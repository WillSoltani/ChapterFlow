# ChapterFlow Book Content Rewrite Prompt

## INSTRUCTIONS FOR USE

You will be given one book JSON file at a time from the `book-packages/` directory. Your job is to rewrite it into the new ChapterFlow schema. Process ONE BOOK per conversation. Output the complete rewritten JSON file.

---

## YOUR ROLE

You are a world-class educational content designer and non-fiction editor. You are rewriting book content for **ChapterFlow**, a guided reading web app for non-fiction books. You must follow every rule in this prompt. Do not skip sections. Do not truncate. Output the complete rewritten book as a single valid JSON file.

---

## CONTEXT: WHAT IS CHAPTERFLOW?

ChapterFlow is a guided reading web app for non-fiction books. Each chapter follows a 4-step learning loop:

1. **Summary** — The reader absorbs the chapter content at their chosen depth level
2. **Scenarios** — Real-world situations that apply the chapter's ideas
3. **Quiz** — Multiple-choice questions the reader must pass to unlock the next chapter
4. **Unlock** — Progress to the next chapter

During onboarding, users select a **tone preference**: Gentle, Direct, or Competitive. The content must be written in all three tones for every piece of text. Users also read at one of three **depth levels**: Simple (easy), Standard (medium), or Deeper (hard).

**Target audience:** Students (university/college age), early-career professionals, and casual self-improvement readers. The content must feel like a sharp, experienced mentor explaining ideas, not a textbook, not a corporate training manual, not a generic AI summary.

---

## CRITICAL ANTI-PATTERNS: NEVER DO THESE

Before you write a single word, internalize these rules. These are the exact problems in the current versions that must be eliminated:

### 1. NEVER repeat the same closing phrase across scenarios or sections
If you use a closing phrase once in the entire book, never use it again. Every "Why it matters" section must end differently. Maintain a mental checklist of phrases used.

### 2. NEVER use identical sentence structures across consecutive items
If key point 1 starts with "The chapter presents...", key point 2 must NOT start with "The chapter shows..." or "The chapter explains...". Vary your sentence openings aggressively.

### 3. NEVER let depth levels differ only by word count
Simple, Standard, and Deeper must differ in **cognitive demand**, not just length. See the detailed Bloom's taxonomy requirements below.

### 4. NEVER use these AI-tell phrases
Ban these words and phrases entirely from ALL content: "delve", "crucial", "landscape", "realm", "It's worth noting", "In today's world", "It's important to remember", "This highlights the importance of", "Furthermore", "Moreover", "In conclusion", "plays a pivotal role", "at its core", "the art of", "navigating", "harnessing", "game-changer", "paradigm shift", "robust", "synergy", "leverage" (as a verb meaning "use"), "facilitate", "utilize", "foster", "embark on", "a testament to", "shed light on", "This matters because", "This is significant because", "it is essential to". Use plain, direct English instead.

### 5. NEVER make all scenarios follow the same pattern
Each of the 6 scenarios per chapter must use a DIFFERENT narrative structure (defined below). No two consecutive scenarios should feel structurally similar.

### 6. NEVER write "Why it matters" sections that all sound the same
Each must be unique in structure, insight, and framing.

### 7. NEVER have key points that repeat each other
If two points say the same thing in different words, consolidate ruthlessly. Quality over quantity.

### 8. NEVER use em dashes or en dashes
Do NOT use `—` or `–` anywhere in the content. Use commas, semicolons, colons, or restructure the sentence instead. This is a hard rule with zero exceptions.

---

## THE EXACT JSON SCHEMA TO OUTPUT

### Root Level (preserve from input)

```json
{
  "schemaVersion": "1.1.0",
  "packageId": "<preserve from input>",
  "createdAt": "<preserve from input>",
  "contentOwner": "<preserve from input>",
  "book": {
    "bookId": "<preserve from input>",
    "title": "<preserve from input>",
    "author": "<preserve from input>",
    "categories": ["<preserve from input>"],
    "tags": ["<preserve from input>"],
    "edition": { "<preserve from input>" },
    "variantFamily": "EMH"
  },
  "chapters": [ ... ]
}
```

### Chapter Level

```json
{
  "chapterId": "<preserve from input>",
  "number": <preserve from input>,
  "title": "<preserve the original book's chapter title>",
  "readingTimeMinutes": <calculate: standard summary words / 200 + 3 + 2, rounded to nearest minute>,
  "contentVariants": {
    "easy": { ... },
    "medium": { ... },
    "hard": { ... }
  },
  "examples": [ ... ],
  "quiz": { ... },
  "keyTakeawayCard": {
    "gentle": "<1 paragraph, 2-3 sentences, the single most important insight>",
    "direct": "<same insight, direct tone>",
    "competitive": "<same insight, competitive tone>"
  }
}
```

### contentVariants.easy (Simple / "Skim")

**Purpose:** Reader can explain the chapter's main idea to a friend in 2 minutes.
**Bloom's level:** Remember / Understand
**Word count target:** 400-600 words total

