# IMP-04 — Source-Safe Concreteness, Stand-In Prevention, and Register Critics

**Status:** COMPLETE (advisory-first scope; blocker promotion is IMP-11's calibration job)
**Baseline:** `5007056685b1198fc5566b9eb5747af125892726` (IMP-05)
**Machine report:** `implementation-report.imp-04.json` (validates against the frozen worker-report schema)

## What landed

IMP-03 gave every chapter an immutable, compiler-owned source-use plan (origin / form /
claim strength / detail permission / sufficiency / framing per unit). IMP-04 operationalizes
that plan at authoring time: the writer now gets a compact evidence-sufficiency **decision
policy**, the lead/cast deal loses its architectural pressure toward named invented people,
and a new **plan-aware critic family (C37)** checks the prose's aggregate register against
the plan's aggregate permissions — emitting evidence-bound, scope-bounded repair findings
that can never relabel the plan.

### 1. The decision policy (instruction 2)

One ~570-char line on the SOURCE-USE PLAN card block (`renderSourceUsePlanLines`,
`src/compiler/sourceUsePlanCompiler.ts`), rendered for every plan:

> CHOOSE THE SAFE FORM BY EVIDENCE: enough verified human/event detail → the permitted
> sourced form only; a concept you can teach directly → direct explanation (no cast, prop,
> or scene needed); an observable workflow helps → a generic operational scenario with role
> labels; a fictional contrast materially helps → a constructed application framed as
> hypothetical at first entry; not enough evidence → stop and request an upstream
> source-plan action, never invent to fill the gap.

All five arms are pinned by tests. No magic phrase anywhere — framing is semantic.

### 2. Lead/cast register defaults (instructions 4 + 6)

Assessed first (per the conflict matrix) — the **deal itself is unchanged**: name
reservation stays a book-wide disjoint allocation (`castFor`), the protected-name union
still guarantees no invented name collides with a real source person, and the
CONTENT-DEVICES proxy-cast ban plus the deal↔deal cast-emptying from the fresh-gold fixes
remain intact. What changed is the **register the deal renders**
(`src/compiler/chapterBrief.ts`):

- **`## CAST` block:** invented people now default to ROLE LABELS; a reserved name is
  spent only inside a clearly-framed constructed application (the dealt lead thread
  qualifies) where it materially helps. The "use only these; never a real source-person
  name" invariant is retained verbatim.
- **Invented lead thread:** the line now types the device — "This thread is a CONSTRUCTED
  application" — and requires first-entry non-factual clarity in natural varied wording
  (explicitly "no single fixed phrase") plus the anti-drift rule: never let a later
  paragraph report the invented events as history. Owned-case leads are untouched (a real
  case must never be framed as fiction).

Dealt state on disk is byte-identical — recompiles, lineage keys, and regen budgets are
unaffected; only rendered text changed.

### 3. The C37 critic family (instructions 5, 7, 8)

`src/critics/sourceRegister.ts` — `checkSourceRegister(chapter, plan)`, deterministic,
pure, **no-op without a plan** (legacy chapters: absence grants nothing and blocks
nothing). Checks the reader-facing prose (hook, counterintuition, takeaway, all three
breakdown tiers, example scenario/whyItMatters, quiz explanations, memorable lines,
coreSkill) against `planAggregate(plan)`:

| Check | Fires when | License that clears it |
|---|---|---|
| `C37.claim_strength_overreach` | causal/inevitability language (incl. quiz explanations and memorable lines — instruction 7's full surface list) | any unit with `claimStrength: "causal"` |
| `C37.unsupported_scene_completion` | invented dialogue quotes, interior-thought verbs, or beat-closure transitions in examples | any case unit with `detailSufficiency ≠ concept_only` |
| `C37.generic_specific_leak` | bare year / exact metric / credential | any `source_bound` unit (a grounded anchor could carry it) |

All three are **advisory-MINOR, calibration-pending** — exactly the C31–C36 posture. None
is wired to a gate, blocker, or acceptance predicate; `finalGate` is untouched. They
surface on the same three lanes as their siblings: write-retry cards
(`authorRun.advisoryRegisterBlock`, now plan-threaded), the surgical repair directive
(`authorRepair.buildRepairCard`, now plan-threaded), and regen attempt-1 cards. One
finding per check per chapter (surfacing, not flooding).

Why advisory despite the objective's "block before commit": the plan's conflict matrix
mandates shadow-first for new semantic critics (false-positive risk on a lexical
approximation of a semantic property), and the true register/factuality **blockers remain
owned by sourceGrounding/sourceRealness, untouched**. IMP-11's bakeoff measures C37's
false-positive rate before any promotion.

### 4. Evidence-bound repair findings (instructions 9, 13, 14)

`sourceRegisterRepairFindings(chapter, plan)` emits frozen `RepairFindingV1` records:
severity `advisory`, the offending span as `evidenceQuotes`, the implicated plan field as
`sourcePlanDependencies`, a **bounded `permittedRepairScope`** per check (claim →
breakdown/quiz/keyTakeaway/memorableLines; scene → examples; leak → examples/breakdown),
and `prohibitedChanges` pinning **all five plan fields** — a repair can soften prose to
the permitted register (`recommendedRoute: "surgical"`, the IMP-07 bounded-patch
interface) but can never relabel origin/form/claim-strength/sufficiency/framing; a genuine
plan change routes upstream to source-plan recompile. Free-form prose cannot broaden the
scope: the mapping is a code constant, tested under injection.

## Tests (20 new in `tests/source-register.test.ts`, plus 2 cap updates)

- Valid forms pass CLEAN under the matching plan: direct explanation + generic role-label
  scenario under the most restrictive (invented-origins-only) plan; a sourced case scene
  with quotes/dates/metrics under a scene-licensed plan.
- **Varied hypothetical framing** (Suppose… / Picture… / If…were yours…) passes with zero
  findings — no marker word required (the fixtures deliberately avoid "imagine").
- Negatives trip exactly one finding per check, on the right surface (quiz explanation,
  memorable line, example), each license-gated: the same prose under a permitting plan is
  clean. Scene markers in the hook are out of scope (scenes live in examples).
- Legacy: no plan / empty plan → zero C37 findings; the 1-arg
  `collectRegisterAdvisories` signature still returns exactly the C31–C36 set.
- Repair findings: schema-valid against the frozen contract, advisory, evidence-bound,
  unit-refs within the plan, scope/prohibitions exactly the constants — including with
  INJECTION_STRINGS embedded in every prose surface and in plan unit ids.
- Decision policy renders with all five arms; CAST role-label default; constructed-lead
  framing; owned-case lead keeps its sourced register.
- Budget updates, all deliberate and commented: brief-md 9,600 → 10,000 (CAST +
  lead-framing additions; fixture measures ~9.9k); plan-block 2,800 → 3,200 (decision
  policy); the IMP-05 golden-fixture card-diet pin 15,000 → 15,200 — the CAST text was
  first tightened (−95 chars), and the remaining ~96-char overshoot is the irreducible
  instruction-4 register text, so the pin moved with a comment. The diet ratchet stands
  (~4.7k under the 19,924 pre-diet card); control-block (≤4,600) and directive-line
  (≤40) pins were untouched and still hold.

Full hermetic suite + `contract-validate`: results recorded in the machine report.

## Verification-procedure notes (plan §IMP-04)

- Card fragments: plan block +~570 chars (decision policy); brief CAST +~280; invented-lead
  line +~230. Golden-fixture author card stays ≤15,000 (the IMP-05 diet pin) — precedence
  order unchanged (AUTHOR_PRECEDENCE still renders first).
- Direct explanation and generic scenarios pass with zero proper nouns and zero invented
  history (tested); a declarative stand-in trips `unsupported_scene_completion` while the
  same content framed and licensed passes.
- No source or factuality blocker was made advisory, weakened, or removed: `finalGate`,
  sourceGrounding, sourceRealness, SP15/SP16, and ENFORCED_MAJOR are untouched (gate
  changes: none).

## Honest coverage map (what is NOT deterministically detected)

- **Deceptive conditional framing** (begins "suppose…", later asserts the event as
  history — instruction 6's reject-half) is a semantic property; a lexical detector would
  be FP-heavy or a magic-phrase test, both forbidden. Today it is mitigated (framing
  requirement on the card + the anti-drift lead-thread rule + C37 catching the
  scene/specific symptoms) and owned downstream by IMP-08's blinded review and IMP-11
  calibration.
- **Sourced-identity-in-invented-event** (instruction 5) is prevented structurally at the
  deal (protected-name union means an invented cast name can never be a source person) and
  prohibited on the card (constructed license line); entity-level cross-referencing of
  prose names against packet identities is IMP-09's named-entity work (instruction 10's
  coordination note).
- **Per-unit prose↔plan mapping** (instruction 8's "each planned unit"): chapter prose
  carries no unit ids pre-write, so C37 checks aggregate permissions. Plan/hash match and
  embedded-plan-mutation are already fail-closed pre-commit (IMP-03); the per-unit
  attribution question belongs to IMP-08's structured review output.

## Files changed

- `scripts/book/prompts/chapterflow-v24-author-pipeline/src/critics/sourceRegister.ts` (new)
- `…/src/critics/registerAdvisories.ts` (optional `plan` threading, C37 fold-in)
- `…/src/orchestrator/authorRun.ts` (retry block plan-threaded)
- `…/src/orchestrator/authorRepair.ts` (repair directive plan-threaded)
- `…/src/compiler/sourceUsePlanCompiler.ts` (decision policy line)
- `…/src/compiler/chapterBrief.ts` (CAST role-label default; constructed-lead framing)
- `…/src/types.ts` (three `C37.*` CriticCheckIds)
- `…/tests/source-register.test.ts` (new, 20 tests)
- `…/tests/source-use-plan.test.ts`, `…/tests/chapter-brief.test.ts` (justified cap updates)

## Integration notes

- **IMP-05:** the card diet's enforcement-owner ledger now points at a real C37 owner for
  register lessons; the diet budget held (no re-expansion).
- **IMP-07:** `sourceRegisterRepairFindings` output is the typed, scope-bounded input the
  patch lane consumes; `recommendedRoute: "surgical"` + `permittedRepairScope` define the
  bounded patch surface (instruction 14).
- **IMP-08:** blinded reviewers own the semantic half (historical-register ambiguity,
  deceptive conditional); C37 gives them deterministic pre-screening.
- **IMP-09:** named-entity grounding must not treat proper-noun presence as a grounding
  proxy — role-label scenarios legitimately have none (tested here).
- **IMP-11:** owns C37 calibration (FP rate on the gold corpus) and any promotion from
  advisory to blocker.

## Risks

- C37 is lexical-aggregate, so known FP classes exist (e.g., a licensed constructed
  application legitimately staging framed dialogue on a chapter whose cases are
  explanation-only will draw the scene advisory). Advisory severity makes this cost
  one card line on an already-retrying draft; calibration data decides its future.
- The quoted offending spans on retry/repair cards embed draft text (bounded at 40/160
  chars, same posture as C31–C36); full-fidelity draft/reviewer text continues to ride
  the typed untrusted envelope.
