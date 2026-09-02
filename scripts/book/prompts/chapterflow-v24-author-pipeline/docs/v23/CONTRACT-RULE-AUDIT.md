# CONTRACT-RULE-AUDIT (P07 / F9)

Sentence-by-sentence disposition of the four pre-P07 `sectionContract(kind)` blocklists in
`src/sections/sectionTasks.ts`, and where each rule now lives after the refactor into a layered
brief (`universalCore` + `gateAwareness` + `craftBrief`) plus a per-book scars file.

## Classes

- **A — universal invariant, NOT gate-enforced.** No SEC/AS/BP check fires on violation, so it
  must stay in prose. Disposition → `universalCore` (or the shared DO NOT block), tightened.
- **B — gate-enforced.** A SEC/AS check fires. The `~8` rules a writer must *design around*
  (not merely avoid) stay in `gateAwareness`, each ending "the validator enforces this". Every
  other class-B sentence is **DELETED from prose** — the gate is the enforcement; a prose copy
  buys dilution, not safety.
- **C — book-specific scar.** Names a phrase / prop / venue from one book. Disposition → MOVED to
  `config/book-scars/<bookId>.json`, rendered only into that book's task.
- **D — positive craft guidance.** What good looks like (the rubric grades this). Disposition →
  `craftBrief`, expanded.

## The `~8` design-around rules kept in `gateAwareness` (class-B that survives as prose)

| Concern | Enforcing check(s) | Kinds |
|---|---|---|
| Same-position quiz uniqueness (q01-vs-q01) | AS5 / AS12 (+ SEC126/SEC107) | learning |
| Cross-chapter answer/distractor reuse | AS6 | learning |
| Cross-chapter review-card similarity | SEC81 | learning |
| Distractor discipline (strawman / longest / tell / tail) | SEC52 / SEC53 / SEC59 / SEC116 | learning |
| Transfer floor (≥7/9 new-scenario) | SEC117 | learning |
| Cross-chapter example matching / saturation | AS9 / SEC80 / SEC89 / SEC85 / SEC93 / SEC96 / SEC98 / SEC100 / SEC101 / SEC108 / SEC112 | example |
| Intra-pack 5-gram | SEC87 | example |
| Cross-chapter summary tiers (framework list, verbatim para) | AS10 / AS11 / SEC82 / SEC83 | summary |
| Hook first-word clustering | SEC95 | summary |
| Cross-chapter implementation-field reuse / opener-closer shells | AS8 / SEC84 / SEC94 / SEC114 | action |
| Action worksheet / template / social-pressure saturation | SEC102 / SEC109 / SEC115 | action |
| Situational-trigger `ifThen` context | SEC67 | action |
| Anchor cited + ≥2 hardSpecifics verbatim (per kind) | SEC13/14, SEC33, SEC55–58, SEC73/74 | all |
| Leak family: source-note numbering / jammed CamelCase / " / " anchor-label seam | SEC103 / SEC104 / SEC105 / SEC88 | all |

## Class-A rules kept (no gate enforces them)

| Rule | Home |
|---|---|
| Hedge words appear in distractors ≥ in the key (score.py ships no hedge lexicon — see `pedagogyThresholds.ts`) | `universalCore` (learning) |
| Do not turn source-grounding rules into reader prose ("at least 3 named cases", "claims checkable") | `universalCore` (summary) + card variant (learning) |
| Name a public case plainly; never anonymize into a periphrastic tell (e.g. "a Moline-based equipment company") — the *rule* is unenforced; the book-specific *examples* moved to scars | shared DO NOT block |
| Scope ("Write ONLY …"), schema/count/length invariants, `Output <Pack>V1 JSON only` | `universalCore` |

---

## SUMMARY-PACK — sentence dispositions

