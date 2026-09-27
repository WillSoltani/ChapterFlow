# Scan lens: what the app actually shows a user

Investigator: app-render lens · 2026-09-27 · repo `origin/main 22e021d` · read-only, 0 model calls.
Scratch scripts: `/tmp/claude-0/-home-user-ChapterFlow/48916df7-45f9-50d8-ad9d-e43b21e61800/scratchpad/scan/app-render/{visible.py,minimal.mts}`.

## keyFacts

- **A new user reads only `fastRead`.** `activeDepth = defaultToFastPath ? "simple" : modeToDepth(learningMode)` (`ChapterReaderClient.tsx:144`), `defaultToFastPath = bookPrefsHydrated && !profileCustomized` (`useReaderSettings.ts:31`), default `profileCustomized: false` (`app/book/settings/constants/defaults.ts:59`). The "simple" depth resolves to the `easy` variant (`app/book/data/bookChapters.ts:205`), and the adapter fills that from `breakdown.fastRead` (`app/book/lib/v21-adapter.ts:246`). VERIFIED.
- **In the catalog, `fastRead` has a median of 94 words per chapter (range 56 to 215).** That is 11.5% of the words in the three tiers. The header still says "12 min read" (median `readingTimeMinutes`). `deepRead` and `fullRead` never render in default mode. VERIFIED (`visible.py` over 140 books and 1,903 chapters).
- **A default user sees about a third of the words authored for a chapter.** The median is 32% (p10 30%, p90 34%). About 24% of what they do see is book prose. The rest is quiz (5 questions, median 306 words), the implementation plan (median 178), one example (median 120) and cards. For Radical Candor ch1 it is 972 of 2,703 words (36%), and the prose is 191 of those 972.
- **The full telling is reachable only through "Challenge" mode.** Challenge also brings a 10-question quiz, a "no retries on the quiz" banner, and a rule that the reader must react to every scenario. "Standard" shows as selected but clicking it does nothing (`ChapterReaderClient.tsx:262`). Picking a reading profile in /book/settings, even "Deep", resets the reader to the fast path (`BookSettingsClient.tsx:429`). Changing an unrelated setting (daily goal, motivation, streak mode) silently moves the reader to `deepRead` (`BookSettingsClient.tsx:458,468,477`). VERIFIED.
- **Memorable lines render twice on the Summary screen.** They appear once as an unquoted, numbered "Key Takeaways" list (`v21-adapter.ts:134-139` → `SummaryCard.tsx:149-242`) and again, in quotes, as "Lines worth keeping" (`ReaderPhaseContent.tsx:158-160`). The `why` and `location` fields are never rendered. VERIFIED.
- **Paragraphs split only on blank lines, and `cleanText` turns any single newline into a space** (`bookChapters.ts:116`). Splitting on single newlines would change nothing today: 0 of 1,903 catalog fullReads rely on single newlines, and the rr21 walls contain no newlines at all (`verify-accuracy-content.md:84`). Walls of text reach only users who have left default mode. VERIFIED.
- **The quiz can test facts the default reader never saw.** In the Opus probe, q4 asks what became of Uncle Benjamin's shorthand. The answer ("never practised … forgotten") is in deepRead and fullRead, not in fastRead. Default users get questions 1-5 (`quiz-session.ts:137-138`, fast-path count 5 at `learning-mode.ts:101`). VERIFIED.
- **The app validator hardly constrains a v21 chapter.** A chapter with only three non-empty tiers passes: no title, examples, quiz, cards or plan. It must have `fastRead`, `deepRead` and `fullRead` non-empty; unique chapter numbers (positive integers) and ids; `passingScorePercent` between 50 and 100; and every question needs an integer `correctIndex` that is in range. It sets no counts and no length limits. VERIFIED by running the real validator on 8 minimal packages (see §4).
- **Two of the three authored tiers are invisible by default,** yet 32 of the last 46 reader-panel blockers were about tiers standing alone or contradicting each other (`reader-quality.md:14,193`). The pipeline spent its repair effort on a property the product's default does not show. VERIFIED (doc) plus INFERRED (implication).

