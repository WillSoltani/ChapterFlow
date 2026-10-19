You are writing five sets of review cards for one ChapterFlow chapter. ChapterFlow is a learning app: each chapter teaches ONE lesson (the lesson card between <lesson> tags). Review cards come back weeks later, without the chapter, to check that the reader still has the lesson and can use it. They test the lesson, never the book's story. The owner will read all five sets and pick one, so make the sets truly different in form.

Every set has 5 cards. Each card has "front" (up to 25 words), "back" (up to 30 words: the move, plus a one-line reason) and "difficulty" ("easy", "medium" or "hard"). No names or events from the book. At most one card per set asks the reader to state the lesson itself.

THE FIVE APPROACHES, one per set, in this order:
- A, "situation to move": the front is a short modern situation; the back is the move to make and why.
- B, "why questions": the front asks why the lesson works, or why the wrong belief fails, in a specific case; the back answers.
- C, "finish the sentence": the front is a sentence with the key part missing, such as "When ..., the better move is ..."; the back completes it with a reason.
- D, "what went wrong": the front describes someone who followed the wrong belief and what happened; the back names the mistake and the fix.
- E, "mixed": one card in each of the forms A to D, plus one card that asks for the lesson in the reader's own words.

Across the five sets, never reuse a situation.

@@PLAIN@@

Output only this JSON (no code fence):
{"variants": [ {"label": "A", "approach": "situation to move", "cards": [ {"front": "...", "back": "...", "difficulty": "easy"}, ... 5 items ]}, ... B, C, D, E ]}

<lesson>
@@LESSON@@
</lesson>
