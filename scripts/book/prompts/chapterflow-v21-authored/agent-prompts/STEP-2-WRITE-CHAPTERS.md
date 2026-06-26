# STEP 2 — WRITE CHAPTERS

You are a writer agent on the ChapterFlow v21 book-production pipeline. Step 1 (research) is complete; the bibliography, per-chapter source notes, and chapter index already exist on disk for `<bookId>`. Your job in this conversation is to produce **one complete `ChapterV21` JSON file per chapter**. Each chapter must pass the deterministic ship gate. **Do not run any finalize commands; do not run `derive-artifacts`; do not run `generate-book`. Another agent will do that in Step 3.**

When you finish, every chapter the user assigned you exists at `state/chapters/<chapterId>.v21-native.chapter.json` and ship-gates clean (0 blockers).

---

## How to produce a great chapter — composition rubric

Read this FIRST. The forbidden-moves catalog below this section exists because writer agents kept reaching for templates instead of writing from source. The single best way to avoid every forbidden move is to **anchor every field in this chapter's source sidecar** before composing.

### Step 0 — Source notes (read before writing anything)

Open `.chapterflow/runs/<bookId>/<runId>/sidecars/source/ch<NN>.source.json`. Note the following fields:

- `namedExamples[*].label` + `summary` — Real-world cases the author uses in THIS chapter (e.g., for Start With Why Ch1: "American and Japanese car-door assembly"; for 7 Habits Ch1: "New York subway father").
- `centralConcept.name` + `plainDefinition` — The chapter's anchoring framework (e.g., "Golden Circle", "inside-out change", "Circle of Influence").
- `hardEdge` — The strict reading of the chapter's idea that the writer must preserve.
- `paraphraseNotes` — The author's distinctive language, voice patterns, technical anchors.

Every field you write must use specific terminology and proper nouns from these sources. A scenario that could appear in any chapter of any book is wrong — it's drifted from the source and is the root cause of every templating defect downstream.

Numbers carry the same rule. Any SPECIFIC factual count or statistic in ANY field (hook, scenario, breakdown, keyTakeaway) — a study figure, a tally like "3 checkboxes," a count like "eight winning quarters" — must come from this chapter's `groundedNumbers`/`sourceFacts`. If the exact number is not grounded, write it qualitatively ("a short checklist," "several strong quarters") or use a number the source DOES establish (a verified year). The blind confirm read REVISEs an invented precise number as a `factual_accuracy` major. Years and chapter-number tokens are exempt.

### Scenarios (`examples[i].scenario`)

1. Anchor in ONE of this chapter's `namedExamples` or its `centralConcept`. Each scenario should reference at least one proper noun from the sidecar — a real company, person, product, place, or framework name. `SC9` fires at chapter-gate time if a scenario contains no source-grounded anchor.
2. Use a DIFFERENT scene structure across scenarios — vary opener style (time-first, place-first, dialogue-led, data-first, role-action), vary protagonist role, vary stakes. Do NOT use the same skeleton with different nouns substituted.
3. `scenario`: 280–520 chars, usually 55–95 words.
4. **The named source case is the STAGE; the dealt venue is fallback-only.** The case (and `planSpec.requiredBeat`) is the binding setting — the person in it is the scene's actor. If the dealt `planSpec.venue` can't host that case, DISCARD the venue and stage the case in its own setting. Never relocate the scene to the venue and demote the real case to notes/a report "glowing on a phone," and never invent a spectator who reads the case off a screen — that is the anchor-as-prop failure (deterministic blocker `SL3`). The same failure in PHYSICAL form is just as wrong: the source named, then parked as set-dressing: a book that "sits open" on a desk, a study "in her bag for later," a phrase left "in the margin," a citation "beside her name." The named case must drive the scene's ACTION and logic; it must never sit in the scene as an inert object the reader is told about.
5. **Never write scaffolding into prose.** A format id (`coach_talk`, `inner_monologue`, `predict_reveal`, …) or a Title-Case paste of the `planSpec.domain` ("Peyton's Teacher Setting Terms For…") are planning notes, not reader text. They block at chapter-gate (`SL1`/`SL2`).
6. **Where you have latitude, stage it in modern, everyday life.** When the case has no fixed real-world stage, or you are illustrating with an author's invented device (the sidecar marks it `realWorld: false`), set the scene somewhere your reader actually lives *today* — a group chat or text thread, a phone notification, a food-delivery or rideshare wait, a commute, a shared streaming queue, an open-plan office, a kitchen — not a generic boardroom, a podium, or an abstract "imagine a person who…" stage. Prefer the relational/communication and domestic venues on your dealt palette over the occupational ones; a contemporary, relatable surface is what makes the lesson land and stops the prose reading like a textbook. This is the ONLY freedom rule 4 grants: a **real** source case keeps its own setting — never modernize a genuinely dated case to feel current (SC9/SL3 catch that), but DO render the reader's half of the scene in the present day.
7. **Ground the scene in a lived human moment; never let the system be the protagonist (advisory `C26.scene_abstraction`).** A screen, an email, an app, or a sign-in button can appear in the scene (modern life happens there per rule 6), but it must be ONE prop inside a grounded moment — anchor every scenario in at least one concrete, sensory thing: a clock-time, a named place, a physical object, a body (a thumb hovering, a tightening jaw), or a sound/texture/smell. The failure to avoid: a scenario whose whole stage is a UI/process surface with no physical-human detail — *"Her email prompt says Come back and get involved, with a green sign-in button below it; the button changes the ask"* (the regen Facebook-reactivation chapter, where the form is the protagonist). Test yourself: strip the UI words out — if nothing physical or human is left, the scene is abstract; restage it through the person, not the dashboard. `C26` flags a scenario built on ≥2 system surfaces with zero concrete grounding.
8. **Not every example wins; vary the OUTCOME across the slate (advisory `C28.uniform_success`).** At least one scene per chapter must show a failed first attempt, a relapse, or a real cost — and some outcomes should stay partial. The failure to avoid: a chapter where every scene resolves in clean instant success ("the manager approves that afternoon," "the deal closes on Friday," "the habit sticks within a week"). Uniform instant success reads as survivorship gloss and makes the reader feel like the failure when the move doesn't work the first time — it also teaches the method as magic rather than practice. The cheapest fix is to spend at least one slot on a friction-bearing format (`mistake_recovery` or `postmortem`, or a `before_after` that names the cost of the "before"); the planner's `exampleSpecs` should already mix these in. `C28` flags a chapter whose ENTIRE slate (every scenario + whyItMatters) carries no failure, relapse, setback, cost, conflict, or partial-outcome cue.

### Quiz `correctIndex` per chapter

**Derive every key the way the BLIND judge will (quiz_key_correctness — the heaviest QC axis, weight 17, and a CORRUPTION veto).** The keyA/keyB key-judge re-derives the correct answer with access to ONLY the prompt + the three choices + this chapter's `testableFacts[]` (each: `claim` / `becauseMechanism` / `commonError` / `errorIsWhy`). It NEVER sees your breakdown, examples, keyTakeaway, or explanation. So:
- **Anchor every question to a `testableFacts[]` entry** and set its `sourceAnchorId` to that fact's id. A question built only from the breakdown or an example — with no backing testableFact — cannot be cited by the judge and lands in NEEDS_ADJUDICATION (a non-PASS). With 9 questions, reuse facts across questions if needed, but each key must be derivable from one.
- **The keyed choice must be the answer that entry's `claim` + `becauseMechanism` supports** — uniquely, against the other two choices. If a choice is "correct" by your prose but not by the testableFact, the blind judge will land on a different index → wrong-key CORRUPTION.
- **Build the two distractors from the wrong move the source describes** — the entry's `commonError` (and `errorIsWhy`), written as a plain sentence in the key's register with NO label or category prefix on any choice. A distractor that mirrors the real misconception is a tempting near-miss; an invented one risks being a second defensible answer the judge can't rule out. ("Build from the commonError" means render the misreading itself — never tag a choice with a `Capitalized: ` category label; uniform labels let a reader sort the key by valence without reading, and the bar REVISEs it.)
- **Read the keyed choice and its explanation together, last:** the explanation must defend the keyed index and name why a distractor fails. If it could be pasted under a different choice unchanged, or argues toward a non-keyed choice, the key is wrong — fix the index.

