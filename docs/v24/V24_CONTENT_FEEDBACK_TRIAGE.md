# V24 Content-Feedback Triage — high-output-management ch7/ch8 review

**Date:** 2026-07-08 · **Triage agent:** v24 content-quality triage orchestrator (this session)
**Input:** 17-finding external review of `high-output-management` Chapter 7 ("The Breakfast
Factory Goes National") and Chapter 8 ("Hybrid Organizations")
**Sample of record:** `book-packages/high-output-management.v21.json` (published `e750a692e`;
run state was swept by publish-final's canonical cleanup, so the package is the durable sample)
**Companions:** `V24_CONTENT_FEEDBACK_IMPLEMENTATION_PROMPTS.md` (prompts CF-A…CF-H),
`V24_CONTENT_FEEDBACK_ROADMAP.md` (lanes, sequencing, orchestrator contract)
**Pipeline root (abbreviated `PIPE/`):** `scripts/book/prompts/chapterflow-v24-author-pipeline/`

Nothing was implemented in this pass: no code, no prompt-constant edits, no regeneration, no
publish, no push.

---

## 0. Evidence base and independent corroboration

Three read-only evidence sweeps were run before triage:

1. **Sample audit** — every claim checked against the actual published chapter JSON, with
   verbatim quotes (claim-by-claim results are cited inline below).
2. **Pipeline surface map** — where each behavior is produced/validated. Key architectural fact:
   the v24 `--author` path uses ONE whole-chapter writer whose entire instruction is assembled in
   `PIPE/src/orchestrator/authorRun.ts` (`buildAuthorCard`), governed by three verbatim constants
   — `AUTHOR_HOUSE_RULES` (~line 217), `AUTHOR_QUALITY_BAR` (~271), `AUTHOR_PREMIUM_BLOCK` (~291)
   — plus the dealt VARIETY block from `PIPE/src/compiler/briefRotation.ts` and the CONTENT
   DEVICES deal from `PIPE/src/compiler/contentDeviceDeal.ts`. The legacy `PIPE/prompts/*.system.md`
   per-section agents are NOT the v24 path.
3. **App/schema blast radius** — for the comparison-table finding (details under Finding 16).

**Independent corroboration that the reviewer is calibrated:** the book's own blinded acceptance
panel (pooled composite **78.8**, below the 80 premium telemetry target; ch8 = **85.0**, the
book's lowest chapter) issued non-blocking texture advisories: `scene_skeleton` on **all 16
chapters** ("same dramatic transaction shape, nouns swapped") and `repeated_unit` on chapters
**2/5/8/11** — which are exactly the four chapters where the sample audit found the recycled
"Agreement nods; commitment signs" line (Finding 11). The external feedback and the internal
panel are pointing at the same residual weaknesses. Source:
`PIPE/docs/v24/V24_HIGH_OUTPUT_MANAGEMENT_COMPLETION_AND_PUBLISH_REPORT.md` §12.

**Five enforcement gaps confirmed in the pipeline** (these anchor the verdicts below):

| # | Gap | Surface |
|---|-----|---------|
| G1 | No per-hook tension/concreteness critic or review axis — only book-level hook-*shape* saturation (`catalogAudit.ts` `classifyHook`, `bookPatternAudit.ts`) | hooks |
| G2 | Memorable-line / aphorism cross-book reuse unguarded — `crossBookSignatureAudit.ts` scans only breakdown tiers, only 6–25-word sentences, and is a watchlist, not a gate; "Agreement nods; commitment signs" (4 words, in counterintuition/fastRead/coreSkill/memorableLines fields) is invisible to it and absent from `PIPE/config/banned-phrases.json` | signature lines |
| G3 | First-use definition rule covers only terms the chapter *coins* (`AUTHOR_PREMIUM_BLOCK` PLAIN WORDS), not terms of art inherited from the source; no deterministic check | terminology |
| G4 | No critic enforces that adjacent chapters teach distinct *learning jobs* — differentiation is enforced on delivery machinery (architecture families, content devices), not the pedagogical job | chapter separation |
| G5 | Within-chapter "each example teaches a DIFFERENT facet" is prompt-only (`AUTHOR_QUALITY_BAR` rule 6), with no detector; `EXAMPLE_LENSES` deals form variety, not lesson variety | example diversity |

---

## Finding 1: Chapter 8 has a weak hook

### Verdict
**Agree**

### Reader impact
The hook is the chapter's doorway; the first line either creates a reason to keep reading or it
doesn't. Ch8's hook gives the reader a man labeling functions on paper — no stake, no cost, no
question. For an already-abstract chapter this compounds Finding 2: the reader gets abstraction
before any reason to care.

### Evidence
Sample audit CONFIRMED. Ch8 hook, in full: *"Jude maps engineering, manufacturing, sales, and
finance functions to shared professional standards."* — a flat activity description. Contrast
ch7: *"What breaks when one breakfast counter becomes national scale across multiple branch
locations?"* — a threat-framed question. Ch8 scored 85.0, the book's lowest chapter composite.

### Pipeline source
- `PIPE/src/orchestrator/authorRun.ts` — `authorSchemaHint` (~298) requires only "60–120 chars";
  `AUTHOR_QUALITY_BAR` rule 4 addresses opening abstraction generally, not hook tension.
- `PIPE/src/compiler/briefRotation.ts` — `OPENER_TYPES` (line 126: question/scene/claim/
  statistic/tension-thesis) rotates hook *shape* for variety; no quality bar per shape.
- Gap G1: no per-hook tension critic; no reader-review hook axis (retention covers it only
  indirectly).

### Category
hook quality · writer prompt behavior · critic/test coverage

### Blast radius
**Low–Medium.** Writer-card wording in `authorRun.ts` (+ card-pin tests) is Low. An optional
advisory hook-heuristic extension is Medium only if a critic is added; the plan keeps enforcement
at write-time self-check + card text (see red-team note in the plan) — no gate change.

### Risks
- Over-constraining hooks into one shape (e.g. all questions) would create a NEW sameness
  pattern and fight the `OPENER_TYPES` deal — the rule must be *mode-agnostic* (a "claim" or
  "statistic" opener must be able to pass by naming a visible stake/cost, not by becoming a
  question).
- A deterministic "tension detector" would be high-false-positive; rejected in the plan.

### Recommendation
**Create implementation prompt now** — grouped into **Prompt CF-A** (with Findings 2 and 12).

### Rationale
Confirmed in the sample, corroborated by the score spread, and a real pipeline gap (G1), not a
one-off. The fix is cheap (card text + self-verify + tests) and mode-agnostic.

---

## Finding 2: Chapter 8 is too abstract compared to Chapter 7

### Verdict
**Agree**

### Reader impact
Ch7 teaches through a physical model the reader can see (counter, branches, ingredients); ch8
teaches through nouns (functional organization, interfaces, centralized expertise). Concept-heavy
chapters are precisely the ones where the reader most needs a concrete conflict to hold onto.

### Evidence
Sample audit CONFIRMED. Ch7: 4 of 5 examples carry a sensory anchor ("A coffee ring stains the
page," "A folded supplier note under the order total"). Ch8: only 2 of 4; two examples open in
pure exposition ("Caroline first feels the miss when the product answer reaches her in pieces").
All the predicted abstract terms cluster in ch8. Note the asymmetry's root: ch7 inherits Grove's
own breakfast-factory device from the source; ch8's source material is inherently conceptual —
so this is a *class* of chapter (concept-heavy source chapters), not a random miss.

### Pipeline source
- `PIPE/src/orchestrator/authorRun.ts` — `AUTHOR_PREMIUM_BLOCK` VOICE rule ("never let more than
  2 consecutive paragraphs open on an abstraction") and `AUTHOR_QUALITY_BAR` rule 4 ("Open plain —
  no throat-clearing abstraction before the first concrete beat") exist but govern paragraph
  rhythm, not whether the chapter's *doorway* (hook + first fastRead beat) is a concrete scene.
- `PIPE/src/critics/sceneConcreteness.ts` — C26 `scene_abstraction` is deliberately narrow
  (fires only on abstract-system stages with zero grounding cues; advisory) and pinned to zero
  findings on the gold corpus (`PIPE/tests/scene-concreteness.test.ts`).

### Category
concreteness · hook quality · writer prompt behavior

### Blast radius
**Low–Medium.** Same surface as Finding 1 (writer card + tests). Widening C26 is explicitly NOT
recommended (its zero-FP pin on the gold corpus is a design point; loosening it invites repair
churn).

### Risks
- "Be concrete" applied naively can push the writer to invent physical props for genuinely
  conceptual material → prop-tableau saturation (already capped at 2/6 scenes via
  `EXAMPLE_LENSES`) or fake-feeling scenes.
- Must not mandate a specific concrete *device* (e.g. "open with a customer delay") pipeline-wide
  — that is this book's answer, not every book's; hardcoding it would overfit and create sameness.

### Recommendation
**Create implementation prompt now** — grouped into **Prompt CF-A**.

### Rationale
Confirmed, class-level (concept-heavy chapters), and fixable at the doorway (hook + first beat +
example grounding) without banning abstraction wholesale.

---

## Finding 3: Examples are compressed and less human than the best samples

### Verdict
**Partially agree** (strongly for ch8; weakly for ch7)

### Reader impact
Examples that read as analyst case-cards ("What changed? Separate expertise stopped passing as
customer value.") teach the label of the lesson, not the lived experience of it. Retention and
transfer both suffer; the acceptance panel's `scene_skeleton` advisory on all 16 chapters says
the writer is filling a transaction template.

### Evidence
Sample audit PARTIALLY CONFIRMED: three of four ch8 examples open `whatToDo`/`whyItMatters`
fields with evaluator prompts ("What changed? …", "What nearly failed? …", "Why does it work? …");
ch7 examples retain scene and sensory detail. So the compression is real but concentrated where
the material is abstract — same class-of-chapter effect as Finding 2.

### Pipeline source
- `PIPE/src/orchestrator/authorRun.ts` — `AUTHOR_QUALITY_BAR` rule 7 EXAMPLE CRAFT: the
  "what MEASURABLY CHANGED after (a result, a number, a visible before→after)" phrasing is the
  likely *cause* of the evaluator-voice tic — the writer answers the rubric's question verbatim
  inside the reader-facing field. The write contract even strips label-family prefixes
  ("Why it matters:") at ~line 435 — the Q&A-opener form is the same disease in a new coat.
- `PIPE/src/critics/exampleCraft.ts` — C29 `example_thinness` catches examples with NO
  specificity AND no causal movement; it cannot catch examples that have the facts but deliver
  them as analysis notes.

### Category
example craft · writer prompt behavior · critic/test coverage

### Blast radius
**Medium.** Rewrites rule-7 wording (writer behavior on every future book) + a new narrow
advisory detector for evaluator-stem density. No gate, no schema.

### Risks
- Banning question forms outright would kill legitimate rhetorical questions → make it a
  *density cap on interrogative-then-answer openers within example fields*, advisory.
- Any rule-7 rewrite must preserve the parts that demonstrably work (decision + completed
  consequence; "set, not met" failure definition) — those killed arc-that-never-lands examples.

### Recommendation
**Create implementation prompt now** — grouped into **Prompt CF-B** (with Findings 5, 13, and
the 17-adjacent constraint).

### Rationale
The root cause is identifiable (rule-7 phrasing echoed into output), the fix is testable (stem
density measurable on the published sample as a red-team fixture), and the panel's
scene_skeleton advisory independently demands example-texture work.

---

## Finding 4: Chapter 7 examples repeat the same central/local signal idea

### Verdict
**Agree**

### Reader impact
Five examples that teach three-and-a-half distinct lessons waste the reader's highest-value
learning surface. Repetition inside a chapter also feeds the "one template, different nouns"
panel complaint.

### Evidence
Sample audit CONFIRMED: examples #1 (Olivia Sets The Return), #2 (Olivia Pays For Common
Buying), #3 (Aubrey Keeps The Spec) are near-identical ("attach/return the local demand signal
to central buying"); #4 (handoff) and #5 (duplication) add genuine variation. 3 of 5 teach the
same principle.

### Pipeline source
- `PIPE/src/orchestrator/authorRun.ts` — `AUTHOR_QUALITY_BAR` rule 6: *"Each example teaches a
  DIFFERENT facet or failure-mode — if two teach the same lesson, merge them."* Prompt-only,
  unenforced (gap G5).
- `PIPE/src/compiler/briefRotation.ts` — `EXAMPLE_LENSES` (line 186) deals 3 *form* lenses per
  chapter; form variety ≠ lesson variety (the three duplicate examples have different props and
  the same lesson).
- `PIPE/src/critics/intraBookFieldSimilarity.ts` — existing similarity machinery is
  cross-chapter, not within-chapter-across-examples.

### Category
example diversity · critic/test coverage · writer prompt behavior

### Blast radius
**Medium.** Writer-card addition (declared per-example jobs) + a within-chapter example-lesson
similarity advisory reusing existing similarity utilities + tests. No gate change.

### Risks
- A similarity detector on short fields is FP-prone; must be tuned on the gold corpus with a
  pinned no-FP test (the `scene-concreteness.test.ts` pattern).
- Forcing N *distinct* facets when the source chapter genuinely has fewer teachable facets could
  push invented facets → source drift. The rule must allow "fewer, merged examples" as the
  compliant escape (rule 6 already says "merge them" — keep that).

### Recommendation
**Create implementation prompt now** — grouped into **Prompt CF-C** (with Finding 8).

### Rationale
Confirmed 3-of-5 duplication against an existing-but-unenforced rule is exactly the "concrete
write-time self-checks >> judgment" lesson from the willpower-instinct run: give the writer a
declaration step and give the pipeline a detector.

---

## Finding 5: Chapter 8 examples need more real conflict

### Verdict
**Partially agree**

### Reader impact
Hybrid organizations are interesting precisely because competent groups collide; examples that
stage the collision (Jude Pulls Back The Yes: "Sales promised speed and Manufacturing protected
quality") are the chapter's best. But conflict is a *fit-dependent* virtue, not a universal one.

### Evidence
Sample audit PARTIALLY CONFIRMED: only 1 of 4 ch8 examples stages genuine inter-department
conflict; the vivid clash the reviewer wants ("Sales wants speed. Manufacturing wants discipline.
Finance wants cost clarity. Engineering wants standards") already exists — in the fullRead prose,
not in the example cards. So the material was available and the examples didn't use it.

### Pipeline source
Same surface as Finding 3: `AUTHOR_QUALITY_BAR` rule 7 requires a decision + consequence but
never asks *who is pulling the other way*. The dealt example arcs (`briefRotation.ts`) don't
include a "staged disagreement" arc.

### Category
example craft · writer prompt behavior

### Blast radius
**Low–Medium** (rides Prompt CF-B's writer-card change).

### Risks
- **New sameness pattern:** mandate conflict pipeline-wide and every example in every book
  becomes a two-department fight — the exact monoculture failure this branch exists to kill.
  Must be *conditional*: when the chapter's core concept involves competing legitimate interests
  (detectable from the brief/packet, or simply stated as a writer conditional), at least one
  example stages the disagreement.
- **Fake-scene risk:** dramatized conflict must stay inside the source packet's factual walls or
  be explicitly hypothetical (existing EXAMPLE GROUNDING clause, `contentDeviceRepair.ts:77`).

### Recommendation
**Merge into another prompt** — the conditional-tension clause inside **Prompt CF-B**.

### Rationale
Real gap in the sample, but universalizing it is the wrong move; a conditional writer-card
clause captures the value at near-zero risk.

---

## Finding 6: The sample needs more modern examples

### Verdict
**Partially agree** (value real; risk real; policy first)

### Reader impact
A 2026 reader maps "breakfast factory branches" to delivery apps and support queues on their
own; doing it for them can raise transfer and relevance. But a fabricated-feeling SaaS anecdote
in a 1983 management classic damages trust more than an evergreen example ever costs.

### Evidence
Sample audit CONFIRMED (absence): every example in both chapters lives in the book's own
settings; the only real-world referent is an Intel-era semiconductor case. Note ch7's breakfast
factory is *Grove's own device* — its dominance is source fidelity working as intended.

### Pipeline source
- `PIPE/src/orchestrator/authorRun.ts` — writer projection: the source packet is "the ONLY
  allowed factual material"; SELF-VERIFY FACTS check.
- `PIPE/src/critics/evidenceWitness.ts` (EW1 invented-witness, MAJOR), `evidenceIntegrity.ts`,
  `sourceGrounding.ts` — the fake-example defense line.
- The content-deal EXAMPLE GROUNDING clause already permits *explicitly-framed hypotheticals*.

### Category
source fidelity · writer prompt behavior · anti-sameness (policy-level)

### Blast radius
**Medium as policy, High if done carelessly** (touches the source-fidelity defense line and every
future book's texture).

### Risks
- Unsupported modern analogies presented as fact → EW1-class violations, misattribution.
- Modern references date fast (an "AI content pipeline" example reads stale in 3 years — the
  evergreen policy exists for a reason).
- A dealt "modern example" slot in every chapter = a new sameness pattern.
- Quiz/card contamination: a hypothetical modern analogy must never become a quiz "fact".

### Recommendation
**Create implementation prompt now, as a policy + opt-in design** — **Prompt CF-G**, gated on
owner approval of the policy section before any writer-instruction change lands.

### Rationale
The reviewer themselves flagged the fidelity risk. The right shape is a bounded, dealt, opt-in
"contemporary translation" slot (≤1 per chapter, minority of chapters, explicitly hypothetical,
quiz-quarantined) — written as policy first so the owner can reject it cheaply.

---

## Finding 7: Some terms need simpler first-use definitions

### Verdict
**Partially agree**

### Reader impact
A beginner hitting "single output accountability" undefined has to reverse-engineer it; the
`beginner` review axis (weight 7) exists exactly for this reader.

### Evidence
Sample audit PARTIALLY CONFIRMED — the claim is too strong as stated: `interface` gets an
explicitly plain definition ("In plain words, an interface is the line where one side's call
must meet another side's expertise."), `functional organization` and `mission-oriented
organization` get inline glosses; but `single output accountability` and `centralized expertise`
are used with no definition anywhere in the chapter.

### Pipeline source
- `PIPE/src/orchestrator/authorRun.ts` — `AUTHOR_PREMIUM_BLOCK` PLAIN WORDS covers only terms
  the chapter *coins* ("a 'return pass', a 'capability call'"), not terms of art inherited from
  the source (gap G3).
- `PIPE/src/critics/plainLanguage.ts` (E7) does vocabulary simplification, not
  definition-presence checking.

### Category
terminology clarity · writer prompt behavior

### Blast radius
**Low.** One PLAIN WORDS clause extension + a self-verify item + card-pin test. A deterministic
"was it defined?" critic is rejected (see Risks).

### Risks
- Deterministic first-use-definition detection is semantically hard and FP-heavy (what counts as
  a definition?) — a critic here would misfire; keep it prompt + review-side.
- Over-defining slows expert readers; the rule must ask for *one* plain unpacking at first use,
  not a glossary tone.

### Recommendation
**Create implementation prompt now** — **Prompt CF-D** (small, standalone).

### Rationale
Half the terms already comply, which shows the writer does this when told; extending the
existing rule from "coined terms" to "load-bearing inherited terms" closes the gap at Low cost.

---

## Finding 8: Chapter 7 and Chapter 8 need sharper separation

### Verdict
**Agree**

### Reader impact
When adjacent chapters re-teach "handoffs need rules/data/escalation" and "interfaces need
decide/advise/execute" as near-parallel cards, the reader experiences the book as circling. The
reviewer's proposed split (ch7 = "when scale breaks sight, design the return signal"; ch8 =
"when expertise and market speed collide, design the interface") is a genuinely better carve.

### Evidence
Sample audit CONFIRMED: near-parallel passages (ch7 fullRead on handoffs/rules/data/escalation
vs ch8 fullRead on explicit interfaces/who-decides) and near-parallel review cards (ch7 card 5
vs ch8 card 3). Caveat: Grove's source chapters DO overlap — the pipeline can't invent
separation the source lacks, but it can *assign* each chapter a distinct emphasis.

### Pipeline source
- `PIPE/src/compiler/bookDesign.ts` — curriculum design; no per-chapter "learning job"
  declaration; venue separation exists (line ~145) but venues ≠ pedagogy (gap G4).
- `PIPE/src/compiler/chapterBrief.ts` / `briefRotation.ts` — briefs carry variety deals, not a
  "this chapter is NOT about X (chapter N owns X)" line.
- Brief gate (`chapter-brief-gate` in `PIPE/src/cli.ts`) — no adjacent-overlap advisory.
- Book-level critics (`architectureMonoculture.ts`, `bookRepetition.ts`,
  `intraBookFieldSimilarity.ts`) — all target delivery machinery or verbatim similarity, not
  learning-job overlap.

### Category
chapter differentiation · anti-sameness · critic/test coverage

### Blast radius
**Medium.** Book-design output gains a per-chapter learning-job line; brief gate gains an
adjacent-overlap **advisory** (never a blocker in this pass); writer card gains a NOT-this line.
Touches the compiler path all machine-brief books run.

### Risks
- Over-separation can break deliberate cumulative build (a book that *should* deepen one idea
  across chapters). The advisory must compare *jobs*, not shared vocabulary, and stay advisory.
- Manual-brief books (~113/119 in production) skip the machine VARIETY path — this improves
  fresh machine-brief books only; do not retrofit.

### Recommendation
**Create implementation prompt now** — grouped into **Prompt CF-C** (with Finding 4).

### Rationale
Both findings are the same disease at two zoom levels: no declared "job" per example
(within-chapter) and no declared "job" per chapter (within-book). One prompt, one mental model,
shared test style.

---

## Finding 9: Implementation plans need better reusable skill titles

### Verdict
**Agree**

### Reader impact
"Name the Local Signal" is rehearsable; a 40-word coreSkill paragraph is not. The skill title is
what the reader carries out of the chapter.

### Evidence
Sample audit: the published `implementationPlan` objects contain `coreSkill` prose with no punchy
handle (ch7 coreSkill is strong prose but 3 sentences; ch8's ends in the recycled "agreement
nods; commitment signs"). Note: `authorSchemaHint` (~298) already specifies
`implementationPlan.title` "(4–7 words)" — but the published package has NO title field, so the
title is being either not emitted or stripped between writer and package. **That discrepancy is
itself a small engineering question the implementing agent must resolve first** (emit-and-drop vs
never-emitted vs app schema lacks the field — app `PackageChapter.implementationPlan` renders
`coreSkill`/`ifThenPlans` only).

### Pipeline source
- `PIPE/src/orchestrator/authorRun.ts` — `authorSchemaHint` (title spec exists), legacy
  `PIPE/prompts/writer-implementation-plan.system.md` ("coreSkill is a concrete skill not a
  virtue").
- Package/bridge surface: wherever chapter JSON → package projection drops fields (check
  `publishFinal.ts` bridge + `app/book/data/book-package-core.ts` `implementationPlan` type,
  which has no title).

### Category
implementation-plan UX · writer prompt behavior · quiz/card projection (projection only)

### Blast radius
**Low** for the prompt/guidance part; **Medium only if** the title field must be threaded through
the package projection + app validator + `ImplementationPlanCard.tsx` (that sub-decision is
scoped inside the prompt with its own go/no-go).

### Risks
- Cute-title pressure → vague virtue names ("Own the Outcome") — the guidance must demand an
  imperative verb + concrete object (the reviewer's two examples are the spec).
- If the title field is added to the app surface, old packages must remain valid (optional
  field; the validator's closed key sets must be extended deliberately).

### Recommendation
**Create implementation prompt now** — grouped into **Prompt CF-E**.

### Rationale
Cheap, confirmed, and there's a latent field-drop bug to resolve either way.

---

## Finding 10: Try-this-now actions are stiff

### Verdict
**Agree**

### Reader impact
The action line is the one sentence the reader is supposed to *do*. "when the return word must
arrive" makes the reader parse jargon inside an instruction.

### Evidence
Sample audit CONFIRMED. Ch7: *"…say in 30 seconds where the signal comes from, who can see it,
and when the return word must arrive."* — "return word" is a coined shorthand inside an action
line. Ch8: mechanical F/M labeling instruction. Both are timed-command style.

### Pipeline source
- `PIPE/src/orchestrator/authorRun.ts` — `AUTHOR_QUALITY_BAR` rule 3 (imperative-led, numbered/
  timeboxed — keep; it kills ritual actions) and D9 round-timer contract (~383) — keep.
- The PLAIN WORDS rule doesn't currently apply itself to tryThisNow/challenge fields explicitly —
  "return word" is exactly a coined term reaching an action line unglossed.

### Category
implementation-plan UX · terminology clarity · writer prompt behavior

### Blast radius
**Low.** Card wording + self-verify item + card-pin test.

### Risks
Minimal; the only trap is weakening rule 3's timebox/number requirement while rephrasing — the
prompt forbids touching it.

### Recommendation
**Create implementation prompt now** — grouped into **Prompt CF-E**.

### Rationale
Confirmed, tiny, and mechanically enforceable ("no coined shorthand in action fields; say it
plainly").

---

## Finding 11: "Agreement nods; commitment signs" feels reused

### Verdict
**Agree — and the evidence upgrades it well beyond the reviewer's suspicion**

### Reader impact
A signature aphorism recycled 5× across four chapters of one book and 3× in a *different
published book* (`execution.v21.json`) is house-voice leakage: the exact "one voice, many books"
failure the anti-sameness campaign targets. A reader of both books will notice; the acceptance
panel already flagged `repeated_unit` on ch 2/5/8/11 — precisely the four chapters carrying the
line.

### Evidence
Sample audit CONFIRMED: HOM ch2, ch5, ch8 (×2: fastRead + coreSkill), ch11 (×3, incl. a comma
variant) + `execution.v21.json` ×3. Pipeline audit VERIFIED no guard can catch it: 4 words
(below `crossBookSignatureAudit.ts`'s 6-word floor), in fields the audit doesn't scan
(counterintuition/coreSkill/memorableLines), audit is watchlist-only, and the phrase is not in
`PIPE/config/banned-phrases.json`.

### Pipeline source
- `PIPE/src/critics/crossBookSignatureAudit.ts` — `findCrossBookTells` (field + length limits).
- `PIPE/src/critics/catalogAudit.ts:149` — memorableLines folded into within-book fingerprint
  only.
- `PIPE/config/banned-phrases.json` — the escalation registry the audit is supposed to feed.
- No within-book verbatim-aphorism repetition critic exists (bookPatternAudit targets stems, not
  recycled whole aphorisms across chapters).

### Category
memorable lines · anti-sameness · critic/test coverage

### Blast radius
**Medium.** Critic extension + one new within-book detector + config data + tests. Advisory-first
(gates untouched); the banned-phrases addition affects future generation only.

### Risks
- Aggressive dedup could flag legitimate *deliberate* callbacks (a book intentionally reprising
  its own thesis line). Mitigation: within-book threshold ≥3 chapters verbatim = advisory, and
  the writer-card rule targets *cross-chapter recycling of aphorisms*, not thesis restatement.
- Lowering the cross-book length floor too far → noise; scope the lower floor to
  aphorism-shaped sentences (short, semicolon/antithesis-shaped) rather than all 4-word strings.

### Recommendation
**Create implementation prompt now** — **Prompt CF-F**, standalone (highest-confidence
engineering fix in the set).

### Rationale
This is the one finding that is a verified *engineering gap* with proof across two published
books plus panel corroboration. It also generalizes: any future signature line will leak the
same way until the guard exists.

---

## Finding 12: Chapter 8's title/topic is emotionally dry

### Verdict
**Partially agree**

### Reader impact
"Hybrid Organizations" as a doorway is dry — but the title IS Grove's chapter title. Readers
navigating against the real book benefit from title fidelity; the *experienced* dryness is
fixable one level down (hook, counterintuition, keyTakeaway framing) without renaming anything.

### Evidence
Sample audit CONFIRMED the dryness (two-word abstract-noun title; no subtitle field exists in
the schema; keyTakeaway is analytically flat). Research TOC titles mirror the source book's
chapters — retitling would trade source fidelity for flavor.

### Pipeline source
Titles: research → TOC (`book-run` research phase). Doorway texture: same surface as CF-A
(hook/counterintuition in `authorRun.ts`).

### Category
hook quality · source fidelity

### Blast radius
Low (as merged into CF-A). Retitling would be Medium–High (navigation, provenance, source
mapping) for marginal gain.

### Risks
Retitling risks source drift and breaks the reader's mapping to the real book.

### Recommendation
**Merge into another prompt** — the doorway half into **Prompt CF-A**; **reject** the retitling
half.

### Rationale
Fix the doorway, keep the map.

---

## Finding 13: Some example instructions sound like internal commands

### Verdict
**Agree**

### Reader impact
"What changed? …" / "What nearly failed? …" as field openers read as the rubric talking to
itself in front of the reader — the strongest single "not premium" tell in the sample.

### Evidence
Sample audit CONFIRMED: eight distinct evaluator-style question openers, all in ch8's example
fields, zero in ch7 (ch7 uses imperative "Skip this and…" openers — proof the writer has a
better register available).

### Pipeline source
Same as Finding 3 — `AUTHOR_QUALITY_BAR` rule 7's rubric-shaped wording is being echoed
verbatim; the contract's label-prefix strip (~435) shows this disease has appeared before in a
different costume and was patched lexically.

### Category
example craft · writer prompt behavior · critic/test coverage

### Blast radius
**Medium** (part of CF-B: rule rewrite + evaluator-stem density advisory + tests).

### Risks
Same as Finding 3 (don't ban all questions; cap density).

### Recommendation
**Merge into another prompt** — **Prompt CF-B**.

### Rationale
Same root cause as Finding 3; one fix, one detector.

---

## Finding 14: Chapter 7 should elevate "Scale breaks sight"

### Verdict
**Partially agree**

### Reader impact
The chapter's central image ("growth breaks sight… sight breaks into pieces") exists in the
prose but none of the three memorableLines carries it — the reader's take-home lines and the
chapter's actual big idea are misaligned.

### Evidence
Sample audit PARTIALLY CONFIRMED: exact phrase absent; the idea appears twice
(counterintuition + deepRead); memorableLines are three other (decent) lines. This is a
*selection* miss, not a generation miss.

### Pipeline source
- `PIPE/src/orchestrator/authorRun.ts` — memorableLines emitted by the whole-chapter writer with
  no selection principle beyond the schema hint; legacy `PIPE/prompts/memorable-lines.system.md`
  (picks 3 existing verbatim lines) is not the v24 path.

### Category
memorable lines · writer prompt behavior

### Blast radius
**Low.** One selection-guidance line ("at least one memorableLine must carry the chapter's
central organizing image") + card-pin test.

### Risks
Overfit risk if worded as "elevate scale-breaks-sight" — the rule must be generic (central image
of *this* chapter). The published HOM chapter itself is NOT to be repaired in this campaign.

### Recommendation
**Merge into another prompt** — **Prompt CF-E** (one guidance line). Sample-specific repair:
**Defer** (no regeneration this pass).

### Rationale
Generic selection principle = cheap, durable; editing the shipped book is out of scope.

---

## Finding 15: Chapter 7 should make "chart last, output first" more central

### Verdict
**Disagree**

### Reader impact
None — the reader already gets this, repeatedly.

### Evidence
Sample audit CONFIRMED the *opposite* of the complaint: fullRead: *"The chart is last, not
first. Scale decisions should be judged by total output: cost, quality, speed, and
responsiveness."*; fastRead: *"Judge the shape by cost, quality, speed, and response."*;
keyTakeaway, reviewCard 6, and quiz Q4 all restate it. The principle is stated in five surfaces
of the chapter including a dedicated quiz question.

### Pipeline source
n/a — no gap.

### Category
example craft (n/a)

### Blast radius
n/a

### Risks
Acting on it would ADD repetition to a chapter the panel already flagged for texture repetition.

### Recommendation
**Reject.**

### Rationale
The evidence contradicts the finding; the reviewer likely skimmed past the fastRead/keyTakeaway
restatements.

---

## Finding 16: Chapter 8 may benefit from a simple comparison table or UI display

### Verdict
**Partially agree** (pedagogy yes; schema path deferred pending owner approval)

### Reader impact
Functional-vs-mission-vs-hybrid is a three-way tradeoff — the canonical case for a comparison
display. Today it's delivered as running prose + parallel Q&A cards; a structured contrast
would genuinely help this *class* of chapter (taxonomy/tradeoff chapters).

### Evidence
Sample audit CONFIRMED no table/comparison structure exists anywhere in the schema. App blast
radius agent's verdict: **Medium, not High** — the reader renders by named fields (no block
switch); a true table block touches: `app/book/data/book-package-core.ts` +
`app/book/data/bookChapters.ts` (types/normalizer), `app/app/api/book/_lib/validate-book-package.ts`
(STRICT closed allowlists: `CHAPTER_KEYS`, `parseSummaryBlocks` hard-rejects unknown block
types), a new reader component beside `ChapterReaderClient.tsx`, and pipeline
`PIPE/src/runtimeSchemas.ts` `validateChapterV21` (line 207) only if machine-authored.
Forward-compat is safe: unknown block types are silently dropped by `SummaryCard.tsx:55-58`,
optional fields are absence-gated. **Low path exists with zero schema change:** bullet blocks
with `detail` (expandable list) and `implementationPlan.ifThenPlans`-style labeled rows
(`ImplementationPlanCard.tsx:63-75`) are existing structured-rendering precedents.

### Pipeline source
`PIPE/src/types.ts:454` (`ChapterV21` closed shape), `PIPE/src/runtimeSchemas.ts:207`, plus the
app surfaces above.

### Category
app/schema/UI · concreteness

### Blast radius
**Medium** (true table) / **Low** (prose-pattern or bullet-expressed contrast). Cross-layer
coordination: app validator + two type layers + reader component + (conditionally) pipeline
schema — the highest-blast-radius item in this triage.

### Risks
- Schema/version skew between pipeline-authored packages and app validator (the validator
  fail-closes on unknown keys — a package authored before the app deploys the new key would be
  rejected).
- A dealt "comparison table" slot becomes a new sameness pattern.
- Quiz/card coupling is confirmed NONE (independent fields) — one real risk retired by evidence.

### Recommendation
**Defer as a design-approval-gated prompt** — **Prompt CF-H** delivers a design decision
(including the zero-schema Low path) for owner sign-off; no implementation until approved.

### Rationale
Real pedagogical value for taxonomy chapters, but it's the only finding whose fix crosses the
app boundary; per the task's own constraint, that needs explicit design approval, and the Low
path should be evaluated first.

---

## Finding 17: Examples need fewer names

### Verdict
**Partially agree — but it is already governed, and the naive fix conflicts with standing gates**

### Reader impact
Eight fictional names across two chapters is name-density noise for some readers; but named
actors are also what makes examples feel human (Finding 3) — the two findings pull against each
other and need one policy, not two patches.

### Evidence
Sample audit CONFIRMED counts: ch7 = 4 distinct names, ch8 = 4, zero reuse across the two
(8 total). Both under the cast cap. Crucially: **quizzes and reviewCards never reference the
named characters** (verified by name-scan) — so de-naming examples would NOT break quiz/card
alignment.

### Pipeline source
This surface is dense with existing policy: `PIPE/src/critics/narrative.ts` `CAST_CAP = 6`
(C24 MAJOR), C27 exotic-name density; `PIPE/config/critic-rubric.json`
`narrative.named_protagonist` (**blocker**) + `minNamedProtagonistRateInExamples: 0.9`;
`contentDeviceDeal.ts` `proxy-cast` device (invented first-name casts) **already dealt-banned in
~half of all chapters**, with a no-stand-ins brief variant ("use 'you', a real source case, or
explicit hypothetical"). The fresh-run report shows proxy-cast at 53% vs the old 93% — the
system the reviewer is asking for already exists and measurably works.

### Category
example craft · anti-sameness · writer prompt behavior

### Blast radius
Would be **High if done naively**: "fewer names" collides head-on with the
`named_protagonist` blocker and the 0.9 rate floor — weakening those is gate-lowering, which
this campaign forbids.

### Risks
- Direct conflict with `narrative.named_protagonist` (blocker) — cannot "reduce names" without a
  deliberate, owner-approved rubric change.
- The content-device deal already modulates this per-chapter; adding a second name-reduction
  mechanism creates two systems fighting over the same dial.

### Recommendation
**Reject as a standalone change**; carry a single guardrail into **Prompt CF-B**'s constraints:
humanization must not INCREASE name pressure (no new named character where a dealt no-stand-ins
variant applies; role-framed actors are acceptable *within* existing rubric limits).

### Rationale
The dial the reviewer wants already exists (proxy-cast deal at 53% coverage); the remaining ask
conflicts with a standing blocker and needs owner-level policy change to pursue — not warranted
by the evidence.

---

## Summary table

| # | Finding | Verdict | Blast radius | Disposition |
|---|---------|---------|--------------|-------------|
| 1 | Ch8 weak hook | Agree | Low–Med | Prompt **CF-A** |
| 2 | Ch8 too abstract | Agree | Low–Med | Prompt **CF-A** |
| 3 | Compressed case-card examples | Partially agree | Med | Prompt **CF-B** |
| 4 | Ch7 examples repeat one idea | Agree | Med | Prompt **CF-C** |
| 5 | Ch8 needs real conflict | Partially agree | Low–Med | merged → **CF-B** |
| 6 | Modern examples | Partially agree | Med (policy) | Prompt **CF-G** (approval-gated) |
| 7 | First-use definitions | Partially agree | Low | Prompt **CF-D** |
| 8 | Ch7/ch8 sharper separation | Agree | Med | Prompt **CF-C** |
| 9 | Better skill titles | Agree | Low(–Med) | Prompt **CF-E** |
| 10 | Try-this-now stiff | Agree | Low | Prompt **CF-E** |
| 11 | "Agreement nods; commitment signs" reuse | Agree (upgraded) | Med | Prompt **CF-F** |
| 12 | Ch8 doorway dry | Partially agree | Low | doorway → **CF-A**; retitle rejected |
| 13 | Evaluator-sounding lines | Agree | Med | merged → **CF-B** |
| 14 | Elevate "scale breaks sight" | Partially agree | Low | guidance → **CF-E**; sample repair deferred |
| 15 | "Chart last" more central | **Disagree** | n/a | **Rejected** (evidence contradicts) |
| 16 | Comparison table / UI | Partially agree | Med–High | Prompt **CF-H** (design, approval-gated) |
| 17 | Fewer names | Partially agree | High if naive | **Rejected standalone**; guardrail in CF-B |

**Counts:** 8 agree (1, 2, 4, 8, 9, 10, 11, 13) · 8 partially agree (3, 5, 6, 7, 12, 14, 16,
17) · 1 disagree (15). 8 implementation prompts (CF-A…CF-H), of which CF-G and CF-H are
approval-gated (policy/design first, no default implementation).
