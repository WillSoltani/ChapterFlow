import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, bookErr } from "@/app/app/api/book/_lib/http";
import { getBookContentBucket } from "@/app/app/api/book/_lib/env";
import { getServerEnv } from "@/app/app/api/_lib/server-env";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { userNameS3Key } from "@/app/app/api/book/_lib/audio-narration";

export const runtime = "nodejs";

const s3 = new S3Client({});

/**
 * POST /api/book/me/audio-name
 * Body: { name: string }
 *
 * Generates a TTS clip of the user's name and stores it in S3.
 * Called once (on Pro signup or when user changes display name).
 * Idempotent — re-generating overwrites the previous clip.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name || name.length > 50) {
      return bookErr(req, 400, "invalid_name", "Name must be 1-50 characters");
    }

    const openaiKey = await getServerEnv("OPENAI_API_KEY");
    if (!openaiKey) {
      return bookErr(req, 503, "tts_unavailable", "Audio generation is not available");
    }

    const bucket = await getBookContentBucket();
    const key = userNameS3Key(user.sub);

    // Generate TTS of just the name
    const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: name,
        voice: "nova",
        response_format: "mp3",
      }),
    });

    if (!ttsResponse.ok) {
      return bookErr(req, 502, "tts_error", "Failed to generate name audio");
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

    return bookOk({ generated: true, key, bytes: audioBuffer.length });
  } catch (err) {
    console.error("[audio-name] Error:", err);
    return bookErr(req, 500, "internal_error", "Name audio generation failed");
  }
}
