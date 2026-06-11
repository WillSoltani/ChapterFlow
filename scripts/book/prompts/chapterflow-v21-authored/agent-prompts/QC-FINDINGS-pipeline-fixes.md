# ChapterFlow v21 — QC Findings & Pipeline-Fix Recommendations

Synthesis of recurring defects found across a multi-book QC session (2026-06-03).
Books reviewed: the-let-them-theory, the-tipping-point, the-subtle-art-of-not-
giving-a-fck, rework (status only), range, dare-to-lead, the-5-am-club,
unreasonable-hospitality — plus institutional history on drive, outliers, mindset,
atomic-habits, 7-habits, start-with-why.

Purpose: tell the pipeline team what to fix so later generations stop reproducing
these failures. Findings are ordered by leverage (fix #1 eliminates the most pain).

---

## THE ONE FINDING THAT EXPLAINS MOST OF THE REST

**Step-2 is being produced by deterministic slot-fill scripts, not by authoring.**
A family of per-book generators (`scratch/write-let-them-chapters.mjs`,
`write-dare-to-lead-step2.mjs`, `write-5am-club-step2.mjs`,
`rewrite-unreasonable-hospitality-authored-step2.mjs`, etc.) splice source
fragments and the chapter's concept-label into fixed skeletons. Every catastrophic
book traces back to this. The output is grammatically-shaped word-salad that passes
**every deterministic gate GREEN** because the gates check templating/structure,
not meaning.

Telltales of script-generation (vs. authored):
- Chapter file mtime is ~1 minute after a `scratch/*.mjs` mtime.
- Concept-label used as a noun/object/actor: "empires nurse", "tactics hospital
  ward", "Cleo lifts a productive vulnerability folder", "Alina studies EMP ranked
  50th", "hospitality economy metric lens blurs hospitality economy intention".
- Placeholder/scaffold titles: "Source Moment N.1", "Second Angle N.2",
  "Practice Claim N.3".
- A perfectly even correctIndex split (60/60/60, 33/33/33) sitting on top of
  incoherent choices — scripted rotation, not judgment.

**Fix #1 (highest leverage): retire the slot-fill generators. Author each field
per chapter with a model, grounded in real source.** When books were *authored*
(tipping-point, subtle-art) or *re-authored after escalation* (let-them round 2,
range, 5am-club), they came out clean. When a `.mjs` script generated or "repaired"
them, they were word-salad. This single change removes the entire word-salad class.

---

## ROOT-CAUSE CHAIN (upstream → downstream)

### R1. Missing/empty source is the reliable predictor of word-salad
- `.chapterflow/runs/<book>/` absent or no `ch*.source.json` → the writer has no
  real named cases, so it template-fills with concept-labels.
- Confirmed on: the-let-them-theory (round 1, no source), dare-to-lead (`.chapterflow`
  empty), the-5-am-club (sidecars absent though chapters held real material).
- The brief can also be hollow: let-them round-1 brief had `coreIdeas: []`,
  `targetReader: ""`.
- **`check-source` is insufficient** — it PASSes on invented/generic notes ("passes
  only because there is nothing to check").

**Fix R1:** Make Step-2 refuse to run unless source sidecars exist AND pass a
*realness* check (named real people/companies/cases, not concept-labels). Add a
sidecar realness critic; don't trust `check-source` alone. The proven recovery
recipe is **re-run Step 1 for real source, THEN author** (this is exactly what
fixed let-them round 2).

---

## CONTENT-CORRECTNESS DEFECTS THE GATES CANNOT SEE (ranked)

### C1. Quiz answer keys — the highest-stakes defect
- **Wrong key** (the `hooked` defect): `correctIndex` points at a wrong choice while
  the `explanation` describes the right one. Shipped on `hooked` (21/72), found on
  dare-to-lead ch01 Q1. **Ships past every gate.**
- **Word-salad / spliced-fragment choices** that aren't coherent propositions
  (let-them r1, unreasonable-hospitality, range original 108/108).
- **Format-identifiable answers** — the key is findable without reading meaning:
  - distractors = the correct sentence with a nonsense directive-verb prefix
    ("Reverse…", "Flatten…", "Force one tool onto…") → only the un-prefixed choice
    is the key (drive: 99/99).
  - answer decided by a trailing container noun (roster/memo/budget note) (UH).
- **Echo-template explanations** = "<keyed-choice text>. <question text>" — restate,
  never justify; structurally hides wrong keys (dare-to-lead 72/72).
- **Explanations pasting "Source case N"** fragments (UH 40/180).
- **Answer-position skew (F3)** — index 0 wins 54% book-wide; one chapter (5am-club
  ch13) had all 9 answers at index 0 → trivially gameable.

**Fix C1:** Add a model-backed **quiz-key judge** to the pipeline (a prototype
already exists: `src/critics/semantic/quizKeyJudge.ts` — show the model
prompt+choices+explanation with `correctIndex` hidden, have it derive the answer,
flag confident mismatches; it's built + unit-tested but **unwired and blocked on a
funded API key**). Add deterministic guards too: reject if exactly one choice per
question is "un-prefixed/odd-one-out" (format tell); require explanation to NOT be a
substring concatenation of choice+prompt; enforce per-chapter correctIndex balance
(make F3 a blocker at gate-chapter, not a book-wide major).

### C2. Examples
- Concept-as-object/actor scenarios; "<Name> studies <label>" skeleton (UH 120/120).
- Identical scene skeleton every chapter ("<Name>, 8:40 a.m. at the <place>:
  <Concept>." — drive; "<Name>, a ROLE, sits at <time> in a <place>" — subtle-art/
  tipping-point as mild debt).
- `whatToDo` holds propositions/source-claims instead of a concrete action.
- Pasted breakdown/source sentences as padding (dare-to-lead: example pairs share 2
  pasted sentences).
- Placeholder titles ("Source Moment N.M").

**Fix C2:** Critic for "concept-label-as-subject/object" and for `whatToDo` that
isn't an imperative action. Ban scaffold-slug titles. Diversify scene openers.
**Caution (false-positive guard):** a legit timestamp inside a coherent scene
("At 6:40 p.m. in the rink office, coach Renee studies a clipboard…") is FINE — the
corrupt form is specifically the concept-as-label header with an identical fixed
time every chapter.

### C3. Review cards
- **Backs pasted verbatim from breakdown** → don't answer the front (dare-to-lead
  32/40).
- **Fronts as source-label subjects** ("When should Theodore Roosevelt arena frame
  influence a leader?", "What does Eleven Madison Park ranked 50th… teach?").
- **Label-only non-questions** ("Motivation operating systems.") — drive 55/55.
- Truncated mid-word; circular (front restates back).

**Fix C3:** Require `front` to be a question (ends "?", no proper-noun/concept-label
as subject) testing a transferable idea; require `back` to NOT be a substring of any
`breakdown` sentence; require back to actually answer front.

### C4. Breakdown tiers
- `fullRead` **templated loop**: one clause repeated ~25× with only the actor label
  rotating (dare-to-lead, 12-word-shingle repetition ratio 0.78–0.86).
- `deepRead` first sentence identical to `fastRead` (E2 — already a blocker, keep).
- Notes-like prose; scenes ending mid-sentence (range ch8).

**Fix C4:** Add a shingle-repetition-ratio critic on each breakdown tier (flag
>~0.5). Require fullRead to end on a complete sentence.

### C5. Implementation plans
- `ifThenPlans[].context` = a source label instead of a situation ("Brent Ladd at
  Purdue University").
- `plan` = pasted breakdown sentence, or writer-facing editor language ("Use
  <source> as the source check", "When Charles Darwin becomes a slogan…").

**Fix C5:** `context` must be a situational trigger (contains if/when/after/during);
`plan` must be a concrete reader action with a named tool, not a pasted sentence.

### C6. Memorable lines
- Line #2 = a 16–23-word explanation, not an aphorism (dare-to-lead 7/8).
- Copies an incomplete framework enumeration.

**Fix C6:** Length/structure critic for aphorism shape; cross-check enumerations.

### C7. Factual / framework errors
- dare-to-lead ch07 BRAVING: Accountability dropped (only 6 of 7 letters), V-letter
  renamed "confidentiality", definitions doubled.

**Fix C7:** Where the source sidecar names a fixed acronym/framework, validate the
chapter enumerates it completely and consistently.

---

## CROSS-CHAPTER TEMPLATING (gates DO catch these — mostly non-blocking debt)
- **B11**: "X is not Y. [correction]" negation-shell counterintuition (5am-club
  17/18, subtle-art 5/9, outliers 5/9).
- **B13**: hook first-word clustering.
- **BP16**: repeated quiz Q-position openers ("a reader wants", "a friend says").
- **F4**: "rather than" overuse (drive 81, let-them 66, 5am-club 39 vs budget 15).
- Same scene-opener formula across chapters.

These don't corrupt content but read as templated across a full book. Worth a
light de-template polish; B11 at 94% is the most visible. Known-acceptable and
should NOT block ship: F4, reasonable D1, F1 on real names, SC9 on a shipped book.

---

## PROCESS / PIPELINE-INTEGRITY FAILURES (not content, but they shipped broken books)

### P1. "Repairs" that never landed
- dare-to-lead: a detailed execution REDO was written but **never applied to disk**
  (chapter mtimes predated the QC). Worse, the un-repaired book was **promoted**.
- Re-check showed identical metrics turn over turn; only briefs/plans (setup
  artifacts) were created, never the chapter rewrite.

**Fix P1:** After any repair, verify it landed: compare chapter mtimes, and
re-measure the specific defect metrics before/after. Never trust "it's fixed."

### P2. Partial repairs
- unreasonable-hospitality: a script "repair" fixed breakdown frames + card backs
  but left examples/quizzes/card-fronts in word-salad. Signature = good prose on top
  of broken quizzes/examples.

**Fix P2:** A repair must re-verify every field class, not just the one it targeted.

### P3. Promoted package diverges from loose chapters
- range and dare-to-lead: `book-packages/<book>.v21.json` held OLD corrupt content
  while loose chapters were fixed (or the reverse). Promote is a **separate
  artifact** that must be re-derived from corrected chapters.

**Fix P3:** Promote should refuse if the package would diverge from current loose
chapters; surface a checksum/diff. Never consider a book "clean in the library"
until the package is re-promoted from corrected chapters.

### P4. Gates get gamed / evaded
- **AS13/BP20 are phrase-frequency critics** → evaded by rotating 9 distinct quiz
  skeletons (one per slot Q1–Q9) so no single 8-word phrase recurs ≥8× (UH, drive).
- **AS9** (example overlap) evaded because one long real source sentence per scenario
  dilutes multiset overlap below the 70% threshold (5am-club).
- Running `gate-chapter` only on the last chapter to fake "all pass".

**Fix P4:** Don't rely on frequency thresholds alone for templating; detect
per-slot-skeleton rotation (cluster questions by position across chapters). Always
run `book-gate` (whole book), never trust a per-chapter self-report.

---

## THE META-GAP (state this loudly in the pipeline docs)

**A GREEN gate is necessary but NOT sufficient.** Every deterministic gate checks
structure / schema / cross-chapter templating / phrase-frequency. **None verifies
semantic correctness**: right quiz keys, coherent propositions, card learning value,
plan actionability, factual accuracy, example coherence. Word-salad and wrong keys
have shipped past GREEN repeatedly (hooked, range, dare-to-lead, UH, 5am-club,
drive, let-them r1). Until a semantic tier exists and is wired in, **a human (or
model) content-read is mandatory before any ship**.

---

## PRIORITIZED FIX LIST (what to build, in order)

1. **Replace slot-fill generators with real per-field authoring grounded in source.**
   Eliminates the entire word-salad class. (Biggest win.)
2. **Gate Step-2 on real source** — require sidecars + a realness check; re-run
   Step-1 when missing. Don't trust `check-source`.
3. **Wire in the semantic quiz-key judge** (`quizKeyJudge.ts`) + fund the API key;
   extend the same pattern to cards/examples. Catches the highest-stakes defect.
4. **Add deterministic semantic-adjacent critics:** format-identifiable answer
   (odd-one-out / container-noun), echo-explanation, card-front-must-be-question,
   back-not-pasted-from-breakdown, whatToDo-must-be-action, concept-label-as-subject,
   fullRead shingle-loop, plan-context-must-be-situational.
5. **Make F3 (answer-position balance) a per-chapter blocker**, not a book-wide major.
6. **Harden against gate evasion:** per-slot-skeleton rotation detector; never accept
   per-chapter self-reports; AS9 robustness to source-sentence dilution.
7. **Process integrity:** verify repairs landed (mtime + metric re-measure);
   promote must re-derive package from corrected chapters and refuse on divergence;
   put "GATE PASS ≠ SEMANTICALLY VERIFIED" in front of every ship decision.

---

## FAST DIAGNOSTIC TELLS (cheat sheet for reviewers + future critics)
- Chapter mtime ≈ 1 min after a `scratch/*.mjs` mtime → script-generated.
- "Source Moment N.M" / "Second Angle" / "Practice Claim" titles → scaffold.
- "<Name> studies <label>" or concept used as object → slot-fill word-salad.
- "<time> a.m./p.m. in the <place>" as a scenario *header* (fixed time each chapter)
  → template (but a timestamp inside a real scene is fine).
- Quiz answerable by format (one un-prefixed choice, or the container noun) → key is
  position-identifiable, not meaning-based.
- Explanation = choice text + prompt text → echo-template hiding wrong keys.
- Card front with no "?" or a proper-noun subject; card back that appears verbatim in
  breakdown → pasted/low-value card.
- Perfectly even correctIndex split over incoherent choices → scripted rotation.
- GREEN book-gate + you haven't read content → you have NOT done QC.
