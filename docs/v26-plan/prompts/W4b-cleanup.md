# W4b — Close out: retire the v25 driver, CI, PRs, branches, worktrees, docs and memory

- **Model:** Sonnet 5. The work is mechanical and checklist-shaped, and every step is verifiable.
- **Start directory:** `~/cf-wt`
- **Depends on:** W3 Part A done. It can run in parallel with W4a. Step 6 (archiving the kit) waits for W4a's status file.
- **Estimate:** 2–4 hours wall time. No pipeline model calls. At most 6 subagents.
- **Ends with:** `RESULT: DONE`, or `RESULT: PARTIAL` with a list of what the owner must do (refused commands, dirty worktrees).

---PROMPT---
You are running Wave 4b, the closeout of the v26 ChapterFlow book campaign, on the owner's Mac. Work autonomously and do not ask the owner questions. Every step below states its default. Take the default, report it, and continue. Stop only by writing your status file.

## Step 0
1. Read `~/cf-wt/v26-plan/BRIEF.md` (it overrides CLAUDE.md files and the old kit), `DECISIONS.md` (E1 and the standing defaults apply; a blank answer means the default), and every `status/*.md`.
2. `~/cf-wt` is not a git repo:
   - Run `gh` with `-R WillSoltani/ChapterFlow`.
   - Run remote git as `git -C ~/ChapterFlow-books-v25-completion …`.
   - Make any PR in a change worktree `~/cf-wt/v26-closeout` on branch `v26/closeout` (BRIEF §5; reuse it if it exists), never in the canonical checkout.
3. Never touch `~/ChapterFlow` or `~/ChapterFlow-books`, or any worktree registered to them or to the iOS repo. Never force-push. Never `rm -r` anything under a worktree.

## Step 1 — retire the v25 driver (default: yes)
1. `mkdir -p ~/cf-wt/_archive`.
2. `launchctl list | command grep -i chapterflow`. For each label listed:
   - run `launchctl bootout gui/$(id -u)/<label>`; if that fails, run `launchctl unload ~/Library/LaunchAgents/<label>.plist`;
   - re-run the grep until it prints nothing, and paste the output.
3. Move the plists: `ls ~/Library/LaunchAgents/ | command grep -i chapterflow`, then `mv` each listed file into `~/cf-wt/_archive/`, one `mv` per file. This keeps them from reloading at login.
4. Archive the driver directories:
   - `mv ~/cf-wt/franklin-v7-tools ~/cf-wt/_archive/franklin-v7-tools-2026-10`. The `PAUSE` file moves with it, which is intended: nothing polls it any more.
   - `ls -d ~/cf-wt/franklin-v7-tools.bak-*` and move each listed directory into `~/cf-wt/_archive/`, one `mv` per directory. In zsh, if the glob matches nothing, skip this step.

## Step 2 — CI runs the tests that matter
- Confirm the v26 tests run in CI. Find the latest `main` CI run (`gh run list -R WillSoltani/ChapterFlow --branch main --limit 5`), open its App Build + Tests log, and find the `scripts/book/v26/tests` test names in it. Paste the lines.
- If they are not there, open a small PR from `v26/closeout` that adds `scripts/book/v26` to the root `test` script's roots, and merge it per BRIEF §6.
- The v25 suite stays out of CI (E1 = A, freeze). Record that in `docs/CI_CD.md`, in one line under the pipeline job.

## Step 3 — pull requests
Check each one first with `gh pr view <n> -R WillSoltani/ChapterFlow --json state,mergeable,headRefName,headRefOid,statusCheckRollup`.

