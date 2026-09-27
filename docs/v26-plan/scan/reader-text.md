# Scan: the reader's experience of the text

Lens: read the text the way a user would, and ask what makes a chapter engaging and what makes it flat. Read-only; no model calls.
Scratch scripts: `/tmp/claude-0/-home-user-ChapterFlow/48916df7-45f9-50d8-ad9d-e43b21e61800/scratchpad/scan/reader-text/` (`dump.py`, `stats.py`, `quizcraft.py`, `flesch.py` (a port of `src/metrics/rubricMetrics.ts`), `modes.py`).
PIPE = `scripts/book/prompts/chapterflow-v24-author-pipeline`.

## keyFacts

- VERIFIED: **A default reader sees about 15% of a chapter, and the quiz is most of that.** A new user is on the "fast path", which gives:
  - the `simple` depth, which is the fastRead only (`ChapterReaderClient.tsx:144`; `reader-flow-core.ts:20-24`; `learning-mode.ts:95-101`);
  - 5 quiz questions (`lib/quiz-question-counts.ts:20-24`);
  - 1 example, with the others behind "Show more" (`components/reader/ExamplesList.tsx:20`).
  In that session the fastRead is 10-15% of the words read and the 5 quiz items are 50-59%: decisive 59%, rev-6 59%, the Opus probe 50% (`modes.py`). The fullRead, which most pipeline effort goes into, is seen only in challenge mode.
- VERIFIED: **Good catalog chapters are short, and rev-6 Franklin is about twice their size.**
  - Catalog (140 books): median 16.4k reader chars per chapter (IQR 15.7k-17.4k); median fullRead 480 words.
  - decisive / radical-candor / contagious / power-of-moments: 16.3k / 16.1k / 15.2k / 15.2k chars, with fullReads of 436-479 words.
  - Rev-6 Franklin: 29.5k chars per chapter, a 564-word fullRead, examples of 221 words each (the good books' are 96-112), and quiz stems of 50 words (the good books' are 17-23).
  - rr21 (from the 09-23 report numbers): about 4,725 words per chapter. The examples, about 1,643 words, are longer than all three summary tiers together (about 1,084).
- VERIFIED: **Rev-6 has no quotation marks and, in Part Three, no Franklin.**
  - 0 double-quote characters in all four rev-6 parts (`stats.py`, `qm` column).
  - "Franklin" occurs 0 times in Part Three.
  - Part One repeats "half the money" 13 times, "one Dutch dollar" 11 times, "Silence Dogood" 12 times and "three puffy rolls" 9 times.
- VERIFIED: **The pipeline starved Franklin's voice by design.**
  - Until #586 (b5efca3, 2026-09-25) writers were given no Franklin quotations.
  - Since then `SOURCE_WORDS_QUOTE_RULE` says "Quote at most two of these lines verbatim" (`PIPE/src/sections/sectionTasks.ts:682`; D18, `PIPE/src/compiler/sourcePacket.ts:171`).
  - The research sidecars give ch13, ch15 and ch19 **1, 0 and 2** quotations. ch13's only line is on the D18 exclusion list (`tests/fixtures/q05/franklin-ch1{3,5,9}.source.json`; `sourcePacket.ts:178-185`). So ch13 and ch15 writers have nothing of Franklin's to quote.
- VERIFIED: **The readability rule cannot coexist with Franklin's voice.**
  - SEC12 requires Flesch ≥70 on the assembled breakdown and "no sentence over 30 words" (`PIPE/src/sections/sectionTasks.ts:112`; `sectionGate.ts:2954-2964`).
  - Franklin's chapter I scores Flesch 46.8 at 35.4 words per sentence.
  - The Opus probe scores 49.9 at 29.0. It would fail SEC12 badly, and it is the most readable Franklin text in the repo.
  - Rev-6 Part One passes at 73.9 by writing "Franklin grew up in Boston. He loved books more than school."
  - contagious ch6, a good catalog chapter, scores 58.5.
