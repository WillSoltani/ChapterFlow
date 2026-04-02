# Fix "How to Win Friends and Influence People" — Full v3 Compliance

## BOOK: How to Win Friends and Influence People — Dale Carnegie
## FILE: `book-packages/friends-and-influence.modern.json` (37 chapters)

---

## WHAT THIS PROMPT DOES

This prompt brings the Friends & Influence book into full compliance with the ChapterFlow v3 content specification. It fixes every structural and content quality issue found in a comprehensive audit. The reference standard is `book-packages/the-48-laws-of-power.modern.json` — match its schema exactly.

**Run this in plan mode.** Create an execution plan, then execute all phases without stopping.

**Do not stop until all phases are complete and `npm run build` passes.**

---

## THE ISSUES (34 total, organized by fix phase)

### Phase A: Structural Schema Fixes (CRITICAL — must go first)

These are schema incompatibilities. The book was generated with an older prompt. The app expects the 48 Laws schema.

| # | Issue | Current State | Required State | Scope |
|---|-------|--------------|----------------|-------|
| 1 | Quiz choices | 4 choices (A/B/C/D) per question | EXACTLY 3 choices (A/B/C) | 370 questions |
| 2 | Quiz explanations | Plain strings | `{gentle, direct, competitive}` tone objects | 370 questions |
| 3 | Example scenario fields | Plain strings | `{gentle, direct, competitive}` tone objects | 222 examples |
| 4 | Example whyItMatters fields | Plain strings | `{gentle, direct, competitive}` tone objects | 222 examples |
| 5 | Example whatToDo fields | Arrays of strings | `{gentle, direct, competitive}` tone objects (single string per tone) | 222 examples |
| 6 | Missing `format` field on examples | Not present | One of: `decision_point`, `postmortem`, `dialogue`, `predict_reveal`, `dilemma`, `before_after` | 222 examples |
| 7 | Missing `endingType` field on examples | Not present | One of: `broader_principle`, `self_directed_question`, `surprising_implication`, `cross_domain`, `common_trap`, `perspective_reframe` | 222 examples |
| 8 | Missing `category` field on examples | Not present (uses `contexts` array) | `"work"`, `"school"`, or `"personal"` (derived from first item in `contexts`) | 222 examples |

### Phase B: Scripted Content Fixes (mechanical string replacement)

| # | Issue | Count | Fix |
|---|-------|-------|-----|
| 9 | "It is/This is/That is [short declarative]." endings | 175 | Replace each with a concrete ending |
| 10 | Closing sentences with "pattern" | 132 | Replace with specific language |
| 11 | Closing sentences with "mechanism" | 101 | Replace with specific language |
| 12 | Closing sentences with "structural" | 35 | Replace with specific language |
| 13 | "leverage" (61 total, Ch34=8) | 61 | Keep max 1/chapter, replace rest with synonyms |
| 14 | "ask yourself" (25 total, 4 chapters with 2+) | 25 | Keep max 1/chapter |
| 15 | AI-tell phrases (landscape 6, facilitate 3, navigating 2, crucial 1) | 12 | Replace all |
| 16 | Practice takeaways (Start, Stop, Do, Read, Check, Ask, Tell) | 9 | Rewrite as insights |
| 17 | Marcus as secondary in 3+ chapters | 3 chapters | Replace in 1 chapter |
| 18 | "study group" in 18 chapters | 18 chapters | Replace with diverse settings (max 3 total) |
| 19 | Easy breakdown word counts outside 140-175 range | 20 chapters | Rewrite to fit range |

### Phase C: Content Regeneration (require LLM rewriting)

| # | Issue | Count | Fix |
|---|-------|-------|-----|
| 20 | "Before and After" titles | 30 | Keep 3, rewrite 27 with diverse patterns |
| 21 | "Predicts" titles | 31 | Keep 3, rewrite 28 |
| 22 | "Dilemma" titles | 36 | Keep 3, rewrite 33 |
| 23 | Quiz questions need 4th choice removed | 370 | Remove weakest wrong answer |
| 24 | Quiz explanations need tone expansion | 370 | Expand each string into 3 tone variants |
| 25 | Example scenarios need tone expansion | 222 | Expand each string into 3 tone variants |
| 26 | Example whyItMatters need tone expansion | 222 | Expand each string into 3 tone variants |
| 27 | Example whatToDo need tone conversion | 222 | Merge array into single string per tone |

---

