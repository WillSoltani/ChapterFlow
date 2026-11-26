import "server-only";

import { NextResponse } from "next/server";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { resolveBookIdentity } from "@/app/app/api/book/_lib/identity";
import { resolveLearningMode } from "@/app/app/api/book/_lib/learning-mode";
import { withBookApiErrors, bookErr, enforceDailyUserLimit } from "@/app/app/api/book/_lib/http";
import { dailyLimitDateKey } from "@/app/app/api/book/_lib/http-guards-core";
import { getUserAccessibleChapter } from "@/app/app/api/book/_lib/content-service";
import { bookUserPk } from "@/app/app/api/book/_lib/keys";
import { isBookApiError } from "@/app/app/api/book/_lib/errors";
import { AuthError } from "@/app/app/api/_lib/auth";
import { getBookTableName, getBookContentBucket } from "@/app/app/api/book/_lib/env";
import { getServerEnv } from "@/app/app/api/_lib/server-env";
import {
  getUserEntitlement,
  getUserQuizState,
  getUserProfileItem,
  getUserSettingsItem,
} from "@/app/app/api/book/_lib/repo";
import { getOrCreateStreak } from "@/app/app/api/book/_lib/streak-repo";
import { getOrCreateTier } from "@/app/app/api/book/_lib/tier-repo";
import { GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "@/app/app/api/_lib/aws";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerBookPackage } from "@/app/app/api/book/_lib/book-package-source";
import type { ToneKey, VariantKey } from "@/app/book/data/book-package-core";
import {
  buildSegmentPlan,
  getSegmentKeys,
  getSegmentDescriptors,
  buildAudioPlan,
  getTimeOfDay,
  chapterBodyClipS3Key,
  splitSpeechText,
  userGreetingS3Key,
  getUserGreetingScript,
  buildTakeawayText,
  selectBodySegmentsToGenerate,
  BODY_SEGMENT_TYPES,
  SPEECH_SETTINGS,
  TTS_UNAVAILABLE_MESSAGE,
  type BodyClipKeys,
  type BodySegmentType,
  type TimeOfDay,
  type NarrationContext,
} from "@/app/app/api/book/_lib/audio-narration";
import { logger } from "@/lib/logging/logger";
import {
  AUDIO_GENERATION_DAILY_LIMIT,
  audioGenerationLimitSk,
  createGenerationReservation,
} from "./audio-generation-limit-core";

export const runtime = "nodejs";

// Presigned segment URLs in the ?mode=plan manifest live for 6 hours — the
// contract minimum (docs/ios/AUDIO-CONTRACT.md §8). The client refreshes by
// re-GETting ?mode=plan; there is no re-sign step.
const PLAN_URL_TTL_SECONDS = 6 * 60 * 60;

// Per-request diagnostic logging is gated behind a debug flag so the audio hot
// path stays quiet in production (CloudWatch cost/noise) and never writes
// user-derived strings (display name, Cognito sub) into logs. Genuine failures
// still log via logger.error unconditionally.
const AUDIO_DEBUG =
  process.env.NODE_ENV !== "production" || process.env.AUDIO_DEBUG_LOG === "1";

function audioDebug(message: string): void {
  if (AUDIO_DEBUG) logger.info("audio_debug", { message });
}

type Params = { params: Promise<{ bookId: string; chapterNumber: string }> };

