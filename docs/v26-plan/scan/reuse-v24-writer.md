# Scan lens: reuse, reviving the v24 author writer, and the minimum viable pipeline

Investigator report, 2026-09-27. Repo `/home/user/ChapterFlow` at `22e021d84` (origin/main). Read-only apart from this file.
`PIPE` = `scripts/book/prompts/chapterflow-v24-author-pipeline`. Scratch scripts (0 model calls) are in
`/tmp/claude-0/-home-user-ChapterFlow/48916df7-45f9-50d8-ad9d-e43b21e61800/scratchpad/scan/reuse-v24-writer/`
(`rubric-probe.mts`, `reuse-probe.mts`, `quotes2.mts`, `gate-default.mts`, `card.mts`, `render.mts`). Run each with
`cd /home/user/ChapterFlow && node_modules/.bin/tsx <script>`. Status tags: VERIFIED (opened or run here), INFERRED, HANDOFF.

## keyFacts

- VERIFIED: **The v24 author writer never saw the book's text.** `buildAuthorCard` (`PIPE/src/orchestrator/authorRun.ts:623-779`) gives the writer the chapter brief, a voice card, rule blocks and the research **source packet**, headed "This is the ONLY allowed factual material" (`:722`). Each packet fact carries at most a 200-char `sourceQuote` (`PIPE/src/compiler/sourcePacketProjection.ts:73`). Built for a real shipped v24 chapter (start-with-why ch01, `card.mts`), the card is 22,696 chars with 78 directive lines: brief 7.9k, packet 7.8k, rules about 5.6k. It contains "Flesch ease 72-84" and no source text.
- VERIFIED: **The v24 retry loop would reject the Opus probe chapter** and push it back toward the rr21 register. The rubric preflight (`authorRun.ts:1420-1466`) is FAIL-capable. On `ch01.opus5.chapter.json` it gives ease 49.9 against a band of 72-84, tell 0.833 against a maximum of 0.2, transfer 0.333 against a minimum of 0.7, and memClean 0 against a minimum of 2 (`rubric-probe.mts`, `PIPE/config/rubric-thresholds.json`). The retry card then says "write plainer, shorter sentences" (`:1463`).
- VERIFIED: **The default v24 gate path has been broken since #533 (2026-09-02).** `authorWriteOneChapter` calls `io.gateCandidate(candidate, path, key)` (`:1399`), and the default io is `chapterTransaction.gateCandidate` (`:268`). That function passes no `gateAttemptState`, so `runChapterGateComposite` returns exit 1 `GATE_ATTEMPT_STATE_UNBOUND` (`PIPE/src/critics/chapterGateComposite.ts:83-91`). I ran it on the probe chapter and it returned that refusal (`gate-default.mts`). Only the forward validation driver binds the state (`forwardLiveValidationDriver.ts:1706-1856`).
- VERIFIED: **The v24 writer is codex-only and nearly unreachable.** The default spawn is `spawnCodexAgent` (`autopilot.ts:955`), with the model defaulting to `BASELINE_MODEL = "gpt-5.5"` (`modelPolicy.ts:33`, `authorRun.ts:460`), effort xhigh (`:461`), sandbox workspace-write (`:1309`) and a 60-minute timeout (`:465`). The `book-autopilot` verb routes to `runV4BookProduction` (`cli.ts:7290-7291`), and `runBookAutopilot` is dead code (`cli.ts:5149-5175`). The only live entry is running `npx tsx src/orchestrator/liveRun.ts <book>` directly (`liveRun.ts:633-644`).
- VERIFIED: **Franklin has no v24 upstream state** (no index, sidecars, packets, briefs, design or plans; `PIPE/state/books/` holds only `the-autobiography-of-benjamin-franklin.production-manifest.json`). Reviving authorRun for Franklin would first need a v25→v24 research bridge. After that, six compile verbs and gates would have to run for the first time on a memoir (`authorRun.ts:1616-1623`).
- VERIFIED: **The claude-route pieces can be reused directly in a small script.** `createClaudeRoute("claude-opus-5","high").build({mode:"READ_ONLY"})` gives `-p --output-format json --model claude-opus-5 --effort high --restricted --disallowedTools *` with env `CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000`. `normalizeStdout` unwraps the real probe envelope into the chapter JSON, and `classifyStdout` returns null on success (`reuse-probe.mts`). The model gateway (run-state admission, execution policy) is not needed.
- VERIFIED: **Franklin's source freeze and chapter map already exist** and cost 0 model calls to reuse. They live inside each v25 candidate: `content/inputs/research/source-text.txt` (sha256 `8d71d7dc…`, 377,692 B) and `chapter-map.json` (19 spans, 100% coverage). Sources: `docs/v26-plan/BRIEF.md:39`, `docs/v25/execution/assessment/reports/merged-ledger.md:13`. The line ranges are in `docs/v25/execution/prompts/S09b-franklin-scar-rekey.md`. Loaders already exist: `PIPE/src/source/sourceTextVerify.ts:122-142` (`loadFrozenSource`, which checks that the map's sha equals the text's) and `PIPE/src/source/chapterMap.ts:382` (`chapterSpanText`). Every span is 4,628-33,513 chars, so one call covers one chapter.
- VERIFIED: **The pipeline's own quote matcher is too strict to reuse unchanged.** On the probe chapter, `quoteIsGrounded` grounds 31 of 40 double-quoted spans of 20+ chars. After trimming edge punctuation and folding `[N]` footnote markers, 39/40 ground (the miss is a modern character's line of speech). The matcher requires the editorial marker: "Twyford,[3] at the Bishop…" grounds, the same quote without the marker does not (`quotes2.mts`, `reuse-probe.mts`). This is the same root cause as Q08's demoted fact-judge finding.
- VERIFIED: **Size estimate: a new ~600-line script is less work and far less risk** than porting authorRun. The port would need about 500-800 changed lines in 8 or more files, a research bridge, and edits to behaviour pinned by 26 test files that CI never runs. After the port, little of authorRun would remain except a retry loop the script needs anyway.