| # | Original sentence (abbrev.) | Class | Disposition | Check id |
|---|---|---|---|---|
| 1 | "Write in the VOICE CARD register;" prefix | D | REPLACED by conditional `voiceCraftLine` (P07 dispatch fix — coherent for voiceless books) | — |
| 2 | Write ONLY hook/summaries/keyTakeaway/tryThisNow; not examples/quiz/cards/plan | A | universalCore | — |
| 3 | keyTakeaway ≤ 30 words | B(count-invariant) | universalCore | SEC18 |
| 4 | Use reservedVariety.hookShape as opening move | D | craftBrief | — |
| 5 | No 3 hooks in 5 share first word; no At/In/On stamps | B | gateAwareness | SEC95 |
| 6 | Openers syntactically simple; no 3-comma run-on in first 80 chars | B | DELETE | SEC11 |
| 7 | fastRead ≤7/≥350, deepRead ≤8.5/≥1000, fullRead ≤9.5/≥2400 | B(length-invariant) | universalCore (tier floors) | SEC6/SEC12 |
| 8 | Assembled breakdown Flesch ease ≥70; concrete verbs | B(invariant) | universalCore + craftBrief rubric target | SEC12 |
| 9 | Seed ≥3 memorable candidates (8–14w), ≥2 ≤14w clean | B→craft | craftBrief + rubric target | SEC17/SEC118 |
| 10 | Prefer testable_fact/framework anchors; namedExample only with ≥2 hardSpecifics | B | gateAwareness (anchor rule) | SEC13/SEC14 |
| 11 | Don't paste source-note sentences / long runs verbatim; keep hardSpecific short then paraphrase | B + D | DELETE gate part; paraphrase folded into craft/voice | SEC91 |
| 12 | Never echo a famous hardSpecific as a 5-word tag; "red phone by the pool" in one unit | B + **C** | rule→gateAwareness (5-gram); phrase→**scars(POM)** | SEC83 |
| 13 | Never expose audit labels "Fact 2"/"Source 3" in any form | B | gateAwareness (leak family) | SEC103 |
| 14 | Avoid jammed CamelCase source labels | B | gateAwareness (leak family) | SEC104 |
| 15 | Never paste anchor label / " / " seam (Disney/Southwest/John Deere examples) | B + **C** | rule→gateAwareness (leak); examples→**scars(POM notes)** | SEC105 |
| 16 | Don't anonymize a nameable case into a periphrastic tell (Moline / U.K. sandwich chain) | **A** (rule) + **C** (examples) | rule→DO NOT block; "Moline"=John Deere→**scars(POM)** | — |
| 17 | AS10 compares tiers; never repeat framework list as stock sentence | B | gateAwareness | AS10 |
| 18 | Don't stamp "transition, milestone, or pit" across chapters | B + **C** | rule→gateAwareness; phrase→**scars(POM)** | AS10 |
| 19 | Don't turn source-grounding rules into reader prose | **A** | universalCore | — |
| 20 | Don't use "attention, meaning, or memory" as a proof loop | **C** | **scars(POM)** | — |
| 21 | Don't reuse stock fullRead paragraphs / connective scaffolds | B | gateAwareness | SEC82/AS11 |
| 22 | Write each tier with a chapter-specific skeleton; avoid reusable 5-word runs [list] | D + B; list has scars | skeleton→gateAwareness; 5-gram→gateAwareness; scar phrases→**scars(POM)**; generic connectives→DELETE (SEC83) | SEC83 |
| 23 | In fullRead every body paragraph carries a unique named case/hardSpecific | B/D | gateAwareness | SEC82/SEC83 |
| 24 | VOICE — LIVED MOMENTS paragraph (nurse/cartoon exemplar) | D | **craftBrief VERBATIM** (snapshot-tested) | — |
| 25 | Output SummaryPackV1 JSON only | A | universalCore | — |

## EXAMPLE-PACK — sentence dispositions

