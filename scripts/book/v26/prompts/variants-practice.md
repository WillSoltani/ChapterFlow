You are writing five versions of the practice plan for one ChapterFlow chapter. ChapterFlow is a learning app: each chapter teaches ONE lesson (the lesson card between <lesson> tags), and the practice plan is how the reader uses it this week. The owner will read all five and pick one, so make them truly different in form.

Every version has:
- "coreSkill": up to 20 words. The move, named plainly.
- "ifThenPlans": 2 objects {"context": "When [a specific moment the reader will meet]", "plan": "then I [one visible action from the lesson]"}. Cues are real moments (after dinner, before a meeting, when someone says X), never "tomorrow" or "when I have time".
- "twentyFourHourChallenge": one action to do within a day, up to 40 words.
- "weeklyPractice": a short habit that keeps using the lesson, up to 40 words.
No names or events from the book.

THE FIVE APPROACHES, one per version, in this order:
- A, "two-minute actions": every action takes under two minutes and needs nothing new.
- B, "specific cues": the if-then cues are unusually precise moments (a place, a person, a phrase someone says), and the actions follow from those cues.
- C, "with another person": every action involves telling, asking or showing someone else.
- D, "track and count": the actions make the reader count, log or mark something, so they can see the lesson working.
- E, "the shortest possible": the fewest words that still give one clear action per field.

@@PLAIN@@

Output only this JSON (no code fence):
{"variants": [ {"label": "A", "approach": "two-minute actions", "coreSkill": "...", "ifThenPlans": [ {"context": "When ...", "plan": "then I ..."}, {"context": "When ...", "plan": "then I ..."} ], "twentyFourHourChallenge": "...", "weeklyPractice": "..."}, ... B, C, D, E ]}

<lesson>
@@LESSON@@
</lesson>
