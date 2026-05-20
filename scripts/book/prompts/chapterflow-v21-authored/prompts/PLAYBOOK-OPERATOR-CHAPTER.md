# PLAYBOOK — Operator-driven chapter generation

This playbook produces **one chapter** as a complete `ChapterV21` JSON file, in-session, no subprocess calls. Each chapter is one big artifact you produce by following the steps below in order. The downstream ship gate validates the JSON; if anything fails, you iterate on the offending field.

You are replacing 11 separate writer agents (editor-in-chief, curriculum-planner, hook, breakdown, examples, quiz, cards, implementation-plan, key-takeaway, memorable-lines, voice-pass) with one focused playbook. Quality depends on you reading carefully and producing each section deliberately.

---

## Inputs you need

- Book **bookId** (slug). The source bundle must already exist at `.chapterflow/runs/<bookId>/<runId>/`.
- Chapter **number** to produce.
- The chapter's source notes (you'll read them in step 0).
- (For chapters 2+) the prior chapters already produced in this book, so voice stays consistent and you don't reuse hooks / examples / names.

## What you are producing

```
scripts/book/prompts/chapterflow-v21-authored/state/chapters/<bookId>-ch<NN>.v21-native.chapter.json
```

One file. A complete `ChapterV21` object matching the schema in [src/types.ts](../src/types.ts) lines 364–391.

After you write the file, run the ship gate (step 12). If it passes, the chapter is ready for assembly. If it fails, iterate on the failing fields and re-run.

---

## Step 0 — Read inputs

```bash
# Source notes for THIS chapter
cat .chapterflow/runs/<bookId>/<runId>/sidecars/source/ch<NN>.source.txt

# Bibliography (for voice + teaching arc)
cat .chapterflow/runs/<bookId>/<runId>/source-freeze/toc.json

# Prior chapters already produced (for variety / voice / dedup)
ls scripts/book/prompts/chapterflow-v21-authored/state/chapters/<bookId>-ch*.v21-native.chapter.json 2>/dev/null || echo "no prior chapters"
```

If prior chapters exist, read at least the most recent 1-2 of them. This is the only way to keep voice consistent and avoid re-using:
- Hook first-words (cap 50% of chapters at the same first word)
- Counter shapes (cap 40% at the same shape)
- Example domains (no two chapters in same domain)
- Protagonist names (every named protagonist must be unique book-wide)
- Quiz distractor phrases (no 5+ word distractor phrase repeats across chapters)

---

## Step 1 — `hook` (60-120 chars, arresting one-liner)

The hook is the first thing the reader sees. It must:
- Be 60-120 characters.
- NOT open with a meta-reference ("In this chapter", "The chapter argues", "The author"). The ship gate fails closed on B1.
- NOT start with the same first word as ≥50% of prior chapters in this book.
- Read like a scene, a number, a verdict, or a confrontation — not like a topic sentence.

Good hooks open with concrete imagery: "A team labels every alert urgent, and within a week the page no longer means anything." "Six minutes before tipoff, the coach stops the play and walks off the floor." "The cheapest way to lose a year is to spend it deciding which year to skip."

Don't use em dashes (—) anywhere in the chapter. Use commas, periods, parens, or colons.

---

## Step 2 — `counterintuition` (1-2 sentences)

The counter is the chapter's surprise — the thing a careful reader did not expect. It must:
- Be observable as a clear claim ("X is not Y; the real lever is Z").
- NOT be templated. Banned opener stems include "Most readers assume", "Most people assume", "The paradox is", "The mistake is", "The trap is to", "It feels like", "the real lever is", "the real move is", "the hard move is" — see [config/banned-phrases.json](../config/banned-phrases.json) for the full list.
- NOT reuse the counter SHAPE of ≥40% of prior chapters. Shapes include: negation-correction ("X is not Y, but Z"), inversion ("you'd expect A but get B"), paradox ("the more you X, the less you Y"), etc.
- Speak directly to the reader's wrong default, not as an abstract observation.

---

## Step 3 — `tryThisNow` (80-220 chars, optional but recommended)

One specific 30-90 second action the reader can do right now or at their next obvious moment. Directive, not question. Renders as a mid-chapter callout.

Examples:
- "Open the calendar for next Tuesday and block one 45-minute window labeled with the actual task name, not 'focus time' or 'deep work'."
- "Pull up the last three emails you sent. Mark the one that closes a loop, the one that opens one, and the one that does both."

Bad:
- "Take some time to think about your priorities." (vague, not specific)
- "What would you do if you only had one task to finish today?" (question, not directive)

---

## Step 4 — `keyTakeaway` (140-220 chars)

The single sentence that should survive if the reader remembers nothing else. Specific, falsifiable, names the mental move.

