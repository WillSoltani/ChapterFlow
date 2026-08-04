## Prompt `IMP-14`: `Balanced Reader-Learning Contract, Cumulative Journey Evidence, and Autonomy Safeguards`

### Role

You are a principal learning-architecture engineer, evaluation-system designer, TypeScript pipeline engineer, and migration-safety reviewer working on the ChapterFlow v24-to-GPT-5.6 SOL migration.

You are implementing one deliberately bounded supplement to the existing migration prompt pack. Your task is not to turn ChapterFlow into a complete rubric-scoring engine and not to add a large new writer prompt. Your task is to add a small amount of high-leverage learning-design structure that the current migration work does not fully cover.

### Context

The GPT-5.6 SOL migration is already being implemented through `IMP-00` to `IMP-13`. Those packages address execution isolation, state safety, model routing, source ontology, source-safe concreteness, writer-card simplification, scene diversity, transactional repair, blind review, validator migration, durable evidence, bakeoff design, regression fixtures, and controlled activation.

ChapterFlow already has useful reader-learning mechanisms, including:

- `ChapterBriefV1.coreMove`, `thesis`, `readerPromise`, and `adjacentJobs`;
- chapter quiz, practice, implementation, transfer, limits, and beginner-facing review factors;
- `ExperiencePlanV21.transferPrompt`, `failureRecovery`, and optional `readerPatterns`;
- deterministic pedagogy and variety plans;
- blinded chapter review and four-chapter book acceptance;
- a whole-book sweep focused primarily on cross-chapter templating and repeated machinery.

Do not duplicate those mechanisms.

The remaining high-value gaps are narrower:

1. There is no single, versioned, authoritative declaration of the intended reader, assumed prior knowledge, book purpose, intended capabilities, exclusions, and safety boundaries.
2. There is no compact book-wide map showing how each chapter contributes to one central mental model and what prior ideas it builds on.
3. Existing chapter-local quizzes and transfer checks do not guarantee deliberate cumulative revisiting or discrimination across chapter boundaries.
4. Reader safety already covers plainly unsafe advice, but coercive, dehumanizing, shame-based, or manipulative-certainty framing is not represented as a narrow, evidence-bound autonomy safeguard.
5. The current book-level sweep can detect templating without proving that the complete book forms a coherent learning journey.

The ChapterFlow Evidence, Learning, and Reader Experience Rubric v2.0 is the design reference for these gaps. It explicitly separates trustworthy explanation, manageable understanding, coherent mental models, active processing, durable retrieval, transfer, calibrated agency, engagement, and whole-book completion. It also separates content-design evidence from demonstrated reader outcomes.

This package must preserve that distinction. It may describe “retention support,” “transfer support,” or “calibration support.” It must not claim that readers will remember, transfer, change behavior, or complete the book without reader-outcome evidence.

### Evidence

Inspect and verify the current integrated repository rather than relying only on this prompt. Relevant evidence includes:

- `ChapterFlow_v2_Rubric_Standard(1).md`;
- `GPT56_SOL_MIGRATION_MASTER_PLAN_AND_PROMPT_PACK.md`;
- `src/artifacts/artifactTypes.ts` and artifact-store/versioning surfaces;
- `src/compiler/bookDesign.ts`;
- `src/compiler/chapterBrief.ts`;
- `src/compiler/chapterBlueprint.ts` where still active or relevant;
- `src/orchestrator/authorRun.ts`;
- `src/orchestrator/authorEvidence.ts`;
- `src/orchestrator/authorReview.ts`;
- `src/review/readerReview.ts`;
- `src/review/evalBookProxy.ts`;
- `src/critics/pedagogy.ts`;
- `src/critics/experiencePlan.ts`;
- `src/critics/bookGate.ts`;
- `src/critics/finalGate.ts`;
- `src/metrics/rubricMetrics.ts` and `src/metrics/bookRubricMetrics.ts`;
- `src/librarian/pedagogyPlan.ts`;
- `src/types.ts` and `src/runtimeSchemas.ts`;
- book-input, index, research-handoff, source-plan, brief, state, evidence, and production-manifest schemas;
- existing tests for briefs, pedagogy, experience plans, reader review, book acceptance, author evidence, book gate, final gate, artifact freshness, and production manifests;
- implementation reports and integrated interfaces from `IMP-03`, `IMP-05`, `IMP-06`, `IMP-08`, and `IMP-10`.

