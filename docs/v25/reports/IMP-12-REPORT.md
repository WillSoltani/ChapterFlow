# IMP-12 — Hermetic Migration Regression, Hostile-Context, Contract, and Cross-Book Fixtures

**Status:** Implemented and verified (typecheck clean; full suite **2,155 pass / 0 fail**, +20 new tests;
`contract-validate` PASS). **Baseline:** `39a172d00` (IMP-03). **Findings:** F-018 (P2), and the shared
contract/worker-report governance for every parallel package. **Phase 3 checkpoint (with IMP-10):**
tests use temporary roots and controlled homes; hostile instruction/config and prompt-injection cases
exist; no unit test requires live model/network.
**Machine-readable report:** `implementation-report.imp-12.json`.

## 1. What shipped

**Test-root abstraction (item 1)** — `tests/testRoots.ts`: `mkTestRoots()` returns one disposable base
with a typed slot per root (state, attempts, evidence, exec-logs, workspaces, home, bakeoff, reviews)
plus `dispose()`. Bases are pid+sequence-unique, so parallel processes and repeated rigs never collide
even reusing book/attempt IDs (red-team "two tests collide on IDs" — they collide under *different*
roots, which is fine).

**Production-leak detector (item 2)** — `tests/productionLeakGuard.ts` stat-walks each production root
(path → `size:mtime`, never reading file bodies — the user's `~/.codex` is stat'd, never opened) and
diffs before/after. Wired into `tests/run.ts`:
- the **forbidden repo-root shadow** `<repo>/state` (CLAUDE.md P0) is guarded on EVERY `npm test` run
  and is currently clean — a write to it fails the run as loudly as a test FAIL;
- `CHAPTERFLOW_LEAK_GUARD=1` (`npm run test:hermetic`) additionally guards the pipeline
  `state/`/`logs/`/`.attempts/`;
- `~/.codex` is enumerated but deliberately not diffed by the runner (reads for envelope auth-copies
  are legitimate and a live Codex session mutates it independently; auth-copy safety is pinned by
  `exec-envelope.test.ts`).

**Frozen-contract compatibility + worker-report governance (items 3-5)** — the Phase-0 contract
manifest already exists (IMP-00); IMP-12 adds the CI enforcement. New CLI verb `contract-validate`
(non-network): asserts `contractFreezeDivergences()` is empty (a parallel agent's schema fork fails
here) and validates every landed worker report against the frozen schema. Package scripts
`contract-validate`, `test:hermetic`, and `ci` (typecheck → contract-validate → test).

**Generic fixture factories (item 6)** — `tests/migrationFixtures.ts`: schema-valid defaults + override
hook for packet, plan (+unit), chapter, attempt identity, candidate record, commit manifest, repair
finding, chapter patch, route result, evidence manifest. `FORBIDDEN_PLAN_UNITS` catalogs each
contract-invalid source-plan combination. Synthetic only — no deleted prose, no real catalog slug.

**Hostile ambient context + injection catalog (items 8-9)** — `tests/hostileHome.ts`:
`buildHostileHome(homeRoot)` writes a fake `~/.codex` (config re-routing model/effort/sandbox, hooks,
MCP server), global + project `AGENTS.md`, rules, and hostile env — under an INJECTED home, never
`$HOME`. `INJECTION_STRINGS` is the shared prompt-injection catalog (instruction override, role
reassignment, control-field mutation, shell/tool call, output redirect, delimiter forgery, schema
forgery).

**Meta-tests (items 7, 10-13, 16-17)** — four new files, 20 tests:
- `production-leak-guard.test.ts` (5): roots disposal + isolation; walk/diff detects add/change/remove
  and is clean on a no-op; guarded-root enumeration; planted-write reporting on a controlled root.
- `hostile-context.test.ts` (5): hostile-home construction; the hermetic env allowlist drops every
  hostile variable and forces `CODEX_HOME`; HOME-passes-but-CODEX_HOME-wins; every injection string
  stays data through the typed envelope; reviewer least-authority at the profile level.
- `migration-contracts.test.ts` (7): contract-freeze parity; all landed worker reports valid with
  adverse fields explicit; a report missing an adverse field / misreporting results is rejected;
  fixture factories emit schema-valid artifacts; every forbidden plan combo rejected; a repair finding
  with any forbidden control field rejected; disjoint outcome unions.
- `cross-book-fixtures.test.ts` (3): two materially different book profiles (research/explanation-heavy
  with contested evidence and no scene-worthy cases vs example-heavy with documented cases + a framed
  device) exercise the ontology along different axes; deterministic-compile immutability + no
  cross-profile contamination; the anti-hard-code scan (no production source hard-codes a `zz-*`
  fixture id — currently zero) and the fixtures-own-their-ids proof.

