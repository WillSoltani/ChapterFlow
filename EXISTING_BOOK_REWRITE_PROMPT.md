# ChapterFlow: Rewrite Existing Book Content

## BOOK TO REWRITE

**Book:** [XXXXXXX]

---

## EXECUTION STRATEGY: PARALLEL AGENT DEPLOYMENT

You MUST follow this execution strategy exactly:

### Phase 1: Analyze the Book

1. Read the existing JSON file for [XXXXXXX] from the `book-packages/` directory. Find the file by searching for the book title in `book-packages/*.modern.json`.
2. Count the total number of chapters in the book. Call this number **N**.
3. Read and preserve all root-level metadata: `schemaVersion`, `packageId`, `createdAt`, `contentOwner`, and the entire `book` object (`bookId`, `title`, `author`, `categories`, `tags`, `edition`, `variantFamily`).
4. For each chapter, note the `chapterId`, `number`, and `title` (these will be preserved).
5. Read the existing content to understand what ideas, stories, and concepts each chapter covers. Extract the core concept per chapter so agents can write accurate content.

### Phase 2: Deploy N Agents in Parallel

Deploy exactly **N agents simultaneously** (one per chapter), where N is the number of chapters in the book. Launch ALL agents in a single message using parallel tool calls. Do NOT run them sequentially.

Each agent receives:
- The complete schema specification (copied from this prompt below)
- The chapter number, chapterId, and title to write
- A brief description of the chapter's core concept (2-3 sentences you extracted in Phase 1)
- The titles and core concepts of ALL other chapters in the book (so the agent can write cross-chapter references and preview teasers)
- Whether this is the FIRST chapter (no back-references needed) or the LAST chapter (needs "Full circle" preview)
- The book title and author name
- Instructions to write the output to `/tmp/{bookId}-ch{NN}.json` where NN is zero-padded

**Agent prompt template** (fill in the bracketed values for each agent):

```
You are rewriting Chapter [NUMBER] of "[BOOK TITLE]" by [AUTHOR] for the ChapterFlow reading app.

CHAPTER INFO:
- chapterId: [CHAPTER_ID]
- number: [NUMBER]
- title: [TITLE]
- Core concept: [2-3 SENTENCE DESCRIPTION OF WHAT THIS CHAPTER TEACHES]

ALL CHAPTERS IN THIS BOOK (for cross-references and previews):
[LIST ALL CHAPTER NUMBERS, TITLES, AND 1-LINE CONCEPTS]

THIS IS CHAPTER [NUMBER] OF [N] TOTAL.
[IF CHAPTER 1: "This is the first chapter. No back-references to previous chapters are needed. Your preview should tease Chapter 2."]
[IF LAST CHAPTER: "This is the last chapter. Your Standard and Deeper preview must be a 'Full circle' reflection connecting back to Chapter 1, not a teaser for a next chapter."]
[IF MIDDLE CHAPTER: "Your Standard and Deeper breakdowns must reference at least one concept from a previous chapter. Your preview should tease Chapter [N+1]: [NEXT CHAPTER TITLE]."]

Write the complete chapter JSON object following the EXACT schema below. Output valid JSON to the file /tmp/[BOOK_ID]-ch[NN].json.

[PASTE THE COMPLETE SCHEMA SPECIFICATION FROM "CHAPTER SCHEMA SPECIFICATION" SECTION BELOW]
```

### Phase 3: Assemble the Final JSON

After ALL agents complete:

1. Read each `/tmp/{bookId}-ch{NN}.json` file
2. Parse and validate each chapter's JSON
3. Assemble them into the final book JSON with the preserved root metadata
4. Scan the entire assembled JSON for any em dashes (—) or en dashes (–) and replace them with commas
5. Write the final complete JSON to `book-packages/{bookId}.modern.json`, overwriting the old file
6. Verify the JSON is valid and the build passes

