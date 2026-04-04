# ChapterFlow MasterValidator V2
 
## HOW TO USE THIS FILE
 
Paste this at the start of any conversation:
 
> Run MasterValidator on `book-packages/{bookId}.modern.json`
 
The validator will:
1. Read the book JSON
2. Run every check below (130+ checks across 14 categories)
3. Score each category out of its weight
4. Produce a total score out of 100
5. List every issue found with exact location and recommended fix
6. Produce a fix plan organized by phase
7. Upon user approval, execute the fix plan
8. Re-validate and confirm the final score
 
**Run this in plan mode.** Read the entire file, then execute the validation systematically.
 
---
 
## SCORING WEIGHTS
 
| Category | Weight | What it checks |
|----------|--------|---------------|
| A. Schema Structure | 12 | JSON validity, required fields, correct types, tone objects |
| B. Depth Structure | 8 | Takeaway counts, field presence per depth, selfCheckPrompts array vs singular |
| C. Word Counts | 6 | Easy 140-175, Medium 330-420, Hard 490-600 per variant |
| D. Example Schema | 10 | category/format/endingType fields, tone objects, format rotation, ending type rotation |
| E. Quiz Schema | 10 | 3 choices, tone object explanations, correctIndex distribution, Bloom's, depthLevel |
| F. Content Specificity | 8 | Breakdowns reference chapter-specific content, moreDetails is additive |
| G. Vocabulary & Phrases | 7 | Banned phrases, word caps, reflexive phrase caps, "leverage" count |
| H. Closing Patterns | 5 | "It is [declarative]" tic, vocabulary in closings, repeated closings |
| I. Scenario Quality | 7 | Thin scenarios, dialogue has quotes, title diversity, lesson diversity |
| J. Tone Quality | 8 | Tone differentiation is substantive, competitive voice tics, tone collapse detection |
| K. Cross-Chapter | 4 | Name reuse, cross-references, preview open loops, last chapter full circle |
| L. Wiring & Assembly | 3 | bookPackages.ts, mockChapters.ts, libraryData.ts, book-covers.ts entries |
| M. Learning Science | 8 | Bloom's progression, prediction prompts, activation quality, recap actionability |
| N. Readability & Flow | 4 | Dash removal, paragraph density, conceptual repetition, reading time alignment |
| **Total** | **100** | |
 
---
 
## EXECUTION INSTRUCTIONS
 
For each category below, run EVERY check. Track results as:
- **PASS**: Check passes completely
- **WARN**: Minor issue, deduct partial points
- **FAIL**: Issue found, deduct full points for that check
 
After all checks, compute the score and produce the report.
 
---
 
## CATEGORY A: SCHEMA STRUCTURE (12 points)
 
Read the book JSON file. Run these checks:
 
**A1. Valid JSON (2 pts)**
- File parses as valid JSON without errors
- No duplicate keys at any level
 
**A2. Top-level fields (2 pts)**
- `schemaVersion` exists (should be "3.0" or "1.1.0")
- `packageId` exists and is a non-empty string
- `createdAt` exists and is a valid ISO date
- `contentOwner` exists
- `book` object exists with: bookId, title, author, categories (array), variantFamily ("EMH")
- `chapters` is a non-empty array sorted by number
 
**A3. Chapter-level required fields (2 pts)**
For EVERY chapter, verify:
- `chapterId` (non-empty string)
- `number` (integer)
- `title` (non-empty string)
- `readingTimeMinutes` (positive number)
- `contentVariants` object with `easy`, `medium`, `hard` keys
- `examples` (array)
- `quiz` (object with `questions` array, NOT null)
- `implementationPlan` (object)
- `reviewCards` (array)
- `keyTakeawayCard` (tone object: {gentle, direct, competitive})
 
If quiz is null, FAIL with CRITICAL severity. Every chapter must have a quiz.
 
**A4. Tone object integrity (3 pts)**
Walk ALL string-valued fields. For every field that should be a tone object, verify it has ALL THREE keys: `gentle`, `direct`, `competitive`, each being a non-empty string.
 
Fields that MUST be tone objects:
- `chapterBreakdown` (all depths)
- `keyTakeaways[].point` (all depths)
- `keyTakeaways[].moreDetails` (medium, hard)
- `activationPrompt` (medium, hard)
- `selfCheckPrompt` (medium, singular object)
- `selfCheckPrompts[]` (hard, array of 2 objects)
- `predictionPrompt` (hard)
- `oneMinuteRecap` (easy: flat tone object. medium/hard: {retrieve, connect, preview} each tone object)
- `examples[].scenario` (tone object)
- `examples[].whatToDo` (tone object)
- `examples[].whyItMatters` (tone object)
- `quiz.questions[].explanation` (tone object)
- `implementationPlan.coreSkill` (tone object)
- `implementationPlan.ifThenPlans[].plan` or `.ifThen` (tone object)
- `implementationPlan.twentyFourHourChallenge` (tone object)
- `implementationPlan.weeklyPractice` (tone object)
- `reviewCards[].front` (tone object)
- `reviewCards[].back` (tone object)
- `keyTakeawayCard` (tone object)
 
