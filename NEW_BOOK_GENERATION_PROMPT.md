# ChapterFlow: Generate a Complete New Book Package

## BOOK TO GENERATE

**Title:** [XXXXXXXX]
**Author:** [XXXXXXXX]

---

## INSTRUCTIONS FOR USE

You are generating a complete, production-ready book package for the ChapterFlow reading app. You must produce **THREE outputs** in sequence:

1. **OUTPUT 1:** The complete book content JSON file
2. **OUTPUT 2:** The SVG book cover file
3. **OUTPUT 3:** The exact code changes needed to wire the book into the app

Do not skip any output. Do not truncate. Every field must be populated with real, thoughtful content.

---

## YOUR ROLE

You are a world-class educational content designer, non-fiction editor, and front-end developer. You have deep knowledge of **[XXXXXXXX]** by **[XXXXXXXX]** and can accurately represent its core ideas, chapter structure, key stories, research, and practical advice.

Your job is to create a ChapterFlow learning experience that feels like a sharp, experienced mentor explaining ideas, not a textbook, not a corporate training manual, not a generic AI summary. The target audience is students (university/college age), early-career professionals, and casual self-improvement readers.

---

## CONTEXT: WHAT IS CHAPTERFLOW?

ChapterFlow is a guided reading web app for non-fiction books. Each chapter follows a 4-step learning loop:

1. **Summary** — The reader absorbs the chapter content at their chosen depth level
2. **Scenarios** — Real-world situations that apply the chapter's ideas
3. **Quiz** — Multiple-choice questions the reader must pass to unlock the next chapter
4. **Unlock** — Progress to the next chapter

During onboarding, users select a **tone preference**: Gentle, Direct, or Competitive. The content must be written in all three tones for every piece of text. Users also read at one of three **depth levels**: Simple (easy), Standard (medium), or Deeper (hard).

---

## CRITICAL ANTI-PATTERNS: NEVER DO THESE

### 1. NEVER repeat the same closing phrase across scenarios or sections
If you use a closing phrase once in the entire book, never use it again. Every "Why it matters" section must end differently.

### 2. NEVER use identical sentence structures across consecutive items
If key point 1 starts with "The chapter presents...", key point 2 must NOT start with "The chapter shows..." or "The chapter explains...". Vary sentence openings aggressively.

### 3. NEVER let depth levels differ only by word count
Simple, Standard, and Deeper must differ in **cognitive demand**, not just length.

### 4. NEVER use these AI-tell phrases
Ban entirely: "delve", "crucial", "landscape", "realm", "It's worth noting", "In today's world", "It's important to remember", "This highlights the importance of", "Furthermore", "Moreover", "In conclusion", "plays a pivotal role", "at its core", "the art of", "navigating", "harnessing", "game-changer", "paradigm shift", "robust", "synergy", "leverage" (verb meaning "use"), "facilitate", "utilize", "foster", "embark on", "a testament to", "shed light on", "This matters because", "This is significant because", "it is essential to". Use plain, direct English.

### 5. NEVER make all scenarios follow the same pattern
Each of the 6 scenarios per chapter must use a DIFFERENT narrative structure. No two consecutive scenarios should feel structurally similar.

### 6. NEVER write "Why it matters" sections that all sound the same
Each must be unique in structure, insight, and framing.

### 7. NEVER have key points that repeat each other
If two points say essentially the same thing, consolidate. Quality over quantity.

### 8. NEVER use em dashes or en dashes
Do NOT use `—` or `–` anywhere. Use commas, semicolons, colons, or restructure the sentence. Zero exceptions.

---

## OUTPUT 1: THE BOOK CONTENT JSON

### Step 1: Determine the Book Structure

Before writing content, determine:
1. How many chapters does the actual published book have? Use the real chapter structure.
2. What are the actual chapter titles from the published book? Use the real titles.
3. What is the core concept/technique taught in each chapter?
4. What specific stories, case studies, experiments, or research does the author reference in each chapter?
5. How do the chapters build on each other?

### Step 2: Generate Identifiers

