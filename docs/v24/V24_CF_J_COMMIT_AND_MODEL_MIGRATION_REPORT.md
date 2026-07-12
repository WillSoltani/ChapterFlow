# V24 CF-J Commit + GPT-5.6 SOL Model-Migration Report

> **ROLLBACK NOTE (2026-07-10, appended):** the SOL migration and the `range` campaign this
> report describes were subsequently ABANDONED and rolled back — the branch was reset to the
> GPT-5.5 baseline `acdc51c13` (commits `a3e8f1522` and `d12ace91c` removed from the active
> branch; preserved on a local backup branch) and all `range` artifacts were deleted. This
> report is retained as evidence by owner instruction. Commit hashes below refer to the
> pre-rollback history.

**Date:** 2026-07-10 · **Conductor:** release engineer / model-routing owner (scene-origin campaign,
phases 1–5) · **Branch:** `feat/anti-sameness-live-fix` · **Companion:**
`V24_FRESH_SCENE_ORIGIN_GOLD_RUN_REPORT.md` (phases 6–16, written at run completion).

## 1. CF-J commit hash

`d894a91d9` — `feat(v24): CF-J — harden v24 against source-apparatus and spec-narration leakage`
(plus a follow-up housekeeping commit `acdc51c13` tracking two orphaned R4/R5 test pins whose src
had already landed in the CF-I wave). Neither pushed; branch is ahead of origin by local commits only.

## 2. Files committed (23 in the CF-J commit)

- **New:** `src/critics/apparatusLeakage.ts` (C36, 4 sub-ids incl. quiz/card surfaces),
  `tests/apparatus-leakage.test.ts` (19 tests).
- **Modified src (10):** `compiler/sourcePacketProjection.ts` (citation-span de-mint on ALL projected
  text), `critics/sourceGrounding.ts` (SC11.2 citation-shaped specifics satisfied-by-construction,
  strictly tolerant), `compiler/chapterBrief.ts` (thesis/coreMove de-mint), `critics/bookRepetition.ts`
  (BP34 tail-clone), `critics/exampleRegister.ts` (C31 cap 6→8), `critics/registerAdvisories.ts`
  (C36 routing), `critics/bookGate.ts` + `critics/finalGate.ts` (advisory registration),
  `orchestrator/authorRun.ts` (SCAFFOLD page-cite line, pins), `types.ts` (ids).
- **Modified tests (6):** aphorism-repetition, author-arch, example-register, packet-projection,
  register-advisory-surfacing, source-anchored-planning.
- **Durable docs (5):** the CF-I release-verification, autonomy and targeted gold-run reports, the
  radical-candor release-readiness review and the CF-J repair report.

Verification before commit: full canonical suite **pass 2046 / fail 0 / xenv 6**, typecheck clean;
recovery patch of the whole working tree saved to the session scratchpad (`cf-j-checkpoint/`).

## 3. Files intentionally excluded

- `src/cli.ts` — its only 2 hunks are the parallel bakeoff session's (`model-bakeoff` help + dispatch);
  left uncommitted with `src/bakeoff/` + `tests/model-bakeoff-*` for that work's owner.
- Generated `radical-candor` chapter state, `radical-candor-cf-j.bak/` checkpoint, acceptance
  artifacts, run logs, scratch files — repo convention tracks book state at PUBLISH time (via the
  publish transaction), and radical-candor is held unpublished (Class B).
- Pre-existing untracked debris (`.chapterflow/`, `archive/`, older handoff docs) — not this campaign's.

## 4. Model-routing audit (every GPT-5.5 / xhigh reference, classified)

| ref | class | action |
|---|---|---|
| `orchestrator/authorRun.ts:400-402` `AUTHOR_WRITER_MODEL/"gpt-5.5"`, `EFFORT/"xhigh"` | **1 active production routing** (writers, regen; imported by authorRepair) | migrated |
| all model-unset `spawnCodexAgent` call sites (reviewers, readers, scouts, evidence, research) | **1 active** — inherited the operator's ambient `~/.codex/config.toml` | now resolve at the spawn choke point (no ambient inheritance) |
| `orchestrator/autopilot.ts` research spawn `reasoningEffort:"high"` | 1 active | raised to SENSITIVE (xhigh) |
| `providers/openai-api.ts` gpt-5.5 pricing/default | **4 compatibility fallback** — billed-API path, inactive under no-API codex mode, gated by explicit `CHAPTERFLOW_PROVIDER` env and REFUSED by the router in no-API mode | unchanged, documented |
| `providers/router.ts:21`, `providers/types.ts:6` comments | 3 historical documentation | unchanged |
| `tests/stier2-levers.test.ts` M-lane pin | 2 test fixture pinning CURRENT routing | re-pointed to gpt-5.6-sol @ high |
| `src/bakeoff/**` (incl. judge default gpt-5.5), `tests/model-bakeoff-*` | separate experiment lane, uncommitted, pins models per-candidate explicitly | out of scope by design |
| committed docs/v24 reports, memory files mentioning gpt-5.5 @ xhigh | 3 historical evidence | preserved verbatim |

