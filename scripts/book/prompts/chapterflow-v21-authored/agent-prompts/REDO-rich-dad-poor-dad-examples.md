# Redo rich-dad-poor-dad — examples (de-template + persona consistency) + ch05 quiz distractors

You are doing **2 edits in every chapter** plus **1 extra edit in ch05 only**. Nothing else changes.

This is a **quality (GENERATED_DRAFT) redo, not a blocker redo.** Every gate already passes
GREEN with 0 blockers — that is exactly the problem. The book reads as a templated draft, not a
finished, publishable book. QC scored ch01/ch05/ch09 as **YELLOW (REVISE)**; the same pattern is
visible in every chapter's examples. Do not chase the gate — it is already satisfied. Fix the two
patterns below and the chapter becomes publishable.

## What you change
1. **Every `examples[].scenario`** in all 9 chapters — de-template (see Rule 1).
2. **Persona consistency** across `breakdown`, `examples`, and `quiz` in all 9 chapters — make each
   first name denote exactly one person doing one consistent activity (see Rule 2). This may mean
   editing a `breakdown` clause or a `quiz` prompt so the name matches the act it owns — that is allowed.
3. **ch05 only — `quiz.questions[].choices`** — kill the answer-length tell and the absolute-word
   strawmen (see Rule 3).

## What you do NOT change
- `quiz.questions[].correctIndex` — **all 81 keys were verified correct. Do NOT move a single key.**
- `quiz` prompts/choices in ch01–ch04, ch06–ch09 (only ch05's choices change; other chapters' quiz
  prompts change *only* if needed for persona consistency under Rule 2, never the keyed answer).
- `examples[].whatToDo`, `whyItMatters`, `planSpec`, `tags`, `sourceAnchorId`, `exampleId`, `title`.
- `breakdown` teaching content, `hook`, `counterintuition`, `tryThisNow`, `keyTakeaway`,
  `reviewCards`, `implementationPlan`, `memorableLines`, `schemaVersion`, `number`, `title`,
  `readingTimeMinutes`. (Touch a breakdown sentence ONLY to fix a persona mismatch under Rule 2.)

## Why this redo exists

The writer shipped chapters where every quiz key is correct and the prose teaches well, but the
example scenes are **mass-produced from one mold**. Two patterns make the book read as a draft:

**Pattern A — the rotating decision-frame skeleton with fixed clock-time stamps.** Nearly every
scenario in the book follows the identical shape:
> *"[Name] [does a task] at [H:MM a.m./p.m.] in/at [place] ... [a deadline: "Before X starts"] ...
> [Name] must decide whether [A] or [B]."*

Verbatim, ch01:
- ex01: "Maurice sweeps the back aisle of a small Hawaii store **at 9:10 a.m.** ... **Before he walks out, he must tell himself whether** the low pay proves he is being used **or whether** the anger is showing..."
- ex02: "Kathleen holds a dented pan over a backyard flame **at 3:40 p.m.** ... She **must answer whether** copying currency... **or whether** her energy needs real knowledge..."
- ex04: "Aisha stands beside the stockroom door **at 6:15 p.m.** ... **Seconds before she accepts, she has to say whether** the raise solves the problem **or** merely quiets the desire..."

