# Prompt IMP-20: Split-Lane Reviewer Alignment and §16 Recovery

## Role

You are a principal AI pipeline architect, TypeScript implementation lead, evaluation designer, and migration-recovery engineer.

You are working in the current integrated ChapterFlow repository after the halted V25 GPT-5.6-SOL §16 campaign.

Your job is to implement the permanent reviewer-architecture correction and prepare a new, sealed recovery experiment.

You must not run live model calls during this implementation package.

---

## Context

The §16 campaign was intended to compare:

```text
GPT-5.5 high
GPT-5.5 xhigh
GPT-5.6 SOL high
GPT-5.6 SOL xhigh
```

under controlled authoring inputs and blinded review.

It never reached diagnostic generation.

Recorded state at the supplied review bundle:

```text
repository HEAD:
23c4ede4efe88722a658130ad536a2fcf34ef51d

old campaign calls consumed:
711

old sealed ceiling:
2,096

diagnostic calls:
0

confirmatory calls:
0

Stage-Q Layer-O v3:
PASS

Layer-N v1:
INSTRUMENT_INVALID

Layer-N v2 final:
panel NOT QUALIFIED
```

The current process is not running. It is halted at the reviewer gate.

The owner does not prefer GPT-5.5, GPT-5.6 SOL, Terra, or any other model as judge. The requirement is:

> Select and use whichever judge configuration is demonstrably aligned with the intended ChapterFlow standard for the specific role it performs.

The existing campaign must not be resumed by merely changing another corpus item, threshold, or model.

---

## Evidence

Verify every claim below against the current integrated repository and durable campaign artifacts before changing code.

### E-01 — Impossible reader-review authority

`src/review/readerReview.ts:151-170` tells a reviewer to:

```text
judge only what is on the page
```

while also requiring it to detect:

```text
fabricated people or events
source-contradictory examples
claims the source never makes
```

The reviewer workspace contains only the phase-1 reader document.

### E-02 — Source evidence is absent from Layer-N controls

The current Layer-N corpus chapters have no:

- `SourceUsePlanV1`;
- source packets;
- source sidecars;
- source anchors;
- claim ledger.

The review context matrix confirms these are not visible to the reviewer.

### E-03 — High score was used as source-clean gold

`build-layer-n-v2-corpus.mts` selects clean controls from books with Content Design Score at least 87 and sets:

```json
{
  "expectedPass": true,
  "prohibitMustFix": true
}
```

The 140-book evaluation explicitly states that external accuracy was not assessed.

### E-04 — Hidden source semantics are invented by normalization

`build-layer-n-v2-corpus.mts` adds:

```json
{
  "format": "scenario"
}
```

to examples lacking `planSpec`.

That metadata is:

- inferred after generation;
- not compiler-owned source provenance;
- not reader-visible;
- not a substitute for `SourceUsePlanV1`.

### E-05 — Current ontology already exists

Inspect:

```text
src/contracts/sourceUsePlan.ts
src/compiler/sourceUsePlanCompiler.ts
src/critics/sourceRegister.ts
src/critics/sourceGrounding.ts
```

The pipeline already distinguishes:

```text
source_bound
constructed
generic
```

with source anchors, claim strength, detail permissions, and framing rules.

### E-06 — Panel assignment rotates judges

`src/bakeoff/migration/reviewRunner.ts:60-68` rotates the primary judge by execution order.

`reviewRunner.ts:113-125` refuses a sample unless every assigned judge is qualified.

This makes every panel member a blocker and injects judge-model variance into candidate comparisons.

### E-07 — Small soft-capability denominators are brittle

The Layer-N v2 corpus has four quiz-ambiguity and four craft-calibration cases.

A threshold of 0.85 over four cases requires 4/4.

### E-08 — Legacy model-owned ship bit

The current professional bar is 80, but the schema field remains:

```json
"ship84": false
```

The deterministic pass requires both:

```text
composite >= bar
ship84 === true
```

Preserved evidence includes chapters scoring above 80 with no `mustFix` complaint that still fail because the model returned `ship84:false`.

### E-09 — Corpus builder is non-hermetic

The builder contains absolute paths under:

```text
/Users/...
/private/tmp/...
```

and silently builds no spec variants when the temp mutation file is missing.

### E-10 — Current campaign is development evidence, not confirmatory evidence

The qualification instrument and gold were modified after several live runs.

Preserve all history. Do not reinterpret earlier failures or passes.

---

## Inputs

Inspect the authoritative current repository and durable campaign evidence.

At minimum, inspect:

