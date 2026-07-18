# IMP-06 — Brief and Device De-Reciping with Shadow-First Diversity Telemetry

**Status:** COMPLETE (de-recipe live; all telemetry SHADOW; zero gate changes)
**Baseline:** `ebac39cec` (IMP-04; full sha in the machine report)
**Machine report:** `implementation-report.imp-06.json`

## What landed

Two halves, in the order F-008/F-016 demand: first REMOVE the globally-repeated
narrative procedures from the writer surface, then MEASURE outcomes passively —
with an evidence-gated activation contract standing between measurement and any
future intervention.

### 1. The de-recipe (instructions 1-3)

**Classification** (instruction 1) of every dealt creative form, with its verdict:

| Dealt form | Class | Verdict |
|---|---|---|
| ownedCases/notYours, cast, avoid, answerIndexPattern, lengthBudget, questionFactOrder | product invariant / book allocation | KEEP unchanged |
| architectureFamily | book allocation | KEEP deal; **instruction text compacted to the shape outcome** — the embedded "Do NOT…" ban lists overlapped the CONTENT DEVICES deal (instruction 2's "overlapping bans"); the device deal is now the single ban owner |
| openerType, challengeFrame, practiceShape, exampleCount, limitsPlacement, leadThread, CONTENT DEVICE bans | book allocation (compact mode dials, CHB6/7/9-backstopped; the device deal is the measured 93%-saturation fix) | KEEP |
| requireFrictionExample, quizStemShapes, quizFailureModes, noun budgets, flavor | outcome preference | KEEP (compact) |
| **exampleArcs** (per-slot entry→outcome→register→+anchor table), **exampleLenses** (named scene taxonomy), **memorableShapes** (line formulas), **idiomFamilies**, **shellRegister**, **practiceVerb**, **groundingForm** taxonomy | **obsolete recipe** (R2's quiet-failure/prop/ledger/check-in/rescue machinery fingerprints) | **DEMOTED from the writer surface** |

**The demotion is render-only.** No gate or critic consumes these fields (verified
by search: consumers are the type, the dealer, the render, the lineage hash, and
the repair card) — so the deals still allocate, briefs on disk recompile
byte-identically, regen lineage/budgets are unchanged, and BR6/BR7 (brief-shape
gates) plus the CHB output budgets are untouched. What changed is the writer-visible
text (`briefVarietyInstructionLines`):

- The lens list + arc table → two compact outcome lines: `EXAMPLES: write EXACTLY
  N… no two examples share both their entry point and their outcome; at most 2 walk
  the framework loop end to end…` + `ANCHORS: give 2-3 examples exactly ONE concrete
  physical/sensory detail each; the rest get none`. Friction stays a dealt outcome
  (one prose sentence, v2 and v3 alike — the arc table that used to carry the
  failure slot no longer renders).
- Named per-slot practice structures → `PRACTICE SURFACES: …must NOT share one
  skeleton or repeat one prompt style` (+ the round-timer rule, unchanged).
- Memorable-line formulas → `write 3; no two share one grammatical mold`.
- Grounding-form taxonomy dropped; the grounding SAFETY rules (packet-drawn,
  never invent, hook anchor window) stay verbatim + a vary-the-form outcome.
- PRACTICE VERB / FRAMEWORK IDIOM / EXAMPLE SHELL REGISTER lines deleted; one
  compact outcome survives them (fields must not open identically; no shared verb
  tic). Cross-chapter texture is owned by the CHB budgets, the blinded acceptance
  readers, and the shadow telemetry.
- The surgical-repair card's per-slot "dealt arc still binds: entry=…, outcome=…"
  line → the anchor allocation only (the one slot fact a scoped edit can break).

### 2. Exact/near clone detection (instructions 4, 10) — `src/critics/cloneDetection.ts`

Deterministic, book-level, pure: exact-normalized hook clones, cross-chapter
memorable-line duplicates, shared ≥12-word n-grams between chapters' prose,
example-scenario shingle overlap (Jaccard ≥ 0.82), opener stem families
(first-4-words), and internal-taxonomy wording in prose. **Exact and near are
separate classes**: exact-clone is the only class the activation contract will
ever allow to block; broad similarity is shadow-first permanently until held-out
calibration. Calibrated on clean fixtures: a varied 3-chapter book yields zero
findings, and the fixture's own first draft was a live calibration lesson — its
shared boilerplate `whatToDo` strings were correctly flagged as a real
cross-chapter 12-word run.

### 3. Passive features + first-write ledger (instructions 5-7, 12)

`src/telemetry/diversityFeatures.ts` — 13 deterministic heuristic classifiers
(opener function, setting category, actor register, source origin/form from the
IMP-03 plan, tension source, discovery/resolution/rescue timing, prop dependence,
narrative container, before/after shape, practice action family, memorable-line
pattern), all with honest `unknown`/`none` values. A structure-preserving noun
swap (the disguised clone the lexical detector must miss) extracts the identical
feature vector — tested.

`src/telemetry/diversityLedger.ts` — appends a record at every chapter COMMIT
(authorRun + authorRepair hooks, post-commit, best-effort: telemetry can never
fail a commit). `firstWrite` is true only for author-initial generation-1 commits;
repaired versions are recorded as diagnosis rows and **never enter the first-write
denominator** (instruction 6: diversity is not inferred from accepted final
chapters). Every record stamps the diversity-config hash + feature schema version,
and when IMP-10 evidence is opted-in the same record rides the attempt's evidence
objects (instruction 12).

**Recording is OPT-IN** (`CHAPTERFLOW_DIVERSITY_LEDGER_ROOT` or explicit root),
the IMP-10 pattern: the 2,200-test suite writes zero telemetry; production/bakeoff
activation is a one-line owner env.

### 4. The activation contract (instructions 8-9) — `src/telemetry/diversityConfig.ts`

`DEFAULT_DIVERSITY_CONFIG` ships ALL-SHADOW. `validateDiversityConfig` is the
single admission gate: activating any check requires a non-empty `evidenceRef`
(the held-out evidence), a recorded `selectionReason`, and frozen non-empty
thresholds; `blocking` is rejected outside exact-clone in v1; active constraints
cap at ≤2 per chapter. An INVALID config never activates anything —
`effectiveMode` degrades to shadow while returning the error list (fail-safe,
never silent). The config hash (recursive key-sorted canonical JSON) is stamped
on every ledger record.

### 5. Anti-taxonomy leakage (instruction 11) — `src/telemetry/internalTaxonomy.ts`

Two catalogs from the live pools: `CARD_FORBIDDEN_LABELS` (the demoted taxonomy —
pinned absent from the brief render) and `PROSE_FORBIDDEN_LABELS` (every internal
label with a DISTINCTIVE form — hyphenated/multi-word only, so ordinary English
like "failure"/"reversal" can never false-positive). `taxonomyLeaksInProse` scans
reader prose; leaks ride the ledger records and the clone scan (`taxonomy-wording`
findings). The retained allocation dials (openerType, challengeFrame,
practiceShape, architectureFamily) render their labels on cards by design and are
excluded from the card-forbidden set — but still forbidden in reader prose.

### 6. The shadow report — CLI `diversity-report <bookId>`

Feature concentration over the immutable first-write ledger (flagging ≥67% shares
as "concentrated (shadow — report only)"), taxonomy leaks, and the clone scan of
current canonical bytes (labeled as such). Report-only; exits 0 regardless.

## Tests

- `tests/diversity-telemetry.test.ts` (10): feature variation + honest unknowns;
  disguised-clone feature equality; plan-driven sourceOriginForm; ledger opt-in
  (zero writes without a root, contained write failures), first-write vs repair
  separation, config/schema stamping, tolerant reads; activation-contract
  rejections (ad hoc, thresholds, blocking-outside-exact-clone, cap>2) +
  loud shadow degradation + a valid evidenced activation accepted; prose-scan
  distinctiveness + leak detection; card-forbidden vs retained-dial catalog.
- `tests/clone-detection.test.ts` (8): clean-book zero findings (FP calibration);
  hook-exact; memorable-line dup; 12-word n-gram fires / 8-word echo doesn't;
  copied scenario fires near-clone while the noun-swapped structure does NOT
  (cross-referenced to the feature test); opener stem family; taxonomy wording;
  normalization/Jaccard behavior.
- Retargeted: `stier2-levers` v3-render test → compact outcomes + a 15-label
  taxonomy-absence scan; B0 dedup marker; `architecture-monoculture` → outcome
  pin + no-ban-overlap pin. Focused suites 153/0 after the retargets; full
  hermetic suite results in the machine report.

## Verification-procedure notes

- Before/after hard-requirement counts: the v3 VARIETY block dropped from ~19
  writer-visible directive lines (arc table rows + lens list + idiom/shell/verb/
  grounding/memorable taxonomies) to 10 compact outcome lines with zero internal
  labels; the brief md fixture shrank accordingly (the 10,000-char cap now has
  wide headroom).
- R2's mechanisms are measurable without being writer-visible: rescue timing,
  prop dependence, ledger-ish before/after shape, and check-in-style practice
  families are ledger features, not card text.
- Shadow no-effect: the telemetry modules have no render path into cards
  (import audit: consumers are the CLI verb and the two post-commit hooks), and
  recording without a root is a structural no-op — the suite proves zero writes.
- Clone removal/detection behavior and vocabulary-vs-structure separation are
  pinned by the two new test files.

## What this package does NOT do (constraints honored)

- No gate, score threshold, or acceptance predicate changed (gateChanges: []).
- No named scene deck, no equal-distribution forcing, no broad-similarity
  blocking — near-clone and feature-concentration cannot even be configured to
  block in v1.
- No diversity-improvement claim: measurement ships; the claim belongs to the
  IMP-11 bakeoff / held-out evaluation.
- First-write lineage is preserved: dealt state and regen lineage hashes are
  byte-identical (render-only demotion).

## Risks / open items

- The de-reciped card trades explicit per-slot procedure for outcome statements;
  whether SOL/5.5 first-writes get better or worse is exactly the IMP-11
  bakeoff's question (F-008's own hypothesis). If first-write quality drops, the
  compact outcomes can be selectively re-expanded on evidence — the deals still
  allocate everything needed to re-render them.
- Feature classifiers are honest heuristics (regex vocabularies); their
  distributions need one calibration pass on real corpus output before any
  concentration threshold is trusted (IMP-11).
- The taxonomy prose scan is distinctive-labels-only by design; a writer could
  reproduce a single-word pool label ("walkthrough") undetected — accepted FP/FN
  tradeoff, documented here.

## Integration notes

- **IMP-07:** repair cards no longer re-impose the arc recipe; the anchor
  allocation line is the only slot-level constraint a patch must respect.
- **IMP-10:** diversity records ride attempt evidence when evidence is opted-in.
- **IMP-11:** owns clone-threshold calibration on held-out data, feature-
  distribution calibration, and ANY activation (the config's evidenceRef points
  at its outputs). The ledger env is the bakeoff's first-write measurement tap.
- **IMP-13:** production ledger activation is a one-line env in the canary
  runbook, same class as CHAPTERFLOW_EVIDENCE_ROOT.
