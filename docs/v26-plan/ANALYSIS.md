# v26 — root-cause analysis

Session: 2026-09-27, cloud session `claude/vibrant-ritchie-xaf7dm` (claude.ai/code), repo `WillSoltani/ChapterFlow`.

## 0. Environment this analysis ran in (read first)

- This session ran in a **cloud container (Linux)**, not on the owner's Mac. Only the git repo was available, at
  `origin/main` = `22e021d84d45e85ce287cffaa606b89301fbd1f1` (checked with `git fetch origin main`).
- **Not available here** (Mac-only): `~/cf-wt/v25-execution/` except the part committed by #577 under
  `docs/v25/execution/` (CONTEXT, DECISIONS, README, S-prompts, 13 of the 09-23 reports, tools/detqc.mts, tools/corrob.py);
  `~/cf-canary/` (rr21 and Q08-arm text, run events, reviews); `~/cf-canary-att/` transcripts; the memory notes; `gh`; codex.
  Wave-Q reports (`assessment/waveQ/*`), `status/*.md` and every `check.json` are NOT in the repo.
- Consequence: claims about rr21 / Q08 text rest on (a) the 09-23 reports committed in `docs/v25/execution/assessment/reports/`
  (they quote rr21 text with source line numbers) and (b) the owner's handoff prompt. Those are marked
  **HANDOFF** (taken from the handoff, not re-checkable here) where I could not re-check them.
- Network: Gutenberg is blocked (HTTP 403 at the proxy). The repo holds two Franklin source slices
  (`$PIPE/tests/fixtures/franklin-autobiography-slice.txt` = the start of chapter I through the parents' epitaph, 365 lines;
  `...-proprietaries-slice.txt`, 354 lines, from the Loudoun/proprietaries and kite passages) and research sidecars for ch13/15/19
  (`$PIPE/tests/fixtures/q05/*.source.json`).
- The kit is written to `docs/v26-plan/` in the repo (branch `claude/vibrant-ritchie-xaf7dm`). Wave 0's first step copies it to
  `~/cf-wt/v26-plan/` on the Mac. The memory note is written to `docs/v26-plan/memory/v26-campaign.md` for the same reason.

## 0.1 Budget for this session

- Orchestration budget set before Step 1: **≤ 50 subagents** in total (under the suggested ~60): scan ≈ 20, design check ≤ 6, review ≈ 10.
- Pipeline model calls: ≤ 5 (owner cap). Ledger in §9.

## 0.2 Confirmed at start (VERIFIED, this session)

- origin/main `22e021d84` = #588. Merged since 09-23: #577, #579, #580, #578, #582, #583, #581, #585, #586, #587, #588; #584 closed unmerged;
  #566–#575 closed unmerged on 09-23 (landed by fast-forward per the handoff). (GitHub MCP `list_pull_requests`.)
- Open PRs: #576, #559, #524, #523, #522, #521, #429, #420, #406 (draft), #401.
- `config/model-routing.json`: every role claude-cli / claude-sonnet-5; author at medium.
- `src/orchestrator/modelPolicy.ts:33` `BASELINE_MODEL = "gpt-5.5"`; `authorRun.ts:460`
  `AUTHOR_WRITER_MODEL = process.env.CHAPTERFLOW_AUTHOR_MODEL ?? BASELINE_MODEL`; `authorRun.ts:1309` `sandbox: "workspace-write"` (codex).
- Live reader: `ChapterReaderClient.tsx:144` `activeDepth = defaultToFastPath ? "simple" : modeToDepth(learningMode)`.

## 1. Bottom line (plain language)

- **Why no book shipped.** The pipeline was never given the job of *writing* a chapter. In v25, four blind section writers
  (Sonnet 5 at medium effort) each fill a dealt slice of a fixed template from a 64–80k-character card. 63% of that card is
  model paraphrase of the book, and only one or two of the four writers see any of Franklin's own text. More than 330 proxy
  checks then push the text toward compliance: token counts, cue words, readability scores, choice lengths. Graders that
  cannot tell good books from bad decide whether it ships. The result is long, samey and a third wrong. Each fix added
  another rule, and each rule made a new tic.
