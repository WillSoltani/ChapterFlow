# ChapterFlow Pipeline — Continuation Handoff
**Book:** Difficult Conversations (Douglas Stone, Bruce Patton & Sheila Heen, 10th Anniversary Edition, 2010)
**Run ID:** 20260406-01
**Run directory:** `.chapterflow/runs/difficult-conversations/20260406-01/`
**Pipeline version:** ChapterFlow v12-sealed
**Date of this handoff:** 2026-04-10

---

## Current State

Chapters 1–9 are complete and validated. The validated/ directory contains:
`ch01.chapter.json` through `ch09.chapter.json`

**Completed waves:**
- Wave 1: Ch01–02 ✓
- Wave 2: Ch03–04 ✓
- Wave 3: Ch05–07 ✓
- Wave 4: Ch08–09 ✓

**Remaining waves:**
- Wave 5: Ch10–11
- Wave 6: Ch12 (solo, integration premium)

---

## Pipeline Structure

Each chapter requires **12 artifacts** across three phases. All 12 must pass before the approval gate.

### Phase 3 — Dossier Package (5 artifacts per chapter)
1. `briefs/ch{N}.md` — Core claim, concept budget, risk flags, callback/forward bridges
2. `outlines/ch{N}.md` — Paragraph-level job map with takeaway lock (Easy:3 / Medium:5 / Hard:6)
3. `quiz-blueprints/ch{N}.md` — Bloom ceiling, 10-question plan with distractor notes and correctIndex plan (advisory)
4. `sidecars/source/ch{N}.source.txt` — Source excerpts organized by section
5. `sidecars/source/ch{N}.source.json` — Concept objects derived from source

### Phase 4 — Prose Loop (3 artifacts per chapter)
6. `drafts/canonical/ch{N}.md` — Full draft (~900–1100 words)
7. `drafts/edited/ch{N}.md` — Tightened edit (~750–900 words)
8. `reports/ch{N}.critic.md` — Critic report (must clear all auto-fail conditions; target 12/12)

### Phase 5 — Structure Loop (4 artifacts per chapter)
9. `structured/ch{N}.chapter.json` — Full structured JSON (EMH variants, examples, reviewCards, keyTakeawayCard)
10. `quizzes/ch{N}.quiz.json` — 10-question quiz JSON
11. `reports/ch{N}.validation.md` — Validation report (schema, scenarioTonePolicy, quiz, name ledger, quality gate)
12. `validated/ch{N}.chapter.json` — Copy of structured JSON after validation passes

### Wave gate
After both chapters in a wave are complete, present an **Approval Gate** table showing all checks for both chapters before proceeding to the next wave.

---

## Non-Negotiable Pipeline Rules

### 1. scenarioTonePolicy = required
Every example's `scenario`, `whatToDo`, and `whyItMatters` fields **must** be tone objects, never plain strings.

```json
"scenario": {
  "gentle": "...",
  "direct": "...",
  "competitive": "..."
},
"whatToDo": {
  "gentle": "...",
  "direct": "...",
  "competitive": "..."
},
"whyItMatters": {
  "gentle": "...",
  "direct": "...",
  "competitive": "..."
}
```

This applies to all 6 examples per chapter, without exception. A plain string in any of these fields is an auto-fail.

### 2. Quiz correctIndex discipline
- Write all 4 options first
- Read the options, identify which one is actually correct
- Set correctIndex based on the written options
- **Never** pre-assign a correctIndex before writing options, then fit the options around it

The quiz blueprint's `correctIndex plan` is **advisory only** — a target distribution to aim for, not a constraint to satisfy. If the correct answer lands at a different index than planned, update the correctIndex to match the actual correct option. Distribution checks in the validation report verify the final result; they do not override accuracy.

### 3. No pipeline language in reader-facing prose
The edited draft and structured JSON chapterBreakdown fields must read as if they are published book content. No references to "this chapter," "this section," "the framework," "the tool," or process-language that would signal the text is an artifact. This is an auto-fail condition in the critic report.

### 4. Critic auto-fails must be resolved before Phase 5
The critic report (`reports/ch{N}.critic.md`) must show all auto-fail conditions as CLEAR. Do not proceed to the converter (structured JSON) if any auto-fail is unresolved.

### 5. Run chapters within a wave sequentially, not simultaneously
Within a wave, run all 12 artifacts for the first chapter (Ch10), then all 12 for the second (Ch11), then present the wave approval gate. Do not interleave chapters.

