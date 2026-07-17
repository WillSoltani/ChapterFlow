# Claude Fable 5 Ultracode — V25 Evaluator, Model Selection, and Implementation Orchestrator

Copy everything between BEGIN PROMPT and END PROMPT into a fresh Claude Fable 5 session with Ultracode enabled.

---

## BEGIN PROMPT

You are Claude Fable 5 operating with Ultracode enabled. Act as the principal ChapterFlow V25 pipeline architect, experimental-design lead, implementation orchestrator, adversarial reviewer, and release-quality verifier.

You may use Claude-family agents to inspect, plan, implement, test, and red-team code. You must not use Claude, Fable, Sonnet, or Opus to rate a ChapterFlow book or chapter. Content ratings have separate, explicit routes defined below.

### 1. Mission

Reconstruct the current V25 implementation truth, revise the existing audit and model-test plan around the new ChapterFlow quality standard, then implement the smallest safe set of fixes that makes the pipeline fair, efficient, testable, resumable, and trustworthy without overengineering it.

The revised system must:

1. Make the repo-local Codex ChapterFlow Book Evaluator the canonical standard for book quality.
2. Route D7 book/chapter review to GPT-5.6 Sol with Ultra reasoning, never to Claude.
3. Preserve Luna, Terra, and Sol as author-model candidates until a larger, blinded, paired chapter experiment is complete.
4. Learn useful design patterns from highly rated ChapterFlow books without leaking their scores, identities, or content into blind evaluator jobs.
5. Use up to eight concurrent worker agents when the dependency graph and file ownership make parallel work safe. Do not impose a two-agent cap.
6. Give every finding a complete implementation packet: evidence, cause, effect, fix, acceptance tests, dependencies, ownership, difficulty, sensitivity, execution model, and reasoning level.
7. Test normal and failure paths, conduct fresh-context red-team reviews, run exact-head verification, and return only evidence-backed claims.
8. Avoid a second migration framework, duplicate scoring system, or unnecessary control plane.

This is an implementation-orchestration assignment, not another planning-only audit. Plan and freeze the work first, then proceed with authorized implementation without waiting for a ceremonial approval. Stop only for a genuine owner decision, unavailable authority, unsafe external side effect, or live-model budget that is not already authorized.

### 2. Owner context

Treat the following as owner-supplied context that must be investigated and reconciled with repository evidence:

- Do not use Claude to rate books or chapters.
- The new canonical quality standard is the Codex skill named ChapterFlow Book Evaluator under .agents/skills/chapterflow-book-evaluator.
- That skill uses a better rubric than the current Claude-side D7 instrument. A high score under that rubric is the new standard.
- A 140-book ChapterFlow portfolio has already been rated. Some books scored very well and some scored poorly.
- Inspect at least one genuinely highly rated book to understand the observable content-design patterns ChapterFlow considers strong.
- In the owner’s independent one-chapter Nudge comparison, Luna scored about 87, Terra about 84, and Sol about 79.
- That comparison is only one generated chapter per model and is not enough to select a final author model.
- Owner-supplied cost order is: Luna cheapest, Terra middle, Sol most expensive.
- If a cheaper model is credibly better, or quality-equivalent within a pre-registered uncertainty band, the cheaper model should become the preferred candidate.
- D7 may use GPT-5.6 Sol with Ultra reasoning for book or chapter review. It must not use Claude.
- Do not generate a whole book until the chapter experiment demonstrates that a candidate is ready for a separately authorized full-book pilot.
- Codex orchestration can use up to eight concurrent agents. Use that capacity intelligently; do not force all work through two agents.

Do not fabricate exact prices, scores, provider capabilities, or model identifiers that cannot be verified. Preserve owner-supplied observations as prior evidence, not as conclusions.

### 3. Known evidence leads that must be reverified

These are time-sensitive leads, not permission to skip investigation:

- The existing audit and visual plan are:
  - docs/v25/V25_PIPELINE_AUDIT_AND_MODEL_TEST_PLAN.md
  - docs/v25/V25_PIPELINE_AUDIT_AND_MODEL_TEST_PLAN.html
- The prior handoff prompt is:
  - docs/v25/CLAUDE_FABLE_5_ULTRACODE_V25_AUDIT_AND_TEST_PLAN_PROMPT.md
- The evaluator skill is:
  - .agents/skills/chapterflow-book-evaluator/SKILL.md
- The curated portfolio snapshot is:
  - docs/v25/chapterflow-140-evaluation/chapterflow-140-evaluation-report-data.json
  - docs/v25/chapterflow-140-evaluation/chapterflow-140-evaluation-report.html
  - docs/v25/chapterflow-140-evaluation/README.md
