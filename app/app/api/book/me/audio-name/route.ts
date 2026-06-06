import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, bookErr } from "@/app/app/api/book/_lib/http";
import { getBookContentBucket } from "@/app/app/api/book/_lib/env";
import { getServerEnv } from "@/app/app/api/_lib/server-env";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  userGreetingS3Key,
  getUserGreetingScript,
  type TimeOfDay,
} from "@/app/app/api/book/_lib/audio-narration";

export const runtime = "nodejs";

const s3 = new S3Client({});

const TIMES_OF_DAY: TimeOfDay[] = ["morning", "afternoon", "evening"];

/**
 * POST /api/book/me/audio-name
 * Body: { name: string }
 *
 * Generates 3 TTS greeting clips ("Good morning, Will." / afternoon / evening)
 * and stores them in S3. Called once on Pro signup or when user changes display name.
 */
export async function POST(req: Request) {
  try {
    const user = await requireActiveBookUser();
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name || name.length > 50) {
      return bookErr(req, 400, "invalid_name", "Name must be 1-50 characters");
    }

    const elevenLabsKey = await getServerEnv("ELEVENLABS_API_KEY");
    if (!elevenLabsKey) {
      return bookErr(req, 503, "tts_unavailable", "Audio generation is not available");
    }

    const bucket = await getBookContentBucket();
    const results: Array<{ timeOfDay: TimeOfDay; key: string; bytes: number }> = [];

    for (const tod of TIMES_OF_DAY) {
      const script = getUserGreetingScript(name, tod);
      const key = userGreetingS3Key(user.sub, tod);

      const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/UgBBYS2sOqTuMpoF3BR0?output_format=mp3_44100_128`, {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });

      if (!ttsResponse.ok) {
        console.error(`[audio-name] TTS failed for ${tod}: ${ttsResponse.status}`);
        return bookErr(req, 502, "tts_error", `Failed to generate ${tod} greeting`);
      }

      const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: audioBuffer,
          ContentType: "audio/mpeg",
          CacheControl: "public, max-age=31536000",
        }),
      );

      results.push({ timeOfDay: tod, key, bytes: audioBuffer.length });
    }

    return bookOk({ generated: true, clips: results });
  } catch (err) {
    console.error("[audio-name] Error:", err);
    return bookErr(req, 500, "internal_error", "Greeting generation failed");
  }
}