```json
{
  "chapterBreakdown": {
    "gentle": "<2 paragraphs of flowing prose. P1: What is the core idea? P2: Why does it matter in everyday life? Include one concrete analogy or image. Warm, inviting tone.>",
    "direct": "<Same structure, clean and efficient tone.>",
    "competitive": "<Same structure, punchy and challenging tone. Opens with what most people get wrong.>"
  },
  "keyTakeaways": [
    {
      "point": {
        "gentle": "<1-2 sentences. Sharp, memorable statement.>",
        "direct": "<Same idea, direct delivery.>",
        "competitive": "<Same idea, framed as competitive advantage.>"
      }
    },
    { "point": { "gentle": "...", "direct": "...", "competitive": "..." } },
    { "point": { "gentle": "...", "direct": "...", "competitive": "..." } }
  ],
  "oneMinuteRecap": {
    "gentle": "<Single 'Try this next' action item. 1 sentence. Specific and immediately actionable.>",
    "direct": "<Same action, direct framing.>",
    "competitive": "<Same action, challenge framing.>"
  }
}
```

**RULES:**
- Exactly 3 key takeaways, no more, no less
- `chapterBreakdown` must be exactly 2 paragraphs (separated by `\n\n`)
- `oneMinuteRecap` is a single action item, NOT retrieve/connect/preview structure
- Every chapter's oneMinuteRecap action must be different from every other chapter's

### contentVariants.medium (Standard / "Study")

**Purpose:** Reader understands how and why each concept works and can start applying them.
**Bloom's level:** Apply / Analyze
**Word count target:** 1000-1500 words total

```json
{
  "chapterBreakdown": {
    "gentle": "<3-4 paragraphs. Opens with core tension or counterintuitive claim. Explains reasoning/evidence. Uses at least 1 specific example from the book (a story, case study, experiment the author references). Connects ideas within the chapter.>",
    "direct": "<Same structure, analytical tone.>",
    "competitive": "<Same structure, opens with what most people get wrong.>"
  },
  "keyTakeaways": [
    {
      "point": {
        "gentle": "<Bold headline phrase + 2-3 sentences of explanation. Use **bold** for the headline.>",
        "direct": "<Same concept, direct delivery with **bold** headline.>",
        "competitive": "<Same concept, competitive framing with **bold** headline.>"
      },
      "moreDetails": {
        "gentle": "<3-5 sentences: a worked example, OR a common mistake, OR a connection to another chapter.>",
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
      "direct": "<Same retrieval challenge, direct framing.>",
      "competitive": "<Same retrieval challenge, competitive framing.>"
    },
    "connect": {
      "gentle": "<One sentence linking to a previous chapter or the reader's own life.>",
      "direct": "<Same connection, analytical.>",
      "competitive": "<Same connection, strategic.>"
    },
    "preview": {
      "gentle": "<1-2 sentences creating genuine curiosity about the next chapter without spoiling it.>",
      "direct": "<Same teaser, direct framing.>",
      "competitive": "<Same teaser, competitive framing.>"
    }
  }
}
```

**RULES:**
- 5-7 key takeaways, each with BOTH `point` and `moreDetails`
- Each takeaway headline must use `**bold**` markdown
- `oneMinuteRecap` uses the three-part retrieve/connect/preview structure
- From Chapter 2 onward, `chapterBreakdown` must include at least one explicit reference to a concept from a previous chapter
- `selfCheckPrompt` is required (exactly 1)

### contentVariants.hard (Deeper / "Master")

**Purpose:** Reader can critically evaluate, synthesize across chapters, and identify limitations.
**Bloom's level:** Evaluate / Create
**Word count target:** 2000-2800 words total

```json
{
  "chapterBreakdown": {
    "gentle": "<4-5 paragraphs. Opens with a provocative analytical claim (not a neutral summary). Explores underlying psychology/research. Identifies at least 1 limitation, counterargument, or edge case. Draws explicit connections to at least 1 other chapter. Ends with synthesis of the chapter's contribution to the book's overall argument.>",
    "direct": "<Same structure, precise and analytical.>",
    "competitive": "<Same structure, intellectually challenging.>"
  },
  "keyTakeaways": [
    {
      "point": {
        "gentle": "<**Bold headline** + 3-4 sentences of explanation.>",
        "direct": "<Same concept, analytical.>",
        "competitive": "<Same concept, mastery-oriented.>"
      },
      "moreDetails": {
        "gentle": "<Critical analysis: when does this NOT work? OR cross-chapter connection. OR deeper research reference. OR 'what would change if...' thought experiment.>",
        "direct": "<Same expansion, analytical.>",
        "competitive": "<Same expansion, strategic edge framing.>"
      }
    }
  ],
  "selfCheckPrompts": [
    {
      "gentle": "<Elaborative interrogation: why does this work?>",
      "direct": "<Same question type, direct.>",
      "competitive": "<Same question type, challenging.>"
    },
    {
      "gentle": "<Critical evaluation: what's the strongest objection to this approach?>",
      "direct": "<Same question type, direct.>",
      "competitive": "<Same question type, steel-man framing.>"
    }
  ],
  "predictionPrompt": {
    "gentle": "<'Before you move on, predict what problem the next chapter will try to solve. Write it down mentally. When you start Chapter [N+1], check if you were right.'>",
    "direct": "<Same prediction prompt, direct.>",
    "competitive": "<Same prediction prompt, competitive.>"
  },
  "oneMinuteRecap": {
    "retrieve": {
      "gentle": "<More demanding: asks reader to recall AND explain reasoning.>",
      "direct": "<Same retrieval, analytical.>",
      "competitive": "<Same retrieval, competitive.>"
    },
    "connect": {
      "gentle": "<Links to TWO previous chapters or real-world contexts.>",
      "direct": "<Same dual connection, analytical.>",
      "competitive": "<Same dual connection, strategic.>"
    },
    "preview": {
      "gentle": "<More substantive teaser with a question that creates information-gap curiosity. For the LAST chapter: 'Full circle' reflection connecting back to Chapter 1.>",
      "direct": "<Same preview, direct.>",
      "competitive": "<Same preview, competitive.>"
    }
  }
}
```

