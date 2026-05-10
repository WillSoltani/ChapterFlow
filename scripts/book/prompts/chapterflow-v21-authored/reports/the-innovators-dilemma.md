# the-innovators-dilemma
File: /Users/willsoltani/dev/chapterflow-siliconx/book-packages/the-innovators-dilemma.modern.json
Generated: 2026-04-22T11:40:46.836Z
Chapters: 11
Units scored: 283
Pass rate: 70.0% (198/283)

## By check
  schema.enum_validity                        pass=   0 fail= 110  (0.0% pass)
  register.no_chapter_number_literal          pass= 171 fail= 104  (62.2% pass)
  pedagogy.quiz_tests_application             pass=  17 fail=  93  (15.5% pass)
  register.no_meta_reference                  pass= 140 fail=  69  (67.0% pass)
  narrative.specific_scene                    pass=   4 fail=  62  (6.1% pass)
  narrative.decision_point                    pass=  21 fail=  45  (31.8% pass)
  narrative.named_protagonist                 pass=  58 fail=   8  (87.9% pass)
  schema.answer_position_balance              pass=   3 fail=   8  (27.3% pass)
  pedagogy.card_tests_retrieval               pass=  49 fail=   6  (89.1% pass)
  register.no_banned_phrase                   pass= 273 fail=   2  (99.3% pass)
  schema.bloom_vocabulary                     pass= 110 fail=   0  (100.0% pass)

## Top 10 worst units
  ch10 example — 4 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 10" — breaks reading experience
    [blocker] narrative.named_protagonist: scenario has no named protagonist — reads as thesis-paraphrase, not a scene
    [major] narrative.specific_scene: scenario too short (130 chars) — needs ≥180 chars of concrete setup
  ch1 quiz_question ch01-q01 — 3 finding(s)
    [blocker] register.no_meta_reference: meta-reference "this chapter" (pattern this_chapter) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
    [major] schema.enum_validity: non-canonical depthLevel "easy" (should normalize to "simple")
  ch1 quiz_question ch01-q06 — 3 finding(s)
    [blocker] register.no_meta_reference: meta-reference "the chapter" (pattern the_chapter) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
    [major] schema.enum_validity: non-canonical depthLevel "medium" (should normalize to "standard")
  ch1 quiz_question ch01-q09 — 3 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 1" — breaks reading experience
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
    [major] schema.enum_validity: non-canonical depthLevel "hard" (should normalize to "deep")
  ch2 breakdown [hard] — 3 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 1" — breaks reading experience
    [blocker] register.no_meta_reference: meta-reference "the chapter" (pattern the_chapter) — teach the idea, don't narrate the chapter
    [major] register.no_banned_phrase: banned phrase "boundary condition" — Grad-school-philosophy register. Appeared 201 times across 46 books in v13 — a generator tell.
  ch2 quiz_question ch02-q01 — 3 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 2" — breaks reading experience
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
    [major] schema.enum_validity: non-canonical depthLevel "easy" (should normalize to "simple")
  ch2 quiz_question ch02-q03 — 3 finding(s)
    [blocker] register.no_meta_reference: meta-reference "the chapter" (pattern the_chapter) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
    [major] schema.enum_validity: non-canonical depthLevel "easy" (should normalize to "simple")
  ch2 quiz_question ch02-q04 — 3 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 2" — breaks reading experience
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
    [major] schema.enum_validity: non-canonical depthLevel "medium" (should normalize to "standard")
  ch2 quiz_question ch02-q05 — 3 finding(s)
    [blocker] register.no_meta_reference: meta-reference "this chapter" (pattern this_chapter) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
    [major] schema.enum_validity: non-canonical depthLevel "medium" (should normalize to "standard")
  ch2 quiz_question ch02-q06 — 3 finding(s)
    [blocker] register.no_meta_reference: meta-reference "the chapter" (pattern the_chapter) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
    [major] schema.enum_validity: non-canonical depthLevel "medium" (should normalize to "standard")