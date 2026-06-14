# Redo dare-to-lead — DE-TEMPLATE THE SUPPORT PACKAGE (all 8 chapters)

You are doing a **surgical, book-wide** redo — six field-level edits in **every
chapter (ch01–ch08)**, plus three ch07-only correctness fixes. The conceptual
content is correct and the quiz keys are sound; **do not regenerate from scratch.**

> **This SUPERSEDES `REDO-dare-to-lead-full-rewrite.md`.** That prompt described
> an earlier, much worse generation (fullRead clauses repeated ~25×, "Cleo lifts
> a productive vulnerability folder" word-salad, echo-explanations, a wrong key
> at ch01 Q1). All of that has already been fixed in the current on-disk book —
> verified: ch01 Q1 now keys index 2 with a real explanation; examples are
> coherent; quiz explanations justify the key. Ignore the old prompt.

## The one root cause (fix this thinking everywhere)

The writer authored good `breakdown` prose and a small pool of source sentences,
then **pasted those same sentences as filler into the review cards, the
implementation plan, the example scenarios, and the memorable lines.** No critic
fires (gates are GREEN, 0 blockers, 0 majors), so this must be fixed by reading.
Every fix below is the same instruction: **compose each field for its own job;
never reuse a `breakdown`/source sentence verbatim in another field.**

Evidence (book-wide, measured across all 8 chapters):
- **4 of 5 review-card backs per chapter** are a `breakdown` sentence pasted verbatim (32/40 cards).
- **All 3 implementation `ifThenPlans` per chapter** paste a `breakdown` sentence into the `plan` field (24/24).
- **Every chapter's 6 examples are 3 pairs**; each pair shares the same two pasted breakdown/source sentences padding the `scenario` and `whatToDo`.
- **Memorable line #2 in every chapter is 16–23 words** — an explanation, not an aphorism.

---

## What you change (per chapter, ch01–ch08)

1. `reviewCards[].front` and `reviewCards[].back`
2. `implementationPlan` (`coreSkill`, `ifThenPlans[].context`, `ifThenPlans[].plan`)
3. `examples[].scenario` and `examples[].whatToDo`
4. `memorableLines[].text`
5. `breakdown.fastRead` (tighten — say each idea once)

## What you change in ch07 ONLY (correctness)

6. `breakdown.deepRead` and `breakdown.fullRead` — fix the incomplete framework
   enumeration and the duplicate definitions (details below).
7. `quiz.questions` — convert/add **one** question that tests **Integrity**.

## What you do NOT change

