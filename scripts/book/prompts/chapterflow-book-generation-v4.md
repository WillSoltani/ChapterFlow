# ChapterFlow: Complete Book Generation Pipeline v4

## BOOK: [BOOK TITLE]

---

## HOW THIS PROMPT WORKS

You are the **orchestrator** for a quality-first ChapterFlow generation pipeline.

You do NOT write full chapter JSON directly unless you are making a tiny targeted fix. Your job is to:

1. Read the static instruction pack in `scripts/book/prompts/chapterflow-v4/`
2. Research the book and build infrastructure
3. Write rich chapter briefs to disk
4. Spawn specialized agents that READ the static files from the repo and the dynamic files you create for this book
5. Quality-gate prose before any structured conversion
6. Validate, assemble, wire, and build the final package, but only after Chapter 1 is approved

**Core architecture:**

- Canonical prose first, schema later
- The chapter brief is the factual source of truth
- The edited draft is the content source of truth
- No downstream agent may invent facts beyond the brief
- Quizzes are a separate pass after chapter content is validated
- Validators fix mechanics directly, but prose failures go to a repair pass
- Chapter 1 is an approval gate for the whole pipeline

**Why this architecture:** When one model tries to research, write beautiful prose, satisfy a large JSON schema, generate examples, generate quizzes, and self-validate all in the same pass, the writing collapses into compliance-heavy sludge. This pipeline isolates those jobs.

**Static files you must use from the repo:**

- `scripts/book/prompts/chapterflow-v4/style/voice.md`
- `scripts/book/prompts/chapterflow-v4/style/constraints.md`
- `scripts/book/prompts/chapterflow-v4/style/bad-patterns.md`
- `scripts/book/prompts/chapterflow-v4/style/gold-patterns.md`
- `scripts/book/prompts/chapterflow-v4/style/gold-prose.md`
- `scripts/book/prompts/chapterflow-v4/style/gold-examples.md`
- `scripts/book/prompts/chapterflow-v4/style/gold-quiz.md`
- `scripts/book/prompts/chapterflow-v4/briefs/brief-template.md`
- `scripts/book/prompts/chapterflow-v4/briefs/chapter-outline-template.md`
- `scripts/book/prompts/chapterflow-v4/rules/chapter-structure.md`
- `scripts/book/prompts/chapterflow-v4/rules/chapter-quality-gate.md`
- `scripts/book/prompts/chapterflow-v4/rules/quiz-rules.md`
- `scripts/book/prompts/chapterflow-v4/rules/validator-rules.md`
- `scripts/book/prompts/chapterflow-v4/rules/repair-rules.md`
- `scripts/book/prompts/chapterflow-v4/rules/writer-agent.md`
- `scripts/book/prompts/chapterflow-v4/rules/editor-agent.md`
- `scripts/book/prompts/chapterflow-v4/rules/converter-agent.md`
- `scripts/book/prompts/chapterflow-v4/rules/quiz-agent.md`
- `scripts/book/prompts/chapterflow-v4/rules/validator-agent.md`
- `scripts/book/prompts/chapterflow-v4/rules/repair-agent.md`

**Working directory for generated book files:**

Use `/tmp/{bookId}-generation-v4/`

Create this structure:

```text
/tmp/{bookId}-generation-v4/
├── briefs/
├── continuity/
├── drafts/
├── structured/
├── quizzes/
├── validated/
└── reports/
```

**Do not stop until the book package is assembled, wired, and built, or until you hit a true blocker.**

---

## PIPELINE OVERVIEW

| Phase | What | Who |
|------|------|-----|
| 0 | Clean slate | You |
| 1 | Deep research + chapter map | You |
| 2 | Infrastructure + continuity | You |
| 3 | Chapter 1 quality loop | Writer Agent → Editor Agent → You → Converter Agent → Validator/Repair |
| 4 | Approval gate | You stop and wait for approval |
| 5 | Remaining chapters in waves of 2 | Same loop |
| 6 | Quiz generation in waves of 2 | Quiz Agent |
| 7 | Full-book validation sweep | You + Validator logic |
| 8 | Assemble, wire, cover, build | You |

---

## PHASE 0: CLEAN SLATE

Search the codebase for any trace of this book and remove it.

1. Search `book-packages/` for all JSON files related to this book. Delete them.
2. Search `app/book/data/bookPackages.ts` for imports, exports, getters, and `BOOK_PACKAGES` references. Remove them.
3. Search `app/book/data/mockChapters.ts` for `TONE_AWARE_BOOK_IDS` and `TONE_BUNDLE_GETTERS` entries. Remove them.
4. Search `components/library/libraryData.ts` for `MOCK_BOOKS` entries. Remove them.
5. Search `lib/book-covers.ts` for `REAL_BOOK_COVER_PATHS` entries. Remove them.
6. Search `public/book-covers/` for this book's cover assets. Remove them.
7. Clear any old `/tmp/{bookId}-generation*` directories.
8. Grep the repo for the book title, author, and likely `bookId`.
9. Log: `Phase 0 complete. Codebase is clean.`

