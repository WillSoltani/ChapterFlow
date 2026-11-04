You wrote the ChapterFlow chapter below for a published book whose text is not available here. It teaches one lesson (see the lesson card). Three style rules were settled after the book was written; apply them to this chapter with find/replace edits and change nothing else: not a fact, not a quiz key, not a paragraph break, not a field's length by more than a few words.

RULE 1, PRONOUNS. The invented people of this chapter (the modern everyday scenes, not the book's historical figures) are: @@NAMES@@. Right now each of them is named on every mention ("Maren has just taken over the family diner from Maren's father"). Give each one a pronoun (he, she or they: choose what fits the name and the scene, and keep it for that person through the whole chapter) and use it the way a novelist would. The name appears on the person's first mention in each summary length, in each example, and in each quiz question or card where the person appears, and again wherever a pronoun would be unclear because two people share a sentence or a paragraph switches between people. Everywhere else, the pronoun, possessives included ("her father", "his notes", "their crew"). Do this in every field where these people appear: the hook, all three summary lengths, examples, quiz stems, choices and explanations, review cards, and the practice plan.

RULE 2, NO SENTENCE ABOUT "THE LESSON". A sentence whose subject is the lesson or the rule being gentler or softer ("The lesson is softer in only one way: ...", "The lesson for you is gentler, because ...", "Your lesson is gentler: ...", "This lesson is gentler and takes your side, because ...") is replaced, in the same place and at about the same length, by the same advice said straight to the reader: "You may aim higher later, on purpose, once this win is safe." "For you, the milder move is to keep your name on your own work." "You may be the one picked to take the fall, so read this from the other side." Keep the content and the contrast with the author's harsher rule; drop the framing that names the lesson. The examples above show the move, not the words: write the sentence in words of your own for this chapter, and do not reuse "For you, the milder move is" or any other example phrase as it stands.

RULE 3, FINDINGS. Any findings listed under ISSUES below are specific to this chapter; fix each with the smallest edit, cutting where cutting is safe. Where you are confident a finding is wrong, leave the text and say why in "declined".

Rules for edits:
- "field" is the field id as it appears in brackets in the chapter text, for example breakdown.fullRead, quiz.q3.explanation, quiz.q3.choices.1, examples.ex01.scenario, reviewCards.rc2.back, implementationPlan.ifThenPlans.0.plan or hook. You may also replace a whole short field (find = its full text).
- "find" must be copied exactly from that field, be long enough to be unique in it, and stay inside one paragraph. To rewrite a paragraph, use one edit with find = that paragraph's full text; for rule 1 that is usually the cleanest way, one edit per paragraph that mentions an invented person. "replace" is the new text.
- Many edits are expected. Cover every mention; a chapter that still names a person on every line has not applied rule 1.
- Never change keyTakeaway, memorableLines, a quiz key or the author's historical figures. Never add a quotation, a name, a number, a date or a motive.

Output only this JSON (no code fence):
{"edits": [{"field": "...", "find": "...", "replace": "..."}], "keyChanges": [], "declined": [{"issue": <int>, "reason": "..."}]}

@@BOOK_SECTION@@

ISSUES:
@@ISSUES@@

<lesson>
@@LESSON@@
</lesson>

<chapter>
@@CHAPTER@@
</chapter>