- At the time this prompt was prepared, that snapshot identified itself as a 140-book single-evaluator screening audit, not a uniformly dual-blind adjudicated cohort. It reported 1,903 chapter evidence records. Verify current metadata and method provenance before using ranks.
- At the time this prompt was prepared, leading snapshot entries included Difficult Conversations at 90.1, The Willpower Instinct at 89.7, The Power of Moments at 89.0, Decisive at 88.0, Behave and Peak at 87.9, and Make It Stick at 87.4. Re-read the current data; do not assume these values are unchanged.
- At the time this prompt was prepared, newer standalone chapter-audit artifacts under artifacts/chapterflow-chapter-audits did not reproduce the owner’s remembered Luna 87, Terra 84, Sol 79 ordering. One run showed an unlabeled Nudge chapter at about 85.3, and a later run showed Sol about 81.4 and Terra about 75.2. Those may be different candidates, runs, or source hashes. Reconcile provenance; never silently replace the owner’s observation or merge incompatible runs.
- Standalone chapter-audit records explicitly mark the full-book score and certification unevaluable and Domain 9 unassessable. Preserve that boundary.
- The prior V25 audit recorded fifteen issue groups, including candidate censorship by readability, fragile D7 arithmetic, stale selection artifacts, weak calibration, branch drift, broken or mistargeted CI, misleading empty scoreboards, unusable cost accounting, command-dependent gates, auto-publish drift, stale status documents, weak ship-path independence, excessive complexity, committed run debris, and smaller bakeoff/legacy defects.

If current evidence differs, record the old claim, current fact, source paths, and consequence. Never choose the version that makes implementation easier.

### 4. Authority order

Resolve conflicts in this order:

1. Platform, system, tool, provider, and safety rules.
2. The nearest applicable AGENTS.md and repository-local instructions.
3. This prompt and explicit owner constraints.
4. Current executable code, tests, schemas, configuration, and run artifacts at the verified authoritative head.
5. Current Git and CI evidence.
6. The ChapterFlow Book Evaluator skill and its normative references for content evaluation.
7. Current plans and reports.
8. Historical plans, comments, status prose, and unverified recollection.

Code is evidence of behavior, not proof of correctness. Documentation is evidence of intent, not proof of current state. Surface every material conflict.

### 5. Non-negotiable boundaries

- Claude-family models may orchestrate and implement but may not assign, revise, adjudicate, calibrate, or certify book/chapter quality scores.
- Canonical book scoring must run through Codex using .agents/skills/chapterflow-book-evaluator.
- Never reproduce the evaluator approximately inside Claude. Do not paste a simplified rubric into a Claude rater and call it equivalent.
- D7 must route to GPT-5.6 Sol with Ultra reasoning through the real model-routing and execution envelope. A prompt string claiming Sol Ultra is not proof; receipts and ledgers must prove the selected route.
- D7 is an operational reviewer/gate, not the canonical portfolio evaluator. It may not override a source-bound ChapterFlow Book Evaluator result.
- A selected-chapter score is a chapter diagnostic only. It is not a full-book score, certification, or evidence of whole-book coherence.
- Do not expose high-rated book names, prior portfolio scores, remediation prompts, candidate model identities, or comparative rankings to blind evaluator workers.
- Do not generate a whole book in this assignment.
- Do not change the production author default based on the owner’s one-chapter result or any invalid/incomplete historical bakeoff.
- Do not weaken thresholds, retry until a preferred model wins, remove unfavorable samples, change prompts after unblinding, or relabel a gate failure as a pass.
- Preserve every attempt and failure. Never delete failed evidence merely because a retry succeeds.
- Preserve unrelated dirty and untracked files. Never reset, clean, stash, overwrite, or delete owner work.
- Use isolated branches/worktrees for implementation workers. Do not let agents concurrently edit the same owned files.
- Do not push, open a PR, merge, publish, deploy, or change a protected branch unless the launching session separately authorizes that external action.
- Follow the root QC rule: after repair changes chapter content, do not resume an old QC round; run qc-diagnose before another repair loop and begin a fresh qc-auto pass.
- Never claim a command passed unless it was run against the exact integrated head and its exit status was captured.

### 6. Required preflight and source reading

Before revising the plan or assigning implementation:

1. Read every applicable AGENTS.md completely.
2. Record checkout path, branch, HEAD, dirty state, remotes, worktrees, local/remote V25 refs, merge bases, and active isolated worktrees.
3. Identify the authoritative V25 implementation head. Do not assume the visible checkout or a historical audit SHA is current.
4. Read the existing Markdown audit and inspect the HTML’s embedded data and visual claims.
5. Read .agents/skills/chapterflow-book-evaluator/SKILL.md completely.
6. Read every evaluator reference applicable to this work completely, including at minimum:
   - references/rubric-v2.md
   - references/scoring-protocol.md
   - references/book-rater-prompt.md
   - references/adjudication-protocol.md
   - references/report-spec.md
   - all schemas and receipt contracts used by any adapter you implement
7. Inspect the evaluator scripts and tests that enforce discovery, source hashing, full-content coverage, blind receipts, pair seals, validation, arithmetic, aggregation, report mutation, and HTML safety.
8. Read the 140-book snapshot README, canonical data, method warning, ranks, per-book provenance if present, and report limitations.
9. Inspect the current Nudge comparison inputs, source hashes, candidate identity mapping, generation manifests, evaluator records, and any retained owner score record. Build a provenance table before quoting a score.
10. Trace the current D7 implementation, author-model routing, bakeoff path, telemetry, publication gates, CI, and resume logic from real entrypoints.

Keep large chapter prose out of the orchestrator context. Pass agents paths, hashes, job IDs, contracts, and precise questions.

### 7. Mandatory GitHub MCP research before plan modification

Use the connected GitHub MCP connector, not a generic recollection, to inspect shanraisshan/claude-code-best-practice before changing the plan. Record the repository commit/ref and exact files consulted.

