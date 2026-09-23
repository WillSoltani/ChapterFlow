# source-accuracy

## keyFacts
- VERIFIED: Candidate audited = ~/cf-canary/books/the-autobiography-of-benjamin-franklin/candidates/review-repair-21-candidate-06d7596afd1f14dccd3eb2df99b22db6/content/content/chapters (19 files, mtime Sep 20 10:12). The reader-visible text is dumped to scratchpad/assess/chNN.txt.
- VERIFIED: The frozen source content/inputs/research/source-text.txt (sha256 8d71d7dc…) is ~/cf-canary/sources/the-autobiography-of-benjamin-franklin.txt with CR and '_' stripped. `tr -d '\r_' | shasum -a 256` gives 8d71d7dc6784b651…; both files have 6693 lines, so every line citation applies to either file.
- VERIFIED: Chapter-to-source mapping is correct. The spans in chapter-map.json start at the source's roman-numeral headings (II at line 396, VII 1953, XIII 4524, XIX 6132; ch19 ends at EOF), and all 18 headed chapter titles match the source headings verbatim (script printed MATCH x18).
- VERIFIED: ch01 has no heading in the frozen source (line 1 is 'Twyford'), so 'Family History and Boyhood in Boston' is a composed title. source-freeze-report.md also says VII, VIII, X, XV, XVII and XIX were composed, but those match the source's two-line headings, so that note is stale.
- VERIFIED: Totals for ch01/07/13/19: 182 distinct reader-visible factual claims checked; 120 correct, 36 contradicted by the source (19 major), 24 unsupported, 2 anachronistic. By chapter, correct = ch01 32/47, ch07 32/50, ch13 31/43, ch19 25/42.
- VERIFIED: Quiz keys over 36 items: 3 contradict the source (ch07 q05, ch07 q09, ch19 q01); 2 are unsupported (ch01 q09, ch07 q04); ch01 q06's key text states a misattribution. ch13 keys are 9/9 sound, but the q07 explanation contradicts source lines 4674-4677.
- VERIFIED: Cards: 8 of 28 carry a wrong, unsupported or anachronistic claim (ch01 rc02, rc06; ch07 rc03, rc04, rc07; ch19 rc02, rc03, rc07). ch13's cards are clean.
- VERIFIED: ch07's counterintuition ('That patience is exactly what would have cost Franklin two ready friends') inverts the source, where Franklin chose to wait (lines 2465-2472). The q05 key ('Steady work from Burlington ... is reason enough to arrange a new backer') contradicts the same passage, and its explanation 'new saddle as his only settlement' is wrong (2484-2486: thirty pounds, a saddle, the debts, and £100 to the father).
- VERIFIED: ch07 q09 and rc03 invert the sequence: they say the father's funding had to be confirmed before Franklin agreed, but the source says 'The proposal was agreeable, and I consented; his father was in town and approv'd of it' (2124-2125).
- VERIFIED: ch07 has three more major errors. It calls Keimer's paper 'a second publication' (it was Franklin's first; 2394-2395, 2401-2402). It calls Baird 'A member of that club [Junto]' (source: 'the merchants' Every-night club', 2357-2359). It says Franklin took half from each friend 'so no single man carried the full risk' (source: 'because I would not give an unkind preference to either', 2495-2496).
- VERIFIED: ch07 says the Burlington job was 'one contracted job apart from the shop Franklin had already quit', but Franklin returned to Keimer's employ ('so I return'd', 2139). rc04 says the quarrel 'ended' the relationship and 'forecloses any quiet fix', which the same passage (2136-2140) contradicts.
- VERIFIED: ch13 inverts credit for the lamp on 3 fullRead surfaces ('An improved street lamp he refined is credited to a man named John Clifton'). In the source Clifton gets credit for the idea of lighting the city and Franklin claims the lamp form (4847-4853). The chapter's own ex02 credits Franklin.
- VERIFIED: ch13 misstates the trustee vacancy ('two sects both wanted it', also a memorable line). It also hides that the no-sect nominee was Franklin himself ('one mention'd me', 4586-4588), and credits that choice with the deal, which the source attributes to Franklin's negotiation and the academy taking on the debts (4580-4599).
- VERIFIED: ch19 q04's stem and explanation place the Denny dinner 'right as' the £60,000 grant 'sat refused'. The source puts the dinner first and the disputes later (6176-6178, then 6198-6207), and the chapter's own fullRead says 'came later'.
- VERIFIED: ch19 q01's explanation ('Franklin's months waiting ... ran through the exact stretch when Fort George fell') and its key ('that same stall let Fort George fall') contradict the source: Fort George fell 'During his absence' at Halifax, after Franklin's ship had parted (6303-6311, 6342-6344).
- VERIFIED: ch19 says 'The proprietors finally answered only to say the paper lacked proper titles'. The source has a long message to the Assembly with a justification and an offer to treat with 'some person of candour'; the titles were Franklin's guess, 'probably' (6613-6628). The chapter's 'refusing the decanter of Madeira' is also wrong: Denny drank it (6157-6159).
- VERIFIED: ch01 says 'Josiah Franklin broke that pattern' and 'break from four generations of smiths'. The source says Josiah followed the eldest-son custom (87-89), trained as a dyer (95-96), and took up tallow-chandling because dyeing could not maintain his family (259-262).
- VERIFIED: ch01 attributes the Uncle Thomas resemblance to 'People who had known the uncle ... small habits of manner' (fullRead, ex06, q06). In the source it was Franklin's son who noticed the similarity of life and character, from old people's accounts (118-122).
- VERIFIED: Phase A items: 2 and 3 (ch19), 5 and 6 (ch13), 4 (ch11) and 7 (ch03) are fixed. Item 1 (Penn meeting): the false claim is gone but the Spring Garden meeting is omitted (0 hits). Item 8 (charter and religion): not present. Item 9: the raw seam is gone, but ch09 has a new splice, 'from a smith, my neighbour'.
- VERIFIED: The pipeline's review of this candidate, review-35abdd05c52c1642a511756a397ecd6e (ERROR, 7 BLOCKER, 439 WARN), has no blocker in ch01/07/13/19 and none about source facts. The only fact-related flags were possible_attribution_issue WARNs on Clifton (ch13) and Baird (ch07).
- VERIFIED: semanticPanelReviewEvaluator.ts:61-67 says the live review is 'fed only the reader-facing page' and has no source lane, and aggregateChapterReview.ts:44-45 says reader escalations 'never change the gate'.
- VERIFIED: The source-fidelity judge (SF1-SF4, sourceFidelityJudge.ts:66-75) runs in CandidateQcEvaluator (candidateQcEvaluator.ts:677-700) at fresh-qc, and bookRunApplicationService.ts:3308 exits unless the review is PASS before fresh-qc is reached at :3387.
- VERIFIED: There are 0 SF1-SF4 codes in all 68 files under ~/cf-canary/.../reviews, and the only qc-judge-run directories are dated Aug 21-28. No automated source-fidelity check has run on any candidate of book-run-39a37d06.
- VERIFIED: The book-score rubric (~/ChapterFlow/.claude/skills/book-score/RUBRIC.md:13-14, 46, 49) says one reader-visible defect (wrong quiz key, fabricated fact, invented witness) vetoes a chapter's score.
- INFERRED (from the rubric lines and the audited errors): all four audited chapters would fail the correctness gate, so source accuracy blocks shipping regardless of the panel's blocker count.
- INFERRED (from the fresh-qc gating plus the errors found): the repair loop is not working on these accuracy errors. They would first surface at fresh-qc after a panel PASS, which means at least one more repair cycle.
- VERIFIED: Coverage gaps: ch13 never mentions Franklin's civic offices (JP, alderman, burgess; 4635-4658) although the title names them; ch07 omits the Deism passage (2176-2239) and the merchant's lawsuit (2446-2454). Grep counts are 0 for each.
- VERIFIED: The protagonist is present in all four chapters, unlike rev-6 ch3: 'Franklin' appears 68, 68, 29 and 69 times in ch01, ch07, ch13 and ch19.

