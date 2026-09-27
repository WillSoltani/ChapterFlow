# W4b — Close out: retire the v25 driver, CI, PRs, branches, worktrees, docs and memory

- **Model:** Sonnet 5. The work is mechanical and checklist-shaped, and every step is verifiable.
- **Start directory:** `~/cf-wt`
- **Depends on:** W3 Part A done. It can run in parallel with W4a. Step 1 (retire the driver) is safe any time after W2.
- **Estimate:** 2–4 hours wall time. No pipeline model calls. At most 6 subagents.
- **Ends with:** `RESULT: DONE`, or `PARTIAL` with a list of what the owner must do (refused merges, dirty worktrees).

---PROMPT---
You are running Wave 4b, the closeout of the v26 ChapterFlow book campaign, on the owner's Mac. Work autonomously and do not ask the owner questions. Every step below states its default. Take the default, report it, and continue. Stop only by writing your status file.

## Step 0
1. Read `~/cf-wt/v26-plan/BRIEF.md` (it overrides CLAUDE.md files and the old kit), `DECISIONS.md` (E1 and E2 apply; blank means default), and every `status/*.md`.
2. Do not touch `~/ChapterFlow`, `~/ChapterFlow-books`, or any worktree registered to them or to the iOS repo.

## Step 1 — retire the v25 driver (default: yes)
1. Check `ls ~/cf-wt/v26-plan/tools/wt.sh`. W1 copied it; if it is missing, copy it now from `~/cf-wt/franklin-v7-tools/wt.sh`.
2. Unload the launchd agent: `launchctl list | command grep franklin`, then `launchctl bootout gui/$(id -u)/com.chapterflow.franklin-autoresume`. If that fails, find the plist with `ls ~/Library/LaunchAgents | command grep -i franklin` and run `launchctl unload ~/Library/LaunchAgents/<plist>`. Confirm `launchctl list | command grep franklin` prints nothing, and paste the output.
3. Move the plist to `~/cf-wt/_archive/` so the agent does not reload at login.
4. Archive the driver directories: `mkdir -p ~/cf-wt/_archive && mv ~/cf-wt/franklin-v7-tools ~/cf-wt/_archive/franklin-v7-tools-2026-10 && mv ~/cf-wt/franklin-v7-tools.bak-20260925T0109Z ~/cf-wt/_archive/`. The `PAUSE` file moves with the directory; that is intended, since nothing polls it any more.

