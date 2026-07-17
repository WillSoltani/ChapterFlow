# V25 Anchor-Band Study: Content Patterns in High-Scoring Books and the Legacy-Anchor Gap

**WP:** E51 · **Lane:** L5 (docs) · **Author role:** NON-RATER. This document is a read-only
qualitative study written by a Claude implementation worker. **The author never rates
candidates and this document's content never enters a blind rater context.** Nothing here —
no book title, no score, no chapter excerpt, no rubric-anchor language coined below — may be
copied into a rater prompt, a blind package, or any artifact a Stage-0b/1/2 rater or
adjudicator will read. If a future workstream needs rater-facing anchor material, it must be
authored fresh, independently, from the rubric and the source packages, not from this file.

**Inputs read (read-only, this session):**
- `/Users/radinsoltani/ChapterFlow-books/book-packages/difficult-conversations.v21.json` (12 ch)
- `/Users/radinsoltani/ChapterFlow-books/book-packages/the-willpower-instinct.v21.json` (10 ch)
- `/Users/radinsoltani/ChapterFlow-books/book-packages/peak.v21.json` (9 ch)
- `/Users/radinsoltani/ChapterFlow-books/book-packages/the-48-laws-of-power.v21.json` (48 ch, low-contrast)
- `.agents/skills/chapterflow-book-evaluator/references/rubric-v2.md` (rubric v2.0, normative)
- `docs/v25/chapterflow-140-evaluation/README.md` + `chapterflow-140-evaluation-report-data.json`
- `src/bakeoff/migration/rubricAuditCanonical.ts`, `src/bakeoff/migration/rubricAuditInstrument.ts:119-154`
- `docs/v25/V25_EVALUATOR_AND_MODEL_SELECTION_EXECUTION_PLAN.md` §2, §5.2 (policy context for §4 below)

No chapter text is quoted at length anywhere in this document; all package content is
paraphrased with locators, per rubric-v2.md "Evidence requirements."

---

## 1. Method limits

The 140-book snapshot (`docs/v25/chapterflow-140-evaluation/`) is explicitly **not** an
adjudicated corpus. Its own metadata says so in three places that this study treats as
binding constraints on every claim below:

- `meta.evaluation_mode`: `"Single-evaluator screening audit"`.
- `meta.profile_counts`: `{"prior": 8, "scalable": 132}` — only 8 of 140 books (5.7%) carry
  the `prior` profile, meaning a previously completed close-read adjudication under this
  rubric; the other 132 (including `peak`, `profile: "deep_practical"`, and
  `the-48-laws-of-power`, `profile: "ethics_fail"`) are single-pass scalable scores, not
  dual-blind-plus-adjudication results.
- `meta.method_warning` (verbatim): *"The package contains all 1,903 chapter evidence records
  and no random seed or sample manifest; it must not be described as a verified four-random-
  chapter experiment."*

Of the four books this study reads, only **difficult-conversations** (rank 1, 90.1,
`profile: "prior"`) and **the-willpower-instinct** (rank 2, 89.7, `profile: "prior"`) carry
the close-read profile. **Peak** (rank 5, 87.9, `profile: "deep_practical"`) and
**the-48-laws-of-power** (rank 140, 48.1, `profile: "ethics_fail"`) are scalable-profile
scores — same single-evaluator method, no adjudication pass. This study does not upgrade
any of the four scores; it treats all four as directional signal only, and where the pattern
analysis leans on a specific number (e.g., a domain sub-score) that number is sourced to the
snapshot and flagged as single-evaluator, not adjudicated.

This study is itself a second, independent method with its own limits: one reader (this
agent), no blind pairing, no adjudicator, selective chapter sampling (not full-book), and a
qualitative rather than scored output. It corroborates or complicates the snapshot's ranking
by direct inspection; it does not replace an adjudication and produces no score.

**Sampling note.** Full-book reads were infeasible in one session for four books totaling 79
chapters (difficult-conversations 12, willpower-instinct 10, peak 9, 48-laws-of-power 48).
This study read every chapter's hook/counterintuition/keyTakeaway/component-count row for
all four books (whole-book shape), plus full early/middle/late chapter bodies
(breakdown/examples/quiz/reviewCards/implementationPlan/memorableLines) for
difficult-conversations chs 1, 6, 12; the-willpower-instinct chs 1, 6, 10; peak chs 1, 3, 9;
and 48-laws-of-power chs 1, 3, 26, 33. The 48-laws-of-power chapters were chosen for content
relevant to Domain 1 (epistemic integrity) and Domain 7 (autonomy) rather than a strict
early/mid/late spread, because the book's `ethics_fail` gate is the load-bearing contrast this
study needed to characterize.

