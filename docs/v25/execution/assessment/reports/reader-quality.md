# reader-quality

## keyFacts
- VERIFIED: The rev-6 package has only 4 chapters ('Part One' to 'Part Four'), createdAt 2026-08-28T06:30:55Z. The candidate has 19 chapters titled from the source headings. Candidate ch07's content (Keimer, Meredith, Coleman, Denham, Webb, Mickle) has 0 hits in rev-6 (grep over the rendered parts), so a same-chapter comparison is impossible. I matched by source span: ch01 to Part 1, ch13 to Part 3, ch19 to Part 4.
- VERIFIED: The candidate has 89,775 reader words, which is more than the source text (66,236 words, wc -w source-text.txt). Examples are 35% of the words (31,218) and summaries 23% (20,601). Rev-6 is about 18k words.
- VERIFIED: 8 of 19 candidate full reads (ch02, 04, 06, 07, 09, 10, 12, 19; 486 to 774 words) and 11 of 19 deep reads have zero newline characters, so each is one unbroken block. This has been true since the compile candidate (compiler-operator-retry-13) and is unchanged through rr21. The web adapter splits paragraphs on /\n\n+/ (app/app/api/book/_lib/v21-adapter.ts:76), so each renders as a single block.
- VERIFIED: Rev-6's longest summary paragraph is 115 words, so the candidate is worse on paragraphing than rev-6.
- INFERRED (assessor scoring with the panel's 10 weighted factors): the candidate chapters score ch01 64.4, ch07 61.1, ch13 68.1, ch19 64.9. Rev-6 Parts 1/3/4 score about 61 on the same lens. This is consistent with Phase A's fresh book-score panel of 64.6 on rev-6 (S_TIER_PHASE_A_REPORT line 7).
- VERIFIED: The pipeline panel's median composites are ch01 74.3, ch07 75.8, ch13 77.1 (review-35abdd, rr21) and ch19 77.5 (review-ba9e, rr20; ch19 bytes identical between rr20 and rr21, sha1 prefix de3f5).
- VERIFIED: The chapter floor is AUTHOR_CHAPTER_BAR = 70 (src/review/readerReview.ts:163, lowered from 80 on 2026-07-29). All 19 chapters clear it (73.2 to 81), so the FAILs come from blockers only.
- INFERRED (from the panel FACTOR_SCORES in both reviews): taking the median over 19 chapters of each factor gives a book composite of about 76.3, with limits 69 and density 69. The whole-book rubric gate needs a composite of 80 and every factor median ≥70 (catalogRubric.ts:178,185), so it would likely fail even on the panel's own numbers.
- VERIFIED: The whole-book rubric phase has never run for Franklin (0 '"phase":"rubric"' events in book-run-events). Fresh-QC, which holds the source-fidelity judge, last ran 2026-08-28, so no source-fidelity check has ever run on the 19-chapter candidates.
- VERIFIED: Over 21 repair rounds the four chapters' panel composites stayed flat or fell. ch01 went 72.2 to 74.3, ch07 78.3 to 75.8, ch13 78.8 to 77.1, ch19 76.1 to 77.5 (compile candidate to latest, per the review JSONs for the 06d7596 lineage).
- VERIFIED: Blocker counts swing from round to round: 34, 27, 21, 17, 13, 19, 15, 9, 18, 9, 10, 15, 16, 7. Across the last four reviews, 33 of 46 reader blockers came from seat-skeptic and 32 of 46 target the summary/hook tiers (standalone completeness or cross-tier contradiction).
- VERIFIED: rr20 blocked chapters 01, 05, 06, 07, 09, 10, 12, 13, 16, 17 and rr21 blocked 04, 08, 10, 12, 15. The overlapping chapters (10, 12) were blocked on different issues.
- VERIFIED: ch13 inverts the lamp credit. The chapter says Franklin 'let the idea stand under Clifton's name instead of his own' and 'the lamp he let Clifton's name cover'. The source credits Clifton with lighting the city and has Franklin claiming merit for the lamp's form (source lines 4846-4851).
- VERIFIED: ch13 hides that the no-sect trustee was Franklin himself, who then negotiated as 'a member of both sets of trustees' (source 4586-4592). It also misstates the dispute as 'two sects both wanted it'; the source says 'how to avoid having two of some other sect'.
- VERIFIED: ch07 says 'A member of that club, Baird', meaning the Junto. The source puts Baird at the 'merchants' Every-night club' (source 2357-2364). ch07 also says Keimer 'shouted down... from the street', while the source has Keimer in the street and 'look'd up' (2094).
- VERIFIED: ch01 Card 6 back invents a cause for Franklin's move into the trade ('the arithmetic that never came right'); the source gives none (237-262). The ch01 full read invents why Mather praised Folger, and quiz Q9 tests that invented claim.
- VERIFIED: ch19 omits two moments that are in its source span. Innis's 'like St. George on the signs' line (offset 353199, inside the ch19 span) is flattened to 'He always sat at his desk, yet never sent a letter.' The Scilly lighthouse near-wreck (offset 365437, inside the ch19 span) is absent. ch01 omits the 'second edition' opening (offset 1702, inside the ch01 span).
- VERIFIED: Rev-6 distortions are fixed in the candidate. ch19 has the royal assent right and the Mansfield ending (rev-6 P4 said 'not the king's word' and 'The Board of Trade never rules'). ch13 has the correct hospital sequence and paving tax. ch03 has 'a Dutch dollar and about a shilling in copper'. ch11 has the fire-company fines.
- VERIFIED: Token hammering is reduced. The candidate's maximum per-chapter repeat counts are 4 to 9 ('Fort George' 9, 'heap of stones' 8, 'Madeira' 7), against 11 to 17 in rev-6 per Phase A §3. Card backs no longer open with 'The contrast is/The boundary is' scaffolds.
- VERIFIED: All 57 candidate memorable lines are verbatim sentences lifted from the summaries, and most are plot sentences (e.g. 'He had to buy fresh stores at his own cost.'). They are chosen by code (selectMemorableLinesDeterministic) and re-derived after every repair (src/app/candidateRepairApplicationPort.ts:654-686).
- VERIFIED: splitSentences (src/optimizers/memorableLines.ts:335-341, split on /(?<=[.!?])\s+/) breaks sentences after 'Mr.'. It produced the ch18 memorable line 'Canton to test the pointed rod himself, and Canton found it worked.' (source prose: 'sent Mr. Canton to test...').
- VERIFIED: The web adapter renders memorable lines as takeaway bullets under every summary tier (app/app/api/book/_lib/v21-adapter.ts:276-283).
- VERIFIED: Examples follow one mold: 6 per chapter, 114 in total. 52 of 114 action lines prescribe writing, logging or signing, and 49 of 114 start 'Before' or 'When'. The panel flags the mold as advisory in nearly every chapter (e.g. rr21 ch01, ch02, ch03, ch05, ch06, ch07, ch13 advisories).
- VERIFIED: 108 of 171 quiz stems open with 'Imagine' or 'Suppose'. Absolute words appear in 158 of 342 wrong choices (46%) against 52 of 171 keys (30%).
- VERIFIED: The ch07 memorable line 'Keimer, meanwhile, kept his own newspaper running for nine months.' was a BLOCKER in review-ba9e (rr20). It is still present unchanged in rr21, and review-35abdd did not flag it, which shows seat-level volatility.
- VERIFIED: The panel prompt forbids external factual authority (src/review/readerExperienceReview.ts:78) and routes repetition and density to advisory findings, not blockers (line 103). The panel is structurally unable to block on defects 1 to 3 above.
- VERIFIED: review-35abdd (rr21) has FACTOR_SCORES only for ch01 to ch15. ch16 and ch17 failed with the weekly-limit 429 (SEMANTIC_PANEL_READER_FAILED). ch16 and ch17 bytes changed between rr20 and rr21 (hash b37e4 to 8ff1b and 3d5f0 to d9d9a), so their latest scores are stale.

## openQuestions
- What would the whole-book rubric gate actually score this candidate: close to 76 (the per-chapter panel) or close to 64 (Phase A's fresh-panel style)? Settling it means running the catalog-rubric or book-score 3-reader panel on the rr21 candidate. That spends weekly model quota, so it is an owner decision.
- Would the fresh-QC source-fidelity judge (candidateQcEvaluator / sourceFidelityJudge) catch the ch13 Clifton inversion, the ch07 Baird misattribution and the ch01 Card 6 invented cause? It has never run on this lineage. It would first run only after a review PASS, or through a dry evaluation of the judge on rr21.
- Is a 19-chapter, ~90k-word book (longer than the 66k-word source) the intended product shape? The chapter count follows the source headings after #569. The owner should confirm the target length and depth per chapter.
- Does the live reader route use app/app/api/book/_lib/v21-adapter.ts, so that unbroken full reads show as one block and memorable lines show as takeaway bullets? I verified the adapter code but did not trace the mounted component tree.
- My ten-factor scores come from one assessor and are uncalibrated. A blind 3-reader book-score panel on ch01/07/13/19 of rr21 and on rev-6 Parts 1/3/4 would give comparable numbers.
- ch16 and ch17 changed after rr20 and have no rr21 panel score. Their current reader quality is unknown.
- Lord Mansfield's role: the Gutenberg text says 'one of the counsel', while the candidate says 'counsel for those same proprietors'. Whether this counts as a distortion depends on the edition or historical record (council vs counsel). A historical check or the source-fidelity judge would settle it.

## report

## Reader-experience assessment: candidate review-repair-21 vs the rev-6 released package

### Bottom line
- **Distance from the owner's bar.** The latest candidate is readable, and it is more accurate than rev-6. It is still well short of what the owner would call high quality. I scored it by hand with the ten weighted panel factors, and the four sampled chapters come out at **61 to 68**. The pipeline's own per-chapter panel scores the same bytes at **74 to 78**.
  - The whole-book rubric gate needs a composite of 80 and no factor median below 70. It would probably fail even on the panel's own numbers. Taking the median over 19 chapters of each chapter's panel factor medians gives a composite of 76.3, with limits at 69 and density at 69.
  - That gate has **never run** on this run's content. There are 0 `"phase":"rubric"` events in the events file. Fresh-QC has not run since 2026-08-28.
- **Change since rev-6.** Compared with rev-6 the candidate is:
  - better on accuracy and on over-repeating quoted phrases ("token hammering");
  - worse on paragraphing and length;
  - the same on the two defects that cap retention: the templated examples and the flat memorable lines.
- **Mismatch with the panel's blockers.** The panel's blockers are almost entirely about whether each summary tier stands alone, or whether tiers contradict each other: 32 of 46 reader blockers across the last four reviews. **None of the top five defects below has ever been a panel blocker**, except for one memorable-line blocker that the next round did not repeat.
- **21 repair rounds did not move the four chapters.**

| chapter | compile panel | rr21 panel |
|---|---|---|
| ch01 | 72.2 | 74.3 |
| ch07 | 78.3 | 75.8 |
| ch13 | 78.8 | 77.1 |
| ch19 | 76.1 (compile) | 77.5 (rr20, identical bytes) |

### Method (read-only)
- **Rendering.** I rendered each chapter the way the panel reads it. `scratchpad/assess/rx/render.js` is a JS port of `renderReaderBodyLines` in `src/review/renderReaderDoc.ts` at 9f0117cb7. It prints into `cand-chNN.md` and `rev6-partN.md`, with an answer key appended for my own use.
- **Reader projection.** The product projection is `stripInternalFields` (`src/lib/readerContent.ts:187`). It only removes internal keys. All reader text is identical to what I read.
- **Checks.** Source claims were checked against `~/cf-canary/sources/the-autobiography-of-benjamin-franklin.txt` (66,236 words).
- **Metrics.** Structural metrics come from `scratchpad/assess/rx/{metrics,ngrams,quizshape}.js`.
- **Panel data.** Panel data comes from `reviews/review-ba9e74443abb6b1ce926c5613d8e6238.json` (on rr20) and `review-35abdd05c52c1642a511756a397ecd6e.json` (on rr21).
  - The rr21 review scored only ch01 to ch15.
  - ch19's rr21 bytes are byte-identical to rr20 (sha1 prefix de3f5), so the rr20 score applies to ch19.

### A framing fact: the "same four chapters" do not exist in rev-6
- **Rev-6 shape.** Rev-6 (`book-packages/the-autobiography-of-benjamin-franklin.v21.json`, createdAt 2026-08-28T06:30:55Z) has **4 chapters**, titled "Part One" to "Part Four", and about 18k reader words in total.
- **Candidate shape.** The candidate has **19 chapters**, titled from the source headings, with **89,775 reader words**. That is more words than the source itself (66,236).
  - Examples take 35% of the words (31,218).
  - Summaries take 23% (20,601).
- **How I compared.** I matched chapters by source span:

| candidate | rev-6 counterpart |
|---|---|
| ch01 | Part One (boyhood to London) |
| ch07 | none. Keimer, Meredith, Coleman, Denham, Webb and Mickle get 0 hits in all four parts; the Junto appears only in Part Three |
| ch13 | Part Three |
| ch19 | Part Four |

### Scores (assessor estimate, single reader, not a calibrated panel)
Weights are retention 13, quizzes 12, transfer 11, practical 11, summaries 11, tone 10, limits 9, insight 8, density 8, beginner 7 (`src/review/readerReview.ts:93-104`).

| | ret | quiz | trans | pract | summ | tone | limits | insight | dens | begin | **composite** | pipeline panel median |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cand ch01 | 62 | 62 | 64 | 62 | 68 | 68 | 58 | 66 | 60 | 78 | **64.4** | 74.3 (rr21) |
| cand ch07 | 64 | 60 | 62 | 62 | 58 | 64 | 55 | 66 | 58 | 62 | **61.1** | 75.8 (rr21) |
| cand ch13 | 70 | 64 | 74 | 62 | 68 | 70 | 60 | 74 | 66 | 76 | **68.1** | 77.1 (rr21) |
| cand ch19 | 60 | 62 | 72 | 66 | 62 | 64 | 72 | 72 | 60 | 60 | **64.9** | 77.5 (rr20 = same bytes) |
| rev-6 Part 1 | 62 | 52 | 60 | 55 | 64 | 62 | 60 | 60 | 62 | 80 | 61.0 | — |
| rev-6 Part 3 | 64 | 55 | 66 | 55 | 58 | 62 | 55 | 62 | 62 | 78 | 61.1 | — |
| rev-6 Part 4 | 58 | 50 | 64 | 62 | 55 | 64 | 66 | 58 | 62 | 80 | 61.0 | — |

My numbers sit where Phase A's fresh book-score panel put rev-6: 64.6, against 76.4 on the handoff card (`docs/v25/S_TIER_PHASE_A_REPORT_2026-09-02.md:7-17`). The per-chapter panel runs about 10 to 12 points more lenient.

### Chapter notes (line numbers refer to the rendered cand-chNN.md)

**ch01 "Family History and Boyhood in Boston"**
- Strengths:
  - The fast read is clean and stands on its own (L7).
  - The wharf story carries a real moral: "A good result does not make a taken thing honest" (L35).
  - The deep read is paragraphed.
- Accuracy defects, verified against the source:
  - Card 6 invents a cause (L149): "the later move into the trade turned on a separate cause, the arithmetic that never came right". The source gives no such cause (src 257-259).
  - L25 invents a reason Mather praised Folger ("That accumulated standing, not the verse by itself, is what earned Folger a place"). Q9 then tests that invented claim (L127-130).
  - "Josiah Franklin broke that pattern" (L7). Josiah was the youngest son and trained as a dyer, and the smith trade went to eldest sons (src 110, 138, 259-262).
  - The uncle Thomas resemblance is attributed to "People who had known the uncle" (L31). In the source it was Franklin's son reacting to old people's accounts ("transmigration", src 118-122).
  - "within weeks" (L18) should be "pretty soon" (src 257).
- Examples. Several are incoherent grafts:
  - A dispatcher on a bus layover writing a genealogy that happens to contain Peter Folger's 1675 stand (L66).
  - "Pierce's ledger runs on the same kind of occasion: an uncle's pamphlet collection..." (L63).
- Memorable lines are two flat sentences: "The family story goes back further than Josiah Franklin, Benjamin's father." (L164-165).
- Omission: the most quoted passage in the span is missing: the "second edition" and vanity opening (source offset 1702, inside the ch01 span).

**ch07 "Beginning Business in Philadelphia"**
- Readability: the **deep read is one 309-word paragraph and the full read is one 643-word paragraph** (L10, L13; 0 newlines in the JSON).
- Accuracy defects:
  - "A member of that club, Baird" (L13). The source puts Baird at "the merchants' Every-night club", not the Junto (src 2357-2364).
  - "Keimer once shouted down at Franklin from the street". In the source Keimer was in the street and "look'd up" (src 2094).
  - "gave Franklin a second publication": unsupported, since the Gazette was his first paper.
- Quizzes: Q9 keys an invented step ("Confirm the father's willingness to fund the venture before treating skill as an equal share").
- Examples: Example 6 ends in nonsense: "the hardware man sold his own building and paid far more than the landlord had first quoted her" (L58).
- Memorable lines: line 3 is "Keimer, meanwhile, kept his own newspaper running for nine months." (L144). The rr20 panel made this a BLOCKER. It is still present in rr21, and the rr21 panel did not flag it.
- Strength: Mickle's "sinking place" and the Coleman/Grace half-from-each story are vivid.

**ch13 "Public Services and Duties"** (the best of the four)
- Strengths:
  - The deep read (L10-14) is the strongest passage in the sample. It explains the hospital matching grant correctly ("pay two thousand pounds, but only if private donors first raised that same amount"), and covers the Carlisle rum delay and the Craven-street shilling trial.
  - Good lines: "A small paid trial turns a guess into a number you can trust."
- Accuracy defects:
  - **The credit for the lamp is inverted.** The chapter says "Franklin worked out a replacement built from four flat panes... then let the idea stand under Clifton's name instead of his own" (L21), and "the lamp he let Clifton's name cover" (L23). The source credits Clifton with the idea of lighting the city, and Franklin claims "some merit... respecting the form of our lamps" (src 4846-4851).
  - The chapter hides that the "man who belonged to no sect at all" was Franklin, who then negotiated as "a member of both sets of trustees" (src 4586-4592). It also misstates the dispute as "two sects both wanted it" (L19, L155). The source says "how to avoid having two of some other sect".
  - Chronology: "Long before any of that" (L25). The paving came after the 1753 post office appointment.
- Meta language: "But the page tells a quieter story." (L23).
- Examples: Example 2 has an electrician fit a modern doorway fixture with "a narrow funnel above to vent the smoke" at "the corner of Craven-street" (L42). Example 4 (a mural timed on a therapy walk, L56) teaches nothing.
- Cross-chapter leakage: the weekly practice imports ch07's rule, "is my part capped at what I can afford to lose alone" (L151).

**ch19 "Agent of Pennsylvania in London"**
- Accuracy: much better than rev-6. It includes the Mansfield engagement, the Clerk of the Council, the committee finding "perfect equity", the Denny Madeira bribe, Loudoun's refusal to settle the accounts, and Granville with the royal assent handled correctly ("Those laws needed only the king's assent, not his command").
- A strong stated limit: "A witnessed promise does not protect a person from being checked. It invites the check."
- Readability: **deep read (388 words) and full read (750 words) are each one paragraph** (L10, L13).
- The chronology is scrambled: the Denny dinner is narrated after the crossing.
- It loses the chapter's two best moments, although both are in its span:
  - Innis's "like St. George on the signs, always on horseback, and never rides on" (src 6282; offset 353199, in ch19). It is flattened to "He always sat at his desk, yet never sent a letter."
  - The Scilly lighthouse near-wreck (src 6485-6493; offset 365437, in ch19). "The crossing took about thirty days. The ship reached soundings near Falmouth."
- "Lord Mansfield, counsel for those same proprietors" goes beyond the source ("one of the counsel", src 6661).
- Memorable lines are all flat: "He had to buy fresh stores at his own cost."
- Spelling drifts between "Louisbourg" and "Louisburg".

### Comparison with rev-6 (better / worse / same)
- **Better, on accuracy.** Rev-6's verified distortions are gone from the candidate:
  - Part 4 said "It asks only for the governor's yes, not the king's word" and "The Board of Trade never rules on it"; ch19 has the royal assent right and has the Mansfield ending.
  - Part 3 put the hospital sequence the wrong way round ("subscribers... then the Assembly agreed to a matching grant"); ch13 has it right.
  - Part 3 said "paid for by the residents... not by a city-wide tax"; ch13 correctly says residents came to accept a paving tax.
  - The Dutch dollar is fixed in ch03 ("a Dutch dollar and about a shilling in copper").
  - The fire-company fines are fixed in ch11.
- **Better, on token hammering.**
  - Rev-6 repeated phrases 11 to 17 times each. The candidate's worst counts are 4 to 9: "Fort George" 9, "heap of stones" 8, "Madeira" 7.
  - Stapled quiz stems are rarer. Compare rev-6 P4 Q7: "the same voyage had nearly run aground days earlier... Which confident claim deserves more scrutiny".
  - The card-back scaffold openers are gone. In rev-6, 15 of 28 opened with "The contrast is/The boundary is".
  - Franklin is now present in every chapter. In rev-6 Part 3 he is never named.
- **Worse, on paragraphing and length.**
  - Rev-6's longest paragraph is 115 words, and its reads are short and choppy but easy.
  - In the candidate, **8 of 19 full reads (486 to 774 words) and 11 of 19 deep reads are single paragraphs**: ch02, 04, 06, 07, 09, 10, 12 and 19 for both, plus the deep reads of ch11, 14 and 15. These have existed since the compile candidate and no repair has ever fixed them.
  - The web adapter splits paragraphs on `/\n\n+/` (`app/app/api/book/_lib/v21-adapter.ts:76`), so each of these renders as one block.
- **Same on examples.** Six examples per chapter in the same three-beat mold: scenario, one imperative line, a paragraph tying back to Franklin. It is flagged as advisory in nearly every chapter of both reviews. 52 of 114 action lines prescribe writing, logging or signing something, and 49 of 114 start with "Before" or "When".
- **Same on memorable lines.** Still verbatim sentences lifted from the summaries (57 of 57), and mostly plot statements.
- **Same on voice.** The prose is still a plain third-person summary with few of Franklin's own lines.

### How far from the bar
- **The rubric gate** (`CATALOG_RUBRIC_DEFAULT_BAR = 80` and `CATALOG_RUBRIC_FACTOR_FLOOR = 70`, `src/review/catalogRubric.ts:178,185`):
  - On the panel's own numbers the book composite is about 76.3, and limits and density are at 69. That fails on both the composite and the factor floor.
  - On a book-score-style read (mine, and Phase A's) it is about 61 to 68, which is 12 to 19 points short.
- **The chapter floor** (`AUTHOR_CHAPTER_BAR = 70`, `src/review/readerReview.ts:163`, lowered from 80 on 2026-07-29) is passed by every chapter, with panel scores of 73.2 to 81. Blockers alone decide the FAIL.
- **The owner's high-quality bar** (≥85, no factor below 70, retention and quizzes ≥80) is far away. Retention is 60 to 70 in my scoring and 70 to 82 on the panel.

### Top 5 remaining content defects, by reader impact

| # | Defect | Evidence | Has the panel blocked on it? |
|---|---|---|---|
| 1 | **Unbroken walls of text in summaries** | 8 full reads and 11 deep reads with 0 newlines, up to 774 words; present since compiler-operator-retry-13 | No. Advisory only ("Long unbroken passages...", ch07 rr21; "runs as one continuous block", ch19 rr20) |
| 2 | **Contrived, templated modern examples** (35% of all words) | ch13 Ex2 smoke-vented electric fixture; ch01 Ex4; ch07 Ex6; the identical three-beat mold | Advisory in almost every chapter; a blocker only for single sentences (ch13 Ex2 lamp wording in rr20, ch12 Ex5 in rr21) |
| 3 | **Source distortions and lost signature moments** | ch13 Clifton inversion and hidden Franklin-as-trustee; ch07 Baird→Junto; ch01 Card 6 cause, Folger claim with Q9, "broke that pattern"; ch19 lost St. George line and lighthouse; ch01 lost "second edition" opening | Never. The panel has no source authority by design (`readerExperienceReview.ts:78`), and the source-fidelity judge sits in fresh-QC, which this run has never reached |
| 4 | **Flat and broken memorable lines** (retention is the heaviest factor at 13) | 57 of 57 lifted from the summaries, selected by code (`selectMemorableLinesDeterministic`, re-run after every repair, `candidateRepairApplicationPort.ts:654-686`). The splitter `src/optimizers/memorableLines.ts:335-341` splits on "Mr.", producing the ch18 fragment "Canton to test the pointed rod himself, and Canton found it worked." The web adapter shows these lines as takeaway bullets under every tier (`v21-adapter.ts:276-283`) | Once (ch07 rr20). Not repeated in rr21 on the unchanged line. A repair writer can only fix these indirectly, by rewriting the summaries |
| 5 | **Quiz and card craft** | 108 of 171 stems open "Imagine"/"Suppose"; 46% of wrong choices carry absolute words against 30% of keys; keys can be spotted by keyword (ch19 "signed/written"); some keys test invented claims (ch01 Q9, ch07 Q9) | 74 to 99 quiz_cue advisories per review; about one blocker per round (ch16 Q5 in rr20) |

What the panel actually blocks on:
- **Blockers are mostly one seat and one unit type.** Across the last four reviews there are 46 reader blockers. 33 come from the seat-skeptic reader ("seat" = one of the three panel readers), and 32 are about the summary tiers (a tier "fails its stand-alone promise", or two tiers contradict each other).
- **Blockers change chapters every round.**
  - rr20 blocked ch01, 05, 06, 07, 09, 10, 12, 13, 16 and 17.
  - rr21 blocked ch04, 08, 10, 12 and 15.
  - The only overlaps, ch10 and ch12, are on different issues.
- **Conclusion:** the repair loop is chasing defects that each seat generates at random, while the systemic defects above persist.

### Scratch files (my own, not deliverables)
`/private/tmp/claude-501/-Users-radinsoltani-ChapterFlow/c062400c-9b46-482f-921c-b35b71796a3e/scratchpad/assess/rx/`: `render.js`, `cand-ch01.md` to `cand-ch19.md`, `rev6-part1.md` to `rev6-part4.md`, `metrics.js`, `ngrams.js`, `quizshape.js`, `spanmap.js`, `adv-35abdd.txt`.