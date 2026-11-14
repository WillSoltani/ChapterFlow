# Judge calibration against the owner's labels (W1c Phase 2)

Labels: 17 owner judgments from `reading/W1/NOTES.md`, all ch01: X = rr21 (7, all fail), Y = W1 prototype (6: 4 fail, 2 pass: examples, practice), Z = Q08 (4, all fail). `labels.json` maps each to an eval item.
Calibration set: X + Z (11). Held out: Y (6), scored only after the judge prompt was fixed. The ch13 versions have no owner labels and are a baseline only.

| Run | Judge prompt | X+Z (calibration) | Y (held out) |
|---|---|---|---|
| calib-v1 | `judge-v1.md` (untuned) | 11/11 | 6/6 |
| calib-v1-rep2 (identical repeat) | `judge-v1.md` | 10/11 (X TRY flipped to pass: "concrete … though it opens with a retelling") | 6/6 |
| calib-v2 | `judge.md` (TRY tightened: an action with a retelling or moral attached fails) | 11/11, X re-run 7/7 | **6/6** |

- The only tuning change came from a calibration-set disagreement (X TRY), and Y has no TRY label, so the held-out check is clean.
- Discrimination: the judge passes Y's examples (3/3) and practice, as the owner did, and fails Y's quiz (1/7) and cards (1/5). It is not a fail-everything judge. On ch13 it generalizes: the prototype's quiz is 1/7 and its cards 0/5, the same story-recall failure.
- Stability: between identical runs 7 of 125 item verdicts flipped (≈5%), mostly borderline EXFIT items in Z.
- Robustness: one v2 run on Z returned a degenerate 5-item JSON (a `"OPENER-wait"` placeholder). The runner now checks that every expected item id is present and retries once.
- No-chapter solver (Sonnet 5, q1–q5 only, no chapter): **5/5 on X, Y, Z and rr21-ch13; 4/5 on proto-ch13 and q08-ch13.** Every old quiz is guessable without reading, which confirms the quiz problem from a second direction.
- Readability (Flesch–Kincaid): X/Z summaries already sit at grade 5–8, yet the owner called their words hard. FK misses archaic vocabulary ("tallow-chandler", "freehold", "tithe son" — the judge's PLAIN evidence), so plainness is a judge item and FK is a reported band (summary 5.0–8.5; rest ≤ 8.5).
- Cost of Phase 2: see `scratch/W1c/ledger.tsv` (eval:* rows).

## Recalibration against strict LLM readers (2026-11-13)

Why: strict LLM readers (Opus subagents with web search, told to be demanding) rated chapters of six published v26 books at 6 to 8 of 10, while the old judge gave the same chapters 81 to 100. About half of the readers' findings were about the quiz: wrong choices that can still be argued for, right choices that give themselves away, and questions that all test one move. The old judge had no item for any of these, so items were added and three were made stricter, then checked against the readers.

**Set and split.** 18 chapters of six published v26 books, each read by an independent strict LLM reader (score 6 to 8 of 10, mean 6.89). Calibration set: 12 chapters (what-every-body-is-saying 1, 3, 6; essentialism 1, 12, 18; crucial-conversations 1, 5, 8; deep-work 1, 3, 7). Held out: 6 chapters (the-charisma-myth 1, 5, 9; the-laws-of-human-nature 1, 12, 15), judged once, after the wording was frozen. Two tuning rounds on the calibration set (r1, r2), then the held-out run. Between r1 and r2 only ARC-<tier> and VARY-examples changed wording.

**Labels.** `reader-labels-2026-11-13.json` in this folder. Reader findings mapped to judge items: 151 findings, 111 mapped to at least one item (132 item-level labels), 40 with no judge item (20 of them "the short read shrinks the book's chapter to one tip": a product decision, not a judge item; 6 stock phrasing, 6 repetition inside a chapter, 4 across chapters, 4 other).

**Scores, old judge and new judge.**

| | old judge (42 items) | new judge (58 items) |
|---|---|---|
| mean score, all 18 chapters | 93.5 | 82.6 |
| calibration 12 | 92.9 | 82.0 |
| held out 6 | 94.8 | 83.6 |
| chapters readers gave 6 (5) | 91.0 | 78.3 |
| chapters readers gave 7 (10) | 93.8 | 83.6 |
| chapters readers gave 8 (3) | 96.8 | 86.2 |
| correlation with the reader score (18 chapters) | +0.32 | +0.47 |
| range of chapter scores | 81.0 to 100 | 69.0 to 93.1 |

The correlation is weak evidence: 18 chapters, readers in a 6 to 8 band. The gain comes from the calibration set (+0.28 to +0.42). On the six held-out chapters the old and the new judge are about the same (+0.59 and +0.62). What the held-out chapters do show is the level (94.8 down to 83.6) and the same order by reader score.

**New items against the reader labels** (r2 wording; "agreement" = share of items the reader raised nothing about that the judge passed).

| item | recall, calibration | recall, held out | recall, all 18 | agreement, all 18 | fails, all 18 |
|---|---|---|---|---|---|
| KEY-<q> | 18/25 | 5/11 | 23/36 (64%) | 65/90 (72%) | 48/126 |
| TELL-<q> | 13/21 | 9/11 | 22/32 (69%) | 57/94 (61%) | 59/126 |
| VARY-quiz | 4/5 | 3/4 | 7/9 | 4/9 | 12/18 |
| VARY-examples | 4/6 | 2/4 | 6/10 | 5/8 | 9/18 |
| ARC-fastRead (tightened) | 3/5 | 1/1 | 4/6 | 11/12 | 5/18 |
| PLAIN-summary (tightened) | 3/3 | 1/3 | 4/6 | 9/12 | 7/18 |
| TRY (tightened) | 1/2 | 1/1 | 2/3 | 13/15 | 4/18 |

The calibration columns are in-sample: the wording was tuned on those chapters. Out of sample, KEY recall is 5 of 11, under half, and TELL holds at 9 of 11. Over every labelled item of every kind, old items included, the judge failed 72 of 130 (55%).

**Judge-only KEY fails and held-out KEY misses.** The 25 judge-only KEY fails (questions the reader had not raised) are the same kinds of fault the readers name elsewhere: a "what most likely happens" question whose facts do not force the keyed outcome, or a wrong choice the chapter gives no reason against. The readers listed about four quiz problems a chapter and were not exhaustive. The held-out KEY misses are 6. One is a dispute with the book itself (the-charisma-myth ch09 q3, since rewritten), which a judge that sees only the chapter cannot catch. The other five are faults the KEY wording covers and the judge still passed, siding with the key: the-charisma-myth ch09 q1 (the wrong choice repeats the chapter's own advice) and ch01 q2, the-laws-of-human-nature ch12 q4 and ch01 q2 and q6.

**Noise.** r1 and r2 judged the same 12 chapters. On items whose wording did not change: KEY flipped 6 of 84 (7%), TELL 13 of 84 (15%), END 8 of 36 (22%), TEMPT 3 of 84, QUIZ 1 of 84, VARY-quiz 0 of 12, CARD 0 of 60; all of them together 39 of 648 (6.0%). END, an old item, flips more than any new one. With ARC and VARY-examples, whose wording changed between the rounds, 52 of 696 (7.5%). A chapter's score moved 2.6 points on average between the two runs, 8.6 at most (deep-work ch03, 77.6 then 69.0; 7.4 without the two changed items). The four books' three-chapter means moved 1.1, 1.7, 1.1 and 4.0. A book's mean over ten chapters should move about one point: an estimate from the chapter moves, not a measurement.

**What it means for the gate.** The thresholds are unchanged: auto 80, manual 70.
- A chapter of today's published quality scores about 83 (was about 94). As averages: readers' 6 of 10 is about 78, 7 is about 84, 8 is about 86. The spread is wide and the groups overlap (6: 69.0 to 84.5; 7: 75.9 to 89.7; 8: 77.6 to 93.1), so one chapter's score does not tell its reader score.
- Kinds weak in at least half of a chapter's items, over the 18 chapters: VARY-quiz 12, VARY-examples 9, PLAIN-summary 7, TELL 7, ARC-fullRead 6, ARC-fastRead 5, ARC-deepRead 5, KEY 5. By book (weak in at least two of its three sampled chapters): VARY-quiz in 4 of 6 books, VARY-examples, TELL and PLAIN-summary in 3 of 6 each. So the repeat rule will hold most books written with today's writer in the manual band on VARY-quiz (often on VARY-examples, TELL or PLAIN-summary too), by name, until the writer is taught the same rules. The writer prompts were not changed in this revision.
- The quiz is now 29 of a chapter's 58 items (QUIZ, TEMPT, KEY, TELL per question, plus VARY-quiz). About half of the readers' findings were about the quiz.
- A saved eval from the old judge is asked again (JUDGE_VERSION 2), so `score` on a book published before this change re-judges every chapter (about $0.27 each) and its band can change. `score.json` names its judge too, and the publish gate refuses a score from an older judge. The ten published books' stored scores (94 to 99) are old-judge scores.

**Limits.** Recall on answer-key faults is about two thirds in-sample and under half on the held-out chapters. An id the judge answers twice is counted once (it happened once in 30 runs). TELL is the noisiest new item. LLM readers sit in a 6 to 8 band, so the correlation is over a narrow range. The no-chapter solver is unchanged.

**Cost.** 30 chapter evals (12 + 12 + 6), $8.06 on the scratch ledgers, about $0.27 a chapter (one judge call and three solver runs). The judge prompt is longer now, so `score` costs about $0.27 a chapter where it was about $0.17.

## The writer taught the same rules (2026-11-13)

This changed the same day. The section above says the writer prompts were not changed, and that was true of that revision. Later on 2026-11-13 the writer was taught the rules the recalibrated judge checks, and six published chapters were written again to test it.

**What changed in the writer.**
- `prompts/write-exemplar.md`: the Quiz rule is now a lead line and six short grouped lines (what each question asks; one sound answer; wrong choices; wording; the explanation; questions 1 to 5). New in it: no forecast questions; one deciding detail in the stem, and the right choice and the explanation use only facts the stem gives; a belief question gives three reasons the person gave themselves; wrong choices are about the same thing the right choice is about; the lesson's own words are in all three choices or in none.
- The Examples rule asks for three different `whatToDo` instructions: the move itself; how to put things right after the usual fix; what else a harder case needs. Each `whyItMatters` gives a reason the summaries already give.
- `tryThisNow` is the lesson's move itself and needs nothing a reader may lack. The one sentence about the author's harsher advice sits where the summary turns to what the reader does. A real case is told so a reader could retell it, or left out.
- `src/book.ts`: seven quiz forms for seven questions (`QUIZ_FORMS`): what do you do, in an ordinary case; spot the trap: which of the person's own thoughts led them wrong; best reply to a friend who is about to make the usual mistake; why does this work; what do you do when something makes the move harder; best reply to a friend who made part of the move and thinks that is enough; why did the usual fix fail. "predict what happens" is gone. One try-this kind and the evidence note were reworded. In `src/approaches.ts` the quiz approach C of `variants` is now "explain what happened" instead of "predict what happens".
- The house exemplar (`house/ch01/final.json`): three different example instructions, no forecast question, right choices not in the slogan's words, a loose aside cut. The recalibrated judge gave it 53 of 58 before. In six later runs, with edits between them, it gave 54, 55, 56, 54, 57 and, on the committed text, 55 of 58: one run each, and about two items of that spread are the judge's own noise.
- `prompts/keys-knowledge.md` asks for one concrete detail of the chapter's story. `prompts/variants-plain.md` has one new line (every sentence follows from the one before; common names for things). The fix prompts and the KEY fix hint in `src/auto.ts` no longer push toward a forecast or the key phrase in a choice.

**The proof.** Six published chapters (what-every-body-is-saying 1 and 6, essentialism 1 and 18, crucial-conversations 1, deep-work 3) were written again from the same lesson cards with the `book` verb (one write, checks, one fix round) in scratch run dirs, then judged with the recalibrated judge. "Old" is the published chapter under the same judge (round r2 above). There were three rounds. Round 1 and round 2 each led to changes to the rules (after round 2 to the exemplar too). Round 3 is the last round that was proved. After it a consistency check made small wording fixes that were not proved again: the sentence "at most three right choices tell the reader to make the lesson's move" went, because the seven forms cannot meet it, and the second reply now "names the part still missing"; the kinds of wrong choice are scoped to questions about what to do or say; the sentence on the author's harsher advice is one sentence; the evidence note names the book's text or the author's advice; in the exemplar the ending of q6 and one wrong choice of q7 changed; and the fix hints no longer invite a fact that makes a wrong choice impossible.

**Judge.** Mean score of the six chapters and failed items by kind (KEY, TELL, TEMPT of 42 questions; VARY of 6 chapters; ARC and END of 18; OPENER of 24; TRY and PLAIN-summary of 6).

| | mean | KEY | TELL | TEMPT | VARY-quiz | VARY-examples | ARC | END | OPENER | TRY | PLAIN-summary |
|---|---|---|---|---|---|---|---|---|---|---|---|
| old writer (published) | 79.3 | 22 | 16 | 1 | 6 | 5 | 6 | 6 | 3 | 1 | 3 |
| new writer, round 1 | 82.2 | 2 | 21 | 11 | 4 | 1 | 10 | 3 | 0 | 4 | 2 |
| new writer, round 2 | 84.8 | 6 | 19 | 14 | 3 | 1 | 4 | 0 | 0 | 1 | 3 |
| new writer, round 3 (last proved) | 82.5 | 6 | 24 | 9 | 4 | 1 | 6 | 3 | 0 | 1 | 4 |

Other kinds, old writer then rounds 1 to 3: SPINE 2, 3, 1, 2; PRACTICE 1, 0, 0, 0; CARD 0, 0, 0, 1; PLAIN-rest 0, 1, 1, 0. ARC, END and OPENER are summed over the three summary lengths here; the repeat rule counts each length as its own kind.

**Round 3 by chapter.**

| chapter | old | new |
|---|---|---|
| what-every-body-is-saying ch01 | 84.5 | 82.8 |
| what-every-body-is-saying ch06 | 84.5 | 81.0 |
| essentialism ch01 | 82.8 | 89.7 |
| essentialism ch18 | 75.9 | 81.0 |
| crucial-conversations ch01 | 79.3 | 79.3 |
| deep-work ch03 | 69.0 | 81.0 |

**Blind readers** (round 3 chapters). Three strict LLM readers each read the six pairs: the published version and the new version, labelled A and B at random per reader, in a plain-text rendering of the default path. The labels were hidden. The versions still differ visibly in their question forms: forecast questions are only in the published ones, the three-reasons question only in the new ones.
- Verdicts: the new version in 14 of 18 (11 clear, 3 slight); the published version in 4 (all slight). Four chapters went to the new version 3 to 0. Two went to the published version 2 to 1: what-every-body-is-saying ch06 and deep-work ch03.
- Mean scores of 10, published then new: overall 6.28, 6.75; examples 6.11, 7.06; quiz 5.50, 6.33; summary 6.67, 6.78; first screen 6.83, 6.83; practice 6.94, 7.00.
- Quiz faults the readers counted over 18 readings of 7 questions (126 a side), published then new: a second answer can be argued 45, 13; the right answer gives itself away 48, 54; both wrong choices can be struck out unread 13, 24.
- All three examples come down to one instruction: 13 of 18 readings, then 5 of 18.

**What the proof shows and what it does not.**
- Holds in every round: far fewer arguable answers (the judge's KEY fails 22 of 42, then 2 to 6; the readers' own count 45 of 126, then 13; one reader called being marked wrong for a sound answer the worst quiz fault), examples that teach three things, no forecast questions.
- Got worse: questions whose wrong choices can be struck out on sight rose clearly (TEMPT 1 of 42, then 9 to 14; the readers' count 13 of 126, then 24). Right choices that can be spotted by their wording rose a little (TELL 16, then 19 to 24, where that item's run-to-run noise is about 6 of 42; the readers' count 48, then 54). A deciding detail that makes a question fair also tends to hand it over. All three readers listed the form "which of her three reasons was the trap" among recurring faults: it is only in the new versions, and two of its reasons are plainly sensible. In the judge's round 3 its six questions carry 3 of the 9 TEMPT fails and 4 of the 24 TELL fails, so TELL is spread across the forms. The form was left as it is.
- VARY-quiz still fails in 4 of 6 chapters, PLAIN-summary in 4 of 6 (old writer 3), and TELL is weak (4 or more of 7 questions) in 3 of 6, so the repeat rule will still hold most books in the manual band, by name. The judge's round of an `auto` run has fix hints for KEY, TELL and TEMPT items; this proof used the `book` verb and did not test that round.
- Limits: six chapters, one judge run each (a chapter moves 2.6 points between identical runs). The published chapters were written under the plan of the chapter number alone and went through a whole `auto` run; the proof chapters were written under the per-book plan with one fix round only (4 of the 6 round 3 chapters still had an open fact or key flag, which a full run would take further). The readers are LLM readers. Judge and readers disagree on deep-work ch03: the judge gives the new version 12 points more (69.0, then 81.0), and two of the three readers preferred the published one. Two more forms were tried in the proofs and dropped: a second "spot the trap" (round 1) and a look-alike case that does not call for the move (round 2).

**Cost.** $30.27 for the three proof rounds (18 chapter writes with checks and judging: $10.62, $9.67, $9.98) and $2.10 for seven judge runs on the exemplar.

**Files.** Everything is kept at `~/cf-wt/v26-plan/eval/writer-rules-2026-11-13`: `spec.md`, `results.md`, `run*/`, `out/`, `blind-new3/`, `blind-key-new3.json`, `blind-result-new3.json`, `compare.py`, `run-proof.sh`, `make-blind.py`.
