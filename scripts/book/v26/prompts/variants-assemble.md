You are assembling one ChapterFlow chapter from the parts the owner picked. ChapterFlow is a learning app, not a storyteller: each chapter teaches ONE lesson, and the book's story is the evidence. The owner read five versions of each part and chose these, so their wording stays: copy each picked part into the chapter unchanged, except where a FIX or an OWNER NOTE below asks for a change.

@@BOOK_SECTION@@

@@HEADER@@

@@SOURCE_RULES@@ @@QUOTE_RULE@@

THE LESSON is in the lesson card between <lesson> tags. THE OWNER'S PICKS are between <picks> tags. FIXES TO APPLY are between <fixes> tags: the fact checker's findings on the picked summary; apply each with the smallest edit that makes the text true to the book.

Write the chapter as one JSON object with these keys, in this order:
- "title": up to 60 characters. It names the lesson or the problem, not a scene.
- "hook", "counterintuition", "tryThisNow": copied from the picked summary version.
- "keyTakeaway": exactly the lesson sentence from the lesson card.
- "memorableLines": [{"text": the picked memorableLine}]@@MEMORABLE_RULE@@
- "breakdown": {"fastRead", "deepRead", "fullRead"}: three lengths of the picked summary. Each keeps the picked opener (the same scene, question, people or analogy), the same path (opener, why the wrong belief feels true, the chapter's story as evidence, back to the opening, the lesson in fresh words) and the same ending. A reader reads only one, so each stands alone, and paragraphs are separated by a blank line.
  - "fastRead": @@FAST@@ words in 2 or 3 paragraphs. The picked summary made shorter: keep its opener and its ending, tell the story in a few sentences.
  - "deepRead": @@DEEP@@ words in 3 to 5 paragraphs. The picked summary as it is, extended only if it is under the band.
  - "fullRead": @@FULL@@ words in 6 to 9 paragraphs of 60 to 140 words. The picked summary expanded with more of the chapter's evidence: another episode the chapter tells, the author's reasoning, and the limits of the lesson. Never plot for its own sake; the story stays under about half the words, and the chapter still ends on the lesson.
- "examples": the picked 3, unchanged, with "exampleId" "ex01", "ex02", "ex03".
- "quiz": {"passingScorePercent": 70, "questions": [...]}: the picked @@PICKED_QUIZ_COUNT@@ questions unchanged (ids "q1".. in their order), then @@EXTRA_QUIZ_COUNT@@ more in the same form and approach ("@@QUIZ_APPROACH@@"): new modern situations, no names from the book, three choices in one form and about one length, one wrong choice that acts out the wrong belief and one near-miss, and the key never the longest choice. Across all @@QUIZ_COUNT@@ questions each position is the key at least twice. Questions 1 to 5 must be answerable by a reader who read only the hook, counterintuition, fastRead, memorable line, tryThisNow and the first example.
- "reviewCards": the picked 5, unchanged, with "cardId" "rc1".."rc5".
- "implementationPlan": the picked plan, unchanged.

@@PLAIN@@

Output only the JSON object: no code fence, no commentary, and no "_lesson" key.

<lesson>
@@LESSON@@
</lesson>

<picks>
@@PICKS@@
</picks>

<fixes>
@@FIXES@@
</fixes>

@@SOURCE_BLOCK@@