## 1. What the v24 author writer is (inputs, contract, validators, repair, spawn)

| Aspect | What the code does | Evidence |
|---|---|---|
| Inputs | `chNN.brief.md` plus the machine brief, the source packet (research facts, cases, ≤200-char quotes), the source-use plan, the voice card, and a content-device deal (≥4 chapters). No chapter span. | `authorRun.ts:1104-1177`, `:717-752`; no `spanText`/`sourceSpan` reference in the file (grep) |
| Card | Precedence, invariants ("Flesch ease 72-84", "follow the brief's answer-key pattern"), craft targets (length-tell caps), reviewer axes, packet, schema hint (`planSpec`, `depthLevel`, 9 quiz), 4-check self-verify. Target ≤25k chars. | `:328-401`, `:103`; measured 22.7k (`card.mts`) |
| Output | Agent writes one file `<chapterId>.v21-native.chapter.json` in an isolated attempt workspace. The conductor imports it, then gates, rubric-checks and contract-checks it, then does a CAS commit. | `:768-776`, `:1275-1297`, `:1359-1535` |
| Validators | `gate-chapter` composite (ship gate, intra-book quiz similarity, identity). Rubric preflight (ease, tell, transfer, memClean, lenTell). Write contract (dealt example count, lead thread in fastRead plus 2 examples, round practice timers, label prefixes). Then reader budgets book-wide (name bank CHB3, CHB10/12/14/15) with one repair round. | `:1399`, `:1420-1466`, `:467-590`, `:1778-1998` |
| Repair | Regeneration with complaints (`authorReview.ts`), plus a field-scoped splice lane (`authorRepair.ts`, 627 lines, spawns `author-repair`, workspace-write, `:452-457`). | read |
| Retries | 1 initial + 1 gate retry + 1 "lead degradation" attempt, with a durable regen ledger. | `:108`, `:115`, `:1233-1269` |
| Spawn | `deps.spawn({role:"author-writer", sandbox:"workspace-write", model, reasoningEffort, timeoutMs:3.6M})` goes to `spawnCodexAgent`, which builds `codex exec -c model=… -c model_reasoning_effort=…`. | `:1304-1314`; `codexAgent.ts:193-200`, `:242-260` |

