# Layer-N v2 — Final Qualification Report

**Date:** 2026-07-12 · **Status:** HALTED BEFORE DIAGNOSTIC GENERATION (owner directive) · **Diagnostic calls made: 0**

Layer-N v2 qualifies the **reviewer role** of the three sealed judges before the §16 diagnostic. This report states the reviewer-role result, the (non-)implication for authoring, instrument validity, per-judge and per-capability threshold results, and the exact call ledger. It draws **no** conclusion about GPT-5.6-SOL authoring.

---

## 1. Reviewer-role qualification result

**PANEL NOT QUALIFIED — 1 of 3 judges qualified.**

| Judge | Reviewer-role result | Cause |
|---|---|---|
| `gpt-5.5@high` | ✅ **QUALIFIED** (28/28) | — every capability met |
| `gpt-5.6-sol@high` | ❌ **NOT QUALIFIED** (20/28, conclusive) | systematic reserved-category *"fabricated / misleading source"* mustFixes on clean controls → cleanPass 0.125 |
| `gpt-5.5@xhigh` | ❌ **NOT QUALIFIED** (28/28) | missed **one** genuinely-ambiguous quiz item → quizAmbiguity 0.75 |

The two failures are **unrelated** and of **different character** (see §4). The panel does not qualify because §3 requires all three judges to individually qualify.

## 2. Authoring-role implication: **NOT DETERMINED**

Layer-N v2 is a **reviewer**-role instrument. It does **not** test GPT-5.6-SOL as an author/writer. **No inference about SOL authoring quality may be drawn from this result.** The gpt-5.6-sol reviewer behavior documented here concerns how the model *reviews* chapters, not how it *writes* them.

## 3. Instrument validity result

**STRUCTURALLY VALID — with one disclosed, unresolved clean-control adjudication.**

- The scoring mechanics are correct and self-consistent. The run-1 ship84 scoring defect was fixed in **scorer v2.2** (hard-blocker detection = mustFix-in-target-unit + verified evidence; the score-based ship bit no longer gates detection) and validated 8/8 on real reviews. **Thresholds were never changed.** The neutralized craft fillers (run-3) removed the run-2 borderline-gold item.
- **Open question (disclosed):** gpt-5.6-sol raised reserved-category *fabricated / misleading-source* mustFixes on the clean controls' **named-character examples** that neither gpt-5.5 judge raised — **14 disputed cases**. Whether these are gpt-5.6-sol **false positives**, or the clean controls are **not actually clean** (a gold/rendering/source-framing issue), is **NOT adjudicated**. Until it is, the clean-control gold carries an open question. Full evidence: **`SOL_JUDGE_SOURCE_REGISTER_DIVERGENCE_PACKET.{json,md}`**.

## 4. Per-judge threshold results

### gpt-5.5@high — QUALIFIED (28/28)
protocolValidity 1.00 · quoteEvidenceValidity 1.00 · **cleanPass 0.875** · hardBlockerSensitivity 1.00 · hardBlockerEvidenceAccuracy 1.00 · quizKeyMismatch 1.00 · quizAmbiguity 1.00 · nonBlockerCalibration 1.00 · observableDefectSensitivity 1.00 · pairedDirectionality 1.00 · unresolvedRequiredCases 0 · security NOT_APPLICABLE. **Failing checks: none.**

### gpt-5.6-sol@high — NOT QUALIFIED (20/28; conclusive)
Run halted after 20 items to surface the finding, but **all 8 clean-pass items were processed**, so cleanPass is conclusive: **7 of 8 clean controls blocked, 1 shipped → cleanPass 0.125** (< 0.75). **14 items** carried reserved-category *fabricated/misleading-source* mustFixes (across clean-pass, key-mismatch, craft, and hard-blocker kinds — see packet). **Failing check: cleanPass.** This is **not** a craft failure and **not** a scoring bug; it is a systematic reviewer standard, **disputed** vs the gpt-5.5 judges and pending adjudication.