## EXECUTION ORDER

```
Phase A: Structural schema fixes (FIRST — changes shape of data)
  Step 1: Add category/format/endingType to all examples
  Step 2: Convert scenario/whatToDo/whyItMatters to tone objects
  Step 3: Convert quiz explanations to tone objects
  Step 4: Remove 4th quiz choice from all questions

Phase B: Scripted content fixes
  Step 5: Fix "leverage" (61 → max 1/chapter)
  Step 6: Fix "ask yourself" (25 → max 1/chapter)
  Step 7: Fix AI-tell phrases (12 → 0)
  Step 8: Fix Marcus secondary name (3 → 2 chapters)
  Step 9: Fix "study group" (18 → max 3 chapters)
  Step 10: Fix practice takeaways (9 → 0)

Phase C: Agent-assisted content rewrites
  Step 11: Fix declarative endings (175 → 0)
  Step 12: Fix "pattern/mechanism/structural" in closings (268 → max 3 each)
  Step 13: Fix title patterns (97 formulaic → varied)
  Step 14: Fix easy breakdown word counts (20 chapters)

Phase D: Validation
  Step 15: Full audit — 0 violations
  Step 16: npm run build
```

---

## PHASE A: STRUCTURAL SCHEMA FIXES

### Step 1: Add category, format, endingType to all examples

Every example currently has `contexts: ["work"]` (or "school"/"personal") but no `category`, `format`, or `endingType` field.

**For category:** Derive from the first element of `contexts`. If contexts is `["work"]`, category is `"work"`.

**For format:** Assign based on the example's position and content. Each chapter must use all 6 formats exactly once. Use this assignment logic:
- Read the example's scenario text. If it contains 3+ quoted speech exchanges → `dialogue`
- If the title contains "Before and After" or describes a transformation → `before_after`
- If the title contains "Predicts" or "Guesses" → `predict_reveal`
- If the title contains "Dilemma" or "Between" or "Choice" → `dilemma`
- If the scenario describes analyzing what went wrong after the fact → `postmortem`
- Default → `decision_point`
- After assigning, verify each chapter uses all 6 exactly once. If duplicates exist, reassign the least clear one.

**For endingType:** Read the whyItMatters text and classify:
- Ends with a question → `self_directed_question`
- Mentions a different domain/context → `cross_domain`
- Warns about a common mistake → `common_trap`
- States a broad principle → `broader_principle`
- Presents something surprising → `surprising_implication`
- Reframes the situation → `perspective_reframe`
- Assign each of the 6 types exactly once per chapter.

### Step 2: Convert example text fields to tone objects

For each of the 222 examples, convert:

**scenario** (currently a plain string) → `{gentle, direct, competitive}`:
- `direct`: Use the current string as-is (it's the strongest version)
- `gentle`: Rewrite with warmer, more reflective framing. Softer verb choices, more empathetic observation. Same scene, same details, different emotional register.
- `competitive`: Rewrite with sharper, more strategic framing. Edge-seeking, advantage-focused language. Same scene, same details, more tension.

**whyItMatters** (currently a plain string) → `{gentle, direct, competitive}`:
- Same approach: direct = current text, gentle = reflective rewrite, competitive = strategic rewrite.

**whatToDo** (currently an array of strings) → `{gentle, direct, competitive}`:
- `direct`: Join the array elements into a single coherent paragraph.
- `gentle`: Rewrite as a warmer, more reflective version of the same advice.
- `competitive`: Rewrite as a sharper, edge-focused version.

**Critical tone rules:**
- Tones must differ in SUBSTANCE, not just adjectives
- Gentle: Warm, reflective, sit-with-it framing
- Direct: Sharp, clinical, efficient. Facts and mechanisms.
- Competitive: Edge, advantage-seeking. Strategic framing.
- If three tones are the same sentence with different adjectives, REWRITE.

### Step 3: Convert quiz explanations to tone objects

For each of the 370 quiz questions, convert `explanation` from a plain string to:
```json
{
  "gentle": "<warm explanation of why correct + why wrong answer tempts>",
  "direct": "<current explanation text, edited if needed>",
  "competitive": "<edge insight, 'the trap is...' framing>"
}
```

**Rules for quiz explanation openers:**
- EVERY explanation across 10 questions must start with a DIFFERENT first clause per tone
- BANNED: "The strongest answer protects position..." or any opener starting with "The strongest answer" / "The best answer" / "The correct response"
- After writing all 10, read first 10 words of each. If any two share 4+ consecutive words, REWRITE one.

### Step 4: Remove 4th quiz choice

For each of the 370 questions:
1. Read all 4 choices and the explanation
2. Identify which wrong answer is most easily distinguished from the correct answer (the "weakest distractor")
3. Remove it
4. Reindex: remaining choices become A), B), C)
5. Update `correctIndex` to match the correct answer's new position (0, 1, or 2)
6. Verify `correctIndex` points to the genuinely correct answer
7. Across each chapter's 10 questions, ensure correctIndex is roughly balanced (3-4 each of 0, 1, 2)

