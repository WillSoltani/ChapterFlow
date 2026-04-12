import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { withBookApiErrors, bookErr, bookOk } from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookContentBucket } from "@/app/app/api/book/_lib/env";
import { getServerEnv } from "@/app/app/api/_lib/server-env";
import { getUserEntitlement } from "@/app/app/api/book/_lib/repo";
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildAudioKey, buildContentPrefix } from "@/app/app/api/book/_lib/keys";
import {
  getBookPackageByIdForTone,
  type ToneKey,
} from "@/app/book/data/bookPackages";
// Content types vary between raw packages (ToneKeyed) and tone-resolved packages (string).
// We handle both forms below.

export const runtime = "nodejs";

const s3 = new S3Client({});

type Params = { params: Promise<{ bookId: string; chapterNumber: string }> };

export async function GET(req: Request, ctx: Params) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const bucket = await getBookContentBucket();
    const { bookId, chapterNumber: chapterStr } = await ctx.params;
    const chapterNumber = Number(chapterStr);

    if (!bookId || !Number.isFinite(chapterNumber) || chapterNumber < 1) {
      return bookErr(req, 400, "invalid_params", "Invalid bookId or chapterNumber");
    }

    // Pro gate
    const entitlement = await getUserEntitlement(tableName, user.sub);
    if (entitlement?.plan !== "PRO") {
      return bookErr(req, 403, "pro_required", "Audio mode requires a Pro subscription");
    }

    const url = new URL(req.url);
    const tone = (url.searchParams.get("tone") ?? "direct") as ToneKey;
    const variant = url.searchParams.get("variant") ?? "medium";

    const contentPrefix = buildContentPrefix(bookId, 1);
    const audioKey = buildAudioKey(contentPrefix, chapterNumber, tone, variant);

    // Check if audio already exists in S3
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: audioKey }));
      const signedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket, Key: audioKey }),
        { expiresIn: 3600 },
      );
      return bookOk({ audioUrl: signedUrl, cached: true });
    } catch {
      // Not cached — generate
    }

    // Get OpenAI API key
    const openaiKey = await getServerEnv("OPENAI_API_KEY");
    if (!openaiKey) {
      return bookErr(req, 503, "tts_unavailable", "Audio generation is not available");
    }

    // Load chapter content from local book package (same source as the reader)
    let ttsText = "";
    const pkg = getBookPackageByIdForTone(bookId, tone);
    if (!pkg) {
      return bookErr(req, 404, "book_not_found", "Book package not found");
    }

    const chapter = pkg.chapters.find((ch) => ch.number === chapterNumber);
    if (!chapter) {
      return bookErr(req, 404, "chapter_not_found", "Chapter not found in book package");
    }

    // Extract text from contentVariants.
    // After getBookPackageByIdForTone, ToneKeyed fields are already resolved
    // to plain strings for the requested tone, so we handle both forms.
    const variants = chapter.contentVariants ?? {};
    const v =
      variants[variant as keyof typeof variants] ??
      variants.medium ??
      variants.easy ??
      Object.values(variants)[0];

    if (v) {
      const parts: string[] = [];

      // Resolve a field that may be a string (tone-resolved) or ToneKeyed object
      const resolveText = (val: unknown): string => {
        if (typeof val === "string") return val;
        if (val && typeof val === "object") {
          const obj = val as Record<string, unknown>;
          if (typeof obj[tone] === "string") return obj[tone] as string;
          if (typeof obj.direct === "string") return obj.direct as string;
        }
        return "";
      };

      // Chapter breakdown (the main summary narrative)
      const breakdown = resolveText(v.chapterBreakdown);
      if (breakdown) parts.push(breakdown);

      // Key takeaways with details
      if (v.keyTakeaways && Array.isArray(v.keyTakeaways)) {
        for (const t of v.keyTakeaways) {
          if (typeof t === "string") {
            parts.push(t);
          } else if (t && typeof t === "object") {
            const point = resolveText((t as Record<string, unknown>).point);
            if (point) parts.push(point);
            const details = resolveText((t as Record<string, unknown>).moreDetails);
            if (details) parts.push(details);
          }
        }
      }

      // Plain takeaways fallback
      if (v.takeaways && Array.isArray(v.takeaways)) {
        for (const t of v.takeaways) {
          if (typeof t === "string" && t.trim()) parts.push(t);
        }
      }

      // One-minute recap
      if (v.oneMinuteRecap) {
        const recapText = resolveText(v.oneMinuteRecap);
        if (recapText) {
          parts.push(recapText);
        } else if (typeof v.oneMinuteRecap === "object" && !Array.isArray(v.oneMinuteRecap)) {
          // Structured recap with retrieve/connect/preview
          const recapObj = v.oneMinuteRecap as unknown as Record<string, unknown>;
          for (const section of ["retrieve", "connect", "preview"]) {
            const text = resolveText(recapObj[section]);
            if (text) parts.push(text);
          }
        }
      }

      ttsText = parts.join("\n\n").trim();
    }

    if (!ttsText) {
      return bookErr(req, 404, "no_content", "No text content available for audio");
    }

    // Generate audio via OpenAI TTS (chunk if needed)
    const chunks: Buffer[] = [];
    const maxChunkLen = 4096;
    const textChunks: string[] = [];

    for (let i = 0; i < ttsText.length; i += maxChunkLen) {
      textChunks.push(ttsText.slice(i, i + maxChunkLen));
    }

    for (const chunk of textChunks) {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1-hd",
          input: chunk,
          voice: "nova",
          response_format: "mp3",
        }),
      });

      if (!response.ok) {
        return bookErr(req, 502, "tts_error", "TTS generation failed");
      }

      const arrayBuffer = await response.arrayBuffer();
      chunks.push(Buffer.from(arrayBuffer));
    }

    const audioBuffer = Buffer.concat(chunks);

    // Cache to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: audioKey,
        Body: audioBuffer,
        ContentType: "audio/mpeg",
        CacheControl: "public, max-age=31536000",
      }),
    );

    // Return signed URL
    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: audioKey }),
      { expiresIn: 3600 },
    );

    return bookOk({ audioUrl: signedUrl, cached: false });
  });
}
