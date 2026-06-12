# ChapterFlow v21 Book-Production Pipeline — Handoff

A briefing for a model continuing development. It covers what the pipeline does, the
hard constraint that shapes every design choice, the end-to-end flow, the gate/QC
model, the file map, the non-obvious gotchas, and the open work.

---

## 1. What it produces

Given a non-fiction book (title + author), the pipeline produces a **`ChapterV21`
learning package** — one rich JSON object per chapter. Top-level keys (verified):

```
chapterId, number, title, readingTimeMinutes, hook, counterintuition, tryThisNow,
keyTakeaway, breakdown{fastRead,deepRead,fullRead}, examples[], quiz{questions[]},
reviewCards[], implementationPlan, memorableLines[3]
```

- `examples[]` = `{title, format, scenario, whatToDo, whyItMatters, sourceAnchorId?}` (6 per chapter).
- `quiz.questions[]` = `{prompt, choices[], correctIndex, explanation, sourceAnchorId?}` (~9 per chapter).
- `reviewCards[]` = `{front, back, sourceAnchorId?}`.
- `chapterId` = `"<bookId>-chNN"` (lowercase-hyphen bookId). Files live at
  `state/chapters/<bookId>-chNN.v21-native.chapter.json`.
- `sourceAnchorId` is **gate-time provenance only** — it points a unit at the source
  fact it was built from (for SC11) and is **stripped at promote** so it never ships.

The finished, validated book becomes `book-packages/<bookId>.v21.json`, which the
Next.js reader renders.

---

## 2. THE HARD CONSTRAINT (read this first — it explains everything)

**No funded LLM API for the pipeline's automated checks** (no OpenAI/Anthropic key).
The operating model is:
- **Generation = Codex** (the user runs it inline; the pipeline emits prompts, not API calls).
- **QC = a separate Claude session** (a human drives it).

Consequence: there is **no automated semantic judge**. Deterministic gates can verify
structure/templating/format but **cannot** catch a wrong quiz answer, a plausible-but-
false sentence, or "templated-but-grammatical" prose. That gap is closed not by a model
call but by a **content-pinned QC-attestation gate** (§5) that a human/Claude reviewer
fills. Any feature that assumes an automated judge is off the table unless the owner
lifts this constraint.

---

## 3. How to run

- **Dir:** `scripts/book/prompts/chapterflow-v21-authored/`
- **Run:** `npx tsx src/cli.ts <command>` — `tsx` executes TypeScript directly and
  **ignores types** at runtime. Since Phase 0 there IS a tsconfig: typecheck with
  `npx tsc -p . --noEmit` (zero-error baseline, held by CI/tests — see tests/README.md).
  The repo-root Next.js tsconfig also sweeps this dir at ES2017/strict, so keep new
  code compatible with both.
- **Node:** 18+ for the pipeline; the **web app needs Node 20**.
- **State dirs:** chapters in `state/chapters/`, indexes in `state/indexes/`, name plans
  in `state/name-plans/`, QC attestations in `state/qc/`, gate reports in `state/books/`.
  Research artifacts (toc + source sidecars) in `.chapterflow/runs/<bookId>/<runId>/`
  **at the repo root** (NOT under the pipeline dir).

---

## 4. End-to-end flow (the commands)

Full CLI surface: `research, generate, generate-book, next-task, check-source,
source-v2-gate, derive-artifacts, name-plan, fanout, author-check, gate-chapter,
book-gate, qc-open-round, sweep-pack, sweep-attest, sweep-status, key-pack,
key-derive, key-resolve, qc-attest, qc-status, major-status,
major-disposition, categorize, promote-book, register-web, batch, ledger,
migrate-state, state-status, fix-chapter-ids, quarantine-book, critic, ping`.

The supported (no-API) operator loop, per book:

1. **Research → v2 source sidecars.** `next-task <bookId>` walks: bibliography
   (`toc.json`) → per-chapter `chNN.source.json` (`schemaVersion: "source-v2"` — real
   `testableFacts`, `namedExamples` with `hardSpecifics`, anchor ids) → chapter index.
   Playbook: `agent-prompts/STEP-1-RESEARCH.md`. `check-source <bookId>` validates.
2. **`name-plan <bookId> --from N --to M`** — allocates a disjoint protagonist-name
   slice per chapter (see §6). Writes `state/name-plans/<bookId>.name-plan.json`.
3. **`fanout <bookId>`** — prints one ready-to-paste authoring prompt per un-written
   chapter (title, source path, the chapter's names, the R6 anti-templating line, save
   path, self-gate command). Runs `name-plan` for you. Paste each into a Codex agent.
4. **Author each chapter** against `agent-prompts/STEP-2-WRITE-CHAPTERS.md`, then
   **self-gate**: `author-check` + `gate-chapter <file>` until `Gate verdict: PASS — 0 blockers`.