```text
README.md
AGENTS.md and every nested AGENTS.md
package.json and lockfiles
tsconfig files
test configuration

src/review/readerReview.ts
src/review/renderReaderDoc.ts
src/review/quizAdjudication.ts
src/review/reviewerWorkspace.ts
src/orchestrator/authorReview.ts

src/contracts/sourceUsePlan.ts
src/compiler/sourceUsePlanCompiler.ts
src/critics/sourceRegister.ts
src/critics/sourceGrounding.ts

src/bakeoff/review.ts
src/bakeoff/migration/reviewRunner.ts
src/bakeoff/migration/qualification.ts
src/bakeoff/migration/nativeReviewTypes.ts
src/bakeoff/migration/nativeReviewQualification.ts
src/bakeoff/migration/nativeReviewRunner.ts
src/bakeoff/migration/nativeReviewSeal.ts
src/bakeoff/migration/experimentTypes.ts
src/bakeoff/migration/guards.ts
src/bakeoff/migration/seal.ts

state/migration-experiments/_owner-inputs/stage-q/
state/migration-experiments/ and all §16 manifests, seals, schedules,
call ledgers, results, and preserved attempt evidence

docs/v25/IMP-19_LAYER_N_V2_IMPLEMENTATION_REPORT.md
docs/v25/reports/ and relevant integration reports
the current migration master plan and prompt pack
the ChapterFlow v2 rubric standard
the original v24 archive or extracted authoritative snapshot, when present
the top-rated-book artifacts used by Layer-N v2
```

Also inspect the supplied judge-alignment review bundle when it is available:

```text
CHAPTERFLOW_JUDGE_ALIGNMENT_REVIEW_BUNDLE_2026-07-12_015947.zip
SHA-256:
34af4e459bd113a9cc6e5207af966d16807134b9bb1199a084de6040282a345c
```

Treat implementation reports and summaries as hypotheses until verified against code, manifests, hashes, and raw evidence.

If the repository HEAD differs from the recorded bundle HEAD, document the difference and determine whether later changes already address any requirement. Do not discard valid later work or blindly reset the tree.

---

## Objective

Implement a split-lane reviewer architecture that:

1. Separates reader experience from source truth and quiz truth.
2. Gives each reviewer the evidence needed for its authority.
3. Aggregates typed results deterministically.
4. Qualifies judge configurations per role.
5. Uses fixed judge assignment during the bakeoff.
6. Removes the all-models-must-pass gate.
7. Builds hermetic, role-specific qualification corpora.
8. Prevents another live test-rewrite treadmill.
9. Archives the old §16 campaign without deleting evidence.
10. Prepares a new, small, sealed recovery pilot.
11. Makes no live model call until separately authorized.

---

## Scope

Included:

- reviewer prompt and schema versioning;
- reader-experience review lane;
- source-and-claim-integrity review lane;
- quiz-integrity review lane;
- deterministic result aggregation;
- migration-harness judge assignment;
- role-specific judge qualification;
- qualification corpus design and builders;
- corpus provenance and hashing;
- old-campaign closure;
- new recovery experiment contracts and preflight;
- unit, integration, regression, negative, failure-path, and red-team tests;
- migration documentation and implementation report.

---

## Non-goals

Do not:

- change authoring prompts merely to make a judge pass;
- select GPT-5.5, GPT-5.6 SOL, Terra, or another model by preference;
- rerun Layer-N v2;
- create Layer-N v3 or v4 as another monolithic reviewer test;
- change old gold labels;
- change old thresholds;
- delete old calls or results;
- resume the old diagnostic seal;
- weaken factuality, safety, source, quiz, or publication gates;
- route authoring permanently back to GPT-5.5;
- add book-specific or chapter-specific production branches;
- run a book generation;
- run a repair;
- run a live judge;
- run `codex exec`;
- call an API or model SDK;
- activate `IMP-13`;
- publish, promote, deploy, upload, or push.

---

## Required architecture

## A. Reader-experience lane

Create a new versioned contract, for example:

```ts
type ReaderExperienceReviewV1 = {
  schema: "reader-experience-review-v1";
  reviewerRole: "reader-experience";

  chapterContentSha256: string;
  readerDocumentSha256: string;
  rubricVersion: string;

  scores: {
    retention: number;
    quizzes: number;
    transfer: number;
    practical: number;
    summaries: number;
    tone: number;
    limits: number;
    insight: number;
    density: number;
    beginner: number;
  };

  quizDerivation: {
    answers: Array<"a" | "b" | "c">;
    mechanisms: string[];
    confidence: Array<"low" | "medium" | "high">;
    ambiguities: string[];
    tells: string[];
  };

  recommendation: "SHIP" | "REVISE" | "BLOCK";

  blockingFindings: Array<{
    category:
      | "unsafe"
      | "internal_contradiction"
      | "structurally_invalid"
      | "schema_or_app_breaking"
      | "unusable";
    unit: string;
    problem: string;
    evidenceSpans: string[];
  }>;

  escalationSignals: Array<{
    category:
      | "origin_ambiguous_to_reader"
      | "possible_real_world_claim"
      | "possible_attribution_issue";
    unit: string;
    problem: string;
    evidenceSpans: string[];
  }>;

  advisoryFindings: Array<{
    category:
      | "thin_example"
      | "quiz_cue"
      | "repetition"
      | "tone"
      | "density"
      | "pacing"
      | "other_craft";
    unit: string;
    problem: string;
    evidenceSpans: string[];
  }>;

  strongestEvidence: string[];
  weakestEvidence: string[];
  oneParagraphVerdict: string;
};
```

