# V24 Content-Feedback Roadmap — execution lanes, sequencing, orchestrator contract

**Companions:** `V24_CONTENT_FEEDBACK_TRIAGE.md` (verdicts + evidence),
`V24_CONTENT_FEEDBACK_IMPLEMENTATION_PROMPTS.md` (prompts CF-A…CF-H).
**Branch:** `feat/anti-sameness-live-fix` · **Suite baseline at handoff:** pass 1891 / fail 0 /
xenv 6 · **Pipeline root (`PIPE/`):** `scripts/book/prompts/chapterflow-v24-author-pipeline/`

Standing context the implementing agents inherit: F-1 (bounded lead degradation) and F-2
(restore fixtures) are already landed on this branch (`226fd5e00`, `5890955bb`);
`high-output-management` is published (`e750a692e`) with deploy PENDING; two commits after the
publish are local-only. **Do not push; do not deploy; do not regenerate books** during this
campaign — the fresh validation book is the orchestrator's job afterwards.

---

## Recommended execution order (priority)

| Order | Prompt | What | Why this rank |
|-------|--------|------|---------------|
| 1 | **CF-F** | Signature-line reuse guard | Highest-confidence verified engineering gap (proven across two published books + panel `repeated_unit` corroboration); independent files; unblocks the "what else leaked" catalog sweep the owner will want |
| 2 | **CF-B** | Example humanization + evaluator-voice detector | Biggest reader-experience lever; addresses the panel's all-16-chapter `scene_skeleton` advisory class; its critic should exist BEFORE any future review-calibration work |
| 3 | **CF-A** | Hook tension + concrete doorway | Cheap, confirmed, targets the book's weakest chapter class |
| 4 | **CF-C** | Distinct jobs (examples + chapters) | Medium blast radius (compiler + brief gate); benefits every future machine-brief book |
| 5 | **CF-E** | Plan UX: skill names, plain actions, central-image lines | Low cost; runs last of the card-editing prompts; includes the title-drop investigation |
| 6 | **CF-D** | First-use definitions | Smallest prompt; slots anywhere in the card serialization (scheduled before CF-E — see lane 1) |
| 7 | **CF-G** | Modern-examples policy | Approval-gated; policy phase can run anytime, implementation only after owner sign-off |
| 8 | **CF-H** | Comparison-display design doc | Approval-gated design-only; highest blast radius if ever implemented |

Highest-priority prompt: **CF-F** (with CF-B the close second on pure reader impact).
Highest-blast-radius prompt: **CF-H** (app/schema cross-layer — which is exactly why it ships as
a design decision, not an implementation).

---

## Parallel lanes

The dominant conflict surface is `PIPE/src/orchestrator/authorRun.ts` — four prompts edit the
same writer-card constants and MUST serialize. Everything else can run in parallel.

```text
Lane 1 — Writer-card serialization (ONE agent at a time, in this order; each rebases on the last)
- CF-A  Hook tension + concrete doorway          (authorRun.ts card constants)
- CF-B  Example humanization (card half + new critic file)
- CF-D  First-use definitions                    (PREMIUM_BLOCK)
- CF-E  Plan UX + memorable-line selection       (schema hint + rules; coordinates with CF-D text)

Lane 2 — Critics & config (parallel with Lane 1, independent files)
- CF-F  Signature-line reuse guard               (crossBookSignatureAudit.ts, new within-book
                                                  detector, banned-phrases.json, catalog sweep)

Lane 3 — Compiler / brief path (parallel with Lanes 1-2 EXCEPT its one card touch — see deps)
- CF-C  Learning jobs + adjacent-overlap advisory (bookDesign.ts, chapterBrief.ts, brief gate,
                                                  within-chapter example-lesson advisory)

Lane 4 — Approval-gated (start anytime; BLOCK on owner decision before any implementation)
- CF-G  Modern-examples policy (Phase 1 doc → STOP → owner → Phase 2)
- CF-H  Comparison-display design doc (design only → STOP → owner)
```

Practical dispatch: Lane 1 as one sequential chain (or a single agent handed all four prompts in
order), Lane 2 + Lane 3 + Lane 4-phase-1 concurrently alongside it.

## Sequential dependencies

1. **CF-A → CF-B → CF-D → CF-E (hard):** same card constants; each prompt's card-pin tests
   assert exact lines — parallel edits would collide textually and in tests. CF-E additionally
   depends on CF-D's landed PLAIN WORDS text (its plain-action clause coordinates with it).