Start with:

- README.md
- tips/claude-boris-2-tips-10-mar-26.md
- tips/claude-boris-2-tips-25-mar-26.md
- tips/claude-boris-13-tips-03-jan-26.md
- tips/claude-boris-15-tips-30-mar-26.md
- implementation/claude-agent-teams-implementation.md

Extract only practices that fit this repository. At minimum, consider:

- plan first, then execute against a frozen contract;
- safe parallelism through isolated worktrees and explicit file ownership;
- a shared task list and shared data contracts;
- small, focused vertical slices that are easy to review, revert, and integrate;
- independent fresh contexts as test-time compute;
- giving each implementation agent a concrete verification loop;
- deterministic hooks or scripts for repetitive validation;
- preserving permission boundaries instead of bypassing them.

Do not copy the reference repository wholesale, create a large agent-team framework, or use dangerous permission-skipping flags. In the revised plan, include a short Adopted / Adapted / Rejected table with reasons.

### 8. Canonical evaluation architecture

Design and implement one clear hierarchy:

#### 8.1 Full-book release standard

The ChapterFlow Book Evaluator v2.0 is the canonical full-book quality authority.

For a scoreable full book it requires:

- the current package hash and immutable ordered source inventory;
- every chapter and every reader-facing component read in full;
- exactly one full-read evidence record per inventory entry;
- nine weighted domains and all 36 subcriteria;
- five gates assessed independently from score;
- two mutually blind raters in distinct task and session identities;
- source/inventory/job/role-bound dispatch receipts;
- a sealed pair receipt binding both exact results;
- a fresh adjudicator working from source plus the validated blind pair;
- deterministic score arithmetic and schema validation;
- no prior score, reputation, remediation prompt, other book, or external factual lookup in the rater context.

Incomplete, partial, duplicated, inaccessible, reordered, or source-drifted content is unevaluable. A high weighted score never clears a failed gate. External accuracy remains not assessed unless separately authorized.

Do not make the Fable orchestrator a book rater. Dispatch evaluator work to Codex workers that invoke the repo-local skill faithfully. If the environment cannot dispatch Codex workers, implement and validate the integration boundary, produce exact pending job manifests, and stop that evaluation step as BLOCKED_NO_CODEX_RATER. Never substitute Claude.

#### 8.2 Chapter-screening diagnostic

The pre-book experiment may use a standalone chapter audit grounded in the same rubric, but it must:

- label scope as standalone chapter audit;
- set full-book score, certification, and confidence to unevaluable;
- mark whole-book Domain 9 unassessable;
- score only the domains that can be supported by the supplied chapter;
- retain source hashes, section inventory, blind-worker receipts, pair seal, and fresh adjudication;
- clearly state that retention spacing and whole-book coherence cannot be inferred;
- use identical protocol and validation across Sol, Terra, and Luna.

Do not compare a chapter diagnostic directly with a full-book Content Design Score as if they were the same construct.

#### 8.3 D7 operational reviewer

D7 must use GPT-5.6 Sol with Ultra reasoning. It may review a candidate chapter or complete book for an operational gate, but:

- its identity must be proven in the execution receipt and ledger;
- atomic ratings/evidence are model outputs; arithmetic is derived deterministically in code;
- every attempt is persisted; retries are capped and role-scoped;
- calibration spans the actual decision band;
- candidate identity remains blinded;
- its verdict is secondary to the canonical evaluator;
- a failed or missing D7 record cannot be hidden by a later retry.

Because Sol is also an author candidate, explicitly test for model-family judge interaction. Compare D7 deltas against the Codex evaluator’s blinded deltas. If D7 systematically favors or penalizes Sol-authored content, D7 may remain a safety/operational check but cannot be the sole model-selection statistic.

#### 8.4 High-quality content anchors

Use the portfolio report to select at least one and preferably two or three high-scoring books with different nonfiction types. Verify each source package exists and its current hash matches the report record.

In a separate, non-rater context:

- read the selected books’ reader-facing content;
- extract observable patterns mapped to the nine rubric domains;
- contrast them with one lower-scoring book only when useful;
- distinguish real quality patterns from mere component quantity or template conformity;
- produce authoring guidance stated as principles, not copied prose.

The snapshot’s prior scores may choose the anchor-study sample, but they must never enter blind rating contexts. If the snapshot is single-evaluator or mixed-method, label the anchor study qualitative and method-limited.

### 9. Reconcile the evidence before designing the test

Create a provenance matrix with one row per claimed Sol/Terra/Luna result:

| Required field | Meaning |
|---|---|
| Claim source | Owner statement, generation manifest, rater record, adjudication, report, or derived computation |
| Candidate model | Verified model and effort, or unknown |
| Candidate source hash | Exact generated chapter hash |
| Prompt/config hash | Frozen generation contract |
| Evaluator method | Legacy D7, standalone evaluator audit, full-book evaluator, or other |
| Rater identities | Task/session/model evidence |
| Score construct | Chapter diagnostic, D7 composite, or full-book score |
| Score | Full precision plus displayed value |
| Gates | Independent statuses |
| Date/run ID | Exact provenance |
| Comparability | Comparable, partially comparable, or incompatible |
| Disposition | Retain as prior, use in analysis, or exclude with reason |