### Phase 4: Wire the Book for Tone Support

Check if the book is already wired through `normalizeNstdPackage` in `app/book/data/bookPackages.ts`. If it is NOT (i.e., it uses `as BookPackage` direct casting), update `bookPackages.ts`:

1. Change the export from:
   ```typescript
   export const BOOK_CONSTANT = bookImportJson as BookPackage;
   ```
   to:
   ```typescript
   export const BOOK_CONSTANT = normalizeNstdPackage(bookImportJson, "direct");
   ```
   This ensures the tone objects (`{gentle, direct, competitive}`) are properly resolved to strings for the rest of the system.

2. Verify the build still passes after this change.

---

## CHAPTER SCHEMA SPECIFICATION

This is the complete specification for each chapter. This entire section must be included in every agent's prompt.

### Critical Anti-Patterns: NEVER Do These

1. **NEVER repeat the same closing phrase** across scenarios or sections. If you use a closing phrase once, never use it again in this chapter.

2. **NEVER use identical sentence structures across consecutive items.** If key point 1 starts with "The chapter presents...", key point 2 must NOT start with "The chapter shows..." or any similar pattern. Vary sentence openings aggressively.

3. **NEVER let depth levels differ only by word count.** Simple, Standard, and Deeper must differ in cognitive demand, not just length.

4. **NEVER use these AI-tell phrases:** "delve", "crucial", "landscape", "realm", "It's worth noting", "In today's world", "It's important to remember", "This highlights the importance of", "Furthermore", "Moreover", "In conclusion", "plays a pivotal role", "at its core", "the art of", "navigating", "harnessing", "game-changer", "paradigm shift", "robust", "synergy", "leverage" (verb meaning "use"), "facilitate", "utilize", "foster", "embark on", "a testament to", "shed light on", "This matters because", "This is significant because", "it is essential to". Use plain, direct English.

5. **NEVER make all scenarios follow the same pattern.** Each of the 6 scenarios must use a DIFFERENT narrative structure.

6. **NEVER write "Why it matters" sections that all sound the same.** Each must be unique in structure, insight, and framing.

7. **NEVER have key points that repeat each other.** Consolidate ruthlessly. Quality over quantity.

8. **NEVER use em dashes (—) or en dashes (–).** Use commas, semicolons, colons, or restructure the sentence. Zero exceptions.

### Chapter JSON Structure

Output a single JSON object (not wrapped in an array) with this exact structure:

```json
{
  "chapterId": "<preserve from input>",
  "number": <preserve from input>,
  "title": "<preserve from input>",
  "readingTimeMinutes": <calculate: standard summary words / 200 + 3 + 2, rounded>,
  "contentVariants": {
    "easy": { ... },
    "medium": { ... },
    "hard": { ... }
  },
  "examples": [ ... ],
  "quiz": { ... },
  "keyTakeawayCard": {
    "gentle": "<1 paragraph, 2-3 sentences. The single most important insight from this chapter. Not a summary of the summary, but a crisp standalone insight a reader remembers a week later.>",
    "direct": "<same insight, direct tone>",
    "competitive": "<same insight, competitive tone>"
  }
}
```

### contentVariants.easy (Simple / "Skim")

**Purpose:** Reader can explain the chapter's main idea to a friend in 2 minutes.
**Bloom's level:** Remember / Understand
**Word count:** 400-600 words total

