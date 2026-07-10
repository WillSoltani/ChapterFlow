# V24 Remaining Fix Prompts (post-verification)

**Date:** 2026-07-08 · Companion to `V24_IMPLEMENTATION_VERIFICATION_REPORT.md`.

All 12 original prompts verified as implemented; **no S0/S1 issue remains open.** What remains is
small: one pre-existing test failure (R1), one shared correctness nit in an off-by-default gate
(R2), one operational precondition (R3), and two optional owner-awareness items (R4, R5). R1-R3
should land before the pipeline is declared production-ready; R4-R5 are non-blocking.

Also listed at the end: the **controlled validation run** the readiness classification requires —
an owner-run procedure, not a coding prompt — and the standing owner decisions already packaged in
`ACCEPTANCE-GATE-POLICY.md`.

Global constraints for every prompt: do not push/publish/deploy; do not lower gates; do not rewrite
books; back up any state file you must rewrite; keep the suite at `pass ≥ 1856 / fail 0 (after R1) /
xenv 6` with any new failing NAME treated as your regression.

---

## Prompt R1: SC11 anchor-check precedence — the last suite failure

### Role
Pipeline engineer on the source-grounding validator. You resolve a deterministic code-vs-test
disagreement so the suite reaches a true `fail 0`.

### Context
`tests/source-anchored-planning.test.ts` — "source-v2 provenance rejects nonexistent,
wrong-chapter, placeholder, and unsupported anchors precisely" — fails with:
`unsupported should raise SC11.6.unsupported_anchor; got SC11.2.anchor_specific_not_present:ch01.ex.lantern`.
This failure is **pre-existing** (present in the clean-HEAD baseline; both the test and
`src/critics/sourceGrounding.ts` are unmodified by the recent fix wave) and is the only remaining
`fail` in the suite. The test plants an anchor that EXISTS and is chapter-correct but does not
SUPPORT the unit's claim type, and expects the precise code `SC11.6.unsupported_anchor`; the
validator currently reports the coarser `SC11.2.anchor_specific_not_present` first (a
verbatim-specific check winning precedence over the claim-type-support check).

### Input
- `tests/source-anchored-planning.test.ts` (the failing case and its fixture — read what the
  planted "lantern" anchor actually contains)
- `src/critics/sourceGrounding.ts` (SC11.2 and SC11.6 check order; ~:305 for SC11.6 per the
  original audit)
- `git log -p --follow` on both files to find when the precedence last changed and which behavior
  is newer/intended
- Any SC11 calibration notes in `docs/` or code comments

### Objective
The suite reaches `fail 0` by making the validator and the test agree on which SC11 code fires for
an existing-but-unsupportive anchor — WITHOUT weakening what blocks.

