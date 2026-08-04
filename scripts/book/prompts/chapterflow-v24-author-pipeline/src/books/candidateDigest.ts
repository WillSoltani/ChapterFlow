import { createHash } from "node:crypto";

import type { ManifestDigest } from "../contracts/v4Core.js";
import type { CandidateEntry, CandidateManifest } from "./candidateTypes.js";

export type CandidateManifestMetadata = Omit<CandidateManifest, "manifestDigest">;

export interface CandidateDigestFile {
  readonly bytes: Uint8Array;
}

function lengthPrefix(length: number): Buffer {
  if (!Number.isSafeInteger(length) || length < 0) throw new Error(`invalid digest byte length: ${length}`);
  const prefix = Buffer.alloc(8);
  prefix.writeBigUInt64BE(BigInt(length));
  return prefix;
}

function stableMetadata(manifest: CandidateManifestMetadata): Record<string, unknown> {
  return {
    schemaVersion: manifest.schemaVersion,
    bookId: manifest.bookId,
    candidateId: manifest.candidateId,
    ...(manifest.parentCandidateId === undefined ? {} : { parentCandidateId: manifest.parentCandidateId }),
    createdByRunId: manifest.createdByRunId,
    entries: manifest.entries.map((entry: CandidateEntry) => ({
      kind: entry.kind,
      logicalPath: entry.logicalPath,
      mediaType: entry.mediaType,
      byteLength: entry.byteLength,
    })),
    createdAt: manifest.createdAt,
  };
}

export function candidateManifestDigest(
  manifest: CandidateManifestMetadata,
  orderedFiles: readonly CandidateDigestFile[],
): ManifestDigest {
  if (orderedFiles.length !== manifest.entries.length) {
    throw new Error("candidate digest requires one ordered byte payload per manifest entry");
  }
  const hash = createHash("sha256");
  const metadataBytes = Buffer.from(JSON.stringify(stableMetadata(manifest)), "utf8");
  hash.update("chapterflow-candidate-manifest-v1\0", "utf8");
  hash.update(lengthPrefix(metadataBytes.byteLength));
  hash.update(metadataBytes);
  orderedFiles.forEach((file, index) => {
    const bytes = Buffer.from(file.bytes.buffer, file.bytes.byteOffset, file.bytes.byteLength);
    if (bytes.byteLength !== manifest.entries[index]?.byteLength) {
      throw new Error(`candidate digest byte length mismatch at entry ${index}`);
    }
    hash.update(lengthPrefix(index));
    hash.update(lengthPrefix(bytes.byteLength));
    hash.update(bytes);
  });
  return hash.digest("hex");
}