- **bookId:** Convert the book title to kebab-case. Example: "Atomic Habits" → `atomic-habits`, "The 7 Habits of Highly Effective People" → `the-7-habits-of-highly-effective-people`
- **packageId:** Generate a valid UUID v4 (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
- **chapterId:** Format as `ch{NN}-{kebab-case-of-chapter-title}` where NN is zero-padded. Example: Chapter 1 "The Power of Habits" → `ch01-the-power-of-habits`

### Step 3: Write the Complete JSON

The file must be named `{bookId}.modern.json` and placed in `book-packages/`.

#### Root Structure

```json
{
  "schemaVersion": "1.1.0",
  "packageId": "<generated UUID v4>",
  "createdAt": "<current ISO-8601 date, e.g. 2026-03-22T00:00:00Z>",
  "contentOwner": "Will Soltani",
  "book": {
    "bookId": "<kebab-case-book-title>",
    "title": "[XXXXXXXX]",
    "author": "[XXXXXXXX]",
    "categories": ["<primary category>", "<secondary category>", "<optional third>"],
    "tags": ["<tag1>", "<tag2>", "<tag3>", "<tag4>", "<tag5>"],
    "edition": {
      "name": "10 Chapter Structure Student Interpretation",
      "publishedYear": 2026
    },
    "variantFamily": "EMH"
  },
  "chapters": [ ... ]
}
```

**Categories:** Choose from existing categories used in the app: "Negotiation", "Communication", "Decision Making", "Productivity", "Psychology", "Leadership", "Strategy", "Self-Improvement", "Business", "Finance", "Philosophy", "Creativity", "Relationships", "Health", "Learning". Use 2-3 that best fit.

**Tags:** 5 lowercase keywords that describe the book's themes. Example for Atomic Habits: `["habits", "behavior change", "systems", "identity", "compound growth"]`

#### Chapter Structure

Each chapter object:

```json
{
  "chapterId": "ch01-kebab-case-title",
  "number": 1,
  "title": "<actual chapter title from the published book>",
  "readingTimeMinutes": <calculate: standard summary words / 200 + 3 + 2, rounded>,
  "contentVariants": {
    "easy": { ... },
    "medium": { ... },
    "hard": { ... }
  },
  "examples": [ ... ],
  "quiz": { ... },
  "keyTakeawayCard": {
    "gentle": "<1 paragraph, 2-3 sentences. The single most important insight from this chapter.>",
    "direct": "<same insight, direct tone>",
    "competitive": "<same insight, competitive tone>"
  }
}
```

---

### CONTENT VARIANTS: THE THREE DEPTH LEVELS

#### contentVariants.easy (Simple / "Skim")

**Purpose:** Reader can explain the chapter's main idea to a friend in 2 minutes.
**Bloom's level:** Remember / Understand
**Word count:** 400-600 words total

```json
{
  "chapterBreakdown": {
    "gentle": "<2 paragraphs separated by \\n\\n. P1: What is the core idea? P2: Why does it matter in everyday life? Include one concrete analogy or image. Warm, inviting tone: 'Here's the heart of what [author] is saying...'>",
    "direct": "<Same 2 paragraphs. Clean, efficient: 'The core technique: [X]. Here's how it works.'>",
    "competitive": "<Same 2 paragraphs. Punchy, challenging: 'Most people get this wrong. Here's what actually works.'>"
  },
  "keyTakeaways": [
    {
      "point": {
        "gentle": "<1-2 sentences. Sharp, memorable, underline-worthy.>",
        "direct": "<Same idea, direct delivery.>",
        "competitive": "<Same idea, competitive edge framing.>"
      }
    },
    { "point": { "gentle": "...", "direct": "...", "competitive": "..." } },
    { "point": { "gentle": "...", "direct": "...", "competitive": "..." } }
  ],
  "oneMinuteRecap": {
    "gentle": "<Single 'Try this next' action item. 1 sentence. Specific, immediately actionable. Different from every other chapter.>",
    "direct": "<Same action, direct framing.>",
    "competitive": "<Same action, challenge framing.>"
  }
}
```

**Rules:** Exactly 3 key takeaways. No `moreDetails`. `oneMinuteRecap` is a flat tone object (NOT retrieve/connect/preview).

#### contentVariants.medium (Standard / "Study")

**Purpose:** Reader understands how and why each concept works and can start applying.
**Bloom's level:** Apply / Analyze
**Word count:** 1000-1500 words total

```json
{
  "chapterBreakdown": {
    "gentle": "<3-4 paragraphs separated by \\n\\n. Opens with core tension or counterintuitive claim. Explains reasoning/evidence. Uses at least 1 specific example from the book (a story the author tells, a case study, an experiment). Connects ideas within the chapter. From Ch2 onward: includes at least 1 explicit reference to a previous chapter's concept.>",
    "direct": "<Same structure, analytical tone.>",
    "competitive": "<Same structure, opens with what most people get wrong.>"
  },
  "keyTakeaways": [
    {
      "point": {
        "gentle": "<**Bold headline phrase.** 2-3 sentences of explanation.>",
        "direct": "<**Bold headline.** 2-3 sentences, analytical.>",
        "competitive": "<**Bold headline.** 2-3 sentences, competitive framing.>"
      },
      "moreDetails": {
        "gentle": "<3-5 sentences: a worked example showing the concept in action, OR a common mistake people make, OR a connection to another chapter's idea.>",
        "direct": "<Same expansion, analytical.>",
        "competitive": "<Same expansion, advantage/mastery framing.>"
      }
    }
  ],
  "selfCheckPrompt": {
    "gentle": "<'Ask yourself: [question about why this works]'>",
    "direct": "<Same type of question, direct.>",
    "competitive": "<Same type of question, challenging.>"
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
      "gentle": "<1-2 sentences creating genuine curiosity about the next chapter without spoiling.>",
      "direct": "<Same teaser, direct.>",
      "competitive": "<Same teaser, competitive.>"
    }
  }
}
```

**Rules:** 5-7 key takeaways, each with BOTH `point` AND `moreDetails`. Headlines use `**bold**` markdown. `selfCheckPrompt` is singular (1 object). `oneMinuteRecap` uses retrieve/connect/preview structure.

#### contentVariants.hard (Deeper / "Master")

**Purpose:** Reader can critically evaluate, synthesize across chapters, identify limitations.
**Bloom's level:** Evaluate / Create
**Word count:** 2000-2800 words total

```json
{
  "chapterBreakdown": {
    "gentle": "<4-5 paragraphs. Opens with a provocative analytical claim (not neutral summary). Explores underlying psychology/research. Identifies at least 1 limitation, counterargument, or edge case. Draws explicit connections to at least 1 other chapter. Ends with synthesis of this chapter's contribution to the book's overall argument.>",
    "direct": "<Same structure, precise and analytical.>",
    "competitive": "<Same structure, intellectually challenging: 'Here's where most analyses stop. Let's go further.'>"
  },
  "keyTakeaways": [
    {
      "point": {
        "gentle": "<**Bold headline.** 3-4 sentences of explanation.>",
        "direct": "<**Bold headline.** 3-4 sentences, analytical.>",
        "competitive": "<**Bold headline.** 3-4 sentences, mastery-oriented.>"
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
      "direct": "<Same, direct.>",
      "competitive": "<Same, challenging.>"
    },
    {
      "gentle": "<Critical evaluation: what's the strongest objection to this approach?>",
      "direct": "<Same, direct.>",
      "competitive": "<Same, steel-man framing.>"
    }
  ],
  "predictionPrompt": {
    "gentle": "<'Before you move on, predict what problem the next chapter will try to solve...'>",
    "direct": "<Same prediction, direct.>",
    "competitive": "<Same prediction, competitive.>"
  },
  "oneMinuteRecap": {
    "retrieve": {
      "gentle": "<More demanding: recall AND explain reasoning.>",
      "direct": "<Same, analytical.>",
      "competitive": "<Same, competitive.>"
    },
    "connect": {
      "gentle": "<Links to TWO previous chapters or real-world contexts.>",
      "direct": "<Same, analytical.>",
      "competitive": "<Same, strategic.>"
    },
    "preview": {
      "gentle": "<More substantive teaser with information-gap curiosity question. For LAST chapter: 'Full circle' reflection connecting back to Chapter 1.>",
      "direct": "<Same, direct.>",
      "competitive": "<Same, competitive.>"
    }
  }
}
```

**Rules:** 7-10 key takeaways with `point` + `moreDetails`. `selfCheckPrompts` is an ARRAY of exactly 2 objects. `predictionPrompt` is required. For the LAST chapter, the preview is a "Full circle" reflection.

---

### EXAMPLES (SCENARIOS): 6 PER CHAPTER

Each chapter gets exactly 6 examples: 2 Work, 2 School, 2 Personal.

```json
{
  "exampleId": "ch01-ex01",
  "title": "<Descriptive title with character name>",
  "category": "work",
  "format": "decision_point",
  "contexts": ["work"],
  "scenario": {
    "gentle": "<80-150 words. The situation. 3+ concrete specific details (names, dates, specific items).>",
    "direct": "<Same situation, action-oriented.>",
    "competitive": "<Same situation, stakes-oriented.>"
  },
  "whatToDo": {
    "gentle": "<60-120 words. How to apply the concept. Uses 'try starting with...' language.>",
    "direct": "<Same advice. Uses 'use [technique]' and 'the move here is...' language.>",
    "competitive": "<Same advice. Uses 'the power move is...' and 'most people would [mistake], instead...' language.>"
  },
  "whyItMatters": {
    "gentle": "<50-100 words. Growth/understanding oriented. Unique ending.>",
    "direct": "<Results/efficiency oriented. Different ending.>",
    "competitive": "<Advantage/mastery oriented. Different ending.>"
  }
}
```

#### THE 6 SCENARIO FORMATS (use each exactly once per chapter)

1. **decision_point** — Character must choose between two plausible actions. Show the fork. "What to do" applies the technique. "Why it matters" explains what's at stake and why instinct would have been worse.

2. **postmortem** — Opens with "Here's what happened:" A situation that already went wrong because the technique wasn't used. "What to do" rewinds and shows the better path. "Why it matters" identifies the general pattern behind the failure.

3. **dialogue** — Written primarily as realistic conversation (3-6 exchanges). Shows the technique in real-time dialogue. "What to do" breaks down why each conversational move worked. "Why it matters" explains the conversational principle.

4. **predict_reveal** — Situation builds to a critical moment. Pauses with "What would you expect to happen next?" Then reveals a surprising/counterintuitive outcome. "What to do" explains using the chapter's framework. "Why it matters" connects to broader human behavior insight.

5. **dilemma** — The technique helps but doesn't fully resolve the tension. Reasonable people would handle it differently. "What to do" presents the technique AND acknowledges its limits. "Why it matters" explores genuine complexity.

6. **before_after** — Same character in two versions: once without the technique (struggling), once with it (improved). "What to do" highlights the specific behavioral difference. "Why it matters" identifies the internal shift, not just external.

#### SCENARIO RULES

- **Character names:** Use diverse, realistic names. Never use the same name more than twice in the entire book. Rotate through: Maya, Ethan, Priya, Marcus, Sofia, Kai, Nora, James, Leila, Andre, Yuki, Omar, Tessa, Davi, Aaliyah, Connor, Rosa, Kenji, Dante, Rina, Felix, Naomi, Tariq, Ivy, Mei, Zara, Liam, Amara, Samir, Elena, Hana, Derek, Celia, Riku, Asha, etc.
- **Specificity:** 3+ concrete details per scenario (names, dates, amounts, specific objects, locations)
- **Unique endings:** Every "Why it matters" ending must be different. Cycle through: broader principle, self-question, surprising implication, connection to different life area, warning about common trap, perspective reframe. Never repeat the same ending type in consecutive scenarios.
- **`category` must match `contexts[0]`**
- **`exampleId` format:** `ch01-ex01` through `ch01-ex06`
- **Do NOT use formats in the same category slot across consecutive chapters.** If Ch1's first work scenario is `decision_point`, Ch2's first work scenario should NOT be `decision_point`.

---

### QUIZ: 10 QUESTIONS PER CHAPTER

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
        "gentle": "<2-3 sentences: why correct is correct + why the most tempting wrong answer is wrong.>",
        "direct": "<Same, analytical.>",
        "competitive": "<Same, mastery framing.>"
      },
      "bloomsLevel": "remember",
      "depthLevel": "simple"
    }
  ]
}
```

#### Question Level Distribution

| Questions | depthLevel | bloomsLevel | What it tests |
|-----------|-----------|-------------|---------------|
| q01-q05 | `"simple"` | `"remember"` or `"understand"` | "What did the chapter say?" / "What does this concept mean?" |
| q06-q07 | `"standard"` | `"apply"` or `"analyze"` | Short scenario-based: "How would you use this?" / "Why does this work?" |
| q08-q10 | `"deeper"` | `"evaluate"` or `"create"` | Critical analysis, edge cases, cross-chapter: "When would this fail?" / "What's the deeper principle?" |

#### Quiz Rules

- Exactly 3 options per question, prefixed with "A) ", "B) ", "C) "
- Wrong answers must be **plausible misunderstandings**, not obviously wrong
- Distribute `correctIndex` roughly evenly across 0, 1, 2 (about 3-4 of each per chapter)
- Never use "all of the above" or "none of the above"
- Never make the correct answer consistently longest or shortest
- No absolute words in correct answers unless genuinely absolute
- Each question tests a DIFFERENT concept
- Every `explanation` is a `{gentle, direct, competitive}` object, NOT a string
- `questionId` format: `ch01-q01` through `ch01-q10`
- Every question prompt must be unique across the entire book

---

### TONE IMPLEMENTATION

Tone changes **substance**, not just adjectives.

| Section | Gentle | Direct | Competitive |
|---------|--------|--------|-------------|
| Breakdown opening | Invitational, curious | States core claim immediately | Opens with what most people get wrong |
| Key takeaway language | "You might find that..." | "The technique is..." | "The advantage here is..." |
| Scenario framing | Characters learn and grow | Characters face and solve problems | Characters outperform and gain edges |
| Why it matters | Growth/understanding | Results/efficiency | Advantage/mastery |
| Recap | "Take a moment to reflect..." | "Key action: [X]" | "Here's your edge..." |
| Self-check | "Ask yourself..." (exploratory) | "Explain the mechanism..." (analytical) | "Construct a scenario..." (challenging) |

---

### CROSS-CHAPTER CONTINUITY

1. **From Chapter 2 onward:** Every Standard and Deeper summary must explicitly reference a concept from a previous chapter.
2. **Progressive complexity:** Early chapters have straightforward single-concept scenarios. Later chapters combine multiple concepts from different chapters.
3. **Preview teasers:** Every Standard/Deeper oneMinuteRecap preview creates genuine curiosity about the next chapter using a real concept from that chapter.
4. **Last chapter:** Preview becomes a "Full circle" reflection connecting back to Chapter 1.

---

### QUALITY CHECKLIST FOR JSON

Before outputting, verify EVERY chapter:

- [ ] Easy has exactly 3 key takeaways (no moreDetails)
- [ ] Standard has 5-7 key takeaways, each with point AND moreDetails
- [ ] Deeper has 7-10 key takeaways, each with point AND moreDetails
- [ ] No closing phrase repeated anywhere in the chapter or across chapters
- [ ] All 6 scenario formats used exactly once per chapter
- [ ] Character names diverse, none used more than twice in entire book
- [ ] Every scenario has 3+ specific concrete details
- [ ] Quiz has exactly 10 questions in a single flat `questions` array
- [ ] Questions 1-5: depthLevel "simple", bloomsLevel "remember"/"understand"
- [ ] Questions 6-7: depthLevel "standard", bloomsLevel "apply"/"analyze"
- [ ] Questions 8-10: depthLevel "deeper", bloomsLevel "evaluate"/"create"
- [ ] All quiz choices prefixed with "A) ", "B) ", "C) " (exactly 3 options)
- [ ] correctIndex values distributed roughly evenly across 0, 1, 2
- [ ] Every explanation is `{gentle, direct, competitive}`, NOT a string
- [ ] No AI-tell phrases anywhere
- [ ] No em dashes (—) or en dashes (–) anywhere
- [ ] Sentence structure varies across consecutive items
- [ ] Cross-chapter references in Standard and Deeper from Ch2 onward
- [ ] Standard has selfCheckPrompt (singular, 1 object)
- [ ] Deeper has selfCheckPrompts (plural, array of 2) AND predictionPrompt
- [ ] Standard/Deeper oneMinuteRecap uses retrieve/connect/preview
- [ ] Easy oneMinuteRecap is flat {gentle, direct, competitive} (NOT retrieve/connect/preview)
- [ ] Last chapter preview is "Full circle" connecting to Chapter 1
- [ ] keyTakeawayCard exists at chapter level with all 3 tones
- [ ] category and format fields on every example
- [ ] contexts array matches category on each example

---

## OUTPUT 2: THE SVG BOOK COVER

Generate an SVG file at exactly `1200x1800` pixels. Follow this exact template structure, customizing colors and the decorative motif to match the book's theme:

```svg
<svg width="1200" height="1800" viewBox="0 0 1200 1800" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">[BOOK TITLE] cover</title>
  <desc id="desc">Auto-generated themed cover for [BOOK TITLE] by [AUTHOR].</desc>
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1800" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="[DARK_PRIMARY]"/>
      <stop offset="100%" stop-color="[MEDIUM_PRIMARY]"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="1800" fill="url(#bgGrad)"/>

  <!-- Decorative background shapes (theme-appropriate, subtle) -->
  [2-4 SUBTLE BACKGROUND SHAPES: circles, ellipses, or rects with low opacity 0.08-0.16]

  <!-- Central illustration card -->
  <rect x="116" y="304" width="968" height="1036" rx="38" fill="[LIGHT_BG]" stroke="[LIGHT_ACCENT]" stroke-width="10"/>

  <!-- Shadow illustration (offset behind, lower opacity) -->
  <g opacity="0.24" transform="translate(0 -26)">
    <g transform="translate([X] [Y])">
      [DECORATIVE MOTIF matching book theme - simple geometric shapes only]
    </g>
  </g>

  <!-- Main illustration (foreground) -->
  <g transform="translate([X+13] [Y+18])">
    [SAME MOTIF with different accent colors, slightly shifted position]
  </g>

  <!-- Badge/emblem in top-right of card -->
  <g transform="translate(930 336)">
    [SMALL BADGE: shield, circle, or rounded rect with 2-letter book initials]
  </g>

  <!-- Author bar (top) -->
  <rect x="0" y="0" width="1200" height="238" fill="[DARK_PRIMARY]" opacity="0.93"/>
  <text x="600" y="136" text-anchor="middle" fill="[TEXT_LIGHT]" font-family="Georgia, serif" font-size="62" font-weight="700" letter-spacing="3">[AUTHOR NAME UPPERCASE]</text>
  <text x="600" y="208" text-anchor="middle" fill="[TEXT_LIGHT]" font-family="'Trebuchet MS', Arial, sans-serif" font-size="30" letter-spacing="4">[PRIMARY CATEGORY UPPERCASE]</text>

  <!-- Title (on the card) -->
  <text x="600" y="1216" text-anchor="middle" fill="[TEXT_DARK]" font-family="'Trebuchet MS', Arial, sans-serif" font-size="[78-92 depending on title length]" font-weight="700" letter-spacing="2">[BOOK TITLE UPPERCASE]</text>

  <!-- Footer bar (bottom) -->
  <rect x="0" y="1454" width="1200" height="346" fill="[MEDIUM_PRIMARY]" opacity="0.95"/>

  <!-- Tag pills -->
  <g>
    <rect x="[X]" y="1466" width="[W]" height="42" rx="21" fill="[TEXT_LIGHT]" opacity="0.18" stroke="[TEXT_LIGHT]" stroke-width="2"/>
    <text x="[CENTER]" y="1494" text-anchor="middle" fill="[TEXT_LIGHT]" font-family="'Trebuchet MS', Arial, sans-serif" font-size="20" letter-spacing="1">[TAG1 UPPERCASE]</text>
  </g>
  <g>
    <rect x="[X]" y="1466" width="[W]" height="42" rx="21" fill="[TEXT_LIGHT]" opacity="0.18" stroke="[TEXT_LIGHT]" stroke-width="2"/>
    <text x="[CENTER]" y="1494" text-anchor="middle" fill="[TEXT_LIGHT]" font-family="'Trebuchet MS', Arial, sans-serif" font-size="20" letter-spacing="1">[TAG2 UPPERCASE]</text>
  </g>

  <!-- Tags line -->
  <text x="600" y="1538" text-anchor="middle" fill="[TEXT_LIGHT]" font-family="'Trebuchet MS', Arial, sans-serif" font-size="30" letter-spacing="3">[TAG1]  ·  [TAG2]  ·  [TAG3]</text>

  <!-- Tagline -->
  <text x="600" y="1604" text-anchor="middle" fill="[TEXT_LIGHT]" font-family="Georgia, serif" font-size="30">[One-line book tagline/motto]</text>

  <!-- Edition line -->
  <text x="600" y="1668" text-anchor="middle" fill="[TEXT_LIGHT]" font-family="'Trebuchet MS', Arial, sans-serif" font-size="26" letter-spacing="2">Modern Edition · Practical Lessons · Real Scenarios</text>
