# v26 — the owner's decisions

Each decision has a **default**. A session takes the default whenever the owner's answer line is blank, and says in its
status file that it did. To decide, write your choice on the `Owner:` line (in `~/cf-wt/v26-plan/DECISIONS.md` on the Mac).
There are three batches: **now** (before Wave 1), **at the first reading** (R1, after Wave 1), and **at the book reading**
(R2, after Wave 2). The only other things that wait for you are `publish-final` and the deploy, which are yours by rule.

---

## Batch 1 — decide now (all three have safe defaults; you can leave them blank)

### N1. When does Wave 1 start?
Wave 1 costs very little in pipeline calls: about 10–20 model calls, under $15 API-equivalent. The main cost is the session
itself. The weekly limit resets **Tuesday 2026-09-29 23:00Z (7 pm Toronto)**, and how much quota is left this week is unknown.
- **A — after the reset.** You read the prototype on Wednesday or Thursday. There is no risk of a usage-limit stop mid-wave.
- **B — now,** if your usage page shows about 20% or more of the weekly limit left. You read it about two days sooner. If the limit hits, the session stops with `WAITING-FOR-RESET` and resumes after the reset.
- **Recommended: B if the usage page shows room, otherwise A.** Default: **A**.

Owner:

### N2. Which two chapters does the prototype write?
- **A — ch01 "Family History and Boyhood in Boston" and ch13 "Public Services and Duties".** ch01 is the book's first impression: the stolen-stones wharf, "nothing was useful which was not honest". ch13 covers the hospital, the paving and the lamps, and it was the strongest chapter in rr21, so beating it is a fair test.
- **B — ch01 and ch07 "Beginning Business in Philadelphia".** ch07 had the most errors in rr21 (15 contradicted claims, 10 major: Baird's club, the Burlington job, the half-from-each-friend reason), so it is the harshest accuracy test.
- **Recommended: A.** Accuracy is tested anyway: every prototype chapter is fact-checked, and the checker's recall is measured with planted errors. Default: **A**.

Owner:

### N3. Should Wave 1 also try a GPT-5.5 writer?
The handoff assumed "the good books were all GPT-written". The repo says otherwise (`scan/existence-proof.md`):
- **In July no catalog book met your full bar.** Five scored 85 or more, and all five had churn HIGH.
- **Two of the top three books came mostly from Claude.** Atomic Habits and Getting Things Done, plus How to Win Friends (your quality reference in May), came mostly from a May `claude -p` pipeline with **Claude Opus 4.7** as the writer and small prompts; a Codex pass followed.
- **The six v24 books written whole-chapter by GPT-5.5 averaged 77.6 on book-score,** below the catalog mean. One of them, The Power of Moments, ranks #3 on the close-read evaluation.
- So the evidence favours **neither model family**. What the better books share is one strong model per unit, with a small prompt and tight length.

The options:
- **A — Claude only.** Wave 1 writes with Opus (5.5 if the newer CLI works, otherwise Opus 5). If you do not find it clearly better, Wave 1b tries GPT-5.5 as the next variant.
- **B — add a GPT-5.5 arm now.** The same two chapters are also written by GPT-5.5 (codex, effort xhigh) with the same brief and shown to you blind as a third version. That is about 20 more minutes of reading. It uses your OpenAI/Codex subscription, not the Claude weekly limit.
- **Recommended: A.** Nothing in the repo shows either family writing better. The exploratory Opus draft already reads far better than rr21, and GPT stays the planned next variant. Default: **A**.

Owner:

---

## Batch 2 — at the first reading (R1). Wave 1 stops here and hands you a reading pack.

### R1-a. Is the prototype clearly better? (the plan's main fork)
- **A — yes, build it.** Wave 2 turns the prototype into the pipeline and writes all of Franklin.
- **B — yes, with changes.** Write what to change in `reading/W1/NOTES.md` (for example "fewer modern examples, more of his own stories"). Wave 2 applies your notes to the brief first.
- **C — no.** Wave 1b tries a different prototype variant (the GPT-5.5 writer, and/or a different chapter format), never a return to tuning section rules. If the variant also fails, the plan stops at the reassess point.
- No default: this one needs your reading. The session waits.

Owner:

### R1-b. The chapter format for a memoir
Today every v25 chapter has 6 invented modern examples, 9 quiz questions and 7 cards. That comes to about 30k characters, while
the best catalog books have about 16k. The Wave 1 prototype uses 3 modern examples, 7 quiz questions (3 choices each; q1–q5 are
answerable from the short summary a new reader sees), 5 cards and a small practice plan. It also shows you **ch01 once with its
examples in format B**, so you can compare the two.
- **A — keep the prototype's shape.**
- **B — Franklin's own stories as the examples.** 1 modern example plus 2 "Franklin did this" cases told from the source (e.g. ch07: Coleman and Grace each offer to back him and he takes half from each "because I would not give an unkind preference to either"). Everything else as in A.
- **C — something else** (write it, e.g. "no examples at all for chapters that are pure narrative").
- **Recommended: B for Franklin.** Readers remember his stories, and the invented scenarios are what they kept calling samey. The how-to book (Bennett) keeps modern examples. Default: **A** (the shape you will have just read).

Owner:

### R1-c. How many chapters?
The book grew from 4 "Parts" (revision 6) to the edition's 19 chapter headings on 09-04 without a recorded decision. Cost no longer depends on the count: a whole chapter is about $1–2 of model calls.
- **A — 19 chapters,** one per heading in the Pine edition (#20203). Each covers about 3,500 words of Franklin and takes about 7 minutes to read. The titles match the real book.
- **B — about 10 chapters,** pairing neighbouring headings. Fewer, longer chapters; about 12 minutes each.
- **Recommended: A.** It is shorter per sitting and follows Franklin's own structure. Default: **A**.

Owner:

### R1-d. What a new reader sees first (an app change for every book)
A new user who has not customized their settings reads only the **short summary** (`fastRead`, a median of 94 words in the
catalog). They then see one example, 5 quiz questions, and a practice screen that repeats the same plans up to 4 times. About
a quarter of what they see is the book's prose. The full telling (`fullRead`, where the stories and quotations are) appears only
in "Challenge" mode, which also brings a 10-question quiz with no retries. Rev-6 gave a default reader **522 words of Franklin
for the whole book**. Two app bugs make it worse. Clicking "Standard" does nothing. Picking a reading profile in Settings resets
the reader to the short summary. (Evidence: `scan/app-render.md`: `ChapterReaderClient.tsx:144,262`,
`useReaderSettings.ts:31`, `BookSettingsClient.tsx:429`.)
- **A — no app change.** The prototype's short summary is written to carry the chapter's best scene and 1–2 of his lines. Readers who want more must find "Challenge".
- **B — show the full telling by default, for every book, and keep the 5-question quiz for new readers.** It also fixes the Standard no-op and shows memorable lines once, as quotes. For Franklin ch01 a new reader would read about 1,000 words in his order and with his lines, instead of about 180. A catalog book's fullRead is a median of about 480 words (about 3 minutes). This is a small web PR (about 3 lines plus tests, plus the two bug fixes) in Wave 2, in parallel with the book.
- **C — show the middle depth (`deepRead`, about 300–500 words) by default,** with the same bug fixes.
- **Recommended: B.** The writing is the product, and today the product hides it. Default: **A** (no app change without your yes).

Owner:

---

## Batch 3 — at the book reading (R2, after Wave 2)

### R2. Approve the Franklin book?
Wave 2 hands you the whole book in the app's form, the fact-check report for every chapter, and a short list of anything the checks could not settle.
- **A — approve.** Wave 3 releases it and prints your `publish-final` and deploy commands.
- **B — approve after fixes.** Note each fix in `reading/W2/NOTES.md` by chapter (e.g. "ch05: the fullRead drags in the middle; cut the Keimer digression"). Wave 3 applies them, re-checks the facts, and shows you only the changed chapters.
- **C — not good enough.** This is the reassess point: the plan stops and a planning session reviews it with you. No new machinery is added.

Owner:

---

## Batch 4 — at the end (Wave 4 uses these defaults unless you write otherwise)

### E1. The v25 pipeline code once Franklin has shipped on the new path
- **A — freeze it.** It stays in the repo, is marked legacy in the docs, and is no longer run or tested in CI. The launchd agent is unloaded and the driver archived.
- **B — delete the bypassed parts** (research sidecars, section compiler, panel, review-repair, fresh QC, rubric, promotion machine) in one reviewed PR. The v21 gold corpus stays.
- **Recommended: A now, B after the second book ships.** Default: **A**.

Owner:

### E2. Dependabot PRs (#576, #420, #429, #521–#524)
- **Default:** Wave 4 merges the ones whose CI is green, closes #576 with the lockfile note (its lockfile desync fails the workspace contract test), and lists the rest for you.

Owner:

---

## Standing defaults sessions use (no owner input needed)
- **Writer model:** Opus 5.5 if the 2.1.280 CLI runs it (checked in W1 with one tiny call), otherwise `claude-opus-5`, at effort `high`. **Checker model:** the same, at effort `high` (in the planning probe, Opus 5 caught 7/7 planted errors and Sonnet 5 caught 5/7).
- **Blocking checks** are only facts vs source, quiz keys, and "the app can render it" (`BRIEF.md` §4). Everything else is advisory.
- **Stale PRs** #559, #401 and #406 are closed in Wave 4 with a one-line reason. Their branches are kept, renamed under `archive/`, only if they carry unmerged work; otherwise they are deleted.
- **Second book:** Arnold Bennett, *How to Live on 24 Hours a Day* (a how-to, public domain, short), in Wave 4.