- VERIFIED: **The 6/9/7 counts are pipeline rules, not app rules.**
  - The pipeline requires quiz ≥9 and examples ≥6 (`PIPE/src/critics/finalGate.ts:684-720`) and exactly 6 example slots (`PIPE/src/compiler/blueprintGate.ts:47`).
  - The app validator accepts any counts, including empty lists (`app/app/api/book/_lib/validate-book-package.ts:470-471, 487-491`), and it accepted the probe's 3/6/5.
- VERIFIED: **The catalog already shows what the template does to a memoir.**
  - `mans-search-for-meaning.v21.json` (2026-05-18) opens chapter 1's fullRead with "It took Emily two snowstorms to understand what the gala budget was hiding."
  - Its Auschwitz chapter opens "The turnstile clicks red for the third badge in a row."
  - "Frankl" appears 2 times in the whole package and "prisoner" 0 times.
- VERIFIED: **Rev-6 Part One teaches facts the Autobiography does not contain.**
  - It uses "Silence Dogood", "age sixteen" and "Once James learned who Silence really was".
  - The scar file records that "Silence Dogood" and any age are absent, and that Franklin disclosed his authorship himself (`PIPE/config/book-scars/the-autobiography-of-benjamin-franklin.json`, `_comment` and the Dogood pin).
  - Quiz q06 and card 6 test this material.
- VERIFIED: **The Opus probe is the best Franklin text in the repo, with three flaws.**
  - Its fullRead is long: 1,432 words. Family history fills paragraphs 3-6, about 560 words or 40% of the fullRead, and paragraph 6 alone runs about 200 words.
  - Its quiz keys are the longest choice, or tied for longest, in 5 of 6 questions.
  - Its memorable lines are verbatim Franklin but do not appear in the breakdown. That fails pipeline rule A11 (`finalGate.ts:878`), a rule that makes no sense for a memoir.
