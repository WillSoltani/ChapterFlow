# V24 Targeted Gold-Corpus Run Report — radical-candor

**Date:** 2026-07-09 · **Conductor:** v24 gold-corpus validation conductor (targeted autonomy +
drift-monitoring run; not a redesign campaign)
**Question:** can the finalized v24 pipeline autonomously produce another high-quality book
while avoiding CF-I leakage, C31 evaluator voice, proxy-cast overuse, churn-HIGH sameness, quiz
drift, source-fidelity errors, and repair-loop instability?

## 1. Branch and commit

`feat/anti-sameness-live-fix` at `3c84ae1ee` (publish commit for multipliers; CF-I campaign at
`116527f92` beneath it). No commits made by this run; tracked tree clean before and after.

## 2. Dirty state before run

Zero tracked modifications. Untracked debris classified: prior-campaign generated state
(the-culture-code chapters/reviews — READY, unpublished, untouched), pre-repair `.bak`
backups, run logs, zz-fixture noise — none of it shares a namespace with `radical-candor`; no
poisoning risk; nothing deleted.

## 3–4. Selected book and why

**`radical-candor`** (Kim Scott). Representative mainstream management nonfiction; rich REAL
named cases (Google/Apple-era stories) stressing proxy-cast discipline and source fidelity; a
2×2 framework stressing terminology/distinct-jobs surfaces; a third distinct author voice after
HOM (practitioner manual), multipliers (research leadership), the-culture-code (narrative
journalism) — a genuine consistency probe. Owner provided no explicit id; selection rules
applied (not SWW/multipliers/HOM/culture-code; zero prior state; machine-brief; catalog entry
`{bookId: radical-candor, title: Radical Candor, author: Kim Scott}` in `books.json`).

## 5. Prior state and handling

None existed (verified across `state/`, `.chapterflow/`, `logs/`). Nothing to back up or
isolate. Note recorded: the doctor's "could not resolve … using raw id" message is NORMAL for
any never-published fresh book (`resolveBookIdentifier` reads the app catalog + state indexes,
not the pipeline `books.json`); the raw id is exactly the catalog bookId.

## 6. Doctor result

`logs/v24-targeted-gold-run/radical-candor.doctor.20260709.log` — **missing input, expected**:
1 fatal `CHSET.index_missing` (the correct fail-closed state for a never-researched book,
identical to the HOM and culture-code pre-run doctors) + 2 known pending-deploy lifecycle
warnings (HOM, multipliers). Cleared to run.

## 7. Run command and logs

`CHAPTERFLOW_ALLOW_MODEL_GEN=1 npx tsx src/cli.ts book-run radical-candor --author
--no-publish --log logs/v24-targeted-gold-run/radical-candor.author-no-publish.<entry>.log` —
2 entries (`20260709`, `resume2`).

## 8. Chapter generation summary (entry journal)