| # | Original sentence (abbrev.) | Class | Disposition | Check id |
|---|---|---|---|---|
| 1 | VOICE CARD register prefix | D | conditional voiceCraftLine | — |
| 2 | Write ONLY the example pack | A | universalCore | — |
| 3 | Produce exactly six slots; final gate requires six | A(count) | universalCore | SEC22 |
| 4 | exampleId "ex01".."ex06" / "chNN-exNN-slug"; never bookId | A(format) | universalCore | SEC124 |
| 5 | Every example is a concrete human scene, named person, defining moment (not all "weighs a choice") | D | craftBrief | — |
| 6 | Let dealt sceneFrame/requiredBeat set the kind of moment | D | craftBrief | — |
| 7 | Different dealt name per slot; no source-figure as actor | A/B | universalCore | SEC29/SEC34/SEC35 |
| 8 | Each example cites namedExample anchor + ≥2 hardSpecifics verbatim | B | gateAwareness (anchor rule) | SEC33 |
| 9 | whyItMatters explains same cited sourceFactIds + decision | B/A | universalCore | SEC39 |
| 10 | Source facts drive the scene, never props/labels/wall cards/titles | B | universalCore (positive) / DELETE bookkeeping restatement | SEC30 |
| 11 | Never write "<label> includes/…"/"<hardSpecific> is evidence" bookkeeping sentences | B | DELETE | SEC30 |
| 12 | Never paste anchor label / " / " seam; Disney/Southwest examples | B + **C** | gateAwareness (leak); examples→**scars(POM)** | SEC105 |
| 12b | Don't anonymize into periphrastic tell (Moline / U.K. sandwich chain) | **A** + **C** | DO NOT block; example→**scars(POM)** | — |
| 13 | Vary openings/venues/protagonists/outcomes/title grammar; no "<Name> decision …" | D + B | craftBrief; title-shape → DELETE | SEC38 |
| 14 | whatToDo adds a new instruction not narrated in scenario | A | universalCore | — |
| 15 | Don't make a slot "whole process vs one loaded/focused point" | B + **C-ish** | DELETE (saturation gate) | SEC108 |
| 16 | Never "one focused intervention" as abstraction | B | DELETE | SEC108 |
| 17 | Don't make a slot "pleasant average vs peak/low/ending" | B | DELETE; POM peak-end note→**scars(POM)** | SEC112 |
| 18 | No exact 5-word phrase across ≥3 scenarios/whatToDo/whyItMatters | B | gateAwareness (intra-pack 5-gram) | SEC87 |
| 19 | Avoid BP13 stamps "transition, milestone, or pit, then"/"red phone…"/"tradeoff memo" | **C** | **scars(POM + TI)** | SEC89 |
| 20 | AS9 compares examples; no finite cycle of reusable scene frames; distinct role/timing/engine | B | gateAwareness | AS9/SEC80/SEC89 |
| 21 | No stock next-step phrases "so the next action is" | B | DELETE | (quiz/example ngram) SEC89 |
| 22 | No jammed CamelCase (BrokerCheck) | B + **C** | gateAwareness (leak); "BrokerCheck"→**scars(TI)** | SEC88 |
| 23 | No stock connective phrases from sibling chapters ("The social pressure is mild", "[Name] decides after X, not before") | B | DELETE | SEC97 |
| 24 | Don't make pending/until/only-if the default ending | B | gateAwareness (saturation) / DELETE detail | SEC98 |
| 25 | Don't close with "partial answer, then next action/review" | B | DELETE | SEC100 |
| 26 | Don't default to tactile action while someone waits/asks | B | DELETE | SEC101 |
| 27 | Vary outcomes (rejection/approval/comparison/audit/…) | D | craftBrief | — |
| 28 | Don't cycle action containers (tradeoff memo/prospectus packet/broker statement/…) | **C** | **scars(TI)** | SEC85 |
| 29 | Document/memo → one chapter-specific detail, not the scene engine | D | craftBrief | — |
| 30 | Don't reuse document-plus-old-default/shortcut-plus-repair frame; vary opening/pressure/turn/outcome | B | gateAwareness (saturation) | SEC96 |
| 31 | Prefer varied scene engines [list] | D | craftBrief | — |
| 32 | SCENE-ENGINE DIVERSITY: six DIFFERENT engines; ≥3 non-deliberation | D | craftBrief | — |
| 33 | Vary WHAT KIND / WHO; swapped name = repeat | D | craftBrief | — |
| 34 | Don't rely on default venues (budget apps/spreadsheets/kitchen tables/…) | B | gateAwareness (saturation) / DELETE list | SEC85/SEC93 |
| 35 | Controlled friction/recovery; avoid six instant wins | D | craftBrief | — |
| 36 | Don't open with "[Name] is on a phone call"/"at the front desk" | B | DELETE | SEC36 |
| 37 | No synthetic scaffolds "beside the slate cabinet"/"slatefilter"/"stays closed" | B | DELETE | SEC30/SEC37 |
| 38 | Do not write summaries/quiz/cards/implementation | A | universalCore | — |
| 39 | Output ExamplePackV1 JSON only | A | universalCore | — |

## LEARNING-PACK — sentence dispositions

