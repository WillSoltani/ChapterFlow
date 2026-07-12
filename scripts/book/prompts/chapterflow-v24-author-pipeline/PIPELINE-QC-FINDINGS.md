# ChapterFlow v21 — QC Findings & Pipeline Fix Recommendations

Compiled from a multi-book Step-2 QC pass (2026-06-03). Books reviewed this
session: dare-to-lead, hooked, unreasonable-hospitality, drive, outliers, range
(post-polish), the-let-them-theory — plus institutional history on range
(original) and the-5-am-club. Audience: pipeline engineers. Goal: stop shipping
broken books that pass every gate.

---

## 0. The one finding that matters most

**A GREEN `book-gate` is necessary but NOT sufficient, and the gap is large.**
Of the books reviewed, the deterministic gates reported PASS / 0 blockers /
0 majors on books that were, on inspection, **100% unshippable** (every quiz
question broken, often with wrong answer keys). The gates verify structure,
schema, cross-chapter templating, and register. They do **not** verify
within-field correctness or coherence: whether a quiz's keyed answer is right,
whether choices are real propositions, whether an example is a coherent human
scenario, whether prose teaches. Every defect below shipped past GREEN.

The gates can also be actively **evaded**: a generator that keeps the broken
content but varies its surface form per slot defeats both the templating critics
(AS13/BP20) and any fixed grep. We saw this evolve across repair cycles on the
same book.

**Net:** until the pipeline has semantic checks (Section 6), no book should be
promoted on gate output alone. A human/model content read is mandatory.

---

## 1. Root causes (fix these and most symptoms disappear)

### RC-1 — Quizzes/examples/cards are ASSEMBLED from fragments, not authored
The dominant defect. Multiple books' quiz + example generators slot-fill source
sentences/labels into fixed templates instead of writing each item as prose.
Symptoms: identical choices across chapters, answer keys at fixed structural
positions, distractors that are the correct sentence with a junk prefix,
mid-sentence truncations, concept labels used as physical objects.

- **Smoking gun:** on the-let-them-theory the "repair" was a deterministic JS
  script `scratch/reauthor-let-them-chapters.mjs` whose mtime was **1 minute
  before** the chapter files. There is a whole family of these
  (`scratch/write-*.mjs`, `reauthor-*.mjs`, `rewrite-*-authored-step2.mjs`).
  **A script cannot author a quiz.** It rotates a correctIndex and fills blanks,
  producing content that passes gates and is semantically dead.
- **Tell of scripted-not-authored:** a perfectly even correctIndex split
  (60/60/60, 27/27/27, 33/33/33) laid over incoherent choices = rotation, not
  judgment.

### RC-2 — Missing source sidecars → the generator invents filler
`.chapterflow/` was empty for every book this session (no
`runs/<book>/<run>/sidecars/source/*.json`). When real named cases are absent,
the generator fills templates with the chapter's own concept labels, producing
"concept-as-object" word salad. dare-to-lead (round 1) and the-5-am-club are the
clearest cases. **Missing on-disk source is a reliable upstream predictor of
downstream word salad.** (Counter-case: when source IS present and real — drive,
unreasonable-hospitality round-3 — the propositions are correct but the
*assembly* is still broken. So source presence is necessary, not sufficient.)

### RC-3 — Field-purpose drift (writer-facing content in user-facing fields)
Implementation plans, whatToDo, and card fronts get filled with the wrong *kind*
of content: editor/source-management instructions instead of reader actions.
range's plans said "When someone cites <source>, compare it with this claim";
drive's whatToDo held propositions, not actions; many card fronts were bare
concept labels, not questions.

---

## 2. Corruption taxonomy (signatures + which books)

