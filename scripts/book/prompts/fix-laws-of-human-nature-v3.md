# Fix "The Laws of Human Nature" — Full v3 Compliance

## BOOK: The Laws of Human Nature — Robert Greene
## FILE: `book-packages/laws-of-human-nature.modern.json` (18 chapters)

---

## WHAT THIS PROMPT DOES

This prompt brings The Laws of Human Nature into full compliance with the ChapterFlow v3 content specification. The book is already in good structural shape (correct schema, tone objects, 3-choice quizzes, format fields present). The fixes are content quality and consistency issues.

**Run all phases without stopping. Do not wait for approval.**

---

## THE ISSUES (12 categories, exact counts from audit)

| # | v3 Rule | Issue | Count | Fix Type |
|---|---------|-------|-------|----------|
| 1 | Rule 2 | "It is/This is/That is [short declarative]." endings | 75 | Agent-assisted rewrite |
| 2 | Rule 3 | Closing sentences with "structural" (53), "pattern" (29), "mechanism" (14) | 96 | Agent-assisted rewrite |
| 3 | Rule 18 | "ask yourself" 85 times (Ch8=10, Ch9=7, Ch11=7) | 85 | Scripted replacement |
| 4 | Rule 8 | AI-tell phrases: "navigating" (8), "landscape" (7), "robust" (3) | 18 | Scripted replacement |
| 5 | Rule 17 | "leverage" 27 times (Ch6=7, Ch15=4, Ch17=4) | 27 | Scripted replacement |
| 6 | Rule 13 | 6 dialogue scenarios with 0 quoted speech | 6 | Agent-assisted rewrite |
| 7 | Rule 12 | "study group" in 7 chapters | 7 chapters | Scripted replacement |
| 8 | Rule 20 | "Here is something worth sitting with" | 5 | Scripted replacement |
| 9 | Rule 11 | "[Name]'s [X]" pattern in 39/108 titles. "Predicts" in 6. | ~30 to rewrite | Agent-assisted rewrite |
| 10 | Rule 23 | `endingType` field missing from all 108 examples | 108 | Scripted addition |
| 11 | Rule 6 | 2 practice takeaways (Ch1 "Delay", Ch16 "Track") | 2 | Manual fix |
| 12 | Rule 9 | 2 double-hyphens (--) | 2 | Scripted replacement |

---

## EXECUTION ORDER

```
Phase A: Scripted fixes (mechanical, no content generation needed)
  Step 1:  Add endingType to all 108 examples
  Step 2:  Fix "leverage" (27 → max 1/chapter)
  Step 3:  Fix "ask yourself" (85 → max 1/chapter)
  Step 4:  Fix AI-tell phrases (18 → 0)
  Step 5:  Fix "Here is something worth sitting with" (5 → 0)
  Step 6:  Fix "study group" (7 chapters → max 3)
  Step 7:  Fix double-hyphens (2 → 0)
  Step 8:  Fix practice takeaways (2 items)

Phase B: Agent-assisted content rewrites
  Step 9:  Rewrite 75 declarative endings
  Step 10: Rewrite 96 closing sentences with structural/pattern/mechanism
  Step 11: Rewrite 6 dialogue scenarios with actual quoted speech
  Step 12: Diversify ~30 formulaic titles

Phase C: Validation
  Step 13: Full audit — 0 violations
  Step 14: npm run build
```

---

## PHASE A: SCRIPTED FIXES

Write a Node.js script `scripts/book/fix-human-nature-v3.mjs` that reads the JSON, applies fixes, and writes back. Use the same pattern as the existing `scripts/book/fix-48-laws-v3-compliance.mjs`.

### Step 1: Add endingType to all 108 examples

Every example has `category` and `format` but is missing `endingType`. Each chapter must use all 6 ending types exactly once across its 6 examples.

For each chapter's 6 examples, read the `whyItMatters.direct` text and classify:

| If the whyItMatters... | Assign endingType |
|------------------------|-------------------|
| Ends with a question | `self_directed_question` |
| Mentions a different domain/context than the scenario | `cross_domain` |
| Warns about a common mistake or trap | `common_trap` |
| States a broad principle beyond this specific situation | `broader_principle` |
| Presents something counterintuitive or surprising | `surprising_implication` |
| Reframes how to see the situation | `perspective_reframe` |

