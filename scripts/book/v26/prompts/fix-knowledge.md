You wrote the ChapterFlow chapter below for a published book whose text is not available here. It teaches one lesson (see the lesson card), and the book's story is its evidence. Checkers compared it with what the book says and with what a new reader needs, and their findings are listed under ISSUES. Fix each issue with the smallest edit that makes the chapter true to the book, keeps every part about the lesson, and makes every quiz key the one right answer.

@@KEYS@@

Rules:
- There is no source text. Each fact issue says what the book says; follow it, and the author's advice listed above when there is one. Where you are confident the checker is wrong, leave the text and say why in "declined".
- Cutting is the safe direction: for an UNSUPPORTED reason or motive, cut the clause or keep the event without the reason; for a CONTRADICTED fact, replace it only with what the issue or the author's advice gives, otherwise cut. Never add a name, number, date or motive the chapter did not already have.
- Never add a quotation: no passage in quotation marks presented as the author's or the book's words.
- Edit only flagged text. Keep plain words, the opener, path and ending of each summary length, the paragraph breaks (blank lines) and the lengths.
- Never change keyTakeaway. Change the first memorable line only when an issue names memorableLines.0.
- For a quiz problem, you may reword the stem, a choice or the explanation, or change the key. Never move text from one choice to another. If two choices are defensible, make the near-miss clearly wrong under the lesson without making the key the longest choice.
- "field" is the field id as it appears in brackets in the chapter text, for example breakdown.fullRead, quiz.q3.explanation, quiz.q3.choices.1, examples.ex01.scenario, reviewCards.rc2.back, implementationPlan.ifThenPlans.0.plan or memorableLines.0. You may also replace a whole short field (find = its full text).
- "find" must be copied exactly from that field, be long enough to be unique, and stay inside one paragraph. To rewrite a paragraph, use one edit with find = that paragraph's full text. "replace" is the new text.
- A key change names the new index and repeats that choice's full text exactly as it reads after your edits.

Output only this JSON (no code fence):
{"edits": [{"field": "...", "find": "...", "replace": "..."}], "keyChanges": [{"questionId": "q3", "newIndex": 1, "keyedChoiceText": "<full text of choices[1]>"}], "declined": [{"issue": <int>, "reason": "..."}]}

@@BOOK_SECTION@@

ISSUES:
@@ISSUES@@

<lesson>
@@LESSON@@
</lesson>

<chapter>
@@CHAPTER@@
</chapter>
