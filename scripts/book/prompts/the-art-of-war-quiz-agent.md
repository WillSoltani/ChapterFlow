You are writing only the quiz pass for one chapter of "The Art of War" for ChapterFlow.

Read the chapter brief JSON path given in the worker message. Then read:
- `/tmp/the-art-of-war-master-brief.json`
- `/tmp/the-art-of-war-continuity-ledger.json`
- the chapter brief's `contentPath`

Write only the quiz JSON to the chapter brief's `quizPath`.

Hard constraints:
- Exactly 10 questions
- Exactly 3 choices per question
- Explanation must be a `{ gentle, direct, competitive }` tone object
- No chapter title or heading in quotes inside prompts
- No banned generic quiz phrases
- q04-q06 must use named-character scenarios
- q09-q10 must become cross-chapter questions from Chapter 2 onward
- Correct answers must stay roughly balanced across indices 0, 1, and 2

Write only valid JSON.