### gpt-5.5@xhigh — NOT QUALIFIED (28/28)
protocolValidity 1.00 · quoteEvidenceValidity 1.00 · **cleanPass 0.875** · hardBlockerSensitivity 1.00 · quizKeyMismatch 1.00 · **quizAmbiguity 0.75** · nonBlockerCalibration 1.00 · observableDefectSensitivity 0.9375 · unresolvedRequiredCases 0. **Failing check: quizAmbiguity (0.75 < 0.85)** — missed one item (`ambiguity-decisive-ch1`, the observer-distance vs temporal-distance "attain distance" pair, both defensibly correct). Its craft calibrated **1.00** (the neutralized fillers held).

## 5. Per-capability results (across judges)

| Capability (threshold) | gpt-5.5@high | gpt-5.6-sol@high | gpt-5.5@xhigh |
|---|---|---|---|
| protocolValidity (1.00) | 1.00 | (partial) | 1.00 |
| hardBlockerSensitivity (1.00) | 1.00 | (partial) | 1.00 |
| quizKeyMismatch (1.00) | 1.00 | (partial) | 1.00 |
| quizAmbiguity (0.85) | 1.00 | (partial) | **0.75 ✗** |
| nonBlockerCalibration (0.85) | 1.00 | (partial) | 1.00 |
| cleanPass (0.75) | 0.875 | **0.125 ✗** | 0.875 |
| quoteEvidenceValidity (0.95) | 1.00 | (partial) | 1.00 |
| observableDefectSensitivity (0.85) | 1.00 | (partial) | 0.9375 |
| unresolvedRequiredCases (0) | 0 | (partial) | 0 |
| security | NOT_APPLICABLE — delegated to bound Layer-O v3 prerequisite (never a Layer-N pass) | | |

**Structural note:** the 4-item soft capabilities (quizAmbiguity, nonBlockerCalibration) at a 0.85 bar require 4/4 — a single soft miss fails a judge. This fragility surfaced twice (run-2 craft, run-3 xhigh ambiguity). Not remediated (no threshold change per directive); flagged for the panel-design decision.

## 6. Exact call ledger

| Phase | Calls |
|---|---|
| Stage-Q Layer-O (durable) | 540 |
| Layer-N run-1 (INSTRUMENT_INVALID, ship84 defect) | 37 |
| Layer-N run-2 (craft borderline) | 38 |
| Layer-N run-3 (final) | 96 |
| **Layer-N total** | **171** |
| **Campaign total consumed** | **711 / 2096 sealed hard-max** |
| **Diagnostic calls made** | **0** |
| **Confirmatory calls made** | **0** |

Run-3 breakdown: gpt-5.5@high 36 · gpt-5.6-sol@high 24 · gpt-5.5@xhigh 36. Route: `codex_exec_chatgpt_subscription` on every call; forbidden provider env absent; `CHAPTERFLOW_NO_API_CODEX_QC=1`; 0 canonical-tree writes.

## 7. Seal (run-3, unchanged since sealing)

corpus `fa67542f…` · instrument `fd34fd95…` · thresholds `d9625446…` · schedule `99b367e4…` · seal-file `3979b4bc…` · Layer-O v3 prerequisite `ffba6d2c…` (ALL_THREE_JUDGES_QUALIFIED), FRESH.

## 8. What is halted and what is next

**Halted:** diagnostic generation. **Preserved:** every attempt, phase result, route sidecar, parsed output, evidence span, score, and hash — including the run-1 and run-2 evidence (renamed `…-RUN1-instrument-invalid`, `…-RUN2-craft-borderline`).

**No further live call is authorized** until (1) the **14 disputed source-register cases** are adjudicated (blind fields provided in the packet) and (2) the **reviewer-panel design** is explicitly decided. The central open question the owner must resolve: **is gpt-5.6-sol over-flagging (false positive), are the clean controls actually not clean, is it a rendering/context defect, or is it a genuine boundary case?** — and, given that gpt-5.6-sol is also a diagnostic judge, **can the diagnostic run meaningfully with the panel as sealed?**

**Prohibitions honored:** no rerun · no corpus/gold/threshold change · no judge replacement · no diagnostic generation · no SOL-authoring inference · no IMP-13 · no implementation change while preparing this packet.
