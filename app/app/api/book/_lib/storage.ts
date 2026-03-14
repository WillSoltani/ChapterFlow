import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  GetObjectCommand,
  PutObjectCommand,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { s3 } from "@/app/app/api/_lib/aws";
import { BookApiError } from "./errors";

async function streamToString(body: GetObjectCommandOutput["Body"]): Promise<string> {
  if (!body) return "";
  if (typeof body.transformToString === "function") {
    return body.transformToString("utf-8");
  }
  const chunks: Uint8Array[] = [];
  const reader = body as AsyncIterable<Uint8Array>;
  for await (const chunk of reader) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export async function readJsonFromS3<T>(bucket: string, key: string): Promise<T> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const text = await streamToString(res.Body);
  if (!text.trim()) {
    throw new BookApiError(422, "empty_content", "Uploaded JSON file is empty.");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new BookApiError(422, "invalid_json", "Uploaded file is not valid JSON.");
  }
}

export async function writeJsonToS3(bucket: string, key: string, payload: unknown): Promise<void> {
  const body = JSON.stringify(payload);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/json; charset=utf-8",
      CacheControl: "no-store",
    })
  );
}

export async function putJsonStringToS3(
  bucket: string,
  key: string,
  jsonString: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: jsonString,
      ContentType: "application/json; charset=utf-8",
      CacheControl: "no-store",
    })
  );
}

export async function createPresignedJsonUploadUrl(
  bucket: string,
  key: string,
  expiresInSeconds = 600
): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: "application/json",
    }),
    { expiresIn: expiresInSeconds }
  );
}
