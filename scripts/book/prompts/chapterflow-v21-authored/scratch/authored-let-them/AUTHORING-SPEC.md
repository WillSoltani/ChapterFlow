# AUTHORING SPEC — The Let Them Theory (Mel Robbins), v21 full-body re-author

You are authoring ONE chapter's body for an interactive book. The previous version
of this entire book was produced by a deterministic slot-fill SCRIPT that pasted the
chapter's concept name into a fixed skeleton shared by all 20 chapters. The result
passed structural checks but reads as templated Mad-Libs, the quiz keys are wrong, and
the examples are word-salad. Your job is to throw that skeleton away and write THIS
chapter as a real human author would if it were the only chapter they ever wrote.

Everything you write must be:
- **Grounded in this chapter's source material** (you will read its source sidecar).
- **Concrete and specific to this chapter** — its concept, its real named cases.
- **Written as standalone prose** — no shared sentence templates with other chapters,
  no fill-in-the-blank connective tissue, no generic scaffolding.

## INPUTS — read these three files FIRST (paths given in your task message)
1. The **source sidecar** (`...source/chNN.source.json`) — the real Mel Robbins
   material: `focus`, `coreClaim`, `centralConcept` (name + plainDefinition +
   whyItMatters), `keyClaims[]`, `namedExamples[]` (label + summary + teachesWhat),
   `hardEdge`, `voiceCues[]`, `paraphraseNotes`. THIS IS YOUR TRUTH. Build everything
   from it. Do not invent facts the source does not support.
2. The **plan** (`state/plans/...chNN.manual-plan.json`) — `coreMove`, `exampleSpecs[]`
   (each has `audience` naming the protagonist, `format`, `stakes`, `requiredBeat`),
   `quizFocus.bloomsMix`.
3. The **current chapter file** (`state/chapters/...chNN....json`) — ONLY to copy the
   preserved `hook`, `counterintuition`, and `title`, and to read each example's
   `exampleId` / `tags` / `planSpec` (you keep those; you rewrite the prose).
   IGNORE the current breakdown / cards / plan / quiz / examples prose — it is the
   broken template you are replacing. Do not echo its phrasings.

## OUTPUT — write valid JSON to the output path given in your task message
Write a single JSON object with EXACTLY these keys (no others). Strict JSON: double
quotes, no trailing commas, no comments, no markdown fences. Properly escape quotes.

```
{
  "keyTakeaway": "string",
  "tryThisNow": "string",
  "breakdown": { "fastRead": "string", "deepRead": "string", "fullRead": "string" },
  "reviewCards": [ { "cardId":"card01", "front":"string", "back":"string", "difficulty":"easy|medium|hard" }, ...6 total ],
  "implementationPlan": {
    "title":"string", "coreSkill":"string",
    "ifThenPlans":[ {"context":"string","plan":"string"}, ...4 total ],
    "twentyFourHourChallenge":"string", "weeklyPractice":"string"
  },
  "quiz": { "passingScorePercent":70, "questions":[ {"questionId":"q01","prompt":"string","choices":["a","b","c"],"correctIndex":N,"explanation":"string","bloomsLevel":"...","depthLevel":"..."}, ...9 total ] },
  "examples": [ {"exampleId":"ex01","title":"string","scenario":"string","whatToDo":"string","whyItMatters":"string"}, ...6 total ],
  "memorableLines": [ {"text":"<verbatim sentence copied from your breakdown>","location":"breakdown.fastRead|deepRead|fullRead","why":"string"}, ...3 total ]
}
```
Use cardId card01..card06 and exampleId ex01..ex06 in order. Match each example's
exampleId to the SAME index in the current chapter file so its tags/planSpec stay aligned.

## GLOBAL RULES (apply to EVERY field — these are hard gate failures)
- **No em dash** (—) anywhere. None. Use commas, periods, semicolons, "and", or rewrite.
- **No meta-reference**: never write "this chapter", "the chapter", "the book", "the
  author", "the source says", "the reader is told", "this section". Write the ideas
  directly. (You MAY use "the reader" sparingly as a person, but prefer concrete actors.)
- **No chapter-number literals** ("chapter 7", "the seventh law", etc.).
- **Third person, plainspoken**, medium cadence (the book's voice: blunt, warm,
  everyday, coaching rhythm; see the sidecar `voiceCues`). Short and medium sentences,
  varied. No academic distance, no literary ambiguity.
- Every text field must **end with terminal punctuation** (. ! ?). Never truncate.
- **Do NOT use these banned crutch phrases** (any form): "boundary condition", "strips
  away", "is not decorative", "is not magic", "the paradox is that/this", "the mistake
  is to", "the real lever is", "the real move is", "the hard move is", "the better move
  is", "Most readers assume/think", "Most people assume/think", "That matters because"
  (avoid), "turns out to be" (avoid). Do not open the counterintuition-style lines with
  a "Most people think X, but really Y" shell.
