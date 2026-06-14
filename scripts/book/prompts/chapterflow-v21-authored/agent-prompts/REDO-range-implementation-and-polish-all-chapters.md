# Redo range — implementation plans + prose/cards/examples polish (ALL 12 chapters)

An external QC reviewed Range **Chapter 8** ("The Outsider Advantage") and
scored it 82/100 — "much better than the broken Range chapter, but still not
publishable yet." The defects it found are **not ch8-specific**; they are
systematic generation templates present in **all 12 chapters** (verified:
12/12 chapters share the writer-facing implementation-plan templates; 36 card
backs lead with a source-label prefix). Fix them everywhere.

This is a **multi-field polish, not a rewrite.** The quizzes (scored 90), core
ideas (94), and source anchors are good — preserve them. Apply the fixes below
to every chapter ch01–ch12.

## Chapters
range-ch01 The Cult of the Head Start · ch02 How the Wicked World Was Made ·
ch03 When Less of the Same Is More · ch04 Learning, Fast and Slow ·
ch05 Thinking Outside Experience · ch06 The Trouble with Too Much Grit ·
ch07 Flirting with Your Possible Selves · ch08 The Outsider Advantage ·
ch09 Lateral Thinking with Withered Technology · ch10 Fooled by Expertise ·
ch11 Learning to Drop Your Familiar Tools · ch12 Deliberate Amateurs

## What you do NOT change
`quiz` (all fields — it is good), `hook`, `counterintuition`, `keyTakeaway`,
all `chapterId`/`exampleId`/`cardId`/`number`/`title`/`readingTimeMinutes`,
and the factual content of the source anchors (Polgar, Kepler, Bingham/
InnoCentive/Lakhani, Smithies, Yokoi, Tetlock, Weick, etc.). Keep every claim
true to the book.

---

## FIX 1 — Implementation plan: full rewrite to a user-facing practice (BIGGEST FIX)

**Problem (all 12 chapters).** The implementation plan is writer-facing source-
management guidance, not a reader action plan. Verbatim:
- ch08 24h: "Review the last meeting using outside-in thinking; **include Alph
  Bingham at Eli Lilly and one place where the analogy or lesson could fail.**"
- ch01 24h: "...**include Laszlo Polgar and the Polgar sisters and one place
  where the analogy or lesson could fail.**"
- Every `ifThenPlans` entry, all 12 chapters: "context: When someone cites
  <source>" / "plan: If <source> **enters the conversation, then compare it
  with this claim before acting:** <source>..." — that is debate-prep, not
  practice.
- `weeklyPractice`, all 12: "This week, revisit the hard edge: <the chapter's
  guardrail sentence>" — a reminder, not an action.

**Required.** Replace the plan with a concrete practice a reader performs, in a
numbered step → question/action shape. ch08 must use exactly this model (from
the external QC):

> **Outside-In Problem Frame**
> 1. Strip jargon — How would I describe the problem with no company- or
>    field-specific terms?
> 2. Name the function — What physical, behavioral, or logical thing must happen?
> 3. Name constraints — What must stay true: cost, safety, speed, material, scale?
> 4. Search distant fields — Which fields already solve this shape?
> 5. Test translation — What outsider idea can we try without losing insider
>    judgment?

**Every other chapter gets its OWN topic-matched practice in this same shape —
do NOT copy the Outside-In frame across chapters.** The skill differs per
chapter; the practice must fit it. Steers:
- ch01 Head Start → diagnose kind vs wicked: is feedback fast/accurate/stable? if
  wicked, what early breadth protects against the wrong lesson?
- ch02 Wicked World Made → practice classifying a problem concrete vs abstract,
  then reframe it conceptually.
- ch03 Less of the Same → audit a skill diet: where to add sampling/breadth before
  re-specializing.
- ch04 Learning Fast/Slow → build a desirable-difficulty drill (space it, generate
  before being told, mix problem types).
- ch05 Thinking Outside Experience → an analogy protocol: map the relation, test
  the fit, drop surface detail, keep what transfers.
- ch06 Too Much Grit → a match-quality check: when is switching the disciplined
  move, not quitting?
- ch07 Possible Selves → design a short, low-cost identity experiment and a review
  date.
- ch08 Outsider Advantage → the Outside-In Problem Frame above.
- ch09 Withered Technology → repurpose mature/cheap tech for a new use; list
  proven-but-underused tools.
