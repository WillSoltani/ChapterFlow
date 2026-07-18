# Stage-Q v3 Preflight Report — 2026-07-11

Returned before any v3 live call. Stage-Q v1 and v2 remain `STAGE_Q_INSTRUMENT_INVALID`;
no prior result rewritten into a pass. D1 was a prompt-versus-schema mismatch; D2 was a
gold-standard definition error. v3 uses execution-enforced structured output; the original
ambiguous cases are development-only; v3 qualifies on fresh review-finding holdouts; no
diagnostic model output existed when v3 was designed.

## D1 correction (committed)

- Central broker `--output-schema` mechanism (`codexAgent.ts` `outputSchemaPath` →
  `executionEnvelope.ts` `hermeticExecArgv`): binds `codex exec --output-schema <file>`,
  writes a structured-output sidecar (schema path + SHA-256 + parse result), fails closed on a
  missing schema, stays on the ChatGPT-subscription route. Test proves the schema reaches the
  codex exec argv and the sidecar is written.
- Three target schemas (`STAGE-Q-V3-SCHEMA-MANIFEST.json` `cde4f158…`): `additionalProperties:
  false`, explicit `required`, in-schema enums, `evidenceSpans` a typed non-empty-string array
  — stringified arrays / missing / unknown / invalid enum all rejected.
- Review execution path = PROVEN role-specific compatibility exception (fenced + tolerant +
  byte-verified), documented in the schema manifest.

## D2 correction (committed)

- `stageQv3.ts`: `evidenceSufficiency` + `findingValidity` with the frozen consistency rule
  (enforced as schema validity); assertion ≠ proof (UNSUPPORTED over a decidable record);
  INCONCLUSIVE reserved for a named missing comparator. New metric
  `reviewEvidenceSufficiencyAccuracy` + zero-false-SUPPORTED-on-high-severity-unsupported.
- Re-adjudication of the 8 v2 review cases (`STAGE-Q-V2-REVIEW-FINDING-READJUDICATION.json`
  `84518974…`): RF4 and RF6 → UNSUPPORTED; RF7's sufficiency coordinate resolves the v2
  ambiguity. Moved to `v3/development/review-finding-v2-cases/` — development-only.

## Fresh review holdout + calibration (adversarially audited)

- 8 fresh holdout (2 SUPPORTED / 2 PARTIALLY_SUPPORTED / 2 UNSUPPORTED / 2 INCONCLUSIVE),
  evidence-determinable, each declaring intentionally-unavailable evidence.
  (`review-fresh-holdout*.json`).
- 6-case calibration set (1 candidate / 4 review one-each-label / 1 security),
  excluded from qualification.
- **Adversarial gold audit** (`STAGE-Q-V3-GOLD-AUDIT.json`): verifier B (independent Claude
  subagent, definitions-only) 14/14 MATCH, 0 MISMATCH — and explicitly confirmed the
  UNSUPPORTED(U2)-vs-INCONCLUSIVE(I1/I2) boundary is drawn correctly. Verifier A (adversarial,
  inline, maximal skepticism) AGREED on 7/8 holdout + all 6 calibration and FLAGGED SQV3-RF-P2
  as contestable (PARTIALLY_SUPPORTED vs UNSUPPORTED severity ambiguity) → BLOCKED and REPLACED
  with an unambiguous scope-overstatement case (three quiz questions, exactly one key
  contradicts its own explanation — mechanically verifiable; finding claims "all three" →
  PARTIALLY_SUPPORTED forced). After replacement, both verifier roles AGREE on all 14. Neither
  verifier is the codex judge panel — the holdout was never exposed to the qualification models.
- **Internal consistency:** a perfect-judge self-check (answering the gold) QUALIFIES (corpus
  not vacuous); blindness precheck over all 64 cases PASS.

## v3 corpus + thresholds

- 64 qualification cases (`STAGE-Q-V3-HOLDOUT-CORPUS-MANIFEST.json` `2eaa79c5…`): 56 kept
  proven-sound + 8 fresh review; 8 families × 8; blind order; fail-closed blindness precheck.
  Denominators: candidate 36, high-severity 8, clean 12, review validity 8, review sufficiency
  8, injection 6, security 8.
- Thresholds (`STAGE-Q-V3-THRESHOLDS.json` `70513d61…`): v2 bounds preserved + review
  evidence-sufficiency accuracy ≥85% + zero-false-SUPPORTED-high-severity. Not weakened.

## Absolute campaign ceiling (recomputed, not reused)

**2,096** live model calls — each operation counted once:
- Stage-Q owner instrument (once): v1 192 (consumed) + v2 138 (consumed) + v3 calibration 36 +
  v3 qualification 384 = 750.
- native Layer-N qualify (once): 258.
- diagnostic candidate work: 384. confirmatory candidate work: 704.
- **Consumed: 330. Remaining authorized: ≤ 1,766.** Reconciliation: the owner's listed
  "existing diagnostic/confirmatory maxima" (1,026 / 1,346) each contain a Stage-Q allocation
  now superseded by v3; counting v3 qualification + Layer-N once and using the candidate-only
  portions of diagnostic/confirmatory avoids double-counting. 2,096 is a hard upper bound
  (every component code-pinned; Stage-Q runs once), NOT a target.

## Tests + route invariant

- Targeted v3 tests (schema-reaches-codex-exec, structured sidecar, missing-schema
  fail-closed, schema rejects stringified/missing/unknown/invalid, consistency rule,
  assertion→UNSUPPORTED, missing→INCONCLUSIVE, sufficiency accuracy, no-retro-v1/v2-pass,
  holdout-disjoint-from-dev): 10/10 green; **full suite 2,356 / 0** (broker `--output-schema`
  change caused zero regression); typecheck clean; committed `2657cec34`.
- Every live v3 call routes `codex_exec_chatgpt_subscription / chatgpt / apiKeyPresent:false /
  apiFallbackAllowed:false`; no API provider or fallback reachable; the runner refuses to start
  with any forbidden provider env var.

## Live sequence (on your standing authorization)

1. Calibration: 18 live calls; pass only on 100% schema validity, real evidenceSpans arrays,
   target distinction, sufficiency-rule review labels, no ambiguity. If it fails on another
   instrument ambiguity → STOP (do not enter qualification).
2. If calibration green → qualification: 64×3 (≤384). Gate: all three judges meet the
   target-specific conjunction.
3. Final-stop rule: valid instrument + judge miss → judge unqualified; panel can't meet the
   conjunction → stop the campaign; a THIRD material instrument ambiguity → stop for offline
   redesign (no v4). If v3 passes → sealed diagnostic → C3 pause before unblind.

**Confirmation: the first v3 live call has not yet occurred.**