// The tone/variant query params select the chapter text that is spoken; they
// are not part of any S3 key (body clips are named by the text itself). They
// are still constrained to the known sets and answer 400 on anything else.
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
      return bookErr(req, 403, "pro_required", "Listening to chapters is part of Pro. Upgrade to listen.");
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

    // Same gate as the chapter text route: the book is started and this chapter
    // is unlocked for this reader (403 book_not_started / chapter_locked).
    await getUserAccessibleChapter({
      tableName,
      contentBucket: bucket,
      userId: user.sub,
      bookId,
      chapterNumber,
    });

    // The chapter's text for each body segment, read once per request, with the
    // chunks sent to speech and the clip name derived from them. A body segment
    // with no text gets no name: it is not missing audio, never causes 503 and
    // never reserves a daily generation unit.
    const bodyTexts: Partial<Record<BodySegmentType, string>> = {};
    const bodyChunks: Partial<Record<BodySegmentType, string[]>> = {};
    const bodyKeys: BodyClipKeys = {};
    const variantContent = await resolveVariantContent(bookId, chapterNumber, tone, variant);
    if (variantContent) {
      for (const seg of BODY_SEGMENT_TYPES) {
        const text = extractSegmentText(variantContent as Record<string, unknown>, seg, tone);
        bodyTexts[seg] = text;
        if (!text) continue;
        const chunks = splitSpeechText(text);
        bodyChunks[seg] = chunks;
        bodyKeys[seg] = chapterBodyClipS3Key(bookId, chapterNumber, seg, chunks);
      }
    }

    // A chapter without summary text has no chapter audio to offer.
    if (!bodyTexts.summary) {
      return bookErr(req, 404, "no_audio", "No audio segments available");
    }

    // Paid speech generation is capped per user per day. Cached clips are free;
    // a request that generates anything reserves one unit, once.
    const reserveGeneration = createGenerationReservation(() =>
      enforceDailyUserLimit({
        tableName,
        userPk: bookUserPk(user.sub),
        counterSk: audioGenerationLimitSk(dailyLimitDateKey()),
        limit: AUDIO_GENERATION_DAILY_LIMIT,
        entity: "BOOK_AUDIO_TTS_COUNT",
        resource: "new chapter audio",
      }),
    );

    // A greeting never blocks a listen: when the daily limit refuses the
    // reservation, the greeting is skipped. A body clip that still needs
    // generation is then refused by the same (remembered) reservation.
    const reserveForGreeting = async (): Promise<boolean> => {
      try {
        await reserveGeneration();
        return true;
      } catch (err) {
        if (isBookApiError(err) && err.status === 429) return false;
        throw err;
      }
    };

    // Gather user context in parallel
    const [profile, streak, tier, userSettings, prevQuizState, prevPrevQuizState] =
      await Promise.all([
        getUserProfileItem(tableName, user.sub),
        getOrCreateStreak(tableName, user.sub),
        getOrCreateTier(tableName, user.sub),
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
    const segmentKeys = getSegmentKeys(plan, narrationCtx, bodyKeys);

    audioDebug(
      `[audio] Plan: greeting=${plan.greetingId} score=${plan.scoreId} transition=${plan.transitionId} closing=${plan.closingId} segments=${segmentKeys.length}`,
    );

    // Identify which body segments might need on-the-fly generation
    const bodySegmentKeyMap = new Map<string, BodySegmentType>();
    for (const seg of BODY_SEGMENT_TYPES) {
      const key = bodyKeys[seg];
      if (key) bodySegmentKeyMap.set(key, seg);
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
      const descriptors = getSegmentDescriptors(plan, narrationCtx, bodyKeys);
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
          // write so the presigned URL is immediately valid. A clip that was
          // not stored has no object to link, so it counts as not produced.
          generate: async (d) => {
            if (d.type === "userGreeting") {
              if (!elevenLabsKey || !userName) return null;
              if (!(await reserveForGreeting())) return null;
              const clip = await generateGreetingClip(
                bucket,
                d.key,
                narrationCtx.timeOfDay,
                getUserGreetingScript(userName, narrationCtx.timeOfDay),
                elevenLabsKey,
              );
              return clip.audio && clip.stored ? clip.audio.length : null;
            }
            if (d.type === "summary" || d.type === "takeaways" || d.type === "recap") {
              const chunks = bodyChunks[d.type];
              if (!elevenLabsKey || !chunks) return null;
              // A daily-limit refusal (429) propagates out of buildAudioPlan.
              await reserveGeneration();
              const clip = await generateBodyClip(bucket, d.key, d.type, chunks, elevenLabsKey);
              return clip.audio && clip.stored ? clip.audio.length : null;
            }
            return null;
          },
          canGenerate: Boolean(elevenLabsKey),
          hasContent: (d) =>
            d.type === "summary" || d.type === "takeaways" || d.type === "recap"
              ? Boolean(bodyTexts[d.type])
              : true,
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
    const greetingKey = userName ? userGreetingS3Key(user.sub, narrationCtx.timeOfDay, userName) : null;

    // Log what loaded and what's missing (debug-only). The per-user greeting key
    // carries the user id, so it is logged by its time of day only.
    if (AUDIO_DEBUG) {
      for (const { key, buffer, bodyType } of loadResults) {
        const label = key === greetingKey ? `user greeting (${narrationCtx.timeOfDay})` : key;
        if (buffer) {
          audioDebug(`[audio] Loaded: ${label} (${buffer.length} bytes)`);
        } else if (bodyType) {
          audioDebug(`[audio] Missing body segment: ${key} (${bodyType})`);
        } else if (key === greetingKey) {
          audioDebug(`[audio] Missing greeting clip: ${label} (will auto-generate)`);
        } else {
          audioDebug(`[audio] Missing narration segment: ${key}`);
        }
      }
    }

    // Auto-generate missing greeting clip on-the-fly
    if (greetingKey && elevenLabsKey && userName) {
      const greetingResult = loadResults.find((r) => r.key === greetingKey);
      if (greetingResult && !greetingResult.buffer && (await reserveForGreeting())) {
        // Never log the user's display name (PII). The presence of a name is
        // implied by reaching this branch.
        audioDebug(`[audio] Generating greeting clip (${narrationCtx.timeOfDay})...`);
        const allTods: TimeOfDay[] = ["morning", "afternoon", "evening"];
        // Generate all 3 time-of-day greetings in parallel so they're cached for
        // next time; every write is awaited before the response.
        const greetingResults = await Promise.all(
          allTods.map(async (tod) => ({
            tod,
            clip: await generateGreetingClip(
              bucket,
              userGreetingS3Key(user.sub, tod, userName),
              tod,
              getUserGreetingScript(userName, tod),
              elevenLabsKey,
            ),
          })),
        );
        // Patch the current greeting into loadResults
        for (const { tod, clip } of greetingResults) {
          if (clip.audio && tod === narrationCtx.timeOfDay) {
            greetingResult.buffer = clip.audio;
            audioDebug(`[audio] Generated greeting (${clip.audio.length} bytes)`);
          }
        }
      }
    }

    // Generate missing body segments in parallel (only those with text)
    const missingBody = selectBodySegmentsToGenerate(loadResults, bodyTexts);
    if (missingBody.length > 0 && !elevenLabsKey) {
      logger.error("audio_body_segments_missing_no_api_key", { bookId, chapterNumber });
      return bookErr(req, 503, "tts_unavailable", TTS_UNAVAILABLE_MESSAGE);
    }
    if (missingBody.length > 0 && elevenLabsKey) {
      await reserveGeneration();
      audioDebug(`[audio] Generating ${missingBody.length} missing body segments in parallel...`);
      const generated = await Promise.all(
        missingBody.map((r) => {
          const chunks = r.bodyType ? bodyChunks[r.bodyType] : undefined;
          if (!r.bodyType || !chunks) return Promise.resolve<GeneratedClip>({ audio: null, stored: false });
          return generateBodyClip(bucket, r.key, r.bodyType, chunks, elevenLabsKey);
        }),
      );
      // Patch the generated audio in place. A segment with text that could not
      // be spoken means the chapter audio is not ready: answer 503 rather than
      // audio with a part missing. Parts spoken in this request stay stored.
      let allGenerated = true;
      missingBody.forEach((seg, i) => {
        const audio = generated[i]?.audio;
        if (audio) {
          seg.buffer = audio;
          audioDebug(`[audio] Generated ${seg.bodyType}: ${seg.key} (${audio.length} bytes)`);
        } else {
          allGenerated = false;
        }
      });
      if (!allGenerated) {
        return bookErr(req, 503, "tts_unavailable", TTS_UNAVAILABLE_MESSAGE);
      }
    }

    // Stitch all available segments
    const segmentBuffers: Buffer[] = [];
    for (const { key, buffer } of loadResults) {
      if (buffer) {
        segmentBuffers.push(buffer);
      } else {
        audioDebug(
          `[audio] Segment skipped: ${key === greetingKey ? `user greeting (${narrationCtx.timeOfDay})` : key}`,
        );
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
    // cached and reused via chapterBodyClipS3Key; only the cheap final
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
    logger.error("audio_unexpected_error", { err });
    return bookErr(req, 500, "internal_error", "Audio generation failed");
  }
}

// ── Speech clips ─────────────────────────────────────────────────────

const SPEECH_URL = `https://api.elevenlabs.io/v1/text-to-speech/${SPEECH_SETTINGS.voiceId}?output_format=${SPEECH_SETTINGS.outputFormat}`;

// The one speech call of this route (body clips and greetings). Speaks the
// chunks in order and returns the joined audio, or null on any failure. Never
// throws: a network error or an answer without audio is a failure like a
// non-2xx answer. Logs one
// audio_tts_ok or audio_tts_failed line; never the text, the key, a user id or
// a name.
async function synthesizeClip(
  segment: string,
  chunks: readonly string[],
  elevenLabsKey: string,
): Promise<Buffer | null> {
  const started = Date.now();
  const characters = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const audioChunks: Buffer[] = [];
  for (let i = 0; i < chunks.length; i++) {
    let res: Response;
    try {
      res = await fetch(SPEECH_URL, {
        method: "POST",
        headers: { "xi-api-key": elevenLabsKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text: chunks[i],
          model_id: SPEECH_SETTINGS.modelId,
          voice_settings: SPEECH_SETTINGS.voiceSettings,
        }),
      });
      if (res.ok) {
        const audio = Buffer.from(await res.arrayBuffer());
        if (audio.length > 0) {
          audioChunks.push(audio);
          continue;
        }
        // A 2xx answer without audio is a failure too: an empty clip must
        // never be stored under a content name, where it would stay.
        logger.error("audio_tts_failed", {
          segment,
          kind: "empty",
          status: res.status,
          chunk: i,
          characters,
          ms: Date.now() - started,
        });
        return null;
      }
    } catch {
      logger.error("audio_tts_failed", {
        segment,
        kind: "network",
        chunk: i,
        characters,
        ms: Date.now() - started,
      });
      return null;
    }
    try {
      await res.body?.cancel();
    } catch {}
    logger.error("audio_tts_failed", {
      segment,
      kind: "http",
      status: res.status,
      chunk: i,
      characters,
      ms: Date.now() - started,
    });
    return null;
  }
  logger.info("audio_tts_ok", {
    segment,
    chunks: chunks.length,
    characters,
    ms: Date.now() - started,
  });
  return Buffer.concat(audioChunks);
}

// Write a generated clip and wait for the write to finish.
async function storeClip(
  bucket: string,
  key: string,
  audio: Buffer,
): Promise<{ stored: true } | { stored: false; err: unknown }> {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: audio,
        ContentType: "audio/mpeg",
        CacheControl: "public, max-age=31536000",
      }),
    );
    return { stored: true };
  } catch (err) {
    return { stored: false, err };
  }
}