`chapterId`, `number`, `title`, `readingTimeMinutes`, `hook`, `counterintuition`,
`tryThisNow`, `keyTakeaway`, `examples[].exampleId/title/tags/planSpec/whyItMatters`,
and **all `quiz` prompts/choices/correctIndex/explanation** (except the single
ch07 Integrity question in #7). Do **not** add or remove chapters, examples,
cards, or questions (except the ch07 Integrity swap). Preserve the *unique,
coherent core* of each example scenario (see rule 3) — you are removing pasted
padding, not rewriting the situation.

## Why this redo exists

Final QC of ch07 ("Braving Trust") scored the chapter 78/100 — "not yet
publishable" — for templated execution, and a book-wide scan confirmed the same
pattern in all 8 chapters. The gates cannot see it because pasted-but-true
sentences are structurally valid. Verbatim broken output:

**Cards pasted from the breakdown (ch07):**
> front: "When should BRAVING inventory influence a leader?"
> back:  "Specific language lowers defensiveness and makes trust repair actionable."  ← does NOT answer "when?", and is lifted from fastRead

**Source-label card fronts (6 of 8 chapters) — three fixed templates with a proper noun slotted in:**
> "When should Theodore Roosevelt arena frame influence a leader?" (ch01)
> "How does Stefan Larsson and Old Navy change the next conversation?" (ch05)
> "How does Brent Ladd at Purdue University change the next conversation?" (ch07)
> "When should Ham Foldover Debacle influence a leader?" (ch08)

**Example scenarios padded with pasted, topically-mismatched filler (ch07):**
> ex6 "Partnership Generosity" is about a missed deadline with thin evidence, but its scenario pastes the **gossip/Vault** sentence: *"Sharing someone else's private information can create a quick feeling of intimacy…"*
> ex2 "Campaign Reliability" and ex5 "Migration Amends" both paste the **Purdue self-trust** paragraph though neither is about self-trust.

**Implementation plan — situational triggers replaced by source labels, plans pasted:**
> ifThenPlan.context = "Brent Ladd at Purdue University"  (should be a *situation*)
> ifThenPlan.plan ends with pasted "Specific language lowers defensiveness and makes trust repair actionable."

**ch07 framework error — BRAVING is a named 7-part acronym, but one letter is dropped and one is renamed:**
> deepRead enumerates only **6**: "boundaries, reliability, vault, integrity, nonjudgment, and generosity" — **Accountability is missing.** (The incomplete list is also copied into memorable line #2.)
> fastRead writes the V-letter as **"confidentiality"** once and "vault" twice.
> fullRead **defines Reliability, Accountability, and Vault twice each** in near-verbatim consecutive sentences.

## Files

- Chapter JSONs to modify: `state/chapters/dare-to-lead-ch{01..08}.v21-native.chapter.json`
- Source notes: `.chapterflow/runs/dare-to-lead/<runId>/sidecars/source/ch{NN}.source.json`
  — **NOTE: these do not currently exist on disk** (`.chapterflow/` is empty for
  this book). The existing content is coherent and grounded enough to de-template
  against, so a Step-1 re-run is **not required** for this pass. But do not invent
  new named cases; reuse the real situations already in each chapter's examples.

## Rules — per-field composition

### 1. reviewCards composition rule
- **front** = a question about a *behavior, distinction, or skill the reader must
  recall* — never a question about a source label or anecdote. **Banned front
  templates** (and any close variant): `"When should <X> influence a leader?"`,
  `"What does <X> add to the practice?"`, `"How does <X> change the next
  conversation?"`, `"Which warning keeps <X> honest?"`, `"What does <X> require
  under pressure?"`. No proper noun (person, university, exercise name) may be the
  subject of a front.
- **back** = a crisp, **freshly authored** 1–2 sentence answer that actually
  answers its front. It may **not** be a sentence that appears anywhere in
  `breakdown`. Test each back: does it answer *this* front?
- ch07 cards should test the BRAVING behaviors. Example direction:
  | front | back |
  |---|---|
  | What does Reliability test? | Whether commitments are realistic and repeatedly kept, not overpromised to earn approval. |
  | What does Accountability require? | Owning the mistake, apologizing, making amends, and changing the behavior. |
  | What does the Vault protect? | Information that is not yours to share — and it treats gossip as a breach, not bonding. |
  | What does Generosity mean here? | The most charitable reading the available facts can honestly support. |
  | What does Integrity choose? | Values over convenience, especially when convenience is easier. |

### 2. implementationPlan composition rule
- `coreSkill` = one tight sentence naming the skill. Not a pasted paragraph.
- `ifThenPlans[].context` = a **situational trigger**, e.g. "Confidential
  information is moving through unclear access rules" — **never** a proper-noun
  label like "Brent Ladd at Purdue University" or "Square Squad exercise".
- `ifThenPlans[].plan` = a crisp `If <trigger>, then <specific action>` step.
  It may **not** contain any sentence that appears in `breakdown`.
- Keep `twentyFourHourChallenge` and `weeklyPractice` to one action each.
- ch07 plan should read as a usable BRAVING repair sequence: name the strain →
  pick the BRAVING letter → name the specific behavior → choose the repair
  (boundary / kept promise / apology+amends / protected confidence / honest
  value / charitable reading) → name the observable evidence of repair.

### 3. examples composition rule
- Keep each example's existing **unique opening situation** (e.g. ch07 ex1: Marta
  and the vague file-access rules; ex3: Oren and advising-office gossip). Those
  cores are good.
- **Delete the 2 pasted breakdown/source sentences** that pad each `scenario`,
  and the 1 pasted sentence that ends each `whatToDo`. Replace with prose that
  belongs to *this* scene only.
- Each example teaches **one** concept/behavior (match `tags`). Do not import an
  unrelated source fragment: keep gossip in **Vault** examples only; use missed
  deadlines for **Reliability/Accountability**; use thin-evidence-about-intent
  for **Generosity**; use the Purdue/self-trust idea in **one** self-trust/control
  example only (ch07 ex4 "Purdue Control" is the right home).
- `scenario` = a concrete moment: a visible trust break, then the stakes.
  `whatToDo` = the specific repair action and its consequence. No two examples in
  the book may share a `whatToDo`/`whyItMatters` sentence (currently each pair does).

### 4. memorableLines composition rule
- Each of the 3 lines = a sharp, portable aphorism, **≤ 14 words**, no list.
  Rewrite line #2 in every chapter (it is the over-long one). For ch07:
  > line 2 current: "Brown uses BRAVING to break a global accusation into inspectable parts: boundaries, reliability, vault, integrity, nonjudgment, and generosity…"
  > better: "Trust repair starts when the accusation becomes a nameable behavior."
- A memorable line may not contain a framework enumeration.

### 5. breakdown.fastRead composition rule (all chapters)
- State each idea **once**. Name the framework once, then show one concrete
  mini-application; do not restate the thesis 3–4 times. ch07 target shape:
  trust feels vague until behavior names it → BRAVING gives seven behaviors →
  one quick example (missed deadline = Reliability; gossip = Vault) → repair
  begins by naming the strained letter.

### 6. ch07 breakdown.deepRead / fullRead (correctness)
- **Every** enumeration of BRAVING must list all seven, in order, with canonical
  names: **Boundaries, Reliability, Accountability, Vault, Integrity,
  Nonjudgment, Generosity.** Never drop Accountability. Never write
  "confidentiality" for the V-letter — it is **Vault**.
- Define each letter **once**. Remove the duplicate consecutive definitions of
  Reliability, Accountability, and Vault in `fullRead`. Then show how the *repair*
  differs by letter (overpromise → Reliability reset; breach → Vault correction;
  harsh assumption → Generosity).

### 7. ch07 quiz — add one Integrity question
- BRAVING's Integrity letter is untested. Convert the weakest existing question
  (or add one, keeping the count consistent with the other chapters) to test it.
  Example:
  > prompt: "A leader says transparency matters but quietly hides unfavorable data before a board review. Which BRAVING behavior is under strain?"
  > correct choice: "Integrity — convenience was chosen over a stated value."
  > explanation: must say *why* integrity (stated value vs convenience) and why the distractors (e.g. Vault, Reliability) do not fit.
- Re-verify **every** quiz key in **every** chapter while you are here — do not
  assume. Confirm each `correctIndex` points at the genuinely correct choice and
  each `explanation` supports that same choice.

## Banned substrings (appear book-wide as pasted filler — remove everywhere)
- "Specific language lowers defensiveness and makes trust repair actionable."
- "Seven behaviors turn trust into a practical checklist: …"
- "BRAVING is an inventory of seven trust behaviors: …" (as a card back / scenario / plan line)
- "The simplified takeaway is to be more trusting…" (as a card back / plan line)
- Any `breakdown` sentence reused verbatim in `reviewCards`, `implementationPlan`,
  `examples`, or `memorableLines`.

## Procedure
1. Work chapter by chapter, ch01 → ch08.
2. After each chapter:
   `npx tsx src/cli.ts gate-chapter state/chapters/dare-to-lead-ch{NN}.v21-native.chapter.json`
   — must report **0 blockers** before moving on.
3. After all chapters:
   `npx tsx src/cli.ts book-gate dare-to-lead` — must report **0 blockers**.

## Done condition (gates are necessary but NOT sufficient)
- Per-chapter `gate-chapter`: 0 blockers. `book-gate`: 0 blockers.
- **AND** a content read confirms, in every chapter:
  - No `reviewCards.back` is a verbatim `breakdown` sentence; every back answers its front; no card front is a source-label template.
  - No `implementationPlan.ifThenPlans.context` is a proper-noun label; no `plan` line is a pasted `breakdown` sentence.
  - No example `scenario`/`whatToDo` contains a banned substring; no two examples share a `whatToDo`/`whyItMatters` sentence; each example stays on its one tagged concept (gossip only in Vault examples; Purdue/self-trust in one control example).
  - Every `memorableLines.text` is ≤ 14 words and list-free.
- **AND** specifically in ch07: every BRAVING enumeration lists all 7 canonical
  letters; no letter is defined twice; the quiz now tests Integrity; ch01 Q1
  still keys index 2.

Report back: per-chapter blocker count, book-gate blocker count, and quote one
rewritten review card + one rewritten example `scenario` from ch07 and from one
other chapter, so the de-templating can be spot-verified.
