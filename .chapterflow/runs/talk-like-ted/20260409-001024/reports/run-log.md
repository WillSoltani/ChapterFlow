# Run Log

## Phase 0 Preflight

- Title: Talk Like TED: The 9 Public-Speaking Secrets of the World's Top Minds
- Author: Carmine Gallo
- Edition preference: ask_if_ambiguous
- bookId: talk-like-ted
- runId: 20260409-001024
- outputProfile: flagship_v4_compatible
- learningContract: research_native
- runProfile: balanced_flagship
- validationMode: chapter_gate
- chapterGateMode: automatic_continue
- chapterGateQuizMode: generate
- scenarioTonePolicy: required
- sourceDiscoveryMode: web_bundle
- editionSelectionMode: ask_if_ambiguous
- sourcePolicy: public_or_authorized_plus_secondary
- forbidBulkGenerators: true
- releaseAssembleFromValidatedOnly: true
- preserveApprovedChapterHashes: true

Manifest repair applied:
- normalized malformed title and author fields from launch input
- restored `editionSelectionMode` and `bookRequest.editionPreference` to `ask_if_ambiguous`
- locked the run to the dominant 2014 St. Martin's Press edition pending source freeze

Phase 0 complete.

## Phase 1 Source Discovery And Freeze

Locked source bundle:
- authorized Macmillan / St. Martin's product page with excerpt for Chapter 1
- Google Books metadata and preview landing page
- UNT catalog record for stable table of contents
- Carmine Gallo official book page for title and market positioning
- SuperSummary introduction and part summaries as secondary chapter-level support

Edition decision:
- auto-lock to the 2014 St. Martin's Press first edition
- no user clarification required because later printings do not materially alter the nine-chapter structure used for this run

Phase 1 complete.

## Phase 4 Chapter 1

Pre-writer artifacts created:
- briefs/ch01.md
- outlines/ch01.md
- quiz-blueprints/ch01.md
- sidecars/source/ch01.source.txt
- sidecars/source/ch01.source.json

Writer -> editor -> critic completed.

Validation notes:
- chapter-gate lint passed
- review package and validated chapter regenerated after a local word-count repair in the structured chapter
- Chapter 1 continuity hash sealed: `7c49518b498d45f3186b2294dc13ea63eac9b7b65e4796332f05648a353cff5f`

## Phase 5 Chapter 2 In Progress

Pre-writer artifacts created:
- briefs/ch02.md
- outlines/ch02.md
- quiz-blueprints/ch02.md
- sidecars/source/ch02.source.txt
- sidecars/source/ch02.source.json

Writer -> editor -> critic completed.

Current state:
- Chapter 2 prose approved for conversion
- structured, quiz, validation, and seal still pending

## Phase 5 Chapter 2 Complete

Validation notes:
- structured chapter repaired locally for EMH word-floor compliance before validation
- chapter-gate lint passed
- quiz, validated chapter, review package, reading metrics, and continuity artifacts regenerated from the corrected structured source
- review-package wrapper match confirmed
- Chapter 2 continuity hash sealed: `932137d518eba141a75ed7e94bbcd3bbfe13d328472e9d7a8723893f957ae2dc`

Baseline floor:
- reports/baseline-quality.md written from Chapters 1 and 2
- Chapter 1 and Chapter 2 now establish the reference quality floor for later waves

Wave status:
- Wave 1 (Chapters 1-2) ready for repo artifact guard

## Phase 6 Wave 2 Opened

Chapter 3 pre-writer artifacts created:
- briefs/ch03.md
- outlines/ch03.md
- quiz-blueprints/ch03.md
- sidecars/source/ch03.source.txt
- sidecars/source/ch03.source.json

Chapter 3 writer -> editor -> critic completed:
- drafts/canonical/ch03.md
- drafts/edited/ch03.md
- reports/ch03.critic.md

Current state:
- Chapter 3 prose approved for conversion
- structured, quiz, validation, and seal still pending

## Phase 6 Chapter 3 Complete

Validation notes:
- structured chapter repaired locally for EMH word-floor and ceiling compliance before validation
- chapter-gate lint passed
- quiz, validated chapter, review package, reading metrics, and continuity artifacts regenerated from the corrected structured source
- review-package wrapper match confirmed
- Chapter 3 continuity hash sealed: `2d4170d57ceee280dc5465362bb1130f88e0a4e4cde7da679a989dee810a4816`

Wave status:
- Chapter 3 is clean and ready for repo artifact guard before Chapter 4 begins

## Phase 6 Chapter 4 In Progress

Pre-writer artifacts created:
- briefs/ch04.md
- outlines/ch04.md
- quiz-blueprints/ch04.md
- sidecars/source/ch04.source.txt
- sidecars/source/ch04.source.json

Writer -> editor -> critic completed:
- drafts/canonical/ch04.md
- drafts/edited/ch04.md
- reports/ch04.critic.md

Current state:
- Chapter 4 prose approved for conversion
- structured, quiz, validation, and seal still pending

## Phase 6 Chapter 4 Complete

Validation notes:
- structured chapter repaired locally for EMH word-floor compliance before validation
- chapter-gate lint passed
- quiz, validated chapter, review package, reading metrics, and continuity artifacts regenerated from the corrected structured source
- review-package wrapper match confirmed
- Chapter 4 continuity hash sealed: `03ae58e0b3ff8ebadb42e6ea9bbca66299674dc7e2145208796293360033a7c5`

