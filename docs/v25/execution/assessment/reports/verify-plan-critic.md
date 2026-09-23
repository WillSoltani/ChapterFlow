# verify plan-critic

## corrections
- H3: "37 PRs were merged in #525–#564 (36 if the #525 docs handoff is excluded); #557 does not exist, and #559 and #566–#575 are open."
- H5c: "A rubric FAIL replays for that candidate at zero cost, but the stored record is re-judged against the current run's bar. A FAIL on the composite alone becomes promotable if the owner lowers CHAPTERFLOW_RUBRIC_BAR (60–95). A FAIL on the factor floor (70, a code constant), on churn HIGH, or on the correctness gate (FAIL or SPLIT) is final for that candidate."
- Add to H5c: "The rubric's correctness gate needs a unanimous 3-reader PASS and fails closed on a SPLIT. The only earlier 3-reader card on a Franklin package split 2 PASS / 1 FAIL. The rubric readers never see the source, so the source-fidelity judge in fresh QC is the only accuracy gate."
- D2: "How many panels strict 2-of-3 would have passed depends on how two seats' findings are matched. Chapter+category matching passes 2 of the 13 completed panels (P10, P12; the first at 09-20 06:05). The analyst's semantic matching passes 4 (the first at P8, 09-19 21:24). Normalised unit-string matching passes 7. The owner must choose the matcher as well as the rule."
- D2 adjudication: "Adjudication is unlikely to reach PASS on its own. In the 17-blocker ground-truth sample, 10 were REAL, 5 DEBATABLE and 2 FALSE, so a truthful verifier would still uphold roughly 6–9 blockers per panel."
- D3/D5: "D3 and D5 block no step and are deferred until after the owner has evaluated the output."
- D4: "D4 blocks nothing until the rubric runs. Decide it after a 3-call rubric probe on the current candidate."
- E1/D6: "Landing #566–#575 does not block the run, which runs from the local checkout. What matters is that the exact run sha exists on origin before the release: a fast-forward of main (or a pushed tag) guarantees that, and a squash merge does not. The pipeline never checks this itself."
- E2: "Adding v25 tests to CI removes no blocker to the run; do it after the book."
- E3: "E3 needs two parts. (1) Make MAX_REVIEW_SUCCESSOR_ORDINALS an env knob (following the #574 precedent), or skip provider-blocked stored-ERROR successors without counting them. (2) Make the driver stop when the round log, or a review JSON written that round, contains 'weekly limit|session limit|hit your'. Autoresume forwarding is unnecessary: add CHAPTERFLOW_REVIEW_REPAIR_ORDINALS=${CHAPTERFLOW_REVIEW_REPAIR_ORDINALS:-40} to the driver and touch PAUSE while running manually."
- E5: "Only the F4 scoping change is needed. Scope F4 to the fewest highest-count chapters, not to every chapter containing 'rather than' (17 of 19), and land it before the first panel PASS. Running the deterministic QC stack inside the review loop saves nothing, because the source-fidelity judge will fail fresh QC anyway."
- E6: "E6 is conditional. First run the existing source-fidelity judge on ch01/07/13/19 (4 calls) against the 19 known majors. Wire it into the review loop only if its findings are too many for the 4-ordinal QC-repair lane to clear."
- E7: "Defer E7. Prompt or scar changes force a fresh compile (~3 h, ~$120 API-eq) and restart the review loop from a 34-blocker candidate. The rev-6 distortions the pins targeted are already fixed, and the paragraph problem can be fixed by targeted repair or a deterministic split after the evaluation."
- E8: "score-franklin-v7.js must read indices [0,6,12,18] (the rubric's sample: chapters 1, 7, 13, 19) and drop its '4-chapter' wording. It can score a scratch {chapters:[…]} assembly of the candidate without a release. The cli.ts:564 text is cosmetic."
- R1: "Do not resume until D2 and F4 are both in the checkout. Under the union rule each round costs ~$32 with essentially no chance of PASS, and a PASS before F4 lands commits an immutable QC round that the QC-repair lane cannot repair."
- R1 risk: "Resuming 39a37d06 carries a permanent-wedge risk. Every resume replays the ordinal-15 dispute, which uses up the run's single disputed-review supersession, so any new ordinal in which the writer declines every named chapter fails closed with 'start a fresh run'."
- R2: "Each QC-repair link costs ~263 calls and 5–9 h and needs a whole-book panel PASS on its first verdict. The driver caps QC repair at 4 links, and every unsuccessful link stops the driver with REPAIR_DIAGNOSIS_REQUIRED until an operator runs qc-diagnose."
- R2 quota: "Fresh QC is ~190 sequential calls (3–7 h, an estimated $25–50) and is lost entirely if interrupted. Run fresh QC and QC repair at the start of a quota week with orchestration idle."
- R3: "Push or fast-forward the run sha to origin before the owner runs the release command."
- Zero-cost option: "Deliver the rendered review-repair-21 candidate and the accuracy findings first, in parallel with the decisions, not as a last alternative. Note that ch16 and ch17 have no current panel score."
- Add a step: "Before any D1(a) spending, run two scratch-root probes: the source-fidelity judge on the 4 audited chapters, and the in-pipeline rubric on rr21 (together ~$5–15, under 2 h). Stop if the judge catches under half of the 19 known majors or flags more than 5 blockers per chapter, or if the rubric returns a gate SPLIT/FAIL, a factor below 65 or a composite below 74."
- Add a step: "touch ~/cf-wt/franklin-v7-tools/PAUSE before any manual driver run. A manual run replaces the WEDGE STOP marker, and a later crash would otherwise let autoresume relaunch with the stale env (LOG_PREFIX=fv8d, no ORDINALS line; its REVIEW_REPAIR_ROUNDS=10 is overridden by the driver's inline 4)."
- Add a note: "The repair-role schema failure is a small tax, not a wedge. 2 of the 3 cases were heavy-thinking (~52–54k thinking tokens, 09-17/18). The third (review-repair-13 on 09-20) was a 30-second, 2.9k-token reply to the hallucinated ch14 blocker. None of the current run's other 20 ordinals hit it, so no routing change is needed."
- Add a note: "EI1/EI2 on this memoir are located and repairable (for example 'Benjamin Franklin's account…' passes the full-name exemption), so they are not a wall."
- Add a cost line: "Last week ~10 fix PRs plus monitoring used ~$766 API-eq of session quota (48% of the ~$1,600 weekly proxy), about $40–75 per PR. A 3–4 PR fix round plus a D1(a) run (realistically 35–60 h and $400–700 of pipeline quota) will likely use about one full weekly cap, with a low and unmeasured chance of passing the rubric at 80 with every factor at 70 or more."

