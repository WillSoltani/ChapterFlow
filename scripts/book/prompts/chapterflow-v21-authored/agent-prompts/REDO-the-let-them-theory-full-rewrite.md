# Redo the-let-them-theory — FULL STEP-2 REWRITE (do not patch)

This book is not patchable. Every chapter is template word-salad across **every**
field — examples, hooks, counterintuition, tryThisNow, quiz, and review cards.
`book-gate` reports **109 blockers / 4 majors** spanning 6+ distinct classes
(F1, BP2, BP3, BP13, BP16, BP20). Per the QC playbook, when 5+ blocker classes
fire you do a full Step-2 redo from scratch, not surgical edits.

**But Step 2 alone will reproduce the same word-salad** — because the root cause
is upstream (see below). Fix the source first.

## Root cause — read this before doing anything

There is **no source freeze and no source sidecars** for this book:
`.chapterflow/runs/the-let-them-theory/` does not exist; no `*.source.json`,
no `toc.json` anywhere. The only grounding is `state/briefs/the-let-them-theory.manual-brief.json`,
and in it `coreIdeas` is `[]` and `targetReader` is `""` — empty.

With no real per-chapter source material, the writer fell back to slot-filling a
single template with concept-labels and place/time fillers. That is exactly why
you get strings like a concept being "studied" as a physical object at a
timestamp in a location. **You must produce real source notes (Step 1) before
re-running Step 2.** If you re-run Step 2 against an empty brief, you will ship
this same book again.

## What the corruption looks like (verbatim, so you can recognize it)

- Example title is two slot-fillers mashed together:
  `"Oakley's prom-night taco At college move-in"`
- Scenario uses `[concept-label] at H:MM AM in the [place]`, with the concept
  treated as an object someone "studies":
  - ch01: `"Hadley studies Oakley's prom-night taco bar at 7:17 AM in the college move-in, working as a founder with a dorm checklist."`
  - ch20: `"Nolan studies Chris and ADHD-related household chaos at 6:52 AM in the city council, working as a assistant coach with a public comment card."`
- `whatToDo` splices a label onto a raw source claim:
  `"Hadley should use Oakley's prom-night taco as the cue for this source claim: ..."`
- Quiz choices are spliced source-claim fragments that end mid-sentence; the
  "correct" key is meaningless because no choice is a coherent sentence:
  - ch01 Q1 key: `"Linnea uses Oakley's prom-night taco bar to release the outside-control piece and answers with Trying to keep everyone satisfied usually makes the self smaller."`
- Review-card fronts use the concept-label as a noun:
  `"What does Chris and ADHD-related make visible?"`
- The same scene wording, hook frame, counterintuition frame, and tryThisNow
  frame repeat across nearly all 20 chapters (BP2/BP3 template collapse).
- 10 protagonist names are reused as named characters across multiple chapters
  (F1): Hadley(ch1,14), Kendall(ch1,9), Orla(ch2,15), Chris(ch2,17,20), …
- Q3/Q5/Q6/Q8 prompts open with the identical phrase in all 20 chapters (BP16);
  100+ quiz n-grams repeat 5–40× book-wide (BP20).

## The fix — two phases, in order

### Phase 1 — redo Step 1 (source) so it is real
1. Re-run the Step-1 research/source step (`agent-prompts/STEP-1-RESEARCH.md`)
   for `the-let-them-theory` so it produces:
   - a real `toc.json` (the actual 20-chapter structure of Mel Robbins' *The Let
     Them Theory*), and
   - one `ch{NN}.source.json` sidecar per chapter under
     `.chapterflow/runs/the-let-them-theory/<runId>/sidecars/source/`, each
     containing **real, specific, named** material from that chapter — the actual
     scenes, the actual examples Robbins uses, the actual claims — not generic
     "control separation" filler.
2. Also fill the brief: `coreIdeas` must be non-empty and `targetReader` set.
3. Verify before proceeding: `npx tsx src/cli.ts check-source the-let-them-theory`
   passes, AND open 2 sidecars and confirm they name real cases from the book
   (check-source can pass on invented notes — read them).

### Phase 2 — full Step-2 rewrite from scratch
1. Delete the corrupted chapter JSONs:
   `state/chapters/the-let-them-theory-ch{01..20}.v21-native.chapter.json`
2. Re-run the writer against `agent-prompts/STEP-2-WRITE-CHAPTERS.md`, grounding
   **every field** in the per-chapter sidecar from Phase 1.

## Composition rules the rewrite must follow

### Examples
- The scenario is a real, concrete, human situation grounded in that chapter's
  source. A concept (e.g. "control separation", "the Let Them theory") is NEVER a
  person, an object, a place, or something a character "studies". People act;
  concepts are demonstrated by what people do.
- No `[concept] at H:MM AM in the [place]` template. No timestamp-in-location
  filler. No mashed-together titles.
- `whatToDo` is plain teaching prose, not a label + "this source claim:" splice.
- Each chapter's scene, characters, and wording are distinct. No scene sentence,
  hook frame, counterintuition frame, or tryThisNow frame may repeat across
  chapters (BP2/BP3 are structural — different scenes, not renamed ones).

### Protagonist / character names (F1)
- Give a different name to the example actor in each chapter and do not reuse a
  name as a named character in any other chapter.

### Quiz
- Every choice is a complete, grammatical, standalone sentence. No choice may end
  mid-clause or splice a raw source claim onto a stem.
- `correctIndex` must point at the genuinely correct choice, and `explanation`
  must justify **that same** choice. Distractors are plausible-but-wrong, not
  fragments.
- Vary Q openers across chapters: no fixed Q3/Q5/Q6/Q8 opening phrase reused
  book-wide. No 5+ word phrase may repeat across chapters' quiz choices (BP20).

### Review cards
- `front` is a real question; `back` is true and actually answers it. The
  concept-label is never used as a bare noun ("What does <concept> make
  visible?" is banned).

### Style
- `"rather than"` ≤ 15 uses book-wide (currently 66).

## Done condition
- Phase 1: `check-source` passes AND sidecars verified by reading as real source.
- Phase 2: every chapter rewritten, grounded in its sidecar.
- Per chapter: `npx tsx src/cli.ts gate-chapter state/chapters/the-let-them-theory-ch{NN}.v21-native.chapter.json` → 0 blockers.
- Book-wide: `npx tsx src/cli.ts book-gate the-let-them-theory` → 0 blockers.
- A human-readable spot check: pick any chapter, read its example + 2 quiz
  questions aloud — they must read as written by a person, with correct answer
  keys.

Report back: per-chapter blocker count, book-gate blocker/major count, and the
runId of the new source freeze.
