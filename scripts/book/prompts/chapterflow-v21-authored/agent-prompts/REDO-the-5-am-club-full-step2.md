# Redo `the-5-am-club` — FULL Step-2 regeneration (previous output was corrupted)

You are re-writing **all 18 chapters** of `the-5-am-club` from scratch. The previous Step-2
output was discarded because it was corrupted. Step 1 (research) is intact and good — you compose
from it.

This is **not** a surgical fix. There is nothing to patch — the prior chapters were word-salad in
every field and have been deleted. You are producing 18 brand-new `ChapterV21` JSON files.

---

## Why this redo exists (read this — it is the failure you must not repeat)

The previous Step-2 run did not actually *write* the chapters. It looks like a script jammed raw
source-note fragments and **unsubstituted placeholder tokens** into fixed skeletons. The result
was grammatically broken across the breakdown tiers, examples, quizzes, cards, AND implementation
plans. Verbatim sample (ch1, quiz Q1):

> **prompt:** *"Irene studies Pain becomes a doorway when it forces honest inventory beside the
> inventory term sheet. The team mentions Money. Which choice fits crisis as threshold?"*
> **choice [0]:** *"Let Irene protect Her wealth and status are present in the setting, but they do
> not help before threshold takes the room."*

Notice the tells: bare concept tokens dropped mid-sentence (`Money`, `threshold`, `inventory`,
`Spellbinder`), source claims pasted in raw, sentences that do not parse, and a "Let [Name]
protect/answer/postpone …" choice skeleton. **None of it is readable English.**

Critically: **every deterministic gate PASSED on this garbage** (per-chapter ship gate 0 blockers,
book-gate PASS, 54/54/54 answer balance). The gates check *structure* — field presence, choice
counts, position balance, n-gram templating, banned phrases — but **not whether the prose is
coherent.** So you cannot rely on `gate-chapter` to tell you the prose is good. You must read it.

**Root cause to avoid:** do **not** use any helper script to generate prose by substituting
source-note fields into a template (this is the documented anti-pattern in
[STEP-2-WRITE-CHAPTERS.md] and the Codex playbooks). Compose every field as original, coherent
prose written from the chapter's source notes.

---

## The non-negotiable rule (the one that failed)

**Every field of every chapter must be coherent, grammatical, human-readable English.**

- No bare placeholder tokens. A concept name (`Victory Hour`, `Money`, `threshold`,
  `Spellbinder`) may appear only inside a real, grammatical sentence — never as a dropped token.
- No raw source-note fragments copy-pasted. Paraphrase into original sentences.
- **Quizzes:** each question is a real, answerable stem; each of the 3 choices is a distinct,
  grammatical statement; each explanation is a real explanation. And `correctIndex` must point at
  the genuinely correct choice. (Lesson from the `hooked` book: if you need to balance answer
  positions, **reorder the choices — do not move `correctIndex` off the right answer.**)
- **Cards / implementation plan:** real fronts/backs, real if-then plans — no truncated or
  placeholder text.

If you would not be comfortable showing a sentence to a reader as finished product, it is not done.

---

## Follow the standard composition rubric

Read and follow [STEP-2-WRITE-CHAPTERS.md](STEP-2-WRITE-CHAPTERS.md) in full — it is the
authoritative quality rubric (source-grounding/SC9, decision-point scenarios/C3, distinct examples
across chapters/AS9, progressive breakdown tiers/E2, vary scenario openers, `correctIndex`
distribution by reordering, etc.). This redo does not override any of it; it adds the coherence
rule above and the book-specific notes below.

---

## Book context — The 5 AM Club (Robin Sharma, 2018)

It is a **parable**: a billionaire mentor (the Spellbinder), an entrepreneur, and an artist learn a
morning-mastery philosophy in exotic settings. Honor that world.

- **Voice:** ornate, aphoristic, grandiose, mentor-dialogue, capitalized framework names — but the
  app targets a **grade 8–9 reader**. Last run tripped `E1` (reading level) on most chapters; keep
  Sharma's flavor while staying readable. Plain words over academic vocabulary when both work.
- **Watch the phrase budget:** the prior output used **"rather than" 101 times** (budget 15).
  Use it sparingly.
- **Render Sharma's actual frameworks correctly — do not invent or distort them.** Use only the
  framework that belongs to each chapter per its source sidecar. Reference set:
  the Victory Hour (5–6 a.m.); the 20/20/20 Formula (20 min Move / 20 min Reflect / 20 min Grow);
  the 4 Interior Empires (Mindset, Heartset, Healthset, Soulset); the 66-Day Habit Installation
  Protocol; the 4 Focuses of History-Makers; the 10 Tactics of Lifelong Genius; the Twin Cycles of
  Elite Performance. Respect each chapter's `forbiddenLeakage` (don't pull a later chapter's
  framework forward).

---

## Files

- Source sidecars (compose ONLY from each chapter's own): `.chapterflow/runs/the-5-am-club/20260601-083520/sidecars/source/ch{NN}.source.json` (ch01–ch18)
- Chapter index (titles/ids): `state/indexes/the-5-am-club.json`
- Write each chapter to: `state/chapters/the-5-am-club-ch{NN}.v21-native.chapter.json`
- (Step 1 is intact — do not touch the sidecars, index, brief, or plans.)

---

## Procedure

1. Work **one chapter at a time**, in order. Open `ch{NN}.source.json` first and compose every
   field from it (Step 0 of the rubric). Write real prose — do not run any script that fills a
   template.
2. After each chapter, run:
   `npx tsx src/cli.ts gate-chapter state/chapters/the-5-am-club-ch{NN}.v21-native.chapter.json`
   It must report **0 blockers** before you move on.
3. **MANDATORY manual coherence self-check after each chapter** (the gate will NOT catch
   corruption): read the hook, all 3 breakdown tiers, all examples, all 9 quiz questions + choices
   + explanations, all cards, and the implementation plan. Confirm:
   - every sentence parses and reads as finished prose;
   - no bare placeholder tokens, no pasted source fragments;
   - each quiz question is answerable and its `correctIndex` matches its explanation;
   - the chapter's framework is named and used correctly.
   If any field fails, rewrite it before continuing.
4. After all 18 chapters, run:
   `npx tsx src/cli.ts book-gate the-5-am-club`
   It must report **Book gate: PASS** (0 blockers). Remember PASS alone is not sufficient — the
   manual reads in step 3 are what guarantee coherence.

## Done condition

- All 18 chapters written as coherent original prose (no placeholders, no fragments, no word-salad).
- `gate-chapter` on each: 0 blockers.
- `book-gate the-5-am-club`: 0 blockers.
- A manual read of every field across all 18 chapters confirms publishable English.

Report back: chapters written, per-chapter gate results, book-gate result, and explicit
confirmation that you read every field and found no corruption.