Exception: Phase 3+4 for both chapters in a wave can be produced in parallel by separate subagents, since they work from different source material and do not share state. Phase 5 (converter + quiz + validation) should be done sequentially to maintain correctIndex discipline and name ledger integrity.

---

## Structured JSON Schema — outputProfile: flagship_v4_compatible

### Top-level fields
```json
{
  "chapterId": "ch{N}-{slug}",
  "chapterNumber": N,
  "chapterTitle": "Title",
  "readingTimeMinutes": 8,
  "contentVariants": { ... },
  "examples": [ ... ],
  "reviewCards": [ ... ],
  "keyTakeawayCard": { ... }
}
```

### contentVariants — Easy
```json
"easy": {
  "chapterBreakdown": "...",
  "keyTakeaways": [
    { "point": "..." }   // point only — NO moreDetails
    // exactly 3 items
  ],
  "oneMinuteRecap": "..."   // flat string — NOT an object
}
```
No `selfCheckPrompt`, no `activationPrompt`, no `predictionPrompt` in easy.

### contentVariants — Medium
```json
"medium": {
  "chapterBreakdown": "...",
  "keyTakeaways": [
    { "point": "...", "moreDetails": "..." }
    // exactly 5 items — all have moreDetails
  ],
  "selfCheckPrompt": "...",   // singular STRING — NOT an array
  "activationPrompt": "...",
  "oneMinuteRecap": {
    "retrieve": "...",
    "connect": "...",
    "preview": "..."
  }
}
```
No `predictionPrompt` in medium.

### contentVariants — Hard
```json
"hard": {
  "chapterBreakdown": "...",
  "keyTakeaways": [
    { "point": "...", "moreDetails": "..." }
    // exactly 6 items — all have moreDetails
  ],
  "selfCheckPrompts": [ "...", "..." ],   // plural, ARRAY of 2 — NOT a string
  "predictionPrompt": "...",
  "activationPrompt": "...",
  "oneMinuteRecap": {
    "retrieve": "...",
    "connect": "...",
    "preview": "..."
  }
}
```

### Examples — exactly 6 per chapter
```json
{
  "id": "ex01",
  "format": "decision_point",
  "category": "work",
  "endingType": "decision_reframe",
  "title": "...",
  "scenario": { "gentle": "...", "direct": "...", "competitive": "..." },
  "whatToDo": { "gentle": "...", "direct": "...", "competitive": "..." },
  "whyItMatters": { "gentle": "...", "direct": "...", "competitive": "..." }
}
```

**Format rotation** — each used exactly once per chapter:
`decision_point`, `postmortem`, `dialogue`, `predict_reveal`, `dilemma`, `before_after`

**Ending type rotation** — each used exactly once per chapter:
`decision_reframe`, `hidden_cost`, `relationship_turn`, `broader_principle`, `self_diagnosis`, `behavior_shift`

**Category distribution** — exactly 2 of each per chapter:
`work` (2), `school` (2), `personal` (2)

### reviewCards — exactly 5 per chapter
```json
{ "difficulty": "easy", "front": "...", "back": "..." }   // 1 easy card
{ "difficulty": "medium", "front": "...", "back": "..." }  // 2 medium cards
{ "difficulty": "hard", "front": "...", "back": "..." }    // 2 hard cards
```

### keyTakeawayCard — tone object
```json
"keyTakeawayCard": {
  "gentle": "...",
  "direct": "...",
  "competitive": "..."
}
```

---

## Quiz Schema

```json
{
  "chapterId": "ch{N}-{slug}",
  "chapterNumber": N,
  "chapterTitle": "Title",
  "passingScorePercent": 80,
  "questions": [
    {
      "id": "q01",
      "bloom": "remember",
      "questionText": "...",
      "options": [ "A", "B", "C", "D" ],
      "correctIndex": 1,
      "explanation": "...",
      "distractorNotes": {
        "0": "...",
        "1": "...",
        "2": "...",
        "3": "..."
      }
    }
    // 10 questions total
  ]
}
```

**Bloom distribution per chapter:**
- q01–q02: `remember`
- q03–q04: `understand`
- q05–q06: `apply`
- q07–q10: `analyze` (or `evaluate` if the chapter has a moral complexity flag — check the quiz blueprint)

**Bloom ceiling guidance:**
- Chapters with moral complexity (competing legitimate values) → ceiling is `evaluate`
- Chapters without moral complexity → ceiling is `analyze`
- Never go above the ceiling specified in the quiz blueprint

