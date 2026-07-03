/**
 * Labeled regression corpus for the critic-calibration campaign (findings #2–#15).
 *
 * ── TAXONOMY (the load-bearing contract) ─────────────────────────────────────
 * Keys `f2`..`f15` map EXACTLY to PIPELINE-10of10-FIX-BACKLOG.md findings #2..#15.
 * A Phase-1 agent building the gate for finding #N pulls `REGRESSIONS.f<N>` and
 * trusts that every span genuinely exhibits #N. So the labels MUST match the
 * backlog — a mislabel here mis-calibrates a gate (CP-0 caught exactly that).
 *
 * Finding #1 (testimonial-as-evidence) already shipped as the EI1/EI2 gate; its
 * spans live in `EI_REGRESSION` below as a REGRESSION GUARD (keep EI firing), NOT
 * under `f2`. #10 (author voice) is a generation/bar concern with no deterministic
 * span — left empty by design.
 *
 * ── SOURCE BOOKS ─────────────────────────────────────────────────────────────
 * The reverted tiny-habits **regen** exhibits only a SUBSET of findings; the rest
 * are lifted from the live, committed packages in `book-packages/`. Every BadSpan
 * carries `book` so the self-test (tests/regressions-corpus.test.ts) verifies it
 * verbatim against the right source:
 *   • "tiny-habits-regen" → tests/fixtures/regression-tiny-habits-regen.json
 *       (the REVERTED package — fixtured here because it is no longer in book-packages/).
 *   • "willpower" / "atomic-habits" → book-packages/<book>.v21.json
 *       (LIVE + committed; verified best-effort, skipped if the dir is absent in CI).
 *
 * EMPTY arrays = a structural / passage-level / quiz-shaped finding that its
 * Phase-1 prompt seeds inline (per Shared Law §7). The `// SEED:` note states the
 * SOURCE BOOK + what to look for, so the agent knows exactly where to lift from.
 *
 * ── GOLD-CORPUS REACHABILITY (the zero-false-positive side of calibration) ────
 * A calibrated blocker must fire on the spans here yet stay at ZERO on the gold
 * sources a real book legitimately uses:
 *   • SYNTHETIC gold — always present, deterministic: `goldChapterFiles()`
 *     (tests/helpers.ts) → zz-gold-daring-greatly, zz-gold-start-with-why. Use for
 *     the zero-FP pin; present on every machine incl. CI.
 *   • REAL gold — present on authoring machines, ABSENT in CI: state/chapters/
 *     daring-greatly-ch*.v21-native.chapter.json + start-with-why-ch* (21 files
 *     here). A consumer MUST guard on existsSync(STATE_CHAPTERS) and skip() when
 *     absent (see evidence-integrity.test.ts), so a clean checkout never fails CI.
 *
 * ── REMOVED at CP-0 (do not re-add) ──────────────────────────────────────────
 * Two spans previously seeded as "performative ritual cues" were GOOD teaching
 * content, not defects: "She claps after every sip of water, then feels silly,
 * then stops…" is the chapter CORRECTLY teaching that over-performed celebration
 * backfires (Caroline's overcorrection), and "…smiles for real…" is the AUTHENTIC
 * celebration. Calibrating a gate on these would fire on reference-quality prose.
 * Also: "performative ritual cue" is NOT a backlog finding (#2–#15).
 * The James-Clear "2012 case" spans were DEFERRED, not seeded: "James Clear" is a
 * FULL real name (EI exempts full names by design), so whether it is a fabricated
 * attribution vs. a real cited source needs a source check before it can be a TP.
 * See the note under `f2`.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type SourceBook = "tiny-habits-regen" | "willpower" | "atomic-habits";

/** Absolute path to the recovered tiny-habits regen package (full book, verbatim). */
export const REGEN_FIXTURE_PATH = resolve(__dirname, "regression-tiny-habits-regen.json");

/** book-packages/ from the pipeline dir (…/chapterflow-v21-authored/tests/fixtures → repo root). */
const BOOK_PACKAGES_DIR = resolve(__dirname, "../../book-packages");

function bookPath(book: SourceBook): string {
  if (book === "tiny-habits-regen") return REGEN_FIXTURE_PATH;
  return resolve(BOOK_PACKAGES_DIR, `${book}.v21.json`);
}

/** Raw text of a source book. Returns null when a live package is absent (CI); the
 *  regen fixture is always present. The self-test skip()s a null book. */