The exact type names may differ, but the semantics must not.

### Reader-lane authority

The prompt must explicitly say:

```text
You are evaluating the reader-facing chapter.

You may judge whether a passage presents its status clearly to the reader.

You may not determine whether an external person, organization, event,
quotation, date, number, study, or source claim is factually real or
source-supported because no source evidence is provided.

When a passage reads as factual but its status is unclear, emit
origin_ambiguous_to_reader. Do not call it fabricated or source-contradictory.
```

Remove source-truth categories from reader-lane blocking authority.

Preserve internal contradiction as a reader-lane blocker when the contradiction is visible within the chapter itself.

### Reader-lane output

Use execution-enforced structured output.

Do not rely on a fenced JSON example alone.

Use a JSON Schema with:

- required fields;
- strict enums;
- array types;
- `additionalProperties:false`;
- schema hash recorded in evidence.

---

## B. Source-and-claim-integrity lane

Create a separate versioned source-aware review contract, for example:

```ts
type SourceIntegrityReviewV1 = {
  schema: "source-integrity-review-v1";
  reviewerRole: "source-integrity";

  chapterContentSha256: string;
  sourceUsePlanSha256: string;
  sourcePacketSha256: string;
  sidecarSha256: string;

  units: Array<{
    unitId: string;
    expectedOrigin: "source_bound" | "constructed" | "generic";
    expectedForm:
      | "case"
      | "application"
      | "operational_scenario"
      | "explanation"
      | "analogy";

    claimStrengthExpected:
      | "descriptive"
      | "inferential"
      | "correlational"
      | "mechanistic"
      | "causal";

    visibleRegister:
      | "clearly_sourced"
      | "clearly_constructed"
      | "clearly_generic"
      | "ambiguous"
      | "presented_as_fact";

    supportStatus:
      | "SUPPORTED"
      | "PARTIALLY_SUPPORTED"
      | "UNSUPPORTED"
      | "NOT_APPLICABLE"
      | "INCONCLUSIVE";

    framingAdequate: boolean | null;
    claimStrengthFit: boolean | null;
    namedSpecificityAllowed: boolean | null;

    chapterEvidenceSpans: string[];
    sourceEvidenceSpans: string[];

    findings: Array<{
      category:
        | "invented_detail"
        | "source_contradiction"
        | "missing_visible_framing"
        | "generic_specificity_leak"
        | "claim_strength_overreach"
        | "unsupported_attribution"
        | "missing_required_evidence";
      severity: "blocker" | "major" | "minor";
      explanation: string;
    }>;
  }>;

  result: "PASS" | "BLOCK" | "INCONCLUSIVE";
  blockingFindingIds: string[];
  rationale: string;
};
```

### Source-lane inputs

The source reviewer must receive only the required role package:

```text
candidate chapter
immutable SourceUsePlanV1
validated source packet
validated source sidecar
allowed anchor catalog
claim-strength constraints
relevant source projection or claim ledger
```

Every non-instruction artifact must be wrapped as untrusted data.

The source reviewer must not receive:

- model identity;
- authoring stack identity;
- previous judge verdicts;
- acceptance outcome;
- answer-key outcome unless a source claim in the quiz is under review.

### Source-lane rules

Enforce:

```text
source_bound:
- requires valid anchors
- named specifics must be supported
- no invented dialogue, thought, date, participant, setting, outcome,
  statistic, credential, or quotation

constructed:
- must be visibly hypothetical at first entry
- no merging real people or organizations into invented events
- no fabricated date, statistic, credential, or citation
- consequences must be presented as illustrative, not reported history

generic:
- role labels and observable operations
- no historical specificity
- no claim that the event occurred

missing evidence:
- INCONCLUSIVE
- never guess
- never convert missing evidence into PASS
```

Use existing deterministic critics first:

```text
checkSourceRegister
checkChapterProvenance
checkExampleSourceGrounding
source-use-plan staleness checks
```

The semantic source reviewer should adjudicate what deterministic checks cannot establish.

Do not duplicate deterministic findings as separate independent votes.

---

