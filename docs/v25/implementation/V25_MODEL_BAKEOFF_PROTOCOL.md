# V25 Model Bakeoff Protocol — GPT-5.6 Sol / Terra / Luna

**Status:** part of the S-tier master plan (§10); binding once the plan is approved and D-3/D-7 are answered. All live calls ledgered; hard ceiling 150 codex sessions; no GPT-5.5 anywhere; no model is sole judge of its own output.

## Protocol

**Status:** draft for execution (Phase 6). **Owner-decided architecture — this document realizes it, it does not redesign it.**
**Authoritative source line:** `feat/v25-pipeline-live` @ dispatch SHA. **Pipeline (PIPE):** `scripts/book/prompts/chapterflow-v24-author-pipeline`.
**Governing WPs:** WP-701 (corpus), WP-702 (harness re-point), WP-703 (Stage 1), WP-704 (Stage 2/3 + owner packet), WP-705 (decision), WP-502 (capability probe), WP-503 (ledger), WP-504 (fallback).

## 1. Purpose and non-goals

Select ONE production writer configuration from the three approved 5.6 candidates using controlled, blinded, evidence-driven staging, and prove the selected config can clear the D7 gold bar at chapter and book scale. GPT-5.5 is REMOVED as writer, reviewer, repair, fallback, benchmark, and architectural assumption (directive 1); historical 5.5 results are evidence only. No unbounded loops anywhere (directive 4).

## 2. Fixed inputs (frozen before any live call — WP-701)

