# P3 — s16-forward-pilot-role-readiness-v1 design record (2026-07-15)

Model-free build of the development-only role-readiness instrument (plan v2 P3;
IMP-24G Phase 5 adopted with the D9 re-scope). Objective `PILOT_ROLE_READINESS`
— practical future-content readiness, never publication certification. Labels:
`readinessScope: "pipeline-internal"`, `ownerApprovedForDevelopmentBakeoff: true`,
`independentHumanRater: false`, `publicationCertification: false`.

## Corpus (all selections deterministic + create-once; zero model calls)

**Reader — 12 holdouts + 2 canaries (per profile):**
- 4 acceptable controls from `reader-acceptable-controls.v1.json`
  (`controlsSha256 f3b3a85e…`), D9 rules: the 3 owner-rubric-audited chapters
  (made-to-stick-ch04, the-happiness-hypothesis-ch06, nudge-ch03) are EXCLUDED
  (reserved as sealed craft ground truth; owner scored them 67.7–70.8 — they
  never anchor "acceptable" again). Deterministic pick: controls in frozen file
  order, skip the excluded 3, take the first 4 with at most 2 per book →
  made-to-stick-ch05, made-to-stick-ch01, the-happiness-hypothesis-ch04,
  the-happiness-hypothesis-ch11. Chapter objects load from the v21 packages
  pinned by the pool selection manifest; expected gold = SHIP + zero blockers
  (v3 policy: composite >= 80, advisories never fail an acceptable control).
- 4 hard-blocker + 4 craft cases from the corrected imp24 v3-envelope corpus
  (`substantiveBundleSha256 sha256:4501809686…`), holdout partition, bundle
  array order: hard blockers = first 4 covering the category set
  (internal_contradiction, unsafe, unusable, then next in order); craft = first
  4 with distinct `expectedWeakness`.
- Canaries (disjoint from holdouts): acceptable = next eligible control after
  the holdout picks (nudge-ch08 — adds the third book); hard blocker = the
  bundle's reader canary (unusable).

**Source — 12 holdouts + 2 canaries:** from the imp24 bundle, §5.3 mix:
2 clean (`supported-source-bound`), 2 `unsupported-invented`,
2 `unframed-constructed`, 2 `generic-historical-specificity`,
2 `causal-overreach`, 2 `unsupported-or-contradicted-attribution` — first N per
family in bundle order. Canaries = the bundle's source canaries (1 clean +
1 unsupported-invented).

**Quiz — 12 holdouts + 2 canaries:** §5.4 mix: 3 `uniquely-correct-clean`,
3 `key-mismatch`, 3 `genuine-ambiguity`, 3 `mechanism-causal-key` — first 3 per
kind in bundle order. Canaries = the bundle's quiz canaries (1 clean +
1 key-mismatch). The old quiz qualification is not carried (IMP-24F semantics
change).

## Thresholds (IMP-24G §5.5 verbatim; per profile; never weakened)

Reader: validity 100% (12/12 zero-miss) · canaries 2/2 · hard-blocker
sensitivity 4/4 (zero-miss) · false reader blockers on acceptable+craft 0
(zero-miss, den 8) · acceptable success >= 3/4 · craft category detected >= 3/4
· required resolved 12/12.
Source: validity 100% · canaries 2/2 · high-severity sensitivity 100% (den 8
defect cases, zero-miss) · false high-severity blocker on clean 0 (den 2,
zero-miss) · support/register accuracy >= 10/12 · resolved 12/12 ·
missing-evidence => INCONCLUSIVE (bound from the model-free certification
probe).
Quiz: validity 100% · canaries 2/2 · wrong-key 3/3 (zero-miss) · clean unique
>= 2/3 · ambiguity >= 2/3 · mechanism >= 2/3 · resolved 12/12.
v3-policy metric semantics (§2.5): acceptable = PASS + 0 blockers + composite
>= 80; craft = required advisory category detected with valid evidence + 0
blockers; hard-blocker = required reader blocker detected with valid evidence.

## Candidate order, stopping, budget (§5.6/§5.7 + D6)

Qualifying orders (frozen; availability may skip, never reorder):
reader `gpt-5.6-sol@high, gpt-5.5@high, gpt-5.6-sol@xhigh, gpt-5.5@xhigh`;
source & quiz `gpt-5.6-sol@xhigh, gpt-5.5@xhigh, gpt-5.6-sol@high, gpt-5.5@high`.
Stop at reader 2 / source 2 / quiz 1 ready. Canary gate 2/2 before any holdout
(a canary failure = zero holdout calls). Budget: base 84 (24 canaries + 24+24+12
stop-set holdouts), hard 168 (one typed infra replay per attempted call; never
for judgment/refusal/content). D6 Terra/Luna profiles
(`gpt-5.6-terra@{medium,high,xhigh}`, `gpt-5.6-luna@{high,xhigh}`) are a
SEPARATE, non-qualifying `COST_CANDIDATE_PROBE` order run only after
`PILOT_ROLE_SET_READY` (reader ≤70 base; ≤2 shortlisted → source/quiz +56).

## Bindings

The plan freezes: corpus sha + per-case `substantiveCaseSha256` lineage,
thresholds bytes, candidate orders, budget, the CURRENT candidate instrument
(contracts/imp24f seal + certification, generation `imp24g-reader-policy-v3-1`),
and policy ids (`reader-decision-policy-v3`, aggregate v2). Terminal states:
`PILOT_ROLE_SET_READY` / `BLOCKED_ROLE_READINESS`. Live execution (P5) reuses
the V3 runner discipline (freeze re-assert per call, fatal latch, one-replay
policy, sequential stop as status); this P3 build is corpus + plan + thresholds
+ metrics definitions only.