Do not average scores from different source hashes, rubrics, scopes, efforts, prompts, or evaluator methods. If the owner’s 87/84/79 record cannot be located, retain it as OWNER-SUPPLIED_PRELIMINARY and design the new test to resolve it.

### 10. Required model-comparison experiment

The experiment must be written and frozen before new candidate generation.

#### 10.1 Decision

The immediate decision is which model or models earn a separately authorized full-book pilot. Chapter samples alone do not certify a production default.

The eventual production-default rule is:

- choose the cheaper model when it is credibly better;
- choose the cheaper model when it is quality-noninferior within a pre-registered, rubric-grounded margin and is materially cheaper;
- retain Sol when cheaper candidates are meaningfully worse, less reliable, or fail hard gates;
- return INCONCLUSIVE when uncertainty remains; do not move the bar after seeing identities.

#### 10.2 Frozen controls

Hold constant across Sol, Terra, and Luna:

- source material and chapter assignment;
- generation prompt, schema, tools, retrieval inputs, context limits, and safety rules;
- reasoning/effort for the primary family comparison;
- execution envelope and timeout policy;
- deterministic preflight and post-generation diagnostics;
- number of independent generations;
- chapter-audit protocol and D7 protocol;
- retry caps and failure classification.

Treat effort sensitivity as a separate arm. Do not mix a Sol-high versus Sol-Ultra question into the author-family comparison.

#### 10.3 Sample structure

Derive and justify the smallest credible design. Use the prior audit’s three chapter blocks by two independent generations per model as the default starting hypothesis, not an unquestionable mandate:

- Stage 0: model-free instrument validation plus a bounded reviewer/calibration shakedown.
- Stage 1: at least three frozen chapter blocks that exercise different nonfiction demands, with two independent generations per model when budget permits.
- Stage 2: a pre-declared held-out confirmation set for the top one or two candidates, used only if Stage 1 is promising or tied.
- Stage 3: recommendation for a separately authorized full-book pilot; no whole-book generation here.

Choose chapter blocks before candidate identity is revealed. Include contrasting demands such as mechanism explanation, practical judgment, epistemic nuance, learning design, and narrative engagement. Avoid selecting only material where one model is known to excel.

If a sequential design is used, pre-register its minimum sample, maximum sample, continuation triggers, and stopping rules. A failed candidate remains in the denominator. Do not add samples selectively to rescue one model.

#### 10.4 Blinding and independence

- Assign opaque candidate IDs before reviewers see content.
- Remove model names, route metadata, filesystem paths, timestamps, and stylistic headers that reveal identity.
- Use independent author sessions for every replicate.
- Use mutually blind evaluator workers and a fresh adjudicator for each candidate chapter.
- Do not let the content-anchor study agent rate candidates.
- Do not let the implementation author perform final acceptance of its own slice.
- Preserve the blind key until all primary records, D7 records, gates, and analysis code are frozen.

#### 10.5 Outcomes

Primary chapter-screen outcome:

- adjudicated standalone ChapterFlow evaluator diagnostic over assessable domains, with gates and uncertainty;
- never presented as a full-book score.

Secondary outcomes:

- D7 Sol-Ultra operational score/verdict;
- disagreement between D7 and the canonical evaluator-derived chapter diagnostic;
- deterministic defects and gate rates;
- completion rate, timeout rate, retry rate, and invalid-record rate;
- latency and true model-call count;
- dated, versioned estimated cost and cost per accepted chapter when a verified price table exists;
- qualitative defect taxonomy by rubric domain.

Do not use prose fluency, evaluator confidence, or component count as a substitute for rubric evidence.

#### 10.6 Analysis

- Analyze candidates as paired/blocked observations by chapter assignment and replicate.
- Report per-model means, medians, spread, paired differences, uncertainty intervals, gate rates, and worst-case chapter.
- Treat chapters, not individual subcriteria, as the experimental units.
- Do not present pseudo-precision from 36 correlated subcriteria as 36 independent samples.
- Report practical effect size and decision-margin crossing, not only a p-value.
- Check model-by-chapter interaction and D7-judge-by-author-model interaction.
- Show quality, reliability, latency, and cost separately before applying the decision rule.
- Keep the blind analysis output immutable; unblind only after it validates.

#### 10.7 Cost truth

Until a dated, approved price table is present, preserve:

- Luna cheapest: OWNER-SUPPLIED, PRICE NOT VERIFIED
- Terra middle: OWNER-SUPPLIED, PRICE NOT VERIFIED
- Sol most expensive: OWNER-SUPPLIED, PRICE NOT VERIFIED

Do not invent dollar figures. Distinguish real model sessions from free re-ingests, validation, or cached reads. Stamp price-table version and effective date into every cost rollup.

### 11. Finding contract

Every confirmed issue and every retained hypothesis must appear in the canonical Markdown plan with all fields below:

| Field | Required content |
|---|---|
| ID | Stable identifier |
| Title | One-sentence defect |
| Status | Confirmed, probable, hypothesis, resolved, superseded, or not reproducible |
| Severity | Critical, high, medium, or low impact |
| Difficulty | Easy, medium, or hard implementation |
| Sensitivity | Low, moderate, high, or critical consequence if mishandled |
| Execution route | Sonnet 5 or Opus 4.8 plus high or xhigh reasoning |
| Evidence | Exact current file paths, symbols/lines, run IDs, hashes, and tests |
| Current behavior | What happens now |
| Issue | Why it is wrong or unproven |
| Root cause | Smallest credible cause |
| Consequence | Quality, validity, cost, latency, safety, reliability, maintainability, or operator-trust effect |
| Recommended fix | Smallest safe vertical slice |
| Inputs | Contracts, data, decisions, and dependencies |
| Outputs | Code, schema, artifact, or behavior produced |
| Acceptance tests | Unit, contract, integration, failure-injection, and exact-head checks |
| Red-team attack | How an independent reviewer tries to break or falsify the fix |
| File ownership | Files/directories assigned to one lane |
| Dependencies | Work packages that must land first |
| Non-goals | Explicit overengineering guard |
| Residual risk | What remains after the fix |

Severity, difficulty, and sensitivity are separate. A simple change can be high sensitivity.

### 12. Model and reasoning assignment

Apply this routing to findings and work packages:

- EASY: Sonnet 5, high reasoning.
- MEDIUM: Sonnet 5, high reasoning; use xhigh when sensitivity is high/critical, the slice changes evaluation evidence, or concurrency/resume semantics are involved.
- HARD: Opus 4.8, xhigh reasoning.
- Any evaluator-isolation, blind-receipt, model-routing, publication, statistical-decision, source-hash, or cross-cutting state-machine change should normally be HARD unless evidence proves it is truly bounded.
- Independent final red-team for high/critical-sensitivity work: Opus 4.8, xhigh, in a fresh context.

These Claude-family assignments are for code and plan work only. They do not authorize Claude-family content rating.

If a named model is unavailable, do not silently substitute. Record the unavailable route and either obtain owner approval for a substitute or mark the work package blocked while continuing independent packages.

### 13. Seed issue register to revalidate

Do not copy these forward blindly. Reproduce each issue at the current authoritative head, revise its impact after the evaluator/D7 policy change, and add newly discovered issues.

| Seed | Topic | Suggested difficulty | Suggested sensitivity | Default route |
|---|---|---|---|---|
| V25-AUD-01 | Readability proxy censors candidate generation before semantic measurement | Medium | Critical | Sonnet 5 xhigh |
| V25-AUD-02 | Reviewer asks the model for deterministic arithmetic, loses failed attempts, and lacks a hard cap | Hard | Critical | Opus 4.8 xhigh |
| V25-AUD-03 | Selection artifacts can be minted from non-terminal state and remain stale | Medium | Critical | Sonnet 5 xhigh |
| V25-AUD-04 | Reviewer calibration does not span the actual decision boundary | Hard | Critical | Opus 4.8 xhigh |
| V25-AUD-05 | Branch/worktree/remote authority drift | Medium | High | Sonnet 5 xhigh |
| V25-AUD-06 | CI is broken, mistargeted, or validates a legacy package | Medium | High | Sonnet 5 xhigh |
| V25-AUD-07 | Reports can present a scoreboard over zero valid comparisons | Easy | High | Sonnet 5 high |
| V25-AUD-08 | Ledger cannot distinguish spend from re-ingest or support verified economics | Medium | High | Sonnet 5 xhigh |
| V25-AUD-09 | Strong gates depend on the operator verb and may default off | Hard | Critical | Opus 4.8 xhigh |
| V25-AUD-10 | Generate-book publication default conflicts with owner intent | Easy | Critical | Sonnet 5 xhigh |
| V25-AUD-11 | Status documents contradict code and one another | Medium | Moderate | Sonnet 5 high |
| V25-AUD-12 | Ship-path independence, receipt binding, and contract freezing are incomplete | Hard | Critical | Opus 4.8 xhigh |
| V25-AUD-13 | Excessive surface area and live code inside historical migration paths | Hard | High | Opus 4.8 xhigh |
| V25-AUD-14 | Generated evidence is committed without a retention boundary | Medium | High | Sonnet 5 high |
| V25-AUD-15a | Stage-specific plan-artifact gate weakness | Medium | High | Sonnet 5 xhigh |
| V25-AUD-15b | Residual identity leakage in paths/calibration units | Medium | High | Sonnet 5 xhigh |
| V25-AUD-15c | Legacy direct model transport bypasses the hermetic envelope | Hard | Critical | Opus 4.8 xhigh |
| V25-AUD-15d | Stale model-selection environment remnants | Easy | Moderate | Sonnet 5 high |
| V25-AUD-15e | A dead delegate branch can exit successfully without running | Easy | High | Sonnet 5 high |
| V25-AUD-15f | Retry choreography may rerun an entire pair instead of one failed role | Hard | High | Opus 4.8 xhigh |
| V25-NEW-01 | Claude-side rating conflicts with the canonical Codex evaluator policy | Hard | Critical | Opus 4.8 xhigh |
| V25-NEW-02 | The 140-book snapshot may be single-evaluator or mixed-method, limiting score comparability | Hard | High | Opus 4.8 xhigh |
| V25-NEW-03 | Owner 87/84/79 result conflicts with or is absent from newer local artifacts | Medium | High | Sonnet 5 xhigh |
| V25-NEW-04 | Sol-Ultra D7 may have author-family interaction when Sol is a candidate | Hard | Critical | Opus 4.8 xhigh |
| V25-NEW-05 | Chapter diagnostics can be mistaken for full-book scores/certification | Hard | Critical | Opus 4.8 xhigh |
| V25-NEW-06 | Cost ordering lacks a versioned, verified price table | Medium | High | Sonnet 5 xhigh |
| V25-NEW-07 | Eight-agent fan-out can create file conflicts or invalid shared-state evidence | Hard | High | Opus 4.8 xhigh |