5. **`book-gate <bookId>`** — cross-chapter pattern audit (F1 reused names, BP13 stock
   phrases, skeleton drift) that per-chapter gates can't see.
6. **QC (separate Claude/Codex QC session)** with `agent-prompts/QC-SESSION-PROMPT.md`.
   In v21.1 no-api Codex QC mode (`CHAPTERFLOW_NO_API_CODEX_QC=1`), open a
   role-separated round with `qc-open-round`, run the sweep, blind manual key
   judge (`key-pack`/`key-derive`/`key-resolve`), round-tokened `qc-attest`,
   and explicit `major-disposition` for every current major. `qc-status <bookId>`
   tracks PASS/STALE/REVISE/CORRUPTION/MISSING; gate-only GREEN is never enough.
7. **`promote-book <bookId> --title … --author …`** — final gate (re-runs ship gate +
   book gate + the QC-attestation gate), auto-derives categories/tags (§7), strips
   `sourceAnchorId`, writes `book-packages/<bookId>.v21.json`. Quarantines on failure.
8. **`register-web <bookId>`** — makes it show in the reader (§8).

**`batch <manifest.json> [--run]`** is the multi-book driver: reads
`[{bookId,title,author}]`, computes each book's stage (RESEARCH/AUTHOR/GATE_FIX/QC/SHIP/
DONE), prints a work queue, and with `--run` auto-promotes+registers every book whose QC
is complete. `books.json` at the pipeline root is the live manifest.

---

## 5. The no-API QC-attestation gate (the core innovation — understand this deeply)

Because there's no automated semantic judge, the **human/Claude reviewer's verdict is
made an enforceable, un-skippable, un-stale-able gate**:

- **`src/critics/qcAttestation.ts`**:
  - `chapterContentHash(chapter)` — sha256 over the chapter's **reader-facing** fields
    (title, hook, counterintuition, keyTakeaway, tryThisNow, breakdown tiers, examples'
    scenario/whatToDo/whyItMatters, quiz prompt/choices/correctIndex/explanation, card
    front/back, implementationPlan, memorableLines). It **excludes `sourceAnchorId`** so
    the promote-time provenance strip doesn't invalidate a valid attestation.
  - `checkQcAttestation(chapter, enforce)` → blocks on `QC0.missing_attestation`,
    `QC0.not_publishable`, or `QC0.stale_attestation`.
- **`qc-attest <chapter> --verdict PUBLISHABLE|REVISE|CORRUPTION --reviewer <id>`** writes
  `state/qc/<bookId>-chNN.qc.json` (verdict + the content hash at review time + reviewer).
- **`promoteBook` (`src/promoteBook.ts`) Step 3.5** requires every chapter to carry a
  **fresh PUBLISHABLE** attestation. Edit a chapter after review → hash mismatch → STALE
  → promote blocks again → forced re-review. This is what makes "Claude reviewed it"
  trustworthy without an API.
- **The redo loop works** (verified on `rich-dad-poor-dad`): round-1 QC found systemic
  templating → REVISE → promote blocked → Codex de-templated → round-2 QC verified the
  NEW content (hash changed) → PASS → shipped. Clean.
- `src/scratch/qc-review.workflow.js` is an automated multi-agent reviewer (bar-read +
  adversarial key verification) usable when a Claude harness is available.

---

## 6. Name registry (prevents the parallel-authoring collision class)

Chapters authored concurrently (Codex agents, blind to each other) independently reuse
protagonist names (book-gate **F1**) and stock connectives (**BP13**). The registry
prevents it BEFORE authoring instead of catching it after.

- **`src/librarian/namePlan.ts`** + **`config/name-bank.json`** (**777** effective names,
  Canadian: English + French-Quebecois (ASCII) + multicultural). `planNames` deals each
  chapter a **disjoint** slice. Key policy: **names MAY repeat across books** (owner's
  call) → no cross-book exclusion → **the bank never exhausts under volume** (a fresh
  88-chapter book sees all 777). Per-book rotation (FNV-1a hash of bookId) gives different
  books different casts. Re-plan is **idempotent**: already-authored chapters carry their
  real on-disk names through; only un-authored chapters get fresh names.
- **`config/banned-connectives.json`** — stock phrases authors must avoid (BP13 guidance).
- The name extractor (`extractNamesFromText` in `libraryState.ts`) NFD-strips diacritics
  so accented names are whole, F1-visible tokens.

---

## 7. No-API auto-categorizer