After assigning all 6, verify each chapter uses each type exactly once. If there are duplicates, reassign the least clear match to the needed type.

### Step 2: Fix "leverage" (27 → max 1/chapter)

Read every string field in every chapter. For each chapter, keep the FIRST occurrence of "leverage" (noun form). Replace all subsequent occurrences with context-appropriate synonyms:

Synonym rotation: "advantage", "influence", "position", "power", "upper hand", "edge", "hold", "sway", "bargaining power", "pull"

Chapters needing fixes: Ch5 (3→1), Ch6 (7→1), Ch8 (2→1), Ch9 (3→1), Ch14 (2→1), Ch15 (4→1), Ch17 (4→1).

### Step 3: Fix "ask yourself" (85 → max 1/chapter)

Keep the first occurrence per chapter. Replace all extras with alternatives, rotating through:
- "consider this:"
- "the question becomes:"
- "what shifts is:"
- "try this lens:"
- "the test is:"
- "the real question is:"
- "a useful check:"
- "one way to test this:"
- "a revealing question:"
- "the deeper question is:"

Chapters with the most to fix: Ch8 (10→1), Ch9 (7→1), Ch11 (7→1), Ch2 (6→1), Ch5 (6→1), Ch6 (5→1), Ch14 (6→1), Ch17 (6→1).

### Step 4: Fix AI-tell phrases (18 → 0)

Replace every instance:
- **"navigating"** (8 occurrences) → "handling" / "working through" / "managing" / "dealing with" / "moving through" / "facing" / "addressing" / "confronting"
- **"landscape"** (7 occurrences) → "environment" / "context" / "terrain" / "world" / "field" / "territory" / "space"
- **"robust"** (3 occurrences) → "strong" / "solid" / "durable" / "reliable"

Use a different synonym each time to avoid creating a new repetition pattern.

### Step 5: Fix "Here is something worth sitting with" (5 → 0)

Replace each of the 5 occurrences (Ch1×2, Ch2, Ch9, Ch12) with a unique gentle opener from this pool:

1. "One thing that tends to go unnoticed is"
2. "You might have experienced this without naming it:"
3. "The part most people skip past is"
4. "A small detail changes the entire picture here."
5. "Something counterintuitive is hiding in this principle."

Each replacement must be unique — no two may use the same opener.

### Step 6: Fix "study group" (7 chapters → max 3)

Keep "study group" in the first 3 chapters that use it (Ch1, Ch6, Ch9). Replace in the other 4 (Ch12, Ch14, Ch17, Ch18) with diverse school settings:

| Chapter | Replace "study group" with |
|---------|---------------------------|
| Ch12 | "peer tutoring session" |
| Ch14 | "debate team practice" |
| Ch17 | "campus newspaper editorial meeting" |
| Ch18 | "thesis advisor meeting" |

Replace in ALL text fields of each affected chapter: scenario, whatToDo, whyItMatters (all 3 tones), quiz prompts, review cards, chapterBreakdown, moreDetails. Also update example titles if they contain "study group".

### Step 7: Fix double-hyphens (2 → 0)

Search for `--` (double hyphen) across all string fields. Replace with a comma or semicolon depending on context.

### Step 8: Fix practice takeaways (2 items)

Rewrite these 2 medium keyTakeaway.point fields from imperative to insight:

**Ch1 medium KT that starts with "Delay":**
- Current (direct): "Delay and suppression are different processes with opposite outcomes."
- This one is actually fine — "Delay" here is part of a declarative sentence about processes, not an imperative telling the reader to delay something. **Keep it if the full sentence reads as an insight.** Read the full text — if the bold headline is imperative ("**Delay your response.**"), rewrite the headline only. If it's declarative ("**Delay and suppression are different processes.**"), keep it.

**Ch16 medium KT that starts with "Track":**
- If the bold headline is imperative ("**Track outcomes, not tone.**"), rewrite as: "**Outcomes reveal intent more reliably than tone.** Tracking what someone produces, not how they sound while producing it, separates accurate reads from emotional ones."
- If already declarative, keep it.

---

## PHASE B: AGENT-ASSISTED CONTENT REWRITES

For each step, read the book JSON, extract the specific fields that need rewriting, process them, and patch back.

### Step 9: Rewrite 75 declarative endings

Find every field where the last sentence starts with "It is/This is/That is" and is under 15 words.