## 1. Route and data path (production)

1. `app/book/library/[bookId]/chapter/[chapterId]/page.tsx:12-35` calls `getPublishedLibraryBookDetail`. That reads the DynamoDB catalog row (it must be `PUBLISHED` with `currentPublishedVersion`), the S3 library index and the S3 manifest for the version (`library-catalog.ts:158-166`). `loadInitialChapterContent` server-hydrates the chapter's content for an entitled, started and unlocked viewer (`page.tsx:52-57`).
2. Chapter content comes from `GET /api/book/books/[bookId]/chapters/[n]`. The API returns **all** `contentVariants` (`route.ts:65-71`). The client rebuilds a raw-v21 chapter from the adapted v13 shape (`lib/chapterFromApi.ts:136-180`) and runs it through `normalizeV21Package` and then `buildBundle`, the same path the local bundle uses.
3. The quiz is read first from the **raw authored package** in S3 at `book-content/packages/<bookId>.v21.json` (`book-package-source.ts:24-26`, `content-service.ts:281-321`, quiz `route.ts:95-113`). Only if that is missing does it fall back to the published S3 quiz. The raw package is cached for the life of a warm Lambda (`book-package-source.ts:28-35`), so re-uploading it without a redeploy could keep serving a stale quiz (INFERRED).
4. In dev (`npm run dev`), the reader always falls back to the statically bundled `book-packages/*.v21.json` (`lib/fallbackPolicy.ts`, `bookPackages.ts` imports, auto-registered by publish-final at `bookPackages.ts:2081`). Production never falls back. **This is the cheapest way for the owner to see a prototype in the real UI.**

## 2. The default mode and how a user changes it

| Setting | Default | Source |
|---|---|---|
| `learningMode` | `"standard"` | `defaults.ts:22` |
| `profileCustomized` | `false`, so the fast path is on | `defaults.ts:59`; onboarding seeding never sets it (`useBookPreferences.ts:845-880`) |
| active depth | `"simple"` → `easy` → `fastRead` | `ChapterReaderClient.tsx:144`, `bookChapters.ts:205` |
| start tab | Summary | `useBookPreferences.ts:162`, `onboarding-personalization.ts:52-56` |
| example filter | "all" | `hooks/book/useOnboardingState.ts:132` |
| quiz | 5 questions, one at a time, retry incorrect only | `learning-mode.ts:101`, `useBookPreferences.ts:181-186` |

How to change it: open the reader's gear menu, then "Reading settings", then "Mode" (`ReaderSettingsMenu.tsx:10-36`). The options are Guided ("More guidance and pacing support"), Standard ("Balanced pacing and feedback", marked recommended and **already selected**) and Challenge ("Faster pace with fewer interruptions"). None of these labels says "longer text". Clicking Guided keeps `fastRead`. Clicking Challenge gives `fullRead`. Clicking Standard returns early because `mode === learningMode` (`ChapterReaderClient.tsx:262`), so a user can reach `deepRead` only by going to Guided first and then Standard. The first-chapter coachmark does promise the control: "Pick Guided, Standard, or Challenge in Reading settings to set how much detail you get" (`ReaderChrome.tsx:192-194`).

