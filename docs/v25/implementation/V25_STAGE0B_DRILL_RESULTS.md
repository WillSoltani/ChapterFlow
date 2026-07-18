# Stage 0b — Live Calibration Drill Results (2026-07-17/18)

**Authorization:** owner Q&A 2026-07-17 (D-3 amendment: codex-only ceiling 170; Stage 0b ≤24 sessions).
**Spend:** 14 true codex sessions (2 probes + 4 E-audits × 3 roles). Remaining under ceiling: **132**.
**Protocol:** `V25_CHAPTER_EXPERIMENT_PROTOCOL.md` §4. Evidence: `state/model-bakeoffs/chapterdiag-s0b1-*/chapter-diagnostics/stage0b-s0b1-*/` + `_campaign/stage0b/drill-summary-s0b1.json` + probe sidecars under `_campaign/ultra-acceptance/` (untracked per evidence-retention rule; every attempt preserved).

## Results (all confidence HIGH, terminal `judged`, rater uniformly `gpt-5.6-sol` @ ultra)

| Cell | Anchor | Chapter diagnostic |
|---|---|---|
| ah:w1 | difficult-conversations ch6 (book 90.1, `prior`) | 70.85526315789474 |
| ah:w2 | same, independent repeat | 70.32894736842105 |
| am:w1 | multipliers ch5 (book 72.3, `prior`) | 69.76973684210527 |
| am:w2 | same, independent repeat | 69.34210526315789 |

All values are **CHAPTER DIAGNOSTICS — NOT BOOK SCORES**.

## Gates

| Gate | Result |
|---|---|
| Ultra-acceptance probe | **PASSED live** (both invocations): codex accepted `-c model_reasoning_effort=ultra` with `--output-schema`, exit 0 — the Sol-ultra route is runtime-proven |
| First-attempt validity (≥6/8 rater sessions) | **8/8 PASS** (12/12 including adjudicators — zero retries in the whole drill) |
| Rater-model uniformity | **PASS** — every session resolved `gpt-5.6-sol` |
| Test-retest noise | mean SD per anchor 0.372 / 0.302; pooled SD **0.339**; 2×SD **0.678** → **noise STOP clear** by a wide margin; **W frozen = 2.0** (clamp floor — the instrument is far more stable than the band's minimum) |
| **Sanity stop (`mean(A_high)` ∈ [75, 95])** | **FIRES: mean(A_high) = 70.59 < 75** — pre-registered owner huddle before any candidate spend |

## What the sanity stop means (finding, not failure)

1. **The instrument itself passed every instrument gate** — reproducibility ±0.34 SD, zero invalid attempts, proven route, uniform rater. The retired Claude-D7 instrument voided ~38% of its live sessions; this one voided none.
2. **Book-score anchoring does not transfer to the chapter construct.** The 90.1-book's chapter and the 72.3-book's chapter score the SAME (70.59 vs 69.56 — separation 1.04, inside W=2.0). A published chapter read standalone loses its cross-chapter context (the construct shift the plan pre-disclosed), and the portfolio book score carries no usable location information at chapter scale.
3. **Anchor-derived floors are therefore invalid** (`mean(A_high) − 8` would set an advance floor of 62.6 — meaningless). The pre-registered response is exactly this stop: floors must be re-derived, not patched mid-flight.
4. Context: the candidate-era records on this same construct (PM-4..6) scored 75.2–85.3 — fresh single-chapter drafts spread well above published-book chapters. The instrument separates where it matters; the anchors were simply the wrong location reference.
5. **What the anchors still deliver:** the noise measurement (W = 2.0, their primary purpose) and four ultra-stable drift sentinels (SD ~0.3) for stage-boundary drift checks.

## Owner decision required (floor re-derivation) — options prepared

(a) **Absolute-band floors:** advance floor 75 (rubric "valuable/uneven" boundary; matches the registered legacy screening floor and splits the observed candidate range 75.2–85.3), block floor 65; anchors kept as drift sentinels only. No further calibration spend.
(b) **Re-anchor high-band with 3 live sessions:** E-audit one sealed 2026-07-15 reference chapter (owner-adjudicated ~90 on the D7 scale) and key floors to it — risks the same construct shift.
(c) **Owner hand-adjudication of the 2 anchor chapters** on the chapter construct (the originally-offered truth check) — resolves whether ~70 is instrument compression or true standalone-chapter quality, then floors follow.
(d) **Halt Stage 1** pending a floor redesign.

## D7-lite drill result (run 2026-07-18, 3 sessions, probe reused)

| Unit | Sol-ultra single-rater derived | Owner adjudication | \|Δ\| | Pass (±3.0) |
|---|---|---|---|---|
| made-to-stick-ch04 | 91.25 | 67.664 | 23.59 | **MISS** |
| the-happiness-hypothesis-ch06 | 76.842 | 68.816 | 8.03 | **MISS** |
| nudge-ch03 | 78.026 | 70.757 | 7.27 | **MISS** |

**Verdict: 0/3 — P3 fires, decision-rule 7 is DROPPED; D7-lite is descriptive-only for the entire campaign** (pre-registered fail-closed outcome, protocol §10.1-P3). The single-rater Sol-ultra instrument systematically inflates +7 to +24 points against owner adjudications and is not calibratable as-is. Contrast: the dual-blind + adjudicated E-audit scored the same-class units 69.3–70.9 — within ~2 points of the owner's 67.7–70.8 adjudications. **The receipt-chained dual-blind protocol is what keeps the instrument honest; the canonical evaluator carries the model decision alone, with the owner blind Stage-2 read as the human check.** Standing high-band caveat: no ~85-92 owner adjudication exists anywhere, so even a re-drilled D7 could only ever be mid-band-calibrated.

**Budget consequence (recommended, owner-revivable):** with rule 7 dead, the 12 Stage-1 + 10 Stage-2 D7-lite sessions buy only descriptive data from an uncalibrated instrument — **skip them**. Stage 1 becomes 18 authoring + 54 E-audit = **72 sessions**; spend to date 41 (24 pre + 14 E-drill + 3 D7-drill) → 129 remaining → Stage 1 + Stage 2 (32) fit with ~25 margin.