| # | Original sentence (abbrev.) | Class | Disposition | Check id |
|---|---|---|---|---|
| 1 | VOICE CARD register prefix | D | conditional voiceCraftLine | — |
| 2 | Write ONLY quiz + review cards | A | universalCore | — |
| 3 | Each question: questionId/prompt/3 choices/correctIndex/explanation/bloomsLevel/depthLevel | A(schema) | universalCore | SEC42–45/SEC125 |
| 4 | bloomsLevel enum; depthLevel from blueprint slot | A(schema) | universalCore | SEC93 |
| 5 | correctIndex MUST match blueprint slot | B(invariant) | universalCore | SEC46 |
| 6 | Quiz anchors support quiz_prompt/explanation/key_evidence; namedExample ok | B | universalCore (provenance) | SEC55 |
| 7 | Obey dealt promptShape/answerStyle/distractorTrap/caseCueIds | D + B | gateAwareness (AS5 line) + craftBrief | AS5 |
| 8 | Use caseCueIds as cues/anchors | D | craftBrief | — |
| 9 | Never expose audit labels in prompts/choices/explanations/cards | B | gateAwareness (leak) | SEC103 |
| 10 | Avoid jammed CamelCase source labels | B | gateAwareness (leak) | SEC104 |
| 11 | Never paste anchor label / " / " seam (Disney/Southwest/John Deere) | B + **C** | gateAwareness (leak); examples→**scars(POM)** | SEC105 |
| 12 | Don't anonymize into periphrastic tell (Moline / U.K. sandwich chain) | **A** + **C** | DO NOT block; example→**scars(POM)** | — |
| 13 | AS5 compares q01-to-q01; different scenario/opening/pressure/source per slot | B | gateAwareness | AS5/AS12 |
| 14 | Keep prompts LEAN and scenario-driven | D | craftBrief | — |
| 15 | Don't front-load named-case labels (LA hotel/Houston charter/free popsicles) | D + **C** | craftBrief (rule); phrases→**scars(POM)** | SEC107 |
| 16 | Name AT MOST ONE case, only when the question hinges on it | D | craftBrief | — |
| 17 | Don't repeat a case phrase ("free popsicles…"/"students announce…"/"red phone…") across stems | B + **C** | gateAwareness (ngram); phrases→**scars(POM)** | SEC94 |
| 18 | Distractors discriminate on the mechanism | D | craftBrief | — |
| 19 | AS6 compares answers/distractors; correct answer names requiredFactIds mechanism in fresh words | B | gateAwareness | AS6 |
| 20 | Never reusable correct answers ("change attention, meaning, or memory"/"elevation, insight…") | **C** | **scars(POM)** | AS6 |
| 21 | Review cards use review_card anchors incl. namedExample | B | universalCore (provenance) | SEC57 |
| 22 | Obey frontShape/retrievalTarget/backShape/caseCueIds; include hardSpecific when cued | D + B | gateAwareness (SEC81) + craftBrief | SEC81 |
| 23 | Never make a card retrieve source-grounding requirements | **A** | universalCore | — |
| 24 | Wrong choices plausible, not strawman absolutes (always/never/automatically/…) | B | gateAwareness (distractor discipline); enumerated list DELETED | SEC52 |
| 25 | Named-case wrong choices stay in same case; don't import another case's proper noun | B | DELETE | SEC111 |
| 26 | Never append mechanical proof tails ("under the stated evidence test") | B | gateAwareness (distractor discipline) | SEC59 |
| 27 | Keyed answer not longest by chars; <1.4x avg words / ≤1.5x avg chars | B | gateAwareness (distractor discipline) | SEC53/SEC116 |
| 28 | Hedge words appear in distractors ≥ in key | **A** | universalCore | — |
| 29 | ≥7 of 9 questions transfer (new scenario) | B | gateAwareness + craftBrief rubric target | SEC117 |
| 30 | Vary prompt/choice/explanation/card grammar; no reused stems | D + B | craftBrief | SEC107 |
| 31 | Cards checked across whole book; follow dealt shapes + chapter-specific noun | B | gateAwareness (SEC81) | SEC81 |
| 32 | Don't use generic cross-book stems ("What should you inspect"/"What check does"/…) | D + B | craftBrief | SEC81 |
| 33 | Card backs answer in a different sentence shape from neighbors | D | craftBrief | SEC81 |
| 34 | Output LearningPackV1 JSON only | A | universalCore | — |

## ACTION-PACK — sentence dispositions

