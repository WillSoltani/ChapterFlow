import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { bookErr } from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookContentBucket } from "@/app/app/api/book/_lib/env";
import { getServerEnv } from "@/app/app/api/_lib/server-env";
import {
  getUserEntitlement,
  getUserProgress,
  getUserQuizState,
  getUserProfileItem,
  getUserSettingsItem,
} from "@/app/app/api/book/_lib/repo";
import { getOrCreateStreak } from "@/app/app/api/book/_lib/streak-repo";
import { getOrCreateTier } from "@/app/app/api/book/_lib/tier-repo";
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import {
  getBookPackageByIdForTone,
  type ToneKey,
} from "@/app/book/data/bookPackages";
import {
  buildSegmentPlan,
  getSegmentKeys,
  getTimeOfDay,
  chapterBodySegmentS3Key,
  buildTakeawayText,
  BODY_SEGMENT_TYPES,
  type BodySegmentType,
  type NarrationContext,
} from "@/app/app/api/book/_lib/audio-narration";

export const runtime = "nodejs";

const s3 = new S3Client({});

type Params = { params: Promise<{ bookId: string; chapterNumber: string }> };

// ── Helpers ──────────────────────────────────────────────────────────

async function loadSegmentFromS3(bucket: string, key: string): Promise<Buffer | null> {
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) return null;
    const bytes = await result.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch {
    return null;
  }
}

function resolveVariantContent(
  bookId: string,
  chapterNumber: number,
  tone: ToneKey,
  variant: string,
) {
  const pkg = getBookPackageByIdForTone(bookId, tone);
  if (!pkg) return null;
  const chapter = pkg.chapters.find((ch) => ch.number === chapterNumber);
  if (!chapter) return null;
  const variants = chapter.contentVariants ?? {};
  const v =
    variants[variant as keyof typeof variants] ??
    variants.medium ??
    variants.easy ??
    Object.values(variants)[0] ??
    null;
  return v;
}

function resolveText(val: unknown, tone: string): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (typeof obj[tone] === "string") return obj[tone] as string;
    if (typeof obj.direct === "string") return obj.direct as string;
  }
  return "";
}

function extractSegmentText(
  v: Record<string, unknown>,
  segment: BodySegmentType,
  tone: string,
): string {
  const parts: string[] = [];

  switch (segment) {
    case "summary": {
      const breakdown = resolveText(v.chapterBreakdown, tone);
      if (breakdown) parts.push(breakdown);
      break;
    }
    case "takeaways": {
      const structured: Array<{ point: string; moreDetails: string }> = [];

      // Primary source: summaryBlocks bullets with "Go Deeper" detail
      const summaryBlocks = v.summaryBlocks;
      if (summaryBlocks && Array.isArray(summaryBlocks)) {
        for (const block of summaryBlocks) {
          if (
            block &&
            typeof block === "object" &&
            (block as Record<string, unknown>).type === "bullet"
          ) {
            const text = resolveText((block as Record<string, unknown>).text, tone);
            const detail = resolveText((block as Record<string, unknown>).detail, tone);
            if (text) structured.push({ point: text, moreDetails: detail });
          }
        }
      }

      // Fallback: keyTakeaways (if no summaryBlocks bullets found)
      if (structured.length === 0) {
        const keyTakeaways = v.keyTakeaways;
        if (keyTakeaways && Array.isArray(keyTakeaways)) {
          for (const t of keyTakeaways) {
            if (typeof t === "string" && t.trim()) {
              structured.push({ point: t, moreDetails: "" });
            } else if (t && typeof t === "object") {
              const point = resolveText((t as Record<string, unknown>).point, tone);
              const details = resolveText((t as Record<string, unknown>).moreDetails, tone);
              if (point) structured.push({ point, moreDetails: details });
            }
          }
        }
      }

      // Last fallback: plain takeaways array
      if (structured.length === 0) {
        const takeaways = v.takeaways;
        if (Array.isArray(takeaways)) {
          for (const t of takeaways) {
            if (typeof t === "string" && t.trim()) {
              structured.push({ point: t, moreDetails: "" });
            }
          }
        }
      }

      const connectedText = buildTakeawayText(structured);
      if (connectedText) parts.push(connectedText);
      break;
    }
    case "recap": {
      const recap = v.oneMinuteRecap;
      if (recap) {
        const recapText = resolveText(recap, tone);
        if (recapText) {
          parts.push(recapText);
        } else if (typeof recap === "object" && !Array.isArray(recap)) {
          const recapObj = recap as Record<string, unknown>;
          for (const section of ["retrieve", "connect", "preview"]) {
            const text = resolveText(recapObj[section], tone);
            if (text) parts.push(text);
          }
        }
      }
      break;
    }
  }

  return parts.join("\n\n").trim();
}

