# Source Discovery

## Decision

The run locks to the public-domain George Long translation of **Thoughts of Marcus Aurelius Antoninus**, used as the working text for **Meditations**.

## Why this edition

- Project Gutenberg ebook `15877` provides a complete twelve-book English text and explicitly identifies George Long as translator.
- Project Gutenberg ebook `2680` independently confirms the standard English title **Meditations** and the same twelve-book structure.
- Wikipedia corroborates the work's conventional twelve-book framing and wider translation context.
- The manifest entered with curly-quote corruption and a hyphenated author field, but the title and author were still unambiguous enough to auto-lock without a user question.

## Source ladder outcome

1. Public-domain full text exists and is frozen locally.
2. A second public-domain text exists for title and structure cross-checking.
3. Reputable secondary reference exists for translation context and structural corroboration.

## Working constraints

- Paraphrase first unless an exact line is directly supported by the frozen George Long text.
- Chapter briefs and sidecars must stay narrower than the temptation to import later Stoic commentary from memory.
- Book titles are treated as `Book I` through `Book XII`; later chapter intents must come from the frozen text, not from external summary drift.
