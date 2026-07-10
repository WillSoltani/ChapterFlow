# Comparison-Display Design Decision

**Finding 16** (from `V24_CONTENT_FEEDBACK_TRIAGE.md`). HOM ch8's
functional-vs-mission-vs-hybrid tradeoff is the canonical case for a structured
comparison display. This doc lets the owner choose how (or whether) to support
comparison displays in chapters. **Design only — nothing is implemented.**

- **Companion docs:** `V24_CONTENT_FEEDBACK_TRIAGE.md`, `V24_CONTENT_FEEDBACK_ROADMAP.md`
- **Branch:** `feat/anti-sameness-live-fix`
- **Scope constraint:** the ch7/ch8 sample is *evidence*, not the target. No book-specific string enters `src/`.

---

## 1. What the schema can carry today (verified)

A chapter's reader-visible body is a list of **summary blocks**, and the block
union is closed to exactly two types — `paragraph` and `bullet` — at every layer:

| Layer | Type / gate | File:line | Behavior |
|---|---|---|---|
| Pipeline authoring (v21) | `validateChapterV21` — body is `breakdown.{fastRead,deepRead,fullRead}` **prose strings**; there is no structured-block field | [runtimeSchemas.ts:207-255](../../scripts/book/prompts/chapterflow-v24-author-pipeline/src/runtimeSchemas.ts#L207-L255) | A comparison today can only live *inside* prose. |
| v21→v13 adapter | `adaptVariant` **synthesizes** `summaryBlocks` by splitting prose into `paragraph`s + mapping takeaways to `bullet`s | [v21-adapter.ts:52-69](../../app/app/api/book/_lib/v21-adapter.ts#L52-L69) | The adapter, not the package, decides block shape. A v21 package cannot hand-author a block type. |
| Ingestion validator (native-v13) | `parseSummaryBlocks` accepts **only** `paragraph`\|`bullet`; anything else → issue `"summary block type must be paragraph or bullet."` | [validate-book-package.ts:202-245](../../app/app/api/book/_lib/validate-book-package.ts#L202-L245) (reject at [:239-242](../../app/app/api/book/_lib/validate-book-package.ts#L239-L242)) | STRICT closed set. |
| Ingestion validator (keys) | `CHAPTER_KEYS` + `VARIANT_CONTENT_KEYS` are closed allowlists; `hasOnlyKeys` pushes `"Unexpected field."` for any unknown key | [CHAPTER_KEYS:64-79](../../app/app/api/book/_lib/validate-book-package.ts#L64-L79), [VARIANT_CONTENT_KEYS:100-114](../../app/app/api/book/_lib/validate-book-package.ts#L100-L114), [hasOnlyKeys:118-124](../../app/app/api/book/_lib/validate-book-package.ts#L118-L124) | A new sibling key is also rejected. |
| Reader types | `PackageSummaryBlock` and `ChapterSummaryBlock` unions = `paragraph`\|`bullet` only | [book-package-core.ts:21-30](../../app/book/data/book-package-core.ts#L21-L30), [bookChapters.ts:34-45](../../app/book/data/bookChapters.ts#L34-L45) | — |
| Reader normalizer | `variantSummaryBlocks` maps only `paragraph`/`bullet`; any other type → `null` → filtered out | [bookChapters.ts:265-289](../../app/book/data/bookChapters.ts#L265-L289) (drop at [:286-288](../../app/book/data/bookChapters.ts#L286-L288)) | **Silent drop** — no crash. |
| Reader render | `SummaryCard` splits blocks into `paragraph`/`bullet` and renders each; unknown types never reach the DOM | [SummaryCard.tsx:55-58](../../app/book/library/[bookId]/chapter/[chapterId]/components/SummaryCard.tsx#L55-L58), wired at [ChapterReaderClient.tsx:1532](../../app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx#L1532) | — |

### Old-package safety (verified)
Unknown blocks are dropped silently at the normalizer ([bookChapters.ts:286-288](../../app/book/data/bookChapters.ts#L286-L288)) and again filtered at the reader ([SummaryCard.tsx:55-58](../../app/book/library/[bookId]/chapter/[chapterId]/components/SummaryCard.tsx#L55-L58)); every new optional field is absence-gated. So **shipping a renderer for a new block type does not break any of the ~130 already-published packages** — they simply carry none.

### Zero-schema structured precedents that already exist (verified)
- **Expandable bullet (`detail`):** a bullet can carry a `detail` string that renders behind a "Show more"/"Show less" toggle — [SummaryCard.tsx:210-235](../../app/book/library/[bookId]/chapter/[chapterId]/components/SummaryCard.tsx#L210-L235); parsed at [validate-book-package.ts:227-238](../../app/app/api/book/_lib/validate-book-package.ts#L227-L238). Three labeled bullets each with a `detail` = a scannable 3-way comparison with **zero schema change**.
- **Labeled rows (`ifThenPlans`):** the implementation-plan card renders labeled, boxed rows (`context` chip + body) — [ImplementationPlanCard.tsx:63-75](../../app/book/library/[bookId]/chapter/[chapterId]/components/ImplementationPlanCard.tsx#L63-L75). Precedent for a labeled-row visual, though it is a fixed card, not a general block.

### Quiz / card impact (verified: NONE for every option)
A comparison lives in **chapter body content** (`summaryBlocks` / `breakdown` prose). Quiz parsing (`QUIZ_KEYS`/`QUESTION_KEYS`, [validate-book-package.ts:81-99](../../app/app/api/book/_lib/validate-book-package.ts#L81-L99)) and `reviewCards` parsing ([:692-720](../../app/app/api/book/_lib/validate-book-package.ts#L692-L720)) are independent surfaces. No option below touches quiz keys, distractors, review cards, or `keyTakeawayCard`.

---

## 2. The four options

### Option 0 — Do nothing
- **Reader value:** none added. A tradeoff is a wall of prose; scanning the three cases is on the reader.
- **Blast radius:** zero.
- **Sameness risk:** zero.
- **Quiz/card:** none.
- **Rollout:** none.

### Option 1 — Prose-contrast pattern (writer-card instruction, Low, no schema)
Add a writer-card instruction that, for taxonomy/tradeoff chapters, tells the author to render the comparison as **parallel, structurally-matched sentences** (same clause order per case, one case per sentence) so the contrast is legible without any UI.
- **Reader value:** Medium. Good prose already conveys tradeoffs; parallel structure makes the three cases scannable. Fits the premium bar (Apple-Pro restraint — no chrome).
- **Blast radius:** Low. Writer-card text only (`AUTHOR_*` constants in `authorRun.ts`). No schema, no app, no validator, no deploy sequencing.
- **Sameness risk:** Low–Medium — the instruction must be **conditional** ("when the source presents a genuine multi-way tradeoff"), never "every chapter gets a contrast," or it becomes a tic. Guarded by the existing sameness/monoculture critics.
- **Quiz/card:** none.
- **Rollout:** lands in one card-prompt pass; serializes with the Lane-1 card prompts (CF-A→CF-B→CF-D→CF-E).

### Option 2 — Reuse existing structures (writer-card instruction, Low, no schema)
Same as Option 1, but the instruction additionally permits mapping a 3-way taxonomy onto the **existing expandable-bullet structure**: one bullet per case (`text` = the case + its one-line verdict, `detail` = the nuance), which the reader already renders as a scannable, expandable list ([SummaryCard.tsx:210-235](../../app/book/library/[bookId]/chapter/[chapterId]/components/SummaryCard.tsx#L210-L235)).
- **Reader value:** Medium–High. Genuine scannability (labeled, expandable rows) with **zero** schema/app/validator/deploy change — the renderer already exists and ships everywhere.
- **Blast radius:** Low. Writer-card text only. The `detail` field is already valid at the validator ([:227-238](../../app/app/api/book/_lib/validate-book-package.ts#L227-L238)) and normalizer ([bookChapters.ts:277-284](../../app/book/data/bookChapters.ts#L277-L284)).
- **Sameness risk:** Medium — bullets already carry takeaways, so overusing them for comparisons risks visual monotony. Must be dealt (see §4), not universal.
- **Quiz/card:** none.
- **Rollout:** one card-prompt pass; same serialization as Option 1.

### Option 3 — True `comparison_table` block, end-to-end (Medium, cross-layer)
Add a first-class `comparison` block type carrying axes × cases as structured data, rendered as a real comparison table.
- **Reader value:** High for the rare genuine matrix (N cases × M axes). Highest fidelity, most scannable.
- **Blast radius:** **Medium, cross-layer** (see §3 for the file-by-file list). Touches pipeline authoring schema, adapter, reader types, normalizer, reader component, **and** the native-v13 ingestion validator.
- **Sameness risk:** **High** — a dedicated table block is the most tempting to over-apply; it must be a **dealt slot** (§4) with a hard cap, or every chapter grows a table.
- **Quiz/card:** none (content-only).
- **Rollout:** **deploy-order constraint** — the app (validator + adapter + normalizer + reader + types) MUST deploy **before** any package carrying the new key is published. See §3.

---

## 3. Option 3 — exact file-by-file change list (only if the owner picks it)

If (and only if) Option 3 is approved, these are the surfaces, in dependency order:

1. **Pipeline authoring schema** — add an optional structured `comparisons` field (axes + cases) to `ChapterV21` and validate it in [`validateChapterV21`](../../scripts/book/prompts/chapterflow-v24-author-pipeline/src/runtimeSchemas.ts#L207-L255). (Today the body is prose-only, so there is nowhere to author a matrix.)
2. **v21→v13 adapter** — extend [`adaptVariant`](../../app/app/api/book/_lib/v21-adapter.ts#L52-L69) to emit a `comparison` summary block from the authored `comparisons`. Without this, a v21 package's comparison is never carried into `summaryBlocks`.
3. **Reader types** — add the `comparison` arm to `PackageSummaryBlock` ([book-package-core.ts:21-30](../../app/book/data/book-package-core.ts#L21-L30)) and `ChapterSummaryBlock` ([bookChapters.ts:34-45](../../app/book/data/bookChapters.ts#L34-L45)).
4. **Reader normalizer** — teach [`variantSummaryBlocks`](../../app/book/data/bookChapters.ts#L265-L289) (and `exactSummaryBlocks`, [:295-323](../../app/book/data/bookChapters.ts#L295-L323)) to pass the new type through instead of dropping it at [:286-288](../../app/book/data/bookChapters.ts#L286-L288).
5. **Reader component** — a new `ComparisonTable` component beside [SummaryCard.tsx](../../app/book/library/[bookId]/chapter/[chapterId]/components/SummaryCard.tsx), rendered from the block switch (SummaryCard filters at [:55-58](../../app/book/library/[bookId]/chapter/[chapterId]/components/SummaryCard.tsx#L55-L58)); must be horizontally-scroll-safe and theme-aware to hold the premium bar.
6. **Native-v13 ingestion validator** — extend `parseSummaryBlocks` to accept `comparison` ([validate-book-package.ts:202-245](../../app/app/api/book/_lib/validate-book-package.ts#L202-L245); the reject site is [:239-242](../../app/app/api/book/_lib/validate-book-package.ts#L239-L242)). **This is the deploy gate.**

### Deploy-order constraint (why the app must ship first)
- **Native-v13 path:** the OLD validator **hard-rejects** an unknown block type (422, [:239-242](../../app/app/api/book/_lib/validate-book-package.ts#L239-L242)). Publishing a package with `comparison` before step 6 deploys → ingestion fails closed.
- **v21 path:** for v21 packages, `validateBookPackage` runs only `enforceSemanticRules` + `enforceV21QuizFieldRules` on the *adapted* package and **skips** the field parser ([validate-book-package.ts:1295-1308](../../app/app/api/book/_lib/validate-book-package.ts#L1295-L1308)) — so ingestion won't reject, but the OLD adapter (step 2) never emits the block and the OLD normalizer silently drops it: the comparison is **invisible** until the app deploys.
- **Conclusion:** for either authoring path, **deploy the app (steps 2–6) before publishing any package that carries the new structure.** Old packages remain safe throughout (§1).

---

## 4. Sameness guard (applies to Options 2 and 3)
A comparison display must be a **dealt slot**, never universal — the anti-sameness mandate is the whole point of this branch. Whichever renderer exists, the authoring instruction must:
- gate on genuine multi-way tradeoffs actually present in the source packet (not invented);
- be allocated by the existing brief/deal rotation, not emitted every chapter;
- carry a per-book cap so a comparison structure does not appear in more than a small minority of chapters.
This is enforced by the deal/rotation layer, not by the display itself.

---

## 5. Recommendation

**Recommend Option 1 as the primary, with Option 2 as its explicit fallback — a single "structured contrast" writer-card instruction that covers both. Recommend against Option 3 for now.**

Rationale:
- **Reader value per unit of risk is highest at Options 1/2.** Option 2's expandable-bullet path already gives a scannable, labeled, expandable 3-way display with **zero** schema, app, validator, or deploy change — the renderer ships in every package today ([SummaryCard.tsx:210-235](../../app/book/library/[bookId]/chapter/[chapterId]/components/SummaryCard.tsx#L210-L235)).
- **The premium bar favors restraint.** A dedicated table block is exactly the kind of chrome the owner's Apple-Pro standard resists; prose parallelism + expandable bullets read as calm, not gimmicky.
- **Option 3 is Medium, cross-layer, and deploy-sequenced** for a need that is, by the triage's own framing, *rare* (one canonical chapter). The sameness risk is highest precisely because a table is the most over-appliable. Defer it to a dedicated design cycle if a real matrix need (N×M, not 3×1) recurs across books.
- **Cost:** Options 1/2 = one card-prompt pass on this branch, serialized with the Lane-1 card prompts; no deploy, no schema, no app change.

### Spec for the follow-up card prompt (Option 1 + 2, one pass)
Land this as a single conditional clause in the writer card (`AUTHOR_HOUSE_RULES` or `AUTHOR_QUALITY_BAR` in `authorRun.ts`), rebased on the latest Lane-1 card text. Suggested text (**net delta ≈ +330 chars**, within the ≤ +400 budget; merge into an existing "structure" line if one exists to reduce delta):

> **Structured contrast (only when the source presents a genuine multi-way tradeoff — never invented, never every chapter):** render the cases in parallel — either as structurally-matched sentences (same clause order per case, one case per sentence) or as one takeaway bullet per case, where the bullet states the case + its one-line verdict and the detail holds the nuance. Do not fabricate a comparison where the source has none.

(No new schema key: "one bullet per case with detail" uses the existing `summaryBlocks` bullet+`detail` shape, valid at the validator and normalizer today.)

### Test plan for the recommendation (Options 1/2)
Because Options 1/2 are writer-card text with **no runtime surface**, the tests are card-integrity + regression, not new rendering paths:
1. **Card-length regression:** assert the writer card stays within its warning budget after the clause is added (measure net char delta; keep ≤ +400). Extend whichever existing card-constant test guards `authorRun.ts` sizes.
2. **Full suite green:** `npm test` from `PIPE/` must stay `fail 0` (baseline pass 1891 / fail 0 / xenv 6); the clause adds to `pass` only if it ships with an assertion.
3. **No-op on the app:** confirm no app test changes — the expandable-bullet render path is already covered by existing `SummaryCard` / `experiencePlanCards` tests; Option 2 introduces no new block type, so no validator/normalizer test is needed.
4. **(If Option 2 is exercised on a real chapter later)** a manual read: three cases render as three expandable bullets, `detail` toggles, and the sameness deal did not place a comparison in a majority of chapters.

*(If the owner instead picks Option 3, the test plan is larger: validator accept/reject tests for the new type on the native-v13 path, an adapter unit test that a v21 `comparisons` field emits a `comparison` block, a normalizer passthrough test, a reader render + horizontal-scroll/theme test, and an old-package regression proving silent-drop still holds. Those are out of scope until Option 3 is approved.)*

---

## 6. Owner approval checklist

- [ ] **Pick one:** Option 0 (do nothing) · Option 1 (prose contrast) · Option 2 (reuse expandable bullets) · Option 3 (true `comparison_table` block).
- [ ] If **1 or 2:** approve the writer-card clause text in §5 (or edit it); confirm it lands as an advisory, conditional, dealt instruction — not a per-chapter mandate.
- [ ] If **3:** explicitly accept the Medium cross-layer blast radius (§3) **and** the deploy-order constraint (app deploys before any package carrying the new key is published), and schedule it as its own design/implementation cycle.
- [ ] Confirm the sameness guard (§4): a comparison display is a dealt slot with a per-book cap, never universal.
- [ ] Confirm no gate/blocker/contract is weakened (global constraint) — none of the recommended options touch a gate.

**This document ends here. No implementation, schema edit, or app edit has been made.**
