# Redo Start With Why — examples[] only

You are rewriting the `examples[]` array in every chapter of the
**Start With Why** book package. Everything else in each chapter file
stays as-is. This is a surgical fix, not a rewrite.

---

## Why this redo exists

Your previous run shipped 14 chapters where every example position used
the same scene skeleton across chapters, with only the character name
and city swapped. Concretely, `examples[0].scenario` reads like this:

```
Ch1  ex[0]: "Anika   leans over a clipboard at 8:10 a.m. in the Oakland repair bay…"
Ch2  ex[0]: "Giselle leans over a clipboard at 8:10 a.m. in the Denver running store…"
Ch3  ex[0]: "Marisol leans over a clipboard at 8:10 a.m. in the Phoenix bike studio…"
…
Ch14 ex[0]: "Thabo  leans over a clipboard at 8:10 a.m. in the Hanna cross-country course…"
```

The same templating runs through `ex[1]` ("At 3:25 p.m. in the…"),
`ex[2]` ("memo is open on the table at 11:40 a.m. inside…"), `ex[3]`
("By 6:05 p.m… three messages from…"), `ex[4]` ("Inside the … at
9:15 a.m."), `ex[5]` ("studies the calendar near the … at 4:50 p.m.").

A new blocker critic (AS9 — chapter-example similarity) was added to
the pipeline. It compares `examples[i].scenario / whatToDo /
whyItMatters` at the same position across chapters using word-multiset
overlap (so name + city swaps don't evade it). At ≥70% overlap it
fails the chapter ship gate. Your previous output triggers AS9
**248 times** across the 14 chapters. You need to rewrite the examples
so each one is grounded in **that chapter's** source material instead
of in a generic template.

---

## Files

- **Source notes per chapter** (READ — your raw material):
  `.chapterflow/runs/start-with-why/20260521-062153/sidecars/source/ch{NN}.source.json`

  Each sidecar has `namedExamples` (the real-world cases Sinek uses in
  that chapter — Apple, Wright brothers, TiVo, Southwest, MLK, etc.),
  `centralConcept`, `hardEdge`, `keyClaims`, `paraphraseNotes`.

- **Chapter JSON to modify** (EDIT — only the `examples[]` array):
  `scripts/book/prompts/chapterflow-v21-authored/state/chapters/start-with-why-ch{NN}.v21-native.chapter.json`

  Touch nothing except `examples`. Do not modify `hook`, `breakdown`,
  `quiz`, `reviewCards`, `implementationPlan`, `memorableLines`, etc.

- **Book toc** (READ — voice charter):
  `.chapterflow/runs/start-with-why/20260521-062153/source-freeze/toc.json`

  Use `authorVoice.signatureMoves` + `authorVoice.avoidMoves` to
  preserve Sinek's plainspoken third-person register.

Chapters 1–14 map to `ch01` through `ch14`.

---

## What "good" looks like for an example

Each `examples[i]` is an object with this shape (keep the keys):

```json
{
  "exampleId": "ex01",
  "title": "Short concrete label",
  "tags": ["the chapter's central concept", "domain"],
  "planSpec": { "domain": "...", "audience": "...", "stakes": "..." },
  "scenario": "A 2–4 sentence concrete scene — who, where, what they're about to decide.",
  "whatToDo": "1–2 sentences on the move the actor makes that embodies this chapter's central concept.",
  "whyItMatters": "1–2 sentences naming the reason this is the better path, in this chapter's terms."
}
```

Keep `exampleId` (`ex01`–`ex06`) as the index requires. Keep
roughly 6 examples per chapter (match the existing count).

### Each example must

1. **Be rooted in this chapter's `namedExamples`.** If Ch1's named
   examples are car-door assembly (American vs Japanese plants), a
   pilot-training scenario, and a hospital diagnosis culture, then the
   six examples in Ch1 should be drawn from or analogous to those
   cases — not invented set pieces about "Anika in the Oakland repair
   bay." It is fine to abstract one Sinek example into a parallel
   modern scenario (e.g. a manufacturing line, a clinic, a software
   release) as long as the move being illustrated is faithful to
   Sinek's claim in that chapter and the surface details are different
   from any other chapter.

2. **Use a scene structure that's different from every other example
   position in every other chapter.** Concretely, after you write
   Ch2's `examples[0].scenario`, compare its word set to Ch1's
   `examples[0].scenario`. If they share ≥60% of their non-trivial
   words (i.e. you reused "leans over a clipboard at 8:10 a.m. in
   the…"), rewrite Ch2's `examples[0]` from scratch with a different
   time, setting, role, and inciting action. Same for `whatToDo` and
   `whyItMatters`.

3. **Sound like Sinek, not like a screenplay.** Plainspoken third
   person. No invented dialogue, no theatrical action verbs
   ("She slams the binder"), no proper-noun character names with
   exotic spellings (Anika, Giselle, Marisol, Asha…). Default to
   generic roles ("the plant manager", "the founder", "the head of
   sales") and real organization references from the source notes
   (Apple, Southwest, TiVo, Wright brothers, MLK, Continental, Bell
   Labs, etc.) where Sinek already cites them.

4. **Make the chapter's central concept legible.** A reader who
   forgets the chapter title should still be able to identify which
   chapter the example belongs to from `whyItMatters` alone.

---

## Forbidden moves

- **No shared scene skeleton across chapters.** No "leans over a
  clipboard at 8:10 a.m.", no "memo is open on the table", no "By
  6:05 p.m., [NAME] has three messages from…". Each example position
  in each chapter is fresh.

- **No fictional first-name characters** (Anika, Giselle, Marisol,
  Hugo, Thabo, etc.). Use roles or named people from the source notes.

- **No mechanical name/location swap.** If you find yourself thinking
  "I'll keep the Ch1 scenario and swap the city," stop. Start the
  scenario over.

- **No salt tokens, no nonsense phrases, no decorative adjectives
  added just to defeat similarity detectors.** Write clean prose. If
  AS9 still fires, rewrite the scene structure, not the surface words.

---

## Procedure

Work through chapters in order (Ch1, then Ch2, then Ch3 …). For each:

1. Read the chapter's source sidecar
   (`.chapterflow/runs/.../sidecars/source/ch{NN}.source.json`) and
   the chapter JSON to confirm the central concept, hardEdge, and
   what claims the examples should illustrate.

2. Compose 6 new examples. As you write each one, check that its
   scene structure is different from the same-position example in
   every chapter you've already done.

3. Write the chapter JSON back with only the `examples[]` field
   changed. Preserve formatting (2-space indent, trailing newline) so
   the diff stays clean.

4. Move to the next chapter.

After all 14 chapters are rewritten, run this verification:

```bash
cd scripts/book/prompts/chapterflow-v21-authored
for n in 01 02 03 04 05 06 07 08 09 10 11 12 13 14; do
  npx tsx src/cli.ts gate-chapter start-with-why-ch$n 2>&1 | tail -20
done
```

Every chapter must report **zero** AS9 findings. If any AS9 finding
remains, the failing example needs to be rewritten with a different
scene structure (not a word swap).

---

## Done condition

- All 14 `start-with-why-ch{NN}.v21-native.chapter.json` files have
  fresh, non-templated `examples[]` arrays.
- No other field in any chapter has been modified.
- `gate-chapter` reports zero AS9 findings on every chapter.
- Examples are grounded in each chapter's `namedExamples` and reflect
  Sinek's plainspoken third-person voice.

Report back the count of AS9 findings per chapter (should all be 0)
and the count of total examples rewritten (should be ~84 = 14 × 6).
Do not run the book gate or finalization — that comes after this
redo passes.