async function generateAndCacheBodySegment(
  bucket: string,
  cacheKey: string,
  bookId: string,
  chapterNumber: number,
  tone: ToneKey,
  variant: string,
  segment: BodySegmentType,
  elevenLabsKey: string,
): Promise<Buffer | null> {
  const v = resolveVariantContent(bookId, chapterNumber, tone, variant);
  if (!v) return null;

  const ttsText = extractSegmentText(v as Record<string, unknown>, segment, tone);
  if (!ttsText) return null;

  // Chunk at 4096 chars on paragraph boundaries
  const MAX_CHUNK = 4096;
  const textChunks: string[] = [];
  if (ttsText.length <= MAX_CHUNK) {
    textChunks.push(ttsText);
  } else {
    const paragraphs = ttsText.split("\n\n");
    let current = "";
    for (const para of paragraphs) {
      if (current && (current.length + para.length + 2) > MAX_CHUNK) {
        textChunks.push(current.trim());
        current = para;
      } else {
        current = current ? `${current}\n\n${para}` : para;
      }
    }
    if (current.trim()) textChunks.push(current.trim());
  }

  // Generate TTS for each chunk
  const audioChunks: Buffer[] = [];
  for (const chunk of textChunks) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/UgBBYS2sOqTuMpoF3BR0?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": elevenLabsKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: chunk,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!res.ok) {
      let errBody = "";
      try { errBody = await res.text(); } catch {}
      console.error(`[audio] TTS failed for ${segment}: ${res.status} ${errBody.slice(0, 300)}`);
      return null;
    }
    audioChunks.push(Buffer.from(await res.arrayBuffer()));
  }

  const buffer = Buffer.concat(audioChunks);

  // Cache to S3 in background
  s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: cacheKey,
      Body: buffer,
      ContentType: "audio/mpeg",
      CacheControl: "public, max-age=31536000",
    }),
  ).then(() => {
    console.log(`[audio] Cached ${segment}: ${cacheKey} (${buffer.length} bytes)`);
  }).catch((err) => {
    console.error(`[audio] S3 cache write failed for ${segment}:`, err);
  });

  return buffer;
}

// ── Main handler ─────────────────────────────────────────────────────

