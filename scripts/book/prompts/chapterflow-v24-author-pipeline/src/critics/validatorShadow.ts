/**
 * validatorShadow (IMP-09, instruction 8) — dual-run comparison of a REPLACED
 * lexical validator against its frozen pre-replacement algorithm on approved
 * synthetic fixtures.
 *
 * The OLD algorithm is preserved here VERBATIM as a reference implementation
 * (never called by production code) so the shadow comparison is against the
 * real predecessor, not a reconstruction. Each fixture row records: the old
 * verdict, the new verdict, the expected label, and the adjudication — the
 * §Deliverables "shadow corpus report" is the test-pinned table this module
 * computes. Severity is NOT decided here; the comparison is evidence for the
 * inventory, and any future severity change is IMP-11 calibration territory.
 */

import { anyAliasPresent, leadAliasSet } from "./leadAliases.js";

// ── The FROZEN pre-IMP-09 D7 token algorithm (reference; production-dead) ────

/** Verbatim pre-IMP-09 D7 token selection (authorRun.ts, first capitalized
 *  ASCII token ≥4 chars minus sentence stopwords). */
export function legacyD7Token(name: string, kind: "invented" | "owned-case"): string {
  return kind === "invented"
    ? name
    : (name.split(/\s+/).find((w) => /^[A-Z][A-Za-z-]{3,}/.test(w) && !/^(The|This|That|When|What|From|Into|With)$/.test(w)) ?? "");
}

/** Verbatim pre-IMP-09 presence test: \b<escaped token>\b, case-sensitive. */
export function legacyD7Present(text: string | undefined, token: string): boolean {
  if (!token) return false;
  return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text ?? "");
}

// ── Shadow comparison ─────────────────────────────────────────────────────────

export type D7ShadowFixture = {
  /** Human-legible fixture id (e.g. "surname-van-gogh"). */
  id: string;
  leadName: string;
  kind: "invented" | "owned-case";
  /** The prose under test (a fastRead stand-in). */
  text: string;
  /** Ground truth: does the prose genuinely carry the dealt lead's thread? */
  expected: "present" | "absent";
};

export type D7ShadowRow = {
  id: string;
  old: "present" | "absent" | "vacuous-skip";
  new: "present" | "absent" | "vacuous-skip";
  expected: "present" | "absent";
  adjudication:
    | "both-correct"
    | "new-fixes-false-negative"   // old missed a genuinely-present thread
    | "new-fixes-vacuous-skip"     // old had no token → silently unenforced
    | "old-correct-new-wrong"      // regression — must be zero
    | "both-wrong";
};

export function d7ShadowRow(fx: D7ShadowFixture): D7ShadowRow {
  const token = legacyD7Token(fx.leadName, fx.kind);
  const old: D7ShadowRow["old"] = token === "" ? "vacuous-skip" : legacyD7Present(fx.text, token) ? "present" : "absent";
  const aliases = leadAliasSet(fx.leadName);
  const neu: D7ShadowRow["new"] = aliases.length === 0 ? "vacuous-skip" : anyAliasPresent(fx.text, aliases) ? "present" : "absent";
  let adjudication: D7ShadowRow["adjudication"];
  const oldCorrect = old === fx.expected;
  const newCorrect = neu === fx.expected;
  if (oldCorrect && newCorrect) adjudication = "both-correct";
  else if (!oldCorrect && newCorrect) adjudication = old === "vacuous-skip" ? "new-fixes-vacuous-skip" : "new-fixes-false-negative";
  else if (oldCorrect && !newCorrect) adjudication = "old-correct-new-wrong";
  else adjudication = "both-wrong";
  return { id: fx.id, old, new: neu, expected: fx.expected, adjudication };
}

/** Run the whole corpus; the caller (test) asserts zero regressions and the
 *  expected fix classes. */
export function d7ShadowReport(fixtures: readonly D7ShadowFixture[]): D7ShadowRow[] {
  return fixtures.map(d7ShadowRow);
}
