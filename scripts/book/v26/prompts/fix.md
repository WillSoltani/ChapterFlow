You wrote the ChapterFlow chapter below. It teaches one lesson (see the lesson card), and the book's story is its evidence. Checkers compared it with the chapter's source text and with what a new reader needs, and their findings are listed under ISSUES. Fix each issue with the smallest edit that makes the chapter true to the source, keeps every part about the lesson, and makes every quiz key the one right answer.

Rules:
- The source between <source> tags is the only authority for the book's people and events. Where a checker is wrong (the source does support the text), leave the text and say why in "declined".
- Edit only flagged text. Keep plain words, the opener → problem → story → lesson path of each tier, the paragraph breaks (blank lines) and the lengths.
- Explain or replace a hard word; never chop sentences into fragments to pass a readability check. When the hard word carries a fact (a coin, an amount, a name, a place), keep it and explain it in a few plain words ("sixpence, a small coin"); never swap a fact for a vaguer one.
- A quotation presented as the author's words must be copied exactly from the source, or removed.
- Never change keyTakeaway: a code check requires it to equal the lesson card's lesson, and you cannot edit the card. If an issue says the lesson itself is wrong or repeats an earlier chapter's lesson, decline it (a wrong lesson is redone by a rewrite, not here). Change the first memorable line only when an issue names memorableLines.0.
- For a quiz problem, you may reword the stem, a choice or the explanation, or change the key. Never move text from one choice to another.
- If a quiz question is "guessable without the chapter", look for the giveaway first: usually the right answer is the only short, plain choice while the others carry long "since..." reasons, or a wrong choice is silly. Rewrite the choices so all three have the same form and length, the wrong-belief choice is what a sensible person would really pick, and the near-miss is reasonable. Do not make the right answer obscure.
- If a new reader could not answer q1-q5 from the hook, counterintuition, fastRead, memorable lines, tryThisNow and first example, make fastRead state the lesson more clearly. Never add more story.
- "field" is the field id as it appears in brackets in the chapter text, for example breakdown.fullRead, quiz.q3.explanation, quiz.q3.choices.1, examples.ex01.scenario, reviewCards.rc2.back, implementationPlan.ifThenPlans.0.plan or memorableLines.1. You may also replace a whole short field (find = its full text).
- "find" must be copied exactly from that field, be long enough to be unique, and stay inside one paragraph. To rewrite a tier's opener, its ending or a whole paragraph, use one edit per paragraph with find = that paragraph's full text. "replace" is the new text.
- If an issue says the lesson sentence is repeated in too many fields, reword those sentences around the lesson card's keyPhrase instead of the whole sentence.
- A key change names the new index and repeats that choice's full text exactly as it reads after your edits.

Output only this JSON (no code fence):
{"edits": [{"field": "...", "find": "...", "replace": "..."}], "keyChanges": [{"questionId": "q3", "newIndex": 1, "keyedChoiceText": "<full text of choices[1]>"}], "declined": [{"issue": <int>, "reason": "..."}]}

ISSUES:
@@ISSUES@@

<lesson>
@@LESSON@@
</lesson>

<chapter>
@@CHAPTER@@
</chapter>

<source>
@@SOURCE@@
</source>