- **`src/agents/autoCategorize.ts`** — `deriveCategoriesAndTags(bookId)` reads the book's
  own content (toc + chapter source notes + concept names), scores the **17 canonical
  categories** (`config/categories.json`: Psychology, Self-Help, Business, Productivity,
  Leadership, Communication, Strategy, Decision Making, Philosophy, Learning, Investing,
  Negotiation, Relationships, Behavioral Economics, Management, Innovation,
  Entrepreneurship) by keyword-stem hits, and builds tags from chapter `centralConcept`
  names. **`promote-book` auto-fills** categories/tags when not passed; `categorize
  <bookId>` previews. (The model-backed `categorizer.ts` needs the API and is unused in
  the no-API flow.)

---

## 8. Web integration (two surfaces — important distinction)

- **Static `/books` marketing browse** = `app/book/data/bookPackages.ts` (static imports)
  + generated `booksCatalog.metadata.json`. `register-web` appends a registration here via
  **`normalizeAnyPackage`** (NOT `normalizeNstdPackage` — the "C1" bug: nstd reads
  `contentVariants`, absent on v21 raw, → blank Summary; `normalizeAnyPackage` detects v21
  and routes to `normalizeV21Package` which reads `breakdown.*`). It then regenerates the
  catalog.
- **The actual in-app reader + library** = **API-backed (DynamoDB + S3)** via
  `/api/book/*`. `register-web` runs the ingest (`scripts/book/publish-single-package.ts`,
  `publishNow=true`) when AWS env (`BOOK_TABLE_NAME` / `BOOK_INGEST_BUCKET` /
  `BOOK_CONTENT_BUCKET` / `AWS_REGION`) is present; otherwise it prints the command. The
  reader detail page 404s for ALL books locally without AWS — that is by design, not a bug.

---

## 9. Gates & critics

- **`gate-chapter`** = `runShipGate` in **`src/critics/finalGate.ts`** (per-chapter ship
  gate). Severity comes from the `SEVERITY_FROM_CATALOG` map there. **The authoritative
  result is the `Gate verdict:` line + exit code**, NOT the top "Ship gate:" line.
- **`book-gate`** = **`src/critics/bookGate.ts`** (cross-chapter: F1 names, BP13 phrases,
  hook clustering, etc.).
- Critic files (`src/critics/`): `finalGate, bookGate, bookPatternAudit, quizQuality,
  quizCorrectness, sourceGrounding (SC9/SC10/SC11), sourceRealness, authoringContract
  (AC1-AC11), narrative (C8/C9/C10 + C22/C23), intraBookFieldSimilarity, supportSectionAudit
  (owns catalog ids C11-C17!), prose, pedagogy, readingLevel, register, schema, integrity,
  semantic/publishableBar (the rubric the human QC scores against)`.
- **New this session:** `C22` = `narrative.example_setting_stamping` (BLOCKER — one
  LOCATION stamped as the setting across ≥4 of N example scenes; calibrated zero-FP on the
  gold corpus; spares central concepts/entities). `C23` =
  `narrative.example_protagonist_reuse` (advisory). **`SC9` is advisory `major`** (it is
  too strict to be a blocker — it false-positives on reference-quality books).

---

## 10. The contract & prompts

`agent-prompts/`: `STEP-1-RESEARCH.md` (v2 sidecars), `STEP-2-WRITE-CHAPTERS.md`
(authoring LAW — the Bind Block + rules **R1–R6**; R6 = vary the SHAPE of each scene, the
anti-templating rule), `STEP-3-FINALIZE.md`, `QC-SESSION-PROMPT.md` (the reviewer — the
publishable-bar rubric, the hidden-key protocol, the example-slate coherence checks, and
the mandatory `qc-attest` step), `PLAYBOOK-GENERATE-A-BOOK.md` (the operator runbook),
`FIELD-PURPOSE-CONTRACTS.md`, `QC-PLAYBOOK.md`, `FAILURE-MODES.md`.

---

## 11. THE DEFINING LIMITATION + the one defect class with no gate

Under no-API, the deterministic gates cannot catch: wrong quiz keys, plausible-false
prose, and the **systemic scene-skeleton templating** — every example scene on one frame
(`"[Name] does X at [clock time] in [place]; must decide whether A or B"`) with persona
drift (one name = two people across breakdown/examples/quiz). **There is NO viable
deterministic gate for the scene-skeleton**: clock times and decision language are
legitimate and *common in clean books* — the gold reference `daring-greatly` trips a
clock+decision check MORE than the templated `rich-dad` (5/7 vs 4/9 chapters). Any such
gate nukes the gold corpus. So this class is handled ONLY by **prevention** (STEP-2 R6 +
the `fanout` prompt line) + the **semantic QC reviewer** (flagged in QC-SESSION-PROMPT as
THE most-missed defect). **Do not re-attempt a clock-time/decision deterministic blocker.**

Net: ~1 in 6 chapters needs a revision pass; every book needs a Claude QC pass. This caps
the pipeline at **supervised** mass production, not unattended. To remove the human, the
owner must either keep formalizing the QC gate or lift the no-API constraint (then
`semantic/quizKeyJudge.ts` + `publishableBar.ts` become automated blockers).