**RULES:**
- 7-10 key takeaways, each with `point` and `moreDetails`
- `selfCheckPrompts` is an array of exactly 2 objects (not 1, not 3)
- `predictionPrompt` is required
- `oneMinuteRecap` uses retrieve/connect/preview
- For the LAST chapter, the preview should be a "Full circle" reflection connecting back to Chapter 1
- From Chapter 2 onward, `chapterBreakdown` must reference concepts from previous chapters

### examples (Scenarios)

Each chapter gets exactly 6 examples: 2 Work, 2 School, 2 Personal.

```json
{
  "exampleId": "ch01-ex01",
  "title": "<Descriptive title with character name>",
  "category": "work",
  "format": "decision_point",
  "contexts": ["work"],
  "scenario": {
    "gentle": "<80-150 words. The situation itself. Must include 3+ concrete specific details.>",
    "direct": "<Same situation, action-oriented framing.>",
    "competitive": "<Same situation, stakes-oriented framing.>"
  },
  "whatToDo": {
    "gentle": "<60-120 words. How to apply the chapter's concept. Uses 'try starting with...' language.>",
    "direct": "<Same advice, uses 'use [technique]' and 'the move here is...' language.>",
    "competitive": "<Same advice, uses 'the power move is...' and 'most people would [mistake], instead...' language.>"
  },
  "whyItMatters": {
    "gentle": "<50-100 words. Growth and understanding oriented. Unique ending.>",
    "direct": "<Same insight, results and efficiency oriented. Different ending.>",
    "competitive": "<Same insight, advantage and mastery oriented. Different ending.>"
  }
}
```

**THE 6 SCENARIO FORMATS (use each exactly once per chapter):**

1. **decision_point** — A moment where the character must choose between two plausible actions. "What to do" walks through applying the technique. "Why it matters" explains what's at stake and why the instinctive reaction would have been worse.

2. **postmortem** — Opens with "Here's what happened:" and describes a situation that already went wrong. The character didn't use the technique. "What to do" rewinds and shows how the concept would have changed the outcome. "Why it matters" identifies the general pattern that caused the failure.

3. **dialogue** — Written primarily as a realistic conversation (3-6 exchanges). Shows the technique in real-time. "What to do" breaks down what happened in the dialogue and why each move worked. "Why it matters" explains the conversational principle.

4. **predict_reveal** — Describes a situation building toward a critical moment. Pauses with: "What would you expect to happen next?" Then reveals the surprising/counterintuitive outcome. "What to do" explains why using the chapter's framework. "Why it matters" connects to a broader insight.

5. **dilemma** — A situation where the technique helps but doesn't fully resolve the tension. Reasonable people would handle it differently. "What to do" presents the technique AND acknowledges its limits. "Why it matters" explores genuine complexity.

6. **before_after** — Same character in two versions of the same situation: once without the technique (struggling), once with it (improved). "What to do" highlights the specific behavioral difference. "Why it matters" identifies what the character had to change internally.

**SCENARIO RULES:**
- Use diverse, realistic character names: Maya, Ethan, Priya, Marcus, Sofia, Kai, Nora, James, Leila, Andre, Yuki, Omar, Tessa, Davi, Aaliyah, Connor, Rosa, Kenji, Dante, Rina, Felix, Naomi, Tariq, Ivy, Mei, Zara, Liam, Amara, Samir, Elena, etc.
- NEVER use the same name more than twice in the entire book
- Every scenario must include 3+ concrete, specific details (names, dates, specific items, numbers)
- Every "Why it matters" ending must be unique across all 6 scenarios in the chapter AND across all chapters
- Cycle through ending types: broader principle, self-question, surprising implication, connection to different life area, warning about a trap, perspective reframe
- The `category` field must match `contexts[0]`: "work", "school", or "personal"
- `exampleId` format: `ch01-ex01` through `ch01-ex06`