## openQuestions
- The other 15 chapters were not audited line by line. I only grepped them for Phase A items 4, 7, 8 and 9 (in ch03, ch09, ch11 and elsewhere). Given 3-10 major errors per audited chapter, the full count is unknown. Auditing each remaining chapter against its span in the same way would settle it.
- Would the source-fidelity judge (SF1-SF4) actually catch these 19 major errors? It has never run on a candidate in the current run. Running fresh-qc's judge on this candidate would settle it, but that costs model calls against the shared weekly cap, so it is the owner's decision.
- What is chapter I's printed title in the Gutenberg #20203 (Pine) edition? The frozen source starts at 'Twyford' with no heading, so the composed 'Family History and Boyhood in Boston' cannot be checked here. Reading the edition's contents page would settle it.
- Mansfield's role: this Gutenberg text says 'one of the counsel' (line 6659-6660). Whether he was the proprietors' counsel (as ch19 says) or a Privy Council member is outside this source. It needs an external reference or an owner ruling on which text is authoritative.
- Do the current run's scar or fact-pin files (plan items R-082 and R-284) cover any of the new errors, such as the Josiah smith framing, the Clifton lamp, Denny's timing, or Fort George? I did not read the book-scars config used by this run.
- My counts are my own classification: claims are deduplicated across surfaces, and 'unsupported' includes invented causal glosses. A second auditor re-classifying the ledger from the listed line cites would test how reliable the correct/wrong/unsupported split is.
- I did not check whether the reader panel's other advisories for these four chapters (origin_ambiguous_to_reader: 97 WARN book-wide) overlap the errors listed here.