Verified baseline observations from the supplied v24 snapshot include:

- `ChapterBriefV1` already contains a chapter-local learning job through `coreMove` and a non-binding `readerPromise`.
- `adjacentJobs` prevents adjacent chapters from silently reteaching the same job, but it is not a complete book-level learning map.
- the existing reader-review factors already include retention, transfer, practical use, tone, limits, and beginner accessibility;
- `ExperiencePlanV21` already contains transfer and failure-recovery surfaces;
- the existing author-evidence sweep is designed primarily to detect cross-chapter template reuse;
- book acceptance reads a deterministic four-chapter sample, not every chapter as one cumulative learning sequence.

Treat these as surfaces to extend carefully, not reasons to create parallel competing systems.

### Inputs

Before changing code, inspect:

1. The exact integrated branch or tree that contains the completed migration packages available at implementation time.
2. All current artifact schemas and versioning rules.
3. The current book-input and research-handoff contract.
4. The current brief compiler and writer-card renderer after prompt-diet work.
5. The current isolated reviewer workspace and structured-output contracts after blind-review work.
6. The current attempt/evidence manifest and freshness rules after durable-evidence work.
7. Current tests and fixtures for pedagogy, learning components, experience plans, book acceptance, sweeps, and final readiness.
8. Any frozen bakeoff or activation manifest already in force.

If a required dependency is not integrated, do not reimplement it locally under a different interface. Report the dependency mismatch and either target the frozen contract or stop this package before creating a competing schema.

### Objective

Implement a versioned, hash-bound, rubric-lite learning-design layer with three capabilities:

1. **A declared reader-learning contract** for the whole book.
2. **A compact cumulative journey map** connecting chapter jobs to the book’s central mental model, prior knowledge, selective revisiting, and transfer.
3. **A narrow, evidence-bound autonomy and ethics safeguard** that detects concrete reader harm without turning subjective tone preferences into blockers.

Carry only the chapter-relevant subset into authoring. Add one book-level learning-journey audit after the book exists. Keep the full 36-subcriterion rubric outside the writer prompt and outside routine deterministic gating.

The implementation must be feature-versioned and support at least:

```text
off
shadow
required
```

`shadow` is the safe initial migration mode. `required` must exist and be testable, but this package must not activate it in production or alter a frozen bakeoff without separate authorization.

### Scope

Included:

- versioned book-learning contract and journey-map artifacts;
- schemas, parsers, validators, canonical serialization, hashes, provenance, and freshness;
- lifecycle integration at book-design or brief-compilation time;
- a compact chapter-level projection into briefs and writer cards;
- reconciliation with existing `coreMove`, `readerPromise`, `adjacentJobs`, pedagogy, and experience-plan fields;
- deterministic structural validation of the learning journey;
- one isolated, structured, book-level learning-journey review role;
- narrow autonomy/safety finding categories and adjudication rules;
- shadow/required policy modes;
- evidence retention and invalidation;
- focused unit, integration, regression, negative, and red-team tests;
- documentation and a machine-readable implementation report.

### Non-goals

Do not:

- implement the entire Rubric v2 scoring system inside the generation pipeline;
- add all 36 rubric subcriteria to the writer card, reviewer prompt, or deterministic gate;
- produce or claim a psychometrically validated Content Design Score;
- claim actual reader retention, transfer, behavior change, confidence calibration, completion, or satisfaction;
- require every chapter to contain a story, scene, exercise, prediction, retrieval question, far-transfer example, failure vignette, or autonomy statement;
- create a new repeated chapter template or named learning mold;
- duplicate source ontology, model routing, reviewer isolation, attempt evidence, or transactional repair contracts owned by other migration packages;
- weaken or replace existing source, factuality, quiz, causal, schema, state, acceptance, or release blockers;
- change existing review score thresholds or retry budgets;
- turn ordinary directness, accountability, urgency, criticism, or discussion of harmful conduct into an ethics violation;
- add book-specific or chapter-specific hard-coded logic;
- activate a new production gate or modify a frozen bakeoff profile as part of this package;
- generate, repair, publish, promote, deploy, upload, commit, or push a book.

### Specific implementation instructions

