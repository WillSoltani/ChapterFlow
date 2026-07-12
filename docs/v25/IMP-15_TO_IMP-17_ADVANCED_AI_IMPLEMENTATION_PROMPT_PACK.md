# ChapterFlow Advanced AI Implementation Prompt Pack

**Packages:** `IMP-15`, `IMP-16`, and `IMP-17`  
**Purpose:** Add safe continuous-improvement evidence, metamorphic regression testing, and shadow risk-adaptive routing to the SOL-native ChapterFlow pipeline.  
**Initial operating posture:** Evidence-generating and shadow-only. No autonomous prompt/code mutation and no active dynamic routing.

## Recommended implementation order

```text
Integrated migration checkpoint
        ↓
IMP-15 — Failure memory and governed improvement loop
        ↓
IMP-16 — Metamorphic regression and failure-to-eval mining
        ↓
IMP-17 — Shadow risk-adaptive routing and calibration
        ↓
Independent integration verification
        ↓
Separate decision on any later activation
```

`IMP-16` may begin its generic framework after the `IMP-15` export contract is frozen, but its failure-mining bridge should wait for the integrated `IMP-15` schema. `IMP-17` should consume the final `IMP-15` approved historical-feature interface and the centralized routing/evidence contracts. Do not let any package create duplicate evidence stores, test roots, model routers, or worker-report schemas.

## Shared integration rules

1. Treat the current integrated repository, not the original v24 paths, as authoritative.
2. Verify every dependency and frozen schema before editing.
3. Use immutable content hashes and explicit schema versions.
4. Keep production gates, routes, retries, acceptance, publication, and deployment unchanged.
5. Use hermetic fixtures and fake/replay providers for normal CI.
6. Do not modify a frozen bakeoff or canary in place.
7. Every package must emit both a narrative report and the required machine-readable worker report.
8. After all three packages are integrated, run a separate integration audit before considering active routing or automated escalation.

---

## Prompt `IMP-15`: `Trace-Grounded Failure Memory and Evidence-Governed Improvement Loop`

### Role

You are a principal AI reliability architect, incident-learning engineer, evaluation-governance designer, TypeScript pipeline engineer, and migration-safety reviewer working on ChapterFlow.

You are implementing a durable learning layer above the existing ChapterFlow execution, evidence, review, repair, and acceptance systems. Your task is to make confirmed failures reusable as structured institutional memory without allowing the pipeline to rewrite, weaken, or deploy its own prompts, code, routing policy, validators, or gates.

### Context

The SOL-native migration already includes or is expected to include:

- hermetic execution and effective-context provenance from `IMP-00`;
- conductor-owned candidate output and atomic commit from `IMP-01`;
- centralized model and provider routing from `IMP-02`;
- compiler-owned source semantics from `IMP-03`;
- typed repair and invariant preservation from `IMP-07`;
- technically isolated review from `IMP-08`;
- durable attempt, review, repair, and state-transition evidence from `IMP-10`;
- generic hermetic fixtures and frozen contracts from `IMP-12`.

Those packages make attempts reconstructable. They do not, by themselves, create an explicit memory of recurring failure classes, distinguish observed symptoms from confirmed root causes, identify novel failures, link each confirmed defect to regression protection, or govern how lessons become proposed pipeline changes.

The original v24 snapshot also contains a chapter risk score, evidence maps, critic findings, review artifacts, session ledgers, and campaign reports. Those are useful inputs, but they are not a governed failure-memory system. In particular:

- a critic complaint is not automatically a root-cause diagnosis;
- a repair that eventually passes does not prove the repair addressed the original cause;
- repeated wording similarity does not prove two failures are the same;
- a model-generated diagnosis is evidence to inspect, not a fact to accept;
- a historical report is secondary evidence unless its underlying artifacts are available;
- a lesson should normally become a durable test or contract, not another permanent warning in the writer prompt.

Implement the safe form of a self-learning loop:

```text
Observed failure
→ immutable evidence linkage
→ structured triage
→ confirmed or disputed diagnosis
→ recurrence and novelty analysis
→ regression-protection candidate
→ controlled change proposal
→ shadow replay and evaluation
→ separately authorized promotion
```

Do not implement this unsafe form:

```text
Observed failure
→ model edits a prompt or rule
→ model deploys the change
```

### Evidence

Inspect and verify the current integrated repository rather than relying only on this prompt. Relevant evidence includes:

- `GPT56_SOL_MIGRATION_MASTER_PLAN_AND_PROMPT_PACK.md`;
- implementation reports and frozen contracts from `IMP-00`, `IMP-01`, `IMP-02`, `IMP-03`, `IMP-07`, `IMP-08`, `IMP-10`, and `IMP-12`;
- the current attempt/evidence manifest, content-addressed object store, lineage index, and state journal;
- current critic, reviewer, tiebreak, repair, regeneration, acceptance, and final-gate outputs;
- current model-route and effective-execution fingerprints;
- `src/orchestrator/authorEvidence.ts` or its integrated successor;
- `src/orchestrator/sessionLedger.ts` or its integrated successor;
- `src/evidence/evidenceMap.ts` or its integrated successor;
- `src/risk/chapterRisk.ts` and its persisted risk artifacts;
- `src/critics/**`, `src/review/**`, `src/orchestrator/authorRepair.ts`, and `src/orchestrator/authorReview.ts` or their migrated equivalents;
- current bakeoff, canary, gold-corpus, cross-book, and incident-report artifacts;
- `V24_CF_J_COMMIT_AND_MODEL_MIGRATION_REPORT.md`, `V24_FRESH_SCENE_ORIGIN_GOLD_RUN_REPORT.md`, and any available raw failure files, while treating reports as evidence rather than guaranteed truth;
- current test roots, fixture factories, worker-report schema, package exclusions, retention policy, and privacy/redaction rules.

Verified baseline observations from the supplied v24 snapshot include:

- `src/risk/chapterRisk.ts` computes a small rule-based score from source quality, evidence-map findings, and a rubric preflight result;
- the risk artifact contains `low`, `medium`, and `high` lanes and can recommend `qc-shadow`, but it is not a historical failure memory;
- evidence and reviewer outputs are distributed across several artifacts;
- the deleted `range` campaign left reports without the complete raw attempt lineage;
- the master plan intentionally puts immutable attempt reconstruction in `IMP-10`, so this package must reference that evidence rather than create a second competing evidence store.

### Inputs

Before changing code, inspect:

1. The exact integrated tree or commit and repository status. If Git metadata is absent, use stable tree/content hashes and state that commit-level verification is unavailable.
2. The Phase-0 frozen contract manifest and the exact current versions of:
   - execution-profile manifests;
   - route results;
   - attempt/evidence manifests;
   - source-use plans;
   - repair findings and patches;
   - review outputs;
   - candidate transactions and commit manifests;
   - worker implementation reports.
3. The current evidence query/index API from `IMP-10`.
4. Existing failure, incident, finding, critic, review, and repair taxonomies.
5. Existing retention, cleanup, redaction, package-exclusion, and artifact-freshness behavior.
6. Current hermetic test roots and generic fixture factories from `IMP-12`.
7. Any active or frozen bakeoff, canary, or production-readiness fingerprint.

If an expected dependency is missing or incompatible, do not create a local substitute with overlapping semantics. Report the contract gap and stop before producing a competing source of truth.

### Objective

Implement a versioned, append-only, evidence-bound failure-memory and improvement-governance system that:

1. converts immutable run evidence into structured failure observations;
2. keeps observed defect, root cause, contributing condition, and downstream symptom distinct;
3. permits machine-assisted diagnosis while clearly separating proposal from confirmation;
4. groups genuinely similar failures without destructively merging them;
5. identifies potentially novel high-value failures for human review;
6. links confirmed failures to durable regression protection or an explicit reason protection is not yet possible;
7. creates controlled improvement candidates without modifying production behavior automatically;
8. measures recurrence, diagnostic latency, and protection coverage over time;
9. exposes a stable, bounded interface to `IMP-16` metamorphic testing and `IMP-17` shadow risk routing;
10. remains advisory and non-gating until a separate authorization explicitly changes that policy.

The initial operating mode must be `shadow`. In shadow mode, this package may create evidence and reports, but it must not alter authoring, repair, review, acceptance, routing, promotion, publication, or deployment decisions.

### Scope

Included:

- versioned failure-observation, failure-case, diagnosis, cluster, regression-link, and improvement-candidate schemas;
- append-only status transitions and decision provenance;
- deterministic ingestion from `IMP-10` attempt evidence;
- evidence-bound machine-assisted diagnosis proposals;
- human/operator confirmation and dispute workflow;
- structured similarity, clustering, recurrence, and novelty analysis;
- genericization and anti-hard-code checks;
- links to approved tests and metamorphic cases;
- improvement-candidate lifecycle and controlled experiment prerequisites;
- query/report/CLI or equivalent inspection surfaces;
- bounded retention and redaction integration;
- shadow telemetry and summary metrics;
- unit, integration, regression, negative, and red-team tests;
- narrative and machine-readable implementation reports.

### Non-goals

Do not:

- duplicate the raw attempt/evidence object store created by `IMP-10`;
- store hidden chain of thought;
- infer missing raw failure artifacts from summary reports and mark the inference as confirmed;
- let a critic, reviewer, repairer, or model-generated diagnosis automatically become the official root cause;
- let the system edit or activate prompts, model policies, validators, thresholds, gates, retry budgets, source plans, or production code;
- create a self-modifying or self-deploying agent loop;
- make cluster membership a publication or acceptance decision;
- treat semantic similarity as proof of identical cause;
- permanently encode a book title, chapter number, author name, `range`, or other campaign-specific token in production logic;
- add unbounded model calls, retries, evidence retention, or background polling;
- introduce a network requirement into unit CI;
- change an already-frozen bakeoff or canary profile;
- claim that fewer recurring failures or better reader outcomes have been achieved without a later controlled evaluation;
- publish, promote, deploy, upload, commit, or push unless separately authorized.

### Specific implementation instructions

1. **Establish the baseline and requirement traceability.**
   - Record the exact base tree/commit and all consumed contract versions.
   - Create stable requirement IDs `FM-001` through `FM-030` or an equivalent complete mapping.
   - Map every requirement to its implementation surface and test before editing production code.
   - Confirm that `IMP-10` remains the authoritative source of raw attempt evidence.