**Tone collapse detection**: For every tone object, compare gentle vs direct vs competitive. If ANY TWO of the three are identical strings (exact match), FAIL with CRITICAL. This catches the Carnegie-style bug where all three tones have the same text.
 
If ANY of these is a plain string instead of a tone object, FAIL.
 
**A5. No orphaned fragments (2 pts)**
Walk all string fields:
- None may end with `'.` or `".` (orphaned quote + period)
- No double periods `..` anywhere
- No sentence that ends mid-word (detect via: ends with lowercase letter followed by `?` or `.` where the preceding word is < 3 characters and is not a recognized abbreviation)
- No truncated text (detect via: last sentence has fewer than 4 words and does not end with a question mark)
 
**A6. No em/en dashes (1 pt)**
Zero em dashes (U+2014) or en dashes (U+2013) in the entire file.
Also check for double-hyphens `--` which should be commas or semicolons.
 
---
 
## CATEGORY B: DEPTH STRUCTURE (8 points)
 
**B1. Easy depth (2 pts)**
For EVERY chapter:
- `keyTakeaways`: EXACTLY 3
- Each takeaway has ONLY `point` (tone object). NO `moreDetails` field.
- NO `activationPrompt` field
- NO `selfCheckPrompt` field
- NO `selfCheckPrompts` field
- `oneMinuteRecap`: flat tone object {gentle, direct, competitive} (NOT structured with retrieve/connect/preview)
- `chapterBreakdown`: tone object
 
**B2. Medium depth (2 pts)**
For EVERY chapter:
- `keyTakeaways`: 5-6 items (WARN at 7, FAIL at 8+)
- Each has `point` (tone object) AND `moreDetails` (tone object)
- `activationPrompt`: present, tone object
- `selfCheckPrompt`: present, SINGULAR tone object (NOT an array)
- `oneMinuteRecap`: structured {retrieve: tone, connect: tone, preview: tone}
- `chapterBreakdown`: tone object
 
**B3. Hard depth (2 pts)**
For EVERY chapter:
- `keyTakeaways`: 5-7 items (WARN at 8, FAIL at 9+)
- Each has `point` (tone object) AND `moreDetails` (tone object)
- `activationPrompt`: present, tone object
- `selfCheckPrompts`: present, ARRAY of EXACTLY 2 tone objects (NOT singular)
- `predictionPrompt`: present, tone object
- `oneMinuteRecap`: structured {retrieve: tone, connect: tone, preview: tone}
- `chapterBreakdown`: tone object
 
**B4. No field leakage (2 pts)**
- Easy MUST NOT have: moreDetails, activationPrompt, selfCheckPrompt, selfCheckPrompts, predictionPrompt
- Medium MUST NOT have: selfCheckPrompts (array), predictionPrompt
- Hard MUST NOT have: selfCheckPrompt (singular)
 
---
 
## CATEGORY C: WORD COUNTS (6 points)
 
**C1. Easy breakdown word counts (2 pts)**
For EVERY chapter, count words in `easy.chapterBreakdown.gentle`, `.direct`, `.competitive`.
Each MUST be 140-175 words.
Report any outside range with exact count.
 
**C2. Medium breakdown word counts (2 pts)**
Same for `medium.chapterBreakdown`. Each variant: 330-420 words.
 
**C3. Hard breakdown word counts (2 pts)**
Same for `hard.chapterBreakdown`. Each variant: 490-600 words.
 
---
 
## CATEGORY D: EXAMPLE SCHEMA (10 points)
 
**D1. Example count (1 pt)**
Every chapter: exactly 6 examples.
 
**D2. Required fields on every example (1 pt)**
Every example MUST have: `exampleId`, `title`, `category`, `format`, `endingType`, `contexts`, `scenario`, `whatToDo`, `whyItMatters`.
Report any missing fields.
 
**D3. Tone objects on examples (1 pt)**
`scenario`, `whatToDo`, `whyItMatters` MUST each be `{gentle, direct, competitive}` tone objects, NOT plain strings, NOT arrays.
 
