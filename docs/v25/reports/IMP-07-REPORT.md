# IMP-07 — Typed Transactional Repair with Semantic Invariant Preservation

**Status:** COMPLETE (patch lane live for surgical/section; regeneration stays whole-chapter)
**Baseline:** `e6f38dc16` (IMP-06; full sha in the machine report)
**Machine report:** `implementation-report.imp-07.json`

## What landed

The repair agent no longer returns a rewritten chapter for the conductor to
splice. Surgical and section repairs now return a **typed patch** (the frozen
`chapter-patch-v1` contract), and the new `src/orchestrator/repairPatch.ts`
makes scope enforceable in code; `authorRepair.doRepairOneChapter` was rewired
onto it end to end.

### The lane (was → is)

| Step | Pre-IMP-07 | Now |
|---|---|---|
| Agent output | whole rewritten chapter file | `patch.json` only (whole-chapter output → `validation_failed`, no fallback splice) |
| Scope enforcement | object-level splice of scoped fields | per-route PATH ALLOWLIST, leaf-only, replacement-only |
| Staleness | CAS at commit only | patch pins `expectedBaseHash` + `sourcePlanHash` + per-op `expectedOldValueHash`; a stale patch **rejects, never rebases**; CAS still guards commit |
| Non-scope safety | splice discards out-of-scope drift | out-of-scope ops REJECT the patch; plus a byte-hash **drift proof** over every untouched leaf before the battery runs |
| Validation | full battery on spliced chapter | same full battery on the patched chapter (a local patch never exempts unrelated blocker checks) + named dependency-closure log |

### Route classification (instruction 5) — `classifyRepairRoute`

Deterministic escalation lattice over frozen findings: `restore` (nothing
actionable / invalid finding) → `surgical` (isolated leaves) → `section`
(prose tiers: hook, counterintuition, breakdown) → `regeneration` (any scope
outside the patchable surface, any must-fix in causal/thesis/architecture
territory, or an explicit recommendation) → `upstream-source` (any source-plan
change request). Ambiguity always escalates; nothing widens silently. A finding
carrying a control-plane field (`model`, `tools`, `retries`, … —
`FINDING_FORBIDDEN_CONTROL_FIELDS`) fails the frozen validator and refuses to
route at all. The lane accepts surgical/section and returns a typed refusal for
everything else (regeneration/upstream have their own lanes).

### Path allowlists (instructions 4, 8)

- **Surgical:** `quiz.questions[i].(prompt|explanation|choices[j]|correctIndex)`,
  `examples[i].(scenario|whatToDo|whyItMatters|title)`,
  `memorableLines[i].(text|why)`, `reviewCards[i].(front|back)`, `keyTakeaway`,
  `tryThisNow`, `implementationPlan.(coreSkill|twentyFourHourChallenge|weeklyPractice|ifThenPlans[i].(context|plan))`.
- **Section:** surgical ∪ `hook`, `counterintuition`, `breakdown.(fastRead|deepRead|fullRead)`.
- **No route** hosts ids (`chapterId`, `questionId`, `exampleId`, `cardId`),
  source metadata (`sourceAnchorId(s)`, `keyEvidenceAnchorIds`), `planSpec`,
  `tags`, blooms/depth levels, `passingScorePercent`, `title`, `authoring`,
  `experiencePlan` — identity and lineage simply have no patchable path.
- **Replacement-only by construction**: there is no insert/delete operation, so
  array-index drift cannot exist, an `index === length` op is rejected as an
  append-in-disguise, and count invariants (9 questions, N examples) cannot be
  violated by a patch at all.

### Apply verification (instructions 7, 8) — `applyChapterPatch`

In order: frozen-contract validation (which already rejects prototype-pollution
and absolute/parent paths) → chapterId match → `expectedBaseHash` equals the
canonical base bytes' sha256 → `sourcePlanHash` equals the live plan hash (or
the explicit `legacy-no-plan` sentinel — never empty) → findingIds non-empty and
⊆ the findings the conductor actually issued → ≤ 12 operations (a rewrite
disguised as patches goes to regeneration) → per-op: duplicate/ancestor-overlap
rejection, allowlist, strict path resolution (in-bounds, no append), old-value
hash match (≥16-hex prefix; the conductor recomputes from its own canonical
value), string/number type preservation, per-op no-op rejection → apply on a
deep clone → whole-patch no-op rejection. The caller's original object is never
mutated; failures leave canonical bytes and evidence untouched (IMP-01).

### Non-scope proof (instruction 11) — `nonScopeDrift`

Every leaf outside the touched paths must be **byte-identical** (canonical-JSON
hash) before/after. Byte equality is the v1 standard for all non-scope fields —
an in-memory object apply gives no field a reason to reformat, so no field needs
semantic-hash tolerance (documented decision). The proof is not vacuous: a test
sabotages a non-touched field and the proof names exactly that leaf.

