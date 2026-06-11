# Continue rework — Step 2 (write chapters 8–88)

You are the **writer agent (Codex)** resuming an interrupted Step-2 session on the
ChapterFlow v21 pipeline. A previous session wrote chapters 1–7 and was lost. Your
job is to finish the remaining **81 chapters (ch08–ch88)** to the same standard.
This is a continuation, not a redo — **do not touch ch01–ch07.**

## Your canonical instructions
Follow `agent-prompts/STEP-2-WRITE-CHAPTERS.md` in full — it is the authoritative
composition rubric, schema, forbidden-move catalog, and gate loop. Everything below
is continuation-specific context layered on top of it. If anything here seems to
conflict with that file, that file wins on *how to compose*; this file wins on
*what's already done and what's left*.

## Where the work stands
- **Step 1 (source): complete.** Run id `20260601-083527`. All 88 source sidecars,
  the toc, and the 88-entry chapter index exist on disk.
- **Step 2 (chapters): 7 of 88 written.** Done: ch01 (Introduction "The new
  reality") + ch02–ch07 (the full "Takedowns" section). **Remaining: ch08–ch88.**
- Step 3 (finalize): not started — **not your job.**

Section map of the remaining work (one native chapter per essay, 88 total):

| chapters | section |
|----------|---------|
| ch08–ch18 | Go |
| ch19–ch29 | Progress |
| ch30–ch40 | Productivity |
| ch41–ch45 | Competitors |
| ch46–ch50 | Evolution |
| ch51–ch61 | Promotion |
| ch62–ch73 | Hiring |
| ch74–ch78 | Damage Control |
| ch79–ch87 | Culture |
| ch88 | Conclusion |

## How to resume (the pipeline tracks progress for you)
```bash
cd /Users/radinsoltani/ChapterFlow
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts next-task rework
```
It will point you at **Chapter 8 "Make a dent in the universe"** and print the
source path and save path. Compose the chapter, gate it, then re-run `next-task`.
Loop until `next-task` stops saying `write-chapter` (it will say `derive-artifacts`
/ `finalize` / `ALL DONE`) — then STOP and report. Do not run finalize, derive,
generate, generate-book, promote, or research.

Paths for each chapter `NN`:
- Source (your primary input): `.chapterflow/runs/rework/20260601-083527/sidecars/source/chNN.source.json`
- Save to: `scripts/book/prompts/chapterflow-v21-authored/state/chapters/rework-chNN.v21-native.chapter.json`

## Non-negotiables for THIS book (read before writing ch08)

1. **Anchor every field in that chapter's own sidecar.** Open
   `chNN.source.json` first and pull its `namedExamples`, `centralConcept`,
   `hardEdge`, and `paraphraseNotes`. Every scenario must reference a real proper
   noun from the sidecar (a real company/person/product Fried & DHH actually use —
   37signals/Basecamp, Crew, "planning is guessing", etc.). A scenario that could
   live in any chapter is wrong. This is the single most important rule; skipping
   it is the root cause of the word-salad collapse QC has killed other books for.

2. **You MUST read the already-written chapters before composing each new one.**
   This book is 88 chapters, so cross-chapter de-duplication is the dominant risk —
   the book gate computes its caps over ALL 88 and fails closed on duplicates.
   Before each chapter, skim every `rework-ch*.v21-native.chapter.json` already on
   disk and actively avoid reusing:
   - **protagonist names** (gate fails closed on any reuse — keep a running list;
     7 chapters already burned 6 names per chapter, so ~40+ names are taken before
     you start, and you'll add ~5–6 per chapter × 81 more — track them),
   - **hook first-words** (gate caps clustering at 50% of the book),
   - **counterintuition shapes** — do NOT default to the "X is not Y. [correction]"
     negation shell; it already flagged B11 on sibling books. Vary the paradox shape.
   - **quiz question openers** — vary the Q-position phrasing across chapters; do
     not reuse a fixed opener like "A reader wants…" / "A friend says…" in the same
     slot every chapter (that flagged BP16 on sibling books),
   - **scene skeletons** — do NOT reuse one "Name, a ROLE, sits at TIME in a PLACE"
     opener with nouns swapped. Vary opener style (time-first, place-first,
     dialogue-led, data-first, role-action) and stakes across chapters.
   - **5+ word distractor / example phrases** (gate fails closed on cross-chapter
     repeats — BP20 / BP2 / BP3 territory).

3. **Quiz answer keys must be correct.** For each of the 9 questions, the
   `correctIndex` must point at the genuinely correct choice and the `explanation`
   must justify THAT SAME choice. Distractors are plausible-but-wrong, never
   sentence fragments. Distribute correctIndex 3-3-3 (4-3-2 ok, never 5+ of one
   position), and make each chapter's 9-position sequence differ from every prior
   chapter's (AS12).

4. **Match the voice already established in ch01–ch07** — Rework's terse,
   contrarian, short-essay register (Fried/DHH). Read a couple of the existing
   chapters to calibrate before writing ch08.

## Gate as you go — no shortcuts
After EVERY chapter, before moving on:
```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts gate-chapter \
  scripts/book/prompts/chapterflow-v21-authored/state/chapters/rework-chNN.v21-native.chapter.json
```
Trust the final `Gate verdict:` line; it must report **0 blockers** before you
re-run `next-task`. Do not batch-write and gate only the last one — QC checks for
exactly that gaming pattern and will bounce the whole book.

## Done condition
- ch08–ch88 all exist on disk (ch01–ch07 untouched and unchanged).
- Each chapter: `gate-chapter` → 0 blockers.
- Whole book: `npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts book-gate rework`
  → `Book gate: PASS`, 0 blockers. (Run this yourself as a final self-check; the
  human QC reviewer will run it independently and also read raw content for
  correctness, so a GREEN gate is necessary but not sufficient — make the content
  actually right.)
- STOP at finalize. Report: chapters written, per-chapter blocker counts, final
  book-gate blocker/major counts.
