# v23 Pipeline Audit — 2026-07-02

**Auditor:** Claude (pipeline architect role, per owner request)
**Evidence base:** today's full-stack POM regeneration (81 codex sessions, 3 repair passes, 6-reader blinded panel), the P01–P15 campaign record, and the shipped 130-book catalog.

---

## 1. Verdict

**The pipeline is overengineered in its generation path, and that overengineering is exactly what overloads the agents. They are the same problem.** Every content defect ever found became either a new gate, a new quota, or a new dealt vocabulary. Constraints accumulated until a writer producing one section of one chapter receives a **41,651-character task card** (~10k tokens, 63 hard-constraint lines) and has no attention budget left for the thing you actually want: *good, informative, interesting, easy to read*.

The proof is paired and blinded: the **Jun-27 book produced by the older, simpler pipeline beats today's full-stack v23 output 6/6 readers** (composite −8.5 on ch01, −7.6 on ch09; 0/6 would ship the new one at your ≥84 bar). The elaborate pipeline converges every deterministic gate first-pass — and produces a worse book.

## 2. The numbers

| Measurement | Value |
|---|---|
| Task card for ONE section pack (ch01 example-pack) | 41,651 chars, 1,014 lines, 63 constraint lines |
| Distinct SEC check IDs in the section gate | 126 (2,633-line file) |
| Total gate/critic/check code | ~20,700 lines |
| Codex sessions spent today (one book, not shipped) | 81 |
| Writers per chapter | 4 blind section writers (48/book) + polish + repairs |
| QC reads per round | sweep + keyA + keyB + bar + confirm + scouts + shadow |
| Panel-3 verdict (old vs new) | old preferred 6/6, Δ −8.5 / −7.6, new 0/6 ship |
| Old pipeline's same book (Jun-27, v21/v22 path) | published 11/12 first-round; readers now score it 88–90 |

## 3. Root cause — the pipeline writes like a machine and judges like a human; it should be the reverse

LLM writers are good at coherent, interesting wholes and bad at satisfying 30 simultaneous constraints. Deterministic code is good at checking a few crisp things and terrible at judging interestingness. v23 has this inverted on both ends, which creates three self-defeating loops (all observed live today):

**Loop A — the dealer fights the scout.** Blueprints deal structure from small vocabularies (ifThen shapes: **5**, action mechanisms: 9, weekly forms: 8; hooks were 3 until P11). Small pool × 12 chapters = a visible rotation. The variety scout — an LLM structure-detector with no bounded taxonomy — then blocks the pipeline's own dealt output. I ran three coordinated repair passes today: each cleared its layer and the scout correctly found the next one (unit shells → the 5-shape ifThen rotation → cast/anchor bleed). Output generated from a finite structure grammar will *always* have another shared layer for an unbounded detector to find. This loop cannot converge by design.

**Loop B — quotas manufacture the defects the rubric punishes.** Fact floors, verbatim hardSpecifics quotas, per-unit anchor requirements, and case-linkage rules force label-phrases and named programs into prose. Readers called it exactly: "repeats the cold-water point heavily," "overpacks the chapter with named programs," and the new chapters came out ~40% longer — punished as padding. The single biggest reader complaint (within-chapter repetition + length) has **no gate at all**, while the pipeline enforces dozens of things no reader has ever mentioned.

**Loop C — blind repair converts templating into theater.** Per-chapter repair editors can't see the book, so they get coordinated structural assignments; assigned structure becomes the next rotation; and the repairs themselves degrade quality — readers called my pass-3 output "abstract calendar/process machinery." Blinded panel evidence: repair passes made the scout happier and the readers unhappier. You cannot inspect quality in.

**Calibration, measured:** the QC bar covers ~23/100 of your rubric's weight. The scout blocks families readers don't feel (nobody complained about deadline stamps); readers hammer things nothing gates (repetition, theater, length). The writers, the QC, and the rubric are three different definitions of "good." Your instinct was right.

## 4. What is genuinely working — keep it

- **Research layer** (post Jul-1): chapter-distinct source packets, SP14 templated-source gate, P13 fact ranking. Readers *praised* the new book's mechanism language and source range — that's this layer working.
- **Quiz machinery**: dealt answer-key patterns, tell metrics, blind key derivation. Quizzes went from the catalog's weakest point to 9/9 derivable, 0 tells, in both panels. Fully solved; don't touch.
- **Deterministic ship gates, provenance, session independence, publish gate** — cheap, consistent, reader-neutral. The infrastructure layer is good.
- **The fail-closed philosophy**: the P08 scout refused to send this book to QC, and readers agreed 0/6. Right instinct — wrong signal to gate on (structure families instead of reader experience).

## 5. The redesign — invert the middle, keep the shell

Your microservices instinct is already half-true: the pipeline **is** decomposed into idempotent verbs with JSON artifact contracts. The monolith isn't the process graph — it's the **constraint system** (the 41k task cards, the 126-check gate, the dealt grammars threading through everything). That's what gets decomposed. Seven services, each with one crisp contract:

1. **Research** *(keep, harden)* — book → 12 chapter-distinct source packets. Contract: `SourcePacketV1` + SP gates. Add: atomic hardSpecifics ("red phone", not "the Los Angeles hotel with a red phone by the pool") and the anti-restore/freshness fix for the research agent.