- **What we did not know until today.** One strong writer given the real chapter text and a one-page brief writes a much
  better chapter in 3 minutes for $0.45. A second strong model then catches planted errors of every kind rr21 was full of.
  This planning session measured both (§9).
- **Two things nobody had looked at.**
  - The app hides most of the writing: a new user reads a ~100-word summary, one example and a 5-question quiz.
  - The release path itself had stopped working: every commit expires a release, and the catalog path moved in July.
- **Fix.** Rebuild around the writer, check only what a reader would miss (facts, quiz keys, renderability), let the owner's
  reading be the gate, and fix the app's default so readers see the writing. Cost per book falls from $700–1,100 to about
  $25–40. Time per book falls from days of machine time plus wedges to about 1–2 hours plus the owner's reading.

## 2. Root causes, ranked by how much they explain

Status tags: **VERIFIED** (re-checked in the repo this session, usually by one investigator and one adversarial verifier;
see `scan/*.md`), **INFERRED** (reasoned; basis given), **HANDOFF** (from the owner's handoff, Mac-only evidence).

### RC1 — The unit of work is wrong: nobody writes a chapter (VERIFIED)
- **Four writers, none owning the chapter.** Each chapter is four separate calls: summary, examples, learning, action.
  Each is dealt its slots by a blueprint before any text exists: 6 example slots, 9 quiz slots with pre-dealt answer
  positions `[1,0,1,2,1,0,0,2,2]`, and 7 cards (`scan/writing-path.md` §1; `chapterBlueprint.ts:1340`; `sectionTasks.ts:133`).
- **Each writer gets a 64–80k-character trusted card, 63% of it paraphrase.** In ch13, only 1,350 of the source packet's
  43,030 characters are Franklin's words (`scan/writing-path.md` keyFacts). The example and action writers get no chapter
  span, only ≤200-character quote fragments inside the packet (verifier correction W2). The span that the summary and
  learning writers do get "adds no citable material" (`sectionTasks.ts:1020`).
- **The writers run at medium effort because the rulebook is so big.** At high effort they spent the whole 64k output cap
  thinking (`config/model-routing.json:3`). The graders run at xhigh. The effort is inverted.
- **What the May setups that scored best had instead.** They used one strong model per unit with a small prompt: 2–9k
  characters with Claude Opus 4.7, or about 30–50k for a Codex writer (`scan/existence-proof.md` §2.4). v25 changed the
  writer tier (Opus 4.7 → Sonnet 5 medium), the prompt size (~9k → 150–190k) and the source (text → paraphrase) at once.

### RC2 — The rulebook replaced the goal, and every rule bred the next tic (VERIFIED)
- **Size.** More than 330 checks can block or reshape a chapter: 138 SEC ids, 22 BPV, 131 ship-gate ids, book gates,
  budgets, 82 banned phrases and 19 eviction policies. Gate, critic, review and QC code is about 50k of 180k source lines
  (`scan/rule-inventory.md`).
- **They check proxies.** **0 of 138 SEC checks can tell whether a fact is true or a key is right.** The code says so
  itself (`sectionGate.ts:3051-3053`).
- **They reject the books they were calibrated on.** 78 of 78 chapters of six high-scored catalog books fail at least one
  portable SEC blocker, and so does the Opus probe (`scan/rule-inventory.md` §3). Across all 140 catalog books, SEC117 fails
  1,902 of 1,903 chapters and SEC116 fails 1,718 (verifier re-run). The code's claim that the thresholds are "calibrated
  zero-FP on every >=85 book" (`pedagogyThresholds.ts:7-9`, `sectionGate.ts:3620`) no longer holds, and no test re-checks it.
- **They forbid Franklin's own sentences.** SEC12 (Flesch ≥ 70) at Franklin's vocabulary allows at most about 12 words per
  sentence. Franklin writes about 30, and his text scores 48–53 (`scan/hb-alternative.md`, `scan/writing-path.md`).
- **The code's own comments document about a dozen cascades, about 7 of them strictly rule → tic → new rule.** For example:
  SEC14 → "three puffy rolls" on 11 surfaces → SEC129; SEC33 → tie-back closer in 88/114 examples → SEC137. The rest are
  rule collisions or false positives patched by narrowing (`scan/rule-inventory.md` §4 and its verification).
- **What it cost.** 61 of 78 compile rounds since 09-04 ended on a gate. 284 of 311 compile calls went to attempts that
  failed (`live-history.md`, `quota-defect.md`, cited in the rule-inventory report). 48% of pipeline commits since 07-20 were
  run-recovery or gate-convergence fixes. 10% touched the writer (`scan/time-machinery.md` §5).

### RC3 — The loop steered by graders that cannot tell good from bad (VERIFIED / HANDOFF)
- **Known-good books fail the rubric.** It fails known-good books on Sonnet and Opus readers alike (Q02/Q02b, HANDOFF). Q08
  could not separate new, old-code and known-good text (HANDOFF; `assessment/q08-check/check.json`, Mac-only).
- **The panel is noise on identical bytes.** A byte-identical chapter drew a blocker on 41% of re-reads, so P(all 19
  chapters clean) ≈ 4e-5 (`panel-analytics.md`, `scan/time-machinery.md` §2).
- **Most of the money went to grading.** The panel was 58% of run C4's $593 and compile 20% (`quota-defect.md:117-127`,
  `scan/time-machinery.md`).