</svg>
```

#### Color Palette Rules

Choose a color palette that matches the book's theme and mood. Use exactly 5 colors:

| Role | Purpose | Example for a habits book |
|------|---------|--------------------------|
| DARK_PRIMARY | Top bar, gradient start | `#D6A91F` (gold) |
| MEDIUM_PRIMARY | Bottom bar, gradient end | `#F1C94C` (light gold) |
| LIGHT_BG | Card background | `#FFF9E8` (cream) |
| LIGHT_ACCENT | Card stroke, decorative elements | `#D0B25D` (muted gold) |
| TEXT_LIGHT | Text on dark backgrounds | `#FFFDF6` (warm white) |

Additional accent colors (1-2) for the decorative motif. TEXT_DARK for title on the card is typically `#1C2C30` or `#2B2B22`.

#### Decorative Motif Guidelines

The central illustration should be a **simple, abstract, geometric representation** of the book's core theme. Use only basic SVG shapes (rect, circle, ellipse, path, line). No complex illustrations, photos, or detailed drawings.

Examples of motifs by book theme:
- **Negotiation book:** Two facing speech bubbles separated by a dividing line
- **Habits book:** Grid of alternating dots (representing atomic/compound patterns)
- **Strategy book:** Chess-like arrangement of geometric shapes
- **Psychology book:** Overlapping circles or a brain-suggestive abstract pattern
- **Leadership book:** A shield or crown with simple internal geometry
- **Productivity book:** Stacked blocks or a focus/target pattern

