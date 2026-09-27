You are writing one chapter of a ChapterFlow learning edition of Benjamin Franklin's Autobiography.
ChapterFlow readers are curious adults reading on a phone, 10-15 minutes per chapter. They came for Franklin: his stories, his wry voice, and ideas they can use. They leave when text feels generic, padded, or like a worksheet.

SOURCE: the full text of this chapter of the Autobiography (Gutenberg #20203, Pine edition) is below, between <source> tags. It is your ONLY authority for facts. Every name, number, date, sequence, motive and cause you state must be in it. If the source does not say why something happened, do not invent a reason. Footnote markers like [3] are editorial; ignore them.

WHAT TO WRITE (one JSON object; field names exactly as listed):
- "title": a short chapter title in plain words (max 60 chars).
- "hook": 1-2 sentences that make a reader want to start. Concrete, from the story. No questions addressed to "you".
- "counterintuition": 1-2 sentences: the idea in this chapter that runs against what a modern reader would expect.
- "keyTakeaway": one sentence a reader should remember.
- "tryThisNow": one small action a reader can do today, tied to the chapter's idea (1-2 sentences).
- "breakdown": { "fastRead", "deepRead", "fullRead" } - three reading depths. A reader picks ONE; each must stand alone.
  - fastRead: 120-180 words. The chapter's story and point in brief.
  - deepRead: 350-500 words, 3-5 paragraphs.
  - fullRead: 900-1300 words, 6-10 paragraphs. The main telling: Franklin's story in order, with the scenes and people that make it memorable, and what he took from them.
  - Separate paragraphs with a blank line ("\n\n"). Paragraphs of 40-130 words.
  - Voice: clear modern English, warm and a little wry, like a good biographer who loves the book. Let Franklin speak: quote his own words (exact, in double quotes) at least 4 times in fullRead and at least twice in deepRead. Vary sentence length naturally.
  - State plainly any limits or doubts Franklin himself admits (for example about his memory, his vanity, or his early mistakes).
- "examples": exactly 3 objects {"exampleId":"ex01".., "title", "tags": [2-3 short tags], "scenario", "whatToDo", "whyItMatters"}. Each is a short modern situation (60-120 words for scenario) where this chapter's idea helps; three different settings; no stock characters; do not retell Franklin's anecdote inside them. whatToDo: 1-3 sentences. whyItMatters: 1-2 sentences that explain the principle, not Franklin.
- "quiz": {"passingScorePercent": 70, "questions": [6 objects {"questionId":"q1".., "prompt", "choices": [4 strings], "correctIndex": 0-3, "explanation", "bloomsLevel": one of "remember","understand","apply","analyze"}]}. At least 3 questions test the story itself (answerable from the chapter's text); at least 2 test applying the idea. Distractors plausible and similar in length and tone to the key. Spread correctIndex across positions. Explanations cite the story.
- "reviewCards": 5 objects {"cardId":"rc1"..,"front","back","difficulty": "easy"|"medium"|"hard"} - question on front, short answer on back.
- "implementationPlan": {"coreSkill": 1-2 sentences, "ifThenPlans": [2 objects {"context","plan"}], "twentyFourHourChallenge": 1-2 sentences, "weeklyPractice": 1-2 sentences}.
- "memorableLines": 3 objects {"text"} - Franklin's own most quotable lines from this source, verbatim.

Output ONLY the JSON object. No code fence, no commentary.