## C. Quiz-integrity lane

Create or formalize a separate versioned quiz lane.

Use the existing two-phase blindness pattern:

```text
Phase 1:
chapter prose + questions + choices
no answer key
derive the answer and mechanism

Commit:
hash and persist the derivation

Phase 2:
committed derivation + answer key
adjudicate key correctness and ambiguity
```

The quiz lane owns:

- keyed-answer correctness;
- unique-answer requirement;
- ambiguity;
- causal-mechanism match;
- distractor validity;
- answer-length and wording tells.

It must produce a typed result, for example:

```ts
type QuizIntegrityResultV1 = {
  schema: "quiz-integrity-result-v1";
  chapterContentSha256: string;
  derivationSha256: string;
  questions: Array<{
    itemId: string;
    derivedAnswer: "a" | "b" | "c";
    keyedAnswer: "a" | "b" | "c";
    keyCorrect: boolean;
    uniqueAnswer: boolean;
    defensibleAlternatives: Array<"a" | "b" | "c">;
    mechanismSupported: boolean;
    tellDetected: boolean;
    explanation: string;
    evidenceSpans: string[];
  }>;
  result: "PASS" | "BLOCK" | "INCONCLUSIVE";
};
```

Do not let a general reader's holistic ship preference decide quiz correctness.

---

## D. Deterministic aggregation

Create a conductor-owned aggregation contract, for example:

```ts
type AggregatedChapterReviewV1 = {
  schema: "aggregated-chapter-review-v1";

  chapterContentSha256: string;
  readerResultSha256: string;
  sourceResultSha256: string;
  quizResultSha256: string;
  deterministicCriticBundleSha256: string;

  readerComposite: number;
  readerBar: number;

  finalStatus: "PASS" | "REVISE" | "BLOCK" | "INCONCLUSIVE";
  blockingReasons: string[];
  revisionReasons: string[];
  escalationReasons: string[];
};
```

### Required decision policy

At minimum:

```text
BLOCK when:
- a true safety blocker exists;
- a visible internal contradiction is unresolved;
- a source-integrity blocker exists;
- a source result is INCONCLUSIVE on a required claim;
- a quiz key is wrong;
- a one-answer quiz item is genuinely ambiguous;
- schema/app behavior is broken.

REVISE when:
- reader composite is below the bar;
- the chapter is usable but has non-blocking craft or learning defects;
- origin ambiguity requires clarification but source integrity is otherwise sound.

PASS only when:
- deterministic gates pass;
- reader result is valid;
- reader composite meets the bar;
- no reader blocker exists;
- source result is PASS;
- quiz result is PASS;
- all bound hashes are fresh.

INCONCLUSIVE:
- missing evidence;
- stale source plan;
- unavailable required adjudication;
- unresolved high-severity disagreement.
```

The model's recommendation is evidence. It is not the final gate.

---

## E. Replace the legacy `ship84` contract

Do not delete support for old persisted records.

Implement a versioned transition:

```text
reader-rubric-v3-phase1:
legacy parse and replay support only

reader-experience-review-v1:
new production and migration path
```

For the new path:

- remove `ship84` from the model-facing schema;
- use `recommendation`;
- compute final status deterministically;
- provide an explicit adapter for old artifacts;
- prevent an old record from satisfying a new freshness predicate;
- add a version/hash bump so incompatible evidence becomes stale.

Do not perform an in-place semantic reinterpretation of old reviews.

---

## F. Judge qualification by role

Create a role-qualified registry:

```ts
type JudgeCapabilityQualificationV1 = {
  profileId: string;
  model: string;
  effort: string;

  readerExperience:
    | "QUALIFIED"
    | "NOT_QUALIFIED"
    | "NOT_TESTED";

  sourceIntegrity:
    | "QUALIFIED"
    | "NOT_QUALIFIED"
    | "NOT_TESTED";

  quizIntegrity:
    | "QUALIFIED"
    | "NOT_QUALIFIED"
    | "NOT_TESTED";

  securityBoundary:
    | "QUALIFIED"
    | "NOT_QUALIFIED"
    | "NOT_TESTED";

  evidenceHashes: string[];
  corpusHashes: string[];
  instrumentHashes: string[];
  qualifiedAt: string;
};
```

A model may qualify for one role and fail another.

Do not require all profiles to qualify.

### Required production/bakeoff roles

Before the future bakeoff, require:

```text
reader:
- one fixed qualified primary
- one fixed qualified backup/audit judge

source:
- one fixed qualified primary
- one qualified independent adjudicator for high-severity findings
  OR a mandatory blind human adjudication path

quiz:
- deterministic checker
- one qualified semantic adjudicator
```

### Selection policy

Freeze selection before candidate outputs.