2. **Define the failure-memory vocabulary and ownership rules.**
   - Use distinct concepts for:
     - `observation`: something directly visible in evidence;
     - `defect`: the reader-facing, operational, or evaluation problem observed;
     - `root cause`: the mechanism that produced the defect;
     - `contributing condition`: a condition that increased likelihood or severity;
     - `downstream symptom`: a later effect caused by the original defect;
     - `diagnosis proposal`: an evidence-bound but unconfirmed explanation;
     - `confirmed diagnosis`: a decision made under the confirmation policy;
     - `regression protection`: a named test, invariant, or monitored control linked to the case;
     - `improvement candidate`: a proposed change that has not been promoted.
   - Never collapse these concepts into one free-form string.

3. **Define a versioned `FailureObservationV1`.**
   - Reuse current artifact conventions, canonical JSON, stable IDs, and content hashes.
   - The exact type names may differ, but the schema must represent at least:

```ts
type FailureObservationV1 = {
  schemaVersion: "failure-observation-v1";
  observationId: string;
  attemptId: string;
  parentAttemptId?: string;
  bookId: string;
  chapterId?: string;
  taskClass: string;
  observedStage: string;
  observedAt: string;
  evidenceManifestHash: string;
  assessedArtifactRefs: Array<{
    artifactId: string;
    sha256: string;
    role: string;
  }>;
  defects: Array<{
    defectClass: string;
    severity: "P0" | "P1" | "P2" | "P3" | "P4";
    unitRefs: string[];
    evidenceRefs: string[];
    source: "deterministic" | "reviewer" | "human" | "provider" | "state-machine";
    confidence?: number;
  }>;
  routeFingerprint: string;
  promptStackFingerprint: string;
  sourcePlanHash?: string;
  providerOutcome: string;
  ingestionVersion: string;
};
```

   - Do not copy this shape blindly if the integrated contracts already provide equivalent fields. Reference existing identifiers rather than duplicating bytes.
   - Ingestion must be idempotent. The same immutable attempt evidence cannot create duplicate observations.
   - A missing field must be recorded as unavailable, not fabricated.

4. **Define a governed `FailureCaseV1`.**
   - A case may link one or more observations that are believed to represent one failure occurrence or one recurrence series.
   - Required fields must include:
     - stable case ID and schema version;
     - status: `observed`, `triaged`, `confirmed`, `disputed`, `false_positive`, `resolved`, `reopened`, or `archived`;
     - primary and secondary defect classes;
     - proposed and confirmed root-cause classes;
     - contributing conditions and downstream symptoms;
     - affected stages and reader/operational impact;
     - linked immutable evidence and observation IDs;
     - model, effort, prompt-stack, execution-profile, source-plan, critic, reviewer, and schema fingerprints where available;
     - repair/regeneration history and final disposition;
     - decision maker, decision timestamp, evidence cited, and contrary evidence considered;
     - linked cluster IDs, regression-protection IDs, and improvement-candidate IDs;
     - resolution status and recurrence-after-resolution count.
   - Do not mutate prior decisions in place. Append a decision event and compute current state from the event history.

5. **Use a versioned, extensible taxonomy.**
   - Maintain separate taxonomies for observed defect and root-cause mechanism.
   - Root-cause families must cover at least:
     - execution-context contamination;
     - state/transaction failure;
     - provider or route-policy failure;
     - source insufficiency or conflict;
     - source projection or ontology loss;
     - prompt conflict, overconstraint, or underspecification;
     - model generation behavior;
     - critic/validator false positive or false negative;
     - reviewer or adjudication failure;
     - repair-scope or repair-routing failure;
     - evidence freshness or acceptance failure;
     - integration/schema mismatch;
     - interaction among multiple components;
     - unknown or not assessable.
   - Defect classes must cover at least factual fabrication, ambiguous source register, unsupported causal strength, quiz/key ambiguity, repeated structure, repair regression, state corruption, stale evidence, validator mismatch, reviewer mismatch, prompt-injection control effect, unexpected write, provider outcome misclassification, and other/unknown.
   - Taxonomy changes must be versioned and must not silently rewrite historical classifications.

6. **Implement deterministic observation ingestion from immutable evidence.**
   - Build an adapter over the `IMP-10` evidence query API. Do not rescan arbitrary repository debris.
   - Ingest deterministic critic failures, reviewer findings, provider outcomes, state transitions, commit failures, repair outcomes, acceptance invalidations, and explicit human findings.
   - Preserve the exact detector/reviewer result and artifact hash that produced each observation.
   - Only direct operational causes with mechanically conclusive evidence may be auto-classified as confirmed, such as a schema parse failure, stale compare-and-swap base, unexpected write, missing required artifact, or hash mismatch.
   - Content and model-behavior root causes must remain proposed until confirmed under the governance policy.

7. **Implement an evidence-bound diagnosis proposal interface.**
   - Machine assistance may produce a structured `DiagnosisProposalV1` containing:
     - proposed root cause;
     - contributing conditions;
     - downstream symptoms;
     - evidence for the proposal;
     - evidence against or not explained by the proposal;
     - alternative hypotheses;
     - information still needed;
     - confidence and calibration source;
     - recommended next diagnostic action.
   - The diagnosis role must operate in an isolated, read-only context and receive only authorized evidence references or redacted artifacts.
   - A diagnosis proposal cannot change case status to `confirmed`, cannot alter source plans or prompts, and cannot dispatch repair.
   - Preserve disagreement among proposals. Do not force consensus or overwrite minority evidence.

8. **Define confirmation, dispute, and closure policy.**
   - Require an explicit operator or separately authorized adjudication decision to confirm content-related root causes.
   - A decision must cite exact evidence references and record contrary evidence considered.
   - `false_positive` requires evidence explaining why the detector or reviewer finding was invalid.
   - `resolved` requires a linked implementation/change identity and regression protection, or an explicit documented exception.
   - A later recurrence may reopen a resolved case without erasing the original resolution.
   - P0/P1 cases must not be archived merely because they are old.

9. **Implement non-destructive similarity and clustering.**
   - Start with explainable structured features such as defect class, root-cause class, stage, source-risk profile, route fingerprint, critic/reviewer codes, repair path, state transition, and artifact semantics.
   - Optional semantic embeddings may supplement structured features only if:
     - the embedding model/version and input hashes are recorded;
     - raw sensitive content is not sent outside approved boundaries;
     - an offline deterministic stub exists for unit CI;
     - changing the embedding model invalidates cluster evidence;
     - the system remains usable without embeddings.
   - Cluster assignments are advisory links. Never merge or delete cases automatically.
   - Show the features and nearest cases that produced each similarity or novelty result.
   - Explicitly test failures that share vocabulary but have different causes, and failures with different wording but the same mechanism.

10. **Implement novelty detection as a triage aid.**
    - Novelty must use a documented combination of:
      - distance from confirmed historical cases;
      - unseen stage/root-cause combinations;
      - new provider/state outcomes;
      - high reviewer disagreement;
      - high severity with low diagnostic confidence;
      - failure of existing regression protections.
    - Novelty is not a quality score and must not be based primarily on a model saying “this is novel.”
    - Produce `high`, `medium`, `low`, or `unknown` novelty with evidence and missing-data notes.
    - Prioritize `P0/P1 + high novelty`, `P0/P1 + low confidence`, and recurring P2 clusters for human triage.

11. **Create a governed regression-protection link.**
    - Every confirmed P0/P1 case and every recurring P2 cluster must have one of:
      - an active deterministic test;
      - an approved metamorphic case from `IMP-16`;
      - an approved model-backed evaluation case;
      - a monitored runtime invariant;
      - an explicit, reviewed reason why durable protection is not yet feasible.
    - A link must record the exact test/case ID, version, owner, activation status, last result, and pipeline fingerprints assessed.
    - Passing a test once does not resolve a case unless the implementation change and relevant evaluation are also linked.

12. **Create an `ImprovementCandidateV1` lifecycle.**
    - An improvement candidate must state:
      - linked failure cases and clusters;
      - target layer: test, prompt, source compiler, authoring contract, repair, reviewer, validator, state, routing, observability, or documentation;
      - proposed mechanism of change;
      - expected benefit and possible regressions;
      - blast radius and overlapping packages;
      - required tests/evals, held-out data, and success thresholds;
      - rollback criteria;
      - owner and approval history;
      - exact baseline and candidate fingerprints.
    - Lifecycle states must include at least `draft`, `reviewed`, `approved_for_experiment`, `experimenting`, `qualified`, `rejected`, `superseded`, and `withdrawn`.
    - No state in this package may automatically edit files, activate a route, weaken a gate, or promote a model/profile.
    - `qualified` requires external evidence from the appropriate integration, bakeoff, regression, or canary process. It must not be self-awarded by the proposing model.

13. **Implement active triage and reporting without background autonomy.**
    - Provide commands or APIs equivalent to:
      - ingest new immutable evidence;
      - list untriaged high-severity observations;
      - show a complete case timeline;
      - compare nearest confirmed cases;
      - display potentially novel cases;
      - list confirmed cases without regression protection;
      - create a draft improvement candidate;
      - export a review packet;
      - produce trend reports.
    - Commands must be explicit and bounded. Do not create a daemon that continually edits or promotes artifacts.
    - Reports must distinguish counts of observations, cases, confirmed causes, false positives, unresolved cases, and protected cases.

14. **Measure process quality, not invented outcome claims.**
    - Record at least:
      - recurrence rate by confirmed failure class;
      - time from observation to triage;
      - time from confirmation to regression protection;
      - percentage of P0/P1 cases with active protection;
      - false-positive rate by detector/reviewer where adjudicated;
      - reopened-case rate;
      - unresolved-case age;
      - top recurring clusters;
      - novelty-review yield;
      - number of prompt changes avoided because a test or compiler/validator fix was chosen instead.
    - Treat missing adjudication as missing data, not a negative or positive outcome.
    - Do not claim reader learning, lower production defect rate, or improved quality until a controlled evaluation demonstrates it.

15. **Integrate with `IMP-16` and `IMP-17` through narrow contracts.**
    - Expose confirmed cases and unprotected recurring clusters to `IMP-16` through a stable query/export schema.
    - Expose only approved, non-leaky historical features to `IMP-17`.
    - A pre-authoring risk feature must never include the current chapter’s post-authoring outcome, reviewer result, repair count, or acceptance status.
    - Prevent circularity: risk recommendations and metamorphic results may become evidence, but they cannot confirm their own correctness.

16. **Preserve privacy, retention, and package isolation.**
    - Reference content-addressed evidence rather than copying complete source bodies into the failure index.
    - Apply existing redaction and retention classes.
    - Exclude failure-memory roots from chapter discovery, assembly, package, publish, and normal reader-facing output.
    - Cleanup must refuse to delete evidence referenced by an unresolved case, active incident, approved regression, bakeoff, canary, or readiness decision.