Same mold in ch09 ("Before the workday starts" / "Before the lights shut off" / "Before the train
doors open" + 7:35 a.m., 8:50 p.m., 3:15 p.m., ...). The arbitrary clock stamps are the loudest tell.
**Count of clock-time stamps per chapter:** ch01=6, ch02=6, ch03=**0**, ch04=6, ch05=1, ch06=5,
ch07=7, ch08=6, ch09=6. **ch03 is the model — it has zero clock stamps and reads naturally. Make the
others look like ch03.**

**Pattern B — persona drift (one name = two different people).** A first name does one thing in the
breakdown and a *different* thing in the quiz, or two names share the same act:
- **ch01:** the comic-book kid is **Ravi** in the breakdown ("Ravi reaches the turn with comic books")
  and ex03, but **Min** in the breakdown fullRead ("Min runs into the other side... sorting old comic
  books") and q05. Meanwhile **Ravi** is given the *illegal-counterfeit-shortcut* act in q03 — which
  belongs to **Kathleen** (breakdown deepRead + ex02). Three names, two acts, scrambled.
- **ch05:** **Allison** is the toothpaste-tube person in the breakdown, the Bell/startup person in
  ex05, and the analyze-ten-rentals person in q06 — three unrelated acts under one name. **Anya** is
  the Bell person in the breakdown but the duplex person in ex02. **Kiara** is Bell in the breakdown
  but toothpaste in ex03/q03. **Finn** is real-estate in the breakdown, Bell in ex01, a service
  business in q01.
- **ch09:** **Sabine** = biographies (breakdown) + commute-cafe audit (ex04) + cheap-property listing
  (q06). **Joanne** = weekly-practice (breakdown) + bakery mentor (ex05) + reads-biographies (q07).

**Pattern C — ch05 quiz only: the correct answer is findable by length, and two distractors use
absolute words.** A test-savvy reader picks ch05's longest choice and is right:
- q04 correct answer is **1.96×** the average distractor length; q09 **1.76×**; q08 **1.66×**;
  q07 **1.64×**; q02 **1.33×**. The key is consistently the most-detailed choice.
- q05 choice 0: *"Credentials **never** matter in financial life once a customer problem appears."*
- q09 choice 2: *"Doubt is **always** a sign of superior analysis."*
  Absolute "never/always" claims are auto-eliminable — they are not plausible wrong answers.

## Files
- Chapter JSONs to modify: `state/chapters/rich-dad-poor-dad-ch{01..09}.v21-native.chapter.json`
- Source notes: **no `.chapterflow/runs/rich-dad-poor-dad/` sidecars exist on disk for this book.**
  Ground every edited scene in the **actual text of _Rich Dad Poor Dad_** (Kiyosaki). Do not invent
  source facts. The named anchors already in the chapters are faithful (10¢/hr dime store, toothpaste-
  tube counterfeit coins, comic-book library, Ray Kroc real-estate, Xerox sales course, four pillars
  accounting/investing/markets/law, five obstacles fear/cynicism/laziness/bad-habits/arrogance,
  Bell/Western Union) — keep them.

## Rules

### Rule 1 — `examples[].scenario` composition rule (all chapters)
Rewrite each scenario so the slate of 6–7 scenes reads like 6–7 different writers wrote them.
1. **Delete every clock-time stamp.** No scenario may contain a time like "9:10 a.m.", "at noon",
   "6:05 p.m.", "8:10 on Saturday morning". If a scene needs temporal grounding, use a *natural*
   beat ("on the third Saturday of unpaid work", "the morning the lease renewed") — never a digital clock.
2. **Break the "must decide whether A or B" closing frame.** At most **one** scenario per chapter may
   end on an explicit either/or decision sentence. Vary how the tension lands: an action interrupted
   mid-step, a number that doesn't add up, a thing already done that must be undone, a question a
   second person asks. Keep the `format` field's intent (decision_point / mistake_recovery / dialogue
   / reflection / audit) but realize it differently each time.
3. **Each scene gets its own concrete, domain-appropriate setting** drawn from `planSpec.domain` —
   a back stockroom, a kitchen table, a county-auction step, a bakery at closing — not a rotating
   "[place] at [time]" header. The `requiredBeat` must still happen.
4. **Keep it a real scene with a named human acting** — do not over-correct into an abstract concept
   essay. (ch05 ex03/Kiara was flagged C2 "lacks specific setting" — give it a real place and moment.)

### Rule 2 — persona consistency rule (all chapters)
1. Build a one-line cast list per chapter: each first name → the **single** activity/role it owns
   (e.g. ch01: Maurice=the dime-store sweeper, Kathleen=the counterfeit-coin kid, Ravi=the comic-book
   librarian). Pick the mapping already used by that name's own `examples[]` entry (the example title
   names the act) and make the breakdown and quiz conform to it.
