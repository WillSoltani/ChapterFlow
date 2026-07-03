# V24 A+ PLAN — outcome A+, process A+ (2026-07-03)

**Commissioned by the owner after the first v24 production run (the-power-of-moments, published
`aec0ecd6e`).** Goal: upgrade the pipeline so the NEXT book earns **A+ on outcome** (content quality)
and **A+ on process** (efficiency, correctness, honesty, hygiene). This is a PLAN ONLY — nothing here
is implemented. Implementation is ultracode-orchestrated after owner approval; validation run follows.

**Evidence base:** 10-scout read-only investigation (2026-07-03, run `wf_29239a72-e30`): package
anatomy, app contract, publish path, debris inventory, run forensics (all 7 logs + session-counter
arithmetic), review/acceptance code + codex rollout archaeology, evidence machinery, rename blast
radius, content forensics (v24 vs shipped bytes), Phase-6 inputs. Scout reports:
session scratchpad `aplus/*.md`.

**Owner decisions already locked (2026-07-03):**
1. Slim-sweep ALL 137 catalog packages (not just new publishes).
2. DELETE all current debris — POM ~55MB (incl. `_regen-backups` 46MB), TII ~49MB sandbox state,
   root strays incl. untracked `pmbok-guide.v21.json`.
3. RENAME the pipeline dir → `scripts/book/prompts/chapterflow-v24-author-pipeline` AND rebrand the
   npm package → `@chapterflow/v24-author-pipeline`.
4. Validation book = **execution** (59.6 owner-score, CAPPED, 10 chapters) — doubles as Phase-6 pilot #1.

---

## §1 FORENSICS — what the first run's logs actually say (corrections included)

### 1.1 Honest cost accounting (CORRECTION)
The earlier retrospective reported "~35 sessions". **The forensically counter-proven number is 102
production sessions** (session-id suffixes reconcile the ledger with zero slack; 2 unlogged
deterministic gate-repair sessions proven by counter arithmetic):

| Type | Count |
|---|---|
| Whole-chapter writer attempts | 37 |
| Per-chapter review readers (incl. 3 quote-verify respawns) | 47 |
| Acceptance book readers (4 rounds × 2) | 8 |
| keyA/keyB derivations | 4 |
| Sweeps | 2 |
| Major-repair shards | 2 |
| Deterministic gate-repairs (HIDDEN — never logged) | 2 |
| **Total** | **102** |

Wall-clock ≈ 4h00m. Writer session ≈ 19 min; readers 2–5 min. Overhead = **58 sessions (57%)**.
Ideal with the fixes in this plan = **44**; absolute floor 29–32.

**Waste ranked:** #1 the 4b re-entry after the bar-84 miscalibration halt (22 sessions, incl. 3
PASS→FAIL review flip-flops on byte-identical content); #2 the 4c re-entry + dead 4b evidence after
one sweep-submission schema rejection (19 sessions); #3 tellRate/ease first-draft failures (17 writer
sessions ≈ 5.4 session-hours — the #1 wall-clock loss; first-draft preflight pass rate was 10/25 = 40%).

### 1.2 The "reader hallucination" was OUR bug (CORRECTION)
The acceptance FAIL claim "ch05 Q9 missing from the combined key" was previously called a reader
hallucination. Root cause found: **`renderBookSampleDoc` joins with no trailing newline**
(`evalBookProxy.ts:83`) → `wc -l` reports 756 for a 757-line file → readers that chunk with
`sed -n '521,756p'` never see line 757 — which is exactly `CHAPTER 5 Q9: b`, systematically the last
key row of every sample doc. **Three different readers in 3 of 4 acceptance rounds independently made
the same byte-false claim.** Collateral: round-1's version steered a wasted regen of innocent ch05
(which had PASSed review 86.3), and round-2's version co-caused the phase-4 halt. Bitter footnote:
the machine held disproof in-band the whole time — reader-2's own keyCheck derived 36/36 including
ch05 Q9 — and composed the FAIL anyway.

### 1.3 Review nondeterminism
Run-4b re-reviews flip-flopped **3/12 chapters PASS→FAIL on byte-identical bytes** (ch06 87.9→87.6
ship=false, ch08 89.7→82.2, ch10 87.9→85.3) → 3 unnecessary whole-chapter regens + re-reviews.
Single-reader verdicts near the bar are coin-flips; unchanged bytes must not be re-rolled.

### 1.4 Content residuals in the published POM (measured, NEW vs OLD-shipped bytes)
- **Sameness (reader complaint verified; v24 is MORE uniform than OLD):** 10/12 chapters share one
  24h-challenge skeleton ("In/Within the next 24 hours…"; OLD max 3/12); hooks claim-type 10/12;
  fastRead openers claim-type 11/12; `tryThisNow` starts "Pick" 6/12; section length sd halved.
- **Tell whack-a-mole:** unique-LONGEST key fixed 42%→4%, but unique-SHORTEST key minted 21%→**51%**
  (chance 33%). `score.py` measures only unique-longest, so the owner instrument reads it as solved.
