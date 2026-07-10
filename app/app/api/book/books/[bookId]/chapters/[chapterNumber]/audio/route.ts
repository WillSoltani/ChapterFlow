import "server-only";

import { NextResponse } from "next/server";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { resolveBookIdentity } from "@/app/app/api/book/_lib/identity";
import { resolveLearningMode } from "@/app/app/api/book/_lib/learning-mode";
import { withBookApiErrors, bookErr } from "@/app/app/api/book/_lib/http";
import { isBookApiError } from "@/app/app/api/book/_lib/errors";
import { AuthError } from "@/app/app/api/_lib/auth";
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
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerBookPackage } from "@/app/app/api/book/_lib/book-package-source";
import type { ToneKey, VariantKey } from "@/app/book/data/book-package-core";
import {
  buildSegmentPlan,
  getSegmentKeys,
  getSegmentDescriptors,
  buildAudioPlan,
  getTimeOfDay,
  chapterBodySegmentS3Key,
  userGreetingS3Key,
  getUserGreetingScript,
  buildTakeawayText,
  BODY_SEGMENT_TYPES,
  type BodySegmentType,
  type TimeOfDay,
  type NarrationContext,
} from "@/app/app/api/book/_lib/audio-narration";

export const runtime = "nodejs";

const s3 = new S3Client({});

// Presigned segment URLs in the ?mode=plan manifest live for 6 hours — the
// contract minimum (docs/ios/AUDIO-CONTRACT.md §8). The client refreshes by
// re-GETting ?mode=plan; there is no re-sign step.
const PLAN_URL_TTL_SECONDS = 6 * 60 * 60;

// Per-request diagnostic logging is gated behind a debug flag so the audio hot
// path stays quiet in production (CloudWatch cost/noise) and never writes
// user-derived strings (display name, Cognito sub) into logs. Genuine failures
// still use console.error unconditionally.
const AUDIO_DEBUG =
  process.env.NODE_ENV !== "production" || process.env.AUDIO_DEBUG_LOG === "1";

function audioDebug(message: string): void {
  if (AUDIO_DEBUG) console.log(message);
}

type Params = { params: Promise<{ bookId: string; chapterNumber: string }> };

// The tone/variant query params are interpolated into S3 keys used to both read
// and (on cache miss) write TTS segments, so they must be constrained to the
// known key sets. An unvalidated variant lets a caller mint unlimited distinct
// values, each forcing a fresh billable ElevenLabs generation and a new cached
// S3 object (cost amplification / S3 pollution). Validate against the allowed
// sets and 400 on anything else before either value is used in a key.
const VALID_TONES = new Set<ToneKey>(["gentle", "direct", "competitive"]);
const VALID_VARIANTS = new Set<VariantKey>([
  "easy",
  "medium",
  "hard",
  "precise",
  "balanced",
  "challenging",
]);

function isToneKey(value: string): value is ToneKey {
  return VALID_TONES.has(value as ToneKey);
}

function isVariantKey(value: string): value is VariantKey {
  return VALID_VARIANTS.has(value as VariantKey);
}

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

// HEAD a segment object → its byte length, or null if it is absent/unreadable.
// Used by the ?mode=plan path to size each segment without downloading it (the
// stream path, by contrast, needs the bytes and uses loadSegmentFromS3).
async function headContentLength(bucket: string, key: string): Promise<number | null> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return typeof head.ContentLength === "number" ? head.ContentLength : null;
  } catch {
    return null;
  }
}

// Generate ONE user-greeting clip and DURABLY cache it before returning (the
// plan path presigns a URL to this object, so unlike the fire-and-forget stream
// greeting write we must await the PutObject). Returns null on TTS or cache
// failure so the caller drops the segment rather than handing out a dead URL.
async function generateAndCacheGreetingClip(
  bucket: string,
  key: string,
  script: string,
  elevenLabsKey: string,
): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/UgBBYS2sOqTuMpoF3BR0?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": elevenLabsKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buf,
        ContentType: "audio/mpeg",
        CacheControl: "public, max-age=31536000",
      }),
    );
    return buf;
  } catch {
    return null;
  }
}

