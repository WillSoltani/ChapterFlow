# verify accuracy-content

## corrections
- Replace '3/36 quiz keys contradict the source' with: '2 of 36 quiz keys contradict the source outright (ch07 q05, ch07 q09). A third (ch19 q01) keys the only sensible choice, but its explanation misdates Fort George's fall. Other items carry source errors outside the key: the ch19 q04 stem, the ch13 q08 explanation, and ch01 q06, whose key choice restates the Uncle Thomas misattribution.'
- Replace '36 contradicted (19 major)' with: '36 contradicted (19 major on the investigator's severity scale). An independent re-check of 16 of those majors confirmed 14 as source contradictions, found 1 (the ch13 trustee vacancy) to be a real misstatement of arguable severity, and found 1 (ch19 "refusing the decanter of Madeira") to be unsupported rather than contradicted.'
- Replace '8/28 cards wrong' with: '8 of 28 cards carry a wrong, unsupported or anachronistic claim. At least 3 are contradicted outright by the source (ch07 rc03 and rc04, ch01 rc02), a fourth arguably is (ch07 rc07), and the rest are unsupported causes or modern framings.'
- Replace '~90k words (> the 66k-word source)' with: 'about 90-99k words across every reader surface (98,684 counting all quiz choices; about 90.8k without the wrong choices and memorable-line notes), against 66,236 source words (about 62.5k without footnotes and captions). A single-tier reader gets much less: the three summary tiers total 20,601 words and the full-read tier is 11,826 words, about 18% of the source.'
- Replace 'templated examples (35% of words)' with: 'modern examples make up 31,218 words (32-35% of reader words, depending on the denominator); that they are templated is a reviewer judgment, not a measured share.'
- Replace 'in the 19-chapter map ch01-ch04 get wrong pins and ch05-ch19 get none' with: 'the bookScars scoper (bookScars.ts:106-125) matches (chNN) labels by chapter number, so the current run's compile (09-19 03:44-04:58Z) rendered the 4-part pins into the wrong chapters: the virtue pins into "Beginning Life as a Printer", the civic pins into "Arrival in Philadelphia", and the London and proprietors pins into "First Visit to Boston". ch05-ch19, including "Plan for Attaining Moral Perfection" and "Agent of Pennsylvania in London", received no chapter-scoped pins, only the 10 book-wide rules.'
- Replace 'all Phase A distortions fixed' with: 'all Phase A distortions resolved: 6 fixed and 2 no longer present, but the Penn and Spring Garden meeting is now simply omitted, and ch09 has a new first-person splice ("from a smith, my neighbour") on 3 surfaces.'
- Add to the 'review loop cannot see this' clause: 'the panel did flag Baird (ch07) and Clifton (ch13) as possible_attribution_issue WARNs, but those escalations cannot gate by design (aggregateChapterReview.ts:44-48).'
- Mark 'Independent reading score ~61-68 per chapter vs panel 74-78' as the investigator's subjective scoring, not independently re-verified.