**D4. Format rotation (2 pts)**
Each chapter MUST use all 6 formats exactly once: `decision_point`, `postmortem`, `dialogue`, `predict_reveal`, `dilemma`, `before_after`.
Report any chapter with missing or duplicate formats.
 
**D5. Ending type rotation (2 pts)**
Each chapter MUST use all 6 ending types exactly once: `broader_principle`, `self_directed_question`, `surprising_implication`, `cross_domain`, `common_trap`, `perspective_reframe`.
Report any chapter with missing or duplicate ending types.
 
**D6. Category distribution (1 pt)**
Each chapter should have 2 work, 2 school, 2 personal.
 
**D7. Dialogue content check (2 pts)**
For every example with `format: "dialogue"`: the `scenario` field (all 3 tones) MUST contain at least 3 quoted speech exchanges between named characters. Count quote pairs. Report any with fewer than 3.
 
---
 
## CATEGORY E: QUIZ SCHEMA (10 points)
 
**E1. Quiz presence (1 pt)**
Every chapter has a `quiz` object with a `questions` array of exactly 10 items.
If quiz is null, CRITICAL FAIL.
 
**E2. Choice count (1 pt)**
Every question has EXACTLY 3 choices. NOT 4, NOT 2. Report any violations.
 
**E3. Explanation type (1 pt)**
Every `explanation` field is a `{gentle, direct, competitive}` tone object, NOT a plain string.
 
**E4. correctIndex validity (1 pt)**
Every `correctIndex` is 0, 1, or 2.
Spot-check 5 random questions: does the choice at `correctIndex` actually sound like the best answer?
 
**E5. correctIndex distribution (1 pt)**
Across each chapter's 10 questions, correctIndex should be roughly balanced: 3-4 each of 0, 1, 2.
Report any chapter where one index appears 6+ times.
 
**E6. Explanation opener diversity (1 pt)**
For each chapter, extract the first 10 words of each `explanation.direct`.
- Any starting with "The strongest answer" or "The best answer" or "The correct response"? FAIL.
- Any two sharing 5+ consecutive opening words? FAIL.
 
**E7. bloomsLevel field (2 pts)**
Every question MUST have a `bloomsLevel` field with value from: "remember", "understand", "apply", "analyze", "evaluate", "create".
Distribution across 10 questions:
- At least 2 must be "remember" or "understand"
- At least 3 must be "apply" or "analyze"
- At least 1 must be "evaluate" or "create"
Report missing fields and imbalanced distributions.
 
**E8. depthLevel field (1 pt)**
Every question MUST have a `depthLevel` field with value: "simple", "standard", or "deeper".
Target distribution: 5 simple, 3 standard, 2 deeper (plus or minus 1).
Report missing fields and distributions outside 3-6 simple, 2-4 standard, 1-3 deeper.
 
**E9. Quiz prompt quality (1 pt)**
Scan all quiz prompts for banned patterns:
- Chapter title in quotes
- "realistic situation for"
- "best applies"
- "best puts...into practice"
- "best reflects"
- "real-world decision tied to"
Report any violations.
 
---
 
## CATEGORY F: CONTENT SPECIFICITY (8 points)
 
**F1. Breakdown specificity (2 pts)**
For chapters 1, N/3, 2N/3, and N (4 samples):
Read `easy.chapterBreakdown.gentle`. Does it mention THIS chapter's specific topic, stories, or framework? Or is it generic text that could belong to any chapter?
FAIL if any reads as generic.
 
**F2. moreDetails specificity (2 pts)**
Sample 3 random `medium.keyTakeaways[].moreDetails.direct` from different chapters.
Does each explain something specific to its chapter's core concept? Or generic psychology filler?
FAIL if any are generic or identical across chapters.
 
**F3. moreDetails is conceptual, not vignette (1 pt)**
Walk ALL moreDetails fields across ALL chapters. Check for fictional vignette patterns:
- Named character + action verb (e.g., "Sarah noticed", "Marcus decided")
- Regex: `/\b([A-Z][a-z]{2,})\s+(?:said|walked|noticed|sat|stood|looked|opened|picked|turned|glanced|leaned|paused|asked|replied|decided|grabbed|pulled|pushed|stared|sighed|nodded|shook|smiled|frowned|whispered|shouted)\b/`
- Exclude stopwords: The, This, That, They, What, When, Where, Which, While, Why, How, Every, Getting, Being, Having, Making, Taking, Doing, Going, Coming, Most, Some, Many, Each, Any, All, One, Two, Three, People, Someone
Report any fictional vignettes found.
 