**Documentation (item 20)** — `tests/TEST-ARCHITECTURE.md`: entry points, the hermeticity model, the
known legacy-leak baseline with the exact closing recipe, injected roots, fixtures, and how future
incidents become fixtures / how contract versions evolve.

## 2. Adverse finding — the suite is not yet fully hermetic (F-018, honest)

The leak guard immediately found what F-018 names: pre-IMP-12 tests mutate the pipeline's own roots by
using default paths instead of injected ones. Measured over one `npm run test:hermetic` run:

- `state/`: +9 added (`qc-preflight/**` scout-reads), ~35 changed (`autopilot-logs/**`,
  `gate-attempts.json`, `provenance/**`, `qc/**`, `library-state.journal`)
- `logs/exec/`: +3 (real spawn manifest/result/route sidecars)
- `.attempts/`: +12 (real attempt workspaces, e.g. `zz-fixture-stier/ch01/**`)
- `<repo>/state` (forbidden shadow): **CLEAN** — the P0 invariant holds.
- `~/.codex`: churns from the live Codex session (this environment), NOT the suite — excluded by design.

Offending test files: `autopilot`, `qc-converge`, `stier-levers`, `stier2-levers`,
`research-freshness`, plus the author/publish/qc tests listed in `TEST-ARCHITECTURE.md`. This is the
F-018 debt made VISIBLE and CI-checkable, not newly introduced. IMP-12 ships the detector + the ratchet
(the always-on shadow gate + the opt-in full guard) and the migration path (`mkTestRoots()` +
io-seam/roots-param threading, exactly as the IMP-01+ author tests already do). Closing the legacy
offenders is incremental follow-on; **every new test in this package is hermetic** (all 20 use tmp
roots / in-memory validators only), which is what the rollback criterion ("Stop if tests mutate
production state") governs for added tests.

Why the full guard is opt-in, not always-on in `npm test`: making it a hard gate today would fail the
suite on the pre-existing legacy leaks before they are closed. The always-on portion is scoped to the
one invariant that is already clean and is the true P0 (the forbidden repo-root shadow). This is a
deliberate, documented staging — not a silenced cap (`TEST-ARCHITECTURE.md` lists the full baseline).

## 3. Verification

- `npx tsc -p . --noEmit` clean.
- `CHAPTERFLOW_NO_API_CODEX_QC=1 tsx tests/run.ts` → **2,155 pass / 0 fail** / 18 skip / 6 xenv, exit 0
  (the always-on forbidden-shadow gate passed — `<repo>/state` untouched).
- `CHAPTERFLOW_LEAK_GUARD=1 …` → suite passes, then the full guard reports the §2 legacy leaks and exits
  1 (proving the ratchet fires end-to-end).
- `npm run contract-validate` → PASS (contract-freeze parity + IMP-00..03 worker reports all valid).
- Removing a protection fails its fixture (verify step 5): the walk/diff test plants a write and asserts
  it is reported; the contract test mutates a good report and asserts rejection.

## 4. Deliberate scope boundaries (recorded, not hidden)

Instructions 14-15 (human-labeled judge-qualification corpus; statistical fixtures for paired/clustered
analysis, zero-event bounds, sequential stopping) are **IMP-11's** substrate — they describe the
evaluation harness's inputs, which do not exist until IMP-11. IMP-12 ships the generic factories,
contract governance, hostile-context, leak guard, and cross-book profiles those will build on; the
judge/statistical fixtures land with IMP-11 to avoid freezing an interface before its consumer exists
(the plan's own "contract-change rule"). Recorded in `unresolvedRisks`.

The full always-on leak gate is staged behind closing the legacy offenders (§2). Root CI wiring
(instruction 19, "coordinate root CI changes explicitly") is provided as package entry points
(`npm run ci`, `contract-validate`, `test:hermetic`) rather than an edit to the outer monorepo's CI —
touching outer CI is out of scope for a no-push package and needs explicit owner coordination.

## 5. Constraint compliance

No gate/threshold/blocker/cap/acceptance/independence/promotion weakened. No book/chapter-specific
production behavior (the anti-hard-code scan proves production source carries zero `zz-*` ids). No
silent fallback; no unbounded retries. No live model/network in any unit test (all synthetic /
in-memory). No publish/promote/deploy/upload/commit-to-outer/push. No production state as a fixture
(the guard now *enforces* this for new tests). No quality claims from fixture tests. Frozen contracts
untouched (manifest byte-identical; `contract-validate` PASS).