## confirmations
- ch01 'Josiah Franklin broke that pattern' / 'break from four generations of smiths' is a CONFIRMED error: the custom covered eldest sons (SRC 87-89), Josiah trained as a dyer (95-96) and became a chandler because dyeing failed (259-262).
- ch01 Uncle Thomas resemblance is CONFIRMED misattributed: the chapter credits 'People who had known the uncle … small habits of manner', but in SRC 118-122 it was the son who noticed the similarity of life and character.
- ch07 counterintuition 'That patience is exactly what would have cost Franklin two ready friends' is a CONFIRMED inversion: Franklin waited and kept both friends (SRC 2465-2472).
- ch07 q09 (correctIndex 2) and rc03 CONFIRMED wrong: 'The proposal was agreeable, and I consented; his father was in town and approv'd of it' (SRC 2124-2125).
- ch07 q05 (correctIndex 1, 'Steady work from Burlington … reason enough to arrange a new backer') CONFIRMED wrong: it contradicts SRC 2465-2472, and the 'new saddle as his only settlement' explanation is contradicted by SRC 2479-2486.
- ch07 'gave Franklin a second publication' CONFIRMED error: Keimer's paper was his first ('as I could not yet begin our paper', SRC 2394-2395; 'took it in hand directly', 2401-2402).
- ch07 'A member of that club [Junto], Baird' CONFIRMED error: Baird spoke at 'the merchants' Every-night club' (SRC 2357-2363).
- ch07 'taking half from each so no single man carried the full risk' CONFIRMED invented motive: the source reason is 'because I would not give an unkind preference to either' (SRC 2495-2496).
- ch07 Burlington 'apart from the shop Franklin had already quit' and rc04 'ended … forecloses any quiet fix' CONFIRMED errors: 'so I return'd, and we went on more smoothly' (SRC 2136-2140).
- ch13 Clifton lamp inversion CONFIRMED on 3 fullRead surfaces: the source gives Clifton the idea of lighting the city and Franklin the lamp form (SRC 4847-4853).
- ch19 q04 stem 'right as the … sixty-thousand-pound grant … sat refused' CONFIRMED wrong: the dinner came first and disputes came 'afterwards' (SRC 6176-6178, 6202-6207); the chapter's own fullRead says 'came later'.
- ch19 q01 explanation 'ran through the exact stretch when Fort George fell' CONFIRMED false: the fort fell 'During his absence' at Halifax, after Franklin's ship had parted (SRC 6302-6311, 6342-6344).
- ch19 'The proprietors finally answered only to say the paper lacked proper titles' CONFIRMED error: a long message with a 'flimsy justification' and a 'some person of candour' offer, while the titles were Franklin's guess (SRC 6613-6628).
- Walls of text CONFIRMED: walls.js printed zero-newline counts { fastRead: 19, deepRead: 11, fullRead: 8 }; full reads ch02/04/06/07/09/10/12/19 run 486-774 words (max ch10), deep reads reach 388 words; the adapter splits paragraphs on /\n\n+/ (~/ChapterFlow/app/app/api/book/_lib/v21-adapter.ts:57).
- Scar scoping CONFIRMED: #538 (f763541d1) added 42 rules, 32 of them chapter-scoped; the real bookRuleChapters gives ch1:6 ch2:8 ch3:12 ch4:6 and ch5-ch19:0; the compile transcripts of 09-19 03:44-04:58Z show the ch02 virtue pins in the 'Beginning Life as a Printer' prompt and none in 'Plan for Attaining Moral Perfection'.
- Memorable-line splitter CONFIRMED: memorableLines.ts:335-341 splits on /(?<=[.!?])\s+/; reproduced as ['…sent Mr.', 'Canton to test the pointed rod himself, and Canton found it worked.']; ch18 memorableLines[2] is that fragment; 57 of 57 memorable lines are verbatim breakdown sentences.
- The panel has no source lane and fresh-qc is gated on PASS, CONFIRMED: semanticPanelReviewEvaluator.ts:61-67, aggregateChapterReview.ts:44-48, bookRunApplicationService.ts:3308; SF1-SF4 codes appear in 0 of 68 review files.
- Reader word total of about 90k CONFIRMED within method: 98,684 words across all reader strings, about 90.8k without the wrong quiz choices and memorable-line notes; source 66,236 raw words.

## report

## H6 adversarial verification: content quality of candidate review-repair-21-candidate-06d7596afd1f14dccd3eb2df99b22db6

I only read files. I made no model calls and did not modify any checkout. My scripts are in `.../scratchpad/assess/verify/`: find.js, walls.js, words.js, scope.mts, pins.py.
- C = `~/cf-canary/books/the-autobiography-of-benjamin-franklin/candidates/review-repair-21-candidate-06d7596afd1f14dccd3eb2df99b22db6/content/content/chapters/`
- SRC = `~/cf-canary/sources/the-autobiography-of-benjamin-franklin.txt` (6693 lines; line numbers are the same as in the frozen source-text.txt)
- P = `~/ChapterFlow-books-v25-completion/scripts/book/prompts/chapterflow-v24-author-pipeline` (HEAD 9f0117cb7)