**F4. Takeaway = insight, not practice (1 pt)**
Walk all `medium.keyTakeaways[].point.direct` across all chapters.
Flag any starting with imperative verbs: Try, Practice, Run, Test, Count, Ask, Write, Start, Begin, Make, Do, Notice, Track, Record, Monitor, Check, Review, Schedule, Plan, Set, Create, Build.
Also flag any starting with "Practice:" prefix.
 
**F5. moreDetails is additive, not restating (2 pts)**
For each chapter, sample 3 takeaways. Compare the first sentence of `point.direct` with the first sentence of `moreDetails.direct`.
If moreDetails opens by restating the point's core claim with over 50% word overlap in the first 15 words, WARN.
The expansion should introduce new information, a new mechanism, a new angle, or a new example, not restate.
Report any restating expansions with the overlapping text.
 
---
 
## CATEGORY G: VOCABULARY & PHRASES (7 points)
 
**G1. AI-tell phrases (2 pts)**
Search entire file for each banned phrase (case-insensitive):
"delve", "crucial", "landscape", "realm", "It's worth noting", "In today's world", "It's important to remember", "This highlights the importance of", "Furthermore", "Moreover", "In conclusion", "plays a pivotal role", "at its core", "the art of", "navigating", "harnessing", "game-changer", "paradigm shift", "robust", "synergy", "facilitate", "utilize", "foster", "embark on", "a testament to", "shed light on", "This matters because", "This is significant because", "it is essential to"
 
Report each with count and chapter locations. Any occurrence = deduction.
 
**G2. "leverage" frequency (1 pt)**
Count "leverage" (case-insensitive) per chapter.
- Max 1 per chapter as noun
- 0 as verb (meaning "to use/exploit")
 
**G3. "ask yourself" frequency (1 pt)**
Count per chapter. Max 1 per chapter. Report chapters with 2+.
 
**G4. Reflexive phrase caps (1 pt)**
Count per chapter: "notice when", "pay attention to", "think about", "consider whether". Max 1 each per chapter.
 
**G5. Gentle opener diversity (1 pt)**
Extract first 6 words of every `gentle` field across all chapters.
- "Here's something worth sitting with" or "Here is something worth sitting with": max 0 (fully banned)
- Any other gentle opener phrase appearing in more than 2 chapters: WARN
 
**G6. "study group" count (0.5 pt)**
Count chapters containing "study group" (case-insensitive) anywhere. Max 3 across entire book.
 
**G7. Competitive voice tic (0.5 pt)**
Count "The person who" and "The player who" per chapter in competitive-tone fields only.
Max 4 per chapter. Report chapters exceeding cap.
Also count across entire book: max N x 2 (where N = chapter count).
 
---
 
## CATEGORY H: CLOSING PATTERNS (5 points)
 
**H1. "It is [declarative]" endings (2 pts)**
For every string field, extract the last sentence. Flag any where:
- Last sentence starts with "It is", "This is", "That is" AND is under 15 words
Report total count. Target: 0.
 
**H2. Vocabulary in closing sentences (1.5 pts)**
Count closing sentences (last sentence of any field) containing:
- "structural": max 3 across entire book
- "mechanism": max 3 across entire book
- "pattern": max 3 across entire book
Also: "structural", "mechanism", "pattern", "dynamic", "framework", "system" are BANNED from the last sentence of any chapterBreakdown, whyItMatters, moreDetails, whatToDo, or oneMinuteRecap field.
 
**H3. Repeated closings within chapter (1 pt)**
For each chapter, collect all whyItMatters endings (6), all whatToDo endings (6), all moreDetails endings.
No two closings in the same section should share the same first 3 words.
 
**H4. Ending type variety within chapter (0.5 pt)**
Cross-check with D5 for consistency.
 
---
 
## CATEGORY I: SCENARIO QUALITY (7 points)
 
**I1. Scenario vividness (1.5 pts)**
Sample 4 random scenarios from different chapters (direct tone).
Each should have 3+ concrete details (names, times, objects, locations) plus 1 sensory or emotional detail.
Flag any thin scenarios.
 
**I2. Scenario word count (1 pt)**
Sample 10 random scenarios. Each should be 80-200 words. Report any outside range.
 
**I3. Title diversity (1 pt)**
Extract ALL example titles across all chapters.
- Any possessive "[Name]'s [X]" pattern: should not exceed 40% of total titles
- Any single title structure pattern: should not exceed 30% of total titles
Report any pattern exceeding its cap.
 
**I4. At least 1 messy outcome per chapter (0.5 pt)**
For each chapter, check if at least 1 example has a non-perfect outcome.
Look for keywords: "still", "didn't", "did not", "awkward", "messy", "partial", "lingered", "unresolved", "imperfect", "not perfect", "cost", "lost".
 
