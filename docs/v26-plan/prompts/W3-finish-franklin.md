# W3 — Finish Franklin: apply the owner's notes, release, hand over the publish commands, verify live

- **Model:** Opus 5.5 (Claude Code session)
- **Start directory:** `~/cf-wt`
- **Depends on:** W2 done, and R2 = A or B in `~/cf-wt/v26-plan/DECISIONS.md`. W2w must be merged if R1-d was B/C.
- **Estimate:** Part A 3–6 hours wall time. Pipeline calls about $5–20 (hard cap $30). At most 10 subagents. Part B takes under an hour.
- **Ends with:** Part A: `RESULT: NEEDS-OWNER — publish commands ready`. Part B (the same prompt, re-run after the owner published): `RESULT: DONE — Franklin live`.

---PROMPT---
You are running Wave 3 of the v26 ChapterFlow book campaign on the owner's Mac. Work autonomously and do not ask the owner questions. You stop only by writing your status file: when the publish commands are ready (they are the owner's to run), when the quota cap would be exceeded, or on a usage-limit stop.

## Which part you are in
Read `~/cf-wt/v26-plan/status/W3.md` if it exists.
- If it does not exist, or its first line is not `RESULT: NEEDS-OWNER — publish commands ready`, run **Part A**.
- If that is its first line **and** the owner has written `published` on the `P1` line of `DECISIONS.md` (or the ship PR is merged and `book-packages/.pending-deploy.json` on origin/main lists the Franklin package), run **Part B**.

## Step 0 (both parts)
1. Read `~/cf-wt/v26-plan/BRIEF.md` (it overrides CLAUDE.md files and the old kit) and `DECISIONS.md`.
2. Read `status/W2.md`, `status/W2w.md` if present, and `reading/W2/NOTES.md`.
3. The v26 tool is `scripts/book/v26/` on origin/main (W2's PR). Its usage is in `scripts/book/v26/README.md` or the W2 status.
4. Create a change worktree `~/cf-wt/v26-franklin-ship` on branch `books/franklin-v26` from `origin/main` (BRIEF §5 recipe).

## Part A — make the book final
1. **Precondition:** R2 is A or B. If it is C or blank, write `RESULT: BLOCKED — R2 is not A/B (C = the plan's reassess point)` and stop.
2. **Apply the owner's notes** (R2 = B), chapter by chapter, with the tool:
   - a note about wording or a specific passage becomes a targeted `fix` issue;
   - a note like "this chapter drags, cut X" becomes a re-write of that chapter, with the note appended to its header.

   Never turn a note into a rule in the shared brief unless the owner's note says it applies to every chapter.

   Then run the full `check` on every changed chapter (fact check, blind solver, deterministic checks). Record each note → change → check result.
3. **The changed-chapters page:** `~/cf-wt/v26-plan/reading/W3/changes.html`. Per note, show a before/after of the changed passages, plus the check result. The owner can read this before running the publish commands.
4. **Presentation.** New books otherwise get a boilerplate synopsis ("A modern reading of …").
   - Add a curated `BOOK_PACKAGE_PRESENTATION` entry for Franklin in `app/book/data/bookPackages.ts`. Follow an existing entry's shape: a 2–3 sentence synopsis written from the book (no invented claims) and the fields the other entries use.
   - If `public/book-covers/` has no Franklin cover, leave it for the owner and list it.
   - Categories come from the app taxonomy (`Memoir`, `Classics`, `Self Improvement`), plus the W2 tags.
5. **Assemble** the final package with the tool.
   - Run every app check: `validateBookPackage`; the slim-contract, title-quality and category-taxonomy tests; and `npx tsx scripts/book/register-api-books.ts --dry-run the-autobiography-of-benjamin-franklin` from a directory whose `book-packages/` holds the package.
   - Then run `npx tsx scripts/book/v26/cli.ts ship --dry-run --book scripts/book/v26/books/the-autobiography-of-benjamin-franklin.json` on the `books/franklin-v26` branch, and paste its plan.
6. **Hand over.** Write the exact commands, filled in, in the status and on `~/cf-wt/v26-plan/reading/W3/PUBLISH.md`, in this order:
   - (1) the real ship, on the branch (commits the package, the registry block, the catalog row, the deploy sentinel and the provenance note, then pushes the branch);
   - (2) open the PR (`gh pr create …` with a filled body);
   - (3) after CI is green and the PR is merged: the S3 package upload (`BOOK_CONTENT_BUCKET=<prod> AWS_REGION=us-east-1 npx tsx scripts/book/upload-book-packages-to-s3.ts --dry-run`, then without `--dry-run`);
   - (4) the web deploy (`gh workflow run deploy.yml -f environment=prod -f deploy_app=true`, which also ships W2w's reader change);
   - (5) `npm run register:api -- the-autobiography-of-benjamin-franklin` with the prod table and bucket env, `--dry-run` first;
   - (6) `npm run verify:live`.

   Use `scan/publish-path.md` §5 and the repo's `docs/SCRIPTS.md` for the exact env names. Mark every AWS value the session cannot know as `<prod …>`, and say where the owner finds it. Add an optional dev-stack rehearsal (the same steps against dev) before prod.
7. Write `status/W3.md` starting with `RESULT: NEEDS-OWNER — publish commands ready`. Include:
   - the note → change table;
   - the check results;
   - the package path and sha256;
   - the dry-run plan;
   - the command list;
   - the line "When done, write `published` on the P1 line of DECISIONS.md and re-run this prompt for Part B."

   Stop.

## Part B — after the owner published
1. Confirm from origin/main that the ship PR is merged, and look up its number and SHA.
2. Run `npm run verify:live` with the owner's env (it reads S3 and DynamoDB), and paste its result lines.
3. If it passes: commit the sentinel change it makes (`book-packages/.pending-deploy.json`) on a branch, open a PR, and merge it per BRIEF §6.
4. If it fails: paste the failing check, say which of the owner's steps it points to, and write `RESULT: NEEDS-OWNER — verify:live failed: <line>`.
5. On success, write `status/W3.md` starting with `RESULT: DONE — Franklin live, verify:live passed (<date>)`.
6. Append one line to `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/v26-campaign.md`, and add a durable one-liner to that directory's `MEMORY.md`: "Franklin v26 published <date> via scripts/book/v26 (PR #…)".

## Boundaries
- Never run the real ship, `publish-final`, S3 uploads, deploys or `register:api` yourself. You may run their `--dry-run` forms and `verify:live`.
- `~/cf-canary`, `~/cf-canary-att` and `~/cf-wt/v25-execution` are read-only. `PAUSE` stays.
- Every model call keeps the BRIEF §5 flags (`--restricted`) on the stripped env. Stop before the $30 cap. A usage limit means `RESULT: WAITING-FOR-RESET`.
- Do not invoke `superpowers:brainstorming`, `superpowers:writing-plans` or `superpowers:executing-plans`.
---END---