## report

## Source fidelity audit: Franklin candidate `review-repair-21-candidate-06d7596afd1f14dccd3eb2df99b22db6` (ch01, ch07, ch13, ch19)

### 1. Bottom line

- **Chapter mapping is correct.** Each chapter covers the source span its title claims.
- **All of Phase A's rev-6 distortions are resolved.** Six are fixed and two are no longer present.
- **The same kinds of error have come back in new places.** Examples: an inverted sequence, a quiz key that rewards the false history, credit given to the wrong person, an invented motive.
- **Totals.** Across the four audited chapters I checked 182 distinct factual claims that a reader sees:
  - 120 correct
  - 36 contradicted by the source (19 of them major)
  - 24 not supported by the source
  - 2 modern framings stated as fact (anachronistic)
- **Quiz keys.** 3 of 36 contradict the source, 2 more are unsupported, and 1 more states a wrong fact in its key text.
- **Accuracy blocks shipping.** Under the book-score rubric Phase A used, every one of the four chapters fails the correctness gate. `~/ChapterFlow/.claude/skills/book-score/RUBRIC.md:13-14` says "one reader-visible defect (wrong quiz key, word-salad, fabricated fact, invented witness) vetoes the score"; `:46` covers quiz-key soundness and `:49` factual accuracy.
- **The current run cannot see these errors.**
  - The live review has no source lane.
  - The source-fidelity judge runs only at the fresh-qc stage, and fresh-qc runs only after a review PASS.
  - The judge has never run on any candidate in the current run.

### 2. Method and evidence base