- Max 30 words (A14 cap).
- NOT a paraphrase of the chapter title.
- NOT a banned phrase ("That matters because", "boundary condition", etc.).
- No meta-references.

---

## Step 5 — `breakdown` (three tiers: fastRead, deepRead, fullRead)

Three progressively longer prose treatments of the same idea. Each tier should be readable standalone but each successively layered with more depth. Length floors are blocker-level (A15):

| Tier | Min chars | Target | Reader |
|---|---|---|---|
| `fastRead` | 350 | 400-700 | 2-minute read |
| `deepRead` | 1000 | 1200-1800 | careful reader |
| `fullRead` | 2400 | 2500-3500 | full depth |

### Rules for every tier

- **No meta-references.** Never "this chapter", "the chapter", "the book", "the author", "Chapter N". Write the claim directly.
- **No author-surname-verb.** Never "Clear argues", "Kahneman says", "Taleb claims".
- **No em dashes.** Use commas, semicolons, parens, or colons.
- **Plain words.** If a four-syllable word and a one-syllable word convey the same thing, use the one-syllable word.
- **Avg sentence length:** fastRead ≤14 words, deepRead ≤16 words, fullRead ≤18 words. No sentence over 30 words anywhere (B7 / E1 / E3).
- **Vary paragraph openers.** Avoid the same first word across paragraphs in the same tier.
- **Concrete openers.** Every paragraph should start with something specific — a scene, a number, a name, a verb. Never a definition ("Productivity is…") or a generic abstraction.
- **Layered, not redundant.** fastRead → deepRead → fullRead should ADD content, not repeat. The B8 critic checks for 4+ word verbatim phrases shared between tiers.
- **Voice charter consistency.** Match the author's register from the bibliography. If their voice is "plainspoken", don't drift into "literary" mid-chapter.

### What each tier does

- **fastRead** — scene + rule. One vignette, then the move. End on the takeaway.
- **deepRead** — mechanism + second scene. Why the move works, plus a second example that stress-tests it.
- **fullRead** — depth + third angle + limits. The third example, the boundary case, the failure mode of the move, and a closing line.

### Voice-pass discipline

Once you've drafted all three tiers, re-read them as a unit. Check:
- Is there a closing-line landing in each tier? (B7)
- Are tier-to-tier verbatim phrases under 4 words? (B8)
- Does each tier start concrete?
- Are paragraph openers varied?

If any check fails, revise.

---

## Step 6 — `examples` (3-9 examples per chapter)

The hardest part. Examples are the place where v13 / v21 books most often shipped templated content. The ship gate has 5+ critic checks here.

### Per-example schema

```ts
{
  exampleId: "ex01",            // ex01..exNN
  title: string,                // brief identifier, e.g. "Maria's pull request"
  tags: string[],               // 1-4 short descriptors, ≤40 chars each
  planSpec: {
    domain: string,             // specific, e.g. "asking for a raise at a late-stage startup"
    audience: string,           // who this speaks to
    stakes: string,             // what's at risk
    format: string,             // see ExampleFormat type in types.ts
    requiredBeat: string        // the exact beat the example must hit
  },
  scenario: string,             // 280-520 chars
  whatToDo: string,             // 120-240 chars
  whyItMatters: string          // 120-240 chars
}
```

### Rules (every one matters; the ship gate enforces them all)

1. **Named protagonist (C1).** Every scenario opens with a named person (not "a manager", not "an engineer"). Use names that have NOT appeared in any prior chapter of this book and are NOT in the banned name pool: `Priya, Omar, Maya, Marcus, Elena, Lena, Victor, Theo, Jonah, Mateo, Tessa, Owen, Mira, Malik, Nadia, Felix, Caleb, Talia, Elise, Naomi`. Pick names that fit the cultural setting of the scenario.
2. **Specific scene (C2).** The scenario names a time, a place, a role, a concrete artifact. "On Tuesday at 4 PM in the Berlin warehouse, Hanna sees the manifest on her tablet…" not "A manager reviews paperwork…"
3. **Decision point (C3).** Every scenario contains a moment where the protagonist must choose. The choice mirrors the chapter's core move.
4. **No template across examples (C8).** No two examples in the chapter share a Cartesian-product shape (same skeleton with name/role/city swapped). Each scenario is structurally different.
5. **No alphabet-cycling names (C9).** Don't pick names A, B, C, D, E, F across examples. Vary deliberately.
6. **No title verb shell (C10).** Don't have all titles open with the same verb ("Maria handles…", "Theo handles…", "Nina handles…"). Vary the verb.
7. **Distinct domains.** No two examples in the chapter use the same domain. Span industries / settings / role types.
8. **whatToDo is one move, not a list.** State the action the protagonist took (or should take). One verb, one object, one reason.
9. **whyItMatters is the lesson.** What does this scene teach about the chapter's move? Don't repeat the scenario.

