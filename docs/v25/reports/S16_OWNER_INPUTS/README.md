# §16 Owner-Input Package (C1–C5)

**Context:** §15 emitted `BAKEOFF AUTHORIZED: YES` (commit `f14873bfa`; G3 fixed in `27aeddc16`, addendum `48b5bf7f7`). §16 is authorized in principle but **must not execute** until the five owner inputs below are supplied, validated, frozen, and hashed into the sealed protocol. The harness ENFORCES each absence (dryRunOnly refusal, INCONCLUSIVE decisions, seal halts) — nothing here can be synthetically satisfied or silently defaulted.

**Validator (one command per file, from the pipeline dir):**
```
cd scripts/book/prompts/chapterflow-v24-author-pipeline
npx tsx ../../../../docs/v25/reports/S16_OWNER_INPUTS/tools/validate-owner-inputs.mts <c1|c3|c4|spec> <file.json>
```

## The five inputs

| Input | File here | Owner must | Required for | If absent |
|---|---|---|---|---|
| **C1** Stage-Q corpus | `C1_STAGE_Q_LABELING_PACKET.md` + `.seed.json` (9 ready-to-label synthetic cases, all 8 classes) | **LABEL** every item (human), extend (recommended ≥3/class + ≥4 controls), set `labelProvenance:"human"`, provide path | score → unblind → decide | qualification is `dryRunOnly` ⇒ live review REFUSES ⇒ no decision |
| **C2** legacy-v24 snapshot | `C2_LEGACY_V24_SNAPSHOT_MANIFEST.json` | **APPROVE** source commit `b8815ca02` + book list, have the render executed, hashes filled | DIAGNOSTIC seal only | no diagnostic can seal; confirmatory unaffected |
| **C3** human adjudication | `C3_HUMAN_ADJUDICATION_TEMPLATE.json` | **COMPLETE** after the review phase (upheld high-severity counts per cell; human judgment only), place in experiment root | decide | T2/T4a/T5a/T6a/T7 evaluate INCONCLUSIVE ⇒ no profile can QUALIFY |
| **C4** frozen thresholds | `C4_PROPOSED_FROZEN_THRESHOLDS.json` (proposal with per-group rationale/direction/denominator/unit/blocking/sensitivity) | **APPROVE or tighten**, merge C5 decision, **FREEZE** at `state/migration-experiments/_owner-inputs/thresholds.owner-frozen.v1.json` | seal + decide | experiment cannot seal |
| **C5** economics bounds | `C5_PROPOSED_ECONOMICS_BOUNDS.json` (Option A recommended: real p95-latency bound; cost honest-unavailable) | **DECIDE** A/B/custom, merge into C4 `economics{}` | decide (T10) | T10 passes as "no bound declared" — the flagged asymmetry stands |

## Draft sealed-protocol manifests

- `C0_DRAFT_CONFIRMATORY_SPEC.json` — the four-way final-stack experiment (cells 55-H/55-XH/56S-H/56S-XH, one stack, ≥2 books, all four strata, screening→prespecified expansion, ≤1 infra replay never content/safeguard). Unresolved owner fields are marked `OWNER-DECISION` and enumerated in `_unresolvedOwnerFields`; the `spec` validator prints exactly what is missing.
- `C0_DRAFT_DIAGNOSTIC_SPEC.json` — the 6-cell legacy-vs-SOL-native prompt-stack factorial (runs first, own experiment ID, never production qualification; needs C2).

## Execution sequence once inputs are approved

1. Owner returns: labeled C1 → frozen C4 (with C5 merged) → completed C0 drafts (books, seed, panel) → executed C2 (diagnostic only). C3 comes later, after the review phase.
2. Validate every file with the commands above; `migration-bakeoff plan --experiment <spec>` (validates + prints the schedule, zero writes).
3. `migration-bakeoff seal` — copies + hashes spec/thresholds/corpus/stacks/inputs into the experiment root (the sealed protocol).
4. §16 preflight (plan @3516): identity/hash verification + the no-model dry run proving no repair/retry/canonical-write/key-leak/promotion/identity-leak.
5. Preflight passes ⇒ execute the frozen protocol exactly (per the standing authorization). Unplanned protocol changes and IMP-13 activation remain unauthorized.

## Standing safety invariants (unchanged by this package)

IMP-13 dormant; GPT-5.5 production baseline untouched (`NORMAL_PROFILE="baseline-55"`); no publish/promote/deploy/upload/production routing from the harness (3-layer structural no-promotion guard); no gate/threshold weakening; no book-specific exceptions; no unbounded retries; synthetic evidence can never satisfy a human-evidence requirement (enforced, not procedural).