**I5. Hook quality (1 pt)**
Check first sentence of every `chapterBreakdown` across all depths and tones.
BANNED starts: "This chapter", "The author argues", "In this chapter", "Chapter N".
Report any violations.
 
**I6. Scenario lesson diversity (2 pts)**
For each chapter, extract the first sentence of each `whatToDo.direct` (6 sentences from 6 examples).
- If 3+ of 6 share the same core recommendation verb or primary action instruction, WARN.
- If 4+ of 6 converge on the same lesson, FAIL.
Check for convergent verbs: pause, ask, wait, stop, listen, slow down, reframe, redirect, question.
Report chapters where scenario advice converges on the same action.
 
---
 
## CATEGORY J: TONE QUALITY (8 points)
 
**J1. Tone differentiation spot check (3 pts)**
Pick 3 random takeaways from 3 different chapters. For each, read `moreDetails.gentle`, `moreDetails.direct`, `moreDetails.competitive`.
- Are they genuinely different in substance (different vocabulary, different framing, different emotional register)?
- Or are they the same text with adjective swaps?
FAIL if any are adjective-swap copies.
 
**J2. Tone consistency (2 pts)**
Verify that across the book:
- Gentle tone uses warm, reflective, sit-with-it framing
- Direct tone is clinical, mechanism-focused, efficient
- Competitive tone is edge-seeking, strategic, advantage-focused
Sample 3 chapters and verify the tones feel distinct.
 
**J3. Tone collapse detection (3 pts)**
Walk EVERY tone object in the file. For each {gentle, direct, competitive} object:
- Compare gentle vs direct: if identical, CRITICAL FAIL.
- Compare gentle vs competitive: if identical, CRITICAL FAIL.
- Compare direct vs competitive: if identical, CRITICAL FAIL.
- If all three are identical: CRITICAL FAIL (triple collapse).
Report every collapsed tone object with exact JSON path.
 
This is the most important tone check. The Carnegie chapter had multiple collapsed tone objects (activation prompts, self-checks, prediction prompts all had 3 identical tones). This MUST be caught.
 
---
 
## CATEGORY K: CROSS-CHAPTER (4 points)
 
**K1. Character name reuse (1.5 pts)**
Extract all character names from ALL examples across all chapters (from titles and scenario text).
Report any name appearing in more than 2 chapters. Target: 0 names in more than 2 chapters.
Within a book, characters appearing in 2 chapters is acceptable and encouraged for narrative continuity.
 
**K2. Cross-chapter references (1 pt)**
For Ch2+: does `medium.chapterBreakdown` or `hard.chapterBreakdown` reference the previous chapter?
For the last chapter: does the preview reference Chapter 1 (full circle)?
Sample 3 chapters to verify.
 
**K3. Format-category rotation across book (0.5 pt)**
Check: does the `dialogue` format appear in all 3 categories (work, school, personal) across the book?
If any format is locked to a single category for ALL chapters: FAIL.
 
**K4. School setting variety (1 pt)**
Count unique school settings used across all school-category scenarios. Should be 5+ distinct settings.
"study group" in max 3 chapters (cross-verify with G6).
 
---
 
## CATEGORY L: WIRING & ASSEMBLY (3 points)
 
**L1. bookPackages.ts wiring (1 pt)**
Check `app/book/data/bookPackages.ts`:
- Import statement for this book's JSON exists
- Normalized package export exists
- Raw chapters export exists
- Tone-aware getter function exists
- Added to BOOK_PACKAGES array
- Added to BOOK_PACKAGE_PRESENTATION with icon, coverImage, difficulty, synopsis
 
**L2. mockChapters.ts wiring (1 pt)**
Check `app/book/data/mockChapters.ts`:
- bookId is in TONE_AWARE_BOOK_IDS set
- Entry exists in TONE_BUNDLE_GETTERS map with getPackage and getRaw
 
**L3. libraryData.ts + book-covers.ts (1 pt)**
Check `components/library/libraryData.ts`:
- Entry exists in MOCK_BOOKS array with all required fields
Check `lib/book-covers.ts`:
- Entry exists in REAL_BOOK_COVER_PATHS
Check `public/book-covers/`:
- Cover image file exists
 
---
 
## CATEGORY M: LEARNING SCIENCE ALIGNMENT (8 points)
 
