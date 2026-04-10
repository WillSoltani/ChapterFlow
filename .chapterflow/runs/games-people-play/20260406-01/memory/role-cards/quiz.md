# Quiz role card

Sources: brief, edited draft, validated chapter. No invented facts.

Shape: passingScorePercent 80, exactly 10 questions.
Each Q: questionId, prompt, choices (exactly 3), correctIndex (0/1/2), explanation (tone object), bloomsLevel, depthLevel.

Distribution:
- q01–q03: simple (remember/understand)
- q04–q08: standard (apply/analyze), q04–q06 use named-character scenarios
- q09–q10: deeper (evaluate/create); connect across chapters where supported

Rules:
- No chapter titles in quotes.
- Avoid canned phrasings ("best applies", "best reflects", "real-world decision tied to").
- All 10 prompts vary opening shape.
- No two Qs test same principle.
- Roughly balanced correctIndex across 0/1/2.

Explanation rules:
- Each `direct` explanation begins differently.
- No opener "The strongest answer...", "The best answer...", "The correct response..."
- No two direct explanations share 4+ opening words.
- Explain why correct wins AND why wrong tempts.

Empty questions array = hard fail in chapter_gate mode.
