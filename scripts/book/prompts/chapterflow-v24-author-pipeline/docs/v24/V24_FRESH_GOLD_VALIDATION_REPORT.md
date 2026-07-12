# V24 Fresh Gold-Corpus Validation — Report

**Date:** 2026-07-08 · **Book:** `high-output-management` (Andrew S. Grove) — fresh, from zero
**Branch:** `feat/anti-sameness-live-fix` · **HEAD at start:** `e7c77b86c` (docs) over `62180db3a`
(the R1/R2/R4/R5 safety commit) — the full audit→fix→verification wave was committed before this
run (Phase 1 requirement satisfied; nothing pushed). Three further inline fixes were made
**mid-run under the owner's pause-fix-resume instruction** (uncommitted at time of writing, §6).
**Companion:** `V24_FRESH_VALIDATION_FIX_PROMPTS.md` (the one open design gap + test debt).

---

## 1. Verdict

**Classification: C — not ready due to a verified engineering gap** (one specific blocker), **with
the campaign's central question answered YES**:

> Is v24 a functional production pipeline when used cleanly from chapter one?

**The anti-sameness objective succeeded outright.** Written fresh under the fixed stack, the book's
content-device profile is:

| Device | start-with-why (manual-brief era, pre-repair) | high-output-management (fresh, 15 ch) |
|---|---|---|
| practice-shell | **100%** | **53%** |
| proxy-cast | **93%** | **53%** |
| return-proof | **93%** | **53%** |
| named-anchor-lead | 57% | **0%** |
| second-setting | 50% | **0%** |
| hard-detail-boundary | 43-57% | **0%** |
| three-part-split | 21% | **0%** |

Every device sits under the 60% cap, matching the rotation's designed ≤~57% almost exactly; ch07
carries zero devices; no two adjacent chapters share a device combination. **The mold that took
four repair campaigns to fight on start-with-why simply never formed.** 15 of 16 chapters wrote,
gated, and passed blinded review at 84.8-89 with 9/9 keys.

**The blocker:** ch14's dealt lead case ("Task-focused interview questions" — a concept label with
no narratable actors) is systematically uncarriable under the STIER-2 lead-thread write contract:
**5 of 6 drafts across three entries failed it** (the single pass carried a reader-caught mustFix).
The pipeline halts honestly and repeatedly on it, with no degradation path — a convergence trap on
fresh books whenever research yields a concept-only chapter. Book acceptance was therefore **never
exercised** on this book. The durable fix is a design change (deal↔contract feedback), specified in
the companion prompts file — deliberately NOT improvised mid-run.

**No publish, no deploy, no push, no gate lowered, no acceptance policy touched.**

---

## 2. Phase 1 — preservation of validated work

- `git log`: fix wave P1-P12 committed (`fea830b73`→`66d104666`); follow-ups R1/R2/R4/R5 committed
  as `62180db3a`; campaign docs as `e7c77b86c`. Working tree clean of tracked changes at run start.
- Pre-run suite: **pass 1871 / fail 0 / xenv 6** · typecheck clean.

## 3. Phase 2 — book selection

- **Selected:** `high-output-management` from the 49 unpublished catalog entries.
- **Why:** mainstream, highly representative management nonfiction (like the shipped corpus); rich
  real-world source material; **zero prior state anywhere** (no runs, no chapters, no ledgers);
  not `start-with-why`; not a legacy manual-brief book — it runs the full **machine-brief** v24
  path (research → packets → design → chapter briefs → author), i.e. the VARIETY system that
  manual-brief books never exercised.
- Rejected: `your-money-or-your-life` (stale Jul-3 attempt logs), `pmbok-guide` (edge-case
  reference manual).
- Old state: none existed; nothing to isolate. Checkpoint/logs under `logs/v24-fresh-validation/`.

## 4. Phases 3-4 — doctor & intake

- `doctor high-output-management` (pre-research): 1 fatal `CHSET.index_missing` — **classified:
  missing input**, the correct fail-closed state for a never-researched book. Not a blocker.
- **Provider detours (environment, not pipeline):** the standalone `research` verb routes through
  the billed/CLI provider router — `anthropic-cli` unconfigured (no `claude` binary on this
  machine) and `openai-api` returned `insufficient_quota`. The correct machine path turned out to
  be the autopilot itself: **book-run's research phase spawns a codex research session**
  (subscription), which is how all writer/review work runs. One aborted invocation each for the
  wrong-provider and a wrong-cwd launch (conductor-side; logged).
- **Research (codex, live web):** 13 minutes → 16-chapter TOC + full source sidecars.
  Then the entire compile chain first-try green: 16 source packets → packet-gate → book-design →
  design-gate → 32 chapter-brief files → brief-gate (0 blockers, 0 advisories at every step).

## 5. Phase 5 — the run (3 segments, 2 owner-instructed pause-fix-resume cycles + 1 bug fix)

