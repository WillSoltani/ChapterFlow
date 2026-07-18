# Stage-Q v1 Postmortem — 2026-07-11

## Verdict classification

The completed Stage-Q v1 Layer-O run is classified **`STAGE_Q_INSTRUMENT_INVALID`**.
It is **not** evidence that the judge panel is intrinsically unqualified.

## Required statements (owner directive 2026-07-11)

- **Stage Q v1 did not qualify the panel.** All three judges scored below the frozen
  C4 bounds; the panel is not qualified under v1.
- **The run exposed an instrument defect.** The failure signature — near-unanimous
  panel agreement (pairwise kappa 0.967–1.0), perfect schema validity, perfect
  clean-control specificity, perfect evidence-span validity, and two *entire* families
  at 0.0 sensitivity across all three judges — is the signature of a systematic
  task-and-label mismatch in the instrument, not independent judge error. A panel that
  agrees with itself and grounds every complaint in verbatim evidence, yet uniformly
  diverges from the gold on exactly two coordinate systems, is reading a mis-specified
  instrument correctly.
- **No diagnostic or confirmatory call occurred.** Execution stopped at the Stage-Q
  gate. Layer N was never started; the sealed diagnostic and confirmatory experiments
  were never entered; their seals (`e8e5d4bb…`, `45cf77c1…`) are intact and unconsumed.
- **No original output or score was deleted.** All 192 Layer-O reads, the
  `layer-o-summary.json`, the failure report + evidence JSON, and every per-spawn
  manifest / route / result sidecar in `logs/exec/` are preserved unchanged.
- **v1 results are not being rewritten into a pass.** The v1 summary remains a FAIL.
  This postmortem, the label-diff, and the v2 instrument are additive; nothing
  retroactively converts a v1 read into a passing score.
- **v2 is a new qualification instrument.** Stage-Q v2 is a distinct, versioned
  instrument with separated evaluation targets, corrected label coordinates, corrected
  injection scoring, target-specific metrics, and a fresh holdout corpus. It is sealed
  and run separately; its results stand on their own.

## The three instrument defects (evidence in `STAGE-Q-V1-FAILURE-EVIDENCE.json`)

1. **Generic DEFECT|CLEAN question across incompatible targets.** v1 asked one
   content-defect question of candidate content, of review findings *about* content,
   and of security artifacts. Review-finding cases and candidate-content cases do not
   share a verdict coordinate system; pooling them created the family-B failure.
2. **Wrong verdict coordinates for unsupported reviewer complaints.** v1 gold mapped
   "unsupported complaint + clean candidate" to `verdict: DEFECT`. All three judges
   produced the gold's *reasoning* verbatim ("score-only, lacks chapter rationale,
   cannot be upheld") but expressed it as `INCONCLUSIVE / don't-uphold`. The judges were
   correct about the world; the label demanded they call a clean chapter defective.
3. **Register standard leaned on hidden provenance; injection heuristic conflated
   quotation with compliance.** Family A required a fictional disclaimer even for
   scenario-labeled generic vignettes (judged CLEAN by the panel on reader-facing
   grounds). The takeover heuristic fired on SQ-057 because the judge *quoted* the
   injected directive as byte-verified evidence while flagging it HIGH and not obeying
   it — quotation was scored as takeover.

## Terminology

`ownerApprovedForDevelopmentBakeoff: true` · `independentHumanRater: false`. v2 fresh
fixtures are owner-approved development fixtures, never independent human labels.

## Preservation pointers

- `stage-q/layer-o-results/` — 192 reads + `layer-o-summary.json` (FAIL, unchanged) +
  `STAGE-Q-FAILURE-REPORT.md` + `STAGE-Q-FAILURE-EVIDENCE.json` (`0fc962a5…98c3`).
- `logs/exec/` — 192 per-spawn manifests / route sidecars (all
  `codex_exec_chatgpt_subscription`) / result sidecars.
- Campaign spend at v1 stop: **192 of the (pre-v2) 2,372 ceiling**.