Traps (all VERIFIED):
- **Settings page:** `handleProfileChange` writes `profileCustomized: false` (`BookSettingsClient.tsx:419-434`). A user who picks the "Deep" profile gets `learningMode: challenge` but still reads `fastRead`.
- **Side effect:** changing daily goal, motivation persona or streak mode writes `profileCustomized: true` (`BookSettingsClient.tsx:458,468,477`). That quietly moves a Standard user from `fastRead` to `deepRead` and from a 5-question quiz to a 7-question one (`resolveStrictQuizQuestionCount`, `learning-mode.ts:141-150`).
- **Coupling:** reading depth, quiz length (5/7/10, `lib/quiz-question-counts.ts`), the no-retry banner (`SummaryCard.tsx:114-122`) and the scenario gate (`reader-flow-core.ts:64-69`) all hang off one Mode control. Nobody can get the full text without also taking the hard quiz.
- **Hydration swap (INFERRED, not seen in a browser):** before preferences hydrate, `bookPrefsHydrated=false` makes `activeDepth` equal `modeToDepth("standard")`, which is `deepRead` (`useBookPreferences.ts:805`). The server-rendered page therefore shows `deepRead`, then shrinks to `fastRead` on hydration (the motion key is `summary-${activeDepth}`, `ReaderPhaseContent.tsx:121`).

## 3. Walkthrough: new user, default mode, Radical Candor ch1

Radical Candor is one of the six v24 author-first books that reached the app on 2026-07-10 (`packageId radical-candor-v21-1783672528768`) and scored 81.5 PASS in July (`docs/v24/CATALOG_QUALITY_AUDIT.md:93`). Word counts come from `visible.py`.

**Screen 1: Summary** (`ReaderChrome.tsx` + `ReaderPhaseContent.tsx:119-170`). Roughly 190 unique authored words, 215 as rendered.
1. Header: "RADICAL CANDOR · KIM SCOTT", H1 "Chapter 1: Build Radically Candid Relationships", "7 min read". A floating audio button reads the same `easy` variant (`ReaderChrome.tsx:114-120`).
2. Hook banner, which collapses to one sticky line on scroll (`HookBanner.tsx:49-66`). Hook and counterintuition, 39 words: *"The advice was right. Everyone agreed, but the person who needed it heard blame."* / *"Care does not slow candor; it gives candor somewhere to land…"*
3. Phase stepper (Summary · Examples · Quiz · Practice). A first-visit coachmark (about 45 words). "Take a moment with this section — Continue unlocks once you've read it."
4. **The chapter body is `fastRead`, 107 words in 3 paragraphs, and this is the whole of the book's prose for chapter 1:**
   > The advice can be right and still miss. A person leaves with the standard in their ears and no reason to hear it as help.
   > Kim Scott, a former Google executive tied to Google AdSense, gives the idea its live setting. Her later Apple role adds another place where the count matters. This is not nicer wording: has the other person seen that you know they are more than output?
   > Radical Candor joins Care Personally, seeing the whole person, with Challenge Directly, naming strong output and output that falls short. Count the care before the challenge. Then offer the view as a view, not as owned truth.
5. "KEY TAKEAWAYS" 1-3: the three memorable lines (24 words), with bookmark icons. Then "Save takeaways to notes".
6. "TRY THIS NOW" callout (21 words): *"Count one current conversation: write the number of visible care signals…"*
7. "LINES WORTH KEEPING": the **same three lines again**, now in quotes, each with a copy button.
8. "Continue to Examples", which unlocks at 90% scroll or after 30 s (`usePhaseCompletion.ts:40-45`).

**Interstitial** (about 0.9 s): "Now let's see this in action".

**Screen 2: Examples** (`ExamplesList.tsx`). About 215 words.
1. "Real-world examples", "+ Add a Scenario +N IP", filter pills All/Work/School/Personal, "1 of 4".
2. **Only example 1** is shown (`DEFAULT_VISIBLE_EXAMPLES = 1`, `ExamplesList.tsx:20`): "After the Miss", 122 words. In simple depth there is no "Pause and predict" gate (`:116`). Its scenario reads: *"No private hallway scene exists to replay, so treat the miss as a thought experiment, not a biography."* That is pipeline rule-speak shown to the reader.
3. "Show 3 more examples" hides 333 words.
4. "APPLY THIS WEEK": the three if-then `plan` texts (about 93 words) and a 3-day or 7-day check-in (`ReaderPhaseContent.tsx:214-229`).
5. "Start the Quiz", which unlocks at 90% scroll or after 10 s.

