import type { QcRoundRole } from "./qcRound.js";

/**
 * Derive a deterministic, approved QC reviewer id for a (round, role, chapter).
 *
 * Why this exists: bar↔confirm reviewer independence is enforced in finalize.ts
 * by a plain string compare (`bar.reviewer === confirm.reviewer`). When QC is
 * fanned out across parallel subagents, they would otherwise all inherit one
 * reviewer label and `sameReviewerConfirm` would fire on every publishable
 * candidate — parking the whole book in NEEDS_MORE_QC forever. Deriving the id
 * per (round, role, chapter) makes `bar(ch) !== confirm(ch)` true BY CONSTRUCTION
 * rather than by asking a reviewer to "remember to use a different id".
 *
 * The prefix stays `codex-qc`, so isApprovedReviewer() (which only inspects the
 * substring before the first ':') still passes. The id is a PURE function of its
 * inputs — no timestamp/pid — so a re-submitted read for the same unit overwrites
 * cleanly and still matches its confirm partner's expected counterpart.
 */
export function qcReviewerId(roundId: string, role: QcRoundRole, chapterNumber?: number): string {
  const suffix = typeof chapterNumber === "number" ? `:ch${String(chapterNumber).padStart(2, "0")}` : "";
  return `codex-qc:${roundId}:${role}${suffix}`;
}