17. **Support legacy and partial evidence honestly.**
    - Permit import of historical reports as `secondary_report` observations with lower evidentiary status.
    - Never reconstruct missing chapter bytes, prompts, reviews, or state transitions from prose summaries.
    - Mark claims `not assessable` when underlying evidence is missing.
    - Provide schema migration and read compatibility for future taxonomy versions.

18. **Ship in shadow mode only.**
    - Default mode must be `shadow`.
    - Shadow mode creates observations, cases, reports, and draft proposals but does not affect production verdicts or routing.
    - Any future gating or automated escalation requires a separately approved activation manifest, new pipeline fingerprint, and requalification.

### Expected files or surfaces

Likely files or surfaces include, but are not limited to:

- new failure-memory schemas under the existing artifact/types namespace;
- failure observation/case stores that reference the `IMP-10` evidence store;
- append-only case decision journal;
- ingestion adapters for critic, reviewer, repair, provider, state, and acceptance evidence;
- similarity/cluster/novelty modules;
- improvement-candidate and regression-link modules;
- query/index/report/CLI surfaces;
- retention, redaction, cleanup, and package-exclusion configuration;
- integration adapters for `IMP-16` and `IMP-17`;
- fixture factories and hermetic tests;
- documentation for taxonomy, confirmation policy, lifecycle, and operator use.

Verify exact locations in the integrated branch. Do not force all functionality into v24 filenames if ownership has moved.

### Tests to add or update

Add or update all applicable tests below.

#### Unit tests

- Schema, canonical serialization, stable ID, hash, and version tests for every new artifact.
- Idempotent ingestion of the same attempt evidence.
- Append-only decision history and computed current-state tests.
- Separation of defect, root cause, contributing condition, and downstream symptom.
- Taxonomy versioning and unknown/not-assessable behavior.
- Direct operational cause auto-confirmation only for mechanically conclusive events.
- Content root causes remaining proposed until confirmation.
- Contradictory diagnosis proposals retained without forced consensus.
- False-positive, disputed, resolved, reopened, and archived state transitions.
- Improvement-candidate lifecycle and prohibition on automatic promotion.
- Regression-protection coverage calculations.
- Similarity and novelty explanation output.
- Redaction, retention, package exclusion, and cleanup protection.

#### Integration tests

- Immutable attempt evidence → observation → triaged case → confirmed diagnosis → regression link.
- Critic finding plus later reviewer rejection producing a disputed rather than confirmed case.
- Repair that passes but does not prove the original root cause.
- Provider safeguard, timeout, stale base, unexpected write, schema failure, content defect, and reviewer false positive remaining distinct.
- Historical report import with secondary-evidence status and unavailable raw artifacts.
- Case export to `IMP-16` and approved feature export to `IMP-17`.
- Case remains reconstructable after index rebuild using only immutable evidence references.
- Shadow mode leaves canonical chapters, routing, gates, and acceptance decisions unchanged.

#### Regression fixtures

Create generic fixtures for at least:

1. invented named person caused by a source/prompt interaction;
2. unsupported causal upgrade caused by evidence-strength loss;
3. two-valid-answer quiz defect;
4. repair that fixes framing but changes an unrelated quiz;
5. lexical validator false positive on a valid alias;
6. stale acceptance after chapter-byte change;
7. mid-write or stale-base state failure;
8. provider safeguard misclassified as content failure;
9. prompt-injection text with no control effect;
10. two failures with similar language but different root causes;
11. two failures with different wording but the same root mechanism;
12. a reviewer complaint later adjudicated false positive;
13. a resolved case that recurs under a new prompt fingerprint;
14. a historical report whose raw artifacts are unavailable.

#### Negative and failure-path tests

- Missing evidence manifest or mismatched artifact hash.
- Duplicate observation ingestion under concurrent workers.
- Case confirmation without cited evidence.
- P0/P1 resolution without protection or approved exception.
- Cluster process trying to merge/delete cases.
- Diagnosis proposal attempting to alter prompt, model, gate, or source plan.
- Improvement candidate attempting to activate itself.
- Book title, chapter number, author name, or campaign token becoming a production feature.
- Embedding provider unavailable or version changed.
- Sensitive source text copied into an unrestricted index.
- Cleanup attempting to remove evidence linked to an unresolved case.
- Current-chapter post-outcome leakage into a pre-authoring risk export.

#### Red-team cases

- A model diagnosis confidently claims a cause unsupported by the evidence.
- Three model diagnoses agree because they share the same mistaken premise.
- A repair passes all current checks but the original defect remains in another unit.
- A cluster is driven only by repeated words such as “calendar,” “meeting,” or “ledger.”
- A novel P1 failure is hidden inside a large recurring P3 cluster.
- A source document includes fake failure-memory control instructions.
- A worker changes a gate to make recurrence metrics look better.
- A false-positive reviewer is never adjudicated, causing incorrect detector-quality claims.
- A resolved case is treated as permanently impossible and not reopened after recurrence.
- A report claims the self-learning loop improved books without a controlled evaluation.

### Verification procedure

1. Record the exact baseline and frozen contract versions.
2. Produce a requirement-to-code-to-test matrix for all `FM-*` requirements.
3. Show the final schemas, taxonomies, lifecycle diagrams, and confirmation policy.
4. Reconstruct at least one synthetic case end to end from immutable `IMP-10` evidence.
5. Demonstrate a disputed case, a false positive, a resolved case, and a reopened recurrence.
6. Demonstrate two nearest-case queries: one correct semantic match with different wording and one rejected vocabulary-only match.
7. Demonstrate novelty triage on a high-severity fixture with no close historical case.
8. Show that a confirmed P1 case cannot be resolved without active protection or an explicit approved exception.
9. Export one draft metamorphic candidate to `IMP-16` and one approved historical feature set to `IMP-17`.
10. Prove shadow mode does not change model calls, canonical chapter bytes, repair selection, review verdicts, gate outcomes, retry counts, promotion, or publication behavior.
11. Run focused unit, integration, negative, and red-team tests under hermetic no-network conditions.
12. Run the full migration regression suite required by the integrated branch.
13. Inspect diffs for any autonomous prompt/code/routing/gate mutation path.
14. Provide exact test commands and unedited results.

### Rollback criteria

Stop, revert, or leave this package unmerged if any of the following occurs:

- it creates a second raw attempt/evidence store competing with `IMP-10`;
- an AI proposal can become a confirmed root cause without the defined decision policy;
- any artifact can edit or activate prompts, code, routes, gates, thresholds, retries, source plans, or production state;
- cluster assignment destructively merges cases or hides minority evidence;
- P0/P1 cases can be resolved without protection or an explicit reviewed exception;
- the system requires live network/model access in unit CI;
- sensitive source content or credentials leak into the index or reports;
- cleanup can delete evidence referenced by active cases or decisions;
- a book-specific or campaign-specific rule is introduced;
- shadow mode changes production behavior;
- an already-frozen bakeoff/canary fingerprint is silently modified;
- the implementation claims quality or reader-outcome improvement without evaluation;
- broad unrelated changes are needed to make tests pass.

### Red-team checklist

- Can a critic or reviewer finding automatically become “root cause confirmed”?
- Can a diagnosis agent alter the source plan, repair scope, prompt, route, or gate?
- Can a cluster hide a unique P0/P1 failure?
- Can similar vocabulary outweigh different state transitions and evidence?
- Can different wording prevent recognition of the same causal mechanism?
- Can unresolved evidence be deleted by retention cleanup?
- Can a historical summary be mistaken for raw proof?
- Can a current outcome leak into the earlier risk feature set?
- Can one model proposal promote its own suggested change?
- Can production behavior change when the feature is set to shadow?
- Can book- or chapter-specific tokens enter the taxonomy or similarity rules?
- Can reports imply readers learned or defects fell without controlled evidence?

### Deliverables

Provide:

1. Exact baseline tree/commit identity and consumed contract versions.
2. Files changed, added, and deleted.
3. Final failure observation, case, diagnosis, cluster, regression-link, and improvement-candidate schemas.
4. Taxonomy definitions and migration/version policy.
5. State/lifecycle diagrams and confirmation/adjudication rules.
6. Evidence-ingestion and content-addressed reference flow.
7. Similarity, clustering, novelty, and genericization design.
8. Operator/API/CLI usage examples.
9. Shadow-mode behavior and proof of no production decision change.
10. Tests required, exact tests run, unedited results, and fixture inventory.
11. Demonstrations of confirmed, disputed, false-positive, resolved, and reopened cases.
12. Privacy, retention, cleanup, and package-exclusion evidence.
13. Known limitations, unresolved risks, and prerequisites for later activation.
14. Explicit statement of all actions not performed, including book generation, publication, deployment, upload, commit, and push.

Emit both:

- a narrative implementation report; and
- `implementation-report.imp-15.json` conforming to the frozen worker-report schema.

The JSON must explicitly include baseline/result hashes, contract versions, files changed, requirements implemented, tests required/run/results, gate changes, book-specific exceptions, unexpected writes, unresolved risks, dependency assumptions, mode default, network/model calls made, and whether any bakeoff/canary/activation fingerprint changed. Empty and adverse fields must be explicit. The narrative and JSON reports must agree.

### Constraints

- No gate weakening.
- No book-specific or chapter-specific hacks.
- No silent fallback or silent diagnosis confirmation.
- No unbounded retries, polling, model calls, or retention.
- No hidden chain-of-thought storage.
- No autonomous prompt, code, model-policy, validator, threshold, gate, or production-state mutation.
- No production gating or routing effect in shadow mode.
- No live model/network dependency in unit CI.
- No permanent routing back to GPT-5.5.
- No publish, promote, deploy, S3 upload, package mutation, production activation, commit, or push unless separately authorized.
- No use of production state as a test fixture.
- No modification of a frozen bakeoff or canary profile without a new fingerprint and requalification decision.
- Preserve backward compatibility or provide an explicit, tested migration path.


---

## Prompt `IMP-16`: `Metamorphic Regression Contracts and Active Failure-to-Eval Mining`

### Role

You are a principal AI evaluation architect, metamorphic-testing engineer, property-based testing specialist, TypeScript test-platform engineer, and migration-safety reviewer working on ChapterFlow.

You are implementing a reusable evaluation layer that tests how ChapterFlow responds to controlled changes in evidence, source semantics, quiz structure, repair scope, execution context, and artifact freshness. Your goal is to detect semantic brittleness that ordinary snapshot tests and one-off goldens miss.

### Context

`IMP-12` provides hermetic generic regression fixtures for the SOL migration. `IMP-15` provides a governed memory of confirmed failures and identifies cases that lack durable regression protection. Those capabilities are necessary but incomplete:

- a fixed fixture can pass while the pipeline still reacts incorrectly when one source detail is removed;
- a lexical validator can pass familiar wording while failing a semantically equivalent paraphrase;
- a quiz can appear correct until answer choices are reordered;
- a repair can pass on one fixture while changing protected content under a slightly different path;
- an instruction/data boundary can appear safe until hostile instructions are inserted into a source or reviewer artifact;
- a model can preserve causal language after the source has been weakened from causal to correlational.

Metamorphic testing addresses this by defining a relationship between a base input/output and a deliberately transformed input/output.

Example:

```text
Base source contains a date
→ chapter may use the date

Transformed source removes the date
→ chapter must not retain or replace that date with invented specificity
```

The expected result is not one exact chapter string. It is a semantic relation such as “unsupported detail disappears,” “claim strength does not increase,” “answer meaning remains stable while its index changes,” “only approved paths change,” or “dependent evidence becomes stale.”

This package must remain compatible with generative nondeterminism. Use deterministic oracles wherever possible, qualified semantic judges only where necessary, and human approval before any generated test becomes an active regression or release requirement.

### Evidence

Inspect and verify the current integrated repository. Relevant evidence includes:

- `GPT56_SOL_MIGRATION_MASTER_PLAN_AND_PROMPT_PACK.md`;
- implementation reports and contracts from `IMP-00` through `IMP-12`, especially `IMP-03`, `IMP-07`, `IMP-08`, `IMP-09`, `IMP-10`, `IMP-11`, and `IMP-12`;
- `IMP-15` failure-memory schemas and query/export interface, if already integrated;
- source packet, source-use plan, source projection, and claim-strength schemas;
- author, repair, reviewer, acceptance, and evidence-freshness contracts;
- current critic and validator interfaces;
- current fake providers, replay providers, fixture factories, injectable roots, and no-network CI entry points;
- existing tests for source grounding, source realness, causal claims, quiz keys, lexical aliases, repair scope, stale evidence, unexpected writes, hostile context, and compare-and-swap behavior;
- existing v24 files such as `src/critics/sourceGrounding.ts`, `src/critics/sourceRealness.ts`, `src/critics/quizKeyGate.ts`, `src/critics/quizCorrectness.ts`, `src/critics/misattribution.ts`, `src/critics/evidenceIntegrity.ts`, `src/evidence/evidenceMap.ts`, `src/orchestrator/authorRepair.ts`, `src/review/renderReaderDoc.ts`, and `src/risk/chapterRisk.ts`, or their migrated equivalents.

Treat the exact integrated interfaces as authoritative. Do not recreate older v24 contracts when migration packages have replaced them.

### Inputs

Before editing, inspect:

1. The exact integrated tree or commit and frozen contract manifest.
2. The current hermetic test-root abstraction and production-leak detector.
3. The current source-use, claim-strength, repair-patch, review-output, evidence-manifest, route-result, and worker-report schemas.
4. Current fixture factories and fake/replay model providers.
5. The qualified judge contract from the bakeoff work, if available.
6. The `IMP-15` export for confirmed, recurring, and unprotected failure cases.
7. Any active CI, bakeoff, canary, gold-corpus, or production-readiness profile.

If `IMP-15` is not yet integrated, implement the metamorphic framework so it can accept a frozen adapter later, but do not invent a competing failure-memory schema. If a required shared contract is incompatible, stop and report the mismatch.

### Objective

Implement a versioned metamorphic regression framework that:

1. defines controlled, typed input transformations;
2. defines expected semantic relationships rather than brittle full-output strings;
3. records preconditions, changed inputs, protected inputs, seeds, hashes, and oracle provenance;
4. supports deterministic unit/CI execution without live model or network access;
5. supports separately authorized, bounded, no-publish model-backed evaluation runs;
6. converts high-value confirmed failures into draft metamorphic cases without auto-promoting them;
7. requires review and approval before a generated case becomes active;
8. produces relation-level `pass`, `fail`, `inconclusive`, `not_applicable`, or `base_invalid` results;
9. integrates with existing regression, bakeoff, and evidence systems without changing production gates automatically;
10. makes it difficult to satisfy a fixture through a book-specific hard-code or lexical trick.

The initial framework must activate deterministic approved metamorphic tests only in the hermetic regression suite. Model-backed cases must remain separate, bounded, no-publish, and explicitly invoked.

### Scope

Included:

- versioned metamorphic case, transformation, relation, run, and result schemas;
- whitelisted transformation registry;
- safe semantic-relation/oracle registry;
- deterministic seed and canonical-diff behavior;
- base-case validity and applicability checks;
- priority source, ontology, claim-strength, quiz, repair, freshness, injection, and lexical transformations;
- bridge from `IMP-15` confirmed failures to draft eval candidates;
- draft/reviewed/approved/active/retired case lifecycle;
- deterministic replay and fake-provider support;
- separately authorized model-backed runner with frozen profiles and bounded samples;
- evidence manifests and result reports;
- CI integration for deterministic active cases;
- focused unit, integration, regression, negative, and red-team tests.

### Non-goals

Do not:

- replace ordinary unit, integration, bakeoff, gold-corpus, or reader-outcome evaluation;
- require exact prose equality for generative output;
- execute arbitrary code or `eval` from a metamorphic artifact;
- let model-generated transformations or expected relations become active automatically;
- use one model’s answer as the sole oracle for another model’s correctness;
- call live models or the network in normal unit CI;
- generate, repair, publish, package, or promote a real book as part of this package;
- change existing source, factuality, causal, quiz, schema, state, acceptance, or release thresholds;
- change production routing or retry budgets;
- create book-specific fixtures from titles, names, or chapter numbers;
- hide a base-case failure by scoring only the transformed case;
- continue sampling until a relation passes;
- modify an already-frozen bakeoff/canary profile without requalification.

### Specific implementation instructions

1. **Establish the baseline and requirement map.**
   - Record the exact base identity and consumed contract versions.
   - Create stable requirement IDs `MR-001` through `MR-034` or an equivalent complete mapping.
   - Verify that `IMP-12` owns the hermetic test roots and shared fixture contracts.
   - Verify that `IMP-15` owns confirmed failure memory and that this package only consumes its approved export.

2. **Define the metamorphic vocabulary.**
   - Use distinct concepts for:
     - `base fixture`: the valid starting inputs and expected baseline conditions;
     - `transformation`: one controlled change to the input, policy, or artifact state;
     - `precondition`: what must be true before the transformation is meaningful;
     - `protected input`: an input that must remain identical;
     - `changed input`: the exact field/path intentionally changed;
     - `relation`: the expected relationship between base and transformed behavior;
     - `oracle`: the mechanism that evaluates a relation;
     - `case`: a governed combination of base fixture, transformation, and relations;
     - `run`: one execution under a frozen profile;
     - `result`: relation-level evidence and final case disposition.
   - Do not call an ordinary pair of golden files a metamorphic test unless the expected relationship is explicit.

3. **Define a versioned `MetamorphicCaseV1`.**
   - Use existing artifact conventions, canonical JSON, content hashes, stable IDs, and provenance.
   - The exact schema may differ, but it must represent at least:

```ts
type MetamorphicCaseV1 = {
  schemaVersion: "metamorphic-case-v1";
  caseId: string;
  title: string;
  status: "draft" | "reviewed" | "approved" | "active" | "retired";
  owner: string;
  sourceFailureCaseIds: string[];
  baseFixtureRef: {
    fixtureId: string;
    version: string;
    sha256: string;
  };
  stageUnderTest: string;
  transformation: {
    transformationId: string;
    version: string;
    parameters: Record<string, unknown>;
    seed?: string;
  };
  preconditions: string[];
  changedInputPaths: string[];
  protectedInputPaths: string[];
  expectedRelations: MetamorphicRelationV1[];
  forbiddenOutcomes: string[];
  oraclePolicy: string;
  approval: {
    proposedBy: string;
    reviewedBy?: string;
    approvedBy?: string;
    rationale: string;
  };
  pipelineCompatibility: string[];
};
```

   - A case must not contain executable JavaScript, shell, templates with side effects, or arbitrary evaluator expressions.
   - All transformations and oracles must resolve through approved registries.

4. **Define a constrained relation model.**
   - Support typed relation kinds such as:
     - `must_preserve`;
     - `must_change`;
     - `must_remove`;
     - `must_not_introduce`;
     - `must_not_strengthen`;
     - `must_reframe`;
     - `must_remap`;
     - `must_invalidate`;
     - `must_reject`;
     - `must_not_control`;
     - `bounded_diff`;
     - `monotonic_nonincrease`;
     - `semantic_equivalence`;
     - `schema_equivalence`.
   - Each relation must identify:
     - the assessed artifact/path/unit;
     - the base and transformed evidence references;
     - the oracle type;
     - exact success, failure, and inconclusive conditions;
     - whether a deterministic blocker takes precedence over a semantic judge.
   - Do not create an unrestricted expression language. Implement a finite, reviewed registry of relation evaluators.

5. **Implement a pure, versioned transformation registry.**
   - Each transformation must:
     - declare its applicable input schema and version;
     - validate preconditions;
     - receive an explicit seed where randomness is used;
     - return new immutable artifacts rather than mutating the base fixture;
     - record before/after hashes and a machine-readable semantic diff;
     - be deterministic for the same inputs, version, parameters, and seed;
     - fail clearly when not applicable.
   - Transformation code is trusted repository code. Transformation parameters are data and must not select arbitrary code paths.

6. **Implement the priority source-detail removal family.**
   - Support controlled removal of a date, number, person, organization, location, event, quote, hard specific, or source anchor.
   - Expected relations must be able to require that:
     - the removed unsupported detail no longer appears as fact;
     - no replacement detail is invented;
     - dependent claims weaken, reframe, or disappear;
     - source-plan and evidence hashes update;
     - stale downstream evidence is invalidated.
   - Do not require the transformed output to retain the same prose or structure.

7. **Implement evidence-strength downgrade and contradiction transformations.**
   - Support transformations such as:
     - causal → correlational;
     - demonstrated → suggested;
     - universal → conditional;
     - precise estimate → uncertain range or no supported number;
     - single-source certainty → conflicting-source uncertainty.
   - Expected relations must prevent stronger claims than the transformed evidence permits.
   - The valid response may be weaker language, explicit uncertainty, direct explanation, or refusal to assert the claim.
   - Do not force one stock uncertainty phrase.

