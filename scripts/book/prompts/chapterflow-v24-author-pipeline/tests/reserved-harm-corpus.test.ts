import assert from "node:assert/strict";

import { test } from "./harness.js";
import { classifyComplaintHarm, complaintNamesReservedHarm } from "../src/orchestrator/authorReview.js";
import type { ChapterReviewComplaint } from "../src/artifacts/artifactTypes.js";

// ── F-09 acceptance corpus ────────────────────────────────────────────────────
//
// The classifier decides on HARM-SEMANTICS, not substrings. Every entry below is
// a real complaint phrasing (drawn from state/reviews/start-with-why/*.review.json
// and the reviewer rubric's own category names) or a required synthetic edge case,
// hand-labeled block / downgrade / ambiguous. This table IS the acceptance test —
// a change that flips any label must be justified against the corpus (Requirement 4).
//
// The old substring nets (RESERVED_HARM_RX / SUBJECTIVE_ONLY_RX) classification is
// recorded in `old` for the fail-direction diff: `block→downgrade` moves are the
// intended fix (aesthetic complaints that merely used answer/key/wrong/missing);
// `downgrade→block` moves are the Requirement-2 recovery (thin/filler that names
// unusability). Every other entry is unchanged.

type Label = "block" | "downgrade" | "ambiguous";
type Entry = { text: string; label: Label; old: Label; src: "state" | "synthetic" | "rubric"; why: string };

const CORPUS: Entry[] = [
  // ── DOWNGRADE: quiz-tell / keys-sound craft (contain answer/key/wrong but no defect) ──
  { text: "Correct answers are frequently the longest and most lesson-coded option, creating answer tells even for readers who skim keywords.", label: "downgrade", old: "block", src: "state", why: "quiz tell; keys sound. Old blocked on substring 'answer'." },
  { text: "Correct answers often echo the chapter's exact vocabulary and specificity while distractors are broadly wrong, creating some answer-key tells.", label: "downgrade", old: "block", src: "state", why: "'distractors broadly wrong' is correct design; a tell, not a defect. Old blocked on 'wrong'/'answer'/'key'." },
  { text: "Some distractors are too obviously wrong because they endorse rank, familiarity, abstract purpose language, or proof from attention; this creates answer tells without requiring close reading.", label: "downgrade", old: "block", src: "state", why: "distractors being wrong = fair design; too-easy tell. Old blocked on 'wrong'/'answer'." },
  { text: "The correct answer is made easier by distinctive phrasing that mirrors the chapter's own language about anchors and checkable ground; this is a quiz tell, not a broken key.", label: "downgrade", old: "block", src: "state", why: "explicitly 'not a broken key' — a tell. Old blocked on 'broken'/'key'/'answer'." },
  { text: "The quiz is fair and key-sound, but it overweights founder/date anchoring relative to the broader WHY-HOW-WHAT transfer skill.", label: "downgrade", old: "block", src: "state", why: "key-sound affirmation + weighting taste. Old blocked on 'key'." },
  { text: "The keyed answer is sound, but 'venue changes how far the idea can honestly travel' is more abstract than the TiVo prose's simpler warning about novelty versus buying reason.", label: "downgrade", old: "block", src: "state", why: "keyed answer sound; abstraction taste. Old blocked on 'answer'/'key'." },
  { text: "Some correct choices are easier to guess because they alone include the chapter's concrete diagnostic tokens while distractors lean into obviously wrong overgeneralization.", label: "downgrade", old: "block", src: "state", why: "guessable tell; distractors wrong = design. Old blocked on 'wrong'." },
  { text: "The answer feels generic.", label: "downgrade", old: "block", src: "synthetic", why: "REQUIRED: aesthetic; old blocked on 'answer'." },

  // ── DOWNGRADE: thin-but-usable examples (rubric transfer category b) ──
  { text: "The Gabriel/TiVo example is thin: it names a person and object, but the before-to-after decision and consequence are mostly abstract.", label: "downgrade", old: "downgrade", src: "state", why: "thin-but-usable; unchanged." },
  { text: "Hailey and the blue folder feel like slot-filler staging. The example restates the lesson about action rebuilding trust but does not show a concrete decision and consequence.", label: "downgrade", old: "downgrade", src: "state", why: "slot-filler, usable; unchanged." },
  { text: "Reads like a slot-filler: 'service rule' and 'change' are unnamed, with no concrete decision, setting, number, or visible consequence beyond restating the lesson.", label: "downgrade", old: "downgrade", src: "state", why: "slot-filler; unchanged." },
  { text: "Jerome is introduced only to restate the same WHY-before-WHAT correction already shown by Sylvia and Yann; the example is usable but redundant.", label: "downgrade", old: "downgrade", src: "state", why: "usable but redundant; unchanged." },
  { text: "The example feels thin — it is missing a concrete consequence.", label: "downgrade", old: "downgrade", src: "synthetic", why: "'missing' anchored to a consequence (not a section) stays a thin-example downgrade." },

  // ── DOWNGRADE: prose taste / density / beginner-abstraction ──
  { text: "Several paragraphs restate the same ledger/return-proof distinction with only small wording changes, lowering density.", label: "downgrade", old: "downgrade", src: "state", why: "repetition/density; unchanged." },
  { text: "Terms like 'return point,' 'carrier,' 'scope mark,' and 'venue' are understandable in context but may feel abstract for a cold beginner.", label: "downgrade", old: "downgrade", src: "state", why: "beginner abstraction; unchanged." },
  { text: "Some sections have a light template smell from repeated named-reader setups and repeated 'mark' phrasing, even though the prose remains clear.", label: "downgrade", old: "downgrade", src: "state", why: "template smell; unchanged." },
  { text: "The American Airlines summary ends with a vague question rather than stating what proof returned or what changed.", label: "downgrade", old: "ambiguous", src: "state", why: "'vague' craft; usable. Old had no subjective hit → ambiguous→block; now downgrades." },
  { text: "Distractor c is too easy to eliminate because it says employees matter after loyalty appears, which directly contradicts the repeated order of the chapter.", label: "downgrade", old: "block", src: "state", why: "too-easy distractor; 'contradicts the repeated order of the chapter' (no possessive) is a distractor being contrary, not self-contradiction. Old blocked on 'contradict'." },
  { text: "The distractors are slightly weak.", label: "downgrade", old: "downgrade", src: "synthetic", why: "weak distractors = craft; unchanged." },
  { text: "The example feels thin, could be richer.", label: "downgrade", old: "downgrade", src: "synthetic", why: "REQUIRED: aesthetic; unchanged." },

  // ── BLOCK: key/answer/fact IS wrong (correctness) ──
  { text: "Q4 keys the wrong choice.", label: "block", old: "block", src: "synthetic", why: "REQUIRED: the key is wrong." },
  { text: "The answer key is wrong — two choices are correct.", label: "block", old: "block", src: "rubric", why: "key wrong + two correct." },
  { text: "The keyed answer is conceptually intended, but the answer choice is worded as if the distinction is preserved rather than lost, making the item unsound or at least confusing.", label: "block", old: "block", src: "state", why: "item unsound/confusing." },
  { text: "The keyed answer is basically sound by elimination, but 'visible setting' misnames the thing being lost; the prose supports loss of source anchor, not loss of a setting.", label: "block", old: "block", src: "state", why: "misnames — a validity defect (block-safe despite soundness affirmation)." },
  { text: "This fact is factually incorrect.", label: "block", old: "block", src: "rubric", why: "factual defect." },
  { text: "The example implies something untrue.", label: "block", old: "ambiguous", src: "synthetic", why: "RED-TEAM: no classic keyword; 'untrue' must block (was ambiguous→block before)." },
  { text: "The quiz has two correct answers.", label: "block", old: "block", src: "synthetic", why: "structural quiz defect." },

  // ── BLOCK: safety / fabrication / structural / unusable / self-contradiction ──
  { text: "This advice could hurt a reader who tries it at home.", label: "block", old: "block", src: "synthetic", why: "unsafe advice." },
  { text: "The scenario is fabricated — no such study exists.", label: "block", old: "block", src: "rubric", why: "fabrication." },
  { text: "This contradicts the chapter's own claim in the hook.", label: "block", old: "block", src: "rubric", why: "self-contradiction (possessive anchor)." },
  { text: "The summaries section is missing.", label: "block", old: "block", src: "rubric", why: "structural: a section missing." },
  { text: "The example is filler, teaches nothing, and is unusable.", label: "block", old: "downgrade", src: "synthetic", why: "REQUIRED + Requirement-2 recovery: 'filler' co-occurs with unusability → block now wins (old downgraded on 'filler')." },
  { text: "The pacing makes the safety warning unreadable.", label: "block", old: "block", src: "rubric", why: "collision: 'pacing' aesthetic but 'unreadable'/'safety' block wins." },
  { text: "The generic phrasing states a factually wrong date.", label: "block", old: "block", src: "rubric", why: "collision: 'generic' aesthetic but factually-wrong date block wins." },

  // ── AMBIGUOUS → BLOCK (default trust) ──
  { text: "Something is off here.", label: "ambiguous", old: "ambiguous", src: "rubric", why: "no signal → default block." },
  { text: "asdf qwer zzz lorem", label: "ambiguous", old: "ambiguous", src: "synthetic", why: "REQUIRED: gibberish → default block." },
];

