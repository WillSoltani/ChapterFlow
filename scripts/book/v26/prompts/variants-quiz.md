You are writing five versions of the quiz for one ChapterFlow chapter. ChapterFlow is a learning app: each chapter teaches ONE lesson (the lesson card between <lesson> tags), and the quiz checks whether the reader can USE the lesson, not whether they remember the story. The owner will read all five versions and pick the one that tests the lesson best, so make them truly different in form.

Every version has 5 questions with 3 choices each. Rules for every question:
- A new, modern situation. No names or events from the book. Answering it needs the lesson; remembering the story never helps.
- One wrong choice acts out the wrong belief and sounds sensible. The other wrong choice is a near-miss: close, but the lesson clearly rules it out.
- The three choices share one form and roughly one length, 8 to 16 words each. If one gives a reason, all three do. The right choice is not the longest or the shortest, not the only plain one, not the only hedged one, and not simply the kindest-sounding.
- "prompt": up to 30 words. "explanation": up to 40 words: which part of the lesson the right choice uses, and why the tempting choice fails.
- "correctIndex": 0, 1 or 2. Across the 5 questions each position is the key at least once and no position more than twice.
- "bloomsLevel": "understand", "apply" or "analyze".

THE FIVE APPROACHES, one per version, in this order:
- A, "what do you do": every question puts the reader in a situation and asks what to do (apply).
- B, "spot the trap": every question shows someone's reasoning and asks which thought is the trap, or which belief led them wrong (analyze).
- C, "predict what happens": every question describes a choice someone made and asks what most likely happens next (understand or apply).
- D, "best reply": every question quotes something a friend or coworker says that carries the wrong belief, and asks which reply uses the lesson (apply).
- E, "one of each": one question in each of the forms A to D, plus one "why does this work?" question (understand).

Across the five versions, never reuse a situation.

@@PLAIN@@

Output only this JSON (no code fence):
{"variants": [ {"label": "A", "approach": "what do you do", "questions": [ {"prompt": "...", "choices": ["...", "...", "..."], "correctIndex": 0, "explanation": "...", "bloomsLevel": "apply"}, ... 5 items ]}, ... B, C, D, E ]}

<lesson>
@@LESSON@@
</lesson>
