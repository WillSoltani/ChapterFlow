# QC Findings → Pipeline Fixes (v21)

Synthesis of the recurring defects found while QC-ing v21 books, written for the
team improving the generator/gates. Grounded in books actually reviewed
(`daring-greatly`, `dare-to-lead`, `unreasonable-hospitality`) plus institutional
incidents (`hooked`, `start-with-why`, `7-habits`).

---

## The one meta-finding (read this first)

**The deterministic gates verify structure, templating patterns (BP/AS/F catalog),
and register — they do NOT verify (a) factual correctness, (b) semantic coherence,
or (c) whether a field actually does its job** (back answers front, explanation
explains *why*, enumeration is complete). **And writers reliably template or paste
filler into any field that lacks a chapter-time detector** (Goodhart's Law). So
defects migrate to whichever field is currently ungated.

Consequence: a book can pass every gate GREEN and still be unshippable. This has
happened repeatedly (`hooked` shipped 21/72 wrong answer keys past GREEN; `7-habits`
shipped ruined because no one read a chapter). **GREEN is necessary, never sufficient.**

Counter-evidence that the generator *can* be excellent: `daring-greatly` came
through clean on every axis below. So this is **high generation variance under
weak detection**, not a fundamentally broken generator. The fix is twofold:
(1) reduce variance at generation, (2) add detectors for the currently-ungated
failure modes so bad runs can't pass.

---

## Severity-ranked defect catalog

### TIER 1 — Correctness defects (silent ship of ruined books; highest priority)

**1.1 Wrong answer keys.** `correctIndex` points at a wrong choice.
- Evidence: `hooked` — 21 of 72 questions keyed wrong, shipped past GREEN. `dare-to-lead` (early gen) ch01 Q1 keyed the worst option.
- Why gates miss it: the gate validates that `correctIndex` is in range and choices are well-formed — never whether the keyed choice is *true*.
- Pipeline fix: add an **LLM answer-key judge** as a required generation/finalize step (a `judge-quiz-keys` pass already exists in `src/scratch/` — promote it to a gate). For each question, an independent model answers cold and must agree with `correctIndex`; disagreement blocks.

**1.2 Key/explanation contradiction.** The `explanation` justifies a different
choice than the one keyed.
- Pipeline fix: in the same judge pass, verify the explanation entails the keyed choice.

**1.3 Echo-explanations.** `explanation` = "<keyed choice text>. <question text>" —
restates the choice and prompt, never says *why*.
- Evidence: `dare-to-lead` (early gen) — all 72 explanations were echoes. This is doubly bad: it reads as filler AND removes the natural cross-check (an echo can't expose a wrong key).
- Pipeline fix: detector — flag explanations whose token overlap with the keyed choice/prompt exceeds a threshold and that contain no causal language ("because", "since", "so that", contrast with distractors).

**1.4 Incomplete / wrong named-framework enumerations.** When a chapter rests on a
named N-part model, an enumeration drops or renames a part.
- Evidence: `dare-to-lead` ch07 — BRAVING (7 parts) listed as 6 (Accountability dropped) in `deepRead` and a memorable line; "confidentiality" used for the "Vault" letter.
- Why gates miss it: no concept of "named framework completeness."
- Pipeline fix: let the chapter plan declare its framework + canonical part list; add a detector that every enumeration of ≥half the parts lists **all** of them with canonical names.

**1.5 Card back doesn't answer its front.** Front asks "*when?*", back gives a
generic statement that never says when.
- Evidence: `dare-to-lead` ("When should BRAVING influence a leader?" → "Specific language lowers defensiveness…"); `unreasonable-hospitality` after a partial repair (fronts updated, backs left generic → systematic mismatch).
- Pipeline fix: LLM check per card — does `back` answer `front`? Cheap, high-value.

**1.6 Word-salad / concept-label-as-actor.** Concept names used as physical objects
or people.
- Evidence: `dare-to-lead` (early gen) — "Cleo lifts a productive vulnerability folder and points toward John Gottman trust research."
- Root cause: missing source grounding (see 4.3). The writer fills templates with label tokens.
- Pipeline fix: detector for known concept-labels appearing as grammatical subjects/objects of physical verbs; plus fix the source-grounding gap.

### TIER 2 — Cross-field & cross-chapter templating (systemic; the dominant defect by volume)

The unifying root cause: **the writer authors good `breakdown` prose, then reuses a
small pool of breakdown/source sentences as filler in cards, plans, examples, and
memorable lines** instead of composing each field for its own purpose.

**2.1 Review-card backs pasted verbatim from the breakdown.**
- Evidence: `dare-to-lead` — 4 of 5 card backs per chapter were a breakdown sentence pasted (32/40 book-wide).

**2.2 Implementation plans copy-heavy.** `ifThenPlans[].plan` pastes breakdown
sentences; `context` is a proper-noun label ("Brent Ladd at Purdue University")
instead of a situational trigger; `coreSkill` is a pasted paragraph.
- Evidence: `dare-to-lead` — all 3 ifThenPlans pasted, every chapter (24/24).

**2.3 Example scenarios padded with pasted, topically-mismatched filler.**
- Evidence: `dare-to-lead` ch07 — 6 examples were 3 pairs sharing two pasted sentences each; gossip/Vault material pasted into a *Generosity* example; Purdue self-trust pasted into *Reliability* and *Amends* examples.

**2.4 Identical content across ALL chapters.** A field is byte-identical book-wide.
- Evidence: `unreasonable-hospitality` — card backs 0/1/2/4/5 identical across all 20 chapters; `twentyFourHourChallenge` was 3 rotating templates across 20 chapters.

**2.5 Repeated definitions within one field.**
- Evidence: `dare-to-lead` ch07 `fullRead` defined Reliability/Accountability/Vault twice each; early gen repeated a clause ~25× (repetition ratio 0.78–0.86).

**2.6 Source-name-heavy / templated card fronts.** Three fixed front templates with
a proper noun slotted in: "When should X influence a leader?", "What does X add to
the practice?", "How does X change the next conversation?".
- Evidence: `dare-to-lead` — 6 of 8 chapters.

- Why gates miss Tier 2: the AS-series cross-chapter detectors exist but (a) don't
  cover cross-*field* paste (breakdown→card), and (b) silently disable on the
  chapterId bug (4.1). `book-gate` BP/F catch some but not these.
- Pipeline fixes:
  - **Cross-field paste detector**: flag any `reviewCards.back` / `ifThenPlans.plan`
    / `examples.scenario|whatToDo` / `memorableLines.text` sentence that appears
    verbatim (normalized) in `breakdown`.
  - **Cross-chapter identical-field detector** (case-insensitive): for each field,
    group values across all chapters; flag any field where distinct < ~0.9·N.
  - **Card-front template detector**: ban the three fixed front shells and
    proper-noun-as-subject fronts.
  - **Generation prompt**: explicitly instruct "compose each field for its own job;
    never reuse a breakdown/source sentence in another field," with the banned
    front templates listed.

### TIER 3 — Execution quality (YELLOW individually; together = "not publishable", e.g. 78/100)

- **3.1 FastRead repetition** — restates the thesis 3–4× instead of developing it (`dare-to-lead`).
- **3.2 Memorable lines too long/explanatory** — line #2 was 16–23 words carrying enumerations, not portable aphorisms (`dare-to-lead`, every chapter).
- **3.3 Uniform example scaffold** — every example opens "[Name] at [clock time] in [City]…" (`daring-greatly`) / "[Day] [time] in a [place]…" (`dare-to-lead`). Coherent but templated feel.
- **3.4 Generic implementation plans** — long, copy-heavy, not action-oriented.
- **3.5 Typography artifacts** — stray spaces before commas (`unreasonable-hospitality` breakdown).
- Pipeline fixes: max-word caps + "no list" rule on memorable lines; an intra-field
  repetition-ratio cap on each breakdown tier; vary the example opener; a final
  typographic lint.

### TIER 4 — Pipeline / infrastructure gotchas (process defects that *mask* content state)

**4.1 Gate blindness from chapterId casing.** `unreasonable-hospitality` chapterIds
are capital-U (`Unreasonable-hospitality-chNN`) while files are lowercase. The
case-sensitive sibling regex in `runIntraBookCheck` (`src/cli.ts`) matches 0
siblings, so AS5–AS12 (all cross-chapter detectors) **never fire** — `gate-chapter`
prints PASS without running them.
- Pipeline fix (high priority, tiny change): make the sibling match **case-insensitive**
  / normalize chapterId to the file slug at load. This single bug silently disabled
  half the templating safety net for an entire 20-chapter book.

**4.2 Two `state/chapters/` directories.** Repair/generate output can land in the
repo-root `state/chapters/` while gates and `promote-book` read the
`chapterflow-v21-authored/state/chapters/` copy.
- Evidence: a `dare-to-lead` repair landed in the root copy; the canonical copy was
  byte-identical to pre-repair, so a re-QC falsely read "the repair did nothing" —
  a full wasted cycle until mtimes/diffs were checked.
- Pipeline fix: one canonical chapters dir (symlink the other, or make the writer
  resolve the same path the gates use). At minimum, generate/repair should print the
  absolute path it wrote and assert it equals the gate's read path.

**4.3 Missing source sidecars; `check-source` passes vacuously.** `.chapterflow/`
was empty for `dare-to-lead` and `daring-greatly` — no `sidecars/source/chNN.source.json`
on disk. `check-source` returned "PASS (0/0/0)" because there was nothing to check.
Absent/fake source is the root cause of Tier-1 word-salad (no grounded named cases →
template-filling).
- Pipeline fix: `check-source` must **FAIL** (not vacuously pass) when expected
  sidecars are absent; Step 2 should refuse to generate against missing source.

**4.4 Stale finalize/promote artifacts.** Step 3 packages built *before* a repair
remain on disk; the shipped `book-packages/<book>.v21.json` still contains the broken
content even after chapters are fixed.
- Evidence: `dare-to-lead` package built 03:08 predated the 03:52 repair.
- Pipeline fix: `promote-book` should refuse if any chapter JSON is newer than the
  existing package, or always rebuild; stamp the package with source chapter hashes.

**4.5 `gate-chapter` display trap.** The top "Ship gate: PASS" line is chapter-only;
the authoritative line is "Gate verdict:" (adds intra-book blockers). A display quirk
could show PASS up top with a blocker below.
- Pipeline fix: collapse to a single verdict line; make exit code the source of truth.

---

## If you fix only five things (highest leverage)

1. **LLM answer-key + explanation judge** as a required gate (Tier 1.1/1.2/1.3) — stops the class that silently ships ruined books.
2. **Case-insensitive sibling match in `runIntraBookCheck`** (4.1) — re-enables the entire AS5–AS12 net that's currently silently off for at least one book.
3. **Cross-field paste + cross-chapter identical-field detectors** (Tier 2) — catches the dominant defect by volume; both are simple normalized-string comparisons.
4. **Card-back-answers-front + framework-completeness checks** (1.4/1.5) — cheap LLM/structural checks for two recurring correctness misses.
5. **`check-source` fails on missing sidecars + single canonical chapters dir + rebuild-on-stale promote** (4.2/4.3/4.4) — removes the process traps that mask content state and waste QC cycles.

## What's already working (don't regress it)
- `daring-greatly`: clean answer keys, authored (non-pasted) cards, coherent grounded
  examples, sharp memorable lines, 0 cross-chapter dup. Proof the target quality is
  reachable. Use it as the golden reference for regression tests.
- `book-gate` BP/F/name-dup/hook-dup audits and the quiz-answer-position spread check
  are genuinely useful — keep them; they just need the correctness + cross-field +
  case-insensitivity gaps closed around them.