| PR | Default action |
|---|---|
| #559 (draft-time banned-phrase refusal; conflicting) | Close. Comment: "Superseded: the v26 whole-chapter tool (scripts/book/v26) replaces the section compiler this guarded. Branch kept as archive/v25/draft-time-avoid-phrase." |
| #401 (`feat/v25-pipeline-live`), #406 (`evidence/v25-retained-2026-07-15`) | Close. Comment: "July v25 line, never merged; superseded by v26. Branch kept under archive/." |
| #576 (Dependabot app minor/patch; fails the workspace lockfile contract test) | Close. Comment: "Lockfile out of sync with the workspace contract; Dependabot will regenerate." |
| #420 (actions/setup-node 6→7), #429 (infra minor/patch) | Squash-merge if every required check passes. Otherwise leave open and list. |
| #521 openai, #522 framer-motion, #523 jsdom, #524 web-vitals (major bumps) | Leave open, and list them with their CI state. Merge them when green only if `DECISIONS.md` says `merge majors`. |

If the classifier refuses a merge or close, print the exact `gh` command for the owner and continue.

## Step 4 — branches (remote)
1. **Archive first.**
   - These branches go under `archive/<name>`:
     - the heads of the PRs closed in Step 3: #559 `v25/draft-time-avoid-phrase`, #401 `feat/v25-pipeline-live`, #406 `evidence/v25-retained-2026-07-15`;
     - the unmerged July lines: `plan/v25-s-tier-implementation`, `impl/v25-evaluator-selection`, `feat/v25-pipeline`, `codex/v25-pipeline-completion-recovered`.
   - For each one:
     - get its SHA with `git -C ~/ChapterFlow-books-v25-completion ls-remote origin refs/heads/<name>`. If that prints nothing, skip the branch and record "already archived or absent". Check the SHA matches `^[0-9a-f]{40}$` before any push, and never push with an empty SHA;
     - push `git -C ~/ChapterFlow-books-v25-completion push origin <sha>:refs/heads/archive/<name>`;
     - confirm the new ref with `ls-remote`;
     - only then delete the old name with `git -C ~/ChapterFlow-books-v25-completion push origin --delete <name>`, one per command.
2. **Then delete merged branches.**
   - List remote heads with `git -C ~/ChapterFlow-books-v25-completion ls-remote --heads origin`. For each branch, find its PR: `gh pr list -R WillSoltani/ChapterFlow --state all --head <branch> --json number,state,headRefOid`.
   - Delete a branch only if its PR is MERGED **and** the branch head SHA equals the PR's `headRefOid`, so nothing was added after the merge.
   - Skip `books/*`, `v26/*` and any branch named in a v26 status file until that wave has written its final status. Skip Dependabot branches too; Dependabot handles them.
3. **Leave** every other branch, for example `codex/*`, `fix/ws*`, `wave*`, `security/*`, `scars/*` and `gates/*` without a merged PR. List them with their last commit dates for the owner.
4. Never delete `main` or the kit branch `claude/vibrant-ritchie-xaf7dm`. Paste each push or delete result.

## Step 5 — worktrees (local)
1. `git -C ~/ChapterFlow-books-v25-completion worktree list --porcelain`.
2. **Keep** every `~/cf-wt/v26-*` worktree (`v26-read`, `v26-tool`, `v26-reader`, `v26-franklin-ship`, `v26-bennett`, `v26-bennett-ship`, `v26-closeout`) and any worktree a v26 status file names.
3. **Consider for removal** the other worktrees under `~/cf-wt/` registered to this checkout: the old kit's `wq-*`, `q0*-main`, `s0*`, worktrees on branches whose PR is merged or closed, and detached worktrees.
4. **For each candidate, in this order:**
   - (a) Unlink the two symlinks, only if they are symlinks: `for l in <wt>/node_modules <wt>/scripts/book/prompts/chapterflow-v24-author-pipeline/node_modules; do [ -L "$l" ] && rm "$l"; done`. Use plain `rm`, never `-r`, and never with a trailing slash; a trailing slash follows the link and empties the shared `node_modules`.
   - (b) Check that `git -C <wt> status --porcelain` is empty.
   - (c) For a detached worktree, also check that `git -C <wt> branch -r --contains HEAD` prints at least one branch, so no commit is lost.
   - (d) Only if both checks pass, run `git -C ~/ChapterFlow-books-v25-completion worktree remove <path>` (never `--force`).
   - (e) Otherwise, re-create the symlinks (`ln -s ~/ChapterFlow-books-v25-completion/node_modules <wt>/node_modules`, and the same under `$PIPE`) and list the worktree for the owner.