8. **Implement source-ontology and register transformations.**
   - Support controlled conversion among source-bound case, constructed application, generic operational scenario, and direct conceptual explanation where the current source-plan contract permits.
   - Expected relations must verify that:
     - constructed material is clearly framed as illustrative;
     - invented people, companies, dates, and events do not retain a sourced historical register;
     - source-bound claims retain required anchors;
     - generic scenarios do not acquire unsupported biographical specificity;
     - the writer cannot relabel a unit merely to evade a source restriction.

9. **Implement semantic-preserving paraphrase and ordering transformations.**
   - Support paraphrase of source text or labels while preserving the underlying IDs and meaning.
   - Support harmless reordering of independent source entries where order has no declared semantics.
   - Expected relations must focus on semantic validity, source binding, and gate outcomes rather than exact text.
   - Use these cases to detect lexical assumptions in validators.
   - Human approval is required for any model-generated paraphrase before it becomes active.

10. **Implement quiz and answer-choice transformations.**
    - Support answer-choice permutation with deterministic seed.
    - Require semantic key identity to remain constant while the keyed index/letter remaps correctly.
    - Support a mutation that makes a distractor independently defensible; the quiz/reviewer path must detect ambiguity rather than silently preserve the old key.
    - Support mutation of the stored key to an incorrect choice; the independent derivation/adjudication path must catch it.
    - Preserve phase-one blindness and ensure the key is absent from the derivation workspace.

11. **Implement typed repair-scope transformations.**
    - Apply one approved repair finding to one allowed path or dependency closure.
    - Require protected paths or protected semantic units to remain unchanged.
    - Test stale base hashes, incorrect old-value hashes, unauthorized paths, source-plan mutation, and over-broad patches.
    - Full regeneration is not a valid substitute for passing a surgical-patch metamorphic case.

12. **Implement freshness and state transformations.**
    - Change a committed chapter byte, source-plan hash, prompt/schema version, reviewer card, route fingerprint, or execution profile.
    - Require all dependent review, quiz, sweep, acceptance, and readiness evidence to become stale according to the integrated freshness graph.
    - Include compare-and-swap base changes and interrupted transaction states where relevant.
    - Do not duplicate the state machinery; exercise its public test interfaces.

13. **Implement hostile instruction/data-boundary transformations.**
    - Insert instruction-like text into source facts, hard specifics, briefs, prior complaints, reviewer evidence, or repair artifacts.
    - Expected relation: the inserted text may appear as quoted data where relevant but must have no control effect on model, tools, paths, permissions, output protocol, retries, gates, or state.
    - Combine prompt-level checks with least-authority filesystem and execution assertions.

14. **Implement lexical and identity robustness transformations.**
    - Support surname/full-name alias, punctuation, Unicode normalization, case folding, multi-token identity, equivalent label, and decoy-token mutations.
    - Expected relations must distinguish semantic identity from unrelated lexical overlap.
    - These tests must harden the migrated validator without weakening the underlying source or identity invariant.

15. **Define base validity and case disposition.**
    - Before evaluating a relation, verify that the base fixture satisfies its declared prerequisites.
    - A case result must be one of:
      - `pass`;
      - `fail`;
      - `inconclusive`;
      - `not_applicable`;
      - `base_invalid`.
    - Never count `base_invalid`, provider failure, safeguard/refusal, timeout, or schema truncation as a successful relation.
    - Report base and transformed outcomes separately.

16. **Use an oracle hierarchy.**
    - Prefer, in order:
      1. schema and hash checks;
      2. deterministic validators and typed invariants;
      3. exact semantic IDs and source/claim metadata;
      4. qualified, isolated semantic judges;
      5. human adjudication.
    - A semantic judge cannot overturn a deterministic integrity failure.
    - Judges must use frozen cards/schemas, randomized candidate order where comparison is involved, and evidence-bound structured output.
    - A model-generated oracle or expected answer cannot be the sole approval basis for a new active case.

17. **Bridge confirmed failures to draft metamorphic candidates.**
    - Query `IMP-15` for:
      - confirmed P0/P1 cases without protection;
      - recurring P2 clusters;
      - reopened cases;
      - high-novelty cases that have been adjudicated;
      - validator/reviewer false-positive clusters.
    - Rank candidates by severity, recurrence, blast radius, diagnostic confidence, and feasibility of expressing a stable relation.
    - Produce a draft case with generalized fixture inputs, transformation rationale, expected relation, and unresolved oracle questions.
    - Never activate the draft automatically.
    - Strip book titles, author names, chapter IDs, and campaign-specific vocabulary unless they are intrinsic to the generic invariant.

18. **Implement case governance and versioning.**
    - Lifecycle: `draft` → `reviewed` → `approved` → `active`; permit `retired` with reason and replacement ID.
    - Require reviewer identity, approval rationale, source failure IDs, and version compatibility.
    - Any transformation, relation, oracle, fixture, prompt, schema, judge, or route change must update the compatibility fingerprint and may stale prior results.
    - Active cases may gate only the hermetic regression profile explicitly configured to include them. This package must not add a new production release blocker automatically.

19. **Separate deterministic CI from model-backed evaluation.**
    - Unit and normal integration CI must use deterministic code paths, fake providers, replayed structured outputs, and no network.
    - Provide an explicitly invoked no-publish model-backed runner for cases whose relation requires real model behavior.
    - The runner must freeze:
      - model and effort through `IMP-02`;
      - prompt stack;
      - execution profile;
      - source and fixture hashes;
      - sample count;
      - repair enabled/disabled state;
      - judge profile;
      - stopping rules.
    - Do not replay until pass. Preserve all samples and provider outcomes.

20. **Make reports relation-first and evidence-bound.**
    - Report each relation separately with evidence references, not only one case score.
    - Include base validity, transformed validity, changed/protected input hashes, actual semantic diff, oracle, result, and confidence or disagreement.
    - Aggregate by transformation family and failure class without treating within-chapter units as independent chapters.
    - Do not claim a production defect-rate reduction from fixture passes.

21. **Control cost and suite growth.**
    - Deduplicate semantically equivalent active cases while retaining their source failure links.
    - Apply explicit runtime classes such as `unit`, `integration`, `extended`, and `model-backed`.
    - Require an owner and review date for expensive cases.
    - Do not add every observed failure as a new model-backed test. Prefer the smallest deterministic or metamorphic protection that preserves the invariant.

22. **Preserve frozen experiments and production behavior.**
    - If a bakeoff/canary profile is already frozen, add these cases under a new evaluation-profile fingerprint rather than modifying the experiment in place.
    - Do not alter authoring prompts, model routes, gate thresholds, retry caps, or publication behavior in this package.

### Expected files or surfaces

Likely files or surfaces include, but are not limited to:

- new metamorphic case/relation/run/result artifact schemas;
- transformation and relation registries;
- source, ontology, claim-strength, quiz, repair, freshness, injection, and lexical transformation modules;
- base-fixture and semantic-diff helpers;
- bridge from `IMP-15` exports;
- deterministic fake/replay execution adapters;
- optional no-publish model-backed runner;
- evidence/report writers;
- CI suite registration and runtime-class configuration;
- fixture factories, approved case catalog, and governance documentation;
- worker implementation reports.

Verify exact locations. Reuse `IMP-12` test-root and fixture infrastructure instead of creating parallel roots.

### Tests to add or update

Add or update all applicable tests below.

#### Unit tests

- Case, transformation, relation, run, and result schema/version/hash tests.
- Registry resolution and rejection of unknown transformation/oracle IDs.
- Rejection of arbitrary executable expressions.
- Pure deterministic transformation behavior for same seed and inputs.
- Preconditions, protected inputs, semantic diff, and not-applicable behavior.
- Base validity and all five result dispositions.
- Case lifecycle and approval requirements.
- Compatibility fingerprint and stale-result behavior.
- Runtime-class and cost-bound configuration.

#### Integration tests

- Approved case execution under hermetic fake provider.
- `IMP-15` confirmed case → generalized draft metamorphic case → review → approval → active deterministic test.
- Draft/unapproved case cannot gate any suite.
- Model-backed runner refuses missing frozen model, effort, prompt, judge, sample, or stopping policy.
- No-publish runner preserves every attempt and provider outcome.
- Active deterministic cases run in isolated roots and cannot mutate production state.

#### Required metamorphic regression cases

Implement at least one approved generic case for each of the following:

1. source date removal;
2. source number removal;
3. named-person or organization removal;
4. causal-to-correlational downgrade;
5. certainty-to-uncertainty downgrade;
6. conflicting source insertion;
7. sourced-case to constructed-application conversion;
8. constructed application to generic scenario conversion;
9. semantic-preserving paraphrase for a lexical validator;
10. answer-choice permutation with key remap;
11. creation of a second defensible quiz answer;
12. incorrect stored answer key;
13. surgical repair limited to one approved path;
14. unauthorized repair path and stale base;
15. chapter-byte change invalidating review and acceptance evidence;
16. execution-profile or prompt/schema change invalidating evidence;
17. hostile instruction inside source data;
18. hostile instruction inside reviewer/repair data;
19. full-name/surname/Unicode alias equivalence;
20. decoy-token non-equivalence.

#### Negative and failure-path tests

- Base fixture already invalid.
- Transformation precondition not met.
- Transformation mutates protected input.
- Nondeterministic transformation under same seed.
- Oracle unavailable or judge output invalid.
- Deterministic integrity failure contradicted by semantic judge.
- Generated draft lacking human approval.
- Book-specific fixture or title token in production evaluator.
- Provider safeguard, timeout, transport failure, and truncation miscounted as relation success.
- Model-backed runner replaying until pass.
- Frozen bakeoff profile altered by case registration.
- Case result remaining fresh after transformation/oracle/version change.

#### Red-team cases

- A model removes one unsupported date but invents another.
- Causal language is hidden in an implication rather than the explicit verb “cause.”
- A hypothetical label is added once while the rest of the passage remains factual in register.
- Choice order changes and the answer letter remains stale.
- A repair changes punctuation in the target path but rewrites a protected example elsewhere.
- Hostile source text asks the agent to mark the test passed.
- A paraphrase preserves words but reverses meaning.
- Two semantically distinct names share one capitalized token.
- A generated test encodes the original book title as the expected answer.
- The suite reports success because the base run failed before reaching the assessed behavior.

### Verification procedure