1. **Establish the integration baseline and freeze interfaces.**
   - Record the exact base tree or commit when available.
   - Verify the current schema and report interfaces from `IMP-03`, `IMP-05`, `IMP-06`, `IMP-08`, and `IMP-10`.
   - If the current bakeoff or canary fingerprint is frozen, mark this package as a new pipeline-profile version. Do not insert it into an already-running or already-frozen experiment.
   - Add requirement IDs for every behavior in this prompt and map them to code and tests.

2. **Define a compact `BookLearningContractV1`.**
   - Use existing artifact conventions, canonical JSON, schema versioning, and content hashes.
   - The exact names may differ after repository inspection, but the contract must represent at least:

```ts
type BookLearningContractV1 = {
  schemaVersion: "book-learning-contract-v1";
  bookId: string;
  intendedReader: string;
  assumedPriorKnowledge: string[];
  purpose: string;
  intendedOutcomes: Array<{
    id: string;
    statement: string;
    capability: "explain" | "distinguish" | "diagnose" | "apply" | "adapt" | "integrate";
  }>;
  relevantContexts: string[];
  materialExclusions: string[];
  centralModel: {
    statement: string;
    componentIds: string[];
  };
  components: Array<{
    id: string;
    label: string;
    roleInModel: string;
    boundaryOrMisuseRisk?: string;
  }>;
  safetyBoundaries: string[];
  provenance: {
    status: "declared" | "model-drafted" | "validated";
    inputHash: string;
    sourcePlanHash?: string;
    createdBy: string;
  };
};
```

   - Do not copy this type blindly if an existing schema can represent part of it. Extend or reference existing artifacts rather than creating semantic twins.
   - Stable IDs must be unique and machine-validated.
   - Blank, generic placeholder language such as “general reader,” “learn the topic,” or “various contexts” must not satisfy `required` mode.
   - The contract must not invent source claims. If the central model or a component states a material factual or causal proposition, bind it to the integrated source-plan/evidence contract rather than duplicating unsupported prose.
   - The writer, repairer, and reviewer must not be allowed to silently change this contract.

3. **Define a `BookLearningJourneyV1` that maps chapters to the contract.**
   - The exact shape may differ, but it must represent at least:

```ts
type BookLearningJourneyV1 = {
  schemaVersion: "book-learning-journey-v1";
  bookId: string;
  contractHash: string;
  sourcePlanHash?: string;
  chapters: Array<{
    chapterId: string;
    chapterNumber: number;
    contribution: {
      kind: "introduce" | "deepen" | "distinguish" | "diagnose" | "apply" | "integrate";
      statement: string;
      outcomeIds: string[];
      componentIds: string[];
    };
    prerequisiteComponentIds: string[];
    revisits: Array<{
      componentId: string;
      mode: "recall" | "discriminate" | "explain" | "apply";
    }>;
    transfer?: {
      outcomeId: string;
      mode: "near" | "far" | "boundary";
      context: string;
    };
  }>;
  exemptions: Array<{
    outcomeId: string;
    reason: string;
  }>;
};
```

   - Do not require every contribution kind, revisit mode, or transfer mode to appear.
   - Do not impose a combinatorial rotation or per-chapter quota. This is a learning dependency map, not another variety dealer.
   - Validate references, chronology, and completeness:
     - every chapter maps to exactly one primary contribution;
     - every referenced outcome/component exists;
     - prerequisites and revisits cannot depend on a concept that has not yet been introduced, unless an explicit prior-knowledge declaration covers it;
     - each intended outcome is introduced and later reinforced, applied, integrated, or explicitly exempted with a concrete reason;
     - no chapter contribution may be an empty paraphrase of the book purpose;
     - structurally identical contribution statements across many chapters produce an advisory for semantic review, not a brittle lexical blocker.
   - Reuse current chapter numbers and canonical chapter identities. Never create a second chapter-order authority.

4. **Create and validate the artifacts at the correct lifecycle point.**
   - Prefer the existing book-design or brief-compilation stage. Do not add a new top-level conductor phase unless the current architecture cannot provide correct freshness or boundedness.
   - The contract may come from explicit book input, a structured planning step, or a controlled combination. Verify the repository’s intended input model before deciding.
   - If model assistance is used, route it through the centralized model policy and hermetic execution envelope. Require schema-constrained output. Mark it `model-drafted` until independently validated.
   - `required` mode may accept only `declared` or independently `validated` artifacts according to a documented policy. It must not silently promote a model draft.
   - In `shadow` mode, missing or weak artifacts produce visible findings and evidence but must not break existing book generation.
   - No silent generic defaults.

