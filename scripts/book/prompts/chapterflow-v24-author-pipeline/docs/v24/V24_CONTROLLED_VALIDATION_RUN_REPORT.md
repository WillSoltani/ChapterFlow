# V24 Controlled Validation Run — Report

**Run date:** 2026-07-08, 02:18–04:11 local (ADT) · **Conductor:** validation session (this report)
**Branch:** `feat/anti-sameness-live-fix` · **HEAD:** `66d104666` (P12) — the 8 fix-wave commits
(P1→P12) are committed; the 5 follow-up fixes (R1 SC11 precedence, R2 provenance restore, R4
calibration-scan, R5 key-evidence stateRoot/lines — R3 was the committing itself) are present as
**uncommitted** working-tree changes (10 files, +452/−10), captured in the checkpoint diff.
**Book:** `start-with-why` (14 chapters, author architecture)

---

## 1. Outcome classification

# **B — Functionally ready; book still rejected on legitimate quality policy.**

Every pipeline mechanism exercised by this run behaved exactly as designed and specified; **no
pipeline bug was found**. The book was rejected by the acceptance panel for the same honest reason
as before — cross-chapter sameness texture and the beat-shipped margin — and the run terminated in
a bounded, fully-attributed content halt with an actionable repair prompt. The previously-untestable
"writer ceiling" hypothesis now has **measured live evidence** (see §5): the writer sheds the banned
device in only ~2/6 explicit attempts, reproduces it in 2/6 despite the ban reaching the prompt, and
introduces quality/key defects in 2/6.

**No publish, no deploy, no push, no gate change, no policy change occurred.**

---

## 2. Pre-run state (Phase 1)

- `git status`: only the 5 follow-up fixes dirty (expected; they are part of what was validated) +
  known untracked debris. No merge conflicts, no publish/deploy changes, no gate-lowering
  (accept predicate re-verified: floor 74, +5 margin, premium target 80 telemetry).
- **Pre-run test gate:** `tsc --noEmit` clean; full suite **pass 1871 / fail 0 / xenv 6 / skip 12**
  — R1 closed the last pre-existing failure (SC11 precedence). First fully-green suite on this
  checkout.
- **Checkpoint** (backup, per constraint "no deletion without backup"):
  `logs/v24-validation/checkpoint-20260708/` — all 14 chapter files, the full review tree, regen
  ledger, rubric metrics, brief, HEAD hash, `status.txt`, `uncommitted.diff` (1.0 MB).
- Stale-state check: brief on disk = the committed de-mandated version (restored during R3);
  sanitized voice card verified CLEAN before the run.

## 3. Log files created

```
logs/v24-validation/start-with-why.doctor.20260708-021852.log
logs/v24-validation/start-with-why.content-repair.20260708-0230.log
logs/v24-validation/start-with-why.book-run.20260708-0345.log
logs/v24-validation/checkpoint-20260708/            (state backup + uncommitted.diff)
```
(One aborted invocation before the repair run failed on a wrong working directory —
`ERR_MODULE_NOT_FOUND` for `src/cli.ts` from the repo root; conductor-side wiring, not a pipeline
issue; rerun from the pipeline dir succeeded.)

## 4. Doctor (Phase 3)

**PASS — 0 fatal, 8 checks passed, 1 warning.** The warning is the known legacy sectioned-TOC shape
(`toc-contract: TOC uses sections; run toc-migrate --apply`) — pre-existing, migration tooling
exists, sectioned TOCs are round-trip-tested. The new P10/P12 doctor checks (pending-deploy, stale
locks) reported clean. No publish/deploy action triggered.

## 5. Content-device repair (Phase 4)

Command: `CHAPTERFLOW_ALLOW_MODEL_GEN=1 npx tsx src/cli.ts content-repair-book start-with-why --log …`
Duration ~80 min, exit 0. Writer: gpt-5.5 @ xhigh.

**Planner diagnosis (validates the P5 catalog fix):** the six original devices were all ≤60%
ubiquity going in (named-anchor 57%, second-setting 43%, proxy 36%, hard-detail 36%, return-proof
29%, three-part 14%); the ONLY over-cap device was **practice-shell at 100%** — precisely the device
the original catalog missed (finding F-07). Min-cover selected ch01–ch06 (`drop practice-shell`),
preserving ch07–ch14.

**Per-chapter statuses (driver summary, verbatim classification):**

| Ch | Status | Draft composite | Detail |
|---|---|---|---|
| 01 | **kept-and-clean** (repaired) | 83.2 (near-bar; formalized at 87.1 in Phase 5) | banned device shed; substituted hard-detail-boundary (telemetry, non-banned) |
| 02 | **reverted-quality** | 84.7, keys 9/9, valid | draft carried a reserved-harm/true-blocker complaint → prior passing bytes restored |
| 03 | **devices-persisted** | 85.8 (review-passing!) | draft still used banned `three-part-split` — evidence snippet logged; reverted, grant spent |
| 04 | **kept-and-clean** (repaired) | 85.7, ship=true | clean |
| 05 | **reverted-quality** | 87, **keys 8/9** | draft introduced a key defect → restored |
| 06 | **devices-persisted** | 86.4 (review-passing) | draft still used banned `proxy-cast` (evidence: `invented name(s): Houston`) — reverted, grant spent |

