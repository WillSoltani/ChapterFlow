# ChapterFlow: Complete Book Generation

You are generating an entire book's content for the ChapterFlow guided reading app. This is a fresh start.

**Book:** [xxxxxxx]

---

## EXECUTION OVERVIEW

**Phases:**

0. **Delete** all existing files for this book
1. **Research** the book: map every chapter, concept, story, framework
2. **Generate** all chapter content (summaries at 3 depths x 3 tones, 6 scenarios, implementation plans, review cards, key takeaway cards)
3. **Generate** all quizzes (10 per chapter) as a SEPARATE PASS after all content is written
4. **Validate** every chapter against the full constraint set, fix any issues
5. **Assemble** the final book JSON, wire it into the codebase, build

Quiz generation MUST be a separate pass after all content is written. The reason: quiz quality degrades when generated simultaneously with content because the model falls into template patterns. Writing quizzes as a dedicated second pass with fresh attention produces dramatically better questions.

**Start by creating a plan.** Show me your execution plan and the full chapter table. Wait for my approval before generating anything.

---

## PHASE 0: DELETE EVERYTHING

Find and delete ALL files related to [xxxxxxx] across the entire codebase.

1. Search `book-packages/` for ALL JSON files related to this book. Delete all.
2. Search `app/book/data/bookPackages.ts` for any imports, exports, or BOOK_PACKAGES entries referencing this book. Note the exact lines. Remove them.
3. Search `/tmp/` for any leftover files from previous generation runs. Delete all.
4. Grep the codebase for any other references to this book's title or bookId.
5. Confirm: "All files for [xxxxxxx] deleted. Starting fresh."

---

## PHASE 1: RESEARCH THE BOOK

Before generating any content, build a deep understanding of the entire book.

**Step 1: Map the book's structure.**

Determine:
- Full title, author, edition
- Total number of chapters (N)
- How the book is organized (parts, sections, etc.)
- Generate a kebab-case bookId slug (e.g., "the-48-laws-of-power")
- Determine appropriate categories and tags

**Step 2: For each chapter, document:**

- **Number and title**
- **Core concept (2-3 specific sentences):** What is the ONE actionable principle? Not vague. "Greene argues that criticism triggers defensiveness and kills cooperation. The alternative is to begin by genuinely trying to see the other person's point of view" is good. "This chapter is about being a better communicator" is vague and rejected.
- **Key stories/examples the author uses:** Specific names, companies, anecdotes. These must appear in the generated content.
- **Framework or model (if any):** Named techniques, numbered steps, mental models the author introduces.
- **Cross-chapter connections:** What does this build on from the previous chapter? What does the next chapter introduce that this sets up?
- **Common misconceptions:** What do people get wrong about this idea? Feeds into quiz wrong answers and Deeper analysis.
- **Most-quoted line:** The sentence people remember from this chapter. Feeds into keyTakeawayCard.

**Step 3: Build a continuity ledger:**