5. **Reconcile with existing learning fields instead of duplicating them.**
   - `ChapterBriefV1.coreMove` should align with the chapter contribution, not compete with it.
   - `readerPromise` should be derived from or checked against the declared outcome and chapter contribution.
   - `adjacentJobs` should be generated from the journey map where practical, preserving backwards compatibility.
   - Existing `ExperiencePlanV21.transferPrompt`, `failureRecovery`, and `readerPatterns` remain the reader-facing mechanisms. Use the journey map to guide them only when relevant.
   - Existing quiz transfer ratio, practical checks, limits checks, and beginner checks remain authoritative for their current purposes.
   - If a current field already has the same semantics, migrate or reference it. Do not introduce two sources of truth.

6. **Project only a bounded chapter-relevant block into authoring.**
   - The writer must not receive the full Rubric v2 or the full book contract.
   - Add one compact, precedence-safe block containing only what this chapter needs, for example:

```text
INTENDED READER: <one concise line>
CHAPTER JOB: <one concise line>
BUILDS ON: <zero to two prior components>
REVISIT OR TRANSFER GOAL: <only when assigned>
RELEVANT BOUNDARY: <only when materially applicable>
```

   - Keep the rendered block under a documented character/line budget.
   - Treat the contract and journey as untrusted data under the common artifact wrapper.
   - State the outcome, not a mandatory prose recipe. A revisit may be achieved through a contrast, callback, application, explanation, quiz, practice item, or another natural method. Do not require a separate “retrieval section.”
   - Do not add a new global scene, hook, example, or exercise formula.
   - Snapshot-test the writer-card size and prove this package does not restore prompt accretion removed by `IMP-05`.

7. **Add deterministic journey validation without pretending to judge prose quality lexically.**
   - Deterministically validate schema, IDs, hashes, chapter coverage, valid references, chronology, declared exemptions, and freshness.
   - Do not make lexical similarity, keyword presence, or exact phrase matching a proxy for mental-model coherence, transfer, or autonomy.
   - Semantic questions belong to the isolated book-level audit described below.
   - Existing true blockers remain blockers. New learning-quality findings are shadow/advisory until specifically qualified, except for already-existing unsafe-content rules.

8. **Add one isolated `learning-journey` book-level audit role.**
   - Run it at the existing author-evidence/book-sweep stage or another evidence-backed point after all committed chapters are available.
   - Keep it separate from the template-reuse sweep. Do not overload the current sweep’s mission.
   - Use the reviewer-isolation framework from `IMP-08` and the evidence lineage from `IMP-10`.
   - The reviewer receives only:
     - the validated book-learning contract;
     - the validated journey map;
     - the complete reader-facing book or complete set of committed reader documents;
     - a small structured review card;
     - no model identity, author card, source packet, prior verdict, repair history, or acceptance result.
   - Assess only these four families:

```text
A. Reader and purpose fit
B. Central model, chapter contribution, and sequence
C. Cumulative revisiting, discrimination, and transfer support
D. Autonomy, safety boundaries, and calibrated claims
```

   - Do not ask this role to score all nine rubric domains or all 36 subcriteria.
   - Do not ask for a 0–100 score.
   - Require schema-constrained findings with exact quotes, chapter IDs, contract/journey IDs, severity, confidence, and a concrete expected correction.
   - Require at least one whole-book observation for any non-pass verdict. A chapter-local preference alone cannot fail a whole-book journey audit.
   - Use outcome-safe language. The audit may say the book “provides cumulative retrieval support,” not that readers “will remember.”

9. **Implement narrow autonomy and ethics categories with strict false-positive controls.**
   - Recognize only concrete categories such as:

```text
unsafe_action_without_needed_boundary
coercive_or_dehumanizing_conduct
shame_as_the_primary_motivator
manipulative_certainty_or_guaranteed_outcome
```

   - A blocking finding must contain:
     - an exact reader-facing quote;
     - the affected chapter/unit;
     - the category;
     - the concrete reader-harm mechanism;
     - the missing boundary or required correction;
     - confidence and evidence provenance.
   - Discussion, quotation, or criticism of harmful conduct is not endorsement.
   - Directness, accountability, urgency, challenge, or uncomfortable truth is not automatically shame or coercion.
   - Vague “tone feels harsh” or “could be more empathetic” findings are advisory at most.
   - A new autonomy category must not become a production blocker from one unqualified model vote. Require either:
     - deterministic confirmation under an existing safety rule; or
     - agreement from two independent, fresh, technically isolated reviewers under a frozen rubric.
   - Preserve the current `UNSAFE` must-fix category. Do not narrow it.
   - Route upheld findings through the existing typed repair system with minimal scope and full invariant revalidation.

10. **Use a controlled rollout policy.**
    - Implement `off`, `shadow`, and `required` modes under one versioned policy.
    - Default this new package to `shadow` in the migration branch unless an already-approved integration decision says otherwise.
    - In `shadow`, persist all artifacts and findings but do not alter existing pass/fail decisions.
    - In `required`, missing/stale/invalid contracts or journey maps block qualification; qualified autonomy blockers may block release under the independent-confirmation rule.
    - Do not activate `required` in production here.
    - The gold-corpus and later production-readiness process may explicitly require this profile after tests and calibration.
    - Any mode, schema, audit-card, reviewer, or threshold change must alter the pipeline fingerprint and invalidate stale evidence.

11. **Bind all evidence to exact inputs and preserve bounded cost.**
    - Hash the contract, journey, complete reader document set, audit card, output schema, reviewer execution profile, and final audit response.
    - Invalidate the audit after any committed chapter-byte change, contract change, journey change, reviewer-card/schema change, or execution-profile change.
    - Cache only by the complete compatible hash set.
    - Permit at most one normal learning-journey audit per committed book hash plus the existing bounded invalid-output retry policy. No replay-until-pass.
    - Avoid adding a new per-chapter model call. Prefer deterministic compilation plus one book-level semantic audit.

12. **Preserve backward compatibility explicitly.**
    - Legacy books without these artifacts must remain readable and inspectable.
    - In `off`, behavior is byte-compatible where feasible.
    - In `shadow`, missing artifacts produce explicit shadow findings, not fabricated defaults.
    - In `required`, absence is a clear prerequisite failure.
    - Provide a dry-run or migration command that can emit a draft contract/journey without modifying canonical chapters or production state.
    - Never mark a legacy inferred artifact as validated without evidence.

13. **Keep the full rubric external to generation.**
    - The full ChapterFlow Rubric v2 remains appropriate for gold-corpus evaluation, editorial audit, and publication decisions.
    - This package implements only the selected high-leverage contract and audit surfaces.
    - Do not add a weighted Content Design Score to routine authoring or use one composite score to erase a hard safety/factuality defect.
    - Keep reader-outcome evaluation separate from content-design evidence in all reports and types.

### Expected files or surfaces

Likely files or surfaces include, but are not limited to:

- `src/artifacts/artifactTypes.ts`;
- `src/artifacts/artifactStore.ts`;
- new learning-contract/journey compiler and validator modules under the existing compiler or design namespace;
- `src/compiler/bookDesign.ts`;
- `src/compiler/chapterBrief.ts`;
- `src/orchestrator/authorRun.ts`;
- `src/orchestrator/authorEvidence.ts`;
- isolated reviewer workspace and schema surfaces introduced by `IMP-08`;
- evidence manifests/freshness surfaces introduced by `IMP-10`;
- `src/critics/pedagogy.ts`;
- `src/critics/experiencePlan.ts`;
- `src/critics/bookGate.ts` and `src/critics/finalGate.ts` only where mode-aware evidence prerequisites belong;
- `src/types.ts` and `src/runtimeSchemas.ts`;
- pipeline fingerprint/production-manifest code;
- CLI or dry-run inspection command;
- focused tests and fixture factories;
- documentation for artifact ownership, modes, evidence, and activation.

Verify exact locations. Do not force all logic into these files if the integrated architecture has moved responsibility elsewhere.

### Tests to add or update

Add or update all applicable tests below.

#### Unit tests

