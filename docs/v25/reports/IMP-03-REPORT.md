# IMP-03 — Compiler-Owned Source Semantics, Writer-Safe Projection, and Untrusted-Data Envelope

**Status:** Implemented and verified (typecheck clean; full suite **2,135 pass / 0 fail**, +26 new tests).
**Baseline:** `365d5b3c6` (IMP-02). **Findings:** F-004, F-005, F-006, F-007 (P1); F-013, F-021 (P2).
**Phase 4 exit checkpoint:** plans compiler-owned ✓, immutable per attempt ✓, hash-bound ✓, compact ✓,
package-excluded ✓; artifact blocks use the untrusted-data contract ✓.
**Machine-readable report:** `implementation-report.imp-03.json`.

## 1. The final orthogonal ontology

The frozen `source-use-plan` v1 contract (`src/contracts/sourceUsePlan.ts`, unchanged — no version
bump needed) is now **implemented** by `src/compiler/sourceUsePlanCompiler.ts`:

- **Origin** (`source_bound` / `constructed` / `generic`) × **form** (`case` / `application` /
  `operational_scenario` / `explanation` / `analogy`) × **claim strength** (`descriptive` /
  `inferential` / `correlational` / `mechanistic` / `causal`) — three independent axes, never one
  overloaded enum. Detail permissions (`allowedDetailTypes`/`forbiddenDetailTypes`, categorical
  vocabularies from §8.4), `detailSufficiency`, and `framingRequired` complete each unit.
- **Units minted per chapter:** one source-bound *explanation* unit per packet fact (direct
  conceptual explanation is first-class — no cast, prop, or scene may be demanded of it); one
  source-bound *case* unit per adequately documented named case; three chapter-level
  invented-material licenses (*constructed application* framed, *generic operational scenario*
  role-labeled, *analogy* framed). 14 units on the tracked golden fixture.
- **Conservative strength derivation (the F-C causal-overreach fix):** a researcher-attested
  `mechanism` grants `mechanistic`; `replicationStatus` below robust caps at `descriptive`
  (even with a mechanism string); everything else is `descriptive`. `causal`, `inferential`,
  and `correlational` are **never minted** by this compiler — no sidecar field attests them, so
  they are reachable only through an explicit future research field, never a downstream relabel.
  A compiler-wide ceiling assertion (`COMPILER_MAX_CLAIM_STRENGTH = mechanistic`) is self-checked
  at compile time and pinned by test.