The motif appears twice: once as a shadow (offset, lower opacity) and once as the main illustration (slightly different position, full colors).

#### Title Font Size

Adjust font-size based on title length:
- 1-2 words: `font-size="92"`
- 3-4 words: `font-size="78"`
- 5+ words: `font-size="62"`
- Very long titles (7+ words): `font-size="48"` and consider splitting across two `<text>` elements at different y-coordinates

#### Badge

The badge in the top-right contains 2-letter initials of the book title. For "Atomic Habits" → "AH", for "The Power of Habit" → "PH", for "Never Split the Difference" → "NS".

---

## OUTPUT 3: CODE CHANGES TO WIRE THE BOOK INTO THE APP

You must provide the exact code changes needed in the following files. Output each as a clearly labeled diff.

### File 1: `app/book/data/bookPackages.ts`

Three changes needed:

#### Change 1A: Add import (at the top of the file, with the other imports)

```typescript
import [camelCaseBookName]PackageJson from "@/book-packages/[bookId].modern.json";
```

Example: `import atomicHabitsPackageJson from "@/book-packages/atomic-habits.modern.json";`

#### Change 1B: Add the normalization function call and export (after the existing NSTD normalization block, around line 337)

Since this book uses the new tone-aware format (same as Never Split the Difference), it needs the same normalization treatment. Add:

```typescript
export const [SCREAMING_SNAKE_CASE]_PACKAGE =
  normalizeNstdPackage([camelCaseBookName]PackageJson, "direct");
```

**IMPORTANT:** The `normalizeNstdPackage` function already exists and is generic enough to handle any tone-aware book. Do NOT cast the import directly as `BookPackage` (e.g., do NOT do `as BookPackage`), because the tone objects (`{gentle, direct, competitive}`) in the JSON won't match the `BookPackage` type which expects plain strings.

#### Change 1C: Add to BOOK_PACKAGES array (around line 451-548)

```typescript
export const BOOK_PACKAGES: BookPackage[] = [
  // ... existing entries ...
  [SCREAMING_SNAKE_CASE]_PACKAGE,  // <-- add this line
];
```

#### Change 1D: Add presentation metadata (in BOOK_PACKAGE_PRESENTATION object, around line 550+)

```typescript
"[bookId]": {
  icon: "[appropriate emoji]",
  coverImage: "/book-covers/[bookId].svg",
  difficulty: "[Easy|Medium|Hard]",
  synopsis: "[1-2 sentence description of what the book teaches, written for the target audience]",
  pages: [approximate page count of the actual published book],
},
```

**Difficulty guidelines:**
- Easy: Accessible, practical, everyday advice (Atomic Habits, Make Time)
- Medium: Requires some engagement, moderate abstraction (Deep Work, Start With Why)
- Hard: Dense concepts, academic research, philosophical depth (Thinking Fast and Slow, Antifragile)