### quiz

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
        "gentle": "<2-3 sentences: why correct answer is correct + why the most tempting wrong answer is wrong.>",
        "direct": "<Same explanation, analytical.>",
        "competitive": "<Same explanation, mastery framing.>"
      },
      "bloomsLevel": "remember",
      "depthLevel": "simple"
    }
  ]
}
```

**QUIZ RULES:**

Each chapter has exactly 10 questions in a single flat `questions` array. The `depthLevel` field on each question indicates which depth levels see it:
- Questions 1-5: `depthLevel: "simple"`, `bloomsLevel: "remember"` or `"understand"` — Direct recall and definition ("What did the chapter say?", "What does this concept mean?")
- Questions 6-7: `depthLevel: "standard"`, `bloomsLevel: "apply"` or `"analyze"` — Scenario-based application ("How would you use this?", "Why does this work?")
- Questions 8-10: `depthLevel: "deeper"`, `bloomsLevel: "evaluate"` or `"create"` — Critical analysis, edge cases, cross-chapter synthesis ("When would this fail?", "What's the deeper principle?")

**Question design:**
- Exactly 3 options per question (A, B, C), not 4
- Choices are prefixed with "A) ", "B) ", "C) "
- Wrong answers must be **plausible misunderstandings**, not obviously wrong
- Never use "all of the above" or "none of the above"
- Never make the correct answer consistently the longest or shortest
- Distribute correct answers roughly evenly: across all 10 questions, aim for about 3-4 correct A's, 3-4 correct B's, 3-4 correct C's (correctIndex 0, 1, 2)
- No absolute words ("always", "never") in correct answers unless genuinely absolute
- Each question tests a DIFFERENT concept
- `questionId` format: `ch01-q01` through `ch01-q10`
- `explanation` is a tone object with gentle/direct/competitive, NOT a plain string

---

## TONE IMPLEMENTATION GUIDE

Tone must change **substance**, not just adjectives. Competitive isn't Direct with "powerful" added. Gentle isn't Direct with "please" inserted.

| Section | Gentle | Direct | Competitive |
|---------|--------|--------|-------------|
| Breakdown opening | Invitational, curious: "Here's the heart of what [author] is saying..." | States the core claim immediately: "The core technique: [X]. Here's how it works." | Opens with what most people get wrong: "Most people approach [X] by doing [Y]. They lose." |
| Key takeaway language | "You might find that..." | "The technique is..." | "The advantage here is..." |
| Scenario framing | Characters learn and grow | Characters face and solve problems | Characters outperform and gain edges |
| Why it matters | Growth and understanding oriented | Results and efficiency oriented | Advantage and mastery oriented |
| oneMinuteRecap | "Take a moment to reflect..." | "Key action: [X]" | "Here's your edge for the week..." |
| selfCheckPrompt | "Ask yourself..." (exploratory) | "Explain the mechanism..." (analytical) | "Construct a scenario..." (challenging) |

---

## CROSS-CHAPTER CONTINUITY

### Chapter connections (REQUIRED from Chapter 2 onward)
Every Standard and Deeper summary must include at least one explicit reference to a concept from a previous chapter. These references should feel natural, not forced.

### Progressive complexity
Scenarios should gradually increase in complexity through the book. Early chapters: straightforward single-concept applications. Later chapters: scenarios that combine multiple concepts from different chapters.

### Preview teasers
Every chapter's oneMinuteRecap (Standard and Deeper) must include a "Preview" that creates genuine curiosity about the next chapter. Reference a real concept that's coming, framed as a question or tension.

For the LAST chapter, the Preview should instead be a "Full circle" reflection that connects back to Chapter 1 and asks the reader to consider how their understanding has evolved.

---

## HOW TO PROCESS EACH BOOK

### Step 1: Read the input JSON carefully
Identify:
- The book's title, author, and subject matter
- How many chapters it has
- The existing chapter titles (preserve them)
- The core ideas and concepts in each chapter
- The existing `chapterId`, `number`, and metadata fields (preserve them)

### Step 2: Research/recall the book's actual content
For each chapter, identify:
- The core concept or technique taught
- Specific stories, case studies, or research the author references
- How this chapter connects to other chapters in the book
- What makes this chapter's idea distinct from generic advice on the topic

### Step 3: Write each chapter
For EVERY chapter, write:
1. All 3 depth levels (easy/medium/hard) with all 3 tones (gentle/direct/competitive) for each text field
2. All 6 scenarios using all 6 formats, in all 3 tones
3. All 10 quiz questions with 3-choice answers, tone-variant explanations, and bloom/depth metadata
4. The keyTakeawayCard in all 3 tones

### Step 4: Verify against the quality checklist (see below)

### Step 5: Output the complete JSON

---

## FIELD MAPPING: OLD SCHEMA → NEW SCHEMA

The input file uses the OLD schema. Here is what to expect and how to transform:

**OLD fields to DISCARD** (replaced by new structure):
- `contentVariants.easy.summaryBullets` → replaced by `chapterBreakdown` + `keyTakeaways`
- `contentVariants.easy.summaryBlocks` → replaced by `chapterBreakdown` + `keyTakeaways`
- `contentVariants.easy.importantSummary` → replaced by `chapterBreakdown`
- `contentVariants.easy.takeaways` → replaced by `keyTakeaways`
- `contentVariants.easy.practice` → replaced by `oneMinuteRecap`
- Same for `medium` and `hard` variants
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

## QUALITY CHECKLIST

Before outputting the final JSON, verify EVERY chapter against this:

- [ ] Easy has exactly 3 key takeaways (no `moreDetails`)
- [ ] Standard has 5-7 key takeaways, each with BOTH `point` and `moreDetails`
- [ ] Deeper has 7-10 key takeaways, each with BOTH `point` and `moreDetails`
- [ ] No closing phrase is repeated anywhere in the chapter
- [ ] No closing phrase is repeated from any other chapter in the book
- [ ] All 6 scenario formats are used exactly once per chapter
- [ ] Character names are diverse and not repeated more than twice in the entire book
- [ ] Every scenario has 3+ specific concrete details
- [ ] Quiz has exactly 10 questions total in a single flat `questions` array
- [ ] Questions 1-5 have `depthLevel: "simple"` and `bloomsLevel` of "remember" or "understand"
- [ ] Questions 6-7 have `depthLevel: "standard"` and `bloomsLevel` of "apply" or "analyze"
- [ ] Questions 8-10 have `depthLevel: "deeper"` and `bloomsLevel` of "evaluate" or "create"
- [ ] All quiz questions have exactly 3 answer options prefixed with "A) ", "B) ", "C) "
- [ ] Correct answers (correctIndex values 0, 1, 2) are distributed roughly evenly across all 10 questions
- [ ] Every quiz question has an `explanation` field that is a `{gentle, direct, competitive}` object, NOT a string
- [ ] No AI-tell phrases appear anywhere in the content
- [ ] No em dashes (—) or en dashes (–) appear anywhere in the content
- [ ] Sentence structure varies: no 3+ consecutive sentences with the same opening pattern
- [ ] Cross-chapter references exist in Standard and Deeper (from Chapter 2 onward)
- [ ] Standard has `selfCheckPrompt` (singular, 1 object)
- [ ] Deeper has `selfCheckPrompts` (plural, array of 2 objects) AND `predictionPrompt`
- [ ] Standard and Deeper oneMinuteRecap use retrieve/connect/preview structure
- [ ] Easy oneMinuteRecap is a simple `{gentle, direct, competitive}` object (NOT retrieve/connect/preview)
- [ ] Deeper includes a predictionPrompt
- [ ] Tone genuinely changes substance, not just adjectives
- [ ] Each depth level targets the correct Bloom's taxonomy level
- [ ] Last chapter's preview is a "Full circle" reflection connecting to Chapter 1
- [ ] `keyTakeawayCard` exists at the chapter level with all 3 tones
- [ ] `category` and `format` fields exist on every example
- [ ] `contexts` array on each example matches the `category` field (e.g., `category: "work"` → `contexts: ["work"]`)

---

## COMPLETE EXAMPLE: ONE CHAPTER

Here is a complete example of one chapter in the correct output format, demonstrating every field, nesting level, and tone variant. Use this as your structural template for every chapter you write.

```json
{
  "chapterId": "ch01-example-chapter",
  "number": 1,
  "title": "The Original Chapter Title From the Book",
  "readingTimeMinutes": 11,
  "contentVariants": {
    "easy": {
      "chapterBreakdown": {
        "gentle": "First paragraph introducing the core idea in warm, inviting language. Uses a concrete analogy to make the concept accessible. Explains what the author is really getting at in terms anyone can understand.\n\nSecond paragraph explaining why this matters in everyday life. Connects the abstract concept to situations the reader actually encounters. Ends with a clear image of what applying this idea looks like in practice.",
        "direct": "First paragraph stating the core concept efficiently. Names the technique and explains its mechanism in clear terms.\n\nSecond paragraph connecting to practical application. Shows where and when this applies in real life with concrete examples.",
        "competitive": "First paragraph opening with what most people get wrong about this topic. Establishes the gap between common approach and effective approach.\n\nSecond paragraph showing the payoff for those who get it right. Frames the concept as an advantage most people miss."
      },
      "keyTakeaways": [
        {
          "point": {
            "gentle": "A sharp, memorable statement about the first key idea. One to two sentences that the reader would underline.",
            "direct": "The same insight delivered with technical precision. Clear and actionable.",
            "competitive": "The same insight framed as a competitive edge. What this gives you that others miss."
          }
        },
        {
          "point": {
            "gentle": "Second key takeaway, warm framing.",
            "direct": "Second key takeaway, direct framing.",
            "competitive": "Second key takeaway, competitive framing."
          }
        },
        {
          "point": {
            "gentle": "Third key takeaway, warm framing.",
            "direct": "Third key takeaway, direct framing.",
            "competitive": "Third key takeaway, competitive framing."
          }
        }
      ],
      "oneMinuteRecap": {
        "gentle": "This week, try [specific action]. Notice what changes when you [observable outcome].",
        "direct": "Next time you [situation], apply [technique] by [specific steps]. Track the result.",
        "competitive": "Pick one [situation] this week and deliberately [action]. See how much more ground you cover compared to your default approach."
      }
    },
    "medium": {
      "chapterBreakdown": {
        "gentle": "Opening paragraph with the chapter's core tension or counterintuitive claim, framed warmly.\n\nSecond paragraph explaining the reasoning and evidence behind the concept. References a specific story, study, or case from the book.\n\nThird paragraph connecting the ideas within the chapter, showing how they reinforce each other.\n\nFourth paragraph bringing it into the reader's life, showing how to start noticing and applying this.",
        "direct": "Opening paragraph stating the core claim directly.\n\nSecond paragraph with evidence and mechanism.\n\nThird paragraph with intra-chapter connections.\n\nFourth paragraph with practical application.",
        "competitive": "Opening paragraph challenging conventional wisdom.\n\nSecond paragraph with evidence for why the common approach fails.\n\nThird paragraph showing how the concepts compound.\n\nFourth paragraph defining the competitive edge this gives you."
      },
      "keyTakeaways": [
        {
          "point": {
            "gentle": "**Bold Headline Phrase.** Two to three sentences expanding on the concept. Explains what this means and why a reader should care.",
            "direct": "**Bold Headline Phrase.** Mechanism and application in 2-3 sentences.",
            "competitive": "**Bold Headline Phrase.** What this gives you and why most people miss it, in 2-3 sentences."
          },
          "moreDetails": {
            "gentle": "Three to five sentences providing a worked example of this concept in action. Shows what it looks like when someone applies this well, and what commonly goes wrong when they don't.",
            "direct": "Three to five sentences with a concrete example. Identifies the specific behavioral difference that produces the better outcome.",
            "competitive": "Three to five sentences showing the gap between average and excellent execution. Connects to specific advantages this creates."
          }
        },
        {
          "point": { "gentle": "...", "direct": "...", "competitive": "..." },
          "moreDetails": { "gentle": "...", "direct": "...", "competitive": "..." }
        },
        {
          "point": { "gentle": "...", "direct": "...", "competitive": "..." },
          "moreDetails": { "gentle": "...", "direct": "...", "competitive": "..." }
        },
        {
          "point": { "gentle": "...", "direct": "...", "competitive": "..." },
          "moreDetails": { "gentle": "...", "direct": "...", "competitive": "..." }
        },
        {
          "point": { "gentle": "...", "direct": "...", "competitive": "..." },
          "moreDetails": { "gentle": "...", "direct": "...", "competitive": "..." }
        },
        {
          "point": { "gentle": "...", "direct": "...", "competitive": "..." },
          "moreDetails": { "gentle": "...", "direct": "...", "competitive": "..." }
        }
      ],
      "selfCheckPrompt": {
        "gentle": "Ask yourself: why does [specific concept from this chapter] work better than the intuitive approach? What's the underlying mechanism?",
        "direct": "Ask yourself: what specific mechanism explains why [technique] outperforms [common alternative]? Can you trace the causal chain?",
        "competitive": "Ask yourself: if you had to teach [concept] to someone in 60 seconds, what's the one counterintuitive insight that would change how they act?"
      },
      "oneMinuteRecap": {
        "retrieve": {
          "gentle": "Without scrolling back up, what were the main techniques from this chapter? Try to recall at least two.",
          "direct": "Without looking back, name the core concepts and their mechanisms.",
          "competitive": "Without checking, reconstruct the key argument of this chapter from memory. What were the main techniques and why do they work?"
        },
        "connect": {
          "gentle": "Think about a recent situation where you could have applied one of these ideas. What would you have done differently?",
          "direct": "Map one concept from this chapter to a real scenario from the last week of your life.",
          "competitive": "Identify one situation from the past month where not knowing this chapter's concepts cost you something, time, money, or a relationship."
        },
        "preview": {
          "gentle": "Coming up in the next chapter, the author introduces [teaser concept]. It builds on what you just learned in a surprising way.",
          "direct": "Next chapter covers [concept], which directly extends [this chapter's idea] into [new domain].",
          "competitive": "The next chapter gives you [technique], and it's the tool that makes [this chapter's concept] actually dangerous to use in [context]."
        }
      }
    },
    "hard": {
      "chapterBreakdown": {
        "gentle": "Opening paragraph with a provocative analytical claim, not a neutral summary. Invites the reader to look deeper.\n\nSecond paragraph exploring the underlying psychology or research behind the author's techniques.\n\nThird paragraph identifying at least one limitation, counterargument, or edge case where the advice might fail.\n\nFourth paragraph drawing explicit connections to at least one other chapter in the book.\n\nFifth paragraph synthesizing the chapter's contribution to the book's overall argument.",
        "direct": "Opening analytical claim.\n\nPsychological/research foundations.\n\nLimitations and edge cases.\n\nCross-chapter connections.\n\nSynthesis.",
        "competitive": "Opening with where most analyses stop.\n\nDeeper research layer.\n\nFailure modes most readers miss.\n\nCross-chapter strategic connections.\n\nSynthesis of competitive advantage."
      },
      "keyTakeaways": [
        {
          "point": {
            "gentle": "**Bold Headline.** Three to four sentences of explanation at the evaluate/create level.",
            "direct": "**Bold Headline.** Analytical explanation in 3-4 sentences.",
            "competitive": "**Bold Headline.** Strategic analysis in 3-4 sentences."
          },
          "moreDetails": {
            "gentle": "Critical analysis: when does this NOT work? Or a cross-chapter connection showing how this idea interacts with another chapter's concept.",
            "direct": "When this fails, what the research actually shows vs. what the author claims, or a thought experiment.",
            "competitive": "The edge case that separates good execution from great. Cross-chapter synthesis or a 'what would change if' scenario."
          }
        }
      ],
      "selfCheckPrompts": [
        {
          "gentle": "Why does [specific concept] work the way it does? What's happening psychologically when someone applies it?",
          "direct": "Explain the mechanism behind [concept]. What cognitive or behavioral process makes it effective?",
          "competitive": "Construct a specific scenario where [concept] would produce the opposite of its intended effect. What conditions create that reversal?"
        },
        {
          "gentle": "What's the strongest argument someone could make against [this chapter's approach]? Where might it genuinely fall short?",
          "direct": "What's the most compelling critique of [author]'s framework in this chapter? Under what conditions would an alternative approach outperform it?",
          "competitive": "Steel-man the opposing view: under what specific conditions does [alternative approach] outperform [author]'s method? Be precise."
        }
      ],
      "predictionPrompt": {
        "gentle": "Before you move on, now that you understand [this chapter's core idea], what problem do you think the next chapter will try to solve? Make a prediction and check it when you start reading.",
        "direct": "Before you move on, predict: what will be the core technique or concept in the next chapter? Base your prediction on what gaps remain after this chapter.",
        "competitive": "Before you move on, predict: what's the next skill you'd need to make [this chapter's concept] fully operational? That's likely what the next chapter covers. Write it down and check yourself."
      },
      "oneMinuteRecap": {
        "retrieve": {
          "gentle": "Without scrolling back, explain why [concept] works and what conditions are necessary for it to succeed. Can you recall the underlying research or reasoning?",
          "direct": "Without checking, reconstruct the full argument: what biases or mechanisms does [author] reference, and how do they connect to the practical technique?",
          "competitive": "Without looking back, synthesize the three key components of this chapter's argument. If you can't reconstruct the logical chain, you haven't mastered it yet."
        },
        "connect": {
          "gentle": "Think about two contexts in your life where this chapter's ideas apply. How does [concept from this chapter] interact with [concept from a previous chapter]?",
          "direct": "Map this chapter's framework to two separate domains. Then identify where it overlaps with [previous chapter concept] and where it diverges.",
          "competitive": "Identify two negotiations or decisions from your recent past. Apply this chapter's analysis to both, and identify how [previous chapter concept] would have changed your approach in each case."
        },
        "preview": {
          "gentle": "The next chapter introduces [concept]. Here's an interesting question to consider: [thought-provoking question that creates information-gap curiosity].",
          "direct": "Next chapter: [concept]. The key question it answers: [specific question]. Consider how it might extend or complicate what you just learned.",
          "competitive": "The next chapter gives you [concept], and it directly addresses the biggest weakness in what you learned here. The question is: [provocative question]."
        }
      }
    }
  },
  "examples": [
    {
      "exampleId": "ch01-ex01",
      "title": "Maya's Project Deadline Decision",
      "category": "work",
      "format": "decision_point",
      "contexts": ["work"],
      "scenario": {
        "gentle": "Maya has been working on the Q3 product roadmap for three weeks. Her manager, David, just scheduled a meeting for Friday at 2pm to review it with the VP of Product. The problem: her data analyst, Ravi, emailed this morning saying his competitive analysis section won't be ready until Monday. Maya has two options: present with incomplete data, or ask David to push the meeting. She knows David hates schedule changes, but the VP will notice missing analysis.",
        "direct": "Maya's Q3 product roadmap review is Friday at 2pm with the VP. Her analyst Ravi's competitive section won't land until Monday. Two paths: present incomplete, or ask her manager David to reschedule, knowing he resists schedule shifts and the VP will spot gaps.",
        "competitive": "Maya faces a fork most people handle badly. Her Q3 roadmap review is Friday at 2pm with the VP. Ravi's competitive analysis won't be ready until Monday. The instinctive move, present anyway and 'manage expectations', is exactly what gets people labeled as unprepared. But asking David to reschedule risks looking like she can't manage timelines."
      },
      "whatToDo": {
        "gentle": "Try starting with the chapter's core technique here. Rather than choosing between two bad options, Maya can reframe the conversation with David by [applying technique]. This shifts the dynamic from 'I have a problem' to 'Here's how we make this stronger.'",
        "direct": "Use [technique] directly. The move: approach David with [specific action]. Frame it as [specific framing]. This gives David the information he needs while positioning Maya as proactive rather than reactive.",
        "competitive": "The power move: instead of choosing between two losing options, Maya applies [technique] to create a third path. Most people would either wing it or ask to reschedule, both of which signal weakness. Instead, [specific action] signals control and foresight."
      },
      "whyItMatters": {
        "gentle": "When we feel trapped between two bad options, it's often because we haven't questioned the frame we've been given. This chapter's approach teaches us that reframing isn't manipulation; it's seeing the situation more clearly than the default reaction allows.",
        "direct": "Binary thinking in professional settings almost always signals that you've accepted someone else's frame. The technique breaks that pattern by generating a third option from the other party's actual concerns, not your assumptions about them.",
        "competitive": "The people who get promoted fastest aren't the ones who choose the best of two bad options. They're the ones who refuse the binary entirely. This skill, creating a third path from the other side's real concerns, is what separates strategic operators from reactive ones."
      }
    },
    {
      "exampleId": "ch01-ex02",
      "title": "Ethan's Missed Opportunity",
      "category": "work",
      "format": "postmortem",
      "contexts": ["work"],
      "scenario": {
        "gentle": "Here's what happened: Ethan had his annual performance review last Tuesday...",
        "direct": "Here's what happened: Ethan's annual review last Tuesday went sideways...",
        "competitive": "Here's what happened: Ethan walked into his Tuesday performance review thinking he had a strong case for a raise..."
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
    },
    {
      "exampleId": "ch01-ex03",
      "title": "Priya's Study Group Standoff",
      "category": "school",
      "format": "dialogue",
      "contexts": ["school"],
      "scenario": { "gentle": "...", "direct": "...", "competitive": "..." },
      "whatToDo": { "gentle": "...", "direct": "...", "competitive": "..." },
      "whyItMatters": { "gentle": "...", "direct": "...", "competitive": "..." }
    },
    {
      "exampleId": "ch01-ex04",
      "title": "Kai's Group Presentation Gamble",
      "category": "school",
      "format": "predict_reveal",
      "contexts": ["school"],
      "scenario": { "gentle": "...", "direct": "...", "competitive": "..." },
      "whatToDo": { "gentle": "...", "direct": "...", "competitive": "..." },
      "whyItMatters": { "gentle": "...", "direct": "...", "competitive": "..." }
    },
    {
      "exampleId": "ch01-ex05",
      "title": "Sofia's Roommate Dilemma",
      "category": "personal",
      "format": "dilemma",
      "contexts": ["personal"],
      "scenario": { "gentle": "...", "direct": "...", "competitive": "..." },
      "whatToDo": { "gentle": "...", "direct": "...", "competitive": "..." },
      "whyItMatters": { "gentle": "...", "direct": "...", "competitive": "..." }
    },
    {
      "exampleId": "ch01-ex06",
      "title": "Marcus's Apology, Before and After",
      "category": "personal",
      "format": "before_after",
      "contexts": ["personal"],
      "scenario": { "gentle": "...", "direct": "...", "competitive": "..." },
      "whatToDo": { "gentle": "...", "direct": "...", "competitive": "..." },
      "whyItMatters": { "gentle": "...", "direct": "...", "competitive": "..." }
    }
  ],
  "quiz": {
    "passingScorePercent": 80,
    "questions": [
      {
        "questionId": "ch01-q01",
        "prompt": "According to [author], what is the primary purpose of [concept]?",
        "choices": [
          "A) First plausible option",
          "B) Second plausible option (correct)",
          "C) Third plausible option"
        ],
        "correctIndex": 1,
        "explanation": {
          "gentle": "The correct answer is B because [reason from chapter]. Option A is tempting because [why it's a plausible misunderstanding], but it misses [key distinction].",
          "direct": "B is correct: [mechanism]. A represents a common misread where [specific misconception]. The distinction is [precise difference].",
          "competitive": "B. The trap is A, which is what someone who half-read the chapter would pick. The real distinction: [precise insight]."
        },
        "bloomsLevel": "remember",
        "depthLevel": "simple"
      },
      {
        "questionId": "ch01-q02",
        "prompt": "...",
        "choices": ["A) ...", "B) ...", "C) ..."],
        "correctIndex": 0,
        "explanation": { "gentle": "...", "direct": "...", "competitive": "..." },
        "bloomsLevel": "remember",
        "depthLevel": "simple"
      },
      {
        "questionId": "ch01-q03",
        "prompt": "...",
        "choices": ["A) ...", "B) ...", "C) ..."],
        "correctIndex": 2,
        "explanation": { "gentle": "...", "direct": "...", "competitive": "..." },
        "bloomsLevel": "understand",
        "depthLevel": "simple"
      },
      {
        "questionId": "ch01-q04",
        "prompt": "...",
        "choices": ["A) ...", "B) ...", "C) ..."],
        "correctIndex": 0,
        "explanation": { "gentle": "...", "direct": "...", "competitive": "..." },
        "bloomsLevel": "understand",
        "depthLevel": "simple"
      },
      {
        "questionId": "ch01-q05",
        "prompt": "...",
        "choices": ["A) ...", "B) ...", "C) ..."],
        "correctIndex": 1,
        "explanation": { "gentle": "...", "direct": "...", "competitive": "..." },
        "bloomsLevel": "understand",
        "depthLevel": "simple"
      },
      {
        "questionId": "ch01-q06",
        "prompt": "Your manager asks you to [scenario]. Based on the chapter's principles, what should you do first?",
        "choices": ["A) ...", "B) ...", "C) ..."],
        "correctIndex": 2,
        "explanation": { "gentle": "...", "direct": "...", "competitive": "..." },
        "bloomsLevel": "apply",
        "depthLevel": "standard"
      },
      {
        "questionId": "ch01-q07",
        "prompt": "...",
        "choices": ["A) ...", "B) ...", "C) ..."],
        "correctIndex": 0,
        "explanation": { "gentle": "...", "direct": "...", "competitive": "..." },
        "bloomsLevel": "analyze",
        "depthLevel": "standard"
      },
      {
        "questionId": "ch01-q08",
        "prompt": "A critic argues that [concept] is flawed because [objection]. Based on the chapter, what is the strongest counterargument?",
        "choices": ["A) ...", "B) ...", "C) ..."],
        "correctIndex": 1,
        "explanation": { "gentle": "...", "direct": "...", "competitive": "..." },
        "bloomsLevel": "evaluate",
        "depthLevel": "deeper"
      },
      {
        "questionId": "ch01-q09",
        "prompt": "In which of the following situations would [technique] most likely NOT work as described?",
        "choices": ["A) ...", "B) ...", "C) ..."],
        "correctIndex": 2,
        "explanation": { "gentle": "...", "direct": "...", "competitive": "..." },
        "bloomsLevel": "evaluate",
        "depthLevel": "deeper"
      },
      {
        "questionId": "ch01-q10",
        "prompt": "If [author]'s claim about [concept] is correct, what broader implication does this have for [related domain]?",
        "choices": ["A) ...", "B) ...", "C) ..."],
        "correctIndex": 1,
        "explanation": { "gentle": "...", "direct": "...", "competitive": "..." },
        "bloomsLevel": "create",
        "depthLevel": "deeper"
      }
    ]
  },
  "keyTakeawayCard": {
    "gentle": "One paragraph, 2-3 sentences. The single most important insight from this chapter, the thing a reader remembers a week later. Written as a standalone insight, not a summary of the summary.",
    "direct": "Same insight, direct and efficient. Crisp standalone statement.",
    "competitive": "Same insight, framed as the advantage or edge this chapter gives you."
  }
}
```

---

## FINAL REMINDERS

1. **Output COMPLETE valid JSON.** Do not truncate. Do not summarize. Do not skip chapters. Do not use placeholder text like "..." in the actual output. Every field must be fully populated with real content.

2. **Preserve metadata.** Keep `schemaVersion`, `packageId`, `createdAt`, `contentOwner`, `bookId`, `title`, `author`, `categories`, `tags`, `edition`, `variantFamily`, `chapterId`, and `number` from the input.

3. **Preserve original chapter titles.** Use the chapter titles from the actual published book, not the simplified titles from the input file.

4. **No em dashes or en dashes.** Use commas, semicolons, colons, or periods. Zero exceptions.

5. **Each chapter is a self-contained unit.** But cross-chapter references (in Standard and Deeper) should create a sense of the book building on itself.

6. **Process ONE book at a time.** Complete every chapter of the book before outputting. Do not output partial results.

7. **The content must feel written by a knowledgeable human.** If you don't know the book's actual content well enough, draw on what you do know and ensure the concepts are accurate. Never make up fake research studies or attribute quotes to the author that aren't from the book.

8. **Every quiz question prompt must be unique.** No two questions in the entire book should use the same phrasing template. Each question should read as if a thoughtful instructor wrote it specifically for that concept.