---

## PHASE 1: DEEP RESEARCH

Build a deep map of the entire book before generating anything.

### Step 1: Book metadata

Determine:

- full title
- author
- publication year / edition if available
- chapter count
- parts / sections / themes
- core thesis in 2 to 3 sentences
- cultural context and likely audience
- bookId slug
- categories and tags
- moral complexity flag

### Step 2: Per-chapter research

For every chapter, produce enough detail that a writer could draft it without improvising facts.

You must document:

- chapter number and title
- core claim in 3 to 5 specific sentences
- what makes this chapter distinct from the rest of the book
- author logic chain: first / then / then
- 2 to 3 required anchor stories or examples with names and relevant detail
- allowed quotes or near-quotes
- frameworks / named models / terms
- specific applications the author recommends
- common misreadings
- counterarguments / limitations / boundary conditions
- previous chapter bridge
- next chapter bridge
- cross-chapter tensions
- moral complexity framing
- conceptual complexity assessment: is this chapter making one argument from multiple angles, or building a multi-component framework? This determines the takeaway count ceiling.
- Bloom's ceiling: what is the highest cognitive level the source material can genuinely support for quiz questions?

### Step 3: Research quality gate

Do not proceed if any chapter is still thin.

Each chapter brief must pass:

- specific enough that it cannot be swapped to another chapter
- at least 2 strong named anchors where the book provides them
- at least 1 real line or near-line worth quoting where the book provides it
- practical implications tied to the chapter itself
- at least 1 limitation, tension, or failure mode for deeper treatment

Log: `Phase 1 complete. N chapters mapped.`

---

## PHASE 2: INFRASTRUCTURE

### 2A: Character name pool and ledger

Build a diverse pool of at least `15 x N` names.

Rules:

- assign 6 names per chapter: 3 primary, 3 secondary
- no name appears in more than 2 chapters total
- scenario names must come from the assigned pool only

### 2B: Format-category rotation table

For each chapter, assign:

- 6 formats exactly once:
  - `decision_point`
  - `postmortem`
  - `dialogue`
  - `predict_reveal`
  - `dilemma`
  - `before_after`

- 6 ending types exactly once:
  - `broader_principle`
  - `self_directed_question`
  - `surprising_implication`
  - `cross_domain`
  - `common_trap`
  - `perspective_reframe`

- category distribution:
  - 2 `work`
  - 2 `school`
  - 2 `personal`

Across the book:

- no format should lock to the same category for more than 2 consecutive chapters
- `dialogue` must appear in work, school, and personal across the book
- `before_after` must appear in work, school, and personal across the book

### 2C: Vocabulary audit

Identify likely overused words for this book and set caps.

Universal defaults:

- `structural`: 1 per chapter, 8 per book
- `mechanism`: 1 per chapter, 8 per book
- `framework`: 1 per chapter, 8 per book
- `pattern`: 3 per chapter, `N * 0.5` per book
- `dynamic`: 2 per chapter, `N` per book
- `leverage` noun: 1 per chapter, 6 per book
- `leverage` verb: 0
- `ask yourself`: 1 per chapter, 6 per book

### 2D: School-setting variety

Build 20+ school contexts.

Rules:

- max 3 `study group` scenarios across the book
- use actual variety: seminar, lab, debate prep, design critique, office hours, scholarship panel, rehearsal room, admissions interview, language lab, etc.

### 2E: Continuity state

Write `/tmp/{bookId}-generation-v4/continuity/continuity-state.json`:

```json
{
  "nameUsage": {},
  "formatCategoryHistory": [],
  "schoolSettingUsage": {},
  "wordFrequency": {},
  "phraseFrequency": {},
  "openerRegistry": {
    "gentle": {},
    "direct": {},
    "competitive": {}
  },
  "titleTemplateRegistry": {},
  "endingPatternRegistry": {}
}
```

### 2F: Master brief

Write `/tmp/{bookId}-generation-v4/briefs/master-brief.json` containing:

- bookId
- title
- author
- chapterCount
- chapterOrder
- globalNamePool
- formatCategoryTable
- schoolSettings
- vocabularyCaps
- moralComplexity
- all static prompt-pack paths

Log: `Phase 2 complete. Infrastructure validated.`

---

## PHASE 3: CHAPTER 1 QUALITY LOOP

