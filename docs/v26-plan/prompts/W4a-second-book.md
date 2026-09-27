# W4a — The second book in days: Arnold Bennett, *How to Live on 24 Hours a Day*

- **Model:** Opus 5.5 (Claude Code session)
- **Start directory:** `~/cf-wt`
- **Depends on:** W3 Part A done (the v26 tool is on origin/main). It may start before Franklin's deploy. Runs in parallel with W4b.
- **Estimate:** 0.5–1 day wall time. Pipeline calls about $10–25 (hard cap $40). At most 10 subagents.
- **Ends with:** a Bennett reading pack plus ship commands and `RESULT: NEEDS-OWNER` (a light owner read, R3). The runbook `scripts/book/v26/README.md` is updated with what a new book needed.

---PROMPT---
You are running Wave 4a of the v26 ChapterFlow book campaign on the owner's Mac. Work autonomously and do not ask the owner questions. You stop only by writing your status file: at the reading checkpoint (the normal end), at the quota cap, or on a usage-limit stop.

## Goal
Prove the v26 tool (`scripts/book/v26/`, on origin/main since W2) makes a **second, different kind of book** in days, not months.

The book is Arnold Bennett's *How to Live on 24 Hours a Day* (1910, public domain; bookId `how-to-live-on-24-hours-a-day`). It is a short **how-to**, not a memoir. Its chapter shape differs from Franklin's:
- modern examples do real work here (3–4 per chapter);
- the practice plan is the point;
- quotations are fewer but welcome, because Bennett's voice is dry and funny.

Measure the wall time and the cost from start to reading pack. That measurement is the answer to "how fast is the next book".

## Step 0
1. Read `~/cf-wt/v26-plan/BRIEF.md` (it overrides CLAUDE.md files and the old kit), `DECISIONS.md`, `status/W2.md`, `status/W3.md`, `scripts/book/v26/README.md` and `scripts/book/v26/briefs/README.md` (book types).
2. Record the start time (UTC).
3. Check the tool is on main (`git -C ~/ChapterFlow-books-v25-completion fetch origin && git -C ~/ChapterFlow-books-v25-completion cat-file -e origin/main:scripts/book/v26/cli.ts`). If it is missing, base the worktree on `origin/v26/tool` and say so.
4. Create the change worktree, or reuse it if it exists: `git -C ~/ChapterFlow-books-v25-completion worktree add -b books/bennett-v26 ~/cf-wt/v26-bennett origin/main`. Then `cmp` the lockfiles and symlink both `node_modules` (BRIEF §5). Never `npm ci`.

## Step 1 — source and chapter map (0 model calls if possible)
Bennett's text was frozen by the v25 runs. Look under `~/cf-canary/books/how-to-live-on-24-hours-a-day/candidates/*/content/inputs/research/` for `source-text.txt` plus `chapter-map.json`.
- Pick the newest candidate whose map's `sourceTextSha256` equals the text's sha256.
- Copy both into `~/cf-wt/v26-plan/data/bennett/` (read-only source).
- If none exists, look for `~/cf-canary/sources/how-to-live-on-24-hours-a-day.txt` and build the map with the tool's heading splitter (or the pipeline's `src/source/chapterMap.ts` `resolveChapterMap` rules: spans in order, no big gaps).
- The v25 map has 13 chapters (the preface plus I–XII). By default, keep them as frozen, with the preface as chapter 1. Rebuild the spans with a heading split only if they disagree with the book's own table of contents, and say why.
- Do not re-run v25 research.

## Step 2 — brief and config
- Write `scripts/book/v26/briefs/how-to-live-on-24-hours-a-day.md` from the how-to section of `briefs/README.md`. Read two chapters of Bennett first and describe his voice in one short paragraph.
  - Shape: fastRead 120–200 words; deepRead 300–450; fullRead 700–1,000 (the chapters are short); 3–4 modern examples (work, home, commute, study; no character who "read Bennett"); 7 quiz questions of 3 choices, where q1–q5 are answerable from the default-visible text; 5 cards; a practice plan that is concrete and doable this week; 3 memorable lines verbatim from Bennett.
  - Keep it under about 4,000 characters.
- Categories: `["Productivity", "Self Improvement"]` (both canonical in `lib/category-taxonomy.ts`). Tags: `time management`, `habits`, `self-education`, `daily routine`.
- Add `scripts/book/v26/books/how-to-live-on-24-hours-a-day.json`.

## Step 3 — run
1. Run `caffeinate -dimsu npx tsx scripts/book/v26/cli.ts run --book scripts/book/v26/books/how-to-live-on-24-hours-a-day.json --chapters 1,7` first, and read both chapters.
2. Adjust the brief only if something is wrong in both, then run the rest.
3. Run `report`, then read every chapter yourself. This is a short book, so one Workflow of 3 reader agents is optional.
4. Fix real problems with targeted `fix` issues. Never add a brief rule for one chapter.
5. `assemble` (into the run dir, never a checkout's `book-packages/`), all app checks, `register-api-books --dry-run` (with `TSX_TSCONFIG_PATH`, as in W3), and `ship --dry-run` in `~/cf-wt/v26-bennett`.
6. Build the reading pack `~/cf-wt/v26-plan/reading/W4a/index.html` in the app's order.

## Step 4 — the runbook
Update `scripts/book/v26/README.md` with a section "Making the next book". It covers the exact steps you took, each with its time and cost:
- source → map → brief → config → run → read → fix → assemble → ship dry run → owner commands;
- everything you had to work around (a surprise in the source format, a check that misfired, a brief line that did not generalize).

Open a PR with the Bennett brief, the config and the runbook change. Do not commit the package itself: the owner's real `ship` does that. Merge it per BRIEF §6.

After the PR merges, print the owner's ship commands for a **fresh** branch:
- `git -C ~/ChapterFlow-books-v25-completion fetch origin && git -C ~/ChapterFlow-books-v25-completion worktree add -b books/bennett-v26-ship ~/cf-wt/v26-bennett-ship origin/main`, plus the BRIEF §5 symlinks;
- then, in that worktree, `npx tsx scripts/book/v26/cli.ts ship --book scripts/book/v26/books/how-to-live-on-24-hours-a-day.json`;
- then the same PR, S3, deploy and `register:api` steps as W3's PUBLISH.md, run from a checkout at the merged origin/main.

The package stays in the run dir.

## Boundaries
- Never run the real `ship`, `publish-final`, `register:api`, S3 uploads or deploys. Print them for the owner.
- `~/cf-canary`, `~/cf-canary-att` and `~/cf-wt/v25-execution` are read-only.
- Every call keeps the BRIEF §5 flags (`--restricted`) on the stripped env. Stop before $40. A usage limit means `RESULT: WAITING-FOR-RESET`.
- The v25 SEC137 detector false-fired on Bennett ("Time", "Choosing"). It is not in the v26 tool. Do not import any v25 gate to "be safe".

## Definition of done
`status/W4a.md` starts with `RESULT: NEEDS-OWNER — Bennett ready for an optional light read (R3, default: not now): ~/cf-wt/v26-plan/reading/W4a/index.html`. It contains:
- **start → reading-pack wall time and total $** (the headline number);
- chapters and open issues;
- brief notes;
- the PR number and SHA;
- the ship command set for the owner, with the line "Publishing Bennett is optional; the campaign's goal was proving the next book takes days".

Append one line to `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/v26-campaign.md`.
---END---