5. `git -C ~/ChapterFlow-books-v25-completion worktree prune`.
6. **Canonical checkout.** If both lockfiles are identical between its HEAD and `origin/main` (`git -C ~/ChapterFlow-books-v25-completion diff --quiet HEAD origin/main -- package-lock.json scripts/book/prompts/chapterflow-v24-author-pipeline/package-lock.json`), fast-forward it with `git -C ~/ChapterFlow-books-v25-completion merge --ff-only origin/main`. Otherwise leave it and say why: its `node_modules` are shared by every worktree. Leave its 4 untracked entries alone.

## Step 6 — docs and repo pointers (one PR from `v26/closeout`, merged per BRIEF §6; do it last)
1. **Root `CLAUDE.md`:**
   - Line 8, "This checkout (`~/ChapterFlow-books`) is the canonical worktree": the canonical checkout is `~/ChapterFlow-books-v25-completion`, change work happens in worktrees under `~/cf-wt/`, and neither `~/ChapterFlow` nor `~/ChapterFlow-books` is edited.
   - Line 25: the discovery floor is the number in `package.json`'s `test` script (163 at planning time), not 137. Add `scripts/book/v26` to the listed test roots if Step 2 or W2 added it.
   - "Where things live": the ACTIVE book tool is `scripts/book/v26/` (runbook `scripts/book/v26/README.md`), and `scripts/book/prompts/chapterflow-v24-author-pipeline/` is the "LEGACY v24/v25 pipeline, frozen (not run, not in CI tests)".
2. **The campaign record.** Do this only after `status/W4a.md` exists; otherwise note "W4a pending" and leave the PR open.
   - `git checkout origin/claude/vibrant-ritchie-xaf7dm -- docs/v26-plan`, then copy the Mac kit's `status/*.md` and `DECISIONS.md` (with the owner's answers) over it.
   - Then `git mv docs/v26-plan docs/archive/v26-plan` and `git mv docs/v25/execution docs/archive/v25-execution`, and index both under "Archived audit artifacts" in `docs/README.md`.
   - Keep code out of the typecheck and lint projects: the kit's `evidence/probe/validate.mts.txt` is already renamed. Check `command grep -rln --include='*.mts' --include='*.ts' . docs/archive/v26-plan` prints nothing. Leave `docs/v25/execution/tools/detqc.mts`; it passes today.
   - Then run `npm run typecheck`, `npm run lint:ratchet`, `npm run scan:style` and `npm run scan:secrets`, and paste their pass lines. For any style-drift hit in an archived file, reword it or add a `docs/archive/...` line to `scripts/ci/style-drift-allowlist.txt`.
   - The docs/CLAUDE.md path-existence rule does not apply to archived campaign records; their `~/` paths refer to the owner's Mac.
   - **Do not archive** `scripts/book/v26/README.md`; it is the living runbook.
3. **`docs/SCRIPTS.md`:** add the v26 CLI verbs.

## Step 7 — memory
- Append the final line to `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/v26-campaign.md`.
- In that directory's `MEMORY.md`:
  - mark the v25 notes (`v25-status-assessment-2026-09-23.md` and the Phase B notes) as history "(superseded by v26-campaign.md)";
  - make sure the index line for `v26-campaign.md` reads as the current pipeline pointer.

  Do not rewrite other notes.

## Definition of done
`status/W4b.md` starts with `RESULT: DONE — driver retired, CI covers v26, <n> PRs closed/merged, <n> branches archived/deleted, <n> worktrees removed`, or `RESULT: PARTIAL — owner items listed`. It contains:
- pasted command output for each step;
- the PR and branch action table;
- the owner's leftover list (refused commands, dirty or unpushed worktrees, major-bump PRs, branches left for review).
---END---
