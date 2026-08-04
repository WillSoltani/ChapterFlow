# IMP-11 — Controlled Prompt-Stack Diagnostic and GPT-5.5 vs SOL Confirmatory Bakeoff Harness

**Status:** COMPLETE (harness + guards + Stage Q/D/C machinery + clustered stats + threshold script + decision file; NO live evaluation run — that is §16's separately authorized act)
**Baseline:** `c9d77f499` (IMP-09; full sha in the machine report)
**Machine report:** `implementation-report.imp-11.json`

## What landed

A NO-PUBLISH migration-experiment harness under `src/bakeoff/migration/` — a
SIBLING of the production bakeoff conductor that reuses the production write
and review instruments verbatim while having **no structural path to
promotion, QC, publish, repair, or canonical state**. It implements the three
frozen stages the plan requires:

- **Stage Q — judge qualification** (`qualification.ts`): a labeled
  adversarial corpus (all eight classes: clean controls, sourced fabrication,
  ambiguous constructed, causal overreach, two-valid-answer quiz,
  unsupported-complaint bait, structural clone, prompt injection) is read
  through the REAL phase-1 chapter instrument (`reviewOneChapter` — physically
  isolated workspace, byte-verified quotes); frozen minimums on per-class
  sensitivity, clean-control false positives, evidence-quote validity,
  protocol validity, and injection resistance decide QUALIFIED. An
  unqualified judge **cannot** score candidates (`assertJudgeQualified` — also
  refuses qualifications earned on a different rubric/docHash version).
  Synthetic-seed labels mark the record `dryRunOnly`: a §16-valid run requires
  a human-labeled corpus, enforced fail-closed.
- **Stage D — diagnostic prompt-stack factorial**: spec-level `stacks`
  (`current-builders` = the live SOL-native card chain; `snapshot` = a frozen
  directory of pre-rendered legacy v24 card templates, hash-pinned) ×
  model/effort cells. Validation enforces the minimum factorial (55-XH and SOL
  high/xhigh on BOTH stacks). Snapshot templates are re-hashed **at use** —
  a drifted stack refuses to author.
- **Stage C — confirmatory four-way**: validation enforces exactly
  `55-H/55-XH/56S-H/56S-XH` on ONE final stack, ≥2 books, all four chapter
  strata (spec-carried, prespecified), ≥2 samples/cell, seeded blocked
  randomization (`schedule.ts` — a pure function of the sealed spec).

### The firewall (inst. 1; verification #4)

Three independent layers, each tested:
1. **Static** — a suite test greps the migration sources for
   promotion/publish/provenance/delegation identifiers, `.runVerb(` call
   sites, `process.env`, canonical-tree strings, and asserts the analysis
   modules perform no filesystem IO at all.
2. **Capability** — `withMigrationGuards` strips `runVerb` entirely (verified:
   the production write path validates in-process through io hooks — the
   experiment needs NO verb, so promote/publish/qc-converge are unreachable
   even by future accident).
3. **Path** — every write goes through `rootedWrite` (inside
   `state/migration-experiments/<id>/` AND outside every canonical tree, both
   asserted; a root misconfigured INTO a canonical tree still refuses).

The conductor's phase ladder (`seal → qualify → generate → review → metrics →
analyze → unblind → decide → report`) simply **has no promote/qc/publish
rung**.

### One-attempt samples (inst. 9)

`AuthorWriteOneOpts` gained two additive seams (production defaults
byte-identical, pinned): `firstWriteOnly` (exactly one attempt — no gate
retry, no lead degradation) and `cardOverride` (snapshot-stack substitution).
The sample runner (`sampleRunner.ts`) enforces one-attempt discipline
(`assertOneAttemptOpts`: no complaint feedback ever), classifies every spawn
through the IMP-02 disjoint provider taxonomy, permits **at most one**
prespecified infrastructure replay under the SAME sample identity — never for
content failures or safeguard/refusals — and preserves every non-completed
spawn's REDACTED tail content-addressed under the experiment's evidence root
(the raw material `SAFEGUARD_MARKERS` — deliberately empty at IMP-02 —
calibrates from). Deterministic critics run ONCE per committed sample: C37
subclass counts, register advisories, causal-claim counts, the IMP-06
diversity feature lexicon.

### The seal (inst. 2, 6, 17)

`sealExperiment` freezes EVERYTHING before any live call could exist: spec
bytes (copied into the run root), per-book shared inputs (hashed on canonical
disk — the experiment **never compiles**; missing inputs halt with
instructions), per-stack card templates (current builders re-rendered with the
placeholder each verification — builder-code drift after sealing halts the
run), thresholds (copied + hashed), the deterministic schedule, instrument
versions (rubric v3-phase1, docHash v3, route-policy v1.0, contract-manifest
sha), the judge panel, and the price snapshot. `verifySealIntact` re-derives
every hash before EVERY phase; drift halts instead of mixing conditions.
Tuning a sealed experiment is structurally impossible — a changed
spec/thresholds/stack no longer matches its seal.

### Blindness (inst. 10)

Reviewer blindness rides IMP-08's PHYSICAL isolation (workspace = the phase-1
doc, nothing else) plus experiment-specific fail-closed screens: every
reviewer-visible byte (doc text, doc filename, task) is checked against the
forbidden identity vocabulary (model ids + slugs + family suffixes, stack ids,
cell ids, stage vocabulary, the experiment id). Blind sample ids are opaque
hashes. Analyst-side ordering is enforced mechanically: the decision phase
refuses to run until the metric tables are frozen (hash recorded in the
manifest, re-verified) and the sealed thresholds still hash to the seal —
thresholds cannot change after results exist (verification #5).

### Metrics, statistics, thresholds (inst. 12-20)

- `metrics.ts` — the §16 table set per cell × book × stratum + pooled:
  first-write deterministic pass, review acceptance, DISTINCT provider-outcome
  rates (safeguard/refusal never folded into infra), replays, latency
  p50/p95, critic rates, diversity concentration, exact-clone collisions,
  quiz-adjudication statuses, judge agreement (prespecified double-read
  subsample), review composites, projected repair demand (frozen versioned
  formula, labeled a projection), missing cells VISIBLE. **Tokens/cost are
  null with an explicit reason** — the Codex CLI exposes no usage fields
  (verified against codexAgent/cost-tracker); nothing is estimated (inst. 18).
- `stats.ts` — pure + seeded: paired per-(book,chapter)-block deltas,
  cluster-aware bootstrap (BLOCKS are the resampling unit — quiz items and
  within-chapter units are never independent), effective-sample accounting,
  rule-of-three (`0/36 → ~8.3%; ~150 → 2%; ~300 → 1%` — the mandated statement
  ships verbatim in every report), precision assessment (`inconclusive`, never
  a relaxed target), FROZEN stopping-rule vocabulary (unknown rule ids throw),
  and model/effort/stack/interaction/book/stratum effects with bootstrap CIs.
- `thresholds.ts` — the twelve §16 groups as data
  (`DEFAULT_MIGRATION_THRESHOLDS`; the owner freezes/tightens before §16);
  `evaluateProfile` emits per-group `pass|fail|inconclusive` with a
  `statisticallySupported` honesty flag (observed gates vs population
  claims); missing evidence is inconclusive, never a silent pass;
  point-clears-but-interval-misses non-inferiority is INCONCLUSIVE (inst. 16).
  `buildDecisionFile` can qualify **no profile, one profile, or multiple
  task-scoped profiles** (high-vs-xhigh routing recommendation per threshold
  11), emits the exact line `SOL BAKEOFF RESULT: QUALIFIED <…> | NO SOL
  PROFILE QUALIFIED | INCONCLUSIVE`, and carries an explicit activation
  refusal — activation is IMP-13's package.

### Screening → expansion (inst. 14)

Wave 1 runs + reviews the screening subset; the frozen rules are evaluated
ONCE on interim metrics and the decision PERSISTS (`stopping-decision.json` —
resume reuses it, never re-decides); futility beats expansion; only an
"expand" decision runs the expansion entries.

### CLI

`migration-bakeoff <plan|seal|qualify|run|analyze|decide|status>` registered
in the main CLI (thin parsing over the conductor; `plan` validates + prints
the schedule with no writes; `--allow-synthetic-qualification` is the labeled
dry-run-only escape hatch). These subverbs ARE the standalone §16 execution
surface.

## Tests (43 new; all listed classes from the prompt covered)

- `migration-guards.test.ts` (6) — rooted/canonical write refusal (incl. the
  misconfigured-root case), verb-strip, one-attempt assertion, forbidden
  vocabulary, and the two STATIC scans.
- `migration-spec.test.ts` (5) — design-rule validation (confirmatory four-way
  exactness, ≥2 books, strata coverage, ONE final stack, never-replayable
  safeguards, price-snapshot completeness, screening/expansion coherence;
  diagnostic factorial minimums), schedule determinism/blocking/opacity, the
  seal, and all three drift classes (inputs, builder code, thresholds).
- `migration-sample.test.ts` (7) — one-attempt pin THROUGH the real
  `authorWriteOneChapter` (one spawn on deterministic failure, classified
  `content_invalid`, never replayed) **plus the production-budget pin** (the
  same failing gate without the flag still burns 1 + AUTHOR_WRITE_GATE_RETRIES
  spawns); success-path critics/diversity capture + resume immutability;
  bounded infra replay with original-outcome + redacted-tail evidence;
  pre-spawn policy refusals; snapshot-stack substitution (hash-verified at
  use; tampered template refuses); io tripwires.
- `migration-qualification.test.ts` (5) — corpus validation (eight classes,
  verifiable anchors, marker-required injections, bait items as CONTROLS),
  the frozen anchor rule, scoring (sharp/trigger-happy/injection-obeying
  judges), orchestration + the four enforcement refusals (missing, failed,
  dry-run-in-live, stale instrument), the overlap detector.
- `migration-stats.test.ts` (7) — the mandated rule-of-three numbers exactly,
  precision honesty, cluster-driven bootstrap width + seed determinism,
  paired-delta missing blocks, frozen stopping vocabulary (futility override,
  unknown-rule throw), designed-delta effect recovery, effective-sample and
  missing-cell accounting.
- `migration-thresholds.test.ts` (6) — all twelve groups, inconclusive-over-
  overstated, observed-gate marking, no-forced-winner, the frozen
  high-vs-xhigh recommendation, exact decision lines.
- `migration-conductor.test.ts` (7) — the full ladder dry-run with synthetic
  stages + hostile inputs (QUALIFIED with human adjudication supplied;
  INCONCLUSIVE without it — missing evidence never passes), unblind-refusal on
  tampered frozen metrics, thresholds-immutability halt, the persisted
  screening→expansion decision, the qualification/candidate overlap halt
  (red-team case 1), and the REAL review runner's enforcement (unqualified
  refusal, panel rotation, prespecified agreement reads, review immutability,
  dry-run-vs-live refusal).

Full hermetic suite + `npx tsc --noEmit` + `contract-validate`: results in the
machine report (commands verbatim).

## Deliberately NOT in this package (non-goals honored)

- **No live model evaluation** — every stage dry-runs on injected deps; §16
  executes the harness under its own authorization after §15 emits
  `BAKEOFF AUTHORIZED: YES`.
- **No prompt tuning, no activation, no product-gate changes** — C37/clone/
  diversity/phase-2-adjudication rates are MEASURED per cell (calibration
  inputs); the decision file recommends, IMP-13 activates.
- **No new frozen contracts** — experiment schemas are versioned module types
  (the `model-bakeoff-*-v1` tradition); the nine Phase-0 contracts and the
  frozen `AgentRole` union are untouched (spawns reuse existing roles).

## Risks / open items (also in the machine report)

- Token telemetry is structurally unavailable on the Codex CLI route — §16
  cost-per-accepted-chapter will be latency + explicit-unavailable cost fields
  unless capture improves. Honest per inst. 18, recorded in every table.
- The legacy-v24 stack SNAPSHOT (pre-IMP-05 cards rendered from git history)
  is a §16 operator input; the harness verifies its pin and refuses drift but
  cannot conjure it.
- The seed qualification corpus is synthetic (tests only). A §16-valid Stage Q
  needs the human-labeled corpus; `dryRunOnly` + the live-run refusal make the
  gap impossible to paper over.
- Human adjudication (upheld high-severity counts, review-completion) enters
  via `human-adjudication.json`; absent fields evaluate INCONCLUSIVE — the
  dry-run decision line is honest by construction.
- `stash@{0}` note: the owner's stashed main-CLI registration of
  `model-bakeoff` touches the same help/switch region as the new
  `migration-bakeoff` registration — a future stash pop may conflict
  trivially (two adjacent insertions); nothing was popped or modified.