**Icon guidelines:** Choose an emoji that represents the book's core theme. Examples: 📖 (general), 🧠 (psychology), 🎯 (strategy/goals), 🗣️ (communication), ⚡ (energy/performance), 🔑 (unlocking/access), 💡 (ideas), 🏗️ (building/systems), 🧩 (problem-solving), 🪞 (self-reflection)

### File 2: `public/book-covers/[bookId].svg`

Place the SVG cover file generated in Output 2 here.

### File 3 (Optional): `components/website/BrowseLibraryPage.tsx`

If the book should appear in featured sections, add its bookId to the appropriate set:

```typescript
// For new releases:
const NEW_IDS = new Set([
  // ... existing ...
  "[bookId]",
]);
```

---

## NAMING CONVENTION REFERENCE

Given a book title, here's how to derive all identifiers:

| Book Title | bookId | JSON filename | Import name | Export constant |
|------------|--------|---------------|-------------|-----------------|
| Atomic Habits | `atomic-habits` | `atomic-habits.modern.json` | `atomicHabitsPackageJson` | `ATOMIC_HABITS_PACKAGE` |
| The 48 Laws of Power | `the-48-laws-of-power` | `the-48-laws-of-power.modern.json` | `the48LawsOfPowerPackageJson` | `THE_48_LAWS_OF_POWER_PACKAGE` |
| Never Split the Difference | `never-split-the-difference` | `never-split-the-difference.modern.json` | `neverSplitTheDifferencePackageJson` | `NEVER_SPLIT_THE_DIFFERENCE_PACKAGE` |
| Deep Work | `deep-work` | `deep-work.modern.json` | `deepWorkPackageJson` | `DEEP_WORK_PACKAGE` |

