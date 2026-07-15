# Migration experiment confirmatory-dryrun-2026-07 (confirmatory)

- Sealed spec: `07cbb9ba3be9acac` · thresholds `6a90acea1c94f124` · schedule `996d4375c5cf2059`
- Instruments: rubric reader-rubric-v3-phase1, docHash v3, route policy route-policy-v1.0
- Books: start-with-why (14 ch), radical-candor (9 ch)
- Cells: 55-H=gpt-5.5@high/sol-native-current; 55-XH=gpt-5.5@xhigh/sol-native-current; 56S-H=gpt-5.6-sol@high/sol-native-current; 56S-XH=gpt-5.6-sol@xhigh/sol-native-current

> Zero events in 36 independent units gives an approximate one-sided 95% upper bound near 8.3%; roughly 150 zero-event units are needed for about 2%, and 300 for about 1%, before clustering adjustments.

| cell | run/planned | first-write pass | acceptance | p95 latency | safeguard/refusal | replays |
|---|---|---|---|---|---|---|
| 55-H | 24/24 | 100.0% | 100.0% | 1s | 0 | 0 |
| 55-XH | 24/24 | 100.0% | 100.0% | 1s | 0 | 0 |
| 56S-H | 24/24 | 100.0% | 100.0% | 1s | 0 | 0 |
| 56S-XH | 24/24 | 100.0% | 100.0% | 1s | 0 | 0 |

Unavailable fields (never estimated): tokens, costPerAcceptedChapterUsd.

## Threshold verdicts

### 56S-H (gpt-5.6-sol @ high) — inconclusive on T2-severe-factual, T4a-framing-severe, T5a-quiz-severe, T6a-causal-severe, T8-reviewer-reliability
- T1-state-safety State and execution safety: **PASS** (0; rule: zero upheld)
- T2-severe-factual Observed severe factual safety: **INCONCLUSIVE** (unavailable; rule: zero upheld) — observed gate only, not a population claim — evidence not produced yet
- T3-non-inferiority First-write non-inferiority: **PASS** (pooled 100.0% (CI lower 100.0%), baseline 100.0%; rule: ≥75% pooled, point ≥ baseline − 10pp, CI lower above the floor)
- T4a-framing-severe Source framing (upheld high-severity): **INCONCLUSIVE** (unavailable; rule: zero upheld) — observed gate only, not a population claim — evidence not produced yet
- T4b-framing-material Source framing (material rate): **PASS** (0.00% vs baseline 0.00%; rule: ≤ baseline + 2pp) — observed gate only, not a population claim
- T5a-quiz-severe Quiz key/mechanism (upheld high-severity among accepted): **INCONCLUSIVE** (unavailable; rule: zero upheld) — observed gate only, not a population claim — evidence not produced yet
- T5b-quiz-ambiguity Quiz ambiguity (material rate): **PASS** (0.00% vs baseline 0.00%; rule: ≤ baseline + 2pp) — observed gate only, not a population claim
- T6a-causal-severe Causal overreach (upheld high-severity): **INCONCLUSIVE** (unavailable; rule: zero upheld) — observed gate only, not a population claim — evidence not produced yet
- T6b-causal-material Causal (material rate): **PASS** (0.00% vs baseline 0.00%; rule: ≤ baseline + 2pp)
- T7-repetition Repetition (exact prohibited leakage / adjudicated clone): **PASS** (0; rule: zero upheld)
- T8-reviewer-reliability Reviewer reliability: **INCONCLUSIVE** (unavailable; rule: raw ≥ 0.75, chance-corrected ≥ 0.5, material disagreement ≤ 10%, human review complete) — observed gate only, not a population claim
- T9-repair-demand Repair demand: **PASS** (0.00 vs baseline 0.00 sessions/chapter (projection); rule: ≤ baseline + 0.05/chapter (blocking); relative ≤ ×1.2 blocking only when baseline ≥ 0.1 (owner-frozen C4 rule)) — observed gate only, not a population claim — projection, not an observed production rate; relative comparison informational (baseline 0.00 < 0.1 floor) — relative clears ×1.20 and cannot independently fail this configuration
- T10-economics Economics and latency: **PASS** (p95 1s; rule: no frozen bound declared) — owner declared no economic bound; latency reported informationally

### 56S-XH (gpt-5.6-sol @ xhigh) — inconclusive on T2-severe-factual, T4a-framing-severe, T5a-quiz-severe, T6a-causal-severe, T8-reviewer-reliability
- T1-state-safety State and execution safety: **PASS** (0; rule: zero upheld)
- T2-severe-factual Observed severe factual safety: **INCONCLUSIVE** (unavailable; rule: zero upheld) — observed gate only, not a population claim — evidence not produced yet
- T3-non-inferiority First-write non-inferiority: **PASS** (pooled 100.0% (CI lower 100.0%), baseline 100.0%; rule: ≥75% pooled, point ≥ baseline − 10pp, CI lower above the floor)
- T4a-framing-severe Source framing (upheld high-severity): **INCONCLUSIVE** (unavailable; rule: zero upheld) — observed gate only, not a population claim — evidence not produced yet
- T4b-framing-material Source framing (material rate): **PASS** (0.00% vs baseline 0.00%; rule: ≤ baseline + 2pp) — observed gate only, not a population claim
- T5a-quiz-severe Quiz key/mechanism (upheld high-severity among accepted): **INCONCLUSIVE** (unavailable; rule: zero upheld) — observed gate only, not a population claim — evidence not produced yet
- T5b-quiz-ambiguity Quiz ambiguity (material rate): **PASS** (0.00% vs baseline 0.00%; rule: ≤ baseline + 2pp) — observed gate only, not a population claim
- T6a-causal-severe Causal overreach (upheld high-severity): **INCONCLUSIVE** (unavailable; rule: zero upheld) — observed gate only, not a population claim — evidence not produced yet
- T6b-causal-material Causal (material rate): **PASS** (0.00% vs baseline 0.00%; rule: ≤ baseline + 2pp)
- T7-repetition Repetition (exact prohibited leakage / adjudicated clone): **PASS** (0; rule: zero upheld)
- T8-reviewer-reliability Reviewer reliability: **INCONCLUSIVE** (unavailable; rule: raw ≥ 0.75, chance-corrected ≥ 0.5, material disagreement ≤ 10%, human review complete) — observed gate only, not a population claim
- T9-repair-demand Repair demand: **PASS** (0.00 vs baseline 0.00 sessions/chapter (projection); rule: ≤ baseline + 0.05/chapter (blocking); relative ≤ ×1.2 blocking only when baseline ≥ 0.1 (owner-frozen C4 rule)) — observed gate only, not a population claim — projection, not an observed production rate; relative comparison informational (baseline 0.00 < 0.1 floor) — relative clears ×1.20 and cannot independently fail this configuration
- T10-economics Economics and latency: **PASS** (p95 1s; rule: no frozen bound declared) — owner declared no economic bound; latency reported informationally

**SOL BAKEOFF RESULT: INCONCLUSIVE**

Effort recommendation: no SOL profile qualified — no effort recommendation

Activation: NOT AUTHORIZED HERE — activation is IMP-13's separately authorized package.
