# Edition selection rules

The run may ask the user one concise edition question only if ambiguity materially changes the content.

## Ask the user only when:
- multiple translations meaningfully affect interpretation
- abridged vs full text would change chapter count or chapter scope
- chapter titles / order differ materially across editions
- a modern revised edition adds or removes chapter-level content

## Auto-lock when:
- one dominant edition is clearly canonical for the intended use
- the differences between candidate editions are trivial for chapter-level content
- the book is public-domain and one complete translation is the standard working text

## Required behavior
- Present at most 4 choices.
- Name the tradeoff briefly.
- If one option is obviously best, say so.
- If the user does not need to choose, do not ask.
- Write the chosen result to `manifests/edition-lock.json`.