- **Do NOT reuse the old template skeletons.** These exact constructions are BANNED;
  if you find yourself writing anything close, rewrite from the source:
  - "<Concept> helps you stop managing what belongs to other people and put your energy into the next honest response"
  - "The skill is to notice the moment when attention leaves the reader's own choices and starts managing another person"
  - "<Concept> is the mechanism underneath the source"
  - "holds two truths at once. The reader cannot control another person's mood, timing, desire, maturity, or readiness"
  - "The reader still remains responsible for the next sentence, boundary, repair attempt, standard, or decision"
  - "is not asking the reader to become passive", "A practical reader can test the idea by asking"
  - "makes the idea concrete", "The core move is", "keeps the source from becoming too neat"
  - card fronts like "What is the source's hard edge?", "Why does this idea matter to the reader?", "What does <X> teach?", "How does <X> change the practice?", "What should the reader remember from <X>?"
- **Cross-chapter uniqueness**: Other chapters are being authored in parallel. Never
  reach for generic connective phrasing that another chapter would also reach for. The
  safeguard is concreteness: name THIS chapter's specific concept, its specific named
  cases, and specific everyday situations. Vary your sentence openers and structures.

## FIELD-BY-FIELD REQUIREMENTS

### keyTakeaway  (<= 28 words, one or two sentences)
A specific, memorable takeaway about THIS chapter's concept and what it gives the
reader. NOT the banned skeleton. Name the concept in plain words, tie it to the change
it produces. Example shape (do not copy): "When someone's bad mood stops being your
emergency, you get your attention back for the things you can actually do."

### tryThisNow  (one concrete directive, 1-2 sentences)
A 60-second action the reader can take right now that enacts this chapter's concept,
anchored to a real situation from the source case. Concrete and doable. Not abstract.

### breakdown  (three PROGRESSIVE tiers — this is the chapter's core teaching prose)
- `fastRead`: >= 350 characters (aim ~500-800). The quick version: the problem this
  chapter addresses and the one move that fixes it, in plain language, opening with a
  concrete image or the named case (not an abstract definition). 1 short paragraph.
- `deepRead`: >= 1000 characters (aim ~1400-1800). The mechanism: define the concept
  clearly, walk through the named case(s) and what they teach, address the misuse /
  hard edge, and what changes for the reader. 2-3 paragraphs.
- `fullRead`: >= 2400 characters (aim ~2600-3200). The full treatment: the two-sided
  truth of the concept, the named cases in motion, the hard edge in depth, the practical
  payoff, and the emotional difficulty. 4-6 paragraphs.
- The three tiers MUST be genuinely progressive and must NOT open with the same
  sentence as each other. Each tier opens with a DIFFERENT concrete entry point.
- Do NOT repeat any 3+ word phrase across the three tiers (beyond the chapter title
  words). If a vivid phrase appears in fastRead, reword it in deepRead/fullRead.
- Vary paragraph openers; vary sentence length (mix short punchy sentences with longer
  ones). Open paragraphs with concrete subjects, not "It is" / "There is" / "This".
- Keep the vocabulary plain (grade 8-9). Avoid clustering long/academic words: no more
  than 2 words of 4+ syllables in any single paragraph, especially in fastRead.

### memorableLines  (exactly 3)
Each `text` MUST be an EXACT, verbatim, complete sentence that appears in your
`breakdown` prose (copy it character-for-character). Pull one strong line from each
tier ideally. `location` = which tier it's from. `why` = one sentence on why it lands.

### reviewCards  (exactly 6; retrieval practice)
- `front`: a specific question that makes the reader RETRIEVE a real idea from this
  chapter — name the concept or the named case in the question. NOT a generic
  "What is the source's hard edge?" shell. Each front is distinct.
- `back`: the answer, in coherent prose true to the source. Must ANSWER the front, not
  restate it (the back's opening words must not just echo the front's words). Distinct
  from every other card's back. Ends with punctuation.
- `difficulty`: spread across easy / medium / hard.

### implementationPlan
- `title`: a short specific name for this chapter's practice (not "X Practice" generic).
- `coreSkill`: 2-4 sentences naming the actual skill this chapter builds, in this
  chapter's own terms and cases. Do NOT open with "The skill is to notice the moment...".