**M1. Bloom's taxonomy progression in quizzes (2 pts)**
For each chapter's quiz, verify the 10 questions progress in cognitive demand:
- Questions 1-3 should be predominantly "remember" or "understand" level
- Questions 4-7 should be predominantly "apply" or "analyze" level
- Questions 8-10 should include at least 1 "evaluate" or "create" level
If the highest Bloom's level in any chapter is "apply" (no evaluate or create), FAIL.
Report chapters without cognitive progression.
 
**M2. Prediction prompts ask for predictions (1.5 pts)**
For every `hard.predictionPrompt`, verify:
- Contains a question mark OR contains an imperative asking the reader to predict/guess/anticipate/forecast
- Does NOT read as a passive preview or teaser (detect: if it contains no question mark AND no imperative verb, it is a teaser, not a prediction)
- References something specific from the current chapter that the reader should use as a framework for their prediction
Report any prompts that are teasers rather than prediction tasks.
 
**M3. Activation prompts are functional (1.5 pts)**
For every `medium.activationPrompt` and `hard.activationPrompt`, verify:
- The prompt is a complete sentence (does not end mid-word or mid-phrase)
- Contains either a question mark OR an imperative verb (think, identify, recall, write, list, name, consider, pick, choose, imagine, remember, notice, ask, map, divide, take)
- Is NOT a declarative statement that merely describes what the chapter covers
Report any broken, truncated, or passive prompts.
 
**M4. Self-check prompts are differentiated and functional (1 pt)**
For every `medium.selfCheckPrompt` and `hard.selfCheckPrompts[]`:
- Each contains a question mark (it should be asking the reader to reflect)
- All three tones are different (not collapsed, cross-reference J3)
- The hard selfCheckPrompts array has exactly 2 items, and they ask different questions (not the same question reworded)
Report any declarative self-checks, collapsed tones, or duplicate questions.
 
**M5. Recap sections demand generation, not passive summary (1 pt)**
For every medium and hard `oneMinuteRecap.retrieve`:
- The retrieve section should contain a question mark or imperative verb asking the reader to recall from memory
- It should NOT read as a pre-written summary of the chapter (detect: if it contains 3+ declarative sentences with no question marks or imperatives, it is a summary, not a retrieval challenge)
Report any passive summaries labeled as retrieve prompts.
 
**M6. Implementation plan specificity (1 pt)**
For every `implementationPlan.ifThenPlans[]`:
- The `plan` (or `ifThen`) field contains both an "If" trigger and a "then" action in every tone variant
- The trigger is specific (mentions a concrete situation, not a vague state)
- The action is specific (mentions a concrete behavior, not "be more mindful")
Report any vague or incomplete if-then plans.
 
---
 
## CATEGORY N: READABILITY & FLOW (4 points)
 
**N1. No em dashes, en dashes, or double hyphens (1 pt)**
Cross-verify with A6. Zero tolerance.
Additionally check for:
- Parenthetical insertions using commas that function as dashes and run longer than 10 words between the commas (these should be separate sentences)
 
**N2. Within-chapter conceptual repetition (1.5 pts)**
For each chapter, identify the core thesis from the first paragraph of `easy.chapterBreakdown.gentle`.
Then search ALL other sections in that chapter (all depths, all tones) for the same thesis stated in highly similar language.
- Count sections where the core thesis is restated nearly verbatim (over 60% content overlap in any sentence)
- 1-2 restatements: PASS (some reinforcement is natural)
- 3 restatements: WARN
- 4+ restatements: FAIL
Report the specific sections where repetition occurs.
 
**N3. Hard mode reading time estimate (1 pt)**
For each chapter, estimate the total word count of hard mode content if all "Go Deeper" expansions are opened:
- hard.chapterBreakdown (all 3 tones averaged)
- All hard.keyTakeaways point + moreDetails (all 3 tones averaged)
- Estimate reading time at 230 words per minute
- If estimated reading time exceeds 18 minutes for the Summary phase alone (before Examples), WARN
- If it exceeds 22 minutes, FAIL
Report estimated reading times per chapter.
 
**N4. Generation artifact detection (0.5 pt)**
Walk all string fields looking for:
- Duplicate consecutive sentences (same sentence appearing twice in a row)
- Duplicate sentence openings within the same paragraph (same 5+ words starting two consecutive sentences)
- Words that appear to be garbled substitutions: "processatically", "arrangement" used where "system" was intended, "organism" used where "system" was intended, "method" used where "system" was intended in a clearly wrong context
- Incomplete sentences that end with a preposition or article ("the", "a", "to", "for", "of") followed by a period or end of string
Report all artifacts with exact location.
 
---
 
## OUTPUT FORMAT
 
After running all checks, produce this report:
 