Its premise ("ONE author owning a whole chapter beats four blind section writers", `authorRun.ts:4-12`) is the right one. The implementation around that premise is not: the writer is grounded on paraphrase, and the conductor enforces the old rubric. INFERRED from the rows above.

## 2. Can it be revived on today's Claude route?

Not as-is. It has seven blockers. Each is VERIFIED unless marked otherwise.
1. **Spawn.** `SpawnAgent` is implemented only by codex (`autopilot.ts:955`). A claude adapter would have to return `{ok, exitCode, finalMessage, stdout, stderr, durationMs, sessionId}` (`codexAgent.ts:155-170`). The adapter could run `claude -p` with `--permission-mode acceptEdits --restricted` in the attempt workspace (`claudeRoute.ts:123`, `:225-227`), or run it read-only and write `finalMessage` to the candidate file itself.
2. **Gate.** `GATE_ATTEMPT_STATE_UNBOUND` on every attempt through the default io (keyFacts).
3. **Rubric preflight and write contract.** Both would reject the probe chapter (ease, tell, transfer, memClean). They also enforce a dealt example count and an invented "lead thread" in the fastRead and in 2+ examples (`:479-526`). This lead-thread rule is the "invented modern character" device the diagnosis blames.
4. **Card.** It grounds on the packet. Adding the span means rewriting the "ONLY allowed factual material" block and dropping "Flesch ease 72-84", "nine quiz questions" and "4-6 examples".
5. **Upstream state.** Franklin has no index, sidecars, packets, design or briefs in v24 state. The v25 research output sits inside the candidate store (on the Mac).
6. **Reader budgets.** They halt on a missing name bank and on book-wide CHB findings (`:1804-1845`). Those rules were built for invented-cast books.
7. **Tests.** 26 test files under `PIPE/tests/` reference authorRun (grep). The root workspace is only `chapterflow-v21-authored` (`package.json:9-11`), and `pipeline:test` targets that workspace (`:32-33`). So CI never runs these tests. `tsconfig.book.json` does typecheck `scripts/book/**`.

Also relevant: since #583 (2026-09-25) the **v25** summary-pack and learning-pack writers, the chapter editor and repair all receive the chapter span (`src/app/compilerApplicationPort.ts:2193-2196, 2389`; `candidateRepairApplicationPort.ts:1357, 1512`). The v24 author card never received it. Reviving v24 is therefore a step back on source access. INFERRED: because Q08 ran on #583 code and still failed with the shell (HANDOFF), access to the text alone is not what made the probe different. One writer, the whole chapter, a small brief and a stronger model at high effort together are what differ. The probe cannot separate those factors.

## 3. Option (a): port authorRun's spawn to the claude route and re-expose a verb

| Work item | Lines (est.) | Notes |
|---|---|---|
| `spawnClaudeAgent` implementing `SpawnAgent` (write or read-only mode), session log, 429 stop | 120-180 | plus tests |
| Deps wiring plus a CLI verb, or a `liveRun.ts` flag | 60-100 | `resolveDeps` in `autopilot.ts` also carries locks, run logs and heartbeat |
| Bind `gateAttemptState` for the default io | 20-40 | |
| Card: add span, drop the packet-as-only-truth, Flesch, 9-quiz and 4-6-example lines | 60-120 | breaks pins in `card-diet`, `writer-card-source-context`, `author-arch`, `stier*-levers` … |
| Disable or re-threshold rubric preflight, write contract and reader budgets | 60-150 | plus test edits in about 10 of the 26 files |
| v25→v24 research bridge for Franklin (index plus 19 sidecars), then a first run of compile-source-packets, book-design, chapter-briefs and their gates on a memoir | 150-250 plus unknown gate failures | the brief dealer deals lead thread, cast and content devices |
| **Total** | **≈500-800 changed lines in ≥8 files; 2-4 days; high risk** | stale since 07-10; its tests are not in CI |

After those edits, what survives of authorRun is the attempt-workspace, CAS-commit, provenance, lead-degradation and ledger machinery. The MVP needs none of it. INFERRED.

## 4. Option (b): a new small script (recommended)

One call per chapter: `claude -p` gets a one-page book brief plus the chapter span and returns a v21 chapter JSON. The script then runs deterministic checks, one fact-and-key check call, and at most one fix call, and assembles a package.

