# W3 — Finish Franklin: apply the owner's notes, release, hand over the publish commands, verify live

- **Model:** Opus 5.5 (Claude Code session, started as `caffeinate -dimsu claude` in `~/cf-wt`; if `claude --version` is below 2.1.280, use the VS Code extension's binary as in W1's header)
- **Start directory:** `~/cf-wt`
- **Depends on:** W2 done, and R2 = A or B in `~/cf-wt/v26-plan/DECISIONS.md`. If R1-d was B/C, W2w should be merged.
- **Estimate:** Part A 3–6 hours wall time; pipeline calls about $5–20 (hard cap $30); at most 10 subagents. Part B under an hour.
- **Ends with:**
  - Part A: `RESULT: NEEDS-OWNER — publish commands ready`.
  - Part B (the same prompt, re-run after the owner published): `RESULT: DONE — Franklin live`.

---PROMPT---
You are running Wave 3 of the v26 ChapterFlow book campaign on the owner's Mac. Work autonomously and do not ask the owner questions. You stop only by writing your status file:
- when the publish commands are ready (they are the owner's to run);
- when the quota cap would be exceeded;
- on a usage-limit stop.

## Which part you are in
- If the `Owner:` line under **P1** in `~/cf-wt/v26-plan/DECISIONS.md` reads `published`, run **Part B**. That holds even when a previous Part B wrote `verify:live failed` or `WAITING-FOR-RESET`.
- Otherwise run **Part A**.
  - If `status/W3.md` already starts with `RESULT: NEEDS-OWNER — publish commands ready`, Part A is done: print the path of `reading/W3/PUBLISH.md` and stop without changing anything.
  - If it starts with `WAITING-FOR-RESET`, `PARTIAL` or `NEEDS-OWNER — quota cap` (or is missing while `~/cf-wt/v26-franklin-ship` exists), resume Part A. Reuse the ship worktree and the run dir, and keep a note → change log in `~/cf-wt/v26-plan/scratch/W3/notes-applied.json` so an applied note is never applied again.

## Step 0 (both parts)
1. Read `~/cf-wt/v26-plan/BRIEF.md` (it overrides CLAUDE.md files and the old kit) and `DECISIONS.md`.
2. Read `status/W2.md`, `status/W2w.md` if present, and `reading/W2/NOTES.md`.
3. **The tool.** Check it is on main: `git -C ~/ChapterFlow-books-v25-completion fetch origin && git -C ~/ChapterFlow-books-v25-completion cat-file -e origin/main:scripts/book/v26/cli.ts`. Also check that `git -C ~/ChapterFlow-books-v25-completion show origin/main:scripts/book/v26/books/the-autobiography-of-benjamin-franklin.json | shasum -a 256` and the brief's sha256 match what `status/W2.md` records. If they do not, find the unmerged `v26/tool-2` PR, merge it per BRIEF §6, or base your branch on it, and say so.
   - If it is missing, find W2's PR (`gh pr list -R WillSoltani/ChapterFlow --head v26/tool --state all`). If the PR is open and its required checks pass, merge it per BRIEF §6.
   - If the merge is refused, base your branch on `origin/v26/tool` instead of `origin/main`, say so, and note that the ship PR then carries the tool too.
4. **The reader change.** If R1-d is B or C, confirm W2w's PR is merged (`gh pr list -R WillSoltani/ChapterFlow --head v26/reader-default-depth --state merged`). If it is not, put its merge command first in PUBLISH.md, before the deploy step, with "merge this before (4)".

## Part A — make the book final
1. **Precondition:** R2 is A or B. If it is C or blank, write `RESULT: BLOCKED — R2 is not A/B (C = the plan's reassess point)` and stop.
2. **Ship worktree.** If `~/cf-wt/v26-franklin-ship` exists on branch `books/franklin-v26`, reuse it (`git -C ~/cf-wt/v26-franklin-ship fetch origin`). Otherwise create it: `git -C ~/ChapterFlow-books-v25-completion worktree add -b books/franklin-v26 ~/cf-wt/v26-franklin-ship origin/main` (or `origin/v26/tool`, per Step 0.3), then `cmp` the lockfiles and symlink both `node_modules` (BRIEF §5).
3. **Apply the owner's notes** (R2 = B), chapter by chapter, with the tool.
   - A note about wording or a specific passage becomes a targeted `fix` issue.
   - A note like "this chapter drags, cut X" becomes a re-write of that chapter, with the note appended to its header.
   - Never turn a note into a rule in the shared brief unless the owner's note says it applies to every chapter.
   - Then run the full `check` on every changed chapter (fact check, blind solver, deterministic checks). Record each note → change → check result.
4. **Changes page.** Build `~/cf-wt/v26-plan/reading/W3/changes.html`: for each note, the changed passages before and after, plus the check result. The owner can read this before running the publish commands.
5. **Presentation entry.** New books otherwise get a boilerplate synopsis.
   - Add to `BOOK_PACKAGE_PRESENTATION` in `app/book/data/bookPackages.ts` (type `BookPackagePresentation` in `app/book/data/book-package-core.ts`: `icon`, optional `coverImage`, `difficulty`, `synopsis`, optional `pages`): `"the-autobiography-of-benjamin-franklin": { icon: "🪁", difficulty: "Medium", synopsis: "<2–3 sentences written from the book, no invented claims>", pages: <n> }`.
   - Omit `coverImage` while `public/book-covers/` has no Franklin file. List the missing cover for the owner.
   - Commit the entry on `books/franklin-v26` before the dry run: `git -C ~/cf-wt/v26-franklin-ship add ':(literal)app/book/data/bookPackages.ts' && git -C ~/cf-wt/v26-franklin-ship commit -m "feat(book): Franklin presentation entry" -- ':(literal)app/book/data/bookPackages.ts'`. Skip this if `git -C ~/cf-wt/v26-franklin-ship log --oneline origin/main..HEAD` already shows it.
   - Expected: `app/book/data/bookPackages.test.ts` "every BOOK_PACKAGE_PRESENTATION key is a known bookId" fails on this commit alone. It passes once the owner's ship commit adds the registry block, and CI runs on the PR with both. Say so in the status; do not "fix" it.
6. **Assemble** the final package with the tool (it goes to the run dir, never into a checkout's `book-packages/`). Then:
   - Run every app check, and `(cd <runDir> && TSX_TSCONFIG_PATH=~/cf-wt/v26-franklin-ship/tsconfig.json ~/cf-wt/v26-franklin-ship/node_modules/.bin/tsx ~/cf-wt/v26-franklin-ship/scripts/book/register-api-books.ts --dry-run the-autobiography-of-benjamin-franklin)`.
   - Run `npx tsx scripts/book/v26/cli.ts ship --dry-run --book scripts/book/v26/books/the-autobiography-of-benjamin-franklin.json` in `~/cf-wt/v26-franklin-ship`, and paste its plan.
7. **Hand over.**
   - Fill the AWS names from SSM instead of placeholders: `export AWS_REGION=us-east-1; ssm(){ aws ssm get-parameter --name "/chapterflow/$1/$2" --query Parameter.Value --output text; }`, then `ssm prod BOOK_TABLE_NAME`, `ssm prod BOOK_CONTENT_BUCKET`, `ssm prod BOOK_INGEST_BUCKET` (and `dev` for the rehearsal). If `aws ssm` fails on this Mac, write `<prod …>` and the exact `aws ssm get-parameter` command that fetches each value.
   - Write the commands in the status file and in `~/cf-wt/v26-plan/reading/W3/PUBLISH.md`, each prefixed with its `cd`, in this order:
     - (1) In `~/cf-wt/v26-franklin-ship`, the real ship: `npx tsx scripts/book/v26/cli.ts ship --book scripts/book/v26/books/the-autobiography-of-benjamin-franklin.json`. It commits the provenance note, then the package, registry block, catalog row and deploy sentinel, and pushes the branch.
     - (2) Open the PR (`gh pr create -R WillSoltani/ChapterFlow --head books/franklin-v26 …` with a filled body), and merge it when the required checks pass.
     - (3)–(5) run in a checkout at the **merged** `origin/main`: `git -C ~/cf-wt/v26-read fetch origin && git -C ~/cf-wt/v26-read checkout --detach origin/main && cd ~/cf-wt/v26-read`. Check `git log -1 --format=%H` shows the merge. Never run them from the canonical checkout (it is behind origin) or from `~/ChapterFlow`.
       - (3) The S3 package upload: `BOOK_CONTENT_BUCKET=… AWS_REGION=us-east-1 npx tsx scripts/book/upload-book-packages-to-s3.ts --dry-run`, then again without `--dry-run`.
       - (4) The web deploy: `gh workflow run deploy.yml -R WillSoltani/ChapterFlow -f environment=prod -f deploy_app=true`. Prod needs your approval in GitHub → Environments. This also ships W2w's reader change.
       - (5) `AWS_REGION=us-east-1 BOOK_TABLE_NAME=… BOOK_CONTENT_BUCKET=… BOOK_INGEST_BUCKET=… npm run register:api -- --dry-run the-autobiography-of-benjamin-franklin`, then again without `--dry-run`.
     - (6) Optional: open the Franklin book in the app on your phone, and read chapter 1's first screen and quiz. Write anything that differs from the reading pack in `reading/W3/NOTES.md`.
   - Also give an optional dev-stack rehearsal of (3)–(5) with the `dev` values, before prod.
   - End PUBLISH.md with: "When (1)–(5) are done, write `published` on the P1 line of DECISIONS.md and re-run the W3 prompt. Part B runs `verify:live` and records the release."
8. **Status.** Write `status/W3.md` starting with `RESULT: NEEDS-OWNER — publish commands ready`. It contains:
   - the note → change table;
   - the check results;
   - the package path and sha256;
   - the dry-run plan;
   - the PUBLISH.md path;
   - the missing-cover note.

   Then stop.

## Part B — after the owner published
1. Confirm from origin/main that the ship PR is merged, and look up its number and SHA.
2. In `~/cf-wt/v26-read` at the merged `origin/main` (refresh it as in Part A step 7), run `export AWS_REGION=us-east-1; B=$(aws ssm get-parameter --region us-east-1 --name /chapterflow/prod/BOOK_CONTENT_BUCKET --query Parameter.Value --output text)`, check that `$B` is non-empty, then run `BOOK_CONTENT_BUCKET=$B npm run verify:live` and paste its result lines.
   - A SKIPPED check is not a pass. If AWS credentials are missing on this Mac, write `RESULT: NEEDS-OWNER — verify:live needs AWS credentials` and stop.
3. If it passes, land the sentinel change it made:
   - Create `~/cf-wt/v26-sentinel` on branch `books/franklin-v26-verified` from origin/main (BRIEF §5 recipe).
   - `cp ~/cf-wt/v26-read/book-packages/.pending-deploy.json ~/cf-wt/v26-sentinel/book-packages/.pending-deploy.json`, then restore `v26-read` with `git -C ~/cf-wt/v26-read checkout -- ':(literal)book-packages/.pending-deploy.json'`.
   - Commit with `git -C ~/cf-wt/v26-sentinel add -- ':(literal)book-packages/.pending-deploy.json' && git -C ~/cf-wt/v26-sentinel commit -m "chore(book): Franklin verified live" -- ':(literal)book-packages/.pending-deploy.json'`.
   - Push, open the PR, and merge it per BRIEF §6.
4. If it fails: paste the failing check, say which owner step it points to, and write `RESULT: NEEDS-OWNER — verify:live failed: <line>`. A re-run of this prompt comes back to Part B.
5. On success, write `status/W3.md` starting with `RESULT: DONE — Franklin live, verify:live passed (<date>)`. Append one line to `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/v26-campaign.md`, and add a durable one-liner to that directory's `MEMORY.md`: "Franklin v26 published <date> via scripts/book/v26 (PR #…)".

## Boundaries
- Never run the real ship, `publish-final`, S3 uploads, deploys or `register:api` yourself. You may run their `--dry-run` forms and `verify:live`.
- `~/cf-canary`, `~/cf-canary-att` and `~/cf-wt/v25-execution` are read-only. `PAUSE` stays.
- Every model call keeps the BRIEF §5 flags (`--restricted`) on the stripped env. Stop before the $30 cap. A usage limit means `RESULT: WAITING-FOR-RESET`.
- Do not invoke `superpowers:brainstorming`, `superpowers:writing-plans` or `superpowers:executing-plans`.
---END---