```
===========================================================
CHAPTERFLOW MASTERVALIDATOR V2 REPORT
Book: {title} by {author}
Chapters: {N}
Date: {today}
===========================================================
 
SCORE: {X}/100
 
CATEGORY BREAKDOWN:
  A. Schema Structure:       {X}/12
  B. Depth Structure:        {X}/8
  C. Word Counts:            {X}/6
  D. Example Schema:         {X}/10
  E. Quiz Schema:            {X}/10
  F. Content Specificity:    {X}/8
  G. Vocabulary & Phrases:   {X}/7
  H. Closing Patterns:       {X}/5
  I. Scenario Quality:       {X}/7
  J. Tone Quality:           {X}/8
  K. Cross-Chapter:          {X}/4
  L. Wiring & Assembly:      {X}/3
  M. Learning Science:       {X}/8
  N. Readability & Flow:     {X}/4
 
===========================================================
ISSUES FOUND: {total count}
===========================================================
 
CRITICAL ({count}):
  - [{category}] {description}
    Location: {exact JSON path or field}
    Fix: {specific recommendation}
 
HIGH ({count}):
  - [{category}] {description}
    Location: {exact JSON path or field}
    Fix: {specific recommendation}
 
MEDIUM ({count}):
  - [{category}] {description}
    Location: {exact JSON path or field}
    Fix: {specific recommendation}
 
LOW ({count}):
  - [{category}] {description}
    Location: {exact JSON path or field}
    Fix: {specific recommendation}
 
===========================================================
FIX PLAN
===========================================================
 
Phase 1: Scripted fixes (mechanical, no content generation needed)
  These can be executed with find-replace or JSON manipulation:
  1. {description} - {estimated effort}
  2. {description} - {estimated effort}
  ...
 
Phase 2: Content regeneration (requires new content written)
  These need new prose generated to match existing quality:
  1. {description} - {what needs to be written}
  2. {description} - {what needs to be written}
  ...
 
Phase 3: Structural changes (schema modifications)
  These change the shape of the data:
  1. {description} - {what fields change}
  2. {description} - {what fields change}
  ...
 
Phase 4: Consolidation (content restructuring)
  These merge or split existing content:
  1. {description} - {which takeaways/sections to merge}
  2. {description} - {which takeaways/sections to merge}
  ...
 
Phase 5: Re-validation
  Run MasterValidator V2 again to verify improvements.
  Target: 95+ for production readiness.
 
===========================================================
ESTIMATED EFFORT
===========================================================
Phase 1: {X} minutes (automated)
Phase 2: {X} minutes (LLM generation)
Phase 3: {X} minutes (restructuring)
Phase 4: {X} minutes (editorial)
Total: {X} minutes
 
Awaiting approval to proceed with fixes.
```
 
---
 
## SEVERITY CLASSIFICATION
 
| Severity | Criteria | Score impact |
|----------|----------|-------------|
| CRITICAL | Schema broken, quiz missing, tone collapsed, app will crash or display wrong content | Full category deduction |
| HIGH | Content quality violation that users will notice (repeated text, generic filler, wrong quiz answers, truncated prompts) | 50-100% of check deduction |
| MEDIUM | Rule violation that affects quality but not functionality (word cap exceeded, title pattern repeated, too many takeaways) | 25-50% of check deduction |
| LOW | Minor style issue (1-2 instances of a phrase, borderline word count) | 10-25% of check deduction |
 
---
 
## FIX EXECUTION PROTOCOL
 
Upon user approval of the fix plan:
 
1. **Execute Phase 1** (scripted fixes). Show each replacement. Confirm count matches plan.
 
2. **Execute Phase 2** (content regeneration). For each item:
   - State what is being regenerated and why
   - Generate the new content matching the tone, depth, and style of surrounding content
   - Show the new content for review
   - Apply the fix
 
3. **Execute Phase 3** (structural changes). For each item:
   - State the schema change
   - Apply it
   - Verify no downstream breaks
 
4. **Execute Phase 4** (consolidation). For each item:
   - Show what is being merged or restructured
   - Generate the consolidated version
   - Apply it
 
5. **Run Phase 5** (re-validation). Execute full MasterValidator V2 again on the modified file. Report the new score. If below 95, identify remaining issues and propose a targeted fix round.
 
---
 
## REFERENCE: QUALITY BENCHMARKS FROM CONTENT REVIEW
 
These benchmarks come from detailed analysis of 5 chapter content packages scored against learning science research:
 