Chapter 1 runs solo as the quality template.

### 3A: Write the chapter brief

Use `scripts/book/prompts/chapterflow-v4/briefs/brief-template.md` and write:

- `/tmp/{bookId}-generation-v4/briefs/ch01.md`

It must include:

- all chapter research
- all assigned scenario assets
- banned names / opener phrases / title patterns from continuity state
- vocabulary budget
- paths for canonical draft, edited draft, structured JSON, quiz, validated JSON, and reports

### 3B: Write the chapter outline

Before spawning the writer, write:

- `/tmp/{bookId}-generation-v4/briefs/ch01-outline.md`

Use `scripts/book/prompts/chapterflow-v4/briefs/chapter-outline-template.md`.

The outline must include:

- the chapter promise in one line
- the opening move
- the anchor allocation
- the paragraph-job map
- the key tension or limitation that makes hard depth real
- the next-chapter bridge
- the specific genericity risks for this chapter
- the takeaway count lock for easy, medium, and hard based on conceptual complexity
- the hard takeaway topic list showing each distinct concept
- the scenario lesson map showing what distinct skill each of the 6 scenarios teaches

No writer may start without a chapter outline.

### 3C: Spawn Writer Agent

Send this exact message:

> You are writing one canonical chapter draft. Read `/Users/willsoltani/dev/chapterflow-siliconx/scripts/book/prompts/chapterflow-v4/rules/writer-agent.md`, your chapter brief at `/tmp/{bookId}-generation-v4/briefs/ch01.md`, and your chapter outline at `/tmp/{bookId}-generation-v4/briefs/ch01-outline.md`. Write the canonical chapter to the path in the brief.

### 3D: Spawn Editor Agent

After the writer finishes, send:

> You are editing one canonical chapter draft. Read `/Users/willsoltani/dev/chapterflow-siliconx/scripts/book/prompts/chapterflow-v4/rules/editor-agent.md`, the chapter brief at `/tmp/{bookId}-generation-v4/briefs/ch01.md`, the chapter outline at `/tmp/{bookId}-generation-v4/briefs/ch01-outline.md`, and the canonical draft path in that brief. Write the edited draft to the path in the brief.

### 3E: Editorial quality gate

Read `scripts/book/prompts/chapterflow-v4/rules/chapter-quality-gate.md` and then read the edited draft yourself before conversion.

Auto-fail if any are true:

- generic enough to fit another chapter
- missing required anchor stories or frameworks
- invented facts, quotes, studies, or mechanisms
- fake depth / pseudo-neuroscience / unsupported precision
- repeated paragraph jobs
- weak opening
- weak next-chapter bridge
- no memorable sentence density
- moral complexity framed as endorsement instead of strategic awareness

Then score the draft using the rubric in `chapter-quality-gate.md`.

Rules:

- Chapter 1 must score at least `10/12` to proceed
- any unsupported factual claim forces rejection regardless of score
- any paragraph-job repetition forces rejection regardless of score
- any tone drift into generic self-help prose forces rejection regardless of score

If the edited draft is weak, send it back through the writer or editor with a targeted instruction. Do not convert weak prose into structure.

### 3F: Spawn Converter Agent

Once the edited draft passes:

> You are converting one approved chapter into ChapterFlow structure. Read `/Users/willsoltani/dev/chapterflow-siliconx/scripts/book/prompts/chapterflow-v4/rules/converter-agent.md`, the chapter brief at `/tmp/{bookId}-generation-v4/briefs/ch01.md`, the chapter outline at `/tmp/{bookId}-generation-v4/briefs/ch01-outline.md`, and the edited draft path in that brief. Write the structured chapter JSON to the path in the brief.

### 3G: Spawn Validator Agent

> You are validating one structured chapter. Read `/Users/willsoltani/dev/chapterflow-siliconx/scripts/book/prompts/chapterflow-v4/rules/validator-agent.md`, the chapter brief at `/tmp/{bookId}-generation-v4/briefs/ch01.md`, the chapter outline at `/tmp/{bookId}-generation-v4/briefs/ch01-outline.md`, the edited draft path in that brief, and the structured chapter path in that brief. Write the validation report and either the validated chapter JSON or a repair report, as instructed by the validator rules.

### 3H: Spawn Repair Agent if needed

If the validator produces a repair report:

> You are fixing one structured chapter after validation. Read `/Users/willsoltani/dev/chapterflow-siliconx/scripts/book/prompts/chapterflow-v4/rules/repair-agent.md`, the chapter brief, the chapter outline, the edited draft, the structured chapter JSON, and the repair report. Write the final validated chapter JSON to the path in the brief.