- Contract schema, canonical serialization, stable IDs, hash, and version tests.
- Journey schema, valid reference, chapter identity, chronology, and exemption tests.
- Tests rejecting blank/generic placeholders in `required` mode.
- Tests proving the writer/repairer cannot mutate the contract or journey.
- Projection tests proving the author block is bounded, chapter-specific, precedence-safe, and does not contain the full rubric.
- Compatibility tests for `coreMove`, `readerPromise`, `adjacentJobs`, transfer prompts, and experience-plan fields.
- Mode tests for `off`, `shadow`, and `required`.
- Pipeline-fingerprint and freshness tests.

#### Integration tests

- Book input/design → contract → journey → chapter brief → writer-card projection.
- Complete committed book → isolated learning-journey audit → hash-bound evidence.
- Chapter change after audit invalidates the audit.
- Contract or journey change invalidates briefs, projections, and audit evidence as appropriate.
- Required mode blocks missing/stale prerequisites without changing existing source/quiz/acceptance thresholds.
- Shadow mode records findings without affecting existing verdicts.
- No additional per-chapter model call is introduced.

#### Regression fixtures

Create generic fixtures for:

1. a coherent cumulative book;
2. a book whose chapters are individually good but teach the same job repeatedly;
3. a book with an undeclared prerequisite introduced too late;
4. an intended outcome introduced once and never reinforced or applied;
5. a valid sparse book where not every chapter contains retrieval or transfer work;
6. a book with near transfer but no justified far-transfer requirement;
7. a book with a clear boundary case and honest “when not to use this” guidance;
8. a book that quotes coercive behavior in order to criticize it;
9. a book that directly promotes shame or coercion as the main method;
10. a book that guarantees outcomes beyond the support presented;
11. a plain, direct, accountability-focused passage that must not be falsely flagged;
12. a model-drafted contract that cannot silently become validated.

#### Negative and failure-path tests

- Invalid or cyclic component dependencies.
- Forward revisit to an unintroduced concept.
- Missing chapter mapping.
- Unknown outcome/component IDs.
- Duplicate stable IDs.
- Generic placeholder contract fields.
- Full rubric text accidentally rendered into every writer card.
- Learning contract containing prompt-injection or control-plane instructions.
- Reviewer finding with a non-verbatim quote.
- Reviewer finding without a concrete harm mechanism.
- Single-reviewer autonomy accusation attempting to block release.
- Stale audit carried after chapter, contract, journey, rubric, schema, or execution-profile change.
- Unparseable reviewer output under the bounded retry policy.
- Legacy book behavior in all three modes.

#### Red-team cases

- Every chapter receives the same “recall the previous chapter” ritual.
- The journey map becomes another deterministic chapter-shape dealer.
- The contract says “non-expert,” while chapters assume unexplained specialist knowledge.
- The central model is merely the book title restated.
- A transfer assignment asks for a context unsupported by the source plan.
- A repair fixes an autonomy complaint by weakening a factual or causal claim incorrectly.
- An autonomy auditor flags the description of harmful conduct rather than its endorsement.
- A reviewer claims “readers will remember” without reader data.
- A worker changes existing acceptance thresholds to make the new audit pass.
- A frozen bakeoff profile silently incorporates this package midway through the experiment.

### Verification procedure

1. Record the exact baseline identity and dependency versions.
2. Produce a requirement-to-code-to-test traceability table.
3. Show the final contract and journey schemas and one valid generic fixture of each.
4. Show a before/after writer-card excerpt and exact character/token delta attributable to this package.
5. Prove the full Rubric v2 is not embedded in the writer card.
6. Prove no new per-chapter model call was added.
7. Prove the learning-journey reviewer sees only the authorized book, contract, journey, and review card.
8. Run focused unit, integration, negative, and red-team tests.
9. Run the full hermetic regression suite required by the integrated migration branch.
10. Verify all existing source, quiz, causal, acceptance, state, reviewer-independence, and release thresholds are unchanged.
11. Demonstrate shadow mode on fixtures and show that existing verdicts remain unchanged.
12. Demonstrate required mode on fixtures only and show clear prerequisite failure for missing/stale artifacts.
13. Demonstrate independent confirmation for a true autonomy blocker and non-blocking treatment for a false-positive control.
14. Verify a chapter-byte change stales all dependent learning-journey evidence.
15. Inspect every diff for unrelated prompt, gate, retry, publishing, or deployment changes.
16. Do not use a live generated book as proof unless separately authorized. Static fixtures and tests are sufficient for this implementation package.