---

## PHASE B: SCRIPTED CONTENT FIXES

### Step 5: Fix "leverage" (61 → max 1/chapter)

For each chapter, keep the first occurrence of "leverage" (noun form). Replace all subsequent with context-appropriate synonyms: advantage, influence, position, power, bargaining power, upper hand, edge, hold, sway, pull.

### Step 6: Fix "ask yourself" (25 → max 1/chapter)

Keep first per chapter. Replace extras with: "consider this:", "the question becomes:", "what shifts is:", "try this lens:", "the test is:", "the real question is:"

### Step 7: Fix AI-tell phrases (12 → 0)

Replace every instance:
- "landscape" (6) → "environment" / "context" / "terrain" / "world" / "field"
- "facilitate" (3) → "help" / "support" / "enable"
- "navigating" (2) → "handling" / "working through"
- "crucial" (1) → "important" / "critical" / "essential"

### Step 8: Fix Marcus (3 → 2 chapters)

Marcus appears as secondary in Ch4, Ch10, Ch20 (and as primary in Ch31). Keep in Ch4 and Ch10 (first 2 secondary appearances). Replace in Ch20 with an unused name from the pool.

### Step 9: Fix "study group" (18 → max 3)

For chapters containing "study group", replace with diverse school settings. Use this rotation (no setting used more than twice):
- thesis advisor meeting, student government session, debate team practice, campus newspaper editorial, peer tutoring session, dorm floor meeting, scholarship interview, mock trial preparation, lab partner discussion, art critique session, athletic team meeting, teaching assistant office hours, internship orientation, club fundraiser planning, campus tour guide training, research assistant meeting

Replace "study group" in ALL text fields of the affected chapter (scenario, whatToDo, whyItMatters, quiz prompts, review cards, chapterBreakdown, moreDetails).

### Step 10: Fix practice takeaways (9 → 0)

Rewrite these 9 medium keyTakeaway.point fields from imperative (practice) to declarative (insight):

- Ch1: "Start..." → rewrite as insight about the underlying principle
- Ch3: "Stop..." / "Do..." / "Read..." → rewrite each as insight
- Ch4: "Stop..." → rewrite as insight
- Ch8: "Check..." → rewrite as insight
- Ch15: "Ask..." → rewrite as insight
- Ch25: "Tell..." → rewrite as insight

Pattern: "**[Bold insight headline.]** [2-3 sentences explaining the principle, not telling the reader what to do.]"

---

## PHASE C: AGENT-ASSISTED CONTENT REWRITES

For each step below, process chapters in batches. For each batch, spawn an agent that reads the current content, applies the fix, and writes back.

### Step 11: Fix declarative endings (175 → 0)

Find every field where the last sentence starts with "It is/This is/That is" and is under 15 words. Replace each with a CONCRETE ending: a person, an action, a feeling, a specific consequence.

BANNED: "It is the difference between..." / "This is what separates..." / "That is the key."
CORRECT: "The raise she got had nothing to do with the spreadsheet." / "Nobody in the room realized the decision had already been made."

Process in batches of 6-8 chapters. For each batch, extract all flagged endings, generate replacements, and patch them back.

### Step 12: Fix "pattern/mechanism/structural" in closings (268 → max 3 each across book)

Find every field where the LAST SENTENCE contains "pattern", "mechanism", or "structural". Replace the word with a more specific, concrete term or rewrite the sentence entirely.

- "pattern" (132 closings) → Replace with the specific thing being described. "The communication pattern" → "The way she opened every meeting"
- "mechanism" (101 closings) → "process" / "response" / "reaction" / specific description
- "structural" (35 closings) → "built-in" / "fundamental" / specific description

After fixing, verify max 3 closing sentences per word across the entire book.

### Step 13: Fix title patterns