```json
{
  "chapterBreakdown": {
    "gentle": "<2 paragraphs separated by \\n\\n. P1: What is the core idea? P2: Why does it matter in everyday life? Include one concrete analogy or image. Warm, inviting: 'Here's the heart of what [author] is saying...'>",
    "direct": "<Same 2-paragraph structure. Clean, efficient: 'The core technique: [X]. Here's how it works.'>",
    "competitive": "<Same 2-paragraph structure. Punchy, challenging: 'Most people get this wrong. Here's what actually works.'>"
  },
  "keyTakeaways": [
    {
      "point": {
        "gentle": "<1-2 sentences. Sharp, memorable, underline-worthy statement.>",
        "direct": "<Same idea, direct delivery.>",
        "competitive": "<Same idea, framed as competitive advantage.>"
      }
    },
    { "point": { "gentle": "...", "direct": "...", "competitive": "..." } },
    { "point": { "gentle": "...", "direct": "...", "competitive": "..." } }
  ],
  "oneMinuteRecap": {
    "gentle": "<Single 'Try this next' action item. 1 sentence. Specific, immediately actionable. Must be different from every other chapter's recap.>",
    "direct": "<Same action, direct framing.>",
    "competitive": "<Same action, challenge framing.>"
  }
}
```

**Rules:**
- Exactly 3 key takeaways, no more, no less. No `moreDetails` field on easy takeaways.
- `chapterBreakdown` must be exactly 2 paragraphs (separated by `\n\n`)
- `oneMinuteRecap` is a flat `{gentle, direct, competitive}` object. NOT retrieve/connect/preview.

### contentVariants.medium (Standard / "Study")

**Purpose:** Reader understands how and why each concept works and can start applying them.
**Bloom's level:** Apply / Analyze
**Word count:** 1000-1500 words total

```json
{
  "chapterBreakdown": {
    "gentle": "<3-4 paragraphs separated by \\n\\n. Opens with core tension or counterintuitive claim. Explains reasoning and evidence. Uses at least 1 specific example from the book (a story the author tells, a case study, an experiment). Connects ideas within the chapter. From Chapter 2 onward: includes at least 1 explicit reference to a previous chapter's concept.>",
    "direct": "<Same structure, analytical tone.>",
    "competitive": "<Same structure, opens with what most people get wrong.>"
  },
  "keyTakeaways": [
    {
      "point": {
        "gentle": "<**Bold headline phrase.** 2-3 sentences of explanation. Use **bold** markdown for the headline.>",
        "direct": "<**Bold headline.** 2-3 sentences, analytical.>",
        "competitive": "<**Bold headline.** 2-3 sentences, competitive framing.>"
      },
      "moreDetails": {
        "gentle": "<3-5 sentences: a worked example showing the concept in action, OR a common mistake people make with this concept, OR a connection to another chapter's idea.>",
        "direct": "<Same expansion, analytical framing.>",
        "competitive": "<Same expansion, advantage/mastery framing.>"
      }
    }
  ],
  "selfCheckPrompt": {
    "gentle": "<One elaborative interrogation question. Format: 'Ask yourself: [question about why this works]'>",
    "direct": "<Same type of question, direct framing.>",
    "competitive": "<Same type of question, challenge framing.>"
  },
  "oneMinuteRecap": {
    "retrieve": {
      "gentle": "<'Without scrolling back up, what were the [N] main techniques from this chapter?'>",
      "direct": "<Same retrieval challenge, direct.>",
      "competitive": "<Same retrieval challenge, competitive.>"
    },
    "connect": {
      "gentle": "<1 sentence linking to a previous chapter or the reader's own life.>",
      "direct": "<Same connection, analytical.>",
      "competitive": "<Same connection, strategic.>"
    },
    "preview": {
      "gentle": "<1-2 sentences creating genuine curiosity about the next chapter without spoiling. Reference a real concept from the next chapter.>",
      "direct": "<Same teaser, direct.>",
      "competitive": "<Same teaser, competitive.>"
    }
  }
}
```

**Rules:**
- 5-7 key takeaways, each with BOTH `point` and `moreDetails`
- Each takeaway headline uses `**bold**` markdown
- `selfCheckPrompt` is singular (1 tone object, not an array)
- `oneMinuteRecap` uses the three-part retrieve/connect/preview structure
- From Chapter 2 onward, `chapterBreakdown` must include at least one explicit reference to a concept from a previous chapter