### 1. Major source errors
I re-checked 16 of the investigator's 19 "major" errors. For each one I read the chapter JSON field and the cited source lines.

| # | Claimed error | Chapter text (field) | Source | Verdict |
|---|---|---|---|---|
| 1 | ch01: Josiah "broke that pattern" | counterintuition: "Josiah Franklin's own break from four generations of smiths"; fastRead: "bred the oldest son to the smith's trade … Josiah Franklin broke that pattern"; q02 explanation: "he broke from the smith's trade" | SRC 87-89: the custom covered eldest sons only. SRC 95-96: Josiah was apprenticed to a dyer at Banbury. SRC 259-262: he became a chandler because "his dyeing trade would not maintain his family". SRC 92-93: the source says "five generations back", not four. | **CONFIRMED error** |
| 2 | ch01: Uncle Thomas resemblance misattributed | fullRead: "People who had known the uncle later remarked how closely the nephew came to resemble him, right down to small habits of manner"; also q06 choice[1] and explanation | SRC 118-122: the old people at Ecton gave an account of Thomas's life and character, and it "struck **you** [the son] … from its similarity to what you knew of mine". "Habits of manner" is invented. | **CONFIRMED error** (severity closer to moderate) |
| 3 | ch07: counterintuition inverts Franklin's patience | "That patience is exactly what would have cost Franklin two ready friends" | SRC 2465-2472: "I could not propose a separation while any prospect remain'd … Thus the matter rested for some time". Franklin waited and still kept both friends. | **CONFIRMED error** |
| 4 | ch07: q09 and rc03 invert the sequence | q09 key (correctIndex 2): "Confirm the father's willingness … before"; rc03: the father's backing "needed confirming before Franklin accepted" | SRC 2124-2125: "The proposal was agreeable, and I consented; his father was in town and approv'd of it". Franklin consented before the father approved. | **CONFIRMED error** |
| 5 | ch07: "a second publication" | fullRead: "taking over Keimer's weak paper gave Franklin a second publication". There is no earlier Franklin publication in the fullRead (1 occurrence of "publication"). | SRC 2394-2395: "as I could not yet begin our paper". SRC 2401-2402: "took it in hand directly". This was his first paper. | **CONFIRMED error** (moderate) |
| 6 | ch07: Baird's club | fullRead: "A member of that club [the Junto], Baird" | SRC 2357-2363: the remark was made at "the merchants' Every-night club", where Baird said "when I go home from club". | **CONFIRMED error** |
| 7 | ch07: why he took half from each friend | deepRead: "taking half from each so no single man carried the full risk"; plan coreSkill and ifThen: "afford to lose" | SRC 2495-2496: "because I would not give an unkind preference to either" | **CONFIRMED error** (invented motive) |
| 8 | ch07: the Burlington job | fullRead: "That ended his regular employment under Keimer … one contracted job apart from the shop Franklin had already quit" | SRC 2136-2140: Keimer's "very civil message … so I return'd, and we went on more smoothly" | **CONFIRMED error** |
| 9 | ch07 rc04: the quarrel was final | "ended Keimer and Franklin's working relationship, forecloses any quiet fix" | SRC 2136-2140 (same passage as row 8) | **CONFIRMED error** |
| 10 | ch13: Clifton lamp credit inverted | fullRead has 3 hits: "An improved street lamp he refined is credited to a man named John Clifton"; "let the idea stand under Clifton's name instead of his own"; "the lamp he let Clifton'…" | SRC 4847-4853: Clifton's single lamp gave the people "the idea of enlighting all the city", and that honour "belongs truly to that gentleman". Franklin claims "some merit … respecting the form of our lamps". | **CONFIRMED error** (the draft's wording is fine). The investigator's side note that "ex02 credits Franklin" is weak, because the fullRead also says Franklin worked the design out. |
| 11 | ch13: the trustee vacancy | fullRead: "When a seat opened and two sects both wanted it … someone suggested a man who belonged to no sect at all. That neutral choice is what let the deal go through"; also a memorable line and the q08 explanation | SRC 4580-4588: the others refused another Moravian, and the difficulty was "how to avoid having two of some other sect". Then "one mention'd me". SRC 4588-4599: Franklin negotiated the deal from his seat on both boards. | **CONFIRMED misstatement, severity debatable.** "Two sects both wanted it" is not in the source, and hiding that the nominee was Franklin is real. But "the neutral choice let the deal go through" is a defensible compression of the cause. |
| 12 | ch19 q04: Denny dinner placed too late | q04 stem: "right as the Assembly's sixty-thousand-pound grant … sat refused"; the explanation repeats it | SRC 6176-6178: disputes resumed "when he afterwards came to do business". SRC 6202-6207: the £60,000 refusal came later. The chapter's own fullRead says "What actually forced the ocean crossing came later". | **CONFIRMED error** |
| 13 | ch19: Fort George timing | q01 explanation: "Franklin's months waiting … ran through the exact stretch when Fort George fell"; q01 key: "that same stall let Fort George fall" | SRC 6302-6311: after 5 days at sea the ship "quitted the fleet"; "During his absence … had taken Fort George". SRC 6342-6344: "paraded idly at Halifax, by which means Fort George was lost". | **CONFIRMED** for the explanation. The keyed choice's causal clause is debatable. Note that the fastRead and deepRead state the timing correctly ("in his absence"). |
| 14 | ch19: the proprietors' answer | deepRead: "The proprietors finally answered only to say the paper lacked proper titles" (also ex06) | SRC 6613-6620: "a long message to the Assembly … complaining of its want of formality … a flimsy justification … some person of candour". SRC 6625-6628: the titles were Franklin's own guess ("probably"). | **CONFIRMED error** |
| 15 | ch19: the decanter | counterintuition: "refusing the decanter of Madeira, and the reward behind it" | SRC 6157-6159: the drinkers sent a decanter, "which the governor made liberal use of". The source never says whether Franklin drank. | **DEBATABLE.** The claim is unsupported and a misleading framing, but the source does not contradict it. "Denny drank it" does not show that Franklin did not refuse wine. Better classed as unsupported than as a major contradiction. |
| 16 | ch07 q05 (see section 2) | | | CONFIRMED |

