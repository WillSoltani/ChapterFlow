# V25 S-Tier Program — Open Owner Decisions

Format per §13 of the master plan. Answers are recorded in `V25_DECISION_LEDGER.md`.

---

## D-1 — P5 readiness-campaign freeze timing

**Decision required:** When to stop minting readiness identities (accepted finding V25-01/05 retires them from the ship path).
**Why blocked:** A v6 identity ("packet-E assembly re-slot ruling", commit `97b78bf71`) is committed and possibly mid-execution in another active session's worktree. Lane 2 (WP-202) must not yank machinery out from under a running owner-ruled campaign.
**Options:**
- **(a) Freeze immediately.** Benefit: stops further spend now (~84 calls saved). Drawback: discards an owner-ruled in-flight campaign mid-identity; the v6 ruling's information (packet-E assembly re-slot) is lost; risks colliding with the other session. Reversibility: low (spent calls are spent).
- **(b) Let v6 run to its ceiling, then freeze (RECOMMENDED).** Benefit: no collision; v6's result (like v5's first-ever source qualification) becomes final advisory-role seeding evidence; clean campaign closure. Drawback: up to ~84 more calls. Reversibility: n/a.
- **(c) Continue campaigns until a full role set freezes.** Rejected by the accepted audit: the design re-spends per identity and has never converged in 6 identities (~349 P5 calls + 338 V3 calls).
**Recommendation:** (b). **Default action if approved:** WP-004 coordinates closure after v6 concludes; WP-202 executes afterward.

## D-2 — Advisory-reviewer seeding without formal qualification

**Decision required:** Accept that the advisory review lane starts with the identity-scoped v5/v6 role selections (reader `gpt-5.6-sol@high`, source `gpt-5.6-sol@xhigh`, quiz `gpt-5.6-sol@xhigh`) **without** a completed formal qualification campaign.
**Why blocked:** Formal qualification is being retired (V25-01); no complete qualified role set exists; the lane is advisory-only (never publish-blocking) under the target architecture, and the ship gate is D7 (Claude-side).
**Options:**
- **(a) Accept advisory seeding from v5/v6 selections (RECOMMENDED).** Benefit: reuses the only reviewer evidence that exists; zero extra calls; risk contained by advisory status + different-model-from-writer rule. Drawback: reviewer precision unmeasured; mitigated by tracking advisory-finding precision during the bakeoff and pilot (removal condition: precision persistently <50% → drop the lane).
- **(b) No advisory lane at all.** Benefit: simpler. Drawback: loses the one cheap early-warning layer before expensive D7 audits; historical reader reviews did catch real defects.
**Recommendation:** (a). **Default action:** WP-403 implements with the precision-tracking removal condition.
**Bundled acknowledgment (verifier M9):** if the writer model resolves to gpt-5.6-sol (the provisional default, D-9b) and terra/luna prove unsupported (WP-502), the advisory lane cannot satisfy different-model review; it then runs sol at a different effort with reduced finding weight. Independence of the SHIP decision is unaffected — the D7 gate is Claude-side.

## D-3 — Bakeoff live-call authorization and ceiling

**Decision required:** Authorize Phase 6 live calls: capability probe (≤10) + staged bakeoff, hard ceiling **150 codex sessions total**, plus Claude-side D7 audits (all ledgered).
**Why blocked:** Program rule: no live model calls without explicit owner authorization; first live calls occur at Phase 6.
**Options:** (a) authorize at plan approval (fastest); (b) authorize at Phase-6 entry after G5 passes (RECOMMENDED — calls only spend once the pipeline they measure is stable); (c) reduced ceiling (e.g. 100 — risks an unfinished Stage 3).
**Recommendation:** (b). **Default action:** Phase 6 blocks until a written authorization lands in the decision ledger.
**Bundled acknowledgments required with D-3:** (i) terra/luna existence on the subscription is unproven — the capability probe (WP-502) may return UNSUPPORTED_MODEL_CONFIG, shrinking the bakeoff to the supported set; (ii) the pre-registered screening halt (no config reaches D7 mean ≥75 → program halt + owner escalation, audit change-condition C→D) is binding — the bar is never lowered mid-flight; (iii) tie-break 7 and pilot acceptance require owner blind-read availability — the release gate cannot self-certify human sign-off.

## D-4 — PR #401 residual raw-evidence disposition