Rules:
- **bookId:** All lowercase, words separated by hyphens, articles included
- **JSON filename:** `{bookId}.modern.json`
- **Import name:** camelCase + `PackageJson` suffix
- **Export constant:** SCREAMING_SNAKE_CASE + `_PACKAGE` suffix
- **chapterId:** `ch{NN}-{kebab-case-chapter-title}` (NN is zero-padded to 2 digits)
- **exampleId:** `ch{NN}-ex{NN}` (e.g., `ch01-ex01` through `ch01-ex06`)
- **questionId:** `ch{NN}-q{NN}` (e.g., `ch01-q01` through `ch01-q10`)

---

## FINAL INSTRUCTIONS

1. Start by determining the book's actual chapter structure, titles, and core concepts. Use the real published book's table of contents.

2. Write every chapter's content completely. Do not truncate, summarize, or use placeholder text.

3. Verify against the quality checklist after each chapter.

4. Output the complete JSON first (Output 1), then the SVG (Output 2), then the code changes (Output 3).

5. The content must demonstrate genuine understanding of the book. Do not write generic self-help advice. Each chapter's scenarios and quiz questions must reference the specific concepts, stories, and frameworks from THAT chapter of THAT book.

6. Every piece of text exists in three tones. The tones must differ in substance, not decoration.

7. Process the entire book before outputting. Every field must be populated. The JSON must be valid.
