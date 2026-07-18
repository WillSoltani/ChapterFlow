# IMP-10 — Durable Attempt, Execution-Context, Repair, Review, and State-Transition Evidence

**Status:** Implemented and verified (typecheck clean; full suite **2,168 pass / 0 fail**, +13 new tests;
`contract-validate` PASS). **Baseline:** `d4c4416d0` (IMP-12). **Findings:** F-014 (P2); F-001/F-003/F-019..F-024 inputs.
**Phase 3 checkpoint (with IMP-12):** immutable manifests link execution/input/output/route/filesystem/
outcome/termination evidence; content-addressed; retention-bounded; excluded from canonical scans/packages.
**Machine-readable report:** `implementation-report.imp-10.json`.

## 1. What shipped

`src/evidence/evidenceStore.ts` — a content-addressed, append-only evidence store implementing the
frozen `attempt-evidence-manifest` v1 contract (unchanged — no version bump):

```
<evidenceRoot>/
  objects/<aa>/<sha256>          content-addressed blobs (atomic tmp→rename, deduplicated)
  attempts/<attemptId>/
    manifest.json                AttemptEvidenceManifestV1 (frozen schema)
    journal.jsonl                append-only raw state-transition stream
```

- **Content-addressed objects (items 4-5):** `putEvidenceObject` hashes the REDACTED bytes, stores at
  `objects/<aa>/<hash>`, dedups by hash, writes atomically. Candidate bytes, task cards, final messages,
  commit manifests, attempt identities, patches, review docs all store once per unique content.
- **Append-only manifests + journal (items 1, 9):** `openAttemptEvidence` writes the manifest and first
  transition; `appendTransition` GROWS both the manifest array (queryable) and the raw `.jsonl` (never
  replaced by a summary — rollback criterion). Reopening an id APPENDS (resume-safe), never clobbers.
- **17-state journal (item 9):** the frozen `AttemptStateV1` union (allocated → workspace-ready →
  running → process-ended → output-ready → candidate-ready → commit-pending → committed / validation-failed
  / review-failed / repair-planned / repaired / regenerated / carried / superseded / cleaned /
  recovery-required).
- **Redaction (item 13, rollback "secrets leak"):** `redactEvidence` strips secret-shaped values
  (OpenAI/AWS/Slack/GitHub tokens, PEM private keys, `*key/secret/password/token=…`) and the absolute
  home path from EVERY object and manifest field before storage; idempotent. Proven: a seeded
  `sk-…` secret is absent from the on-disk store (unit test + live CLI smoke).
- **Reconstruction/query (item 15):** `reconstructAttempt` rebuilds one attempt chronologically from the
  manifest + objects (no debris scan), verifying every object hash against stored bytes;
  `evidenceLineageGraph` emits a machine-readable graph for integration/bakeoff tooling (verify step 6).
- **Retention + protected-reference cleanup (items 11-12):** `RETENTION_WINDOWS_MS` per class (bounded:
  migration-experiment 30d, temporary-workspace 7d, infrastructure/rejected 90d; accepted-production and
  sensitive-source `null` = owner decision only). `planEvidenceCleanup` is DRY-RUN by default and REFUSES
  to delete active-state, cited (`protectedRefs`), or never-expire evidence.
- **Stale-evidence classification (item 17):** `classifyEvidenceStaleness` flags an attempt whose recorded
  lineage inputs (source-plan / execution-profile / renderer hash) no longer match the live pipeline.

`src/evidence/attemptRecorder.ts` — the thin, **best-effort, opt-in** binding to the IMP-01 transaction:
- `resolveEvidenceRoot` returns non-null ONLY from an explicit param or `CHAPTERFLOW_EVIDENCE_ROOT`.
  **OFF by default** — the existing hermetic suite writes zero evidence (no new tmp files, no
  perturbation, no new leak).
- `recordAttemptMint` (allocated → workspace-ready + attempt-identity/seed objects), `recordSpawnEvidence`
  (running → process-ended, links the IMP-00 effective-context manifest + route sidecar, stores the
  rendered card + final message), `recordAttemptFinal` (the frozen terminal state per outcome).
- Wired into `chapterTransaction.ts` (mint/commit/finalize) and the author/repair conductors after each
  spawn. Every hook is guarded by `attempt.evidenceRoot` and swallows its own errors — **observability
  never gates or fails a content attempt.**

CLI (item 15, non-network): `evidence-reconstruct [<attemptId>] [--root <dir>]` (per-attempt lineage +
hash verification, or the whole-store graph) and `evidence-cleanup [--execute] [--root <dir>]` (dry-run
retention cleanup). `.evidence/` added to `.gitignore`.

