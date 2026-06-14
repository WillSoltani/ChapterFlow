# Redo drive — MAJOR cleanup of the generated support sections (all 11 chapters)

drive's **core is right and the breakdown's argument is accurate to the book** —
but the generated package (deepRead, fullRead, examples, quiz, review cards,
implementation plan) reads like a draft, not a finished ChapterFlow chapter. An
independent final QC scored the Purpose chapter **61/100, "not publishable yet"**,
and the same defects are present in **all 11 chapters** (verified by grep — counts
below). This is a medium-to-major cleanup, NOT a from-scratch rewrite: the hooks,
counterintuition, key takeaways, and fastRead are good — keep them. Rewrite the
support sections to the standard of a finished chapter.

## ⚠️ This is a QUALITY/PUBLISHABILITY bar, and the gate cannot see it
`book-gate drive` → PASS, 0 blockers (only F4). Every quiz key is already
*correct*. None of that is the problem. The problem is that the questions,
distractors, cards, examples, and plan are template-assembled and don't read like
a person wrote them. Do not use the gate to judge this cleanup — it will pass the
current bad version and a good one alike. The check is reading it.
**While rewriting quizzes, the keyed answer must stay the correct one** (a reword
that flips a key is worse than the templating — the gate won't catch it; re-read
each quiz after editing).