**Tally for the 16 majors I checked:** 14 confirmed contradictions, 1 confirmed misstatement of debatable severity (ch13 trustee), and 1 unsupported rather than contradicted (ch19 decanter).
- The direction of the draft's "19 major" holds. The exact count and the severity labels are the investigator's own classification.
- The 182/120/36/24 ledger is UNVERIFIABLE without redoing the full audit. My sample supports its direction.

### 2. Quiz keys claimed wrong

| Item | JSON (correctIndex and key) | Source | Verdict |
|---|---|---|---|
| ch07 q05 | correctIndex 1: "Steady work from Burlington while the father's funding falls short is reason enough to arrange a new backer." The explanation says Meredith left with "a new saddle as his only settlement". | SRC 2465-2472: Franklin refused to push a separation while any prospect remained. SRC 2471-2486: Meredith himself said his father was unable. The settlement was thirty pounds and a new saddle, plus the company's debts, his personal debts and £100 returned to the father. Choice 2 ("wait until Meredith formally admits…") is what actually happened. | **CONFIRMED wrong** |
| ch07 q09 | correctIndex 2: "Confirm the father's willingness to fund the venture before treating skill as an equal share." | SRC 2115-2125: Franklin relied on Meredith's report that his father "was sure would advance money". Then "I consented; his father was in town and approv'd of it". | **CONFIRMED wrong** (inverted sequence) |
| ch19 q01 | correctIndex 1: "Treat repeated 'ready tomorrow' letters as the real warning: that same stall let Fort George fall, so set a firm deadline now." | SRC 6303-6311 and 6342-6344 | **PARTLY TRUE.** The explanation's timing claim is false. The keyed choice is still the only sensible option, and "that same stall" loosely blurs Loudoun's New York delay with the Halifax delay that Franklin actually blames. This is a false-fact explanation, not clearly a wrong key. |