Superseding a finding requires evidence and a replacement ID or explicit no-longer-applicable rationale.

### 14. Roadmap and execution lanes

Use a dependency graph, not a serial checklist. The orchestrator owns integration and shared contracts. Up to eight workers may run concurrently after Wave 0 freezes interfaces and file ownership.

#### Wave 0 — Truth, contracts, and plan freeze

Single-writer work:

1. Verify authoritative head and create an isolated integration worktree.
2. Build the evidence/provenance matrix.
3. Revalidate the issue register.
4. Freeze evaluator/D7 roles, schemas, file ownership, test commands, experiment contract, and live-call authority.
5. Write and red-team the revised Markdown plan and visual HTML.
6. Create a shared task ledger containing IDs, dependencies, owners, worktrees, status, commits, validators, and review disposition.

Once Wave 0 is internally consistent and no genuine owner decision blocks local implementation, proceed automatically.

#### Wave 1 — Parallel foundations

| Lane | Outcome | Initial ownership boundary | Model route | Depends on |
|---|---|---|---|---|
| L1 Evaluator | Codex evaluator adapter, source/receipt contracts, chapter-diagnostic boundary | New evaluation adapter modules, evaluator contract registrations, evaluator-specific tests | Opus 4.8 xhigh | Wave 0 |
| L2 D7 route | GPT-5.6 Sol Ultra routing, deterministic arithmetic, attempt persistence/caps, decision-band calibration | D7 judge/gate modules and D7-specific provider/receipt tests | Opus 4.8 xhigh | Wave 0 |
| L3 Experiment | Fair candidate generation, measure-only bakeoff diagnostics, terminal selection, blinding, sequential stop rules | Candidate/screening/selection modules excluding files owned by L2 | Opus 4.8 xhigh | Wave 0 |
| L4 Economics | True-session ledger, retry/re-ingest distinction, price-table contract, cost rollups | Telemetry and cost-report modules | Sonnet 5 xhigh | Wave 0 |
| L5 Content anchors | Read-only high-quality pattern study and author-prompt recommendations | One dedicated docs artifact; no evaluator records or candidate files | Sonnet 5 high | Wave 0 |
| L6 CI/operator | Current package workspace targeting, workflow repair, generated status truth, safe CLI surface | Root scripts, workflow files, generated status script; no production evaluator logic | Sonnet 5 xhigh | Wave 0 |
| L7 Red-team preparation | Threat model, failure-injection fixtures, cross-lane acceptance matrix | New adversarial fixtures and review checklist; read-only against production files | Opus 4.8 xhigh | Wave 0 |

If current file topology makes two lane boundaries overlap, sequence those packages or move one file to a single owner. Never rely on agents “being careful” in the same file.

#### Wave 2 — Vertical implementation slices

Within each lane, implement the smallest end-to-end slice:

1. Contract/schema and failing test.
2. Minimal production change.
3. Unit and contract validation.
4. Focused integration test.
5. Failure injection.
6. Fresh-context review.
7. Commit with evidence and hand back to orchestrator.

Prefer focused changes that remain easy to inspect and revert. Split a large cross-cutting change by behavior, not by arbitrary file count. Do not create a new framework solely to make the work package look tidy.

#### Wave 3 — Controlled integration

Integrate in dependency order:

1. evaluator and D7 contracts;
2. candidate/selection state;
3. telemetry/economics;
4. CLI/CI/status;
5. documentation and visual plan generated from current truth.

After each integration batch:

- rerun affected unit/contract tests;
- run import/contract drift checks;
- test resume and partial-failure behavior;
- confirm model routing and no-Claude-rating invariants;
- update the task ledger from command output, not memory.

#### Wave 4 — Adversarial verification

Use fresh agents that did not author the slice. Attack:

- Claude accidentally entering a rating path;
- candidate identity leaking through path, prompt, metadata, or context;
- high-rated anchor scores leaking to evaluator workers;
- partial chapter inventory passing as a book;
- stale source hash or reordered chapter evidence;
- cloned blind judgments or task/session identity collisions;
- missing, tampered, or stale receipt chains;
- D7 model-route spoofing;
- aggregate arithmetic mismatches;
- retries erasing failures or exceeding caps;
- a non-terminal run producing a final scoreboard;
- a resumed run duplicating spend;
- Sol-family D7 interaction with Sol-authored candidates;
- an unavailable price table yielding fabricated cost;
- an alternate CLI verb bypassing a gate;
- default publication without explicit authorization;
- concurrent worktrees writing shared run state;
- malicious strings or unsafe embedding in the visual report.

No high/critical finding is accepted until its red-team disposition is recorded.

#### Wave 5 — Bounded shakedown and chapter experiment

Only if live model calls are explicitly authorized in the current session:

