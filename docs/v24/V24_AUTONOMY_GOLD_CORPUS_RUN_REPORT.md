# V24 Autonomy Gold-Corpus Run Report — the-culture-code

**Date:** 2026-07-09 · **Conductor:** the release-verifier session (autonomy validation mandate)
**Question under test:** can v24 reliably and autonomously produce books at the multipliers
level without manual rescue, hidden drift, or pipeline-language leakage?
**Pipeline at:** `116527f92` (CF-I campaign) + publish commit `3c84ae1eef98` · suite 1974/0
**Companion:** `docs/v24/V24_CF_I_RELEASE_VERIFICATION_REPORT.md`

## 1–2. Selected book and why

**`the-culture-code`** (Daniel Coyle). Mainstream narrative nonfiction with rich REAL cases
(Felps's bad-apple study, Pixar Braintrust, Edmondson's hospital research, Navy SEALs) — a
deliberately different flavor from HOM/multipliers (journalistic case-narrative vs practitioner
manual), so it tests generalization of the CF-I register rules rather than repeating the
training ground. Machine-brief path, representative of normal nonfiction.

## 3. Existing state and handling

Zero prior state anywhere (verified: no state dirs, no run dirs, no logs); doctor showed the
correct fail-closed `CHSET.index_missing` for a never-researched book. Nothing to isolate.

## 4. Run command and logs

`CHAPTERFLOW_ALLOW_MODEL_GEN=1 npx tsx src/cli.ts book-run the-culture-code --author
--no-publish --log logs/v24-release/the-culture-code.fresh-autonomy.<entry>.log` — 5 entries:
`20260709` (fresh), `resume2`…`resume5`.

## Entry journal (the autonomy evidence)

