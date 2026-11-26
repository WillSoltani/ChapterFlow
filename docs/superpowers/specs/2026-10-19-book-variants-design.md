# Book pipeline review and the variants loop (2026-10-19)

Part 1 is the review you asked for. Part 2 is the design for what comes next. Both are short on purpose.

## Part 1. Review: what happened and why nothing shipped

### The history in five lines

| Version | When | Shape | Result |
|---|---|---|---|
| v21 | June | Chapters written from the model's memory of each book, with research sidecars. Deterministic gates and QC. | The 140-book catalog. Its "quality scores" come from graders that do not agree with close reading. |
| v24 | July | Whole-chapter GPT writer plus about 50k lines of gates, critics and review loops. | One book (High-Output Management) at 78.8, below your premium bar. |
| v25 | Jul to Sep | Four blind section writers per chapter under a 150k-character rulebook, 138 checks, a reader panel, repair loops. | About 1,500 model calls, $700 to $1,100 per run, ten weeks, zero publishable books. Franklin rev 6 failed a blind panel 6 of 6 with real source errors. |
| v26 W1 | Sep 28 | One Opus writer per chapter from the source text, a fact checker, a blind quiz solver. | Three chapters in a day for $8. You read them and rejected all three: story-first, not lesson-first. |
| v26 W1c | Oct 2 | Same calls, lesson-first brief: the writer picks one lesson first and every field serves it. Draft PR #589. | Three chapters for $33. Auto-judged 35/35. **You never read them.** The decision line R1c has been blank for 17 days. |

Code under `scripts/book/`: about 263,000 lines (v21 and v24 are near-duplicates of each other), 47 git worktrees, one 5,900-line CLI. The v26 tool is 2,700 lines of source and 6,000 of tests.

### The diagnosis

1. **Overengineering is proven, not suspected.** Not one of the 138 v25 section checks can tell whether a fact is true or a quiz key is right. The checks rejected 1,902 of 1,903 catalog chapters, including the books they were calibrated on. Each rule bred a new tic that needed the next rule. Most of the money went to grading, not writing.

2. **The real failure is the feedback loop, not the writer.** Every wave guessed your taste from a paragraph of notes, built a judge to stand in for you, tuned until the judge said 35/35, then handed you a pack. You were consulted twice in ten weeks. Your taste was never captured as data a prompt could use. A 35/35 judge score told the last session nothing about whether you would like the result.

3. **v26 is the right shape and is close.** I read its ch01 and ch13. Ch13 ("a small fix to something you face every day often adds more happiness than a rare windfall") is a real lesson, plainly told, with modern examples and quizzes that test the lesson. Ch01 ("check the means") is correct but preachy. Both are far better than anything v25 made. The remaining gap is taste, and only you can close it.

4. **A chapter costs $0.75 and five minutes to write.** That changes what the loop should be. Iteration is cheap enough that the owner reading real text, not approving plans, is the right gate.

### What to keep, bypass, and delete

- **Keep:** the v26 writer call, fact check, blind key solver, deterministic render checks, the app validator, and the Franklin and Bennett frozen sources.
- **Bypass now, delete after Franklin ships:** everything under `chapterflow-v24-author-pipeline/` except the two files v26 imports from it (`claudeRoute.ts`, `chapterMap.ts`), the v25 driver, the 35-item judge as a tuning target, and the reader panel.
- **Never delete:** the v21 gold corpus `state/` directories.

### Two things to know before launch

- **Source-grounded writing only works for public-domain books.** Franklin and Bennett have source text. A copyrighted title cannot be fed to the writer, so those chapters must come from the model's knowledge of the book and cannot be fact-checked against a source. The variants loop below works for both; the fact check does not.
- **The app hides the writing.** A new reader sees the short summary only. You decided on 2026-09-28 (R1-d = B) that the full telling should show by default. That app change was never made. The pick page below shows each summary at one length so this does not matter for calibration, but it matters for launch.

## Part 2. Design: the variants loop

### Goal

Capture your taste as data, cheaply, by showing you five real versions of each chapter component and recording what you pick and why. After two chapters of picks the writer prompt carries your choices as examples, and the rest of the book is written in one pass.

