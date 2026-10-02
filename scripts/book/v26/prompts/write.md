You are writing one chapter of a ChapterFlow book: a short lesson that a beginner reads on a phone. ChapterFlow is a learning app, not a storyteller. Each chapter teaches ONE lesson from the book: one usable idea the reader understands, remembers a week later, and can use in their own life. The book's story is the evidence for that lesson, not the product.

THE READER: an adult beginner, busy and curious, not a scholar. They read everyday English. They keep reading when something makes them curious and makes sense to them. They leave when the page turns into a history lesson, a list of facts, or a lecture.

THE SOURCE: the chapter's text is between <source> tags. It is your only authority for the book's people and events: names, numbers, dates, order, causes and motives. If the source does not say why something happened, do not supply a reason. Never add outside facts anywhere (no statistics, studies, dates, or real events or people from outside the source). Invented modern situations are fine; invented facts are not. The block headed EDITOR'S NOTES was written by a later editor, not the author: never quote it as the author.

@@BOOK_SECTION@@

STEP 1. FIND THE LESSON, and write it first, in "_lesson".
- Read the whole source. Choose the one lesson with the best evidence in this chapter that is most useful to a reader today. If the author states his own reflection or rule, build the lesson on it.
- "lesson": one sentence of 8 to 20 plain words, present tense, no names. It must be a claim about how to think or act that a reader could repeat a week later. Example of the form (from a different book): "Asking for help early saves more time than struggling alone."
- "wrongBelief": the common belief this lesson corrects, the way a sensible beginner would say it. If no sensible adult would believe it, the lesson is a cliché (work hard, be honest, learn from mistakes): choose a sharper one that names a specific move and when to use it.
- "keyPhrase": 2 to 4 words that name the lesson's move. Use it in a few places where it helps the reader remember (the coreSkill, one card, a tier ending); everywhere else say the specific move in plain words. It is not a label to stamp on every field.
- "hookQuestion": the question the hook makes the reader wonder about. The lesson is its answer.
- "storyNames": the names of people and places from the source that you use.
- "evidence": 1 to 3 short passages, copied word for word from the source, that show the lesson.

STEP 2. WRITE EVERY FIELD TO TEACH THAT LESSON. Each field adds something new: a case, a reason or a step. A field that would still make sense without the lesson is wrong. So is a field that only repeats the lesson.

Write one JSON object with the keys in this order:
- "_lesson": {"lesson", "wrongBelief", "keyPhrase", "hookQuestion", "storyNames", "evidence"}, as above. Readers never see it.
- "keyTakeaway": exactly the lesson sentence.
- "counterintuition": up to 45 words, in the shape "Many people think [the wrong belief]. Actually [the correction], because [the reason]." End on the correction.
- "hook": up to 40 words. Open the hookQuestion with a real problem from the reader's own life: a moment where the obvious move (the wrongBelief) backfires, a surprising contrast between two people or two choices, or a small puzzle set in a concrete moment. The reader should feel the problem and not yet know the answer. It does not have to mention the book. No dates, no facts about the author, no statistics, and no teasers like "the secret is".
- "tryThisNow": up to 40 words. One small, visible action any reader can do today that uses the lesson, even if they are not in the chapter's situation right now: something they write, say, send, set or remove, never "think about" or "reflect on". Start with a verb, say when or where, and give one short reason about what they will see or gain, not the lesson restated. Never a summary, a moral, or the story.
- "memorableLines": 1 to 3 objects {"text"}.
  - Item 1 is the lesson in fresh words: up to 15 words, general, present tense, one useful sentence a reader can act on, not a slogan.
  - Items 2 and 3 are optional; most chapters need none. They are the author's own words, copied exactly from the source, only if they carry the same lesson and a beginner can read them without help (a quoted line cannot be explained, so no old or hard words).
  - Do not put quotation marks inside the text.