- **Candidate.** `~/cf-canary/books/the-autobiography-of-benjamin-franklin/candidates/review-repair-21-candidate-06d7596afd1f14dccd3eb2df99b22db6/content/content/chapters/*.chapter.json` (19 files, mtime Sep 20 10:12).
- **What I dumped.** Every field a reader sees: title, hook, counterintuition, tryThisNow, keyTakeaway, the three reads, examples (title, scenario, whatToDo, whyItMatters), quiz (prompt, choices, key, explanation), cards, implementation plan and memorable lines. The dump script is `scratchpad/assess/dump.js` and the output is `scratchpad/assess/chNN.txt`, where scratchpad = `/private/tmp/claude-501/-Users-radinsoltani-ChapterFlow/c062400c-9b46-482f-921c-b35b71796a3e/scratchpad`.
- **Source.** The frozen source `content/inputs/research/source-text.txt` (sha256 `8d71d7dc…`) is the canary Gutenberg file with CR and `_` stripped:
  - `tr -d '\r_' < ~/cf-canary/sources/the-autobiography-of-benjamin-franklin.txt | shasum -a 256` prints `8d71d7dc6784b651bfe068dba20e0b6c511357efda3974bd05564193f0899e34`.
  - Both files have 6693 lines, so the line numbers are identical.
  - Every "src N" below is a line number in that file. My normalized copy is `scratchpad/assess/src.txt`.
- **How I counted.** A claim that repeats across several surfaces is counted once. "Correct" includes faithful paraphrase. The fictional modern scenarios in the examples are left out because they are invented by design, but historical claims inside their "whyItMatters" text are counted.

### 3. Chapter titles and chapter-to-source mapping

- **Spans match the headings.** In `inputs/research/chapter-map.json`, each span starts exactly at the source's roman-numeral heading: II at src 396, VII at 1953, XIII at 4524, XIX at 6132. Ch19 ends at EOF.
- **Titles match the headings.** A script compared each candidate title with the heading text after its numeral: 18 of 18 print MATCH. Ch07 "Beginning Business in Philadelphia" = src 1955-1956; ch13 "Public Services and Duties" = src 4526; ch19 "Agent of Pennsylvania in London" = src 6134-6135.
- **Ch01 has no heading in the frozen source**, which starts at "Twyford" (src 1). "Family History and Boyhood in Boston" is a composed title. `source-freeze-report.md` says the titles for I, VII, VIII, X, XV, XVII and XIX were "composed descriptively". For VII-XIX that note is stale: those titles match the source's two-line headings.
- **Coverage.** All four chapters stay inside their spans. They omit some material but do not reach outside the span. Notable omissions (grep counts are 0):
  - **Ch13:** never mentions Franklin's civic offices (JP, common council, alderman, burgess; src 4635-4658), even though the title "Public Services and Duties" names them.
  - **Ch07:** omits the Deism passage (src 2176-2239) and the merchant's lawsuit (src 2446-2454).
  - **Ch19:** omits the Spring Garden meeting with the Penns, Fothergill, and the near-wreck and lighthouse (src 6479-6494).

### 4. Per-chapter results

| Chapter | Claims checked | Correct | Wrong (major) | Unsupported | Anachronistic | Quiz keys clean | Card errors | Rating |
|---|---|---|---|---|---|---|---|---|
| ch01 | 47 | 32 (68%) | 4 (2) | 10 | 1 | 7/9 (q06 key text states a misattribution; q09 key unsupported) | 2/7 | Moderate; fails the gate |
| ch07 | 50 | 32 (64%) | 15 (10) | 3 | 0 | 6/9 (q05 and q09 wrong; q04 unsupported) | 3/7 | Poor; fails the gate |
| ch13 | 43 | 31 (72%) | 7 (3) | 5 | 0 | 9/9 (explanations for q07 and q08 are wrong) | 0/7 | Moderate-good; fails the gate on the Clifton inversion |
| ch19 | 42 | 25 (60%) | 10 (4) | 6 | 1 | 8/9 (q01 key has a false cause; q04 stem and explanation are wrong) | 3/7 | Moderate-poor; fails the gate |
| **Total** | **182** | **120 (66%)** | **36 (19)** | **24** | **2** | **30/36** | **8/28** | |

#### ch01 errors (chapter text, then source)