Result: 2 keys are clean contradictions and 1 is a partial error. Other quiz items also carry source errors outside the key:
- ch19 q04: the stem and explanation misplace the dinner in time (row 12).
- ch13 q08: the explanation carries the trustee misstatement.
- ch01 q06: choice[1] and the explanation carry the Uncle Thomas misattribution.

### 3. Walls of text
`node walls.js` over all 19 chapter JSONs (breakdown keys: fastRead, deepRead, fullRead) printed:
- `zero-newline counts { fastRead: 19, deepRead: 11, fullRead: 8 }`
- `max words among zero-newline { deepRead: 388, fullRead: 774 }`

| Tier | Chapters with zero newlines | Word range |
|---|---|---|
| fullRead | 8: ch02, 04, 06, 07, 09, 10, 12, 19 | 486-774 (max is ch10) |
| deepRead | 11: those 8 plus ch11, 14, 15 | up to 388 |

The web adapter builds paragraphs with `prose.split(/\n\n+/)` (`~/ChapterFlow/app/app/api/book/_lib/v21-adapter.ts:57`), so each of these renders as one block. **CONFIRMED.**

### 4. Word counts
Method (`words.js`): I counted whitespace tokens in every reader string. Fields counted:
- title, hook, counterintuition, tryThisNow, keyTakeaway
- the 3 breakdown tiers
- example title, scenario, whatToDo and whyItMatters
- quiz prompt, all choices and explanation
- card front and back
- implementation plan
- memorable-line text and why

Excluded: `.authoring`, ids, anchors, tags and planSpec.