Before any generation, create:
- Chapter order with preview targets (each chapter's preview teases the next)
- Cross-chapter reference map (which chapters reference which)
- Character name pool: assign 3 names per chapter upfront so no name is used more than twice across the entire book. Use diverse names: Maya, Ethan, Priya, Marcus, Sofia, Kai, Nora, James, Leila, Andre, Yuki, Omar, Tessa, Davi, Aaliyah, Connor, Rosa, Kenji, Dante, Rina, Felix, Naomi, Tariq, Ivy, Mei, Zara, Liam, Amara, Samir, Elena, Hana, Derek, Celia, Riku, Asha, Nico, Petra, Idris, Quinn, Lena, Tomas, Suki, Mikhail, Bria, Kaden, Anika, Joel, Thea, Ravi, Luz, Emery, Camille, Soren, Dina, Grant, Yara, Paco, Iris, Malik, Freya, Theo, Alma, Jai, Nell, Amir, Sage, Rowan, Cleo, Benny, Vera, Hugo, Lia, Milo, Selena, Kira, Cruz, Maren, Tate, Ada, Obi, Nina, Leo, Farah, Wren, Dex, Sable, Remy, Gil, Zuri, Tala, Knox, Elise, Rio, Harlan, Pearl, Juno, Cole, Lyra, Siya, Finn, Esme, Atlas, Raina, Kit, Maeve, Bodhi, Lina, Zeke, Cora, Taj, Willa, Oren, Nadia, Bryn, Ezra, Simone, Beck, Anya, Gael, Tova, Ray, Mira, Otis, June, Ren, Daria, Axel, Sol, Nyla, Penn, Rue, Joss, Koa, Belen, Nash, Paloma, Eamon, Isla, Dane, Pia, Reed, Noelle, Kip, Lark

**Step 4: Present the chapter plan table for my approval.**

| # | Title | Core Concept | Key Story/Example | Framework | Connects to |
|---|-------|-------------|-------------------|-----------|------------|

**Wait for my approval before proceeding to Phase 2.**

---

## PHASE 2: GENERATE ALL CHAPTER CONTENT

After approval, generate each chapter's complete content. Set `"quiz": null` on every chapter. Quizzes are generated in Phase 3.

Process chapters in order. For each chapter, follow every rule in the Content Specification below.

---

### THE ENGAGEMENT ARCHITECTURE

All content follows the **Curiosity-Insight-Flow Cycle**, repeating every 800-1,200 words:

**1. HOOK** — First sentence of EVERY section creates a curiosity gap.

WRONG (never write these):
- "This chapter explains why criticism is counterproductive."
- "The author argues that you should avoid blame."
- "In this chapter, the author discusses the importance of appreciation."
- "Chapter 3 explores how to influence people through genuine interest."

RIGHT (model every opening after these):
- "The fastest way to lose someone's honesty is to open with a verdict."
- "Most people think they're starting a conversation. They're actually starting a courtroom."
- "Lincoln wrote a furious letter to General Meade after Gettysburg, then never sent it."
- "A smile costs nothing. But Carnegie found it could be worth a raise, a sale, and a marriage."

**2. BUILD** — Sustain tension. Named characters, sensory details, unanswered questions.
**3. DELIVER** — Insight at peak curiosity. A sentence worth highlighting.
**4. BRIDGE** — Close current loop, open the next. Never wrap up neatly.

**Every major section must contain:**
- A **STORY** (named person in a specific moment, from the book when possible)
- **EVIDENCE** (why it works)
- A **PRACTICAL IMPLICATION** (what to do differently, specific enough to picture)

**SUCCESs quality test:** Every key idea should be Simple, Unexpected, Concrete, Credible, Emotional, and wrapped in a Story. If a takeaway fails 3+ of these, rewrite it.

**Priming dose principle:** Front-load a small intriguing piece before the full explanation. A small amount of knowledge greatly increases curiosity (Loewenstein's information-gap theory).

**Highlightable sentence density:** 1 quotable sentence per 200 words.
- BAD: "It is important to show interest in others."
- GOOD: "You can make more friends in two months by becoming interested in other people than you can in two years by trying to get other people interested in you."
- GOOD: "A person's name is, to that person, the sweetest sound in any language."
- GOOD: "People remember whether your first move was a trap or a door."

---

### VOICE AND READABILITY

**Voice: "the friend who explains well."** Has a mind behind it. Notices things. Has opinions. Admits uncertainty sometimes ("Actually, that isn't quite right, the real issue is..."). Uses "you" constantly. Never sounds like Wikipedia, a textbook, or a corporate FAQ.

**Translation test:** Would a smart person say this out loud to a friend over coffee? If no, rewrite.

**READABILITY MANDATE:** All content must be written at a conversational, accessible reading level. Use plain, everyday words that a high school student would understand. The goal is completeness WITHOUT complexity. Say everything that needs to be said, but say it simply. If you wouldn't say it out loud to a friend over coffee, rewrite it.

**VAGUENESS IS BANNED.** Every sentence must tell the reader something they can ACT on or PICTURE. If a sentence could appear in any self-help book about any topic, it is too vague.

- BAD: "This approach can improve your interactions."
- GOOD: "The next time someone pushes back in a meeting, try asking what part of your proposal feels hardest to accept. You'll often learn the real objection isn't what they said first."

- BAD: "Being mindful of emotions can help."
- GOOD: "When someone's jaw tightens and they say 'it's fine,' the conversation just started, not ended."

- BAD: "Consider the other person's perspective."
- GOOD: "Before responding to an objection, pause 3 seconds and ask yourself: what is this person protecting that they haven't said out loud?"

- BAD: "Apply this concept in your next conversation."
- GOOD: "In your next disagreement at work, instead of defending your position, say: 'What part of this feels wrong to you?' Then stop talking for 10 seconds."

**Humor and unexpected analogies:** 1 per major section. "Think of it like trying to calm a smoke alarm by arguing with the battery" is the right register.

**Readability rules:**
1. Grade 8-10. Average 15-20 words per sentence.
2. Concrete > abstract. Person in a moment, not concept in space.
3. "Use" not "utilize." "Help" not "facilitate." "Show" not "demonstrate."
4. Vary sentence rhythm: medium, short, long, short, medium.
5. Use "you" and "your" constantly.
6. Intellectual honesty: "This works usually. The exception is..."

**Depth levels differ in COGNITIVE DEMAND, not word count:**

| Depth | Grade | Does | Engagement target |
|-------|-------|------|------------------|
| Simple | 7-8 | Explains WHAT | "Cool idea. I want more." |
| Standard | 9-10 | Explains HOW/WHY. Story + evidence + implication. | At least 2 aha moments. |
| Deeper | 10-12 | Evaluates WHEN IT FAILS + CONNECTIONS. | At least 3 "I hadn't considered that." |

If Deeper is just longer Standard, it fails.

---

### TONE CHANGES SUBSTANCE, NOT ADJECTIVES

Example of the same takeaway in each tone:

**GENTLE:** "Here's something worth sitting with: the first thing people protect isn't their position. It's their sense of control. When you notice that, you stop fighting the argument and start addressing the fear behind it."

**DIRECT:** "The first battle is over meaning, not facts. Before anyone weighs your evidence, they're deciding whether you're a threat. Read that layer first."

**COMPETITIVE:** "Most people argue the point. The person who reads the room first, wins. While everyone else defends their logic, the top performer is asking: what does this person think they're losing?"

If your three tone versions are the same sentence with different adjectives, REWRITE.

---

### THE 12 REJECTION RULES

Every one has appeared in previous test runs.

**1. REPEATED CLOSING SENTENCES** — #1 content failure.

In previous runs, EVERY "What to do" ended with the same sentence. EVERY "Why it matters" ended with the same sentence. EVERY moreDetails ended with the same sentence.

Every closing sentence in a chapter must be STRUCTURALLY DIFFERENT. Here are 6 correct whyItMatters endings:

- #1 (broader principle): "People rarely protect only the number. They protect what the number says about respect."
- #2 (self-directed question): "When have you called something fair just because it ended the tension?"
- #3 (surprising implication): "A housing decision can fail because of grief language, not money language."
- #4 (cross-domain): "The same move that saves a class project can save a work call."
- #5 (common trap): "The trap is thinking a balanced option is always kind. Sometimes kindness means staying with the discomfort."
- #6 (perspective reframe): "The problem was never the budget. It was the feeling of being cornered."

**BEFORE SUBMITTING: Read EVERY closing sentence. If any two sound similar, REWRITE one.**

**2. GENERIC moreDetails.**
- BAD: "Apply this concept in your next conversation."
- BAD: "This technique is useful in many situations."
- GOOD: "Priya sees a client go quiet the moment the price increases. If she rushes to the spreadsheet, she answers the wrong question. A better first move is to ask what feels out of line."
- GOOD: "Cole walks into a client call with charts and a rollout plan. The client stays cold because Cole entered after a week of silence that already felt like abandonment."

**3. moreDetails on Simple takeaways.** Simple has ONLY `point`. The `moreDetails` field DOES NOT EXIST at this depth. Do not generate it.

**4. Wrong takeaway count.** Simple = EXACTLY 3. Standard = 5-7. Deeper = 7-10.

**5. Thesis-first openings.** First sentence = hook always.

**6. AI-tell phrases:** "delve", "crucial", "landscape", "realm", "It's worth noting", "In today's world", "Furthermore", "Moreover", "In conclusion", "plays a pivotal role", "at its core", "the art of", "navigating", "harnessing", "game-changer", "paradigm shift", "robust", "synergy", "leverage" (verb), "facilitate", "utilize", "foster", "embark on", "a testament to", "shed light on", "This matters because", "This is significant because", "it is essential to".

**7. Em dashes or en dashes.** Zero. Use commas, periods, colons, or semicolons.

**8. Thin scenarios.** Need 3+ concrete details + 1 sensory/emotional detail.
- BAD: "A work deadline slipped because one file was not uploaded."
- GOOD: "Maya is in a glass conference room at 4:42 p.m., watching the sun flash off parked cars while a vendor asks for a sudden increase. Her finance lead taps a pen hard enough to click through the silence."

**9. Generic scenario titles.**
- BAD: "Deadline reset" / "Room tone" / "Office choice"
- GOOD: "Maya at the Friday Renewal Call" / "Jonah's Club Event That Never Quite Recovered"

**10. Bland Wikipedia prose.** Passive voice, hedging, no "you", facts without interpretation.

**11. No dialogue scenario.** At least 1 of 6 scenarios uses dialogue format (3-6 exchanges).

**12. Previews that wrap up neatly.** Use open-loop patterns: open question, partial framework, contradiction tease, application bridge. Last chapter = "Full circle" to Chapter 1.

---

### CHAPTER JSON STRUCTURE

```json
{
  "chapterId": "<generated>",
  "number": <number>,
  "title": "<title>",
  "readingTimeMinutes": <standard words / 200 + 5>,
  "contentVariants": { "easy": {}, "medium": {}, "hard": {} },
  "examples": [],
  "quiz": null,
  "implementationPlan": {},
  "reviewCards": [],
  "keyTakeawayCard": {
    "gentle": "<2-3 sentences. The ONE insight. Highlightable.>",
    "direct": "...", "competitive": "..."
  }
}
```

---

### contentVariants.easy (Simple)

**Words:** 400-600 | **Grade:** 7-8 | **Bloom's:** Remember/Understand

```json
{
  "chapterBreakdown": {
    "gentle": "<2 paragraphs (\\n\\n). P1: Hook + core idea. P2: Why it matters + analogy.>",
    "direct": "...", "competitive": "..."
  },
  "keyTakeaways": [
    { "point": { "gentle": "<1-2 sharp sentences.>", "direct": "...", "competitive": "..." } },
    { "point": { ... } },
    { "point": { ... } }
  ],
  "oneMinuteRecap": {
    "gentle": "<1 specific action. NOT 'Apply this concept.'>",
    "direct": "...", "competitive": "..."
  }
}
```

**Rules:** EXACTLY 3 takeaways. NO moreDetails. 2 paragraphs. Flat recap. Hook first.

---

### contentVariants.medium (Standard)

**Words:** 1000-1500 | **Grade:** 9-10 | **Bloom's:** Apply/Analyze | **2+ aha moments**

```json
{
  "chapterBreakdown": {
    "gentle": "<3-4 paragraphs (\\n\\n). P1: Hook. P2: Framework via named person. P3: Reframe/aha. P4 (Ch2+): Cross-chapter + forward momentum. Story + evidence + implication. 2+ curiosity-insight cycles.>",
    "direct": "...", "competitive": "..."
  },
  "keyTakeaways": [
    {
      "point": { "gentle": "<**Bold headline.** 2-3 sentences.>", "direct": "...", "competitive": "..." },
      "moreDetails": { "gentle": "<3-5 sentences. Named character in specific scene.>", "direct": "...", "competitive": "..." }
    }
  ],
  "activationPrompt": { "gentle": "<Before-reading question.>", "direct": "...", "competitive": "..." },
  "selfCheckPrompt": { "gentle": "<After-reading WHY question.>", "direct": "...", "competitive": "..." },
  "oneMinuteRecap": {
    "retrieve": { "gentle": "<Retrieval challenge. Desirable difficulty: pulling from memory strengthens learning more than re-reading.>", "direct": "...", "competitive": "..." },
    "connect": { "gentle": "<Link to previous chapter or life.>", "direct": "...", "competitive": "..." },
    "preview": { "gentle": "<Open-loop teaser. Not neat wrap-up.>", "direct": "...", "competitive": "..." }
  }
}
```

**Rules:** 5-7 takeaways with moreDetails. Every moreDetails has a named person in a scene. Ch2+ references previous chapter. Preview uses open loops.

---

### contentVariants.hard (Deeper)

**Words:** 2000-2800 | **Grade:** 10-12 | **Bloom's:** Evaluate/Create | **3+ "I hadn't considered that" moments**

```json
{
  "chapterBreakdown": {
    "gentle": "<4-5 paragraphs. P1: Provocation beyond Standard. P2: Psychology/mechanism. P3: Limitation. P4: Cross-chapter. P5: Synthesis + highlightable ending. 3+ cycles. Story + evidence + implication.>",
    "direct": "...", "competitive": "..."
  },
  "keyTakeaways": [
    {
      "point": { "gentle": "<**Claim NOT in simpler depths.** 3-4 sentences.>", "direct": "...", "competitive": "..." },
      "moreDetails": { "gentle": "<Critical analysis with specifics.>", "direct": "...", "competitive": "..." }
    }
  ],
  "activationPrompt": { "gentle": "<Write-then-compare.>", "direct": "...", "competitive": "..." },
  "selfCheckPrompts": [
    { "gentle": "<Why does this work?>", "direct": "...", "competitive": "..." },
    { "gentle": "<Strongest argument against?>", "direct": "...", "competitive": "..." }
  ],
  "predictionPrompt": { "gentle": "<Predict next chapter's problem.>", "direct": "...", "competitive": "..." },
  "oneMinuteRecap": {
    "retrieve": { "gentle": "<Recall + reasoning.>", "direct": "...", "competitive": "..." },
    "connect": { "gentle": "<TWO previous chapters.>", "direct": "...", "competitive": "..." },
    "preview": { "gentle": "<Best teaser. Last ch = Full circle.>", "direct": "...", "competitive": "..." }
  }
}
```

**Rules:** 7-10 takeaways. selfCheckPrompts = array of 2. predictionPrompt required. Genuine critical thinking.

---

### implementationPlan (per chapter)

```json
{
  "coreSkill": { "gentle": "...", "direct": "...", "competitive": "..." },
  "ifThenPlans": [
    { "context": "work", "plan": { "gentle": "<'If I [specific], then I will [specific]'>", "direct": "...", "competitive": "..." } },
    { "context": "school", "plan": { ... } },
    { "context": "personal", "plan": { ... } }
  ],
  "twentyFourHourChallenge": { "gentle": "<Under 5 min. Specific.>", "direct": "...", "competitive": "..." },
  "weeklyPractice": { "gentle": "<Recurring + frequency.>", "direct": "...", "competitive": "..." }
}
```

---

### reviewCards (5 per chapter)

**Research basis:** Practice testing (g=0.50-0.73) + spaced practice (d=0.54) are the only HIGH-utility techniques. Testing with feedback nearly doubles the effect (g=0.73 vs 0.39). Make answers rewarding ("Nice catch..."), not clinical. Wrong answers should feel like "oh, I see the trap" not shame.

2 easy, 2 medium, 1 hard. Scenario questions answerable in 10-30 seconds. Test APPLICATION.

```json
{
  "cardId": "ch01-rc01",
  "front": { "gentle": "...", "direct": "...", "competitive": "..." },
  "back": { "gentle": "...", "direct": "...", "competitive": "..." },
  "difficulty": "easy"
}
```

---

### examples (6 per chapter: 2 work, 2 school, 2 personal)

**Narrative transportation.** Specify SITUATION and EMOTION, not demographics.

```json
{
  "exampleId": "ch01-ex01",
  "title": "<Character name + what happens. Curiosity-creating.>",
  "category": "work", "format": "decision_point", "contexts": ["work"],
  "scenario": { "gentle": "<80-150 words. 3+ details. 1+ sensory.>", "direct": "...", "competitive": "..." },
  "whatToDo": { "gentle": "<60-120 words. Specific. UNIQUE closing.>", "direct": "...", "competitive": "..." },
  "whyItMatters": { "gentle": "<50-100 words. UNIQUE ending type.>", "direct": "...", "competitive": "..." }
}
```

**6 formats (each once):** decision_point, postmortem, dialogue, predict_reveal, dilemma, before_after
**6 ending types (each once):** broader principle, self-directed question, surprising implication, cross-domain, common trap, perspective reframe
**At least 1 messy outcome. Diverse names from the pre-assigned pool.**

---

### Cross-Chapter Continuity

- Ch2+: Standard/Deeper reference previous chapter
- Later chapters combine concepts from multiple chapters
- Previews use open loops
- Last chapter = "Full circle" to Chapter 1
- Character names from pre-assigned pool (max 2 uses per name across book)

---

### PRE-OUTPUT CHECK (run for each chapter)

1. Every whyItMatters ending unique
2. Every whatToDo ending unique
3. Every moreDetails has named person in scene
4. Simple: exactly 3 takeaways, NO moreDetails
5. Standard: 5-7 takeaways with moreDetails
6. Deeper: 7-10 takeaways, selfCheckPrompts array of 2, predictionPrompt
7. First sentence of every breakdown is hook
8. Zero em/en dashes, zero AI-tell phrases
9. Every scenario: 3+ details, 1+ sensory, character name in title
10. At least 1 dialogue scenario with 3-6 exchanges
11. Tone changes substance across gentle/direct/competitive
12. 1+ highlightable sentence per 200 words
13. Previews use open-loop patterns
14. quiz = null

---

## PHASE 3: GENERATE ALL QUIZZES (Second Pass)

After ALL chapter content is written, go back and generate quizzes as a dedicated second pass. For each chapter, read its content and write 10 quiz questions.

### THE QUIZ RULE THAT MATTERS MOST

**Every question describes a SPECIFIC SITUATION. No question contains the chapter title or any heading in quotes.**

6 consecutive test runs failed this check every time. The model always generated:
- "Which option best applies 'Do Not Begin With Blame'?"
- "In a relatable scenario, which choice best puts 'Do Not Begin With Blame' into practice?"

These are WRONG. They reference the chapter title. They describe nothing.

**BANNED PHRASES in quiz questions:**
- "realistic situation for [title]"
- "best applies [title]"
- "best puts [title] into practice"
- "best reflects [title]"
- "real-world decision tied to [title]"
- Any chapter title or section heading in quotes

**10 EXAMPLES OF CORRECT QUESTIONS:**

1. "A new manager inherits a team with a missed deadline. She can open Monday's meeting by asking what went wrong or by asking what the team needs to hit the next one. What is the stronger opening?"

2. "Two siblings argue about holiday plans. One says 'You always get your way.' The other says 'That's not true.' Why does this exchange escalate rather than resolve?"

3. "A teacher notices a student's essay has a strong thesis but weak evidence. She can write 'This needs more support' or 'Your thesis is compelling, I want to see the evidence match it.' Which feedback approach is more likely to improve the next draft, and why?"

4. "Why does the author argue that even justified criticism usually backfires?"

5. "A sales rep sends a follow-up email that opens with 'Just checking in.' The client doesn't respond. What principle from this chapter explains the silence?"

6. "A parent catches their teenager breaking a house rule. They can say 'We need to talk about what happened' or 'You broke the rule and here's your consequence.' What happens differently in each case?"

7. "A project lead gives feedback to a teammate by starting with 'The presentation was solid, especially the data section. One thing that could make the Q&A stronger is...' Why does this opening work better than going straight to the critique?"

8. "What would change about a workplace disagreement if the person who felt wronged asked 'Help me understand your thinking' instead of 'Why did you do that?'"

9. "How does the principle from this chapter change how you would apply the listening technique from Chapter 5?"

10. "A CEO wants to change a company policy that employees love. She can announce the change with reasons, or she can first ask employees what they value about the current policy. Under what conditions does each approach work better?"

### QUIZ STRUCTURE

```json
{
  "passingScorePercent": 80,
  "questions": [
    {
      "questionId": "ch01-q01",
      "prompt": "<SPECIFIC SITUATION. ZERO quoted titles.>",
      "choices": ["A) ...", "B) ...", "C) ..."],
      "correctIndex": 0,
      "explanation": {
        "gentle": "<Why correct + why wrong tempts. 'Nice catch...'>",
        "direct": "<'Correct. The mechanism...'>",
        "competitive": "<'Expert answer. The trap is...'>"
      },
      "bloomsLevel": "remember",
      "depthLevel": "simple"
    }
  ]
}
```

### QUIZ RULES

1. **EXACTLY 3 choices: A), B), C).** Not 4.
2. q01-q03: simple/remember-understand. q04-q06: standard/apply-analyze (MUST have scenario with named character). q07-q08: standard/apply-analyze. q09-q10: deeper/evaluate-create (Ch2+: reference another chapter).
3. All 10 use DIFFERENT sentence structures (scenario, contrast, metacognitive, diagnostic, predict, counterfactual, cross-chapter).
4. Wrong answers = plausible misunderstandings. Name the misconception in explanations.
5. correctIndex distributed roughly evenly (3-4 each of 0, 1, 2).
6. explanation = {gentle, direct, competitive}, NOT a plain string.
7. Testing with feedback doubles learning (g=0.73). Make explanations rewarding and educational.
8. No duplicate questions. Each tests a different concept.