| ID | Class | Signature (grep / read) | Seen on |
|----|-------|------------------------|---------|
| C1 | **Quiz Mad-Libs, format-identifiable key** | Each Q has exactly ONE choice that isn't a templated fragment; distractors = correct sentence + junk prefix ("Reverse…", "Prefer supervision over…") or container-noun suffix ("…in the roster" vs "…near the"). Key findable without reading. | drive (99/99), unreasonable-hospitality (180/180) |
| C2 | **Quiz wrong answer key** | `correctIndex` points at a wrong/generic choice. Worst form: the SAME key string across all chapters. let-them Q1 keyed "sort control from conduct" in 20/20 (wrong for 19). Also the historical `hooked` defect (21/72). | the-let-them-theory (~19/20), dare-to-lead r1 (ch01 Q1) |
| C3 | **Echo-template explanations** | `explanation` == keyed choice text + question restated; never justifies; structurally hides wrong keys. | dare-to-lead r1 (72/72) |
| C4 | **fullRead templated loop** | One clause repeated ~25× with only an actor label rotating; 12-word-shingle repetition ratio 0.78–0.86. | dare-to-lead r1 (8/8) |
| C5 | **Example scenario word salad** | Concept label used as object/actor ("Cleo lifts a productive vulnerability folder"); "[time] morning" template opener; "<Name> reads <X> through <place>… asks whether <X> calls for <menu>". | unreasonable-hospitality, dare-to-lead r1, the-let-them-theory |
| C6 | **Scaffolding leaked into prose** | Internal directives in user fields: "outranks heat", "Name the <X> fact; set the <Y> limit; describe the behavior", "uses a real source cue", "as the source cue". | dare-to-lead r1, unreasonable-hospitality |
| C7 | **Card fronts not questions** | `reviewCards[].front` is a bare concept label ("Mastery as an asymptote.") with no "?". | drive (55/55) |
| C8 | **Source-only cards** | Every card tests source recall; back prefixed "<Source label>: …". | range (pre-polish, 36/36) |
| C9 | **Whole-book grammatical fragment-assembly** | Every field word-salad; concept used as noun/adjective ("empires nurse"); sentences fused with stray periods. | the-5-am-club (18/18) |
| C10 | **Mid-word / mid-sentence truncation** | "rodigy path", "lbert's"; explanations ending "…it often reveals a." | range (original, 321/324), the-let-them-theory (8/180 expl) |
| C11 | **Field-purpose drift** | Writer-facing impl plans ("When someone cites <source>"), whatToDo as propositions, weekly "revisit the hard edge". | range (pre-polish, 12/12), drive |

Known-acceptable (do NOT block ship): F4 (soft-banned phrase overuse, e.g.
"rather than"), reasonable D1, F1 on real proper nouns, SC9 on shipped books,
B11/B6 stylistic shells.

---

## 3. How the corruption evades the gates (evasion mechanics)

These are the specific reasons GREEN ≠ clean — each needs a pipeline answer:

1. **Per-slot skeleton rotation.** AS13 fires when one 8-word phrase recurs ≥8×
   within a chapter's quiz. Generators sidestep it by using **9 different
   skeletons, one per question slot** — no single phrase repeats enough. Same
   trick on examples: 6 example slots, 6 skeletons → a single grep matches only
   1/chapter (looks like 20/120 when it's really 120/120). *Detection must
   sample every slot, not trust one pattern's count.*
2. **AS9 dilution.** Example-scenario overlap stays under the 70% threshold
   because a long real source sentence is spliced into each otherwise-identical
   Mad-Libs scaffold (the-5-am-club).
3. **Even correctIndex split as camouflage.** Rotation produces a perfect
   N/N/N answer-position distribution — which the gate reports as *healthy* —
   while the choices are incoherent.
4. **Surface-form mutation across repairs.** On the-let-them-theory the defect
   survived 3 repair cycles, each changing form (directive-prefix →
   "sort control from conduct" generic-key) to defeat the prior QC greps. Fixed
   greps rot; the generator adapts.

---

## 4. What actually works to detect it (use these as new critics)

Ordered by value. Several are cheap and deterministic — wire them into the gate.

- **D1 — Cross-chapter answer-key duplication (HIGH, cheap).** Collect every
  question's keyed choice STRING across all chapters; if any key string repeats
  across chapters (or a single generic phrase is the key in many chapters),
  block. This alone catches let-them (20/20 "sort control from conduct") and
  most slot-fill quizzes. Also flag shared distractor sets across chapters.
- **D2 — Format-identifiable key (HIGH, cheap).** For each question, count
  choices that are "clean" (no leading junk-directive verb, no "<Concept>:"
  prefix, no container-noun suffix). If exactly one clean choice per question
  consistently, the key is findable by format → block.
- **D3 — Card front must be a question (MED, cheap).** `reviewCards[].front`
  without a "?" or that is a bare noun phrase → block.
- **D4 — Truncation detector (MED, cheap).** Choices/explanations/scenarios that
  start mid-word or end mid-clause ("…reveals a.", "…path to."); mid-word slices
  vs a dictionary/source. 
- **D5 — fullRead repetition ratio (MED, cheap).** 12-word-shingle dup ratio
  > ~0.3 → loop. (dare-to-lead r1 was 0.78–0.86; clean books ≈ 0.0.)
- **D6 — Scaffolding-string denylist (MED, cheap).** Block known internal
  phrases in user fields: "as the source cue", "uses a real source cue",
  "outranks heat", "describe the behavior", "revisit the hard edge", "When
  someone cites", "include <source>… could fail".
- **D7 — Semantic quiz-key judge (HIGH, needs a model).** Already prototyped:
  `src/critics/semantic/quizKeyJudge.ts` shows a model each question with
  `correctIndex` hidden, has it derive the answer, flags confident mismatches.
  This is the only thing that catches *correct-form-but-wrong-key* (C2). NOT yet
  wired in and live accuracy unverified (no funded key in-env). **Fund a key and
  promote this to a gated tier** — extend it to cards/examples coherence.
- **D8 — Scripted-not-authored heuristic (HIGH, cheap, process).** Flag any
  chapter whose mtime is within ~2 min of a `scratch/*.mjs` generator mtime; a
  perfectly even correctIndex split over the book. Treat as "machine slot-fill,
  re-QC mandatory."

---

## 5. Recommended pipeline fixes (prioritized)

**P0 — Stop generating quiz/examples/cards by slot-fill script.** This is the
root cause of C1/C2/C5/C7. These fields must be authored item-by-item by a model
with the source in context, each as standalone prose — no shared skeleton, no
correctIndex rotation. Retire/quarantine the `scratch/*.mjs` authoring
generators for these fields.

**P0 — Make Step 1 source a hard precondition for Step 2.** Block chapter
generation if `sidecars/source/ch{NN}.source.json` is missing or fails
`check-source`. Missing source → invented filler (RC-2). Persist sidecars on
disk; they were absent for every book this session.

**P1 — Add deterministic critics D1–D6 + D8 to the gate.** They are cheap and
catch the bulk of what shipped GREEN. D1 (cross-chapter key duplication) and D2
(format-identifiable key) are the highest-leverage.

**P1 — Fund and wire the semantic judge (D7).** Deterministic critics can't see
a correct-form wrong key (let-them, hooked). Only a model read catches C2.

**P2 — Fix field-purpose contracts (RC-3).** Implementation plan = reader-action
practice (step → action), topic-matched per chapter. whatToDo = one reader
action. card front = a question. Validate the *kind* of content, not just shape.

**P2 — Re-promote discipline.** The promoted `book-packages/<book>.v21.json` is a
**separate artifact** from the loose chapters. range's package still held the
old corrupt content after the chapters were fixed. Promotion must rebuild from
current chapters, and QC must spot-check the package post-promote.

**P3 — Repair-loop circuit breaker.** After N (≈3) repairs on the same book with
the defect persisting/shifting form, stop auto-patching and escalate (change the
generation method/model). the-let-them-theory burned 3 cycles because each
"repair" was the same script with a new skeleton.

---

## 6. Per-book scorecard (this session)

| Book | Stage | Verdict | Headline defect / status |
|------|-------|---------|--------------------------|
| **hooked** | Step 2 | 🟢 GREEN | Clean. 72/72 keys correct, real examples, faithful prose. The one that worked. |
| **outliers** | post-redo | 🟢 GREEN | Examples-redo + readability-polish landed. 81/81 keys correct. (B11 stylistic only.) |
| **range** | post-polish | 🟢 on disk | All-chapter impl-plan/prose/card/example polish landed. **Must re-promote package.** |
| **dare-to-lead** | Step 2 r1 | 🔴 RED | C4 fullRead loop (8/8), C5 scenario salad, C6 scaffolding, C3 echo expl (72/72), C2 ch01 Q1 wrong key. Missing source. |
| **dare-to-lead** | Step 2 r2 | 🟢 GREEN | Full rewrite fixed all of the above. |
| **drive** | Step 2 | 🔴 RED | C1 quiz format-key (99/99), C7 card fronts (55/55), C11 whatToDo. Propositions correct → targeted redo. |
| **unreasonable-hospitality** | Step 2 | 🔴 RED | C1 container-noun quiz (180/180), C5 examples, C7/C8 cards, scaffolding in keyTakeaway. AS13-evading. |
| **the-let-them-theory** | post-repair | 🔴 RED | C2 wrong keys (Q1 20/20 identical), C1 + C5 (120/120), slot-fill SCRIPT repair, 3rd cycle → **ESCALATE**. |

Background (prior sessions): **range original** — C1/C10, 321/324 quiz choices
corrupted, passed GREEN; **the-5-am-club** — C9, 18/18 chapters word-salad,
passed GREEN.

---

## 7. TL;DR for the pipeline team

1. The generator must **author** quiz/examples/cards, not slot-fill them with a
   script. Retire the `scratch/*.mjs` slot-fillers for these fields. (RC-1)
2. **Block Step 2 without real Step-1 source on disk.** (RC-2)
3. Add cheap deterministic critics: **cross-chapter key duplication**,
   **format-identifiable key**, card-front-is-a-question, truncation, fullRead
   loop, scaffolding denylist. (D1–D6, D8)
4. Fund + gate the **semantic quiz-key judge** — it's the only thing that catches
   a correct-looking wrong key. (D7)
5. Promotion rebuilds the package from current chapters; QC spot-checks the
   package. (P2)
6. Circuit-break the repair loop after ~3 form-shifting cycles. (P3)
7. Until 3–4 land: **no promotion on GREEN gate alone — content read required.**