---

## 2. Observable design patterns (mapped to the 9 rubric domains)

All three high books and the low contrast share **near-identical component quantities per
chapter**: 6 examples, 9 quiz questions, 5 review cards (6-7 for willpower-instinct), 4
if-then implementation plans (3-4), 3 memorable lines. This is the first and most important
finding for distinguishing real quality from template conformity — see the box at the end of
this section.

### Domain 1 — Epistemic Integrity and Intellectual Honesty (15%)

- **High pattern (difficult-conversations, willpower-instinct, peak):** claims are
  consistently framed as heuristics with a stated boundary, not universal law. Peak ch1
  ("The Power of Purposeful Practice") states the core claim — narrow, feedback-close
  practice beats repetition — then immediately gives the failure mode of the naive version
  ("naive practice repeats the whole task and hopes time will fix the weak part") rather than
  asserting purposeful practice as a silver bullet. Willpower-instinct ch4 ("License to Sin")
  states its causal claim (moral licensing) and explicitly reframes when the same behavior is
  *not* licensing ("Good acts protect willpower when they point to values, not when they
  become a trophy"), which is the uncertainty/limitation move rubric anchor 1.2 rewards.
  Difficult-conversations ch1's `deepRead` closes with an explicit scope limit: "The three
  conversations are a diagnostic tool, not a script. They do not solve the exchange."
- **Low contrast (the-48-laws-of-power):** the pattern is present structurally (each chapter
  has a `counterintuition` field and an implementation "limit" clause) but the content
  undermines rather than supports 1.1/1.2. Ch1 ("Never Outshine the Master") does carry one
  boundary paragraph ("This Law inverts in one situation... those conditions are rarer than
  ambition wants to admit"), which is real nuance. But ch3 ("Conceal Your Intentions")
  contains a sentence this study flags as a 1.2 false-certainty pattern: "Concealment is not
  deception." The claim is asserted, not argued, immediately after a `fastRead` scenario
  (Camille, 14-week M&A courtship under false pretenses) whose own details read as textbook
  deception. The package's snapshot score reflects this: 48-laws' Epistemic domain is **1.0/4**
  (snapshot `domains["Epistemic Integrity and Intellectual Honesty"]`), the lowest of its nine
  domains and far below difficult-conversations (3.75), willpower-instinct (3.75), or peak
  (3.5).

### Domain 2 — Audience Fit, Comprehensibility, and Cognitive Economy (12%)

- All four books, including the low contrast, use short sentences, concrete named characters
  (Adaeze, Rachel, Beatrice, Janelle), and a consistent `fastRead → deepRead → fullRead`
  layering that lets a reader stop at the density they can absorb. This machinery is present
  book-wide and is not what separates high from low.
- The differentiator inside this domain is less about sentence-level clarity and more about
  whether the *frameworks* stay singular and non-competing. Peak's three chapters read use one
  vocabulary throughout (purposeful practice → mental representations → deliberate practice
  standard), each chapter explicitly building the term set the last one introduced. 48-laws
  introduces one new discrete "law" per chapter with no shared vocabulary across chapters
  (ch1 "outshine the master," ch3 "conceal your intentions," ch26 "keep your hands clean,"
  ch33 "discover each man's thumbscrew" are four independent frames, not a cumulative model) —
  this is more a Domain 3 (central model) issue than a Domain 2 one, but it does inflate
  framework load without a unifying model to anchor it (rubric anchor 2.3).

### Domain 3 — Mental-Model Coherence and Explanatory Depth (15%)

- **Strongest observed pattern:** the closing chapter of each high book explicitly
  re-invokes the vocabulary of its own earlier chapters as a working model, not a summary list.
  Willpower-instinct ch10 ("Final Thoughts") frames its closing skill, "Test the Next Fit," as
  a diagnostic across exactly the causes named in chs 2-9 — the implementation plan literally
  asks the reader to check "body state, reward cue, shame, future, social norm, or
  suppression," which map onto the six preceding chapter titles (the willpower instinct/body,
  the muscle model, licensing, the brain's lie, the what-the-hell effect, the future discount,
  and contagion). Peak ch9 ("Where Do We Go from Here?") reapplies its ch1-ch7 vocabulary
  (standard, protected reps, feedback) to an institutional-design argument rather than
  restating it. Difficult-conversations ch12 ("Putting It All Together") makes the integration
  the explicit subject: its `deepRead` shows a character (Beatrice) whose planned five-move
  arc gets interrupted, and the chapter argues that "openness to being changed is the skill
  underneath all the skills" — i.e., the central model is reframed as a judgment layer over
  the previous 11 chapters' techniques, not a checklist to run in order.
- **Low contrast:** 48-laws-of-power has no equivalent capstone; each of its 48 chapters is a
  self-contained "law" with its own scenario and its own vocabulary. Its snapshot Mental-Model
  domain score is 2.5/4 versus 3.75-4.0 for the three high books — mid-range, not floor-level,
  because individual chapters do build real (if narrow) causal models (e.g., ch33's
  "thumbscrew" chapter correctly distinguishes stated objections from underlying incentives).
  The domain is dragged down by absence of cross-chapter integration, not by chapter-local
  incoherence.

### Domain 4 — Learning Architecture and Productive Processing (12%)

- Peak's three read chapters (1, 3, 9) show a deliberate progression from "what purposeful
  practice is" → "what a mental representation is and why it makes practice legible" → "how an
  institution builds the road to a standard," each with a worked scenario before the abstract
  claim (archer, then aviation-maintenance technician, then lifeguard-certification designer).
  This is the rubric's "problem → model → practice → complexity" sequencing (anchor 4.1)
  applied at the whole-book level, visible even from three non-adjacent chapters.
- Difficult-conversations' implementation plans consistently include a context-specific
  if-then per chapter (work feedback / family logistics / partnership decision / community
  conflict in ch1) rather than one generic if-then repeated with cosmetic edits — this is what
  separates "active processing" (anchor 4.3, a 3-4) from an if-then field that exists only to
  satisfy the schema.
- 48-laws' implementation plans have the same four-context shape (work / negotiation / family
  or community / leadership) and are competently constructed as instructions — ch26's plan
  ("Keep Your Hands Clean") is unusually explicit about mechanism (name the proxy, stage
  distance, plan the proxy's exit). The learning architecture itself is not what's broken here;
  what the plan is teaching the reader to *do* is the Domain 6/7 problem below.

### Domain 5 — Retention and Retrieval Support (10%)

- Quiz construction quality is comparable across high and low books — this is a second
  quantity-vs-quality distinction worth stating plainly. 48-laws' ch1 quiz (q01-q09) requires
  discrimination between "complement" and "substitute" framings across nine different
  scenarios (hospital, kitchen, seminar, board, product demo, nursing, theater, council,
  school), not recognition of a repeated term — structurally this is a well-built retrieval
  item bank (rubric anchor 5.3, "questions often require recall, discrimination... or
  application"). The retention *mechanism* is not the differentiator between the low book and
  the three high books; what each quiz is training the reader to discriminate is.

### Domain 6 — Purpose-Appropriate Transfer, Action, and Practical Judgment (15%)

- This domain is where the three high books show a pattern absent from 48-laws: an explicit
  "when this breaks down / when not to use this" clause tied to the technique, not appended
  as decoration. Difficult-conversations ch12's implementation plan includes a "limit case"
  if-then: "If the other person will not engage or holds much more power, then add
  documentation, allies, exits, or third-party support before relying on conversation skill" —
  this is rubric anchor 6.4 (boundaries, adaptation, and tradeoffs) at the 3-4 level: the
  package tells the reader when its own core technique is insufficient.
- 48-laws' equivalent "limit" language exists (ch1's paranoid-superior clause) but is framed
  as *tactical risk to the actor* ("if redirecting credit... raises surveillance, the hierarchy
  is the problem") rather than a boundary on whether the technique should be used at all — the
  reader is told the tactic might fail, not that it might be wrong to deploy. Snapshot Transfer
  domain: difficult-conversations 3.75, willpower-instinct 3.75, peak 4.0, versus 48-laws 1.5 —
  the widest domain gap in the four-book set alongside Domain 7.

### Domain 7 — Motivation, Autonomy, and Calibrated Agency (8%)

- Willpower-instinct ch6 ("What the Hell") is the clearest high-book exemplar this study read:
  its review cards explicitly reframe self-blame as counterproductive ("a lapse is data, not a
  sentence") and its core mechanism (shame → bigger lapse) is taught as something to interrupt
  in oneself, not leverage in others. This is anchor 7.3 (autonomy and non-shaming tone) at the
  3-4 level.
- 48-laws' Motivation/Autonomy snapshot domain score is **1.0/4**, tied with Epistemic
  Integrity as its lowest domain and the single largest domain gap versus the three high books
  (3.25 peak, 3.75 difficult-conversations and willpower-instinct). This tracks directly with
  what this study read in chs 26 and 33: both
  chapters' core mechanism is asymmetric (the reader acts on someone else's psychology — a
  proxy absorbs blame in ch26, a private fear is located and traded on in ch33) rather than
  calibrating the reader's own agency. This is a domain-appropriate reading, not a moral
  aside: the rubric's Domain 7 anchors ask whether the package supports the *reader's own*
  autonomy and confidence, and a book whose central skill is applied to other people's
  psychology structurally has less to say about the reader's own calibrated agency, independent
  of whether the technique described works.

### Domain 8 — Instructionally Aligned Engagement and Reading Momentum (8%)

- Notably **not** a strong differentiator: 48-laws' snapshot Engagement domain is 3.0/4,
  matching difficult-conversations' own 3.0 exactly and close to willpower-instinct's 3.25 and
  peak's 3.25. All four books use named characters, present-tense scenes, and specific
  sensory/temporal detail (times of day, specific objects) at comparable density. This is the
  clearest single piece of evidence in the four-book set that vivid narrative craft is
  necessary but not sufficient — the low scorer is not low because its prose is duller.

### Domain 9 — Whole-Book Coherence, Consistency, and Completion Value (5%)

- The three high books' final chapters function as closing synthesis: willpower-instinct ch10,
  peak ch9, and difficult-conversations ch12 all explicitly re-derive their opening claims in
  light of everything taught since, per Domain 3 above. 48-laws has 48 chapters with identical
  internal shape and no such capstone; its snapshot Whole-Book domain is 2.25/4 versus an
  identical 3.5 across all three high books (difficult-conversations, willpower-instinct, peak).

### Component quantity vs. quality — the load-bearing distinction

Every chapter read across all four books — high and low alike — has 6 examples, 9 quiz
questions, 5-7 review cards, 3-4 implementation if-thens, and 3 memorable lines. **Component
counts are template-uniform and carry zero discriminating signal in this four-book set.**
What separates the 90.1/89.7/87.9 books from the 48.1 book is never "more" or "fewer"
components; it is (a) whether Domain 3's model accumulates across chapters instead of resetting
each chapter, (b) whether Domain 6's boundary language is about whether to use a technique or
merely about tactical risk to the user of the technique, and (c) whether Domain 7's core skill
is applied to the reader's own agency or to someone else's. Rubric-v2.md states this directly
("Component quantity alone earns no score... A field named `quiz`, `exercise`, or
`implementation plan` earns nothing by existing") and this study's read is a direct, book-level
confirmation of that instruction, not a restatement of it.

---

## 3. Authoring guidance (principles, never copied prose)

These are generalizable authoring principles distilled from the pattern contrasts above.
None of the language below is copied from any source package; each principle names the
*mechanism* observed, for use in future author prompts, not a phrase to insert.

1. **Give every technique a stated boundary that is about legitimacy, not just tactics.**
   The high books tell the reader when a technique is the wrong tool. The low contrast tells
   the reader when a technique might fail operationally. Author prompts should require both,
   with the legitimacy boundary first.
2. **Route the chapter's core skill through the reader's own agency, not a third party's.**
   Techniques that are chiefly exercised on other people's psychology or incentives (finding
   what someone fears, routing blame through a proxy) structurally starve Domain 7. A skill
   framed as "notice X in yourself, then choose Y" outperforms a skill framed as "locate X in
   someone else, then leverage Y," independent of how well-constructed the surrounding
   examples/quiz/reviewCards are.
3. **Build the closing chapter as re-derivation, not summary.** The strongest observed pattern
   across three independently-authored, different-genre books (communication, psychology,
   performance science) is a final chapter whose worked example requires the reader to apply
   several earlier chapters' vocabulary at once, in a case that does not resolve neatly with
   any single earlier chapter's technique alone. A capstone that merely restates prior
   takeaways in sequence should be treated as a lower-tier draft.
4. **Do not resolve a genuine tension with a flat assertion.** The clearest single 1.2-anchor
   failure mode observed was a claim that dismisses its own obvious counter-reading in one
   sentence ("X is not Y") rather than arguing the distinction or acknowledging the overlap.
   When a technique's ethical status is contestable, the package should show the contest, not
   foreclose it.
5. **Framework accumulation needs a shared vocabulary, not just a shared format.** A
   fixed per-chapter schema (hook/counterintuition/breakdown/examples/quiz/reviewCards/
   implementationPlan/memorableLines) is necessary scaffolding but does not by itself produce
   Domain 3 coherence. Coherence requires later chapters to *use the terms* earlier chapters
   defined, as willpower-instinct's closing "Test the Next Fit" explicitly does by naming six
   prior chapters' mechanisms as a checklist.
6. **Component quantity is a floor, not a lever.** Given that 6/9/5-7/3-4/3 counts are already
   uniform across the entire 140-book corpus (this study's four-book sample plus the corpus-
   level `component_totals` in the snapshot meta), author prompts gain nothing by asking for
   more examples or quiz items. Gains are available only in what each component *teaches* and
   whether it earns its place under rubric-v2's evidence requirements ("Inspect actual
   component quality... Component quantity alone earns no score").

---

## 4. Anchor-band analysis

### 4.1 Why the legacy D7 anchors cannot validate an 80/85 bar

`src/bakeoff/migration/rubricAuditInstrument.ts:130-154` defines
`RUBRIC_CALIBRATION_REFERENCES`, the three owner-adjudicated **chapter-diagnostic** anchors
still live in the D7-lite instrument:

| Unit | Expected chapter diagnostic |
|---|---|
| `nudge-ch03` | 70.75657894736842 |
| `the-happiness-hypothesis-ch06` | 68.8157894736842 |
| `made-to-stick-ch04` | 67.66447368421052 |

And `RUBRIC_AUDIT_BAR_D7` (same file, lines ~119-124) sets `perChapterMin: 80, meanMin: 85,
coreDomainFloor: 3.0, calibrationTolerance: 3.0`. The structural problem this study confirms
by direct package inspection: **all three legacy anchor units score in the high-60s/low-70s
band**, roughly 15-20 points below the `perChapterMin: 80` / `meanMin: 85` bar those same
constants are used to gate. A calibration set whose only known-good reference points sit at
67-71 cannot certify that an instrument correctly distinguishes an 80 from an 85 — every
anchor in the set is on the wrong side of both thresholds. This is a calibration-tolerance
problem, not merely an inconvenience: `calibrationTolerance: 3.0` was fit to discriminate
around a 67-71 cluster, and nothing in the frozen instrument establishes that the same
tolerance is meaningful near 80-85, where the score-to-band mapping in rubric-v2.md changes
character (70-79.9 = "valuable but materially uneven"; 80-89.9 = "strong design").

Separately, these three units are **chapter diagnostics** (Domain 9 unevaluable, 8-domain
renormalized score per the execution plan §5.2), not full-book scores — they were never
positioned to validate a full-book 80/85 release bar, only to calibrate the D7-lite reviewer's
drift on its own historical scale. Using them as a proxy for "is this instrument sensitive to
the difference between an 80-level and an 85-level full book" conflates two different
measurement objects (a single chapter vs. a full nine-domain book) in addition to sitting
below both thresholds.

### 4.2 The chosen evaluator anchors (execution plan §5.2) and what they resolve

The execution plan's Stage-0b/1 anchor selection is different in kind, not just band:

- **A_high = difficult-conversations** (snapshot score 90.1, `profile: "prior"`, the only
  `Reference-standard` band book among the four this study read, gates all-Pass). Deterministic
  chapter pick under the frozen `⌈n/2⌉` rule: `⌈12/2⌉ = 6` → **"Ground Your Identity"**, this
  study's own read chapter. It opens on a reviewer facing a single flagged error in a model and
  asks whether that error will register as "the model has an error" or "I am not competent" —
  directly instantiating rubric anchor 7.4 (calibrated confidence) and 1.3 (internal-consistency
  QA framed as something the reader must survive emotionally, not just process correctly). This
  is a genuinely load-bearing anchor candidate: it sits inside the 80-90 band the experiment
  needs to discriminate, and — per this study's whole-book read — the pattern (AND/BOTH
  identity grounding) is representative of the book's overall approach, not a locally strong
  outlier chapter.
- **A_mid = multipliers** (snapshot score 72.3, `profile: "prior"`). Same deterministic rule on
  its 9 chapters: `⌈9/2⌉ = 5` → chapter 5 ("The Debate Maker"), which this study spot-read only
  at the hook/keyTakeaway level (out of this WP's four-book assignment; noted here for
  completeness of the anchor-band picture, not as a full pattern read). Its 72.3 score sits
  squarely inside the 70-79.9 "valuable but materially uneven" band per rubric-v2.md's score
  table, giving the experiment a genuine mid-band reference distinct from both the legacy
  67-71 cluster and the 90.1 high anchor.
- Both A_high and A_mid carry `profile: "prior"` — i.e., both are among the 8 close-read-
  adjudicated books in the snapshot, not scalable-profile scores. This is the correct anchor
  population per `V25-NEW-02`'s fix (execution plan §6): "anchor selection restricted to
  `prior` books."

Net effect: the new anchor pair spans roughly 72-90, bracketing both the `mean(A_high) − 8`
screening-advance floor and `mean(A_high) − 18` block floor formulas in execution plan §5.2,
and gives Stage 0b's `W = clamp(2 × SD_retest, 2.0, 4.0)` equivalence band a chance to be
estimated from data that actually straddles the region the experiment needs to resolve — unlike
the legacy 67-71 cluster, which straddles nothing above 71.

### 4.3 What the owner would need to adjudicate

Per execution plan §5.2 ("Optional owner hand-adjudication of the 2 anchor chapters = truth
check"), the owner's role is not to re-approve the anchor *books* (that selection is frozen
in the plan and independently corroborated by this study's qualitative read) but to hand-rate
the two specific anchor *chapters* — difficult-conversations ch6 and multipliers ch5 — against
rubric-v2.md, blind to the snapshot's own 90.1/72.3 scores. If declined, per the plan, "anchors
provide location+noise only (disclosed)" — i.e., Stage 0b can still compute `W` from
test-retest spread across two E-audit replicates per anchor, but loses the independent
truth check that a `|E − owner| ≤ W` comparison would provide. This study surfaces one
concrete decision point for that adjudication: whether the difficult-conversations ch6 excerpt
this study read (identity-grounding scenario, `AND/BOTH` framing) is judged the owner's own
89-90-level standard, or whether the owner's independent read lands materially lower — which
would itself be informative about whether the single-evaluator snapshot's `prior` "close-read"
label is holding up outside its own scoring session.

---

## 5. Provenance

- **The owner's 87/84/79 figures** (Luna/Terra/Sol, per the execution plan's PM-1/PM-2/PM-3)
  are **OWNER-SUPPLIED_PRELIMINARY** — a motivating prior with no retrievable artifact, method,
  or date (execution plan §2, "unknown" in every column but the number). This study does not
  use, corroborate, or reference those three numbers anywhere in §§1-4 above; they belong to a
  different comparison object (candidate chapter drafts under a Sol/Terra/Luna bakeoff) than
  the four catalog books this study reads, and averaging or triangulating across the two would
  be exactly the kind of unearned comparability the execution plan's provenance matrix
  (§2, "Never merged") forecloses.
- **The 140-book snapshot scores** (90.1 / 89.7 / 87.9 / 48.1, and every per-domain figure cited
  in §2) are single-evaluator screening output per §1 above. They are cited here as directional
  evidence for a qualitative pattern study and as the source of the anchor-book selection in
  §4 — never as adjudicated ground truth, and **never to be pasted into any rater-visible
  artifact.** This is the same constraint the execution plan states for `V25-NEW-02`: "snapshot
  scores never in blind contexts," verified by leak-token tests per that finding's acceptance
  criteria.
- **This document's own claims** are single-reader, non-blind, selectively-sampled, and
  produce no score of any kind. They should be weighted as a design-pattern brief for authoring
  guidance (§3) and as supporting rationale for an anchor selection already frozen by the
  execution plan (§4), not as an independent validation of any book's rank or of the anchor
  choice itself. Any future rater-facing use of this material requires fresh authorship from
  the rubric and source packages, per the header.