Command (all segments): `CHAPTERFLOW_ALLOW_MODEL_GEN=1 npx tsx src/cli.ts book-run
high-output-management --author --no-publish --log logs/v24-fresh-validation/<segment>.log`

**Logs:** `high-output-management.doctor.20260708-0421.log`, `…research.20260708-0423.log`,
`…fresh-author.20260708-0433.log` (segment 1), `…0517.resume.log` (segment 2),
`…0540.resume2.log` (segment 3), `…0705.resume3.log` (segment 4) + backups
(`briefs-pre-fix-backup/`, `ch14.contract-failing-draft.bak.json`, `ch14.write-phase-orphan-2.bak.json`,
`high-output-management.stale-lock.bak.json`).

### 5.1 What the machine-brief path delivered (first live exercise under the fixed stack)

Every chapter card carried the full dealt VARIETY block — architecture family, opener mode,
24-hour-challenge frame, practice shape, example arcs/lenses, lead thread, quiz-stem shapes,
distractor modes, practice-slot shapes, practice verb — plus the always-on CONTENT DEVICES bans
and the sanitized voice card. The STIER-2 write contracts actively policed the deals (lead-thread
and rubric-preflight retries observed on ~6 chapters, all bounded, all but ch14 converging).

### 5.2 Mid-run finding #1 (pause 1): lead-thread dealer was content-deal-blind

ch01's card carried `proxy-cast` in its CONTENT DEVICES bans **and** "Willow carries this chapter"
in its LEAD THREAD — and because the lead is contract-enforced while the ban is not, the pipeline
**forced the banned device in** (ch01 shipped with Willow ×8). `dealLeadPreference` is documented
"packet-blind"; the P5 consistency filter had covered practice shapes only. Collision census:
ch01 (already written), ch09/ch13/ch15 (preventable).
**Fix (paused at 8/16 written):** `resolveLeadThread` gained `avoidInvented` — a proxy-banned
chapter never deals an invented lead while any owned case exists; call site consults
`dealContentDeviceBans`. Briefs recompiled (ch09/13/15 → owned-case leads; other diffs were the
designed sibling-avoid context). Tests: 16-chapter invariant + regression pins (46/0 focused).

### 5.3 Mid-run finding #2 (pause 2): supporting-cast leak on proxy-banned chapters

ch13 carried its owned-case lead but kept its old proxy "Preston" ×10 in supporting scenes — the
brief still dealt an invented cast list, and the owned-case template licensed "invented cast in
supporting scenes" on a proxy-**banned** chapter.
**Fix (paused at 14/16, ch15 seconds into writing):** proxy-banned owned-case chapters now deal an
**empty cast** and their lead line forbids stand-ins outright ("NO invented stand-in characters…").
Wider suites 180/0. **Live proof:** ch15 and ch16 (both proxy-banned) wrote clean of invented names
— ch15 scored 89, the book's best.

### 5.4 Review board (16/16 fresh reads)

13 straight PASSes (84.8-89, ship=true, keys 9/9). ch07 (84.8, ship=false) → median-of-3 tiebreak
**converted** (86.7/86 ship-majority, no cap consumed). ch14 (87, ship=false) → tiebreak **upheld**
0/3 ship (a consistent editorial signal: its one reader-named mustFix was a quiz stem naming the
wrong character) → bounded regen with merged complaints (repair lane correctly ineligible —
non-convergent scopes).

### 5.5 Mid-run finding #3 — VERIFIED BUG (fixed): failed writes left unreviewed drafts on disk

ch14's regen died twice on the lead contract — and left the **contract-failing draft on disk,
destroying the original 87-composite chapter** (disk hash `553e81ec…` vs review-bound
`3d10c422…`; original bytes unrecoverable — no backup exists in the write path). Worse, on the
next entry that unreviewed draft would have been **blindly reviewed as a legitimate chapter**
(write contracts are checked only at write time). The same orphan-draft shape reappeared in the
write phase during resume 3.
**Fix (root):** `authorWriteOneChapter` now snapshots the pre-write bytes and, when every attempt
fails, restores them — or **removes the orphan draft** when no chapter existed — covering all
three lanes (write phase, review regen, acceptance regen) at the source; the review-lane call site
additionally restores the prior review pointer + provenance (mirrors the P3 acceptance guard).
`AuthorIo` gained injectable `readChapterFile`/`writeChapterFile`/`removeChapterFile`.
Suite: **pass 1873 / fail 0** (typecheck clean). The dedicated write-gate-failure fixture test is
specified in the companion prompts file (needs authorRun gate fixtures; deliberately not
improvised).

### 5.6 The open blocker: ch14's uncarriable dealt lead (the convergence trap)

