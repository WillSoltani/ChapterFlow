# S-TIER PLAN — 2026-07-03

Root-cause investigation of the `execution` fail-closed halt (acceptance 74.7 / 74.2 vs bar
80, churn HIGH ×2) and the fix plan that takes the v24 author pipeline from "mechanically
sound, collectively templated" to S-tier content. Every finding below is byte-measured or
quoted from the run's durable records — nothing is from memory.

Evidence sources: `state/reviews/execution/acceptance.round{1,2}.json` (6 reader verdicts),
`state/autopilot-logs/execution/` (cost reports, sessions), the wave6 conductor log,
`state/chapters/execution-ch0*.v21-native.chapter.json` (measured directly), and the
pipeline surfaces mapped file:line in §B.

---

## A. WHERE EACH PHASE FAILED (the run, phase by phase)

| Phase | What happened | Verdict on the phase |
| --- | --- | --- |
| research (1 session) | 1-pass, SP14 clean, 9 packets, rich cases (GE Session C, IBM 1993, Honeywell, Southwest) | WORKED. But `bookWideDuplicate` tags are never shown to writers (§B12) |
| briefs (compile) | 18 files, gate clean; W4 dealt opener/challengeFrame/practiceShape | WORKED where dealt — hooks measurably vary. Coverage gap: nothing deals example dramaturgy, lens vocabulary, practice verbs (§B1, B2, B4) |
| write (9 + 6 retries) | 5/9 first drafts FAILED preflight (tellRate ×4, transferRatio ×2) → 6 retry writer sessions (~14 min each) | QUALITY BAR card exists but rule 1 isn't followed on draft 1 — needs a mechanical self-check protocol (§B7) |
| budgets | "clean (1 advisory)" while the book was maximally templated | BLIND SPOT: CHB6–9 police openers/scaffold stems/length tells; the actual sameness is lexical-field + scene-architecture + distractor-semantics, which nothing measures (§B1–B3) |
| gates | clean after 1 deterministic + 1 major repair (BP27.venue_stamping) | WORKED — and BP27 proves cross-chapter checks belong to this family; the family is just missing members |
| per-chapter review (bar 84) | 8/9 individually PASS 86.6–89.4. Every FAIL was `ship=false` at composite ≥ bar (must-fix-driven): ch01 85.6/86.6 (real: OUR doc leak), ch07 87.0, ch03 87.5, ch05 84.1/84.5 | Single-reader near-bar verdicts flip on identical bytes (POM forensics: 3/12). Cost: regens burned on flips; operator tiebreak needed for ch07 (§B8). ALSO: reviewers flagged distractor-tone + example-clustering EARLY — signal existed, never aggregated (§B5) |
| acceptance (3 readers ×2 rounds) | 74.7 → REJECT; targeted regen ch03; 74.2 → REJECT; halt | The instrument WORKED (caught what everything upstream missed) — but it's the most expensive place to catch it, the repair router picked ch03 by lowest-number fallback, and the sample is frozen at [3,5,7,9] (§B5, B9) |
| ch03 regen | lens words collapsed (owner 25→1, fact 42→11) — the regen brief worked locally | Composite went DOWN 74.7→74.2: single-chapter regen cannot fix book-wide sameness. Burned a durable cap for nothing (§B5) |

**The one-sentence diagnosis:** every chapter is individually strong (8/9 ≥ 86 at review),
and the book is collectively templated one level below everything the pipeline measures —
lexical saturation, scene architecture, and distractor semantics — so it sails through
budgets/gates/reviews and dies at acceptance, where the only repair lever (single-chapter
regen) is structurally unable to fix it.

## B. BOTTLENECK INVENTORY (measured)

- **B1 — Framework-vocabulary saturation.** `review` 246×, `work` 213×, `plan` 155×,
  `promise` 150×, `fact` 138×, `owner` 121×, `room` 111× — each in 9/9 chapters. ZERO
  6-gram shells appear in ≥4 chapters → every echo/n-gram detector reads clean. Writers
  see no cross-chapter context and get no vocabulary plan. Readers: "the same
  owner-fact-check phrasing… vocabulary saturation." Factors hit: density 62, tone 67.
