/**
 * Non-clobbering manual-brief derivation (P1 / Finding F-01).
 *
 * `derive-artifacts` re-derives state/briefs/<book>.manual-brief.json from the
 * frozen research TOC every time it runs — and it is AUTO-RUN by book-gate
 * (cli.ts:206) and the QC entry (cli.ts:3465). That silently REVERTS any reviewed
 * hand-edit of the brief's voiceCharter (observed live: the dae308a01 de-mandated
 * charter was overwritten on 2026-07-07T23:11Z). The voice-move sanitizer
 * (voiceBible.ts) already stops device mandates from reaching a prompt no matter
 * how the brief is derived; this reconciler is the complementary half — it keeps
 * derivation idempotent for untouched books and preserves a diverged (reviewed)
 * voiceCharter unless the operator passes --force-voice. Every field OTHER than
 * voiceCharter always re-derives.
 *
 * Pure + filesystem-free so it is unit-tested directly (no real state touched).
 */

type Charter = Record<string, unknown>;
type Brief = Record<string, unknown> & { voiceCharter?: Charter };

/** Deterministic key-sorted JSON, so charter comparison is independent of key
 *  order (a hand-edit that reorders keys but keeps content is still "identical"). */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

function charterOf(value: unknown): Charter | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const c = (value as Brief).voiceCharter;
    if (c && typeof c === "object" && !Array.isArray(c)) return c;
  }
  return undefined;
}

export type ReconcileResult = {
  /** The brief to write: derived as-is, or derived with the existing charter grafted back. */
  brief: Brief;
  /** True when a diverged existing voiceCharter was preserved over the derived one. */
  preservedVoice: boolean;
  /** True when --force-voice overrode a diverged existing charter. */
  forcedVoice: boolean;
};

/**
 * Decide the final brief given what is on disk and what was freshly derived.
 * - No existing charter (fresh book) → derive as-is.
 * - --force-voice → derive as-is (overwrite); `forcedVoice` true iff it actually diverged.
 * - Existing charter identical to derived → derive as-is (idempotent, no notice).
 * - Existing charter diverged from derived → PRESERVE it, re-derive everything else.
 */
export function reconcileDerivedBrief(params: {
  existing: unknown | null;
  derived: Brief;
  forceVoice: boolean;
}): ReconcileResult {
  const { existing, derived, forceVoice } = params;
  const existingCharter = charterOf(existing);
  const diverged = !!existingCharter && canonical(existingCharter) !== canonical(derived.voiceCharter);

  if (!existingCharter || forceVoice) {
    return { brief: derived, preservedVoice: false, forcedVoice: forceVoice && diverged };
  }
  if (!diverged) {
    return { brief: derived, preservedVoice: false, forcedVoice: false };
  }
  return { brief: { ...derived, voiceCharter: existingCharter }, preservedVoice: true, forcedVoice: false };
}