### 3I: Update continuity state

From the validated chapter, update:

- name usage
- format/category history
- school-setting usage
- capped vocabulary usage
- opener registry
- title patterns
- ending patterns

Log: `Chapter 1 validated and added to continuity state.`

### 3J: STOP AND REQUEST APPROVAL

After Chapter 1 is validated, stop and present:

- the chapter title
- the brief path
- the outline path
- the canonical draft path
- the edited draft path
- the validated JSON path
- the Chapter 1 quality-gate score
- a short quality summary
- any remaining concerns or tradeoffs

Then ask for approval to continue.

Required wording:

`Chapter 1 is ready for review. Approve this chapter to continue the rest of the book with the same pipeline.`

Do not generate Chapter 2 or any later chapter until approval is granted.

---

## PHASE 4: APPROVAL GATE

Wait here until the user explicitly approves Chapter 1.

If the user requests revisions:

- revise Chapter 1 using the same writer/editor/converter/validator/repair loop
- re-present the updated Chapter 1
- wait for approval again

Only after explicit approval may you proceed to the rest of the book.

---

## PHASE 5: REMAINING CHAPTERS

Process chapters 2 through N in waves of 2.

For each wave:

1. Write 2 chapter briefs with current continuity bans
2. Write 2 chapter outlines (each must include takeaway count lock, hard takeaway topic list, and scenario lesson map)
3. Spawn 2 Writer Agents in parallel
4. Spawn 2 Editor Agents in parallel
5. Read both edited drafts yourself and quality-gate them using `chapter-quality-gate.md`
6. Reject anything below `10/12` and repair before conversion
7. Spawn 2 Converter Agents in parallel
8. Spawn 2 Validator Agents in parallel
9. Spawn Repair Agents only where needed
10. Update continuity state from both validated chapters
11. Spot-check the easy breakdown and 2 random `moreDetails` fields for specificity

If N is odd, the final chapter runs solo.

---

## PHASE 6: QUIZ GENERATION

Generate quizzes only after all validated chapters exist.

Process in waves of 2.

For each chapter:

> You are generating the quiz for one approved chapter. Read `/Users/willsoltani/dev/chapterflow-siliconx/scripts/book/prompts/chapterflow-v4/rules/quiz-agent.md`, the chapter brief, the edited draft, and the validated chapter JSON. Write the quiz JSON to the path in the brief.

Then merge the quiz into the validated chapter JSON.

Spot-check:

- 10 questions
- 3 choices each
- explanations are tone objects
- correctIndex points to the real best answer
- explanation opener diversity
- bloomsLevel and depthLevel present on every question
- Bloom's progression: at least 2 remember/understand, at least 3 apply/analyze, at least 1 evaluate/create
- no two questions test the same principle
- cross-chapter questions only where supported

---

## PHASE 7: FULL-BOOK VALIDATION SWEEP

Read all validated chapters and check:

- schema integrity
- depth rules
- word counts
- example schema and rotation
- quiz schema including bloomsLevel and depthLevel
- content specificity
- vocabulary caps
- closing-pattern diversity
- scenario quality
- scenario lesson diversity within each chapter
- tone differentiation (no collapsed tone objects)
- activation prompt functionality (not passive or truncated)
- prediction prompt functionality (not teasers)
- recap retrieve sections demand recall (not summaries)
- cross-chapter references
- last chapter loops back to Chapter 1 when appropriate
- name reuse caps
- school-setting variety

Also run:

```bash
node scripts/book/validate-book.mjs book-packages/{bookId}.modern.json
```

Use the script's findings for mechanical checks. Use your own reading for specificity, repetition, unsupported claims, and tone collapse.

Log: `Phase 7 complete. Full-book validation complete.`

---

## PHASE 8: ASSEMBLE, WIRE, COVER, BUILD

### 8A: Assemble package JSON

Write:

- `book-packages/{bookId}.modern.json`

Use the validated chapters in order.

### 8B: Wire into codebase

Update:

- `app/book/data/bookPackages.ts`
- `app/book/data/mockChapters.ts`
- `components/library/libraryData.ts`
- `lib/book-covers.ts`

### 8C: Cover

Use the original published cover if available.

Write to:

- `public/book-covers/{bookId}-{date}-real.jpg`

If not available, log:

`ACTION NEEDED: Manually add cover.`

### 8D: Build

Run:

```bash
npm run build
```

Fix any errors.

Log: `Phase 8 complete. Book is live.`

---

## NOW

1. Read the static prompt pack files in `scripts/book/prompts/chapterflow-v4/`
2. Create your execution plan
3. Immediately begin Phase 0
4. Stop after Phase 3 and wait for Chapter 1 approval before continuing