### Length floors

- `scenario`: 280-520 chars
- `whatToDo`: 120-240 chars
- `whyItMatters`: 120-240 chars

### How many examples

3-9 per chapter. Default: 5-6. Use fewer for short chapters (sub-30-min read), more for long chapters with multiple moves.

---

## Step 7 — `quiz` (6-12 questions; default 9)

This is where the audit found the most defects. Read this section twice.

### Per-question schema

```ts
{
  questionId: "q01",            // q01..qNN (auto-renumbered)
  prompt: string,               // 60-380 chars, a scenario stem the reader must reason about
  choices: string[],            // exactly 3 items; only one correct
  correctIndex: number,         // 0, 1, or 2
  explanation: string,          // 120-300 chars
  bloomsLevel: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create",
  depthLevel: "simple" | "standard" | "deep"
}
```

### Non-negotiable rules

1. **Test application, not recall.** Forbidden stems: "What does the chapter say…", "According to the author…", "In this chapter…". If a question can only be answered by having read the source text, it is wrong.
2. **Scenario stems.** Each prompt puts the reader in a situation. Good: "A hiring manager scoring resumes after a late dinner notices that one candidate…" Bad: "Which of these is a heuristic?"
3. **Distractors are plausible mistakes.** Three defensible-sounding choices, only one of which actually follows from the chapter's move. Distractors should reflect the exact heuristic / bias / shortcut the chapter is warning about.
4. **No absolute words in wrong distractors.** Never `always`, `never`, `automatically`, `impossible`, `guaranteed`, `entirely`, `ever`, `forever`, `completely`, `wholly`, `absolutely`, `under no circumstances`, `in all cases` in a wrong choice. Test-takers should pick the right answer because they understand the idea, not because they spot an extreme word. **BP15 blocker.**
5. **Length parity.** Correct/avg-distractor word-count ratio < 1.4. If your right answer ends up 1.5× longer, shorten it or expand distractors with scenario-specific content. **BP16 blocker at ratio ≥2.0, MAJOR at ≥1.5.**
6. **Correct-answer position balanced.** Across N questions, correctIndex distribution roughly uniform. Never >50% in any one position. Never >40% in position 0.
7. **Distractors reference the prompt's scenario.** Every wrong choice must name the prompt's specific actor, role, decision, or scenario noun. Generic tail clauses ("fits the immediate pressure around", "given the constraints in play", "based on the available signal") are forbidden — the ship gate flags them as BP19 blockers (full list in [config/banned-phrases.json](../config/banned-phrases.json)).
8. **No cross-chapter distractor reuse.** No 5+ word phrase repeats across the quiz distractors of this chapter and any prior chapter. Read the prior chapters' quizzes before writing.
9. **No label-shaped correct answers.** A correct answer of ≤6 words with no verb ("Cut charting time.") reads as a label. Extend with scenario-specific detail.
10. **Capitalize every choice's first letter.** No lowercase starts.
11. **No duplicate choices within a question.** The three choices must be distinct.
12. **No `whyItMatters` on questions.** The validator rejects any field outside the schema. Validator returns 422.
13. **No em dashes anywhere.** No banned phrases.
14. **Vary openers.** No more than 5 of 9 questions may start with "A " or "An ". Use "When a manager…", "Your team…", "A colleague argues…", "Which test best reveals…", "If your forecast missed…".
15. **Bloom's mix.** Match the planner's target (or your own plan). Typical 9-question mix: 3 apply, 2 analyze, 2 evaluate, 1 understand, 1 remember.

### Test yourself on each question

Before saving, for each question, complete:
- Could a test-taker who skimmed the chapter get this wrong if they understood the idea? (If yes — distractor is too easy.)
- Does the right answer name something specific from the prompt's scenario? (If no — it's a label.)
- If I score the choices by length only, do I get the right answer? (If yes — fix length parity.)

---

## Step 8 — `reviewCards` (5-9 cards, default 6)

Spaced-repetition cards. The reader sees the `front`, recalls, then sees the `back`.

### Per-card schema

```ts
{
  cardId: "card01",
  front: string,                // 30-200 chars
  back: string,                 // 80-400 chars
  difficulty: "easy" | "medium" | "hard"
}
```

### Rules

1. **front is retrieval, not lookup.** "What does it cost a team to label every alert urgent?" not "Define urgency dilution."
2. **back is the answer.** Plain, specific. References the chapter's core move.
3. **No identical or near-identical backs across cards (C11).** Each back is its own answer.
4. **No quiz-prompt templating (C12).** Don't reuse the quiz's exact phrasing.
5. **No title-keyword injection (C13).** If the chapter title is "The Tax of Urgency", don't shoehorn "tax of urgency" into every front.
6. **front circularity check (C21).** If 4+ of the first 6 content words on the front appear in a back ≤30 words, you've made a circular card. Rewrite.

