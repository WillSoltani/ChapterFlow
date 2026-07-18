# IMP-09 — Validator Compatibility and Lexical Matcher Hardening

**Status:** COMPLETE (D7 replaced; SC9 plan-aware; inventory + shadow corpus delivered)
**Baseline:** `8653046c1` (IMP-08; full sha in the machine report)
**Machine report:** `implementation-report.imp-09.json`
**Inventory:** `IMP-09-VALIDATOR-INVENTORY.md` (instruction-1 deliverable)

## What landed

This is a **compatibility migration, not a relaxation**: brittle surface
assumptions moved to structured identity and normalized matching while every
severity, threshold, and blocker stayed exactly where it was.

### D7 lead-thread: first-token proxy → structured identity + compiler-derived aliases

**Before** (`authorRun.authorWriteContractFindings`): the dealt case label was
reduced to its FIRST capitalized ASCII ≥4-char token ("Vincent van Gogh" →
"Vincent") and presence-tested with a case-sensitive `\b` regex. R2:84/176
documents the damage: writers legitimately use surnames ("Van Gogh",
"Malamud") → false negatives that burned regen budget and halted entry 1;
diacritics fall outside `[A-Z]`; lowercase particles break token shape; a
concept label can yield NO token — the check **silently skipped**.

**After**:

- `resolveLeadThread` now carries the packet case's stable id (`caseId` — it
  existed at deal time and was discarded) and a compiler-derived, reviewable
  `aliases` set onto the brief (`leadThread` additive optional fields; old
  persisted briefs parse untouched). **Selection is byte-identical** — which
  lead gets dealt did not move (pinned).
- `src/critics/leadAliases.ts` — `leadAliasSet(label)`: full label, family
  name WITH particles ("van Gogh", "de la Cruz", "al-Khwarizmi"), given name,
  each name-shaped token; concept labels become their own single alias.
  Nothing inferred, no nicknames, no model-generated aliases (instruction 14)
  — every alias is a deterministic projection of the label, and the module is
  pure (no io/env; the static test enforces it).
- Presence (`aliasPresent`): Unicode word boundaries (`\p{L}\p{N}`), diacritic
  folding (NFD), straight/curly apostrophes, hyphen↔space, possessive
  tolerance. **Case rule:** multi-word aliases match case-insensitively (the
  sequence is distinctive); single-token aliases stay case-SENSITIVE exactly
  like the old matcher — so generic lowercase words ("the airlines flew", "a
  willow bent") can never satisfy an org/name alias (the acronym/common-term
  red-team collision).
- The check itself is unchanged in shape: same complaint strings/units (D7
  check id preserved, instruction 9), same fastRead + ≥2-examples requirement,
  same severity, same call site. Legacy briefs (no aliases field) derive the
  SAME set at check time from the same utility — strictly-superset matching,
  and a chapter carrying NO form of the dealt name **still fails**
  (verification #4, tested).
- Concept leads are now ENFORCED (the label itself must thread) — the old
  engine's vacuous skip is gone, closing a hole rather than opening one.

### Shadow dual-run (instruction 8)

`src/critics/validatorShadow.ts` preserves the pre-IMP-09 algorithm VERBATIM
(production-dead reference) and dual-runs it against the new matcher over a
14-fixture synthetic cross-book corpus (full name, surname ×2, possessive,
diacritic, lowercase particle, hyphenated name, organization, concept lead,
invented lead, and four TRUE-absence negatives). Test-pinned adjudication:
**zero `old-correct-new-wrong` rows, zero `both-wrong`**; the
`new-fixes-false-negative` (R2 surname class) and `new-fixes-vacuous-skip`
(concept-lead class) rows are the only differences, and every expected-absent
fixture stays absent (matching never became token-mention-permissive — the
rollback tripwire).

### SC9 source-grounding: plan-aware register (instruction 4)

`checkExampleSourceGrounding` now consults the IMP-03 compiler-owned
source-use plan: units the plan DEALT as `generic`/`constructed` are validated
by their declared register (C37 + register advisories own that) and are no
longer forced to restamp a source proper noun. Mechanics (extracted pure as
`scenarioGroundingFindings`, directly tested): up to N unmatched scenarios are
licensed where N = the plan's generic/constructed unit count (positional,
ascending index — the plan does not bind units to slots); every unmatched
scenario BEYOND the allowance fires the **same SC9 MAJOR as before**; no plan
→ allowance 0 → byte-identical legacy behavior; a present-but-unreadable plan
→ allowance 0 (the STRICTER direction — the author lane separately fail-closes
on corrupt plans). The plan can only ever shrink scenario findings, never add,
and never below what the plan licensed.