- **Catalog "quality" is mostly a grader artifact.** The ≥85 set is explained by which grader a book got (Opus 3-reader
  vs Sonnet 2-reader, a ~3.7-point swing). The two catalog instruments agree at Spearman ρ ≈ 0.16–0.18, and the 140-book
  evaluation is mostly a genre-profile prior: only 8 books got a close read. **No catalog book met the full bar in July**
  (`scan/existence-proof.md` and its verification).
- **The graders reward books with no author voice.** Meditations gets tone 86 with "Marcus" 0 times, and Man's Search for
  Meaning opens with an invented gala-budget scene (`scan/existence-proof.md` §3).

### RC4 — Accuracy had no owner until the very end (VERIFIED)
- **Where errors enter.** Of the traced rr21 errors, about a third come from the research paraphrase. About two thirds were
  added by writers: forced fact+case quiz pairings, invented causes and misattributions (`scan/accuracy-chain.md` §2;
  HANDOFF 5/4/5/1). The schema *requires* a `becauseMechanism` for every fact, which invites invented causes
  (`sourceIntegrity.ts:69`).
- **The editor cannot introduce a correct name, digit or key the chapter lacks.** It may reword an invented cause, but a
  wrong year, a wrong name or a wrong key is unfixable unless the right one is already on the page
  (`chapterEditorContract.ts:99-108`, `chapterEditGuard.ts:585-607`).
- **The fact check never ran on the 19-chapter candidates.** The only fact check sits in fresh QC, behind a panel PASS that
  never came.
- **The judge's quote matcher demotes real findings.** A Gutenberg footnote marker such as `[7]` breaks it (RED/GREEN
  reproduced with 0 calls, `scan/accuracy-chain.md` §5). The same shared normalizer drops marker-less research quotes as
  ungrounded, so any quote check must fold markers on **both** sides.
- **The whole-chapter alternative, measured today.**
  - Writer: the Opus 5 probe put 44/44 quotations verbatim (§9).
  - Checker: Opus 5 caught 7/7 planted errors; Sonnet 5 caught 5/7, missing the invented cause and the inverted sequence,
    which are two of rr21's main error kinds. This is one run on one planted chapter. Recall on **real** errors is unmeasured,
    and W1 calibrates it on rr21 ch07/ch19.