## confirmations
- H1: no v25 book; the last catalog publishes were 44c311e0d and b8acdd6e1 on 2026-07-10 (git log origin/main -- app/book/data/bookPackages.ts).
- H2: 3284/0 on be9c44ed8 and 3291/0 on 9f0117cb7, typecheck exit 0 on both, 00:14-00:44Z (scratchpad/suites-status.txt, suite-*-test.txt).
- H4: MAX_REVIEW_SUCCESSOR_ORDINALS=3 is a constant (bookRunApplicationService.ts:1236); #successorLanding skips every stored ERROR (:1712-1719); reviews 35abdd05/b1066b7e/adc6eeef/735da811 are ERROR with 'weekly limit'; the driver ends in WEDGE STOP 14:58:03Z.
- H5b: re-running the deterministic QC replay on a byte-identical rr21 copy gives 'outcome FAIL … blockers 33' and a location-less F4 at 24x (verify/detqc-rr21-reverify.out); bookGate.ts:828-833; the port's REPAIR_FINDING_UNSCOPED at candidateRepairApplicationPort.ts:341-343.
- H5b: a QC-repair successor review FAIL spends the ordinal at once (contentRepairWorkflow.ts:258-264).
- The QC round id is immutable per run (derivedId('qc', runId), bookRunApplicationService.ts:3360), so the F4 fix must land before fresh QC commits.
- The rubric gates promotion inside the run, after QC and before promotion (bookRunApplicationService.ts:3585-3611); the factor floor is the constant 70 (catalogRubric.ts:185); a SPLIT fails closed (:647-658).
- Rubric readers get only the book document, with no source (catalogRubricPanelEvaluator.ts:195).
- The rubric's md5 sample for this 19-chapter book is 0-based [0,6,12,18], i.e. chapters 1, 7, 13, 19, the same chapters as the accuracy audit (port of score.py select_idxs).
- H6: 8 full reads (ch02/04/06/07/09/10/12/19, 486-774 words) and 11 deep reads contain no newline in rr21.
- The QC-repair successor judge uses a fixed '${roundId}-judge' run with no walk; a FAILED run gives REPAIR_QC_JUDGE_UNAVAILABLE (bookRunComposition.ts:617-633, 662-670).
- The disputed-supersession budget is 1 (:508); each resume's replay sets it to 1 (:3115), and a new dispute is refused with 'start a fresh run' (:1802-1809).
- The driver hardcodes REVIEW_REPAIR_ROUNDS=4 and QC_REPAIR_RUNS=4 inline (drive-franklin-v7.sh:46,54); provider_block reads only attempts.jsonl (:38-40); it stops on DIAGNOSIS GATE (:88).
- AUTORESUME.env reads LOG_PREFIX=fv8d and REVIEW_REPAIR_ROUNDS=10 with no ORDINALS line; autoresume.sh parses only 3 knobs (:33-52, 122-125) and idles on WEDGE STOP (autoresume.log 00:53Z); there is no PAUSE file; the launchd agent is loaded.
- Each unsuccessful QC-repair link needs qc-diagnose (bookRunApplicationService.ts:3553-3556); v25 qc-diagnose is qcService.diagnose with no model runner (cli.ts:5006-5031).
- qc-auto demands a canonical review PASS before any judge runs (cli.ts:599-603), and no rubric subcommand exists; probes need a scratch harness.
- score-franklin-v7.js reads indices [0,1,2,3] (lines 40-41) and calls the book '4-chapter' (line 139); it takes args.pkg, and the candidate chapter JSON has v21 keys (hook, breakdown, examples, quiz, reviewCards, memorableLines).
- EI1/EI2 hits are chapter-located (ch02 Xenophon, ch10 q08 Franklin); ownerIsRealSource in evidenceIntegrity.ts exempts a possessive preceded by a capitalised word.
- No origin check on sourceGitSha exists in the release path (grep of src/ for is-ancestor, ls-remote and cat-file finds none); 9f0117cb7 is local-only (git log origin/main..HEAD).
- Repair role is routed at effort high and review/qc at xhigh (config/model-routing.json roles).