| Entry | Events |
|---|---|
| 1 | Research 13 min → 9-chapter TOC; packets/design/briefs first-try green (brief gate 0 blockers, 0 advisories — LJ1 silent; no case collisions). Write: **7/9 clean first-entry**. ch04 exhausted retries on the practice-timer consistency contract (same action restated with different minutes — writer ceiling). ch09: **F-1 fired live, textbook run** — dealt lead "The Measurement Problem" (a concept label, exactly F-1's class) failed 2 lead-only attempts → deterministic degradation to "Bonus performance review unit" → degraded attempt failed on rubric (fleschEase, not lead) → honest halt, failed drafts removed by the restore path, **lead-failure memory persisted** for the next entry. Bounded halt with repair prompt. |
| 2 | ch04 and ch09 wrote clean on fresh budgets (ch09 guided past the remembered uncarriable lead). **All 9 blind reviews PASS first-try: 85.7–90.0** (ch08's 90.0 is the highest v24 chapter score recorded). Acceptance **first round: pooled 78.9, churn MEDIUM, gate PASS, 3/3 valid → ACCEPT** (floor 74; premium target 80 — 1.1 short, telemetry). Key-judge, sweep, 9 PUBLISHABLE attestations → **READY TO PUBLISH**. |

Zero review-fail regens. Zero tiebreaks. Zero content repairs. Zero code changes. Zero quiz
defects caught at any layer.

## 9. Per-chapter final status

All 9 PASS, keys 9/9: ch01 87.6, ch02 86.0, ch03 87.3, ch04 85.8, ch05 88.4, ch06 86.3,
ch07 85.7, ch08 **90.0**, ch09 87.6.

## 10–11. Repair/regen summary · halts

One bounded write-phase halt (entry 1), resolved by canonical re-entry — the designed loop. No
repair lanes consumed, no regen at review, no manual escapes, no state edits, no emitted repair
prompt needed execution. Restore path verified in-log (failed drafts removed, "the next entry
must re-write it, not review it"). F-1 degradation + cross-entry memory live-proven end to end
on a second book (after HOM ch14).

## 12. CF-I machinery leakage — CLEAN (1 justified advisory)

C32 meta-case: **0** · C33 beat-vocab per-chapter AND book-level: **0** · C35 lineage-key:
**0** · BP34 aphorisms (incl. hooks): **0** · C34 citation-date doorway: **1** (ch02's lede
carries its concreteness via the published-account framing — a fair advisory; the chapter
reviewed at 86.0). Direct spot-reads found no machinery narration, no beat vocabulary, no
provenance-as-story.

## 13. C31 evaluator voice — BEST RESULT TO DATE

Fired on **1/9 chapters** (ch02, 7 openers; book total 8 = **0.89/chapter** vs HOM 1.56,
culture-code 1.88, pre-repair multipliers 2.22). Advisory as designed; the chapter passed
review; the tic did not dominate the book. Trend across books since the register rule landed
is downward.

## 14. Proxy-cast — WELL UNDER CAP

proxy-cast **33%** (3/9 chapters — vs culture-code 63%, HOM 53%, multipliers 44%); zero
over-cap devices anywhere (named-anchor-lead 11%, hard-detail-boundary 22%, practice-shell 44%,
return-proof 11%). The book does not read as a string of invented people; the source's real
cast (Scott, Sandberg et al.) carries it.

## 15. Anti-sameness / churn

Churn **MEDIUM** (first fresh book not to trigger HIGH-churn repair routing). Hook shapes
varied across all 9 (claim/question/scene/statistic/second-person). Skill names 9/9 imperative
verb + concrete object, no verb monoculture ("Count Visible Care", "Price The Trust Signal",
"Cross-Out Careless Feedback"). No recycled aphorisms, no duplicate example lessons (C30 = 0).

## 16. Quiz/card quality

Keys 9/9 on every chapter at blind review; no lineage keys (C35 = 0); no quiz defects surfaced
at review or acceptance (first run of the four where quizzes drew zero complaints — the CF-I-3
"KEY IS A MOVE" rule plus the culture-code repair lessons appear absorbed).

## 17. Example quality

C30 = 0 (distinct lessons); C32 = 0 (no artifact protagonists); reviews 85.7–90 with no
example-craft mustFixes; spot-reads show reader-facing, applied prose ("Spend the awkward
minute while the fact is still useful"). Residual: ch02's evaluator-opener fields (§13).

## 18. Source fidelity

No factual smells raised by any of the 3 acceptance readers (the layer that caught the
culture-code Felps error). Real-world referents in spot-reads (Kim Scott / Sheryl Sandberg,
Google-era setting) match the source's public account and are framed as such. No invented
statistics observed; EW1/grounding stack silent.

## 19. Acceptance

**ACCEPT, first round: pooled 78.9** (band ±3.7, decision clear of the noise band — single
panel read sufficed), churn MEDIUM, gate PASS, valid 3/3, floor 74, premium target 80
(telemetry: 1.1 short).

## 20. Final gate readiness

READY TO PUBLISH — 9/9 gated + QC PUBLISHABLE, attestations written. **Not published** (task
contract); publish would be `npx tsx src/cli.ts publish-final "radical-candor"` after owner
approval (canonical transaction includes the branch push).

## 21. Classification

**B — pass after designed repair loop.** One bounded write-phase halt required one canonical
re-entry; everything else was first-try. No code changes, no content repairs, no gate changes —
the closest any fresh book has come to Class A (which this rubric reserves for zero-re-entry
runs). Against the four-book series: entries 5 → 2, content repairs 3 → 0, acceptance rounds
2 → 1, churn HIGH → MEDIUM — the trend the consistency question was asking about.

## 22. Pipeline bugs found and fixed

**None.** No fix-prompts file is warranted (per the rule: fix prompts only for verified
engineering bugs). No `V24_TARGETED_GOLD_CORPUS_FIX_PROMPTS.md` written.

## 23. Remaining editorial risks

1. C31 evaluator-opener tic: 1/9 chapters (ch02) — advisory, downward trend, watch.
2. C34 citation-framing lede: 1/9 (ch02) — advisory.
3. Acceptance 78.9 < premium 80 — the fleet's floor-adjacent band persists (HOM 78.8,
   culture-code 75.4, multipliers 80.4 only after repair); the scene-shell texture residual
   remains the likely premium ceiling and is a future editorial campaign, not a bug.

## 24. Publish/deploy/push

**None occurred.** No publish, no S3, no deploy, no push, no gate or policy change;
`multipliers` and `the-culture-code` untouched (tracked tree byte-clean at `3c84ae1ee`
throughout).

## 25. Exact next command

If the owner wants radical-candor shipped after reviewing this report:
`npx tsx src/cli.ts publish-final "radical-candor"` (requires promote first:
`npx tsx src/cli.ts promote-book radical-candor --title "Radical Candor" --author "Kim Scott"`
— title/author from the run's research TOC; note the publish transaction pushes the branch).
Otherwise the standing owner queue is unchanged: deploy run for HOM+multipliers sentinels;
the-culture-code publish decision; CF-G Phase 2 / CF-H checkpoints.