export function bookText(book: SourceBook): string | null {
  const p = bookPath(book);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

/** Back-compat helper: raw text of the regen fixture. */
export function regenFileText(): string {
  return readFileSync(REGEN_FIXTURE_PATH, "utf8");
}

/** A single labeled true-positive: verbatim defective text + its source. */
export type BadSpan = {
  /** Verbatim text copied out of `book`'s package JSON — assert with bookText(book).includes(span). */
  span: string;
  /** Which source the span was lifted from (selects the file the self-test checks). */
  book: SourceBook;
  /** Human locator: `<chapterId>:<field>`. */
  source: string;
};

export type FindingId =
  | "f2" | "f3" | "f4" | "f5" | "f6" | "f7" | "f8"
  | "f9" | "f10" | "f11" | "f12" | "f13" | "f14" | "f15";

export type RegressionCorpus = Record<FindingId, BadSpan[]>;

/**
 * REGRESSION GUARD for the already-shipped EI1/EI2 gate (finding #1). A first-name
 * or lone-initial subject's personal "report" dressed in the grammar of evidence.
 * Use these to assert EI keeps firing — NOT as #2 material.
 */
export const EI_REGRESSION: BadSpan[] = [
  { span: "Brad's report names the hinge.", book: "tiny-habits-regen", source: "tiny-habits-ch07:breakdown.fullRead" },
  { span: "Candace's report points to why this stays humane.", book: "tiny-habits-regen", source: "tiny-habits-ch07:breakdown.fullRead" },
  {
    span: "Candace P.'s report gives her the test: stop adding willpower and discipline, then work with a few key variables.",
    book: "tiny-habits-regen", source: "tiny-habits-ch07:breakdown.fastRead",
  },
  { span: "John's public success report makes the rule small enough to use.", book: "tiny-habits-regen", source: "tiny-habits-ch05:breakdown.deepRead" },
  { span: "Jean B.'s report points to another kind of growth.", book: "tiny-habits-regen", source: "tiny-habits-ch06:breakdown.fullRead" },
  { span: "Josef's report makes that plain.", book: "tiny-habits-regen", source: "tiny-habits-ch06:breakdown.deepRead" },
];

/**
 * DEFERRED — needs source verification before use as a true-positive. The regen
 * attributes a fabricated-sounding "2012 case … changed his life and career" to
 * James Clear (a real author). "James Clear" is a FULL name so EI correctly does
 * NOT fire; whether this is a fabricated attribution (a factual_accuracy /
 * "Piper-move" defect → WT-E) or a real cited source depends on whether the
 * tiny-habits source actually documents him as a 2012 participant. WT-A/WT-E:
 * verify against the source sidecar before promoting any of these to a TP.
 */
export const FACTUAL_MISATTRIBUTION_CANDIDATES: BadSpan[] = [
  { span: "James Clear's 2012 case is the cleanest cascade.", book: "tiny-habits-regen", source: "tiny-habits-ch08:breakdown.fullRead" },
  { span: "The same public case later says the program changed his life and career.", book: "tiny-habits-regen", source: "tiny-habits-ch08:examples[].scenario" },
];

/**
 * Per-finding labeled bad spans. Keys = backlog findings #2–#15.
 * Seeded findings are verbatim-verified; empties carry a `// SEED:` source pointer.
 */
export const REGRESSIONS: RegressionCorpus = {
  // #2 — CONTESTED SCIENCE stated as settled fact (no hedge). Disputed findings
  // (ego depletion, decision fatigue) asserted flat. Detection is semantic
  // (factual_accuracy hedge clause, WT-E) + a sidecar replicationStatus flag (WT-A).
  f2: [
    { span: "Willpower fails fastest when it has to pay twice", book: "willpower", source: "willpower-ch1:breakdown" },
    { span: "Decision fatigue is that bill coming due", book: "willpower", source: "willpower-ch4:breakdown" },
  ],

  // #3 — QUIZ tests recall / recycled chapter scenario, not transfer.
  // SEED (WT-D) from tiny-habits-regen: ch5 quiz prompts that reuse chapter
  // characters ("Nora says John's Maui habit report proves…") and ch8 q07 whose
  // keyed answer is a testimonial ("A participant reports sharing the 5-day course").
  f3: [],

  // #4 — UNGROUNDED / fabricated number in narrative prose.
  f4: [
    {
      span: "The notebook gets opened ninety percent of the time, which is roughly ninety percent more often than the old plan",
      book: "atomic-habits", source: "atomic-habits-ch13:breakdown",
    },
  ],

  // #5 — CAST discipline (too many names / name reused across roles / shuffled
  // example↔quiz). SEED (WT-C) from tiny-habits-regen ch8 (Blair/Bailey/Thierry/
  // Hunter/Donovan — interchangeable coaches) — a cross-example signal, not a span.
  f5: [],

  // #6 — PROSE RHYTHM: monotone short sentences (the choppy/listy defect). The original
  // CoefVar-over-a-tier premise was refuted on the real gold corpus (gold tiers sit
  // CoefVar 0.157-0.62, so a variance floor fires on the clean books); the SHIPPED
  // detector (critics/prose.ts checkSentenceLengthVariance, E8.monotone_cadence) instead
  // catches a SUSTAINED run (≥7 short ≤9-word same-length declaratives, run-mean ≥4.5 to
  // skip telegraphic action staccato). The seed below is a verbatim run the detector
  // fires on. NOTE: a 3-sentence cluster like willpower-ch4's "Defaults handle small
  // repeat calls. Routines keep daily choices from reopening…" is the same pattern but
  // SUB-THRESHOLD — indistinguishable from gold (which has short clusters up to 6), so
  // it is deliberately NOT a TP for a zero-gold-FP gate.
  f6: [
    {
      span: "Each one moves the fight upstream. The first names the cue. The second closes the window. The third makes reversal harder. The fourth lets other people see the promise. The fifth takes the trigger out of reach. You are not admitting defeat.",
      book: "willpower", source: "willpower-ch07:breakdown.deepRead",
    },
  ],

  // #7 — ABSTRACT scenes (system-as-protagonist). From tiny-habits-regen ch4: every
  // example scenario is staged ON a UI/process surface (email, sign-in button, review
  // screen, worksheet) with no clock-time, place, physical object, body, or sensory
  // beat — the form is the protagonist. Detection = `C26.scene_abstraction` (advisory):
  // ≥2 distinct system tokens AND zero concrete grounding. See critics/sceneConcreteness.ts.
  f7: [
    {
      span: "The send window is closing, and product designer Lorraine is still in the draft for the BJ-Demo account. Her email prompt says, Come back and get involved, with a green sign-in button below it.",
      book: "tiny-habits-regen", source: "tiny-habits-ch04:examples[0].scenario",
    },
    {
      span: "The prompt-type chart is tidy, but the reactivation email is not tidy at all. Olivia studies the 3 prompt types on the worksheet: Facilitator, Signal, Spark.",
      book: "tiny-habits-regen", source: "tiny-habits-ch04:examples[1].scenario",
    },
    {
      span: "The usual email reviewer is out, so Phoebe gets the review screen in her inbox for the BJ-Demo account.",
      book: "tiny-habits-regen", source: "tiny-habits-ch04:examples[5].scenario",
    },
  ],

  // #8 — EXOTIC name overuse. SEED (WT-C) cross-book: a chapter whose protagonist
  // set is mostly uncommon names (Thomasina/Rhiannon/Soledad/Osvald/Eero/Saoirse) —
  // a per-chapter density signal, not a single span.
  f8: [],

  // #9 — WEAK hook / non-reversing counterintuition. SEED (WT-E) from tiny-habits-regen
  // ch5 hook ("3 minutes a day, and the missed habit piece was the feeling after the
  // tiny win") vs the clean original ("…is not the reward for the habit. It is the habit.").
  f9: [],

  // #10 — AUTHOR VOICE (generation/bar concern; no deterministic span). Intentionally empty.
  f10: [],

  // #11 — TIER redundancy (paraphrase across fast/deep/full). SEED (WT-B) from
  // tiny-habits-regen ch5: the "John's Maui habit… celebration is key" beat recurs
  // across all three tiers — a cross-tier overlap signal, lift the repeated idea.
  f11: [],

  // #12 — OVER-LENGTH / low idea-density. SEED (WT-B) from tiny-habits-regen: a tier
  // padded to its char floor by restating one idea — a density measure, not a span.
  f12: [],

  // #13 — NO boundary / reversal teaching. SEED (WT-E) negative signal: a chapter
  // that teaches only the move with no "when it fails" beat — absence, not a span.
  f13: [],

  // #14 — TOO-CLEAN resolutions (every example succeeds instantly). SEED (WT-C/E)
  // outcome-uniformity: a chapter where 0% of examples use a friction-bearing format.
  f14: [],

  // #15 — TACTIC vs LENS depth. SEED (WT-E) judgment: a chapter delivering a one-off
  // tip vs a reusable lens — a bar-axis judgment, not a deterministic span.
  f15: [],
};