type GeneratedClip = { audio: Buffer | null; stored: boolean };

// Speak a chapter body clip and store it under its content name. audio is
// null when speech failed; stored is false when the write failed (logged).
async function generateBodyClip(
  bucket: string,
  key: string,
  segment: BodySegmentType,
  chunks: readonly string[],
  elevenLabsKey: string,
): Promise<GeneratedClip> {
  const audio = await synthesizeClip(segment, chunks, elevenLabsKey);
  if (!audio) return { audio: null, stored: false };
  const write = await storeClip(bucket, key, audio);
  if (!write.stored) {
    logger.error("audio_s3_cache_write_failed", { segment, cacheKey: key, err: write.err });
    return { audio, stored: false };
  }
  audioDebug(`[audio] Cached ${segment}: ${key} (${audio.length} bytes)`);
  return { audio, stored: true };
}

// Speak one per-user greeting clip and store it. The key and the script carry
// the user id and name, so a failure logs the time of day only.
async function generateGreetingClip(
  bucket: string,
  key: string,
  timeOfDay: TimeOfDay,
  script: string,
  elevenLabsKey: string,
): Promise<GeneratedClip> {
  const audio = await synthesizeClip("userGreeting", [script], elevenLabsKey);
  if (!audio) return { audio: null, stored: false };
  const write = await storeClip(bucket, key, audio);
  if (!write.stored) {
    logger.error("audio_s3_cache_write_failed", {
      segment: "userGreeting",
      timeOfDay,
      errorName: write.err instanceof Error ? write.err.name : "unknown",
    });
    return { audio, stored: false };
  }
  return { audio, stored: true };
}
