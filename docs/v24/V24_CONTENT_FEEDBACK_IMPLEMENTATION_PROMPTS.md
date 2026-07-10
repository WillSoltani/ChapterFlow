# V24 Content-Feedback Implementation Prompts (CF-A … CF-H)

**Companion to:** `V24_CONTENT_FEEDBACK_TRIAGE.md` (verdicts + evidence) and
`V24_CONTENT_FEEDBACK_ROADMAP.md` (execution order, lanes, orchestrator contract).
**Pipeline root (abbreviated `PIPE/`):** `scripts/book/prompts/chapterflow-v24-author-pipeline/`
**Branch:** `feat/anti-sameness-live-fix` (all work stays on this branch).

## Global constraints (apply to EVERY prompt below)

- Do **not** push, publish, or deploy. Do not regenerate any book.
- Do **not** lower or weaken any gate, blocker, contract, or acceptance policy
  (`AUTHOR_CHAPTER_BAR`, lead-thread contract, `named_protagonist` blocker, EW1, D9 timers,
  quiz/card validators). New checks land **advisory-first** unless a prompt says otherwise.
- Do **not** implement unrelated fixes; if you find an unrelated bug, report it, don't fix it.
- Do **not** hard-code `high-output-management`, `start-with-why`, chapter numbers, or any
  book-specific string into `src/`. The ch7/ch8 sample is *evidence*, not the target.
- Do **not** invent facts or add fake examples; the source packet remains "the ONLY allowed
  factual material"; the EXAMPLE GROUNDING clause (real-or-explicitly-hypothetical) is untouchable.
- Do **not** edit the published `book-packages/high-output-management.v21.json` or any
  published package, and never write into the tracked gold corpus
  (`scripts/book/prompts/chapterflow-v21-authored/state/`) or the forbidden repo-root `/state/`.
- Writer-card constants (`AUTHOR_HOUSE_RULES` / `AUTHOR_QUALITY_BAR` / `AUTHOR_PREMIUM_BLOCK` /
  `authorSchemaHint` / `authorSelfVerify` in `PIPE/src/orchestrator/authorRun.ts`) are a shared
  surface — see the roadmap's serialization rule (CF-A → CF-B → CF-D → CF-E run in sequence, each
  rebasing on the previous card text).
