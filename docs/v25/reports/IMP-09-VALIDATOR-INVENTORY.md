# IMP-09 — Lexical Validator Inventory

Instruction-1 deliverable: every active validator with a lexical/surface
component, its intended invariant, the surface proxy it uses, known failures,
model-sensitivity risk under the GPT-5.6-SOL migration, and its IMP-09
disposition. Severity semantics are UNCHANGED for every row (constraint: no
weakening; replacements alter *matching*, never *what blocks*).

| Check | Invariant | Surface proxy (pre-IMP-09) | Known failure | Model-sensitivity | IMP-09 disposition | Severity |
|---|---|---|---|---|---|---|
| **D7 lead-thread** (`authorWriteContractFindings`) | the dealt lead carries fastRead + ≥2 examples | FIRST capitalized ASCII token of the case label, `\b`-regex, case-sensitive | R2:84/176 — surname usage ("Van Gogh", "Malamud") = false negative; diacritics outside `[A-Z]`; lowercase particles; concept labels → token `""` → **silent skip** | HIGH (alias/syntax variation across models) | **REPLACED**: structured identity rides the brief (`leadThread.caseId` + compiler-derived `aliases`); presence = Unicode-aware, diacritic-folded, possessive/hyphen-tolerant ANY-alias match (`leadAliases.ts`); legacy briefs derive the same set at check time; concept leads now ENFORCED via the label. Shadow corpus: zero regressions, false-negative + vacuous-skip classes fixed. | write-contract complaint (unchanged) |
| **SC9 example grounding** (`checkExampleSourceGrounding`) | scenarios use real source material, not invented set pieces | per-scenario word-boundary hit on sidecar proper-noun fingerprints | forces a source-name restamp onto units the IMP-03 plan DEALT as generic/constructed | MEDIUM | **PLAN-AWARE**: up to N unmatched scenarios licensed where N = dealt generic/constructed plan units (positional, conservative); beyond the license fires the same MAJOR; no plan → byte-identical | major (unchanged) |
| `extractProperNouns` (SC9 candidate pool) | source anchors are recognizable | ASCII `[A-Z][A-Za-z0-9'-]{3,}` + acronyms + hyphenated | diacritic-leading anchors missed from the pool | LOW (pool is sidecar-derived, wide) | **DOCUMENTED RESIDUAL** — candidate pools are curated v2 `hardSpecifics` first; ASCII gap listed for follow-on | n/a (pool builder) |
| **SC11.1-.6 provenance** | every unit names + uses its source anchor | anchor IDs (structural) + verbatim `hardSpecifics` containment | page-citation specifics (fixed CF-J) | LOW (ids are structural) | KEPT — id-based, not lexical; hardSpecifics containment is case-insensitive verbatim by design (curated strings) | blocker (unchanged) |
| **B15 example count** | dealt example count is exact | `examples.length` (structural) | none | NONE | KEPT | write-contract complaint |
| `leadLabelHasToken` / `leadLabelIsNamedCase` (dealer SELECTION) | a dealt lead must be contract-enforceable; named cases preferred over concepts | ASCII capitalized-token heuristics | diacritic-leading labels mis-routed at SELECTION time | LOW (selection, not validation) | **DELIBERATELY UNCHANGED** — changing selection re-deals leads on existing books (dealt-state drift). Unicode selection gap = follow-on work. The CHECKER no longer depends on it. | n/a (dealer) |
| **C37 register family** (`sourceRegister.ts`) | claim strength / scene license / specifics match the plan | lexicon regexes (CAUSAL_RE etc.) | conservative by design | MEDIUM | KEPT advisory-MINOR (calibration-pending, IMP-11); CAUSAL_RE exported — ONE lexicon shared with IMP-08's `extractCausalClaims` | advisory (unchanged) |
| **C31-C35 machinery/clone detectors** + IMP-06 `cloneDetection` | no cross-chapter verbatim/near-clone runs | normalized n-gram runs, exact-clone hashes | fixture-boilerplate flagging (test-side, fixed IMP-06) | LOW (already normalized: case/punct) | KEPT — exact-clone blockers retain byte semantics; near-clone thresholds frozen shadow (IMP-06 activation contract) | per catalog (unchanged) |
| **CHB14/15/17 quiz tells** | longest-option/hedging tells are telemetry | length/lexical measures | INVERTED by design (memory: never lexical quiz-tell gates) | NONE (telemetry) | KEPT telemetry-only; quiz SEMANTICS owned by IMP-08 phase-2 adjudication | none (telemetry) |
| **C24/C25/C27 cast checks** | cast size / quiz-name consistency / name commonality | capitalized-name heuristics | shadow-calibrated zero-FP on gold | MEDIUM | KEPT (shadow/advisory posture); listed for IMP-11 re-calibration on SOL output | shadow major / advisory |
| **Apparatus/leakage detectors (C32-C35, SL6 etc.)** | no scaffold/source-apparatus text in reader prose | distinctive-form catalogs (IMP-06 prose scan distinctive-forms-only) | over-matching common terms (fixed by distinctive-forms rule) | LOW | KEPT | per catalog (unchanged) |

## Instruction-12 note

No residual semantic judge was introduced: every replacement above is
structured or deterministic-lexical. (If later work adds one, it must use the
IMP-00/IMP-08 isolated profile + schema-bound output with full hash binding.)

## Remaining lexical validators recommended for later work

1. `extractProperNouns`' ASCII candidate pool (diacritic-leading anchors).
2. Dealer-side `leadLabelHasToken`/`leadLabelIsNamedCase` Unicode awareness —
   requires a dealt-state migration window (re-deals leads).
3. C27 name-commonality oracle under SOL naming distributions (IMP-11
   calibration input).
