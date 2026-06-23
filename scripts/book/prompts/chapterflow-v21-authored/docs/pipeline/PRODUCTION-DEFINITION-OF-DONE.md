# Production definition of done

A book is production-ready only when the full stack below is green. Most of it is **enforced**, not
just documented: the publish step physically cannot ship a book that fails the QC/publish checks,
and `publish-after-qc` now prints a **checklist of which items passed** (see the bottom). The
research and write checks run in their own phases (`runbook <book>` shows where a book stands).

> This is the acceptance checklist. The *flow* (which prompt to paste, where it stops) is in
> `RUN-A-BOOK.md`; the *failure classes* and their promotion rules are in
> `FAILURE-CLASS-REGISTRY.md`. This file is what "done" means.

## Research
- `check-source` PASS — the bibliography + sidecars are structurally coherent.
- `source-v2-gate` PASS — every chapter sidecar has the required structured fields.
- `source-verify-check` PASS — every named case + testable fact verified against a DISTINCT real
  source (not a rubber-stamp). Run under `CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1` so an ABSENT record
  blocks, not just a bad one.
- `source-fit` not RISKY (advisory) — the source is varied enough for v21 (catch a doomed run early).

## Write
- `author-check` clean for every chapter (advisory shadow rollout — surfaces, drives repair).
- `gate-chapter` PASS for every chapter (deterministic per-chapter ship gate).
- `fanout --barrier` PASS — book-gate clean and no write-barrier-actionable sameness offenders.
- `major-status` PASS — every current major is either absent or closed by a reviewer-attributed,
  content-bound `major-disposition` waiver for the exact finding/content. Legacy/unbound waivers
  remain audit history but do not make production major-clean.

## QC
- `sweep` PASS — no cross-chapter templating.
- keyA + keyB derived in DISTINCT sessions; `manual-keyjudge` PASS — the blind keys agree with the
  source-derived key.
- bar read GREEN + confirm read PUBLISHABLE for every chapter (confirm in a SEPARATE session).
- evidence matrix all PUBLISHABLE; `qc-status` PASS; no stale rounds (a round whose chapters
  changed after it opened is restarted, never force-passed).

## Publish
- `publish-after-qc --dry-run` PASS — the preflight checklist is all green (read-only).
- `publish-after-qc --commit --push` PASS — package written, committed, pushed.
- transient cleanup done — no `REVIEW-PACKET.md` / task cards / `qc-auto.workflow.js` committed
  (the pre-commit hook also blocks these + live `cfq-*` round tokens).
- package exists (`book-packages/<book>.v21.json`), `verify-production-package` PASS, and the
  catalog is registered (`register-web`, which refuses unverified packages).

## The enforced checklist (runtime)
The QC + publish half of this stack is a real gate inside `promoteBook` / `publish-after-qc` — it
re-runs every check from scratch at promote time, so a book that hasn't earned it cannot ship.
`publish-after-qc` (dry-run or real) now prints which items passed:

```
publish preflight — 11/12 checks passed:
  ✓ canonical-chapter-set
  ✓ ship-gate
  ✓ intra-book
  ✓ qc-status
  ✓ quiz-key
  ✓ manual-keyjudge
  ✓ book-gate
  ✓ source-v2
  ✓ plan-enforcement
  ✓ sweep
  ✓ majors
  ✗ source-verify (1 blocker(s))
```

Each `✗` line is followed by its blocking reason. A book is publish-done only when this reads
`N/N checks passed`. (The checklist is `noApiPreflightChecks` in `src/qc/publishAfterQc.ts`.)