async function resolveVariantContent(
  bookId: string,
  chapterNumber: number,
  tone: ToneKey,
  variant: string,
) {
  const pkg = await getServerBookPackage(bookId, tone);
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
      const seen = new Set<string>();

      const addTakeaway = (point: string, moreDetails: string) => {
        const key = point.slice(0, 80).toLowerCase();
        if (!point || seen.has(key)) return;
        seen.add(key);
        structured.push({ point, moreDetails });
      };

      // Source 1: summaryBlocks bullets with "Go Deeper" detail
      const summaryBlocks = v.summaryBlocks;
      if (summaryBlocks && Array.isArray(summaryBlocks)) {
        for (const block of summaryBlocks) {
          if (block && typeof block === "object" && (block as Record<string, unknown>).type === "bullet") {
            const text = resolveText((block as Record<string, unknown>).text, tone);
            const detail = resolveText((block as Record<string, unknown>).detail, tone);
            addTakeaway(text, detail);
          }
        }
      }

      // Source 2: keyTakeaways (structured or plain strings)
      const keyTakeaways = v.keyTakeaways;
      if (keyTakeaways && Array.isArray(keyTakeaways)) {
        for (const t of keyTakeaways) {
          if (typeof t === "string" && t.trim()) {
            addTakeaway(t, "");
          } else if (t && typeof t === "object") {
            const point = resolveText((t as Record<string, unknown>).point, tone);
            const details = resolveText((t as Record<string, unknown>).moreDetails, tone);
            addTakeaway(point, details);
          }
        }
      }

      // Source 3: plain takeaways array
      const takeaways = v.takeaways;
      if (Array.isArray(takeaways)) {
        for (const t of takeaways) {
          if (typeof t === "string" && t.trim()) {
            addTakeaway(t, "");
          }
        }
      }

      audioDebug(`[audio] Takeaways extracted: ${structured.length} (from summaryBlocks bullets + keyTakeaways + takeaways)`);

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
  opts?: { awaitCache?: boolean },
): Promise<Buffer | null> {
  const v = await resolveVariantContent(bookId, chapterNumber, tone, variant);
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

  const put = s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: cacheKey,
      Body: buffer,
      ContentType: "audio/mpeg",
      CacheControl: "public, max-age=31536000",
    }),
  );

  // The stream path fires-and-forgets the cache write (it already holds the
  // buffer it needs). The plan path passes awaitCache:true so the object is
  // DURABLY in S3 before we presign a URL to it — a write failure then drops the
  // segment (return null) rather than yielding a URL that would 404.
  if (opts?.awaitCache) {
    try {
      await put;
      audioDebug(`[audio] Cached ${segment}: ${cacheKey} (${buffer.length} bytes)`);
    } catch (err) {
      console.error(`[audio] S3 cache write failed for ${segment}:`, err);
      return null;
    }
  } else {
    put
      .then(() => {
        audioDebug(`[audio] Cached ${segment}: ${cacheKey} (${buffer.length} bytes)`);
      })
      .catch((err) => {
        console.error(`[audio] S3 cache write failed for ${segment}:`, err);
      });
  }

  return buffer;
}

// ── Main handler ─────────────────────────────────────────────────────

export async function GET(req: Request, ctx: Params) {
  return withBookApiErrors(req, () => handleAudioGet(req, ctx));
}