**Decision required:** Move the residual raw campaign evidence (state/migration-experiments run dirs, v4–v6 corpora) from PR #401 to the evidence branch (as PR #405 did for the larger trees), or leave it.
**Why blocked:** touches a shared PR and the evidence-retention policy.
**Options:** (a) move to `evidence/v25-retained-*` with hash-verified preservation (RECOMMENDED; target: reviewable code-only PR ~305 files); (b) leave as-is (PR stays +800k lines, unreviewable).
**Recommendation:** (a). **Default action:** WP-004 executes the move with byte-identity proofs; no deletion, only relocation.

## D-5 — Phase-8 deletion gate for retired paths

**Decision required:** Authorize actual deletion (not just retirement) of the v23 compiler path, v22 legacy path, and archived campaign machinery after the pilot book passes (WP-804).
**Why blocked:** irreversible removal of large subsystems; the audit's archive-not-delete rule requires explicit owner approval for deletions.
**Options:** (a) delete at Phase 8 after G8 (RECOMMENDED — evidence-backed, single cleanup); (b) keep behind flags indefinitely (carries the four-architecture confusion the audit flagged).
**Recommendation:** (a). **Default action:** WP-804 deletes only what G8 evidence shows unused, with proof-of-non-use per item.

## D-6 — D10 progressive-rendering web-app PR

**Decision required:** Confirm the D10 mode mapping (Standard = fast+deep, Challenge = all three tiers) and its timing (it changes the live reading experience for every catalog book; no catalog regeneration).
**Why blocked:** product-behavior change outside the pipeline; ratified in principle (D10) but the exact mapping ships to real readers.
**Options:** (a) implement now in parallel (RECOMMENDED — fixes the live ~15%-of-prose defect soonest, and D7's layer-independence gate assumes the new rendering); (b) defer until after the pilot (readers keep the defect longer; D7 audits then gate on a rendering users don't see yet).
**Recommendation:** (a). **Default action:** WP-405 proceeds as a separate web-app PR with visual + unit tests and owner UX sign-off before merge.
**Sub-question (drafter-flagged, D8-vs-D10 tension):** D8/Chapter-Format-v25 F-1 makes NEW chapters' layers independent (each self-contained), so blind concatenation would DUPLICATE content for future books while it correctly recovers hidden prose for the existing serial-layer catalog. Options: (i) gate concatenation on a schema/authoring marker — concatenate only pre-v25 serial-layer books; new F-1 books render single-layer-per-mode as designed (RECOMMENDED); (ii) concatenate everything (duplicates future content). **Recommendation:** (i).

---

## D-7 — Bakeoff authoring source for the 3 fixed chapters

**Decision required:** Supply or confirm the authoring INPUTS (draft/manuscript or a one-time-frozen compiled source-packets + chapter-briefs set) for nudge ch03, made-to-stick ch04, and the-happiness-hypothesis ch06, and authorize running the compile chain (research → packets → briefs) once to freeze them.
**Why blocked:** The in-repo artifacts for these books are OUTPUTS (reader docs, shipped packages), not pipeline inputs. Without frozen inputs the fixed corpus cannot be authored by any candidate model, and WP-701/703 cannot run.
**Options:** (a) authorize a one-time compile-chain run against the books' source material, freeze and hash the resulting packets/briefs as the corpus (RECOMMENDED — makes the comparison exactly reproducible); (b) hand-supply a curated source set per chapter (more owner effort, same effect).
**Recommendation:** (a). **Default action:** WP-701 executes the one-time freeze; the compile-chain calls count against the Phase-6 ledger.

## D-8 — Formal D7 bar ratification + on-fail budget semantics

