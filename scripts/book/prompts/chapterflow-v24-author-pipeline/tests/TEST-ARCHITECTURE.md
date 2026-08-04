# Test architecture (IMP-12)

This suite is a register-style harness (`tests/harness.ts` + `tests/run.ts`), not
`node:test`. Statuses: `pass` / `fail` / `xfail` (known defect) / `xpass` (a defect got
fixed — promote it) / `skip` / `xenv` (required corpus absent — auto-runs where present).
`fail` and `xpass` fail the run; `xenv` never does.

## Entry points (no model, no network)

| command | what it runs |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run contract-validate` | frozen contract manifest ↔ live source + every landed worker report vs the frozen schema |
| `npm test` | full suite + the always-on forbidden-shadow hermeticity gate |
| `npm run test:hermetic` | full suite with the FULL production-root leak guard (`CHAPTERFLOW_LEAK_GUARD=1`) |
| `npm run ci` | typecheck → contract-validate → test, in order |

All are non-network and require no credentials (`CHAPTERFLOW_NO_API_CODEX_QC=1`).

## Hermeticity (the leak guard)

`tests/productionLeakGuard.ts` stat-walks each production root (path → `size:mtime`, no
file bodies read) before the first test loads and re-walks after the last result. Guarded
roots: the pipeline `state/` `logs/` `.attempts/`, the **forbidden repo-root shadow**
`<repo>/state` (CLAUDE.md P0), and (enumerated, read-safe) `~/.codex`.

- The **forbidden-shadow** check is ALWAYS ON in `npm test` — any write to `<repo>/state`
  fails the run. It is currently clean and must stay clean.
- The **full guard** (`CHAPTERFLOW_LEAK_GUARD=1`) additionally fails on any mutation of the
  pipeline roots. `~/.codex` is deliberately NOT diffed by the runner: reads for
  envelope auth-copies are legitimate and a live Codex session mutates it independently;
  the auth-copy safety invariant is pinned by `tests/exec-envelope.test.ts` instead.

### Known legacy-leak baseline (F-018 debt being driven down)

`npm run test:hermetic` currently reports mutations from pre-IMP-12 tests that use the
real default roots instead of injected ones. These are the F-018 non-hermeticity the guard
now makes VISIBLE and CI-checkable; closing them is incremental. The offending surfaces:

- `state/qc-preflight/**`, `state/autopilot-logs/**`, `state/gate-attempts.json`,
  `state/provenance/**`, `state/qc/**` — from `autopilot`, `qc-converge`, `stier-levers`,
  `stier2-levers`, `research-freshness`, and other tests exercising real writers with
  default roots.
- `logs/exec/**` — real spawn manifests from tests that route through the hermetic
  envelope with the default sink.
- `.attempts/**` — real attempt workspaces (e.g. `zz-fixture-stier`).

**To close one:** move the test onto `mkTestRoots()` (`tests/testRoots.ts`) and thread its
`stateRoot`/`attemptsRoot`/`execLogRoot` into the code under test via the existing roots
params / io seams (the IMP-01+ author tests are the model — in-memory io + tmp
`attemptsRoot`). New tests MUST be hermetic; the guard is the ratchet.

## Injected roots

`mkTestRoots(prefix?)` returns one disposable base with a typed slot per root
(`stateRoot`, `attemptsRoot`, `evidenceRoot`, `execLogRoot`, `workspacesRoot`, `homeRoot`,
`bakeoffRoot`, `reviewsRoot`) plus `dispose()`. Bases are pid+sequence-unique, so parallel
processes and repeated rigs never collide even when they reuse book/attempt IDs.

## Fixtures

- `tests/migrationFixtures.ts` — schema-valid generic factories for every migration
  artifact (packet, plan + unit, chapter, attempt identity, candidate record, commit
  manifest, repair finding, chapter patch, route result, evidence manifest) with an
  override hook. `FORBIDDEN_PLAN_UNITS` catalogs each contract-invalid combination.
  Synthetic only — no deleted book prose, no real catalog slug (fixtures own `zz-*` ids;
  `cross-book-fixtures.test.ts` scans that production source never hard-codes one).
- `tests/hostileHome.ts` — `buildHostileHome(homeRoot)` writes a fake `~/.codex`
  (config re-routing model/effort/sandbox, hooks, MCP) + global/project `AGENTS.md` +
  rules + hostile env under an INJECTED home (never `$HOME`). `INJECTION_STRINGS` is the
  prompt-injection catalog for DATA-surface tests — grow it here when a new shape appears.

## How a future incident becomes a fixture

1. Reduce the incident to the SEMANTIC invariant it violated (a forbidden origin/form/
   claim-strength combo, an unexpected write, a stale-base commit, an injection that
   changed control state).
2. Add the synthetic case to the matching factory / catalog (never copy production prose
   or a real book id).
3. Assert the invariant with a hash/id/schema check, not a prose snapshot (snapshots only
   for intentional contract surfaces).
4. If it exposed a new leak, close the offending test onto `mkTestRoots()` and let the
   guard hold the line.

## How contract versions evolve

Contracts are frozen in `src/contracts/` with a hashed manifest (`contract-manifest.json`).
To change one: bump its `version`, regenerate (`npx tsx src/contracts/generateManifest.ts`),
and — because a version change invalidates dependent evidence — update the consuming
packages' lineage. `contract-validate` fails if the manifest and source diverge without a
bump, which is how a parallel agent's incompatible schema fork is caught.