- **Echo-tell:** key strictly-most-prose-echoed 46%→63%; 4/108 keys are verbatim ≥5-content-token
  sentence lifts (one from a review card — a surface `score.py` doesn't even scan). Zero-FP
  deterministic gate exists at the ≥5-token + all-distractors-<4 threshold (4/4 flagged = true lifts).
- **Case-anchored stems:** 43% of stems name a chapter case verbatim (OLD 28%) — recognition cue.
- **Practice menu-ification:** exact quoted scripts 6%→0%, "a, b, or c" menus 12%→27%, numeric
  specificity 67%→54% (though imperative-led 23%→40%). Menus read as template, not instruction.
- **Churn driver (MEDIUM):** cross-chapter scaffold spread — "the next 24 hours" in 7/12 chapters;
  16 3-grams + 2 4-grams repeat across ≥4 chapters (OLD 11 + 0).

### 1.5 Package bloat (the owner's "many lines on top")
`productionManifest` = **75,021 B on disk = 21.6%** of the package; metadata occupies lines 26–1644 of
5,526 (29.4% of lines) before the first chapter. **Zero consumers** in app/, components/, lib/,
score.py. Worse: the raw file is statically imported into the **client JS bundle** and uploaded
verbatim to S3 — shipping internal run paths with UUIDs, `state/` layout, QC reviewer ids, and a
215-file pipeline code/prompt/config sha-inventory to anyone who downloads the bundle
(information-disclosure, not just bloat). Only 2 of 137 packages carry it (POM, TII — both v23-promoted);
pre-v23 books are manifest-free. Additional dead-in-distribution fields: `examples[].namedCaseIds`,
`examples[].sourceFactIds`, `quiz.questions[].depthLevel`, `memorableLines[].location/.why`,
`chapters[].schemaVersion`, `implementationPlan.title` (~62KB total ≈ 18%).

### 1.6 Publish-path facts that pin the design
- Slimming MUST happen at **promote time**: publish-to-live does a raw sha256 byte-compare sandbox
  vs dest (`publishToLive.ts:147-151`) and the verifier recomputes the manifest from on-disk state.
- `publish-after-qc --commit` commits **sandbox-nested paths** into the outer repo (the pollution
  source); `publish-to-live` never pushes; registration probe checks the WRONG path
  (`lib/bookPackages.ts`; real registry `app/book/data/bookPackages.ts:131`).
- `pushWithRebase` REBASES local commits on rejection — unsafe for our merge-topology main.
- `prune-book-state` has a live bug: its stem-matcher would delete a book's **held autopilot lock**;
  its published-gate keys on the SANDBOX package being tracked (never true in the publish-to-live flow).
- **No S3 anywhere in the publish chain** (verified by exhaustive grep; the only AWS reference is an
  env-gated register-web ingest shell-out that never fires).
- `createdAt` preserves the run-creation timestamp across re-promotes (`promoteBook.ts:636`) — the
  owner's "June 30" confusion.
- Evidence is round-bound because packHash embeds `roundId`+`createdAt`; conductor re-entry re-derives
  everything (verified live: rounds `…005135` vs `…010922` have 11/12 equal contentHashes, 12/12
  different packHashes). Acceptance is memory-only (`autopilot.ts:978`) — the #1 re-entry trigger.
- Acceptance reader outputs are NOT durably persisted (sessions.jsonl truncates finalMessage to 500
  chars and captured only "```"); full outputs survive only in `~/.codex/sessions` rollouts.

---

## §2 WORKSTREAMS

Every item: WHAT / WHY (evidence) / HOW (design) / BLAST RADIUS / WORTH-IT / TESTS.
Merge protocol unchanged: worktree branch per item-group + adversarial verifier + my review +
`merge --no-ff` to local main; full pipeline suite after every merge with failure names byte-identical
to the canonical env-baseline; root `npm run verify` green.

### WS0 — Rename + workspace hygiene (FIRST, one commit + cleanup pass)
**R1. Rename** `"scripts/book/prompts/chapterflow-v23-compiler-pipeline 2"` →
`scripts/book/prompts/chapterflow-v24-author-pipeline` (same nesting depth — `chapterPaths.ts:56`
hardcodes MONOREPO_ANCESTOR six levels up).
- `git mv` (532 tracked renames) + exactly 2 functional edits:
  `scratch/calibrate-cast-containment.ts:143` (embedded old path) and `tests/autopilot.test.ts:1386`
  (basename regex gains `|24-author-pipeline`).
- Rebrand npm package in lockstep (owner-approved): `package.json` + `package-lock.json` (2 fields) +
  `tests/package-contract.test.ts:9` → `@chapterflow/v24-author-pipeline`.
- Optional cosmetics in same commit: `chapterPaths.ts:24` comment; rename
  `tests/compiler-pipeline.test.ts` + its 4 comment mentions; fix `scratch/gen-rubric-parity.py:17`
  (stale wt-v23-p01 path).
- Verify: repo-wide `git grep` for the old name = 0 functional; root `npm run typecheck` (sweeps 659
  pipeline files); pipeline `npm test` (env-baseline byte-identical); `cli.ts doctor`; v21 workspace
  `pipeline:typecheck/test` untouched.
- Follow-ups: update CLAUDE.md "Where things live"; update the 5 `~/.claude` memory files naming the
  old dir.
- Preconditions: no live pipeline process (verified — the TII lock pid 57274 is dead); all pipeline
  branches merged (verified).
- BLAST RADIUS: LOW (root CI/tsconfig/workflows/gitignore have zero path references; iOS branch's one
  v23 file is content-identical to main → merge-ort converges clean). WORTH-IT: YES — kills the
  space-quoting hazard class permanently and gives the owner the "v24 directory" they expected.

**R2. Worktree/branch/lock cleanup:** `git worktree remove` the 15 `wt-v23-p*` (branches merged;
dirty only with untracked state); delete merged `v24/*` (12) + `fix/v23-p*` branches; delete the stale
`state/autopilot-locks/the-intelligent-investor.lock`. WORTH-IT: YES (hygiene, prevents future
gen-rubric-parity-style stale references).

### WS1 — Distribution package v2 (slim) + catalog sweep + contract tests
**K1. Target shape = the classic v21 shape** (exactly what pre-v23 books already ship):
`{schemaVersion, packageId, createdAt, contentOwner, book{bookId,title,author,categories,tags[,edition]}, chapters[…slim]}`.
- `packageId` returns to human-readable `<slug>-v21-<epochms>` (a sha256 IS a hash — owner said no
  hashes; server adapter derives its own idempotency key when needed).
- `createdAt` = **promote-time stamp whenever contentId changed**; preserved only on byte-identical
  re-promotes (fixes the "June 30" confusion; Phase-5 item c).
- The whole `productionManifest` moves OUT of the package into a **state-side sidecar**
  `state/books/<bookId>.production-manifest.json` written at promote. All PPKG.* verification
  (contentId, payloadHash, loose-state compare, evidence chain) reads the sidecar instead of the
  embedded field. Package bytes = content only.
- WHY: 75KB/21.6% dead weight in every client bundle + S3 fetch; leaks internal paths/session ids/code
  inventory; zero consumers (§1.5).

**K2. Chapter-field slimming at promote** — extend `stripInternalFields`:
- Key-name deep strips (unique names, existing mechanism `readerContent.ts:7-21`):
  `namedCaseIds`, `sourceFactIds`, `depthLevel`.
- **Path-aware strips** (key names too generic for deep removal): `memorableLines[].location`,
  `memorableLines[].why`, `implementationPlan.title`, `chapters[].schemaVersion` (per-chapter only —
  `examples[].title`/`chapters[].title` must survive; `examples[].whyItMatters` is a different key).
- **KEEP `quiz.questions[].bloomsLevel`** — consumed by the owner scoring instrument
  (`score.py:86`, transfer metric); dropping it silently biases every future book score.
- KEEP `quiz.passingScorePercent` (divergent adapter defaults 70 vs 80 if absent) and `examples[].tags`
  (drives the reader's work/school/personal filter, `bookChapters.ts:422-434`).
- Bump `READER_CONTENT_STRIP_RULES_VERSION`; never touch the frozen `V2_EXCLUDE_DEEP` attestation sets
  (`qcAttestation.ts:164-172`).

**K3. Verifier/bridge updates:** `verifyProductionPackage` reads the sidecar manifest; keeps ALL
fail-closed PPKG checks (payload mismatch, loose-chapter mismatch, evidence chain) — only the manifest's
storage location changes. `publishToLive` byte-compare unchanged. `promoteBook` writes package + sidecar
transactionally (extend the existing `_transactions` journal).

**K4. App-contract tests (root suite, permanent):** for EVERY `book-packages/*.v21.json`:
normalize through the client adapter → assert 3 non-empty tiers, quiz integrity (correctIndex in range,
≥2 choices, unique ids), passingScorePercent in 50–100 when present, `schemaVersion` present (its
absence silently misroutes to the legacy normalizer → empty reader — §app-contract);
assert **NO forbidden fields anywhere** (productionManifest, namedCaseIds, sourceFactIds, depthLevel,
memorableLines.location/why, per-chapter schemaVersion, implementationPlan.title, any `*SourceAnchorIds`,
`authoring`, `planSpec`). Pipeline-side mirror test: promote output deep-key allowlist == keep-list
exactly. These tests are the safety net for K5 and for every future publish.

**K5. One-time catalog sweep (owner-approved: all 137):** root script `scripts/book/slim-book-packages.ts`
— parse → apply K1/K2 drops wherever present → stable stringify (indent-2) → rewrite; regenerate
`booksCatalog.metadata.json`; run K4 + full root verify; ONE commit. POM + TII are re-emitted through
the new promote (their state still exists pre-cleanup) so package/sidecar/hashes stay consistent;
the other 135 are script-slimmed (they have no manifests — only small nested dead fields).
- BLAST RADIUS: rewrites tracked JSON catalog-wide; provably behavior-neutral via K4 + existing
  bookPackages tests; formatting normalizes once. S3 note: the S3 copies refresh at the next run of
  `upload-book-packages-to-s3.ts` (deploy-time step, NOT part of publish — grading normalizes either
  way, so no runtime breakage in the interim). WORTH-IT: YES — kills the manifest leak from the bundle,
  uniform schema forever, and K4 locks the contract.

### WS2 — `publish-final`: the one-verb publish (commit → push → sync → cleanup)
**F1. New verb** `publish-final <book> [--dry-run|--keep-debris]` (`src/publish/publishFinal.ts`),
wired into autopilot READY for the author arch (replacing `publish-after-qc` there — which commits
sandbox-nested paths, the repo-pollution source; publish-after-qc remains for compiler/legacy books).
Steps, all fail-closed:
1. **Preflight:** package promote-verified (sidecar-aware K3); no live conductor lock for the book;
   `git fetch origin` + require clean tracked tree at the touched paths.
2. **Bridge:** copy sandbox→root, independent sha256 compare (unchanged); **registration**: probe the
   REAL registry `app/book/data/bookPackages.ts` (fixes `publishToLive.ts:156` — Phase-5 item d);
   if unregistered, append-register into the OUTER registry (register-web logic re-pointed) ;
   regenerate the OUTER `app/book/data/booksCatalog.metadata.json`.
3. **Commit:** pathspec commit of exactly {package, catalog metadata, registry-if-changed} with the
   standard trailer.
4. **Push with MERGE loop** (NOT `pushWithRebase` — rebasing main flattens our merge topology):
   `git push`; on rejection `git fetch` + `git merge origin/main` (never force, never rebase), retry ×3.
5. **Post-push sync (owner requirement):** `git fetch origin` → if behind, `git pull --ff-only` →
   assert `git rev-list --left-right --count origin/main...main` == `0 0`; structured error otherwise.
6. **Cleanup (owner requirement)** — only after 5 succeeds: run F2 for the book.
7. **Report:** what shipped (sha, size, overhead %), commit, sync state, debris deleted (files/bytes),
   session cost table (WS6).
- **No S3 anywhere** — codified: the flow contains no AWS calls (static assertion test greps the
  publish modules for aws-sdk/S3 imports = 0). Content reaches users via repo push + app deploy.

**F2. Debris-cleanup engine** (`src/publish/cleanupBookDebris.ts`) — exact-path manifest builder per
book, from the debris-inventory taxonomy: `state/{books/<book>*, chapters/<book>-*, qc*/<book>*,
briefs/<book>*, book-design/<book>*, provenance/<book>-*, plans/<book>-*, indexes/<book>.json,
reviews/<book>/, autopilot-logs/<book>/, qc-rounds/<book>.*, qc-packs/<book>/, qc-preflight/<book>/,
_regen-backups/<book>*}`, `.chapterflow/runs/<book>/` + `source-verify-<book>.md`, `.tmp/*<book>*`,
sandbox `book-packages/<book>.v21.json`, `scratch/review/<book>/` + `scratch/eval-proxy/*<book>*`,
repo-root shadow `state/**<book>**`; **line-prune** (never delete) the shared ledgers
`state/gate-attempts.json` + `state/metrics/qc-finalizations.jsonl`.
Safety rails (each a test):
- **Abort if any matched path is git-tracked** (report instead of delete).
- **Structural hard-exclusion** of `scripts/book/prompts/chapterflow-v21-authored/**` (gold corpus,
  2,813 tracked files) — excluded at the tool level, not by convention.
- **Exclude `state/autopilot-locks/`** entirely + fix the existing `pruneBookState.ts:104` stem-match
  bug that would delete a HELD lock.
- Dry-run prints the full manifest table; real run requires the F1-step-5 sync proof.

**F3. One-time purge (owner-approved):** run F2 for POM + TII; plus root strays
(`book-packages/pmbok-guide.v21.json`, `book-score-summary.json`, empty shadow `state/`, root
`scratch/`); plus the one-off scratch drivers (keep the 4 tracked calibration scripts + 5 reusable
panel/phase drivers); plus the sandbox register-web debris: delete sandbox `app/` **together with both
`__chapterflow-registry-anchor.v21.json` anchors** (the tsc-linked set) — then root `npm run typecheck`
must pass without anchors, permanently retiring that hack (publish-final registers OUTER-side now, so
the sandbox registry never regenerates). Reclaims ≈ 110MB / ~5,700 files.

### WS3 — Review/acceptance integrity (the trust layer)
**Q1. S0b — trailing newline** on every reader-facing doc (`evalBookProxy.ts:83` + audit
`renderChapterReaderDoc`, key-judge doc, sweep doc; enforce centrally in `writeReviewDoc`). One line;
removes the exact trap that generated every observed structural "hallucination" (§1.2).

**Q2. S0 — doc-integrity postcondition** before any reader spawns: for each sampled chapter, count of
`^Q\d+\.` question lines == `chapter.quiz.questions.length` == count of `^CHAPTER <n> Q\d+: [abc]$`
key rows; doc ends with newline. Mismatch = halt(infra). Makes any "key omits QN" claim provably a
reader error; catches real render truncation no panel reliably would.

**Q3. S3 — structural-claim screen** in `adjudicateBookReview` (+ chapter-level `adjudicateReview`):
on gate FAIL, regex the rationale fields for key-coverage claims (chapter+question extraction), machine-
recount from docText; **only on positive byte-level disproof of a specifically named row** → mark the
vote invalid (`structural claim disproven: ch5 Q9 present (line 757)`) → the existing attempt loop
respawns a replacement reader. If the recount CONFIRMS the claim → halt(infra) (machine truth, not a
vote). Never fires on fuzzy/unparseable claims. Every screen decision logged to the acceptance record.

**Q4. validCount quorum:** accept additionally requires `validCount >= AUTHOR_BOOK_READERS` — today a
book can be accepted on ONE valid reader (`composeBookVerdict` has no floor). Pure strengthen; also the
prerequisite that makes Q3's invalidation weaken-proof.

**Q5. 3-reader acceptance** (`AUTHOR_BOOK_READERS` 2→3): median-of-3 clips a single outlier composite
(round-2's 79.0 dragged the mean to 80.3), true majority gate (2-reader 1P/1F composes PASS — FAIL
required unanimity), churn mode becomes meaningful (2-reader ties resolve by insertion order today).
Restores parity with the owner-instrument replica (its CLI default IS 3; compose.py presupposes an odd
panel; the 80-bar was calibrated on 3-reader reads). Cost +1 reader/round ≈ +3–4% of run sessions, ~0
wall-clock (parallel pool). Post-switch parity check: re-run the shipped-POM + atomic-habits control
reads once; expect composites within ±1 of the 2-reader-era calibration anchors.

**Q6. Durable acceptance-reader records:** write each adjudicated reader result + composed verdict to
`state/reviews/<book>/acceptance.<roundLabel>.json`; fix `sessions.jsonl` finalMessage capture (stores
only "```" today) — persist a meaningful head + full-output sidecar. Forensics currently depend on
`~/.codex/sessions` rollouts the repo doesn't control.

**Q7. Complaint-targeting guard:** `mapBookComplaintsToChapters` may only target chapters named by a
still-VALID (post-Q3) FAIL reader — a disproven structural claim can no longer steer a regen at an
innocent chapter (round-1 burned ch05's regen budget exactly this way).

### WS4 — Efficiency: carry-forward (kills the 57% overhead class)
**E1. Durable acceptance:** derive `authorBookAccepted` from the persisted fresh PUBLISHABLE
attestations carrying `dimensions.bookAcceptance=true` (they are already content-bound and durable)
instead of the memory-only flag (`autopilot.ts:978`) — removes the #1 re-entry trigger (a fully
accepted book re-entering the conductor goes straight to READY, 0 sessions).

**E2. Review-clears ledger** (P09 pattern, `sweep.ts:826-925` as the template): append-only per-review
records keyed by content (`state/reviews/<book>/ch<NN>.<contentHash>.review.json` history + materialized
`<book>.review-clears.json`); extend `ChapterReviewV1` with `bar`, `docHash` (sha256 of the exact
rendered reader doc), `hashVersion`, `reviewedAt`. `doAuthorReview` reuses a review iff ALL match at
reuse time: contentHash(v2) + docHash + bar + schemaVersion, `pass && valid`, reviewer ≠ the chapter's
author session. NEVER carry book acceptance (churn is cross-chapter; it re-runs — 3 cheap sessions).
Persist per-chapter consumed-regen counts so `AUTHOR_REGEN_CAP` survives re-entry (today the in-memory
set silently resets budgets). Effect measured on POM: −24+ review sessions and −3 flip-flop regens
across the 3 entries.

**E3. Per-chapter key-evidence production** (zero promote-side changes): in `runKeyJudgeEvidence`,
compute the stale-chapter subset via the existing per-chapter `checkManualKeyJudge`; `writeKeyPacks`
over that subset only (already accepts subsets, `manualKeyJudge.ts:174`); both key readers derive only
those; `resolveManualKeyJudges` already stitches newest-round-per-chapter (`derivationForChapter`).
Kills the observed all-or-nothing re-derivation of 11 unchanged chapters because 1 changed.

**E4. Key-evidence-clears ledger + promote-side reverification:**
`state/qc/<book>.key-evidence-clears.json` with `{contentHash, sourceHash, answerKeyHash (NEW: canonical
[{prompt,choices,correctIndex}] sha), packContentKey (pack projection MINUS roundId/createdAt), roundId,
keyASessionId, keyBSessionId}`. The ledger is a derived cache, NEVER the evidence: promote acceptance
reverifies the underlying round-token-anchored derivation files, recomputes the pack projection from
CURRENT bytes, and hard-enforces keyA≠keyB≠author (NOT env-gated). Proof-obligation tests T1–T13
(mutate choice/correctIndex/prose → invalidate; delete ledger → rebuild-or-fresh; tamper ledger →
reverify catches; partial-round strand → subset re-derive; end-to-end zero-session promote on full carry,
block on any flipped byte).

**E5. Sweep completeness:** persist REJECTED sweep submissions as non-granting advisory history (round-1's
REVISE read vanished entirely — no record, no corroboration value); keep the b7 format-retry.
Expected combined effect (E1–E5): byte-identical re-entry 15–18 sessions → **0**; one-chapter-changed
re-entry → ~4.

### WS5 — Write-quality levers (the outcome A+ engine)
**W1. Base-card HOUSE STYLE rules** (the author card in `authorRun.ts` — these exist only in the RETRY
card today, which is why 60% of first drafts burned a 19-minute retry):
1. *Distractor parity:* every distractor as substantial as the key; the key must be neither the uniquely
   longest NOR uniquely shortest choice (symmetric — §1.4's whack-a-mole lesson baked into the prompt).
2. *Key paraphrase:* the keyed answer never reuses ≥5 consecutive content words from the chapter
   (including review cards and the implementation plan).
3. *Practice concreteness:* each tryThisNow/24h-challenge = ONE action with a number or timebox AND the
   exact sentence to say or exact object to touch; NO "a, b, or c" option menus.
4. *Plain first draft:* write to ease 72–84 from the first sentence (3 chapters also failed ease outright).
Keep the card ≤ ~15k chars (measure; it's 13k today). Target: first-draft preflight pass 40% → ≥70–80%
(≈ −10–17 writer sessions ≈ −3–5 session-hours per book).

**W2. Preflight additions** (deterministic, calibrated):
- *Echo-tell gate (per question):* key shares a ≥5-contiguous-content-token verbatim n-gram with chapter
  prose while all distractors <4 → FAIL; prose surface INCLUDES reviewCards + implementationPlan
  (score.py's surface misses card lifts — ours must not). Measured FP ≈ 0 (4/4 true lifts on POM; ≥4
  threshold admits canonical-principle FPs — stay at ≥5).
- *Symmetric tell check (per chapter):* no length-class (uniquely-longest OR uniquely-shortest) may hold
  for the key in ≥5 of 9 questions. Calibrate on the corpus top-5 before enforcement.
- *Practice floor (per chapter):* tryThisNow OR 24h-challenge contains (digit|number-word|timebox) AND
  an imperative opener (near-zero FP; catches abstract drift only).

**W3. Reader-budget additions CHB6–CHB9** (book-level, shadow → 17-book-style zero-FP calibration →
enforce; the B3 playbook):
- CHB6 opener-class budget: hook/fastRead opener class ≤ 2/3 of chapters.
- CHB7 scaffold + phrase spread: normalized first-4-words family of tryThisNow/24h/weeklyPractice ≤ 4/12;
  no content 4-gram in ≥ 4/12 chapters (whitelist the book's quoted terms of art from the source packet).
- CHB8 tell-distribution bands: key-uniquely-shortest 20–45%, key-uniquely-longest ≤40%,
  key-most-prose-echoed ≤55%, case-anchored stems ≤30%.
- CHB9 practice budgets: option-menu items ≤15%; ≥3 chapters carry an exact quoted script.
NOTE (disclosed): the just-published POM v24 would FAIL CHB6–CHB8 — that is the point; these budgets
exist so no future book ships with §1.4's residuals. POM's own re-regen is a Phase-6 wave-2 decision.

**W4. Brief-level rotation (prevention-first — the core v24 lesson):** `compileChapterBriefs` deals each
chapter an opener type (question/scene/claim/statistic rotation), a distinct 24h-challenge frame, and a
practice-shape assignment — disjoint across chapters like cast/cases already are; brief gate asserts
the rotation fields present + disjoint. Budgets (W3) become the backstop, not the mechanism.

**W5. Owner-instrument gap (flag only, NOT ours to edit):** `score.py`'s `distractor_tell` measures only
unique-longest and its prose surface omits review cards — after W1–W3 the pipeline self-measures the
inversion and echo, but the owner's instrument will read "solved" regardless. Recommend a separate
owner-approved patch to the book-score skill later; out of scope here.

### WS6 — Telemetry & honest accounting (the process A+ backstop)
**T1. Cost report at READY/HALT:** the conductor prints + persists
(`state/autopilot-logs/<book>/cost-report.json`) the per-phase session table (by type), retries by
cause, carry hits/misses, evidence rounds, wall-clock. The §1.1 table becomes a machine artifact, not
an archaeology project. **Invariant: logged sessions == session-counter total** — the 2 "hidden"
gate-repair sessions get explicit log lines; any mismatch is printed as an error.
**T2. Run manifest:** pin + record control SHA, beat-shipped composite, bar, reader counts, package
sha/size/overhead% at publish.
**T3. Session-record fix** (with Q6): full final messages durably stored.

### WS7 — Phase-6 catalog regen policy (owner-paced)
**Prereqs:** WS3+WS4+WS5 landed; **commit `baseline.json`** (the only owner-score record — currently
untracked with eval artifacts already lost to /private/tmp cleanup); control-read automation: when a
shipped tracked package exists, the acceptance harness auto-runs the 3-reader control read on the
git-pinned shipped bytes and sets beat-shipped internally (no env-var juggling; pin recorded via T2).
**Pilot (8 books, in order):** execution (59.6, 10ch — Wave-6 validation book), measure-what-matters
(46.8, 21ch), the-12-week-year (58.0, 21ch), extreme-ownership (62.1, 13ch), deep-work (66.5 PASS, 9ch —
first meaningful beat-shipped binding case), the-one-thing (66.6, 18ch), grit (68.5, 13ch),
you-cant-hurt-me (71.0, 11ch). ≈445 sessions post-fix (estimator: 9 + 3.2×chapters ±25% all-in).
**Deferred to wave 2:** indistractable (30ch) + ego-is-the-enemy (26ch) — run the expensive books only
after ~5 clean v24 books prove the economics; then the-pyramid-principle, the-year-of-less, essentialism,
zero-to-one. **Policy:** worst-composite-first modulated by chapter count; concurrency 1; per book:
pin SHA → control read → `book-autopilot <slug> --author --regen --no-publish` → owner-instrument check
on READY → `publish-final` (commit+push+sync+cleanup) → refresh + commit baseline.json.
Effective bar per book = max(80, shipped-control composite), conjunctive with gate + churn.

### WS8 — Validation run: `execution` (owner-selected)
End-to-end through EVERYTHING above: fresh research (first-ever v24 exercise of it) → briefs with W4
rotation → writers on the W1 card → W2 preflight → gates → budgets incl. CHB6–9 → reviews (3-reader,
Q1–Q7, E2 carry armed) → acceptance (auto control read) → evidence (E3–E5) → READY + T1 cost report →
`publish-final` (slim package, commit, push, 0/0 sync, auto-cleanup, report). Owner reviews the book +
both scorecards. Only after this: Phase-6 books 2–8.

---

## §3 SEQUENCING (waves; each wave = branch(es) + adversarial verify + merge + suite)

| Wave | Content | Depends on |
|---|---|---|
| 0 | WS0 rename + hygiene (R1, R2) | — |
| 1 | Quick correctness: Q1 S0b, Q2 S0, Q3 S3, Q4 quorum, Q5 3-readers (+parity check), Q6/T3 records, prune-lock bugfix | 0 |
| 2 | WS1 package v2: K1–K4 code+tests, K5 sweep commit (incl. POM/TII re-promote via sidecar promote) | 0 |
| 3 | WS2 publish-final: F1 verb + F2 engine + autopilot wiring + F3 one-time purge | 2 |
| 4 | WS4 efficiency: E1–E5 (T1–T13 proof tests) | 1 |
| 5 | WS5 quality: W1 card, W2 preflight, W3 budgets (shadow→calibrate→enforce), W4 brief rotation + WS6 telemetry | 1 |
| 6 | WS8 validation run on `execution` + A+ scorecards + owner review | 1–5 |
| 7 | WS7 Phase-6 pilot books 2–8 | 6 + owner GO |

Waves 2/4/5 are internally parallelizable (different modules); merge order within a wave is flexible;
suites gate every merge. Estimated build effort: waves 0–5 ≈ 1–2 days of orchestrated agent work;
wave 6 ≈ 1 conductor run (~2.5–3.5h wall-clock at the post-fix model).

## §4 TEST MATRIX (what must be green before wave 6)
- Root `npm run verify` incl. NEW K4 contract tests over all 137 packages.
- Pipeline suite: failure names byte-identical to the canonical env-baseline after EVERY merge
  (baseline rides through the rename; count reconciliation on every test edit — the b7 lesson).
- K5 sweep: byte-diff report (only expected fields removed; chapter content byte-identical), K4 green
  pre- and post-sweep, catalog metadata regenerated deterministically.
- Promote goldens: legacy/compiler paths byte-identical (existing cross-version golden chain extends);
  author-path promote emits slim package + sidecar; verifier round-trip on both.
- publish-final: dry-run on a fixture book (plan table correct); push-loop race test (simulated
  origin advance → merge not rebase → 0/0 assert); cleanup dry-run manifest == debris-inventory rows;
  tracked-file abort; gold-corpus structural exclusion; lock exclusion.
- WS4: T1–T13 evidence tests + review-ledger never-weaken suite (bar/docHash/hashVersion mismatch →
  fresh review; reviewer==author → reject; regen-cap persistence).
- WS3: S0 postcondition unit tests (truncated doc → halt); S3 screen tests (disproven claim →
  invalid+respawn; confirmed claim → halt; fuzzy claim → no-op); quorum test.
- W2/W3 calibration artifacts: zero-FP runs over the corpus top books + POM v24 (expected: POM fails
  CHB6–8 — documented as intended).
- Static: no-AWS assertion on the publish modules; repo-wide old-dir-name grep = 0.

## §5 RISKS & ROLLBACKS
- **Strip-version bump invalidates previously-promoted sandbox packages** → K5 re-promotes POM/TII in
  the same wave; verifier accepts only sidecar-promoted packages going forward. Rollback: revert wave-2
  merge (package shape is additive-removal; old packages still parse).
- **Catalog sweep regression** → K4 contract tests + full root suite pre-merge; single revertable commit.
- **3-reader bar drift** → parity re-check anchors (shipped-POM 80.0, atomic-habits 80.2) before any
  Phase-6 run; bar stays 80 unless anchors move >1.
- **Budgets over-fire on future books** → shadow-first with calibration reports; enforce only at
  zero-FP on the reference corpus; `CHAPTERFLOW_BUDGETS=advisory` escape (same pattern as P08 scout).
- **Carry ledgers weaken promote** → ledgers are caches; promote reverifies underlying round-anchored
  artifacts; T1–T13 are merge-blocking.
- **Cleanup deletes something precious** → exact-path manifests, tracked-file abort, structural
  gold-corpus exclusion, dry-run default, only-after-0/0-push, `--keep-debris` escape.
- **Push races with the iOS session** → merge-loop (never rebase/force) + post-push 0/0 assert + retry.
- **Rename mid-flight collisions** → no live processes (verified), all branches merged; merge-ort
  handles directory renames for any future branch.

## §6 EXPLICIT NON-GOALS
No S3 in the publish flow (deploy handles S3 separately). No live-app deploy in this pack. No network
microservices. No new repair machinery beyond regeneration-with-complaints. No edits to the owner's
book-score skill (W5 flags the gap only). No catalog regens beyond `execution` until owner GO.
Never weaken: no gate/validator/promote check is removed or loosened anywhere in this plan — carries
REVERIFY, screens only INVALIDATE disproven votes with respawn+quorum, budgets only ADD.

## §7 THE GRILLING — hard questions, pre-answered
1. **"You reported ~35 sessions; it was 102. Why believe these numbers?"** The 102 is counter-proven
   (session-id suffixes reconcile the ledger with zero slack). The fix is structural: T1 makes the
   conductor print its own audited cost table with a logged==counter invariant, so honesty stops
   depending on my counting.
2. **"Was the Q9 incident a reader hallucination?"** No — our doc trap (no trailing newline; §1.2).
   Three readers hit it independently. Q1 removes the trap, Q2 certifies the doc, Q3 catches any
   residual false structural claim, Q4 keeps the panel at quorum. The same reader's keyCheck already
   contained the disproof — Q3 is exactly "use the machine evidence we already have."
3. **"Did we lower the bar to pass POM?"** The bar moved 84→80 on evidence (same-instrument control on
   the SHIPPED book = 80.0 with unanimous gate FAIL; no real book has ever read ≥84 on this instrument;
   judge offset ≈ owner−4.5). Beat-shipped stays conjunctive, so a regen can never ship below the book
   it replaces. Q5's parity re-check re-anchors after the 3-reader switch.
4. **"Will the new budgets flag the POM we just published?"** Yes (51% shortest-key tell, 10/12 same
   challenge skeleton). Intended: they exist so the NEXT book can't ship with those residuals. POM's
   re-regen is a Phase-6 wave-2 owner decision, not silent churn now.
5. **"Why rewrite 137 tracked packages?"** 2 carry a 75KB manifest that leaks internal paths/session
   ids/code inventory INTO THE CLIENT BUNDLE; the rest carry small dead fields. One provably-neutral
   commit (K4 gates it) ends the class and locks the contract forever.
6. **"Why trust carry ledgers with publish evidence?"** They're caches, never evidence: promote
   reverifies the round-token-anchored artifacts and recomputes projections from current bytes; delete
   the ledger and you get fresh derivation, not a pass (T4/T5/T7).
7. **"What if `execution`'s shipped-control reads >80?"** Then beat-shipped binds above 80 — as
   designed. The acceptance must beat the shipped book on the same instrument or halt for the owner.
8. **"What does A+ mean, concretely?"** §8. If any row misses, the grade isn't A+ — no narrative rescue.

## §8 A+ SCORECARD — the validation run (`execution`) must hit EVERY row
**Outcome A+**
- Acceptance: gate **3/3 PASS (unanimous)**, churn ≠ HIGH (target LOW), composite ≥ max(80, control)
  — target control+2.
- Reader budgets 0 findings **including CHB6–CHB9**; preflight echo/tell/practice gates clean.
- Package: classic-shape slim (overhead <1%; chapter content starts within the first ~30 lines);
  K4 contract tests green; correct promote-time `createdAt`.
- Owner spot-read approves (their judgment is the final gate).

**Process A+**
- Sessions ≤ 50 all-in (fresh research + control read + run; model ≈ 41 ±25%) — auto-counted by T1,
  logged==counter invariant green.
- First-draft preflight pass ≥ 70% (was 40%); 0 infra halts; 0 re-entry waste (any re-entry ≤ 4 sessions,
  carry-proven); 0 structural-claim invalidations without a byte-disproof record.
- publish-final: one command → commit → push → **origin sync 0/0 asserted** → debris 0 bytes remaining
  for the book (re-run of cleanup dry-run = empty manifest) → cost + size report printed.
- Suites: root verify green; pipeline suite failure names byte-identical to baseline; no tracked-file
  deletions anywhere.

## §9 OWNER-DECISION RECORD (2026-07-03)
Sweep all 137 ✅ · Delete all current debris incl. pmbok ✅ · Rename dir + rebrand npm package ✅ ·
Validation book = execution ✅ · Bar 80 + beat-shipped (standing, 2026-07-03) · Debris auto-delete at
publish (standing, this commission) · Phase-5 items a–g: a→W1, b→Q2/Q3, c→K1, d→F1, e→R1, f→R2,
g→E1–E5 — all absorbed into workstreams above.