### contentVariants.hard (Deeper / "Master")

**Purpose:** Reader can critically evaluate, synthesize across chapters, and identify limitations.
**Bloom's level:** Evaluate / Create
**Word count:** 2000-2800 words total

```json
{
  "chapterBreakdown": {
    "gentle": "<4-5 paragraphs. Opens with a provocative analytical claim (not a neutral summary). Explores underlying psychology or research behind the author's techniques. Identifies at least 1 limitation, counterargument, or edge case where the advice might fail. Draws explicit connections to at least 1 other chapter. Ends with synthesis of this chapter's contribution to the book's overall argument.>",
    "direct": "<Same structure, precise and analytical.>",
    "competitive": "<Same structure, intellectually challenging: 'Here's where most analyses of this chapter stop. Let's go further.'>"
  },
  "keyTakeaways": [
    {
      "point": {
        "gentle": "<**Bold headline.** 3-4 sentences of explanation at the evaluate/create level.>",
        "direct": "<**Bold headline.** 3-4 sentences, analytical.>",
        "competitive": "<**Bold headline.** 3-4 sentences, mastery-oriented.>"
      },
      "moreDetails": {
        "gentle": "<Critical analysis: when does this NOT work? OR a cross-chapter connection showing interaction with another chapter's concept. OR a deeper psychological/research reference. OR a 'what would change if...' thought experiment.>",
        "direct": "<Same expansion, analytical.>",
        "competitive": "<Same expansion, strategic edge framing.>"
      }
    }
  ],
  "selfCheckPrompts": [
    {
      "gentle": "<Elaborative interrogation: why does this work? What's happening psychologically?>",
      "direct": "<Same question, direct and analytical.>",
      "competitive": "<Same question, challenging: 'Construct a specific scenario where...'>"
    },
    {
      "gentle": "<Critical evaluation: what's the strongest argument against this approach? Where might it fall short?>",
      "direct": "<Same question, direct.>",
      "competitive": "<Same question, steel-man framing: 'Under what conditions does the opposing approach outperform this one?'>"
    }
  ],
  "predictionPrompt": {
    "gentle": "<'Before you move on, predict what problem the next chapter will try to solve. Write it down mentally. When you start Chapter [N+1], check if you were right.'>",
    "direct": "<Same prediction prompt, direct.>",
    "competitive": "<Same prediction prompt, competitive.>"
  },
  "oneMinuteRecap": {
    "retrieve": {
      "gentle": "<More demanding than Standard: asks reader to recall AND explain reasoning behind the concepts.>",
      "direct": "<Same, analytical.>",
      "competitive": "<Same, competitive.>"
    },
    "connect": {
      "gentle": "<Links to TWO previous chapters or real-world contexts.>",
      "direct": "<Same dual connection, analytical.>",
      "competitive": "<Same dual connection, strategic.>"
    },
    "preview": {
      "gentle": "<More substantive teaser with a question that creates information-gap curiosity. For the LAST chapter: 'Full circle' reflection connecting back to Chapter 1 and asking the reader to consider how their understanding has evolved.>",
      "direct": "<Same preview, direct.>",
      "competitive": "<Same preview, competitive.>"
    }
  }
}
```

**Rules:**
- 7-10 key takeaways, each with BOTH `point` and `moreDetails`
- `selfCheckPrompts` is an ARRAY of exactly 2 objects (not 1, not 3)
- `predictionPrompt` is required
- `oneMinuteRecap` uses retrieve/connect/preview
- For the LAST chapter, the preview is a "Full circle" reflection connecting back to Chapter 1
- From Chapter 2 onward, `chapterBreakdown` must reference concepts from previous chapters

### examples (Scenarios): 6 Per Chapter

Each chapter gets exactly 6 examples: 2 Work, 2 School, 2 Personal.

