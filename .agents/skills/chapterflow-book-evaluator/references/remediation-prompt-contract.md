# Below-80 Remediation Prompt Contract

Generate remediation only after ratings and arithmetic are final. Keep blind raters isolated; remediation generation must not influence their scoring.

## Contents

1. Thresholds and targets
2. Condition ledger
3. Evidence provenance
4. Priority and workstream rules
5. Prompt content
6. Validation

## Thresholds and targets

Use raw values and strict `< 80`, never a rounded display value:

| Scope | Trigger | First passing planning target |
|---|---|---|
| Overall | `overall_score < 80.0` | `80.0/100` |
| Domain | `domain_score / 4 × 100 < 80.0` | `3.25/4` for four integer ratings |
| Subcriterion | `rating / 4 × 100 < 80.0` | `4/4` on the supplied integer scale |

An adjudicated 3.5/4 also clears the strict threshold. Never change a rating to reach a target; a fresh evaluation establishes any new score.

## Condition ledger

Create one record for every trigger with a stable identifier:

- `O-001` for overall.
- `D-01` through `D-09` in canonical domain order.
- `S-01-01` through `S-09-04` in canonical subcriterion order.

Each record must preserve scope, rubric path, label, current value, normalized percentage, target floor, deficit, domain weight, modeled weighted contribution, evidence class, priority, and verification instruction.

Keep every condition visible. Generate one comprehensive implementation prompt per book and merge related subcriteria into domain workstreams. This prevents thousands of repetitive prompts without dropping any trigger.

The overall condition is an umbrella objective, not an additional score contribution. Never sum every theoretical 3→4 change into a promised score.

## Evidence provenance

### Direct evidence

Use adjudicated rationale/evidence, the supplied evaluator assessment and named weakness instructions, exact gate notes, exact non-generic QA findings, structured technical findings, explicitly blank required chapter fields, and named source locators. Preserve the locator and paraphrase. Label screening assessments as evaluator-level triage evidence, not chapter-level proof.

### Contextual diagnostics

Attach a diagnostic only when a supplied finding identifies the same phenomenon. Examples include longest-answer cues, timestamp staging, acronym load, similarity/repetition, source administration, missing immediate action, and explicit duplicate/missing flags. Label these supporting signals, not causal proof. Use the same detector for before/after comparison and do not invent a pass threshold.

### Score-only targets

When a low score has no supplied rationale, include:

> No chapter-level rationale was supplied for this score. Treat it as a review target. Inspect the package and record new source locators before implementing or claiming resolution.

Do not infer a defect from the subcriterion label, category, tag, popularity, or chapter evidence text alone.

## Priority and workstream rules

- `P0`: failed/unevaluable gate, technical corruption, rating 0–1, or overall below 60.
- `P1`: conditional gate, semantic/integrity gate note, overall 60–69.9, or domain at or below 2.5.
- `P2`: overall 70–79.9, domain 2.75–3.0, rating-2 subcriterion, or explicit QA defect.
- `P3`: rating-3 enhancement target without a stronger trigger.

Within a tier, order by modeled impact:

```text
subcriterion potential = (4 - current_rating) × domain_weight / 16
domain lift to floor   = (3.25 - current_domain_score) × domain_weight / 4
overall arithmetic gap = 80 - current_overall
```

Apply dependency order: integrity; epistemic and ethics gates; audience clarity and mental models; learning, retention, and transfer; agency and engagement; whole-book coherence; polish.

Every domain workstream must map all related condition IDs and include:

- current score state and arithmetic planning target;
- source inspection required before editing;
- direct and contextual evidence plus explicit unknowns;
- ordered, domain-specific implementation steps tied to the rubric anchors;
- preservation constraints from stronger domains;
- acceptance criteria, diagnostics, regression checks, and fresh rerating.

Make every workstream book-specific. Carry the exact supplied assessment, matching domain weakness, gate note, and QA finding into the affected workstream. Add ranked chapter/source navigation targets from the available chapter records, but label inferred targets as hypotheses that require source verification. Do not emit an identical generic instruction block as the complete remediation for multiple books.

Map QA findings to the affected domain workstream and promote a `P3` workstream to at least `P2`; never reduce a stronger priority. Keep condition priority and workstream priority separate when this promotion occurs.

Store condition-linked evidence counts separately from evidence-packet counts. Do not report zero direct/contextual evidence for a book that contains supplied assessment, gate, QA, or diagnostic evidence.

## Prompt content

Every book prompt must contain:

1. Book/source identity and evidence boundary.
2. Immutable overall, domain, weighted-point, gate, confidence, and evaluation-mode snapshot.
3. The complete condition ledger.
4. Direct, contextual, and score-only evidence sections.
5. Prioritized, deduplicated domain workstreams.
6. Arithmetic lift to 80 and modeled domain contributions labeled as scenarios.
7. Chapter/source inspection plan with concise locators.
8. Preservation constraints and non-regression checks.
9. Gate-first acceptance criteria and a fresh rubric rerating requirement.
10. A structured implementation hand-back.

Prohibit editing scores, rankings, report data, or evaluation artifacts to simulate improvement. A score lift cannot clear a gate failure. Do not claim external factual accuracy or measured retention, transfer, completion, satisfaction, or behavior change.

Require this hand-back:

```json
{
  "book_id": "...",
  "conditions_addressed": [],
  "conditions_deferred": [],
  "changed_files": [],
  "changed_chapters": [],
  "evidence_locators": [],
  "before_after_diagnostics": [],
  "validation_commands": [],
  "validation_results": [],
  "gate_status_requested_for_reassessment": [],
  "residual_risks": [],
  "score_changes_claimed": false
}
```

## Validation

Require:

- one remediation record and one comprehensive prompt per evaluated book;
- exact reconciliation of raw below-80 triggers and stable condition IDs;
- every condition ID appears in the prompt and one workstream or umbrella objective;
- all `P0`–`P2` conditions map to an implementation change or explicit unresolved hand-back;
- all deferred `P3` conditions remain visible;
- gates remain independent; diagnostics remain proxies; no score-only target is described as a proven defect;
- shared screening gate notes attach only to non-pass gates, full-content provenance remains visible, and displayed arithmetic gaps are rounded deterministically;
- every workstream has explicit evidence, contextual signals, unknowns, and book-specific chapter/source inspection targets;
- deterministic JSON and Markdown prompt packs;
- report rendering, downloads, embedded JSON, and HTML safety checks pass before `latest/` publication.