### What you will see, per chapter

One page. At the top, five candidate lessons from the chapter, with the one that drove the variants marked. Then one section per component, each with five variants labelled A to E. Each variant says which approach it takes, so your pick tells me the kind of thing you want, not only the one you liked.

| Component | What a variant contains | The five approaches |
|---|---|---|
| Summary | hook, counterintuition, the summary (250 to 350 words), try-this-now, the memorable line | A problem scene · B question or puzzle · C two people, two choices · D the surprising claim first · E a concrete analogy |
| Examples | 3 examples, each with scenario, what to do, why it matters | A one decision moment · B short and plain · C before and after · D a short dialogue · E money, health and relationships settings |
| Quiz | 5 questions, 3 choices each, key and explanation | A what do you do · B spot the trap in the thinking · C predict what happens · D best reply to a friend · E one of each |
| Review cards | 5 cards, front and back | A situation to move · B why-questions · C finish the sentence · D what went wrong · E mixed |
| Practice | core skill, 2 if-then plans, 24-hour challenge, weekly practice | A two-minute actions · B very specific cues · C involves another person · D track and count · E the shortest possible |

Every summary variant is fact-checked against the Franklin text before you see it, and any flag is shown under the variant. Nothing else contains Franklin facts.

Reading time per chapter: about 25 to 30 minutes.

### How you answer

Each variant has a **Pick** button and each component a notes box. A **Copy my picks** button at the bottom puts a short text block on the clipboard. Paste it into chat, or just tell me in words ("summary C, quiz A, the cards are all too wordy"). Either works.

### What happens with your picks

1. `assemble`: one writer call builds the full chapter from your picks (derives the short and full summaries from the one you chose, extends the quiz to 7 questions in the chosen form), then the existing v26 `check` runs (fact check, key solver, render checks).
2. Your picks, the rejected variants and your notes are saved as the chapter's **exemplar**. The writer prompt for later chapters includes the exemplars: "the owner chose these; the owner rejected these; the owner said this."
3. After two calibration chapters (13 first, then one you choose), the remaining 17 are written single-pass with exemplars, checked, and handed to you as a book.

### Cost and time

- Per chapter of variants: 7 Opus calls (1 lessons, 5 components, 1 fact check of the summaries), about $5 to $8, about 15 minutes with the component calls in parallel.
- Assemble plus check: about $3.
- The remaining 17 chapters single-pass: about $50.

### Code

All of it goes next to the existing v26 tool, on branch `v26/variants` built on PR #589.

| File | What |
|---|---|
| `prompts/variants-lessons.md` | five candidate lessons from the chapter source, ranked |
| `prompts/variants-summary.md`, `-examples.md`, `-quiz.md`, `-cards.md`, `-practice.md` | one call each; five labelled variants with the approaches above |
| `prompts/variants-factcheck.md` | the five summaries against the source span |
| `src/variants.ts` | `generateVariants(ctx, n)`: lessons call, then the five component calls in parallel under the config's concurrency, then the fact check; writes `<runDir>/chNN/variants/*.json`; validates shape and labels; `--only <component>` reruns one |
| `src/variantsRender.ts` | the pick page, self-contained HTML, phone-width, dark mode, copy-picks button |
| `cli.ts` | the `variants` verb; `--only`, `--force`, `--reference <chapter.json>` to show the current tool's chapter folded at the bottom |
| `tests/variants.test.ts` | prompts fill with no placeholder left; generation with the fake `claude` writes every file and the page; bad shapes fail with a named error; the page has five cards per component and the copy script |

Not built this turn: `assemble` and exemplars. Their input is your first pick, and the pick format is settled above.

### What blocks and what does not

Blocking before you see a variant: it parses, has the right counts, and (summaries) the fact check found nothing. Everything else is your call. No judge, no panel, no rubric.

### Risks

- The five variants may read too alike. The approach labels are the lever; if two still look the same I rewrite the prompt, not the loop.
- Your pick may favour a form that only works for this chapter. The second calibration chapter is there to catch that.
- Opus 5.5 through the CLI needs a fresh `claude login` on this Mac today. One command, once.