```json
{
  "exampleId": "ch01-ex01",
  "title": "<Descriptive title including the character's name>",
  "category": "work",
  "format": "decision_point",
  "contexts": ["work"],
  "scenario": {
    "gentle": "<80-150 words. The situation itself. Must include 3+ concrete specific details (names, dates, specific items, amounts, locations). Characters learn and grow.>",
    "direct": "<Same situation, action-oriented framing. Characters face and solve problems.>",
    "competitive": "<Same situation, stakes-oriented framing. Characters outperform and gain edges.>"
  },
  "whatToDo": {
    "gentle": "<60-120 words. How to apply the chapter's concept. Uses 'try starting with...' and 'you might find that...' language.>",
    "direct": "<Same advice. Uses 'use [technique]' and 'the move here is...' language.>",
    "competitive": "<Same advice. Uses 'the power move is...' and 'most people would [common mistake], instead...' language.>"
  },
  "whyItMatters": {
    "gentle": "<50-100 words. Growth and understanding oriented. Unique ending, different from every other whyItMatters in this chapter.>",
    "direct": "<Results and efficiency oriented. Different unique ending.>",
    "competitive": "<Advantage and mastery oriented. Different unique ending.>"
  }
}
```

#### The 6 Scenario Formats (use each exactly ONCE per chapter)

1. **decision_point** — Character must choose between two plausible actions. Show the situation building to a fork. "What to do" walks through applying the chapter's technique. "Why it matters" explains what's at stake and why the instinctive reaction would have been worse.

2. **postmortem** — Opens with "Here's what happened:" and describes a situation that already went wrong because the character didn't use the technique. "What to do" rewinds and shows how the concept would have changed the outcome. "Why it matters" identifies the general pattern that caused the failure, not just this specific case.

3. **dialogue** — Written primarily as a realistic conversation (3-6 exchanges). Shows the technique happening in real-time dialogue. The reader should picture themselves saying these words. "What to do" breaks down what happened and why each move worked. "Why it matters" explains the conversational principle at play.

4. **predict_reveal** — Describes a situation building toward a critical moment. Pauses with: "What would you expect to happen next?" Then reveals a surprising or counterintuitive outcome. "What to do" explains why using the chapter's framework. "Why it matters" connects the surprise to a broader insight about human behavior.

5. **dilemma** — A situation where the chapter's technique helps but doesn't fully resolve the tension. Reasonable people would handle it differently. "What to do" presents the technique AND acknowledges its limits in this context. "Why it matters" explores genuine complexity, not a simple "apply technique, get result" story.

6. **before_after** — Same character in two versions of the same situation: once without the technique (struggling), once with it (improved outcome). "What to do" highlights the specific behavioral difference between the two versions. "Why it matters" identifies what the character had to change internally, not just externally.

#### Scenario Rules

- **Character names:** Use diverse, realistic names. NEVER use the same name more than twice in the entire book. Rotate through: Maya, Ethan, Priya, Marcus, Sofia, Kai, Nora, James, Leila, Andre, Yuki, Omar, Tessa, Davi, Aaliyah, Connor, Rosa, Kenji, Dante, Rina, Felix, Naomi, Tariq, Ivy, Mei, Zara, Liam, Amara, Samir, Elena, Hana, Derek, Celia, Riku, Asha, Nico, Petra, Idris, etc.
- **Specificity:** Every scenario must include 3+ concrete, specific details (names, dates, dollar amounts, specific objects, room numbers, deadlines, etc.). NOT "a student has a group project problem" but "Priya's marketing strategy presentation is due Thursday, and her teammate Ethan hasn't sent his competitive analysis section in four days."
- **Unique endings:** Every "Why it matters" ending must be different across all 6 scenarios in the chapter. Cycle through ending types:
  - A broader principle about human behavior
  - A question the reader can ask themselves
  - A surprising implication they might not have considered
  - A connection to a different area of life
  - A warning about a common trap
  - A reframe that shifts perspective