- VERIFIED: **The zz-bakeoff files are test debris.**
  - They come from `tests/model-bakeoff-generation.test.ts:53,99,128` via `fixtureChapter` in `tests/model-bakeoff-helpers.ts:43-51` (text such as "A short hook about chapter 1… attempt2").
  - The state stub `current-run.json` is dated 2026-07-10. The files were committed in the 13,993-file import 7cf24e9 (#533, 2026-09-02) and are not gitignored.
  - They do not matter for quality.

## 1. What a reader actually sees

Each chapter moves through four phases in order: summary → examples → quiz → practice (`reader-flow-core.ts:5`).

The reading tier depends on the learning mode:

| mode | tier | quiz items shown |
|---|---|---|
| guided, or any un-customized profile | fastRead | 5 |
| standard | deepRead | 7 |
| challenge | fullRead | 10 (only 9 exist) |

Other surfaces:
- **Hook and counterintuition** render in `HookBanner`.
- **Memorable lines** render under the summary (`ReaderPhaseContent.tsx:158`).
- **Cards and plan** sit in the practice phase (`components/reader/PracticePhase.tsx:163,243`).

Words a reader sees per session (chapter means from `modes.py`):

| package | guided | standard | challenge | fastRead | fullRead | all examples |
|---|---|---|---|---|---|---|
| decisive | 724 | 1,020 | 1,405 | 104 | 457 | 670 |
| radical-candor | 819 | 1,149 | 1,552 | 119 | 479 | 549 |
| contagious | 719 | 1,009 | 1,385 | 105 | 436 | 573 |
| power-of-moments | 680 | 957 | 1,336 | 103 | 469 | 631 |
| **Franklin rev-6** | **1,361** | 1,885 | 2,480 | 130 | 564 | **1,326** |
| Opus probe ch01 | 1,115 | 1,548 | 2,479 | 164 | 1,421 | 471 |

The default session of rev-6 breaks down as:
- hook and top matter: 207 words;
- Franklin's story: **130** words;
- one invented-character example: 217 words;
- five 50-word stapled quiz stems with their choices and explanations: 806 words.

A default user therefore meets about 130 words of Franklin per chapter, and never in his own words.
- **Consequence:** the fastRead and the quiz are the product for most readers, and every automated grader and repair loop reads the whole JSON. INFERRED from the rendering code above.

## 2. Field-level word shares

Chapter means, as percentages of all reader words, from `stats.py`:

| package | ch | chars/ch | words/ch | top | fast | deep | full | examples | quiz | cards | plan | full-read words/sentence | quote chars |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| decisive | 12 | 16,307 | 2,740 | 3 | 4 | 9 | 17 | 24 | 28 | 8 | 8 | 11.4 | some |
| radical-candor | 9 | 16,122 | 2,766 | 4 | 4 | 9 | 17 | 20 | 31 | 7 | 6 | 10.8 | some |
| contagious | 6 | 15,172 | 2,539 | 4 | 4 | 9 | 17 | 23 | 30 | 6 | 7 | 10.4 | few |
| power-of-moments | 12 | 15,217 | 2,610 | 5 | 4 | 9 | 18 | 24 | 26 | 8 | 7 | 10.6 | 0 |
| **Franklin rev-6** | 4 | **29,493** | **5,035** | 4 | 2 | 6 | **11** | 26 | 30 | 10 | 9 | 11.9 | **0** |
| Opus probe ch01 | 1 | 22,078 | 3,812 | 6 | 4 | 13 | **37** | 12 | 18 | 5 | 5 | 24.1* | 84 |
| rr21 (from report) | 19 | ~30k (handoff) | ~4,725 | – | – | – | summaries 23 in total | **35** | – | – | – | 12-14 (handoff) | 0 in summaries |

*The splitter follows `rubricMetrics.sentences`. The probe log's 30.5 comes from a different split.

Quiz and card craft (`quizcraft.py`):

| package | stem words | choice words | card words | key is the uniquely longest choice |
|---|---|---|---|---|
| good books | 16.7-22.9 | 10-17 | 27-36 | 3-25% |
| rev-6 | **50.4** | 19.6 | **73.4** | 6/36 |
| Opus probe | 19.0 | 13.1 | 35.6 | **4/6** (5/6 including ties) |

In every good book the summary tiers carry about 30% of the words and every field is short. In rev-6 the story shrinks to 19% of the chapter, while the examples and cards double in length.

## 3. What makes a chapter engaging, and what doesn't (quoted)

### Engaging: decisive ch8, contagious ch6, the Opus probe

- **The hook is a compressed claim or a scene.**
  - decisive: "The feeling nearest your face should not get the longest vote."
  - probe: "One evening in Boston, a boy marshalled his friends to haul away a builder's heap of stones, and by morning they had a neat little fishing wharf standing in the salt marsh."
- **There is one idea with a visible arc.**
  - decisive's fullRead goes through tools, then trap, then limit: "The counter-case is a fire alarm, not a car lot. If smoke is under the door, 10/10/10 would be a mistake."
  - contagious ch6 tells each of five source cases once, then gives a limit ("If every line tries to carry a lesson, the story becomes a brochure") and a test ("ask someone to repeat the story after one listen").
- **Memorable lines are earned.** "Distance is a pause, not a freeze." "The familiar can feel true before it is tested."
- **Quiz stems test one idea in under 25 words.** contagious q05: "A writer compares two comedy boards: one random prank and one cheese-refusal prank. Which board is stronger?"
- **Cards are plain question and answer.** "What does 10/10/10 ask you to compare?"
- **Voice (probe only).** The probe is the only Franklin text here that sounds like Franklin: "He has scarcely ever heard the preface 'Without vanity I may say' without some vain thing arriving directly behind it." It also includes a narrator's wry gloss: "the printer's mind applied to a human life."

### Flat or hostile: Franklin rev-6 Parts One and Three

- **Stapled quiz stems join facts that have nothing to do with each other.** Part One q03: "A vegetable diet freeing half the money once claimed in cash instead of shared meals gives a clean day to mark as the start of a change. Being glimpsed passing a doorway on arrival morning is not that clean: what should actually trigger you to count a sighting as the start of a relationship?"
  - Part Three q02 is the same: "Like the voluntary group that formed after Plain Truth called for cannon funded by a public lottery, a handful of friends want to start a weekly discussion circle."
  - This matches the Q08 root cause of pairing a fact with an unrelated case (HANDOFF). It was already on the page in August.
- **Cards splice a second anchor onto the answer.** Part One card 1: "…That same already-methodical instinct for turning a plain constraint into an advantage, like a vegetable diet quietly freeing half the money for books, existed long before any deliberate system tracked it."
  - Part Three: "The Junto's weekly queries habit trained the same discipline: show up and deliver before any reward comes."
  - 15 of 28 rev-6 card backs open with "The contrast is" or "The boundary is" (reader-quality.md:165).
- **Examples use invented characters who have read about Franklin.**
  - "Having once read about an arrival where someone bought three puffy rolls with the last coins in his pocket, Oliver spends the little that's left on something similar."
  - "Inside sat a photocopied note on old trade contracts, describing someone bound at age twelve for a nine-year term."
  - "An old story about a governor's promised letters of credit … sticks in Jacqueline's head from a mentor's notebook."
  - The device announces that the example is a vehicle for a fact quota.
- **The plan has nothing to do with the story.** Part One's practice is an "owner handoff note" (5 times) with a "before-point" (5 times), attached to a boyhood.
- **The prose is chopped.** "Franklin grew up in Boston. He loved books more than school." The full read averages 12 words per sentence. The memorable lines are recaps, not lines: "Governor Keith's letters of credit for London never existed at all."
- **Voice and protagonist are missing.** There are no quotations, and Part Three never names Franklin; its hook is addressed to "you": "Say the whole city needs a school … what's your first move?"
- **The compression is severe.** Part One tells Franklin's life to about age 19 (roughly source chapters I-VI) in a 570-word full read, about 95 words per source chapter. The wharf, Collins, the Spectator imitation, Keith's deceit and London are all compressed away, while the six examples take 1,326 words.
- **Part Three's full read is the best rev-6 prose.** It is clear and orderly, but it is a civics lesson with its facts wrong: the hospital sequence is inverted, and "not by a city-wide tax" is wrong (reader-quality.md:158-159).

### rr21, the latest v25 candidate (quotes from the 09-23 reports, since rr21 itself is not here)

- **The good moments exist but are rare.** "A good result does not make a taken thing honest." "A small paid trial turns a guess into a number you can trust." (reader-quality.md:106,134)
- **Examples are grafts.** "A dispatcher on a bus layover writing a genealogy that happens to contain Peter Folger's 1675 stand", and a modern electrician fitting a fixture with "a narrow funnel above to vent the smoke" "at the corner of Craven-street" (reader-quality.md:115,140).
- **Franklin's best lines are flattened.** "like St. George on the signs, always on horseback, and never rides on" became "He always sat at his desk, yet never sent a letter." (reader-quality.md:149)
- **Memorable lines are plot sentences.** "He had to buy fresh stores at his own cost." (:152)
- **Walls of text:** 8 of 19 full reads are a single paragraph (:169).

### The "good" v24 whole-chapter book still leaks its rulebook (radical-candor ch1, gpt-5.5 xhigh)

- "Kim Scott's Google AdSense and Apple executive settings keep the tool out of etiquette class." In ch1, "AdSense" appears 8 times, "Apple" 8 times and "Google" 13 times.
- ex01: "No private hallway scene exists to replay, so treat the miss as a thought experiment, not a biography."
- The famous Sandberg "um" story is referred to but never told ("shows the care side without making it soft").
- **Lesson:** a whole-chapter writer is necessary but not sufficient. Rules written into the prompt come out as reader text. INFERRED from these quotes plus the grounding and anchor rules the pipeline sends.

## 4. Is the v21 format right for a memoir?

**The app's shell is fine; the pipeline's quotas and example philosophy are wrong for a memoir.** VERIFIED for the counts (section 1 and keyFacts); INFERRED for the judgement.

**Keep:**
- a hook, a counterintuition and three tiers;
- a short quiz and cards;
- a small plan.

This is the product's learning loop, and the app renders it well.

**Change, for a narrative book:**
1. **The story must carry the chapter.** In each tier the chapter is Franklin's scenes, in order, in his words: at least 2 short quotations in the fastRead and 6-15 in the fullRead. Drop the 2-quote cap, the Flesch ≥70 floor and the 30-word sentence ban for this book.
2. **The fastRead is the product for most readers.** It should be a 150-220-word mini-story that contains the chapter's best scene and 1-2 lines of Franklin. It should not be a list of facts.
3. **Use 2-3 examples, not 6.** Each is a plainly modern situation of about 80-130 words that applies one of Franklin's ideas. Never have a character who "read about" Franklin, and never re-tell his anecdote inside an example. The probe's "spreadsheet nobody approved" (the stolen-stones rule applied to borrowed HR data) is the model.
4. **Use 6 quiz items, of which at least 4 test the story itself:** what happened, why Franklin says it happened, and what he concluded. Only 1-2 should test application.
   - The default reader sees 5 questions, so the first 5 should be the best and should be story-first.
   - No stapled stems, no "Suppose" or "Imagine" openers, and a key that is not the longest choice.
5. **Use 4-5 cards, as plain question and answer on a Franklin line or idea.** For example: "What did Franklin's father say about the wharf?" → "nothing was useful which was not honest".
6. **Memorable lines should be Franklin's own sentences.** Drop A11's "verbatim in the breakdown" rule, or quote the line in the fullRead.
7. **Owner decision (the app):** for a memoir, consider making `standard` (the deepRead) the default depth, because 130-160 words cannot carry a life story.

## 5. Sketch: an excellent Franklin chapter 1 (source slice = chapter I, about 3,000 words of Franklin)

The order follows Franklin's own, with the genealogy compressed and the scenes kept. Line numbers refer to `tests/fixtures/franklin-autobiography-slice.txt`.

- **Title:** "Nothing Useful That Is Not Honest", or "The Wharf of Stolen Stones".
- **Hook** (2 sentences, the scene): the boys, "working with them diligently like so many emmets" (293), carry off a builder's stones and build a wharf overnight. The next morning the workmen are "surprised at missing the stones" (295).
- **Counterintuition:** he admits vanity and defends it; one might "thank God for his vanity among the other comforts of life" (59-60).
- **fastRead** (about 180 words): 1771, a letter to his son; the "second edition" wish (37-38); pulled from school because of the cost; "I failed in the arithmetic" (263-264); cutting wick at ten; wanting the sea; the wharf; "nothing was useful which was not honest" (299-300).
- **deepRead** (about 450 words, 4-5 paragraphs): the same line, plus the vanity passage, Ecton ("the youngest son of the youngest son for five generations back", 98-99), the Bible under the joint-stool, and Josiah at the dinner table.
- **fullRead** (1,000-1,200 words, 8-9 paragraphs of 60-140 words):
  1. The letter frame and "emerged from the poverty and obscurity" (17-18).
  2. The "second edition" and the vanity confession: two of the best paragraphs in American prose, so quote them.
  3. Ecton, the smith's trade for the eldest son, and "youngest son of the youngest son". Compress the grandfather, Banbury and the gravestone into one clause.
  4. Uncle Thomas the scrivener and "one might have supposed a transmigration" (127-128); Uncle Benjamin's shorthand, "never practising it, I have now forgot it" (152-153), and the pamphlets turning up at a London bookseller.
  5. The Bible taped inside the joint-stool, with a child watching the door for the apparitor (173-180).
  6. Josiah goes to New England for his religion; 17 children, 13 at one table; Peter Folger, who signed his criticism, "My name I do put here" (226).
  7. School: "I do not remember when I could not read" (246), top of the class, the cost of college, Brownell's school, the failed arithmetic, cutting wick at ten.
  8. The sea, the boats, "commonly allowed to govern" (280-281), the wharf, the father's rule, and Franklin's own verdict: "an early projecting public spirit, tho' not then justly conducted" (283-284).
  9. Josiah's judgment and his dinner-table topics ("scarce tell a few hours after dinner what I dined upon", 330-331), then the epitaph's closing lines (356-358).
- **Examples** (2-3):
  1. Ends and means: a shortcut built on someone else's material.
  2. Honest self-assessment: stating your record plainly, the vanity passage turned around.
  3. Seeding a conversation: a manager bringing one useful question to a meeting, after Josiah.
- **Quiz** (6):
  1. Why was he taken out of grammar school? The cost against thin livings (255-259).
  2. What did the boys build the wharf from?
  3. What did his father say?
  4. How does Franklin treat his vanity?
  5. Application: a path built with "borrowed" gravel.
  6. Application or interpretation: what does "tho' not then justly conducted" concede?
  Keys spread across positions, with equal-length choices.
- **Cards** (5): the father's rule; the "second edition" wish; "youngest son of the youngest son"; the Bible stool; two things he admits failing at (arithmetic and the shorthand).
- **Plan:** one core skill ("test a result twice: does it work, and was the way you got it honest?"), 2 if-then plans, and a weekly habit of bringing one good question to a meal.
- **Length:** about 2,900-3,300 words and 17-20k characters in all. That is near the source chapter's own length, so the value added is the modern telling, the selection and the learning loop, not more words. The probe (3,812 words) is about 15% over this target.

## 6. 19 chapters, 4 parts, or something else?

- **4 parts: no.** VERIFIED for the numbers.
  - Rev-6 Part One gives about 20k source words a 570-word full read, and Part Three drops the protagonist. A default reader gets 130 words for 20 years of life.
  - Each part also needs 6 examples and 9 quiz items, which fill the chapter with invented material (examples 1,326 words against a 564-word full read).
- **19 edition chapters: yes, as the default.** Reasons: the spans are verified (source-accuracy.md:73-76), the titles match the headings, an average of about 3,500 source words fits one 10-15-minute app chapter, and the catalog norm is 9-16 chapters.
- **Engagement comes from each chapter's pull, not from the count.** INFERRED from the text and my reading of the book.
  - Strong material: ch I, II, III, VI, VIII, IX (the virtues), X, XI and XVI (Braddock).
  - Thin material for modern readers: XIV (Albany) and XV (proprietary quarrels). These could be shorter chapters rather than merged ones, with length allowed to follow the source's richness instead of a fixed quota.
- **Cost no longer decides the count.** One probe chapter cost $0.45 to write and $0.27 for an Opus fact check (HANDOFF/probe, docs/v26-plan/ANALYSIS.md:44). So 19 chapters cost about $14 for draft plus check, against about $120 for one v25 compile.

## 7. zz-bakeoff-*.chapter.json

- Five 1.2 KB files in the PIPE root: iso-ch01, iso-ch02, keep-ch01, retry-ch01 and reuse-ch01.
- **Which book:** none. They hold the test fixture's "A short hook about chapter 1. It costs someone something real.attempt2", with empty examples and quiz.
- **Which writer:** none. `fixtureChapter` stamps them with seeds such as "w2" and "attempt2".
- **When:** the fake spawns in `tests/model-bakeoff-generation.test.ts` resolve their output against `PIPELINE_DIR` (line 104) and so leaked into the real tree. The stub `state/books/zz-bakeoff-iso/current-run.json` has createdAt 2026-07-10T11:13Z. The files were committed in 7cf24e9.
- **Do they matter?** Not for quality. They are hygiene only: delete them and point the test at a tmp root.

## 8. Diagnosis verdict (through this lens)

1. **"Assembled, not written": CONFIRMED.** The stapled quiz stems and spliced card backs in rev-6 are what four blind writers under fact-and-case quotas produce. REFINED: the v24 whole-chapter author also leaked rule text ("thought experiment, not a biography"), so the brief and rules matter as much as the split.
2. **"Rules create problems": CONFIRMED, with specifics.**
   - SEC12 (Flesch ≥70 and ≤30-word sentences) forces chopped prose.
   - The 2-quote cap and zero-quote sidecars remove Franklin's voice.
   - A11 forbids his lines as memorable lines unless they are pasted into the tiers.
   - The exact 6 example slots cause padding.
   - The quotas for "anchor in every unit" produce the token hammering.
3. **"The format fights a memoir": REFINED.** The app format is flexible (it accepts 3/6/5, and tiers are chosen by mode). The pipeline's quotas and its invented-character example philosophy are what fight a memoir. The catalog precedent (Man's Search for Meaning) shows the result is systematic, not specific to Franklin.
4. **"A broken compass": CONFIRMED and extended.** Every grader reads the whole JSON, but a default reader sees about 15% of it. Nobody has scored the guided session. Cheap reader-visible smoke alarms would catch rev-6 in seconds: quotation count, Franklin-name count, stem length, example-to-story ratio, and whether the key is the longest choice.
5. **"Accuracy is baked in upstream": PARTLY.** The paraphrase layer starves voice (0-2 quotations per chapter). But rev-6's Dogood material ("age sixteen", "Silence Dogood", "James learned") is model world-knowledge leaking in, not paraphrase. A writer that is given the real text and told it is the only authority fixes both: the probe had 44 of 44 quotations verbatim.
6. **"Over-engineered around the writing": CONFIRMED on the page.** One $0.45 call beats 21 repair rounds on hook, voice, arc, paragraphing, quiz stems and card craft. It loses only on length discipline and the answer-length cue.