async function handleAudioGet(req: Request, ctx: Params): Promise<NextResponse<unknown>> {
  try {
    const user = await requireActiveBookUser();
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
    const toneParam = url.searchParams.get("tone") ?? "direct";
    const variantParam = url.searchParams.get("variant") ?? "medium";
    if (!isToneKey(toneParam)) {
      return bookErr(req, 400, "invalid_params", "Invalid tone");
    }
    if (!isVariantKey(variantParam)) {
      return bookErr(req, 400, "invalid_params", "Invalid variant");
    }
    const tone: ToneKey = toneParam;
    const variant: VariantKey = variantParam;
    const bucket = await getBookContentBucket();

    const pkg = await getServerBookPackage(bookId, tone);
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

    // Resolve user name with fallbacks (profile → Cognito → email → null)
    const identity = resolveBookIdentity(
      user,
      profile?.profile as Record<string, unknown> | undefined,
    );
    const userName = identity.displayName || null;
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
      // SET-1: resolve through the shared core so narration context
      // (ctx-guided / ctx-challenge) reflects the chosen mode, self-healing for
      // users whose mode lives only under settings.extended. See docs/audit-fixes/SET-1.md.
      learningMode: resolveLearningMode(userSettings?.settings),
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

    audioDebug(
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

    // ── mode=plan: personalized segment MANIFEST as JSON ─────────────────
    //
    // Additive native-client contract (docs/ios/AUDIO-CONTRACT.md §8). It shares
    // this route's ENTIRE preamble above — same auth, entitlement, param
    // validation, user context, and `buildSegmentPlan` — and only the response
    // shape differs: per-segment presigned Range-capable URLs instead of one
    // stitched MP3. The default (no `mode`) stream path below is left untouched.
    if (url.searchParams.get("mode") === "plan") {
      const descriptors = getSegmentDescriptors(plan, narrationCtx, tone, variant);
      const result = await buildAudioPlan(
        descriptors,
        { bookId, chapterNumber, tone, variant },
        {
          headContentLength: (key) => headContentLength(bucket, key),
          presign: (key) =>
            getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
              expiresIn: PLAN_URL_TTL_SECONDS,
            }),
          // Generate the only on-the-fly-generatable segments (the three TTS
          // bodies + the user greeting) when missing, awaiting the durable S3
          // write so the presigned URL is immediately valid.
          generate: async (d) => {
            if (d.type === "userGreeting") {
              if (!elevenLabsKey || !userName) return null;
              const buf = await generateAndCacheGreetingClip(
                bucket,
                d.key,
                getUserGreetingScript(userName, narrationCtx.timeOfDay),
                elevenLabsKey,
              );
              return buf ? buf.length : null;
            }
            if (d.type === "summary" || d.type === "takeaways" || d.type === "recap") {
              if (!elevenLabsKey) return null;
              const buf = await generateAndCacheBodySegment(
                bucket,
                d.key,
                bookId,
                chapterNumber,
                tone,
                variant,
                d.type,
                elevenLabsKey,
                { awaitCache: true },
              );
              return buf ? buf.length : null;
            }
            return null;
          },
          canGenerate: Boolean(elevenLabsKey),
        },
        { ttlSeconds: PLAN_URL_TTL_SECONDS, nowMs: Date.now() },
      );

      if (!result.ok) {
        return bookErr(req, result.status, result.code, result.message);
      }

      audioDebug(
        `[audio] Plan: ${result.plan.segments.length}/${descriptors.length} segments, expires ${result.plan.expiresAt}`,
      );
      return new NextResponse(JSON.stringify(result.plan), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          // Per-user manifest carrying embedded presigned URLs → never
          // shared-cache; the client re-GETs to refresh (see §8).
          "Cache-Control": "private, no-cache",
        },
      });
    }

    // First pass: load all segments from S3 in parallel, identify missing body
    // segments. (Serial awaits here previously added ~11 round-trips of latency
    // to every play; the GETs are independent so they fan out cleanly.)
    const loadResults: Array<{ key: string; buffer: Buffer | null; bodyType: BodySegmentType | null }> =
      await Promise.all(
        segmentKeys.map(async (key) => ({
          key,
          buffer: await loadSegmentFromS3(bucket, key),
          bodyType: bodySegmentKeyMap.get(key) ?? null,
        })),
      );

    // Auto-generate greeting clip if missing and we have a name + API key
    const greetingKey = userName ? userGreetingS3Key(user.sub, narrationCtx.timeOfDay) : null;

    // Log what loaded and what's missing (debug-only — keys can embed user.sub).
    if (AUDIO_DEBUG) {
      for (const { key, buffer, bodyType } of loadResults) {
        if (buffer) {
          audioDebug(`[audio] Loaded: ${key} (${buffer.length} bytes)`);
        } else if (bodyType) {
          audioDebug(`[audio] Missing body segment: ${key} (${bodyType})`);
        } else if (key === greetingKey) {
          audioDebug(`[audio] Missing greeting clip: ${key} (will auto-generate)`);
        } else {
          audioDebug(`[audio] Missing narration segment: ${key}`);
        }
      }
    }

    // Auto-generate missing greeting clip on-the-fly
    if (greetingKey && elevenLabsKey && userName) {
      const greetingResult = loadResults.find((r) => r.key === greetingKey);
      if (greetingResult && !greetingResult.buffer) {
        // Never log the user's display name (PII). The presence of a name is
        // implied by reaching this branch.
        audioDebug(`[audio] Generating greeting clip (${narrationCtx.timeOfDay})...`);
        const allTods: TimeOfDay[] = ["morning", "afternoon", "evening"];
        // Generate all 3 time-of-day greetings in parallel so they're cached for next time
        const greetingResults = await Promise.allSettled(
          allTods.map(async (tod) => {
            const script = getUserGreetingScript(userName, tod);
            const key = userGreetingS3Key(user.sub, tod);
            const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/UgBBYS2sOqTuMpoF3BR0?output_format=mp3_44100_128`, {
              method: "POST",
              headers: { "xi-api-key": elevenLabsKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
              body: JSON.stringify({ text: script, model_id: "eleven_turbo_v2_5", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
            });
            if (!res.ok) return null;
            const buf = Buffer.from(await res.arrayBuffer());
            // Cache to S3
            s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buf, ContentType: "audio/mpeg", CacheControl: "public, max-age=31536000" })).catch(() => {});
            return { tod, buf };
          }),
        );
        // Patch the current greeting into loadResults
        for (const r of greetingResults) {
          if (r.status === "fulfilled" && r.value && r.value.tod === narrationCtx.timeOfDay) {
            greetingResult.buffer = r.value.buf;
            audioDebug(`[audio] Generated greeting (${r.value.buf.length} bytes)`);
          }
        }
      }
    }

    // Generate missing body segments in parallel
    const missingBody = loadResults.filter((r) => !r.buffer && r.bodyType !== null);
    if (missingBody.length > 0 && !elevenLabsKey) {
      console.error("[audio] Body segments missing and no ELEVENLABS_API_KEY set");
      return bookErr(req, 503, "tts_unavailable", "Audio generation is not available — chapter audio has not been cached yet");
    }
    if (missingBody.length > 0 && elevenLabsKey) {
      audioDebug(`[audio] Generating ${missingBody.length} missing body segments in parallel...`);
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
          audioDebug(`[audio] Generated ${missingBody[i].bodyType}: ${missingBody[i].key} (${result.value.length} bytes)`);
        } else if (result.status === "rejected") {
          console.error(`[audio] Failed to generate ${missingBody[i].bodyType}:`, result.reason);
        } else {
          audioDebug(`[audio] No content for ${missingBody[i].bodyType} (empty chapter section)`);
        }
      }
    }

    // Stitch all available segments
    const segmentBuffers: Buffer[] = [];
    for (const { key, buffer } of loadResults) {
      if (buffer) {
        segmentBuffers.push(buffer);
      } else {
        audioDebug(`[audio] Segment skipped: ${key}`);
      }
    }

    if (segmentBuffers.length === 0) {
      return bookErr(req, 404, "no_audio", "No audio segments available");
    }

    const finalAudio = Buffer.concat(segmentBuffers);
    const totalSize = finalAudio.length;

    audioDebug(
      `[audio] Stitched ${segmentBuffers.length}/${segmentKeys.length} segments, total=${totalSize} bytes`,
    );

    // NOTE: we intentionally do NOT cache the stitched MP3 to S3. The stitched
    // result is per-user and per-request (greeting, score callout, streak, and
    // time-of-day segments all vary with user state), so a cached copy would be
    // stale on the next play and was never read back — the previous write-only
    // PutObject under an audio-stitched/<user.sub> key only accumulated dead
    // objects with no lifecycle. The expensive TTS body segments are still
    // cached and reused via chapterBodySegmentS3Key; only the cheap final
    // concat happens per request.

    // Return the full MP3 directly
    return new NextResponse(finalAudio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(totalSize),
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    // Auth/API errors carry their own status (401 signed-out, 403 account,
    // 503 verifier outage) — let withBookApiErrors map them; collapsing them
    // here made every stale-token audio request a 500.
    if (err instanceof AuthError || isBookApiError(err)) throw err;
    console.error("[audio] Unexpected error:", err);
    return bookErr(req, 500, "internal_error", "Audio generation failed");
  }
}