**Decision required:** Formally ratify the D7 ship-gate bar (chapter mean ≥85 / min ≥80, core domains ≥3.0, layer independence, ±3.0 calibration void) and the on-fail policy: re-author FAILING CHAPTERS ONLY, at most ONE re-author round per book per audit, then halt for owner.
**Why blocked:** `docs/v25/reports/V25_OWNER_RUBRIC_RECONCILIATION.md` still marks D7/D8 "PENDING OWNER RATIFICATION — not yet in force", while the accepted audit treated them as ratified by delegated judgement. WP-401 wires a BLOCKING gate; that needs an unambiguous bar. The frozen instrument pins meanMin=85/perChapterMin=80/coreFloor=3.0.
**Options:** (a) ratify 85/80/3.0 as-is (RECOMMENDED — matches the frozen, owner-run-bit-compatible instrument); (b) set a different bar (requires re-pinning the instrument and invalidates the sealed baselines' band interpretation).
**Recommendation:** (a), with failing-chapters-only re-author and a per-book-per-audit budget of one round. **Default action:** WP-401 wires the gate with these exact semantics; the gate never applies retroactively to the 140 historical books.

## D-9 — Technical ratifications (bundled)

**(a) tellRate reconciliation direction (WP-402).** The 0.20 tellRate gate duplicates the lengthTell longest-side signal and rejects the owner's reference-standard norm (top book 79% key-longest). Options: demote tellRate to warn-only, keeping the shortest-side cap (=4) as the real safety gate (RECOMMENDED); or raise the threshold above the corpus max (~0.79+), which keeps a gate in name but makes it inert. **Recommendation:** demote to warn.
**(b) Provisional BASELINE_MODEL (WP-501).** After the 5.5 purge the tree needs a compilable default before WP-705 decides. Options: provisionally set `gpt-5.6-sol` (the only 5.6 model with any qualification evidence — P5 v5 roles) flagged `PROVISIONAL_PENDING_WP-705` (RECOMMENDED); or fail-closed no-default (tree red until Phase 7 — safer but blocks all Phase 2–5 test runs). **Recommendation:** provisional sol.
**(c) Unified-ledger location (WP-503).** `state/run-ledger/` is tracked (not gitignored) but CLAUDE.md warns against bloating `state/`. Options: bounded per-run JSONL + per-book rollup under `state/run-ledger/` with a size-capped retention rule (RECOMMENDED); or a new top-level `ledger/` dir. **Recommendation:** the former, cap enforced by test.


## D-10 — Old-line P6 stage-1 pilot vs the S-tier program (NEW 2026-07-16T12:10)

**Decision required:** The other active session is building P6 stage-1 SOL-pilot machinery on feat/v25-pipeline-live (a7bd9b761, b19b847b2, 9a9b18e14 — readiness-v6 qualification binding, stage-scoped campaign engine, driver pilot entrypoint). Construction only so far; no live calls observed. Should the old-line P6 pilot run?
**Why blocked:** L-15 recorded that the S-tier program supersedes the old-line P6; a P6 pilot would spend live calls under the architecture the accepted audit retired (reviewer-lane ship gating, not D7). Only the owner can arbitrate between their two active lines.
**Options:** (a) HALT old-line P6; the S-tier Phase-6 bakeoff is the sole authorized live-call vehicle; the v6 role freeze remains advisory-lane seeding (RECOMMENDED — consistent with the approved plan and D-3). (b) Allow a BOUNDED old-line P6 stage-1 as extra evidence (uses the frozen v6 roles; but spends calls against a superseded ship gate and fragments the call budget). 
**Recommendation:** (a). **Default action:** none — the S-tier program cannot and will not touch the other session; this program continues model-free either way.


## D-11 — D7 receipt trust model: keyless vs signed (NEW 2026-07-16, non-blocking)

**Decision required:** Accept the D7 ship-gate receipts as keyless self-consistency artifacts (current), OR invest in cryptographically SIGNED receipts before REQUIRE mode goes live (WP-802 pilot).
**Why raised:** Three red-team rounds fully bound the verdict against field-level tamper (scores/domains/gates/custody/pair-chain all cross-checked). Two residuals remain, BOTH requiring a state-writing adversary with filesystem access to the retained audit tree: (NOTE B) receipts are keyless, so a state-writer could in principle reconstruct a whole consistent forged audit chain; (NOTE A) if two raters DISAGREE on a hard gate and the adjudicator sided with the stricter one, a state-writer could rewrite the adjudication to the more-permissive rater's value. Neither is a runtime-provable ship path on any in-tree bytes; both are contained by REQUIRE-mode's retained-audit mandate + the trust that the state tree is not adversarially writable.
**Options:** (a) ACCEPT keyless + document the trust boundary (state tree is not adversary-writable; the pilot runs on a controlled CI checkout) — RECOMMENDED, zero extra work, matches the actual threat model (the operator running the pipeline is not the adversary). (b) SIGN receipts with a key (Ed25519 over the canonical receipt + custody) before WP-802 turns REQUIRE on — closes NOTE B fully and NOTE A transitively, but adds a key-management surface and ~1 WP of work for a threat (malicious state-writer) not in the current model.
**Recommendation:** (a) accept keyless for the pilot; revisit signing only if the ship path ever runs where the state tree is writable by an untrusted party. **Default action:** WP-802 sets REQUIRE=1 on a controlled checkout; the residual is documented, not code-changed.