## 9. Implications for the plan

- **P1 is right.** Add to the P1 brief and the owner's side-by-side read:
  - (a) Read each chapter in the app in guided mode as well as challenge mode, because guided mode is what users see.
  - (b) A fastRead of 150-220 words that tells a scene and includes 1-2 quotations.
  - (c) A fullRead of 1,000-1,200 words, with the genealogy compressed.
  - (d) 2-3 examples, with no "read about Franklin" device.
  - (e) 6 quiz items, at least 4 of them on the story, with the key not the longest choice. This check is deterministic and free.
  - (f) Memorable lines that are verbatim Franklin.
  - (g) No outside-source facts: the Dogood material is the canonical trap for ch02.
- **P2's whole-chapter writer should get the real source span.** Drop, for this book: SEC12, the 2-quote cap, A11's verbatim-in-breakdown rule, the exact-6 examples slot and finalGate's quiz ≥9 floor.
- **H-B (keep the v25 compiler) cannot deliver voice** without removing the same rules plus the paraphrase-only inputs. At that point it is P2 with extra machinery.
- **Replace grader targets with cheap reader-visible smoke alarms** computed per mode (the list in 8.4).
- **Do not ship rev-6 or rr21.** Neither passes a reader's read.

## 10. Open questions

- **Default depth for a memoir.** Should narrative books default to `standard` (the deepRead)? This is an owner and app decision.
- **Length.** Is a probe-length full read (1,400 words) acceptable on a phone, or is 1,000-1,200 the cap? A two-length A/B read by the owner would settle it.
- **Spelling.** Does the owner want Franklin's spelling ("tho'", "bro't", "sope") kept in quotations? Keeping it is authentic; normalizing it is easier to read.
- **rr21 and Q08.** I could not read either directly. The "invented modern character → one-line fix → rationale" pattern (HANDOFF) matches rev-6's examples, but its rate in Q08 is unverified here.
- **Retention data.** Does the app log mode choice and chapter completion by mode? That would show whether readers reach the full read at all. It is not checked here.