Titles to rewrite:
- 27 "Before and After" titles (keep 3)
- 28 "Predicts" titles (keep 3)
- 33 "Dilemma" titles (keep 3)

For each title being rewritten, keep the character name and create a curiosity-evoking title using a DIFFERENT structure. Vary across: "The Day [Name]...", "What [Name] Stopped Doing...", "How [Name]'s Silence...", "[Name] at the...", "A Quiet Win That...", question titles, moment titles, outcome titles.

No pattern may appear more than 3 times across the entire book.

### Step 14: Fix easy breakdown word counts (20 chapters)

For each easy chapterBreakdown where word count is outside 140-175:
- **Under 140 (13 chapters):** Add 1-2 concrete sentences. Keep the hook + core idea + why it matters + analogy structure. Add a specific example or vivid detail.
- **Over 175 (7 chapters):** Cut the least essential sentence. Tighten prose. Remove redundancy.

Count words in ALL 3 tone variants (gentle, direct, competitive) for each chapter. All must be 140-175.

---

## PHASE D: VALIDATION

### Step 15: Full audit

After all fixes, verify EVERY check passes:

1. ☐ Every example has: exampleId, title, category, format, endingType, contexts, scenario, whatToDo, whyItMatters
2. ☐ scenario/whatToDo/whyItMatters are ALL `{gentle, direct, competitive}` tone objects
3. ☐ Every quiz question has EXACTLY 3 choices (A, B, C)
4. ☐ Every quiz explanation is a `{gentle, direct, competitive}` tone object
5. ☐ correctIndex is 0, 1, or 2 for every question and points to the correct answer
6. ☐ Zero "It is/This is/That is [short declarative]." endings
7. ☐ "pattern" in max 3 closing sentences across book
8. ☐ "mechanism" in max 3 closing sentences across book
9. ☐ "structural" in max 3 closing sentences across book
10. ☐ "leverage" max 1 per chapter
11. ☐ "ask yourself" max 1 per chapter
12. ☐ Zero AI-tell phrases (landscape, facilitate, navigating, crucial, delve, realm, etc.)
13. ☐ No character name in >2 chapters (including secondary)
14. ☐ "study group" in max 3 chapters
15. ☐ Zero practice takeaways (no imperative verbs in keyTakeaway.point)
16. ☐ Easy breakdown word counts: 140-175 per variant (all 37 × 3 = 111 variants)
17. ☐ Zero em/en dashes
18. ☐ Zero orphaned quote fragments
19. ☐ No "Before and After" title pattern >3 times
20. ☐ No "Predicts" title pattern >3 times
21. ☐ No "Dilemma" title pattern >3 times
22. ☐ Each chapter uses all 6 formats exactly once
23. ☐ Each chapter uses all 6 ending types exactly once
24. ☐ Valid JSON, no duplicate keys

### Step 16: Build

Run `npm run build`. Fix any errors. Verify the book loads.

---

## PROCESSING APPROACH

**For Phase A (structural):** Write a Node.js script that reads the JSON, transforms the schema, and writes back. The tone expansion (converting plain strings to 3-tone objects) requires spawning agents in batches of 6-8 chapters — each agent reads the current plain-string fields and generates the gentle/competitive variants (keeping direct as the original text).

**For Phase B (scripted):** Write a single Node.js script with subcommands (like `fix-leverage`, `fix-askself`, etc.) that does mechanical string replacements. Reference the existing pattern in `scripts/book/fix-48-laws-v3-compliance.mjs`.

**For Phase C (content rewrites):** Process in batches of 6-8 chapters. For each batch, extract the flagged items, spawn an agent to generate replacements, apply the patches, and verify.

**Key principle:** The direct tone content that already exists is generally high quality. When expanding to 3 tones, use the existing text as the `direct` variant and generate `gentle` and `competitive` variants that are substantively different (not just adjective swaps).

---

## REFERENCE FILES

| File | Purpose |
|------|---------|
| `book-packages/the-48-laws-of-power.modern.json` | Schema reference — match this exactly |
| `book-packages/friends-and-influence.modern.json` | The file to fix (37 chapters, ~3MB) |
| `scripts/book/fix-48-laws-v3-compliance.mjs` | Existing fix script pattern to reuse |
| `scripts/book/prompts/chapterflow-book-generation-v3.md` | Full v3 content spec with all 25 rules |

---

## NOW: Create your execution plan and begin. Do not wait for approval. Run all phases through completion.
