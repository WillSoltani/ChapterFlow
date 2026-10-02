# W1c research — making one-lesson chapters interesting, memorable and plain

Written 2026-10-02 for W1c (branch `v26/lesson-first`). Inputs: four research angles (curiosity, memorable messages, retention and transfer, plain language). A separate verifier checked every claim against its source. This doc keeps only supported claims, uses the verifier's corrected wording where a claim was overstated, and labels design inferences as inferences.

## Summary

The evidence backs the owner's lesson-first design, with one limit: an opener may leave the book's story, but it must not leave the lesson, because interesting but off-point material lowers learning and questions asked up front mainly help memory for the thing they ask about. The strongest findings for ChapterFlow are to refute a common wrong belief before teaching the right one (g ≈ 0.41), to practise using the lesson in new situations rather than recalling the story, to compare several short cases that share the lesson (d ≈ 0.50), and to cut anything that does not serve the lesson. Plain-language guides and the research on the "curse of knowledge" say plainness should be checked by a reader who lacks the source, with a readability formula as a screen only. Effects are modest, almost none of the evidence comes from book-summary or microlearning apps, and several rules below (one canonical lesson sentence, the no-chapter solver, the cold reader) are reasonable design steps rather than tested findings. None of the four angles covers LF-FAITHFUL; that stays a check against the source.

## Principles

Each principle gives the rule, the v21 fields it changes, the requirements it serves, the evidence, and a check a writer or judge can apply. Strength: **strong** = meta-analytic and consistent; **moderate** = solid but narrow or extrapolated; **weak** = few studies, or outcomes other than learning.