### Dependency closure (instructions 9, 10)

The lane runs the **full battery** unconditionally — gate composite (whole
chapter + committed siblings), rubric preflight, author write contract,
embedded-plan-mutation scan, plan freshness re-read at commit — so no local
patch exempts an unrelated blocker check. `dependencyClosureChecks(touched)`
names the semantic checks the battery covers for the touched surface (quiz →
key integrity/explanation consistency; examples → register advisories;
takeaway/breakdown/hook/memorable → claim-strength register; practice → timer
consistency) and is logged per repair for attribution.

### The card protocol (instruction 6 posture)

`buildRepairCard` gained a `patchProtocol` block: the base hash, the plan hash,
the citable finding ids, and an **OP MENU** — every concrete patchable path in
scope with a 16-hex prefix of its current value's hash. The agent copies hashes
verbatim; the conductor re-verifies against its own canonical values, so the
menu is a pinning convenience, never an authority. The workspace still holds the
seeded chapter for reading; edits to it are ignored; `patch.json` is the only
consumed output and the only extra file the containment check permits
(`unexpectedAttemptWrites` gained an explicit, caller-named allowance).
Instruction 6's "read-only" is honored as: canonical and repo untouched, the
isolated workspace is the only writable surface, and the typed patch is the only
output consumed.

### Evidence (IMP-10 integration)

When the attempt records evidence: the issued findings (`repair-findings`) and
the raw patch bytes (`chapter-patch`) ride the attempt's evidence objects,
alongside the existing spawn/candidate/commit records and the IMP-06 diversity
snapshot.

### Bridge & migration

`findingsFromComplaints` converts the existing complaint-string eligibility
output into frozen findings (reviewer prose = bounded evidence quotes only), so
the classifier and contract run on structured data with zero caller changes.
`spliceRepairScopes` is retained as the documented legacy artifact path
(`@deprecated`, still tested) — the live lane never calls it.

## Tests

- **`tests/repair-patch.test.ts` (12 new):** allowlists incl. the never-paths;
  op-menu enumeration; the route lattice (surgical/section/regeneration/
  upstream/restore, causal escalation, control-plane refusal); successful
  isolated + linked-section patches with the drift proof; negatives — stale
  base, plan mismatch, wrong old value, foreign/absent finding ids, identity
  edit, duplicate, append-index, type change, prototype pollution (frozen
  layer), op flood, per-op/whole-patch no-ops; whole-chapter-as-patch fails the
  contract; same-base concurrency (loser stale, never rebased); sabotage-detect
  drift proof; hostile path parsing; the findings bridge.
- **Lane integration (retargeted in `tests/source-use-plan.test.ts`):** the fake
  repair spawn now drops `patch.json` like a compliant agent; a relabel-targeting
  op rejects at the allowlist pre-commit with canonical bytes untouched; a clean
  typed patch commits once and the patched leaf lands. The stale-plan
  refuse-before-spawn pin is unchanged.
- Full hermetic suite: **2,229 pass / 0 fail** (+12); `contract-validate` PASS.

## Constraints honored

- No gate, threshold, retry cap, or acceptance predicate changed; the repair
  battery is the same set run on the same surface (gateChanges: []).
- No automatic rebase, no silent fallback (a non-patch output is a typed
  failure), no cap increases, no book-specific behavior.
- No convergence-improvement claim: whether typed patches repair better than
  whole-chapter splices is runtime/bakeoff evidence (IMP-11).

## Risks / open items

- The op menu adds card length proportional to scope size (~60 chars/path;
  quiz-scope worst case ~50 paths). Repair cards are not under the author-card
  budget; measured sizes stay well inside model context. If a future scope
  explodes the menu, pagination-by-scope is the knob.
- `correctIndex` is patchable (a quiz-key fix is a legitimate repair), and the
  dealt answer-index pattern is enforced by the unchanged gate battery — a
  key-breaking patch fails the gate, not the allowlist. Documented rather than
  double-enforced.
- Live repair-agent compliance with the patch protocol (does the model emit
  clean `patch.json` on the first try?) is unmeasured until the §18 smoke /
  IMP-11 runs; the failure mode is a typed rejection + the existing bounded
  regen fallback policy, never a bad commit.

## Integration notes

- **IMP-08:** blinded reviewers should emit `RepairFindingV1` directly
  (structured findings with evidence quotes), replacing the complaint bridge as
  the finding source; the route classifier and patch lane are ready consumers.
- **IMP-10:** `repair-findings` + `chapter-patch` evidence kinds are recorded
  per attempt when evidence is enabled.
- **IMP-11:** owns the patch-lane compliance/convergence measurement and any
  claim about repair quality.
