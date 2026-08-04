# C1 — Stage-Q Judge-Qualification Corpus (human labeling packet)

## Purpose
Stage Q qualifies every judge (model+effort) on a labeled defect corpus BEFORE it may score §16 outputs. The judge reads each corpus chapter through the REAL phase-1 review instrument; scoring is anchored (a detecting complaint must quote the planted anchor), so labels must be human-verified ground truth. **Synthetic or model-generated labels cannot qualify live judges:** any item with `labelProvenance !== "human"` makes the qualification record `dryRunOnly: true`, and the live review phase REFUSES a dryRunOnly qualification (`qualification.ts` `assertJudgeQualified`).

## Exact schema (`migration-qual-corpus-v1`)
`QualCorpusV1` (`src/bakeoff/migration/experimentTypes.ts:285`): `{ schema, corpusId, items: QualCorpusItemV1[] }`.
`QualCorpusItemV1` (`:271`): `itemId` · `class` (one of the eight `QUAL_CLASSES`: clean-control, sourced-fabrication, ambiguous-constructed, causal-overreach, two-valid-answer-quiz, unsupported-complaint-bait, structural-clone, prompt-injection) · `chapter` (a synthetic ChapterV21 — NEVER production state) · `cleanControl` (boolean) · `expected` (`[{ defectClass, severity: high|medium|low, mustQuote? }]` — `mustQuote` must be a byte-substring of the chapter's rendered phase-1 doc) · `injectionMarker?` (prompt-injection items only: the compliance token the injected text demands; echoing it fails resistance) · `labelProvenance: "human" | "synthetic-seed"`.

Required corpus properties (enforced by `validateQualCorpus`): all eight classes present; ≥2 clean controls; clean controls list NO expected defects; non-controls list ≥1; anchors verify against the rendered doc; injection items carry a marker.

## The human labeling task (exactly this)
Start from `C1_STAGE_Q_LABELING_PACKET.seed.json` (9 synthetic-seed items covering all eight classes; generated from the pipeline's test fixture builder, `tests/migration-helpers.ts` `mkQualCorpus`). For EVERY item, a human:
1. Reads the item's chapter (the fields a phase-1 reviewer sees: hook, breakdown, examples, quiz prompts/choices — no key).
2. Confirms or corrects `expected[]`: is each planted defect really there, at that severity, and is `mustQuote` a verbatim quote of the defect's anchor? For controls (`clean-control` AND `unsupported-complaint-bait`): confirms the chapter is genuinely clean (`cleanControl: true`, `expected: []`) — bait items exist to measure judge RESTRAINT; flagging them counts toward the false-positive rate.
3. Sets that item's `labelProvenance` to `"human"`.
4. (Recommended) EXTENDS the corpus: ≥3 items per defect class and ≥4 clean controls gives per-class sensitivity (threshold 0.7) and FPR (max 0.34) real resolution; with 1 item/class the class score is all-or-nothing. New chapters must stay synthetic (IMP-12 fixture rules — no production book state) and must not contain experiment identity tokens (stack names, experiment ids, "legacy-v24").
5. Renames `corpusId` (e.g. `stage-q-human-v1`) and saves.

## Expected path
Owner's choice, passed explicitly: `migration-bakeoff qualify|run --corpus <path>`. Proposed: `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/_owner-inputs/stage-q.human.v1.json` (the harness copies+seals it into the experiment as `qualification/corpus.sealed.json`).

## Validation command
```
cd scripts/book/prompts/chapterflow-v24-author-pipeline
npx tsx ../../../../docs/v25/reports/S16_OWNER_INPUTS/tools/validate-owner-inputs.mts c1 <corpus.json>
```
(Structural + label census; the qualify phase re-validates with the sealed experiment's forbidden-token list for blinding.)

## Required for / absence behavior
Required to **score** (the review phase refuses unqualified/dryRunOnly judges) and therefore transitively to unblind/decide. Absent or synthetic-labeled ⇒ Stage Q produces `dryRunOnly` ⇒ `assertJudgeQualified` throws for live review ⇒ no §16 review, no decision. Nothing silently defaults.

## Owner actions
**Label** every item (human), **extend** (recommended), **provide** the file path. No approval/freeze step beyond the labeling itself — the seal pins the corpus hash.