### RC5 — NEW: the product hides the writing (VERIFIED)
- **What a new user sees.** A user who has not customized their settings reads only `fastRead` (median 94 words in the
  catalog), one example (the rest behind "Show more"), quiz questions 1–5, and a practice screen that repeats the same plans
  up to 4 times (`scan/app-render.md` §2–§4).
- **The full telling is effectively locked.** It is reachable only through "Challenge" mode, which also means a 10-question,
  no-retry quiz. "Standard" is a no-op click (`ChapterReaderClient.tsx:262`). Picking a profile in Settings resets the reader
  to the short summary (`BookSettingsClient.tsx:429`).
- **Rev-6 gave a default reader 522 words of Franklin for the whole book.**
- **Every grader and repair loop worked on text the default user never sees.** 32 of the last 46 panel blockers were about
  tiers standing alone or contradicting each other. Walls of text counted in `fullRead` never reach a default user.
- **The quiz can test facts the default reader never saw.** The probe's q3 and q4 are answerable only from the deeper tiers.
- None of the four earlier root-cause passes noticed any of this.

### RC6 — NEW: iteration was too slow and too expensive to learn from (VERIFIED-report / VERIFIED)
- **Each experiment was a whole run.** A compile cost ~$120 and 16 h, and a review round ~$32. From 09-04 to 09-23 there
  were 452 wall hours, 34% of them with a model call in flight, and 77% of busy hours went to runs later thrown away
  (`live-history.md`, `scan/time-machinery.md` §1).
- **Fixing the machine cost as much quota as running it.** In the exhausted week the orchestration sessions used $766 and
  the pipeline $826 (`quota-defect.md:131-137`).
- **Nobody could iterate on the writing itself.** Every change cost a day and $100+.
- **A whole-chapter draft costs $0.45 and 3 minutes.** That is roughly 250× cheaper iteration, so the owner's reading becomes
  the bottleneck, as it should be.

### RC7 — NEW: the release path itself stopped working (VERIFIED)
- **The only released Franklin pair cannot ship.** It fails the publish preflight at HEAD today
  (`PPKG.prompt_/config_/code_fingerprint_mismatch`). Any change under `src/`, `config/` or `prompts/` expires a release
  (`scan/publish-path.md` §3.1).
- **The catalog path moved and nothing followed it.** Since 07-18 the catalog lives at `lib/books-catalog.metadata.json`,
  but the generator, `publish-final` and `register-api-books` still write the old path, so no new book has received API
  presentation data since then (`scan/publish-path.md` §3.3).
- **Both pipeline release routes re-impose the whole rulebook.** They require grader PASS verdicts or QC attestations. The
  app itself never reads the production-manifest sidecar.
- **The pipeline's category list disagrees with the app's taxonomy.** It refuses "Memoir"/"Classics", which the app's
  taxonomy accepts.

### RC8 — The template is a pipeline choice, applied to a memoir (VERIFIED)
- **The app does not require the counts.** The app validator accepts any counts (3/6/5 passed; even a chapter with only
  three tiers passes). The 6/9/7 counts, the 30k length and the invented-modern-character example
  (`sectionTasks.ts:122-127`) are pipeline rules (`scan/app-render.md` §6, `scan/hb-alternative.md` §2).
- **The same template already flattened other books.** Applied to Man's Search for Meaning and Meditations, it removed the
  author's voice entirely (`scan/existence-proof.md` §3).