### Deliberately unchanged (and why)

- **Dealer selection** (`leadLabelHasToken`/`leadLabelIsNamedCase`): still the
  ASCII heuristics — changing them re-deals leads on existing books
  (dealt-state drift). Their Unicode gap is recorded in the inventory as
  follow-on work; the CHECKER no longer depends on them.
- Exact-clone blockers, apparatus catalogs, SC11 anchor checks, CHB quiz-tell
  telemetry: kept per the inventory (structural or already-normalized; quiz
  SEMANTICS are IMP-08's phase-2 instrument).
- No residual semantic judge was added (instruction 12 conditional — n/a).

## Tests

- **`tests/lead-aliases.test.ts` (13):** alias derivation (particles, stacked
  particles, al- names, concept labels, article stripping, no inferred
  nicknames); Unicode presence (diacritics both directions, possessives curly
  and straight, hyphen↔space, mid-word never matches, single-token case
  sensitivity incl. the airlines/willow negatives); the D7 contract end-to-end
  — surname class passes, dealt vs check-time-derived alias equivalence, TRUE
  missing-thread still fails, diacritic + particle leads enforced, concept
  lead enforced (vacuous skip closed); `resolveLeadThread` metadata (caseId +
  aliases) with selection unchanged; the shadow corpus (zero regressions);
  SC9 allowance arithmetic (0/1/2 licensed, beyond-license fires, same check
  id + severity, no-plan byte-identical); static anti-book-hack (no env, no
  io, no book-slug literals in the new modules); hostile-instruction immunity.
- **Retargets:** `stier2-levers` resolveLeadThread pins compare SELECTION
  fields via a projection (the additive metadata is asserted separately) —
  every selection expectation byte-identical.
- Full hermetic suite: **2,280 pass / 0 fail / 18 skip / 6 xenv** (+13);
  `npx tsc --noEmit` clean; `contract-validate` PASS.

## Constraints honored

- No gate/threshold/severity/blocker change: D7 complaints, SC9's MAJOR, and
  every inventory row keep their pre-IMP-09 severity; `gateChanges: []`.
- No book/title-specific behavior — statically tested (no book-slug literals,
  no env/config reads in the new modules); aliases are compiler-derived only.
- No silent fallback: legacy briefs take the SAME deterministic derivation;
  corrupt plans degrade to the stricter no-plan path.
- Backward compatibility: brief `leadThread` fields are additive-optional;
  no persisted artifact migrates; check ids unchanged.

## Risks / open items

- **False-positive direction is asymmetric by design**: the new matcher can
  only accept MORE genuinely-present threads. The only new acceptance class
  is real alias forms (surname/diacritic/particle/concept-label). Cross-book
  false-positive rates on live SOL output are §16/§18 evidence.
- The dealer-side ASCII selection heuristics and `extractProperNouns`' ASCII
  candidate pool remain (inventory: follow-on) — they affect which lead is
  dealt / which anchors seed SC9's pool, not whether a defect is missed.
- SC9's positional license (ascending index) is an approximation — the plan
  does not bind units to example slots. A misassignment can only trade WHICH
  unanchored scenario is licensed, never HOW MANY.

## Integration notes

- **IMP-11:** the shadow-report shape (`d7ShadowReport`) is reusable for any
  future validator replacement; C27/name-commonality and the dealer heuristics
  are listed calibration inputs.
- **§15 audit:** the inventory table is the checklist for "remaining lexical
  validators"; every row names its disposition.
