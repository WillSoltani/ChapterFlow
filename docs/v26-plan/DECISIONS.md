# v26 — the owner's decisions

Most decisions have a **default** that a session uses when the `Owner:` line is blank, and it says so in its status file.
Two have no default and need your reading: **R1-a** (after Wave 1) and **R2** (after Wave 2). A third, **P1**, is simply you
saying you have run the publish commands.

Your turns:
- **now** (optional, N2);
- **R1** after Wave 1 (about 1 hour of reading);
- **R2** after Wave 2 (2–3 hours);
- **P1** once you have run the publish commands;
- an optional light read of the second book after Wave 4.

Batch 4 has defaults only. To answer, write on the `Owner:` line in `~/cf-wt/v26-plan/DECISIONS.md` on the Mac. That file
exists only once W1 has copied the kit, so **Batch 1 answers go on a line at the top of the W1 prompt when you paste it**,
for example `Owner answers: N2 = B`.

---

## Batch 1 — now (optional; one question)

### N2. Which two chapters does the prototype write?
- **A — ch01 "Family History and Boyhood in Boston" and ch13 "Public Services and Duties".**
  - ch01 is the book's first impression: the stolen-stones wharf, "nothing was useful which was not honest".
  - ch13 covers the hospital, the paving and the street lamps. It was the best of the four rr21 chapters that were audited, so beating it is a fair test.