## 3. The previous orchestrator's diagnosis, point by point

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | The book is assembled, not written | **CONFIRMED, refined** | RC1. Refinement: assembly alone did not sink quality. The May Claude pipeline assembled chapters too and scored in the catalog's top 3. The fatal combination was assembly **plus** a weak tier, huge prompts and paraphrase inputs. The v24 whole-chapter GPT writer also leaked rule text ("treat the miss as a thought experiment, not a biography"). So the brief matters as much as the unit (`scan/reader-text.md` §3, `scan/existence-proof.md` §6). |
| 2 | The rules create the problems they fix | **CONFIRMED, quantified** | RC2: about 7 strict rule → tic → rule cascades in the code's own comments, 0/138 SEC checks able to judge truth, 78/78 high-scored chapters and 1,902/1,903 catalog chapters rejected by SEC117. |
| 3 | The format fights a memoir | **REFINED** | The app shell is flexible. The *pipeline's* counts, length and invented-character examples fight a memoir (RC8). **Also** the app's default hides the telling (RC5). |
| 4 | Steered by a broken compass | **CONFIRMED and extended** | RC3, plus graders read the whole JSON while users see about 32% of it (RC5). The catalog's "good books" set is itself mostly a grader artifact. |
| 5 | Accuracy is baked in upstream by the paraphrase | **PARTLY** | About a third of errors come from the paraphrase and two thirds from writers under forced pairings. Rev-6's Silence Dogood errors are the model's own world knowledge. The deeper cause is that nothing checked facts until the last stage, and that stage never ran (RC4). |
| 6 | Over-engineered around the writing | **CONFIRMED** | About 50k lines of gate, critic, review and QC code against a 1k-line writer card. 58% of spend went to grading. 24 retry and successor budgets sit on the run path (`scan/time-machinery.md`). |

## 4. What that diagnosis missed

1. **The app hides the writing (RC5).** This is the largest miss. A rebuild that writes a beautiful `fullRead` would still
   show new users about 150 words. It is also why the owner must read in both default and full depth.
2. **The release path was broken independently of quality (RC7).** It would have stopped even a perfect book in the last
   wave. The fixes are small: the path change, and a direct ship through `publishFinal()`'s own library entry with the app
   validator (proven end to end in a hermetic repo, `scan/publish-path.md` §4).
3. **Slow, expensive iteration (RC6).** The team could not learn from the text because every experiment was a run.
4. **The "GPT existence proof" does not hold.** No book met the bar.
   - Two of the top three book-scores (Atomic Habits, Getting Things Done) came mostly from a May `claude -p` pipeline with
     Claude Opus 4.7 writing and small prompts, plus a Codex pass.
   - The GPT-5.5 whole-chapter v24 books averaged 77.6 on book-score, but one of them (The Power of Moments) is #3 on the
     close-read evaluation (`scan/existence-proof.md` and its verification).
   - So the evidence favours neither family. What the better books share is a strong model per unit, a small prompt,
     tight length and scene-led prose. The model family is not the lever. A strong model with a small prompt and the real
     text is.
5. **No whole-chapter writer in the pipeline's history ever saw the book's text.** The v21 law, the v22 card and the v24
   author card all grounded on research sidecars (`scan/reuse-v24-writer.md` §8). The probe is the first.
6. **Mechanical traps any design must handle.**
   - The biggest time loss (a 175-hour hang, 42% of wall time from 09-04 to 09-23) happened with per-call timeouts already in
     place (`processSupervisor.ts:116`). The likeliest cause is the Mac sleeping or the host, so long runs need `caffeinate`
     and an outside watchdog, not just in-process timers (`scan/time-machinery.md` verification).
   - Footnote markers and footnote bodies sit inside every span (8–11% of characters).
   - The Franklin scar pins are misfiled to the old 4-part numbering (9 source-quoted pins never reached ch13/ch19).
   - The pipeline discards per-call usage, so it never measured its own cost.
   - The probe's quiz key is the longest choice in 5/6 questions, a cheap tell to check.
7. **The v24 author writer is not a shortcut.** It is codex-only, its default gate path has refused since #533
   (`GATE_ATTEMPT_STATE_UNBOUND`), and its rubric preflight would reject the probe chapter. Reviving it takes 2–4 days at
   high risk. A new ~600-line tool takes about 1 day (`scan/reuse-v24-writer.md` §2–§4).

## 5. H-B (keep the compiler + 7 fixes) vs P1 → P2 (whole-chapter rebuild)

All seven ranked defects exist on main (`scan/hb-alternative.md` §1). But:
- Making the rubric advisory leaves the panel gating: `bookRunApplicationService.ts:3404`, 58% of spend.
- SEC12, the count floors, the example spec and the paraphrase-only fact rule are untouched, and they cause length,
  template, chopped sentences and a third of the errors.