Results:
| Measure | Words |
|---|---|
| **All reader-visible text** | 98,684 |
| Without wrong quiz choices (6,980) and memorable-line "why" (875) | about 90,829 |
| Three summary tiers | 20,601 |
| fullRead tier alone | 11,826 |
| Examples | 31,218 (31.6% of 98,684; 34.8% of the investigator's 89,775 total, which I could not reproduce exactly) |
| Source, raw `wc -w` | 66,236 |
| Source without indented footnotes and illustration captions | about 62,475 |

**PARTLY TRUE.** "~90k > 66k" holds only as a count of the whole package. Someone reading the full-read tier gets 11.8k words, about 18% of the source.

### 5. Scar-pin misalignment
- **Config:** `P/config/book-scars/the-autobiography-of-benjamin-franklin.json` has 42 prohibitions. It was introduced by f763541d1, "WP-3A Franklin scars: 42 source-quoted rules (32 chapter-scoped fact pins) … (#538)".
- **Scoping logic:** `P/src/lib/bookScars.ts:106-125`. `bookRuleChapters` reads `(chNN)` from the rule's label. `bookRuleGovernsChapter` returns `chapters.includes(chapterNumber)`, so scoping is by chapter number only. SAFETY rules are never scoped (`:85`).
- **Running the real code** (`tsx scope.mts`) prints `ch1:6 ch2:8 ch3:12 ch4:6 ch5:0 … ch19:0`. It also prints 10 BOOK-WIDE rules: 3 SAFETY plus 7 general rules.
- **Topics versus the 19-chapter titles:**
  - The ch01 pins cover the Dutch dollar, the indenture, Bradford and Keimer, and the anonymous essays. That material now lives in ch02-ch03.
  - The ch02 pins cover the virtues, now ch09 "Plan for Attaining Moral Perfection".
  - The ch03 pins cover the civic projects, now ch08 and ch10-13.
  - The ch04 pins cover London, now ch19.
- **Evidence from the current run.**
  - The compile for book-run-39a37d06 was operatorAttempt=13. Events show it STARTED 2026-09-19T03:44:42Z and COMPLETED 04:58:35Z (`compilerRunId=compiler-operator-retry-13-run-06d7596a…`).
  - The writer prompts in `~/.claude/projects/-Users-radinsoltani-cf-canary-att-compiler-operator-retry-13/` for that window (`pins.py` output) show:
    - `03:51/03:54 "Beginning Life as a Printer" scopedPins ['ch02']`: the virtue pins.
    - `03:57 "Arrival in Philadelphia" ['ch03']`: the Union Fire Company pins.
    - `04:00 "First Visit to Boston" ['ch04']`: the pin "the proprietors DID meet Franklin".
    - `03:46/03:49 "Family History and Boyhood in Boston" ['ch01']`: the Dutch dollar pin.
    - `04:16 "Plan for Attaining Moral Perfection" []` and `04:53/04:56 "Agent of Pennsylvania in London" []`.
  - ch19 omitting Spring Garden (0 hits) matches the fact that pin 29 never reached it.
- **Verdict: CONFIRMED.** One precision: ch05-ch19 get no chapter-scoped pins, but they do get the 10 book-wide rules.

### 6. Memorable-line splitter
- `P/src/optimizers/memorableLines.ts:335-341`: `splitSentences` does `.split(/(?<=[.!?])\s+/)`.
- I reproduced it on the ch18 deepRead sentence. The output was `['The Royal Society that had mocked Franklin sent Mr.', 'Canton to test the pointed rod himself, and Canton found it worked.', …]`.
- ch18 memorableLines[2].text is "Canton to test the pointed rod himself, and Canton found it worked." with location breakdown.deepRead. The deepRead source text is "sent Mr. Canton to test the pointed rod himself…".
- All 57 of 57 memorable lines across the book are verbatim sentences from the breakdown tiers.
- **Verdict: CONFIRMED.**

### Other H6 sub-claims
- **"The review loop cannot see this": CONFIRMED.**
  - `semanticPanelReviewEvaluator.ts:61-67` says the evaluator is "fed only the reader-facing page".
  - `aggregateChapterReview.ts:44-48` says escalations "never change the gate".
  - `bookRunApplicationService.ts:3308` returns unless the review outcome is PASS, and fresh-qc comes after.
  - SF codes appear in 0 of 68 review files.
  - Nuance: review-35abdd05 did raise WARN `possible_attribution_issue` for Baird (issues[201], ch07) and Clifton (issues[380], ch13). The panel noticed both, but those WARNs cannot block.
- **"All Phase A distortions fixed": PARTLY TRUE.** The distortions are resolved, but item 1 was resolved by omitting the episode (0 hits for Spring Garden, Fothergill or "will not meet" in ch19). ch09 has a new first-person splice, "from a smith, my neighbour", on 3 surfaces: deepRead, q09 prompt and q09 explanation.
- **"8/28 cards wrong": PARTLY TRUE.** 8/28 is the investigator's count of cards with a wrong, unsupported or anachronistic claim. I spot-checked 8 of them:
  - **Contradicted by the source:** ch07 rc03, ch07 rc04, and ch01 rc02 ("generations removed from the smith's trade", though Josiah's own father's line practised it).
  - **Contradicted in its trigger (arguable):** ch07 rc07 says the drinking triggered the offers; the source says "In this distress", meaning the lawsuit.
  - **Unsupported or framing only:** ch01 rc06 (causal claim), ch19 rc02 ("cost … his Assembly seat"), ch19 rc03 (debatable), ch19 rc07 ("independent audit").
- **"Independent reading score ~61-68 vs panel 74-78": UNVERIFIABLE.** This is a subjective reader score, and re-scoring it would need model calls, which were not allowed.
- **"Templated examples (35% of words)": PARTLY TRUE.** Examples are 31,218 words, 32-35% of the total depending on the denominator. Whether they are templated is a judgment, not a measurement.