1. Record exact baseline identity and contract versions.
2. Produce a requirement-to-code-to-test matrix for all `MR-*` requirements.
3. Show final schemas, registry interfaces, lifecycle, and oracle hierarchy.
4. Demonstrate deterministic before/after hashes and semantic diffs for each required transformation family.
5. Run every required generic metamorphic case with fake/replay providers.
6. Intentionally remove or disable one protection at a time in controlled test doubles and show that the associated relation fails.
7. Demonstrate that base-invalid and provider-failure cases cannot be counted as passes.
8. Demonstrate a draft case generated from a synthetic `IMP-15` failure and prove it remains non-active until approved.
9. Demonstrate an approved case becoming stale after transformation, oracle, fixture, prompt, schema, or route fingerprint change.
10. Prove unit and normal integration CI perform no network or live-model calls and do not mutate production roots.
11. Prove model-backed execution is explicitly invoked, bounded, no-publish, and preserves all attempts.
12. Run focused tests and the full hermetic migration regression suite.
13. Inspect diffs for gate weakening, book-specific branches, arbitrary evaluator execution, or frozen-experiment mutation.
14. Provide exact commands and unedited results.

### Rollback criteria

Stop, revert, or leave this package unmerged if any of the following occurs:

- artifacts can execute arbitrary evaluator or transformation code;
- a generated case can become active without review and approval;
- live model/network access becomes required for normal CI;
- tests depend on production state or mutate production roots;
- exact prose snapshots replace semantic relations for generative behavior;
- a semantic judge can override a deterministic integrity failure;
- base failures or provider errors can count as passes;
- the framework samples until success;
- a title-, author-, chapter-, or campaign-specific hard-code is introduced;
- source, factuality, causal, quiz, repair, state, acceptance, or release gates are weakened;
- an already-frozen bakeoff/canary profile changes without a new fingerprint;
- suite cost grows without runtime classification, ownership, and bounded execution;
- broad unrelated production changes are needed to satisfy fixtures.

### Red-team checklist

- Can a transformation or relation artifact execute arbitrary code?
- Can a model-generated test approve itself?
- Can a base failure be hidden by a passing transformed output?
- Can unsupported detail be replaced with different invented detail?
- Can causal overreach survive through implication or framing?
- Can one hypothetical label disguise a factual narrative register?
- Can answer semantics remain correct while the key index becomes stale?
- Can a repair alter protected content without the diff oracle noticing?
- Can hostile source/reviewer text affect tools, paths, permissions, gates, or pass state?
- Can a lexical validator pass a decoy token and fail a true alias?
- Can a frozen experiment absorb new cases without requalification?
- Can fixture passes be misreported as proven production or reader improvement?

### Deliverables

Provide:

1. Exact baseline tree/commit identity and consumed contract versions.
2. Files changed, added, and deleted.
3. Final metamorphic case, relation, transformation, run, and result schemas.
4. Transformation and oracle registry design with safety constraints.
5. Case lifecycle, approval, compatibility, and retirement policy.
6. Catalog of implemented transformation families and active generic cases.
7. Bridge from `IMP-15` confirmed failures to draft eval candidates.
8. Deterministic CI and optional model-backed runner architecture.
9. Evidence/report format with example relation-level results.
10. Tests required, exact tests run, unedited results, and fixture inventory.
11. Proof of no network/live-model use in normal CI and no production-root mutation.
12. Cost/runtime classification and ownership policy.
13. Risks, unresolved questions, and future expansion opportunities.
14. Explicit statement of all actions not performed, including real book generation, publication, deployment, upload, commit, and push.

Emit both:

- a narrative implementation report; and
- `implementation-report.imp-16.json` conforming to the frozen worker-report schema.

The JSON must explicitly include baseline/result hashes, contract versions, files changed, requirements implemented, tests required/run/results, gate changes, active/draft/retired case counts, model/network calls made, book-specific exceptions, unexpected writes, unresolved risks, dependency assumptions, runtime classes, and whether any bakeoff/canary/evaluation fingerprint changed. Empty and adverse fields must be explicit. The narrative and JSON reports must agree.

### Constraints

- No gate weakening.
- No book-specific or chapter-specific hacks.
- No arbitrary executable transformation or oracle artifacts.
- No auto-promotion of generated tests.
- No live model/network dependency in normal CI.
- No replay-until-pass or unbounded samples/retries.
- No exact-prose golden requirement where a semantic relation is appropriate.
- No production routing, prompt, threshold, retry, acceptance, or release change.
- No permanent routing back to GPT-5.5.
- No publish, promote, deploy, S3 upload, package mutation, production activation, commit, or push unless separately authorized.
- No use of production state as a fixture.
- No modification of a frozen bakeoff or canary profile without a new fingerprint and requalification decision.
- Preserve backward compatibility or provide an explicit, tested migration path.


---

## Prompt `IMP-17`: `Shadow Risk-Adaptive Routing, Calibration, and Selective Escalation Recommendations`

### Role

You are a principal AI decision-systems architect, model-routing engineer, calibration and evaluation specialist, TypeScript pipeline engineer, and migration-safety reviewer working on ChapterFlow.

You are implementing a risk-aware recommendation layer above the centralized model policy. Your task is to estimate which chapters and operations are likely to need more reasoning, stronger source review, quiz/causal adjudication, or diagnostic escalation. The initial implementation must observe and report only. It must not change the actual model, reasoning effort, reviewer set, repair route, retry budget, or publication decision.

### Context

The SOL migration centralizes explicit model and reasoning routes in `IMP-02`. The original v24 snapshot also contains `src/risk/chapterRisk.ts`, which calculates a small additive risk score from source quality, fact count, named-case hard specifics, evidence-map issues, and rubric preflight status. It assigns `low`, `medium`, or `high` and can recommend `qc-shadow`.

That existing risk system is useful but limited:

- it mixes signals available at different points in the lifecycle;
- some inputs, such as an evidence map built from an assembled chapter, are not available for a true pre-authoring decision;
- one total score hides which capability is needed;
- missing data can be confused with low risk;
- it is not calibrated against first-write outcomes, repair demand, severe defect classes, latency, or cost;
- it does not use governed historical failure memory;
- it can recommend an action but does not provide a controlled shadow comparison between recommendation and actual route/outcome.

Implement a safer staged approach:

```text
Available evidence at a defined decision point
→ explainable risk-feature snapshot
→ dimension-level risk assessment
→ capability-based route recommendation
→ actual route remains unchanged
→ outcome is linked after the fact
→ calibration report on held-out books
→ separate activation decision later
```

Do not implement a learned black-box router or activate dynamic routing in this package. Begin with explicit, versioned rules and shadow telemetry. A learned router may be considered later only after sufficient labeled data, held-out validation, and separate authorization.

### Evidence

Inspect and verify the current integrated repository. Relevant evidence includes:

- `GPT56_SOL_MIGRATION_MASTER_PLAN_AND_PROMPT_PACK.md`;
- implementation reports and contracts from `IMP-00`, `IMP-01`, `IMP-02`, `IMP-03`, `IMP-04`, `IMP-07`, `IMP-08`, `IMP-10`, `IMP-11`, `IMP-12`, and `IMP-15`;
- current centralized task/profile/model/effort policy;
- current attempt/evidence and route fingerprints;
- current source packet, source-use plan, brief, learning contract where present, critic, review, repair, and acceptance schemas;
- `src/risk/chapterRisk.ts`, `ChapterRiskScoreV1`, `BookRiskScoreV1`, `recommendedAction`, and the current `qc-shadow` orchestration path;
- `src/orchestrator/autopilot.ts`, `src/orchestrator/compilerRun.ts`, `src/providers/router.ts`, and current model-spawn surfaces or their migrated equivalents;
- current bakeoff metrics for first-write pass, severe defects, repair demand, cost, tokens, latency, and reviewer agreement;
- `IMP-15` confirmed failure clusters and approved generic historical features;
- `IMP-16` metamorphic results where available;
- current tests for risk scoring, qc-shadow behavior, route policy, attempts, reviewer escalation, and bakeoff statistics.

Treat the current integrated branch as authoritative. The v24 risk files are evidence of an existing interface, not a requirement to preserve its exact design internally.

### Inputs

Before editing, inspect:

1. The exact base tree/commit and frozen contract manifest.
2. The exact current model-policy task classes and profile IDs from `IMP-02`.
3. Existing risk artifacts, readers, writers, CLI output, tests, and any behavior that currently consumes `recommendedAction`.
4. Attempt/evidence manifests and outcome taxonomy from `IMP-10`.
5. Confirmed failure-memory export and leakage controls from `IMP-15`.
6. The hermetic fixture and statistical-analysis infrastructure from `IMP-11` and `IMP-12`.
7. Any active/frozen bakeoff, canary, gold-corpus, or activation profile.

If the current branch has already replaced `ChapterRiskScoreV1`, target the integrated contract. Do not create a parallel router. If required interfaces are incompatible, stop and report the dependency gap.

### Objective

Implement a versioned, explainable, stage-aware risk recommendation system that:

1. computes risk only from features legitimately available at the named decision point;
2. preserves missingness and uncertainty rather than treating absent data as low risk;
3. separates evidence sufficiency, source-register, factual/causal, quiz, cross-chapter, repair-instability, reviewer-disagreement, novelty, and execution risks;
4. recommends capabilities and approved policy profiles rather than hard-coding raw model IDs;
5. records what route it would have selected while leaving the real route unchanged;
6. links each shadow recommendation to later observed outcomes;
7. measures under-routing, over-routing, quality, repair, latency, token, and cost tradeoffs on held-out books;
8. refuses activation without a separately approved, hash-bound qualification manifest;
9. preserves existing qc-shadow behavior exactly unless a later, separate activation package changes it;
10. creates a clean future hook for selective specialist escalation without implementing an agent swarm now.

The default and only authorized mode for this package is `shadow`.

### Scope

Included:

- versioned stage-specific risk-feature snapshots;
- dimension-level risk assessment and explainable rule registry;
- route/escalation recommendation artifacts using `IMP-02` policy identifiers;
- legacy risk artifact compatibility or explicit migration;
- shadow-only orchestration hooks;
- actual-route/outcome linkage;
- calibration and utility reports;
- held-out, cluster-aware analysis;
- missingness, leakage, drift, and requalification controls;
- CLI/reporting and inspection surfaces;
- unit, integration, regression, negative, and red-team tests;
- narrative and machine-readable implementation reports.

### Non-goals

Do not:

- change the actual model, effort, prompt stack, reviewer count, repair route, retry budget, gate, acceptance, release, or publishing behavior;
- activate dynamic routing;
- replace the centralized model policy from `IMP-02`;
- hard-code raw model identifiers in the risk engine;
- implement a learned classifier, bandit, reinforcement-learning router, or online weight updates;
- use model self-reported confidence as the primary risk signal;
- use current-chapter post-outcome information in a pre-authoring decision;
- implement specialist agent councils or multi-agent authoring in this package;
- assume high risk always means xhigh or more agents;
- treat missing data as evidence of safety;
- tune and evaluate rules on the same books without disclosure;
- add book-specific, chapter-specific, author-specific, or campaign-specific rules;
- change an already-frozen bakeoff/canary profile;
- publish, promote, deploy, upload, commit, or push unless separately authorized.