**Interstitial**: "Ready to test your understanding?"

**Screen 3: Quiz** (`QuizPanel.tsx`). Questions 1-5 of 9, one at a time: 390 words of stems and choices. All five are invented workplace scenarios ("Your release note says the partner was wrong…"). The explanation always shows after a wrong answer; after a right one it sits behind "Show explanation" (137 words in total). The pass mark is 70%, so 4 of 5. Passing is what unlocks the next chapter.

**Screen 4: Chapter-complete modal**, with Practice inside it (`ReaderOverlays.tsx:176-240`, `PracticePhase.tsx`). About 270 unique words, around 450 as rendered.
1. Confetti, score, the Insight-Points ledger (collapsed), achievements.
2. "✨ You've earned this. Lock it in." Then "THE ONE TAKEAWAY": `keyTakeaway`, 26 words. This is the first time it appears.
3. "Implementation Plan", expanded by default: core skill, 3 if-then plans with context, a 24-hour challenge and weekly practice (187 words).
4. "Commit to your steps": the same 3 plans again. "Apply This Week": the same 3 plans a fourth time across the flow, or "Committed" if already done.
5. Review cards: 6 fronts (56 words); the backs (150 words) show on tap.
6. "Continue to Chapter 2 →" and Share.

What the user saw of the chapter's ideas: 191 words of prose (hook, counterintuition, fastRead, lines, try-this) against about 780 words of quiz, worksheet and example. What they never saw: `deepRead` (280), `fullRead` (466, the only tier that lays out the four-quadrant compass), quiz questions 6-9 (365), and examples 2-4 unless they tapped.

## 4. What reaches the user, measured

| | Default-visible | Tap-to-reveal | Never in default mode |
|---|---|---|---|
| Radical Candor ch1 (2,703 w) | 972 (36%) | 620 (23%) | 1,111 (41%): deep 280, full 466, q6-9 365 |
| Franklin rev-6 Part One (5,078 w) | 1,712 (34%) | 1,714 (34%) | 1,652 (33%): deep 354, full 570, q6-9 728 |
| Opus probe ch01 (3,842 w) | 1,179 (31%) | 631 (16%) | 2,032 (53%): deep 492, **full 1,432**, q6 108 |
| Catalog, 1,903 chapters | median 32% | | fullRead alone is a median 18% of authored words |

Tap-to-reveal covers examples after the first, quiz explanations and card backs. Never shown, in any mode: `memorableLines[].why/location` (there is no renderer for them) and the PatternSelector. The PatternSelector needs `NEXT_PUBLIC_BOOK_ENABLE_PATTERN_SELECTOR`, which is set nowhere in the repo (`useReaderExamples.ts:138-140`). v21 books also leave the SummaryCard's "Reflect", "In one minute" and "Before you read" slots empty, because v21 has no `oneMinuteRecap`, `selfCheckPrompts` or `activationPrompt` fields.

**Franklin, read in default mode:** rev 6 gives a reader 117 + 99 + 155 + 151 = **522 words of Franklin for the whole book**, in sentences like *"Franklin grew up in Boston. He loved books more than school."* The Opus probe's default tier is better (164 words, 2 quotes). Its 1,432-word fullRead, which holds 20 Franklin quotations, is exactly the part a default user never sees. **If the owner judges the P1 prototype in the app's default mode, they will be judging the wrong 164 words.**

## 5. Walls of text and memorable lines

