# IMP-05 requirement ledger — writer-card diet

Every instruction currently in the always-sent writer card (`AUTHOR_HOUSE_RULES`,
`AUTHOR_QUALITY_BAR`, `AUTHOR_PREMIUM_BLOCK`, `authorSchemaHint`, `authorSelfVerify` in
`src/orchestrator/authorRun.ts`), with its intent, the layer that ENFORCES it (not the card —
the card is a first-draft hint), and the retain / move / delete decision. The rule is
rollback criterion #1: **no protection may disappear; it moves to compiler data, deterministic
validation, a critic, or a compact local objective — proven here.**

Legend — enforcement owner: `GATE` = deterministic blocker; `SCORED` = blinded reviewer rubric;
`CRITIC` = advisory detector (Cnn); `COMPILER` = brief/source-plan/deal data; `SELF` = kept as a
compact card invariant because it is the writer's only lever (no downstream owner).

## Global invariants — RETAINED (compact) in the dieted card

| # | Invariant | Enforcement owner | Decision |
|---|---|---|---|
| I1 | Complete, valid ChapterV21 (every required field) | GATE (gate-chapter schema) + SELF | retain — the priority-completion rule |
| I2 | Accurate thesis; obey the source-use plan; invent no fact/number/name/claim beyond the packet | GATE (sourceGrounding/realness) + COMPILER (source-use plan) + SELF (FACTS check) | retain (compact) |
| I3 | Quiz keys derivable from prose; key is a MOVE not a source; distractor = key warped by a real failure mode; follow the answer-key pattern | GATE (quizQuality strawman-rate, tellRate) + CRITIC (C35 lineageKeyQuiz) + COMPILER (brief failure modes / answer pattern) + SELF (KEYS check) | retain (compact) |
| I4 | Identity/product limits: never transcribe scaffold vocabulary; reader never meets the machinery | GATE (antiSalting/authoringContract scaffold) + CRITIC (C32 metaCaseProtagonist, C33 beatVocabularyEcho) + SELF (SCAFFOLD check) | retain (compact) |
| I5 | Plain language (Flesch 72-84 on breakdown); density (every paragraph adds new info); honest limits | GATE (readerBudgets Flesch band) + SCORED (density/limits) | retain (compact) |

## Precedence — NEW (instruction 3)

One explicit order rendered at the top of the card: safety/source/identity → schema/product
completeness → thesis/evidence/quiz → chapter objective → active book-level constraints →
optional style. Replaces the implicit ordering scattered across the rules. Owner: card (this is
the conflict-resolution contract; tested by the precedence-conflict tests).

## Per-rule disposition