- **Under-evidenced cases lose the scene, not the lesson:** a real-world case with <2 documented
  hardSpecifics degrades to an explanation-only unit (`concept_only`) — the red-team case "one
  hard specific assigned a full scene" is unconstructible. `full` sufficiency is never minted
  (2–4 checkable tokens license a *partial* scene, not completion). A non-real-world case (the
  source book's own device) keeps its license with `framingRequired: true`.

## 2. Ownership, immutability, and invalidation

- **Only the compiler writes plans.** `compileSourcePackets` (the sole production packet writer)
  compiles and writes `chNN.plan.json` in the same pass, hashed against the FINAL packet bytes
  (after the book-wide dedup/re-rank mutations). Plan and packet cannot drift apart on recompile.
- **Writers/repairs cannot relabel.** Three independent mechanisms:
  1. the writer's isolated attempt workspace (IMP-01) cannot reach the plan file at all;
  2. a candidate carrying any reserved plan-control key (`sourceUsePlan`, `claimStrength`,
     `detailSufficiency`, `sourceOrigin`, `unitForm`, `framingRequired`, …, checked recursively,
     keys-only — prose may discuss the words) fails the attempt (`validation_failed`), leaves
     canonical bytes untouched, and the retry card routes the dispute upstream;
  3. the repair splice discards out-of-scope fields structurally, and the spliced result is
     scanned again (a key smuggled *inside* a scoped object is caught post-splice, pre-commit).
- **Freshness is enforced at three points, fail-closed:** at authoring/repair entry (invalid,
  unreadable, or packet-hash-stale plans REFUSE to spawn — present-but-corrupt is never
  demoted to "no plan"), at the source-packet gate (SP15 invalid / SP16 stale are blockers),
  and again immediately before the CAS commit (a packet recompiled mid-attempt rejects the
  candidate — never rebases).
- **Lineage:** `AttemptIdentityV1.sourcePlanHash` (the slot IMP-00 reserved) is now populated,
  plus `inputHashes` = {sourcePacket, writerProjection, briefMd, sourceUsePlan, renderer
  version}. A plan change ⇒ new plan hash ⇒ dependent attempts/patches stale by construction;
  prose-evidence invalidation continues to ride content hashes (reviews/acceptance are keyed on
  chapter content + doc hashes); IMP-10 wires the full evidence graph.

## 3. Writer-safe projection (F-005) and size comparison

`writerPacketProjection` v1 → **v2** (ephemeral, never persisted — no migration surface; the
version string is embedded in cards and golden-pinned):

- **Added (the safety subset whose absence caused restamps and settled-law statements):** case
  `doNotRestamp` + `naturalSetting`; fact `replicationStatus` (projected only when below
  `robust` — the hedge signal); root `sourceRisks` (citation-stripped, capped at 6).
- **Still deliberately dropped:** `allowedUses` (a uniform constant today — zero information)
  and `forbiddenUses` (one identical boilerplate sentence per case; its content is carried
  categorically by the plan's `forbiddenDetailTypes` and rendered once in the plan block).
  Frameworks, ranking metadata, grounding inventories, provenance, and anchor bodies stay out.
- **Restriction → surface mapping (verification step 2):** doNotRestamp → projected field + plan
  category `restamp_protected_specific`; forbiddenUses content → plan forbidden categories +
  card line; sourceQuality.risks → `sourceRisks`; replication uncertainty → `replicationStatus`;
  forbiddenClaims (two packet-level constants) → plan categories (`invented_quantified_effect`,
  `invented_participant`); forbiddenLeakage (cross-chapter case ownership) → the brief's
  `notYours` reservation (pre-existing).

Measured on the tracked golden fixture packet (15,925-char packet JSON):

| Surface | chars |
|---|---|
| projection v2 (card-formatted) | 4,826 (**0.303×** the packet; v1 was 4,736 — +90) |
| untrusted-envelope overhead per block | +665 |
| plan card block (14 units, grouped) | 2,330 (≤2,800 pinned) |
| plan artifact on disk (authoring-only) | ~8.8 KB |
| realistic writer card (no plan) | 19,924 (pin raised 18,940 → 20,000; diet returns in IMP-05) |
| card + plan block | ≈22.3k, ceiling 25k (pinned) |

## 4. Untrusted-data envelope (F-021)

`src/exec/untrustedArtifact.ts` generalizes `renderUntrustedSourceBlock` into ONE typed envelope
for the seven artifact families (`source-packet-projection`, `source-sidecar`, `source-use-plan`,
`chapter-brief`, `prior-output`, `reviewer-finding`, `repair-evidence`): typed header (artifact
type, stable id, schema version, **content sha256**), stable delimiters, a fence guaranteed
longer than any backtick run in the body, and delimiter-forgery defusal (data can never close or
nest the envelope — pinned against six injection payloads). **Adopted at:** the author card's
packet projection and prior-attempt complaints; the repair card's reviewer criteria and register
advisories (chapter-prose quotes). Conductor-authored text (brief, plan block, dealt constraints,
measured quiz evidence) stays outside the blocks — it IS the instruction channel.

Deliberately NOT attempted: lexical injection detection (the IMP-02 safeguard-marker lesson — a
guessy matcher misclassifies in both directions). The quarantine guarantee is structural: control
policy (role/model/effort/sandbox/output path) is resolved by the conductor before any card text
exists and never parsed back out of artifact data (the frozen repair contract's
`FINDING_FORBIDDEN_CONTROL_FIELDS` covers the structured side). Pinned by a spawn-boundary test:
a card stuffed with injection payloads produces byte-identical resolved route/profile fields.
Legacy `renderUntrustedSourceBlock` call sites (v23 research/planner paths) are unchanged; new
surfaces use the typed envelope.

## 5. Package exclusion (requirement 15)

Plans live at `state/books/<book>/runs/<runId>/source-plans/chNN.plan.json` — an authoring-only,
run-scoped directory. The reader package is built by `promoteBook` exclusively from canonical
`state/chapters/**` chapters; `publishToLive` copies exactly ONE file
(`state/books/<id>.v21.json`) with an independent byte-hash compare — no directory sweep touches
`source-plans/`. Chapters themselves cannot carry plan fields: the reserved-key scan rejects them
at candidate import, the only path to canonical bytes (pinned). The public chapter schema is
untouched.

## 6. Backward compatibility / migration

No persisted artifact changed shape; the plan is a NEW artifact. Absent plan = the legacy path:
authoring, repair, gating, and cards behave byte-identically (pinned: no plan block, no
`sourcePlanHash` key on attempts, gate advisory `SP15.plan_missing` only). Absence grants
nothing — missing/unknown legacy fields are never promoted to scene permission (the compiler
derives permissions solely from present evidence; an empty anchor catalog mints NO source-bound
units, loudly). Present-but-invalid/stale/corrupt is always fail-closed. Plans mint automatically
on the next `compile-source-packets` run of any book.

## 7. Tests (26 new; full suite 2,135/0)

`tests/source-use-plan.test.ts` (20): orthogonal derivations; scene/no-scene licensing; device
framing; ceiling (causal never minted); determinism + hash binding + staleness (incl. identity
mismatch); anchor fallback/omission semantics; all five forbidden combinations rejected by the
frozen validator; relabel containment (writer candidate, repair splice-smuggle, retry-card
routing, zero canonical writes); compact grouped rendering (≤2,800 chars, ≤16 lines, hash-stamped);
card with/without plan (+25k ceiling); SP15/SP16 gate blockers vs legacy advisory; write-path
fail-closed entry checks (stale/invalid/corrupt refuse BEFORE spawn); legacy no-plan write;
fresh-plan lineage in `attempt.json`; mid-attempt packet-swap rejection at commit; repair-path
stale refusal and clean-commit control. `tests/untrusted-artifact.test.ts` (6): delimiter
integrity under six injection payloads, fence escalation, attribute sanitization, byte-preserved
bodies + notice + hash, defusal, and spawn-boundary route immunity. Updated: projection golden
regenerated (deliberate, same commit), allowlist extended by exactly the four safety fields,
author-card pins (v2 literal, envelope presence, complaint framing, budget 18,940 → 20,000 with
history note).

## 8. Honest gaps / risks (recorded, not hidden)

- The plan is a **license catalog**, not yet an enforcement critic: prose that *exceeds* a
  license (e.g. a scene staged on an explanation-only unit) is constrained today by the existing
  source critics plus the card contract; the plan-aware semantic critics are IMP-04's package,
  the ontology-aware validators IMP-09's. IMP-03 deliberately ships data + boundaries first
  (conflict matrix: "IMP-03 data first, IMP-05 diet second, IMP-04 policy third").
- Unit granularity is per-fact/per-case/per-license-class, compiled before authoring (the writer
  owns structure, so per-prose-paragraph units cannot exist pre-write); IMP-04's critics map
  written units back to licenses.
- `inferential`/`correlational` strengths are dormant until research emits an explicit relation
  field; today's ladder is effectively descriptive/mechanistic (documented in the compiler).
- Card cost: +665 (envelope) + ~2,330 (plan block, plan-bearing books) — the IMP-05 diet package
  owns recovering this; hard ceiling (25k) retains ~2.7k headroom on the realistic fixture card.
- `compileSourcePackets` resolves sidecars against the real runs root (pre-existing), so the
  gate/write-path tests exercise the identical helpers under tmp roots rather than that one glob.

## 9. Integration notes

- **IMP-04:** consume `SourceUsePlanUnitV1` + `renderSourceUsePlanLines` (the card block is
  yours to sharpen); the write contract (`authorWriteContractFindings` D7 lead-thread rule) still
  pressures a named lead through fastRead+2 examples — your concreteness/stand-in critics should
  read licenses from the plan store (`sourceUsePlanPath`) and honor `explanation` units' no-scene
  right. The red-team case "explanation forced into a scene by the example contract" is only
  half-closed (plan side done; critic side is yours).
- **IMP-07:** `AttemptIdentityV1.sourcePlanHash` is populated on every write/repair attempt;
  typed patches must carry and re-verify it (the frozen repair contract already reserves the
  slot). The post-splice reserved-key scan is in `doRepairOneChapter` — patch application should
  keep an equivalent scan.
- **IMP-08:** wrap prior outputs/briefs-shown-as-evidence in the typed envelope
  (`prior-output` / `chapter-brief` artifact types are defined and tested but not yet consumed);
  reviewer findings arriving as data already use `reviewer-finding`.
- **IMP-09:** the detail-category vocabularies (`CASE_DETAIL_*`, `GENERIC_DETAIL_*`, …) are the
  intended shared taxonomy for ontology-aware validators; import them, don't re-mint.

## 10. Constraint compliance

No gate/threshold/blocker/cap weakened (SP15/SP16 are additive strengthening; absence stays
advisory). No book/chapter/author-specific behavior. No silent fallback (every invalid/stale/
corrupt plan condition throws or refuses loudly; absence is the explicit, pinned legacy path).
No new retries. No publish/promote/deploy/S3/outer-repo writes. No production state in tests
(tmp roots + fixtures only). No prose-quality claims from schema tests. Frozen contracts
untouched (manifest byte-identical; the freeze suite passes unmodified).