- `ifThenPlans`: exactly 4. Each has a specific `context` (a real trigger situation tied
  to this chapter's concept/cases) and a `plan` ("If <specific trigger>, then <specific
  action>."). Concrete, varied, chapter-specific. Not generic.
- `twentyFourHourChallenge`: one concrete thing to do in the next 24 hours, tied to this
  chapter's concept and a real situation.
- `weeklyPractice`: a one-week practice specific to this concept.

### quiz  (exactly 9 questions; tests APPLICATION, not recall-of-text)
- Hit this chapter's plan `bloomsMix` exactly (read it). Typical: understand 2, apply 2,
  analyze 2, evaluate 2, create 1. `bloomsLevel` must be one of: remember, understand,
  apply, analyze, evaluate, create. `depthLevel` one of: simple, standard, deep
  (suggested: understand->simple, apply/analyze->standard, evaluate/create->deep).
- Each question is a STANDALONE, concept-specific question that tests APPLICATION, not
  recall. Make each prompt a real applied question: either a short scenario of concrete
  setup followed by the question (aim for ~120+ characters), or open with an
  application frame such as "When a reader...", "If you...", "Which response...",
  "Which move...", "A person who...", "Someone...", "A friend argues that...". Avoid
  bare label-style prompts like "<Concept>: choose the definition." Do NOT use one fixed
  prompt skeleton across the 9 questions. At most 5 prompts may start with "A " or "An ".
- `choices`: exactly 3. One correct, two plausible-but-WRONG. The two wrong choices must
  be defeatable only by understanding THIS chapter (a real misreading or a near-miss),
  not by spotting an absolute word. **No absolute trigger words** in any distractor:
  always, never, automatically, impossible, guaranteed, entirely, ever, forever,
  completely, wholly, absolutely, "under no circumstances", "in all cases".
- All three choices similar length (the correct one must NOT be the longest; keep the
  correct/average-distractor character ratio at or below ~1.3). Each choice starts with
  a capital letter. No two choices identical.
- **`correctIndex` is ASSIGNED to you per question** (a 9-length sequence in your task
  message). Put the genuinely-correct choice at that index for each question; arrange
  the two distractors in the other two slots. This is mandatory.
- `explanation`: 1-2 complete sentences that justify why the keyed choice is right FOR
  THIS question (and ideally why the others miss). Specific to this question. Ends with
  punctuation. Never truncated.
- The 9 questions must not share an 8-word phrase with each other. Distractors must be
  chapter-specific (do not reuse a distractor across questions or chapters).
- The correct-answer TEXT must be specific to this chapter's concept — it must read as
  this chapter's own content, never a generic phrase that could key any chapter.

### examples  (exactly 6; concrete human scenes)
For each example i (0-5), use the matching `exampleSpecs[i]` from the plan:
- Protagonist = the named person in `audience` (e.g., "Asha"). Use that exact name.
- `format` (source scene / boundary choice / repair decision / planning choice / misuse
  check / reflection) shapes the beat. `stakes` = what's at risk. `requiredBeat` = what
  must be shown. ENACT the requiredBeat as a real scene; do NOT paste its words.
- `title`: a short, specific, natural label for THIS scene. Each of the 6 titles is
  distinct. **Do NOT start a title with the protagonist's name** (titles starting with
  the alphabet-sequential names trip a check). Start with a scene noun or short phrase
  (e.g., "Rainy driveway before the dance", "The unanswered text"). No two titles share
  a 2nd word or a 3-word run. Do not force the chapter title's words into the title.
- `scenario`: >= 220 characters. A concrete, specific human scene. It MUST contain at
  least one concrete scene anchor: a weekday ("Tuesday"), a clock time ("7:30",
  "before dinner", "late at night"), a named place/object ("at the kitchen table",
  "in the group chat", "the parking lot", "her phone on the counter"), or a role word
  ("manager", "teacher", "coach", "nurse"). For EVERY format EXCEPT "reflection", the
  scenario MUST contain an explicit decision cue, using one of these literal phrasings:
  "has to decide", "must decide", "must choose", "is deciding whether", "decide whether",
  "before she answers", "before he answers", "is torn between", "has to choose". **It MUST reference at least one of this chapter's source
  named-case proper nouns by name** (from the sidecar `namedExamples` labels/summaries,
  e.g. "Oakley", "Kendall") — naturally, as the touchstone the protagonist recalls or a
  parallel the scene echoes. The protagonist applies the chapter's concept WITHOUT
  trying to control another person. A concept or scene is NEVER used as an actor or
  object. No "<Name> reads <X> through <place>", no "asks whether <X> calls for <menu>",
  no double-prepositions, no truncated fragments. Read it aloud: it must sound like a
  person wrote it.
- `whatToDo`: 1-2 sentences of concrete advice for the protagonist that ADDS new
  instruction (do not just restate the scenario's words). Do not start with "Name: ".
- `whyItMatters`: 1-2 sentences connecting the move to the payoff, in this scene's terms.
- The 6 scenarios must be 6 DIFFERENT scenes (different settings/objects/decisions); do
  not share a 5-word phrase across three or more of them.

## BEFORE YOU FINISH — self-check and then write the file
- Re-read every field aloud in your head: does it sound human-authored and specific to
  THIS chapter, or like a filled-in template? If template-ish, rewrite.
- Confirm: correctIndex matches the assigned sequence; 9 questions; 6 cards; 6 examples;
  3 memorable lines copied verbatim from the breakdown; char floors met; no em dashes;
  no banned phrases; every scenario names a source proper noun; valid JSON.
Then write the JSON to your output path. Return a TERSE summary only (one line:
"chNN written; concept=<name>; quiz keys: q1='...' ... q9='...'"); do not paste the
whole JSON back.