---

## Step 9 — `implementationPlan` (one per chapter)

```ts
{
  title: string,                // 4-7 words naming the specific skill this plan teaches
  coreSkill: string,            // 2-4 sentences, plain prose
  ifThenPlans: Array<{
    context: string,            // free-form
    plan: string                // 1-2 sentences, "If X, then Y"
  }>,
  twentyFourHourChallenge: string,   // one-day commitment
  weeklyPractice: string             // one-week practice
}
```

### Rules

1. `title` is a NEW skill name, NOT the chapter title. "Run a 10-minute pre-mortem" not "Pre-mortems".
2. `coreSkill` describes the action the reader takes, not the concept.
3. `ifThenPlans` are 3-5 items. Each must be a concrete trigger ("If your inbox has more than 20 unread items by 10 AM…") followed by a concrete action ("…then close the inbox tab and open the calendar instead.").
4. `twentyFourHourChallenge` is one specific 24-hour commitment with a verifiable outcome.
5. `weeklyPractice` is one practice that compounds across a week.
6. No banned phrases. No em dashes. No meta-references.

---

## Step 10 — `memorableLines` (exactly 3 lines)

Three sentences from the breakdown (fastRead/deepRead/fullRead) that the reader could quote on a share card. Each must:

```ts
{
  text: string,                // EXACT verbatim sentence from the breakdown
  location: string,            // "breakdown.fastRead" | "breakdown.deepRead" | "breakdown.fullRead"
  why: string                  // 1 sentence: what makes it stick
}
```

**The text MUST appear verbatim in the breakdown.** The ship gate (A11) checks for this. If you rewrite breakdown prose after marking lines, you have to re-mark.

Pick sentences that are:
- Aphoristic (compact, complete claim)
- Specific (names a thing, not an abstraction)
- Quotable (sounds like the author when read aloud)

---

## Step 11 — Assemble the ChapterV21 JSON

Put everything together into one object matching the `ChapterV21` schema:

```ts
{
  chapterId: "<bookId>-ch<NN>",
  number: <N>,
  title: "<exact chapter title from index>",
  readingTimeMinutes: <number — 8-15 typical>,
  hook: "<step 1>",
  counterintuition: "<step 2>",
  tryThisNow: "<step 3>",
  keyTakeaway: "<step 4>",
  breakdown: {
    fastRead: "<step 5 tier 1>",
    deepRead: "<step 5 tier 2>",
    fullRead: "<step 5 tier 3>"
  },
  examples: [ /* step 6 */ ],
  quiz: { passingScorePercent: 70, questions: [ /* step 7 */ ] },
  reviewCards: [ /* step 8 */ ],
  implementationPlan: { /* step 9 */ },
  memorableLines: [ /* step 10 */ ]
}
```

Save to:
```
scripts/book/prompts/chapterflow-v21-authored/state/chapters/<bookId>-ch<NN>.v21-native.chapter.json
```

---

## Step 12 — Run the ship gate

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts gate-chapter \
  scripts/book/prompts/chapterflow-v21-authored/state/chapters/<bookId>-ch<NN>.v21-native.chapter.json
```

The gate reports:
- `PASS` → chapter ready
- `BLOCK` → list of findings. Fix the offending fields and re-save, then re-run the gate.

Common blocker fixes:
- B1 meta-reference → rewrite the prose without "this chapter / the author / Chapter N"
- B5 em dash → replace — with , or . or :
- A15 tier too short → expand to floor
- A11 memorable line not found in breakdown → either restore the sentence verbatim to breakdown or repoint memorableLines[i].text to a sentence that IS in the breakdown
- A12 capitalization → fix sentence-initial casing
- C1 unnamed protagonist → add a name to every scenario opener
- C9 alphabet-cycling names → diversify
- BP15 strawman in distractor → replace `always`/`never`/etc. with a scenario-anchored qualifier
- BP16 length ratio → shorten correct or lengthen distractors with scenario-specific content
- BP17 opener monotony → vary "A "/"An " openers
- BP19 banned tail-clause → rewrite distractor with prompt-specific language

The gate iterates as you fix. Once it PASSes, the chapter is ready.

---

## Done

Move to the next chapter (back to Step 0 with the next chapter number). Or, if all chapters are done, finalize via:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts finalize-book <bookId> \
  --title "<title>" --author "<author>" \
  --categories "Productivity,Habits" --tags "habits,systems,compounding"
```

(See PLAYBOOK-OPERATOR-FINALIZE.md for full finalization steps.)