- **B2 — Scene-architecture monoculture.** 54/54 examples are one dramaturgy class:
  named proxy + physical prop gesture ("taps the cap", "circles a missed date") + business
  document + meeting furniture. Reader: "same skeleton: owner, fact, review date, early bad
  news, polished review versus real work." W4 rotation covers hooks (measurably varied ✓)
  but not example scenes. Factor hit: insight 66 ("concrete named moments over hollow proxy
  characters", "outcome variety — at least one failed/partial example": zero exist).
- **B3 — Distractor semantics + explanations.** 19/162 distractors (12%) carry
  tone-giveaway families (polish/announce/slides/morale/bigger); readers: "easy to reject
  from tone alone… strawman options." Keys echo "the chapter's exact signature language"
  below the 5-token echo threshold. The REVIEW RUBRIC scores "explanations teach WHY wrong
  answers are wrong" — the writer card NEVER transmits this demand. Factor hit: quizzes 72.
- **B4 — Practice-verb tics.** "touch the …" ×5 chapters, "Open …" ×5 — mid-sentence, so
  CHB7's first-4-WORDS family check can't see them. Dealt practiceShape varies structure
  but not verb register.
- **B5 — Churn-blind repair routing.** `mapBookComplaintsToChapters` (authorReview.ts:335)
  targets chapters named in verdict prose, else falls back to the FIRST cap-3 sampled
  chapters. Churn-HIGH is a book property; the router regened ch03 (lowest number), score
  dropped, durable cap burned. Per-chapter review complaints that already said
  "distractors tone-rejectable / examples cluster" are never aggregated book-wide.
- **B6 — Regen-cap ledger bricks reruns.** `authorRegenLedger.ts` keys `consumed` by bare
  chapterNumber, never resets. A fresh authoring campaign (new research/briefs → new
  "original authoring") inherits consumed caps from the FAILED campaign: ch01/03/05/07/08
  would start at cap → first review miss = instant halt. Blocks Phase E outright.
- **B7 — First-draft tell rate.** 5/9 preflight FAILs (ch06 lenTell=7!). QUALITY BAR rule 1
  states the constraint but no mechanical write-time protocol; writers draft key-first,
  distractors-shorter, and only comply after paying a ~14-min rewrite.
- **B8 — Near-bar single-reader flips.** All five review FAILs were ship=false at composite
  ≥ bar. Chapter reads cost ~31s; a writer regen costs ~14min + re-review. The pipeline has
  NO second-read protocol; the owner-approved majority-of-3 tiebreak lives in an operator
  scratch script (`scratch/tiebreak-ch07.ts`).
- **B9 — Frozen acceptance sample.** `selectSeededChapters` is seeded by bookId only →
  [3,5,7,9] every round. 5/9 chapters are NEVER book-read; round 2 re-judges the identical
  sample it just regened into.
- **B10 — Rubric demands missing from the writer card.** The acceptance rubric explicitly
  scores: outcome variety ("at least one failed/partial example"), limits ("when the idea
  does NOT apply"), counterintuition that "actually reverses", explanations that teach why
  wrong answers are wrong, tone that isn't "one interchangeable house voice", density
  ("no restating"). None of these sentences reach the writer. The card and the grader are
  misaligned — writers are graded on rules they were never given.
- **B11 — Carry-counter honesty nit.** cost-report shows `carry: 0 hit / 1 miss` on the
  entry whose log carried 7/9 reviews. Telemetry only; violates the logged==counter spirit.
- **B12 — Book-wide fact tags invisible to writers.** `tagBookWideDuplicateFacts` computes
  exactly the shared-spine facts, but `writerPacketProjection` doesn't surface the tag —
  so all 9 writers re-teach the full framework at full strength (the saturation seed).

## C. THE FIXES

Three lanes: **P** (prevention — write-time), **D** (detection — deterministic budgets),
**C** (control — process/routing/ledgers). Never-weaken invariant: every existing gate,
bar, cap, and conjunct stays; new ENFORCED checks require calibration proof (top-5 owner
books PASS with headroom; the halted execution bytes FAIL).

### Lane P — prevention (briefs + writer card)

- **P1 Framework-vocabulary budget (fixes B1).** At brief-compile, compute the book's
  hot framework nouns deterministically from the source packets (top content words by
  cross-packet spread — available before any chapter exists, stable across regens). Each
  brief's VARIETY block gets: the hot-noun list with a per-chapter usage budget
  (calibrated in Phase D against top-5 densities), plus the instruction to prefer the
  chapter's OWN case-concrete referents (the person's name, the artifact, the number) once
  the budget is spent. Dealt, not discovered — parallel writers stay independent.
- **P2 Example-dramaturgy rotation (fixes B2).** New rotation pool EXAMPLE_LENSES
  (~8 classes: prop-tableau [the current default, kept as ONE class], dialogue-beat,
  before/after-ledger, past-tense postmortem, decision-walkthrough, stakes-counterfactual,
  outsider-witness, numbers-detective). Deal 3 classes per chapter (2/3-cap, adjacent-
  differing, fnv1a — same dealer as W4); card instruction: cover your dealt classes across
  the 6 examples, ≤2 prop-tableau scenes, and AT LEAST ONE example where the move fails or
  only partially works (feeds rubric insight directly).
- **P3 Distractor craft + why-wrong explanations (fixes B3).** QUALITY BAR rule 5:
  every distractor must be an action a competent practitioner would genuinely defend
  (a plausible operational alternative), never rejectable by tone alone; ban the giveaway
  families (polish/announce/slides/morale/optics/louder/bigger) unless the chapter
  explicitly teaches against that named move; each explanation names why the most tempting
  wrong answer fails ("If you chose (b): …").
- **P4 Practice-verb rotation (fixes B4).** Deal a per-chapter practice VERB register
  (pool ~10: write/say/mark/count/circle/ask/schedule/read-aloud/underline/move) rendered
  into the VARIETY block; the shape stays dealt by practiceShape as today.
- **P5 "WHAT PREMIUM MEANS" card block (fixes B10).** A compact ~12-line block in the
  always-sent card transmitting the exact rubric demands the grader applies: one
  failed/partial-outcome example; one honest boundary paragraph (when the move does NOT
  apply, what it costs); counterintuition must reverse a default; no sentence reused
  across fast/deep/full tiers; explanations teach why wrong answers are wrong. Aligns the
  author with the grader — currently they play different games.
- **P6 Surface bookWideDuplicate tags (fixes B12).** `writerPacketProjection` marks shared
  facts: "SHARED SPINE — all chapters carry this; reference it briefly through this
  chapter's own angle, do not re-derive it." One line per tagged fact.
- **P7 Tell self-check protocol (fixes B7).** Extend QUALITY BAR rule 1 with the
  mechanical protocol: before returning, list the 9 keys' lengths against their
  distractors; any uniquely-shortest/longest key → rewrite that question's distractors.
  (Concrete write-time self-checks outperform judgment — proven pattern.)

### Lane D — detection (deterministic, calibrated on real corpus)

Calibration set for ALL of these: the top-5 owner-scored books (must PASS with ≥25%
headroom) + the halted execution bytes (must FAIL for D1/D3). Enforcement tier decided by
the calibration result, exactly like CHB7 vs CHB6/8/9 were tiered.

- **D1 CHB10.lexical_saturation (detects B1).** Book-level: for each content word,
  per-chapter density × chapter-spread; flag words above the calibrated ceiling in ≥
  ceil(8/9·N) chapters. Target: enforced (zero-FP expected — a generic word like `room`
  at 111×/9ch should clear any real book's profile; the book's own title-concept gets a
  higher allowance — atomic-habits legitimately says "habit" constantly).
- **D2 CHB11.scene_class spread (detects B2).** Regex-classify example scenarios
  (named-actor-gesture opener / dialogue marks / past-tense narration / number-led /
  question-led); flag when one class covers > ceil(2/3·N) chapters' example sets.
  ADVISORY permanently unless calibration is spotless (classifier FP risk is real).
- **D3 CHB12.strawman_lexicon (detects B3).** Distractor matches the giveaway lexicon
  while its key doesn't → count per book; cap at calibrated rate. Lexicon is small and
  precise; expected enforceable.
- **D4 CHB7 extension: imperative-verb family (detects B4).** First imperative verb of
  each practice field; no verb family on > ceil(1/3·N) chapters (catches "touch" ×5 that
  first-4-words missed). Same family-check machinery, calibrated before enforcement.

### Lane C — control (process, routing, ledgers)

- **C1 Regen-ledger lineage keying (fixes B6 — BLOCKS Phase E until done).** Schema v2:
  `consumed` keys become `"<chapterNumber>@<lineage8>"` where lineage = stable hash of the
  chapter's brief + source-packet identity. Same design → caps accumulate exactly as
  today (no weakening). New research/briefs → new lineage → the fresh authoring is a new
  "original" with a fresh budget (matches AUTHOR_REGEN_CAP's own definition: "write
  attempts BEYOND the original authoring"). v1 entries are preserved verbatim under
  `legacyConsumed` for audit and count toward NOTHING once a lineage-keyed entry exists
  for that chapter — with one exception: on load, if the CURRENT lineage is unknown
  (packet/brief missing), fail toward counting legacy entries (conservative).
- **C2 Churn-aware rejection routing (fixes B5).** In the acceptance-REJECT branch: when
  churn === HIGH, build a CHURN PACK — the 3 verdicts + a deterministic saturation report
  over the current bytes (top saturated words w/ counts, dominant scene class, strawman
  list: D1–D3 run locally) — and target the cap-3 SAMPLED chapters that contribute most
  to the measured saturation (not the lowest-numbered). Every targeted writer gets the
  pack + "diverge from these book-wide patterns" complaints. Round structure/cost caps
  unchanged (one regen round, then re-accept once, then halt).
- **C3 In-pipeline near-bar tiebreak (fixes B8).** In the review phase: a FAIL with
  `valid && composite >= bar` (the flip signature — every real flip this run matched it)
  triggers up to 2 additional independent reads BEFORE any regen budget is consumed;
  majority-of-3 on ship + keys 9/9 decides; the deciding read is persisted through the
  real writers (identical to the owner-approved ch07 tiebreak, now automatic). A FAIL
  below bar regens directly, as today. Reads cost ~31s vs ~14min per avoided regen.
  Never-weaken: conversion requires 2/3 independent clean PASSes; a lone FAIL still fails.
- **C4 Acceptance sample rotation (fixes B9).** Round label salts the seed
  (`md5(bookId + ":" + roundLabel)`) so round 2 reads a different (possibly overlapping)
  sample — two rounds cover up to 8/9 chapters, and a churn-regen can't "teach to the
  sample". Control-read comparability is unaffected (the control is its own doc over
  shipped bytes; the unit of comparison is book-level composite).
- **C5 Carry-counter honesty (fixes B11).** Wire the review phase's actual carryHits into
  the cost report; assert logged==counter in the existing invariant test.

### Explicitly NOT doing (with reasons)

- NOT raising/lowering any bar (80 book / 84 chapter), the churn conjunct, quorum, regen
  caps, or reader counts — never-weaken, and the instrument just proved itself.
- NOT banning the book's framework nouns — `owner`/`fact` ARE the book. Budgets + case-
  concrete referents, not prohibition.
- NOT adding cross-chapter context to writers (other chapters' text) — breaks parallel
  independence and session isolation; everything is DEALT pre-write instead.
- NOT auto-regenerating research — packets are clean and rich; keeping them makes the
  rerun a controlled experiment (same facts, new levers).
- NOT changing ChapterV21 / the app contract in any way — every lever is prompt-side,
  budget-side, or process-side. Slim-package + registration surfaces untouched.

## D. VALIDATION & RERUN DESIGN (Phase D/E)

1. Unit tests per lever (dealer determinism + caps; projection marking; card blocks
   pinned; ledger v2 migration incl. legacy fallback; tiebreak majority logic incl.
   1-below-bar no-tiebreak; router churn path; seed salting).
2. Calibration harness: run D1–D4 against the top-5 owner books' packages AND the halted
   execution bytes; thresholds documented in `docs/v24/`; enforcement tier per result.
3. Suite: `CHAPTERFLOW_NO_API_CODEX_QC=1 npm test` must fail EXACTLY the 15 canonical
   names; root `npm run verify` green.
4. Rerun: keep research/packets; recompile briefs (new dealt fields → new lineage);
   back up then remove the 9 halted chapter files (they are superseded evidence — the
   acceptance records + measurements in this doc preserve the diagnosis); fresh-author
   all 9 under the new card; reviews fresh (docHash changed); acceptance fresh;
   shipped-control pin reused. Expected ~30–40 sessions.
5. Accept = the untouched conjunctive gate (quorum + gate PASS + churn ≠ HIGH +
   composite ≥ 80 + ≥ beat-shipped 62.1). Then MY OWN read of the actual chapters
   (gates-pass-corrupt-content trap) + the saturation measure re-run showing the delta
   vs this doc's numbers. Only then `publish-final execution`.

## E. SELF-CHALLENGE LOG

(each entry: the attack → the verdict → the plan delta)

### Round 1 (self-adversarial, 2026-07-03)

1. **P1 mints stilted synonyms** ("the accountable person" everywhere = next template).
   → REAL. Delta: P1 card text explicitly bans invented synonyms; the budget overflow
   valve is the case's CONCRETE referents (names, artifacts, numbers), never abstractions.
2. **P1 hot-noun list could include generic English** (`work`, `make`) → unactionable
   nagging. → REAL. Delta: top-6 by packet spread×freq AFTER a small generic-English
   stoplist; generic-word excess is D1's job (calibrated), not the writer's.
3. **P2 dialogue-beat invites fabricated quotes from real people** (EW1 invented-witness
   class). → REAL and dangerous. Delta: every EXAMPLE_LENSES instruction carries its own
   fabrication guardrail (dialogue only for proxy characters, or paraphrase-not-quote for
   historical figures; stakes-counterfactual framed as reasoning, never as events).
4. **P3 over-plausible distractors break key derivability** (readers derive the wrong
   answer → keyCheck disagreements spike). → REAL. Delta: rule text requires distractors
   defensible in general but CONTRADICTED by this chapter's specific stated mechanism —
   the prose must settle the question; explanation covers the most tempting distractor
   only (schema's 120–300 char budget).
5. **P5/P7 rule-count dilution** (more rules → less compliance each; B7 is proof).
   → PARTIAL. Delta: P5 capped at ~12 lines, every line mechanical; success metric =
   first-pass preflight rate ≥70% in the rerun (was 44%); if it drops, cut card rules
   rather than adding more.
6. **C1 reset-by-accident**: lineage from the rendered brief md → a cosmetic recompile
   silently refreshes caps (weaken-by-accident). → REAL. Delta: lineage = hash(source-
   packet content hash + dealt rotation assignments JSON + rotation schema version) —
   stable across cosmetic recompiles and complaint regens; changes only when research or
   the dealt design genuinely changes.
7. **C1 legacy semantics circular** ("count legacy until a lineage entry exists" would
   still brick the rerun's first review round). → REAL. Delta: v1 entries are archival
   only (`legacyConsumed`), never counted by v2 logic; migration is disclosed in the
   ledger + run log; the only v1 ledger in state/ is execution's, whose design this plan
   changes — the lost case (identical design across the v1→v2 boundary) does not exist
   in practice. If the current lineage cannot be computed (packet/brief unreadable),
   fail CLOSED: treat the chapter as cap-exhausted and halt (never fail-open the cap).
8. **C4 breaks score.py sampling parity** (selectSeededIdxs is test-pinned to the python
   original). → REAL. Delta: add an optional `salt` parameter defaulting to "" — default
   behavior byte-identical; only acceptance round 2 passes a salt.
9. **C3 weaken audit**: FAIL→PASS conversion by majority — weaker than today? → NO:
   today a regen's PASS rests on ONE fresh read; conversion here needs TWO independent
   clean PASS reads over the SAME bytes, and a lone FAIL still fails. Strictly more
   evidence. (And it is the owner-approved ch07 protocol, automated.)
10. **C2 can't actually fix a book-wide problem with cap-3 regens** → TRUE by design:
    C2 makes the one repair round honest (evidence-targeted, churn-pack-informed); the
    real fix is P-lane prevention; a book that still reads churn-HIGH after one honest
    round SHOULD halt to the owner. Cost caps unchanged.
11. **Rerun with kept research re-deals the same cases** → cases/cast/keys are already
    dealt disjoint per chapter (hard reservations); the sameness was in the TELLING.
    Keeping research isolates the lever experiment. ✓ unchanged.
12. **Are we fixing the right layer?** (alternative: the acceptance instrument is just
    harsh). → REJECTED: bar was Phase-0 calibrated (atomic-habits 80.2, shipped POM
    80.0); execution reads 74 with 6/6 unanimous churn verdicts + byte-measured
    saturation; the P-lane maps 1:1 onto what the verdicts name.
13. **Voice card presence unverified** (tone 67 could partly be a null voice card).
    → RESOLVED: `config/author-voice-profiles.json` carries an `execution` profile and
    `voiceCard()` renders from it — the voice input existed. Tone weakness is downstream
    of variety (B1/B2), not a missing card. No change.

### Round 1.5 (implementation pre-read discoveries)

14. **P3 upgrade — grounded distractors.** `writerPacketProjection` already ships each
    fact's `commonError`/`whyWrong` (real documented misconceptions). Delta: P3's rule
    directs writers to build distractors from the packet's commonError material first,
    invented alternatives second — grounded misconceptions beat invented plausibility and
    cannot be tone-rejected.
15. **P6 mechanics confirmed.** The projection is a strict explicit allowlist that
    deliberately drops `bookWideDuplicate` (sourcePacketProjection.ts:13) — the fix is a
    documented allowlist addition (optional `sharedSpine?: true` on projected facts) + one
    card line, not a schema change.
16. **New brief fields vs the brief gate.** BR1–BR5 validate specific fields; new dealt
    fields (exampleLenses, practiceVerb, hotNouns) are additive-optional. Add BR6
    (advisory): dealt lens sets respect the 2/3 cap — the deal can never mint what CHB11
    would flag, mirroring the W4 opener/CHB6 invariant.

### Round 1.6 (empirical calibration — measured this session, pre-implementation)

17. **D1 is enforceable, with a genre-aware two-tier.** Saturated band = content words at
    ≥12 uses/chapter with ≥85% chapter spread. Measured: top-5 owner books carry 0–2 band
    words (title concepts peak at `habit` 17.1/ch, `evidence` 20.6/ch); the halted
    execution bytes carry 10 (`review` 27.3/ch). Full-catalog scan (135): 24 books exceed
    band>3, clustered in the execution-genre — and they are the KNOWN-templated regen
    candidates (playing-to-win 13, extreme-ownership 10, measure-what-matters 9,
    the-12-week-year 9). Tiering: ADVISORY at band>3; BLOCKING at band>6 OR any single
    word >24/ch (top-5 max word 20.6 → 17% headroom; top-5 max band 2 vs 6 → 3×
    headroom; halted execution fails both prongs). P1's write-time guidance aims at ≤3;
    the gate blocks at defect level, not aspiration level.
18. **D3 is enforceable at a 7% book-level rate.** Strawman-family distractors (giveaway
    lexicon, key not sharing the family): top-5 measure 0.5–4.8%; halted execution 12.3%;
    only 9/135 catalog books exceed 7%. Blocking at >7% with the P3 write-time rule
    carrying the "chapter explicitly teaches against the named move" exception (the
    lexicon rate-cap absorbs legitimate uses — atomic-habits' anti-motivation teaching
    keeps it at 3.8%).

### Round 2 (independent adversarial reviewer, 2026-07-03 — 25 attacks; all deltas ADOPTED)

The full attack report is preserved verbatim in the campaign log. Verdicts: 2 BREAKS,
14 NEEDS-DELTA, 9 HOLDS. Every delta below is binding on the implementation:

- **#1 BREAKS → C3 persistence discipline.** Tiebreak reads share content/doc hashes, and
  `persistReview` + the clears ledger are last-write-wins — a lone PASS persisting after a
  majority FAIL would mint a carryable clear (ship-a-bad-chapter hole). FIX: extra reads
  are adjudicated WITHOUT persistence; after the majority is composed, all reads append to
  history in fixed order with the DECIDING read persisted last as the latest-pointer; a
  clear is minted only on a majority SHIP.
- **#2 → C3 trigger tightened.** Flip signature = `valid && composite ≥ bar && keys 9/9 &&
  ship84 === false`. Any keyCheck disagreement regens as today (majority must never paper
  over a real key defect — P3's harder distractors make that case more common).
- **#3 → forensics corrected.** Review-phase FAILs were 4, not 5; ch08's initial FAIL was
  83.6 < bar (a true fail, correctly regened — not a flip). Flip set: ch01/ch03/ch05/ch07.
- **#4 → overridden complaints survive.** When a tiebreak converts to SHIP, the FAIL read's
  must-fix lines persist to a durable side-record; C2's churn pack includes them for
  targeted chapters (the early signal stays aggregatable).
- **#5 BREAKS-adjacent → C4 force-include.** Round-2 sample = round-1 regen targets
  FORCE-INCLUDED, remainder filled by the salted rotation — round 2 always re-reads the
  repaired bytes (otherwise accept-on-lottery / brick-on-untouched).
- **#6 → salt plumbing pins.** Salt = the raw roundLabel ("" round 1 → unsalted,
  byte-identical to score.py parity; "-round2" salts). Control read stays unsalted.
  THREE pinned tests: default parity, round-1/control unsalted, round-2 salted.
- **#7 → C1 migration.** At first v2 load, when the current lineage IS computable, v1
  counts migrate ONTO that lineage (raw copy kept under `legacyConsumed`). Re-entering the
  same halted design before a recompile keeps its caps (no upgrade-without-recompile
  reset); the rerun's brief recompile (new dealt fields) re-keys honestly.
- **#8 BREAKS (textual) → unknown lineage = INFRA halt.** An uncomputable lineage
  (unreadable packet/brief) halts infra with the explicit reason — never fail-open the
  cap, never fake a content cap-exhaustion.
- **#9 → loader dual-accepts v1+v2**, migrates on write, never clobbers `legacyConsumed`;
  mixed-file round-trip is a pinned test. (Rollback hazard documented: v1 code reading a
  v2 file sees an empty ledger.)
- **#10 → lineage is per-chapter.** hash(this chapter's packet content identity + this
  chapter's dealt rotation fields + rotation schema version). Book-level lists
  (frameworkNouns) EXCLUDED — one packet touch must not re-key nine budgets.
- **#11 → torn-ledger strengthen.** A present-but-unparseable ledger file halts infra
  (was: silent empty).
- **#12 → P1 re-aimed.** Measured: `owner` occurs 0× in the packets — the worst saturator
  is model-emergent, not packet vocabulary. P1 computes from fact TEXT + case labels +
  hardSpecifics only (never raw packet JSON), AND the card gains a mechanical referent
  rule for the emergent class ("name people by their case names/titles; a generic
  role-noun is a budgeted word"). P1 covers packet-derivable saturation; the emergent
  remainder is D1's (chapter-measuring) + C2's job. Plan wording updated.
- **#13 → P2 dealer spec.** Intra-chapter distinctness required (implemented:
  dealLensTriples deals without replacement within a chapter; triples offset-advance
  across chapters).
- **#14 → friction example dealt to 2/3 of chapters, not 9/9.** A dutiful failure-example
  in every chapter is the next stamped ritual; dealing to ceil(2N/3) guarantees ≥1 in any
  4-chapter sample (N−ceil(2N/3) < 4 for N ≤ 11) without the ritual.
- **#16 → explanation stem ban.** Rule 5 demands the CONTENT (name why the most tempting
  wrong answer fails) and explicitly bans a fixed stem ("If you chose (b): …" ×162 is a
  new detectable template).
- **#18 → P7 states the band, not an absolute.** "Across the 9 questions: uniquely-
  shortest keys in ~2–4, uniquely-longest ≤3" — aligned with BOTH the preflight cap (≤4)
  and CHB8's 20–45% band floor (driving to zero inverts the signal).
- **#19 → spine exclusions.** The packet's coreMoveFactId is NEVER marked sharedSpine;
  the card line adds "this chapter's own move must still be taught in full" (fastRead
  self-containment survives).
- **#20 → D1 tier is calibration-gated through the SHIPPED code path.** The surface is
  pinned in code (fullReaderSurface mirrors the calibration script); Phase D re-runs
  top-5 + the 17-book CHB corpus through the real check and DEMOTES the blocker tier to
  advisory on any false positive. No title-token exemptions exist to get wrong.
- **#21 → C2 target priority + divergence dealing.** Reader-NAMED chapters first,
  saturation contributors fill to cap 3; each target gets a DISTINCT divergence
  assignment (vocabulary / scene class / distractor semantics — deterministic from the
  measured report) so three writers with one identical pack don't converge on identical
  avoidance.
- **#22 → exception stated.** C2's churn pack IS cross-chapter context — allowed
  exclusively in the post-acceptance repair round, where the leak is the repair signal.
- **#25 → tone lever promoted (P8) + shell honesty.** P8: the author card path asserts a
  non-null voice card for books with profiles (execution's exists; verified in Phase D
  by rendering); and the plan states plainly that the whatToDo/whyItMatters example shell
  is SCHEMA-fixed — readers naming "the same what-to-do shell" are seeing the contract,
  not a writer defect; the dramaturgy lenses vary everything inside it.
- HOLDS confirmed: #15 (guardrails shipped in each lens instruction), #17 (keyCheck-
  disagreement rate is a named rerun watch-metric), #23 (no contract/schema surface
  touched), #24 (worst-case +36 reads ≈ 19 min ≪ one avoided 14-min regen).
