# V24 Implementation Verification Report

**Date:** 2026-07-08 · **Branch:** `feat/anti-sameness-live-fix` (HEAD `2b93bea92` — **all implementation
work is UNCOMMITTED** on top of it)
**Verifies:** the implementations of the fix-prompt pack in `V24_PIPELINE_FIX_PROMPTS.md`
(12 prompts covering the 15 findings of `V24_PIPELINE_AUDIT_FINDINGS.md`)
**Companion:** `V24_REMAINING_FIX_PROMPTS.md` (follow-ups)

> Scope note: the tasking said "15 prompts." The original pack contains **12 prompts** covering all
> **15 findings** (F-13 test gaps were distributed into Prompts 1-11; F-15 doc corrections into
> Prompts 1/6/7 and the audit report itself). All 12 prompts / 15 findings are verified below.

---

## 0. Verdict

**All 12 prompts verify as implemented — 12 PASS, 0 partial, 0 failed** — with documented
deviations (all defensible, none gate-weakening) and a short residual list. The full suite went
from the audit baseline of **14-15 failures** to **pass 1856 / fail 1 / xenv 6 / skip 12**, where
the 1 failure is a **pre-existing** defect untouched by this work (SC11 anchor-check precedence,
see §4) and xenv is a new machine-checked env-absent status that cannot mask real failures.

**Readiness classification: Functionally ready but needs one validation run** — with two
preconditions before that run: (1) commit the uncommitted union tree into reviewable commits
(it currently mixes several agents' work on one checkout — the known multi-session-collision
hazard), and (2) accept that live writer compliance with device bans under the now-sanitized
prompt is *measurable but unmeasured* — no model-generation run was performed in this pass
(deliberate; see §6). The pipeline is NOT "production-ready" until that controlled run and the
commits land, and it is NOT blocked by any code defect found here.

**No production behavior was changed during verification.** No push, no publish, no deploy, no
book rewritten, no state deleted. The only writes: this report, the remaining-prompts file, and
transient test fixtures the suites themselves clean up.

---

## 1. Repo state at verification

- 34 tracked files modified, ~2,558 insertions / 306 deletions in `src/` + `tests/`; 13 new
  source/test files; 4 implementation reports left by agents (`PROMPT9-F09-REPORT.md`,
  `PROMPT10-COVERAGE-GAP-REPORT-2026-07-08.md`, `ACCEPTANCE-GATE-POLICY.md`, `DEPLOY-RUNBOOK.md`).
  **Nothing committed; nothing pushed.**
- Biggest single change: `src/orchestrator/authorReview.ts` +516 lines (P3+P4+P6+P9 merged in one
  file) — verified as a lane, see §3.
- Book content untouched: chapters' newest mtime Jul 7 20:19 (pre-implementation); regen ledger
  Jul 6; v21 tree untouched (git status clean of v21 modifications).
- `state/briefs/start-with-why.manual-brief.json` remains ` M` (the F-01 revert evidence) —
  deliberately left in place; the sanitizer neutralizes it (verified live, §3 P1).
- Typecheck: clean (`tsc --noEmit` exit 0).

---

## 2. Verification matrix

Status legend: ✅ Verified complete · Confidence from direct code+test evidence. "Deviation" =
implemented differently than the prompt's letter, assessed against its intent.

