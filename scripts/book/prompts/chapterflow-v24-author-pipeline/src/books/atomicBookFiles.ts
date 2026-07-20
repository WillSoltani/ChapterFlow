import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type AtomicBookPoint =
  | "file.before-temp-write"
  | "file.after-temp-write"
  | "file.before-replace"
  | "file.after-replace"
  | "candidate.before-finalize"
  | "candidate.after-finalize";

export interface AtomicBookFileSeams {
  readonly point?: (name: AtomicBookPoint) => void;
  readonly tempSuffix?: () => string;
}

function suffix(seams: AtomicBookFileSeams): string {
  return seams.tempSuffix?.() ?? `${process.pid}-${randomBytes(8).toString("hex")}`;
}

export async function replaceFileAtomic(
  filePath: string,
  bytes: Uint8Array,
  seams: AtomicBookFileSeams = {},
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${suffix(seams)}`;
  try {
    seams.point?.("file.before-temp-write");
    await writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
    seams.point?.("file.after-temp-write");
    seams.point?.("file.before-replace");
    await rename(temporaryPath, filePath);
    seams.point?.("file.after-replace");
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function finalizeCandidateDirectory(
  stagedPath: string,
  finalPath: string,
  seams: AtomicBookFileSeams = {},
): Promise<void> {
  seams.point?.("candidate.before-finalize");
  await rename(stagedPath, finalPath);
  seams.point?.("candidate.after-finalize");
}
