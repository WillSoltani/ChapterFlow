# V24 Pipeline Fix Prompts

**Companion to:** `V24_PIPELINE_AUDIT_FINDINGS.md` (same directory — read the matching finding
before implementing; it carries the full evidence chain).
**Repo:** `~/ChapterFlow-books` · **Pipeline root (all relative paths below):**
`scripts/book/prompts/chapterflow-v24-author-pipeline/`
**Branch:** work on `feat/anti-sameness-live-fix` or a branch cut from it. **Do not push, publish,
or deploy anything.**

**Global constraints (apply to every prompt, in addition to each prompt's own):**
- Do not weaken true blockers or the semantic acceptance panel.
- Do not force or fake a publish; do not change accept thresholds (74 floor, +5 margin, bar 80)
  without an explicit owner-decision note.
- Do not hard-code `start-with-why` (it is the test book, not the target of the fix).
- Do not erase state evidence; back up any state file you must rewrite (`<name>.pre-<prompt>.bak`).
- Do not create unbounded retries; every new write path must consume an existing bounded grant.
- Do not invent unsupported facts in prompts/directives; do not silently bypass gates.
- After each prompt: `npm run typecheck` clean and `npm test` — pass count must be
  `1735 + your new tests`, fail count must remain exactly the 14 known corpus/env failures
  (promote-gate ×9, cast-discipline, name-commonality, generate-book-promotion, qc-run, drive/daring-greatly
  ENOENT) **unless the prompt explicitly fixes some of them (Prompt 11)**. A new failing NAME is a
  regression you introduced.

---

## Execution order

### Must fix first (convergence + production safety)

| Order | Prompt | Finding | Why this order |
|---|---|---|---|
| 1 | Prompt 1 — de-mandate the voice charter durably | F-01 | Every other fix triggers writes; until the mold mandate is out of the writer prompt, every repair write fights itself. Nothing else is trustworthy first. |
| 2 | Prompt 2 — verify banned-device removal | F-02 | Makes repair honest. Must land AFTER Prompt 1 (enforcing bans while the prompt still mandates the devices burns grants on guaranteed reverts). |
| 3 | Prompt 3 — guard acceptance-driven regen | F-03 | Stops the loop from regressing passing chapters while Prompts 1-2 are validated live. |
| 4 | Prompt 4 — wire the content-repair lane into churn routing | F-04 | Depends on Prompts 1-3 (the lane must be prompt-clean, device-verified, and regression-guarded before the conductor may drive it). |

**Parallelism:** Prompt 1 (brief/voice layer: `cli.ts`, `lib/voiceBible.ts`, `lib/voiceCard.ts`)
touches no orchestrator file and MAY run in parallel with Prompt 3. Prompts 2, 3, 4 all touch
`bookSamenessRun.ts` / `authorReview.ts` / the regen ledger — **must run serially in that order**.

### Fix second (quality, calibration, cost)

| Order | Prompt | Finding |
|---|---|---|
| 5 | Prompt 5 — extend the device catalog (practice shell +) & always-on rotation for manual-brief books | F-07, F-08 |
| 6 | Prompt 6 — acceptance-gate truth: tests, dead constant, quorum guard, owner memo | F-05 |
| 7 | Prompt 7 — honest severities in the sameness critics (dead ternary, opt-in flag) | F-06 |
| 8 | Prompt 8 — key-judge loud-fail at promote | F-10 |
| 9 | Prompt 9 — reserved-harm classifier calibration | F-09 |

**Parallelism:** Prompt 5 conflicts with Prompt 2 (`contentDeviceDeal.ts` detectors) — run after
it. Prompt 6 conflicts with Prompt 3/4 (`authorReview.ts`) — run after 4. Prompts 7, 8, 9 are
mutually independent and may run in parallel with each other (7: critics; 8: promote path;
9: `authorReview.ts` — 9 must wait for 6 if run on the same branch).

### Fix later (maintainability / hygiene)

| Order | Prompt | Finding |
|---|---|---|
| 10 | Prompt 10 — pending-deploy visibility | F-11 |
| 11 | Prompt 11 — self-contained promote tests + machine-checked baseline | F-12, F-13 remnants |
| 12 | Prompt 12 — `_blocked` leak, stale locks, gitignore | F-14 |

All three are independent of everything above and of each other; safe in parallel.

---

## Prompt 1: F-01 — De-mandate device-prescribing voice moves, durably (code-side)

### Role
You are a senior pipeline engineer working on the ChapterFlow v24 author pipeline
(`scripts/book/prompts/chapterflow-v24-author-pipeline/`). You fix a prompt-contamination defect at
its choke point without weakening any legitimate voice guidance.

### Context
The writer prompt's HOUSE STYLE section is built from the book brief's
`voiceCharter.signatureMoves`/`avoidMoves`. For inline/manual books the brief is a **derived
artifact**: `derive-artifacts` (`src/cli.ts:948-1003`) unconditionally overwrites
`state/briefs/<book>.manual-brief.json` from the frozen research TOC's `authorVoice`, and it is
auto-run by `book-gate` (`cli.ts:206`) and the QC entry (`cli.ts:3465`). The start-with-why TOC's
signature moves literally mandate the sameness mold ("opens with recognizable business… cases",
"turns a case into a simple three-part distinction such as WHY, HOW, and WHAT", "returns to Apple,
the Wright brothers, and Martin Luther King Jr. as recurring reference points"). Via
`formatVoiceBible` (`src/lib/voiceBible.ts:53-55` — `signatureMoves.slice(0,3)` become a `do:`
line) and `voiceCard` (`src/lib/voiceCard.ts`), those mandates reach **every** writer/repair prompt
(`src/orchestrator/authorRun.ts:562`, rendered :465-469) — in the same card whose CONTENT DEVICES
section bans those exact devices (`authorRun.ts:460-463`). A hand-fix of the brief committed in
`dae308a01` was reverted by a live re-derivation on 2026-07-07T23:11Z (visible as the working-tree
` M` diff on the brief). The voiceCard's own contract (`voiceCard.ts:14-16`) says it teaches "HOW
to sound, never WHAT to say".

### Input
Inspect before writing code:
- `src/cli.ts:940-1065` (`runDeriveArtifacts`), `:454-464` (`tocAuthorVoice`), `:206`, `:3455-3470`
- `src/lib/voiceBible.ts` (whole file), `src/lib/voiceCard.ts` (whole file)
- `src/orchestrator/authorRun.ts:440-480` (card assembly), `:159-234` (house rules/quality bar)
- `src/compiler/contentDeviceDeal.ts:39-46` (the 6 device ids — your filter must cover their shapes)
- `.chapterflow/runs/start-with-why/20260704T125509997Z-*/source-freeze/toc.json` (`authorVoice`)
- `state/briefs/start-with-why.manual-brief.json` (current reverted content) and
  `git show dae308a01 -- .../start-with-why.manual-brief.json` (the de-mandated hand-edit — your
  filter's target output shape)
- `tests/voice-card.test.ts`, `tests/content-machinery.test.ts:164-169`
- Finding F-01 in `V24_PIPELINE_AUDIT_FINDINGS.md`

### Objective
No device-mandating instruction from any brief/TOC voice charter ever reaches a writer prompt,
regardless of how many times the brief is re-derived — while genuine register/style guidance still
flows.

### Requirements
1. **Filter at the choke point.** Add a pure, exported function (suggested:
   `sanitizeVoiceMoves(moves: string[]): { kept: string[]; stripped: string[] }` in
   `src/lib/voiceBible.ts` or a sibling module) that classifies a signature move as a **content-device
   mandate** vs **style guidance**. Device-mandate shapes to strip (match by shape, not by book
   vocabulary): opens-with-<case-type> mandates; turn-into-N-part-framework reflexes
   (WHY/HOW/WHAT-style triads); recurring-named-anchor mandates ("returns to X, Y, Z as recurring
   reference points"); invented-proxy mandates; return-proof/receipt-close mandates;
   second-setting mandates. Keep: register, cadence, person, diction, second-person tests,
   contrast-of-tone moves, all `avoidMoves` (never strip an avoid-rule).
2. Apply it in `formatVoiceBible` **before** the `slice(0,3)` so stripped moves don't consume the
   3-move budget. Log (via the existing return-shape or a comment-visible mechanism) what was
   stripped so gate-time diffs are explainable.
3. **Make derivation non-clobbering.** In `runDeriveArtifacts`: if the existing on-disk brief
   differs from what would be derived AND the existing file's `voiceCharter` is not byte-identical
   to the derived one, preserve the existing `voiceCharter` (fields other than voiceCharter may
   re-derive) and print a one-line notice. Add an explicit `--force-voice` flag to overwrite. This
   keeps derivation idempotent for untouched books and stops silent reverts of reviewed edits.
   (Do not add interactive prompts; the pipeline is headless.)
4. Do NOT edit the frozen TOC (it is research evidence), do NOT change the bibliography prompt in
   this prompt (out of scope; note it as follow-up), do NOT touch `AUTHOR_HOUSE_RULES`.
5. Fix the `voiceCard.ts` header comment to state the sanitizer as the enforcement of "never WHAT
   to say".

### Implementation plan
1. Write the classifier with a table-driven set of shape regexes + unit fixtures first (TDD — the
   start-with-why five moves are your positive fixtures; invent style-only moves as negatives).
2. Wire into `formatVoiceBible`; run `tests/voice-card.test.ts` (must stay green — the guard line
   and budget behavior are pinned there).
3. Amend `runDeriveArtifacts` with the preserve-voiceCharter logic + `--force-voice`.
4. Re-run the full suite; verify baseline.

### Tests
- Unit: `sanitizeVoiceMoves` strips each of the five start-with-why moves (quote them verbatim as
  fixtures) and keeps: "uses direct second-person tests that ask whether a decision feels aligned",
  a register line, and all three start-with-why avoidMoves.
- Unit: a voice card built from the **current reverted** start-with-why brief contains no
  "opens with recognizable" / "three-part distinction" / "returns to Apple" text.
- Unit: `formatVoiceBible` still emits a `do:` line when ≥1 style move survives; emits none when
  all moves are stripped (and never emits an empty `do:`).
- Integration: `runDeriveArtifacts` on a tmp state root with a hand-edited voiceCharter present →
  voiceCharter preserved, other fields re-derived, notice printed; with `--force-voice` →
  overwritten; with no existing brief → derived exactly as today. (Build the tmp fixture like
  `tests/helpers.ts` does; never touch real `state/`.)
- Regression: full suite at baseline.

### Red-team checklist
- Feed the sanitizer 20+ real signature moves from other books' TOCs (grep
  `.chapterflow/runs/*/source-freeze/toc.json` if present) — confirm no legitimate style move is
  stripped (over-stripping recreates the "one house voice" problem the voice card exists to fix).
- Confirm a book with ALL moves stripped still gets a card (register template fallback) — never a
  null card for a book that had a charter.
- Confirm derive-artifacts remains deterministic and side-effect-safe on `--dry-run` QC paths.
- Confirm you did not change what `avoidMoves` render (the `never:` line).
- Adversarial: craft a mandate phrased as style ("sounds best when every chapter opens on a famous
  company") — document whether your shapes catch it; if not, note the residual in your report.

### Output
Report: files changed; the classifier's shape table; before/after voice card for start-with-why
(from the reverted brief); derivation preserve/force behavior demo; tests added + full-suite
result; residual risks (unfiltered mandate shapes, the bibliography-prompt follow-up).

### Constraints
All global constraints. Additionally: do not delete or rewrite
`state/briefs/start-with-why.manual-brief.json` by hand — let the fixed code path handle it; the
working-tree ` M` diff is audit evidence, leave it in place.

---

## Prompt 2: F-02 — Enforce banned-device removal in the repair drivers

### Role
Senior pipeline engineer on the v24 sameness-repair lane. You make device bans verifiable and the
drivers honest about non-compliance.

### Context
`diversifyOne` (`src/orchestrator/bookSamenessRun.ts:185-252`) re-authors a chapter with a ban
directive, then keeps the draft on `review.valid && keysClean && noReservedHarm && composite >= bar-band`
(`:243`) — it never checks whether the banned devices were actually removed. The planner computes
per-target `bannedDevices` (`src/critics/contentDeviceRepair.ts:149`) but the call site
(`bookSamenessRun.ts:328`) passes only `{chapterNumber, directive, label}`, dropping the list.
Live consequence (previous session): ch06 kept the hard-detail device verbatim while "passing"
repair at 87.3; proxy-cast only moved 93%→79%; second-setting rose (balloon effect). Detectors
live in `src/compiler/contentDeviceDeal.ts` (`detectChapterDevices`, 6 devices, :39-46, :115-170).
**Prerequisite: Prompt 1 must be merged first** — otherwise the writer prompt still mandates the
devices and enforcement burns grants on guaranteed reverts.

### Input
- `src/orchestrator/bookSamenessRun.ts` (whole file — `DiversifyTarget`, `diversifyOne`,
  `doBookSamenessRepair`, `doContentDeviceRepair`, the `residualOverCap` logging :342-355)
- `src/critics/contentDeviceRepair.ts` (planner + `ContentRepairTarget`)
- `src/compiler/contentDeviceDeal.ts` (detectors — read every regex)
- `src/critics/bookSamenessRepair.ts` (architecture-lane targets — decide whether architecture
  repairs also get verification; see Requirements 5)
- `tests/content-machinery.test.ts`, `tests/repair-lane.test.ts`
- Findings F-02 and F-07 red-team notes in `V24_PIPELINE_AUDIT_FINDINGS.md`

### Objective
A kept "repaired" chapter demonstrably no longer uses its banned devices; a draft that still uses
them is reverted with a distinct, loud status — never reported as success.

### Requirements
1. Thread `bannedDevices: ContentDeviceId[]` through `DiversifyTarget` (optional field — the
   architecture lane may pass none initially).
2. In `diversifyOne`, after the existing keep-checks pass, run `detectChapterDevices(fresh)`; if
   any device in `bannedDevices` is detected, **revert prior bytes** and return a new status
   (`"devices-persisted"`), logging which devices persisted with the detector's match snippet.
3. **Grant semantics unchanged:** the grant was consumed at spawn; a devices-persisted revert does
   not refund it (bounded behavior preserved).
4. **Balloon-effect telemetry (not a gate):** also detect devices NOT in the ban list that are
   newly present vs the prior bytes; log them into the outcome (`substitutedDevices`) so the
   book-level report shows substitution honestly. Do not revert on substitution alone.
5. Architecture-lane (`doBookSamenessRepair`) targets: pass no `bannedDevices` for now (its bans
   are skeleton families, not content devices) — but surface the same `detectChapterDevices`
   before/after diff in its outcome for visibility.
6. **Detector hardening first:** before enforcement, add FP/FN fixtures for the five detectors that
   have none (named-anchor-lead, second-setting, return-proof, hard-detail-boundary,
   three-part-split): for each, ≥2 true-positive and ≥2 near-miss negative fixtures (e.g. a chapter
   that mentions "the proof of a promise" in a quote must not trip return-proof). If a detector
   cannot pass its near-miss fixtures, narrow it and record the change.
7. `doContentDeviceRepair`'s final summary must clearly separate: kept-and-clean /
   devices-persisted / reverted-quality / skipped-cap.

### Implementation plan
1. Detector fixtures (Requirement 6) — get the regexes trustworthy.
2. Type change + call-site threading (`bookSamenessRun.ts:328` and the sameness-lane call).
3. The post-keep device check + revert + statuses.
4. Substitution telemetry.
5. Full suite.

### Tests
- Unit: `diversifyOne` with a stubbed `authorWriteOneChapter` that returns a draft still containing
  a banned device → status `devices-persisted`, prior bytes restored byte-identically, grant
  consumed exactly once (assert the ledger).
- Unit: draft clean of banned devices but containing a *new* non-banned device → kept, with
  `substitutedDevices` populated.
- Unit: the existing revert branch (below-band composite) still works and is distinguishable from
  `devices-persisted`.
- Unit: detector FP/FN fixture matrix (Requirement 6).
- Integration: `doContentDeviceRepair` over a 4-chapter tmp fixture book where the stubbed writer
  complies on ch1/ch2 and does not on ch3 → summary reports 2 kept, 1 devices-persisted; preserved
  chapters byte-stable.
- Regression: `tests/repair-lane.test.ts`, `tests/content-machinery.test.ts` green; full suite at
  baseline.

### Red-team checklist
- Can a detector FP revert a genuinely-compliant improved draft? Run all 14 current
  start-with-why chapters through each detector and eyeball matches — every match must be a real
  device use (attach the list to your report).
- Does the revert leave any partial state (review ledger, provenance)? The self-check review runs
  with persist=false — confirm that is still true on your new path.
- Could an implementer "pass" this prompt by only logging instead of reverting? The unit test in
  Tests #1 must fail on log-only behavior.
- Confirm the conductor (`autopilot.ts`) is untouched — this prompt changes drivers only.

### Output
Report: files changed; detector regex changes with justification; the 14-chapter detector match
audit; test list + results; behavior demo (kept vs devices-persisted vs reverted); remaining risks
(writer-compliance rate is now measurable — report it if you ran a live round, but a live round is
NOT required for this prompt).

### Constraints
Global constraints. Do not run live model generation in this prompt (all tests use stubs/fixtures).
Do not "solve" non-compliance by weakening the composite keep-check.

---

## Prompt 3: F-03 — Regression-guard the acceptance-driven regen lane

### Role
Senior pipeline engineer on the v24 acceptance loop. You give the acceptance-regen path the same
churn protections the budget lane already has.

### Context
On book-acceptance rejection, `authorReview.ts:1560-1583` fully re-authors ≤3 chapters. Verified
defects: no PASS-lock awareness (`holdsDurablePass`/`appendReopenNote` not imported); a re-authored
draft is kept if it merely re-passes (a 74-draft silently replaces an 85-draft — the documented
ch04 85.6→73.4 class); **if the regen's review FAILs, the block halts with the regressed bytes
left on disk** (no restore anywhere in :1560-1585); no durable reopen note records why a passing
chapter was reopened. Contrast the budget lane's protections: `partitionBudgetBlockers`
(`authorRun.ts:863-879`), A4 hash guard (`:1048-1071`), reopen notes. The sameness drivers'
restore-on-regress (`bookSamenessRun.ts:238-248`) is the pattern to follow.

### Input
- `src/orchestrator/authorReview.ts:1483-1605` (the acceptance rejection block), `:744-848`
  (near-bar/tiebreak), `:1340-1380` (review-round regen for comparison)
- `src/orchestrator/authorReviewLedger.ts` (`holdsDurablePass` :266-279, `appendReopenNote` :312-319,
  `carryReviewFor`)
- `src/orchestrator/bookSamenessRun.ts:185-252` (the restore pattern)
- `src/orchestrator/authorRun.ts:863-879, 1048-1071` (budget-lane guards)
- `tests/author-arch.test.ts` (acceptance tests, :638, :817-839), `tests/budget-carry-lock.test.ts`
- Finding F-03 (incl. red-team notes) in `V24_PIPELINE_AUDIT_FINDINGS.md`

### Objective
An acceptance-driven regen can never leave a chapter worse than it found it, and every reopen of a
passing chapter is durably attributed.

### Requirements
1. Before each target's regen: snapshot prior bytes + the prior review's composite; append a reopen
   note (`trigger: "acceptance-regen"`, decision `"reopened-for-acceptance"`, carrying the reader
   complaints that selected it). Reuse `appendReopenNote` — do not invent a new ledger.
2. After the regen + review (+ existing near-bar tiebreak):
   - review FAILs → **restore prior bytes**, keep the prior persisted review as current (it still
     matches the restored content hash by construction — verify), record the failure in
     `regenFailures` as today. The halt still happens if failures remain, but the book is never
     left with regressed bytes.
   - review PASSes but `composite < priorComposite − noiseBand` → restore prior bytes, log
     `regressed-quality restored`, count it as a failure for halt purposes (the complaint was not
     addressed at equal quality).
   - review PASSes within/above band → keep (current behavior).
3. Grant semantics unchanged: `recordRegenConsumed` stays where it is (consumed at spawn, restore
   does not refund).
4. Keep the churn-branch `strongPass` filter (:1516-1520) as-is.
5. Do NOT block reopening per se (holistic rejections must be able to touch passing chapters); this
   prompt adds regression-safety, not a lock.

### Implementation plan
1. Extract the restore/keep decision into a small pure helper (testable without spawning).
2. Wire snapshots + reopen notes + the three outcomes.
3. Verify the restored-bytes ↔ prior-review carry invariant explicitly in a test.
4. Full suite; `tests/author-arch.test.ts` acceptance cases must stay green.

### Tests
- Unit (pure helper): FAIL → restore; pass-below-band → restore; pass-within-band → keep;
  boundary at exactly `prior − band`.
- Integration (stubbed writer/review io, tmp state): acceptance rejection reopens ch2; regen review
  FAILs → ch2 bytes byte-identical to prior, reopen note exists with trigger `acceptance-regen`,
  regen grant consumed, halt message unchanged in category.
- Integration: regen passes at prior−(band+2) → restored + logged; at prior−1 (inside band) → kept.
- Integration: the restored chapter still carries (`carryReviewFor` hit) on the next entry — no
  re-review spawn for untouched restored bytes.
- Regression: `author-carry-e1-e2.test.ts`, `budget-carry-lock.test.ts`, full suite at baseline.

### Red-team checklist
- Does restore interact with provenance/regen-lineage records written during the failed write?
  Trace `recordAuthorProvenance` and the lineage key — confirm no stale record now points at
  restored bytes in a way any gate consumes.
- Could keep-if-within-band mask a real quality slide across MULTIPLE rounds (ratchet down by
  band each time)? Compare against prior composite from the **pre-reopen snapshot**, not the last
  kept value — confirm your implementation does this per-round (it does not accumulate).
- Does the reopen note fire even when the regen never spawns (write error)? It should — the intent
  to reopen is the event.
- Confirm you did not change `AUTHOR_BOOK_REGEN_CHAPTER_CAP`, the halt categories, or the accept
  predicate.

### Output
Report: files changed; the three-outcome decision table; test list + results; before/after trace of
a simulated regressing regen; remaining risks.

### Constraints
Global constraints. This prompt must not touch `bookSamenessRun.ts` (Prompt 2's file) beyond
reading it, to keep the two mergeable.

---

## Prompt 4: F-04 — Route churn rejections to the content-repair lane (bounded), stop blind regen burn

### Role
Senior pipeline engineer on the v24 conductor/acceptance routing. You connect the purpose-built,
bounded, revert-protected content-device repair lane to the loop that needs it.

### Context
Live state: start-with-why has 14/14 passing chapters, a sticky acceptance gate FAIL at the current
bytes, churn HIGH, 6/14 chapters regen-exhausted — and `contentRepairConsumed` is **empty** because
`doContentDeviceRepair` is reachable only via the manual `content-repair-book` CLI verb
(`cli.ts:5692-5694` → `liveRun.ts:627/684`); `autopilot.ts` never routes to it. Instead, the
churn-HIGH branch of acceptance rejection (`authorReview.ts:1505-1540`) spends the global regen
lane (cap 2 writes/chapter lifetime) on full re-authors. Prompts 1-3 must be merged first: the
lane is only now prompt-clean (P1), device-verified (P2), and the regen fallback regression-guarded
(P3).

### Input
- `src/orchestrator/authorReview.ts:1483-1605` (rejection routing; churn branch :1505-1540)
- `src/orchestrator/bookSamenessRun.ts` (`doContentDeviceRepair` signature, options, outcomes —
  post-Prompt-2 shape), `src/orchestrator/liveRun.ts:600-700`
- `src/orchestrator/autopilot.ts` (how `doAuthorReview` is invoked; halt categories; loop bounds
  `MAX_LOOP_ITERS` :954)
- `src/orchestrator/authorRegenLedger.ts` (contentRepair lane :356-393)
- `state/books/start-with-why.author-regen-ledger.json` (live example of the deadlock)
- Finding F-04 (incl. red-team notes) in `V24_PIPELINE_AUDIT_FINDINGS.md`

### Objective
On a churn-HIGH acceptance rejection, the pipeline tries the bounded content-device repair lane
BEFORE spending global regen writes; when both lanes are spent it halts with an actionable message.
No new unbounded path.

### Requirements
1. In the churn-HIGH branch: first invoke the content-device repair flow (planner + driver) over
   the planner-selected targets, respecting `contentRepairConsumed` (skip-cap stays loud). Only
   chapters that the content lane could not fix (devices-persisted / skipped-cap / reverted) may
   then fall through to the existing (now guarded) regen targeting — and only within the current
   caps.
2. The content-lane pass counts as the round's action: after it, re-run acceptance (bytes changed →
   new docSha → fresh pool) using the existing round-2 machinery; do not add a third round.
3. If churn is HIGH and **both** lanes are spent for every planner target: halt(content) with a
   message that names the state and the manual escape hatch
   (`content-repair-book <book> --only … [--force]`), instead of burning remaining regen writes on
   unrelated chapters.
4. Non-churn rejections: unchanged routing.
5. Everything stays inside `doAuthorReviewInner`'s existing bounded structure — no new loop in
   `autopilot.ts`. If you must touch `autopilot.ts`, it is only to pass IO/deps through.
6. Gate the new routing behind a config/env kill switch (`CHAPTERFLOW_CHURN_CONTENT_REPAIR`,
   default ON, `=0` restores current behavior) — same pattern as `CHAPTERFLOW_REVIEW_REPAIR`
   (`authorRepair.ts:30-32`).

### Implementation plan
1. Extract `doContentDeviceRepair`'s core so it is callable with injected IO from `authorReview`
   (it currently lives behind the CLI driver — keep the CLI verb working over the same core).
2. Insert the lane into the churn branch; wire outcome → fallthrough set.
3. The both-lanes-spent halt message.
4. Kill switch + tests; full suite.

### Tests
- Integration (stubbed writer io, tmp state, 6-chapter fixture book): acceptance rejected
  churn-HIGH → content lane runs on planner targets, ledger's `contentRepairConsumed` records them,
  regen lane untouched for chapters the content lane fixed.
- Integration: content lane returns devices-persisted for ch3 → ch3 (and only ch3) enters the regen
  targeting; regen guarded per Prompt 3.
- Integration: all planner targets content-consumed AND regen-exhausted → halt(content), message
  contains `content-repair-book`.
- Unit: kill switch `=0` → routing byte-identical to pre-prompt behavior (assert no content-lane
  call).
- Integration: non-churn rejection → no content-lane call.
- Regression: full suite at baseline; `author-arch.test.ts` acceptance tests green.

### Red-team checklist
- Bound analysis: worst case writes per conductor entry = (content grants unspent, ≤1/lineage) +
  (regen ≤3) — write the arithmetic in your report and show no path exceeds it.
- Sticky-gate interaction: confirm the round-2 acceptance runs against the NEW docSha (bytes
  changed), otherwise the sticky FAIL makes the round pointless.
- Could the content lane and regen lane both touch the same chapter in one round? Only via the
  explicit fallthrough (devices-persisted) — confirm the chapter then carries BOTH ledger marks and
  cannot be re-entered by either lane afterward.
- Does the kill switch fully restore old behavior (no half-wired logging)?
- Confirm acceptance thresholds, caps, and halt categories are unchanged.

### Output
Report: files changed; the routing decision tree (before/after); bound arithmetic; ledger evidence
from the integration tests; kill-switch demo; remaining risks (e.g. writer compliance rate still
gates real-world success — measurable now via Prompt 2 statuses).

### Constraints
Global constraints. Do not auto-run `diversify-book` (architecture lane) from the conductor — only
the content lane; architecture diversification remains operator-driven. Do not modify the accept
predicate.

---

## Prompt 5: F-07/F-08 — Extend the device catalog; deal rotation that reaches manual-brief books

### Role
Pipeline engineer on the v24 variety systems. You close the coverage gap between what acceptance
readers name and what the deal/critic can see, and you give manual-brief books the rotational
levers that currently require a machine brief.

### Context
The content-device catalog (`src/compiler/contentDeviceDeal.ts:39-46`) covers 6 devices; readers
also name if-then practice shells, quiz-distractor logic, and "limit paragraphs", and the weekly
("each Friday…") practice shell — present in ~13/14 current start-with-why chapters — is covered
only by the advisory ARCH1 axis (`architectureMonoculture.ts:73`). Separately, manual-brief books
(~113/119 in production) skip the whole per-chapter VARIETY block (`authorRun.ts:446-452` gates on
`args.brief`; produced by `briefVarietyInstructionLines`, `chapterBrief.ts:505-574`) — including
practice-shape rotation (`PRACTICE_SHAPES`, `briefRotation.ts:161`) and the architecture-family
deal (v5, 8 families, `briefRotation.ts:135-144,:804`). The always-on content-device deal
(`authorRun.ts:460-463`) is the proven delivery mechanism that reaches them. Prerequisite: Prompt 2
(detector hardening + enforcement) merged.

### Input
- `src/compiler/contentDeviceDeal.ts` (catalog, rotation math `{i,i+1,i+3} mod 6` :177-182,
  renderer :192-204)
- `src/critics/contentMachinery.ts` (thresholds :44-50), `src/critics/architectureMonoculture.ts`
  (ARCH1 regex :73)
- `src/compiler/briefRotation.ts` (`PRACTICE_SHAPES` :161, `ARCHITECTURE_FAMILIES` :135-144,
  `dealRotation`/2-3 cap :804)
- `src/orchestrator/authorRun.ts:440-480`
- `tests/content-machinery.test.ts`, `tests/author-arch.test.ts:418-430` (variety gating pins)
- Findings F-07, F-08 in `V24_PIPELINE_AUDIT_FINDINGS.md`

### Objective
(a) The deal + saturation critic cover the practice-shell device (and, where a precise detector is
achievable, the if-then shell); (b) manual-brief books receive deterministic per-chapter rotation
for practice shape and architecture family through the always-on dealt section.

### Requirements
1. **Catalog extension.** Add `practice-shell` (weekly/scheduled-ritual closer) as a 7th device:
   detector keyed on shape (recurring-schedule ritual framing near the chapter's practice/action
   section), ban text, and altHints. Update the rotation so every device still lands ≤~60%
   book-wide (recompute the difference-set for 7; keep the module's determinism guarantees and its
   `totalChapters < 4` bail). Evaluate if-then-shell and limit-paragraph detectors: implement ONLY
   if you can pass near-miss fixtures (a legitimate single if-then sentence must not trip); if not
   achievable precisely, document why and leave them named-but-unimplemented in the catalog comment.
2. **Deal ↔ rotation-pool consistency.** `PRACTICE_SHAPES` currently deals `if-then-trigger` IN for
   machine-brief books. Make the content deal and the practice rotation aware of each other: a
   chapter whose dealt content bans the practice-shell device must not simultaneously receive a
   `weekly-…` practice shape (filter at deal time; deterministic).
3. **Always-on rotation for manual-brief books.** Extend the always-on dealt section
   (`authorRun.ts` next to the content-device lines) with two compact deterministic lines when no
   machine brief exists: an architecture-family assignment (reuse `ARCHITECTURE_FAMILIES` + the 2/3
   cap via a pure function of chapterNumber/totalChapters/bookId) and a practice-shape assignment
   (from `PRACTICE_SHAPES`, filtered per Requirement 2). Machine-brief books keep their compiled
   VARIETY block unchanged (do not double-deal: skip these lines when `args.brief` is present).
4. `contentMachinery` picks up the new device(s) automatically (it reuses the catalog) — verify,
   and extend its tests.
5. Card budget: the additions must keep the card under `AUTHOR_CARD_MAX_CHARS` (25000) — assert in
   a test with a worst-case fixture.

### Implementation plan
1. Detector + fixtures for practice-shell (TDD; the 13/14 current chapters are your live positive
   corpus — cite matches in the report).
2. Rotation math for 7 devices + determinism tests.
3. Deal/practice-shape consistency filter.
4. Always-on architecture/practice lines for `args.brief === null` books.
5. Full suite.

### Tests
- Detector FP/FN matrix for each new detector (≥3 positives from real chapter text, ≥3 near-miss
  negatives).
- Rotation: with 7 devices over 14 chapters, no device present in >60% of deals; deterministic per
  (bookId, chapterNumber); a device banned in a chapter never co-occurs with a practice shape that
  embodies it.
- Card: manual-brief book (brief null, totalChapters ≥4) card contains architecture-family +
  practice-shape lines; machine-brief book card does NOT contain the new always-on lines (pinned
  alongside `author-arch.test.ts:418-430`).
- `contentMachinery` fires `CM.practice-shell` on a saturated fixture; silent on a rotated one.
- Card-size worst case under 25000.
- Regression: full suite at baseline.

### Red-team checklist
- Overfit: do the detector/ban texts mention Sinek/Friday specifically? Ban text must say
  "recurring scheduled ritual (e.g. a weekly review)" shape language, not one book's phrasing.
- Does the always-on architecture line contradict a manual book's voice charter (post-Prompt 1 it
  cannot mandate devices, but check tone)?
- Balloon effect: with practice-shell banned, what does the writer default to? Confirm the altHints
  offer ≥3 genuinely different closers.
- Determinism across re-runs and `--only` retries (same chapter → same deal).
- Confirm machine-brief books' compiled VARIETY behavior is byte-identical (their tests pin it).

### Output
Report: files changed; new catalog entry table; rotation coverage table (device × 14 chapters);
detector match audit against the live corpus; card before/after for a manual-brief chapter; tests +
results; which additional detectors you declined to implement and why.

### Constraints
Global constraints. Do not change `contentMachinery` thresholds. Do not touch the acceptance path.

---

## Prompt 6: F-05 — Acceptance-gate truth: tests, dead constant, quorum guard, owner memo

### Role
Pipeline engineer + technical writer. You make the book-acceptance gate's real semantics tested,
named, and documented — without changing any threshold.

### Context
Verified semantics (`authorReview.ts:1087-1090`): `accepted = quorum ∧ sticky-gate PASS ∧
median≥AUTHOR_BOOK_ACCEPT_FLOOR(74) ∧ (no shipped control ∨ median≥shipped+BEAT_SHIPPED_MARGIN(5))`.
Churn is telemetry/routing only (:1082-1084). `AUTHOR_BOOK_ACCEPT_BAR=80` (:870) is dead telemetry
with a gate-sounding name. `composeBookVerdict` ties favor PASS (`evalBookProxy.ts:487`), which is
quorum-shielded at acceptance but NOT for the shipped-control read (`shippedControl.ts:222`) that
sets the +5 baseline. None of this is unit-tested. The previous campaigns were run and reported
against a wrong model of this gate ("rejected as churn HIGH").

### Input
- `src/orchestrator/authorReview.ts:355-460` (read pooling, trueMedian, caps), `:860-1100`
  (constants + `runBookAcceptance`)
- `src/review/evalBookProxy.ts` (`composeBookVerdict` :467-490, churn prompt :323, sample :73)
- `src/orchestrator/shippedControl.ts:176-230`
- `tests/eval-book-proxy.test.ts`, `tests/author-arch.test.ts`
- Finding F-05 in `V24_PIPELINE_AUDIT_FINDINGS.md`

### Objective
The accept predicate is pinned by tests; misleading names are fixed; the shipped-control baseline
cannot be set by a degraded panel; the two open calibration questions are packaged as an explicit
owner decision, not silently resolved.

### Requirements
1. **Tests for the predicate** (drive `runBookAcceptance` with injected IO/read records — no live
   readers): floor boundary (73.9 reject / 74.0 accept, no shipped control); margin boundary
   (shipped 72.7: 77.6 reject / 77.7 accept); sticky gate FAIL forces reject regardless of median;
   quorum unmet → reject with the quorum message; churn HIGH with passing numbers → **ACCEPT**
   (pins the telemetry-only semantics loudly, with a comment saying this is the standing
   2026-07-04 calibration).
2. **Rename** `AUTHOR_BOOK_ACCEPT_BAR` → `AUTHOR_BOOK_PREMIUM_TARGET` (or equivalent) so the name
   matches its telemetry role; update the log line and comments. Grep for external references
   first.
3. **Quorum guard for the shipped control:** `resolveBeatShippedBar` must require the same valid-
   reader quorum (≥3) as acceptance before a control composite becomes the margin baseline; a
   degraded control read → treat as `shipped === null` **and log loudly** (floor-only mode). This
   strengthens (a 2-reader control can currently set a too-low baseline); it must not fabricate a
   control where none exists.
4. **Owner-decision memo** at `docs/v24/ACCEPTANCE-GATE-POLICY.md`: one page stating the current
   predicate verbatim, then the two open questions with options + tradeoffs, explicitly awaiting
   sign-off: (a) should churn ever veto (e.g. unanimous-HIGH across a full 3-read pool) — flap-risk
   analysis included; (b) should fresh books (no shipped control) face more than the 74 floor
   (e.g. the 80 premium target) — cost: more rejections on first-time books. **Implement neither.**
5. Do not change: floor value, margin value, read cap, sample size, churn semantics.

### Implementation plan
1. Grep + rename (mechanical).
2. Build a read-record fixture factory (reuse `author-arch.test.ts` helpers).
3. Predicate tests; quorum guard + its tests; memo.

### Tests
As Requirement 1, plus: shipped-control read with 2 valid readers → margin not applied, loud log
asserted; `composeBookVerdict` tie behavior documented in a test comment (not changed).
Regression: full suite at baseline (rename must not break imports).

### Red-team checklist
- Does the rename change any persisted record field name? (`:1047`/`:1055` record shapes — keep
  serialized field names stable; rename the constant only, or map explicitly.)
- Does the quorum guard reject a legitimate historical control record shape? Check
  `shippedControl.ts` persistence for validCount availability on old records; if absent, treat as
  degraded (floor-only) and log — never guess.
- Could the churn-accepts test be misread as endorsing churn? The test comment must point at the
  memo.
- Confirm zero behavior change for a 3-valid-reader control (the normal case).

### Output
Report: files changed; the predicate test matrix with results; rename diff summary; memo path;
confirmation that no threshold changed; any historical control records that now degrade to
floor-only (list them).

### Constraints
Global constraints. This prompt must not run concurrently with Prompts 3/4 (same file).

---

## Prompt 7: F-06 — Honest severities in the sameness critics; implement the promised opt-in enforcement

### Role
Pipeline engineer on the deterministic critic layer. You make the code do what its comments promise,
without changing default gate outcomes.

### Context
`architectureMonoculture.ts:196` has a dead ternary (`severe ? "major" : "major"`); `severe`
(`axes.length >= axesBlock`) is computed and discarded, and the docstring (:27-28) promises an
operator flag that can promote ARCH0 — no such flag exists. `contentMachinery.ts` defines
`axesBlock: 4` (:44-50) that nothing consumes. Both are wired advisory-only into `bookGate`
(:573-599; `passed = blockers.length === 0` :629-633), and bookGate does not run in the author
acceptance path at all — so deterministic sameness currently influences nothing in the live loop.
The standing calibration ("semantic panel is the true gate") is an owner decision — defaults must
not change.

### Input
- `src/critics/architectureMonoculture.ts`, `src/critics/contentMachinery.ts`
- `src/critics/bookGate.ts:560-640`
- `src/orchestrator/authorReview.ts` (acceptance record shape, ~:1040-1060) — for telemetry wiring
- `tests/architecture-monoculture.test.ts`, `tests/content-machinery.test.ts`
- Finding F-06 in `V24_PIPELINE_AUDIT_FINDINGS.md`

### Objective
Severe monoculture CAN block when an operator opts in; defaults are byte-identical to today;
acceptance records carry the deterministic sameness snapshot so future rejections are attributable.

### Requirements
1. Implement `CHAPTERFLOW_STRUCTURAL_SAMENESS=enforce|advisory` (default `advisory`). Under
   `enforce`, ARCH0 with `severe===true` and CM0 with `overCap.length >= axesBlock` emit
   severity `blocker`; otherwise exactly today's severities. Fix the dead ternary accordingly and
   make the docstrings truthful either way.
2. Wire a compact deterministic sameness snapshot (ARCH0 axes + CM over-cap devices with
   fractions) into the acceptance read record (telemetry field; no accept-predicate change) so a
   churn-HIGH rejection can be cross-checked against deterministic saturation.
3. Tests must pin BOTH modes.

### Implementation plan
Flag helper (one resolver, both critics) → severity fix → bookGate passthrough check (blockers
already fail it — verify no special-casing needed) → acceptance telemetry field → tests.

### Tests
- Default/advisory: a 4-axis saturated fixture book emits ARCH0/CM0 as major; bookGate passes
  (pins that advisory stays advisory — the missing test the audit flagged).
- Enforce: same fixture → blocker; bookGate fails; a 1-axis book still passes.
- Acceptance record contains the snapshot field (stubbed acceptance run).
- Regression: full suite at baseline.

### Red-team checklist
- Confirm no default-mode behavior delta by diffing bookGate output on the zz fixtures before/after.
- Enforce-mode + the conductor: if an operator enables it mid-book, can it deadlock (bookGate FAIL
  with all lanes spent)? Document the interaction in the flag's docstring — enforcement is a
  pre-publish audit tool, not a mid-campaign switch.
- The telemetry field must not change the acceptance docSha/caching keys — verify the record hash
  inputs.

### Output
Report: files changed; both-mode test matrix; a sample acceptance record with the snapshot;
confirmation of default-mode byte-identical gate outcomes.

### Constraints
Global constraints. Default behavior must not change; the flag ships OFF.

---

## Prompt 8: F-10 — Make unverified quiz keys loud at promote

### Role
Pipeline engineer on the promote/QC evidence chain. You convert a silent fail-open into a loud,
policy-controlled one. Strengthen only.

### Context
`checkKeyJudge` (`src/critics/quizKeyGate.ts:132-149`) does not block on a **missing or stale**
key-judge result unless `CHAPTERFLOW_REQUIRE_KEYJUDGE=1` (:19); promote calls it with that env
default-off (`promoteBook.ts:646-651`). This is the mechanism that historically shipped `hooked`
with 21/72 wrong keys. The author path has an independent reader-side 9/9 key derivation
(`readerReview.ts:467`), so author-arch books have semantic key evidence at review time — but
promote does not check for THAT evidence either. There is also no multiple-correct-answer check
anywhere beyond a prompt instruction (`quizKeyJudge.ts:87`).

### Input
- `src/critics/quizKeyGate.ts`, `src/critics/semantic/quizKeyJudge.ts`
- `src/promoteBook.ts:590-660`
- `src/orchestrator/authorReviewLedger.ts` / review records (what reader key evidence looks like)
- `tests/quiz-key-gate.test.ts` (:57-105 pin the current matrix)
- Finding F-10 in `V24_PIPELINE_AUDIT_FINDINGS.md`

### Objective
No package promotes with silently-unverified keys: promote either sees key-judge evidence, sees
author-review key evidence, or says loudly per chapter that keys are unverified — and a two-correct
fixture red-teams the judge.

### Requirements
1. Promote report: for every chapter, a key-evidence line — `judge-verified (fresh)` /
   `reader-verified (review 9/9 at current contentHash)` / `UNVERIFIED`. UNVERIFIED chapters print
   a prominent summary block. Default gate behavior unchanged (advisory), `REQUIRE_KEYJUDGE`
   semantics unchanged.
2. Accept reader-side evidence: a durable passing review at the current content hash whose
   `keyCheck.matches === of` counts as key evidence (wire through the existing review ledger; do
   not spawn anything at promote).
3. Add the missing red-team fixture: a question with two defensibly-correct choices → assert the
   judge prompt path yields non-high confidence → not `flagged` → **documented** as the known gap
   in the test comment (this pins reality; do not fake a fix).
4. No new env flags; no threshold changes.

### Implementation plan
Evidence resolver (pure, given chapter + ledgers) → promote report wiring → tests.

### Tests
- Matrix: judge fresh / judge stale + reader-verified / neither → the three lines; UNVERIFIED
  summary appears only in the third.
- Existing `quiz-key-gate.test.ts` matrix stays green (default fail-open pinned there is
  unchanged).
- Two-correct fixture per Requirement 3.
- Regression: full suite at baseline.

### Red-team checklist
- The reader-evidence check must bind to the CURRENT content hash — a post-review edit must demote
  to UNVERIFIED (test it).
- Don't let the report line leak reviewer session ids into the package.
- Confirm promote exit codes are unchanged in all three cases.

### Output
Report: files changed; sample promote report for each evidence state; test results; the documented
two-correct gap.

### Constraints
Global constraints. Do not make UNVERIFIED blocking in this prompt (that escalation is an owner
decision; note it in the report).

---

## Prompt 9: F-09 — Calibrate the reserved-harm complaint classifier

### Role
Pipeline engineer on the v24 review calibration. You fix substring-level misclassification in a
safety-relevant classifier without flipping its fail-direction.

### Context
`complaintNamesReservedHarm` (`src/orchestrator/authorReview.ts:506-514`): `RESERVED_HARM_RX`
matches substrings (`key`, `answer`, `wrong`, `missing`…) anywhere in `unit + problem`, so "the
answer feels generic" blocks near-bar conversion; `SUBJECTIVE_ONLY_RX` contains `thin`/`slot-filler`,
so a genuine "filler example → unusable" can downgrade. Ambiguous defaults to blocking (correct
fail-direction — keep it). Separately, a single sub-band taste FAIL (`composite < bar−3.7`,
`ship84:false`) bypasses the tiebreak entirely and burns 1 of 2 lifetime regen writes
(`isNearBar` :744-749; regen :1367/:1454). No test covers any of this.

### Input
- `src/orchestrator/authorReview.ts:500-560` (classifier + `complaintsOf`), `:744-848`, `:1340-1380`
- `src/review/readerReview.ts:148-160` (the reviewer-side rubric the classifier backstops)
- Real complaint phrasings: grep `state/reviews/start-with-why/*.review.json` for `problem` fields
  (evidence corpus)
- Finding F-09 in `V24_PIPELINE_AUDIT_FINDINGS.md`

### Objective
The classifier decides on harm-semantics, not substrings; a sub-band single-read FAIL cannot burn a
regen write on one reader's taste without a bounded second opinion.

### Requirements
1. Rework matching: word-boundary + context anchoring (e.g. `wrong` only within "factually
   wrong/wrong answer/keyed wrong"-type patterns; `answer/key` only when the complaint asserts a
   correctness/validity defect, not an aesthetic judgment). Build from a fixture corpus FIRST:
   ≥20 real phrasings (from state + the rubric's own category names), each hand-labeled
   block/downgrade, and treat that as the acceptance test. Ambiguous still → block (unchanged
   default).
2. Remove genuine-harm words from `SUBJECTIVE_ONLY_RX` where the corpus shows collisions
   (`thin`/`filler` phrasings that name unusability must block).
3. **Sub-band second-opinion guard (bounded):** before a review-round regen is consumed for a
   chapter whose single FAIL read is sub-band AND whose complaints contain no reserved-harm match,
   spawn exactly ONE additional independent read; regen proceeds only if the second read also
   FAILs (else the better read stands via the existing median/tiebreak machinery). Hard cap: one
   extra read per chapter per round; no extra read when any reserved-harm complaint exists.
4. Fail-direction invariant: any change that makes a previously-blocking complaint downgrade must
   be justified line-by-line against the corpus in your report.

### Implementation plan
Corpus + labels → classifier rewrite (pure function, table-driven) → second-opinion guard →
tests → full suite.

### Tests
- The labeled corpus as a table test (every entry asserted).
- "the answer feels generic" → downgrade; "Q4 keys the wrong choice" → block; "example is filler,
  teaches nothing, unusable" → block; "example feels thin, could be richer" → downgrade;
  gibberish/ambiguous → block.
- Second-opinion guard: sub-band taste FAIL + clean second read → no regen consumed (assert
  ledger); sub-band FAIL + failing second read → regen proceeds; reserved-harm FAIL → no second
  read spawned.
- Regression: full suite; `budget-carry-lock`/`author-arch` green.

### Red-team checklist
- Could the second read inflate costs? Show the trigger conditions are narrow (sub-band AND
  no-reserved-harm AND about-to-consume-regen) and capped.
- Could a malicious/degenerate complaint phrase evade blocking ("the example implies something
  untrue" — no keyword)? Ambiguous→block must catch it; add it to the corpus.
- Does the guard interact with the F5 dead-end pre-check ordering? Trace `:1288-1308` — the guard
  runs after dead-end filtering, never resurrects a dead-ended chapter.

### Output
Report: files changed; the labeled corpus with before/after classification diff; regen-spend delta
in tests; remaining known-ambiguous phrasings.

### Constraints
Global constraints. Ambiguous→block stays. Must not run concurrently with Prompts 3/4/6 (same file).

---

## Prompt 10: F-11 — Pending-deploy visibility (no auto-deploy)

### Role
Pipeline engineer on operator tooling. You make un-deployed publish debt impossible to miss.

### Context
`publishFinal` writes `<outerRoot>/book-packages/.pending-deploy.json` (fail-closed,
`publishFinal.ts:415-433`) listing 3 manual steps (S3 upload → `gh workflow run deploy.yml` →
`verify:live`). `verify:live` exists only in the outer web-app repo; the pipeline only prints a
reminder (`autopilot.ts:2818`). The app grades quizzes from the bundled package import, so a
skipped deploy leaves grading stale even after S3 upload. Nothing in `doctor`/`book-status`
surfaces sentinel age.

### Input
- `src/publish/publishFinal.ts` (sentinel schema + writer), `src/publish/publishToLive.ts:4-70`
- `src/cli.ts` `doctor` and `book-status` implementations
- `tests/publish-final.test.ts`
- Finding F-11 in `V24_PIPELINE_AUDIT_FINDINGS.md`

### Objective
`doctor` and `book-status` loudly show any pending deploy (books, steps remaining, age in hours);
the cross-repo runbook is documented in-repo.

### Requirements
1. A pure reader for the sentinel (tolerant of missing outer root — report "outer root not found",
   never throw).
2. `doctor`: a PENDING DEPLOY section, warning-level at any age, escalating wording >24h.
3. `book-status <book>`: if that book appears in the sentinel, print the remaining steps verbatim.
4. `docs/v24/DEPLOY-RUNBOOK.md`: the exact three commands with their working directories (pipeline
   vs outer repo), what `verify:live` checks, and what clears the sentinel.
5. No new side effects: read-only additions; no auto-clearing, no auto-deploy, no gh/aws calls.

### Implementation plan
Reader + tests → doctor/book-status wiring → runbook doc → full suite.

### Tests
- Sentinel present/absent/malformed → reader outcomes (malformed → loud parse warning, not a crash).
- doctor output contains the section iff sentinel non-empty (tmp outer-root fixture).
- book-status prints steps for a listed book; silent for an unlisted one.
- Regression: `publish-final.test.ts` + full suite at baseline.

### Red-team checklist
- Wrong outer-root resolution must degrade to a warning, not a false "all clear".
- A malformed sentinel (hand-edited) must not crash doctor.
- Confirm no code path writes/clears the sentinel outside `publishFinal`.

### Output
Report: files changed; sample doctor/book-status output; runbook path; test results.

### Constraints
Global constraints. Strictly read-only visibility — no deploy automation.

---

## Prompt 11: F-12/F-13 — Self-contained promote tests + machine-checked failure baseline

### Role
Test-infrastructure engineer. You make the publish-safety suite actually run everywhere and turn
the remembered "14-failure baseline" into asserted state.

### Context
9 of the 14 baseline failures are `promote-gate.test.ts` failing on absent real-state corpus
(`CHSET.index_missing: state/indexes/drive.json`, `drive-ch06…` ENOENT) — the promotion
transaction-safety tests (fault injection, idempotency, recovery, waivers) never execute on this
checkout, and new promote regressions hide inside the accepted baseline. Other suites already
build tmp fixtures via `tests/helpers.ts` (TMP_DIR `tests/.tmp`, cleaned at :281). The runner is
`tests/run.ts`.

### Input
- `tests/promote-gate.test.ts` (all 17 cases; identify which 9 read real state and exactly what
  they need: a canonical index + chapter files + brief/plans for a small book)
- `tests/helpers.ts` (fixture factory patterns, :518-600), `tests/run.ts`
- `src/promoteBook.ts` (state-root injection points — check for a `--state-root`/opts override;
  `verify-production-package` already takes `--state-root`, `cli.ts:154`)
- The other 5 baseline failures (cast-discipline, name-commonality, generate-book-promotion,
  qc-run, gold-corpus ENOENT) — understand each's reason
- Findings F-12/F-13 in `V24_PIPELINE_AUDIT_FINDINGS.md`

### Objective
`promote-gate.test.ts` passes on a bare checkout via self-built fixtures; the remaining
environment-dependent tests are explicitly marked with a machine-readable expected-env-failure
reason; the suite fails if an unexpected NAME fails.

### Requirements
1. Convert the 9 corpus-dependent promote-gate cases to build a minimal fixture book (2-3 chapters,
   canonical index, brief, plans) under `tests/.tmp` using existing helper patterns, injected via
   promoteBook's state-root override (add a narrow injection point if none exists — options
   argument, not env).
2. For genuinely environment-dependent tests (gold-corpus ones needing the real tracked corpus),
   add a runner-level `expectedEnvFailure(reason, when)` marker: they report as `xenv` (skipped-
   with-reason) when the precondition is absent, and RUN when present. The final summary line
   distinguishes `fail` (real) from `xenv`.
3. End state on this checkout: `fail 0`, with the environment-dependent set visible as `xenv`.
   On a corpus-complete checkout: everything runs.
4. Do not weaken any assertion inside the tests; only their fixtures/preconditions change.
5. Also add (small, from F-13): a test pinning production default bar 80 through
   `resolveChapterBar` (no env), and a `derive-artifacts` smoke test if Prompt 1 has not already
   added one (check first — do not duplicate).

### Implementation plan
Fixture factory for a promotable book → convert the 9 cases one-by-one (each must still exercise
its original failure mode) → xenv marker in run.ts → summary wiring → full suite.

### Tests
This prompt IS tests; acceptance: `npm test` → `fail 0`, `xenv` count equals the documented
env-dependent set, `pass ≥ 1735 + converted cases`. Fault-injection/idempotency/recovery promote
cases demonstrably execute (show their pass lines).

### Red-team checklist
- Did any converted test lose its teeth (e.g. fault injection now injects into a path the fixture
  never hits)? Diff each case's assertions before/after.
- Does the fixture book accidentally exercise the author path's live spawns? Everything must stay
  stubbed/no-API (`CHAPTERFLOW_NO_API_CODEX_QC=1` is already set by the test script).
- xenv must not be usable to hide a real regression: the marker requires a precondition CHECK
  (file existence), not a name allowlist.
- Leak check: the converted promote tests must not write to real `state/` (see Prompt 12's leak —
  at minimum, do not add to it; point the quarantine dir at the fixture root via the injection
  point).

### Output
Report: converted case list with before/after assertion diffs; new summary format; final counts on
this checkout; the injection point added to promoteBook (if any) and why it is test-only-safe.

### Constraints
Global constraints. No production logic changes beyond a narrow, options-based state-root injection
point. Do not delete the gold-corpus tests.

---

## Prompt 12: F-14 — Stop the `_blocked` report leak; stale-lock and debris hygiene

### Role
Pipeline engineer on state hygiene. You stop unbounded debris growth without deleting evidence.

### Context
Every BLOCKED promotion writes a new timestamped report (`promoteBook.ts:878` →
`state/books/_blocked/<book>.<epoch>.report.json`, QUARANTINE_DIR :71) and nothing deletes them:
61 files now, +1 per `npm test` run because `tests/source-integrity.test.ts:390-395` promotes a
fixture expecting BLOCK and never cleans the report. `cleanupBookDebris.ts` scans only the top
level of `state/books/` (:171) so `_blocked/` is invisible. The same leak exists in the v21 tree
(untracked `zz-fixture-source-integrity-promote.*.report.json` in git status). Also:
`state/autopilot-locks/zz.compiler-run.lock` can wedge after a crashed test run; v24 `.gitignore`
covers only `state/qc-preflight/`.

### Input
- `src/promoteBook.ts:60-80, 860-890`; `src/publish/cleanupBookDebris.ts` (manifest builder :150-250)
- `tests/source-integrity.test.ts` (the leaking promote call + its cleanup block)
- `state/books/_blocked/` inventory (61 files — count before/after)
- `.gitignore` (pipeline-level), lock code (`acquireBookLock` in `src/orchestrator/` or
  `librarian/libraryState.ts` — locate the heartbeat/liveness logic)
- Finding F-14 in `V24_PIPELINE_AUDIT_FINDINGS.md`

### Objective
Fixture-generated reports never persist; real blocked reports are retained but bounded and
cleanable; stale locks are detected by doctor; debris can't be accidentally committed.

### Requirements
1. **Test leak:** `source-integrity.test.ts` (and any other test that promotes an expected-BLOCK
   fixture — grep for promoteBook calls in tests) must remove its own `_blocked/<fixtureId>.*.report.json`
   in cleanup, or better, use the state-root injection from Prompt 11 so the report lands in
   `tests/.tmp`. Prefer the injection if Prompt 11 landed; else direct cleanup.
2. **Retention for real books:** on writing a new blocked report, prune older reports for the SAME
   bookId beyond the newest N=5 — but first move pruned files into
   `state/books/_blocked/_archive-<date>/` created once per run (constraint: never delete evidence
   outright). `cleanupBookDebris` (which runs on successful publish) additionally learns to include
   `_blocked/<bookId>.*.report.json` for the published book in its manifest (a published book's
   blocked history is resolved).
3. **One-time sweep, backed up:** move the existing `zz-fixture-*.report.json` files (v24 tree
   only) into `_archive-<date>/` with a manifest listing what moved. Do NOT touch the v21 tree
   (gold corpus discipline; note it for the owner instead).
4. **Stale-lock doctor check:** doctor reports any `state/autopilot-locks/*.lock` whose pid is not
   alive (same-host check only; foreign-host locks report as "unverifiable") with the exact `rm`
   command to clear — detection only, no auto-removal.
5. **.gitignore:** add `state/books/_blocked/_archive-*/` and `tests/.tmp/`; do NOT ignore
   `_blocked/*.report.json` themselves (they are legitimate evidence an operator may want to
   commit).

### Implementation plan
Test-leak fix → retention/prune-to-archive → cleanupBookDebris `_blocked` awareness → doctor lock
check → one-time sweep with manifest → full suite (twice, to prove no new report leaks).

### Tests
- Promote a BLOCK fixture through a tmp state root → report written; promote 6 more times → only 5
  remain + archive holds the rest with manifest.
- cleanup manifest for a published fixture book includes its blocked reports.
- source-integrity test run leaves `state/books/_blocked/` count unchanged (assert in the test
  itself).
- Doctor flags a lock with a dead pid (fixture lock with pid 99999999); reports foreign-host as
  unverifiable.
- Regression: full suite at baseline (or post-Prompt-11 counts), run twice — second run must not
  add files under real `state/`.

### Red-team checklist
- Retention must never prune another book's reports (bookId prefix collision: `execution` vs
  `execution-2` — split on the epoch pattern, not prefix alone).
- The one-time sweep must be reviewable: manifest first, moves second, and the commit message
  lists counts.
- Doctor's pid liveness must not kill or signal anything (`kill -0` probe semantics only).
- Confirm the v21 tree is untouched (git status diff before/after).

### Output
Report: files changed; before/after `_blocked` counts; archive manifest; doctor sample output;
double-run leak proof.

### Constraints
Global constraints — especially: never delete state evidence without the named archive; never touch
`chapterflow-v21-authored/` state.

---

## Cross-prompt conflict map (for schedulers)

| File | Touched by |
|---|---|
| `src/orchestrator/authorReview.ts` | P3, P4, P6, P9 — strictly serial in that order |
| `src/orchestrator/bookSamenessRun.ts` | P2, P4 — serial |
| `src/compiler/contentDeviceDeal.ts` | P2 (detectors), P5 (catalog) — serial |
| `src/cli.ts` | P1 (derive), P10 (doctor/status), P11/P12 (small) — coordinate; mechanical merges |
| `src/promoteBook.ts` | P8, P11, P12 — serial (small, low-risk) |
| critics (`architectureMonoculture`, `contentMachinery`) | P5, P7 — serial |
| `lib/voiceBible.ts` / `lib/voiceCard.ts` | P1 only |
| publish (`publishFinal`, `cleanupBookDebris`) | P10, P12 — independent functions, can parallel with care |

**Two prompts that could fight if misread:** P2 (revert on devices-persisted) and P3 (restore on
regression) both restore prior bytes — they operate in different lanes (sameness driver vs
acceptance regen) and must stay lane-local; neither may generalize its restore into the other's
path. P6 pins churn-accepts as a test while P4 routes churn rejections — P6's test must construct a
*passing-numbers* churn-HIGH case (accepted, no routing), P4's tests construct *failing* ones; they
are consistent.

**After the must-fix block (P1-P4) lands**, the correct live validation sequence (owner-run, not
part of any prompt) is: re-derive → confirm sanitized voice card → `content-repair-book
start-with-why` (now device-verified) → book-run acceptance. Only then can "writer ceiling" be
honestly re-evaluated.