---

## 12. Calibration discipline (follow this for any new gate)

Every new deterministic check ships **shadow/advisory first**, calibrated to **ZERO
false-positives on the gold corpus** before promotion to blocker. **Gold corpus =
`daring-greatly` (ch01-07) + `start-with-why` (ch01-14)** — reference-quality books a
blocker must never flag. A verification pass this session (independent agents re-running
every command/gate) caught **3 bugs my own per-piece tests missed**: SC9's "zero-FP" was a
fragile non-reproducible 0 (it actually FPs on 16/21 gold → reverted to advisory); my new
checks **collided on catalog ids C11/C12** (already used by support-section checks → renamed
to C18/C19, which COLLIDED AGAIN with supportSectionAudit's C18-C21 and were renumbered to C22/C23 in Phase 4); and the content hash omitted `title`/`tryThisNow`. **Always run independent
verification across the gold corpus before trusting a calibration claim.**

---

## 13. Gotchas (will bite you)

- **`tsx` ignores types** → type errors only show in the IDE. When you add a `finding(id,…)`
  with a new check id, add that id to the `CriticCheckId` union in **`src/types.ts`** or
  the IDE errors (runtime is unaffected).
- **Catalog ids C11–C21 are taken** by `supportSectionAudit`. New chapter-gate checks must
  use C24+ — supportSectionAudit owns C11-C21 and narrative owns C22/C23; the check-registry test (tests/check-registry.test.ts) guards the namespace. `SEVERITY_FROM_CATALOG` keys are a JS object → a duplicate key silently wins (also guarded by the test).
- **Run resolution is artifact-aware** (Phase 1d, `src/lib/runDirs.ts`): readers take the
  NEWEST run that actually contains the requested artifact, across raw + normSlug bookId
  spellings — a "zz-…" rework dir without ch01-08 sidecars no longer hides the originals.
- **Two state dirs hazard**: repair output can land in a repo-root `state/chapters` shadow
  while gates read the subdir copy — `assertNoShadowStateDir` guards; `migrate-state`
  reconciles.
- **Branch/repo state is messy.** Pipeline lives on `main` (merged from `v21-redesign`).
  Web work lives on `dashboard-real-data` / `deploy/prod-readiness` with large uncommitted
  reorgs. The reader migrated to `/api/book/*` (DynamoDB). When committing, stage explicit
  paths (`git commit -- <file>`) — `git commit` after `git add` will sweep in whatever else
  is staged.

---

## 14. Open work (highest-leverage first)

1. **Promote the AC1–AC11 authoring-contract critics** (concept-as-actor, templated loops,
   echo-template, word-salad) from advisory to blockers — they're the only content/JOB-level
   gates. Needs a **codified calibration harness** (the zero-FP claim is only in comments)
   + (CLOSED Phase 1a: `promote` now runs the AS5–AS12 cross-chapter checks via `src/critics/intraBook.ts`.)
2. **Reduce the ~18% revision rate / reviewer miss rate** — e.g. a mandatory second
   independent QC pass, or sharpen R6 prevention. This is the throughput ceiling.
3. **Finish content**: `rework` is ~25% authored (ch08 missing, v1/v2 sidecar mix).
4. **The repo hygiene**: large uncommitted reorgs on the web branches; reconcile them onto
   the new main.

---

## 15. Quick map

```
src/cli.ts                      all commands (the switch)
src/critics/finalGate.ts        gate-chapter (SEVERITY_FROM_CATALOG, runShipGate)
src/critics/bookGate.ts         book-gate (F1/BP13 cross-chapter)
src/critics/qcAttestation.ts    the no-API QC gate (hash + check)
src/critics/narrative.ts        C22 setting-stamping, C23 protagonist-reuse, example checks
src/critics/sourceGrounding.ts  SC9/SC11 source grounding + provenance
src/critics/semantic/           publishableBar (rubric), quizKeyJudge (API-gated, unused)
src/librarian/namePlan.ts       name-plan allocator
src/agents/autoCategorize.ts    no-API categorizer
src/promoteBook.ts              promote (gates + QC gate + strip + write package)
src/next-task.ts                inline-operator "what's next" ladder
config/name-bank.json           777 Canadian names
config/categories.json          17 canonical categories
agent-prompts/STEP-2-WRITE-CHAPTERS.md   authoring law (R1-R6)
agent-prompts/QC-SESSION-PROMPT.md       the human/Claude reviewer
agent-prompts/PLAYBOOK-GENERATE-A-BOOK.md  the operator runbook
book-packages/<bookId>.v21.json  the shipped package
state/{chapters,indexes,name-plans,qc,books}/  pipeline state
.chapterflow/runs/<bookId>/<runId>/  research artifacts (REPO ROOT)
```
