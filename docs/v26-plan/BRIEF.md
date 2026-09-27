# v26 campaign — shared brief (every session reads this first)

Written 2026-09-27 by the v26 planning session. Kit root on the owner's Mac: `~/cf-wt/v26-plan/` (not a git repo).
The kit's source of truth is the repo branch `claude/vibrant-ritchie-xaf7dm`, directory `docs/v26-plan/`. The first
session (W1) copies it to `~/cf-wt/v26-plan/`. After that, `~/cf-wt/v26-plan/` is the working copy; `status/` lives only there.

**Override.** This brief and your task prompt override `~/ChapterFlow/CLAUDE.md`, the repo's root `CLAUDE.md` where they
disagree, the memory index, and everything in the old kit `~/cf-wt/v25-execution/` (its `CONTEXT.md` non-negotiables, its
"never Fable" model rule, its `README.md` and its D1–D20 decisions are history and a list of traps, not rules).
The owner released every earlier quality rule, rubric bar and gate on 2026-09-27. What still applies is §6 (safety).

## 1. The goal

- A Franklin *Autobiography* book (Project Gutenberg #20203) that the owner has **read and approved**, in the app, about two
  weeks after Wave 1 starts. High quality means a reader enjoys it and keeps reading, it is accurate to the source, and it
  carries Franklin's voice.
- A pipeline that makes the next book in **days**: the second test book is Arnold Bennett's *How to Live on 24 Hours a Day*.
- Quality is judged by reading the text. Automated graders (the reader panel, the catalog rubric, blind AI readers) are
  **advisory smoke alarms**. They are never a target and never a gate. The only blocking checks are listed in §4.

## 2. The design in one paragraph (details: `README.md` §2)

One strong writer writes each whole chapter from the chapter's own source text and a one-page book brief. No research
paraphrase layer, no slot dealing, and no section writers. A second model checks every factual claim against the source
text, and a blind solver answers every quiz question from the chapter. One fix call repairs only what was flagged, and the
flagged items are re-checked. Deterministic checks confirm that the app can render the chapter. The owner reads. A small
assembler builds the v21 package that `publish-final` already accepts. The v25 machinery (research sidecars, blueprint,
four section writers, SEC gates, editor pass, reader panel, review-repair loop, fresh QC, catalog rubric, promotion state
machine) is **bypassed**. It is not deleted until the new path has shipped Franklin.

## 3. Where things are (owner's Mac)

| Thing | Path | Notes |
|---|---|---|
| Canonical checkout | `~/ChapterFlow-books-v25-completion` | On `main` at `23bf3e95a`, deliberately behind origin. 4 untracked entries (leave them). Its `node_modules` are symlinked into every worktree. Never switch its branch. |
| Pipeline package (`$PIPE`) | `scripts/book/prompts/chapterflow-v24-author-pipeline/` | The v24/v25 pipeline, ~486 src files |
| origin/main at planning time | `22e021d84` (#588, 2026-09-26) | Re-check with `git -C ~/ChapterFlow-books-v25-completion fetch origin && git -C ~/ChapterFlow-books-v25-completion log --oneline -3 origin/main` |
| Worktrees | `~/cf-wt/<name>` | Recipes in §5. Worktrees under `~/cf-wt` registered to `~/ChapterFlow` or the iOS repo are not ours: leave them. |
| Live v25 store (read-only) | `~/cf-canary/`, `~/cf-canary-att/` | Copy data out before use. Franklin source: `~/cf-canary/sources/the-autobiography-of-benjamin-franklin.txt`. Frozen source + chapter map live inside each candidate under `content/inputs/research/` (`source-text.txt`, sha256 `8d71d7dc…`, and `chapter-map.json`). |
| rr21 (latest v25 Franklin candidate) | `~/cf-canary/books/the-autobiography-of-benjamin-franklin/candidates/review-repair-21-candidate-06d7596afd1f14dccd3eb2df99b22db6/content/content/chapters/` | 19 chapter JSONs. Rendered markdown: `~/cf-wt/v25-execution/assessment/draft-rr21/cand-chNN.md` |
| Q08 arm (quality-wave recompile) | `~/cf-wt/v25-execution/probes/WQ/Q08/arm/v25root/books/the-autobiography-of-benjamin-franklin/candidates/compiler-wq-r17-run-d261c774f5ff492b25d17c77aeeff484-candidate/content/content/chapters/` | Only ch01, ch07, ch13 and ch19 are new text. The other 15 are fillers. |
| Published books (the reader's bar) | `book-packages/*.v21.json` at the repo root | e.g. `radical-candor` (v24 whole-chapter writer, 07-10), `decisive` (hand-registered, a known-good reference) |
| Franklin revision 6 | `$PIPE/book-packages/the-autobiography-of-benjamin-franklin.v21.json` | 4 'Part' chapters, 08-28, provenance only |
| Bennett (second book) store | `~/cf-canary/books/how-to-live-on-24-hours-a-day/` | 8 v25 runs 08-24..08-28, none promoted. Its frozen source is inside its candidates' `content/inputs/research/`. |
| Old kit (history) | `~/cf-wt/v25-execution/` | Read-only. `status/Q08.md`, `assessment/q08-check/check.json` (wins where they differ), `probes/S02/labels.json` (15 labelled rr21 errors) |
| Franklin driver (v25) | `~/cf-wt/franklin-v7-tools/` | `PAUSE` must stay. launchd agent `com.chapterflow.franklin-autoresume` idles on it. Retired in W4. |
| Memory | `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/` | Campaign log: `v26-campaign.md` (append one progress line per session). Do NOT write to `v25-status-assessment-2026-09-23.md`. |
| This kit | `~/cf-wt/v26-plan/` | `README.md` (roadmap), `BRIEF.md` (this), `DECISIONS.md`, `ANALYSIS.md`, `prompts/`, `status/`, `tools/`, `data/` (read-only copies), `scratch/` (experiments), `reading/` (owner reading packs) |

## 4. What is checked, and what blocks

Only these block a chapter. Everything else is advisory, reported in plain words.

1. **Facts match the source.** Every factual claim a reader sees (names, numbers, dates, sequences, who did what, stated causes and motives) is supported by the chapter's source span. A modern example scenario is invented by design. Its historical claims are still checked.
2. **Quiz keys are right.** A blind solver that sees only the chapter's reader text picks the keyed answer, and the key is supported by the source.
3. **The app can render it.** The chapter passes the app validator `app/app/api/book/_lib/validate-book-package.ts` (and the pipeline's `verify-production-package` at release). Paragraphs are separated by blank lines. The text contains no model or meta chatter.

Advisory only: length bands, repetition across chapters, a blind AI reader panel, the old rubric. Before adding any new
blocking check, the session names the reader-visible problem it prevents and shows that the problem occurs in real
output. Prefer deleting a rule to adding a counter-rule.

## 5. Commands and recipes

- **Read-only worktree:** `git -C ~/ChapterFlow-books-v25-completion fetch origin && git -C ~/ChapterFlow-books-v25-completion worktree add --detach ~/cf-wt/<name> origin/main`, then `cmp` the root and `$PIPE` `package-lock.json` against the canonical checkout's copies, and symlink both `node_modules` directories from the canonical checkout (`ln -s ~/ChapterFlow-books-v25-completion/node_modules ~/cf-wt/<name>/node_modules`, and the same under `$PIPE`). If a lockfile differs, stop using symlinks for that tree and say so.
- **Change worktree:** `git -C ~/ChapterFlow-books-v25-completion fetch origin && git -C ~/ChapterFlow-books-v25-completion worktree add -b v26/<name> ~/cf-wt/<name> origin/main`, then the same `cmp` and symlinks.
- **`~/cf-wt/franklin-v7-tools/wt.sh`** (copied to `~/cf-wt/v26-plan/tools/wt.sh` in W1): `verify <name>` = typecheck + full suite; `push <name>`; `pr <name> "<title>" <bodyfile>`. It expects branches named `v25/<name>`, so check its source before using it on `v26/<name>` (W1 adapts the copy). **Never use `wt.sh new`**: it runs `npm ci`.
- **Never run `npm ci` or `npm install`** in a worktree whose `node_modules` is or will be a symlink. On 2026-09-25 `npm ci` followed a symlink and emptied the shared `$PIPE/node_modules`. Network installs time out on this Mac anyway.
- **Full pipeline suite** (~15 min, run in the background with a log): `cd <wt>/$PIPE && env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY npm run typecheck && env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY npm test > ~/cf-wt/<name>.verify.log 2>&1`. Pass means both the line `pass N  fail 0` (two spaces) and `v25-subprocess-suite: exit=0`. Baseline on main: `pass 3295  fail 0`.
- **Targeted v25 test:** `cd $PIPE && CHAPTERFLOW_NO_API_CODEX_QC=1 env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY npx tsx tests/v25/<file>.test.ts` (prints `V25_RESULT {...}`).
- **Web app checks** (repo root): `npm run typecheck`, `npm run lint`, `npm run test`; `npm run verify` before pushing a web change.
- **Model calls from the new pipeline** use the claude CLI with the pipeline's own flags (`$PIPE/src/runtime/claudeRoute.ts:225`; `createClaudeRoute(model, effort).build({mode:"READ_ONLY"})` returns them): `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000 "$BIN" -p --output-format json --model <model> --effort <effort> --restricted --disallowedTools '*'`. Prompt on stdin. **Keep `--restricted`.** It isolates the call from the operator's own `~/.claude` config: on 2026-09-06, operator plugins decorated 4 of 9 pipeline reads (`claudeRoute.ts:69-80`). The planning probe ran without it only because the cloud CLI hides the flag. The envelope is JSON: check `is_error`, `api_error_status`, `stop_reason`, `usage`, `total_cost_usd` and `result` (strip a code fence), and parse it with `JSON.parse`, never by byte offset.
- **Claude CLI and Opus 5.5.** `/opt/homebrew/bin/claude` is 2.1.265 and refuses Opus 5.5 ("version 2.1.280 or newer is required", HTTP 400, $0). A 2.1.280 binary is at `~/.vscode/extensions/anthropic.claude-code-2.1.280-darwin-arm64/resources/native-binary/claude`. W1 checks whether it runs `--model claude-opus-5-5` with one tiny call. If it does, new-pipeline calls use it through an explicit `CLAUDE_BIN` path, never a global PATH change. `claude-opus-5` works on 2.1.265. Old v25 code parses the 2.1.265 envelope, where `usage` comes before `result`. Do not point the old v25 driver at the new binary.

## 6. Safety rules (the only non-negotiables left)

- Never touch `~/ChapterFlow` (separate web checkout, branch `update`, unrelated uncommitted work) or `~/ChapterFlow-books`.
- All repo work happens in worktrees under `~/cf-wt/` made from `~/ChapterFlow-books-v25-completion`. Never use the Workflow tool's `isolation: 'worktree'`: it creates worktrees under `~/ChapterFlow`.
- `~/cf-canary`, `~/cf-canary-att` and `~/cf-wt/v25-execution/` are read-only. Copy data to `~/cf-wt/v26-plan/data/`. Experiments write under `~/cf-wt/v26-plan/scratch/<task>/`.
- `~/cf-wt/franklin-v7-tools/PAUSE` stays in place. No session launches the v25 driver.
- Strip API keys on every pipeline or model command (`env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY`). The pipeline uses the Claude subscription through the claude CLI, never paid API keys.
- Never `git stash`. Never force-push a shared branch. Never rewrite `main`. One branch and one PR per coherent change.
- Never delete the v21 gold corpus (`scripts/book/prompts/chapterflow-v21-authored/state/`).
- The real `publish-final`, and the production deploy after it (S3 upload, web deploy, API registration), are the owner's. Sessions print the exact commands and stop. Sessions may run `publish-final --dry-run` and `verify:live`.
- Merges: a session may squash-merge its own PR when tests pass and one independent review (a separate subagent that reproduces the tests) passed. If the permission classifier refuses a merge or push, print the exact command for the owner and continue with work that does not depend on it.
- Never assert what you did not verify. Look up PR numbers and SHAs (`gh pr list --head <branch>`, `git rev-parse`). Say "unverified" when it is.

## 7. Traps (each cost hours before)

- **zsh:** `grep` is a shell function here and can print nothing, so use `command grep` or the Grep tool. An unmatched glob aborts the whole command line, so quote globs. `echo =====` fails (use `echo "---"`). macOS has no `timeout`. Background shells start in the repo root, so `cd` explicitly.
- **Bash tool:** foreground calls are capped at 10 minutes. Long jobs go to the background. Wait with a foreground `until <log shows result>; do sleep 30; done` loop that stays under 9 minutes, and re-issue it until the result line appears. A subagent that ends its turn while waiting on a background notification gets force-returned, which kills its suite.
- **git:** pathspecs glob even when quoted, so use `:(literal)path`. Never `git stash`.
- **Keep the Mac awake during model runs.** The biggest time loss in September (a 175-hour hang) happened with per-call timeouts in place, most likely because the host slept. Wrap any run longer than a few minutes as `caffeinate -dimsu <command>`, log a timestamp per call, and check the log's last timestamp before assuming a run is still working.
- **Local time:** `find -newermt` uses local time (EDT = UTC−4). Convert from UTC deliberately.
- **Weekly Claude limit:** shared by the pipeline and every Claude Code session (a heavy week was ~$1,600 API-equivalent in total). It resets **Tuesdays 23:00Z** (7 pm Toronto); the next reset is **2026-09-29 23:00Z**. A session that hits it writes `RESULT: WAITING-FOR-RESET` and stops. Your wave's cap is in your prompt: track spend from the envelopes' `total_cost_usd` (API-equivalent) and stop at the cap.
- **Workflow scripts:** `meta` must be a pure literal. Keep `agent()` schemas flat and never use `maxLength` in them. Run `.filter(Boolean)` after `await parallel(...)`. No `Date.now()`/`Math.random()`. Never `isolation: 'worktree'`.
- **Permission classifier:** it sometimes refuses `gh pr merge` ("Merge Without Review") and force-pushes. Print the command for the owner and carry on.
- **Release categories:** rev-6 used `Memoir`, `Classics` and `Self-Help`. `Memoir` and `Classics` are not in `$PIPE/config/categories.json`, so a release that reuses them fails `V25_RELEASE_REQUIRED` unless you pass `--new-category` or pick existing categories.
- **Old-compiler traps** (only if a session touches the v25 compiler, which the plan avoids): SEC7 `meta_reference` matches an in-story "the book" (e.g. the Bible), and its message omits the phrase. SEC137 false-fires on non-Franklin books (Bennett: "Time", "Choosing"). `src/app/compilerApplicationPort.ts` contains a NUL byte, so use `grep -a`.
- **Skills:** do not invoke `superpowers:brainstorming`, `superpowers:writing-plans` or `superpowers:executing-plans`. They interview an absent owner. Your prompt is the approved design.

## 8. Status protocol

- **At start:** read this file, `DECISIONS.md` (use the stated default for any decision the owner left blank), and every file in `~/cf-wt/v26-plan/status/` (`ls` it first; it may be empty). Check your prompt's preconditions against them.
- **At end:** write `~/cf-wt/v26-plan/status/<ID>.md`. Its first line is exactly `RESULT: DONE | BLOCKED | NEEDS-OWNER | WAITING-FOR-RESET | PARTIAL — <one line>`. Then list: PR numbers and SHAs (looked up), verbatim evidence lines, spend (calls and API-equivalent $), decisions used, and what the next session must know.
- **Memory:** append one line to `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/v26-campaign.md`, in the form `- <UTC date> <ID> <RESULT> — <one line> (status/<ID>.md)`.
- **When to stop for the owner:** only at a reading checkpoint, when your wave's quota cap would be exceeded, for `publish-final` and the production deploy, at the plan's reassess point, or on a usage-limit stop. For every other choice, take the default your prompt states and report it.