- **Candidates:** `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` (PIPE/src/bakeoff/runBakeoff.ts:72 DEFAULT_BAKEOFF_MODELS).
- **Fixed corpus (the SAME 3 chapters for every model and stage):** nudge ch3 "Following the Herd", made-to-stick ch4 "Credible", the-happiness-hypothesis ch6 "Love and attachments" — bound in `docs/v25/bakeoff-corpus-v1/corpus-manifest.json`.
- **Sealed D7 baselines (band-reachability floor):** 70.7565789474 / 67.6644736842 / 68.8157894737 (docs/v25/rubric-audit-2026-07-15/{REPORT.md, raw/adjudicated/*.json, CALIBRATION.md}; source hashes 5561431c… / 9a20a3af… / 98fb3e50…). All three sit in the bottom two rubric bands — the reachability jump to ≥85 is steep and real.
- **Authoring inputs:** each of the three books runs a one-time draft-intake → research → compile chain whose shared inputs are frozen and hashed (`freeze.combinedSha256`, runBakeoff.ts:377); the SAME frozen inputs feed every candidate for that chapter. (Owner decision: supply the draft-source per WP-701.)
- **Immutability:** the corpus packet, the sealed baselines, and each stage's frozen inputs are immutable once sealed; a re-run with the same run id resumes, it does not re-mix (runBakeoff.ts:285-289).

## 3. Capability probe gate (WP-502) — runs BEFORE any authoring

Preflight (runBakeoff.ts:397-416) probes every candidate model AND verifies `--output-schema` acceptance and the effort-flag set on the codex route; any failure HALTS before generation (no silent substitution). The probe additionally confirms terra/luna existence empirically (V25-10: today they are one default-array line + fixtures with zero empirical evidence) and records pricing/latency where observable. A candidate that fails the probe is dropped and recorded, never replaced.

## 4. Blinding procedure (preserved from the existing harness — WP-702 keeps it)

- Candidates are randomly mapped to opaque labels A/B/C once per run and the map persists in the manifest (review.ts:96-108 `assignBlindLabels`, seeded rng).
- Every reviewer-/evaluator-visible artifact (doc path, bytes, task text, D7 audit inputs) is checked against a forbidden-token list — model ids, slugs, slots, family suffixes (`sol`), and price/tier words — BEFORE any dispatch; a leak is a fail-closed error (review.ts:63-91 `forbiddenReviewTokens`/`assertNoIdentityLeak`).
- The owner packet's anonymized copies pass the same leak check so the owner blind read (tie-break 7) is genuinely blind.

## 5. Evaluator set

| Evaluator | Role | Blocking? | Source |
|---|---|---|---|
| **D7 rubric-audit instrument (Claude-side)** | **PRIMARY quality metric** — APP-faithful (keys+explanations) chapter diagnostic; blind pair + adjudicator; ±3.0 calibration-void guard | Decides among floor-survivors | rubricAuditInstrument.ts (RUBRIC_AUDIT_BAR_D7), rubricAuditHarness.ts, auditPackageAssembler.ts |
| **Deterministic floor** | Hard eligibility GATE — book gate, ship gate, reader budgets, quiz-key soundness | Hard veto (disqualifies) | candidates.ts validate phase; selection.ts:44-66 |
| **Cross-model advisory** | Non-blocking signal — a DIFFERENT 5.6 model than the writer, source-EQUIPPED source lane | No (recorded only) | WP-403 rescoped split-lane contracts |
| **Owner blind read** | Human tie-break (7) + pilot sign-off | Only inside the tie band / release gate | WP-704 packet; WP-802/803 |

No gpt-5.5 evaluator anywhere (directive 1); the former codex whole-book panel default (gpt-5.5 @ high, review.ts:18) is removed by WP-702.

## 6. Stage tables (call caps, advancement/stop — pre-registered BEFORE running)

Bars are fixed before the first live call. D7 units are chapter-diagnostic scores (V25-13: never a 140-eval headline). Release bar = D7 mean ≥ 85, per-chapter min ≥ 80, core domains ≥ 3.0, required gates pass, layer-independence pass. Screening bar = D7 mean ≥ 75 (below release, defined here).

| Stage | Design | Authoring cap | Repair cap | Advancement bar | Stop / escalation |
|---|---|---|---|---|---|
| **1 — Screening (WP-703)** | 4 configs (sol@xhigh, sol@high, terra@xhigh, luna@xhigh) × 3 chapters × 1 sample | ≤18 runs | ≤40 sessions | 0 hard-gate failures AND D7 mean ≥ 75 → advance ≤3 (highest means) | NO config ≥ 75 → **STOP**, owner escalation (architecture/format question; audit change-condition C→D). No bar lowering. |
| **2 — Confirmation (WP-704)** | top ≤3 configs × 3 chapters × fresh samples | ≤20 runs | (within cap) | reproduce ≥ 75 on fresh samples; rank by D7 mean | a config that regresses below 75 on fresh samples is dropped |
| **3 — Variance (WP-704)** | ≤2 closest configs × 3 chapters × 2 samples | ≤25 runs | (within cap) | clustered CI (stats.ts `clusterBootstrapCI`/`pairedDeltaCI`) separates or confirms a tie | CI so wide no config clears release bar → owner escalation |

Cross-stage cumulative ledger is checked against the **TOTAL HARD CEILING = 150 codex authoring/review sessions** (plus the Claude-side D7 audits, all ledgered). A would-be overshoot halts before the offending session. Owner authorization of this envelope is a precondition of Stage 1.

## 7. Variance handling

Reuse the migration cluster-stats machinery (PIPE/src/bakeoff/migration/stats.ts; tests/migration-stats.test.ts): block by (bookId, chapterNumber); pooled mean via `pooledMean`; clustered bootstrap CI via `clusterBootstrapCI`; paired block deltas + `pairedDeltaCI` for head-to-head; `ruleOfThreeUpperBoundPct` for zero-event failure bounds; `assessPrecision` and `evaluateStopping` for interim stopping. Never pool naively across blocks; report CIs, not point estimates alone.

## 8. Tie-breaks (pre-registered ladder — WP-705)

Applied in order; each step decides or narrows:
1. **D7 composite mean** outside the ±2.0 noise band (the D7 selection band; distinct from the instrument's ±3.0 calibration tolerance and the codex panel's legacy 3.7).
2. **Worst-chapter min** D7.
3. **Cross-sample variance** (tighter is better).
4. **Repair burden** (fewer bounded repairs).
5. **Floor failures** (fewer deterministic-gate failures).
6. **Latency p50** (codex session wall-clock).
7. **Owner blind preference** (human read of the anonymized 9-sample packet).

The winning config is written to modelPolicy as the NORMAL production route (WP-705), bumping the route-policy version so prior qualification evidence is staled; fallback/rollback per WP-504 contains only 5.6 configs (or a fail-closed no-fallback), never 5.5.

## 9. Evidence / storage layout

- **Corpus + baselines:** `docs/v25/bakeoff-corpus-v1/` (immutable).
- **Per-stage run trees:** the bakeoff run tree (manifest.json phase ladder, freeze hashes, per-candidate generation/validation/review + D7 audit records) — COMPARE-ONLY for the fixed-chapter runs (no promotion/QC/publish; runBakeoff.ts:521-531).
- **9-sample owner packet:** stable comparison dir `docs/v25/bakeoff-corpus-v1/owner-packet/{anonymized,attributed}/` — 3 finalist configs × 3 chapters, each with generation config, reasoning level, pipeline SHA, D7 scores, repair history.
- **Unified ledger (WP-503):** every codex session + Claude-side D7 audit with model, effort, latency p50/p95, outcome; cost currencies = CALL COUNT + LATENCY (tokens NOT_METERED on the ChatGPT-subscription route, V25-15).
- **Decision record:** `docs/v25/implementation/V25_MODEL_POLICY_DECISION.md` (applied tie-break ladder → winner).

## 10. Abort conditions

- Owner spend-ceiling authorization absent → do not start.
- Capability probe fails for all candidates → halt.
- Frozen inputs drift between candidates for a chapter → halt (comparison invalidated; runBakeoff.ts:421/442).
- Any stage's cap or the 150-session cumulative ceiling would be exceeded → hard halt before the session.
- Screening yields no config ≥ 75 → STOP, owner escalation (format/architecture; audit C→D).
- Confirmed winner's D7 mean < 85 → do NOT write it as production route; halt for owner.
- Owner blind preference required (tie-break 7) but unavailable → halt, do not pick arbitrarily.
- Any attempt to route a candidate/judge to gpt-5.5 or any unsupported config → fail-closed pre-spawn (modelPolicy RoutePreflightError), never a fallback.

## 11. Total accounting

**Hard ceiling: 150 codex authoring/review sessions** (Stage 1 ≤18+≤40, Stage 2 ≤20, Stage 3 ≤25, plus preflight/probe and bounded repairs, cumulatively capped at 150) **+ the Claude-side D7 audits** (blind pair + adjudicator per scored chapter, ledgered separately). Every session and audit is recorded in the unified ledger; the running cumulative total gates each next session. This ceiling is the direct answer to V25-01's core failure (≈1,578 prior paid calls → zero durable outcome): the bake-off spends once, under a fixed budget, to a documented single-route decision.