Among profiles that meet every mandatory threshold for a role:

1. Prefer the highest held-out alignment score for that role.
2. Tie-break by lower high-severity false-positive rate.
3. Then lower unresolved rate.
4. Then lower observed invocation count/latency.
5. Never tie-break by preferred model family.

If only one profile qualifies for a safety-critical role and no independent adjudication path exists, keep the campaign blocked.

---

## G. Fixed judge assignment

Replace rotating primary assignment in the migration harness.

The future bakeoff must use:

```text
same primary reader judge for every candidate cell
same primary source judge for every candidate cell
same quiz adjudicator policy for every candidate cell
same audit-subsample rule for every candidate cell
```

A backup judge runs only on:

- a frozen balanced audit subset;
- high-severity source findings;
- required disagreement adjudication;
- prespecified operational failure.

Do not choose the backup based on which candidate produced the output.

Do not let the candidate's authoring model select or influence its judge.

---

## H. Role-specific qualification corpora

## H1. Reader-experience corpus

Build a new reader-lane corpus from complete chapters.

Clean controls must be admitted through a role-specific audit, not a high total score.

A clean reader control must satisfy:

- current chapter schema;
- render integrity;
- technical completeness;
- no known reader-visible hard blocker;
- no known wrong quiz key;
- no unresolved internal contradiction;
- owner-approved reader-quality label;
- no dependence on external source truth for its expected result.

Source ambiguity may be included as an escalation-signal case, but not as proof of external fabrication.

Recommended minimum composition:

```text
12 complete clean controls
8 reader-visible hard blockers
10 non-blocking craft/learning weaknesses
```

Use at least 10 cases for each soft blocking percentage.

## H2. Source-integrity corpus

Build from evidence-complete, held-out source units.

Do not use books selected for the diagnostic or confirmatory candidate sets.

Every case must include:

- chapter unit;
- exact source-use-plan unit;
- source packet;
- sidecar;
- anchors;
- expected origin;
- expected form;
- expected claim strength;
- allowed and forbidden detail types;
- exact gold chapter and source spans;
- provenance hashes.

Required paired families:

```text
supported source-bound detail
unsupported invented detail

framed constructed application
unframed constructed application

clean generic operational scenario
generic scenario with invented historical specificity

correctly qualified correlation
causal overreach

valid attribution
unsupported attribution
```

Use enough cases that a soft 85% threshold does not become hidden 100%.

For high-severity fabrication, causal overreach, and source contradiction, zero misses remain mandatory.

## H3. Quiz-integrity corpus

Use deterministic paired fixtures.

Recommended minimum:

```text
10 uniquely correct clean items
10 key-mismatch items
10 genuinely ambiguous items
10 mechanism/causal-key items
```

Every ambiguity gold must survive an adversarial attempt to identify one uniquely best answer.

Do not include a borderline ambiguity as a qualification holdout.

---

## I. Gold governance

For every role:

- keep calibration and holdout sets separate;
- freeze definitions before live outputs;
- do not edit holdout gold after a live qualification begins;
- if a material instrument defect appears, terminate that experiment ID;
- fix offline and start a new experiment ID;
- never create an in-campaign v4/v5 treadmill;
- record `independentHumanRater:false` honestly when applicable;
- do not treat a model-generated audit as independent human evidence;
- do not infer source-clean status from an overall score.

A clean-base audit must explicitly cover the capability being qualified.

---

## J. Hermetic corpus construction

Remove all absolute user and temporary paths.

The builder must:

- accept input roots through typed CLI/config;
- use repository-relative or supplied mounted paths;
- fail when a required source or mutation specification is missing;
- never silently replace a missing variant set with `[]`;
- commit or package every mutation specification;
- hash every input, gold label, threshold, source artifact, and expected semantic field;
- emit an extraction/provenance manifest;
- reproduce byte-identical output from identical inputs;
- run in a clean temporary directory;
- not depend on a previous agent's scratchpad.

Remove the automatic `planSpec.format="scenario"` normalization.

Do not infer source origin during schema normalization.

If source semantics are absent, record:

```text
sourceSemanticsStatus: MISSING
```

and exclude the artifact from source-integrity clean gold.

---

## K. Close the old campaign

Create immutable closure artifacts:

```text
S16_LEGACY_CAMPAIGN_CLOSURE.md
S16_LEGACY_CAMPAIGN_CLOSURE.json
```

Required status:

```text
ARCHIVED_INCONCLUSIVE_REVIEW_INSTRUMENT_MISMATCH
```

Record:

- old experiment IDs;
- old seals;
- exact call ledger;
- Stage-Q history;
- Layer-N history;
- diagnostic calls = 0;
- confirmatory calls = 0;
- no authoring migration decision was produced;
- old artifacts remain immutable;
- old results remain development evidence;
- old campaign cannot resume.