2. **CF-C's card touch lands last-wins:** CF-C mostly edits compiler/brief files, but its
   NOT-THIS-CHAPTER line renders into the card via brief lines and it strengthens rule 6
   (a `AUTHOR_QUALITY_BAR` constant). Schedule CF-C's authorRun/rule-6 edit AFTER Lane 1
   completes (or let CF-C run fully after CF-E if simpler). The bookDesign/brief-gate work can
   proceed in parallel regardless.
3. **CF-B before any reviewer/QC calibration:** if a future campaign calibrates reader-review
   strictness around example quality, the evaluator-voice detector must already exist so
   calibration sees the deterministic signal. (No calibration is scheduled in this campaign.)
4. **CF-G policy before ANY modern-example writer instruction:** no card text inviting modern
   analogies may land before the policy is approved — the fences (framing, quiz quarantine,
   minority deal) are the point.
5. **CF-H design before ANY schema change**, and if option 3 (true table block) is ever
   approved: the app-side validator must deploy BEFORE any package carrying the new key is
   published (the validator fail-closes on unknown keys — reverse order bricks the publish).
6. **CF-F's banned-phrases entry** is generation-time-forward; its gold-corpus impact must be
   measured (prompt instruction 3) before landing, so it cannot silently fail tracked-corpus
   regression tests.

## Conflict risks (prompt-vs-prompt)

- **CF-B (more human examples) vs Finding-17 (fewer names):** resolved by design — CF-B carries
  an explicit guardrail: humanization must not add named characters beyond the dealt cast and
  must respect dealt proxy-cast bans. The name dial stays owned by the content-device deal.
- **CF-A (tension in every hook) vs `OPENER_TYPES` variety deal:** the hook rule is
  mode-agnostic (a claim/statistic opener passes by naming a stake, not by becoming a question).
  If post-implementation card renders show hooks collapsing into one shape, that is a CF-A
  regression — check it in verification.
- **CF-B conditional-conflict clause vs fake-scene risk:** staged disagreement must stay inside
  packet facts or explicit hypothetical (EXAMPLE GROUNDING untouched). Any dramatization
  instruction that loosens grounding is out of bounds.
- **CF-C (sharper separation) vs book coherence:** the adjacent-overlap check compares learning
  JOBS, not vocabulary, and is advisory — a book deliberately deepening one idea should trip
  nothing. Watch the fixture-book gate regressions.
- **CF-E memorable-line "chapter-native" rule vs CF-F detector:** same goal, two levels (write
  instruction vs book-level detector) — they must agree on what counts as reuse (verbatim +
  punctuation variants). CF-E runs after CF-F is specced; implementers should read each other's
  reports.
- **CF-G modern examples vs source fidelity:** the entire prompt is fences-first; EW1 and
  grounding critics untouchable; quiz quarantine mandatory.
- **CF-H table block vs current schema/publish chain:** design-only now precisely because the
  validator closed-sets + deploy ordering make casual implementation dangerous.
- **Card length:** four prompts add card text to a card already over its soft budget
  (26–31k vs 25k target). Each Lane-1 prompt reports its net delta; the orchestrator sums them
  at verification and, if the total exceeds ~+1k chars, orders a consolidation edit pass.

---

## Orchestrator plan after implementation

When the owner returns to this session after the prompts have been run elsewhere:

1. **Read implementation reports** for every executed prompt (CF-A…CF-F, plus CF-G/CF-H phase-1
   docs).
2. **Verify each prompt against its plan** — diff-level inspection of the named files; card
   constants read directly; confirm each "do not touch" (rule 3, D9, OPENER_TYPES, C26, C29
   logic, EW1, label-strip, named_protagonist, contracts, gates) is byte-untouched.
3. **Check cross-prompt conflicts:** final merged card text reads coherently (no contradictory
   rules, no duplicated instructions from CF-D/CF-E coordination); CF-C's rule-6 edit merged
   after Lane 1; card char delta summed vs budget.
4. **Run targeted tests** per prompt (card pins, detectors, gold-corpus pins), then
   **full suite** — expect `fail 0` and pass count = 1891 + the new tests (reconcile the exact
   number from the reports).