## Step 2 — CI runs the tests that matter
1. Confirm the v26 tests run in CI. Find the latest `main` CI run (`gh run list --branch main --limit 5`), open its test job log, and find the `tests/v26` (or W2's chosen path) test names in it. Paste the lines.
2. If they are not in the log, open a small PR that adds them to the root `npm run test` discovery or to a CI step, and merge it per BRIEF §6.
3. The v25 suite stays out of CI (E1 = A, freeze). Record that in `docs/CI_CD.md` in one line under the pipeline job.

## Step 3 — pull requests (check each state with `gh pr view <n> --json state,mergeable,statusCheckRollup` first)

| PR | Default action |
|---|---|
| #559 (draft-time banned-phrase refusal, conflicting) | Close. Comment: "Superseded: the v26 whole-chapter tool (scripts/book/v26) replaces the section compiler this guarded." |
| #401 (`feat/v25-pipeline-live`), #406 (evidence draft) | Close. Comment: "July v25 line, never merged; superseded by v26." |
| #576 (Dependabot app minor/patch; fails the workspace lockfile contract test) | Close. Comment: "Lockfile desync (see memory note dependabot-squash-lockfile-desync.md); Dependabot will regenerate." |
| #420 (actions/setup-node 6→7), #429 (infra minor/patch) | Merge (squash) if every check is green. Otherwise leave open and list. |
| #521 openai 6→7, #522 framer-motion 12→13, #523 jsdom, #524 web-vitals 5→6 (major bumps) | Leave open. List them for the owner with their CI state. Major bumps can change runtime behaviour tests do not cover. |

If the classifier refuses a merge or close, print the exact `gh` command for the owner and continue.

## Step 4 — branches (remote)
1. List remote branches with `git ls-remote --heads origin`. For each, look up its PR: `gh pr list --state all --head <branch> --json number,state`.
2. **Delete** remote branches whose PR is MERGED, plus the head branches of the PRs you closed in Step 3 (except Dependabot's, which Dependabot deletes). Use `git push origin --delete <branch>`, one per command, and paste each result.
3. **Rename to `archive/<name>`** (push the same SHA to the new name, then delete the old one) the unmerged July lines: `feat/v25-pipeline-live`, `plan/v25-s-tier-implementation`, `impl/v25-evaluator-selection`, `evidence/v25-retained-2026-07-15`, `feat/v25-pipeline`, `codex/v25-pipeline-completion-recovered`.
4. **Leave** every other branch that has no merged PR (for example `codex/*`, `fix/ws*`, `wave*`, `security/*` web work). List them, with their last commit dates, for the owner.
5. Never delete `main` or the kit branch `claude/vibrant-ritchie-xaf7dm`. Never force-push.

## Step 5 — worktrees (local)
1. Run `git -C ~/ChapterFlow-books-v25-completion worktree list --porcelain`.
2. For each worktree under `~/cf-wt/` registered to that checkout, consider removal if one of these holds:
   - it is one of the old kit's (`~/cf-wt/wq-*`, `~/cf-wt/q0*-main`, `~/cf-wt/s0*`);
   - it is on a branch whose PR is merged or closed;
   - it is detached and older than 7 days.

   Check `git -C <wt> status --porcelain` first. Remove it (`git -C ~/ChapterFlow-books-v25-completion worktree remove <path>`, never `--force`) **only if clean**, and remember its `node_modules` symlinks are just symlinks. List dirty ones for the owner.
3. Keep `~/cf-wt/v26-read` and any worktree a v26 status file says is in use.
4. Run `git -C ~/ChapterFlow-books-v25-completion worktree prune`.
5. Canonical checkout: if `package-lock.json` (root and `$PIPE`) is identical between its HEAD and `origin/main` (`git diff --quiet HEAD origin/main -- package-lock.json scripts/book/prompts/chapterflow-v24-author-pipeline/package-lock.json`), fast-forward it with `git -C ~/ChapterFlow-books-v25-completion merge --ff-only origin/main`. Otherwise leave it and say why (its `node_modules` are shared by every worktree). Leave its 4 untracked entries alone.

## Step 6 — docs and repo pointers (one PR, merged per BRIEF §6)
1. Root `CLAUDE.md`:
   - The "Where things live" bullet for the ACTIVE pipeline now names `scripts/book/v26/` (the whole-chapter tool; runbook `scripts/book/v26/README.md`).
   - `scripts/book/prompts/chapterflow-v24-author-pipeline/` becomes "LEGACY v24/v25 pipeline, frozen (not run, not in CI tests)".
   - Also correct the line that calls `app/book/*Client.tsx` "largely dead": `app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx` is the live reader.
2. Kit record: copy the Mac kit's current `status/` into the repo kit (`docs/v26-plan/status/`). Then move the campaign records into `docs/archive/` with `git mv`, per `docs/CLAUDE.md` ("Finishing a campaign? git mv its outputs into archive/"):
   - `docs/v26-plan/` (kit plus final status);
   - `docs/v25/execution/`.

   Both go under `docs/archive/`, with index entries in `docs/README.md`. The kit lives on branch `claude/vibrant-ritchie-xaf7dm`: merge that branch's `docs/v26-plan/` into your PR first. **Do not archive** `scripts/book/v26/README.md`; it is the living runbook.
3. `docs/SCRIPTS.md`: add the v26 CLI verbs.

## Step 7 — memory
1. Append the final line to `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/v26-campaign.md`.
2. In that directory's `MEMORY.md`:
   - mark the v25 notes (`v25-status-assessment-2026-09-23.md` and the Phase B notes) as history "(superseded by v26-campaign.md)";
   - make sure the index line for `v26-campaign.md` reads as the current pipeline pointer.

   Do not rewrite other notes.

## Definition of done
`status/W4b.md` starts with `RESULT: DONE — driver retired, CI covers v26, <n> PRs closed/merged, <n> branches deleted/archived, <n> worktrees removed` (or `PARTIAL — owner items listed`). It contains:
- pasted command output for each step;
- the PR and branch actions table;
- the owner's leftover list (refused commands, dirty worktrees, major-bump PRs).

Append one line to the campaign memory.
---END---
