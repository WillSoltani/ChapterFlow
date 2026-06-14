# Polish drive — vary the assembled phrasing (QUALITY ONLY, not a correctness redo)

drive is **correct and shippable** — this is optional polish, not a rescue. The
prior surgical redo fixed the real defects: all quiz keys are right, explanations
match their keys, distractors are genuine, card fronts are real questions, and the
breakdown prose is good and true to the book. **Do not regress any of that.** The
only problem left is that the *assembled* fields are templated across all 11
chapters — same 9 quiz-prompt stems, same 5 card-front stems, one identical
`whatToDo` reused for all 6 examples in a chapter. It reads formulaic. This pass
varies the phrasing; the underlying content stays.

## ⚠️ The #1 risk: do not break a quiz key while rephrasing
The gate does NOT verify quiz correctness — it passed the original broken book and
will pass a newly-broken one. If you reword a prompt or a distractor, the keyed
choice must stay the genuinely correct answer and the explanation must still
justify *that* choice. After editing each chapter, re-read its quiz and confirm
every `correctIndex` still points at the right answer. A rephrase that flips a key
is far worse than the templating you're fixing.

## Scope: the debt, with exact measurements (all 11 chapters)

**1. Identical `whatToDo` across all 6 examples in every chapter.** 66 examples →
only 11 distinct `whatToDo` strings (one per chapter, repeated 6×). E.g. all six
ch06 examples say: *"Set the next practice target just beyond current ability and
pair it with fast, useful feedback."* Six different scenarios (piano studio,
surgical sim lab, coding dojo, basketball film session…) all resolve to the same
generic action.

**2. One quiz-prompt skeleton reused across all 11 chapters.** Each of these stems
appears exactly 11× (once per chapter, concept/domain swapped):
> "<concept>: <domain> reward diagnostic?"
> "<source-case> challenges paid-control assumptions in <domain>. What conclusion follows?"
> "<concept> is overstated in <domain>. Which boundary protects the claim?"
> "<domain> faces compliance pressure. How does <source-case> redirect the policy?"
> "<domain> ownership fades; <concept> must interpret the output rise?"
Many are telegraphic label-colon fragments, not natural questions
("Mastery as an asymptote: piano lesson studio reward diagnostic?").

**3. Five card-front stems reused across all 11 chapters** (each appears 11×):
> "How would you explain this motivation idea: <claim>?"
> "What source example helps explain why <claim>?"
> "When does this supporting claim matter: <claim>?"
> "What does the source case show when <claim>?"
> "What design mistake is avoided when <claim>?"
They're real questions, but every chapter's five cards are the same five stems
with the claim swapped.

## What you change
- `quiz.questions[].prompt` — rephrase as a natural, varied question.
- `quiz.questions[].choices` — only as needed to keep them coherent/plausible (you
  may improve a weak distractor, but keep the keyed choice correct).
- `quiz.questions[].explanation` — drop the templated lead-in ("<domain> first
  move:", "<domain> result:" — some currently name the *wrong* domain); write a
  one-line reason the key is right.
- `reviewCards[].front` — diversify the question stems.
- `examples[].whatToDo` — make each of the 6 specific to its own scenario.

## What you do NOT change
- `quiz.questions[].correctIndex` and *which choice is correct* — preserve exactly.
- `breakdown.*`, `hook`, `counterintuition`, `keyTakeaway`, `reviewCards[].back`,
  `reviewCards[].difficulty`, `implementationPlan.*`, `memorableLines`.
- `examples[].title/tags/planSpec`, the factual grounding of `examples[].scenario`
  and `examples[].whyItMatters`.
- All ids, `number`, `title`, `readingTimeMinutes`, `passingScorePercent`.

## Composition rules

### Quiz prompts
Write each as a real question a person would ask, in the chapter's own terms. Do
NOT reuse one stem for the same question-slot across chapters — vary verb, frame,
and length. The concept/source-case is something the question is *about*, not a
label pasted before a colon. Keep the prompt tied to the keyed answer.

### Example whatToDo
Each of the 6 must describe an action that fits *that* scenario's domain and
format (decision_point, dialogue, audit, planning_choice, postmortem, reflection).
A chapter may share a principle, but the concrete move should differ: the move in
the surgical-sim-lab audit is not phrased like the move in the coding-dojo
planning choice. At least 4 of the 6 `whatToDo`s per chapter must be distinct.

### Card fronts
Vary the stems so a chapter's 5 cards don't all read alike and the same 5 stems
don't repeat chapter to chapter. Each must still be a real, answerable question
whose answer is the existing `back`.

### Optional: F4
`book-gate` flags "rather than" ×40 (budget 15). If convenient while editing,
swap some for "instead of"/"not"/recast. Non-blocking — skip if it forces awkward
phrasing.

## Procedure
1. Work chapter by chapter, ch01 → ch11.
2. After each chapter, RE-READ its quiz and confirm every key is still correct and
   every explanation supports its key.
3. After each chapter: `npx tsx src/cli.ts gate-chapter state/chapters/drive-ch{NN}.v21-native.chapter.json` → 0 blockers.
4. After all: `npx tsx src/cli.ts book-gate drive` → 0 blockers.

## Done condition
- Quiz keys unchanged and still correct (re-verified by reading, not by gate).
- Templating broken up — these greps should drop sharply from 11 each:
  `grep -c 'reward diagnostic?\|challenges paid-control assumptions in\|is overstated in' state/chapters/drive-ch*.json`
  `grep -c 'How would you explain this motivation idea:\|What source example helps explain why' state/chapters/drive-ch*.json`
- Each chapter has ≥4 distinct `whatToDo` across its 6 examples.
- Per-chapter gate-chapter: 0 blockers. Book gate: 0 blockers.
- Untouched fields verified byte-for-byte unchanged.
- Report: per-chapter blocker counts, book-gate count, and confirmation you
  re-read each chapter's quiz keys after rephrasing.
