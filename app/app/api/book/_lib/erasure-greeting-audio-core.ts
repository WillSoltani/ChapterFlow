// Hard-erasure step for a reader's spoken-name greeting clips ("Good evening,
// <name>."). Pure decision logic: no `server-only`, no AWS imports. The S3
// binding lives in erasure-greeting-audio.ts.
//
// The content bucket is versioned, so a plain delete would only hide the audio
// behind a delete marker. This step deletes every stored version and every
// delete marker by version id.
//
// The result's warning lands in the permanent erasure audit, which must not hold
// the erased user's id. Clip names contain the user id and storage error
// messages can contain the clip name, so the warning carries the error NAME only.

import { GREETING_TIMES_OF_DAY, userGreetingClipPrefix } from "./audio-narration-core";

/** One stored object version or delete marker. */
export type GreetingClipVersion = { key: string; versionId: string };

export type GreetingAudioErasureDeps = {
  /** Every object version AND delete marker whose key starts with the prefix. */
  listVersions(prefix: string, signal: AbortSignal): Promise<GreetingClipVersion[]>;
  /** Permanently delete one version (or delete marker). */
  deleteVersion(version: GreetingClipVersion, signal: AbortSignal): Promise<void>;
};

export type GreetingAudioErasure = {
  outcome: "deleted" | "skipped" | "failed";
  /** Versions and delete markers whose delete succeeded. */
  versionsDeleted: number;
  /** Only when failed. One line; no user id, no key, no raw error message. */
  warning?: string;
  /** Only when failed. A plain error code for the log line, or "unknown". */
  errorName?: string;
};

/** Upper bound for the whole step, so erasure never waits on a hung call. */
export const GREETING_AUDIO_ERASE_BUDGET_MS = 10_000;

const TIME_LIMIT_LABEL = "time limit reached";
const CLIP_SUFFIX = /^(?:[0-9a-f]{16}\.)?mp3$/;
const SAFE_ERROR_NAME = /^[A-Za-z0-9_.-]{1,64}$/;

/**
 * True when `key` is a greeting clip name for `prefix`: the fixed name
 * `<prefix>mp3` or a content name `<prefix><16 lowercase hex>.mp3`. Anything
 * else under the prefix is not ours to delete.
 */
export function isGreetingClipName(key: string, prefix: string): boolean {
  return key.startsWith(prefix) && CLIP_SUFFIX.test(key.slice(prefix.length));
}

function safeErrorName(err: unknown): string {
  if (err instanceof Error && SAFE_ERROR_NAME.test(err.name)) return err.name;
  return "unknown";
}

function failed(versionsDeleted: number, errorName: string, label: string): GreetingAudioErasure {
  return {
    outcome: "failed",
    versionsDeleted,
    errorName,
    warning: `Spoken-name audio clips were NOT fully removed from storage (${label}). Run the erasure again to retry.`,
  };
}

/**
 * Permanently delete every stored version and delete marker of the reader's
 * greeting clips, for every time of day. Deletes everything it could list even
 * when another list or delete fails (a re-run finishes the job). Limited to
 * `budgetMs` overall; on expiry the signal given to deps is aborted and the
 * step reports `failed` without waiting. Never throws.
 */
export async function eraseGreetingAudio(
  userId: string,
  deps: GreetingAudioErasureDeps,
  opts?: { budgetMs?: number },
): Promise<GreetingAudioErasure> {
  const controller = new AbortController();
  const { signal } = controller;
  let versionsDeleted = 0;
  let firstError: unknown;
  let hasError = false;
  const noteError = (err: unknown) => {
    if (!hasError) {
      hasError = true;
      firstError = err;
    }
  };

  const erasePrefix = async (prefix: string) => {
    const versions = await deps.listVersions(prefix, signal);
    const ours = versions.filter((v) => isGreetingClipName(v.key, prefix));
    const deletes = await Promise.allSettled(
      ours.map(async (v) => {
        await deps.deleteVersion(v, signal);
        versionsDeleted += 1;
      }),
    );
    for (const d of deletes) if (d.status === "rejected") noteError(d.reason);
  };

  const work = Promise.allSettled(
    GREETING_TIMES_OF_DAY.map((timeOfDay) => erasePrefix(userGreetingClipPrefix(userId, timeOfDay))),
  ).then((lists) => {
    for (const l of lists) if (l.status === "rejected") noteError(l.reason);
    return "done" as const;
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeLimit = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), opts?.budgetMs ?? GREETING_AUDIO_ERASE_BUDGET_MS);
  });

  try {
    const finished = await Promise.race([work, timeLimit]);
    if (finished === "timeout") {
      controller.abort();
      return failed(versionsDeleted, TIME_LIMIT_LABEL, TIME_LIMIT_LABEL);
    }
    if (hasError) {
      const name = safeErrorName(firstError);
      return failed(versionsDeleted, name, name);
    }
    return { outcome: versionsDeleted > 0 ? "deleted" : "skipped", versionsDeleted };
  } catch (err) {
    const name = safeErrorName(err);
    return failed(versionsDeleted, name, name);
  } finally {
    clearTimeout(timer);
  }
}