**Before finalizing each chapter's quiz:** Read every prompt. If ANY contains a quoted title, REWRITE. If ANY two start the same way, REWRITE. If ANY has 4 options, remove one.

---

## PHASE 4: VALIDATE

After all content and quizzes are generated, validate every chapter:

1. **Quiz integrity:** Zero title references, 3 options each, 10 diverse formats, no duplicates
2. **Simple takeaways:** Exactly 3, NO moreDetails
3. **moreDetails quality:** Every one names a person in a specific scene
4. **Closing uniqueness:** No two endings sound similar within a chapter
5. **Hook quality:** Every breakdown opens with curiosity, not thesis
6. **Structure:** All required fields present, correct types, correct counts
7. **Language:** Zero em/en dashes, zero AI-tell phrases, no vague sentences
8. **Engagement:** Highlightable density, aha moments, dialogue scenario, messy scenario
9. **Tone:** Substance changes across gentle/direct/competitive
10. **Continuity:** Cross-chapter references, open-loop previews, character name budget

Fix anything that fails.

---

## PHASE 5: ASSEMBLE

1. Write each validated chapter to `/tmp/{bookId}-chNN-final.json`
2. Assemble the complete book JSON:

```json
{
  "schemaVersion": "1.1.0",
  "packageId": "<generated UUID>",
  "createdAt": "<current ISO date>",
  "contentOwner": "ChapterFlow",
  "book": {
    "bookId": "<generated-slug>",
    "title": "<book title>",
    "author": "<author>",
    "categories": ["<appropriate>"],
    "tags": ["<appropriate>"],
    "edition": { "name": "<appropriate>", "publishedYear": <year> },
    "variantFamily": "EMH"
  },
  "chapters": [ ... sorted by number ... ]
}
```

3. Write to `book-packages/{bookId}.modern.json`
4. Wire in `bookPackages.ts`:
   - Import the JSON
   - Create the normalized export using `normalizeNstdPackage(bookJson, "direct")`
   - Add raw chapters export and tone-aware getter function
   - Add to the BOOK_PACKAGES array
   - Add presentation metadata
5. Wire in `mockChapters.ts`:
   - Add the book ID to `TONE_AWARE_BOOK_IDS` set
   - Add the book to `TONE_BUNDLE_GETTERS` map with its package and raw getters
6. Build and verify: `npm run build`

---

## NOW: Create your execution plan. Show me the plan and the full chapter table. Wait for my approval.