## What to KEEP (do not touch)
`hook`, `counterintuition`, `keyTakeaway`, `breakdown.fastRead` (light polish only),
`memorableLines` (keep #2 and #3; replace #1 only if it's weak), all ids, `number`,
`title`, `readingTimeMinutes`, `passingScorePercent`, `quiz.questions[].correctIndex`
(the keyed *answer* stays correct — you may move its position only if you also
update correctIndex to still point at it).

## What to FIX, per chapter, all 11

### 1. deepRead — rewrite for clarity (HIGH)
Current deepRead has a duplicated, clunky seam in **every chapter** (11/11):
> ch07: "Purpose motive means The purpose motive is the need to connect effort…"
> ch01: "Motivation operating systems means A motivation operating system is…"
> (also ch03 "Narrow reward fit means N…", ch05 "Ts of autonomy means A…", ch09 …)
and then lists source-claim fragments ("TOMS Shoes: …. Mayo Clinic: …. People
persist differently…") instead of flowing. **Rewrite as normal explanatory prose**
that states the mechanism once and develops it. Never write "<Concept> means The
<concept> is …".

### 2. fullRead — trim 25–35% (MEDIUM-HIGH)
It explains the source anchors, then re-explains the same purpose/profit/meaning
(or equivalent) point again in the closing paragraph. Cut the repetition; keep one
clean pass through the anchors plus the limit.

### 3. examples — rewrite as real scenes (HIGH)
Current examples are planning notes, not scenes. Tells present book-wide:
`planSpec.stakes` = "Use <source-case> to apply <Concept> without flattening the
source lesson"; `requiredBeat` = "Apply <Concept> through <source-case> in a
<domain> situation"; scenario = "<Name> weighs whether <X> during the <domain> at
<time>. <verbatim source sentence>." Rewrite each scenario as a **real moment with
a person, a concrete tradeoff, and a visible decision** — e.g. instead of "Ilya
weighs whether the budget decision proves the mission … during the nonprofit board
meeting at 3:49 p.m.", write a board facing a real choice: outreach gets cut while
the rebrand budget grows, and someone has to decide what that proves about the
mission. `whatToDo` stays a concrete action (these are mostly fine now); make
`whyItMatters` a real consequence, not an appended source line.

### 4. quiz — rewrite fully (CRITICAL)
The keys are correct but the questions are template Mad-Libs and the distractors
are generated source-summary fragments, not real answer options. Present in **all
11 chapters** (each appears 11×):
- "<source-case> would be managed through <thing>; <metric> would outrank <good>."
- "<concept> should be simplified into the <thing>; <reporting> would center …"
- "<domain> should use <thing> first, then ask later whether <concept> lost …"
Example flagged by QC (ch07 q01): *"TOMS Shoes would be managed through mission
badges in the nonprofit board meeting; campaign optics would outrank
contribution."* — not a useful distractor.

Rewrite each question as a **concrete situation with three plausible answers**, the
way the QC illustrated:
> Prompt: "A nonprofit claims community health is its purpose, but its budget cuts
> outreach and increases branding. What should the board inspect first?"
> Correct: "Whether the budget proves the mission or treats it as decoration."
> Distractors: realistic-but-wrong moves a real board might actually consider
> (e.g. "Whether the new branding tests well with donors", "Whether outreach can
> be deferred to next quarter") — wrong because they dodge the mission-proof
> question, NOT because they're nonsense fragments.
Distractors must be things a thoughtful reader could genuinely pick. The keyed
answer must directly answer the prompt (not just be a true source sentence). Drop
the "Purpose diagnostic: …" templated explanation lead-ins; write one sentence on
why the key is right and why the tempting distractor is wrong.

### 5. review cards — rewrite mostly (MEDIUM-HIGH)
Cards test source recall, not understanding. Tells (book-wide): fronts like "How
should the reader use this source claim: <claim>?", "How does this source detail
sharpen <Concept>: <claim>?", "What source lesson should a reader take from
<source-case>?", with backs that restate the claim. Rewrite fronts as questions
that test **practical understanding** ("When a mission sits on the wall but never
changes a budget, what is it?" → "Decoration, not motivation"). Backs should answer
in the reader's terms, not quote the source line.

### 6. implementation plan — rewrite fully + add a concrete tool (HIGH)
Current plan is not reader-friendly: coreSkill = "Use <source-case> as the source
check"; ifThenPlans = "If <source-case> fits the situation, then use this source
lesson: <claim>"; the 24-hour challenge appends long copied warning text as a
run-on. Replace with a **simple, usable audit/checklist tool**. For the Purpose
chapter, the QC proposed exactly this — build it:

> **Purpose Receipt Check** (or "Contribution Proof Test")
> | Step | Question |
> |---|---|
> | Contribution | Who benefits beyond us? |
> | Decision | What choice proves that benefit matters? |
> | Tradeoff | What would we give up to protect the purpose? |
> | Autonomy | Do people have room to act on the purpose? |
> | Mastery | Does the work help people improve at meaningful contribution? |
> | Proof | Where is the receipt — budget, calendar, policy, customer outcome, behavior? |

Give each of the other 10 chapters one analogous concrete tool grounded in that
chapter's concept (a short named check the reader can run on a real decision), not
"apply <source-case> to a real decision."

## Verified scope (so you know it's every chapter, not one)
- `grep -o 'would be managed through' …drive-ch*.json | wc -l` → 11
- `grep -o 'would outrank' …` → 11 ; `'should be simplified into'` → 11 ; `'first, then ask later whether'` → 11
- `grep -o ' means [A-Z]' …` (the deepRead seam) → 11
- planning-note example stakes "to apply … without flattening the source lesson" present across chapters

## Procedure
1. Work chapter by chapter, ch01 → ch11. Start with ch07 (Purpose) as the model
   since the QC specced it in detail; match that quality everywhere.
2. After each chapter, RE-READ the quiz and confirm every key still answers its
   prompt and is correct.
3. `npx tsx src/cli.ts gate-chapter …drive-ch{NN}…` → 0 blockers.
4. After all: `npx tsx src/cli.ts book-gate drive` → 0 blockers.

## Done condition (read, don't trust the gate)
- These greps drop to ~0: `would be managed through`, `would outrank`,
  `should be simplified into`, `first, then ask later whether`, ` means [A-Z]`
  (the deepRead seam).
- Quiz distractors are realistic wrong answers; keys answer the prompt and stay correct.
- Cards test understanding, not source recall.
- Examples read as real scenes with a person, tradeoff, and decision.
- Each chapter's implementation plan has one concrete named tool/checklist.
- deepRead/fullRead read as clean, non-repetitive prose.
- Report: per-chapter blocker counts, book-gate count, and a 3–4 sentence summary
  of what you changed and what you verified by re-reading (not gate output).
  Target quality: the QC's "possible after cleanup" of 88–92.