- Every behavior change ships with tests; full suite must stay `fail 0` (baseline at handoff:
  **pass 1891 / fail 0 / xenv 6**; each prompt adds to `pass`). Run
  `npm test` from `PIPE/` (or the repo's pipeline test command — check `PIPE/package.json`).
- Card-wording changes must stay short. The card is already ~26–31k chars vs a 25k target
  (warning-only); every prompt that adds card text must state its net character delta and keep it
  small (aim ≤ +400 chars per prompt, and remove/merge lines where possible).
- Report faithfully: if a test fails or a requirement can't be met, say so; do not paper over.

---

## Prompt CF-A: Hook tension + concrete doorway for concept-heavy chapters

### Role
Senior pipeline engineer on the v24 whole-chapter writer card. You make chapter *doorways*
(hook + first fastRead beat) start from reader-visible tension, without collapsing hook variety.

### Context
Findings 1, 2, 12 (triage doc). Verified: HOM ch8's hook is a flat activity description ("Jude
maps engineering, manufacturing, sales, and finance functions to shared professional
standards.") while ch7's is a threat-framed question; ch8 is the book's lowest-scoring chapter
(85.0). The pipeline has NO per-hook tension requirement (gap G1): `authorSchemaHint` asks only
for "60–120 chars"; `OPENER_TYPES` in `briefRotation.ts` rotates hook *shape* (question / scene /
claim / statistic / tension-thesis) for variety but sets no quality bar per shape. Concept-heavy
chapters (whose source material is inherently abstract, like "Hybrid Organizations") are the
class where the doorway most needs a concrete stake. Chapter titles are source-faithful and are
NOT to be changed.

### Input
- `PIPE/src/orchestrator/authorRun.ts` — `AUTHOR_QUALITY_BAR` (~line 271, esp. rule 4 "Open
  plain"), `AUTHOR_PREMIUM_BLOCK` (~291, VOICE rule), `authorSchemaHint` (~298, hook spec),
  `authorSelfVerify` (~302), `buildAuthorCard` (~518).
- `PIPE/src/compiler/briefRotation.ts` — `OPENER_TYPES` (line 126) and how the dealt opener mode
  reaches the card, so the new rule can be phrased per-mode.
- Evidence quotes: triage doc Findings 1/2/12.
- Existing card-pin test patterns: search `PIPE/tests/` for tests asserting card text (e.g.
  content-machinery / stier2-levers tests that pin instruction lines).

### Objective
Every future chapter's hook passes a *mode-agnostic tension test*: a reader can point at the
stake (who is about to lose/pay/miss what) or the named cost/failure in the hook itself, in
plain words. The first fastRead beat lands concrete (a person, scene, object, or named cost)
before any taxonomy term appears. Hook shape variety (all 5 opener modes) is preserved.

### Specific instructions
1. Extend the hook spec in `authorSchemaHint` and/or add ONE rule to `AUTHOR_QUALITY_BAR`
   (writer-facing wording is yours, but it must encode): the hook must make a stake visible —
   something breaking, costing, colliding, or about to be lost — regardless of dealt opener mode;
   a bare description of an activity or diagram is a FAILED hook. Include exactly TWO generic
   micro-examples in the card (one passing, one failing) — per-opener-mode examples would blow
   the card budget; keep it to two, non-book-specific.
2. Add the doorway rule for the fastRead opening: before the first abstract/taxonomy term of the
   chapter appears in fastRead, the reader must have hit one concrete beat (actor, scene, object,
   or a named cost). This complements (not replaces) `AUTHOR_QUALITY_BAR` rule 4 and the
   PREMIUM_BLOCK VOICE rhythm rule — do not touch those.
3. Add ONE `authorSelfVerify` checklist item: "point at the stake in your hook; if you cannot,
   rewrite it" (write-time self-check, per the house lesson that concrete write-time self-checks
   outperform post-hoc judgment).
4. Do NOT add a deterministic hook-tension critic (rejected in triage red-team: FP-prone). Do
   NOT touch `OPENER_TYPES`, chapter titles, or the review rubric/weights.
5. Do NOT widen `sceneConcreteness.ts` (C26) — its zero-FP gold-corpus pin is a design point.
6. State the card's net character delta in your report.

### Constraints
Global constraints. Additionally: hook rule must be satisfiable by ALL five opener modes (show
this in tests via wording, not enforcement); no new blocker anywhere; do not overfit wording to
org-design/business books (works for a habit book, a finance book, a psychology book).

### Tests
- Card-pin unit tests: `buildAuthorCard` output contains the new hook-tension rule and the
  doorway rule (exact-line pins, following the existing card-pin test style).
- Self-verify pin: the new checklist item is present.
- A negative test proving nothing was weakened: rule 4 and the VOICE rule text are unchanged.
- Full suite `fail 0`.

### Verification
Beyond tests: render one real card via the CLI for any fixture book (e.g. the zz-fixture books
under `PIPE/state/books/` used by existing tests, or a dry `compile-chapter-briefs` +
card-render path if a fixture harness exists — find the pattern in tests) and paste the new
rule lines in the report. No book generation.

### Output
Report: files changed; verbatim new card lines; net card char delta; test list + suite counts;
explicit confirmation that OPENER_TYPES, titles, rubric, and C26 are untouched; risks noted.

---

## Prompt CF-B: Example humanization — kill the evaluator voice, stage the tension

### Role
Senior pipeline engineer on the v24 writer card + deterministic critics. You make examples read
as lived moments instead of analyst case-cards, and you add the narrow detector that keeps it
that way.

### Context
Findings 3, 5, 13 (+ Finding 17's guardrail). Verified: three of four HOM ch8 examples open
reader-facing fields with evaluator prompts — "What changed? …", "What nearly failed? …", "Why
does it work? …" (8 distinct evaluator-style openers in ch8; zero in ch7, which uses imperative
"Skip this and…" openers — proof the writer has a better register). Root cause hypothesis
(triage): `AUTHOR_QUALITY_BAR` rule 7's rubric-shaped wording ("what MEASURABLY CHANGED…
before→after") is echoed verbatim into output — same disease the contract's label-prefix strip
(`authorRun.ts` ~435, "Why it matters:" strip) patched in a previous costume. Separately, only
1 of 4 ch8 examples stages the inter-party conflict its own fullRead names ("Sales wants speed.
Manufacturing wants discipline…"). The acceptance panel's `scene_skeleton` advisory on all 16
chapters corroborates the template feel.

### Input
- `PIPE/src/orchestrator/authorRun.ts` — `AUTHOR_QUALITY_BAR` rule 7 (~274),
  `authorWriteContractFindings` label-strip (~435), `authorSelfVerify`.
- `PIPE/src/critics/exampleCraft.ts` (C29) — the deterministic complement pattern to copy
  (narrow, dual-condition, advisory) and its test `PIPE/tests/example-craft.test.ts`.
- `PIPE/src/critics/sceneConcreteness.ts` + `PIPE/tests/scene-concreteness.test.ts` — the
  gold-corpus zero-FP pin pattern.
- `PIPE/src/critics/runAllCritics.ts` — critic registration.
- Evidence: `book-packages/high-output-management.v21.json` ch8 (index 7) examples — use as a
  red-team fixture (READ only; copy needed snippets into test fixtures rather than reading the
  package at test runtime if that's the house pattern — check how other tests use fixtures).
- Triage doc Findings 3/5/13/17.

### Objective
(a) Rule 7 still demands decision + completed consequence, but the wording can no longer be
satisfied by evaluator Q&A prose; (b) a new advisory critic flags chapters whose example fields
lean on interrogative-then-answer openers; (c) chapters whose core concept involves competing
legitimate interests stage that disagreement in at least one example; (d) none of this increases
named-character pressure.

### Specific instructions
1. **Rewrite rule 7's phrasing** (keep its substance intact: actor with a real stake, concrete
   action, completed consequence, "set, not met" = FAILED example). Add an explicit register
   rule: consequences are *narrated in the scene's own voice*; example fields must not open with
   an evaluator question answered in the next clause ("What changed? X.", "What nearly failed?
   Y.") — show the change happening instead. Keep it compact; this replaces wording, so aim for
   near-zero net char delta.
2. **Conditional tension clause** (one sentence, conditional — NOT universal): when the
   chapter's core concept involves parties with competing legitimate interests, at least one
   example must stage that disagreement directly (who pulls the other way, and what the collision
   costs) rather than describing it. Universal conflict mandates are forbidden (new-sameness
   risk).
3. **New advisory critic** (new file, e.g. `PIPE/src/critics/exampleRegister.ts`, name yours):
   per chapter, count example fields (`scenario`/`whatToDo`/`whyItMatters` — confirm exact field
   set from `types.ts` `ExampleV21`) whose text *opens* with an interrogative of ≤6 words
   immediately followed by a declarative answer. Threshold: ≥3 such fields in one chapter →
   ONE advisory finding (severity MINOR, advisory lane — mirror C29's registration). Do not
   flag interrogatives mid-field or genuine rhetorical questions that go unanswered.
4. **Tune on the gold corpus**: like `scene-concreteness.test.ts`, add a pin test over the
   tracked v21 gold corpus asserting a LOW total finding count (measure first; pin the measured
   number, and justify any nonzero hits in the report). Add a red-team fixture distilled from
   HOM ch8's example fields that MUST fire, and a ch7-style imperative fixture that MUST NOT.
5. **Finding-17 guardrail:** add to the rewritten rule 7 (or self-verify) that humanization
   never adds a new named character beyond the dealt cast, and respects dealt proxy-cast bans
   (the no-stand-ins variant). Do not touch `named_protagonist`, `CAST_CAP`, or the
   content-device deal.
6. Register the critic advisory-only. Do not wire it into any gate, contract, or acceptance
   predicate. Do not touch C29's logic.

### Constraints
Global constraints. Do not remove the label-prefix strip (~435). Do not add the critic to
`ENFORCED_MAJOR` or any blocker set. Do not alter review weights. Historical trap to respect:
lexical *gates* have measured inverted before (CHB14/15/17) — that is why this detector is
advisory + narrowly scoped to field-opening position only.

### Tests
- Unit: detector fires on the ch8-style fixture (≥3 evaluator openers), not on imperative/
  narrative fixtures, not on a single evaluator opener, not on mid-field questions.
- Gold-corpus pin: measured finding count pinned (no-false-positive regression guard).
- Card-pin: rewritten rule 7 present; conditional tension clause present; old rubric-shaped
  phrase absent.
- Contract regression: label-strip behavior unchanged (existing tests stay green).
- Full suite `fail 0`.

### Verification
Run the new critic standalone (most critics are pure functions — drive via a small script or
test) against `book-packages/high-output-management.v21.json` ch8 and show it fires; against
ch7 and show it does not. Paste both results in the report.

### Output
Report: files changed; verbatim rule-7 before/after; detector spec (fields, pattern, threshold)
and measured gold-corpus finding count with justification; test list + suite counts; net card
char delta; confirmation no gate/blocker/deal touched; risks + next calibration step (whether
advisory→major escalation is ever warranted — recommendation only).

---

## Prompt CF-C: Distinct jobs — per-example within a chapter, per-chapter within a book

### Role
Senior pipeline engineer on the v24 brief compiler + book design + deterministic critics. You
give every example and every chapter a declared, checkable *job*, so repetition becomes visible
before a reader sees it.

### Context
Findings 4 and 8. Verified: HOM ch7 has 3 of 5 examples teaching the identical lesson
("attach/return the local demand signal to central buying") despite `AUTHOR_QUALITY_BAR` rule 6
("Each example teaches a DIFFERENT facet… merge them") — prompt-only, unenforced (gap G5). And
ch7/ch8 carry near-parallel passages and near-parallel review cards (handoffs need
rules/data/escalation ≈ interfaces need decide/advise/execute) because nothing assigns adjacent
chapters distinct learning jobs (gap G4) — differentiation currently targets delivery machinery
(architecture families, content devices), not pedagogy. Caveat honored: the source chapters
genuinely overlap; the pipeline assigns distinct *emphasis*, it does not invent separation.

### Input
- `PIPE/src/compiler/bookDesign.ts` — book design output shape; where per-chapter fields are
  emitted (venue plan floor at ~145 is a precedent for adjacent-separation logic).
- `PIPE/src/compiler/chapterBrief.ts` — brief compile + `briefVarietyInstructionLines` (how
  dealt lines reach the card); `PIPE/src/compiler/briefRotation.ts` — `EXAMPLE_LENSES` (~186).
- `PIPE/src/orchestrator/authorRun.ts` — `buildAuthorCard` (where brief lines land),
  `AUTHOR_QUALITY_BAR` rule 6 (~273).
- Brief gate: `chapter-brief-gate` command in `PIPE/src/cli.ts` → its checker module (locate).
- `PIPE/src/critics/intraBookFieldSimilarity.ts` — similarity utilities to reuse for the
  within-chapter example-lesson check.
- Tests: `PIPE/tests/` patterns for brief-gate and critics.
- Triage doc Findings 4/8.

### Objective
(a) Book design emits one `learningJob` line per chapter (what the reader can DO after this
chapter that no other chapter teaches); (b) the brief gate raises an ADVISORY when adjacent
chapters' learning jobs are near-duplicates; (c) the writer card instructs that each example
serves a distinct declared job and that the chapter must not re-teach the named adjacent job;
(d) a within-chapter advisory flags near-duplicate example lessons.

### Specific instructions
1. **Book design:** extend the design compile so each chapter carries a one-line `learningJob`
   (machine-brief path only — do not retrofit manual-brief books). If the design agent already
   emits something equivalent (check the design schema first), reuse it rather than adding a
   twin field.
2. **Brief gate advisory:** at `chapter-brief-gate`, compare adjacent chapters' learning jobs
   with the existing similarity utilities (token/Jaccard-level is fine); near-duplicate →
   ADVISORY naming both chapters. Never a blocker in this pass. Tune the threshold on existing
   fixture books; pin no-FP on them.
3. **Writer card:** render the chapter's `learningJob` + the neighbors' jobs as a short
   NOT-THIS-CHAPTER line (e.g. "This chapter's job: X. Chapter N-1 owns Y; chapter N+1 owns Z —
   do not re-teach them."). Strengthen rule 6 minimally: each example must serve the chapter's
   job through a DIFFERENT facet/failure-mode; if the source offers fewer facets, write fewer,
   merged examples (keep the merge escape — never force invented facets; example count remains
   governed by the dealt contract, so reconcile: the dealt example count is a *max* target — if
   count is contract-exact today (`authorWriteContractFindings` enforces exact dealt count),
   do NOT change the contract; instead the card language stays "distinct facet per example"
   and the detector below carries the enforcement signal).
4. **Within-chapter example-lesson similarity advisory:** new narrow check (place with the
   book-level critics or beside C29 — your call): pairwise-compare each chapter's example
   lesson-bearing fields (`whyItMatters` primarily); ≥2 pairs above a high similarity threshold →
   ONE advisory. Tune + pin on the gold corpus (measure, pin the measured count, justify hits).
5. Everything advisory; no gate, contract, or acceptance change. Machine-brief path only.

### Constraints
Global constraints. Do not change the dealt example-count contract or any write contract. Do not
make the brief gate stricter for existing fixture books (their gates must still pass 0-blocker).
Adjacent-overlap advisory compares learning JOBS, not shared vocabulary (two chapters may share
terms while teaching different jobs). Do not break `compile-chapter-briefs` determinism or
recompile-stability (the F-1 lead-override sidecar depends on recompiles being derivable — read
its comment in `chapterBrief.ts` before touching brief compile).

### Tests
- Unit: learning-job emission (machine-brief fixture); adjacent-overlap advisory fires on a
  crafted duplicate-job fixture, silent on distinct jobs; within-chapter similarity fires on a
  3-same-lesson fixture (model on HOM ch7's trio), silent on distinct-lesson fixtures.
- Gold-corpus pin for the new similarity advisory (measured count).
- Card-pin: NOT-THIS-CHAPTER line renders with neighbor jobs; rule-6 text updated.
- Brief-gate regression: existing fixture books still pass with 0 blockers.
- Full suite `fail 0`.

### Verification
Compile briefs for one fixture book end-to-end (`compile-chapter-briefs` + `chapter-brief-gate`
on a zz-fixture) and paste the rendered learning-job + NOT-THIS lines and the gate summary in
the report. No book generation.

### Output
Report: files changed; the learning-job schema decision (new field vs reused design field);
thresholds chosen + measured gold-corpus counts; test list + suite counts; net card char delta;
confirmation gates/contracts unchanged; explicit note on recompile-stability; risks.

---

## Prompt CF-D: Plain-language first-use definitions for inherited terms of art

### Role
Pipeline engineer on the v24 writer card. Smallest prompt in the set: one rule extension, one
self-check, tests.

### Context
Finding 7. Verified partial gap: HOM ch8 plainly defines `interface` ("In plain words, an
interface is the line where one side's call must meet another side's expertise.") and glosses
functional/mission-oriented organization — but uses `single output accountability` and
`centralized expertise` with no definition anywhere. The PLAIN WORDS rule
(`AUTHOR_PREMIUM_BLOCK`, ~289) covers only terms the chapter *coins*; terms of art inherited
from the source fall through (gap G3). The compliant half proves the writer does this well when
instructed.

### Input
- `PIPE/src/orchestrator/authorRun.ts` — `AUTHOR_PREMIUM_BLOCK` PLAIN WORDS (~289),
  `authorSelfVerify`.
- `PIPE/src/critics/plainLanguage.ts` (E7) — to confirm no overlap/conflict (E7 does vocabulary
  swaps, not definition presence — leave it alone).
- Triage doc Finding 7.

### Objective
Every load-bearing term of art — coined OR inherited from the source — gets one plain-words
unpacking at first use; expert pace is preserved (one clause, not a glossary tone).

### Specific instructions
1. Extend the PLAIN WORDS rule: from "any compressed term this chapter coins" to also cover
   load-bearing terms inherited from the source (the concepts the chapter is BUILT on —
   ~2–4 per chapter), each unpacked in plain words at first use, in one clause, in the flow of
   the prose. Keep the existing "never dodge a vocabulary budget by minting jargon" clause.
2. Add one `authorSelfVerify` item: "list the 2–4 terms this chapter stands on; check each got a
   plain first-use unpacking."
3. Do NOT add a deterministic definition-presence critic (triage red-team: semantically
   FP-heavy). Do NOT touch E7.

### Constraints
Global constraints. Net card delta small (≤ +250 chars). No rubric/weights change (the
`beginner` axis already rewards this — do not double-enforce).

### Tests
- Card-pin: extended rule present; self-verify item present; original coined-terms clause intact.
- Full suite `fail 0`.

### Verification
Render one card (fixture book) and paste the PLAIN WORDS block before/after in the report.

### Output
Report: files changed; before/after rule text; char delta; test list + suite counts; risks
(explicitly: none expected beyond card length).

---

## Prompt CF-E: Implementation-plan UX — sticky skill names, plain action lines, central-image memorable line

### Role
Pipeline engineer on the v24 writer card + one small projection investigation. You make the
chapter's take-home surfaces (skill name, try-this-now, memorable lines) rehearsable and human.

### Context
Findings 9, 10, 14. Verified: (a) `authorSchemaHint` already specs `implementationPlan.title`
"(4–7 words)" but the published package's implementationPlan has NO title field — emitted-then-
dropped or never-emitted: unresolved; the app type (`app/book/data/book-package-core.ts`
`implementationPlan`) has no title either, and the reader renders coreSkill/ifThenPlans only
(`ImplementationPlanCard.tsx`). (b) Ch7's tryThisNow contains the coined shorthand "return word"
inside an action instruction; both chapters' actions are timed-command stiff. (c) Ch7's central
image ("growth breaks sight… sight breaks into pieces") appears twice in prose but none of the
three memorableLines carries it — a selection miss. Reviewer's target exemplars: "Name the Local
Signal" / "Make the Interface Explicit".

### Input
- `PIPE/src/orchestrator/authorRun.ts` — `authorSchemaHint` (implementationPlan + memorableLines
  specs), `AUTHOR_QUALITY_BAR` rule 3 (~270 — imperative-led/timeboxed; DO NOT WEAKEN),
  D9 round-timer contract (~383 — DO NOT TOUCH), `authorSelfVerify`.
- The title-drop question: trace `implementationPlan.title` from writer output → chapter JSON
  (`PIPE/src/types.ts` ~454 `ChapterV21` — does the type carry title?) → package bridge
  (`PIPE/src/publish/publishFinal.ts` / promote path) → app validator
  (`app/app/api/book/_lib/validate-book-package.ts` closed key sets) → reader.
- `PIPE/prompts/writer-implementation-plan.system.md` (legacy, for phrasing precedent only).
- Triage doc Findings 9/10/14.

### Objective
(a) Every implementation plan leads with a reusable skill name: imperative verb + concrete
object, 2–5 words, no virtue-words — carried in whichever field actually reaches the reader;
(b) action fields (tryThisNow, twentyFourHourChallenge, weeklyPractice) contain zero coined
shorthand — any term of art there is said plainly; (c) at least one memorableLine carries the
chapter's central organizing image.

### Specific instructions
1. **Resolve the title question FIRST** (30-minute timebox): if `ChapterV21` carries
   `implementationPlan.title` and the bridge/app drops it, report that as a projection finding
   and — without app-side changes in this prompt — put the skill name where it demonstrably
   reaches the reader: as the REQUIRED first sentence of `coreSkill` ("<Skill name>. <existing
   coreSkill prose>") via schema-hint + card rule. If title never leaves the writer, same
   answer. (An app-side `title` surfacing is a separate decision — note it for CF-H's design
   review or the roadmap's follow-ups; do not implement it here.)
2. **Skill-name rule:** imperative verb + concrete object, 2–5 words, bans virtue-nouns
   (excellence, ownership, accountability as the *name*); the reviewer's two exemplars go in the
   card as the pattern (they are generic enough — verify they don't leak book specifics; if in
   doubt, invent two neutral ones).
3. **Plain action lines:** extend rule 3 or PLAIN WORDS (coordinate with CF-D's landed text — you
   run after it) with: action fields must contain no coined shorthand; if a chapter term must
   appear in an action, restate it plainly in the same sentence. Do not weaken the
   timebox/number requirement or D9.
4. **Memorable-line selection:** add to the memorableLines schema-hint/card: at least one line
   must carry the chapter's central organizing image (the image the breakdown leans on most);
   lines must be THIS chapter's own — never a line already used in another chapter (CF-F's
   detector enforces the book level; this is the write-time instruction).
5. One `authorSelfVerify` item covering: skill name pattern + no-shorthand actions + central-image
   line.

### Constraints
Global constraints. Do not weaken rule 3 or D9. Do not change app code or package schema in this
prompt. Runs AFTER CF-A/CF-B/CF-D land (same card constants — rebase on their text).

### Tests
- Card-pin: skill-name rule, plain-action clause, memorable-line selection rule, self-verify
  item.
- Negative pins: rule 3's timebox text and D9 contract untouched.
- If the title-drop trace finds a real projection bug, write the failing-shape test ONLY if the
  fix is in-scope prose placement (per instruction 1); otherwise document it.
- Full suite `fail 0`.

### Verification
Render one card (fixture book); paste the implementationPlan + memorableLines instruction blocks
before/after. Report the title-drop trace conclusion with file:line evidence.

### Output
Report: files changed; the title-question verdict (emitted-and-dropped / never-emitted /
type-absent) with evidence; verbatim new rules; char delta; test list + suite counts; risks;
recommended follow-up if the app should someday surface a title field.

---

## Prompt CF-F: Signature-line reuse guard — within-book and cross-book

### Role
Senior pipeline engineer on the v24 deterministic critics. You close the verified gap that let
one aphorism ("Agreement nods; commitment signs") ship 5× across four chapters of
`high-output-management` AND 3× in the previously published `execution` — undetected by any
existing guard.

### Context
Finding 11 — the highest-confidence engineering fix in this campaign. Verified mechanics of the
miss: the phrase is 4 words (below `crossBookSignatureAudit.ts`'s 6–25-word sentence window),
lives in fields the audit never scans (counterintuition, fastRead ledes, coreSkill,
memorableLines — the audit reads breakdown tiers only), the audit is an operator watchlist
(`findCrossBookTells`, ≥3 hits across ≥2 books → *candidate* for `banned-phrases.json`), and the
phrase is not in `PIPE/config/banned-phrases.json`. Corroboration: the acceptance panel's
`repeated_unit` advisory fired on ch 2/5/8/11 — exactly the four chapters carrying the line.

### Input
- `PIPE/src/critics/crossBookSignatureAudit.ts` — `findCrossBookTells` (window + field set).
- `PIPE/src/critics/bookPatternAudit.ts`, `PIPE/src/critics/catalogAudit.ts` (line ~149,
  within-book fingerprint) — decide where the within-book detector best lives.
- `PIPE/config/banned-phrases.json` — format + how it's consumed (find the consumer; confirm it
  reaches the writer card and/or a critic).
- `PIPE/src/critics/runAllCritics.ts` — registration.
- Evidence fixtures: `book-packages/high-output-management.v21.json` and
  `book-packages/execution.v21.json` (read-only; distill into test fixtures).
- Triage doc Finding 11 + gap G2.

### Objective
(a) A within-book detector: the same normalized sentence appearing verbatim (or
punctuation-variant) in ≥3 chapters' reader-facing fields → ONE advisory naming the line and
chapters; (b) the cross-book audit sees the fields and lengths that actually leak (memorableLines,
counterintuition, coreSkill, keyTakeaway, tryThisNow, fastRead ledes; aphorism-shaped short
sentences down to 4 words); (c) "Agreement nods; commitment signs" (and close variants) is in
`banned-phrases.json` so future books can't mint it; (d) the writer card already tells authors
lines must be chapter-native (CF-E instruction 4 — coordinate, don't duplicate).

### Specific instructions
1. **Within-book aphorism-repetition detector** (new check; place it with the book-level
   critics — likely beside `bookPatternAudit`): normalize sentences (case, terminal punctuation,
   `;`↔`,`), scan the reader-facing fields listed above across all chapters; any sentence of
   4–25 words appearing in ≥3 chapters → advisory (MINOR) with line + chapter list. Threshold 3
   is deliberate: a single deliberate callback (2 chapters) stays legal.
2. **Cross-book audit extension:** add the missing fields to `findCrossBookTells`'s scan set;
   lower the length floor to 4 words ONLY for aphorism-shaped sentences (contains `;` or a
   balanced antithesis pattern — keep this heuristic simple and documented) to avoid flooding
   the watchlist with ordinary short sentences. It remains a watchlist, not a gate.
3. **banned-phrases:** add `agreement nods; commitment signs` (and the comma variant) per the
   file's existing format. Verify the consumer path actually blocks/flags it for FUTURE
   generation (show where), and confirm it does NOT retroactively fail any existing book's
   gates (published packages are not re-gated; but check the gold-corpus regression tests that
   run critics over tracked state — if any test re-runs banned-phrase checks over the corpus,
   measure the impact and report BEFORE landing; if it would fail tracked-corpus tests, scope
   the phrase entry to generation-time surfaces only and explain).
4. Registration: both detectors advisory. No blocker, no gate wiring, no acceptance change.
5. Run both detectors over the live `book-packages/` catalog once (read-only script or test
   fixture) and include the top findings table in the report — this is the "what else leaked"
   sweep the owner will want, and it doubles as FP calibration.

### Constraints
Global constraints. Watchlist stays a watchlist. Threshold ≥3 chapters for within-book. Do not
add semantic/LLM checks — pure deterministic. Do not modify published packages. If the catalog
sweep surfaces other leaked lines, LIST them in the report; adding them to banned-phrases is a
follow-up decision for the orchestrator, not this prompt (only the proven "agreement nods"
variants land now).

### Tests
- Unit: within-book detector fires on a 3-chapter fixture (semicolon + comma variants unified),
  silent at 2 chapters, silent on different sentences sharing words.
- Unit: cross-book extension catches a distilled "agreement nods" fixture across two fake books;
  ordinary 4-word sentences do NOT enter the watchlist (aphorism-shape guard).
- Gold-corpus pin: measured finding counts for both detectors over the tracked corpus (pin the
  numbers; justify).
- banned-phrases consumer test: the phrase is rejected/flagged wherever the config is enforced.
- Full suite `fail 0`.

### Verification
Paste the catalog sweep results (per-book findings) for both detectors in the report; show the
HOM `agreement nods` case detected with exact chapters (2/5/8/11 + coreSkill), and the
`execution` cross-book hit.

### Output
Report: files changed; detector specs + thresholds; catalog sweep table; banned-phrases consumer
path evidence; measured gold-corpus counts; test list + suite counts; list of any OTHER leaked
signature lines found (as data, no action); risks.

---

## Prompt CF-G: Modern-examples policy — bounded contemporary-translation slot (APPROVAL-GATED)

### Role
Pipeline policy designer + engineer. You write the policy for contemporary analogies FIRST; only
after the owner approves the policy section do you implement the bounded mechanism. This prompt
has an explicit STOP for approval.

### Context
Finding 6. Verified: zero modern-setting examples in HOM ch7/ch8 (every example lives in the
book's own settings; the only real-world case is Intel-era). That is partially source fidelity
working as designed (the breakfast factory is Grove's own device). The reviewer's suggested
analogies (SaaS support, delivery apps, remote teams…) could raise transfer for 2026 readers but
carry the exact risks this pipeline is hardened against: invented specifics presented as fact
(EW1), misattribution, source drift, dating (modern references go stale), and — if dealt
universally — a new sameness pattern. The existing EXAMPLE GROUNDING clause already permits
explicitly-framed hypotheticals; the policy question is whether to *invite* them in modern
settings, how often, and with what fences.

### Input
- `PIPE/src/compiler/contentDeviceDeal.ts` — the deal pattern to imitate for an opt-in slot.
- `PIPE/src/orchestrator/authorRun.ts` — EXAMPLE GROUNDING + SELF-VERIFY FACTS; writer packet
  projection ("the ONLY allowed factual material").
- `PIPE/src/critics/evidenceWitness.ts` (EW1), `misattribution.ts`, `sourceGrounding.ts`.
- Quiz/card generation surfaces (confirm invented-hypothetical content is already excluded from
  quiz "facts" — find the rule; if none exists, that's a policy requirement below).
- Triage doc Finding 6.

### Objective
Phase 1 (this prompt, always): a one-page policy in
`PIPE/docs/v24/MODERN-EXAMPLES-POLICY.md` covering: when a contemporary-translation example is
allowed (opt-in dealt slot, ≤1 per chapter, dealt to a MINORITY of chapters — suggest ≤1/3, so
it can never become the new house template), the mandatory framing (explicitly hypothetical,
present-day-generic — no named real companies/products, no invented statistics, no
source-attributed modern claims), the quiz/card quarantine (nothing from a
contemporary-translation example may appear as a factual quiz answer or card "fact"), and the
dating rule (generic durable settings — "a support queue", "a distributed team" — not named
technologies that stale). Phase 2 (ONLY after owner approves the policy doc): implement the
dealt slot in `contentDeviceDeal.ts`/brief rotation style + card instruction + tests.

### Specific instructions
1. Write the policy doc with a short decision table (allowed/forbidden examples of each rule).
2. **STOP. Present the policy for owner approval.** Do not implement Phase 2 in the same run
   unless the run instructions explicitly say the policy is pre-approved.
3. Phase 2 (post-approval): the slot is dealt (deterministic, like content devices), opt-in per
   chapter, rendered as a card instruction with the framing + quarantine rules inline; EW1 and
   all source-fidelity critics untouched; add a self-verify item; tests per below.

### Constraints
Global constraints. EW1/misattribution/sourceGrounding are untouchable. No named real companies,
products, or people in invented modern examples. The slot must be structurally incapable of
becoming universal (dealt minority + deterministic). If the quiz-quarantine rule has no existing
enforcement surface, Phase 2 must add the check to the relevant validator as ADVISORY and
report; do not invent a new blocker.

### Tests (Phase 2 only)
- Deal determinism: same book → same slots; minority coverage property test.
- Card-pin: framing + quarantine instructions render only for dealt chapters.
- Fixture: a modern-hypothetical example WITH proper framing passes existing critics; one
  presented as fact trips EW1/grounding fixtures (prove the fences hold).
- Full suite `fail 0`.

### Verification
Phase 1: the policy doc exists and covers all four rule areas. Phase 2: card render for a dealt
vs non-dealt chapter; critic fixtures green.

### Output
Phase 1 report: the policy doc + open questions for the owner. Phase 2 report (if approved):
files changed; deal shape; tests + suite counts; explicit confirmation EW1 et al. untouched.

---

## Prompt CF-H: Comparison/contrast display — design decision (APPROVAL-GATED, DESIGN ONLY)

### Role
Product+pipeline design engineer. You produce a DESIGN DECISION DOCUMENT for structured
comparison displays in chapters — you implement nothing.

### Context
Finding 16. HOM ch8's functional-vs-mission-vs-hybrid tradeoff is the canonical case for a
comparison display; today the schema cannot carry one (chapter content = fixed named fields;
breakdown = three prose strings; the only block union is `paragraph|bullet` app-side). Verified
blast radius (app agent): a TRUE table block = Medium — `app/book/data/book-package-core.ts` +
`app/book/data/bookChapters.ts` (types/normalizer), `app/app/api/book/_lib/validate-book-package.ts`
(STRICT closed allowlists — `CHAPTER_KEYS`, `parseSummaryBlocks` rejects unknown block types),
new reader component beside
`app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx`, plus pipeline
`PIPE/src/runtimeSchemas.ts` `validateChapterV21` (~207) if machine-authored. Old packages are
safe (unknown blocks silently dropped, `SummaryCard.tsx:55-58`; optional fields absence-gated).
**Zero-schema Low path exists:** bullet blocks with `detail` (expandable) and
`ifThenPlans`-style labeled rows (`ImplementationPlanCard.tsx:63-75`) are structured-rendering
precedents; and a disciplined PROSE contrast pattern (parallel sentences) needs nothing at all.

### Input
All files above; triage doc Finding 16; `docs/` design precedents if any (reader UI docs);
the premium design bar (owner's standard: Apple-Pro restraint — no gimmick UI).

### Objective
A decision doc `docs/v24/COMPARISON-DISPLAY-DESIGN.md` (repo-root docs/v24) that lets the owner
choose between: (0) do nothing; (1) prose-pattern only — a writer-card "structured contrast"
instruction for taxonomy/tradeoff chapters (Low, no schema); (2) reuse existing structures
(bullets/labeled rows) with a writer instruction (Low, no schema); (3) true `comparison_table`
block end-to-end (Medium, cross-layer, deploy-sequencing constraint: app validator must deploy
BEFORE any package carrying the new key is published). Each option: reader value, blast radius,
sameness risk (a dealt comparison slot must not become universal), quiz/card impact (verified
none), rollout, and a recommendation.

### Specific instructions
1. Read the listed surfaces; verify the app agent's claims yourself (validator closed sets,
   silent-drop behavior) with file:line citations.
2. Write the decision doc with the four options, a recommendation, and — if option 3 — the exact
   file-by-file change list and deploy-order constraint.
3. **STOP.** No implementation. No schema edits. No app edits. The doc ends with the approval
   checklist for the owner.

### Constraints
Global constraints. Design only. If recommending option 1/2, spec the writer-card instruction
text so a follow-up prompt can land it in one pass (it would then serialize with the Lane-1 card
prompts).

### Tests
None (design only) — but the doc must include the test plan for whichever option it recommends.

### Verification
The doc exists, cites file:line for every blast-radius claim, and contains a test plan.

### Output
The decision doc + a 10-line summary in the report (option recommended, why, cost).