- Paragraphs split on `/\n\n+/` in both adapters (client `v21-adapter.ts:115-122`, server `v21-adapter.ts:76`). `cleanText` then turns every whitespace run into one space (`bookChapters.ts:116`), so a single newline can never make a paragraph. Examples, quiz and cards render as one block per field.
- Catalog: 388 of 1,903 fastReads are one paragraph, which is harmless at a 94-word median. 47 deepReads and 45 fullReads are one paragraph. 66 chapters have a fullRead paragraph over 200 words, the longest 537. **None has single-newline breaks to recover.** rr21 has zero newlines in 19 of 19 fastReads, 11 of 19 deepReads and 8 of 19 fullReads, with full reads up to 774 words (`verify-accuracy-content.md:28,84`). A default user sees none of those walls. Standard and Challenge users see each one as a single `<p>`.
- Memorable lines are rendered as the **"Key Takeaways" numbered list**, with no quote marks and no attribution, and then again as quoted "Lines worth keeping" a few inches lower. For a memoir this mislabels Franklin's own sentences as the app's takeaways. The duplication exists in both adapters (server `v21-adapter.ts:80,83-86` also writes `takeaways`/`keyTakeaways`).
- Markdown: no `**`, bullet or heading artifacts were found in any breakdown in the catalog. Paragraph text renders raw; only bullets pass through `stripMarkdownBold` (`SummaryCard.tsx:10-12,189`).

## 6. What the app validator requires of a v21 chapter

`validateBookPackage` dispatches v21 to `adaptV21ToV13`. It then runs only `enforceSemanticRules` and `enforceV21QuizFieldRules` (`validate-book-package.ts:1293-1305`) and never the v13 field parser. The exact rules:

- Root: a JSON object with `schemaVersion === "chapterflow-v21-authored"`. `packageId`, `createdAt` and `contentOwner` are defaulted (`v21-adapter.ts:379-392`). `book.*` is coerced, with no required fields.
- Per chapter:
  - `chapterId` unique (defaults to `ch-<number>`).
  - `number` unique and an integer ≥ 1 (`:1231-1236`).
  - **`breakdown.fastRead`, `deepRead` and `fullRead` must all be non-empty strings**, which become exactly the `easy`, `medium` and `hard` variants (`:1169-1184`, adapter `:281-283`).
  - `quiz.passingScorePercent` between 50 and 100, defaulting to 70.
  - Every question needs an integer `correctIndex`, within `[0, choices.length)` whenever `choices` is non-empty (`:1245-1266`).
  - `questionId` unique (defaults to `q-<i>`). `exampleId` unique (defaults to `ex-<i>`).
- **Not checked:** title, hook, any count (examples, questions, choices, cards, plans, lines), any length, `explanation`, `tags`, `difficulty`, `bloomsLevel`.

I ran the real validator (`tsx minimal.mts`):

| Package | Result |
|---|---|
| Three tiers only: no title, examples, quiz, cards or plan | ACCEPTED |
| No `fullRead` | REJECTED: missing variant `hard` |
| Question with no `correctIndex` | REJECTED |
| `correctIndex` 2 with 2 choices | REJECTED: out of range |
| 20,000-word fastRead, one-choice question, an example with empty fields | ACCEPTED |
| `passingScorePercent` 40 | REJECTED |
| Duplicate chapter numbers | REJECTED |
| `number: 0` | REJECTED |

Practical constraints beyond the validator, which Wave 1 must also meet:
- At least 1 quiz question, or the chapter can never be completed. Submit rejects an empty `responses` array (`quiz-submit-service.ts:116`, INFERRED consequence).
- Default users get questions 1-5, Standard users 1-7, Challenge users 1-10.
- Titles must not all be bare labels like "Part III" or "Chapter 3" (`book-packages-title-quality.test.ts:17`). "Part One" slips through the regex.
- Example scope comes from tags "work", "school" or "personal". Otherwise it is a keyword guess (`bookChapters.ts:386-405`). This is harmless under the default "all" filter.
- To publish, the package goes to root `book-packages/<id>.v21.json`, publish-final auto-registers it, the raw package is uploaded to S3 for the quiz, and it is ingested to a versioned manifest.

## 7. Implications for a reader-first chapter format