- **`category` must match `contexts[0]`**: "work", "school", or "personal"
- **`exampleId` format:** `ch01-ex01` through `ch01-ex06`
- Do NOT use the same format in the same category slot across consecutive chapters. If Ch1's first work scenario is `decision_point`, Ch2's first work scenario should NOT be `decision_point`.

### quiz: 10 Questions Per Chapter

```json
{
  "passingScorePercent": 80,
  "questions": [
    {
      "questionId": "ch01-q01",
      "prompt": "<Clear, complete sentence question>",
      "choices": [
        "A) <option text>",
        "B) <option text>",
        "C) <option text>"
      ],
      "correctIndex": 0,
      "explanation": {
        "gentle": "<2-3 sentences: why the correct answer is correct (with reference to the chapter concept) + why the most tempting wrong answer is wrong (addressing the specific misconception).>",
        "direct": "<Same explanation, analytical framing.>",
        "competitive": "<Same explanation, mastery framing: 'The trap is [X], which is what someone who half-read the chapter would pick.'>"
      },
      "bloomsLevel": "remember",
      "depthLevel": "simple"
    }
  ]
}
```

#### Question Level Distribution

| Questions | depthLevel | bloomsLevel options | What it tests | Target success rate |
|-----------|-----------|-------------------|---------------|---------------------|
| q01-q05 | `"simple"` | `"remember"` or `"understand"` | "What did the chapter say?" / "What does this concept mean?" | 70-85% |
| q06-q07 | `"standard"` | `"apply"` or `"analyze"` | Short scenario-based: "How would you use this?" / "Why does this work?" | 55-70% |
| q08-q10 | `"deeper"` | `"evaluate"` or `"create"` | Critical analysis, edge cases, cross-chapter: "When would this fail?" | 40-55% |

#### Quiz Rules

- Exactly 3 options per question, prefixed with "A) ", "B) ", "C) "
- Wrong answers must be **plausible misunderstandings**, not obviously incorrect. A wrong answer should be what someone who half-understood the concept might choose.
- Distribute `correctIndex` roughly evenly across 0, 1, 2 (about 3-4 of each across all 10 questions)
- Never use "all of the above" or "none of the above"
- Never make the correct answer consistently the longest or shortest option
- No absolute words ("always", "never") in correct answers unless genuinely absolute
- Each question tests a DIFFERENT concept from the chapter
- `questionId` format: `ch01-q01` through `ch01-q10`
- `explanation` is a `{gentle, direct, competitive}` tone object, NOT a plain string
- Every question prompt must be unique across the entire book. No two questions should use the same phrasing template.
- Avoid double negatives
- Question stems must be clear, complete sentences, not fragments

### Tone Implementation

Tone must change **substance**, not just adjectives. Competitive isn't Direct with "powerful" added. Gentle isn't Direct with "please" inserted.

| Section | Gentle | Direct | Competitive |
|---------|--------|--------|-------------|
| Breakdown opening | Invitational, curious: "Here's the heart of what [author] is saying..." | States the core claim immediately: "The core technique: [X]." | Opens with what most people get wrong: "Most people do [Y]. They lose." |
| Key takeaway language | "You might find that..." | "The technique is..." | "The advantage here is..." |
| Scenario framing | Characters learn and grow | Characters face and solve problems | Characters outperform and gain edges |
| Why it matters | Growth and understanding oriented | Results and efficiency oriented | Advantage and mastery oriented |
| oneMinuteRecap | "Take a moment to reflect..." | "Key action: [X]" | "Here's your edge..." |
| selfCheckPrompt | "Ask yourself..." (exploratory) | "Explain the mechanism..." (analytical) | "Construct a scenario..." (challenging) |

### Cross-Chapter Continuity