## 2. Provider-outcome + state mapping (items 8-9, no conflation)

`terminalStateForOutcome` maps the frozen 10-value `CandidateOutcomeV1` to distinct terminal states —
`provider_safeguard_or_refusal` → `recovery-required` is DISJOINT from `infrastructure_failure` and from
content `validation_failed` (rollback "provider outcomes are conflated"). `stale_base` → `superseded`;
`committed`/`recovered` → `committed`. Pinned by test.

## 3. Crash / recovery / red-team (items 7, 10)

- The commit swap already brackets with a pending→committed manifest (IMP-01); IMP-10 records
  `commit-pending` + the candidate/commit objects BEFORE the canonical write, so a crash between rename
  and bookkeeping leaves evidence that reconstructs to the true state — a manifest can never claim
  `committed` without the committed hash + bytes (rollback "unsupported success").
- Unexpected writes are already first-class (IMP-01 `unexpectedAttemptWrites`); their outcome maps to a
  `validation-failed` terminal with the reason retained.
- Two attempts never share an id or object path: attempt ids carry pid+counter+timestamp (IMP-01), objects
  are content-addressed.
- Interrupted attempts (opened, never finalized) reconstruct at their last recorded state — no false
  terminal (tested).

## 4. Package / scan exclusion (item 14)

The store lives at `.evidence/` (production) — gitignored, pipeline-local, OUTSIDE `state/`. Chapter
discovery, assembly, packaging, and publish scan only `state/**` (promote) or copy exactly one file
(publishToLive), so evidence is excluded by construction. Tests use `testRoots.evidenceRoot` (tmp). Proven
by a path-shape test + the IMP-12 forbidden-shadow gate.

## 5. Tests (13 new; full suite 2,168/0)

`tests/evidence-store.test.ts`: content-addressing + dedup + atomicity; redaction secret-absence +
idempotence; schema-valid append-only manifest + journal mirror; resume-append (no clobber); reconstruct
success (all hashes verify) and failed/stale/safeguard/unexpected-write/infra/interrupted (disjoint
terminals); tampered-object detection; post-spawn exec-context linkage without state rewrite; dry-run +
execute cleanup with active/cited/never-expire protection + bounded windows; stale-lineage classification;
recorder OFF-by-default activation; the full mint→spawn→final wiring reconstructable under a tmp root;
evidence-outside-state path proof. Live CLI smoke: `evidence-reconstruct` rebuilt a 5-transition committed
attempt, all objects verified, seeded secret absent from disk.

## 6. Honest gaps / deferred (recorded, not hidden)

- **Production activation is opt-in** (`CHAPTERFLOW_EVIDENCE_ROOT` / explicit root), NOT default-on. This
  is deliberate: default-on would either write the real `.evidence/` from unit tests (a new leak the
  IMP-12 guard would flag) or require deep per-test threading. Enabling it in the production pipeline entry
  is a one-line operator config, consistent with IMP-13's controlled-activation philosophy. The mechanism
  is fully wired and tested; the switch is the owner's.
- **Review/acceptance evidence hooks** (two-phase quiz derivation, tiebreak, acceptance invalidation —
  items 4, 6) attach through the SAME store API but their call-site wiring lands with IMP-08 (phased
  review) and the acceptance lane; the manifest already carries `invalidated` on the commit side. Recorded
  as a dependency.
- The mint-time `executionContextManifestPath` defaults to the attempt-identity path (a real, non-empty
  execution anchor carrying the profile/prompt/input hashes) and is upgraded to the IMP-00 spawn manifest
  by `linkExecutionContext` post-spawn — because mint precedes the spawn that produces the manifest.
- JSONL raw-event linkage (item 3) stores the final message + card content-addressed and mirrors
  transitions to `journal.jsonl`; consuming the codex `--json` event stream verbatim is IMP-11 telemetry
  territory (the local text route exposes no token/usage events today — recorded in IMP-02's gaps).

## 7. Constraint compliance

No gate/threshold/blocker/cap/acceptance/independence/promotion weakened (evidence is additive
observability). No book/chapter-specific behavior. No silent fallback (evidence OFF is explicit and
pinned; every hook is best-effort and never alters control flow). No unbounded retention (every class has
a bounded or explicitly-owner-gated window) or retries. No hidden chain-of-thought or secrets stored
(redaction + no CoT capture). No publish/promote/deploy/upload/commit-to-outer/push. No production state
as a fixture (tmp roots only). No quality claims from observability. Frozen contracts untouched
(`attempt-evidence-manifest` v1 implemented, not modified; manifest byte-identical; `contract-validate`
PASS).