1. **Make the full telling the default body.** Today the product's default is a roughly 100-word abstract wrapped in a quiz and a worksheet. A whole-chapter writer (diagnosis 1 and 6, P1) produces value only if the app shows its main text. Otherwise the owner and users read the fastRead.
2. **Cut to two prose tiers: the telling, plus a short recap.** SummaryCard already has an "In one minute" recap slot (`SummaryCard.tsx:261-276`) that v21 leaves empty. `fastRead` could render there, below the telling. `deepRead` has no job a reader needs. The validator does insist on a non-empty `medium`, so either fill it at assembly with a copy of another tier (the validator accepts that) or relax `:1169-1184`.
3. **Write the quiz against the tier the reader actually reads.** Put 3 or more story questions in q1-5. 6 questions is enough, since a default reader sees 5.
4. **Show each memorable line once, as an attributed verbatim quote.** Drop the "Key Takeaways" copy.
5. **Examples and plans:** 1-3 examples (only 1 is shown by default) and 2 if-then plans (today they are rendered up to 4 times). Whether invented modern scenarios belong in a memoir at all is an owner product call.
6. **Paragraphs are the writer's job.** Require `\n\n` between paragraphs of 40-150 words; the probe did this unprompted (10 paragraphs). If needed, add a fallback that auto-paragraphs any block over about 180 words at sentence boundaries, in both adapters.

Cheap app changes, sized from the code:

| Change | Where | Size |
|---|---|---|
| Default to the full telling: `"deeper"` instead of `"simple"` on the fast path, or drop the fast path | `ChapterReaderClient.tsx:144`; mirror the quiz count at `learning-mode.ts:101`; update the pin in `ChapterReaderClient.contract.test.ts:13,50-59` | about 3 lines + 1 test |
| Decouple reading depth from quiz difficulty: a separate "Text: full / short" toggle | `ReaderSettingsMenu.tsx`, `ChapterReaderClient.tsx:261-288` | small |
| Fix the Standard no-op, the settings profile reset and the side effects of goal/persona/streak | `ChapterReaderClient.tsx:262`, `BookSettingsClient.tsx:429,458,468,477` | a few lines |
| Stop adding memorable lines as bullets, or render them only once | client `v21-adapter.ts:134-139`, server `:80,83-86` (or `ReaderPhaseContent.tsx:158-160`) | a few lines |
| Render `fastRead` as the "In one minute" recap under the telling | `bookChapters.ts` recap mapping, `ReaderPhaseContent.tsx:107` | small |
| Show the length of the displayed tier in "N min read" | `ChapterHeader.tsx:430` | small |
| Split on single newlines | both adapters | **no effect on current content**; not worth doing alone |

## 8. Verdict on the prior diagnosis (this lens)

1. Assembled, not written: **REFINED.** The app assembles the chapter too: a hook banner, a roughly 100-word abstract, a takeaway list, a callout, one example, a quiz and a worksheet. A well-written whole chapter would still be hidden unless the default changes.
2. Rules create problems: **CONFIRMED in the user-visible text.** Example: *"treat the miss as a thought experiment, not a biography"*, in a July PASS book. The tier stand-alone rules policed tiers that the default hides.
3. Format fights a memoir: **CONFIRMED and quantified.** Prose is about 24% of what a default user sees. Rev 6 gives 522 words of Franklin for the whole book. The full telling is gated behind "Challenge".
4. Broken compass: **CONFIRMED and extended.** Panels, graders and every earlier report judged all three tiers, and none of them noted that users see `fastRead`. Walls counted in fullRead never reach a default user.
5. Accuracy upstream: this lens neither confirms nor refutes it. It does add an experience-accuracy problem: quiz facts that are not in the tier being read (probe q4).
6. Over-engineered around the writing: **CONFIRMED on the app side as well.** The flow has 4 phases, an IP economy, commitments shown up to 4 times, and 3 depth gates coupled to quiz size.

## Adversarial verification