1. **From Chapter 2 onward:** Standard and Deeper `chapterBreakdown` must reference at least one concept from a previous chapter. These should feel natural, not forced.
2. **Progressive complexity:** Early chapter scenarios are straightforward single-concept applications. Later chapters should involve multiple concepts from different chapters working together.
3. **Preview teasers:** Every Standard/Deeper `oneMinuteRecap.preview` creates genuine curiosity about the next chapter by referencing a real concept from that chapter.
4. **Last chapter:** Preview becomes a "Full circle" reflection connecting back to Chapter 1.

### Quality Checklist

Before writing the output file, verify:

- [ ] Easy has exactly 3 key takeaways (no `moreDetails`)
- [ ] Standard has 5-7 key takeaways, each with BOTH `point` and `moreDetails`
- [ ] Deeper has 7-10 key takeaways, each with BOTH `point` and `moreDetails`
- [ ] No closing phrase repeated anywhere in the chapter
- [ ] All 6 scenario formats used exactly once
- [ ] Character names are diverse (no name used more than twice in the book)
- [ ] Every scenario has 3+ specific concrete details
- [ ] Quiz has exactly 10 questions in a single flat `questions` array
- [ ] Questions 1-5: `depthLevel: "simple"`, `bloomsLevel: "remember"` or `"understand"`
- [ ] Questions 6-7: `depthLevel: "standard"`, `bloomsLevel: "apply"` or `"analyze"`
- [ ] Questions 8-10: `depthLevel: "deeper"`, `bloomsLevel: "evaluate"` or `"create"`
- [ ] All quiz choices: exactly 3 options, prefixed "A) ", "B) ", "C) "
- [ ] `correctIndex` values distributed roughly evenly across 0, 1, 2
- [ ] Every `explanation` is `{gentle, direct, competitive}`, NOT a string
- [ ] No AI-tell phrases anywhere
- [ ] No em dashes (—) or en dashes (–) anywhere
- [ ] Sentence structure varies across consecutive items
- [ ] Standard has `selfCheckPrompt` (singular, 1 object)
- [ ] Deeper has `selfCheckPrompts` (plural, array of exactly 2) AND `predictionPrompt`
- [ ] Standard and Deeper `oneMinuteRecap` use retrieve/connect/preview structure
- [ ] Easy `oneMinuteRecap` is flat `{gentle, direct, competitive}` (NOT retrieve/connect/preview)
- [ ] Last chapter preview is "Full circle" connecting to Chapter 1
- [ ] `keyTakeawayCard` exists with all 3 tones
- [ ] `category` and `format` fields exist on every example
- [ ] `contexts` array matches `category` on each example (e.g., `category: "work"` → `contexts: ["work"]`)
- [ ] Tone genuinely changes substance, not just adjectives
- [ ] Each depth level targets the correct Bloom's taxonomy level

---

## FIELD MAPPING: OLD SCHEMA → NEW SCHEMA

The input file uses the OLD schema. Here is what to expect and how to transform:

**OLD fields to DISCARD** (replaced by new structure):
- `contentVariants.{easy|medium|hard}.summaryBullets` → replaced by `chapterBreakdown` + `keyTakeaways`
- `contentVariants.{easy|medium|hard}.summaryBlocks` → replaced by `chapterBreakdown` + `keyTakeaways`
- `contentVariants.{easy|medium|hard}.importantSummary` → replaced by `chapterBreakdown`
- `contentVariants.{easy|medium|hard}.takeaways` → replaced by `keyTakeaways`
- `contentVariants.{easy|medium|hard}.practice` → replaced by `oneMinuteRecap`
- `examples[].scenario` (was a plain string) → now a `{gentle, direct, competitive}` object
- `examples[].whatToDo` (was a `string[]` array) → now a `{gentle, direct, competitive}` object (single string per tone, not array)
- `examples[].whyItMatters` (was a plain string) → now a `{gentle, direct, competitive}` object
- `quiz.questions[].choices` (was 4 items) → now 3 items, prefixed with "A) ", "B) ", "C) "
- `quiz.questions[].explanation` (was a plain string or absent) → now a `{gentle, direct, competitive}` object