## Adversarial verification

Verifier re-ran every count independently (scratch: `scratchpad/scan/verify-reader-text/`: `modes2.py`, `flesch.mts`/`fl2.mts`/`fk.mts` import the pipeline's own `src/metrics/rubricMetrics.ts` via tsx; 0 model calls).

- **RT1: CONFIRMED.** `ChapterReaderClient.tsx:144` + `useReaderSettings.ts:31` (`defaultToFastPath = hydrated && !profileCustomized`, default false); `simple` → `easy` → fastRead (`app/book/lib/v21-adapter.ts:233-249`, `bookChapters.ts:198-208`); the depth picker is hidden (`ReaderChrome.tsx:149 showDepthSelector={false}`), so fullRead is challenge-only; the quiz is `slice(0, 5)` in authored order for v21 (`quiz-session.ts:136-144`, `isStrictReaderSchema` accepts `chapterflow-v21-authored`). Independent recount matches: decisive 73/104/117/428, rev-6 207/130/217/806, probe 218/164/174/568. Caveat: on a correct answer the quiz explanation is collapsed behind "Show explanation" (`QuizPanel.tsx:361-377`); without explanations the quiz is 39-52% of the session and the fastRead 12-18%.
- **RT3: CONFIRMED.** `sectionTasks.ts:682` is the "Quote at most two" rule; `sourcePacket.ts:178-185` excludes `ch13.quote.great-spirit-rum`; `git log -S SOURCE_WORDS_QUOTE_RULE` → b5efca3 (#586, 2026-09-25), and the code comment at `sectionTasks.ts:666-669` says "no writer ever saw one" before it. The q05 fixtures give 1/0/2 quotations (ch15 has no `quotations` key); only these 3 of 19 sidecars are in the repo. Rev-6 (createdAt 2026-08-28) has 0 straight or curly quote marks in all 4 parts. Probe: `probe_tools.py quotes` → "quotes 44, missing 0" (41 quoted spans in the text plus the 3 memorable lines it wraps in quotes).
- **RT4: CONFIRMED (with precision notes).** The pipeline's own `readabilityMetrics` gives rev-6 Part One 73.9, probe assembled 49.9 at 29.0 wps, contagious ch6 58.5: all exact. The Franklin slice with indented footnotes and markers stripped gives 48.2 at 34.1 wps (the investigator's 46.8/35.4 used a slightly different strip); the conclusion is unchanged. The Flesch ≥70 floor (`readingLevel.ts:67`) is a SEC12 blocker (`sectionGate.ts:2958-2964`). "No sentence over 30 words" is prompt text; the gate's E7 fires only above 34 words (`plainLanguage.ts:34`) and is a major, not a blocker. Also, rev-6 Part Three's assembled breakdown scores 69.7, so it would itself fail today's SEC12.
- **RT7: CONFIRMED (stronger than stated).** `mans-search-for-meaning.v21.json` (createdAt 2026-05-18, 5 chapters, live in `lib/books-catalog.metadata.json`): "Frankl" appears 2 times, but one of them is the `book.author` field, so chapter text names him once. "prisoner" appears 0 times and "Auschwitz" 2 times. The ch1 and ch2 fullRead openings match the quotes. All 9 ch2 quiz stems are modern emergencies (apartment fire, drained account, cyberattack and others). The book is catalogued as "Productivity, Self Improvement".

**Missed:** the per-tier FK ceiling hits hardest on the one tier a default reader sees. SEC12 also blocks any fastRead above FK grade 7 (`readingLevel.ts:54-58` `TIER_TARGETS`; `sectionGate.ts:2938-2939` turns a major into a blocker), and the prompt aims the fastRead at 420-600 chars, about 70-100 words (`sectionTasks.ts:112`). The probe's fastRead, the model for section 4 item 2 (a 150-220-word mini-story with 1-2 Franklin lines), is 973 chars at FK 12.7. Rev-6's fastReads are FK 3.7-5.2. So the report's key recommendation for the reader-visible tier is blocked by a second rule that the report never names, beyond the assembled Flesch floor.
