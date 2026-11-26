import "server-only";

import { DeleteObjectCommand, ListObjectVersionsCommand } from "@aws-sdk/client-s3";
import { s3 } from "@/app/app/api/_lib/aws";
import { getBookContentBucket } from "./env";
import {
  eraseGreetingAudio,
  type GreetingAudioErasure,
  type GreetingClipVersion,
} from "./erasure-greeting-audio-core";

/**
 * Permanently remove every stored version and delete marker of a reader's
 * spoken-name greeting clips from the content bucket. Never throws: every
 * failure, including a missing bucket setting, comes back as outcome `failed`.
 */
export async function eraseUserGreetingAudio(userId: string): Promise<GreetingAudioErasure> {
  let bucketPromise: Promise<string> | undefined;
  const bucket = () => (bucketPromise ??= getBookContentBucket());

  return eraseGreetingAudio(userId, {
    async listVersions(prefix, abortSignal) {
      const Bucket = await bucket();
      const found: GreetingClipVersion[] = [];
      let KeyMarker: string | undefined;
      let VersionIdMarker: string | undefined;
      let truncated = false;
      do {
        const page = await s3.send(
          new ListObjectVersionsCommand({ Bucket, Prefix: prefix, KeyMarker, VersionIdMarker }),
          { abortSignal },
        );
        for (const entry of [...(page.Versions ?? []), ...(page.DeleteMarkers ?? [])]) {
          if (entry.Key && entry.VersionId) found.push({ key: entry.Key, versionId: entry.VersionId });
        }
        truncated = page.IsTruncated === true;
        KeyMarker = page.NextKeyMarker;
        VersionIdMarker = page.NextVersionIdMarker;
      } while (truncated);
      return found;
    },
    async deleteVersion(version, abortSignal) {
      const Bucket = await bucket();
      await s3.send(
        new DeleteObjectCommand({ Bucket, Key: version.key, VersionId: version.versionId }),
        { abortSignal },
      );
    },
  });
}
