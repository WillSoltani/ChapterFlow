# Quality Memory — compact

Compiled from rules/chapter-quality-gate.md, rules/chapter-structure.md, rules/hard-depth-rules.md, rules/scenario-tone-rules.md, rules/learning-loop.md, rules/meta-distance-rules.md, rules/readability-rules.md, rules/evidence-anchor-rules.md, rules/chapter-gate-rules.md, rules/release-gate-rules.md, rules/release-assembly-rules.md, rules/no-bulk-generation-rules.md, rules/continuation-guard-rules.md, rules/quiz-lifecycle-rules.md, rules/chapter-review-artifact-rules.md, rules/source-sidecar-rules.md, rules/name-ledger-rules.md.

## Chapter-quality rubric (12 points; must score >= 10/12)
Score each 0 / 1 / 2:
1. Chapter Specificity — 2 = unmistakably this chapter; 0 = could fit multiple.
2. Anchor Use — 2 = anchors carry the thinking; 0 = decorative or absent.
3. Analytical Value — 2 = real mechanism, distinction, or tension; 0 = summary.
4. Paragraph Motion — 2 = every paragraph earns its place.
5. Prose Quality — 2 = sharp, vivid, authored.
6. Hook And Bridge — 2 = opening pulls, ending opens next question.

## Auto-fail conditions
- Invented facts, quotes, studies, mechanisms.
- Generic enough to fit another chapter.
- Paragraph-job repetition.
- Hard depth = medium + words.
- Pseudo-science, fake precision.
- First sentence is thesis-first (must be curiosity-first).
- Contamination leakage from brief/outline/seed language.
- Identical tone collapse.
- Empty quiz in chapter_gate mode.
- Plain-string scenarios in required mode.
- Source splice leakage.

## Required craft checks
- First sentence creates curiosity.
- Uses >= 2 strong anchors from brief.
- Contains real tension, limit, or failure mode.
- Ending opens a next question, not a summary flatten.
- Memorable line every 200-300 words.

## Depth contract
### Easy
- chapterBreakdown (tone object)
- 140-175 words per tone
- exactly 3 keyTakeaways, each with `point` only
- no moreDetails, no prompts except flat `oneMinuteRecap`

### Medium
- chapterBreakdown (tone object)
- 330-420 words per tone
- 5-6 keyTakeaways, each `point` + `moreDetails`
- `activationPrompt` required
- `selfCheckPrompt` singular tone object required
- oneMinuteRecap: { retrieve, connect, preview }

### Hard
- chapterBreakdown (tone object)
- 490-600 words per tone
- 5-7 keyTakeaways, each `point` + `moreDetails`
- `activationPrompt` required
- `selfCheckPrompts` array of exactly 2 tone objects
- `predictionPrompt` required
- oneMinuteRecap: { retrieve, connect, preview }
- must preserve the outline's threshold question
- must add: boundary condition OR failure mode OR contradiction OR synthesis

## Examples (6 per chapter, default)
- 6 canonical formats each appearing exactly once.
- 6 ending types exactly once.
- 2 work / 2 school / 2 personal.
- Each example: title, format, category, scenario (tone object), whatToDo (tone object), whyItMatters (tone object), endingType.

## Quiz (10 questions, chapter_gate=generate)
- exactly 10 questions, 3 choices each, correctIndex ∈ {0,1,2}
- explanation is a tone object
- distribution: q01-q03 remember/understand, q04-q08 apply/analyze, q09-q10 evaluate/create
- q04-q06 use named-character scenarios
- q09-q10 should connect to prior chapter where supported
- no two questions test same principle
- direct explanation openers must vary; no "The strongest answer", "The best answer", "The correct response"
- correct answer must actually sound best; do not break correctness for balance
- roughly balanced correctIndex across 0/1/2

## Other required JSON
- `implementationPlan` shape (specific to chapter, not generic life advice)
- `reviewCards`: 5 cards with 2/2/1 difficulty distribution
- `keyTakeawayCard`: tone object { gentle, direct, competitive }

## Review wrapper (`validated/chXX.review-package.json`)
- schemaVersion, packageId, createdAt, contentOwner, full `book` object
- `chapters` array with exactly one chapter

## Reading metrics sidecar (`sidecars/chXX.reading-metrics.json`)
- Report grade bands per depth, word counts, any warnings

## Source sidecars
- `sidecars/source/chXX.source.txt`: chapter-local excerpt
- `sidecars/source/chXX.source.json`: { title, heading, approx words, proper nouns, repeated terms }

## Name ledger
- Use assigned names only.
- No within-chapter name reuse across examples unless intentional callback documented.
- Do not reuse a character name across the book by default.
- continuity state tracks `withinChapterNames` and `nameUsage`.

## Meta-distance
- Zero "the chapter says/teaches/warns" in takeaways, moreDetails, quiz explanations, scenarios, prompts, cards.
- Author name allowed sparingly in breakdowns only.

## Preview / recap
- preview must ask/imply a real prediction, not narrate next chapter.
- retrieve must be a recall challenge, not a summary.

## Release gate
- every numbered chapter validated
- release assembled from validated chapters only
- release hashes match validated chapters
- approved chapter hashes unchanged
- full artifact bundle for every chapter