### 1. Write the lesson first, as one plain sentence, and make every other field apply, prove or test it.
- **Fields:** `keyTakeaway` (written first, 20 words or fewer); `memorableLines[0]`; the last one or two sentences of each `breakdown` tier; `quiz.questions[].explanation`; `reviewCards[].back`; `implementationPlan.coreSkill`.
- **Serves:** LF-SPINE, LF-LINES, LF-ARC.
- **Evidence:** Cues that mark the essential idea help learning: signaling held in 24 of 28 tests (median d = 0.41), and a meta-analysis of 103 studies (N = 12,201) found g = 0.53 for retention and 0.33 for transfer. The same handbook chapter notes that signaling works better when used sparingly. A government clarity standard scores a text on having one main message of one to three short sentences.
- **Sources:** [Mayer & Fiorella (2014)](https://edtechuvic.ca/wp-content/uploads/sites/11/2022/09/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles.pdf), [Schneider et al. (2018)](https://doi.org/10.1016/j.edurev.2017.11.001), [CDC Clear Communication Index](https://www.cdc.gov/ccindex/pdf/full-index-score-sheet.pdf)
- **Check:** For any field, a judge can name the part of `keyTakeaway` it serves. Restate the whole sentence only in `keyTakeaway`, `memorableLines[0]` and each tier's close (a reader sees one tier); elsewhere reuse its key phrase. One canonical sentence is our inference from these findings, not a tested design.
- **Strength:** moderate.

### 2. The hook opens one small, specific gap, and `keyTakeaway` is the answer.
- **Fields:** `hook`; the first one or two sentences of each `breakdown` tier.
- **Serves:** LF-OPENER, LF-INTEREST, LF-SPINE.
- **Evidence:** A theory review proposes that curiosity comes from noticing a specific gap in what one knows, and that it needs some prior knowledge ("manageable gaps"). In trivia studies, answers people were curious about were recalled better (70.6% vs 54.1% right away; 45.9% vs 28.1% after a day, in a separate experiment). Two meta-analyses of questions asked before learning found gains for the content asked about (g = .66; g = .54) and essentially none for other content (g = .01; g = .04), and the gain depends on the answer coming afterwards.
- **Sources:** [Loewenstein (1994)](https://www.cmu.edu/dietrich/sds/docs/loewenstein/PsychofCuriosity.pdf), [Gruber, Gelman & Ranganath (2014)](https://doi.org/10.1016/j.neuron.2014.08.060), [King-Shepard et al. (2025)](https://link.springer.com/article/10.1007/s10648-025-10075-7), [St Hilaire, Chan & Ahn (2024)](https://doi.org/10.3758/s13423-023-02353-8), [Pan & Carpenter (2023)](https://eric.ed.gov/?id=EJ1393374)
- **Check:** Write the hook's implied question in one line. The lesson sentence that closes each tier must answer it in plain words; if it does not, rewrite the hook. Rotate forms across a book: a question or puzzle, an everyday situation with an unknown outcome, a surprising contrast, "someone worked this out and most people haven't" (drawn from Loewenstein's triggers, which were never tested as openers). A hook's question is rhetorical, so its effect is likely weaker than a real pre-question.
- **Strength:** moderate.

### 3. Make the hook's first sentence concrete and about the reader's own life; hold back only the why or the what-to-do.
- **Fields:** `hook`.
- **Serves:** LF-OPENER, LF-INTEREST.
- **Evidence:** In a registered-report analysis of 8,977 headline A/B tests, vague headlines did better when made more concrete (and over-concrete ones did worse); a 2026 multi-study paper found question-framed titles cut engagement because they seemed less informative, though older small field tests found the opposite. In one short online study (N = 203), an article showing a topic's usefulness (mainly to health and society) raised curiosity, while an article of interesting facts did not. These studies measure clicks, engagement or curiosity ratings, not learning.
- **Sources:** [Le Quéré & Matias (2024)](https://www.nature.com/articles/s41598-024-81575-9), [Fang & Wheeler (2026)](https://myscp.onlinelibrary.wiley.com/doi/10.1002/jcpy.70031), [Dubey, Griffiths & Lombrozo (2022)](https://cognition.princeton.edu/sites/default/files/dubey_-_if_its_important_then_im_curious_increasing_perceived_usefulness_stimulates_curiosity_0.pdf)
- **Check:** Reject vague teasers ("You won't believe...", "The secret is..."), "Did you know" trivia, and stakes that belong only to the historical figure. A hook that opens with a question attaches a concrete scene to it, and question-first hooks stay a minority across a book (a heuristic, not a tested threshold).
- **Strength:** weak.

### 4. Put nothing in only because it is interesting: the opener may leave the story, never the lesson.
- **Fields:** `hook`, `breakdown` tiers, `examples`.
- **Serves:** LF-OPENER, LF-SPINE, LF-SIMPLE.
- **Evidence:** A 2026 meta-analysis (50 studies, 177 effects) found that interesting but irrelevant "seductive details" lowered learning (g = -0.16; comprehension -0.19, recall -0.17, transfer -0.12), mainly by adding extraneous load. Earlier reviews agree: one meta-analysis of 39 effects found small-to-medium harm to retention and medium harm to transfer, and the coherence principle held in 23 of 23 tests (median d = 0.86). One experiment (N = 247) traced the harm to diversion: readers treated the detail as relevant and spent time on it.
- **Sources:** [Cheng et al. (2026)](https://link.springer.com/article/10.1007/s10648-025-10099-z), [Rey (2012)](https://eric.ed.gov/?id=EJ986386), [Sundararajan & Adesope (2020)](https://link.springer.com/article/10.1007/s10648-020-09522-4), [Mayer & Fiorella (2014)](https://edtechuvic.ca/wp-content/uploads/sites/11/2022/09/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles.pdf), [Kienitz, Krebs & Eitel (2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10176302/)
- **Check:** Run a deletion test on the hook and each example: if cutting a fact, statistic or anecdote does not make the problem, the evidence or the lesson harder to follow, cut it. The flat ban on outside facts comes from LF-OPENER and LF-FAITHFUL, not from this evidence.
- **Strength:** strong (the effect is small but consistent).

### 5. Write `counterintuition` as a refutation: "Many people think X. Actually Y, because Z."
- **Fields:** `counterintuition`; the problem part of each `breakdown` tier.
- **Serves:** LF-SPINE, LF-OPENER, LF-ARC.
- **Evidence:** Texts that state a misconception, refute it and explain the correct idea beat standard texts (g = 0.41 over 44 comparisons, n = 3,869), consistently across contexts, though mostly for science misconceptions. A 22-author consensus report says a bare negation does not work: explain why the wrong belief was held, why it is wrong and why the alternative is right, repeat the wrong belief only once just before the correction, and keep the alternative no more complex than the myth.
- **Sources:** [Schroeder & Kucera (2022)](https://link.springer.com/article/10.1007/s10648-021-09656-z), [Lewandowsky, Cook & Ecker (2020)](https://cssn.org/wp-content/uploads/2020/10/DB2020paper-1.pdf)
- **Check:** X is a belief a typical beginner actually holds, in their own words, not a straw man. The field has a because-clause. Each tier says once why X feels true and why it fails. No tier, card or section ends on X.
- **Strength:** strong for refute-then-explain; applying it to life lessons is an extrapolation.

### 6. In every tier, open on the problem, widen it briefly, use the story as evidence, and state the lesson in general terms near the end.
- **Fields:** `breakdown.fastRead`, `breakdown.deepRead`, `breakdown.fullRead`.
- **Serves:** LF-ARC, LF-FAITHFUL, LF-INTEREST, LF-SIMPLE.
- **Evidence:** Stories are remembered better than expository text on average (g = 0.55, with high heterogeneity and some publication bias), but children aged 5-6 who only retold a story stated its lesson 13% of the time, against 34% when told the moral and 41% when asked to explain it. Teasing a gap and then closing it is enjoyed more than getting everything at once (7 studies), and expecting a distant answer makes not knowing feel worse. Problem-first teaching beat instruction-first on average (g = 0.36) in hands-on classroom studies, so for a reading summary only "present the problem first" carries over.
- **Sources:** [Mar et al. (2021)](https://link.springer.com/article/10.3758/s13423-020-01853-1), [Walker & Lombrozo (2017)](https://cognition.princeton.edu/sites/default/files/cognition/files/explaining_the_moral_of_the_story.pdf), [Ruan, Hsee & Lu (2018)](https://journals.sagepub.com/doi/10.1509/jmr.15.0346), [Noordewier & van Dijk (2017)](https://www.tandfonline.com/doi/full/10.1080/02699931.2015.1122577), [Sinha & Kapur (2021)](https://journals.sagepub.com/doi/10.3102/00346543211019105)
- **Check:** The lesson sentence sits in roughly the last fifth of the tier, is in present tense with no character names, makes sense to someone who never read the story, and matches `keyTakeaway`. One bridge sentence says how the story event shows the lesson. `fastRead` resolves too; the answer is never saved for a deeper tier. The problem part takes roughly the first third (a heuristic).
- **Strength:** moderate.

### 7. End each tier with the lesson settled; add at most one honest pointer to a related question the next chapter answers.
- **Fields:** the closing sentences of each `breakdown` tier.
- **Serves:** LF-INTEREST, LF-ARC.
- **Evidence:** A 2025 meta-analysis found no memory advantage for unfinished tasks (recall ratio 0.99 across 38 publications), so holding back the lesson buys no retention. Satisfying answers raised curiosity for later questions only when the new material was related (5,831 participants). Cliffhangers raised the wish for the next part of written stories (N = 202 and 273) but did not raise the intention to keep watching a TV drama (N = 133).
- **Sources:** [Ghibellini & Meier (2025)](https://www.nature.com/articles/s41599-025-05000-w), [Abir et al. (2026)](https://pubmed.ncbi.nlm.nih.gov/42030142/), [Cliffhangers and affective disposition (2023)](https://www.tandfonline.com/doi/abs/10.1080/15213269.2023.2219456), [Wirz, Ort, Rasch & Fahr (2023)](https://sonar.ch/global/documents/319990)
- **Check:** Write the pointer only when the next chapter's lesson is known, and never tease something that chapter does not deliver.
- **Strength:** moderate.

### 8. Use everyday words and short sentences that still connect, talk to "you", and explain any hard word you must keep where it first appears.
- **Fields:** all prose; above all the `breakdown` tiers, `examples`, `implementationPlan` and `memorableLines`.
- **Serves:** LF-PLAIN, LF-ARC.
- **Evidence:** Plain-language guides, taken together, ask for one idea per sentence, an average of 15-20 words, a split for anything over 25 words, and everyday words, and they warn that same-size paragraphs and strings of short sentences read as choppy. Readers with little background learn more from text that spells out how ideas connect, and a meta-analysis found text that talks to the reader improved retention (d = 0.30) and transfer (d = 0.54) in lessons under about 35 minutes. A government clarity standard gives a point only if unfamiliar terms are explained or described, not just defined, the first time they appear.
- **Sources:** [Federal Plain Language Guidelines (2011)](https://wid.org/wp-content/uploads/2022/03/FederalPLGuidelines.pdf), [NIH Clear Communication (archived)](https://webarchive.library.unt.edu/web/20130318055009mp_/http://www.nih.gov/clearcommunication/plainlanguage.htm), [GOV.UK: Use clear language](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/), [CMS Toolkit Part 7](https://montefioreeinstein.org/documents/ToolkitPart07.pdf), [McNamara et al. (1996)](https://experts.azregents.edu/en/publications/are-good-texts-always-better-interactions-of-text-coherence-backg/), [Ginns, Martin & Marsh (2013)](https://researchers.westernsydney.edu.au/en/publications/designing-instructional-text-in-a-conversational-style-a-meta-ana/), [CDC Clear Communication Index](https://www.cdc.gov/ccindex/pdf/full-index-score-sheet.pdf)
- **Check:** Average sentence 12-18 words, none over 25. No verbless fragments, and no run of three sentences under 6 words. Plain connectives (because, so, but, that is why). A book term that must stay is explained in the same or the next sentence in each field a reader can open alone, e.g. "temperance (not eating or drinking too much)".
- **Strength:** moderate (the numbers are conventions; the connective and "you" findings are experimental).

### 9. Check plainness with a readability screen and a cold reader who has not seen the book, never with the writer's own rating.
- **Fields:** all prose, `fastRead` first (a checker rule).
- **Serves:** LF-PLAIN, LF-SIMPLE.
- **Evidence:** In 2023, 28% of US adults read at Level 1 or below and only 44% at Level 3 or above (average score 258, down from 271 in 2017). Readability formulas count only word and sentence length, and writing to a grade target can make text choppy; in our own calibration, Flesch-Kincaid put the rejected summaries at grade 5-8 while missing the old-fashioned words the owner objected to. People who know more cannot fully set aside what they know when predicting what less-informed people will do, and incentives or feedback reduce the bias only partly.
- **Sources:** [NCES PIAAC 2023](https://nces.ed.gov/surveys/piaac/2023/national_results.asp), [CMS Toolkit Part 7](https://montefioreeinstein.org/documents/ToolkitPart07.pdf), [Camerer, Loewenstein & Weber (1989)](https://econpapers.repec.org/RePEc:ucp:jpolec:v:97:y:1989:i:5:p:1232-54), [Loewenstein, Moore & Weber (2006)](https://www.cmu.edu/dietrich/sds/docs/loewenstein/MisPerceivingInfo.pdf), [Sriram et al. (2026)](https://doi.org/10.1055/a-2794-9984), `docs/eval/calibration.md`
- **Check:** The writer prompt states the grade 6-8 target (in one study of one model writing health materials, such an instruction moved the median grade from 10.0 to 5.8 with no loss in quality). Flesch-Kincaid per tier is reported, and a flag is never cleared by chopping sentences. A cold-reader model gets only `fastRead`, restates the lesson (it must match `keyTakeaway`) and lists every word, name or reference it could not follow; any listed item fails LF-PLAIN. No source tests LLM writers, so the cold reader is our inference.
- **Strength:** moderate.

### 10. Write the three examples as short modern situations from three different parts of life that turn on the same lesson move, named in the same words.
- **Fields:** `examples[].scenario`, `examples[].whatToDo`, `examples[].whyItMatters` (and `title`).
- **Serves:** LF-EXAMPLES, LF-SPINE, LF-SIMPLE.
- **Evidence:** Adults who compared two cases sharing a negotiation principle used it later 48% of the time, against 19% for those who studied the same cases separately. A meta-analysis of 57 experiments found case comparison beat single or sequential cases (d = 0.50), more so when learners looked for the shared point and the principle came after the cases; with one story, stating the principle did little, while with two analogous cases it helped a lot. The gain comes from active comparing, so three examples read one after another are a weaker version.
- **Sources:** [Gentner, Loewenstein & Thompson (2003)](https://groups.psych.northwestern.edu/gentner/papers/GentnerLoewensteinThompson03.pdf), [Alfieri, Nokes-Malach & Schunn (2013)](https://eric.ed.gov/?id=EJ1000186), [Gick & Holyoak (1983)](https://www.causeweb.org/cause/research/literature/schema-induction-and-analogical-transfer)
- **Check:** Each scenario is two or three sentences about one moment. The three settings differ (e.g. work, home or relationships, money or health). `whatToDo` is the lesson's action for this person here; `whyItMatters` ties this outcome to the lesson using the shared key phrase. Any detail that does not change what the person should do is cut.
- **Strength:** strong.

### 11. Quiz questions put the reader in a new, modern situation and ask what to do or why; none can be answered from the story.
- **Fields:** `quiz.questions[].prompt`, `choices`, `explanation` (q1-q5 first).
- **Serves:** LF-QUIZ, LF-SPINE.
- **Evidence:** On a delayed test of higher-order questions, students who had practised with fact quizzes scored 46%, no better than restudying (44-49%), while those who had practised with higher-order quizzes scored 72%; the fact quizzes helped only on fact tests. A meta-analysis of 192 effects found practice tests transfer on average (d = 0.40), more often when practice and test answers match, retrieval is elaborated (for example with explanatory feedback) and learners get most items right; with none of these, the bias-corrected transfer is about zero. Practice testing is one of only two techniques, out of ten reviewed, rated high utility.
- **Sources:** [Agarwal (2019)](https://psycnet.apa.org/manuscript/2018-26228-001.pdf), [Pan & Rickard (2018)](https://sc-pan.github.io/pdf/PR_2018W.pdf), [Dunlosky et al. (2013)](https://www.whz.de/fileadmin/lehre/hochschuldidaktik/docs/dunloskiimprovingstudentlearning.pdf), [Butler (2018), WashU summary](https://source.washu.edu/2018/09/for-better-multiple-choice-tests-avoid-tricky-questions-study-finds/)
- **Check:** Flag any item whose answer needs a story name, date, place or event. At most one item asks the reader to recognise the lesson in new words. Each explanation names the part of the lesson the right choice uses and why the tempting wrong choice fails. A reader who finished the chapter should get about 4 of 5 (item-writing advice aims for about 80% passing). Fact retrieval with feedback has transferred in other studies, so the rule is "practise the use you want", not "facts never help".
- **Strength:** strong.

### 12. Make the most tempting wrong option the counterintuition's belief, use three plausible options with no clues, and screen each item with a solver that has not read the chapter.
- **Fields:** `quiz.questions[].choices`, `correctIndex`.
- **Serves:** LF-QUIZ.
- **Evidence:** Students answered SAT and Nelson-Denny reading items above chance with the passages removed, so multiple-choice items can measure plausibility rather than reading. Item-writing research finds three options optimal and advises plausible wrong options built from common errors, of similar length, with no clues such as absolutes or grammar mismatches. In middle-school science, a dominant misconception drew most wrong answers on items that had one (on one item 59% chose it and 17% answered correctly); using that to design distractors is a reasonable but untested step.
- **Sources:** [Katz et al. (1990)](https://api.crossref.org/works/10.1111/j.1467-9280.1990.tb00080.x), [Coleman et al. (2010)](https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:%2210.1177/0022219409345017%22&resultType=core&format=json), [Rodriguez (2005)](https://doi.org/10.1111/j.1745-3992.2005.00006.x), [Haladyna, Downing & Rodriguez (2002), UNM summary](https://cpl.health.unm.edu/AssetListing/Writing-Questions-for-Learning-and-Assessment-JiTL-2573/Rules-for-Multiple-Choice-Items-Haladyna-et-al-2002-5943), [Sadler & Sonnert (2016)](https://files.eric.ed.gov/fulltext/EJ1094278.pdf)
- **Check:** A pure guesser scores 3 or more of 5 about 21% of the time and 4 or more about 4.5%, so run the solver several times and track each item. Rewrite any item it answers from common sense. Strip tells: the longest option, the only hedged one, the only one using the chapter's words, the kindest-sounding one. Using a no-chapter solver as a gate is our inference from the passageless-reading studies.
- **Strength:** moderate.

### 13. Write each review card so it can be answered weeks later without the chapter.
- **Fields:** `reviewCards[].front`, `reviewCards[].back`.
- **Serves:** LF-CARDS, LF-PRACTICE.
- **Evidence:** In a study of more than 1,350 learners with tests up to a year later, the best review gap gave 64% more recall than no gap for the same study time (d = 1.1), and a gap that is too long costs much less than one that is too short. Spacing beat cramming for 90% of learners in a flashcard study, yet 72% believed cramming had worked better. Practice that asks for the use of an idea trains that use (principle 11).
- **Sources:** [Cepeda et al. (2008)](https://www.yorku.ca/ncepeda/publications/CVRWP2008.html), [Kornell (2009)](https://api.crossref.org/works/10.1002/acp.1537), [Agarwal (2019)](https://psycnet.apa.org/manuscript/2018-26228-001.pdf)
- **Check:** The front needs no character name or "in this chapter" to make sense; it is a short modern situation or a "why does this work?". The back is the lesson plus a one-line reason. At most one card asks the reader to state the lesson; the rest ask them to use it. These studies used facts and vocabulary; context-free card design itself was not tested.
- **Strength:** moderate.

### 14. `tryThisNow` is one small action for today; each if-then plan reads "If [a specific moment the reader will meet], then I will [one visible action from the lesson]".
- **Fields:** `tryThisNow`; `implementationPlan.coreSkill`, `implementationPlan.ifThenPlans[].context` and `.plan`, `twentyFourHourChallenge`, `weeklyPractice`.
- **Serves:** LF-TRY, LF-PRACTICE, LF-SPINE.
- **Evidence:** If-then plans raised goal attainment in a 2006 meta-analysis of 94 studies (d = .65); a 2025 meta-analysis of 642 tests found a smaller raw effect (d = .36, and .15 to .35 under different bias corrections), with if-then wording beating plain schedules (.43 vs .29), rehearsing the plan helping, and extra how or how-long detail nearly halving the effect compared with time-and-place cues. Delivered by document, mental contrasting plus if-then planning had a smaller effect than with live contact (g = .28 vs .47). In these studies people formed their own plans, so a plan written for the reader is a weaker version.
- **Sources:** [Gollwitzer & Sheeran (2006), NCI chapter](https://cancercontrol.cancer.gov/sites/default/files/2020-06/goal_intent_attain.pdf), [Sheeran, Listrom & Gollwitzer (2025)](https://kops.uni-konstanz.de/server/api/core/bitstreams/d703c468-46e9-47fc-8900-d32d7d19c8d9/content), [Wang, Wang & Gai (2021)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8149892/), [CDC Clear Communication Index](https://www.cdc.gov/ccindex/pdf/full-index-score-sheet.pdf) (items 13-14: say why the action matters, give specific how and when)
- **Check:** `tryThisNow` starts with a verb, names when or where, can be done today and gives one line on why; it never retells the story or states the moral. Cues are times, places or situations ("If I sit down after dinner and reach for my phone"), never "tomorrow" or "when I have time". Invite the reader to pick one plan and say it once. Promise no big results.
- **Strength:** moderate.

### 15. `memorableLines[0]` is the lesson as one general, present-tense sentence of 15 words or fewer, with no story names.
- **Fields:** `memorableLines[0]` (and `keyTakeaway`).
- **Serves:** LF-LINES, LF-SIMPLE.
- **Evidence:** Compared with lines from the same speaker and scene, memorable movie quotes were more general (fewer third-person pronouns in 64% of pairs, more indefinite articles in 57%, less past tense in 58%) and paired unusual words with ordinary sentence structure. Rhyme and mirrored wording make a saying seem truer, not more memorable, and that effect is small and did not replicate in every study.
- **Sources:** [Danescu-Niculescu-Mizil et al. (2012)](https://arxiv.org/pdf/1203.6360), [Rhyme-as-reason effect (overview)](https://en.wikipedia.org/wiki/Rhyme-as-reason_effect), [Kara-Yakoubian et al. (2022), PsyPost summary](https://psypost.org/2022/04/expressions-such-as-all-for-one-one-for-all-are-perceived-as-more-accurate-compared-to-paraphrases-that-break-the-a-b-b-a-pattern-62930)
- **Check:** The line means exactly what `keyTakeaway` means and passes the cold-reader test on its own. A parallel or contrast shape is fine; meaning is never bent for a rhyme.
- **Strength:** moderate for generality; weak for rhyme.

## What this rules out

- Interesting extras: outside trivia, statistics, celebrity facts or extra history added to the hook, tiers or examples to make them "interesting" (4).
- Story-recall quiz items and trivia cards, such as "What did young Franklin and his friends build with the stones?" (11, 13).
- Hooks that are a dated scene or a fact about the author's life with no problem in them, and vague teasers (2, 3).
- A bare "X is a myth" counterintuition, or any part that ends on the wrong belief (5).
- A tier that retells the story and never states the lesson in general terms, or that saves the lesson for a deeper tier or the next chapter (6, 7).
- Chopping sentences or swapping in short words just to pass a readability score; asking the writer to rate its own plainness (8, 9).
- Long examples that share one setting or teach a side point (10).
- Quiz options with tells: one long, hedged or chapter-worded option (12).
- `tryThisNow` as a summary or moral; if-then cues like "tomorrow" or "when I have time" (14).
- Bending a memorable line's meaning to get a rhyme (15).

## Contested or weak

- **Curiosity triggers.** The theory lists five triggers (the fifth is forgotten knowledge), not four, and never tested them as openers, so "reliably creates curiosity" was dropped. The inverted-U link between curiosity and confidence comes from one small trivia study (19 people scanned).
- **Curiosity spillover.** Curiosity gives only a small boost to unrelated material shown right after the question (it lasted a day in one study), and its overall learning boost is small once prior knowledge is counted. Principle 2 relies only on the boost for the specific answer.
- **Question openers.** Older small field tests found question headlines got more clicks; a large 2026 paper found the reverse. All of this is click data, so principle 3 is weak and its "minority" rule is a heuristic.
- **Why seductive details hurt.** "They make readers build understanding around the wrong thing" was an early, tentative idea; newer work points to extra load and diversion. A 2026 study found such details can raise interest, and marking them as a separate topic offset the transfer cost. Applying the deletion test to every sentence goes beyond this evidence.
- **Commit-then-correct.** Making a prediction raised curiosity but did not improve memory compared with generating an example (N = 29), so "Which would you pick?" prompts are optional, not required.
- **Problem-first reversals.** The reversals were small and came from tasks like water-jug puzzles, not habits or time use. The "first third" limit is a heuristic.
- **Zeigarnik and cliffhangers.** No memory gain from unfinished tasks; cliffhanger effects are mixed.
- **Lesson up front or at the end.** The clarity standard wants the main message in the first section; two single studies of news stories lean toward building up, with mixed results. Our compromise is untested: `counterintuition`, which the reader sees first, names the correct idea briefly, and each tier builds to the full lesson at its end.
- **Stories and morals.** The "readers rarely pull out the lesson" evidence comes from 5-6 year-olds (who still picked the right theme above chance). The adult evidence on surface-bound recall comes from maths problems.
- **Prompts to explain or reflect.** They helped children pull out morals but made maths worked examples worse in one meta-analysis, so there are no default "reflect" prompts.
- **Signaling everywhere.** Signaling works best used sparingly; restating the whole lesson in every explanation and card is unsupported, hence "key phrase" only.
- **Misconception distractors and the no-chapter solver.** Both are inferences (from a study of teacher knowledge and from passageless-reading studies), not tested designs.
- **Implementation intentions.** The effect shrinks in newer meta-analyses (from d = .65 to .36 raw, .15 to .35 corrected) and with text-only delivery.
- **Readability numbers.** The corrected PIAAC averages are 258 (2023) and 271 (2017). "LLM drafts land near grade 10" rests on one study of one model. The 14-word / 43-word sentence-comprehension figures and the song-tapping anecdote are unpublished and are not used.
- **Usefulness and the "you" style.** The usefulness finding is one short online study, and the usefulness shown was to health and society, not to the reader personally. The "you" style improved learning, not interest ratings.
- **Rhyme and mirrored wording.** They affect perceived truth, not memory, and the effect is small and inconsistent.
- **Dropped.** A teacher's "mystery" lesson structure (the cited profile did not describe it and the original essay was not read), and product conventions such as "one big idea per section" (self-descriptions, not evidence).
- **Not covered.** No angle studied LF-FAITHFUL, and no study tested openers in book-summary or microlearning apps.

## How the eval uses this

Most principles map onto items that already exist in `docs/eval/judge.md`; this doc supplies the tests behind them. Principle 1 is SPINE plus the judge's Step 1 `lesson` / `singleLesson`. Principles 2 and 3 are OPENER-hook and OPENER-<tier>; the proposed sharpening is that the hook's implied question must be answered by the judge's stated lesson, and that a dated scene, a fact about the author or a trivia opener fails. Principle 4 feeds OPENER and SPINE (an off-lesson fact fails). Principle 5 is COUNTER; the proposed sharpening is to require a because-clause and the correct idea and to fail a bare negation. Principle 6 is ARC-<tier>, 7 is END-<tier>, 8 is PLAIN-summary and PLAIN-rest, 10 is EX-<ex> and EXFIT-<ex>, 11 is QUIZ-<q>, 13 is CARD-<rc>, 14 is TRY and PRACTICE, and 15 is LINES-1. Two principles are mechanical checks rather than judge items: 9 (the Flesch-Kincaid band from `runner/readability.py`, plus a proposed cold-reader check on `fastRead`) and 12 (the no-chapter solver in `nochapter-solver.md`, run several times with results kept per item; 4 or more of 5 fails). The book-level rules (rotating hook forms, keeping question-first hooks a minority) need a count across chapters, not a per-chapter judge. None of these checks shows that a hook raises completion or that a quiz predicts real use. An in-app test of hook styles (concrete scene vs question vs surprising contrast), measured on completion and quiz scores, would close that gap.
