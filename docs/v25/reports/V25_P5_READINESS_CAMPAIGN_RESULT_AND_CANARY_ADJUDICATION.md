# P5 readiness campaign result + canary-gold adjudication packet (2026-07-15)

`s16-forward-pilot-role-readiness-v1` live campaign — terminal state
**BLOCKED_ROLE_READINESS** (reader 0/2, source 0/2, quiz 0/1 ready).

## Spend ledger (D5 authorization: 84 base / 168 hard)

| | |
|---|---|
| Base calls attempted | **36** of 84 |
| Total attempts | 36 of 168 (0 infrastructure replays) |
| Provider-capacity events | 0 |
| ChatGPT-authenticated codex exec invocations | 36 |
| API calls | **0** |
| Remaining base authorization | 48 |

Implementation head `850fffaf1` (dedicated V25 workflow push run 29436634192,
all CI green); plan `4cb1b1e0…` bind-once against seal `dc925510…` /
cert `4db9d296…`; corpus `e4a3590b…`. Full retained evidence (attempt dirs,
receipts, sidecars, ledger): evidence branch under
`state/migration-experiments/pilot-role-readiness-v1/`. No threshold, label,
order, budget, or retry policy was changed at any point; the campaign never
exceeded any ceiling.

## Diagnosis: three canary gold fields are model-consensus-contradicted

Eleven of twelve profile-roles exited at the canary gate with **exactly 1 of 2
canaries semantically correct** — every profile failed the SAME canary per
role, on the SAME single gold field, with the SAME model answer. The archived
IMP-24 campaign (338-call run, different day, both model families) shows the
**identical divergences on the identical cases**:

| Lane | Canary case | Gold field in dispute | Gold says | Models say (this run) | Archived IMP-24 |
|---|---|---|---|---|---|
| reader | `READER-V3-CANARY-reader-visible-hard-blocker-make-it-stick-ch02` | `expectedBlockingCategory` | `unusable` | `internal_contradiction` ×3 (sol@high, 5.5@high, sol@xhigh); **5.5@xhigh emitted BOTH labels and passed** | sol@high: `internal_contradiction` (sem=False) |
| source | `SOURCE-V3-CANARY-source-bound-detail-ch01-fact-1-defect` (unsupported-invented) | `supportStatus` / `visibleRegister` | `UNSUPPORTED` / (defect register) | `PARTIALLY_SUPPORTED` + `clearly_sourced` — **unanimous ×4** | sol@xhigh: same divergence (sem=False) |
| quiz | `QUIZ-V3-CANARY-key-mismatch-decisive-ch02-q01` | `keyedMechanismSupported` | `true` | `false` — **unanimous ×4** | sol@xhigh: `false` (sem=False) |

On every one of these attempts the **verdict was correct** (`BLOCK` detected,
protocol valid, evidence resolved): only the one secondary label diverged.
Unanimity across two model families, four effort tiers, and two independent
campaigns is the signature of a gold-label defect (or an underdetermined field
definition), not of model failure.

Why this never surfaced before: **the IMP-24 canary gate was protocol-only** —
its archived result shows `quiz gpt-5.6-sol@xhigh QUALIFIED` with
`canarySemanticCorrectCount=1`. The owner-ratified §5.5 readiness thresholds
added `canarySemanticCorrectness 2/2 (zero-miss)`, which is the correct
discipline — and it immediately exposed that these three labels never had
model-consensus validity. The gate did its job.

### The quiz field may be a definition problem, not a label problem

For a key-mismatch item (original correct index 1, mutated key 2), gold
`keyedMechanismSupported: true` reads as "the mechanism text still truthfully
describes the ORIGINAL mechanism"; every model reads the field as "the KEYED
(wrong) answer's mechanism is supported" → `false`. If the strict reading is
intended, the fix is a semantic-rules clarification in the quiz instructions,
not a label flip.

## What the run validated

- **D1 / reader-decision-policy-v3 works.** The acceptable-control canary
  (nudge-ch08, adjudicated composite 87.55) passed for ALL FOUR reader
  profiles — under the old v2 policy the archived clean canary failed with
  `REVISE; blockers=none` for every profile (the defect that made ACTIVE mode
  unrunnable).
- **The instrument is otherwise sound.** The one profile that cleared its
  canary gate (reader `gpt-5.5@xhigh`) posted: acceptable controls **4/4**,
  hard-blocker sensitivity **4/4**, false reader blockers **0/8**, protocol
  **12/12**, resolved **12/12** — failing only `craftCategoryDetected` **2/4**
  (bar 3/4). It was one craft case from qualifying.
- Zero protocol failures, refusals, replays, or capacity events across all 36
  calls; the executor, evidence retention, and ledger behaved exactly as
  certified.

### Craft-detection misses (secondary finding)

Both misses are advisory-CATEGORY mismatches under the frozen mechanization
map (weak_transition→{pacing, other_craft}; thin_explanation→{thin_example,
other_craft}; tone→{tone}; pacing→{pacing}):

- `behave-ch01` (weakness `weak_transition`): model flagged
  tone/repetition/thin_example — no accepted category.
- `difficult-conversations-ch02` (weakness `pacing`): model flagged
  repetition/quiz_cue/density — arguably adjacent (`density`), not accepted.

Whether the map is too strict is a legitimate instrument question — but
widening it for THIS run's outputs would be output-informed re-scoring, which
is prohibited. It can only apply to a fresh identity, prospectively.

## Owner decision required (no action taken without it)

Relabeling gold, changing the canary gate, and re-running are all
owner-gated. Options:

- **A (recommended): adjudicate the three disputed canary fields** (the
  14-case Layer-N adjudication is precedent). Any corrected label → new
  corpus identity → fresh plan identity → fresh campaign. Budget arithmetic:
  48 base calls remain of the 84 authorization; a fresh full campaign's happy
  path costs 70 (ceiling 84), so a corrected re-run needs a fresh-budget
  decision — either extend the authorization or explicitly accept partial
  coverage under the remainder.
- **B (bundled with A): rule on the craft weakness→category acceptance map**
  (accept adjacent categories such as density-for-pacing, or keep strict) and
  on the quiz `keyedMechanismSupported` definition (label flip vs
  instruction clarification) — both prospective-only.
- **C: stand pat** — BLOCKED stands; P6 pilot stays blocked on readiness.

Recommendation: **A+B in one packet.** The cross-campaign unanimity evidence
is as strong as instrument-defect evidence gets, the D3 precedent (owner
audit → instrument correction) applies, and the rest of the instrument
demonstrably works — one adjudication pass converts a 3-label defect into a
runnable campaign.