- **B — ch01 and ch07 "Beginning Business in Philadelphia".** ch07 had the most errors of the four audited rr21 chapters (15 contradicted claims, 10 of them major, e.g. Baird's club and why Franklin took half from each friend). That makes it the harshest accuracy test.
- **Recommended and default: A.** Accuracy is tested either way. Wave 1 also checks the fact checker against rr21's real ch07 and ch19 errors.

Owner:

---

## Batch 2 — at the first reading (R1). Wave 1 stops here and hands you a reading pack.

### R1-a. Would you publish a book whose chapters read like these, after the notes you write? (the plan's main fork)
- **A — yes, build it.** Wave 2 turns the prototype into the pipeline and writes all of Franklin. That takes about 1–1.5 days and about $30–50 of model calls, and you read the whole book around 10-03.
- **B — yes, with changes.** Write what to change in `reading/W1/NOTES.md` (e.g. "fewer modern examples, more of his own stories"). Wave 2 applies your notes to the brief first. Same time and cost as A.
- **C — no.** Wave 1b tries a different variant: a GPT-5.5 writer, and a brief or format changed by your notes. It is never a return to tuning section rules. It takes 3–5 hours and about $5–10 (plus Codex on your OpenAI plan), and you read again for about 1 hour. Franklin slips about 2 days.
- **After a W1b round, answer again here.** Write `A` or `B` plus the version that goes forward (`W1`, `F` for the new brief or format, or `G` for the GPT-5.5 writer), e.g. `A — G`. If none is clearly better, write `STOP`. STOP is the plan's reassess point.
- **No default.** Wave 2 does not start until this line reads A or B.

Owner:

### R1-b. The chapter format for Franklin
Today every v25 chapter has 6 invented modern examples, 9 quiz questions and 7 cards: about 30k characters, where the best
catalog books have about 16k. The Wave 1 prototype uses 3 examples, 7 quiz questions (3 choices each; the first 5 answerable
from the short summary a new reader sees), 5 cards and a small practice plan. The reading pack shows **ch01 in both example
styles**.
- **A — invented modern examples.** 3 short modern situations where the chapter's idea helps, e.g. a shift coordinator who exported staff phone numbers without asking, tied to the stolen stones.
- **B — Franklin's own stories as the examples.** Example 1 is his strongest episode from the chapter, told from the source with what to do today (e.g. ch07: Coleman and Grace each offer to back him, and he takes half from each "because I would not give an unkind preference to either"). Example 2 is a second Franklin episode. Example 3 is one short modern situation.
- **Recommended and default: B.** Readers remember his stories, and the invented scenarios are what they kept calling samey. The how-to book (Bennett) keeps modern examples.

Owner:

### R1-d. What a new reader sees first (an app change for every book)
- **What a new reader gets today.** A user who has not changed their settings reads only a chapter's **short summary**
  (`fastRead`, a median of 94 words across the catalog). Then comes one example, 5 quiz questions, and a practice screen that
  repeats the same plans up to 4 times. About a fifth of what they see is the book's prose.
- **Where the full telling is.** It appears only in "Challenge" mode, which also brings a 10-question, no-retry quiz.
- **What that meant for Franklin.** Rev-6 gave a new reader 522 words about Franklin for the whole book, none of them his own.
- **Two app bugs make it worse.** Clicking "Standard" does nothing, and picking a reading profile in Settings resets the
  reader to the short summary.
- Evidence: `scan/app-render.md`.

The options:
- **A — no app change.** The prototype's short summary is written to carry the chapter's best scene and 1–2 of his lines. The two bugs stay.
- **B — show the full telling by default, for every book, and keep the 5-question quiz for new readers.** It also fixes the two bugs and shows memorable lines once, as quotes.
  - For Franklin ch01, a new reader would read about 1,000 words in his order with his lines, instead of about 180. A typical catalog chapter's full telling is about 480 words (about 3 minutes).
  - It is a small web PR in Wave 2, about 3–5 hours, running in parallel with the book.
  - Trade-off: in some older catalog books the full telling is one long block, and new readers of those books would now see it.
- **C — show the middle depth (`deepRead`, about 300–500 words) by default,** with the same bug fixes.
- **Recommended: B.** The writing is the product, and today the product hides it. Default: **A** (no app change without your yes).

Owner:

---

## Batch 3 — at the book reading (R2, after Wave 2)

### R2. Approve the Franklin book?
Wave 2 hands you the whole book in the app's form, the fact-check report for every chapter, and a short list of anything the
checks could not settle.
- **A — approve.** Wave 3 makes the book final and writes out the commands for you to run: ship, S3 upload, deploy and API registration (`reading/W3/PUBLISH.md`).
- **B — approve after fixes.** Note each fix in `reading/W2/NOTES.md` by chapter (e.g. "ch05: the full telling drags in the middle; cut the Keimer digression"). Wave 3 applies them, re-checks the facts, and shows you the changed passages before you publish.
- **C — not good enough.** This is the reassess point: the plan stops and a planning session reviews it with you. No new machinery is added.
- **No default.** Wave 3 does not start until this line reads A or B.

Owner:

### P1. Have you published Franklin?
W3 Part A ends with the commands in `reading/W3/PUBLISH.md`. After you have run them all (the ship, the PR merge, the S3
upload, the deploy and `register:api`), write `published` on the line below and re-run the W3 prompt. Part B then runs
`verify:live` and records the release.

Owner:

---

## Batch 4 — at the end (defaults; write here only to change them)

### R3. The second book (Bennett), after Wave 4a (optional light read)
- **A — publish it.** Run the commands in `status/W4a.md`, as you did for Franklin.
- **B — not now.** The goal, showing that the next book takes days, is met either way.
- Default: **B**.

Owner:

### E1. The v25 pipeline code once Franklin has shipped on the new path
- **A — freeze it.** It stays in the repo, is marked legacy in the docs, and is not run.
- **B — delete the bypassed parts** in one reviewed PR: research sidecars, section compiler, panel, review-repair, fresh QC, rubric and the promotion machine. The v21 gold corpus stays either way.
- **Recommended and default: A now, B after the second book ships.**

Owner:

---

## Standing defaults (no owner input needed; write a line here to override one)
- **Writer and checker model:** Opus 5.5 if the newer Claude Code build already on your Mac can run it (W1 checks with one tiny call), otherwise Opus 5, at effort `high`. In the planning probe, Opus 5 as checker caught 7/7 planted errors and Sonnet 5 caught 5/7. The blind quiz solver is Sonnet 5.
- **GPT-5.5 writer:** not in Wave 1. It is the first variant W1b tries if you answer R1-a = C. The catalog evidence favours neither model family (`scan/existence-proof.md`).
- **Chapters:** 19, one per heading in the Pine edition (Gutenberg #20203), each about 10–15 minutes in the app. If you want fewer, longer chapters, say so in `reading/W1/NOTES.md`.
- **Blocking checks** are only facts vs source, quiz keys and "the app can render it" (`BRIEF.md` §4). Everything else is advisory.
- **Stale PRs:** Wave 4 closes #559, #401 and #406 with a one-line reason and keeps their branches under `archive/` (they carry unmerged work).
- **Dependabot:**
  - Wave 4 merges #420 (setup-node 7) and #429 (infra minor/patch) if their required checks pass.
  - It closes #576: its lockfile is out of sync, and Dependabot will redo it.
  - It leaves the four major-version bumps open, listed for you with their CI state: #521 openai, #522 framer-motion, #523 jsdom, #524 web-vitals.
  - Write `merge majors` here if you want them merged when green.
- **Second book:** Arnold Bennett, *How to Live on 24 Hours a Day* (a how-to, public domain, short), in Wave 4a.