Do not overwrite old status files.

---

## L. Static retrospective over preserved evidence

Without a model call, reprocess the preserved Layer-N v2 outputs under separated analytical views:

```text
reader-only signals
source-related signals
quiz-related signals
legacy ship-bit effects
```

Produce:

```text
LAYER_N_V2_SPLIT_LANE_RETROSPECTIVE.md
LAYER_N_V2_SPLIT_LANE_RETROSPECTIVE.json
```

For each case and judge, report:

- original result;
- reader composite;
- reader blockers excluding source-truth claims;
- source escalation signals;
- quiz result;
- legacy `ship84` effect;
- whether final failure depended on unavailable source evidence;
- whether the case gold was valid for the capability.

This retrospective is diagnostic only.

Do not use it to qualify a judge under the new contracts.

---

## M. New recovery experiment

Create a new experiment identity, not a revision of the old seal.

Suggested ID:

```text
s16-reviewer-recovery-v1
```

The new experiment must bind:

- split-lane contract versions;
- reader corpus hash;
- source corpus hash;
- quiz corpus hash;
- qualification thresholds;
- candidate judge profiles;
- role assignment policy;
- fixed primary and backup judges;
- source and quiz escalation rules;
- diagnostic and confirmatory candidate inputs;
- seeds;
- schedules;
- no-API execution policy;
- bounded retry policy;
- call ceiling;
- human adjudication pause;
- `IMP-13` dormancy.

Do not seal the full diagnostic until the role-qualified reviewer set exists.

---

## N. Recovery pilot

Prepare, but do not execute, a small blinded pilot before the full diagnostic.

Recommended structure:

```text
4 representative chapter strata:
- research-heavy
- abstract/conceptual
- example-heavy
- causal/quiz-sensitive

4 authoring configurations
1 sample per cell

16 candidate chapters total
```

Use:

- identical inputs;
- fixed qualified reader judge;
- fixed qualified source judge;
- fixed quiz policy;
- frozen audit subset;
- no repair during first-write comparison;
- blind candidate identities;
- preserved attempts;
- no output-informed extra calls.

Pilot stop conditions:

- any role-instrument defect;
- source evidence missing from a required case;
- differential judge assignment;
- stale hash;
- new ambiguous gold;
- unbounded or hidden retry;
- API route;
- material judge disagreement with no frozen adjudication path.

A clean pilot permits later authorization of the full diagnostic.

Do not run the pilot in this implementation package.

---

## Specific implementation instructions

1. Verify the current HEAD and worktree before editing.
2. Read the current campaign closure evidence and all preserved Layer-N outputs.
3. Produce a short baseline report confirming or correcting E-01 through E-10.
4. Freeze the old campaign as described in section K.
5. Define the new reader, source, quiz, aggregation, and qualification contracts.
6. Version schemas and freshness rules.
7. Implement the reader-experience prompt and parser.
8. Implement the source-integrity packet, prompt, parser, and deterministic prechecks.
9. Formalize the quiz-integrity result and gate.
10. Implement deterministic aggregation.
11. Add backward-compatible legacy review parsing without allowing legacy records to satisfy new freshness checks.
12. Replace rotating migration judge assignment with fixed role assignment.
13. Implement role-qualified judge registry and fail-closed checks.
14. Replace or retire monolithic Layer-N as a blocking gate.
15. Build hermetic role-specific corpus builders.
16. Remove the hidden `planSpec` source-semantic inference.
17. Add role-specific corpus validators and complete semantic hashing.
18. Generate the static Layer-N retrospective.
19. Build the new recovery experiment specification and seal-preparation tooling.
20. Build the no-model recovery-pilot dry run.
21. Run all local tests and type checks.
22. Produce a pre-live authorization packet.
23. Stop. Do not make a model call.

---

## Expected files or surfaces

Verify exact repository locations before editing.

Likely existing surfaces:

```text
src/review/readerReview.ts
src/review/renderReaderDoc.ts
src/review/quizAdjudication.ts
src/review/reviewerWorkspace.ts

src/orchestrator/authorReview.ts

src/contracts/sourceUsePlan.ts
src/compiler/sourceUsePlanCompiler.ts

src/critics/sourceRegister.ts
src/critics/sourceGrounding.ts

src/bakeoff/review.ts
src/bakeoff/migration/reviewRunner.ts
src/bakeoff/migration/qualification.ts
src/bakeoff/migration/nativeReviewTypes.ts
src/bakeoff/migration/nativeReviewQualification.ts
src/bakeoff/migration/nativeReviewRunner.ts
src/bakeoff/migration/nativeReviewSeal.ts
src/bakeoff/migration/experimentTypes.ts
src/bakeoff/migration/guards.ts
src/bakeoff/migration/seal.ts
```