export async function GET(req: Request, ctx: Params) {
  try {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const { bookId, chapterNumber: chapterStr } = await ctx.params;
    const chapterNumber = Number(chapterStr);

    if (!bookId || !Number.isFinite(chapterNumber) || chapterNumber < 1) {
      return bookErr(req, 400, "invalid_params", "Invalid bookId or chapterNumber");
    }

    const entitlement = await getUserEntitlement(tableName, user.sub);
    if (entitlement?.plan !== "PRO") {
      return bookErr(req, 403, "pro_required", "Audio mode requires a Pro subscription");
    }

    const url = new URL(req.url);
    const tone = (url.searchParams.get("tone") ?? "direct") as ToneKey;
    const variant = url.searchParams.get("variant") ?? "medium";
    const bucket = await getBookContentBucket();

    const pkg = getBookPackageByIdForTone(bookId, tone);
    if (!pkg) return bookErr(req, 404, "book_not_found", "Book not found");
    const totalChapters = pkg.chapters.length;

    // Gather user context in parallel
    const [profile, streak, tier, progress, userSettings, prevQuizState, prevPrevQuizState] =
      await Promise.all([
        getUserProfileItem(tableName, user.sub),
        getOrCreateStreak(tableName, user.sub),
        getOrCreateTier(tableName, user.sub),
        getUserProgress(tableName, user.sub, bookId),
        getUserSettingsItem(tableName, user.sub),
        chapterNumber > 1
          ? getUserQuizState(tableName, user.sub, bookId, chapterNumber - 1)
          : Promise.resolve(null),
        chapterNumber > 2
          ? getUserQuizState(tableName, user.sub, bookId, chapterNumber - 2)
          : Promise.resolve(null),
      ]);

    const userName =
      (profile?.profile as Record<string, unknown> | undefined)?.displayName as string | null ?? null;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    const booksCompleted = Object.values(tier.completedBooksByCategory ?? {}).flat().length;

    let daysSinceLastSession = 0;
    if (streak.lastActiveDate) {
      const last = new Date(streak.lastActiveDate + "T00:00:00Z");
      const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
      daysSinceLastSession = Math.floor((today.getTime() - last.getTime()) / 86400000);
    }

    const narrationCtx: NarrationContext = {
      userName,
      userId: user.sub,
      bookId,
      bookTitle: pkg.book.title,
      authorName: pkg.book.author,
      chapterNumber,
      totalChapters,
      previousChapterScore: prevQuizState?.highestScorePercent ?? null,
      previousChapterScoreBefore: prevPrevQuizState?.highestScorePercent ?? null,
      currentStreak: streak.currentStreak,
      daysSinceLastSession,
      totalChaptersCompleted: tier.totalLoopsCompleted,
      booksCompleted,
      learningMode: (() => {
        const mode = (userSettings?.settings as Record<string, unknown> | undefined)?.learningMode;
        if (mode === "guided") return "guided" as const;
        if (mode === "challenge") return "challenge" as const;
        return "standard" as const;
      })(),
      isFirstEverChapter: tier.totalLoopsCompleted === 0 && chapterNumber === 1,
      isFirstChapterOfBook: chapterNumber === 1,
      isLastChapterOfBook: chapterNumber === totalChapters,
      isHalfwayThroughBook:
        totalChapters > 2 && chapterNumber === Math.ceil(totalChapters / 2),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isLateNight: hour >= 22 || hour < 5,
      timeOfDay: getTimeOfDay(),
    };

    // Build narration plan and get ordered segment keys
    const plan = buildSegmentPlan(narrationCtx);
    const segmentKeys = getSegmentKeys(plan, narrationCtx, tone, variant);

    console.log(
      `[audio] Plan: greeting=${plan.greetingId} score=${plan.scoreId} transition=${plan.transitionId} closing=${plan.closingId} segments=${segmentKeys.length}`,
    );

    // Identify which body segments might need on-the-fly generation
    const bodySegmentKeyMap = new Map<string, BodySegmentType>();
    for (const seg of BODY_SEGMENT_TYPES) {
      bodySegmentKeyMap.set(
        chapterBodySegmentS3Key(bookId, chapterNumber, tone, variant, seg),
        seg,
      );
    }

    const elevenLabsKey = await getServerEnv("ELEVENLABS_API_KEY");

    // First pass: load all segments from S3, identify missing body segments
    const loadResults: Array<{ key: string; buffer: Buffer | null; bodyType: BodySegmentType | null }> = [];
    for (const key of segmentKeys) {
      const buffer = await loadSegmentFromS3(bucket, key);
      loadResults.push({ key, buffer, bodyType: bodySegmentKeyMap.get(key) ?? null });
    }

    // Log what loaded and what's missing
    for (const { key, buffer, bodyType } of loadResults) {
      if (buffer) {
        console.log(`[audio] Loaded: ${key} (${buffer.length} bytes)`);
      } else if (bodyType) {
        console.log(`[audio] Missing body segment: ${key} (${bodyType})`);
      } else {
        console.log(`[audio] Missing narration segment: ${key}`);
      }
    }

    // Generate missing body segments in parallel
    const missingBody = loadResults.filter((r) => !r.buffer && r.bodyType !== null);
    if (missingBody.length > 0 && !elevenLabsKey) {
      console.error("[audio] Body segments missing and no ELEVENLABS_API_KEY set");
      return bookErr(req, 503, "tts_unavailable", "Audio generation is not available — chapter audio has not been cached yet");
    }
    if (missingBody.length > 0 && elevenLabsKey) {
      console.log(`[audio] Generating ${missingBody.length} missing body segments in parallel...`);
      const generated = await Promise.allSettled(
        missingBody.map((r) =>
          generateAndCacheBodySegment(
            bucket, r.key, bookId, chapterNumber, tone, variant, r.bodyType!, elevenLabsKey,
          ),
        ),
      );
      // Patch results — handle both fulfilled and rejected
      for (let i = 0; i < missingBody.length; i++) {
        const result = generated[i];
        const idx = loadResults.indexOf(missingBody[i]);
        if (idx >= 0 && result.status === "fulfilled" && result.value) {
          loadResults[idx].buffer = result.value;
          console.log(`[audio] Generated ${missingBody[i].bodyType}: ${missingBody[i].key} (${result.value.length} bytes)`);
        } else if (result.status === "rejected") {
          console.error(`[audio] Failed to generate ${missingBody[i].bodyType}:`, result.reason);
        } else {
          console.log(`[audio] No content for ${missingBody[i].bodyType} (empty chapter section)`);
        }
      }
    }

    // Stitch all available segments
    const segmentBuffers: Buffer[] = [];
    for (const { key, buffer } of loadResults) {
      if (buffer) {
        segmentBuffers.push(buffer);
      } else {
        console.log(`[audio] Segment skipped: ${key}`);
      }
    }

    if (segmentBuffers.length === 0) {
      return bookErr(req, 404, "no_audio", "No audio segments available");
    }

    const finalAudio = Buffer.concat(segmentBuffers);
    const totalSize = finalAudio.length;

    console.log(
      `[audio] Stitched ${segmentBuffers.length}/${segmentKeys.length} segments, total=${totalSize} bytes`,
    );

    // Cache stitched audio to S3 for future range requests (fire-and-forget)
    const stitchedKey = `book-content/audio-stitched/${bookId}/ch${String(chapterNumber).padStart(4, "0")}.${tone}.${variant}.${user.sub}.mp3`;
    s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: stitchedKey,
        Body: finalAudio,
        ContentType: "audio/mpeg",
        CacheControl: "public, max-age=3600",
      }),
    ).then(() => {
      console.log(`[audio] Cached stitched audio to S3: ${stitchedKey}`);
    }).catch((err) => {
      console.error("[audio] Failed to cache stitched audio:", err);
    });

    // Return the full MP3 directly
    return new Response(finalAudio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(totalSize),
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[audio] Unexpected error:", err);
    return bookErr(req, 500, "internal_error", "Audio generation failed");
  }
}