**Process in 3 batches** (Ch1-6, Ch7-12, Ch13-18). For each batch:

1. Extract all flagged entries: `{chapter, fieldPath, lastSentence, contextPreview (last 200 chars)}`
2. For each entry, write a replacement that is:
   - CONCRETE: a person, an action, a feeling, a specific consequence
   - Does NOT start with "It is", "This is", "That is", "It was", "This was", "That was"
   - Roughly the same length as the original
   - Fits naturally after the preceding text

**BANNED replacements:**
- "It is the difference between..." / "This is what separates..." / "That is the key."
- Any abstract declaration

**CORRECT replacements:**
- "The raise she got had nothing to do with the spreadsheet."
- "Nobody in the room realized the decision had already been made."
- "Three days later the budget appeared unchanged."
- "What looked like patience was actually the most aggressive move in the room."
- "She never mentioned the conversation again, but her next three decisions showed she had heard every word."

3. Apply each replacement by finding the old ending in the field and replacing it with the new one.
4. Verify: 0 remaining declarative endings after all 3 batches.

### Step 10: Rewrite 96 closing sentences with structural/pattern/mechanism

Find every field where the LAST SENTENCE contains "structural", "pattern", or "mechanism".

**Process in 3 batches.** For each flagged sentence:

Replace the crutch word with a more specific, concrete term OR rewrite the entire last sentence to be concrete:

- **"structural"** (53 instances) → Replace with what is actually structural. "The structural advantage" → "The advantage she built without anyone noticing." Or replace the word: "built-in" / "fundamental" / "foundational" / "underlying" / "embedded" / specific description.
- **"pattern"** (29 instances) → Replace with the specific thing being described. "The communication pattern" → "The way she opened every meeting." Or: "habit" / "tendency" / "rhythm" / "cycle" / "sequence" / specific description.
- **"mechanism"** (14 instances) → "process" / "response" / "reaction" / "trigger" / "reflex" / specific description.

**Target:** Max 3 closing sentences per word across the ENTIRE book after fixing.

### Step 11: Rewrite 6 dialogue scenarios with actual quoted speech

These 6 dialogue-format examples have 0 quoted speech in their scenario fields. They need to be rewritten with 3-4 exchanges of actual quoted dialogue.

| Chapter | Example Title | Current Problem |
|---------|--------------|----------------|
| Ch4 | "Petra's Lab Partner Says One Thing and Codes Another" | Narration, no quotes |
| Ch10 | "Naomi's Client Win and the Team Lead Who Wanted to Debrief" | Narration, no quotes |
| Ch11 | "Tomas and His Brother Have the Conversation They Have Been Avoiding" | Narration, no quotes |
| Ch12 | "Sage and Dex Disagree About Tempo in the Practice Room" | Narration, no quotes |
| Ch14 | "Juno Watches Her Newsroom Turn a Rumor Into a Story" | Narration, no quotes |
| Ch15 | "Ravi's Team Pushes Back on the Deadline" | Narration, no quotes |

For each, rewrite ALL 3 tone variants (gentle, direct, competitive) of the `scenario` field:

**Requirements:**
- 3-4 exchanges of quoted speech between named characters
- Keep the same character names, category, setting, and general situation
- 80-150 words per variant
- 3+ concrete details + 1+ sensory/emotional detail
- Each tone variant must have DIFFERENT dialogue (not copy-paste)
- Gentle: warmer, more reflective dialogue. Direct: blunt, efficient. Competitive: sharper, higher-stakes.

**Example of CORRECT dialogue in a scenario:**
```
"Ravi sets his laptop at the head of the conference table. 'The client wants delivery
by the 15th,' he says. Kenji leans back. 'The 15th assumes we get the API specs by
Wednesday. We won't.' Ravi pauses, tapping the edge of his screen. 'What if we ship
the dashboard without the live feed and patch it in week two?' Kenji's jaw tightens.
'Then we're shipping something broken and calling it a feature.'"
```

**REJECTED (narration about dialogue):**
```
"Ravi discusses the deadline with his team. Kenji pushes back on the timeline.
They eventually agree to a phased approach."
```

### Step 12: Diversify ~30 formulaic titles

The "[Name]'s [X]" possessive pattern appears in 39 of 108 titles (36%). While not all need changing, the pattern should appear in no more than ~15 titles (max ~14% of the book).

