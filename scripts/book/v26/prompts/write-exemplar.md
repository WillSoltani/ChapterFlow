You are writing one chapter of a ChapterFlow book to the standard of a chapter the owner approved. ChapterFlow is a learning app, not a storyteller. Each chapter teaches ONE lesson from the book: one usable idea the reader understands, remembers a week later, and can use in their own life. The book's story is the evidence for that lesson, not the product.

THE READER: an adult beginner, busy and curious, not a scholar. They read everyday English on a phone. They keep reading when something makes them curious and makes sense to them. They leave when the page turns into a history lesson, a list of facts, or a lecture.

HOW THEY MEET THE CHAPTER: first the hook in large type with the counterintuition under it. Then ONE summary length, and for most readers that is the short one (fastRead). Then tryThisNow and the memorable line, then the first example (the others open on a tap), then the first five quiz questions in the order you write them, then the practice plan and the review cards. So the hook, the counterintuition, fastRead, the first example and questions 1 to 5 must be your best work.

@@BOOK_SECTION@@

@@HEADER@@

@@SOURCE_RULES@@ @@QUOTE_RULE@@

@@KEYS@@

THE LESSON this chapter teaches is in the lesson card between <lesson> tags. "keyTakeaway" is exactly its "lesson" sentence. Every part of the chapter serves this lesson and adds something: a case, a reason or a step. The lesson may be the version a fair reader would use today. When you tell what the author advises, tell it as he gives it, even where it is harsh. A limit gets ONE sentence per summary length, and only in two cases. First, the author's advice above names a limit of its own (a reversal): give it in deepRead and fullRead, as the author's limit, and leave it out of fastRead. Second, the lesson is gentler than the author's advice: then each summary length tells the reader so once, in the second person or impersonally, in words of your own for this chapter. When neither case holds, write no limit at all. A limit is never the last or second-to-last sentence, never a sentence about what the author "does not say", never about "the lesson" or "the rule" being gentler, never in the first person, and no quiz question or review card tests it. The chapter has no narrator: the word "I" appears only inside a quoted line of dialogue. The bar is what this book says: where the book and history differ, follow the book and do not correct it.

THE EXEMPLAR between <exemplar> tags is a chapter the owner read and approved. It shows the bar: how good each part is, how plain the words are, how every part serves one lesson, and the JSON shape. It does not set this chapter's opener, the order of its ideas, the order of its quiz and card forms or its key positions: THE PLAN below does, and where the plan and the exemplar differ, the plan wins. Copy NOTHING from it.
- Never reuse: its people, names, places, scenes, objects, analogies, opening sentence frames, title pattern, or any sentence. A reader of the whole book must never notice two chapters built on the same scene or the same person.
The owner's notes on the exemplar: @@NOTES@@

THE PLAN for this chapter, part by part:
@@FORM@@

PRONOUNS. Give each invented person a pronoun (he, she or they, chosen to fit the name and kept through the chapter) and use it the way a novelist would after the first mention in each part; repeat the name only where two people share a sentence. Never "Maren has just taken over the diner from Maren's father".

VARIETY. The first names, settings and analogies already used in this book are listed between <used> tags. Use none of them. Choose new first names (varied in origin and gender), new workplaces, homes, sports and hobbies, and new everyday objects. Vary the opening rhythm too: do not start the hook or the summaries with the same sentence shape the exemplar uses.
<used>
@@USED@@
</used>

Write one JSON object with exactly these keys and shapes (the app rejects any other field name):
{"title": "...", "hook": "...", "counterintuition": "...", "keyTakeaway": "...", "tryThisNow": "...",
 "memorableLines": [{"text": "..."}@@MEMORABLE_RULE@@],
 "breakdown": {"fastRead": "...", "deepRead": "...", "fullRead": "..."},
 "examples": [{"exampleId": "ex01", "title": "...", "tags": ["work"], "scenario": "...", "whatToDo": "...", "whyItMatters": "..."}, ...],
 "quiz": {"passingScorePercent": 70, "questions": [{"questionId": "q1", "prompt": "...", "choices": ["...", "...", "..."], "correctIndex": 0, "explanation": "...", "bloomsLevel": "apply"}, ...]},
 "reviewCards": [{"cardId": "rc1", "front": "...", "back": "...", "difficulty": "easy"}, ...],
 "implementationPlan": {"coreSkill": "...", "ifThenPlans": [{"context": "When I ...", "plan": "then I ..."}, {"context": "When I ...", "plan": "then I ..."}], "twentyFourHourChallenge": "...", "weeklyPractice": "..."},
 "_used": {"approach": "A", "names": ["..."], "settings": ["..."], "analogies": ["..."]}}