| Card rule (old) | Intent | Enforcement owner | Decision + replacement |
|---|---|---|---|
| HOUSE: "Plain verbs, Flesch 72-84" | plain prose | GATE readerBudgets | MOVE → invariant I5 (one line) |
| HOUSE: "Teach through real cases as lived moments" | concreteness | SCORED + IMP-04 critics | MOVE → chapter objective (brief/source-plan) |
| HOUSE: "Honest about limits" | limits | SCORED | MOVE → invariant I5 |
| HOUSE: "No corporate filler / template smell / aphorism-stacking" | register | CRITIC (C31 exampleRegister) + SCORED | DELETE prose → invariant I4 (machinery) + critic |
| HOUSE: "quiz key derivable / answer-key pattern" | quiz | GATE + COMPILER | MOVE → invariant I3 |
| HOUSE: "length budget; density beats coverage; cut before padding" | brevity | COMPILER (brief lengthBudget) + GATE | REPLACE with the priority-completion rule (instr. 5) |
| HOUSE: "never transcribe scaffold vocabulary" | identity | GATE antiSalting | MOVE → invariant I4 |
| QB rule 1 DISTRACTOR PARITY `[GATED]` + length-audit protocol | tell caps | GATE (quizQuality tellRate/lenTell) | DIET → one compact line; verbose audit protocol DELETED (the gate enforces; the ~19-min-retry rationale is a quality/latency concern the bakeoff measures, not a protection) |
| QB rule 2 KEY PARAPHRASE `[SCORED]` | echo | CRITIC (echo meter) + SELF | DIET → folded into I3 (one clause) |
| QB rule 3 PRACTICE CONCRETENESS `[GATED floor]` | practice | GATE (readerBudgets practice floor) + COMPILER (practice shapes) | DIET → compact; "form comes from your dealt shapes" stays (COMPILER pointer) |
| QB rule 4 PLAIN LANGUAGE `[GATED]` | flesch | GATE readerBudgets | DIET → folded into I5 |
| QB rule 5 DISTRACTOR TRANSFORM `[SCORED]` incl. CAUSAL STEMS / ECHO SYMMETRY / KEY IS A MOVE / mechanical-word gate | quiz craft | GATE (mechanical-distractor 7% gate) + CRITIC C35 + COMPILER (failure modes) | DIET → I3 core + one causal-stem clause; the mechanical-word list DELETED from card (the gate counts it; naming the banned words on the card is the "X not Y" anti-pattern O3 warns against) |
| QB rule 6 SURFACES THAT TRANSFER `[SCORED]` (cards/practice/example-job) | transfer | SCORED + CRITIC (C30 example-job) + COMPILER (brief JOB) | DIET → compact; example-job pointer stays (brief) |
| QB rule 7 EXAMPLE CRAFT `[SCORED]` (decision→consequence, register, competing-interests, F17) | example | SCORED + CRITIC C31 + COMPILER (CONTENT DEVICES deal, exampleArcs) | DIET → compact objective; the "narrated in the scene's voice / no evaluator-question opener" register moves fully to C31; competing-interests + F17 stay as COMPILER deal |
| QB rule 8 HOOK CARRIES A STAKE `[SCORED]` + DOORWAY + REGISTER | hook | SCORED + CRITIC (C34 citationDateDoorway, C32/C33 register) | DIET → compact; the FAIL/PASS micro-example KEPT (one sparse example, O3-endorsed); machinery-register moves to I4 + critics |
| QB rule 9 TAKE-HOME SURFACES `[SCORED]` (skill-name opener) | take-home | SCORED + SELF (schema hint requires coreSkill opener) | DIET → schema hint carries the shape; one compact line |
| PREMIUM INSIGHT/LIMITS/DENSITY/PLAIN WORDS/READER AGENCY/VOICE/QUIZZES | rubric | SCORED (blinded reviewers, RUBRIC.md) | DIET → one compact line each (the reviewers own scoring; the card names the axis, not a formula). VOICE's 4 mechanical moves DELETED as a formula (instruction 4 "fixed formulas"); the axis "this book's voice, not a house voice" stays |
| Self-verify items 1-7 | pre-exit check | mixed | DIET → 4 ordered highest-risk questions (KEYS, FACTS, SCAFFOLD, COMPLETE), each a structured-evidence answer (instruction 10); the rest are covered by their gates |
| Historical comment block (lines 281-379) | incident lessons | — | MOVE → this ledger (the card comment now points here) |

## Removed-protection audit (rollback criterion #1)

Every DELETED card sentence maps to a retained owner above. Specifically:
- the mechanical-distractor word list → still counted by the quizQuality 7% gate (GATE);
- the tell-length audit protocol → tellRate/lenTell gate (GATE);
- the VOICE 4-move formula → the "this book's voice" axis stays SCORED; the mechanical pair-sentence
  ritual was itself an anti-pattern (a fixed formula the plan instructs removing);
- register/machinery lessons → C31-C35 advisory critics (CRITIC) + invariant I4;
- example decision→consequence + competing-interests + F17 → C31 + the CONTENT DEVICES deal (COMPILER).

No gate, threshold, source blocker, acceptance predicate, retry cap, or critic severity changes.
The public ChapterV21 schema, the source ontology, and model routing are untouched.

## Card composition versioning (instruction 13)

`CARD_BLOCK_VERSIONS` stamps a version per block (house-invariants, precedence, quality-bar,
premium, schema-hint, self-verify, data-envelope) and `authorCardComposition()` returns a hash of
the assembled control text so evidence (IMP-10) can identify card drift independent of the payload.