Additionally:
- "Predicts" appears in 6 titles (keep max 3, rewrite 3)
- "Before and After" appears in 4 titles (keep max 3, rewrite 1)

**For the ~24 "[Name]'s [X]" titles to rewrite + 3 "Predicts" + 1 "Before and After" = ~28 titles:**

Keep the character name. Rewrite using varied structures:

**Structures to rotate through (no more than 3 of any pattern across the book):**
- "The Day [Name] Changed the Script"
- "What [Name] Stopped Doing That Changed Everything"
- "How [Name]'s Silence Shifted the Room"
- "[Name] at the Crossroads of [X]"
- "The Moment [Name] Let Go of [X]"
- "A Quiet Win That [Name] Almost Missed"
- "What Happened When [Name] Said No"
- "[Name] Between Two Versions of the Truth"
- "The First Time [Name] Saw It Coming"
- "[Name] Reads the Room and Changes Course"

For each title, the new version must:
- Keep the character name
- Create curiosity — hint at a situation without explaining it
- Relate to the chapter's specific principle

---

## PHASE C: VALIDATION

### Step 13: Full audit

After all fixes, verify EVERY check passes:

1. ☐ Zero "It is/This is/That is [short declarative]." endings
2. ☐ "structural" in max 3 closing sentences across entire book
3. ☐ "pattern" in max 3 closing sentences across entire book
4. ☐ "mechanism" in max 3 closing sentences across entire book
5. ☐ "ask yourself" max 1 per chapter (18 max across book)
6. ☐ Zero AI-tell phrases (navigating, landscape, robust, delve, crucial, realm, etc.)
7. ☐ "leverage" max 1 per chapter
8. ☐ Zero "Here is something worth sitting with"
9. ☐ "study group" in max 3 chapters
10. ☐ Zero double-hyphens (--)
11. ☐ Zero practice takeaways (no imperative verb bold headlines)
12. ☐ All 108 examples have `endingType` field
13. ☐ Each chapter uses all 6 endingTypes exactly once
14. ☐ All 18 dialogue scenarios have 3+ quoted exchanges in scenario field
15. ☐ No "[Name]'s [X]" pattern in more than 15 titles
16. ☐ No "Predicts" pattern in more than 3 titles
17. ☐ No "Before and After" pattern in more than 3 titles
18. ☐ Zero em/en dashes
19. ☐ Zero orphaned quote fragments
20. ☐ Valid JSON, no duplicate keys

### Step 14: Build

Run `npm run build`. Fix any errors. Verify the book loads correctly.

Log: "All fixes complete. Laws of Human Nature is v3 compliant."

---

## PROCESSING APPROACH

**Phase A (Steps 1-8):** Write a single Node.js script with subcommands. Pattern after `scripts/book/fix-48-laws-v3-compliance.mjs` which already exists in the codebase. Key utilities to reuse:

```javascript
function walkStrings(obj, visitor, path) { /* traverse all strings */ }
function walkAndReplace(obj, replacer, path) { /* traverse and transform strings */ }
function getLastSentence(text) { /* extract final sentence */ }
```

Run all 8 scripted fixes in sequence. Verify each with a count check before moving to the next.

**Phase B (Steps 9-12):** Process in batches.

For declarative endings and vocabulary closings (Steps 9-10): Extract all flagged entries to a temp file, generate replacements (you can do this directly in-conversation by reading the entries and writing replacements), then apply with a patch script.

For dialogue rewrites (Step 11): Read each of the 6 scenarios, rewrite all 3 tones with actual quoted speech, and patch back.

For title diversification (Step 12): Extract the ~28 titles to rewrite, generate varied replacements, patch back.

**Phase C (Steps 13-14):** Run the audit script to verify 0 violations, then `npm run build`.

---

## REFERENCE FILES

| File | Purpose |
|------|---------|
| `book-packages/laws-of-human-nature.modern.json` | The file to fix (18 chapters) |
| `book-packages/the-48-laws-of-power.modern.json` | Schema reference (gold standard after recent fixes) |
| `scripts/book/fix-48-laws-v3-compliance.mjs` | Existing fix script with reusable utilities |
| `scripts/book/prompts/chapterflow-book-generation-v3.md` | Full v3 content spec with all 25 rules |

---

## NOW: Create your execution plan and begin. Run all phases through completion without stopping.