- ch10 Fooled by Expertise → a forecasting hygiene check (track predictions,
  invite the outside view, fox over hedgehog).
- ch11 Drop Familiar Tools → name the "tool" you'd refuse to drop under pressure,
  and a cue to drop it.
- ch12 Deliberate Amateurs → schedule protected play time inside serious work and
  a rule for testing what it produces.

Each plan's `coreSkill` must read as a reader-facing skill statement (drop
phrasing like "The final numbered research movement celebrates…" which describes
the book, not the reader). `twentyFourHourChallenge` and `weeklyPractice` must
be actions the reader does; remove "include <source>… where the lesson could
fail" and "revisit the hard edge" templates. `ifThenPlans` must be real
if-then implementation intentions tied to the reader's situations, never
"When someone cites <source>."

## FIX 2 — FullRead: smooth prose, one thread, finish every scene

**Problem.** FullRead reads like stacked notes/claims rather than flowing prose,
and **ch08 ends mid-scene** ("...senior chemists worry about embarrassment if
the challenge is posted beyond the company.") — the Dana research-council scene
is set up and never resolved.

**Required.** Rewrite each chapter's fullRead into smooth prose organized around
one central story/thread. Audit every chapter for notes-like listing; ch08 is
the worst. **No fullRead may end mid-scene** — either finish the scene (e.g.
Dana posts the reframed problem and an outside solver recognizes the structure)
or cut it. Keep all the real claims and anchors; change the prose, not the facts.

## FIX 3 — FastRead: add one vivid concrete moment

**Problem.** FastRead states the core idea but is sparse/abstract.

**Required.** Add one short vivid scene per chapter (e.g., ch08: internal
scientists stuck, an outsider recognizes a coating/mechanics/dentistry analogy)
while keeping fastRead short. One concrete moment, then the idea.

## FIX 4 — Review cards: less source-recall, add transferable retrieval

**Problem.** Cards are too source-heavy: every front asks about the source case
("What did the Polgar sisters demonstrate…", "Why did Bingham's experiment…"),
and 36/36 backs lead with a source-label prefix ("Alph Bingham at Eli Lilly:
…", "Johannes Kepler: …").

**Required.** Keep at most ONE source-anchored card per chapter; make the rest
practical/transferable retrieval. For ch08 add cards like: "Why must a problem
'travel' to benefit from outsiders?", "What does local jargon hide?", "What is a
distant analogy and when does it help?" Give every chapter equivalent concept/
practice cards drawn from its own skill. Remove the leading "Source label:"
prefix from card backs — the back should answer the front directly.

## FIX 5 — Examples: natural phrasing

**Problem.** Mechanical generated phrasing: "<source case> sits in her notes,"
"rereads <source>'s habit," and awkward times like "10:00 morning" / "8:40
evening."

**Required.** Make scenarios read naturally. A character may recall a source
idea, but not via "<source> sits in her notes." Use normal time phrasing
("10:00 a.m.", "early evening") or none. Keep the real situation and the
chapter's concept; fix only the phrasing.

## FIX 6 — Tags (low priority, only if exposed)

Retag examples cleanly; replace fragment tags like `eli`, `lilly`, `posting`
with meaningful tags. Skip if tags are not user-visible.

---

## Procedure
1. Work chapter by chapter, ch01→ch12. After each:
   `npx tsx src/cli.ts gate-chapter state/chapters/range-ch{NN}.v21-native.chapter.json` → 0 blockers.
2. After all 12: `npx tsx src/cli.ts book-gate range` → 0 blockers.
3. NOTE: the promoted `book-packages/range.v21.json` (Jun 3 03:38) must be
   re-promoted from the corrected chapters after this redo — the package is a
   separate artifact and will still hold the un-fixed content until re-promoted.

## Done condition (gates necessary but NOT sufficient)
- Per-chapter gate-chapter: 0 blockers. Book gate: 0 blockers. Quizzes unchanged.
- **AND** a human/QC read confirms, in every chapter: the implementation plan is
  a reader-action practice (no "include <source>" / "When someone cites
  <source>" / "revisit the hard edge"); fullRead flows as prose and finishes its
  scene (ch08 Dana scene resolved); fastRead has one concrete moment; ≤1 source-
  recall card and no "Source label:" back-prefix; no example uses "<source> sits
  in her notes" or "10:00 morning"-style times.

Report back: per-chapter + book-gate blocker counts, and quote ch08's rewritten
implementation plan plus one rewritten ch08 card and example to demonstrate.