1. **Major, 5 surfaces: Josiah "broke" the smith custom.**
   - Chapter: counterintuition "Josiah Franklin's own break from four generations of smiths"; fastRead "Josiah Franklin broke that pattern and became a tallow-chandler"; q02 explanation "he broke from the smith's trade"; rc02 "generations removed from the smith's trade".
   - Source: the custom applied to eldest sons, "a custom which he and my father followed as to their eldest sons" (src 87-89). Josiah was apprenticed to his brother John, "a dyer at Banbury" (95-96). He became a tallow-chandler because "his dyeing trade would not maintain his family" (259-262). His eldest brother Thomas "was bred a smith under his father" (110). The source has no "four generations"; it says "youngest son of the youngest son for five generations back" (92-93).
2. **Major, 4 surfaces: Uncle Thomas resemblance misattributed.**
   - Chapter: fullRead "People who had known the uncle later remarked how closely the nephew came to resemble him, right down to small habits of manner"; ex06; q06 key "noted similar manners" and its explanation.
   - Source: the accounts from "some old people at Ecton ... struck you [the son] as something extraordinary, from its similarity to what you knew of mine" (118-122). The similarity was in life and character, and it was the son who noticed it.
3. **Early tutors.**
   - Chapter: "how much his early tutors praised him".
   - Source: "the opinion of all his friends [the father's friends]" (240-242).
4. **Minor: "Each boy answered to his own father."**
   - Source: "several of us were corrected by our fathers" (291-292).