Likely new surfaces:

```text
src/review/readerExperienceReview.ts
src/review/sourceIntegrityReview.ts
src/review/quizIntegrityReview.ts
src/review/aggregateChapterReview.ts

src/bakeoff/migration/judgeCapabilityQualification.ts
src/bakeoff/migration/reviewerRoleAssignment.ts
src/bakeoff/migration/recoveryExperiment.ts

state/migration-experiments/contracts/...
state/migration-experiments/s16-reviewer-recovery-v1/...
docs/v25/reports/...
```

Do not create parallel duplicate implementations when a clean versioned extension is possible.

---

## Tests to add or update

## Unit tests

Add tests proving:

1. Reader prompt cannot declare external fabrication.
2. Reader prompt can emit `origin_ambiguous_to_reader`.
3. Reader schema rejects source-truth blocker categories.
4. Source reviewer requires source-use-plan and source hashes.
5. Missing source evidence returns `INCONCLUSIVE`.
6. Supported source-bound detail passes.
7. Unsupported invented detail blocks.
8. Framed constructed application passes.
9. Unframed constructed application blocks.
10. Generic role scenario passes.
11. Generic historical specificity blocks.
12. Causal overreach blocks.
13. Reader ambiguity signal alone cannot become a source blocker.
14. Quiz key mismatch blocks.
15. Genuine quiz ambiguity blocks.
16. Correct unique quiz passes.
17. Aggregator never passes `INCONCLUSIVE`.
18. Aggregator blocks any high-severity source or quiz defect.
19. Aggregator owns final status.
20. Model recommendation cannot override the conductor.
21. Legacy `ship84` parses only through the legacy adapter.
22. Legacy record cannot satisfy new review freshness.
23. Fixed primary judge assignment is invariant across candidate cells.
24. Backup/audit selection is frozen and balanced.
25. A judge may qualify for one role and fail another.
26. One unqualified unused profile does not block the campaign.
27. A missing required primary or backup does block the campaign.
28. Soft metrics reject denominators below the minimum.
29. A threshold of 0.85 over four cases is refused as underpowered.
30. Corpus builder fails on missing mutation specification.
31. Corpus builder contains no absolute user or temp path.
32. Corpus build is byte-reproducible.
33. Source semantics are never inferred from `planSpec`.
34. Old campaign artifacts remain byte-unchanged.
35. No recovery artifact mutates canonical chapter state.

## Integration tests

Add tests for:

1. Complete reader lane over a full chapter.
2. Complete source lane over a source-bound case.
3. Complete source lane over constructed and generic cases.
4. Complete two-phase quiz lane.
5. Full aggregation across all three lanes.
6. Fixed-role review of all four candidate cells.
7. Balanced audit subset.
8. Stale source-use plan invalidation.
9. Changed chapter invalidates every lane result.
10. Changed prompt/schema invalidates qualification.
11. Changed role assignment invalidates the experiment seal.
12. Old campaign cannot resume.
13. New campaign cannot start before role qualification.
14. Pilot dry run makes zero model calls.
15. Every model-bearing route resolves to ChatGPT-authenticated `codex exec`.
16. No API provider or fallback is reachable.

## Regression tests

Preserve regressions for:

- Stage-Q v1/v2 schema and verdict-coordinate defects;
- Layer-N v1 stub-corpus defect;
- Layer-N v2 hard-blocker scoring defect;
- Layer-N v2 craft borderline;
- Layer-N v2 source-register divergence;
- quoted injection versus obeyed injection;
- wrong-key and two-valid-answer quizzes;
- high composite plus legacy `ship84:false`;
- hidden metadata attempting to rescue ambiguous prose;
- missing source packet;
- stale evidence after chapter change;
- judge rotation accidentally reintroduced.

## Negative and red-team tests

Attempt to:

- make reader lane claim an event never happened;
- pass a source claim with no source packet;
- use hidden `planSpec` as provenance;
- let a constructed example use a real company in an invented event;
- let a generic scenario invent a date or statistic;
- let source `INCONCLUSIVE` pass;
- let a model recommendation bypass the aggregator;
- route one candidate to a different primary judge;
- select a backup after seeing output;
- silently omit corpus variants;
- rebuild from a private temp path;
- alter old seals;
- use an API provider;
- add a content retry;
- add a book-specific exception.

Every attempt must fail closed.

---

## Verification procedure

The implementation agent must prove:

1. Current HEAD and baseline are recorded.
2. Old campaign is archived without modifying old evidence.
3. The monolithic source-blind/source-truth contradiction is removed.
4. Reader, source, and quiz contracts are distinct and versioned.
5. Source blockers can only originate from source-aware evidence.
6. Reader-visible origin ambiguity remains observable.
7. Final pass is conductor-owned.
8. `ship84` is not part of the new model-facing contract.
9. Role qualification works independently.
10. Fixed judge assignment is deterministic.
11. Corpora are hermetic and fully hashed.
12. Soft-class denominators meet the frozen minimum.
13. Full suite passes.
14. Type checking passes.
15. No live model call occurred.
16. No canonical book was generated or changed.
17. No production activation path was reached.
18. No API path is reachable.
19. A new recovery preflight and proposed call ceiling exist.
20. The implementation stops before qualification or pilot execution.

Run:

- targeted unit tests;
- migration integration tests;
- full repository test suite;
- TypeScript type check;
- contract validation;
- corpus reproducibility check;
- secret and absolute-path scan;
- no-model dry run;
- Git diff review.

Record exact commands and complete results.

---

## Rollback criteria

Stop and revert the affected work package if:

- any source blocker can still be emitted without source evidence;
- any missing source evidence can result in PASS;
- reader-visible origin ambiguity is lost;
- source or quiz gates are weakened;
- final status remains controlled by a model boolean;
- old evidence becomes unreadable or is rewritten;
- old campaign can accidentally resume;
- judge rotation remains;
- corpus generation remains non-hermetic;
- a qualification corpus requires a book-specific production branch;
- tests require synthetic shortcuts not present in production;
- an API or model call occurs;
- canonical chapter state changes;
- the full suite regresses.

---

## Red-team checklist

Before handoff, answer with evidence:

```text
[ ] Can a reader-only judge still call an external event fabricated?
[ ] Can hidden metadata rescue reader-facing ambiguity?
[ ] Can a source claim pass with no source packet?
[ ] Can a constructed example merge a real company with an invented event?
[ ] Can a generic scenario invent a date or statistic?
[ ] Can source INCONCLUSIVE become PASS?
[ ] Can a wrong quiz key pass?
[ ] Can a two-answer quiz pass?
[ ] Can model recommendation override the conductor?
[ ] Can legacy ship84 satisfy the new gate?
[ ] Can an unqualified unused model block the campaign?
[ ] Can different candidate cells receive different primary judges?
[ ] Can backup selection occur after output?
[ ] Can a four-case soft family masquerade as an 85% estimate?
[ ] Can a missing temp mutation file silently reduce the corpus?
[ ] Can absolute private paths affect the build?
[ ] Can old §16 seals be resumed?
[ ] Can recovery code invoke an API?
[ ] Can any implementation step publish, deploy, promote, or activate IMP-13?
```

Every answer must be `NO`, supported by file, test, or hash evidence.

---

## Deliverables

Provide:

```text
1. files changed
2. contracts added or versioned
3. behavior changed
4. old behavior preserved for replay only
5. old campaign closure artifacts
6. Layer-N split-lane retrospective
7. role-specific corpus manifests
8. role-specific qualification policy
9. fixed judge-assignment policy
10. new recovery experiment spec
11. recovery pilot spec
12. tests added or updated
13. commands run
14. full results
15. before/after evidence
16. risks
17. unresolved work
18. exact proposed live-call counts
19. exact proposed hard call ceiling
20. separate authorization still required
```

Also produce a machine-readable implementation report:

```json
{
  "promptId": "IMP-20",
  "baselineHash": "",
  "resultHash": "",
  "filesChanged": [],
  "contractsAdded": [],
  "requirementsImplemented": [],
  "testsRequired": [],
  "testsRun": [],
  "testResults": [],
  "oldCampaignStatus": "ARCHIVED_INCONCLUSIVE_REVIEW_INSTRUMENT_MISMATCH",
  "liveModelCallsMade": 0,
  "apiCallsMade": 0,
  "canonicalBooksChanged": 0,
  "gateWeakening": false,
  "bookSpecificExceptions": [],
  "productionActivation": false,
  "proposedQualificationCalls": null,
  "proposedPilotCalls": null,
  "proposedHardCeiling": null,
  "unresolvedRisks": [],
  "separateAuthorizationRequired": true
}
```

---

## Constraints

- No gate weakening.
- No book-specific hacks.
- No chapter-specific hacks.
- No silent fallback.
- No hidden source inference.
- No unbounded retries.
- No output-informed resampling.
- No API usage.
- No direct model SDK or HTTP call.
- No `codex exec` during this implementation package.
- No live qualification.
- No bakeoff execution.
- No generation or repair.
- No publish.
- No promotion.
- No deployment.
- No upload.
- No push unless separately authorized.
- No `IMP-13` activation.
- No claim that the migration works before live evidence.
- Preserve every historical failure and seal.
- Stop after the pre-live implementation and verification packet.
