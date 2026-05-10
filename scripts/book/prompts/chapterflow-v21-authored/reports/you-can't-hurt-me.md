# you-can't-hurt-me
File: /Users/willsoltani/dev/chapterflow-siliconx/book-packages/you-can't-hurt-me.modern.json
Generated: 2026-04-22T11:40:47.090Z
Chapters: 11
Units scored: 285
Pass rate: 46.7% (133/285)

## By check
  register.no_meta_reference                  pass=  93 fail= 116  (44.5% pass)
  schema.enum_validity                        pass=   0 fail= 110  (0.0% pass)
  pedagogy.quiz_tests_application             pass=  25 fail=  85  (22.7% pass)
  register.no_chapter_number_literal          pass= 204 fail=  71  (74.2% pass)
  narrative.specific_scene                    pass=   0 fail=  66  (0.0% pass)
  narrative.decision_point                    pass=   2 fail=  64  (3.0% pass)
  narrative.named_protagonist                 pass=  40 fail=  26  (60.6% pass)
  register.no_banned_phrase                   pass= 262 fail=  13  (95.3% pass)
  pedagogy.card_tests_retrieval               pass=  44 fail=  11  (80.0% pass)
  schema.answer_position_balance              pass=   1 fail=  10  (9.1% pass)
  schema.bloom_vocabulary                     pass= 110 fail=   0  (100.0% pass)

## Top 10 worst units
  ch3 quiz_question ch03-q10 — 4 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 3" — breaks reading experience
    [blocker] register.no_meta_reference: meta-reference "the book" (pattern the_book) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
  ch5 quiz_question ch05-q10 — 4 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 5" — breaks reading experience
    [blocker] register.no_meta_reference: meta-reference "the book" (pattern the_book) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
  ch1 breakdown [hard] — 3 finding(s)
    [major] register.no_chapter_number_literal: literal chapter reference "Chapter 1" — breaks reading experience
    [blocker] register.no_meta_reference: meta-reference "this chapter" (pattern this_chapter) — teach the idea, don't narrate the chapter
    [major] register.no_banned_phrase: banned phrase "boundary condition" — Grad-school-philosophy register. Appeared 201 times across 46 books in v13 — a generator tell.
  ch1 example ch01-ex01 — 3 finding(s)
    [blocker] narrative.named_protagonist: scenario has no named protagonist — reads as thesis-paraphrase, not a scene
    [major] narrative.specific_scene: scenario too short (125 chars) — needs ≥180 chars of concrete setup
    [major] narrative.decision_point: scenario has no explicit decision point — example doesn't force the reader into the protagonist's shoes
  ch1 example ch01-ex02 — 3 finding(s)
    [blocker] narrative.named_protagonist: scenario has no named protagonist — reads as thesis-paraphrase, not a scene
    [major] narrative.specific_scene: scenario too short (108 chars) — needs ≥180 chars of concrete setup
    [major] narrative.decision_point: scenario has no explicit decision point — example doesn't force the reader into the protagonist's shoes
  ch1 example ch01-ex04 — 3 finding(s)
    [blocker] narrative.named_protagonist: scenario has no named protagonist — reads as thesis-paraphrase, not a scene
    [major] narrative.specific_scene: scenario too short (93 chars) — needs ≥180 chars of concrete setup
    [major] narrative.decision_point: scenario has no explicit decision point — example doesn't force the reader into the protagonist's shoes
  ch1 example ch01-ex06 — 3 finding(s)
    [blocker] narrative.named_protagonist: scenario has no named protagonist — reads as thesis-paraphrase, not a scene
    [major] narrative.specific_scene: scenario too short (147 chars) — needs ≥180 chars of concrete setup
    [major] narrative.decision_point: scenario has no explicit decision point — example doesn't force the reader into the protagonist's shoes
  ch1 quiz_question ch01-q02 — 3 finding(s)
    [blocker] register.no_meta_reference: meta-reference "the chapter" (pattern the_chapter) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
    [major] schema.enum_validity: non-canonical depthLevel "easy" (should normalize to "simple")
  ch1 quiz_question ch01-q07 — 3 finding(s)
    [blocker] register.no_meta_reference: meta-reference "the chapter" (pattern the_chapter) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
    [major] schema.enum_validity: non-canonical depthLevel "medium" (should normalize to "standard")
  ch1 quiz_question ch01-q08 — 3 finding(s)
    [blocker] register.no_meta_reference: meta-reference "the chapter" (pattern the_chapter) — teach the idea, don't narrate the chapter
    [minor] pedagogy.quiz_tests_application: prompt is short and does not obviously test application — consider a scenario-based framing
    [major] schema.enum_validity: non-canonical depthLevel "medium" (should normalize to "standard")