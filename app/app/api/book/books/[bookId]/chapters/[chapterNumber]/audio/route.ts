import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { withBookApiErrors, bookErr, bookOk } from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookContentBucket } from "@/app/app/api/book/_lib/env";
import { getServerEnv } from "@/app/app/api/_lib/server-env";
import { getUserEntitlement } from "@/app/app/api/book/_lib/repo";
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildAudioKey, buildContentPrefix } from "@/app/app/api/book/_lib/keys";

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
    const tone = url.searchParams.get("tone") ?? "direct";
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

    // Load chapter content for TTS
    const chapterKey = `${contentPrefix}/chapters/${String(chapterNumber).padStart(4, "0")}.json`;
    let ttsText = "";
    try {
      const chObj = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: chapterKey }),
      );
      const chText = await chObj.Body?.transformToString("utf-8");
      if (!chText) throw new Error("Empty chapter");
      const chapter = JSON.parse(chText);
      const variants = chapter.contentVariants ?? {};
      const v = variants[variant] ?? variants.medium ?? Object.values(variants)[0];
      const breakdown = v?.chapterBreakdown?.[tone] ?? v?.chapterBreakdown?.direct ?? "";
      const takeaways = (v?.keyTakeaways ?? [])
        .map((t: { point?: Record<string, string> }) => t.point?.[tone] ?? t.point?.direct ?? "")
        .filter(Boolean)
        .join(". ");
      ttsText = `${breakdown}\n\n${takeaways}`.trim();
    } catch {
      return bookErr(req, 404, "chapter_not_found", "Chapter content not found");
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