### Requirements
1. First determine intent from history: if SC11.6 was designed to fire for exists-but-unsupported
   anchors (the test's position), reorder/scope the checks so SC11.2 fires only when the anchor's
   verbatim specific is genuinely absent, and SC11.6 when present-but-unsupportive. If instead the
   validator's behavior is intended, change the test's expected code and document why in the test.
   Prefer the fix that keeps the more PRECISE, actionable code for each failure mode.
2. Either way, both codes must remain **blockers** for v2 chapters (severity unchanged); the total
   set of rejected fixtures in the test must not shrink.
3. Add one regression fixture per side of the boundary: anchor-missing-specific → SC11.2;
   anchor-present-but-unsupportive → SC11.6.

### Implementation plan
History read → decide intended semantics (state it in the PR/report) → minimal reorder or test
correction → boundary fixtures → full suite.

### Tests
The currently-failing case passes; the two new boundary fixtures pass; no other SC11 test changes
behavior; full suite `fail 0`.

### Red-team checklist
- Does the reorder let a genuinely-missing anchor slip through as merely "unsupported"? (Both must
  still block; check the severities in `finalGate`'s catalog.)
- Does any OTHER test depend on the current (coarse-first) precedence? Run the full suite, not just
  this file.
- Is the fix scoped to check ordering — no relaxation of what counts as "supports the claim type"?

### Output
Report: the intended-semantics determination with history evidence; files changed; before/after
codes for the four planted-anchor fixtures; full-suite counts.

### Constraints
Global constraints. Do not downgrade either SC11 code's severity. Do not touch unrelated SC11
quota logic (P15 rebalance is pinned by its own test).

---

## Prompt R2: Restore author-provenance attribution on revert/restore paths

### Role
Pipeline engineer on authoring provenance. You fix a shared staleness nit so restored chapters
keep truthful authorship records.

### Context
Author provenance is one file per chapterId (`src/qc/sessionProvenance.ts:187-211` —
`writeAuthorProvenance` overwrites on a "changed content" transition, keeping
`previousContentHash`/`previousAuthorSessionId`). Every revert path — the sameness driver's
quality/devices-persisted reverts (`bookSamenessRun.ts`), the acceptance-regen restore
(`authorReview.ts` `restore()`), and the surgical-repair restore (`authorRepair.ts`) — puts the
PRIOR bytes back on disk but leaves the provenance record pointing at the DISCARDED draft
(contentHash B, session S2) while the chapter is again content A authored by S1. Consumers:
session-independence gates (`qcAttestation.ts:317-329` `QC0.author_graded_own_work`, finalize's
certification checks, `authorRun.ts:118` `authorSessionOf`). Effects are edge-case (the
independence gate is enforced only under `CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE=1` / no-api
mode) but real: a reviewer equal to the true author (S1) is no longer flagged; a reviewer equal to
S2 is wrongly flagged; carry logic reading `authorSessionOf` sees the wrong author. This pattern
PRE-DATES the recent fixes (P2/P3 added instances, not the mechanism).

### Input
- `src/qc/sessionProvenance.ts` (record/load/write semantics; the v2 conflict rules)
- The three revert sites: `bookSamenessRun.ts` (`diversifyOne` revert branches),
  `authorReview.ts` (`restore()` in the acceptance-regen block), `authorRepair.ts` (restore path)
- Consumers listed above; `tests/author-provenance.test.ts` (existing coverage)

### Objective
After any revert/restore, `loadAuthorProvenance(chapterId)` attributes the on-disk bytes to their
true author again.

### Requirements
1. Add a narrow helper in `sessionProvenance.ts` (suggested: `restoreAuthorProvenance(chapterId,
   expectedCurrentContentHash)`) that rewrites the record back to the PRIOR attribution using the
   stored `previousContentHash`/`previousAuthorSessionId` — only when the current record's
   `contentHash` does NOT match the restored bytes and the previous one DOES. If the previous
   fields are absent (v1/legacy), leave the record and log; never fabricate a session id.
2. Call it from all three revert sites, passing the restored bytes' `chapterContentHash`.
3. Keep the create-once/conflict semantics for normal writes untouched.
4. The helper must be safe when the provenance file is missing/corrupt (no-op + log).

### Implementation plan
Helper + unit tests against the four record states (v2-with-previous, v2-without, v1, missing) →
wire the three call sites → integration assertion in each lane's existing revert test.

### Tests
- Unit: the four record states above.
- Integration: extend `content-device-verify.test.ts` (devices-persisted revert) and the P3
  acceptance-restore test to assert `loadAuthorProvenance(ch).contentHash === restored hash` and
  `authorSessionId === original author`.
- Regression: `author-provenance.test.ts` + full suite.

### Red-team checklist
- Could the helper clobber a legitimate NEW record if called out of order (restore after a
  subsequent successful write)? The `expectedCurrentContentHash` guard must make it a no-op then —
  test it.
- Does it interact with `AuthorProvenanceConflictError` (same-content-other-session)? It must
  bypass the conflict check only for this explicitly-guarded rollback.
- No behavior change when `CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE` is unset (record contents
  change; gate outcomes only under the flag).

### Output
Files changed; the four-state matrix results; the three call sites; full-suite counts.

### Constraints
Global constraints. Never invent a session id; never delete a provenance file.

---

## Prompt R3 (operational): Commit the union tree in reviewable slices

### Role
Release engineer. You turn ~2,558 uncommitted lines from multiple agents into reviewable,
independently-verified commits on `feat/anti-sameness-live-fix`. This is the precondition for any
production claim — an uncommitted union tree on a shared checkout is the repo's known
multi-session-collision hazard.

### Context
All 12 implementations are uncommitted. Files map to lanes (see the verification report's matrix).
The ` M state/briefs/start-with-why.manual-brief.json` diff is the F-01 revert EVIDENCE — its
content is now neutralized by the sanitizer, and the committed (HEAD) version carries the better,
hand-de-mandated charter which the new reconcile logic will preserve on future derives.

### Objective
A clean series of commits, each typechecking and passing the suite, with the working tree empty of
tracked modifications afterward; no implementation evidence lost.

### Requirements
1. Commit order and grouping (mirrors verified dependency order):
   c1 P1 (voiceBible/voiceCard/cli-derive/manualBriefReconcile + its 3 test files);
   c2 P2 (contentDeviceDeal detectors+verify, bookSamenessRun, its 2 test files);
   c3 P3+P4+P6+P9 (authorReview/authorReviewLedger/shippedControl/liveRun + their tests + policy
   memo + P9 report) — they interleave in one file; do not split them artificially;
   c4 P5+P7 (briefRotation, authorRun rotation lines, critics, structuralSameness*, their tests);
   c5 P8 (quizKeyEvidence, promoteBook wiring, its test);
   c6 P10 (doctor, publishFinal reader, cli book-status, runbook, its tests);
   c7 P11 (tests/run+harness+converted suites + coverage-gap report);
   c8 P12 (blockedReportRetention, cleanupBookDebris, source-integrity, doctor-locks, .gitignore)
   — adjust only if `git add -p` reveals a cleaner split; record the final mapping.
2. **Brief file:** restore the HEAD version (`git checkout -- state/briefs/start-with-why.manual-brief.json`)
   so the de-mandated charter is what future reconciles preserve. Record in the commit message of
   c1 that the working-tree revert (derivedAt 2026-07-07T23:11Z) was audit evidence, neutralized by
   the sanitizer, and is documented in the two audit reports.
3. After EACH commit: `npm run typecheck` + the lane's focused suites; after the last:
   full `npm test` — expect `pass 1856 / fail 1 (SC11, pre-existing — or 0 if R1 landed first) /
   xenv 6`.
4. Untracked non-deliverable debris (fixture reports, scratch) stays untracked — commit only the
   files in the report's inventory plus the docs/v24 deliverables.
5. **Do not push.** Leave the branch local for owner review.

### Tests
The per-commit gates above; a final `git status --porcelain` showing only intentionally-untracked
paths.

### Red-team checklist
- Any file simultaneously touched by two lanes committed in the wrong slice? (`cli.ts` has P1, P10,
  P11/P12 hunks — use `git add -p`.)
- Does any commit transiently break the suite in a way the next fixes? Each must stand alone.
- Confirm another live session is not mid-write on this checkout before starting (the collision
  trap).

### Output
The commit list with per-commit verification results; final status; any hunks that required
re-mapping.

### Constraints
Global constraints; especially do not push and do not commit state debris.

---

## Prompt R4 (optional, owner-awareness): active-book calibration runs for cast/name pins

### Role / Context / Objective
P11's xenv preconditions now require a SHIPPED package for the cast-discipline/name-commonality
zero-FP pins, so they no longer run on the active campaign book (previously they ran — and failed —
on `start-with-why`, which was part of the old baseline). That's defensible (they are
reference-corpus calibration pins), but it removes a live FP-signal on the book being worked.
If the owner wants it back: add an opt-in flag or a separate non-gating "calibration report" verb
(`npx tsx src/cli.ts calibration-scan <bookId>`) that runs the same detectors against any on-disk
book and prints findings WITHOUT failing the suite. Small; requires no gate changes; tests: verb
prints findings on a planted fixture, exits 0 regardless.
**Constraint:** must not reintroduce the old always-fails-on-active-book baseline noise.

---

## Prompt R5 (optional, tiny): P8 polish — stateRoot threading + CLI visibility

### Role / Context / Objective
Two small hardening items from verification: (a) `resolveBookKeyEvidence(loadedChapters)` at
`promoteBook.ts:665` reads the real review ledger via defaults; if a promote state-root injection
is ever added (it was NOT in P11), thread an options `stateRoot` through so key evidence reads the
same root as the rest of promote. Do the plumbing now (optional param, default current behavior).
(b) Confirm the operator-facing promote CLI print includes the per-chapter `quizKeyEvidence.lines`,
not just the summary in `reason` — if not, print them under the report. Tests: a promote run with
one UNVERIFIED chapter shows its per-chapter line in CLI output; default paths byte-identical
otherwise.
**Constraint:** no gate-behavior change; advisory remains advisory.

---

## Not prompts — required next steps outside coding

### The controlled validation run (owner-run; required before "production-ready")
Sequence (after R3, in this order, no publish, no push):
```
# 1. sanity: doctor + the sanitized card
npx tsx src/cli.ts doctor start-with-why

# 2. content-device repair with live device verification (bounded, revert-protected)
CHAPTERFLOW_ALLOW_MODEL_GEN=1 npx tsx src/cli.ts content-repair-book start-with-why --log <file>

# 3. full author review + acceptance, no publish
CHAPTERFLOW_ALLOW_MODEL_GEN=1 npx tsx src/cli.ts book-run start-with-why --author --no-publish --log <file>
```
Read the outcome diagnostically: `devices-persisted` statuses = measured writer ceiling (the
previous session's hypothesis, finally testable); kept-and-clean repairs + improved acceptance =
the pipeline was the binding constraint. Either way the result is honest — statuses, ledgers, and
the acceptance record capture it. Budget note: regen lanes are partly exhausted (ch 1,2,4,6,11,14);
the content lane is unspent for all 14 chapters.

### Standing owner decisions (already packaged, not blockers)
Documented with tradeoffs in `docs/v24/ACCEPTANCE-GATE-POLICY.md` and the P8 report: (a) should
unanimous churn-HIGH ever veto; (b) should fresh books face more than the 74 floor; (c) should
UNVERIFIED quiz keys block promotion. All three currently preserve the 2026-07-04 calibration.