Verifier re-ran every count with its own scripts (`scratchpad/scan/verify-app-render/{tiers,prose,prose2,minimal}.*`, 0 model calls) and re-read each cited line at 22e021d.

- **AR1: CONFIRMED.** `ChapterReaderClient.tsx:144`, `useReaderSettings.ts:31`, `defaults.ts:59`, `bookChapters.ts:205`, `v21-adapter.ts:246-248` and `ReaderPhaseContent.tsx:105` all read as quoted, and the server fast path is 5 questions (`learning-mode.ts:101,143-150`). bookPrefs hydrate from localStorage in a mount effect (`useBookPreferences.ts:818-886`), so there is no meaningful pre-hydration deepRead flash.
- **AR2: PARTIAL.** These reproduce: 1,903 chapters in 140 books, fastRead median 94 (56-215), fastRead 11.5% of the three tiers, fullRead 17-18% of chapter words, readingTimeMinutes median 12, default-visible share 0.32 (0.30-0.34), Radical Candor ch1 972/2,703 with "prose" 191, and Franklin rev-6 fastReads 117/99/155/151. "Prose is about a quarter" does not reproduce. By the report's own broad definition (hook, counterintuition, fastRead, lines, try-this), prose is a median of 21% of visible words (20.9% in aggregate). The fastRead body alone is 10%.
- **AR3: PARTIAL.** The mechanics hold: the `mode === learningMode` early return at :262, Standard marked recommended, `handleProfileChange` writing `profileCustomized:false`, persona/goal/streak writing `true`, the banner, the every-scenario rule and the 5/7/10 counts. Retries are 2/1/0 (`flow-points-economy.ts:113`). Correction: a settings side-effect moves the reader to `modeToDepth(learningMode)`. That is deepRead with 7 questions only for a user still on `standard`. A user who picked the Deep profile moves to fullRead with 10.
- **AR4: CONFIRMED.** Re-ran the validator and got identical results for cases 1-8. It also ACCEPTS three identical tiers ("same"/"same"/"same") and a package with zero chapters. The zero-chapter case is caught later by the publish gate (`publish-bundled-packages.ts:154`). Empty-string tiers are REJECTED.
- **AR5: CONFIRMED, and stronger than stated.** The probe's fastRead (164 words) has no "never", "forgot" or "vanity". So q4 (shorthand) and also q3 ("How does Franklin treat his own vanity") are not answerable from the tier a default user reads. q1-q3 and q5 do overlap with fastRead. `quiz-session.ts:137-138` slices before it shuffles, so the default user always gets the authored q1-q5.
- **AR6: CONFIRMED.** The probe measures fastRead 164, deepRead 492 and fullRead 1,432 words, with 2, 8 and 20 quoted spans. never-in-default is 53%, and the brief line is at `brief-ch01.md:12`. Nuance: a few of the 20 spans quote others that Franklin cites (the libeller verse, the acrostic), not Franklin's own sentences.

**Missed (most important within lens): mode rules and mode content are keyed to different variables.** Content and quiz size key off `activeDepth` (fast path while `profileCustomized` is false). The banner, retries, per-mode scenario rule and phase thresholds key off `learningMode` (`SummaryCard.tsx:114`, `QuizPanel.tsx:628`, `useReaderPhaseFlow.ts:62`, `ReaderChrome.tsx:218`). Two kinds of user end up with `learningMode: challenge` and `profileCustomized: false`: one who chose "deep" in onboarding (seeded at `useBookPreferences.ts:856-862`) and one who picked the Deep profile in Settings. That user gets Challenge's penalties on fastRead: 0 retries, must react to every scenario, and the "no retries" banner, all on a 5-question quiz. The reader menu shows Challenge as selected, and clicking it is a no-op (`ChapterReaderClient.tsx:262`). Their only route to fullRead is to click another mode and then Challenge again. The report says a Deep-profile user "still reads fastRead" (line 39) but not that they also get Challenge's penalties, or that the Challenge button does nothing for them.