Field rules:
- "title": up to 60 characters; names the lesson or the problem, not a scene.
- "hook": one or two sentences, up to 25 words, about the reader's own life, in the opener's approach: a concrete picture, or a blunt claim with a turn in it. It makes sense with nothing before it. No dates, no facts about the author, no statistics, no teasers, and not the takeaway said again.
- "counterintuition": up to 45 words, in the frame THE PLAN gives: the belief most people hold, the correction, and the reason. It adds the reason; it does not repeat the hook's words.
- "tryThisNow": up to 25 words; one small visible action any reader can do today; starts with a verb and says when or where. The action only: no reason, no moral, no sentence about what it shows.
- "memorableLines" item 1: the lesson in fresh words, up to 15 words, no quotation marks inside.
- The three summary lengths are three versions of the same telling: same opener, same path, same ending; a reader reads only one. Paragraphs are separated by a blank line. Follow the path THE PLAN gives. Tell only the part of the book's evidence that shows the lesson, in plain modern words; when the chapter has no story of its own, work the author's method through one everyday case instead. Every paragraph adds a step, a reason or a case. A paragraph that only says the last one again is cut, and a length runs under its ceiling when the chapter has less to say: never pad. In an invented scene, give one detail a reader can picture (an object, a place, a time of day, a line someone says) and say what the person stands to lose; in the book's own story, add no detail the book does not give. End by returning to the opening and stating the lesson once, plainly, in fresh words, in a line a reader could underline, and stop.
- Examples: each is a short modern situation with one detail a reader can picture, and each ends with the right move in whatToDo. They do three different jobs. Example 1: the lesson's move in an ordinary situation, ending at the moment of choice. Example 2: the person has already tried the fix most people reach for; show it and what it cost, then the moment they can do it right. Example 3: a harder situation, where someone pushes back or a strong feeling is in the way. A reader who opens all three learns something new from each. Titles name the situation, never the job. Tags: one each of "work", "school" and "personal", in the order THE PLAN gives ("school" covers any class or course an adult might take; "personal" covers home, money, health, friends and family).
- Quiz: a new modern situation in every question, no names from the book. Each wrong choice is something a sensible person would really do or think in that situation: the right tool at the wrong moment, the right step in the wrong order, the lesson overdone, or a fix for a different problem. At most two questions use the plain opposite of the lesson as a wrong choice, and no wrong choice is silly or extreme: none says "always", "never", "no matter what" or "at all". Every wrong choice is still clearly wrong once the lesson is applied, and the "explanation" (up to 40 words) says why the wrong choice a reader is most likely to pick fails here. The three choices share one form and one length, within about three words of each other; the right choice sits at the position THE PLAN gives. Questions 1 to 5 are answerable from the hook, counterintuition, fastRead, memorable line, tryThisNow and the first example.
- Cards: for weeks later, without the chapter; no names from the book; at most one asks for the lesson itself.
- Practice: each if-then cue is a moment nearly every reader meets in an ordinary week (a routine moment, a thought they catch themselves having, a remark people often hear), written as "When I ...", up to 14 words, with no invented props and no named people. Its plan starts "then I ..." and is one action. Never "tomorrow". The 24-hour challenge differs from tryThisNow.
- "_used": "approach" is the letter of the summary opener you used (the one THE PLAN asks for); then every first name you used anywhere in the chapter, every setting (a workplace, a sport, a room, a shop), and every analogy or object the summaries lean on. Readers never see it.

@@PLAIN@@

Output only the JSON object: no code fence, no commentary.

<lesson>
@@LESSON@@
</lesson>

<exemplar>
@@EXEMPLAR@@
</exemplar>

@@SOURCE_BLOCK@@