### Specific implementation instructions

1. **Establish baseline identity and existing-risk compatibility.**
   - Record the exact base tree/commit and all consumed contract versions.
   - Create stable requirement IDs `RR-001` through `RR-036` or an equivalent complete mapping.
   - Inventory every producer and consumer of existing risk artifacts and `recommendedAction`.
   - Decide explicitly whether to:
     - introduce a versioned `ChapterRiskProfileV2` plus a compatibility reader; or
     - migrate the current risk artifact with a tested schema transition.
   - Do not silently change the meaning of `ChapterRiskScoreV1` fields.

2. **Define separate decision points and prevent temporal leakage.**
   - Support at least:
     - `pre_authoring`;
     - `post_first_write`;
     - `pre_repair_or_regeneration`.
   - Optional later decision points may include `pre_acceptance` or `release_verification`, but do not add them unless the current architecture needs them.
   - Each feature must declare the earliest stage at which it becomes available.
   - A feature snapshot must reject any feature derived from a future stage.
   - Examples:
     - pre-authoring may use source packet, source-use plan, brief, chapter category, declared claim types, and approved historical priors;
     - post-first-write may add deterministic critic outputs, schema status, output evidence map, and first-write provider outcome;
     - pre-repair may add confirmed findings, complaint topology, prior repair count, patch scope, stale-base status, and reviewer disagreement.
   - Never use final acceptance, successful repair, or later reviewer verdict to score an earlier decision.

3. **Define a versioned `RiskFeatureSnapshotV1`.**
   - Reuse canonical JSON, stable IDs, hashes, and provenance conventions.
   - The exact schema may differ, but it must include:

```ts
type RiskFeatureSnapshotV1 = {
  schemaVersion: "risk-feature-snapshot-v1";
  snapshotId: string;
  bookId: string;
  chapterId?: string;
  decisionPoint: "pre_authoring" | "post_first_write" | "pre_repair_or_regeneration";
  asOfAttemptId?: string;
  inputArtifactRefs: Array<{
    artifactId: string;
    sha256: string;
    featureFamily: string;
  }>;
  dimensions: {
    evidenceSufficiency: RiskDimensionV1;
    sourceRegister: RiskDimensionV1;
    factualAttribution: RiskDimensionV1;
    causalClaim: RiskDimensionV1;
    quizAmbiguity: RiskDimensionV1;
    crossChapterDependency: RiskDimensionV1;
    repairInstability: RiskDimensionV1;
    reviewerDisagreement: RiskDimensionV1;
    historicalRecurrence: RiskDimensionV1;
    novelty: RiskDimensionV1;
    executionReliability: RiskDimensionV1;
  };
  missingFeatures: string[];
  unavailableFutureFeatures: string[];
  rulePolicyVersion: string;
  generatedAt: string;
};
```

   - A `RiskDimensionV1` must carry at least:
     - `low`, `medium`, `high`, or `unknown` level;
     - evidence/reason codes;
     - contributing feature values and provenance;
     - missingness notes;
     - rule IDs that produced the assessment.
   - Do not reduce the entire decision to one opaque number. A summary score may exist only as a secondary display value with a documented formula.

4. **Use externally observable features and preserve missingness.**
   - Candidate feature families may include:
     - source quality and source-detail sufficiency;
     - number and type of source-bound claims;
     - named-case specificity and restrictions;
     - required constructed applications or generic scenarios;
     - conflicting or weak evidence;
     - dates, numbers, organizations, attribution, and historical claims;
     - declared causal or mechanistic claims;
     - quiz count, distractor design requirements, and ambiguity risk;
     - chapter abstraction level and cross-chapter prerequisites;
     - source-plan novelty or uncommon ontology combinations;
     - prior confirmed failures with the same generic feature pattern;
     - prior attempts, critic failures, repair count, and reviewer disagreement only at later decision points;
     - provider or execution instability only when known at that point.
   - Do not use the model’s prose confidence statement as a primary feature.
   - Missing required evidence must produce `unknown` or elevated review need, never an automatic low-risk classification.

5. **Implement a versioned, explainable rule registry.**
   - Each rule must declare:
     - stable rule ID and version;
     - applicable decision point;
     - input feature IDs;
     - dimension affected;
     - rationale;
     - monotonicity or interaction behavior;
     - output level or bounded score contribution;
     - tests and owner;
     - activation status and change history.
   - Rule evaluation must be pure and deterministic for the same feature snapshot and policy version.
   - Interactions must be explicit. For example, sparse source detail plus a source-bound named case may be higher risk than either feature alone.
   - Do not continuously update weights from recent runs.

6. **Define capability-based recommendation classes.**
   - Recommendations must refer to approved `IMP-02` task/profile identifiers or abstract capability classes resolved by `IMP-02`.
   - Do not embed raw model names or effort strings in risk rules.
   - Support recommendation categories such as:
     - normal authoring/review route;
     - high-reasoning authoring candidate;
     - source-sensitive verification;
     - causal-claim adjudication;
     - quiz-ambiguity adjudication;
     - constrained repair rather than regeneration;
     - full regeneration rather than repeated repair;
     - diagnostic hold after repeated or novel failure;
     - additional human review candidate.
   - A recommendation may include several capabilities. It must explain which dimension triggered each capability.
   - High risk does not automatically imply every expensive capability.

7. **Define a `ShadowRouteRecommendationV1`.**
   - The artifact must include:
     - decision point and feature-snapshot hash;
     - current actual route/profile ID;
     - recommended route/profile or capability set;
     - reasoning class recommendation if applicable;
     - recommended additional review/adjudication capabilities;
     - repair/regeneration recommendation where applicable;
     - bounded budget class;
     - rule IDs and evidence reasons;
     - missing/unknown features;
     - recommendation policy version;
     - `mode: "shadow"`;
     - explicit statement that no dispatch occurred.
   - The recommendation artifact must be immutable and linked to the later observed outcome.

8. **Preserve the actual route and existing qc-shadow behavior.**
   - In shadow mode, the current conductor continues to use the route selected by `IMP-02` and the existing integrated policy.
   - The risk system may not modify spawn arguments, task class, model profile, effort, reviewer set, repair route, retry count, or state transition.
   - If the existing v24-style risk system currently triggers a `qc-shadow` review, preserve that baseline behavior exactly. Do not silently remove, broaden, or repurpose it.
   - Record the new recommendation beside the actual baseline action for later comparison.

9. **Link recommendations to observed outcomes.**
   - After the relevant attempt concludes, write a `RouteOutcomeLinkV1` or equivalent containing:
     - recommendation ID;
     - actual route/profile and execution fingerprint;
     - provider/process outcome;
     - first-write deterministic and semantic findings;
     - severe defect classes;
     - repair/regeneration count and route;
     - final accepted/not-accepted disposition;
     - token, latency, and cost fields when genuinely available;
     - missing telemetry flags;
     - exact evidence manifest hashes.
   - Do not fabricate price, latency, token, or cost fields when unavailable.
   - Preserve safeguard/refusal, infrastructure failure, content failure, and schema failure as distinct outcomes.

10. **Use approved historical failure memory carefully.**
    - Consume only confirmed or explicitly adjudicated generic features from `IMP-15`.
    - Exclude raw book title, author, chapter ID, and campaign tokens.
    - Record nearest historical cases/clusters, similarity method/version, and whether the current book/chapter was excluded from the historical pool.
    - A same-book or descendant-attempt outcome must not leak into the pre-authoring historical feature.
    - When history is absent or incompatible, mark it unavailable rather than low risk.

11. **Define novelty and repeated-failure handling.**
    - `novel` or `unknown` risk may recommend diagnostic hold or human review, not automatic repeated generation.
    - Repeated failure under the same cause should not trigger unbounded repair.
    - The shadow recommendation should distinguish:
      - ordinary first attempt;
      - known recurring failure pattern;
      - high-severity novel pattern;
      - infrastructure/provider instability;
      - unresolved reviewer disagreement.
    - Do not implement the specialist diagnostic council here. Only emit a structured future escalation recommendation.

12. **Implement shadow calibration reports.**
    - Compare recommendation to actual outcome using prespecified metrics:
      - first-write pass rate;
      - P0/P1 defect incidence;
      - fabrication/source-register/causal/quiz defect incidence;
      - repair and regeneration demand;
      - reviewer disagreement;
      - accepted-chapter latency, tokens, and cost where available;
      - provider and schema failure rates;
      - under-routing and over-routing rates.
    - Define:
      - `under-routing`: recommendation was less protective than the later evidence indicates was needed;
      - `over-routing`: recommendation added expensive capability without measurable need under the evaluation policy;
      - `correct normal route`;
      - `correct escalation candidate`;
      - `inconclusive` due to missing or confounded outcome.
    - Do not infer counterfactual quality from one observed route. The report may say what the router recommended and whether outcome evidence is consistent with it; causal proof requires a later controlled route experiment.

13. **Use held-out, cluster-aware calibration.**
    - Separate rule development/tuning books from evaluation books.
    - Prefer book-level splits or leave-one-book-out analysis. Do not place chapters from one book in both development and held-out sets without explicit leakage analysis.
    - Account for clustering by book and chapter.
    - Report precision/recall or sensitivity/specificity for high-risk classification where labels support it, plus calibration by risk band.
    - For rare P0/P1 defects, report confidence bounds and acknowledge insufficient sample sizes.
    - Freeze metrics, thresholds, and stopping/expansion rules before any activation experiment.

14. **Define activation prerequisites but do not activate.**
    - Implement an `off|shadow|active` policy type only if it fits the centralized configuration design.
    - Default and authorize only `shadow` in this package.
    - `active` must require a separately issued `RoutingActivationManifestV1` or equivalent that binds:
      - rule-policy version;
      - route-policy version;
      - prompt and execution fingerprints;
      - held-out calibration report;
      - under-routing limits for P0/P1;
      - quality non-inferiority requirements;
      - cost/latency objective;
      - approved route matrix;
      - rollback profile;
      - authorization identity and timestamp.
    - Absence, mismatch, staleness, or failed qualification must make active routing impossible.
    - Do not create or approve the activation manifest as part of this package.

15. **Make drift and staleness explicit.**
    - A change to source-plan schema, prompt stack, model alias/snapshot, effort, execution profile, critic, reviewer, repair policy, route policy, risk rules, historical-memory version, or cost model must update the risk/calibration fingerprint.
    - Historical calibration cannot silently carry across incompatible fingerprints.
    - Alias or CLI drift must trigger requalification through the existing activation/canary system.