1. Run the minimal Stage 0 reviewer/instrument shakedown.
2. Stop if calibration, model identity, receipts, attempt persistence, or terminal selection fails.
3. Freeze the experiment manifest and blind key.
4. Run the pre-registered chapter campaign within the hard call/session ceiling.
5. Validate and seal results before unblinding.
6. Produce a recommendation for a full-book pilot or INCONCLUSIVE.
7. Do not generate the full book.

If live calls are not authorized, finish all code, fixtures, manifests, dry-run proofs, and commands; report READY_FOR_LIVE_TEST with the exact remaining authorization and bounded budget required.

#### Wave 6 — Exact-head release evidence

On the fully integrated head:

- run format/lint/typecheck/build as applicable;
- run all affected unit, contract, integration, failure-injection, evaluator-skill, HTML-safety, and CLI tests;
- run the V25 package CI-equivalent commands locally;
- verify the root command targets the current V25 package;
- run a fresh independent final review;
- confirm no unresolved Critical or High defect and no false pass claim;
- record exact commands, timestamps, exit codes, commit SHA, and residual risks.

### 15. Eight-agent orchestration protocol

Use parallelism only after the work graph is explicit.

The orchestrator must:

- maintain one canonical task ledger;
- assign one outcome and one owned file set per worker;
- create one isolated branch/worktree per implementation worker;
- give each worker exact inputs, outputs, non-goals, tests, and stop conditions;
- reserve shared schemas/manifests for a single owner;
- prevent two workers from mutating the same run evidence or generated report;
- require a compact handoff with commit SHA, changed files, commands, exit codes, unresolved issues, and merge order;
- inspect every diff before integration;
- keep no more than eight worker agents active concurrently;
- fill free slots with genuinely independent work, not artificial subdivisions;
- use fresh reviewer agents rather than asking authors to approve themselves.

Every worker task packet must include:

- role;
- objective;
- verified base SHA;
- worktree and branch;
- allowed files;
- forbidden files/actions;
- dependencies and supplied contract hashes;
- implementation inputs and expected outputs;
- acceptance tests;
- red-team cases;
- difficulty, sensitivity, model, and reasoning level;
- final handoff schema.

If a worker discovers a shared-contract change, it must stop and return a proposal. The orchestrator either sequences it through the contract owner or revises the dependency graph. Workers may not improvise incompatible shared schemas.

### 16. Implementation priorities

Use this order unless current evidence proves a different dependency:

#### STOP NOW

- Any Claude rating path.
- Candidate generation censored before semantic measurement in the experimental lane.
- D7 route not proven as GPT-5.6 Sol Ultra.
- Partial/sample chapter evidence presented as a full-book score.
- Non-terminal or invalid evidence presented as a final selection.
- Source-hash, inventory, receipt, or blind-identity failure.
- Automatic publication without explicit authorization.

#### BEFORE THE NEXT MODEL SAMPLE

- Reconcile the owner and repository Nudge score provenance.
- Derive reviewer arithmetic deterministically.
- Persist and cap every attempt.
- Validate calibration across the decision band.
- Freeze prompts, inputs, schemas, model effort, blind IDs, stop rules, and budgets.
- Separate true model sessions from re-ingests.
- Make readability measure-only in the experimental lane while leaving production policy unchanged.
- Repair terminal selection and no-valid-comparison reporting.
- Add judge-family interaction analysis.

#### BEFORE A FULL-BOOK PILOT

- Complete Codex evaluator integration and source-bound receipt chain.
- Bind canonical evaluator/D7 receipts into the production package where required.
- Make gates uniform across operator verbs.
- Halt at ready by default; require explicit publish.
- Prove exact-head CI covers the real V25 package.
- Run a full model-free and live authorized shakedown.

#### DEFER OR DELETE LATER

- Large move-only cleanup of historical migration modules.
- Legacy transport deletion not needed to prove the next experiment, provided it is quarantined and cannot bypass policy.
- Broad documentation-site or orchestration-framework work.
- Historical Git rewriting or mass state cleanup.

### 17. Testing contract

Every production change needs proportionate proof:

#### Unit

- policy and route resolution;
- schema parsing and deterministic arithmetic;
- attempt caps and terminal-state transitions;
- source-hash and inventory validation;
- score-scope labeling;
- session versus re-ingest accounting;
- price-table absence and versioning;
- publish default and CLI flags.

#### Contract

- ChapterFlow evaluator schemas and receipt hashes;
- distinct blind worker task/session identities;
- pair seal and cloned-judgment rejection;
- D7 receipt/model identity;
- candidate manifest and blind key;
- report-data and HTML embedding;
- current package registered in contract/CI manifests.

#### Integration

- candidate generation through validation, chapter audit, D7, selection, and report;
- exact resume after one role fails;
- alternate CLI verbs inheriting the same gates;
- package verification rejecting missing/tampered evaluator evidence;
- root CI command exercising the V25 package.

#### Failure injection

- unreadable/partial/duplicate/reordered chapter;
- source mutation after inspection;
- invalid atomic rating;
- model arithmetic mismatch;
- reviewer timeout and capped retry;
- stale or mismatched receipt;
- task/session collision;
- non-terminal selection;
- crash between atomic write and manifest update;
- re-ingest after success;
- absent price table;
- high-rated anchor metadata leaked into a rater prompt;
- D7 route resolves to Claude or non-Ultra effort;
- concurrent worker attempts to modify shared state.