- Fix 6b (re-keying the scar pins) forces a fresh research run that re-decides the chapter list.

| | H-B | P1 → P2 (this plan) |
|---|---|---|
| Code before the book | 6–8 PRs, about 4–7 session-days | W1 harness outside the repo; W2 builds `scripts/book/v26/` (~1 day) |
| Pipeline cost for Franklin | $700–1,100 per attempt, 1.5–3 days if nothing wedges | about $25–40 (the W1–W3 caps total $135), 1–2 h machine time; sessions extra on both sides |
| Calendar to an approved book | best case 5–9 days to a *candidate*; the history since 09-04 is 11 runs, 0 passes | about 8–10 days including two owner reads (README §3) |
| What a failure teaches | little (changes sit inside grader noise) | a lot (the owner reads side by side; a variant costs about $10–25) |
| Structural ceiling | same length, template, voice and walls of text the owner already rejected | none known; open risks are 19-chapter consistency and checker recall on real errors (W1 measures both) |

**Recommendation: P1 → P2. Run no H-B fix alongside Wave 1.** Each fix is a PR on a path the plan bypasses. Carry four
H-B lessons as data or prompt lines instead:
1. strip footnotes from spans;
2. map the pins to the 19 chapters as checker hints;
3. key-safe fix edits;
4. log every envelope's cost.

If the plan reaches its reassess point, `scan/hb-alternative.md` §1 is the ordered patch list.

## 6. Target design

See `README.md` §2. In short: a frozen source + chapter map → a one-page brief → one Opus writer call per chapter → 0-call
checks plus an Opus fact check plus a Sonnet blind quiz solve → at most 2 targeted fix rounds → a book report → the owner
reads → assemble → ship through `publishFinal()` with the app validator. The code lives in `scripts/book/v26/` (covered by
`typecheck:book`), with tests under root `tests/` (run by root `npm run test` in CI).

**Bypassed, not deleted:** research sidecars, blueprint and dealing, the four section writers and SEC gates, editor, panel,
review-repair, fresh QC, rubric, the promotion state machine and the v25 driver.

**The second book is Bennett** (how-to): same stages, a different shape.

**Cost per book: about $25–40 API-eq and about 1–2 h at concurrency 3** (`scan/time-machinery.md` §6 models $34 and ~77
calls for 19 chapters).

## 7. Evidence index

| Report | Lens | Adversarial verification |
|---|---|---|
| `scan/reader-text.md` | reading the text as a user | appended in the file |
| `scan/app-render.md` | what the app shows | appended (one claim corrected by the orchestrator: the dev app does **not** fall back to bundled packages for the chapter route; `page.tsx:12-60` calls `notFound()` without the DynamoDB/S3 manifest) |
| `scan/writing-path.md` | what writers receive | appended |
| `scan/rule-inventory.md` | every blocking check | appended in the file |
| `scan/accuracy-chain.md` | where errors enter | appended in the file |
| `scan/time-machinery.md` | time, cost, recovery machinery | appended in the file |
| `scan/reuse-v24-writer.md` | reuse, the v24 writer, the MVP | appended |
| `scan/publish-path.md` | how a book reaches the app | appended |
| `scan/hb-alternative.md` | the H-B alternative | appended in the file |
| `scan/existence-proof.md` | what made the good books | appended in the file |
| `evidence/probe/` | 3 model calls (§9) | orchestrator plus two lenses re-checked the quotes independently |

## 8. Open questions and what settles them

- **Consistency across 19 chapters, and checker recall on real errors.** W1 reads a second, harder chapter and calibrates
  the checker on rr21 ch07/ch19 against the labelled errors. W2 writes all 19.
- **Opus 5.5 in the pipeline.** One $0 version-refusal-or-OK call in W1 with the 2.1.280 binary settles it.
- **Default reading depth (R1-d).** The owner decides after reading both depths in W1.
- **Full-telling length.** The probe's 1,432 words is about 2.5× a catalog fullRead. The owner judges it in W1, and the brief
  sets 900–1,200.
