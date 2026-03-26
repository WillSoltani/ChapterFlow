You are writing the quiz for one chapter of "How to Win Friends and Influence People" by Dale Carnegie.

Read the chapter brief JSON path given in the worker message. Then read:
- `contentPath` from that brief, which contains the finished chapter content

Write valid quiz JSON to `quizPath`.

THE RULE THAT MATTERS MOST

Every question must describe a specific situation. No prompt may contain the chapter title or a section heading in quotes.

Wrong examples:
- "Which option would be most effective for 'Do Not Begin With Blame'?"
- "Which choice best applies 'Create Early Agreement' in practice?"
- "In a realistic situation for 'Warmth Sets the Tone'..."

Right examples:
- "A student opens a feedback talk by listing everything her teammate did wrong. The teammate folds his arms and stops contributing. What should she do instead?"
- "During a budget call, the client says the price is too high, but their tone suggests embarrassment more than anger. What question is most likely to reveal the real issue?"

QUIZ SHAPE

{
  "passingScorePercent": 80,
  "questions": [
    {
      "questionId": "chNN-q01",
      "prompt": "<specific situation>",
      "choices": [
        "A) ...",
        "B) ...",
        "C) ..."
      ],
      "correctIndex": 0,
      "explanation": {
        "gentle": "<2-3 sentences>",
        "direct": "<2-3 sentences>",
        "competitive": "<2-3 sentences>"
      },
      "bloomsLevel": "remember",
      "depthLevel": "simple"
    }
  ]
}

RULES

1. Exactly 10 questions.
2. Exactly 3 choices per question, prefixed `A) `, `B) `, `C) `.
3. Questions 1-3:
   - `depthLevel`: `simple`
   - `bloomsLevel`: `remember` or `understand`
4. Questions 4-6:
   - `depthLevel`: `standard`
   - `bloomsLevel`: `apply` or `analyze`
   - must contain a 2-4 sentence scenario with a named character
5. Questions 7-8:
   - `depthLevel`: `standard`
   - `bloomsLevel`: `apply` or `analyze`
6. Questions 9-10:
   - `depthLevel`: `deeper`
   - `bloomsLevel`: `evaluate` or `create`
   - for chapters after Chapter 1, at least one of these two must reference another chapter
7. All 10 questions must start differently. Compare the first 5 words of every prompt.
8. Vary formats across scenario analysis, conceptual contrast, metacognitive, diagnostic, predict-the-outcome, counterfactual, and cross-chapter synthesis.
9. Wrong answers must be plausible misunderstandings, not jokes or obvious nonsense.
10. Spread `correctIndex` roughly evenly across 0, 1, and 2.
11. No `all of the above` or `none of the above`.
12. `explanation` must always be a tone object and should explain the trap in at least one wrong answer.
13. No duplicate concepts with minor wording swaps.

FINAL CHECK

- No chapter title or section heading in quotes
- No phrases like `best applies`, `best reflects`, `best puts into practice`, `realistic situation for`
- Exactly 3 choices on every question
- Question starts are all different
- Output is valid JSON written to `quizPath`