| Module | Lines | Reuses (file:export) |
|---|---|---|
| CLI, run dir, resume (skip done chapters), JSONL cost log | 70 | — |
| Inputs: load frozen text and map, check sha, slice span, fold `[N]` markers | 50 | `src/source/sourceTextVerify.ts:loadFrozenSource` (or read the two candidate files), `src/source/chapterMap.ts:chapterSpanText`, `src/source/sourceText.ts:ingestSourceText/normalizeIngestedText` |
| Prompt render (brief template about 4k chars; fact-check template about 2k chars, from `docs/v26-plan/evidence/probe/brief-ch01.md` and `factcheck-brief-v2.md`) | 40 | the probe brief is fully generic (no chapter-specific line; `grep` on `brief-ch01.md`) |
| Claude call (spawn with stdin prompt, strip API-key env, timeout 900 s, parse envelope, stop on `is_error`/429, no retry burn) | 70 | `src/runtime/claudeRoute.ts:createClaudeRoute(...).build/env/normalizeStdout/classifyStdout` |
| Assemble chapter (`schemaVersion`, `chapterId`, `number`, `readingTimeMinutes`) | 30 | shape of `book-packages/decisive.v21.json` chapters |
| Deterministic checks (required fields and types, tier word bands, `\n\n` paragraphs and a maximum paragraph length, quotes grounded with edge-trim and marker fold, quiz key range, key-uniquely-longest count, stem-opener repetition, cross-chapter example-title and name repeats, app validator on a 1-chapter wrapper) | 120 | `sourceText.ts:quoteIsGrounded/findQuoteOffsets`; `app/app/api/book/_lib/validate-book-package.ts:validateBookPackage`; probe `validate.mts` |
| Fact-and-key check call plus citation verification (each issue's `sourceQuote` must be verbatim in the span) | 70 | `sourceText.ts:normalizedQuote`; optional second opinion `critics/semantic/sourceFidelityJudge.ts:judgeChapterSourceFidelity` + `classifySourceFidelityFindings` with a claude `ask` adapter |
| One fix call (draft plus issues plus span, then re-check once; still failing → flag for owner) | 50 | — |
| Package plus reading copy (`book-packages/<id>.v21.json` with the rev-6 `book` block; a side-by-side markdown/HTML) | 80 | rev-6 metadata in `PIPE/book-packages/the-autobiography-of-benjamin-franklin.v21.json` |
| **Total** | **≈580 (range 450-750) lines plus about 6k chars of prompt text** | |

Effort: about 1 day to write and test hermetically with a fake runner, then about half a day for a live 2-chapter run and the owner's read. Cost per chapter from the probe envelopes: write $0.45 in 167 s, Opus check $0.27 in 42 s, and a fix call (when needed) about $0.45. Franklin's 19 chapters would cost about $15-25 and take about 1-1.5 h sequentially, or 20-30 min at 4 in parallel. For comparison, one v25 run to promotion costs $700-1,100 (HANDOFF). Risk is low: the script touches no pipeline module and only imports pure ones (import time 119 ms, `reuse-probe.mts`).

Where to put it: under `scripts/book/` (for example `scripts/book/v26/`) so that `typecheck:book` (`tsconfig.book.json` includes `scripts/book/**`) covers it. Unit tests go under root `tests/` so that `npm run test` runs them. The v24 pipeline's own `tests/run.ts` is not in CI.

## 5. Reuse map

| Need | Reuse | Caveat |
|---|---|---|
| Source freeze | Candidate `content/inputs/research/source-text.txt` (sha 8d71d7dc…); `sourceText.ingestSourceText` for new books (BOM, CRLF and `_italic_` folding; `sourceText.ts:156-158`, `254-277`) | Franklin files are on the Mac only; pin the research run `20260918T123418217Z-0e835cda…` (S09b prompt) |
| Chapter map | Candidate `chapter-map.json` (19 spans); `chapterMap.resolveChapterMap` validates anchors or offsets (gap ≤4,000 chars, coverage ≥50%, order) | For new Gutenberg books: `sourceOutline.outlineHeadings` plus a 40-line heading splitter, validated by `resolveChapterMap`. The splitter is not yet proven on Franklin (the slice has one heading, "I"). |
| Model call | `claudeRoute.createClaudeRoute` (argv including `--restricted`, the 64k output env, envelope unwrap, error classify) | The probe ran without `--restricted` in the cloud. On the Mac, `--restricted` is required: operator plugins decorated 4 of 9 reads (`claudeRoute.ts:69-80`). `usage` precedes `result` in the envelope (probe key order; `modelGateway.ts:524-527`), which matters only for 400-char head diagnostics. A full `JSON.parse` is unaffected. |
| App-shape validation | `validateBookPackage` (the v21 branch runs only id/uniqueness and quiz-key-range rules, `validate-book-package.ts:1270-1300`); root `app/book/data/bookPackages.slim-contract.test.ts` (forbids `planSpec`, `depthLevel`, `authoring` …) | A shape check, not a quality check. The probe output carries no forbidden field. |
| Pipeline package verifier | **Skip** `verifyProductionPackage.ts` (1,075 lines): it recomputes a production manifest from candidate evidence, source reality and fingerprints | It only has meaning inside the v25 release chain |
| Fact judge | The probe fact-check prompt (Opus high: 7/7 planted errors, $0.27). Reuse only the verbatim-citation check. `sourceFidelityJudge.ts` (1,100 lines, pure except `ask`) is optional. | That judge has never run live (`downstream-readiness.md` keyFacts) and inherits the strict matcher |
| Answer-key judge | Fold into the fact-check call (the probe caught planted wrong key P7). `quizKeyJudge.ts:judgeQuizKeys` is optional. | Its prompt hardcodes "three choices… 0, 1, or 2" (`quizKeyJudge.ts:125-130`), while the probe wrote 4 choices. All 141 packages use exactly 3 choices and 9 or 10 questions (17,143 questions; python over `book-packages/*.v21.json`) |
| Known-error regression set | 30 Franklin FACT PINs, each with a verbatim quote of 20+ chars (`config/book-scars/…json`), keyed to the old ch01-ch04 | Re-key them deterministically by locating each quote in the 19-span map. Use them as checker hints, not writer rules. |
| Release | `register-web`'s 6-line registration block (`cli.ts:3565-3589`), `scripts/book/generate-catalog-metadata.ts`, `scripts/book/publish-single-package.ts` (DynamoDB/S3 ingest), `npm run verify`, PR, deploy | `register-web` and `publish-final` refuse without a verified production manifest (`cli.ts:3545-3557`). Franklin is in neither root `book-packages/` nor `bookPackages.ts` (grep count 0). |
| Owner reading copy | The real app (`npm run dev` after registration) or a 40-line renderer | **Do not** reuse `review/renderReaderDoc.ts`: it drops `counterintuition` (`render.mts`: false) |

## 6. The minimum viable pipeline

| Stage | Model calls | Code |
|---|---|---|
| 0 Inputs: frozen text plus 19-span map (Franklin: copy from the pinned candidate; check that the sha equals the map's) | 0 | reuse (`loadFrozenSource`, `chapterSpanText`) |
| 1 One-page book brief (owner or Claude writes it once; the probe brief generalizes as-is) | 0-1 | template |
| 2 Write each chapter whole: Opus-class, effort high, brief plus span, v21 chapter JSON | 1 per chapter | new (claude call reuses `claudeRoute`) |
| 3 Deterministic smoke checks (shape, lengths, paragraphs, verbatim quotes, quiz sanity, cross-chapter repeats, app validator) | 0 | new ~120 lines plus reuse |
| 4 Fact-and-key check against the span; verify the citations | 1 per chapter | new ~70 lines |
| 5 At most one fix call, then re-check once; otherwise flag for the owner | ≤1 per chapter | new ~50 lines |
| 6 Package plus side-by-side reading copy (versus rr21 and a known-good catalog book); **the owner reads** | 0 | new ~80 lines |
| 7 Release: root `book-packages/`, registration block, catalog metadata, verify, PR, deploy, ingest | 0 | reuse scripts; `register-web` text without its manifest preflight |

Total per chapter: 2-3 calls, compared with ~16 per chapter in a v25 compile alone (311 calls over 19 chapters, HANDOFF), before review, QC and rubric.

## 7. v25 subsystems the MVP bypasses (PIPE/src line counts, `wc -l`)

- Research agents: bibliography and chapter researcher sidecars, i.e. the paraphrase layer (`agents/` 3.9k). Only their frozen text and map are kept.
- Compiler: source packets, source-use plans, book design, briefs, blueprints, slot deals, name, shape and pedagogy plans (`compiler/` 6.8k).
- Four section writers, `validateSectionPack` SEC1..SEC137 and their retries (`sections/` 7.4k; `app/compilerApplicationPort.ts`).
- Chapter editor pass; 3-seat reader panel; review-repair loop (`review/` 7.2k; `app/chapterEditorPass.ts`, `contentRepairWorkflow.ts`, `semanticPanelReviewEvaluator.ts`).
- Fresh QC deterministic gates (BP15, SC11, F4, EI …) and the candidate QC evaluator (`critics/` 23.2k; `qc/` 13.5k).
- Catalog rubric gate; promotion; candidate store; production manifest; `verify-production-package`; candidate release; `publish-final` (`release/` 2.9k, `publish/` 2.5k).
- Run-state, model gateway, execution policy, CLI qualification (`run-state/` 1.5k, `runtime/` 2.4k, `exec/` 1.0k).
- Scars, name bank, voice card and voice bible, reader budgets; the v24 autopilot, authorRun, authorReview and forward runtimes (`orchestrator/` 27.8k); bakeoff (`bakeoff/` 15.9k, codex-only: `runBakeoff.ts` imports `findCodexBinary`).

The pipeline `src/` is 179,761 lines in 486 files. The MVP imports about 1,000 lines of pure modules and adds about 600 lines.

## 8. Other findings through this lens

- VERIFIED: **Effort was lowered because of prompt size.** `config/model-routing.json` `_comment`: author went high→medium on 09-17 because at high "the section writer spent its whole 64k output budget on thinking… (stop_reason=max_tokens)". With a 23.8k-char prompt, the probe at high used 13,557 output tokens (5,590 of them thinking), `stop_reason=end_turn` (`evidence/probe/envelope-call1-writer-opus5.json`).
- VERIFIED quote / INFERRED implication: **the v21 example contract reproduces the Q08 shell.** All three probe examples are an invented modern person followed by a fix and a rationale ("Marisol coordinates shifts…", "Tomasz has redrafted his illustrator bio…", "Aneta has started recording her grandfather…"), with `whatToDo` and `whyItMatters` fields. That is the same shape as Q08's shell, at 3 per chapter instead of 6. Keeping the app shape unchanged (zero app work) keeps these fields, so the brief must decide what an example is for a memoir. One option is fewer examples, drawn from Franklin's own episodes.
- VERIFIED: **The probe's quiz has a real test-taking tell.** The key is the uniquely longest choice in 5 of 6 questions (lengths `[76,65,97,71]` key 2, `[69,59,60,61]` key 0 …). A reader can exploit this cue, so the MVP should keep a cheap length check (smoke alarm, not target).
- VERIFIED: **No earlier writer prompt ever gave a whole-chapter writer the source.** June's `STEP-2-WRITE-CHAPTERS.md` (98k chars) plus `FIELD-PURPOSE-CONTRACTS.md` (45k) and the v22 writer card all ground on "the chapter's source sidecar" (`PIPE/agent-prompts/V22-WRITER-CARD.md` "Use the source sidecar for source-specific claims"). The probe is the first whole-chapter write from the book's text.

## 9. Risks and open questions

- **Sameness across a whole book is unmeasured.** The probe is one chapter. The MVP should write chapters 1 and 13 (or 1, 7, 13, 19) before a full book, and the smoke checks should compare example names and titles, stem openers and hooks across chapters.
- **Many books.** The source-grounded writer needs the book's text. Gutenberg classics can use `ingestSourceText` plus a heading split. For in-copyright catalog books (most of the 140), the pipeline has only `model-memory` (`sourceText.ts:26-36`). This decision belongs to the owner, not the code.
- **Quota.** Opus calls share the weekly subscription quota. The script must stop on the first 429 envelope (`is_error`, `api_error_status`) rather than burn retries (the defect-#20 class; `modelGateway.ts:417-455`).
- **The Mac-only inputs are unverified here.** The candidate's `chapter-map.json` shape and whether `loadFrozenSource`'s run layout (`source-freeze/…`) matches the candidate layout (`content/inputs/research/…`) are unchecked. The script may need to read the two files directly (5 lines).
- **Choice count.** The catalog is 3 choices and 9 questions everywhere; the probe used 4 and 6. The app accepts both (no 3-choice assumption found in `app/`, `components/`, `lib/`). The owner should pick one; 3 keeps the reusable key judge prompt valid.

## Adversarial verification

Verifier re-ran `card.mts`, `rubric-probe.mts`, `reuse-probe.mts`, `quotes2.mts` (copies plus `rubric-all.mts` in `scratchpad/scan/verify-reuse-v24-writer/`, 0 model calls) and re-opened every cited line at `22e021d`.

| id | verdict | evidence |
|---|---|---|
| R1 | CONFIRMED | `authorRun.ts:722` "This is the ONLY allowed factual material", `:345` "Flesch ease 72-84", `compiler/sourcePacketProjection.ts:73` = 200 (path is `src/compiler/`); 0 hits for spanText/sourceSpan/chapterSpan/loadFrozenSource in authorRun.ts; `card.mts` re-run: 22,696 chars, 78 directive lines, brief 7,918, packet 7,830, Flesch true, `<source>` false. The packet does carry ≤200-char verbatim `sourceQuote` snippets, so "not the book's text" means no chapter span. "Diagnosis points 5 and 2" has no numbered source in the repo. |
| R2 | PARTIAL | All four threshold metrics fail (ease 49.945, tell 0.833, transfer 0.333, memClean 0). But the two other blocking card-quality metrics pass (lengthTell 5 ≤ cap 9, practiceFloor 2), so it is not "every metric that can fail". The rubric preflight runs only after `gate.code === 0` (`authorRun.ts:1399-1420`), and the default io gate refuses with `GATE_ATTEMPT_STATE_UNBOUND` (`chapterTransaction.ts:501-509` passes no options; `chapterGateComposite.ts:83-91`). So the "plainer, shorter sentences" retry (`:1463`) is reached only once the gate binding is fixed. |
| R6 | PARTIAL | The cited facts hold: 26 test files (grep re-count), workspaces = v21 only (`package.json:9-11`), `ci.yml:183` runs only `pipeline:test`, and `tsconfig.book.json` includes `scripts/book/**`. Reuse exports exist (`loadFrozenSource` :122, `chapterSpanText` :382, `quoteIsGrounded` :248, `validateBookPackage` :1270). The line counts, days and risk levels are estimates and can't be reproduced. The report misses `pipeline24:test` (`package.json:38`), which exists but is not run in CI. |
| R7 | CONFIRMED | Re-run prints the exact argv/env; `normalizeStdout` → 11 keys, classify null (import 39 ms here). `claudeRoute.ts:211-251`; `modelGateway.ts:524-527`; envelope key order puts `usage` 5th and `result` 16th. ANALYSIS.md:44 shows the probe used the same flags minus `--restricted`. |
| R13 | PARTIAL | Quiz lengths and keys match exactly. q4 [66,69,69,64] ties, so 5/6 is right. The 3 examples are modern invented people with whatToDo/whyItMatters. But the probe brief itself ordered that shape (`evidence/probe/brief-ch01.md:19`: "Each is a short modern situation… do not retell Franklin's anecdote"). So the brief caused it, not the v21 contract or zero app work. Nothing is known about the writer's behaviour under a different brief. The Q08 comparison rests on Mac-only text. The length tell appeared even though the brief said "Distractors… similar in length" (`:20`). |

**Missed:** §4 row "Prompt render" and §6 stage 1 say the probe brief is "fully generic" and "generalizes as-is". But `brief-ch01.md:19-20` hard-codes the parts the report blames elsewhere: examples as "a short modern situation" that must not retell Franklin (the Q08-shell source, §8), and a quiz of 6 questions × 4 choices. That quiz shape conflicts with the catalog's 9-10 × 3 norm and with the reusable `quizKeyJudge` prompt (§5, §9). The MVP's brief template must be rewritten, not reused as-is. That is a design decision, not a 0-line reuse.