## report

## Red-team of the DRAFT v25 plan (verifier, read-only)

**Scope.** I checked the draft's plan against the nine investigator reports and against primary evidence: the checkout `~/ChapterFlow-books-v25-completion` at 9f0117cb7, `~/cf-canary` run data, the driver and autoresume tooling, and `gh`. Nothing was modified. My only model-free re-runs were:
- a deterministic QC replay on a byte-identical copy of the review-repair-21 candidate (`verify/detqc-rr21-reverify.out`)
- a recount of seat corroboration over the 14 stored panels (`verify/corrob.py`)
- a check of repair-attempt stop reasons (`verify/stops.py`)

All three are in `scratchpad/assess/verify/`.

### A. Claims checked
| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | H1: the last pipeline books reached the app on 07-10; no v25 book exists | CONFIRMED | `git log origin/main -- app/book/data/bookPackages.ts`: 44c311e0d and b8acdd6e1 on 2026-07-10 are the last publishes |
| 2 | H2: suite 3284/0 on main and 3291/0 on 9f0117cb7; typecheck clean | CONFIRMED | `suites-status.txt`: main start 00:14:11Z, 9f0117cb7 end 00:43:57Z, typecheck exit=0 on both. `suite-*-test.txt`: "pass 3284 fail 0" and "pass 3291 fail 0" (xenv 6, skip 17) |
| 3 | H3: "36 PRs merged (#525-#564)" | PARTLY TRUE | `gh pr list --state merged` over 525-564 returns **37** (36 only if the #525 docs PR is excluded) |
| 4 | H4: the run is wedged by #20; the successor cap is a constant; the reset does not clear it | CONFIRMED | `bookRunApplicationService.ts:1236` sets `MAX_REVIEW_SUCCESSOR_ORDINALS = 3`. `:1712-1719` skips every stored ERROR. The reviews 35abdd05, b1066b7e, adc6eeef and 735da811 are all ERROR with "weekly limit". The driver's last lines are "successor budget exhausted…" then "WEDGE STOP" |
| 5 | H5b: the deterministic replay gives FAIL with 33 blockers, and F4 has no location | CONFIRMED (re-run) | `detqc-rr21-reverify.out`: "outcome FAIL … blockers 33"; "B F4 … 'rather than' appears 24 times (budget 15)" with an empty location. `bookGate.ts:828-833` emits no path or chapters. `candidateRepairApplicationPort.ts:341-343` refuses it with REPAIR_FINDING_UNSCOPED. `:3360` makes the QC round id immutable per run |
| 6 | H5b: each QC-repair ordinal needs a panel PASS on the first verdict | CONFIRMED | `contentRepairWorkflow.ts:258-264`: any FAIL returns REPAIR_REVIEW_FAILED |
| 7 | H5c: a rubric FAIL is final for a candidate | PARTLY TRUE | The record replays forever (`:2329-2358`), but it is **re-judged against the current run's bar**: `:3593 judgeCatalogRubric(aggregate, rubricBar)`, with the bar an env knob from 60 to 95 (`catalogRubric.ts:196-215`). A FAIL on the composite alone becomes promotable at zero cost if the owner lowers the bar. A FAIL on the factor floor (`:185`, a constant 70), churn HIGH, gate FAIL or gate SPLIT (`:636-658`) is final |
| 8 | (new) The rubric gate can fail closed on a SPLIT vote | CONFIRMED | `catalogRubric.ts:647-658`. The only earlier 3-reader card on a Franklin package split 2 PASS / 1 FAIL (Phase A report §1 table) |
| 9 | (new) The rubric cannot see source errors | CONFIRMED | `catalogRubricPanelEvaluator.ts:195` sends only the book document. The source-fidelity judge in fresh QC is the only accuracy gate |
| 10 | The rubric samples ch01, ch07, ch13 and ch19 (the same four chapters the accuracy audit covered) | CONFIRMED | Port of `score.py select_idxs` gives [0, 6, 12, 18] |
| 11 | H6: 8 full reads and 11 deep reads are single blocks | CONFIRMED | Python over rr21: full reads in ch02/04/06/07/09/10/12/19 (486-774 words); deep reads in ch02/04/06/07/09/10/11/12/14/15/19 |
| 12 | D2: strict 2-of-3 "would have passed 4 of 14, first at P8" | PARTLY TRUE, depends on the matcher | `corrob.py` over the 13 completed panels. Chapter+category matching (≥2 seats): only P10 and P12 have 0, so 2 pass, the first at 09-20 06:05. Normalised unit-string matching: P6-P8 and P10-P13 pass, so 7. The analyst's semantic matching gives 4 |
| 13 | D2 adjudication would reach PASS | UNSUPPORTED | In the 17-blocker ground-truth sample, 10 were REAL, 5 DEBATABLE and 2 FALSE (panel-analytics §6). A truthful verifier keeps most of them |
| 14 | QC-repair successor judge has no successor walk | CONFIRMED, but it is a cost, not a certain wedge | `bookRunComposition.ts:617-633`: a prior non-RUNNING `${roundId}-judge` run gives REPAIR_QC_JUDGE_UNAVAILABLE. `:662-670` marks the run FAILED on a judge error. This spends one QC-repair ordinal (~$60-90), and only on a judge failure |
| 15 | The repair role thinks to its output cap and fails schema validation | PARTLY TRUE | review-repair-7@90caa067: 52,184 thinking / 69,329 output tokens. review-repair-2@4625510a: 53,528 / 69,659. review-repair-13@06d7596a (current run) was a 30-second, 2,924-token `end_turn` reply to the hallucinated ch14 blocker, not thinking to the cap. None of the current run's 20 other ordinals had this failure |
| 16 | A disputed successor wedges permanently on a 429 | CONFIRMED, and worse than stated | `:1786-1800` fails closed. Also, every resume replays the ordinal-15 dispute and sets `disputedSupersessions=1` (`:3115`), and `:1802` refuses any new dispute (`MAX_DISPUTED_REVIEW_SUPERSESSIONS=1`, `:508`). So **any new ordinal that is all-declined in resumed 39a37d06 fails with "start a fresh run"**. C4 had 2 such hallucination-driven declines in 21 ordinals |
| 17 | AUTORESUME.env is stale | CONFIRMED; harmless while idle | It holds `LOG_PREFIX=fv8d`, has no ORDINALS line, and sets `REVIEW_REPAIR_ROUNDS=10`, which the driver's inline `=4` overrides (`drive-franklin-v7.sh:54`). autoresume stays idle while the last marker is WEDGE STOP (`autoresume.sh:88-96`; log 00:53Z). There is no PAUSE file. A manual driver run would replace that marker |
| 18 | The driver cannot see a 429 | CONFIRMED | `drive-franklin-v7.sh:38-40,86` grep only `attempts.jsonl`. `:84` prints PROVIDER_BLOCKED but never stops on it |
| 19 | A local-only sha ends up in release provenance | CONFIRMED; hygiene, not a blocker | `git log origin/main..HEAD` lists 9f0117cb7. A grep of `src/` for is-ancestor, ls-remote or cat-file finds no check in the release path |
| 20 | EI1/EI2 testimonial blockers are a wall on a memoir | REFUTED as a wedge | They are located (ch02 "Xenophon", ch10 q08 "Franklin"). `evidenceIntegrity.ts ownerIsRealSource` exempts a possessive preceded by a capitalised word, so "Benjamin Franklin's account" passes. They cost repair churn only |
| 21 | Fresh QC is sequential: 190 calls, 3-7 h | CONFIRMED on structure; timing inferred | 171 quiz calls plus 19 source-fidelity calls. There is no per-chapter persistence, so an interruption loses all of it (downstream report; `candidateQcEvaluator.ts:677-723`) |
| 22 | A standalone judge or rubric run is possible without a review PASS | REFUTED | `qc-auto` (`cli.ts:575-603`) runs a canonical review first and exits on anything but PASS. No rubric subcommand exists. Probes need a scratch harness |
| 23 | The draft's R2 covers the whole QC path | PARTLY TRUE, a step is missing | `:3553-3556`: every unsuccessful QC-repair link returns REPAIR_DIAGNOSIS_REQUIRED, and the driver stops (`:88`). A manual `qc-diagnose` (deterministic) is needed before the next link |
| 24 | The scoring script is wrong for 19 chapters | CONFIRMED | `score-franklin-v7.js:40-41` reads [0,1,2,3] and `:139` says "4-chapter". It takes `args.pkg`, and the candidate chapter JSON already has v21 keys, so a scratch `{chapters:[…]}` assembly can be scored without a release |
| 25 | Scoping F4 to "the chapters containing the phrase" is a small change | PARTLY TRUE | "rather than" appears in 17 of 19 chapters of rr21 (40 hits across the whole JSON; F4's own surfaces count 24). Scoping to every containing chapter widens a QC-repair ordinal to nearly the whole book |

The accuracy numbers (182 claims, 19 majors) and the time and quota ledgers were not re-derived by me. They are consistent with the investigator scratch files.

### B. Q1: unnecessary and missing steps
**Unnecessary or over-engineered for the owner outcome:**
- **E2 (CI).** Not a blocker; do it after the book.
- **E3's autoresume forwarding.** One driver line is enough: `CHAPTERFLOW_REVIEW_REPAIR_ORDINALS=${…:-40}`, plus `touch PAUSE` while running manually.
- **E5 part 2 (deterministic QC before review).** Fresh QC will still FAIL on the source-fidelity judge, so the QC-repair lane runs anyway.
- **E6.** Conditional on a 4-call probe of the source-fidelity judge.
- **E7 (scar re-key, paragraph prompt, Mr. splitter).** Forces a fresh compile (about $120 API-equivalent, 3 h) and restarts from a 34-blocker candidate. The rev-6 distortions the pins targeted are already fixed.
- **D3 and D5.** Block nothing.
- **Fixing the `cli.ts:564` text.** Cosmetic.
- **Changing the repair-role effort (#15).** Not needed.

**Missing:**
1. Do not resume before D2 **and** F4 land. Under union each round is about $32 API-equivalent with P(PASS) ≈ 0, and a PASS before F4 commits an immutable round that the QC-repair lane cannot repair.
2. The qc-diagnose manual stop between QC-repair links.
3. The permanent dispute-wedge risk on resuming 39a37d06 (row 16), with a fresh run as the fallback.
4. A driver-side stop on 429s. Grep the round log and the review JSONs written that round for "weekly limit|session limit|hit your". Tooling only, and it covers the review, fresh-QC and rubric lanes.
5. `touch PAUSE` before any manual driver run.
6. The run sha must exist on origin before the release.
7. The rubric's SPLIT fail-closed risk and its reliance on a factor floor that is a code constant.
8. Fix the scoring-script indices to [0, 6, 12, 18].
9. Two cheap probes before spending on D1(a).

### C. Q2: ordering and parallelism
- **D1 is the only decision needed before any spend.**
- **D2 (rule plus matcher) must precede any resume.**
- **D4 does not block anything until the rubric runs.** Decide it after the rubric probe; a composite-only FAIL is reversible at zero cost.
- **D6/E1 is independent.** It only has to be done before the release.
- **Parallel, now, at zero model cost:**
  - handing over the output
  - PAUSE and the driver edits
  - the owner decisions
  - the F1/knob PR and the F4 PR (neither depends on D2's content)
  - fast-forwarding main or pushing the sha
  - assembling the scratch package
  - fixing the scoring script
- **Parallel, small spend:** the source-fidelity probe and the rubric probe, independent of code.
- **Strictly sequential:** D2 code → full local suite → resume → panel PASS → fresh QC → QC-repair links (each with qc-diagnose) → rubric → promotion → release → scorecard.

### D. Q3: minimal critical path under each owner choice
"$" means API-equivalent. The measured unit costs are:
- one review-repair round: about 1.7 h and $32
- one panel on its own: about $26
- fresh QC: 190 calls, 3-7 h, an estimated $25-50 (no live data)
- one QC-repair link: about 263 calls, 5-9 h, an estimated $60-90
- rubric: 3 calls, 10-25 min, $3-10
- fresh compile: about 3 h and $120
- last week's roughly 10 fix PRs plus monitoring used about $766 of session quota, which is 48% of the roughly $1,600 weekly proxy, or about $40-75 per PR

- **D1(b), any D2 (an evaluable output, no promotion):**
  1. Hand over the rendered rr21 plus the accuracy ledger. Unblocks the owner's evaluation. 0 h, $0.
  2. Assemble a scratch package and fix the scoring indices. Unblocks the scorecard. Under 30 min, $0.
  3. Optionally, the source-fidelity probe on 4 or 19 chapters plus the rubric probe, in a scratch root. Gives the pipeline's own accuracy and promotion numbers. 1-2 h, about $5-15.
  4. Optionally, the 6-reader scorecard. 1-2 h, about $40-90 of session quota (inferred from this assessment's $57 for 9 agents).
- **D1(a) + union:** there is no path. P(panel PASS) is about 4e-5 to 3e-7, and the QC-repair lane needs the same PASS. Do not spend.
- **D1(a) + adjudication:** likely no PASS (row 13). It adds about 9-18 verifier calls per panel. Treat it as union unless it is combined with 2-of-3.
- **D1(a) + strict 2-of-3 with a named matcher:**
  1. Tooling: PAUSE, the ORDINALS default and the 429 stop. Unblocks safe manual runs.
  2. PR: the successor-ordinal knob or the F1 predicate. Unblocks the resume.
  3. PR: F4 scoped to the fewest high-count chapters. Unblocks the QC-repair preflight.
  4. PR: D2 in the panel evaluator (it covers both lanes). Unblocks the review PASS and the QC-repair successor PASS.
  5. Full v25 suite on the combined tree. Supplies the evidence CI does not.
  6. Fast-forward or push the run sha. Unblocks clean release provenance.
  7. Resume at the start of a quota week with the orchestrator idle. Successor-4 panel ($26, 1 h), then 0-N rounds. Historical PASS rate per panel is about 15% with chapter+category matching and about 30% with semantic matching.
  8. Fresh QC. FAIL is expected.
  9. QC-repair links, up to 4 (driver cap), with qc-diagnose between them.
  10. Rubric.
  11. Promotion (automatic, pointer 6 → 7).
  12. The owner's release command.
  13. The scorecard.

  Code and PRs take about a day and about $150-300 of session quota. Best-case run: 15-25 h and $150-250 of pipeline quota. Realistic (several panel rounds, 2-4 QC-repair links): 35-60 h and $400-700, which is about one full weekly cap including orchestration. The probability of success is low and unmeasured. The rubric factor floor fails on the panel's own numbers (limits 69, density 69, bar 80). If the resume dispute-wedges, a fresh run adds about 3 h and $130, and the review loop restarts from a 34-blocker candidate.

### E. Q4: the cheaper path
Yes: D1(b) steps 1-4 above. The owner gets the real 19-chapter output within hours for $0-15 of pipeline quota and about $40-90 of session quota, with no pipeline code changes and no gate decisions. Caveat: ch16 and ch17 were changed after the last full panel read them, so neither has a current panel score.

### F. Q5: riskiest assumptions and cheap falsifiers
1. **"2-of-3 makes the panel passable."** It depends on the matcher (2, 4 or 7 of 13). Falsify at $0 by replaying the implemented matcher over the 14 stored panels (`verify/corrob.py`).
2. **"The QC-repair lane can clear the source-fidelity findings in 4 ordinals."** The judge has never run live. Falsify by running it on ch01/07/13/19 (4 calls, about $2-5) against the 19 known majors. Kill if it catches fewer than half of them or flags more than 5 blockers per chapter.
3. **"Rubric ≥80 with every factor ≥70 is reachable."** The panel's own numbers are 76.3 / 69 / 69, and SPLIT fails closed. Falsify with a 3-call rubric in a scratch root (about $3-10).
4. **"Resuming is cheaper than a fresh run."** The dispute budget is already consumed. There is no cheap falsifier, so keep the fresh-run fallback costed.
5. **"There is quota for it."** Orchestration was 48% of last week. Falsify by reading the claude.ai usage percentage before and after the first panel round.

### G. Recommended final step list, with done-criteria
1. **Deliver now:** the rendered rr21 chapters (`rx/cand-ch01..19.md`), the accuracy ledger, the top-5 reader defects and the status. Done when the owner has them, with ch16 and ch17 marked as unscored by the last panel.
2. **`touch ~/cf-wt/franklin-v7-tools/PAUSE`.** Done when `autoresume.log` shows "PAUSE file present".
3. **Owner answers D1.** If D1(a), also D2 **plus the matcher**, and D4 (noting the floor is a code constant). D3 and D5 are deferred. Done when the answers are written.
4. **Probes (owner-approved, scratch root, about $5-15):** the source-fidelity judge on the 4 audited chapters, and the pipeline rubric on rr21. Done when there is a recall/precision figure against the 19 majors plus the rubric composite, factor medians and gate votes. If a kill criterion from F hits, stop and report; D1(a) then needs content redesign, not more rounds.
5. **(D1a) Driver edits:** default ORDINALS to 40, and stop on provider text in the round log or in review JSONs written that round. Done when the stop fires on a replay of `fv8h-r1.log` plus `review-35abdd05`.
6. **(D1a) PR: successor-ordinal knob (or F1), plus one resilience test.** Done when the test goes red to green and the full suite shows N/0.
7. **(D1a) PR: F4 chapter-scoped.** Done when `detqc` on rr21 shows F4 with a chNN location and the port preflight accepts it.
8. **(D1a) PR: D2 with the chosen matcher.** Done when a replay over the 14 stored panels matches the owner-approved pass set and the full suite shows N/0.
9. **Fast-forward main to the run commit, or push a tag.** Done when `git merge-base --is-ancestor <sha> origin/main` succeeds, or the tag exists on origin.
10. **(D1a) Resume 39a37d06 manually,** with PAUSE in place, at the start of a quota week, with the orchestrator idle. Done at review COMPLETED; on a dispute wedge, the owner decides whether to start a fresh run.
11. **(D1a) Fresh QC, then QC-repair links with qc-diagnose between them.** Done when fresh-qc or repair COMPLETED shows PASS.
12. **(D1a) Rubric.** Done when rubric COMPLETED, or on the owner's D4 re-bar after a composite-only FAIL.
13. **Promotion, then the owner's release, then `score-franklin-v7.js` with [0, 6, 12, 18], then the scorecard.** The owner runs `publish-final`.

**Deferred, each with a trigger:**
- E2 CI: after the book.
- E6: if the step-4 probe fails.
- E7: after the owner's evaluation.
- #559: after the book.
- A successor walk for the QC-repair judge: on the first REPAIR_QC_JUDGE_UNAVAILABLE.
- A dispute-budget fix: on the first dispute wedge.
- Repair effort: only if heavy-thinking failures recur.