| # | Original sentence (abbrev.) | Class | Disposition | Check id |
|---|---|---|---|---|
| 1 | VOICE CARD register prefix | D | conditional voiceCraftLine | — |
| 2 | Write ONLY tryThisNow + implementationPlan; concrete/low-friction/provable | A | universalCore | SEC62/SEC63 |
| 3 | Provenance uses implementation_guidance anchors; namedExample ok | B | universalCore (provenance) + gateAwareness anchor | SEC73 |
| 4 | Never expose audit labels | B | gateAwareness (leak) | SEC103 |
| 5 | Avoid jammed CamelCase source labels | B | gateAwareness (leak) | SEC104 |
| 6 | Never paste anchor label / " / " seam (Disney/Southwest/John Deere) | B + **C** | gateAwareness (leak); examples→**scars(POM)** | SEC105 |
| 7 | Don't anonymize into periphrastic tell | **A** + **C** | DO NOT block; example→**scars(POM)** | — |
| 8 | tryThisNow starts with chapter-specific trigger; no "Open the next stock idea"/"Each Friday" | D + **C** | craftBrief (rule); "Open the next stock idea"/"Before the next stock decision"→**scars(TI)** | SEC94 |
| 9 | coreSkill built around action.practiceForm/practiceConstraint; chapter-specific closer | D + B | universalCore + gateAwareness (AS8) | SEC84 |
| 10 | AS8 compares plan fields; each ifThen follows a dealt ifThenPlanShapes[] w/ requiredFactIds | B | gateAwareness | AS8 |
| 11 | Don't repeat "social pressure … then pause for evidence" shell | B | gateAwareness (saturation) | SEC115 |
| 12 | coreSkill and 24h challenge not both classify/choose/predict | B | gateAwareness (saturation) | SEC109 |
| 13 | 24h challenge uses dealt practiceForm; vary opener/cadence; no "Before tomorrow ends" | B | gateAwareness (opener shell) | SEC114 |
| 14 | Don't repeatedly classify transition/milestone/pit, choose elevation/insight/…, predict attention/meaning/memory | **C** | **scars(POM)** | SEC109 |
| 15 | Don't use "attention, meaning, or memory" as proof loop | **C** | **scars(POM)** | — |
| 16 | Don't stamp "transition, milestone, or pit" across tryThisNow/ifThen | **C** | **scars(POM)** | SEC109 |
| 17 | Each ifThenPlans[].context is a situational trigger, not a bare venue | B | gateAwareness | SEC67 |
| 18 | Don't compare a live decision to a full source-case phrase | D + **C-note** | craftBrief; TI note→**scars(TI)** | — |
| 19 | Don't default to "create/open a template/blank/checkpoint kept pending" | B | gateAwareness (saturation) | SEC102 |
| 20 | Don't paste source-note sentences / long runs into action fields | B | DELETE | SEC91 |
| 21 | Output ActionPackV1 JSON only | A | universalCore | — |

---

## Book-scars extraction (class-C moves)

**`config/book-scars/the-power-of-moments.json`** — phrases: "red phone by the pool", "free
popsicles on a silver tray"/"free popsicles", "students announce college choices", "attention,
meaning, or memory"(+variant), "elevation, insight, pride, and connection", "transition,
milestone, or pit"(+variants), "targets are transitions, milestones, and", "the stake-fit rule
because a"; frames: classify/choose/predict framework triad, framework-triad stamping, the
proof-loop close; notes: periphrastic tells (John Deere / Moline, Disney parks, Southwest
Airlines, Magic Castle Hotel / "a Los Angeles hotel", YES Prep / "a Houston public charter
network"), peak-end → concrete action.

**`config/book-scars/the-intelligent-investor.json`** — phrases: "Open the next stock idea",
"Before the next stock decision", "BrokerCheck"; frames: tradeoff memo, prospectus packet,
broker statement, portfolio policy file, bond quote sheet, allocation worksheet, research queue,
container-cycling; notes: don't compare to a full source-case phrase; CamelCase → spaced form.

## Summary counts (approx., dominant class per sentence)

| Class | Summary | Example | Learning | Action | Total |
|---|---|---|---|---|---|
| A (universal, kept) | 6 | 8 | 8 | 4 | 26 |
| B → gateAwareness (design-around) | 8 | 7 | 9 | 8 | 32 |
| B → DELETED (gate-only) | 3 | 12 | 2 | 2 | 19 |
| C → book-scars | 5 | 6 | 6 | 6 | 23 |
| D → craftBrief | 4 | 10 | 8 | 3 | 25 |

**Acceptance:** every original sentence is dispositioned above; the only class-B prose that
survives is the design-around set (each line names its validator and ends "the validator
enforces this"); every class-C phrase moved to its owning book's scars file.