Summary line: `kept-and-clean 2, devices-persisted 2, reverted-quality 2, write-failed 0,
skipped-cap 0` · preserved chapters **byte-stable** ✓ · device ubiquity after: practice-shell
100%→**86%** (still over-cap), named-anchor 57→50%, hard-detail 36→43% (measured substitution).

**Bounded/ledger verification:** `contentRepairConsumed` went from empty to exactly 6 entries
(ch01–06); no other lane touched by the driver; failed/reverted attempts correctly consumed grants;
zero unintended chapter modifications.

**`devices-persisted` appeared — interpretation (per the run's diagnostic rule):** this is
**measured writer-ceiling evidence, not a pipeline failure.** The directive demonstrably reached the
writer (the ban is rendered in the card; the drafts show attempted compliance and substitutions),
and validation is demonstrably working (evidence snippets logged; reverts byte-exact). Confidence
per chapter: ch03 **high** (three-part-split matched mid-prose framework text); ch06 **medium** —
"Houston" is not in the proxy detector's real-name/place allowlist, so if the draft used Houston as
a *place*, this is a detector false positive (the draft was discarded, so it cannot be adjudicated
post-hoc; failure direction was safe either way — prior passing bytes kept). Noted, with two small
non-blocking improvements suggested in §9.

**Also observed (non-blocking):** every repair card exceeded the 25,000-char diet target
(29.3–31.0k; the repair directive + always-on sections inflate it) — the existing warning path
fired and proceeded, as coded. And a design tension worth an owner note: the deterministic ban
rotation gave `three-part-split` to ch03 — the Golden Circle chapter — i.e. content-blind dealing
can ban the shape a chapter's core concept naturally takes.

## 6. Full author review + book acceptance, no publish (Phase 5)

Command: `CHAPTERFLOW_ALLOW_MODEL_GEN=1 npx tsx src/cli.ts book-run start-with-why --author --no-publish --log …`
Duration 27 min, exit 0, terminal state: **bounded content halt** (below). Cost report: 21 spawns
(12 book-readers, 4 chapter reviews, 3 shipped-control, 2 writers), retries 1, carry: reviews
**12 hit / 2 miss**, acceptance 0/1.

**Chapter reviews:** 12/14 CARRIED durable reviews with **zero reader spawns** — including the four
restored chapters, proving the restore↔carry invariant live (restored bytes still match their prior
persisted reviews). Fresh reads only for the two changed chapters: **ch01 87.1 PASS**, **ch04 85.5
PASS** (ship=true, keys 9/9). All 14 chapters PASS at bar 80.

**Acceptance round 1** (fresh docSha → fresh pool; sticky FAIL from the old bytes correctly did not
carry): sample ch 1,2,6,11 (one repaired + two restored-molded + one preserved). Multi-read median
machinery worked exactly as specified — read 1 pooled 73.9 within ±3.7 of the binding boundary
**77.1** (= live shipped-control 72.1 + 5; 3-valid-reader control, quorum guard satisfied) → read 2
(74.05, still in band) → read 3 (cap) →
**REJECT: pooled 74.2, gate PASS (3/3 readers, all reads), churn HIGH, valid 3/3; floor 74 met;
beat-shipped 77.1 NOT met.** The honest new log format printed the full predicate arithmetic.

**Rejection routing (the P4 chain, live):** churn HIGH → **content lane first**: planner re-selected
ch02/03/05/06 (drop practice-shell) → all four **skipped-cap LOUDLY** (grants spent in Phase 4;
bounded, no double-spend) → unfixed set fell through → regen lane: ch02 skipped loudly
(regen-exhausted), guarded regen round over **ch03, ch05** only. **Reopen notes written**
(`reopened-for-acceptance` / `acceptance-regen`, carrying the churn complaint) — first ever for this
book; the F-03 attribution gap is closed in production. Both regens kept: ch03 87.0 PASS (up from
84.8), ch05 85.4 PASS (within band of 86.0) — no restore needed; the P3 guard had nothing to
correct, which is itself the desired outcome.

**Acceptance round 2:** salted sample force-including the regen targets (ch 2,3,5,6 — the four
weakest/molded chapters): **REJECT — pooled 73.1, gate PASS 3/3, churn HIGH** (this round even
under the 74 floor, on the adversarial sample). Terminal:
`AUTOPILOT HALT [phase qc · content]: author acceptance still REJECTED after the one targeted regen
round` — with all three reader verdicts printed in full and a repair prompt artifact written
(`state/repairs/start-with-why/book-run/qc.20260708071102.94b8aa15.repair.md`).

**Panel comments (churn/tone/density):** unanimous across both rounds — correctness is clean ("no
keyed answer contradicted by the prose"), individual craft praised ("sticky diagnostic lines",
"reusable lens"), but the texture "reads heavily engineered… heavily templated"; churn HIGH on every
read. Practice-shell remained at 86% through both rounds.

**Would the final gate allow publish?** No — the book is not accepted, and nothing attempted to
force it. `--no-publish` held; no package, sentinel, or registry file changed (verified via git
status after the run). The brief also survived the run's auto-derives byte-identical (live proof of
the P1 non-clobbering reconcile inside book-run).