5. **Run full validation:** typecheck; `chapter-brief-gate` on fixture books (0 blockers);
   detector catalog sweep re-run (CF-F) and spot-check its findings by reading actual content
   (per the standing trap: gates pass structurally-valid but content-corrupt output — READ the
   content).
6. **Generate ONE fresh gold-corpus validation book** with the updated pipeline: pick a fresh,
   never-run, machine-brief book from the unpublished catalog at run time (NOT
   `high-output-management`, NOT `start-with-why`, no prior state — same selection discipline as
   the 2026-07-08 run), `book-run <book> --author --no-publish`, logs under
   `PIPE/logs/v24-content-feedback-validation/`.
7. **Compare before/after content quality** against the HOM baseline: chapter composites
   (HOM: 85.0–89.0, pooled 78.8 vs premium target 80); panel texture advisories — specifically
   whether `scene_skeleton` still fires on all chapters and whether `repeated_unit` recurs;
   direct reads of 2–3 chapters checking each finding class: hook tension, doorway concreteness,
   evaluator-voice density, example-lesson distinctness, first-use definitions, skill names,
   plain action lines, central-image memorable line, zero recycled aphorisms.
8. **Check book-level sameness:** content-device profile still under the 60% cap; no NEW
   sameness pattern introduced by the fixes themselves (e.g. every hook a question; every
   example a two-party fight; every skill name the same verb).
9. **Decide whether the pipeline improved:** the bar is honest — deterministic detectors clean
   or explained, review scores non-inferior, texture advisories reduced, and the direct-read
   verdict better on the targeted classes. A mixed result gets reported as mixed.
10. **Write the final verification report** →
    `docs/v24/V24_CONTENT_FEEDBACK_VERIFICATION_REPORT.md`, mapping every implemented prompt
    back to its original findings (the triage doc's numbering), with before/after evidence.

## Orchestrator Contract

When the user returns after implementation, this session SHALL:

- verify each implemented prompt against its plan in
  `V24_CONTENT_FEEDBACK_IMPLEMENTATION_PROMPTS.md`, not against the implementer's summary;
- map each implementation back to the original feedback finding (1–17) it serves, using the
  triage doc's verdicts as the reference;
- inspect the code and tests directly (Read the diffs; run the suites); **do not trust
  implementation reports blindly** — reports claim, diffs prove;
- check for blast-radius mistakes: gate/contract/blocker text changed, advisory checks wired
  into gates, card budget blown, manual-brief books affected by machine-brief-only features,
  recompile-stability of briefs broken (F-1 sidecar dependency);
- check for schema/app breakage: no package-schema or app-validator change should exist at all
  unless CF-H option 3 was explicitly approved (it ships design-only);
- check for prompt conflicts using the "Conflict risks" table above, especially the merged
  writer-card text;
- check whether reader experience actually improved by READING generated content, not by
  trusting scores or structural gates (standing trap: gates pass content-corrupt output);
- run a controlled validation on ONE fresh gold-corpus book (steps 6–8 above) before any
  improvement verdict;
- avoid re-opening unrelated old issues (POM research, quiz-tell gates, carry-churn, F-1 design)
  unless evidence shows a regression — the standing "do NOT re-research POM" and "never
  re-propose lexical quiz-tell gates" memories apply;
- write the final verification report (step 10) with faithful, evidence-cited outcomes,
  including failures and partial results;
- create new prompts ONLY for verified engineering bugs found during verification — content
  taste alone does not mint prompts without evidence;
- keep the standing constraints: no push (the branch's push state is already deviated by the
  publish transaction — see the completion report §13; do not push further), no deploy, no
  publish, no gate changes without owner approval.

---

## Final response summary (for the record)

- Findings analyzed: **17**
- Agreed: **8** (1, 2, 4, 8, 9, 10, 11, 13) · Partially agreed: **8** (3, 5, 6, 7, 12, 14, 16,
  17) · Rejected: **1** (15, evidence contradicts) · Also rejected-as-standalone: 17 (its
  guardrail is carried inside CF-B)
- Implementation prompts created: **8** (CF-A…CF-F executable now; CF-G, CF-H approval-gated)
- Lanes: **4** (card serialization · critics/config · compiler · approval-gated)
- Highest priority: **CF-F**, then **CF-B** · Highest blast radius: **CF-H**
- Production code changed in this pass: **none** (three docs written under `docs/v24/`)