- "examples": 3 objects {"exampleId": "ex01".., "title", "tags", "scenario", "whatToDo", "whyItMatters"}.
  - Each is one modern person at one moment where the wrong belief tempts them. Use one setting each: "work", "school" and "personal" (that word is the example's only tag).
  - "scenario": 40 to 75 words, simple and specific.
  - "whatToDo": up to 35 words. The concrete step this person should take here, starting with the step itself.
  - "whyItMatters": up to 30 words. Why it matters for this person, here.
  - Nobody in an example has read the book, and no example retells the story.
- "implementationPlan": {"coreSkill", "ifThenPlans", "twentyFourHourChallenge", "weeklyPractice"}.
  - "coreSkill": up to 20 words.
  - "ifThenPlans": 2 objects {"context": "When [a specific moment the reader will meet]", "plan": "then I [one visible action from the lesson]"}. Cues are real moments (after dinner, before a meeting), never "tomorrow" or "when I have time".
  - "twentyFourHourChallenge": a different action from tryThisNow that builds on it, not the same task again.
  - "weeklyPractice": a short habit that keeps using the lesson.
- "quiz": {"passingScorePercent": 70, "questions": 7 objects {"questionId": "q1".., "prompt", "choices" (3 strings), "correctIndex", "explanation", "bloomsLevel": "understand" | "apply" | "analyze"}}.
  - Each question puts the reader in a new, modern situation (no names from the book) and asks what to do or why. Answering it needs the lesson; remembering the story never helps.
  - One wrong choice acts out the wrong belief and should sound sensible. The other wrong choice is a near-miss: it sounds close, but the lesson clearly rules it out, so a reader who knows the lesson would never call it equally right. Two checkers block any question where a second choice is also defensible.
  - Write the three choices in the same form and about the same length (roughly 8 to 16 words each): if one gives a reason, all three give one. The tempting choice is tempting because a sensible person would really pick it before reading this chapter, not because it carries a longer justification. The near-miss is something a thoughtful person might also pick, never a silly option.
  - The right choice is not the longest or the shortest, not the only plain one, not the only hedged one, not the only one using the chapter's words, and not simply the kindest-sounding.
  - q1-q5 must be answerable by a reader who read only the hook, counterintuition, fastRead, memorable lines, tryThisNow and the first example. q6 and q7 may be harder.
  - Spread the keys: each position is the right answer at least twice.
  - "explanation": up to 40 words. Which part of the lesson the right choice uses, and why the tempting choice fails.
- "reviewCards": 5 objects {"cardId": "rc1".., "front", "back", "difficulty": "easy" | "medium" | "hard"}.
  - Cards are for review weeks later, without the chapter.
  - "front": up to 25 words. A short situation or a "why does this work?", with no names from the book.
  - "back": up to 30 words. The move, plus a one-line reason.
  - At most one card asks the reader to state the lesson.
- "breakdown": {"fastRead", "deepRead", "fullRead"}. These are three versions of the same lesson. A reader reads only one, so each must stand alone.
  - Every tier follows the same path:
    1. Open with the hook's question in a fresh form: an everyday scene, a question or a puzzle.
    2. Widen the problem: why the wrong belief feels true, and what it costs, shown with a concrete case rather than general talk about "today's world" or "most of us".
    3. Tell only the part of the story that shows the lesson, in plain modern words; leave out the chapter's other events, however good. Name only the people the lesson needs and call the rest by their role (his brother, a friend). Add one sentence that says how the story shows the lesson.
    4. End by answering the opening question. Go back for a sentence or two to the opening scene or the reader's own situation and show what the lesson changes there; then state the lesson once, plainly and in general words, as the payoff. Word it freshly (not the keyTakeaway sentence copied) and stop there: no sermon or "so next time" pep talk after it.
  - "fastRead": 150 to 220 words in 2-3 paragraphs. It may quote the author once.
  - "deepRead": 350 to 500 words in 3-5 paragraphs, with at most 2 short quotes.
  - "fullRead": 800 to 1,100 words in 6-9 paragraphs of 60 to 140 words, with at most 3 short quotes. It adds evidence, not plot: more of the episode that shows the lesson. Use a second episode only if it shows exactly the same lesson in a new situation; a nearby virtue (honesty in general, courage, speaking openly) is a different lesson, so leave it out. The story stays under about half the words; use the rest on why the lesson works, and still end on the lesson.
  - Quote the author only where his words carry the lesson. Copy them exactly from the source, inside double quotes, and explain any old-fashioned word in the same sentence.
  - Separate paragraphs with a blank line ("\n\n").
- "title": up to 60 characters. It names the problem or the lesson, not a scene.

PLAIN WORDS (every field): use a 12-year-old's vocabulary for an adult's intelligence.
- Use everyday words.
- Sentences average 12 to 18 words, and none goes over 25.
- Connect ideas with because, so and but. When you tell the story, use because or so only where the source itself gives the reason; otherwise use and, then or but, since an invented cause is a fact error.
- If a hard or old word must stay, explain it right there.
- Talk to the reader as "you" where it fits.
- Never chop sentences into fragments to sound simple.

@@HEADER@@
@@RERUN_NOTE@@

<source>
@@SOURCE@@
</source>

Before you answer, check the rules most often missed:
- "storyNames" and "evidence" in _lesson are arrays of strings; each example's "tags" is a one-item array such as ["work"]; "correctIndex" is 0, 1 or 2.
- The lesson is not one of the earlier lessons listed above the source.
- Besides keyTakeaway, the lesson sentence's exact words appear in at most two fields. End each tier on the lesson in that tier's own words. Do not open whatToDo, explanations or card backs with the keyPhrase; say the specific move instead.
- In the quiz, each position is the key at least twice, the key is never the longest choice, and no prompt is over 30 words.
- No sentence is over 25 words, and every quotation of the author is copied exactly from the source.

Output only the JSON object: no code fence, no commentary.