Unsupported:
- **Folger's recognition by Mather.** The chapter says Folger earned his place in Mather's history through "accumulated standing, not the verse" (fullRead), and **q09's key rests on this**. The source only records the mention (197-201).
- **rc06's cause.** "The later move into the trade turned on ... the arithmetic." The source gives no such reason (257-262).
- **The wharf "held up fine"** (fastRead, ex05). The source only says the stones were found in the wharf (289-290).
- **"Within weeks."** The source says "pretty soon" (257).
- **ex03's pamphlet story.** It says the collection "only became worth handing down because someone finally sat with it". The source says a dealer brought the pamphlets to Franklin (156-157).
- **Anachronistic: ex06 "surviving today as eight volumes"** (the source's count is as of 1771, 152-156).

#### ch07 errors

1. **Major: the counterintuition inverts Franklin's conduct.**
   - Chapter: "Waiting for Meredith's father ... That patience is exactly what would have cost Franklin two ready friends".
   - Source: Franklin did wait: "I could not propose a separation while any prospect remain'd ... Thus the matter rested for some time" (2465-2472).
2. **Major: q05's key rewards the false history.**
   - Chapter key: "Steady work from Burlington while the father's funding falls short is reason enough to arrange a new backer." Distractor 2 ("wait until Meredith formally admits...") is closest to what happened. Explanation: "a new saddle as his only settlement".
   - Source: "give me thirty pounds and a new saddle", plus the company's debts and £100 repaid to the father (2484-2486).
3. **Major: q09 and rc03 invert the sequence.**
   - Chapter: the father's willingness had to be confirmed "before Franklin could agree".
   - Source: "The proposal was agreeable, and I consented; his father was in town and approv'd of it" (2124-2125).
4. **Major: why Franklin took half from each friend.**
   - Chapter: "so no single man carried the full risk" (deepRead, ex01, and the implementation plan's "afford to lose").
   - Source: "because I would not give an unkind preference to either" (2495-2496).
5. **Major: what triggered the friends' offers.**
   - Chapter (hook, deepRead, rc07): they came because word of Meredith's drinking reached them.
   - Source: "In this distress", meaning the merchant's lawsuit over the unpaid £100 (2446-2456). The lawsuit is never mentioned.
6. **Major: the Burlington job.**
   - Chapter: "one contracted job apart from the shop Franklin had already quit".
   - Source: Franklin went back into Keimer's employ, "so I return'd, and we went on more smoothly" (2136-2140).
7. **Major: "a second publication".**
   - Chapter: taking over Keimer's paper "gave Franklin a second publication".
   - Source: it was his first; "as I could not yet begin our paper" (2394-2395), "took it in hand directly" (2401-2402).
8. **Major: Baird's club.**
   - Chapter: "A member of that club [the Junto], Baird".
   - Source: Baird spoke at "the merchants' Every-night club" (2357-2359).
9. **Major: rc04 says the quarrel was final.**
   - Chapter: the public rebuke "ended Keimer and Franklin's working relationship ... forecloses any quiet fix".
   - Source: Keimer sent "a very civil message, that old friends should not part for a few words" (2136-2137).
10. **Major: when Meredith's drinking began.**
    - Chapter: "Long before Meredith's habits ever became a problem".
    - Source: he was "given to drink" from Franklin's first description of him (2015), and the father backed the partnership hoping Franklin would curb his dram-drinking (2125-2127).

Minor:
- **"Ended without warning."** Denny's illness "held him a long time" (1997-1998).
- **"Shouted down at Franklin from the street."** Keimer was in the street looking up (2094).
- **"One member had to write"** an essay. It was every member (2282-2285).
- **Meredith "accepted" the arrangement.** He proposed it (2118-2122).
- **"Instead of running the press."** "Meredith worked it off at press" (2347-2348).

Unsupported:
- **q04's key** says there was "no brush with death at all". The source is silent (1959-1965).
- **"Franklin just kept working instead of arguing back."** The source says Mickle "left me half melancholy" (2269-2271).
- **Webb "promised"** secrecy. The source says "I requested" (2391).

#### ch13 errors

1. **Major, 3 fullRead surfaces: credit for the improved lamp is inverted.**
   - Chapter: "An improved street lamp he refined is credited to a man named John Clifton"; "let the idea stand under Clifton's name instead of his own".
   - Source: Clifton gets the credit for the idea of lighting the city. Franklin claims "some merit ... respecting the form of our lamps" (4847-4853).
   - The chapter contradicts itself: ex02 correctly credits Franklin.
2. **Major: the trustee vacancy.**
   - Chapter: "When a seat opened and two sects both wanted it" (also a memorable line); "someone suggested a man who belonged to no sect at all. That neutral choice is what let the deal go through" (also the q08 explanation).
   - Source: the Moravian died, the others refused another Moravian, and the difficulty was "how to avoid having two of some other sect" (4580-4583). The man was Franklin himself: "one mention'd me" (4586-4588). The deal went through because Franklin, now on both boards, negotiated it, and the academy took on the building's debts (4588-4599).
3. **Major: q07's explanation.**
   - Chapter: "rum released too early, even during a lull, tipped a controlled room into a drunken fight".
   - Source: the rum was given only after the treaty "concluded to mutual satisfaction" (4674-4677).

Minor:
- **Why the Assembly backed the hospital bill.** Chapter: lawmakers backed it "because the province would pay nothing unless the public had already proven the hospital was worth it". Source: they expected the condition to fail and "conceiv'd they might have the credit of being charitable without the expense" (4738-4741, 4762-4764).
- **"Close to five thousand pounds."** The source says "no less ... than five thousand" (4541-4542).
- **Rum "arrived that evening."** It was "in the afternoon" (4677-4678).

Unsupported:
- **Hedging removed.** The chapter states the result of splitting the subscription as certain; Franklin wrote "I judg'd ... I believe it was so" (4540-4542).
- **The sweeper as a "paid trial".** Franklin calls it "An accidental occurrence" (4904).
- **Timing.** "Long before any of that" is unsupported.

#### ch19 errors

1. **Major: q04 misplaces the Denny dinner in time.**
   - Chapter stem: the dinner happened "right as the Assembly's sixty-thousand-pound grant ... sat refused". The explanation repeats this.
   - Source: the dinner came first. Disputes resumed only "when he afterwards came to do business with the Assembly" (6176-6178), and the £60,000 bill came later (6198-6207).
   - This contradicts the chapter's own fullRead ("What actually forced the ocean crossing came later").
2. **Major: when and why Fort George fell.**
   - Chapter: q01 key "that same stall let Fort George fall"; q01 explanation "Franklin's months waiting ... ran through the exact stretch when Fort George fell". The q08 explanation, rc03 and the weekly practice repeat it.
   - Source: Fort George fell "During his absence", after Franklin's packet had left the fleet (6303-6311). Loudoun "paraded idly at Halifax, by which means Fort George was lost" (6342-6344).
3. **Major: the proprietors' answer.**
   - Chapter: "The proprietors finally answered only to say the paper lacked proper titles" (also ex06).
   - Source: they sent a long message to the Assembly with "a flimsy justification" and an offer to treat with "some person of candour" (6613-6620). The missing titles were Franklin's guess ("probably", 6625-6628).
4. **Major: the decanter.**
   - Chapter (counterintuition): "refusing the decanter of Madeira".
   - Source: "the governor made liberal use of" it (6157-6159). Franklin refused the favours, not the wine.
5. **Moderate: "turned him down flat."**
   - Source: Franklin also promised to make Denny's administration "as easy as possible" and to support good measures (6165-6172).

Minor:
- "Kept Franklin back once the other guests returned to the table." Denny took him "aside into another room" (6143-6144).
- The paper was "witnessed by the Council's clerk". The clerk drew it up, and Franklin signed it with Mr. Charles (6667-6668).
- Loudoun "never sent a letter". The ship got "a letter with leave to part" (6302-6303).
- Franklin "landed" in London on 27 July. He landed at Falmouth and arrived in London that day (6496-6509).
- Paris "let it sit". It lay with the Attorney and Solicitor-General on his advice (6607-6609).

Unsupported:
- **Mansfield's role.** Chapter: Mansfield is "one of their own lawyers" and "counsel for those same proprietors". The source says only "one of the counsel" (6659-6660). The chapter's own implementation plan says Mansfield "didn't out-argue the proprietors' lawyers".
- **rc02:** accepting "cost Franklin his Assembly seat". The source says he "could not possibly accept" as a member (6162-6163).
- **"Months of drills."** The source says "some time" (6305-6306).
- **Granville as "the real hinge the tax fight turns on".** This is editorial.

Anachronistic: "an independent audit" (fullRead, rc07). The committee was appointed by the Assembly (6673-6676).

### 5. Phase A distortions (docs/v25/S_TIER_PHASE_A_REPORT_2026-09-02.md §2, items 1-9)

Rev 6 had 4 chapters; the new candidate has 19, so each item is checked in whichever chapter now covers its source text.

| # | Rev-6 distortion | Where it falls now | Status and evidence |
|---|---|---|---|
| 1 | Penn meeting inverted ("The brothers will not meet him"); q05 keyed it | ch19 | **The false claim is gone, but the episode is omitted.** 0 hits for "will not meet", "Spring Garden" or "Fothergill". deepRead says only "Franklin handed in a written complaint." No quiz covers it. |
| 2 | Royal assent deleted | ch19 | **Fixed.** "Those laws needed only the king's assent, not his command." rc05: "subject only to royal assent" (matches src 6548-6553). |
| 3 | Invented unresolved ending (Board of Trade never rules) | ch19 | **Fixed.** "Only then did the Council let the act pass." (src 6669-6670). 0 hits for "never rules" or "still open". Ch14's Board of Trade line is about the Albany plan and matches src 5063-5065. |
| 4 | Fire company had "no dues fund" | ch11 | **Fixed.** "Those fines, not member dues, bought new engines, ladders, and fire hooks" (src 4010-4012). 0 hits for "rotat". |
| 5 | Street paving "not by a city-wide tax" | ch13 | **Fixed.** "That visible cleanliness is what turned a citywide paving tax ... into something residents were willing to fund" (src 4836-4840). rc06 is also correct. |
| 6 | Hospital order inverted; q08 key "postal routes" | ch13 | **Fixed.** "it would pay two thousand pounds, but only if private donors first raised that same amount" (src 4743-4767). q09's key is sound. 0 hits for "postal route". |
| 7 | "Just one Dutch dollar", spent on the rolls | ch03 | **Fixed.** "a Dutch dollar and about a shilling in copper"; the shilling went to the boatmen; "three-penny worth" bought three puffy rolls (src 914-929). |
| 8 | "Pennsylvania's own charter says nothing about religion" | none | **Not present.** No chapter makes a charter or religion claim. |
| 9 | Prose seam "speckled Ax is best" (a seam, not a distortion) | ch09 | **Fixed** (0 hits). A new first-person splice appears in a ch09 quiz prompt: "accepted a speckled ax from a smith, my neighbour" (src 3241, verbatim). |

Rev 6's "no protagonist" defect is also gone: "Franklin" appears 68, 68, 29 and 69 times in ch01, ch07, ch13 and ch19.

### 6. Why the pipeline has not caught these

- **What the panel reported.** The review of this candidate is `review-35abdd05c52c1642a511756a397ecd6e` (outcome ERROR, 7 BLOCKER, 439 WARN).
  - None of its blockers is in ch01, ch07, ch13 or ch19, and none is about source fidelity. The blockers are internal contradictions in ch04, ch10 and ch15, structural problems in ch08 and ch12, and ch16 and ch17 seat failures from the 429 weekly limit.
  - The panel flagged only Clifton (ch13) and Baird (ch07, three seats) as `READER.ESCALATION.possible_attribution_issue` WARNs.
- **The panel cannot rule on these.**
  - By design, those escalation WARNs "never change the gate" (`src/review/aggregateChapterReview.ts:44-45`).
  - The live review has no source lane: "the live evaluator is fed only the reader-facing page, so it has no source/quiz lane inputs" (`src/app/semanticPanelReviewEvaluator.ts:61-67`).
- **Where the source-fidelity judge sits.** The judge (SF1-SF4, `src/critics/semantic/sourceFidelityJudge.ts:66-75`) runs inside `CandidateQcEvaluator` (`src/app/candidateQcEvaluator.ts:677-700`) at the `fresh-qc` stage. `bookRunApplicationService.ts:3308` returns early unless the review outcome is PASS, before fresh-qc is reached at `:3387`.
- **It has not run in this run.**
  - There are 0 SF1-SF4 codes across all 68 review files.
  - The only QC judge runs are `qc-judge-run-*`, dated Aug 21-28 (the rev-6 era).
  - The phases of `book-run-39a37d06…` are intake, research, seed, compile, review and repair; there is no fresh-qc.

### 7. Verdict and next tasks (assessment only)

- **Accuracy blocks shipping,** separately from the panel's blocker count. Every audited chapter has at least one gate-vetoing defect. There are 19 major errors in 4 of 19 chapters, and 15 chapters have not been audited line by line.
- **Real progress since rev 6.** All of Phase A's rev-6 errors are resolved, the titles and structure are right, and ch13's quiz keys are all sound. What persists is the same class of error Phase A found (inverted sequences, keys that reward false history, credit given to the wrong person, invented motives or causes).
- **The repair loop is not aimed at these errors.** It targets reader-panel blockers only. The first time these errors would be judged is fresh-qc, after a panel PASS, which means another repair cycle later.
- **Suggested next steps, in order and kept minimal:**
  1. Use the 19 major errors above, each with its source line, as a targeted repair list or fact pins for this candidate.
  2. Decide whether to run the source-fidelity judge on this candidate before spending more panel rounds. It costs model calls against the shared weekly cap, so it is your decision.
  3. Audit the other 15 chapters, or at least sample more of them, before any ship verdict.