- **Does a dev AWS stack exist?** It is needed only for an optional in-app preview. The owner knows.
- **GPT model used by the May Codex sessions.** It is unrecorded, and it only matters if W1b runs.

## 9. Model-call ledger (owner cap: 5)

| # | When (UTC) | Command | Model / effort | Purpose | Result / cost |
|---|---|---|---|---|---|
| 1 | 2026-09-27 ~21:00 | `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000 claude -p --output-format json --model claude-opus-5 --effort high --disallowedTools '*' < prompt-ch01.txt` (CLI 2.1.283 in the cloud container; flags mirror `src/runtime/claudeRoute.ts:225` minus `--restricted`) | claude-opus-5 / high | Can one call write a whole Franklin ch01 in the v21 chapter shape from the real source text + a 3.4k-char brief, inside the 64k output cap? Prompt 23.8k chars (source slice = chapter I through the parents' epitaph). | **OK.** exit 0, `stop_reason=end_turn`, 166.7 s, output 13,557 tokens (5,590 thinking) of the 64k cap, **$0.448 API-eq** (`total_cost_usd`). Valid JSON on first parse; app validator `validateBookPackage` → `APP_VALIDATOR_OK` (1-chapter package with rev-6 book metadata). 22.0k reader chars; fastRead 164 w / deepRead 492 w (5 paras) / fullRead 1,432 w (10 paras, max 204 w); 20 Franklin quotations in fullRead; avg sentence 30.5 words; 3 examples, 6 quiz (keys 2,0,3,1,2,1), 5 cards. Draft: `evidence/probe/ch01.opus5.chapter.json`. 44/44 double-quoted spans are verbatim in the source after normalization (0-call check). |
| 2 | 2026-09-27 20:58 | same flags, `--model claude-sonnet-5 --effort high`, stdin = `factcheck-brief.md` + source slice + the ch01 draft with **7 planted errors** (`evidence/probe/plants.txt`: 3 wrong numbers/dates, 1 misattribution, 1 invented cause, 1 inverted sequence, 1 wrong quiz key) | claude-sonnet-5 / high | Recall/precision of a one-pass fact check | exit 0, end_turn, 74.4 s, 7,626 output tokens, **$0.145**. Caught **5/7** (P1 year, P2 misattribution, P3 count, P6 card date, P7 wrong key); **missed P4 invented cause and P5 inverted sequence**; 0 false alarms over 78 claims. `evidence/probe/factcheck-result.json` |
| 3 | 2026-09-27 21:00 | same as #2 with `--model claude-opus-5` | claude-opus-5 / high | Does a stronger checker close the gap? | exit 0, end_turn, 41.6 s, 4,220 output tokens, **$0.265**. Caught **7/7**; 1 extra flag on a borderline interpretive phrase in the original draft ("Two generations later the pressure ran the other way"); 88 claims. `evidence/probe/factcheck-result-opus.json` |
| — | 2026-09-27 21:00 | intended #4 (Sonnet 5 with the focused v2 prompt `evidence/probe/factcheck-brief-v2.md`) | — | — | **Not run**: a shell working-directory slip made the stdin redirect fail before the CLI started (no model call; a stray exit file in the repo root was deleted). Not re-run: #3 already settled the design question. |

**Total: 3 model calls, $0.86 API-equivalent, ~4.7 minutes of model time.** For scale: one v25 Franklin compile was ~311 calls / ~$120 / ~16 h.

## 10. Orchestration used by this session

The budget was ≤ 50 subagents. What ran:
- **Scan:** one launch stopped after 2 agents (it restarted when I split it into three parallel workflows because the
  container allows only 2 concurrent agents per workflow), then 10 investigators and 10 adversarial verifiers.
- **Step 5:** one review workflow (see the final reply for counts).

Pipeline model calls: 3 of the 5 allowed, $0.86 (§9).