No stale/dead-code or generated-artifact classes carried active routing.

## 5. Active GPT-5.5 references removed

Both active routes: the author write/regen/repair pin (authorRun) and the implicit ambient-config
inheritance (every model-unset spawn). A static test now scans all active src dirs and fails on any
quoted `gpt-5.5` literal (`tests/model-routing.test.ts`).

## 6. Intentional historical references preserved

Committed campaign reports, provider-layer doc comments, the billed-API compatibility defaults, the
bakeoff lane, and memory files — the old value is part of the evidence there.

## 7. GPT-5.6 SOL identifier used

`gpt-5.6-sol` — the exact codex model id, taken from the repository's own bakeoff lane
(`src/bakeoff/types.ts`: *"Exact codex model id (e.g. \"gpt-5.6-sol\") — passed as `-c model=<id>`"*)
and **live-verified** before any routing change:
`codex exec -c model=gpt-5.6-sol -c model_reasoning_effort=high` → responded correctly
(codex-cli 0.144.1). Reasoning levels: the codex-supported set `minimal|low|medium|high|xhigh` via
`-c model_reasoning_effort=<level>`. No identifier was invented; no silent fallback exists — an
unsupported model/effort now throws before the subprocess is spawned.

## 8. Default (standard) routing behavior

`src/orchestrator/modelPolicy.ts` = single routing authority. `PIPELINE_MODEL = gpt-5.6-sol`
(env-overridable via `CHAPTERFLOW_PIPELINE_MODEL`, validated at module load), `STANDARD_EFFORT = high`.
`spawnCodexAgent` is the choke point: a spawn with no explicit operator resolves to
gpt-5.6-sol @ high — never the ambient personal config — and the RESOLVED model+effort are recorded
on every session result (they flow into the per-session logs). Standard lanes: chapter authoring,
ordinary review/readers, routine repair, regeneration, orchestration scouts, monitoring. Explicit
cheaper efforts at mechanical evidence lanes (key derivation `low`, sweep `medium`, compiler
`medium`) are deliberate cost decisions and were preserved, not force-raised.

## 9. Sensitive (xhigh) routing behavior

`SENSITIVE_EFFORT = xhigh`, applied at:
- **Research synthesis** (`autopilot.ts` doResearch) — every downstream factual claim inherits this
  session's fidelity;
- **Source-fidelity repair** (`authorRepair.ts`) — per-repair classification: quiz scope always, plus
  complaints matching the factual class (fact/fabricated/source/citation/quote/date/institution/
  attribution/key/contradicts); register/texture/format repairs stay standard. The repair log line
  names the resolved effort and why;
- **Operational xhigh** (conductor-side, not code): root-cause analysis of unexplained halts,
  red-team verification, release-artifact verification, and the scene-origin diagnosis in this
  campaign are run by the conductor's own agents at maximum effort.

## 10. Tests run and results

- 9 new pins in `tests/model-routing.test.ts`: policy defaults; author-writer inheritance; loud
  failure on unsupported model/effort (both direct and through the spawn path); spawn choke-point
  argv carries `-c model=gpt-5.6-sol -c model_reasoning_effort=high` when the caller passes none;
  explicit cheaper effort preserved; sensitive-repair classification (positive + negative cases);
  static no-active-gpt-5.5 scan; research-spawn SENSITIVE pin.
- `tests/stier2-levers.test.ts` M-lane pin updated (argv ordering + legacy shape still byte-pinned).
- Full canonical suite: **pass 2055 / fail 0 / xfail 0 / xpass 0 / xenv 6 / skip 12**; typecheck clean.
- Committed as `a3e8f1522` — `feat(v24): migrate operator routing to GPT-5.6 SOL`.

## 11. Routing red-team findings (pre-run)

- **Ambient-config hole closed:** before this migration, most spawns inherited `~/.codex/config.toml`
  (which a parallel session had already flipped to gpt-5.6-sol @ xhigh) — pipeline behavior changed
  when a personal config did. The choke point removes the hole; nothing silently depends on it now.
- **Unsafe cast removed:** `AUTHOR_WRITER_EFFORT` used to cast any env string into the effort union;
  a typo (`xhig`) would have been passed through to codex. It now throws at module load.
- **No hidden GPT-5.5 route found:** static scan across all active dirs is clean; the billed-API
  compatibility default cannot be reached in no-API mode (router refuses billed providers).
- **Deliberate non-migrations named:** bakeoff judge default (other session's lane), providers/
  defaults (inactive), historical docs. None is an active route.
- Output-quality effects of high-vs-xhigh standard authoring are a run-time question — assessed in
  the companion scene-origin report (phase 14).

## 12. Push/deploy confirmation

Nothing pushed (origin remains at `3c84ae1ee`; local commits `d894a91d9`, `acdc51c13`, `a3e8f1522`
ahead), nothing published, no S3 upload, no deploy, no gate or acceptance-policy change,
`multipliers`/`the-culture-code`/`start-with-why`/`radical-candor` untouched.