2. **One act = one name.** If the breakdown and a quiz both depict "the comic-book library", they must
   use the *same* name. If two names currently share an act (ch01 Ravi vs Min on comics), reassign one.
3. **One name = one act.** If a name currently spans 2–3 unrelated acts (ch05 Allison, ch09 Sabine),
   keep it on the act its `examples[]` entry owns and move the other mentions to the correct name.
4. You may edit a `breakdown` clause or a `quiz` **prompt** to fix the name. **Never change a
   `correctIndex`, and never change which option is correct** — only the name/scene wrapper around it.

### Rule 3 — ch05 quiz distractor rule (ch05 ONLY)
1. For **q02, q04, q07, q08, q09**: bring `len(correct) / avg(len(distractors))` **below 1.4×** —
   either trim the correct choice to match the distractors' length or expand the distractors with
   specific, plausible (but wrong) detail. Do **not** change which choice is correct.
2. Replace the absolute-word strawmen so they become scenario-anchored, wrong-but-tempting claims:
   - q05 choice 0 ("Credentials **never** matter...") → a plausible over-reading, e.g. a claim that a
     credential is required *before* testing demand. No "never".
   - q09 choice 2 ("Doubt is **always** a sign of superior analysis.") → a plausible mis-read, e.g.
     that skepticism by itself is the safe financial default. No "always".
3. All three choices in each ch05 question should be within ~1.4× length of each other and each be a
   real wrong answer a learner could believe.

## Procedure
1. Work chapter by chapter, ch01 → ch09. Do ch03 first as a length/structure reference (it already
   passes Pattern A) — match its naturalness.
2. After each chapter, run and require **0 blockers** (this is a regression guard — gates already pass;
   don't introduce new blockers):
   `npx tsx src/cli.ts gate-chapter state/chapters/rich-dad-poor-dad-ch{NN}.v21-native.chapter.json`
3. Self-check each chapter before moving on:
   - `grep -nE '[0-9]{1,2}:[0-9]{2}|at noon' state/chapters/rich-dad-poor-dad-ch{NN}...json` → **no
     matches inside any `scenario`** (Rule 1.1).
   - No more than one scenario ends on "must decide whether ... or ..." (Rule 1.2).
   - Cast-list check: each name maps to exactly one act across breakdown/examples/quiz (Rule 2).
4. For ch05 also run the length check:
   `python3 -c "import json;d=json.load(open('state/chapters/rich-dad-poor-dad-ch05.v21-native.chapter.json'));[print(q['questionId'][-3:], round(len(q['choices'][q['correctIndex']])/(sum(len(c) for i,c in enumerate(q['choices']) if i!=q['correctIndex'])/2),2)) for q in d['quiz']['questions']]"`
   → every ratio **< 1.4**. And `grep -iE '\b(never|always)\b' ` finds none in ch05 choices.
5. After all chapters: `npx tsx src/cli.ts book-gate rich-dad-poor-dad` → **0 blockers** (the B13
   "hook clustering" major may remain; it is non-blocking, but if cheap to vary the 6 "a"-openers,
   do it).

## Done condition
- All 9 chapters' example scenarios de-templated (no clock stamps; ≤1 either/or closer per chapter;
  each scene its own setting).
- Persona map is 1:1 in every chapter (one name = one act, breakdown↔examples↔quiz).
- ch05: all 9 quiz length ratios < 1.4×; no "never/always" distractors; **no `correctIndex` changed**.
- Untouched fields verified unchanged (especially **all 81 `correctIndex` values**).
- Per-chapter `gate-chapter`: 0 blockers. `book-gate`: 0 blockers.
- **Editing the chapters will mark the existing QC attestations STALE** — that is expected. The book
  must be **re-QC'd** (re-read ch01/ch05/ch09 + re-attest) before `promote-book`. Do not run
  `promote-book` yourself.

Report back: per-chapter blocker count, book-gate blocker count, the ch05 length-ratio table, and a
one-line cast list per chapter showing each name → its single act.