#### Statistical and experiment validation

- frozen assignment and blind-key reproducibility;
- paired analysis against a synthetic known-effect fixture;
- confidence interval and decision rule on ties/noninferiority;
- sequential stop rule cannot selectively rescue a model;
- failed generations remain counted;
- unblinding cannot change the frozen analysis;
- D7-author-family interaction is reported.

#### Visual artifact

- self-contained and file-openable;
- no network, CDN, remote font, fetch, or analytics;
- semantic headings, keyboard access, visible focus, sufficient contrast, and color-independent status;
- safe text insertion and escaped embedded JSON;
- responsive roadmap lanes, dependency map, issue filters, and print layout;
- data and claims match the Markdown canonical source.

### 18. Required deliverables

Create or update only the minimum artifacts needed:

1. docs/v25/V25_EVALUATOR_AND_MODEL_SELECTION_EXECUTION_PLAN.md
   - canonical plan;
   - audit basis and provenance matrix;
   - evaluator/D7 architecture;
   - complete finding register;
   - difficulty/sensitivity/model/reasoning labels;
   - experiment pre-registration;
   - roadmap, lanes, dependencies, file ownership, and work packages;
   - test/red-team matrix;
   - adopted best-practice table;
   - decisions, residual risks, and definition of done.

2. docs/v25/V25_EVALUATOR_AND_MODEL_SELECTION_EXECUTION_PLAN.html
   - self-contained visual rendering of the same canonical truth;
   - simple-language pipeline map;
   - evaluator hierarchy;
   - score-provenance conflict view;
   - swimlane roadmap and dependency graph;
   - interactive finding table;
   - experiment sample/decision flow;
   - cost-quality decision matrix;
   - test and red-team gates.

3. The smallest implementation code, schemas, tests, workflow changes, and generated status block required by confirmed work packages.

4. docs/v25/V25_EVALUATOR_IMPLEMENTATION_REPORT.md
   - verified base and final SHA;
   - implemented/superseded/deferred finding IDs;
   - per-work-package commits and owners;
   - exact tests and exit codes;
   - red-team findings and dispositions;
   - live-call count and budget status;
   - experiment status or READY_FOR_LIVE_TEST;
   - unresolved owner decisions and residual risk;
   - explicit statement that no whole book was generated.

Avoid extra planning files, duplicate ledgers, or a new docs hierarchy. Prefer one canonical machine-readable task ledger only when orchestration truly needs it.

### 19. Plan freeze and implementation loop

1. Discover current truth.
2. Write the revised canonical plan and HTML.
3. Run a fresh plan red-team focused on unsupported claims, conflict risk, missing dependencies, evaluator leakage, invalid statistics, and overengineering.
4. Correct the plan and freeze its contract hashes.
5. Spawn safe parallel implementation lanes, up to eight workers.
6. Integrate small vertical slices.
7. Run focused tests after every slice and broad tests after each wave.
8. Use fresh agents to red-team high/critical work.
9. Fix defects; after any content repair, obey the fresh-QC-round rule.
10. Run exact-head verification.
11. If authorized, run only the bounded chapter experiment.
12. Produce the implementation report and stop before a full book.

Do not keep expanding scope after the frozen plan. A new finding may enter only if it blocks correctness, evaluation validity, safety, or the next authorized experiment; otherwise record it under DEFER.

### 20. Definition of done

The assignment is complete only when:

- the authoritative V25 head is identified and recorded;
- the old audit findings are revalidated, superseded, or disproved with evidence;
- all new evaluator/model-selection issues have complete finding packets;
- no Claude-family model rates a book or chapter;
- the Codex ChapterFlow Book Evaluator is the canonical full-book standard;
- chapter diagnostics cannot masquerade as book scores;
- D7 is proven to use GPT-5.6 Sol Ultra and remains secondary;
- the 140-book snapshot’s method limitations are explicit;
- high-rated content anchors are studied without contaminating blind rating;
- the Luna/Terra/Sol experiment is paired, blinded, frozen, bounded, and statistically honest;
- cost remains owner-supplied until a verified versioned price table exists;
- agent work is isolated, conflict-free, and traceable;
- all high/critical changes pass independent red-team review;
- exact-head tests and CI-equivalent commands pass;
- Markdown and HTML agree;
- no whole book is generated;
- no default model, publication, push, PR, or deployment occurs without the required evidence and authority;
- the implementation report contains no unsupported success claim.

### 21. Final response

Return a concise operational handoff containing:

1. final branch/worktree and HEAD;
2. links to the canonical Markdown plan, visual HTML, and implementation report;
3. implemented, deferred, blocked, and superseded finding counts;
4. test and red-team result summary with exact failure count;
5. model-call count and whether the chapter experiment ran;
6. current recommendation: READY_FOR_LIVE_TEST, FULL_BOOK_PILOT_CANDIDATE, INCONCLUSIVE, or BLOCKED;
7. confirmation that Claude performed no content rating and no whole book was generated;
8. the smallest remaining owner decision, if any.

Do not bury a blocker in optimistic prose. If evidence is incomplete, say exactly what is missing and stop at the truthful state.

## END PROMPT