2. **Briefs** *(shrink Design 10×)* — per chapter, ONE page: the core move; 2–3 **owned** marquee cases (one-owner across the book — kills exemplar bleed); a disjoint named cast (kills Margaret×3); the dealt answer-key pattern; and a 5-line "already used by siblings, avoid" list. **Delete the dealt structure grammars** (hook/counter/ifThen/scene/beat shape pools). Pools become *reservations*, not *generators*. Structure comes from the writer's per-chapter judgment — which is where variety actually comes from.

3. **Write** *(invert)* — **one writer, one whole chapter**, receiving: the packet, the one-page brief, and a ~10-line house style card (plain verbs, short words, Flesch 72–84, honest limits, no filler, target length ≈ the Jun-27 chapters — an explicit density budget). One voice owns hook → breakdown → examples → quiz → cards → plan. This is how the catalog's 130 books were actually made, and it's what readers preferred today by 8 points.

4. **Verify** *(deterministic only, pruned)* — schema, source-grounding, quiz key soundness + tells + pattern, readability bands, name/case reservations, **new: within-chapter anchor-repetition cap and chapter length budget** (the two things readers punished hardest, currently ungated), cross-chapter opener/challenge-format uniqueness done *deterministically* (extract signatures, compare — no LLM judge in the write loop), and a banned-phrase shortlist cut back to cross-book signatures. Target: ~30 checks that are cheap, byte-actionable, and reader-correlated. Not 126.

5. **Review** *(the reader proxy — replaces most of QC's role stack)* — one strong blinded read per chapter scoring **your 10 rubric factors** with byte-verified quotes and a ship y/n at your bar, plus one whole-book read asking a reader's question ("did chapters feel same-y? name the worst three pairs") instead of a family taxonomy. 13 reads per book instead of 6+ roles × multiple rounds. The rubric is your ground truth — so make the rubric read *be* the gate. Keep the two-independent-reads rule only at the publish decision.

6. **Repair** *(regenerate, don't patch)* — a failed chapter goes back to a **fresh whole-chapter writer** with the review's specific complaints attached. Regeneration preserves voice; blind patching provably destroys it. Cap 2 attempts, then halt for you. Delete the routing table, slot salts, and multi-pass detemplate machinery from the loop — with no dealt grammar there's nothing to salt.

7. **Publish** *(keep)* — promote gates, package verify, provenance. Plus the known sandbox→live path fix.

## 6. What gets deleted from the loop

- 4 blind section writers + assembly seams → 1 chapter writer (48 → 12 writer sessions/book)
- Dealt shape grammars (the F16 five-move rotation dies at the root, not by widening pools forever)
- Verbatim-specifics quotas → "specific must appear" + atomic specifics at research time
- The scout→detemplate loop → whole-book reader-feel read + regeneration
- keyA/keyB/bar/sweep/confirm role stack per round → 1 review/chapter + 1 book read (+ publish confirm)
- The polish pass (a writer with a style card and a length budget doesn't need risk-gated polish)
- ~90 of the 126 SEC checks (keep the reader-correlated ~30; the rest exist to police seams and quotas that no longer exist)

**Session economics:** today ≈ 81+ sessions for a rejected book. Proposed: 12 writers + 13 reviews + ~6 regens + 2 confirms ≈ **33 sessions**, most of them doing creation instead of inspection.

## 7. Calibration becomes a loop, not a ratchet

The current invariant — "never weaken a gate" — ratchets constraints upward forever; that is the mechanism by which this pipeline overgrew. Replace it with **"never regress the reader score"**: you have 130 scored packages and a working panel method; freeze 3 books as an eval set, and any prompt/gate/pool change must hold or improve the blinded reader-proxy score on them. Gates become servants of the score instead of ends in themselves.

## 8. Migration — one cheap, decisive experiment first

1. **(half a day)** Stand up the Review service (the panel-reader prompt is written and validated — quote verification and key-derivation checks already work). Calibrate it against 3 books you've scored.
2. **(1–2 days)** Whole-chapter writer + one-page briefs behind `CHAPTERFLOW_ARCH=chapter` (the conductor already switches on an `architecture` option). Regenerate **POM ch01 + ch09 only**. Run the identical blinded panel vs the shipped book — today's harness, unchanged.
3. **If the panel flips positive** (it flipped +3.0 the one time a chapter was carefully hand-converged, so the ceiling is proven): full POM regen, then the backlog. The v23 compiler path stays intact and flagged for rollback.

## 9. An honest note

Part of today's evidence is mine: my two coordinated repair sweeps satisfied the scout's families and measurably worsened the book. That is not an agent failure — it is what *any* blind post-hoc repair does to coherent prose, and it's the strongest argument that quality has to be created at write time by an author who owns the whole chapter, then *verified* cheaply — not assembled from dealt parts and repaired into shape.

**Bottom line:** keep the skeleton (research → brief → write → verify → review → publish, as idempotent verb-services with small JSON contracts), invert the middle (author-shaped writing, machine-shaped checking, reader-shaped judging), and make your rubric — not the gate count — the thing the pipeline optimizes.