| Book | Chapter | Content Score | Primary Strength | Primary Weakness |
|------|---------|--------------|------------------|------------------|
| 48 Laws of Power | Ch.1 | 93/100 | Multi-component framework, scenario variety | 7 hard takeaways |
| Never Split the Difference | Ch.1 | 89/100 (93 with quiz) | Intellectual honesty, boundary conditions, tone mastery | Missing quiz |
| Laws of Human Nature | Ch.1 | 88/100 | Neurological depth, strong implementation | 9 hard takeaways, generation artifacts |
| The Charisma Myth | Ch.1 | 84/100 | Clean copy, best activation prompt | Thin source, scenario convergence |
| How to Win Friends | Ch.1 | 78/100 | Scenario authenticity, implementation specificity | Broken prompts, missing quiz metadata |
 
**Consistent pipeline strengths**: High-quality prose across all tones, strong scenario writing with sensory detail, excellent "Go Deeper" content, actionable implementation plans.
 
**Consistent pipeline weaknesses**: Takeaway count inflation in hard mode, within-chapter repetition of core thesis, tone collapse in metadata fields (activation/self-check/prediction prompts), missing quiz metadata fields (bloomsLevel, depthLevel).
 
Any new book should target 90+ on first validation and 95+ after fixes.
 
---
 
## QUICK REFERENCE: FIELD PRESENCE BY DEPTH
 
| Field | Easy | Medium | Hard |
|-------|------|--------|------|
| chapterBreakdown | tone obj | tone obj | tone obj |
| keyTakeaways | 3 (point only) | 5-6 (point + moreDetails) | 5-7 (point + moreDetails) |
| moreDetails | MUST NOT EXIST | tone obj | tone obj |
| activationPrompt | MUST NOT EXIST | tone obj | tone obj |
| selfCheckPrompt | MUST NOT EXIST | singular tone obj | N/A |
| selfCheckPrompts | MUST NOT EXIST | MUST NOT EXIST | array of 2 tone objs |
| predictionPrompt | MUST NOT EXIST | MUST NOT EXIST | tone obj |
| oneMinuteRecap | flat tone obj | {retrieve, connect, preview} | {retrieve, connect, preview} |
 
---
 
## QUICK REFERENCE: BANNED PHRASES (complete list)
 
"delve", "crucial", "landscape", "realm", "It's worth noting", "In today's world", "It's important to remember", "This highlights the importance of", "Furthermore", "Moreover", "In conclusion", "plays a pivotal role", "at its core", "the art of", "navigating", "harnessing", "game-changer", "paradigm shift", "robust", "synergy", "leverage" (as verb), "facilitate", "utilize", "foster", "embark on", "a testament to", "shed light on", "This matters because", "This is significant because", "it is essential to", "Here's something worth sitting with", "Here is something worth sitting with"
 
---
 
## QUICK REFERENCE: WORD FREQUENCY CAPS
 
| Word/Phrase | Max per chapter | Max per book |
|-------------|----------------|-------------|
| leverage (noun) | 1 | 6 |
| leverage (verb) | 0 | 0 |
| structural | 1 | 8 |
| mechanism | 1 | 8 |
| framework | 1 | 8 |
| pattern | 3 | N x 0.5 |
| dynamic | 2 | N |
| ask yourself | 1 | 6 |
| notice when | 1 | 8 |
| pay attention to | 1 | 8 |
| think about | 1 | 10 |
| consider whether | 1 | 8 |
| The person who | 4 (competitive only) | N x 2 |
| The player who | 2 (competitive only) | N x 1 |
 
Closing sentence specific: "structural", "mechanism", "pattern", "dynamic", "framework", "system" = max 3 closing sentences each across entire book.
 
---
 
## QUICK REFERENCE: LEARNING SCIENCE TARGETS
 
| Dimension | Research finding | Validator check |
|-----------|-----------------|-----------------|
| Working memory chunks | 4 plus or minus 1 (Cowan, 2010) | B2/B3: medium 5-6, hard 5-7 takeaways |
| Retrieval practice | g = 0.50 (Rowland, 2014) | E1: quiz must exist, not null |
| Bloom's progression | Remember through Create | E7/M1: quiz questions must progress |
| Pretesting effect | g = 0.34-0.54 | M2: prediction prompts must ask predictions |
| Generation effect | d = 0.40 | M5: recap retrieve must demand recall |
| Implementation intentions | d = 0.65 | M6: if-then plans must be specific |
| Elaborate feedback | better than right/wrong | E3: explanations must be tone objects with reasoning |
| Depth not quantity | Bloom's cognitive levels | B3: fewer deeper takeaways, not more shallow ones |
 
---
 
## NOW: Run the validation. Read the book JSON, execute every check, produce the score and report. Await approval before executing fixes.
 