test("F-09 corpus: classifyComplaintHarm assigns every hand-labeled harm class", () => {
  const flips: string[] = [];
  for (const e of CORPUS) {
    const got = classifyComplaintHarm(e.text);
    assert.equal(got, e.label, `MISLABEL [${e.src}] "${e.text.slice(0, 70)}…" expected ${e.label}, got ${got} — ${e.why}`);
    // complaintNamesReservedHarm: block/ambiguous → true (blocks), downgrade → false.
    const c: ChapterReviewComplaint = { unit: "x", problem: e.text, mustFix: true };
    assert.equal(complaintNamesReservedHarm(c), e.label !== "downgrade", `reserved-harm verdict mismatch for "${e.text.slice(0, 50)}…"`);
    if (e.old !== e.label) flips.push(`  ${e.old}→${e.label}: "${e.text.slice(0, 64)}…" (${e.why})`);
  }
  // Fail-direction ledger: only block→downgrade (aesthetic false-positive fix) and
  // downgrade→block (unusability recovery) and ambiguous→downgrade are allowed; a
  // block→ambiguous or downgrade→ambiguous move would be a silent behavior change.
  console.log(`  [F-09] ${flips.length} corpus reclassifications vs old substring nets:\n${flips.join("\n")}`);
});

test("F-09: the four required discriminations", () => {
  const c = (problem: string): ChapterReviewComplaint => ({ unit: "x", problem, mustFix: true });
  assert.equal(complaintNamesReservedHarm(c("the answer feels generic")), false, "answer-feels-generic → downgrade");
  assert.equal(complaintNamesReservedHarm(c("Q4 keys the wrong choice")), true, "keys-the-wrong-choice → block");
  assert.equal(complaintNamesReservedHarm(c("example is filler, teaches nothing, unusable")), true, "filler+unusable → block");
  assert.equal(complaintNamesReservedHarm(c("example feels thin, could be richer")), false, "thin+richer → downgrade");
  assert.equal(complaintNamesReservedHarm(c("&*^ nonsensical %$# blorp")), true, "gibberish/ambiguous → block");
});