| Entry | What happened | Classification |
|---|---|---|
| 1 | Research 12 min → 16-ch TOC, packets/design/briefs first-try green (brief gate 0/0 — LJ1 silent, no BR1 this time). Write: **14/16 chapters wrote + gated clean**; ch02/ch06 exhausted retry budgets on MIXED causes (lead-contract + fleschEase / memorableClean + lead-contract) → honest bounded halt; failed drafts removed by the restore path; F-1 correctly silent (mixed causes) | writer ceiling, bounded + honest |
| 2 | ch02/ch06 wrote clean on fresh budgets. 16/16 blind-reviewed: 13 PASS; ch03/ch13 regen → PASS (87.1/86.6); **ch11 upheld FAIL through regen + median-of-3 tiebreak** — quiz Q5 key taught an over-specific rule the prose doesn't support + vocabulary tells → halt with self-healing repair prompt | legitimate reviewer catch (quiz) |
| 3 | ch11 quiz repaired per the pipeline's own repair prompt (quiz-scope only; ECHO SYMMETRY de-telling; validated deterministic-clean) → **ch11 blind re-review PASS 87.5**; 15/16 reviews CARRIED (carry system: 15 hit / 1 miss). Then the content-deal saturation lane targeted ch01 (drop proxy-cast); its regen draft carried a NEW quiz defect (Q7 rationale contradicted prose) → upheld FAIL → halt. **The failed acceptance-regen draft was rolled back by the F-2 restore path — live-proven again** | legitimate reviewer catch on a regen draft |
| 4 | ch01 quiz repaired per repair prompt (Q7 re-keyed to the chapter's actual rule as a MOVE; tells rebalanced across 6 questions). ch01 passed via **ship-majority tiebreak** (84.5F/86.1P/85.2P). **Acceptance REJECTED: pooled 72.1 vs floor 74, churn HIGH** — 2/3 panel readers flagged a source-fidelity smell: "the Will Felps institutional attribution… severe in chapters that repeatedly demand exact source discipline" | **research factual error caught by the outermost semantic net** |
| 5 | Root cause traced: the research sidecar minted "University of **South Wales**" (4×) — the source book says University of **New South Wales**. Deterministic gates cannot know external facts (the documented structural limit); the writer faithfully propagated the packet; the blinded book-level panel caught it. Fixed at every layer (sidecar, packet incl. extracted entities, chapter — 22 replacements, backups kept, grounding consistent both sides). ch01 fresh review **87.6 PASS**; acceptance re-ran with the **noise-band multi-read system (3 independent panel reads)** → pooled **75.4 ACCEPT**, gate PASS, 3/3 valid → **READY TO PUBLISH** | source/input issue, honestly resolved |

**NOT published** — autonomy validation only, per the run contract.

## 5. Chapter statuses and scores (final)

16/16 PASS, 82.8–88.1 range at final state: ch01 87.6 (post-Felps-fix re-review), ch02 84.1,
ch03 87.1 (regen), ch04 85.9, ch05 86.7, ch06 84.8, ch07 85.6, ch08 87.2, ch09 84.7, ch10 86.8,
ch11 87.5 (post-quiz-repair re-review), ch12 87.4, ch13 86.6 (regen), ch14 86.0, ch15 85.8,
ch16 84.2. All keys 9/9 at final review.

## 6. Repair/regen summary

- Write retries: bounded, 2 chapters needed entry-2 rewrites (mixed-cause exhaustion).
- Review regens: ch03, ch13 (converged); ch11 (didn't — repaired); ch01 content-deal regen
  (quiz defect — repaired; device change reverted by bounded lane, grant consumed).
- Content repairs (pipeline-prescribed, agent-executed, quiz/fact scope only): ch11 quiz, ch01
  quiz, Felps attribution (3 files + sidecars). Zero code changes during the run. Zero gate
  changes. All repairs validated by the deterministic stack before re-entry, then blind
  re-reviewed.
- Systems observed working: bounded halts ×4 (all honest, each with a self-healing repair
  prompt), F-2 restore (rolled back a failed regen draft live), review carry (15/16),
  median-of-3 + ship-majority tiebreaks, noise-band multi-read acceptance (3 reads), F-1
  correctly silent on mixed-cause failures, content-deal lane bounded (grant consumed, no
  loop).

## 7. CF-I leakage check (detectors over all 16 fresh chapters)

| Check | Result |
|---|---|
| C32 meta-case protagonist | **0** |
| C33 beat-vocabulary echo (per-chapter AND book-level) | **0** — the de-minted instructions produced zero echo from a cold start (the disease's mint is dead) |
| C34 citation-date doorway | **0** — ledes are scenes |
| C35 lineage-key quiz | **0** — no citation-rewarding keys |
| BP34 aphorism repetition (incl. hooks) | **0** |
| C30 duplicate example lessons | **0** |

Machinery narration did NOT reappear on a from-zero book. CF-I prevention generalized.

## 8. C31 evaluator-voice check

**Fired on 3/16 chapters** (ch04 9 openers, ch10 10, ch16 10; 30 opener fields total =
1.88/chapter vs HOM baseline 1.56, pre-repair multipliers 2.22). The write-time register rule
did not eliminate the tic; the three offending chapters gated clean on their first attempt, so
no retry/regen card ever carried the advisory (the surfacing works — these chapters simply
never entered a repair lane, and C31 is advisory by design). Honest classification: **the tic
is now measurable, routed when chapters cycle, but not prevented at first write.** Spot-read
confirms (ch10's example fields open "Who keeps the choice? …"). This is the campaign's known
residual, not a regression.

## 9. Anti-sameness / device results

- **proxy-cast 63% (10/16) — over the 60% cap by one chapter**; second-setting 50%,
  practice-shell 56%, return-proof 31% (under). The content-deal lane targeted ch01, its
  bounded grant was consumed without landing the device drop, and the system moved on honestly
  (advisory, not a gate). One chapter's drop would bring it under cap.
- Panel texture advisories: scene_skeleton 13/16 (cut-away-before-outcome shell),
  repeated_unit 8/16 (count-one-number practice shell) — same residual class as HOM (16/16)
  and multipliers; not a CF-I target; not blocking.
- LJ1 adjacent learning jobs: 0 advisories at the brief gate.

## 10–11. Quiz/card and example results

Quiz keys 9/9 on all 16 at final review; acceptance readers: "quizzes are answerable and the
keyed answers match my derivations" (all 3 readers keyed sound at the accepting round). Two
quiz defects were caught and repaired during the run (ch11 over-specific key, ch01
regen-introduced contradiction + tells) — both caught by blind review, both repaired in quiz
scope only. C30 = 0 (no duplicate example lessons); example craft held per reviews; C31
residual as §8.

## 12. Book acceptance result

**ACCEPT — pooled 75.4** (3 independent panel reads, noise-band protocol; band ±3.7; floor 74;
gate PASS; churn HIGH as telemetry). Below the 80 premium target (multipliers: 80.4) — this
book is publishable-grade, not premium-grade, and the panel's texture advisories say why
(scene shell + proxy-cast density). The earlier REJECT at 72.1 was the panel correctly catching
a factual error — the rejection→fix→accept arc is the system working, not noise.

## 13. Final classification

**B — functionally ready with non-blocking editorial risks.**

Why not A: the run needed 5 entries and 3 pipeline-prescribed content repairs (agent-executed
via the halt-emitted repair prompts — the designed self-heal loop, but not zero-touch); C31
evaluator voice persists at first-write on 3/16 chapters; proxy-cast tipped one chapter over
its advisory cap with the bounded lane spent; acceptance landed floor-adjacent (75.4) rather
than premium. Why not C: **zero engineering failures** — every halt was honest and classified,
every safety system fired correctly (restore, carry, tiebreaks, multi-read acceptance, bounded
lanes, F-1 discrimination), no gate was weakened, no code change was needed mid-run, and the
one factual error was caught by the layer designed to catch it.

## 14. Pipeline bugs found and fixed

**None during this run** (three content/state repairs, zero code). Pre-run release fixes
(committed `116527f92`, all verified): regen advisory surfacing, re-mint watchlist +
instruction re-words, C32 exemption tightening, promote-time machinery-tag strip.

## 15. Remaining risks

1. C31 first-write tic (3/16) — next lever candidates: a stronger register self-verify line, or
   routing C31 into the gate-retry card even on first-attempt passes (design decision — would
   add spawns; NOT recommended without measurement).
2. proxy-cast saturation on people-story books (this genre invites named casts) — the deal cap
   held everywhere else; consider whether the content-deal lane should get a second bounded
   grant when acceptance churn names the same chapter (design decision).
3. Research factual errors: no deterministic defense exists or is planned (structural — no-API
   semantic gate); the acceptance panel is the net and it worked; a research-time
   entity-verification pass is the only shift-left option (owner decision, cost).
4. the-culture-code is READY but NOT published and NOT approved for publish; the Felps-corrected
   research sidecars live only in this checkout's state.
5. Two books pending one deploy (HOM + multipliers).

## 16. Exact next command

Owner decisions, in order:
1. Deploy the two published books (clears both sentinels):
   `BOOK_CONTENT_BUCKET=<bucket> AWS_REGION=us-east-1 npx tsx scripts/book/upload-book-packages-to-s3.ts`
   then `gh workflow run deploy.yml -f environment=prod -f deploy_app=true` then `npm run verify:live`.
2. If the-culture-code should ship after review of its 75.4/churn-HIGH profile:
   `npx tsx src/cli.ts publish-final "the-culture-code"` (canonical; includes the branch push) —
   NOT run; awaiting explicit approval.
3. CF-G Phase 2 and CF-H remain deferred (owner checkpoints unchanged).
