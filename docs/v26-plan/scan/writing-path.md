# Scan lens: what a writer is given and asked to optimise

Investigator report, 2026-09-27. Repo `/home/user/ChapterFlow` at `22e021d84` (origin/main). Read-only except this file; 0 model calls.
`PIPE` = `scripts/book/prompts/chapterflow-v24-author-pipeline`. `sT` = `PIPE/src/sections/sectionTasks.ts`, `cAP` = `PIPE/src/app/compilerApplicationPort.ts` (read with `grep -a`), `sG` = `PIPE/src/sections/sectionGate.ts`.
Scratch scripts (tsx over the real pipeline modules, no model calls) are in `/tmp/claude-0/-home-user-ChapterFlow/48916df7-45f9-50d8-ad9d-e43b21e61800/scratchpad/scan/writing-path/`:
`render-cards.mts` (renders the real v25 section cards for Franklin ch13/15/19 from the committed q05 sidecars, with the real voice card and scar file; the rendered cards are saved there as `chNN.<kind>.card.md`), `scars-per-ch.mts`, `pairs.mts` (dealt quiz/example fact-case pairs), `ease.mts` (Flesch on Franklin's text and the Opus probe), `editor.mts`, `count.py` (constraint-sentence counter).
Run with `cd /home/user/ChapterFlow && node_modules/.bin/tsx <script>`. Tags: VERIFIED (opened or run here), INFERRED, HANDOFF.

## keyFacts

- VERIFIED. **Every section writer gets a trusted 64-80k-char card, and 63% of it is research paraphrase.** Measured on real Franklin ch13/15/19 cards (DIRECT_JSON, the production mode). A writer's own rules take 10-12k: the contract, 10-22 scar rules and 7 style notes, and the voice card. The DO NOT block adds 4.2k: 82 hard-banned phrases, 9 soft budgets and the em-dash rule. The dealt blueprint slice is 5-11k. The "SOURCE PACKET — ONLY allowed facts/cases/numbers/entities" block is 43-52k. In ch13, only **1,350 of the packet's 43,030 chars are verbatim book text**; the other 97% is model paraphrase.
- VERIFIED. **Most of the rest of the request is more paraphrase.** Every writer also gets these untrusted records (`cAP:2378-2389`, paths from `researchCandidateApplicationPort.ts:659-663`):
  - the raw sidecar JSON (23.7-28.7k);
  - its text rendering `chNN.source.txt` (16.4-17.5k);
  - `book-source.md` (the book-level paraphrase);
  - `toc.json`;
  - the chapter index.

  Only the summary and learning writers also get `source_span`, the chapter's own text (`cAP:2193-2195`). It comes as the last record, escaped onto a single JSON line, and the card says it "adds no citable material" (`sT:1020`). The **example and action writers never see a word of the book.**
- VERIFIED. **The card strips four things out, and the records put them straight back in.** The card removes `hardEdge` (described as "the tempting WRONG reading"), `paraphraseNotes`, `voiceCues` and quotations from its packet (`sT:858-877`). The raw `source_sidecar` and `source_1` records still carry all four, to all four writers. That includes the D18-excluded "Let this be for the Indians to get drunk with" (ch13 fixture) and the excluded ch15 "racially charged period joke" cue (`PIPE/src/compiler/sourcePacket.ts:178-187`, which filters only the card's copy).
- VERIFIED. **The #586 voice fix gives the writers almost nothing to quote.** The summary writer may quote only research-extracted lines, "at most two" (`sT:682`). Rendered real cards show:
  - ch13: 0 quotable lines (its one line is D18-excluded);
  - ch15: 0;
  - ch19: 2, and both are other people's words (Shirley, Innis), not Franklin's.

  The same card tells the writer to "Paraphrase" the span and "not copy long runs of its wording" (`sT:1019`). The Opus probe, given the span as its authority, placed 44 verbatim quotations.
- VERIFIED. **Franklin's own prose fails the writer's readability rule by ~20 points.** The card requires Flesch ease ≥70, FK ≤7/8.5/9.5 and "no sentence over 30 words" (`sT:112,215`; SEC12 blocker at `sG:2939,2964`). Franklin's chapter-I text scores ease 52.8, FK 13.0, 29.0 words a sentence, with 43 of 121 sentences over 30 words. The proprietaries slice scores ease 49.6. The Opus probe breakdown scores 49.9 (`ease.mts`). A writer can match both the voice card ("a long, clause-linked line") and SEC12 only by chopping sentences.
- VERIFIED. **The rulebook is the reason the writers run at medium effort.** `config/model-routing.json:3` (commit 7f38617, 2026-09-17) records it: "at high the section writer spent its whole 64k output budget on thinking blocks (stop_reason=max_tokens, zero text) … the same prompt at medium finished in 517 s". One pack at medium took 517 s. The Opus probe wrote a whole chapter at **high** in 167 s with 5.6k thinking tokens, from a 3.4k brief plus the span.
- VERIFIED. **The blueprint gives quiz slots a fact and a case from different episodes, and the card forbids joining them.** Real ch13 deals:
  - q02: the trustees-one-per-sect fact with the Carlisle Indian treaty case;
  - q03: the flat-pane street lamps with the Craven-street sweeper;
  - q04: the postmaster's profit-contingent pay with Dr Bond's hospital.

  This comes from `dealCaseCue`: relevance first, then variety, with a cap of 1 per case (`chapterBlueprint.ts:1175-1207`). The card then says "Never join a slot's fact and its assigned case into one event" (`sT:938`), "Keep each stem to 30 words … name at most one case" (`sT:229`), "If a stem names a case, the question must hinge on it" (`sT:230`), and asks for 7 of 9 stems with an exact cue phrase (`sT:189`). The answer positions are dealt before any text exists (`answerIndexPattern` [1,0,1,2,1,0,0,2,2]; "correctIndex (MUST match the blueprint slot)", `sT:133`).
- VERIFIED. **Chapter-scoped scar rules are keyed to the old 4-part numbering.**
  - Writers of 19-chapter ch01-ch04 get 6/8/12/6 NON-NEGOTIABLE FACT PIN or NAMED ACTOR rules about other chapters' episodes.
  - ch05-ch19 get none. That includes ch13 (hospital, Bond: the scar's "ch03" pins) and ch19 (Penn meeting, Granville, Hanbury: the scar's "ch04" pins).
  - Source: `scars-per-ch.mts`; the filter is `PIPE/src/lib/bookScars.ts:106-125`.
- VERIFIED. **No v25 writer, editor or repair prompt asks for paragraph breaks.** Not one line in `sT`, `chapterEditorContract.ts` or the repair contract says to separate paragraphs with a blank line (grep "paragraph", "blank line"). The probe brief did ("Separate paragraphs with a blank line"). The app splits paragraphs only on blank lines (see app-render.md).
- VERIFIED. **The v24 card states which rule wins a conflict; the v25 card does not.** The v24 card opens with a 6-level PRECEDENCE list (`authorRun.ts:328-335`). The v25 card has no conflict rule anywhere. The one exception is the scar header, "the one that protects the reader from harm wins" (`sT:306`). Every card instead ends with "RUBRIC TARGETS: …" (`sT:215,223,232,242`). The writer's stated objective is the grader's metrics.

## 1. What one v25 section writer receives (Franklin, one chapter, on main)

The rendered prompt is: a header, then the TRUSTED blocks (`control`, `task_card`), then INPUT_RECORDS, each record one JSON line tagged `CHAPTERFLOW_UNTRUSTED_INPUT_V1` (`PIPE/src/runtime/promptRenderer.ts:85-88,153-179`; `untrustedData.ts:29-37`).

| # | Record | Trust | Size (ch13 / ch19) | Content | Which writers |
|---|---|---|---|---|---|
| 1 | control | instruction | 0.1k | "Return only section JSON…" | all 4 |
| 2 | task_card | instruction | summary 67.9k / 79.4k; example 69.1k / 77.8k; learning 70.6k / 79.9k (+ drafted prose and derivability lists in production); action 63.9k / 72.9k | contract, scars, voice card, DO NOT, schema, dealt blueprint slice, MUST TEACH / QUIZ SLOT CASES, CHAPTER CONTEXT (paraphrase, "not citable"), quotations (summary only), the SOURCE PACKET (43-52k), the span pointer, and retry feedback | all 4 |
| 3 | chapter_index | untrusted | n/m | ChapterSpec[] | all 4 |
| 4 | source_sidecar | untrusted | 24.4k / 28.7k | raw research JSON, including hardEdge, paraphraseNotes, quotations and voiceCues | all 4 |
| 5 | source_1 = chNN.source.txt | untrusted | 16.4k / 17.5k | the same research rendered as text (`researcher-chapter.ts:1908`) | all 4 |
| 6 | source_2 = book-source.md | untrusted | n/m | thesis, teaching arc, author voice, each chapter's core claim (`researcher.ts:1445`) | all 4 |
| 7 | source_3 = toc.json | untrusted | n/m | the bibliography record | all 4 |
| 8 | source_span | untrusted, **last** | ≤60k (`chapterMap.ts:86`); about 20k on average (377,692 B / 19 spans) | the book's own text | **summary and learning only** |

In total that is about 150-190k per call (HANDOFF), consistent with the parts measured here. **Paraphrase outweighs book text about 4:1 for the summary writer; the example and action writers get paraphrase only.** Retries add up to 8 blocker lines, the whole rejected draft, and "Resolve every listed blocker and change nothing else" (`sT:814`; `cAP:84` MAX_SECTION_ATTEMPTS=3, `cAP:640`).

Noise in the card: the summary writer receives the whole `reservedVariety` (`sT:843`), so it also gets the example cast, a venue palette, the quiz `answerIndexPattern`, `actionMechanism` and `weeklyPracticeForm`. The blueprint's `fullReadTargetChars` is [2400, 4200], while the contract says "aim 2700-3400". The field gets two different length targets in one card.

## 2. What each writer is told to optimise (from the rendered ch13 cards)

Constraint sentences in each card, excluding JSON and the banned lists (`count.py`): summary 112, example 98, learning 102, action 86. On top of that come 82 hard-banned and 9 soft-banned phrases. The summary card names 24 gate ids. For comparison, the probe brief has 17 constraint sentences, and the v21 STEP-2 law has 489 in 98k chars.

- **Summary**:
  - tier floors and aims, FK ceilings, Flesch ≥70, no sentence over 30 words, no monotone runs (`sT:112`);
  - tiers must not restate each other, and the first sentences must differ (SEC130/131, `:113`);
  - do not close on a limit (`:114`);
  - every dealt case shows 2 hardSpecifics in the hook, fast read, deep read or keyTakeaway, and every dealt year figure appears there too (MUST TEACH, `:971-993`);
  - no specific in more than half the units (SEC14/SEC129, `:168`);
  - hook of at most 25 words in the dealt hookShape, with first-word variety across chapters (`:169,213`);
  - at least 3 memorable-line candidates of 8-14 words, at least 2 of them ≤14 words (`:213-215`);
  - chapter-specific skeletons that "open from this chapter's core move" (`:166`);
  - anchor claim types (SEC13);
  - "lived moments … THEN name the principle it proves" (`:85`);
  - the voice card, at most two quotes, the scars, and the banned lists.
- **Example**:
  - six slots, each dealt a name, venue, sceneMode, sceneFrame, requiredBeat, fact and case (ch13 ex01: "Marcel", "a councillor's anteroom", "stakes audit", "a promise made in public that the next week tests", "show a plan resized after someone with standing objects", the trustees-one-per-sect fact);
  - 50-90 words each, with a named person, stakes (SEC31), and at least 4 kinds of whatToDo;
  - whyItMatters in at most 2 sentences / about 40 words, sharing at least 2 roots with the fact's mechanism and whyWrong (SEC39), never naming the source (SEC137), never recalled by a character (SEC133);
  - no 5-word phrase repeated across 3 fields (SEC87), and cross-chapter engine variety (SEC85-SEC112) (`sT:120-128,175-179,220-224`).
- **Learning**:
  - 9 questions with dealt key positions, shapes, traps and case cues;
  - 3 choices, with the key sized to the longer distractor's word count ±3 and at most 1.5x the average characters, and never the longest (`:187-188`);
  - hedge words in the distractors as often as in the key (`:135`);
  - at least 7 of 9 stems containing an exact cue phrase ("you are", "imagine", "suppose", "a colleague", "your team", "scenario", "consider a"; `:189`, `rubricMetrics.ts:311`);
  - no first word opening more than 3 stems;
  - stems of at most 30 words naming at most one case, with the case never joined to the fact (`:229,938`);
  - everything derivable from the hook, fast read, deep read and takeaway only (SEC120, with computed allowed and not-allowed lists, `:735-767`);
  - 7 cards with backs of at most 25 words and no angle-announcing openers (SEC132, `:231`).
- **Action**:
  - tryThisNow ≤35 words, coreSkill ≤60, each if-then ≤30, the challenge and weekly practice ≤40 each (`:144`);
  - coreSkill built on the dealt practiceForm and practiceConstraint;
  - if-then contexts as situational triggers with 3 different first words (SEC67);
  - exactly ONE hardSpecific verbatim (SEC74, `:199`);
  - never name the example characters (SEC119);
  - no cross-chapter shells (SEC84/94/102/109/114/115).

## 3. Top conflicting-instruction pairs (quote both sides)

| # | Side A | Side B | What the writer is left with | Status |
|---|---|---|---|---|
| C1 | `sT:112` "the assembled breakdown reads at Flesch ease >=70 … no sentence over 30 words" (SEC12 blocker `sG:2939,2964`) | voice card `voiceCard.ts:144` "rhythm: … a long, clause-linked line"; `sT:682` "Quote … verbatim … let the line carry the irony"; scar note "Let his comic and self-mocking details stand as he tells them" | Franklin's own text scores ease 52.8, and 36% of its sentences run over 30 words. A verbatim line or an imitated cadence blocks the draft, so writers chop sentences (rr21: 12-14 words a sentence, HANDOFF). | VERIFIED |
| C2 | the blueprint deals a fact and a case from different episodes (ch13 q02-q04 above; `chapterBlueprint.ts:1188-1207`) and fixes the key index ("MUST match the blueprint slot", `sT:133`) | `sT:938` "Never join a slot's fact and its assigned case into one event"; `sT:229` "stem to 30 words … at most one case"; `sT:230` "If a stem names a case, the question must hinge on it"; `sT:189` 7/9 cue-phrase stems | The stem is about case X, the key is about fact Y, all in 30 words with "suppose/imagine". Result: stem and choices about different situations (the Q08 root cause). | VERIFIED |
| C3 | SEC39: whyItMatters must share at least 2 roots with the fact's mechanism and whyWrong (`sG:2494-2500,3312-3320`). The message names no terms (`sG:3317`). The pool is Franklin-specific ("The commissioners strictly forbade selling liquor during the treaty…") | `sT:127` "in the scene's own terms … Never name the source case or a source figure"; `sT:177` "A whyItMatters that names a source figure or case is refused (SEC137)"; `sT:125` "at most 2 sentences, about 40 words" | The writer must echo a hidden vocabulary drawn from an 18th-century fact inside an invented modern scene, without naming it: the SEC39 livelock. | VERIFIED (livelock itself HANDOFF) |
| C4 | `sT:166` "open from this chapter's core move". The coreMove is ONE fact's researcher-written "because" (ch13: "Spreading payments over several years lowers the immediate financial burden…"). `sT:185` "every correct answer names this chapter's requiredFactIds mechanism" | scar prohibition (`book-scars/…franklin.json:59`) "NO FALSE UNIVERSAL: never present one mechanism as a chapter's … single lesson when the text itself narrates others"; CHAPTER CONTEXT focus: "each through a different mechanism" | The writer is told to frame every tier on one installment mechanism while being told that doing so is absolutely forbidden. | VERIFIED |
| C5 | `sT:85` (KEEP VERBATIM, snapshot-locked) "let the reader briefly FEEL the moment, THEN name the principle it proves"; `sT:213-215` "at least three … memorable-line candidates … portable", "at least two clean" | voice card "never: grandeur, moralizing"; `sT:682` "do not explain it"; scar "never explain the joke away"; `sT:213` "At most one standalone principle sentence per tier, never a paragraph's last"; scar "fastRead, deepRead and fullRead … never address the reader or give advice" | The writer is required to write portable morals and told never to moralize. Maxims went down after #586 (HANDOFF), but the requirement is still there. | VERIFIED |
| C6 | `sT:1017` "The span is the book: where the SOURCE PACKET … disagrees with it, follow the span" | `sT:1020` "It adds no citable material: names, numbers and cases still come only from the SOURCE PACKET"; `sT:395`; MUST TEACH dealt facts and years (`sT:971-993`); dealt `requiredFactIds` per slot | When the paraphrase is wrong, the writer can only drop it. It cannot use the right fact from the span, and the dealt slots still demand the wrong one. | VERIFIED |
| C7 | scar note "Never announce a limit or nuance … state it inside the story"; `sT:114` a limit or negation close "at most one chapter in three" | `sT:113` "fullRead adds … the hard edge or limit, and the nuance", each in its own sentences; `sT:127` "or where it stops working" | The limit is mandatory, gets its own sentences, and may be neither announced nor used as the close. | VERIFIED |
| C8 | `sT:113` "a longer tier ADDS, it never restates … no fullRead sentence reuses a deepRead sentence" (SEC130/131) | the product shows ONE tier per mode (`ChapterReaderClient.tsx:144`, `ReaderPhaseContent.tsx:105`). A Challenge-mode reader sees fullRead only, and a default reader sees fastRead only (app-render.md) | fullRead is built to depend on deepRead, which its own reader never sees. deepRead is "complete enough … to answer the quiz" (`:113`), but default users read fastRead. | VERIFIED (code) + INFERRED (reader effect) |

Smaller collisions:
- The voice card says "never … a modern coaching voice" (`voiceCard.ts:146`), yet it is rendered in full to the example writer, whose whatToDo is "the ONE move the reader would make" (`sT:126`).
- `sT:124` calls ex01/ex03/ex05 "even slots".
- ch13 ex02 is dealt purpose "failure-mode", sceneMode "mistake-recovery" and sceneFrame "an unexpected kindness that lands and gets retold afterward" at the same time (`pairs.mts`, rendered card).

## 4. The writing setups side by side

| | v25 section writers (today) | v25 chapter editor | v25 repair writer | v24 author (July books) | v21 law (June books) | Opus probe (09-27) |
|---|---|---|---|---|---|---|
| Who writes | 4 blind calls per chapter (summary → example → learning → action), each ≤3 attempts, plus 1 summary re-draft (`cAP:84,119`) | 1 whole-chapter call, ≤2 attempts (`chapterEditorPass.ts:84`) | 1 whole-chapter call per round | 1 codex agent per chapter, 1 + 1 retry + 1 lead-degrade (`authorRun.ts:108,115`) | an operator session per book (HANDOFF) | 1 call |
| Model / effort | claude-sonnet-5 / **medium** (`model-routing.json:7`; high hit the 64k cap, `:3`) | role "author" (`chapterEditorPass.ts:311`), so sonnet-5 medium | sonnet-5 / high (`model-routing.json:8`) | gpt-5.5 / xhigh (`authorRun.ts:460-461`, `modelPolicy BASELINE_MODEL`) | believed Codex (HANDOFF) | claude-opus-5 / high |
| Input size | card 64-80k + ~45k paraphrase records + span ≤60k: about 150-190k per call | writing contract 24.6k + scars 5.7-9.6k + brief 4.3k + reader view + 4 packs + packet + span ≤60k | contract 25.2k + scars + failed chapter + packet + plan + span + findings | card ≤25k (`authorRun.ts:103`), 22.7k measured (reuse-v24-writer.md) | 98k law + sidecar + toc + every prior chapter, read with tools | 3.4k brief + ~20k span |
| Source text? | summary and learning only, since 09-25 (#583); the last untrusted record; "adds no citable material" | yes, span ≤60k; FIDELITY "against source_span" (`chapterEditorContract.ts:89`) | yes, span; "adds no citable material" (`candidateRepairApplicationPort.ts:1496`) | **no**: packet with ≤200-char quotes, "the ONLY allowed factual material" | **no**: sidecar paraphrase is "your primary source" (`STEP-2:558`) | **yes**: "your ONLY authority for facts" |
| Constraints | 86-112 constraint sentences per card + 91 banned phrases + dealt slots; 138 SEC checks behind them | all 4 contracts + 12 brief lines + 8 preservation rules | all 4 contracts + scars + "Repair only supplied chapter findings" (`:1470`) | precedence, 5 invariants, 5 craft targets, 7 reviewer axes, self-verify; Flesch 72-84 "short words, one idea per sentence" (`authorRun.ts:345`) | 489 constraint sentences; avg sentence ≤14/16/18 words, "NO sentence over 30 words" (`STEP-2:728`) | 17 constraint sentences |
| Conflict rule | none (scars: "protects the reader wins") | "an edit that keeps the rules is worth more than an ambitious one" (`:310`) | "a repair that clears a finding while breaking a rule … has not repaired anything" | explicit 6-level PRECEDENCE | "Gate reference — tripwires, not the spec" | n/a |
| Sees the rest of the chapter? | example and action: no prose, no span. Learning: summary prose. Summary: nothing downstream | yes: reader view + packs | yes: the failed chapter | yes, it writes it all | yes, plus prior chapters | yes |
| Output | one pack JSON, assembled deterministically | the 4 packs, edited in place | a whole ChapterV21 | a whole ChapterV21 file | whole ChapterV21 files | a whole ChapterV21-shaped JSON (3 examples, 6 quiz, 5 cards) |

## 5. What the editor and the repair writer may and may not change

- **Editor, may**: reword any sentence, move sentences between tiers, delete restatement, and rewrite the two wrong choices (`chapterEditorContract.ts:100-108`).
- **Editor, may not**:
  - change ids, `correctIndex` or the keyed choice's words;
  - add or drop fields or citations;
  - lose or add any digit-written number;
  - lose or add any proper name.

  So it **cannot fix a wrong year, a wrong name or a wrong key.** Its FIDELITY line limits it to "using names and figures already in the chapter" (`:89`).
- **Editor's other limits**:
  - It is told to "Aim the whole chapter at about 16,000 reader-visible characters" (`:87`), but it must keep 6 examples, 9 questions and 7 cards and every section floor, and it is re-gated by the same SEC checks.
  - Its CADENCE line repeats the 30-word cap (`:83`), and its VOICE line repeats "at most two" quotes (`:88`).
  - "If it fails twice, the UNEDITED chapter ships" (`:310`). The incentive is timidity.
  - It runs at medium effort. INFERRED from the role at `chapterEditorPass.ts:311`.
- **Repair**:
  - It rewrites a whole chapter under the concatenation of all four section contracts (`candidateRepairWritingContract.ts:297-309`), plus scars, plus "Repair only supplied chapter findings. Preserve chapter identity." (`candidateRepairApplicationPort.ts:1470`).
  - The binding writing contract travels as an *untrusted* record that the control text has to re-declare as instruction.
  - It cannot choose to write the chapter differently. It inherits every conflict in §3.

## 6. Findings

| id | Finding | Status |
|---|---|---|
| W1 | Section card sizes by kind (above). The packet is 43-52k of each card, and 97% of it is paraphrase (1,350 of 43,030 chars verbatim in ch13). The rules proper take 14-16k. | VERIFIED (`render-cards.mts`) |
| W2 | Example and action writers never see the book or the chapter prose (`cAP:2193-2195`; `sT:705` prose only for learning). Four blind writers is literal. | VERIFIED |
| W3 | The card's stripping of hardEdge, paraphraseNotes, voiceCues and quotations (`sT:858-877`) is undone by the raw sidecar records sent to all four writers, including the D18-excluded line. | VERIFIED |
| W4 | Quotable lines per chapter after #586: ch13 0, ch15 0, ch19 2 (neither Franklin's). The span may not be quoted beyond "long runs" (`sT:1019`). | VERIFIED |
| W5 | Franklin's own prose fails the SEC12 readability floor by ~17-20 ease points, and the probe's prose, which carries his voice, fails it too. | VERIFIED (`ease.mts`) |
| W6 | The medium effort is forced by the prompt: at high the section writer thought to the 64k cap with zero text (`model-routing.json:3`, 7f38617). | VERIFIED |
| W7 | Quiz fact and case are dealt from different episodes, and the key positions are dealt before any text. Combined with the never-join rule, the 30-word cap and the cue-phrase rule, this gives stem/choice mismatch and wrong keys after a length fix. | VERIFIED (deal); HANDOFF (Q08 outcome) |
| W8 | Scar FACT PINs are keyed to the 4-part numbering: 32 pins go to ch01-04 about other episodes, and none to the chapters they govern (ch13, ch19 …). | VERIFIED (`scars-per-ch.mts`) |
| W9 | No writer, editor or repair prompt asks for paragraph breaks, so one-paragraph tiers are an omission in the prompt. | VERIFIED (grep) |
| W10 | Each card's craft block ends with "RUBRIC TARGETS: …" (`sT:215,223,232,242`). The code documents the block as "what excellent looks like (the rubric grades this)" (`sT:61,205`). The writer is told to optimise the grader. | VERIFIED |
| W11 | The rules themselves minted tics, according to the code's own comments. The SEC117 cue list became openers: "108 of rr21's 171 stems then opened 'Suppose'/'Imagine'" (`sG:3681-3682`). The SEC33 token floor became the tie-back closer: "88 of 114 examples carried it only there" (`sG:2508-2516`). | VERIFIED |
| W12 | v21 required every scenario to anchor in a source case ("reference at least one proper noun from the sidecar", SC9, `STEP-2:28`). v25 now forbids naming or retelling it (`sT:177`, #587, 09-25). The invented-modern-character shell is written into the contract. The schema scenario → whatToDo → whyItMatters is the "fix + rationale" shell. | VERIFIED (rules); INFERRED (shell cause) |

## 7. Implications (through this lens)

1. A whole-chapter writer needs a brief under 5k, the span as its **only** factual authority, and quoting allowed. Do not reuse `sectionContract`, `renderBookScarsBlock` or the packet projection as they stand. Each one brings C1-C7 back with it.
2. If any v25 piece is kept (H-B), these no-model fixes follow from this lens:
   - move the span ahead of the paraphrase and let it supply facts;
   - send example and action writers the span and the drafted prose;
   - drop the raw `source_sidecar` / `source_1` records, or strip them the way the card is stripped;
   - pair quiz cases to their own episode, or deal no case;
   - key the scars to the 19 chapters;
   - add the paragraph instruction;
   - remove RUBRIC TARGETS from the cards;
   - make SEC12 advisory for memoir, since it cannot be satisfied in Franklin's register.
3. Do not raise the effort on the current cards. The failure at high was thinking exhaustion, not quality.
4. Any fact check must be able to **change facts**. The editor cannot, by design.

## Reproduce

`cd /home/user/ChapterFlow/scripts/book/prompts/chapterflow-v24-author-pipeline && ../../../../node_modules/.bin/tsx <scratch>/render-cards.mts` (and likewise `pairs.mts`, `scars-per-ch.mts`, `ease.mts`, `editor.mts`); then `python3 <scratch>/count.py <scratch> <brief> <STEP-2>`.

## Adversarial verification

Verifier pass, 2026-09-27, same commit (`22e021d`), 0 model calls. The investigator's scratch scripts were re-run (`ease.mts`, `pairs.mts`). A new 0-call script, `scratchpad/scan/verify-writing-path/scores.mts`, prints the case-linkage scores behind the ch13 quiz deal.

- **W2: PARTIAL.** The record order and the span gating reproduce: `cAP:2193-2195` sends the span to summary and learning only, and `cAP:2378-2389` puts `source_span` last. `untrustedData.ts:29-37` renders each record as one JSON line, and `sT:1020` says "adds no citable material". The claim that example and action writers "never see a word of the book" is wrong, though. Every card's SOURCE PACKET carries bounded verbatim `sourceQuote` fields on facts and cases: 15/16/18 of them in ch13/15/19, about 1.37k characters in ch13 (`sT:878-885`). The raw `source_sidecar` record, which all 4 writers get, carries 29/27/35 `sourceQuote` fields. So they get Franklin's words only as short fragments, and no rule says whether they may quote them. The 4:1 ratio is plausible (43k + 24k + 16k + book-source against about 20k of span) but was not re-measured.
- **W4: CONFIRMED.** The rendered cards give `grep -c "THE BOOK'S OWN WORDS"` = 0/0/1. The ch13 quote is excluded by `sourcePacket.ts:178-187`, and ch15 has no `quotations` key. The ch19 card lines 198-199 are Shirley's and Innis's words. The rule is at `sT:682`, and `sT:1019` says "Paraphrase it; do not copy long runs". For the probe, a simple count finds 42 double-quoted spans, 41 of them verbatim in the ch-I slice fixture; ANALYSIS.md records 44/44 via `probe_tools.py`. One caveat: these are the 3 q05 fixtures, not all 19 production sidecars.
- **W5: PARTIAL.** `ease.mts` reproduces every number exactly: the slice scores 52.8 / FK 13.0 / 29.0 words a sentence / 43 of 121 sentences over 30 words, the proprietaries slice 49.6, and the probe breakdown 49.9. Ease >=70 and the FK tier ceilings are SEC12 blockers (`sG:2938-2940` and `:2956-2965`, with floors at `readingLevel.ts:54-67`). Two corrections:
  - "No sentence over 30 words" is not SEC12. It is `E7.long_sentence`, a major raised at chapter assembly (`sT:112`, `finalGate.ts:384`).
  - The same card line says "a long clause-linked sentence of short words passes". So the voice card's "long, clause-linked line" is reconciled in text, and the conflict bites through word length and verbatim quoting, not through clause-linking as such.
- **W6: PARTIAL.** The facts reproduce: the `model-routing.json:3` comment and `:7` (author = medium), commit 7f38617 (2026-09-17), and "the same prompt at medium finished in 517 s". The probe envelope shows 166.7 s, 5,590 thinking tokens and end_turn. Two problems:
  - The routing comment attributes the failure to "the same prompt", not to the rulebook. The prompt also holds about 85-100k of paraphrase records, so blaming the "rulebook load" is an inference.
  - The comparison mixes models: production is claude-sonnet-5 and the probe is claude-opus-5.
- **W7: PARTIAL.** `pairs.mts` reproduces q02 (sect trustees with Carlisle), q03 (lamps with sweeper) and q04 (postmaster with hospital), and the keys [1,0,1,2,1,0,0,2,2]. The quoted rules check out at `sT:133,189,229,230,938`. The mechanism is more specific than "relevance then variety", as `scores.mts` shows. `dealCaseCue` checks `CASE_LINKAGE_MIN_SCORE`=2 only on the top-scored case (`chapterBlueprint.ts:1187`). Cap 1 plus `CASE_CUE_HEAD_TOLERANCE`=1 then deals a case below the floor. Example: q02's academy case (score 2) is already taken by q01, so Carlisle (score 1) is dealt. The link to "Q08" cannot be re-checked here: ch13 q08 has no case dealt at all.
- **W11 (the C1-C8 conflict table): PARTIAL.** C1, C2, C3 and C6 hold on the cited lines. C3 checks out at `sG:3312-3320`: a blocker whose message names no terms, with `FACT_ALIGNMENT_MIN_OVERLAP`=2. The others are overstated:
  - C4: "open from this chapter's core move" (`sT:166`) and "every correct answer names this chapter's requiredFactIds mechanism" (`sT:185`, per slot, not one mechanism) do not tell the writer to present one mechanism as the single lesson, which is what the scar's line 59 forbids. It is a tension, not a contradiction.
  - C7: the scar note forbids *announcing* a limit with meta-phrases ("'worth noticing'") and says to "state it inside the story". That is compatible with `sT:113`'s mandatory limit, and `sT:114` allows a limit close in one chapter in three.
  - C5: a real tension, but `sT:213` already caps principle sentences at one per tier.

**Missed (writing-path lens):** the quiz and card case-cue linkage guard is defeated by its own variety cap. `dealCaseCue(..., {cap: MAX_CASE_CUES_PER_SURFACE=1, requireLink: true})` (`chapterBlueprint.ts:1449,1491`) compares only `scored[0].score` against `CASE_LINKAGE_MIN_SCORE`=2 (`:1186-1187`, `sourcePacketFacts.ts:222`). When that best-linked case was already used on the surface, the head (`top - 1`) or the spillover hands the slot a case scoring 1, below the floor that `requireLink` is meant to enforce. In ch13 that is building-sect-balance → carlisle (1) and postmaster-profit-pay → hospital (3, after academy at 4 was taken). The investigator's C2 fix, "pair quiz cases to their own episode", is a precise one-line fix here: apply the linkage floor to the chosen candidate, not the top one, and deal no case otherwise.
