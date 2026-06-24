# ChapterFlow v21 Hardening — Final Verification

Date: 2026-06-24 (America/Halifax)

## Verdict

**NOT CLEARED FOR RELEASE.** Verification was performed against the exact remote
tip. Eight of nine command gates pass on a clean checkout, but **three open
release blockers remain** (library-state drift, a `books.json` merge conflict
with `main`, and required CI that has not — and currently cannot — run on the
SHA). The release-blocker count must be zero; it is currently **3**. See
[Open Release Blockers](#open-release-blockers).

This document **replaces** the prior `VERIFICATION.md`, which was invalid: it
certified the *parent* commit `dd8e4370a` (not the branch tip), ran its "final
verification" from a **dirty working tree**, and concluded "safe for unattended
production promotion" *despite* an open drift finding. Those are precisely the
anti-patterns this re-verification was required to avoid.

## Scope

- Branch: `fix/v21-pipeline-hardening-2026-06`
- Remote: `origin/fix/v21-pipeline-hardening-2026-06`
- **Exact verified commit (code + committed state):** `4a8906b2c21a438a17ad9cb336f96f5ea5e59663`
  - Subject: `fix(pipeline): enforce explicit library-state authority + fail-loud audit; repair UH identity drift`
  - Author date: `2026-06-24T12:03:55-03:00`
  - The local branch was **9 commits ahead** of the stale remote tip
    (`436c18677…`) at the start; it was fast-forward pushed
    (`436c18677..4a8906b2c`) so the remote reflects the intended-for-merge tip
    **before** verification. Local and remote then matched (`0  0` ahead/behind).
- Primary pipeline package: `scripts/book/prompts/chapterflow-v21-authored`
- Merge-base with `origin/main`: `0355902252dbcd80e506f012e4c2e695e32d22d9`
- `origin/main` tip at verification time: `7c6897300` (`Remove excluded book artifacts`)

## Clean-Checkout Procedure & Invariants

The verification ran in a **fresh detached `git worktree` checked out at exactly
`4a8906b2c…`**, located in an ephemeral, gitignored session scratchpad **outside
the repository** (machine-specific absolute path intentionally omitted). The
primary working tree was **not** used as release proof (it carried 831
uncommitted/untracked entries).

| Invariant | Result |
| --- | --- |
| `git fetch --all --prune --tags` | OK |
| Recorded remote SHA | `4a8906b2c21a438a17ad9cb336f96f5ea5e59663` |
| `git status --porcelain` in checkout | **empty (0 lines — pristine)** |
| `HEAD == origin/fix/v21-pipeline-hardening-2026-06` | **MATCH** |
| Detached HEAD | yes |
| Node | `v20.20.2` (satisfies `engines: >=20.20.0 <21`) |
| npm | `10.8.2` (matches `packageManager: npm@10.8.2`) |
| OS | macOS / Darwin `25.5.0`, arm64 (hostname omitted) |

## Model-Credential Isolation (Proof)

Before every command, all live-provider credentials were `unset` in the
executing shell and the absence asserted with `printenv` (which returns
non-zero / empty when unset):

| Variable | State before unset | State during runs |
| --- | --- | --- |
| `OPENAI_API_KEY` | **SET in ambient env** | `unset` (asserted) |
| `ANTHROPIC_API_KEY` | unset | `unset` (asserted) |
| `CHAPTERFLOW_PROVIDER` | unset | `unset` (asserted) |
| `CHAPTERFLOW_CLAUDE_BIN` | unset | `unset` (asserted) |
| `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `CLAUDE_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, `COHERE_API_KEY` | unset | `unset` (asserted) |

After unsetting, the only provider-pattern variable remaining in the environment
was `CLAUDE_CODE_EXECPATH` (a Claude Code **harness** path, not a model
credential). No live OpenAI / Anthropic / Claude-CLI or other model service was
called. `pipeline:doctor` additionally forces offline mode via
`CHAPTERFLOW_NO_API_CODEX_QC=1`. Network use was limited to the clean-checkout
`npm ci` dependency install from the committed lockfile.

## Commands, Exit Codes, Counts

All run from the clean detached checkout with credentials unset.

| Command | Exit | Result |
| --- | --- | --- |
| `npm ci --include=optional` | **0** | 635 packages installed; 5 `npm audit` findings (1 low, 4 moderate) noted, unrelated to this change |
| `npm run pipeline:typecheck` | **0** | `tsc -p . --noEmit` clean |
| `npm run pipeline:test` | **0** | **`pass 896  fail 0  xfail 0  xpass 0  skip 0`** |
| `npm run pipeline:build` | **0** | clean (`build` == typecheck) |
| `npm run pipeline:doctor` | **0** | `DOCTOR — 0 fatal, 0 warning(s)`, **26 checks passed** (offline) |
| `npx tsx …/src/cli.ts doctor --json` | **0** | `status: ok`, `fatal 0, warnings 0, ok 26, total 26`; `unreasonable-hospitality` identity drift **repaired**; no repo-root shadow state |
| `npx tsx …/src/cli.ts migrate-state` | **0** | "No shadow dir … nothing to migrate. State is canonical." |
| `npx tsx …/src/cli.ts state-status` | **0** | **"All chapters tracked and identity-clean"** (24 books, 0 untracked, 0 idMismatch) |
| `npx tsx …/src/cli.ts rebuild-library-state --dry-run --json` | **1** | ⚠️ **DRIFT — open blocker** (`drift: true`, `blockerCount 0`, 11 conflicts, 12 warnings, 23 findings, all `severity: warning`) |

### Authoritative-state caveat (test hermeticity)

`pipeline:test` is **not** hermetic with respect to the state tree: it writes
untracked `zz-fixture-*` artifacts and several empty scaffold directories (e.g.
`state/qc-packs/`, `state/qc-rounds/`, `state/waivers/`, `state/provenance/`)
into `…/state/`. These are test scratch (not committed and never shipped). To
audit only the **committed** state, the checkout was restored to pristine
(`git clean -fd …/state/`, porcelain `0`) **before** the authoritative
`state-status` and `rebuild-library-state --dry-run` runs reported above. This
non-hermeticity is a minor observation, not a release blocker.

## Open Release Blockers

### 1. `library-state.json` drift (`rebuild-library-state --dry-run` exits 1)

On the **pristine committed tree**, the dry-run reports `drift: true` and a
planned `replace-ledger` write because *"stored ledger drifts from the
authoritative inputs."* Classification: `blockerCount 0`; all 23 findings are
`severity: warning` (11 × `library.package_loose_divergence`, 12 ×
`library.missing_canonical_index`). The exit-1 is the dry-run's `--check`-style
drift signal, not a fatal.

Root cause — the committed ledger is a **stale snapshot**:
- `stolen-focus` is registered in committed `books.json` but its built inputs
  are **not committed** (104 untracked files live only in the primary working
  tree). The stored ledger lists 126 books; a rebuild from committed inputs
  yields 125.
- Independently, the stored ledger carries **331 `globalNameUsage` entries that
  no current committed input justifies** (it reflects an older, larger corpus
  state). Committing the `stolen-focus` inputs reconciles the *book count* but
  **still leaves `drift: true`** (stored 1245 vs rebuild 914 name entries) — so
  a ledger rebuild is required either way.

Resolution is **owner-owned and intentionally out of scope** for this
verification (no product/state change was made). A `rebuild-library-state`
(write) clears it (`Drift: no  Blockers: 0`), regenerating the ledger
(≈ `+4118 / −10807` lines if `stolen-focus` is dropped, or `+4431 / −9125` if
its inputs are committed first). Per Rule 4 this drift is **not** dismissed as
acceptable.

### 2. `books.json` merge conflict with `main`

The branch **conflicts with `origin/main`** in exactly one file —
`scripts/book/prompts/chapterflow-v21-authored/books.json` (the book-catalog
registry). `main`'s tip `7c6897300` ("Remove excluded book artifacts") pruned
catalog entries while the branch edited the same file. PR #297 reports
`mergeable: CONFLICTING`, `mergeStateStatus: DIRTY`. The branch cannot be merged
until this is resolved.

### 3. Required CI has not (and currently cannot) run on the SHA

At verification time the exact SHA `4a8906b2c…` had **0 check-runs and 0 commit
statuses** (combined status `pending`). The CI workflow `.github/workflows/ci.yml`
runs its gating jobs — `app-checks` (typecheck + unit tests + Next build +
OpenNext bundle), `lambda-checks`, and the **new `pipeline-checks` job this
branch adds** (`pipeline:typecheck/test/doctor/build`) — only on the
`pull_request` event and on `push` to `main`. A PR (**#297**, base `main`) was
opened to trigger them, but **GitHub created no `pull_request` run** because the
PR is in merge-conflict (blocker #2): the merge ref cannot be built, so the
checks never start. The `push`-event run that exists for the SHA
(`28108939744`) has **0 jobs** (a feature-branch push matches no job's branch
filter) and is not green evidence.

GitHub Actions itself is healthy — other PRs (`fix/auth-hardening`,
`fix/data-retention`, `fix/gdpr-erasure-billing`, …) ran `pull_request` CI to
`success` minutes before. The local run above already demonstrates the new
`pipeline-checks` job would pass; once blocker #2 is resolved and CI runs green,
the run/job identifiers must be recorded here.

| CI item | Value |
| --- | --- |
| PR | #297 (`fix/v21-pipeline-hardening-2026-06` → `main`) |
| Required jobs (from `ci.yml`) | `app-checks`, `lambda-checks`, `pipeline-checks` |
| `pull_request` run on `4a8906b2c…` | **none created (PR conflicting)** |
| Check-runs / statuses on `4a8906b2c…` | **0 / 0** |
| Stray `push`-event run | `28108939744` — 0 jobs, not gating |

## Re-verification After Documentation Commit (Procedure §11)

This document is committed atop the verified SHA `4a8906b2c…` as a
**documentation-only** delta (no code or state change). After the commit, an
exact-tip re-verification is performed against the resulting branch tip
(re-running `npm ci` + `pipeline:typecheck/test/build/doctor` and the
state/library audits in a fresh clean checkout) to confirm the documentation
commit does not alter any gate result. The resulting tip and re-verification
outcome are recorded in the session log accompanying this commit.

## Summary of Remaining Risks (must be zero for release)

| # | Risk | Severity | Status |
| --- | --- | --- | --- |
| 1 | `library-state.json` stale-ledger drift (`rebuild --dry-run` exit 1) | Release blocker | **OPEN** (owner-owned) |
| 2 | `books.json` merge conflict with `main` | Release blocker | **OPEN** |
| 3 | Required CI not green on the SHA (blocked by #2) | Release blocker | **OPEN** |
| — | Test suite writes untracked `zz-fixture` state artifacts | Minor / hygiene | Noted, non-blocking |
| — | 5 `npm audit` advisories (1 low, 4 moderate) | Minor | Noted, unrelated |

**Three release blockers are open. This branch is not cleared for merge or
production until all three are zero.**