Evidence across three entries: **6 drafts, 5 lead-contract failures** (original attempt-1 fail,
attempt-2 pass-with-mustFix; regen ×2 fail; fresh write ×2 fail). The dealt lead
"Task-focused interview questions" is a bare concept — the packet's three cases are ALL concept
labels (no person/org/study anywhere in the chapter's source material), `leadLabelHasToken`
accepts any capitalized token, and the D7 contract demands the lead's "real actors, numbers,
dates" carry the fastRead + 2 examples. Comparable concept-ish leads ("Salary review", "One-on-one
meeting") carried fine — the failure is specific but the CLASS is real: **when research yields a
concept-only chapter, the pipeline deals an instruction its own contract then fails ~80% of the
time, with no degradation path and no feedback loop — an honest but unbreakable halt cycle.**
A lexical fix was evaluated and rejected (would misclassify this book's seven *working*
concept-ish leads — overfit risk). The design fix (bounded retry-time lead degradation) is
Prompt F-1 in the companion file.

## 6. State & code produced

- Chapters: 15/16 written+reviewed PASS (ch14 absent — orphan drafts backed up + removed so the
  next write is honest). Reviews durable; regen ledger: ch14 regen consumed 1 (review lane);
  reopen/tiebreak notes as designed. No acceptance records (never reached).
- Code (uncommitted, this session): `chapterBrief.ts` (lead-deal consistency ×2),
  `authorRun.ts` (write-failure restore/remove + AuthorIo hooks),
  `authorReview.ts` (review-lane restore call-site), `stier2-levers.test.ts` (+2 tests).
  All gated on typecheck + full suite (1873/0).
- The two aborted wrong-cwd/wrong-provider launches left a stray empty repo-root `logs/` (removed)
  and touched nothing else; v21 tree untouched; start-with-why untouched.

## 7. Phase 7 diagnostics (required answers)

- **Did the new v24 systems reach the writer from chapter one?** Yes — verified in the compiled
  briefs and cards (VARIETY + CONTENT DEVICES + sanitized voice), and enforced by write contracts.
- **Did they prevent the start-with-why machinery?** Yes — the table in §1; the mold never formed.
- **Did chapters churn or converge?** Converged cleanly except ch14: no chapter was reopened
  unnecessarily, tiebreaks resolved noise without spending caps, bounded retries everywhere.
- **Were passing chapters protected?** Yes — and the one protection GAP found (failed writes
  clobbering good bytes) was caught live, root-fixed, and suite-verified.
- **Were repairs surgical and bounded?** The repair lane correctly declined a non-convergent case;
  every regen/write consumed its budget honestly; all halts were bounded with repair prompts.
- **Did book acceptance give actionable reasons?** Not reached (the only stage this run leaves
  unexercised on a fresh machine-brief book).
- **General v24 bug or book-specific?** The three fixed bugs were general (deal composition ×2,
  draft-cleanup ×1). The open blocker is a general CLASS (concept-only chapters) that this book
  happened to instantiate on one chapter.

## 8. Does this change the interpretation of `start-with-why`?

Yes, favorably. Start-with-why's churn is now demonstrably an artifact of the **manual-brief era**:
no VARIETY deals, mold-mandating voice moves, and no write-time device enforcement. A fresh book
under the fixed stack does not develop the disease the repair campaigns were treating. The
"writer ceiling" measured there (2/6 device-shed rate under *repair*) coexists with this run's
finding that *prevention at write time works* — de-molding is hard, not-molding is achievable.

## 9. Classification evidence (why C, not B or D)

- Not **A/B**: the book did not complete (15/16); acceptance never ran; the halt cause is an
  engineering gap (no degradation path for an uncarriable dealt lead), not a quality/policy
  judgment about the book.
- Not **D**: everything is interpretable; model access worked (after routing research through the
  autopilot's codex path); artifacts and logs are complete.
- **C**: one specific, verified, reproducible blocker (5/6 draft failures across three entries) +
  one verified-and-fixed bug wave. "Not ready" applies narrowly: to fresh books containing
  concept-only chapters, until Prompt F-1 lands.

## 10. Exact next commands

```bash
# 1. Commit the three mid-run fixes (local; do NOT push):
git add src/compiler/chapterBrief.ts src/orchestrator/authorRun.ts src/orchestrator/authorReview.ts tests/stier2-levers.test.ts
git commit -m "fix(v24): deal-consistency (lead vs content bans) + write-failure draft restore/removal"

# 2. Implement Prompt F-1 (lead degradation) + F-2 (restore-fixture tests) from
#    docs/v24/V24_FRESH_VALIDATION_FIX_PROMPTS.md

# 3. Then finish the book (ch14 will re-deal under F-1) and run acceptance:
CHAPTERFLOW_ALLOW_MODEL_GEN=1 npx tsx src/cli.ts book-run high-output-management --author --no-publish --log logs/v24-fresh-validation/high-output-management.post-F1.log
```