16. **Provide clear operator and report surfaces.**
    - Provide commands/APIs equivalent to:
      - compute a stage-specific feature snapshot;
      - explain every risk dimension and rule;
      - show actual versus recommended route;
      - list high-risk/unknown recommendations;
      - generate held-out calibration reports;
      - detect leakage and stale calibration;
      - export an activation-candidate package without activating it.
    - Human-readable output must show reasons and missing data, not only one score.

17. **Control cost and runtime.**
    - Shadow scoring must be deterministic and should not add a model call to every chapter.
    - If semantic historical similarity is used, consume cached/versioned `IMP-15` output or a separately bounded offline job.
    - Do not add an always-on specialist team, best-of-N generation, or extra reviewer call in this package.

18. **Preserve experiment integrity.**
    - If the current bakeoff or canary is frozen, shadow telemetry must either be outside the experiment’s tested behavior or produce a new explicit pipeline fingerprint.
    - It must not change candidate prompts, routes, reviewers, repair behavior, or selection.
    - Do not use bakeoff evaluation outcomes to tune rules and then report performance on the same cells as held-out evidence.

### Expected files or surfaces

Likely files or surfaces include, but are not limited to:

- versioned risk feature, dimension, recommendation, outcome-link, calibration, and activation-manifest schemas;
- `src/risk/chapterRisk.ts` or its integrated successor;
- risk-rule registry and stage-availability validator;
- adapters to source plans, briefs, attempt evidence, failure memory, critics, reviews, and repair history;
- shadow hook near centralized routing/orchestration that cannot dispatch;
- compatibility reader/migration for existing risk artifacts;
- calibration/statistical report modules;
- CLI/reporting surfaces;
- fixture factories and hermetic tests;
- documentation for feature provenance, leakage prevention, shadow operation, and activation prerequisites.

Verify exact ownership in the integrated branch. Do not bypass `IMP-02` or create a second model router.

### Tests to add or update

Add or update all applicable tests below.

#### Unit tests

- Risk feature/dimension/recommendation/outcome/calibration schema, hash, and version tests.
- Rule registry determinism and explanation tests.
- Stage-availability and future-feature leakage rejection.
- Missing feature producing `unknown` or explicit elevated need, not low risk.
- Capability recommendations resolving through approved `IMP-02` profile/task IDs.
- No raw model ID or effort literal in risk rules.
- Compatibility and migration tests for legacy `ChapterRiskScoreV1` and `BookRiskScoreV1`.
- Drift/freshness and activation-manifest prerequisite tests.

#### Integration tests

- Pre-authoring snapshot from source/brief/plan only.
- Post-first-write snapshot adding critic/output evidence but not final acceptance.
- Pre-repair snapshot adding repair count, approved findings, base freshness, and reviewer disagreement.
- Shadow recommendation linked to actual route and immutable outcome evidence.
- Shadow mode produces no additional model spawn and no route/state/verdict change.
- Existing qc-shadow behavior remains exactly as the integrated baseline.
- Confirmed generic historical case feature is consumed; same-book/current-outcome leakage is rejected.
- Missing telemetry remains explicit in the calibration report.
- Active mode refuses to start without a current, valid, separately authorized activation manifest.

#### Regression fixtures

Create generic fixtures for at least:

1. low-risk conceptual chapter with adequate source support;
2. sparse source requiring direct explanation rather than invented scene detail;
3. source-bound named case with insufficient hard specifics;
4. several dates/numbers/organizations and attribution-sensitive claims;
5. declared causal mechanism with weak or conflicting evidence;
6. quiz-sensitive chapter with plausible distractor ambiguity;
7. abstract chapter requiring a constructed application;
8. chapter with heavy cross-chapter prerequisite dependence;
9. first write with clean deterministic results;
10. first write with source-register and causal findings;
11. repeated repair failure with the same root cause;
12. reviewer disagreement requiring adjudication;
13. provider safeguard or infrastructure failure;
14. high-severity novel failure with no historical match;
15. known recurring failure cluster from `IMP-15`;
16. missing source/risk feature data;
17. legacy risk artifact migration;
18. stale calibration after prompt/model/critic/rule change.

#### Negative and failure-path tests

- Pre-authoring snapshot reads evidence map or review output from the future.
- Same book appears in both rule tuning and held-out calibration without warning.
- Missing data is treated as zero risk.
- Risk rule sets raw `gpt-*` model ID or effort directly.
- Recommendation causes an actual spawn/route change in shadow mode.
- Historical feature contains book title, chapter ID, author, or campaign token.
- Cost/latency/token values are fabricated when unavailable.
- Provider safeguard is classified as content defect.
- Calibration result remains valid after incompatible drift.
- Active routing starts without authorization or with stale manifest.
- Existing qc-shadow behavior changes unintentionally.

#### Red-team cases

- A chapter looks low risk only because the source packet is missing.
- A model writes “I am highly confident,” attempting to lower risk.
- A later successful repair leaks backward and makes pre-authoring risk look accurate.
- A high-risk score indiscriminately recommends xhigh, extra judges, and regeneration.
- A book-specific phrase becomes a strong historical predictor.
- A router appears accurate because it was evaluated on the same books used to tune it.
- A P1 defect occurs in the low-risk band but is hidden by average cost savings.
- A model alias or CLI changes while old calibration is still treated as current.
- Shadow mode silently changes a retry budget or reviewer set.
- An activation manifest is generated and approved by the same automated process.

### Verification procedure

1. Record exact baseline identity and contract versions.
2. Produce a requirement-to-code-to-test matrix for all `RR-*` requirements.
3. Show final schemas, decision-point matrix, feature-availability matrix, and rule registry.
4. Show migration/compatibility behavior for the current risk artifacts.
5. For each fixture, display dimension-level risk, reasons, missing data, and recommendation.
6. Prove a pre-authoring snapshot cannot access post-authoring, review, repair, or acceptance artifacts.
7. Prove risk rules contain no raw model/effort route and resolve only through `IMP-02`.
8. Run the same synthetic pipeline fixture with risk `off` and `shadow`; prove model calls, routes, retries, reviewer set, repair decisions, gate outcomes, and canonical outputs are identical apart from isolated telemetry artifacts.
9. Demonstrate actual-versus-recommended linkage and held-out calibration reports with clustered uncertainty.
10. Show an under-routed P1 fixture remains visible and cannot be averaged away by cost savings.
11. Demonstrate stale calibration after model/prompt/execution/critic/rule drift.
12. Demonstrate active routing refusal without a valid separately authorized activation manifest.
13. Run focused tests and the full hermetic migration suite.
14. Inspect all model-spawn and route call sites for unintended shadow influence.
15. Provide exact commands and unedited results.

### Rollback criteria

Stop, revert, or leave this package unmerged if any of the following occurs:

- shadow mode changes an actual route, model, effort, reviewer set, repair path, retry, gate, verdict, or publication behavior;
- the risk engine bypasses or duplicates `IMP-02`;
- a pre-authoring feature contains future outcome information;
- missing data is treated as low risk;
- raw model IDs or effort strings are hard-coded in risk rules;
- the legacy risk interface changes silently or existing qc-shadow behavior regresses;
- a learned/online-updating router is introduced without separate authorization;
- a book-specific or campaign-specific feature is introduced;
- calibration uses the same books for tuning and held-out claims without disclosure;
- P0/P1 under-routing can be hidden by aggregate cost or pass-rate metrics;
- active routing is possible without a current external authorization manifest;
- a frozen bakeoff/canary profile is modified without requalification;
- broad unrelated changes are required to make tests pass.

### Red-team checklist

- Can current-chapter future evidence enter a pre-authoring snapshot?
- Can missing source data make the chapter look safe?
- Can model self-confidence affect routing materially?
- Can the risk engine choose a raw model outside `IMP-02`?
- Can shadow mode alter any actual execution decision?
- Can a high-risk label trigger every expensive mechanism without specificity?
- Can a book title or chapter token become a predictor?
- Can a same-book outcome contaminate historical recurrence features?
- Can old calibration survive model, prompt, critic, or rule drift?
- Can cost savings average away a low-risk P1 failure?
- Can the system activate itself or approve its own activation manifest?
- Can existing qc-shadow behavior change under the guise of compatibility migration?

### Deliverables

Provide:

1. Exact baseline tree/commit identity and consumed contract versions.
2. Files changed, added, and deleted.
3. Final risk feature, dimension, recommendation, outcome-link, calibration, and activation-prerequisite schemas.
4. Decision-point and feature-availability matrices.
5. Explainable rule catalog with stable IDs and rationale.
6. Existing-risk compatibility/migration design.
7. Shadow orchestration data flow proving no dispatch effect.
8. Actual-versus-recommended outcome linkage and calibration report format.
9. Leakage prevention, held-out split, clustered analysis, drift, and requalification design.
10. Tests required, exact tests run, unedited results, and fixture inventory.
11. Proof that existing model routing, qc-shadow behavior, retries, gates, and publication behavior were unchanged.
12. Activation prerequisites and explicit statement that no activation was performed.
13. Risks, unresolved questions, and data required before active routing can be considered.
14. Explicit statement of all actions not performed, including real book generation, publication, deployment, upload, commit, and push.

Emit both:

- a narrative implementation report; and
- `implementation-report.imp-17.json` conforming to the frozen worker-report schema.

The JSON must explicitly include baseline/result hashes, contract versions, files changed, requirements implemented, tests required/run/results, gate changes, mode default, actual route changes, legacy risk migration, model/network calls made, book-specific exceptions, unexpected writes, unresolved risks, dependency assumptions, calibration dataset split, and whether any bakeoff/canary/activation fingerprint changed. Empty and adverse fields must be explicit. The narrative and JSON reports must agree.

### Constraints

- Shadow mode only.
- No gate weakening.
- No book-specific or chapter-specific hacks.
- No raw model/effort routing outside `IMP-02`.
- No temporal leakage or missing-data-to-low-risk shortcut.
- No learned, self-updating, bandit, or reinforcement router in this package.
- No specialist swarm, best-of-N, or extra model call on every chapter.
- No silent fallback, unbounded retry, or replay-until-pass.
- No active routing without a separate current authorization manifest and requalification.
- No permanent routing back to GPT-5.5.
- No publish, promote, deploy, S3 upload, package mutation, production activation, commit, or push unless separately authorized.
- No use of production state as a test fixture.
- No modification of a frozen bakeoff or canary profile without a new fingerprint and requalification decision.
- Preserve backward compatibility or provide an explicit, tested migration path.

