# V25 Bakeoff-Corpus Freeze Results — WP-701 Stage-B live execution (Phase 6)

**Executed:** 2026-07-17 (research sessions 08:20–09:45 UTC approx) · **Custody:** orchestrator (direct CLI, no agent)
**Authorization:** owner D-3 + D-7 option (a) (ledger L-37); procedure pre-registered at L-40; entry verb WP-701b (L-42)
**Result:** **CORPUS RESOLVED — ready-for-bakeoff.** All three books researched, aligned, compiled, hash-frozen.

## Per-book execution

| Book | Research | Wall | Alignment gate (pre-registered L-40) | Source gate | Compile chain |
|---|---|---|---|---|---|
| nudge | 1 codex session (sol@high) | 42.8 min | ch3 = "Following the Herd" — EXACT match (15-ch fresh index) | PASS, 0 blockers | 30 packets · design · 30 briefs — ALL gates PASS |
| made-to-stick | 1 codex session (sol@high) | 20.3 min | ch4 = "Credible" — EXACT match (6-ch fresh index, same as shipped) | PASS, 0 blockers | 12 packets · design · 12 briefs — ALL gates PASS |
| the-happiness-hypothesis | 1 codex session (sol@high) | 25.7 min | ch6 = "Love and Attachments" — case-only difference vs sealed "Love and attachments"; ACCEPTED + recorded | PASS, 0 blockers | 22 packets · design · 22 briefs — ALL gates PASS |

- Research via `auto-research` (WP-701b): role `research` → modelPolicy → `gpt-5.6-sol@high`, hermetic
  envelope, structural stop before authoring, `env -u OPENAI_API_KEY` (forbidden-env discipline, L-39).
- Each run: exactly ONE research session — the ≤2-pass retry cap was never needed; zero source-repair
  passes needed (0 blockers on every source-v2 gate).
- Compile chain fully deterministic (verified L-40): **zero model calls** in every post-research step.

## Call accounting

| Item | Sessions |
|---|---|
| Capability probe (L-39) | 8 |
| Corpus freeze research ×3 | 3 |
| **Phase-6 total** | **11 / 150** |

Ledger slices committed: `state/run-ledger/{nudge,made-to-stick,the-happiness-hypothesis}/auto-research-*.jsonl`
(+ summaries/rollups) under the pipeline dir. (The L-22 incident's 1 completed + 1 partial UNAUTHORIZED
calls remain disclosed separately and excluded from the authorized count.)

## Corpus manifest resolution

- Every unit's `authoringSource` → its frozen chapter brief (passes the hardened resolution allowlist).
- NEW per-unit `frozenInputs`: 6 hash-bound shared inputs each (index, source-v2 sidecar, source packet,
  brief json+md, book design) — the fixtures test re-hashes all 18 entries on every run.
- NEW per-unit `researchRunId` + top-level `freeze` provenance block (method, sessions, ledger paths,
  alignment-gate record).
- `bakeoffReadiness` = `ready-for-bakeoff` (independently re-derived by the verification test; single
  UNRESOLVED/placeholder unit still vetoes).
- Manifest re-emitted via the pipeline's own `canonicalPretty` — byte-stability test intact.

## Test updates committed with this freeze (state-dependent assertions)

- `tests/bakeoff-corpus-fixtures.test.ts`: UNRESOLVED-state assertions → resolved-state assertions
  (exact pointers, on-disk existence, allowlist pass, frozenInputs re-hash, ready-verdict re-derivation,
  UNRESOLVED-veto retained on in-memory copies).
- `tests/bakeoff-screening-plan.test.ts` (f): the REAL manifest now proves the intake PROCEED path
  (real `collectSharedInputPaths` over the committed state); the refusal path moved to a not-ready fixture.

## Consequence

WP-703 Stage-1 screening is now fully unblocked: registered plan (L-43) + probe-passed configs (L-39) +
ready corpus (this freeze) + D7 primary judge (L-41) + corpus intake + D7 dispatch seam (L-43). The next
live step is screening execution per `V25_BAKEOFF_STAGE1_SCREENING.md`.