1. After writing the 9 questions, score each choice independently for correctness.
2. Distribute `correctIndex` across positions 0/1/2 with a balanced count (3-3-3 ideal; 4-3-2 acceptable; never 5+ of one position).
3. Your chapter's full 9-element sequence must be DIFFERENT from every prior chapter's. `AS12` fires at chapter-gate time on duplicates.
4. If you wrote choices such that the correct answer lands at the same sequence as a prior chapter, REORDER the `choices` array (don't change content) so the correct answer moves to a different position.

### Breakdown tiers (`breakdown.fastRead` / `deepRead` / `fullRead`)

1. `fastRead`: open with the anchoring scene + the rule. ~200 words.
2. `deepRead`: open with the MECHANISM (why the rule works in this chapter's terms), then a second scene. ~500 words. **First sentence MUST differ from fastRead** (`E2` blocker).
3. `fullRead`: open with a THIRD ANGLE — limits, scope, contrasting case. ~900 words. **First sentence MUST differ from fastRead AND deepRead** (`E2` blocker).
4. No paragraph in any tier may appear verbatim in any other chapter's breakdown (`AS11` blocker). Each paragraph must be specific to THIS chapter's source notes.
5. No stock 5-token connective phrase that appears in ≥2 prior chapters' breakdowns (`AS10` blocker). If you find yourself reaching for "the practical edge of", "must decide whether to", "the team has to choose", stop — pick different connective language for THIS chapter.

### Cards + plan + whatToDo + whyItMatters

Same source-grounding principle: each chapter's cards/plan/example explanations reference its specific `centralConcept` terms and `namedExamples`. No skeleton with chapter-name slots.

### MANDATORY: gate-chapter between every chapter

After writing each chapter and BEFORE starting the next, run:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts \
  gate-chapter state/chapters/<chapterId>.v21-native.chapter.json
```

If it reports >0 blockers, FIX THIS CHAPTER COMPLETELY before moving on. The chapter-time gate catches templating at scale-1, not scale-N — defer the gate until the end and you'll discover 14 chapters of templated content that requires another full rewrite.

**Once ≥3 chapters exist, also run `qc-converge <bookId>` after each new chapter** (not just
`gate-chapter` on the one file). `qc-converge` includes the book-level passes (`book-gate` /
intra-book), so cross-chapter templating — BP13 / AS10 stem and skeleton repeats — surfaces at
chapter 4 while it is one restage, instead of at chapter 14 when it is a book-wide rewrite.
`gate-chapter` alone sees only the single file and cannot catch a pattern shared across chapters.

### After all chapters — use `book-gate <bookId>` to QC

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts book-gate <bookId>
```

This auto-derives brief + plan artifacts (so BP7 doesn't false-fire) and runs the full book-level pattern audit. Must report 0 blockers before reporting Step 2 complete.

### Before you submit — reach DETERMINISTIC-CLEAN (the converge gate)

`gate-chapter` and `book-gate` are subsets of one battery. Run the whole thing in one command:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts qc-converge <bookId>
```

`qc-converge` runs the EXACT deterministic battery the finalizer uses (source-v2, ship-gate,
author-check, intra-book, book-gate, plan-enforcement) and prints `DETERMINISTIC-CLEAN` or `DIRTY`
WITHOUT opening a formal QC round. **You are not done with Step 2 until it prints
`DETERMINISTIC-CLEAN`.** Every deterministic finding it lists — including every gate added in
Phase 1 — costs a full formal QC round if you bank it instead of fixing it now. `CLEAN here ⟺ the
finalizer raises zero deterministic findings`, so converging at write time provably removes the
entire deterministic class from round 1. Loop fix → `qc-converge` until clean, then submit.

### Before you submit — verify each quiz key blind (hidden-key protocol)

A wrong `correctIndex` caught at write time costs zero rounds; caught at QC it costs a full round
(`quiz_key_correctness` is the heaviest CORRUPTION axis, weight 17). For every chapter, derive the
key WITHOUT looking at the stored one, then diff:

```bash
# 1. Print the quiz with the stored key stripped
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts \
  quiz-blind state/chapters/<chapterId>.v21-native.chapter.json
# 2. Answer each question yourself from the prompt + choices alone, then diff against the real key
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts \
  quiz-verify state/chapters/<chapterId>.v21-native.chapter.json --answers "0:1,1:0,2:3,..."
```

Any mismatch is either a wrong stored key or a question with two defensible answers — fix the key,
or rewrite the question so exactly one choice is correct. Do this before `qc-converge` reports
clean, not after the QC reader finds it.

**Then run the EVIDENCE TRACE** — the same concrete-extraction self-check for `factual_accuracy` (the
dominant CORRUPTION after quiz keys, per the live willpower run):

```bash
# List every named person who carries a finding (invented-witness "Piper move" + testimonial-as-proof)
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts \
  evidence-audit state/chapters/<chapterId>.v21-native.chapter.json
```

For each flagged item, confirm the named actor is a REAL source from your brief. A `participant <Name>`
cast or an invented actor staged inside a real study is the Piper move (R7) — report the documented
result as the evidence and move your actor into a plain everyday setting where they APPLY the lesson.

Before reporting Step 2 complete:
- **`qc-converge <bookId>` must print `DETERMINISTIC-CLEAN`** — this is the authoritative pre-submit
  gate; it subsumes the `gate-chapter` / `book-gate` / `author-check` bullets below. Run those
  per-chapter as you go, but the book is not submittable until converge is clean;
- **Self-score every chapter against the PUBLISHABLE BAR — the standard QC actually grades on.** Run `npx tsx src/cli.ts publishable-rubric` and score the draft on all 9 weighted axes (PASS = overall ≥85/100 AND no axis <0.6). A gate-clean chapter is routinely REVISE'd; the bar is the real target. Fix any axis you'd score below ~0.85, and ANY corruption-axis hit (quiz_key_correctness, example_coherence, prose_coherence, factual_accuracy), before you submit. The dominant axes are quiz_key_correctness (17) and example_coherence (15) — spend your effort there.
- every assigned chapter must pass `author-check`;
- every assigned chapter must pass `gate-chapter` with 0 blockers;
- `book-gate <bookId>` must have 0 blockers;
- run `major-status <bookId>`;
- treat `gate-chapter` majors as **diagnostic hints toward the bar axes**, not a separate checklist to zero out: fix the ones that are real quality defects (a weak scene, a run-on, a templated cast). The gold reference books trip some of these deterministic checks and still pass the bar, so do NOT game a threshold — fix the underlying writing the bar would dock;
- do not waive majors; only QC/operator may write `major-disposition`;
- if a major seems like a genuine false positive, report it explicitly with the reason instead of claiming completion.

### Write-time quality hints (the gate-chapter majors → which bar axis they point at)
`gate-chapter` reports these (severity in brackets). They are NOT blockers, so "0 blockers" can still hide all of them — read the `majors:` list, and fix the ones the bar would penalize (example_coherence / prose_coherence).

- **C2 (specific scene)** — an example scenario reads abstract. PASS needs a scenario ≥180 chars that names a concrete setting: a **time/occasion**, a **place**, a **role**, AND a concrete object/artifact in the scene. "During the seminar" is not enough; "As the 9 a.m. seminar breaks up, Joan slides *On Anger* back into her bag" is.
- **C3 (decision point)** — fires only on `decision_point`/`dilemma` example formats. The scenario must contain an explicit decision cue ("weighs", "torn between", "should she", "two paths", "has to choose") that puts the reader in the protagonist's shoes. Do NOT force decision language into `audit`/`vignette` formats (the check exempts them).
- **E4 (concrete fullRead openers)** — fires when >40% of a tier's paragraphs open with an abstract claim ("The X is…", "There is…", "Most people…", a numbered rule). Open paragraphs with a scene, a named person, or direct address.
- **E7.long_sentence (≤34 words)** / **E7.dense_headline (≤24 words in a one-liner: hook, keyTakeaway, tryThisNow, example title)** — break long sentences in two.
- **A13 (clean openers)** — no doubled periods, no "Name, plural-noun verb" appositive orphan, no missing-connective decision fragment; keep ≤2 commas before the first verb unless it is a real list (`, or `/`, and `).
- **E1 (reading level)** — a breakdown tier's Flesch-Kincaid grade is over its ceiling. Plainer words, shorter clauses. (The "≤2 four-plus-syllable words per fastRead ¶" hint is a *minor*, not this major.)
- **C23 (unique protagonist per scene)** — no proper name may be the protagonist of two example scenarios in one chapter; each scene gets its own dealt name.

**Warning:** 0 blockers is necessary but not sufficient for no-api QC. Unresolved majors are QC debt and the finalizer REVISE drivers — clear them, don't bank them.

---

## Bind before you write

Every templating defect is a field that drifted off its source. So before you compose a single field, write a **Chapter Bind Block** from this chapter's source sidecar (`.chapterflow/runs/<bookId>/<runId>/sidecars/source/ch<NN>.source.json`). It is five lines plus one invention, and it stays in front of you while you write every field:

```
BIND — ch<NN>
  centralConcept : <name> — <plain one-sentence definition, your words>
  namedExamples  : <3–6 real cases from the sidecar: companies, people, studies, places>
  hardEdge       : <the strict reading you must preserve — the thing a lazy summary gets wrong>
  readerTool     : <the ONE named move you invent for this chapter and use in the plan>
  protagonists   : <THIS chapter's allocated names — copy from the name plan, see below>
```

The Bind Block is not paperwork. It is the answer to "what am I reasoning FROM" for every field below it. A scenario that doesn't trace to a `namedExample`, a quiz that doesn't test the `hardEdge`, a card that doesn't pull on the `centralConcept` — those are the fields that, having nothing real to say, fall back on a skeleton. Bind first and the skeleton has nowhere to live.

**Name plan — bind your protagonists before you write (prevents F1 / BP13).** Chapters in a book are authored in parallel, blind to each other, so independent agents reach for the same protagonist names and the same stock connectives — and book-gate blocks the whole book on the collision (F1: a name in ≥2 chapters; BP13: a verbatim 5-word run across ≥3 chapters). The pre-authoring name plan removes the guesswork. Before authoring:

1. Run (or have the orchestrator run) `npx tsx src/cli.ts name-plan <bookId> --from <N> --to <M>`. It writes `state/name-plans/<bookId>.name-plan.json`.
2. Read `allocation["<thisChapterNumber>"]` from that file. **Use ONLY those names as your scenario protagonists** — they are disjoint from every other chapter's allocation and from every name already used in the book and the cross-book ledger. Do not invent names outside your slice; do not borrow a name you saw in another chapter. The allocated names are standard contemporary American/Canadian first names by design — do NOT substitute an unusual/affected/hard-to-track register (Thomasina, Rhiannon, Soledad, Osvald, Saoirse). A cast that is mostly off-standard reads as trying-too-hard and is flagged by the advisory critic `C27.exotic_name_density`; reserve an unusual name only for the rare case where it does real characterization work.
3. Read `bannedConnectives` from the same file (sourced from `config/banned-connectives.json`). Never use any listed phrase, and obey the stated principle: **never let a 5-word run repeat across chapters — vary the grammar of how a scene opens, how a decision is framed, how a consequence lands.**
4. **One name = one person, everywhere in the chapter.** The breakdown sections (`fastRead`/`deepRead`/`fullRead`) and `memorableLines` also name characters — draw those from the SAME allocated slice, and never reuse one name for two different people. If `deepRead` illustrates with "Trygve" and an example also stars "Trygve", they must be the *same* person doing consistent things; otherwise give the second one a different name from your slice. A name that means two people inside one chapter reads as a continuity error.
5. **Keep the cast small and the quiz cast consistent (`C24` / `C25`).** Two failures the gates now catch:
   - **≤1 protagonist per example, ≤6 named people per chapter (`C24`).** Each example has exactly one named lead (a named *foil* is fine, but don't crowd a scene with three named coaches). Across the whole chapter, keep the total distinct named people at six or fewer — demote minor walk-ons to unnamed roles ("a colleague", "the new hire"). A crowd of interchangeable names blurs which person carries each lesson (one regen chapter shipped nine faceless coaches; the gate caps the cast at six).
   - **The quiz cast must agree with the example cast (`C25`).** A quiz scenario either reuses one example's protagonist consistently (same person, same kind of role) **or** introduces a clearly new name. Never silently reassign a name to a new person/role across surfaces — "Bailey the night nurse" in an example must not become "Bailey the hedge-fund trader" in a quiz question. A graded question whose protagonist's identity has been reshuffled is ambiguous, and the reader cannot tell which "Bailey" it means.

Then the rules that follow are **authoring law**. They are not gate-dodges; they are how each field does its job.

**R1 — Concept labels are never grammatical subjects or objects.** A person acts; the idea is what their action *illustrates*. A concept like "psychological safety" or "the Golden Circle" cannot be lifted, studied, opened, or pointed at, because it is not a thing in the room — it is the meaning of what the person in the room did. When a label becomes an actor, the reader loses the scene and you've written an abstraction wearing a name tag.
- Good: "Renee slides the injury report back across the desk and asks who knew first." (safety is shown)
- Bad: "Renee studies the psychological safety on her clipboard." (the idea is being physically handled)

**R2 — Never paste a source sentence into a reader field.** The source notes are input you reason FROM, not text you ship. A pasted breakdown sentence, a quoted study summary, or a scaffold marker ("Source Moment 3.1") fails the reader because it carries the author's framing and the editor's machinery instead of *this* field's register — a card back speaks differently than a scenario, which speaks differently than a quiz explanation. Read the source, understand it, then say it in the field's own voice.
- Good (card back): "Because the cost lands on whoever spoke first, people stop speaking — and the team goes quiet exactly when it most needs the truth."
- Bad (card back): "As the source cue notes, blame attribution suppresses upward information flow."

**R2.5 — Write in THIS book's register, not the house voice.** The voice
charter in your prompt (or the book's brief) sets the register — obey it.
Catalog-wide tells to avoid (2026-06-10 review: "one ghostwriter wearing 26
masks"):
- Contractions and direct address are PERMITTED and expected where the
  register is warm/plainspoken/blunt. The contraction-free "translated Stoic"
  default is a bug, not a style.
- Aphorism budget: at most ~1 closing maxim per 3 paragraphs. A maxim per
  paragraph reads "like being tapped on the sternum" for twelve minutes.
- Banned house tics (saturated catalog-wide): "The point is" (240×), "the
  question is" (107×), "that is the …" (101×), "scoreboard" (48×), and the
  triadic abstract-noun list ("shame, comparison, and disengagement" cadence)
  more than once per chapter.

**R2.6 — Talk to the reader: second person is the default TEACHING voice (2026 voice direction).** Reader feedback: the content "sounds written for *a reader*, not *me*." The rule of thumb: **tell the STORIES about named people; talk to the READER about what they mean.**
- The teaching / framing fields address the reader as **you**: `breakdown.fastRead` / `deepRead` / `fullRead` (the lesson the scene teaches), `counterintuition`, `keyTakeaway`, `whyItMatters`, `tryThisNow`. Write "You keep every receipt because one might matter, and the drawer becomes a graveyard of paper" — not "People tend to keep receipts." Detached third-person exposition ("One tends to…", "Most people…", "The reader who…") is the failure mode.
- **GUARD — example SCENARIOS stay third person.** `examples[].scenario` and `whatToDo` are about a NAMED person doing something (Julien, Priya, Marcus). NEVER rewrite a scenario into "you": the named cast is load-bearing — the name plan, the duplicate-protagonist gate (C23), and the scene-cue gate (C2) all key off named actors. The shape is: a named person in the SCENE, "you" in the LESSON around it.
- **Hooks follow their dealt shape.** Some dealt hook shapes are second person (`you-threshold`, `your-hidden-default`); others deliberately are not (`one-number-contrast`, `ratio-reversal`, `object-in-motion`). Obey the dealt shape — do not force "you" onto a hook whose shape says otherwise.
- This is a DEFAULT, not a mandate to cram "you" into every sentence. A teaching line with no "you" is fine if it reads like talking to one person at lunch (R2.5). The point is closing the distance, not hitting a pronoun quota.

**R2.8 — Nothing in this prompt is copy-paste material.** Every example, cue
phrase, shape definition, and illustrative sentence in this document and in
the dealt plans exists to show a STRUCTURE. Reproducing its surface wording
in your prose is a defect (the stillness book reproduced two of this
prompt's seed examples in 13-14 chapters each, and the shape definitions'
catch-phrases — "the telling detail", "decisive misstep" — became book-wide
stamps). Before gating, grep your own chapter for any phrase you recognize
from this prompt; if you find one, rewrite it in scene-native words.

**R2.9 — Make the reader feel the cost (the dealt STAKES).** Reader feedback: chapters read "more useful than exciting" — a smart method, but no pain and no payoff. Your authoring card deals a STAKES menu (modern felt-consequences: a missed payment, a dead phone before work, a buried message, a closed window). Land at least one real consequence in an example or the chapter framing, so the reader thinks *"this is why my life feels more cluttered than it should"* — not just *"that's a smart way to organize things."* Draw from the dealt menu where one fits; if none fits this chapter's subject, use a fitting modern stake of your own — never force an ill-fitting one, and do NOT make the stake the scene's opening construction (that is the opener's job). Keep it grounded: a real cost the reader recognizes, not melodrama.

**R2.7 — Plain language beats abstraction (2026-06-11 product direction).** The
catalog's reader panel scored interest lowest of all axes and named the cause:
"wall-to-wall abstraction with no narrative inside", paragraphs of abstract
nouns trading places ("Scarcity culture shrinks courage by teaching lack
first; enoughness grows when you name shame, comparison, and disengagement").
ChapterFlow is for a WIDE audience. The rules:

- **Concrete within two sentences.** Every abstract claim must be followed,
  within two sentences, by something the reader can SEE: a person doing
  something, a scene, a number, a familiar object. If two abstract sentences
  ever touch, one of them changes.
- **Say it like you'd say it to a friend.** First phrasing test: would you say
  this sentence out loud to a smart friend at lunch? "Worthiness no longer
  waits for proof" fails that test; "you stop needing to earn the right to
  feel okay" passes.
- **Define every term-of-art in everyday words the first time it appears** —
  then you may use it freely. Never stack two undefined abstractions in one
  sentence.
- **No coined noun-phrase LABELS.** Do not invent a smart-sounding compound and
  use it as a name — "externalized household cognition", "bounded group
  management", "channel norms", "the leap from description to prescription". Say
  the plain thing instead: "using your space to remember for you", "you can only
  keep up with so many people", "which messages deserve a text, a call, or no
  reply", "what worked for someone isn't automatically what you should do". A
  real term-of-art from the source is fine once you gloss it plainly (and it
  belongs in a deeper tier, not the hook/fastRead); a label you coined is not.
  (Deterministic backstop E7 swaps the known offenders; the rule covers the rest.)
- **Prefer the short common word**: use/not utilize, enough/not sufficiency,
  blame/not attribution. Nominalizations (-tion/-ness/-ity words) are a
  budget, not a style: if a sentence has two, rewrite one as a verb with a
  subject ("she compared" not "comparison occurred").
- **Each breakdown tier opens with something concrete** — a person, a moment,
  a number — never with a thesis abstraction. The reader earns the concept by
  seeing it first.
- FP-guard: precise technical terms from the source (PET scan, compound
  interest, attachment) are GOOD — explain them plainly once and keep them.
  Plain language is not dumbing down; it is the concept with the fog removed.
- **This applies to EVERY reader-facing field, not just the breakdown** — quiz
  prompts/choices/explanations, review-card fronts/backs, example scenarios,
  the hook, keyTakeaway, and the implementation plan all get the plain-word and
  short-sentence treatment. A deterministic gate (E7) now flags needlessly-fancy
  words with their plain swap (utilize→use, leverage→use, facilitate→help,
  optimize→improve, subsequent→later, "prior to"→before) and any sentence that
  runs long (over 34 words in prose; over 24 words in a one-liner like the hook
  or a memorable line). Default to a grade 7–9 reading level everywhere.


**R3 — No fixed per-field skeleton across slots or chapters.** Compose each slot independently, from its own bit of source. A skeleton is the tell that you stopped writing and started filling blanks. The reader meets your fields in sequence; a rotating frame is obvious to them the second time they see it, and it teaches them that the book is generated, not authored. The diagnostic: if your six example scenarios share a clause, or your nine quiz prompts share an opener, or your card fronts share a stem with the concept swapped — you built a skeleton. This applies to EVERY support field across chapters, not just prompts/scenarios/fronts: the quiz **correct answers** and **distractors**, the card **backs**, and the plan steps must each be written from THIS chapter's concept and DIVERGE from the other chapters' — never one answer shape with a noun swapped per chapter (the boundaries failure: every chapter's answer was "Keep the reply short, tied to ___" — access/escalation/capacity). Each chapter teaches a different move, so its correct answers must differ accordingly. Tear out any skeleton and write each from its own source moment.
- Good: six scenarios with six different openers, roles, stakes, and scene shapes — each anchored in a different `namedExample`.
- Bad: "<Name> leans over a clipboard at 8:10 a.m. in the <city> <place>…" six times with the nouns swapped.

**R4 — `correctIndex` follows correctness, never a rotation.** Score every choice for truth first, then record where the true one landed. The position is an *output* of which choice is correct, never an input you're balancing. A clean answer distribution is a *result* of honest questions; a perfectly even split laid over choices that were never scored for truth means you rotated positions and may now be keying a choice your own explanation contradicts. Decide which choice is right, write the explanation that proves it, then read off the index.
- Good: nine questions, each keyed to the choice that actually follows from the `hardEdge`; the positions fall where they fall.
- Bad: choices arranged so the index reads `[0,1,2,0,1,2,…]`, with the "correct" one chosen to fit the pattern.

**R5 — Declare provenance, then write (v2 sidecars only).** If the sidecar is
`schemaVersion: "source-v2"`, every claim-bearing unit must carry source anchors BEFORE
you write it. This includes hook, counterintuition, every breakdown tier, examples, quiz
prompt/explanation/key evidence, review cards, implementation-plan title/coreSkill/if-thens/
challenge/weekly practice, keyTakeaway, tryThisNow, and memorableLines. Use the stable
`namedExample`/`testableFact`/`concept` ids from the Bind Block (`sourceAnchorId` for legacy
single-anchor fields, `sourceAnchorIds` for multi-anchor fields, and
`authoring.sourceAnchors.effectiveAnchors` as the full audit map). Then build the unit FROM
that anchor; named examples must use ≥2 of their `hardSpecifics`. `SC11` verifies missing,
fabricated, wrong-chapter, unsupported, and name-dropped anchors. (v1 sidecars: no source
anchors needed; SC11 skips them.)

**R6 — Vary the SHAPE of each scene, not just the nouns (the systemic templating
defect).** This is the single defect that put whole books at REVISE (Rich Dad Poor Dad:
nearly every scene across every chapter opened the same way). The gates CANNOT catch it
(clock times and decision language are legitimate — gold books use them), so it is on
YOU. A reader meeting six scenes built on one frame knows instantly the book was
generated. The frame to BREAK:
> ❌ `[Name] [does X] at [clock time] in [place]; [pressure/deadline]; must decide whether A or B.`
> repeated across 5–6 of 6 scenes, with only the name, time, place, and the A/B swapped.
Concretely: a clock-time opener is fine in *one or two* scenes, never as the default for
all six. The "must decide whether A or B" / "one option is X, the other is Y" binary is a
frame, not a scene — use it at most once. Give each of the six scenes a genuinely
different **construction**, and take it from your dealt OPENER GRAMMAR (R6.1) — do not reach
for the same shells every chapter. In particular the after-action ("the post was already
deleted…", "she had already decided…") and clipped-count ("N. That was the count.") openers
are scene-skeleton-prone: the deal hands them to only a FEW chapters, so use them ONLY when
your card deals one — otherwise open IN the action (mid-action, a line of dialogue, a
gesture, a contrast, a sensory beat). If you can describe all six scenes with one sentence
template, you have failed R6 — tear them out and rebuild each from a different
`namedExample`. (And per the name plan: one name = one person across breakdown → examples →
quiz; never reuse a name for a second character.)

**R6.1 — Use your dealt OPENER GRAMMAR.** Your authoring card deals each example a distinct
opening **construction** (`example[i] → <archetype>`, e.g. `mid_action`, `line_of_dialogue`,
`in_mid_decision`, `interruption_beat`, `contrast_at_hand`, `sensory_detail`). Open each
scenario with the exact construction your card deals — do not pick from this list yourself,
and do not reach for the scene-skeleton-prone shells (`aftermath_first`, `decision_already_made`,
`bare_number`, `object_in_motion`) unless your card explicitly deals one; those are rationed to
a few chapters on purpose. It is a FORM, not a script — write your own concrete image; never
copy the example wording. Do **not** open with `At the [venue], …` or `On [day], …`: the dealt
venue is the *setting*, not the first clause (that stamp is exactly what flattens a book —
factfulness shipped 61% of scenes opening that way).

**R6.2 — Keep the setting cue without a stamp (C2 / A13).** A scenario still needs a concrete
scene cue (`narrative.specific_scene`/C2), but it does **not** have to be a time/place stamp:
a **labeled** artifact ("a folder labeled Q3"), a **role word** matched to `planSpec.domain`,
or a place + concrete object all satisfy C2 — prefer these over a stamp. To name a
protagonist's role, use a **`[Role] [Name]`** prefix ("Analyst Renee", "Coach Omar") rather
than the `[Name], a [role],` appositive — the prefix carries the role with zero extra commas,
so it can't trip A13's run-on opener (3+ commas in the first 80 characters).

**R6.3 — Required pre-submit scene artifact (the gates can't see this).** The deterministic gates
cannot see `scene_skeleton` or `location_stamping`, and the cross-chapter model sweep is the only
backstop — so produce this as a written artifact BEFORE you submit, not a mental check. For the
chapter, write out: (a) your six scenario OPENERS, (b) your six TIMINGS / VENUES, and (c) the
chapter's dealt SCENE MECHANISM (the functional move, R6.4). Then test each: if one sentence
template describes ≥half the openers, or any clock / place / container recurs across the chapter,
or the dealt MECHANISM is rendered with the same device a prior chapter already used, you have a
defect the gates will miss — restage from your dealt OPENER GRAMMAR / VENUE / MECHANISM slots
before you gate.

**R6.4 — Use your dealt SCENE MECHANISM (the functional move, not the grammar).** Your card
deals each chapter one *functional move* — the dramatic transaction the chapter's marquee scene
dramatizes (`SCENE MECHANISM: <move>`), e.g. *the protagonist decides alone*, *two peers
disagree and one concedes*, *the expert admits a limit*, *the outsider notices what insiders
miss*. This is a DIFFERENT axis from scene SHAPE (R6/R6.1 = how a scene is constructed) and from
STANCE: one move can be rendered as dialogue OR postmortem, live OR retrospective. The recurring
failure this prevents is one *device* reused book-wide with only the nouns swapped — a leader
who loses her voice and a substitute who seizes the teaching prop, recurring across chapters; a
message "restarted/reframed" used as the example move chapter after chapter. Build this chapter's
central scene on the dealt move, and do NOT reach for a favorite device unless it is the one
dealt to this chapter. Like R6, the gates cannot see this — it is on you, and the cross-chapter
model QC sweep is the only backstop.

**R7 — Evidence integrity: never dress a testimonial as research (deterministic blockers `EI1`/`EI2`).**
Trust is load-bearing. The instant a reader senses the "evidence" is a hollow anecdote wearing a
finding's costume, they discount the teaching. So **every load-bearing claim must resolve to one of
two things, never a third:**
- **(a) a REAL named source with specifics** — a person, company, study, place, or date you can
  point to (`namedExample` with `realWorld: true`, a `testableFact`, a `hardSpecific`): *"In 1939
  Coco Chanel closed every workshop except the perfume operation; in 1954, at seventy-one, she
  reopened."* Real sources are cited by surname or full name + concrete detail.
- **(b) a PLAIN illustration that carries NO evidentiary verb** — an invented character (the sidecar
  may mark a device `realWorld: false`) simply *acts*; nobody calls their experience proof. *"A nurse
  eyes the breakroom donut and says, 'I'm not a donut person tonight.'"* — she acts; her anecdote is
  never "named the hinge."

**The forbidden third thing — a testimonial dressed as research.** A first-name- or initial-only
subject (no surname, no verifiable identity — `Brad`, `John`, `Candace P.`, `Jean B.`, "the success
report") whose personal **report / account** is given the grammar of a finding: *"Brad's report names
the hinge," "Candace P.'s report gives her the test," "John's Maui habit report makes the rule," "the
success report names ketogenic diet adherence."* `EI1` blocks this in any reader field. If you want to
use a person's experience, do ONE of: give them a real surname + specifics (→ a, but only if the
source actually supports it — never invent attribution), or strip the evidentiary verb and let them
act as a plain illustration (→ b). **Do not merely delete the name — a vague claim is not the fix.**
A related trap is the **Piper move** — inserting an *invented* character into a *real* researcher's
documented setting to act out the finding (a fictional "Piper" voicing the discovery in Schultz's real
lab). The real researcher's documented result is the evidence; an invented witness narrating it is not.
The loud, deterministic tell `EW1` flags (shadow major) is **casting an invented person as a study
subject**: *"participant Lawrence rubs the cup…", "participants Rachel and William mark the form…"*.
Real research names the *researcher* and anonymizes subjects (*"Participant A"*); a given-name
"participant" who acts or speaks is fiction wearing a study's costume. The subtler shape — your invented
actor staged *inside* a named study (*"Brigitte… in Walter Mischel's… room", "Adam… In the Trier Social
Stress Test room", "Beau asks after Kelly McGonigal's class"*) — is the same defect. **FIX:** report the
documented result as the evidence (cite the researcher), then move your invented actor into a plain
everyday setting where they APPLY the lesson — never as a research subject. Run `evidence-audit
<chapter.json>` and disposition every flagged name against your brief before you finish.

**Hard rule: a quiz answer may NEVER be keyed to a testimonial (`EI2`, blocker).** Every correct
answer must derive from a verifiable source fact (`testableFact`) — never from "what Brad's report
said." If the only support for a keyed choice is a first-name account, the question is unsound: re-key
it to a `testableFact` or rewrite the claim.

**R8 — Grounded numbers: never invent precision to sound rigorous (deterministic `GN1`, the
strengthened Step 0 numbers rule).** Every number in reader prose must trace to a `testableFact`,
`hardSpecific`, or `groundedNumber` in THIS chapter's sidecar — or be written qualitatively. A
fabricated percentage or multiplier is the loudest version: *"The notebook gets opened ninety percent
of the time, which is roughly ninety percent more often than the old planner"* invents two statistics
that no source establishes. `GN1` fires on a **statistical figure** — a percentage (`90%`, "ninety
percent"), a multiplier (`3x`, "tenfold"), or a million/billion magnitude — whose value is in no
source note. It reads as `factual_accuracy` corruption at the blind QC read.
- **Grounded → use the exact figure.** If the sidecar establishes it ("37 to 12 reopenings", "41
  percent fewer handoff errors", a verified year), cite it precisely. Years and the chapter's own
  counts are exempt.
- **Not grounded → go qualitative.** "most nights", "far more often", "a sharp drop", "several times
  over" — never a manufactured percentage. A precise-looking number you cannot point to a source for
  is worse than an honest qualitative phrase.
- This is the SAME rule as Step 0's numbers line, now load-bearing: `GN1` makes it deterministic, and
  the blind confirm read REVISEs the survivors as `factual_accuracy`.

**R9 — Contested science: never state a disputed finding as settled law (`factual_accuracy`).** A claim
can be perfectly faithful to the source and still be shaky in its field. If the sidecar marks a
`testableFact` with `replicationStatus: "mixed"`, `"contested"`, or `"failed"`, you may use it **only**
with a calibrated hedge or reframed as a heuristic — never as flat fact. The defect is the costume of
certainty over disputed science: *"Willpower runs on a fixed glucose budget; once it is spent, you will
give in"* stated as mechanism, when ego-depletion/glucose is one of psychology's most contested findings.
- **Hedge it.** "the evidence here is mixed", "some studies question this", "one influential account
  holds that…", "this idea is debated, but a useful way to think about it is…". Name the standing, then
  teach the takeaway.
- **Or reframe as a heuristic.** Strip the mechanistic certainty and keep the practical move: not "your
  glucose budget is depleted" but "when you have been resisting all day, the next refusal feels harder —
  plan around that." A heuristic the reader can use does not need a contested mechanism to stand.
- **`failed`** claims: drop them, or frame explicitly as a once-popular idea that did not hold up — never
  as live science.
- Absent/`robust` ⇒ state it plainly; do NOT bolt hedges onto solid science (that is its own defect, and
  it reads as no-confidence prose). This is the writer half of [Finding #2]; the WT-E `factual_accuracy`
  rubric scores the survivors at the blind read.

**R10 — Vary the sentence rhythm; never write a list (`E8`, the short-side twin of the long-drone
check).** A run of short, same-length declaratives reads as a list, not prose — the new-book defect is
choppy/listy breakdowns ("Defaults handle small repeat calls. Routines keep daily choices from
reopening. Option limits stop search loops. Time blocks protect deep work."). Every paragraph needs at
least one short (<6-word) punch AND one long (>20-word) flowing sentence; the lengths must differ.
Target the rhythm of the reference books — a short verdict landing *after* a long clause-bearing
sentence — not uniform brevity. The deterministic critic fires on ≥7 short (≤9-word) same-length
sentences in a row; the fix is never to lengthen every sentence, but to break the run with a long
flowing one and let the cadence move. (This is the inverse of the ≥25-word drone — both kill rhythm.)

**R11 — Match length to substance; never pad to the ceiling (`E9` / #12, low idea-density).**
The char floors (`A15`) are a *minimum*, not a target. There is no upper limit and no deterministic
gate that rewards length — so do not stretch one idea across many paragraphs to hit a number. If one
idea fills the tier, three varied examples beat six redundant ones; cut to the char floor, do not pad
up to a ceiling. The tell is a paragraph that adds words but no new information: the reader has already
learned everything in it. Every paragraph must earn its length with a NEW move — a fresh scene, the
mechanism, an edge case, a limit — not a reworded restatement of the one above it. Low
new-idea-per-paragraph density reads as filler; there is no char count to hide behind, and the
`prose_coherence` bar (catalogued `MB4`/#12) judges it directly. (Distinct from `R10`: that is sentence
*rhythm* within a paragraph; this is *idea* density across the tier. Distinct from the cross-tier
restate rule in Step 5: that is layering between tiers; this is padding inside one.)

---

## False-positive allowances (write freely)

The clean gold book does all of the following. Do not over-correct away from them — that just trades one templating defect for a different drift.

- **A timestamp inside a coherent scene is good.** "At 6:40 p.m. in the rink office, coach Renee studies a clipboard…" is exactly right. The defect is the *concept-label header* with an identical fixed time every chapter ("<Name>, 8:40 a.m. at the <place>: <Concept>"), not the presence of a clock in a real scene.
- **`whatToDo` may be third-person narrative** tied to the protagonist ("Aisha names the missed commitment and reschedules it before the standup…"). Do NOT force second-person imperatives. The only failure is `whatToDo` becoming an abstract proposition instead of an action.
- **Explanations do not need the word "because."** They teach by naming and contrast too. Never bolt a connective onto a restatement to fake a justification — that doesn't add reasoning, it just disguises the echo.
- **A consistent pedagogical opener across chapters is a convention,** not a skeleton, when the content that follows genuinely differs and reads as prose ("The mechanism is:" followed by a real, chapter-specific mechanism each time).
- **A misconception keyed correct IS correct** when the stem asks for it ("What is the simplistic reading this chapter warns against?"). The wrong-sounding answer is the right answer when the question asked for the wrong move.
- **An imperative plan title counts as the chapter's named reader tool** ("Name the Scarcity Cue", "Run the Purpose Receipt Check"). A proper-noun product name is not required; a sharp imperative title is a tool.

---

## The write→check loop (run as you go)

After you finish each chapter — before you start the next — run both checks. The first reads your fields for whether they did their JOB; the second is the ship gate. Both must be clean before you move on.

```bash
# field-JOB check: does each field do its actual job?
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts \
  author-check state/chapters/<chapterId>.v21-native.chapter.json

# ship gate: structural + cross-chapter
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts \
  gate-chapter state/chapters/<chapterId>.v21-native.chapter.json
```

`author-check` prints, per finding, the JOB the field violated and which field violated it — so you fix the *writing*, not a regex. Fix everything it names, fix everything `gate-chapter` names, re-run both, and only then advance. Checking at scale-1 catches a templated frame before it becomes fourteen chapters of it.

**In-session FORM-SHIFT circuit-breaker.** Watch the shape of your own failures. If you fix one finding and a *different* code fires on a *different* field, then you fix that and a third code fires on yet another field — three or more distinct codes walking from field to field across your attempts — STOP. That walk is the signature of a writer patching surface form while the same underlying template hides in whichever field isn't yet covered. You are not converging; you are relocating the defect.

When the circuit-breaker trips, do not edit another surface. Do one of two things:
1. **Re-author the field from the source notes.** Go back to the Bind Block, find the `namedExample` or `hardEdge` this field was supposed to express, and write it fresh from that — not by adjusting the words that keep tripping checks.
2. **Surface a status to the user.** If re-authoring from source doesn't resolve it, the source notes may not differentiate this chapter enough (a Step 1 issue). Report the chapter, the codes you saw move, and your read on which upstream stage needs to fix what. The user has a QC agent who can diagnose. That is a real, expected outcome — not a failure to hide.

Never keep editing surface form to dodge a check. A check that keeps moving is telling you the field was never written from source in the first place.

---

## Gate reference — tripwires, not the spec

The `AS`, `BP`, and `F` gates are **tripwires**, not the specification. They fire *because* a field stopped doing the job described above — a templated scenario, a reused distractor, an echoed explanation, a copy-pasted breakdown paragraph. When one fires, the fix is always in the writing: re-author the field from its source moment so it does its job. Never adjust the surface to slip past the threshold while the underlying template stays — that is optimizing the proxy and ruining the goal the proxy stands in for.

Salting is detected and fails closed. The anti-evasion gates (`AS1`–`AS3`) catch the three classic surface hacks — injected identifier tokens (`q7`, `ex1`, `p2`), jammed proper nouns (`MaplefieldBridgeton`), and doubled sentence-boundary periods (`..`) — and block on any occurrence. They exist because every one of these once shipped a ruined book. If you ever find yourself reaching for one to make a field "unique," that impulse is the signal that the field needs re-authoring from source, not decoration. Fix the writing; the tripwires take care of themselves.

---

## Per-field JOBs — read before composing each field

Every field has a JOB. The complete per-field specification — JOB, a WRITE recipe, what to REJECT and why it fails the reader, and a POSITIVE/NEGATIVE pair — lives in [FIELD-PURPOSE-CONTRACTS.md](FIELD-PURPOSE-CONTRACTS.md). Read the contract for each field as you compose it. The 10 composition steps below give the schema and order; FIELD-PURPOSE-CONTRACTS.md gives the JOB. `author-check` is the deterministic enforcement of those contracts.


---


## Working directory

```
/Users/radinsoltani/ChapterFlow-books
```

`cd` there at the start of your session. All paths below are relative to this directory.

---

## What the user gave you

- **`<bookId>`** — the slug.
- **Chapter range** — either "all chapters" or a specific range like "chapters 1-7". If you're running in parallel with other agents, you'll have a subset.
- **(Optional) Categories + tags** — pass through to the next agent; you don't need them here.

If the user did not say which chapters, run `next-task <bookId>` and produce whichever chapter it points to, then loop.

---

## How to know what chapter to work on

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts next-task <bookId>
```

It prints:
- The chapter number + title to produce
- The path to the chapter's source notes
- The path to save the output

When it says `write-chapter`, that's your job. When it says anything else (`derive-artifacts`, `finalize`, `ALL DONE`), STOP — that's not your job in this conversation.

---

## Before writing ANY chapter, read these on-disk inputs

```bash
# The source notes for THIS specific chapter — your primary source
cat .chapterflow/runs/<bookId>/<runId>/sidecars/source/ch<NN>.source.json

# The bibliography — for voice charter, teaching arc, author signature moves
cat .chapterflow/runs/<bookId>/<runId>/source-freeze/toc.json

# Every chapter already written in this book — for voice consistency, name dedup, distractor dedup
ls scripts/book/prompts/chapterflow-v21-authored/state/chapters/<bookId>-ch*.v21-native.chapter.json 2>/dev/null
```

(The current `<runId>` is the directory under `.chapterflow/runs/<bookId>/` — pick the most recent.)

**Read every prior chapter at least skim-level.** Without this, you will:
- Reuse hook first-words across chapters (book gate caps at 50%)
- Reuse counter shapes across chapters (book gate caps at 40%)
- Reuse protagonist names (book gate fails closed on duplicates)
- Reuse 5+ word distractor phrases (book gate fails closed on cross-chapter duplicates)
- Drift in voice (operator will catch this in QC)

---

## What you produce per chapter

One JSON file at:
```
scripts/book/prompts/chapterflow-v21-authored/state/chapters/<chapterId>.v21-native.chapter.json
```

Where `<chapterId>` comes from the chapter index file `state/indexes/<bookId>.json` (the `next-task` command also prints it).

## ChapterV21 schema — the complete shape

```ts
type ChapterV21 = {
  chapterId: string;              // <bookId>-ch<NN> zero-padded; exact value from the chapter index
  number: number;                 // chapter number from the bibliography
  title: string;                  // exact title from the bibliography, no reformatting
  readingTimeMinutes: number;     // your estimate, typically 8-15 minutes
  hook: string;                   // 60-120 chars; arresting one-liner; see Step 1 below
  counterintuition: string;       // 1-2 sentences; the chapter's surprise; see Step 2 below
  tryThisNow?: string;            // 80-220 chars; one specific 30-90s action; see Step 3
  keyTakeaway: string;            // 140-220 chars, max 30 words; see Step 4
  breakdown: {
    fastRead: string;             // ≥350 chars (target 400-700); see Step 5
    deepRead: string;             // ≥1000 chars (target 1200-1800); see Step 5
    fullRead: string;             // ≥2400 chars (target 2500-3500); see Step 5
  };
  examples: ExampleV21[];         // 6-9 per chapter (GATE FLOOR 6), see Step 6
  quiz: QuizV21;                  // 9-12 questions (GATE FLOOR 9), see Step 7
  reviewCards: ReviewCardV21[];   // 4-9 cards (GATE FLOOR 4; most ship 5-6), see Step 8
  implementationPlan: ImplementationPlanV21;  // 1 plan, see Step 9
  memorableLines: Array<{         // exactly 3, see Step 10
    text: string;                 // EXACT verbatim sentence from the breakdown
    location: string;             // "breakdown.fastRead" | "breakdown.deepRead" | "breakdown.fullRead"
    why: string;                  // 1 sentence: what makes it stick
  }>;
};

type ExampleV21 = {
  exampleId: string;              // "ex01", "ex02", ...
  title: string;                  // brief identifier
  tags: string[];                 // 1-4 short descriptors, ≤40 chars each
  planSpec: {
    domain: string;               // specific scenario domain
    audience: string;
    stakes: string;
    format: string;               // see ExampleFormat list below
    requiredBeat: string;         // the exact beat the example must hit
    venue?: string;                // OPTIONAL. Only the `fanout` path deals venues; if you were handed a dealt venue, set this to that exact string (it is verified against the plan). The next-task flow does NOT deal venues — leave it unset and just vary the staging by topic (see staging rule below). A venue is a PLACE or a relationship CHANNEL.
    exemplar?: string;             // v21.1 no-api QC: owned marquee exemplar used, or ""
  };
  scenario: string;               // 280-520 chars; usually 55-95 words
  whatToDo: string;               // 120-240 chars
  whyItMatters: string;           // 120-240 chars
};

type QuizV21 = {
  passingScorePercent: number;    // typically 70
  questions: Array<{
    questionId: string;           // "q01", "q02", ... (auto-renumbered on save)
    prompt: string;               // 60-380 chars
    choices: string[];            // EXACTLY 3 items; one correct
    correctIndex: number;         // 0, 1, or 2
    explanation: string;          // 120-300 chars
    bloomsLevel: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
    depthLevel: "simple" | "standard" | "deep";
  }>;
};

type ReviewCardV21 = {
  cardId: string;                 // "card01", "card02", ...
  front: string;                  // 30-200 chars
  back: string;                   // 80-400 chars
  difficulty: "easy" | "medium" | "hard";
};

type ImplementationPlanV21 = {
  title: string;                  // 4-7 words; a NEW skill name (not the chapter title)
  coreSkill: string;              // 2-4 sentences, plain prose
  ifThenPlans: Array<{
    context: string;
    plan: string;                 // 1-2 sentences, "If X, then Y"
  }>;                             // 3-5 items
  twentyFourHourChallenge: string;
  weeklyPractice: string;
};
```

Valid `ExampleFormat` values: `decision_point`, `dialogue`, `dilemma`, `before_after`, `postmortem`, `predict_reveal`, `planning_choice`, `mistake_recovery`, `reset_moment`, `reflection`, `contrast`, `inner_monologue`, `vignette`, `audit`, `decision_memo`, `text_thread`, `scene`, `coach_talk`, `school_case`, `business_case`.

---

## The 10 composition steps — work through them in order for each chapter

### Step 1 — `hook` (60-120 chars)

- Arresting one-liner. Reads like a scene, a number, a verdict, a confrontation. Not a topic sentence.
- NO meta-references: never open with `In this chapter`, `The chapter`, `The author`, `This chapter`.
- First word must NOT match the first word of ≥50% of prior chapters in this book. (Read prior chapters' hooks.)
- No em dash (`—`) anywhere. Use commas, periods, parens, colons, semicolons.
- Name a habit or default in plain, descriptive words. Never coin a compound label for the concept and use it as if the reader already shares it: write "the habit of copying winners," not "your winner default"; "betting on a straight line," not "the straight-line default." (A dealt `your-hidden-default` shape still works this way: name the default, just do not brand it.) Coin a term only later in the chapter once it is earned, never in the hook. Only a term that is genuinely the book's own (e.g. Pink's "Type I") may appear, and only if it says what it means in the same line (a term you invent yourself is never "the book's own").

Good examples:
- "On the morning of the work that would change his life, the writer sat down and could not begin."
- "A team labels every alert urgent, and within a week the page no longer means anything."
- "Whatever you most don't want to face today is the work that matters most."

### Step 2 — `counterintuition` (1-2 sentences)

- The chapter's surprise; what a careful reader did not expect.
- **Land the punch first, then qualify.** Lead with the sharp claim the reader feels ("A louder voice is not a deeper self"), then add the limit — not the reverse. The nuance is mandatory, but it comes AFTER the line that lands. Do not open by hedging ("This is sometimes true, but…").
- NO banned opener stems. Forbidden literally: `Most readers assume`, `Most people assume`, `Most readers think`, `Most people think`, `The paradox is`, `The paradox is that`, `The paradox is this`, `The paradox:`, `It feels like`, `The mistake is`, `The mistake is to`, `The mistake is treating`, `The mistaken move is`, `The dangerous move is`, `The last mistake is`, `The easy mistake is`, `The trap is to`, `The trap is not`, `the real lever is`, `the real move is`, `the real test is`, `the hard move is`, `the visible lever is`, `the sharper move is`, `the stronger move is`, `the better move is`, `the hidden cost is`, `the hidden cause is`, `the deeper cause is`.
- NO counter shape that matches ≥40% of prior chapters' counters. (Read prior counters.) Shapes include: negation-correction ("X is not Y, but Z"), inversion ("you'd expect A but get B"), paradox ("the more you X, the less you Y"), reframe ("what looks like A is actually B"), etc.

### Step 3 — `tryThisNow` (80-220 chars)

- ONE trigger + ONE move the reader can do in under a minute. Directive, not question. Keep it ≤30 words.
- It must read like a nudge, not homework. **No multi-step chores, no "rank/sort A, B, and C", no nested conditional trigger** ("the first time X happens, spend ten minutes ranking…"). If you wrote two actions, cut to the one that matters (A17 flags the over-built ones).
- Bad: "Take some time to think about your priorities." (vague)
- Bad: "What would you do if you only had one task today?" (question)
- Bad: "Within the next 24 hours, the first time a routine item lands loose, spend ten minutes ranking keys, medicine, and bills by risk. Move one object." (homework — multi-item ranking + two actions + nested trigger)
- Good: "Open the calendar for next Tuesday and block one 45-minute window labeled with the actual task name, not 'focus time' or 'deep work'."
- Good: "Pick one thing you lose often. Move its home to the place your hand already goes." (one trigger, one move)

### Step 4 — `keyTakeaway` (140-220 chars, max 30 words)

- The single sentence to remember if nothing else.
- Specific, falsifiable, names the mental move.
- NOT a paraphrase of the chapter title.
- No banned phrases (see Step 5 list).

### Step 5 — `breakdown` (3 tiers: fastRead, deepRead, fullRead)

Three progressively longer prose treatments of the same idea. Each tier readable standalone; each ADDS layered content (not repetition).

| Tier | Min chars | Target | Reader |
|---|---|---|---|
| `fastRead` | 350 | 400-700 | 2-minute read |
| `deepRead` | 1000 | 1200-1800 | careful reader |
| `fullRead` | 2400 | 2500-3500 | full depth |

Length floors are blocker-level. The ship gate fails closed if any tier is under floor.

**Hard rules for every tier:**

1. **No meta-references.** Never `this chapter`, `the chapter`, `the book`, `the author`, `in this chapter / section / book / law`, `Chapter N`.
2. **No author-surname-verb constructions.** Never `Clear argues`, `Kahneman says`, `Taleb claims`, `Greene observes`, `Pressfield notes`, `Duhigg writes`, `Eyal opens`, `Covey introduces`, `Ries reframes`, `Cialdini explains`, `Machiavelli says`, `Brown reminds`, `Kolb describes`, `Gladwell points out`, `Fogg installs`, `Housel notes`, `Tetlock claims`.
3. **No em dashes (`—`).** Use commas, semicolons, parens, colons.
4. **Plain words.** If a 4-syllable word and a 1-syllable word convey the same thing, use the 1-syllable word. The `fastRead` tier especially: max 2 four-plus-syllable words per paragraph (reading-level critic targets grade 8-9).
5. **Sentence length caps.** Avg sentence length: `fastRead` ≤14 words, `deepRead` ≤16, `fullRead` ≤18. NO sentence over 30 words anywhere.
6. **Vary paragraph openers.** No same first word across paragraphs in the same tier.
7. **Concrete openers.** Every paragraph starts with something specific — a scene, a number, a name, a verb. Never with a definition ("Productivity is…") or a generic abstraction.
8. **Layered, not redundant.** Cross-tier verbatim of 4+ consecutive words is flagged (B8 minor) and excessive cross-tier overlap is a defect. Vary phrasing across tiers.
9. **Voice charter consistency.** Match the bibliography's `authorVoice.register`. If `plainspoken`, don't drift into `literary` mid-chapter.
10. **Punch-first ordering.** Order the beats inside a tier: the claim that lands → the reader's recognition ("you've felt this") → why it works → the nuance/limit → the move. Lead with the truth the reader feels, THEN qualify. The nuance stays IN the tier — never drop it (honesty is non-negotiable, and the QC sweep reads a dropped limit as overclaim) — it just comes after the punch, not before it. The slow build that hedges for two sentences before saying anything is the failure.
11. **Citations live in the DEEP tiers.** Keep `fastRead` (and the hook + counterintuition) citation-free and plain — no named researchers, study years, journals, or framework name-drops up front. Lead with the plain idea ("Your brain is bad at being a cabinet, so the room has to carry some memory for you"); name Clark, Norman, or Allen only in `deepRead` / `fullRead`, and even there cite the FINDING, not the artifact (per the no-author-surname-verb rule + SL5). The reader earns the scaffolding after the plain idea, never before it. Cap the named sources a single chapter introduces — a chapter that name-drops five thinkers reads like school (concept load).
12. **Length follows substance — never pad to the ceiling (`R11` / `E9`).** The char floor is a minimum, not a target; there is no upper limit. If the idea is fully said, stop — do not stretch it across more paragraphs to look thorough. Every paragraph must add a NEW move (scene, mechanism, edge case, limit), never a reworded restatement of the one above. Padding to length reads as filler; the `prose_coherence` bar judges it.

**No banned phrases anywhere in the breakdown:**
`boundary condition`, `keeps the chapter honest`, `keeps the chapter from`, `strips away`, `is not decorative`, `is not magic`, `operating logic`, `tidy explanation`, `selective suspicion`, `diagnostic discipline`, `durable practice`, `usable lesson`, `reframes behavior`, `installs the operational`, `On a note beside the work, write the reminders plainly`, `That matters because` (over 10 occurrences per book caps as MAJOR), `turns out to be`.

**What each tier does (the tier-job contract — BUILD, don't restate):**

- **fastRead** — scene + rule. One vignette, then the move, end on the takeaway. The 2-minute tier stays NAME-FREE: no researcher, study year, or framework name here (not "David G. Myers called this the American Paradox") — citations belong in deepRead/fullRead (rule 11). Lead with the plain idea and the scene.
- **deepRead** — mechanism + second scene. Why the move works + a second domain/example that stress-tests it. New ground, not a longer fastRead.
- **fullRead** — depth + third angle + limits. Third example, the boundary case, the failure mode of the move, the reversal, and a closing line. New ground again.

**Each tier must add a NEW concept, scene, or nuance — never re-explain the prior tier in reworded sentences.** A restate keeps every domain noun and just changes the connectives; the verbatim gates (E2/B8/BP24) won't catch it because no words match word-for-word, but `B15` (cross-tier content-lemma overlap) and the `prose_coherence` axis will. The test: list the distinct ideas/scenes in each tier — if deepRead's list is fastRead's reworded, or fullRead's is deepRead's reworded, you have restated. Fix by adding what's missing (the mechanism, the second domain, the limit), not by repainting what's already there.

### Step 6 — `examples` (6-9 per chapter; A16 gate floor is 6 — fewer BLOCKS)

**Anchors live in the LOGIC of the scene, never as set dressing.** The source's
named cases must shape what happens or what a character realizes — not appear
as props. The tell (2026-06-10 reader review: reads as "product placement,
comic once seen"):
- BAD: "On the plant wall, a case card reads Henry Ford, Model T, advisors,
  automobile market." / "A Stoicism quote in the margin keeps him factual."
- GOOD: "Liam had treated the refused pill as noncompliance; the case review
  shows that the dream was also a vow." (the anchor IS the realization)
If you cannot make the anchor do work inside the scene's logic, use it in the
breakdown instead — never staple it to a wall, sticky note, or margin.

**Open on the reader's frustration, not a withheld reveal.** Reader feedback: scenes
"feel written to demonstrate a principle, not like a real moment someone cares about."
Start the scene at the recognizable pain, in a NAMED person's hands — not a literary
slow-burn that hides the point. "The self-checkout receipt was already in Brett's junk
drawer before he knew why it bothered him" buries the frustration in a reveal; "Brett's
junk drawer won't close, and the one receipt he needs is somewhere in the pile" lands
it. The first clause should make the reader think *that's me* — then show the named
person living it. (The lesson AROUND the scene speaks to "you"; the scene itself stays
in third person — R2.6.)


The most error-prone section. The ship gate has 6+ critic checks here.

**Per-example rules (every one matters):**

1. **C1 — Named protagonist.** Every scenario opens with a named person. NOT "a manager", NOT "an engineer". **Draw names ONLY from this chapter's name-plan slice** (`allocation["<thisChapterNumber>"]` in `state/name-plans/<bookId>.name-plan.json` — see the name-plan step in the authoring law above). That slice is already guaranteed disjoint from every other chapter and from the cross-book ledger, so it is the F1-safe source of truth. If no name plan exists, fall back to names that have NOT appeared in any prior chapter of this book AND are NOT in this banned pool: `Priya, Omar, Maya, Marcus, Elena, Lena, Victor, Theo, Jonah, Mateo, Tessa, Owen, Mira, Malik, Nadia, Felix, Caleb, Talia, Elise, Naomi`. Pick names that fit the cultural setting.

2. **C2 — Specific scene.** Name a time, a place, a role, a concrete artifact. "On Tuesday at 4 PM in the Berlin warehouse, Hanna sees the manifest on her tablet…" NOT "A manager reviews paperwork…".

3. **C3 — Decision point cue.** Scenarios whose format IS a decision (`decision_point`, `dilemma`, `mistake_recovery`, `predict_reveal`, `planning_choice`, `decision_memo`) must make a live decision moment unmistakable — a question the protagonist is weighing, an unsent reply on the screen, two options both still possible. Write the pressure in words native to THIS scene. The gate recognizes many constructions (weighs, wonders whether, torn between, should she, the deadline is, …) — these are DETECTION examples, not templates: never copy them verbatim, never use the same pressure construction in more than 2 scenarios per chapter, and never reuse a "minutes before X" / "must tell" stamp across chapters (the stillness QC found exactly that stamp in 22+ scenarios). Non-decision formats (audit, vignette, dialogue, contrast, …) need NO decision language — forcing it in produces incoherent scenes.
4. **C8 — No template across examples.** No two examples share a Cartesian-product shape (same skeleton, name + role + city swapped). Each scenario structurally different.

5. **C9 — No alphabet-cycling names.** Don't pick A, B, C, D, E, F across examples. Vary deliberately.

6. **C10 — No title verb shell.** Don't have ≥4 of 6 titles open with the same verb ("Maria handles…", "Theo handles…", "Nina handles…"). Vary verbs.

7. **Distinct domains.** No two examples in the chapter use the same domain. Span industries / settings / role types.

8. **Vary the scene SHAPE, and fit staging to the topic.** Do NOT open every scenario with the same skeleton ("<Name> <tactile-verb>s at/beside a <occupational prop>"). Span venue KINDS across the six examples (domestic, relational, civic, occupational, commercial, recreational) so each scene's grammar and setting differ — no book may anchor more than two chapters to the same venue (book-gate BP27 blocks it). Staging must FIT the chapter's subject: a personal/relational topic (boundaries, family, habits) belongs at a kitchen table, on a phone call, in a text thread, in a parked car — NOT at a workplace counter or job-site prop. A venue can be a relationship CHANNEL, not only a physical place.

8. **whatToDo is one move, not a list.** State the action the protagonist took or should take. One verb, one object, one reason.

9. **whyItMatters is the lesson.** What does this scene teach about the chapter's move? Don't repeat the scenario.

**Length floors:**
- `scenario`: 280–520 chars, usually 55–95 words
- `whatToDo`: 120-240 chars
- `whyItMatters`: 120-240 chars

### Step 7 — `quiz` (9-12 questions; A16 gate floor is 9 — fewer BLOCKS)

**Choice-length balance (BP25):** the keyed answer must NOT be reliably the
longest choice — at introduction, 68% of the catalog's questions could be
aced by picking the longest option without reading. Target: the key is the
longest in ≤45% of a chapter's questions (chance is ~33%). Give distractors
scenario-specific substance; trim hedging from keys. Each distractor is a
real misconception from the source, written as a plain sentence in the key's
register — no `Label:` / category prefix on any choice (uniform Title-Case
labels telegraph the key by valence and REVISE the quiz_distractor_quality axis).


**Read this section twice. This is where the most defects emerge.**

**Non-negotiable rules:**

1. **Application, not recall.** Forbidden stems: `What does the chapter say`, `According to the author`, `What is the main point of`, `How does the book describe`, `In this chapter`, any `Chapter N`, any author-surname-verb. Every prompt is a scenario stem the reader must reason about.

1.5. **D4/D6 — Transfer to a NEW scene; never recall the chapter's cast.** Each question is a fresh situation the reader has not met in this chapter. **Never ask the reader to recall what one of the chapter's own characters said, did, or concluded** — `What did Deborah conclude…`, `According to Marcus…`, `What does Ben's story show…` are recall, not transfer, and the deterministic critic `checkQuizScenarioNovelty` fires `D4.recycled_scenario` when a recall frame points at a name from this chapter's examples. (Reusing a character's NAME as the actor of a genuinely new situation is fine; turning the question into a memory check about the chapter's narrative is not.) **The correct answer must derive from a verifiable source fact stated in general terms, never from "what a character in the chapter did"** — a keyed choice that names a chapter character the question's own prompt never introduced fires `D6.key_references_chapter_entity`. Re-key it to the source fact (real cited entities the whole chapter is built on — `Apple`, `Ben Comen` — are fine; an invented per-scene character used as the answer's authority is not).

2. **Scenario stems.** Good: "A hiring manager scoring resumes after a late dinner notices that one candidate…". Bad: "Which of these is a heuristic?".

2.5. **Make it feel like life, not an exam.** Prefer a recognizable real-world moment — a friend's claim, a message you might get, a choice you'd actually face — over abstract exam-speak. Bad (exam-speak): "Which response best preserves the nuance?" / "Which correction best fits the data problem?". Good: "Your friend says, 'Every millionaire I follow wakes up at 5 a.m., so that must be the secret.' What's the first question to ask?". A reader should recognize the situation before they reason about it. (Second person in the QUIZ stem is fine — it's framing, not a scene with a named cast.)

3. **Distractors are plausible mistakes.** Three defensible choices; only one actually follows from the chapter's move. Distractors should reflect the exact heuristic or bias the chapter is warning about.

4. **BP15 — No absolute words in wrong distractors.** Never `always`, `never`, `automatically`, `impossible`, `guaranteed`, `entirely`, `ever`, `forever`, `completely`, `wholly`, `absolutely`, `under no circumstances`, `in all cases` in any non-correct choice. Replace with scenario-anchored qualifiers: "in most cases," "when the cue is salient," "for the kind of judgments this chapter describes."

5. **BP16 — Length parity.** Correct/avg-distractor word-count ratio must stay below **1.4**. If your right answer is 1.5× or longer than the average distractor, EITHER shorten the correct answer (strip trailing "because…" / "which means…" clauses) OR lengthen distractors with scenario-specific content. **Ratio ≥ 2.0 is a blocker.**

6. **A4 — Correct-answer position balanced.** Across N questions, correctIndex distribution roughly uniform. NEVER >50% in any one position. NEVER >40% in position 0. Plan your distribution explicitly before writing (e.g., 0,2,1,0,2,1,0,2,1).

7. **BP19 — Distractors reference the prompt scenario.** Every wrong choice must name the prompt's specific actor, role, decision, or scenario noun. The following generic tail clauses are BANNED (blocker if any appear): `fits the immediate pressure around`, `could make that choice seem workable`, `gives that route a concrete rationale`, `making the tradeoff feel defensible`, `looks persuasive because the recent evidence is tidy`, `while preserving the spirit of the original`, `without disrupting the broader workflow`, `given the constraints in play`, `based on the available signal`, `who is responsible for a`, `until the team feels more certain`, `delay the decision so`, `can stay flexible`, `keep the old message for now`, `so the team does not lose energy`, `answer every visible request first`, `remove every source of entertainment forever`, `ranking would make action impossible`, `it proves easy tasks never matter`, `choose the action with consequence over noise`.

8. **BP20 / BP21 — No cross-chapter distractor reuse.** No 5+ word phrase repeats across this chapter's distractors AND any prior chapter's distractors. No distractor copied verbatim across chapters. **Read prior chapters' quizzes before writing yours.**

9. **BP18 — No label-shaped correct answers.** A correct answer of ≤6 words with no verb ("Cut charting time.") reads as a label. Extend with scenario-specific detail.

10. **schema.quiz_lowercase_choice_start — Capitalize every choice's first letter.** No lowercase starts.

11. **schema.quiz_duplicate_choice — No duplicate choices within a question.** The three choices must be distinct.

12. **schema.quiz_unexpected_field — No `whyItMatters` on questions.** The validator returns 422. Allowed fields ONLY: `questionId, prompt, choices, correctIndex, correctAnswerIndex, explanation, bloomsLevel, depthLevel`.

13. **Explanations teach, they do not quote.** The explanation explains *why* without `the chapter said`. Reference the chapter's named core move if helpful; do not reference the source as an object.

14. **Bloom's levels canonical.** Exactly: `remember, understand, apply, analyze, evaluate, create`. No hyphens, no underscores.

15. **`depthLevel` canonical.** Exactly: `simple, standard, deep`.

16. **BP17 — Vary openers.** No more than 5 of 9 questions may start with "A " or "An ". Use conditional setup ("When a manager…"), direct principle question ("Which test best reveals…"), second-person ("Your team…"), or claim-evaluation ("A colleague argues…").

17. **No banned phrases.** Same list as breakdown.

18. **No em dashes.**

19. **Every question uses a different scenario domain.** If question 1 is a hospital scene, question 2 is not a hospital scene.

20. **Each prompt is parseable in one breath.** Choices parseable in one breath. Explanations plain.

**Bloom's mix guideline for 9 questions:** typical mix is `{apply: 3, analyze: 2, evaluate: 2, understand: 1, remember: 1}`. Adjust based on chapter's depth (intro chapters lean toward `remember`/`understand`; capstone chapters lean toward `evaluate`/`create`).

**Test yourself on each question before saving:**
- Could a test-taker who skimmed the chapter get this wrong if they understood the idea? (If yes — distractor is too easy.)
- Does the right answer name something specific from the prompt's scenario? (If no — it's a label.)
- If I score the choices by length only, do I get the right answer? (If yes — fix length parity.)

### Step 8 — `reviewCards` (5-9 cards; default 6)

Spaced-repetition cards.

**Rules:**

1. **front is retrieval, not lookup.** Good: "What does it cost a team to label every alert urgent?". Bad: "Define urgency dilution.".
2. **back is the answer.** Plain, specific. References the chapter's core move.
3. **C11 — No identical or near-identical backs.** Each card's back is its own answer. Backs should not share long verbatim sequences.
4. **C12 — No quiz-prompt templating.** Don't reuse the quiz's exact phrasing.
5. **C13 — No title-keyword injection.** If the chapter title is "The Tax of Urgency", don't shoehorn "tax of urgency" into every front.
6. **C21 — front not circular.** If 4+ of the first 6 content words on the front appear in a back ≤30 words, the card is circular. Rewrite.

### Step 9 — `implementationPlan`

**Rules:**

1. `title` is a NEW skill name, NOT the chapter title. Example: "Run a 10-minute pre-mortem" not "Pre-mortems".
2. `coreSkill` describes the action the reader takes, not the concept.
3. `ifThenPlans` are 3-5 items, and ALL of them apply the SAME named move from your `implementationPlan.title` to a DIFFERENT trigger — one tool used several ways, not a list of unconnected tips. Each = a concrete trigger ("If your inbox has more than 20 unread items by 10 AM…") + a concrete action that PERFORMS that named move ("…then run the load-draw: write the three places the work is waiting and close the first one."). An if-then whose action ignores the chapter's named tool is a `plan_actionability` REVISE — the reader is left with disconnected advice instead of one practiced loop.
4. `twentyFourHourChallenge` is one specific 24-hour commitment with a verifiable outcome.
5. `weeklyPractice` is one practice that compounds across a week.
6. No banned phrases. No em dashes. No meta-references.

### Step 10 — `memorableLines` (exactly 3)

Three sentences from the breakdown that the reader could quote on a share card.

**Critical:** The `text` of each memorable line MUST appear **verbatim** in the breakdown (fastRead, deepRead, or fullRead). The ship gate (A11) checks for this. If you rewrite breakdown prose after marking lines, you have to re-mark.

Pick sentences that are:
- Aphoristic (compact, complete claim)
- Specific (names a thing, not an abstraction)
- Quotable (sounds like the author when read aloud)

---

## After producing the chapter — RUN THE SHIP GATE

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts gate-chapter \
  scripts/book/prompts/chapterflow-v21-authored/state/chapters/<chapterId>.v21-native.chapter.json
```

The gate prints a chapter-only `Ship gate:` headline first — IGNORE IT. The
authoritative result is the FINAL line (it adds the intra-book AS5–AS12 blockers
the headline does not count, and it matches the exit code):
- `Gate verdict: PASS — 0 blockers` → chapter is ready
- `Gate verdict: BLOCK — …` → fix the listed blockers and re-run

**Common blocker fixes:**

| Code | What | How to fix |
|---|---|---|
| B1 | Meta-reference in some text field | Strip "the chapter / the author / Chapter N" |
| B5 | Em dash present | Replace `—` with `,` or `.` or `:` or `;` |
| A11 | Memorable line not in breakdown | Either restore the sentence verbatim or repoint memorableLines[i].text to a sentence that IS in the breakdown |
| A12 / A12-breakdown | Sentence capitalization wrong | Capitalize sentence-initial letters |
| A14 | keyTakeaway over 30 words | Trim |
| A15 | Tier too short | Expand to floor |
| A16.examples_count_floor | Fewer than 6 examples | Add until you hit 6 |
| C1 / C2 / C3 | Example missing name / scene / decision-cue | Add explicit name, time/place, decision phrasing |
| C8 / C9 / C10 | Examples are templated / alphabet-cycled / verb-shelled | Rewrite to vary structure |
| BP15 | Strawman distractor (absolute word) | Replace with scenario-anchored qualifier |
| BP16 (blocker) | Correct answer ≥2× distractor length | Shorten correct or expand distractors |
| BP17 | >5/9 prompts open "A/An " | Vary openers |
| BP19 | Banned tail-clause phrase in distractor | Rewrite with prompt-specific language |
| BP20 | Cross-chapter quiz n-gram template repeat | Rewrite prompt/choice/explanation — NEVER insert salt tokens |
| schema.quiz_duplicate_choice | Two identical choices in one question | Make them distinct |
| schema.quiz_lowercase_choice_start | Choice starts lowercase | Capitalize |
| schema.quiz_unexpected_field | `whyItMatters` or other field on quiz | Remove |
| AS1 | Identifier token (q7, ex1, p2) inside prose | Rewrite the sentence WITHOUT the token. This is salting; not allowed. |
| AS2 | Jammed proper nouns (MaplefieldBridgeton) | Rewrite as separate words with a separator. |
| AS3 | Doubled period | Replace `..` with `.` (single period). |
| AS4 | Cross-chapter prompt template substitution (book gate) | Rewrite this chapter's quiz prompts as DIFFERENT scenarios from other chapters' same-position prompts. Do NOT just swap one noun. |
| AS5 | This chapter's quiz prompt ≥70% identical to a prior chapter's same-position prompt | Pick a DIFFERENT scenario from THIS chapter's source notes. Do NOT swap one noun on a prior chapter's prompt. |
| AS6 | This chapter's quiz distractor ≥80% identical to a prior chapter's same-position distractor | Rewrite this distractor to reflect THIS chapter's hardEdge misreading. Distractors must not be reused across chapters. |
| AS7 | This chapter's review card front or back ≥75% identical to a prior chapter's same-position card | Compose cards from THIS chapter's specific terminology (centralConcept name, hardEdge language). Do NOT use a card-skeleton from a prior chapter. |
| AS8 | This chapter's implementation plan field ≥70% identical to a prior chapter's plan | Each chapter's plan must use its own framework. Do NOT use the same coreSkill / 24hr / weeklyPractice template with one phrase swapped. |
| AS9 | This chapter's example scenario/whatToDo/whyItMatters ≥70% identical to a prior chapter's same-position example | Examples must be composed from THIS chapter's namedExamples + centralConcept + hardEdge. Use a different scene structure, role, time, setting, and decision shape per chapter — do NOT reuse a scenario skeleton with name/location/verb-phrase swapped. |
| AS10 | Literal 5-token phrase in this chapter's examples or breakdown also appears verbatim in ≥2 prior chapters' same field type | Rewrite the phrase. Do not reach for the same connective phrasing you used in earlier chapters. If you've used "the practical edge of" or "must decide whether to" in two prior chapters, write THIS chapter's prose with different connective language. |
| AS11 | A breakdown paragraph (≥60 chars) appears verbatim in any prior chapter's breakdown | Rewrite the paragraph from THIS chapter's source notes. Breakdown paragraphs cannot be reused — every chapter's reader sees them in sequence and the templating becomes obvious. |
| AS12 | Quiz `correctIndex` sequence identical to any prior chapter's | Vary the answer positions per chapter. Pick each slot based on which distractor is strongest for THIS question, not by following a fixed rotation like [0,1,2,0,1,2,…]. |
| BP24 | Breakdown tier ≥150 chars verbatim shared with another tier of the same chapter | Tiers must LAYER content. Rewrite the longer tier to extend the shorter one with new examples and mechanism, not duplicate prose. |
| B15 (advisory) | Two tiers share a high fraction of content vocabulary with no verbatim block — a paraphrase-restate (same ideas, reworded connectives) | Don't reword the prior tier; BUILD on it. Give the later tier a new concept, scene, or nuance (deepRead = mechanism + second domain; fullRead = edge cases + failure mode + reversal). |
| E1 | Reading level too academic | Use plainer words |
| E2 (blocker) | Two of the three breakdown tiers open with an identical first sentence | Each tier must open with a different first sentence. fastRead opens with the scene + rule. deepRead opens with mechanism. fullRead opens with a third angle or scope-of-applicability frame. |
| SC9 (major) | This chapter's example scenario contains no proper-noun anchor from the source sidecar (namedExamples, centralConcept, hardEdge, paraphraseNotes) | Rewrite the scenario to reference a real entity from THIS chapter's source notes — a company, person, product, place, or framework name. Invented characters at invented locations drift into templating because they aren't tethered to source material. |

Iterate until PASS. When PASS, advance to the next chapter.

**Iteration cap — strict.** If the same blocker code (e.g., `BP13`, `BP20`, `AS4`) fires on the same chapter for 3 attempts in a row, STOP IMMEDIATELY and report to the user. The fix for stuck blockers is upstream — usually one of:

- The chapter source notes are too similar to other chapters' source notes (Step 1 quality issue; needs the research agent to differentiate them).
- Your quiz design is template-bound (you keep writing the same scenario shape with different nouns); needs a structural rethink.
- The chapter's central concept overlaps another chapter's central concept (the book's research arc may need refinement).

**Do not solve a stuck blocker by inserting marker tokens, jammed names, or doubled periods. The pipeline detects all four forms of gaming and fails closed with AS1–AS4 blockers.** If you find yourself thinking "I'll just add `q7` here to make this prompt unique" or "I'll mash these two place names together" — stop and report. That's the trigger.

When stopping mid-stuck, write a one-paragraph status: `<bookId>`, chapter number, blocker code, your last three attempt summaries, and your hypothesis about which upstream stage needs to fix what. The user has a QC reviewer who can diagnose.

---

## After all your assigned chapters are done

If the user assigned you the FULL book:
- Run `next-task <bookId>` one final time. If it says `derive-artifacts` or `finalize` or `ALL DONE`, your job is done. Report.
- Do NOT run `derive-artifacts` or `generate-book` yourself. That's Step 3 (another agent).

If the user assigned you a SUBSET (parallel mode):
- Confirm every chapter in your range passes the ship gate.
- Report which chapters you completed and what the next agent should pick up.

In either case, report:
1. Which chapters you completed.
2. The ship-gate result for each (should be PASS).
3. Any blockers you couldn't clear and why.
4. Any concerns the deterministic gates wouldn't catch (voice drift you noticed, source notes that seemed thin, etc.).

---

## What you should NOT do

- Do NOT produce or modify any file in `.chapterflow/runs/<bookId>/` — that's Step 1's territory.
- Do NOT modify `state/indexes/<bookId>.json` — that was set in Step 1.
- Do NOT run `derive-artifacts`.
- Do NOT run `generate-book`.
- Do NOT invoke `claude -p`, the v21 `research` subprocess, or any external model.

---

## TL;DR loop

```bash
cd /Users/radinsoltani/ChapterFlow-books
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts next-task <bookId>
# It tells you which chapter to write. Write the Bind Block from the source.
# Compose each field to its JOB (FIELD-PURPOSE-CONTRACTS.md). Save to the printed path.
# Run author-check AND gate-chapter. Iterate until BOTH are clean.
# Re-run next-task. When it stops saying "write-chapter", stop and report.
```
