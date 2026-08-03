<!--
  Keep this short. It exists to catch the mistakes that have actually bitten
  this repo (scope creep, missing regen, `git add -A` sweeping the gold
  book-state corpus). Delete instructions, keep the checklist.
-->

## What / why

<!-- Finding ID (if any) + one-line summary of the change and its acceptance evidence. -->

## Checklist

- [ ] `npm run verify` is green locally (typecheck + tests + build).
- [ ] The relevant CI job(s) for this change surface are named explicitly
      (see `.github/rulesets/main-branch.json` for the canonical required-check
      list, and `upgrade/infra-cicd/CLAUDE.md` / `docs/CI_CD.md` §3 for mapping
      change-surface → job).
- [ ] No scope widening beyond the stated finding/task — out-of-scope cleanups
      are a separate PR.
- [ ] If this PR touches a registered native-contract source (see
      `app/app/api/book/_contracts/native-contract-registry.ts`), I ran
      `npm run contract:native:generate` and staged the regenerated
      `contracts/native-ios/v1/` bundle.
- [ ] Staged files were added explicitly by path — **no `git add -A`** (it
      sweeps `scripts/book/**/state/**`, the tracked gold regression corpus).