| Prompt | Finding (sev) | Status | Conf | Key evidence | Deviations / residuals |
|---|---|---|---|---|---|
| P1 voice sanitizer + non-clobbering derive | F-01 (S1) | ✅ | High | `sanitizeVoiceMoves`/`DEVICE_MANDATE_SHAPES` (`voiceBible.ts:80-141`) applied before `slice(0,3)` (`:155`); `reconcileDerivedBrief` (`manualBriefReconcile.ts:55-71`) wired at `cli.ts:1011-1035` + `--force-voice`; auto-run sites (`cli.ts:5287`, `:3507`) go through reconcile. Tests 7+7+8 green. **Live proof:** voice card built from the still-reverted on-disk brief is CLEAN of all mandate text (run during this verification); "opens with recognizable…"/"three-part…"/"returns to Apple…" stripped, style moves + all avoidMoves kept | Non-charter hand-edits still re-derive (spec-permitted); bibliography prompt upstream untouched (out of scope, still open) |
| P2 device-removal enforcement | F-02 (S1) | ✅ | High | `bannedDevices` threaded (`bookSamenessRun.ts:238-243,447`); post-keep `detectChapterDevices` → byte-exact revert + `devices-persisted` status, grant stays spent (`:347-355`); substitution telemetry never gates (`contentDeviceDeal.ts:403`); detectors hardened with per-detector near-miss fixtures (16/16), 14-chapter live-corpus FP audit clean | Discarded-draft provenance orphan on revert — **pre-existing pattern shared with all revert paths**, follow-up R2 |
| P3 acceptance-regen guard | F-03 (S1) | ✅ | High | Snapshot + `reopened-for-acceptance` note **before** spawn (`authorReview.ts:1945-1957`); pure `decideAcceptanceRegenOutcome` (`:410-427`): FAIL→restore, pass-below-band→restore+counted-failure, within-band→keep; restore re-persists prior review → carry hits (`:1966-1974`); grants never refunded; halt categories unchanged | Same provenance-orphan residual (R2); kept-then-FAIL content-lane interaction (see P4) |
| P4 churn → content lane | F-04 (S1) | ✅ | Med-High | Churn-HIGH invokes content lane first (`:1811-1847`), kept chapters re-reviewed authoritatively; only failures fall through to guarded regen (`:1864-1868`); round-2 vs new docSha (`:2027-2032`); both-lanes-spent halt names `content-repair-book` (`:1912-1925`); kill switch `CHAPTERFLOW_CHURN_CONTENT_REPAIR` default-ON restores old routing at `=0`; CLI verb shares the same core; **autopilot.ts untouched**; bound arithmetic holds (content ≤1/lineage + regen ≤3) | If a content-lane draft is kept then FAILs its authoritative review, P3's "prior" is the lane's bytes, not the pre-lane passing bytes — the round halts (never publishes) but disk can end worse than at entry. Documented for the owner; acceptable-by-design, watch in the validation run |
| P5 catalog + always-on rotation | F-07/F-08 (S2) | ✅ | High | practice-shell = 7th device, rotation `{i,i+1,i+3} mod 7` → 8/14 = 57.1% ≤ 60% (computed from code); manual-brief books get architecture-family + practice-shape lines (`authorRun.ts:461-474`), machine-brief books byte-identical (pinned); card-size asserted ≤25000 (+delta <1500); if-then/limit-paragraph documented-declined with reasons (`contentDeviceDeal.ts:42-56`); CM auto-picks-up the device | Deal↔practice-shape consistency filter is presently a **no-op** (no weekly-* shape exists) — correct forward guard, flagged; ARCH1 and CM.practice-shell double-surface in telemetry (intended, noted) |
| P6 gate truth | F-05 (S2) | ✅ | High | All 5 predicate tests green (73.9/74.0, 77.6/77.7, sticky FAIL, quorum, churn-HIGH-accepts pinned w/ memo pointer); rename → `AUTHOR_BOOK_PREMIUM_TARGET` (`:1131`), serialized `bar` field stable; shipped-control quorum guard (`shippedControl.ts:213-265`) degraded→floor-only+loud; `ACCEPTANCE-GATE-POLICY.md` states predicate verbatim + 2 owner questions, implements neither; **no threshold changed** (floor 74, margin 5, readers 3, caps 2/3 — re-verified directly) | Historical records without `validCount` get it **derived from the persisted readers array** rather than auto-degraded — stronger than the prompt's letter, evidence-based, pinned by tests; flagged for owner |
| P7 honest severities | F-06 (S2) | ✅ | High | `CHAPTERFLOW_STRUCTURAL_SAMENESS=enforce` promotes ARCH0-severe / CM0≥axesBlock to blocker; default advisory **byte-identical** (pinned both modes); dead ternary fixed (`architectureMonoculture.ts:205`); snapshot attached to acceptance records is provably outside docSha/pool-key inputs (`authorReview.ts:1243,1253,1331`) | Enforcement documented as pre-publish audit tool, not mid-campaign switch |
| P8 loud unverified keys | F-10 (S2) | ✅ | High | 3-state resolver (`quizKeyEvidence.ts:53-107`), reader evidence bound to current `chapterContentHash`; ⚠ summary on both BLOCKED and PROMOTED paths (`promoteBook.ts:850-858,953,994`); default fail-open + exit codes unchanged (quiz-key-gate 5/5 green); two-correct fixture honestly pins the judge gap incl. the false-flag direction; no session-id leak; no promote-time spawns | UNVERIFIED stays advisory (owner escalation deferred by design); per-chapter lines live in the structured report — confirm CLI print shows them (R5); latent stateRoot coupling if promote injection ever lands (R5) |
| P9 reserved-harm calibration | F-09 (S2) | ✅ | High | Table-driven `classifyComplaintHarm` (`authorReview.ts:628-677`), BLOCK-wins → aesthetic-downgrade → **ambiguous→block preserved**; 4 required corpus labels confirmed; second-opinion guard: exactly one non-persisting read, only sub-band ∧ no-reserved-harm ∧ pre-regen, after dead-end check, mutually exclusive with near-bar, never consumes regen | Fail-direction diff reviewed row-by-row: only aesthetic phrasings moved to downgrade |
| P10 pending-deploy visibility | F-11 (S2) | ✅ | High | Tolerant pure reader (`publishFinal.ts:147-179`, outer-root-missing ≠ clean); doctor WARN + >24h escalation (`doctor.ts:200-218`); book-status verbatim steps (`cli.ts:1886-1897`); `DEPLOY-RUNBOOK.md` complete (3 commands + working dirs + clear semantics); strictly read-only — sentinel writer remains only `publishFinal` | — |
| P11 self-contained promote tests + xenv | F-12/F-13 (S3) | ✅ (2 caveats) | High | promote-gate **17/17 pass on bare checkout** — fault-injection/idempotency/recovery/waiver assertions verified case-by-case intact; xenv is precondition-checked (file existence, fail-closed to xenv on probe error; a running test's throw is a REAL fail — cannot hide regressions); summary line distinguishes fail/xenv; bar-80 default test present; derive smoke covered by P1's reconcile tests | **Deviation:** no promoteBook state-root injection — fixtures are zz-namespaced in REAL state dirs with `finally` cleanup (pre-existing pattern; zero post-run residue verified, but a crashed run leaks and concurrent sessions can transiently collide — observed during this verification, resolved on completion). **Caveat:** two 1-chapter promote fixtures no longer exercise multi-chapter package ordering (covered residually by 2- and 3-chapter cases). **Caveat:** cast-discipline/name-commonality preconditions now require a shipped package, so they xenv on the active book (semantic change — owner awareness, R4) |
| P12 blocked-report leak + locks | F-14 (S3) | ✅ | High | Leak closed at the test (cleanup + count-stable assertions; **empirically: `_blocked` 61→5**, archive `_archive-2026-07-08/` holds 83 files + 83-line manifest, `execution`'s 4 real reports retained; two full suite runs during verification leaked nothing); retention keeps newest 5/bookId, epoch-pattern-safe, rename-never-delete; cleanupBookDebris `_blocked`-aware; doctor dead-pid lock detection (probe-only, prints `rm`); .gitignore adds `_archive-*` + `tests/.tmp`, keeps reports un-ignored; **v21 untouched** | — |

**Finding-level closure:** F-01✅ F-02✅ F-03✅ F-04✅ F-05✅ F-06✅ F-07✅ F-08✅ F-09✅ F-10✅
F-11✅ F-12✅ F-13✅ (distributed: predicate/classifier/revert-branch/detector/bar-80/derive tests
all exist and run) F-14✅ F-15✅ (constants renamed, docstrings truthful, policy memo + runbook
written).

---

## 3. How this was verified (method + independent checks)

Five parallel verification agents (one per implementation lane) checked every prompt requirement
against code with file:line evidence and ran ~20 focused suites. Independently of the agents, this
session verified the highest-stakes claims directly:

1. **Live F-01 kill-shot:** executed `voiceCard("start-with-why")` (read-only) against the
   **current, still-reverted** on-disk brief. Output card: `do:` carries only the two style moves;
   all three mandate moves absent; `never:` line intact. The poisoned artifact can no longer reach
   a writer.
2. **Accept predicate untouched:** re-read `authorReview.ts:1355-1358` — identical shape, floor 74,
   margin 5; rename to `AUTHOR_BOOK_PREMIUM_TARGET` confirmed at `:1131`.
3. **Leak empirics:** `_blocked/` inventory before/after two full suite runs — stable at 5 entries;
   archive + manifest present.
4. **No-book-rewrite check:** chapter/ledger mtimes pre-date the implementation session.
5. **Provenance-orphan trace (agents' open question):** provenance is one file per chapterId,
   overwritten on content transitions (`sessionProvenance.ts:187-211`) — after any revert/restore
   the record can attribute the restored bytes to the discarded draft's session. Consumers:
   session-independence gates (`qcAttestation.ts:317-329`, finalize) — off-by-default /
   no-api-mode-scoped. **Pre-existing across all revert paths** (P2/P3 added instances of an
   existing pattern, not a new mechanism). Bounded, but real → follow-up R2.

Focused suites run green during verification (selection): author-arch 62, eval-book-proxy 20,
sweep-rejected-and-control-e5 17, promote-gate 17, content-device-detectors 16, content-machinery 15,
pending-deploy-visibility 15, author-carry-e1-e2 13, repair-lane 13, publish-final 12, voice-card 8,
source-integrity 8, budget-carry-lock 7, manual-brief-reconcile 7, voice-moves-sanitizer 7,
architecture-monoculture 7, quiz-key-evidence 6, doctor-locks 6, blocked-report-retention 6,
manual-brief-rotation 6, structural-sameness-enforcement 5, quiz-key-gate 5, content-device-verify 4,
reserved-harm-corpus 2.

---

## 4. Whole-suite validation and failure classification

Commands: `npm run typecheck` (clean, exit 0); `npm test` — run twice:

```
pass 1856  fail 1  xfail 0  xpass 0  xenv(env-absent) 6  skip 12
```

| Item | Classification | Evidence | Action |
|---|---|---|---|
| 1 fail — `source-anchored-planning.test.ts` "…rejects nonexistent, wrong-chapter, placeholder, and unsupported anchors precisely" (`unsupported should raise SC11.6.unsupported_anchor; got SC11.2.anchor_specific_not_present`) | **Pre-existing known failure, NOT a regression.** Test file, `sourceGrounding.ts`, and every module the test imports are absent from the diff; the SC11.6 assertion exists at HEAD; the original audit's baseline explicitly listed "source-anchored SC11"; the clean-HEAD isolated-worktree baseline (1720/15) included it. (One verification agent guessed "regression from other uncommitted work" — corrected here with the above evidence.) | Real deterministic code/test disagreement about validator precedence — the last obstacle to `fail 0`. Follow-up **R1** |
| 6 xenv — generate-book-promotion (1), qc-run (1), cast-discipline (2), name-commonality (2) | Machine-checked env-absent (missing `drive`/`daring-greatly` gold chapters or shipped package). Preconditions are file-existence probes; the tests run and can FAIL wherever the corpus exists | The cast/name preconditions now also require a shipped package → they no longer run on the active book (semantic tightening) | Owner awareness — R4 (optional) |
| 12 skip | Pre-existing skip set, unchanged | — | none |
| Baseline delta | 14-15 fails → 1: 9 promote-gate failures became **real passes** (hermetic fixtures); 4-5 corpus failures became xenv; SC11 remains | — | R1 closes it |

---

## 5. Cross-fix integration audit

**Gate interactions — no loosening, no impossibility.** Chapter bar 80, floor 74, margin +5,
regen caps 2/3, tiebreak machinery: all unchanged (constants re-verified; predicate tests now pin
them). P7 enforcement is opt-in-off; P6's quorum guard only *strengthens* (a degraded shipped
control can no longer set the margin baseline); P9 moves only aesthetic phrasings to downgrade and
keeps ambiguous→block. Nothing converts an advisory to a blocker by default; nothing bypasses a
blocker.

**Repair/regen interactions — converge-safe.** The five ledger lanes remain independent; every new
write path consumes an existing grant; failed/reverted attempts still consume (no retry laundering);
P3 restore never refunds; P4's worst case per conductor entry = unspent content grants (≤1/lineage)
+ regen slice (≤3), then halt with an actionable message. Kill switches: `CHAPTERFLOW_REVIEW_REPAIR`
(pre-existing), `CHAPTERFLOW_CHURN_CONTENT_REPAIR` (new, default ON). PASS-protection is now
symmetric: budget lane (locks + A4) and acceptance lane (snapshot/restore/reopen-notes); the
sameness drivers keep their own revert.

**Sameness systems — now compose instead of fighting.** The write-time chain for a manual-brief
chapter is: sanitized HOUSE STYLE (P1) + always-on architecture-family/practice-shape rotation (P5)
+ 7-device content ban deal (P5) — with post-write ban verification (P2) in the repair lane, and
churn rejections routed to that lane first (P4). Detection double-surfaces practice-shell in ARCH1
and CM (telemetry only, intended). One vacuous guard (deal↔practice filter) documented as
forward-only.

**Manual-brief path — bypasses closed** for voice mandates, architecture family, practice shape,
content devices. Still machine-brief-only (unchanged, by design): example lenses/arcs, lead thread,
quiz stems, distractor modes — a documented residual, not a regression.

**Publish/deploy — honest and visible.** Promote report carries per-chapter key evidence; defaults
unchanged (fail-open, with the owner-decision escalation packaged in the policy memo); sentinel
readable and surfaced in doctor/book-status with escalation; runbook documents the cross-repo
chain; nothing auto-deploys; quiz-grades-from-bundle divergence remains an outer-repo property
(documented in the runbook).

**Cross-prompt conflicts found:** two, both documented and non-blocking — (a) P3×P4 kept-then-FAIL
prior-bytes nuance (halts safely; disk may end worse than entry until the next round); (b) P8×P11
latent stateRoot coupling (only material if a promote state-root injection lands later; none did).

---

## 6. Red-team of the final system

- **Can a bad chapter pass?** No easier than before — no gate weakened; keys now loud at promote;
  reader-side 9/9 unchanged. Residual: UNVERIFIED keys remain advisory at promote (owner decision,
  policy memo).
- **Can a good chapter get stuck forever?** Bounds unchanged and now better instrumented; P9's
  second opinion removes the one-taste-read regen burn; every halt names its escape hatch.
- **Can a true blocker be downgraded accidentally?** P9 preserves ambiguous→block; the corpus diff
  moved only aesthetic rows; ENFORCED_MAJOR set untouched.
- **Can passing chapters still be rewritten destructively?** The acceptance lane now restores on
  regression/failure; sameness lane reverts; budget lane locks. Watch item: the P3×P4 nuance above.
- **Can stale state poison a run?** The reverted brief is neutralized at card-build time (verified
  live); derive no longer clobbers; xenv preconditions re-arm automatically; stale locks are
  doctor-visible. The union working tree itself is the biggest stale-state hazard → commit first.
- **Can manual-brief books bypass the new systems?** No for voice/architecture/practice/devices;
  yes (unchanged, documented) for compiled-artifact levers.
- **Can sameness critics create fake variety?** Substitution telemetry surfaces the balloon
  effect instead of hiding it; the semantic panel remains the gate; enforcement flag defaults off.
- **Can acceptance reject forever with no repair path?** The live deadlock class is closed: churn
  rejections reach the content lane; both-lanes-spent halts with the manual command; new bytes
  reset the sticky gate.
- **Can publish happen without a current package/bundle?** Still manual-by-design; now visible
  (sentinel + doctor + runbook) instead of silent.
- **Can deploy verification be faked?** `verify:live` remains the outer repo's; this repo only
  reads the sentinel — no new writer or clearer was added (verified).
- **Can an agent think the pipeline passed on a narrow test?** The honest gap: **everything here is
  unit/integration-level.** No live model-generation run was performed — writer compliance with
  bans under the sanitized prompt, and the real acceptance outcome for start-with-why, are
  unmeasured. P2's statuses make the next live run *diagnostic*: `devices-persisted` outcomes =
  genuine writer ceiling; clean outcomes + acceptance = the pipeline was the binding constraint.

---

## 7. Functional readiness checklist

**Chapter-level:** generation ✔ (unchanged paths, tests green) · review ✔ · surgical repair ✔
(floor-82 lane intact) · regen bounded ✔ (caps + durable ledgers) · true blockers preserved ✔ ·
subjective complaints calibrated ✔ (P9, corpus-pinned) · passing chapters protected ✔ (all three
lanes) · stale state handled ✔ (reconcile, sanitizer, xenv, lock/pending-deploy visibility).

**Book-level:** assembly ✔ · acceptance detects cross-chapter problems ✔ (panel + deterministic
snapshot telemetry) · sameness repairable/preventable ✔ (deal + enforcement-verified repair +
routed lane) · content-deal diversity enforced ✔ at repair time (write-time remains prompt-level
by design) · fake variety surfaced ✔ (substitution telemetry) · book gate meaningful ✔ (predicate
pinned by tests; churn/floor caveats documented as explicit owner decisions in the policy memo).

**Operational:** tests sufficient ✔ (net +~140 tests; remaining gaps listed in R-prompts) · logs
actionable ✔ (distinct statuses, halts name commands) · transitions observable ✔ (reopen notes,
ledgers, snapshots) · publish/deploy explicit ✔ (runbook + sentinel) · manual interventions
minimized-but-present (deploy chain cross-repo by design) · no hard-coded local paths/secrets in
the new code ✔.

**Classification: Functionally ready but needs one validation run.** Blockers to "production-
ready": (1) uncommitted union tree — must be committed in reviewable slices and re-verified at each
commit (R3); (2) one controlled live run (`content-repair-book start-with-why` → `book-run --author
--no-publish`) to measure writer compliance and the acceptance outcome now that the prompt
contradiction is gone; (3) R1 (SC11 precedence) for a true `fail 0`. None of these is an
architecture problem; no S0/S1 issue remains open.

---

## 8. What was and wasn't run

- **Run:** typecheck; full suite ×2; ~24 focused suites; live read-only voice-card build; live
  state inventories (ledgers, `_blocked`, locks, chapters).
- **Not run (deliberate):** any model-generation (writing/repairing/reviewing chapters), any
  publish/deploy/push. Rationale: the task's controlled-run option is expensive, spends the owner's
  model budget on a book under an explicit owner HOLD, and the constraint "do not rewrite books"
  applies; all code-level behavior the run would exercise is covered by stubbed integration tests.
  The limitation is stated plainly in §6 and drives the readiness classification.
- **Side effects during verification:** none persistent. Transient test fixtures (zz-namespaced,
  including brief promote-fixture appearances in real state dirs) were cleaned by the suites'
  teardown; `_blocked/` count stable; no tracked file modified by this session beyond the two
  report files.
