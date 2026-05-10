# influence
File: /Users/willsoltani/dev/chapterflow-siliconx/book-packages/influence.modern.json
Generated: 2026-04-22T11:40:46.376Z
Chapters: 9
Units scored: 233
Pass rate: 39.9% (93/233)

## By check
  schema.enum_validity                        pass=   0 fail=  90  (0.0% pass)
  schema.bloom_vocabulary                     pass=   0 fail=  90  (0.0% pass)
  register.no_meta_reference                  pass=  96 fail=  75  (56.1% pass)
  pedagogy.quiz_tests_application             pass=  16 fail=  74  (17.8% pass)
  register.no_chapter_number_literal          pass= 154 fail=  71  (68.4% pass)
  narrative.specific_scene                    pass=   6 fail=  48  (11.1% pass)
  narrative.decision_point                    pass=  16 fail=  38  (29.6% pass)
  schema.answer_position_balance              pass=   1 fail=   8  (11.1% pass)
  pedagogy.card_tests_retrieval               pass=  42 fail=   3  (93.3% pass)
  register.no_banned_phrase                   pass= 223 fail=   2  (99.1% pass)
  narrative.named_protagonist                 pass=  54 fail=   0  (100.0% pass)

## Top 10 worst units
  ch3 quiz_question ch03-q10 — 5 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 3" — breaks reading experience
    [blocker] register.no_meta_reference: meta-reference "the book" (pattern the_book) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
  ch4 quiz_question ch04-q10 — 5 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 4" — breaks reading experience
    [blocker] register.no_meta_reference: meta-reference "the book" (pattern the_book) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
  ch5 quiz_question ch05-q10 — 5 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 5" — breaks reading experience
    [blocker] register.no_meta_reference: meta-reference "the book" (pattern the_book) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
  ch6 quiz_question ch06-q10 — 5 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 6" — breaks reading experience
    [blocker] register.no_meta_reference: meta-reference "the book" (pattern the_book) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
  ch7 quiz_question ch07-q10 — 5 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 7" — breaks reading experience
    [blocker] register.no_meta_reference: meta-reference "the book" (pattern the_book) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
  ch8 quiz_question ch08-q10 — 5 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 8" — breaks reading experience
    [blocker] register.no_meta_reference: meta-reference "the book" (pattern the_book) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
  ch9 quiz_question ch09-q10 — 5 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 9" — breaks reading experience
    [blocker] register.no_meta_reference: meta-reference "the book" (pattern the_book) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
  ch1 breakdown [medium] — 4 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 1" — breaks reading experience
    [blocker] register.no_meta_reference: meta-reference "This chapter" (pattern this_chapter) — teach the idea, don't narrate the chapter
    [major] register.no_banned_phrase: banned phrase "keeps the chapter from" — Meta-reference + stock construction. 167 hits across 50 books.
  ch1 breakdown [hard] — 4 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 1" — breaks reading experience
    [blocker] register.no_meta_reference: meta-reference "the chapter" (pattern the_chapter) — teach the idea, don't narrate the chapter
    [major] register.no_banned_phrase: banned phrase "boundary condition" — Grad-school-philosophy register. Appeared 201 times across 46 books in v13 — a generator tell.
  ch1 quiz_question ch01-q01 — 4 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 1" — breaks reading experience
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
    [blocker] schema.bloom_vocabulary: non-canonical bloomsLevel "remember-understand" (should normalize to "understand")