## 7. Post-run ledger/state verification

- `consumed` (regen): 8 chapters (added ch03, ch05 this run) — global cap arithmetic correct.
- `contentRepairConsumed`: exactly ch01–06. `samenessRepairConsumed`: untouched (11, from July 6).
- Reviews: new durable PASS records for ch01/03/04/05; carried records intact for the rest.
- Acceptance records: `acceptance.round1.e1a5e5e6.r1–r3.json`, `acceptance.round2.62a242a4.r1.json`
  — all quorum-met, durable, with the structural-sameness telemetry snapshot attached.
- Checkpoint remains at `logs/v24-validation/checkpoint-20260708/` for byte-level diffing.

## 8. Evidence for classification B (and against A, C, D)

- **Not A:** book acceptance rejected (74.2 then 73.1 vs binding 77.1; round 2 below even the 74
  floor on the adversarial sample). No hidden blocker — the rejection is fully attributed.
- **Not C:** zero pipeline defects observed. Every claimed mechanism was exercised live and behaved:
  bounded lanes (0 double-spends, loud skips), byte-exact reverts, device verification with logged
  evidence, restore↔carry invariant, multi-read median + band + cap, honest predicate logging,
  churn→content→regen routing order, reopen notes, no-publish discipline, non-clobbering derive,
  cost accounting. The suite was green (1871/0) before the run.
- **Not D:** environment, model access, and artifacts all functioned; results are fully
  interpretable.
- **Why the rejection is legitimate quality/policy, not a bug:** the panel's stated reason
  (templated texture) matches the deterministic telemetry (practice-shell 86%, substitutions
  measured); the margin policy (+5 over live shipped control) is the documented owner calibration
  (`ACCEPTANCE-GATE-POLICY.md`), untouched by this run; and the writer-side evidence (2/6 shed rate,
  2/6 devices-persisted at review-passing quality, 2/6 quality regressions) now supports the
  "writer ceiling" component that was previously unproven.

## 9. Non-blocking observations (recorded, no fix prompts warranted)

Per the run constraints, none of these is a verified pipeline bug; none blocks; all are logged for
the owner/backlog:

1. **Proxy-detector place-name gap ("Houston"):** add common city names to `REAL_NAME_RX`'s
   place guard and widen the logged evidence snippet (one line of surrounding prose) so future
   `devices-persisted` verdicts are post-hoc adjudicable. Tiny, detector-precision only.
2. **Revert log should quote the failing complaint:** ch02's revert is attributable only by
   predicate elimination because the draft review is non-persisting; one log line with the mustFix
   complaint text would make quality-reverts self-explanatory.
3. **Repair-card diet:** repair-path cards run 29–31k vs the 25k target (warning fires, proceeds).
   Worth a diet pass on the directive/packet composition eventually.
4. **Content-blind ban rotation:** the rotation can ban a chapter's concept-native shape
   (three-part-split on the Golden Circle chapter). A concept-affinity exception in the dealer is a
   design question for the owner, not a defect.
5. **Provenance multi-hop staleness:** the R2 guard fired correctly four times (refused unsafe
   rollback on hash mismatch — records predate this run's transitions). Records for ch02/03/05/06
   currently attribute discarded drafts; consequence-free while session-independence enforcement is
   off, and un-fixable retroactively without fabrication. Known, bounded.

`V24_POST_VALIDATION_FIX_PROMPTS.md` was **not** created — the run exposed no verified pipeline bug.

## 10. What remains is an owner decision, not engineering

The pipeline converged to its designed terminal: 14/14 passing chapters, clean correctness, bounded
budgets spent, honest rejection on the +5 premium margin with churn HIGH texture. The standing
options (unchanged from `ACCEPTANCE-GATE-POLICY.md` §owner-decisions and the original audit):
**(a)** accept the margin policy outcome and hold v1 as published; **(b)** revisit the +5 margin /
churn policy (explicit sign-off, policy memo already drafted); **(c)** attempt further de-molding
with the measured expectation that the writer sheds the practice-shell ~1/3 of the time per attempt
(remaining unspent content grants: ch07–ch14; regen remaining: ch7,8,9,10,12,13).

## 11. Exact next command

No further pipeline command is required or recommended until the owner decides §10. For review:

```bash
# inspect the run end-to-end
less logs/v24-validation/start-with-why.book-run.20260708-0345.log
# the halt's repair prompt (if pursuing option c)
less state/repairs/start-with-why/book-run/qc.20260708071102.94b8aa15.repair.md
# commit the 5 follow-up fixes (R1/R2/R4/R5) — they are validated but uncommitted
git add -p   # then commit per-fix, do NOT push
```

---

### Final constraint attestation

Not pushed · not published · not deployed · no gate lowered · no policy doc rewritten · no state
deleted (checkpoint backup created first) · failing outcomes reported verbatim · classification
based on captured evidence only.
