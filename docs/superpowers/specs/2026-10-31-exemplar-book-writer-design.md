# Why the pipeline could not write Law 1 on its own, and the exemplar-driven book writer (2026-10-31)

The owner approved the assembled Law 1 of *The 48 Laws of Power* (`runs/the-48-laws-of-power/ch01/final.json`) and asked: why can the pipeline not produce this on its own, and how does every chapter of a book come out like it?

## Part 1. What is wrong

1. **The owner's taste never reached the writer.** v24 and v25 replaced it with rulebooks (330+ checks) and graders that could not tell good from bad. v26's `write` writes a whole chapter from generic rules with no example of the wanted form, and nothing the owner picked ever enters its prompt.
2. **The form was left to chance.** Each call chose its own opener, example shape, quiz shape and card shape. Law 1 is good because a *form* was chosen from real alternatives: a problem-scene summary, one-decision-moment examples, a one-of-each quiz, mixed cards, specific-cue practice. A writer told only "be interesting" lands on that form sometimes.
3. **Lesson and prose decided in one breath.** The variants flow chose the lesson first (five candidates, best evidence, no cliché) and wrote everything to it. `write` does both in one call, so a weak lesson drags a whole chapter down.
4. **Text mode only.** `write`, `check` and `fix` refuse a book without source text, so a copyrighted title had no path at all until knowledge mode.
5. **No fix path for knowledge-mode flags.** The fact check finds real errors (Fouquet's motive, the softened advice) and nothing could apply them.
6. **Sameness across a book was never handled here.** Forty-seven more "Maya at Monday's meeting" chapters would read as one chapter. v24 hit this and built a 1,400-line device detector; the fix is a ledger in the prompt.

## Part 2. The fix: write every chapter against the approved exemplar

The approved chapter becomes the **exemplar**: the model of form every other chapter is written to match, with its scenes, names and sentences forbidden. The pipeline per chapter is three to five calls, about $1.20:

| Step | Call | What |
|---|---|---|
| 1. Lesson | Opus | Five candidate lessons, best first (the existing variants prompt), with every lesson already taught in this book listed as off limits. Candidate 1 drives the chapter. |
| 2. Write | Opus | One call. Inputs: the exemplar chapter JSON, the approach rule for each part the owner picked (the summary opener rotates through the openers the owner approved, so neighbouring chapters never open the same way), the owner's notes, the lesson card, the chapter's `keys` (the author's advice in blunt words, knowledge mode), the source rules (text or knowledge), and the variety ledger (names, settings, analogies and the recent chapters' opening and closing sentences: never reuse). Output: the full chapter JSON in the exemplar's form, plus a `_used` sidecar naming the opener used and the new chapter's names, settings and analogies. |
| 3. Checks | none | App validator, shape, counts and tier lengths against the exemplar (±20%), no quotations in knowledge mode, meta chatter, outside facts, prompt vocabulary in reader text (reported), exemplar copy (its invented names and any eight-word run block; the book's own people pass), variety (a name from another chapter, a six-word run shared with another chapter's summaries, or a repeated opener: reported). |
| 4. Fact and keys | Opus + Sonnet | Fact check of the three summary lengths (knowledge or text prompt). Blind key solver: questions 1 to 5 from what a new reader sees; a wrong pick, a second defensible choice or "not in text" blocks. |
| 5. Fix | Opus, at most once | Only blocking issues, smallest edits (find/replace through the existing fix engine), then steps 3 and 4 again. Leftovers go to the owner. |
| 6. Land | none | `final.json`, `status.json`, `lesson.json`, the reading page; `_used` appended to `variety.json`. |

Book level: chapters run three at a time, resume from files, stop at the budget or a usage limit; a duplicate-name report across chapters at the end; `pack` renders chosen chapters into one reading page.

**Rollout.** Pilot three laws first (2, 24, 48: early, middle, last). The owner reads them next to Law 1. If they hold, the remaining 44 run unattended (about $55, about 90 minutes). Any chapter the owner dislikes goes back through `variants` and `assemble`, and its approved result joins the exemplars.

### Changes from the critique pass (2026-10-31)

Three lenses (sameness, exemplar leakage, knowledge-mode accuracy), each finding refuted by two skeptics; 4 of 18 survived:

1. **Rotate the opener.** The owner rated summary openers A, B and D Excellent; the exemplar record carries `approved.summary` and chapter n opens as `approved[(n-1) mod k]`. The exemplar's path, lengths and ending stay the model.
2. **Prompt words leak into reader text.** "acts out the wrong belief", "near-miss", "the story shows" came back verbatim. The shared plain-words block forbids them and a 0-call check reports them.
3. **Forbid invented names only.** The exemplar's own people (Fouquet, Louis XIV) recur in later laws legitimately; the book's people come from the five candidate lessons' story names, and only the exemplar's invented names block.
4. **Softening is systematic.** Writer and checker share a gentler reading of a blunt book. Each chapter carries `keys`: the author's advice in blunt words, drafted once by `keys` and edited by the owner. The lessons, writer, checker and fix calls read it; the rule is "the lesson may be gentler; the account of his advice may not, and say where you go softer"; the reading page shows it under the takeaway so the owner spots a nice-ified law at a glance.

Dropped by the synthesis as judges in disguise: parsing the owner's notes for "Excellent", a model call to sort names, a check that the lesson covers the whole law, any opener-rhythm detector beyond the ledger sentences and the six-word report.

## Part 3. What stays out

No judge, no reader panel, no rubric, no device detector. Facts, quiz keys and renderability block; everything else is the owner's read. The exemplar is data the owner produced, not a rule a session wrote.

## Part 4. Build

- `src/approaches.ts`: the single source of the five approaches per component; the variants prompts render their lists from it, and the writer gets the picked rules.
- `prompts/write-exemplar.md`: the writer call. `prompts/fix-knowledge.md`: the fix call without source text.
- `src/book.ts`: `writeBookChapter`, `runBook` (pool, resume, ledger), the variety ledger, the exemplar loader.
- `cli.ts`: `book` and `pack` verbs.
- `tests/book.test.ts`: hermetic, with the fake `claude`.

## Risks the critique pass checks

- The writer copies the exemplar instead of matching its form (names, scenes, phrasing).
- Forty-eight chapters still read alike despite the ledger (same settings, same rhythm).
- Knowledge mode invents facts the checker also believes.
- The exemplar's quirks (its five fact flags) get replicated.