**OLD fields to PRESERVE unchanged:**
- `schemaVersion`, `packageId`, `createdAt`, `contentOwner`
- `book.bookId`, `book.title`, `book.author`, `book.categories`, `book.tags`, `book.edition`, `book.variantFamily`
- `chapters[].chapterId`, `chapters[].number`

**NEW fields to ADD:**
- `chapters[].keyTakeawayCard` — `{gentle, direct, competitive}` (chapter-level)
- `contentVariants.medium.selfCheckPrompt` — `{gentle, direct, competitive}`
- `contentVariants.hard.selfCheckPrompts` — array of 2 `{gentle, direct, competitive}` objects
- `contentVariants.hard.predictionPrompt` — `{gentle, direct, competitive}`
- `examples[].category` — "work" | "school" | "personal"
- `examples[].format` — "decision_point" | "postmortem" | "dialogue" | "predict_reveal" | "dilemma" | "before_after"
- `quiz.questions[].bloomsLevel` — "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create"
- `quiz.questions[].depthLevel` — "simple" | "standard" | "deeper"

---

## ASSEMBLY TEMPLATE

When assembling the final JSON in Phase 3, use this structure:

```json
{
  "schemaVersion": "<preserved>",
  "packageId": "<preserved>",
  "createdAt": "<preserved>",
  "contentOwner": "<preserved>",
  "book": {
    "bookId": "<preserved>",
    "title": "<preserved>",
    "author": "<preserved>",
    "categories": ["<preserved>"],
    "tags": ["<preserved>"],
    "edition": { "<preserved>" },
    "variantFamily": "EMH"
  },
  "chapters": [
    <chapter 1 JSON from /tmp/{bookId}-ch01.json>,
    <chapter 2 JSON from /tmp/{bookId}-ch02.json>,
    ...
    <chapter N JSON from /tmp/{bookId}-chNN.json>
  ]
}
```

Sort chapters by `number` field in ascending order.

---

## WIRING CHANGE IN bookPackages.ts

After assembling the JSON, check `app/book/data/bookPackages.ts` to see how the book is currently exported. If it uses a direct `as BookPackage` cast:

```typescript
// OLD (will break with tone objects):
export const SOME_BOOK_PACKAGE = someBookPackageJson as BookPackage;
```

Change it to use the normalizer:

```typescript
// NEW (properly resolves tone objects):
export const SOME_BOOK_PACKAGE = normalizeNstdPackage(someBookPackageJson, "direct");
```

The `normalizeNstdPackage` function already exists in the file and handles:
- Resolving `{gentle, direct, competitive}` tone objects to plain strings
- Converting `chapterBreakdown` paragraphs into `summaryBlocks`
- Converting `keyTakeaways` into `summaryBullets` and `takeaways`
- Converting `oneMinuteRecap` into `practice`
- Resolving tone objects in `scenario`, `whatToDo`, `whyItMatters`, and `explanation`

This is required because the rest of the app (mockChapters.ts, quiz-session.ts) expects plain strings, not tone objects. Without this normalization, you will get runtime errors like `question.explanation?.trim is not a function`.

---

## SUMMARY OF WHAT TO DO

1. **Read** the existing `book-packages/[XXXXXXX].modern.json` (find the file by book title)
2. **Extract** chapter count, all chapter IDs/titles/concepts, and root metadata
3. **Deploy N agents in parallel** (one per chapter) with the full schema spec
4. **Wait** for all agents to complete
5. **Assemble** the final JSON from all `/tmp/` chapter files
6. **Strip** any em/en dashes from the assembled content
7. **Write** the final JSON to `book-packages/{bookId}.modern.json`
8. **Update** `bookPackages.ts` to use `normalizeNstdPackage` if not already
9. **Build** to verify everything passes
