# V24 CF-I Roadmap — machinery-leakage campaign

**Companion:** `docs/v24/V24_CF_I_PROMPT_PACK.md` (prompts CF-I-1…CF-I-4)
**Branch:** `feat/anti-sameness-live-fix` · **Base commit:** `260fa13e0` (CF-A..CF-F wave,
committed locally 2026-07-09, NOT pushed) · **Suite baseline:** pass 1921 / fail 0 / xenv 6
**Held artifact:** `multipliers` READY-TO-PUBLISH, publish deliberately deferred until CF-I
repair + owner checkpoint (owner decision 2).

## Sequential steps

1. ~~Commit current campaign~~ — DONE: `260fa13e0` (24 files: src, tests, config, docs;
   generated state/logs excluded; nothing pushed/published/deployed).
2. **CF-I-1** — detector family (C32 meta-case, C33 beat-vocab echo, C34 citation-date
   doorway, C35 lineage-key quiz) + BP34 hook field + leaked-line forensics (report only).
3. **CF-I-2** — de-mint briefRotation instruction strings + card register rule + C31/CF-I
   advisory surfacing into write-retry cards and review-repair directives.
4. **CF-I-3** — quiz application-over-lineage card instruction (runs after CF-I-2; same file).
5. **CF-I-4** — targeted multipliers repair via the canonical lane → re-gate → re-review →
   re-accept → detector probes to zero → STOP.
6. **Owner checkpoint** → publish `multipliers` (canonical publish transaction — note it
   includes a `git push`, per the HOM precedent; the owner must explicitly accept that).
7. **One fresh validation book** after the publish decision (new never-run machine-brief book)
   to confirm prevention works from zero, not just under repair.

## Parallel lanes

```text
Lane A (critics/tests):        CF-I-1  ──────────┐
                                                  ├─→ CF-I-4 (repair) ─→ owner checkpoint ─→ publish? ─→ fresh book
Lane B (card/rotation/repair): CF-I-2 ─→ CF-I-3 ─┘
```

- **CF-I-1 ∥ CF-I-2 is allowed with one guard:** CF-I-1 creates the shared machinery-phrase
  module (data) and does not edit `briefRotation.ts`; CF-I-2 owns `briefRotation.ts` +
  `authorRun.ts`. If run concurrently, CF-I-2 must consume CF-I-1's phrase-module interface as
  specced (coordinate on the module path up front) — otherwise run 1 → 2 sequentially. When in
  doubt, sequential; the campaign is small.
- **CF-I-2 → CF-I-3 is HARD sequential** (both edit `authorRun.ts` card constants + pins).
- **CF-I-4 is HARD after all three** — repairs must happen under the new instructions and be
  measured by the new detectors, or the repair validates nothing.
- Direct-read artifact collection (quoting more leakage examples for fixtures) may run in
  parallel with anything — it is read-only.

## Conflict risks

- **CF-I-2's de-minting vs rotation determinism:** instruction TEXT changes; ids/shapes/deal
  math must not. Rotation tests pin this.
- **CF-I-2 register rule vs CF-B rule 7 / CF-A rule 8:** additive register dimension; the
  prompts forbid rewording landed requirements. Watch the merged card for duplication (the
  orchestrator re-reads the merged constants at verification, same as last campaign).
- **C32 (no machinery protagonists) vs C29/rule-7 (dramatize decisions):** a writer stripped
  of the meta-case crutch on actor-less source cases may fail the lead-thread contract more →
  watch retry rates in CF-I-4 and the fresh book; F-1 degradation is the designed relief valve.
- **C34 vs legitimate dated scenes:** the person-acts exemption is load-bearing; its negative
  fixture is required in CF-I-1.
- **Advisory surfacing vs repair-loop inflation:** fix lines make retry cards longer and more
  directive; bounded budgets (AUTHOR_WRITE_GATE_RETRIES, repair caps) are untouched, so the
  worst case is unchanged loop counts with better-aimed retries.
- **Card budget:** CF-I-2 + CF-I-3 combined ≤ +600 chars against the 18,700 pin (≤19,000 with
  justification).

## Owner checkpoints (required approvals)

| Checkpoint | Trigger |
|---|---|
| **Publish `multipliers`** | After CF-I-4 report: detectors clean, gates green, direct-read clean — AND explicit acceptance that the canonical publish transaction pushes the branch |
| **Mass-edit / banned-phrases additions for the 4 leaked cross-book lines** | After CF-I-1's forensics table (detection/planning only this campaign — owner decision 5) |
| **Any acceptance-gate/policy change** | Not planned; would need explicit approval |
| **CF-G Phase 2** | Deferred until after CF-I validation (owner decision 6) |
| **CF-H option pick** | Deferred until after CF-I validation (owner decision 6) |

## Success criteria (campaign exit)

- C32/C33/C34/C35 pinned low on gold + HOM; ZERO (or justified waivers) on repaired multipliers.
- C31 density on repaired/fresh content below the HOM baseline (1.56 openers/chapter) — the
  fold-in's measurable goal.
- multipliers still 9/9 PASS ≥ prior scores band; acceptance still ACCEPT.
- Direct-read: no machinery narration, no lineage keys, doorways are scenes; no NEW mold
  (examples must not converge on one "human scene" template).
- Suite fail 0 throughout; no gate/contract/severity changes anywhere in the diff.

## Orchestrator contract (this session, when the owner returns)

Verify each CF-I prompt against its spec by diff, not by report; re-run detectors and suites
independently; re-read the merged card; direct-read repaired chapters before endorsing any
publish; hold the publish command until the owner says go; keep standing constraints (no push
outside the canonical publish transaction, no gate changes, no start-with-why, no mass edits).