Wave status:
- Wave 2 (Chapters 3-4) ready for repo artifact guard

## Phase 7 Wave 3 Opened

Source-boundary notes:
- frozen Part II support narrowed for Chapter 5 from the already-authorized `supersummary-part-2` source
- Chapter 5 local source sidecars created before any writer artifact

Pre-writer artifacts created:
- briefs/ch05.md
- outlines/ch05.md
- quiz-blueprints/ch05.md
- sidecars/source/ch05.source.txt
- sidecars/source/ch05.source.json

Current state:
- Chapter 5 is open on the strict path
- writer, editor, critic, conversion, quiz, validation, and seal still pending

## Phase 7 Chapter 5 In Progress

Writer -> editor -> critic completed:
- drafts/canonical/ch05.md
- drafts/edited/ch05.md
- reports/ch05.critic.md

Current state:
- Chapter 5 prose approved for conversion
- structured, quiz, validation, and seal still pending


## Phase 7 Chapter 5 Complete

Validation notes:
- structured chapter repaired locally for EMH word-floor and ceiling compliance before validation
- chapter-gate lint passed
- quiz, validated chapter, review package, reading metrics, and continuity artifacts regenerated from the corrected structured source
- review-package wrapper match confirmed
- Chapter 5 continuity hash sealed: `1f0d9a87256630007a37090ea947d8432f923e1ac0ff74b45e1c7493202db068`

Wave status:
- Chapter 5 is clean inside Wave 3

## Phase 7 Chapter 6 Opened

Source-boundary notes:
- frozen Part II support narrowed for Chapter 6 from the already-authorized `supersummary-part-2` source
- Chapter 6 local source sidecars created before any writer artifact

Pre-writer artifacts created:
- briefs/ch06.md
- outlines/ch06.md
- quiz-blueprints/ch06.md
- sidecars/source/ch06.source.txt
- sidecars/source/ch06.source.json

Current state:
- Chapter 6 is open on the strict path
- writer, editor, critic, conversion, quiz, validation, and seal still pending

## Phase 7 Chapter 6 In Progress

Writer -> editor -> critic completed:
- drafts/canonical/ch06.md
- drafts/edited/ch06.md
- reports/ch06.critic.md

Current state:
- Chapter 6 prose approved for conversion
- structured, quiz, validation, and seal still pending

## Phase 7 Chapter 6 Complete

Validation notes:
- structured chapter met EMH word-floor and ceiling compliance before validation
- chapter-gate lint passed
- quiz, validated chapter, review package, reading metrics, and continuity artifacts generated from the gated structured source
- review-package wrapper match confirmed
- Chapter 6 continuity hash sealed: `a79ab9d71911c03dcd66d453bb0a0bb0e8a4f4d7b440ba76f6dc9689efd956c6`

Wave status:
- Chapter 6 is clean inside Wave 3
- Wave 3 (Chapters 5-6) ready for repo artifact guard

## Phase 8 Wave 4 Opened

Source-boundary notes:
- frozen Part III support narrowed for Chapter 7 from the already-authorized Chapter 7 source anchors in `book-source.md`
- Chapter 7 local source sidecars created before any writer artifact

Pre-writer artifacts created:
- briefs/ch07.md
- outlines/ch07.md
- quiz-blueprints/ch07.md
- sidecars/source/ch07.source.txt
- sidecars/source/ch07.source.json

Current state:
- Chapter 7 is open on the strict path
- writer, editor, critic, conversion, quiz, validation, and seal still pending

## Phase 8 Chapter 7 In Progress

Writer -> editor -> critic completed:
- drafts/canonical/ch07.md
- drafts/edited/ch07.md
- reports/ch07.critic.md

Current state:
- Chapter 7 prose approved for conversion
- structured, quiz, validation, and seal still pending

## Phase 8 Chapter 7 Complete

Validation notes:
- structured chapter met EMH word-floor and ceiling compliance before validation
- chapter-gate lint passed
- quiz, validated chapter, review package, reading metrics, and continuity artifacts generated from the gated structured source
- review-package wrapper match confirmed
- Chapter 7 continuity hash sealed: `1ecfb580e04e9308541885d95fee1ba02e5736786e70e42f5ef99b4eae51b27e`

Wave status:
- Chapter 7 is clean inside Wave 4

## Phase 8 Chapter 8 Opened

Source-boundary notes:
- frozen Part III support narrowed for Chapter 8 from the already-authorized Chapter 8 source anchors in `book-source.md`
- Chapter 8 local source sidecars created before any writer artifact

Pre-writer artifacts created:
- briefs/ch08.md
- outlines/ch08.md
- quiz-blueprints/ch08.md
- sidecars/source/ch08.source.txt
- sidecars/source/ch08.source.json

Current state:
- Chapter 8 is open on the strict path
- writer, editor, critic, conversion, quiz, validation, and seal still pending

## Phase 8 Chapter 8 In Progress

Writer -> editor -> critic completed:
- drafts/canonical/ch08.md
- drafts/edited/ch08.md
- reports/ch08.critic.md

Current state:
- Chapter 8 prose approved for conversion
- structured, quiz, validation, and seal still pending
