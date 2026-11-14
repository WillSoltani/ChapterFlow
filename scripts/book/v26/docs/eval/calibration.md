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
