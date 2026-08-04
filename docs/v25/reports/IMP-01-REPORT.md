# IMP-01 — Conductor-Owned Chapter Output, Atomic Commit, and Transient-Read Safety

**Status:** Implemented and verified (typecheck clean; full hermetic suite **2,098 pass / 0 fail / 0 xpass**; architecture-qualification probes recorded).
**Baseline:** `1946b320b` (IMP-00) on `feat/v25-pipeline`. **Findings:** F-001 (P0), F-020 (P0). **Gate:** G1.
**Machine-readable report:** `implementation-report.imp-01.json`.

## 1. What changed

Before: author/repair agents wrote the CANONICAL chapter path directly
(workspace-write at the pipeline root); the conductor validated whatever landed
and byte-restored on failure; repair even wrote spliced-but-unvalidated bytes
back to canonical before gating them. Three windows the `range` campaign hit
live: concurrent readers parsing half-saved files (conductor crash, six
orphaned writers), failed drafts shadowing reviewed bytes until restore, and
restore itself failing (F6).

After (the plan's qualified isolated-writable protocol, §8.8):

```text
mint attempt (immutable identity + expected canonical base hash + workspace)
→ agent runs with cwd = attempt workspace — its ONLY writable directory;
  the card names ONE output file; no repository path, no CLI commands
→ conductor: unexpected-write check → candidate import (size cap, JSON parse,
  identity) → gate composite IN PROCESS with COMMITTED siblings as context
  → rubric with the candidate SUBSTITUTED into the committed book → write
  contract → compare-and-swap atomic commit through the io seam
→ failed / malformed / stale attempts leave canonical bytes untouched
  (the restore lane is structurally unnecessary — deleted, not weakened)
```

Repair follows the same protocol with a SEEDED workspace (the agent edits a
COPY of the reviewed chapter); the conductor splices scoped fields in memory,
revalidates everything, and CAS-commits. `RepairRestoreError`/`restoreFailed`
remain exported for callers but can no longer occur.

## 2. Surfaces

- **`src/orchestrator/chapterTransaction.ts`** (new): attempt mint/identity
  (frozen `candidate-transaction` v1), candidate import, workspace containment,
  in-process gate/rubric candidate validation, CAS commit with a recoverable
  pending/committed/aborted manifest bracket, deterministic idempotent crash
  recovery (runs on every mint), attempt-outcome evidence, bounded stale sweep.
- **`src/critics/chapterGateComposite.ts`** (new): the COMPLETE `gate-chapter`
  verdict (ship gate, intra-book siblings, IDN, advisory layers, combined
  verdict line, gate-attempt history + STUCK/FORM-SHIFTING breakers) extracted
  verbatim from cli.ts; the CLI verb delegates — one composition, zero drift.
  Sibling context comes from the chapter's canonical home, so a candidate is
  compared against the COMMITTED book and excluded from itself.
- **`authorRun.ts`**: per-attempt workspace spawns (`skipGitRepoCheck`, cwd =
  workspace); candidate import replaces disk sniffing; gate/rubric/contract read
  the candidate; commit + provenance on success; restore lane deleted; atomic
  `writeFileAtomic` default for the canonical io seam; `AuthorIo` gains
  `gateCandidate` / `rubricWithCandidate` / `attemptsRoot` (tests inject these
  where they previously stubbed runVerb).
- **`authorRepair.ts`**: seeded-workspace protocol; in-memory splice+validate;
  CAS commit; zero direct fs writes remain in the module (pinned by test).
- **`bakeoff/candidates.ts`**: slot-local `attemptsRoot`; rubric interception
  moved from the runVerb layer onto the io seam (candidate substituted into the
  SLOT's committed chapters). Slot-rooted commits flow through the existing
  slot io unchanged.
- **Cards**: the writer's OUTPUT is the candidate FILE NAME in its own working
  directory; the `Then run: npx tsx src/cli.ts gate-chapter …` instruction is
  REMOVED from self-verify and the repair card (IMP-01 item 7 — the conductor
  owns validation; agents cannot reach the repo CLI from their workspaces).
- **Profiles**: `author-writer` / `author-repair` cwd policy → `isolated-workspace`.
- `.gitignore`: `.attempts/` (bounded by `sweepStaleAttempts`, 7-day default).

## 3. Architecture qualification (plan item 2) — recorded evidence

Preferred-protocol probes (read-only agent emits the complete chapter as its
final message), run live on codex-cli 0.144.1, gpt-5.5 @ low, hermetic flags:

- **Probe A** (`-o` capture, 33,278-byte REAL chapter — the corpus maximum —
  echo task): **did not complete within 420 s**; the `-o` file was never
  created (codex writes it only at completion). SIGKILL at timeout.
- **Probe B** (`--output-schema` + `-o`, same payload): **did not complete
  within 540 s** either — the schema-constrained route shows the same
  serial-emission wall; no output file, no partial bytes.

Selection: **isolated attempt workspace** — evidence-forced per plan item 2
("select the preferred path unless evidence proves it unsuitable": two
independent probes, both final-message protocols, corpus-max payload, zero
completions inside 7–9 minutes at low effort).
Rationale beyond the probe evidence: the workspace protocol preserves the
writer's iterate-and-self-check dynamics that 2,098 pinned tests encode, adds
zero serial final-message emission tail to already 15–40-minute xhigh writer
sessions, makes truncation impossible (file writes are incremental tool use),
and achieves the SAME authority boundary — the candidate file is the only
writable path, and the canonical store is mutated exclusively by the
conductor's CAS commit. `--output-schema` remains qualified-available (IMP-00
CLI qualification) for single-shot roles (IMP-08 reviewer outputs, IMP-11
judges), where responses are small and iteration is not wanted.

## 4. Tests

New `tests/chapter-transaction.test.ts` (12): identity/schema, seeding, import
rejections (missing/malformed/oversized/wrong-identity), containment, CAS
commit + generation, stale_base, two-attempt race, crash recovery (both
crash points, idempotent), mint-time recovery, finalize lifecycle, pending-
aware sweep, and the static no-direct-canonical-writer scan.

Updated to the new invariants (stronger, same intent): `author-arch` (harness
drops candidates into the spawn cwd; gate/rubric stubs moved to the io seam;
in-memory canonical store so units never touch real state), `author-write-
restore` (restore pins → zero-canonical-writes pins + commit-failure-throws),
`lead-degradation`, `register-advisory-surfacing`, `model-bakeoff-args`,
`model-bakeoff-generation`, `model-bakeoff-helpers`.

Full suite: **2,098 pass / 0 fail / 0 xfail / 0 xpass / 18 skip / 6 xenv**.

## 5. Behavior changes to know about

1. Writers/repairers can no longer read the pipeline via relative paths or run
   CLI verbs (cwd is the workspace). Cards are self-contained (they always
   embedded brief+packet+schema); the in-session `gate-chapter` self-converge
   loop is gone — the conductor's existing bounded retry carries the blockers
   instead (caps unchanged: 1+1 write attempts, one surgical grant, one regen).
2. `gate-chapter` CLI output and exit semantics are byte-preserved via the
   extraction; per-chapter gate-attempt history keys are unchanged.
3. A commit-write failure now THROWS (infrastructure) instead of any silent
   path; the pending bracket is recovered deterministically on the next mint.
4. The regen no-op guard reads the candidate hash (was: disk re-read).

## 6. Residual risks / debt

- The v23 legacy writer fanout (autopilot §write for non-author books) and
  compilerRun section writers still write chapter/section artifacts directly
  from pipeline-root cwd — legacy-route debt, documented, NOT the active v24
  author route. Migrating them is follow-up work outside IMP-01's author-route
  scope (the plan's F-001 evidence is the author route).
- `.attempts/` failed-candidate retention is interim forensics until IMP-10's
  evidence store (bounded by the 7-day sweep).
- Surgical repair still transports a whole-chapter candidate (splice-limited);
  the typed-patch protocol is IMP-07's package on the frozen `repair` v1 contract.

## 7. Constraint compliance

No gate/threshold/blocker/cap/acceptance change (`gateChanges: []`); no
book-specific behavior; no silent fallback (stale_base never rebases or
auto-retries); no publish/promote/deploy/S3; production state untouched by
tests (in-memory io + tmp attempt roots); no prose-quality claims.