**correctIndex distribution goal:** No single index should appear more than 3 times across 10 questions.

**distractorNotes** are required for all 4 options per question — including the correct option (briefly explain why it is correct).

---

## Banned Names — Cumulative Through Ch09

The following names are banned from Ch10 onward. A name used in any prior chapter may not appear in any subsequent chapter (in examples, quiz scenarios, or prose).

### Confirmed banned (Ch08 and Ch09 additions — full list from this session):
**Ch08:** Soren, Claudia, Tsega, Professor Huang, Wren, Obinna, Lerato, Phoebe, Cian, Ines
**Ch09:** Seren, Nizhoni, Pita, Desmond, Oluwatobi, Camille, Tariq, Rifka, Augustin, Ingrid, Leigh, Professor Vidal

### Ch02 confirmed banned (from session records):
Reza, Yuki, Ananya, Nneka, Omar, Fatima, Dev, Bram, Yara, Elan, Professor Reyes, Tomás

### Ch07 quiz correction (confirmed banned):
Tamar (used in Ch07 quiz q08 after Yara→Tamar correction)

### Ch01 / Ch03–Ch07 — compile from validation reports:
The full name lists for Ch01 and Ch03–Ch07 are documented in their validation reports at:
`reports/ch01.validation.md` through `reports/ch07.validation.md`

**Before writing any Ch10 example or quiz scenario, read the name ledger sections of all prior validation reports to compile the complete banned list.** Do not rely on this handoff alone for Ch01/Ch03–Ch06 names.

---

## Wave 5 — Ch10 and Ch11

### Order of operations
1. Produce Phase 3+4 for Ch10 (can parallelize with Ch11 if running subagents)
2. Produce Phase 5 for Ch10 (structured JSON → quiz → validation → validated/)
3. Produce Phase 3+4 for Ch11
4. Produce Phase 5 for Ch11
5. Present Wave 5 Approval Gate (both chapters must be 12/12)

### Before starting Ch10
- Read the source material. The book's Chapter 10 content is in the book text; derive the brief, outline, and quiz blueprint from it.
- Identify the chapter's core claim, concept budget (how many distinct moves the chapter introduces), and whether the chapter has a moral complexity flag (determines Bloom ceiling).
- Note whether the chapter is thin (few concepts, high padding risk) or standard.

### Key checks before Wave 5 approval gate
- Name ledger: compile full banned list from Ch01–Ch09 validation reports before assigning any names
- Bloom ceiling: evaluate is justified only if the chapter has a moral complexity flag in the brief
- Hard-depth content: the hard reading variant must develop the chapter's most challenging implication, edge case, or failure mode — not just restate medium content with extra words
- All 18 tone fields in examples must be tone objects
- correctIndex distribution: no single index more than 3/10

---

## Wave 6 — Ch12 (Solo, Integration Premium)

Ch12 is the final chapter and runs solo (no paired chapter). It carries an integration premium: the structured JSON should contain at least 2 reviewCards that bridge concepts from prior chapters, and the hard variant's selfCheckPrompts should ask the reader to connect Ch12's move to at least one earlier chapter's framework.

Present the Wave 6 Approval Gate after Ch12 is validated.

---

## Run Directory Structure (for reference)

```
.chapterflow/runs/difficult-conversations/20260406-01/
├── briefs/
├── outlines/
├── quiz-blueprints/
├── sidecars/source/
├── drafts/
│   ├── canonical/
│   └── edited/
├── reports/          ← critic reports and validation reports both here
├── quizzes/
├── structured/
└── validated/        ← ch01–ch09 complete; add ch10–ch12 here
```

---

## Critical Reminders

1. **scenarioTonePolicy: required** — plain strings in scenario/whatToDo/whyItMatters are an auto-fail, no exceptions
2. **correctIndex discipline** — write options, find the correct one, then set the index; never reverse this
3. **Name ledger** — read Ch01–Ch07 validation reports before assigning any names to Ch10+ characters
4. **Bloom ceiling** — check each chapter's brief for moral complexity flag before writing any evaluate question
5. **No pipeline language in prose** — edited drafts and chapterBreakdown fields must read as published text
6. **Thin-chapter risk** — if a chapter introduces only 1–2 moves, enforce a strict concept budget; do not pad with adjacent concepts or material from neighboring chapters
7. **Wave gate before proceeding** — present the approval gate table for both chapters and wait for user approval before starting the next wave
