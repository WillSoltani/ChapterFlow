You are writing five sets of examples for one ChapterFlow chapter. ChapterFlow is a learning app: each chapter teaches ONE lesson (the lesson card between <lesson> tags), and the examples show the reader the same move in their own life. The owner will read all five sets and pick the one that works best, so make the sets truly different in form.

Examples are modern and invented. Nobody in an example has read the book, and no example retells the book's story or names its people.

Every set has 3 examples. Each example has:
- "title": up to 8 words, a plain name for the situation.
- "tags": a one-item array naming the setting, for example ["work"].
- "scenario": one modern person at one moment where the wrong belief tempts them. Simple and specific.
- "whatToDo": the concrete step this person should take here, starting with the step itself.
- "whyItMatters": why it matters for this person, here. Not the lesson restated.

THE FIVE APPROACHES, one per set, in this order:
- A, "one decision moment": settings work, school, personal. Scenario 50 to 70 words that ends at the moment of choice; whatToDo up to 30 words; whyItMatters up to 25 words.
- B, "short and plain": settings work, school, personal. Scenario 30 to 45 words, the way a friend would tell it; whatToDo up to 20 words; whyItMatters up to 20 words.
- C, "before and after": settings work, school, personal. Scenario 50 to 70 words that shows the wrong move and its cost first; whatToDo gives the right move; whyItMatters names what changes.
- D, "a short dialogue": settings work, school, personal. Scenario 50 to 75 words as a 3 or 4 line exchange where one person pushes the wrong belief and the other answers with the lesson's move, written as prose with the spoken lines in quotation marks; whatToDo and whyItMatters up to 25 words each.
- E, "money, health, relationships": the same form as A, but the settings are money, health and relationships.

Across the five sets, never reuse a scenario or a name. Every example has a different name.

@@PLAIN@@

Output only this JSON (no code fence):
{"variants": [ {"label": "A", "approach": "one decision moment", "examples": [ {"title": "...", "tags": ["work"], "scenario": "...", "whatToDo": "...", "whyItMatters": "..."}, ... 3 items ]}, ... B, C, D, E ]}

<lesson>
@@LESSON@@
</lesson>