### Rollback criteria

Stop, revert, or leave the package unmerged if any of the following occurs:

- the full rubric or a large rule list is added to every writer card;
- writer-card growth materially reverses the prompt-diet work;
- the journey map introduces a repeated chapter mold or mandatory ritual;
- existing source, factuality, quiz, causal, schema, state, review, acceptance, or release blockers are weakened;
- a single unqualified model reviewer can create a new autonomy blocker;
- ordinary directness or critical discussion is repeatedly misclassified as coercion or shame;
- the contract or journey can be modified by the writer or repair agent;
- missing artifacts silently receive generic defaults;
- required-mode evidence can remain fresh after chapter, contract, journey, schema, rubric, or execution-profile changes;
- the package adds unbounded retries or replay-until-pass;
- the package changes a frozen bakeoff/canary profile without explicit requalification;
- the implementation creates a competing source of truth for existing learning fields;
- the package claims actual reader outcomes from design evidence;
- broad unrelated changes are required to make the tests pass.

### Red-team checklist

- Can hostile text inside the contract or journey alter model, tools, paths, permissions, retries, output protocol, or gates?
- Can the writer reinterpret or overwrite the intended reader, purpose, central model, or safety boundary?
- Does every chapter get forced into the same callback, prediction, or retrieval shape?
- Can a concept be revisited before it is introduced?
- Can a model-drafted contract become “validated” without an independent step?
- Can an unsupported transfer context enter the chapter as if source-backed?
- Can a quoted harmful statement trigger a blocker even when the chapter rejects it?
- Can a direct accountability statement be mislabeled as shame?
- Can one reviewer’s subjective preference block release?
- Can a late chapter edit leave the journey audit apparently fresh?
- Can legacy books silently receive made-up reader or purpose declarations?
- Does the writer card contain rubric prose, scoring anchors, or dozens of new instructions?
- Does any report say readers learned, remembered, transferred, or changed behavior without outcome data?
- Does this package alter the existing bakeoff, acceptance, or activation profile without a new fingerprint?

### Deliverables

Provide:

1. Exact baseline tree/commit identity and dependency assumptions.
2. Files changed, added, and deleted.
3. Final contract and journey schemas with versioning and ownership rules.
4. Artifact lifecycle and data-flow diagram.
5. `off`/`shadow`/`required` behavior matrix.
6. Compact writer projection and before/after prompt-size evidence.
7. Learning-journey audit role, authorized-input manifest, output schema, and adjudication policy.
8. Autonomy/safety category definitions and independent-confirmation rule.
9. Freshness and invalidation matrix.
10. Backward-compatibility and migration behavior.
11. Tests required, exact tests run, unedited results, and fixture inventory.
12. Evidence that existing gates, thresholds, retry caps, acceptance predicates, and release requirements were not changed.
13. Risks, unresolved questions, and recommended activation prerequisites.
14. Explicit statement of all actions not performed, including book generation, publishing, deployment, upload, commit, and push.

Emit both:

- a narrative implementation report; and
- `implementation-report.imp-14.json` conforming to the frozen worker-report schema used by the migration program.

The JSON must explicitly include baseline/result hashes, files changed, requirement IDs implemented, tests required/run/results, gate changes, book-specific exceptions, unexpected writes, unresolved risks, dependency assumptions, prompt-size delta, mode default, and whether any bakeoff or activation fingerprint changed. Empty and adverse fields must be explicit. The JSON and narrative report must agree.

### Constraints

- No gate weakening.
- No book-specific or chapter-specific hacks.
- No silent fallback or silent generic defaults.
- No unbounded retries or replay-until-pass.
- No full Rubric v2 dump into writer prompts.
- No claim of actual reader outcomes without reader-outcome evidence.
- No new production blocker without explicit qualification and independent confirmation.
- No permanent routing back to GPT-5.5.
- No model-routing changes outside the centralized policy.
- No direct agent writes outside the least-authority contracts established by the migration.
- No publish, promote, deploy, upload to S3, package mutation, production activation, commit, or push unless separately authorized.
- No use of production state as a test fixture.
- No modification of a frozen bakeoff or canary profile without a new fingerprint and requalification decision.
- Preserve backward compatibility or provide an explicit, tested migration path.
