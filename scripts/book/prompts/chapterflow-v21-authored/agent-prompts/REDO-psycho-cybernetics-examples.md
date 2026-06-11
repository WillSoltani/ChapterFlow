# Redo psycho-cybernetics — examples (de-template scene slate) + counterintuition variation

You are doing **1 edit in every chapter** (rewrite the 6 example scenarios) plus **1 secondary edit
in the 10 flagged chapters** (vary the counterintuition opener). Nothing else changes.

This is a **quality (GENERATED_DRAFT) redo, not a blocker redo.** Every gate already passes GREEN with
**0 blockers** — that is exactly the problem. The book reads as a templated draft, not a finished,
publishable book. QC scored **ch01 GREEN (~91)** but **ch08 and ch15 YELLOW (REVISE)**, both on the
same defect; the pattern is measurable in every chapter's example slate. Do **not** chase the gate — it
is already satisfied. Fix the two patterns below and the chapters become publishable.

**Correctness is fine. Do not touch it.** All 27 quiz keys in the three QC'd chapters (ch01/ch08/ch15)
were hand-verified correct against the source; the SUCCESS acronym (ch08) and Selye / *The Stress of
Life* / 1956 (ch15) are accurate; prose teaches well; sidecars are real. This redo is purely about
de-templating the example scenes (and the paradox openers), nothing semantic.

## What you change
1. **Every `examples[].scenario`** in all 15 chapters — de-template the scene slate (see Rule 1).
2. **`counterintuition`** in the 10 chapters flagged for the negation shell — Ch **1, 2, 3, 7, 8, 9,
   11, 12, 13, 14** — vary the opener so it is not "X is not Y. [correction]" (see Rule 2).

## What you do NOT change
- **`quiz.questions[].correctIndex` — do NOT move a single key in any chapter.** (27 verified correct;
  the rest will be re-QC'd. None may move regardless.)
- **`quiz` prompts and `choices`** — leave them as written. (No persona drift was found, so you should
  not need to touch a quiz to fix a name. If a scenario rewrite genuinely forces a name change, keep
  the name consistent everywhere, but never change which option is correct or the wording of a choice.)
- `examples[].whatToDo`, `whyItMatters`, `planSpec` (domain/audience/stakes/format/requiredBeat),
  `tags`, `sourceAnchorId`, `exampleId`, `title` — **unchanged.** You re-stage the *scenario* only; the
  `requiredBeat` must still happen and the `whatToDo`/`whyItMatters` must still follow from it.
- `breakdown` (all three reads), `hook`, `tryThisNow`, `keyTakeaway`, `reviewCards`,
  `implementationPlan`, `memorableLines`, `schemaVersion`, `number`, `title`, `readingTimeMinutes` —
  **unchanged.** (The only breakdown-adjacent edit allowed is the `counterintuition` field under Rule 2.)

## Why this redo exists

The writer shipped chapters where every quiz key is correct and the prose teaches well, but the **6
example scenes in each chapter are mass-produced from one mold.** Two patterns make the book read as a
draft:

**Pattern A — one scene skeleton across the whole slate (the most-missed defect).** In most chapters
≥4 of the 6 scenarios fit a single sentence template:
> *"[Name], at [a clock time], in [a place], holding [an object tied to the lesson]; [a pressure];
> **before [an imminent event], [Name] must [decide / choose / answer] whether [A] or [B].**"*

If one sentence describes all six scenes, the slate fails — and here it does. Measured across the book:

| ch | "must decide/choose…" closers | "before [event]" clauses | clock-time stamps |
|----|------|------|------|
| 01 | 1/6 | 3/6 | 0 |
| 02 | 0/6 | 1/6 | 0 |
| 03 | 1/6 | 5/6 | 1 |
| 04 | 0/6 | 4/6 | 0 |
| 05 | 1/6 | 4/6 | 0 |
| 06 | 2/6 | 5/6 | 1 |
| 07 | 0/6 | 4/6 | 1 |
| **08** | **4/6** | 5/6 | 0 |
| **09** | **3/6** | 5/6 | 2 |
| **10** | **3/6** | 5/6 | 0 |
| 11 | 0/6 | 3/6 | 0 |
| 12 | 2/6 | 3/6 | 0 |
| **13** | **3/6** | 3/6 | 0 |
| 14 | 0/6 | 4/6 | 0 |
| **15** | **6/6** | 3/6 | **5** |

**ch15 is the worst** — all 6 scenes are "[Name] at [7:00 a.m. / Tuesday noon / 6:10 p.m. / Friday's
bell / 10:20 a.m. / 7:45 p.m.] … before [event] must [apply the lesson]." Verbatim:
- ex01 Yasmin: "…**before the 7:00 a.m.** cardiac-rehab class begins … **Before the warmup starts, she
  must** tell the group why the age verdict itself can add strain."
- ex03 Graham: "He is a retired machinist **at 6:10 p.m.** … **Before the class list closes, he must**
  answer the pull of enthusiasm…"
- ex05 Lacey: "…fourteen readings on the wellness dashboard **by 10:20 a.m.** … **Lacey must** show
  that renewal … will fail if stress and purpose stay untouched."
- ex06 Anika: "Anika returns the brochure to the kitchen table **at 7:45 p.m.** … **After dinner, she
  must** offer more life…"

**ch08** is the same skeleton without clock times — "Before the agenda closes, Paolo must…" / "Before
the next lap, he needs to choose…" / "before tomorrow's product note goes out … which facts" / "Gerald
has a decision to make before the call connects" / "Before he answers the school email, Pierre needs to
choose…" / "Everly needs to decide how to correct…" — a "choose [right] instead of [wrong]" closer in
all six.

**The "before [event]" deadline clause is over-used book-wide** (3–5 of 6 in nearly every chapter) and
is the connective tissue of the mold. It is not a gate finding — the deterministic gates **cannot** see
a shared scene shape (clock times and decision language are legitimate in gold books), which is exactly
why a human caught it and you must fix it by hand.

**Pattern B — the paradox opener is a fixed negation shell (gate finding B11).** 10 of 15
`counterintuition` fields open with "X is not Y. [correction]." Verbatim:
- ch02: "A useful goal system **does not** prove itself by moving in a perfect first line. **It** proves
  itself by receiving error…"
- ch07: "Happiness **is not** the prize after life cooperates. **Here it is** trained conduct…"
- ch09: "The negative feeling **is not** the failure mechanism; ignoring its warning is…"
- ch12: "Peace of mind **is not** blankness. **It is** the trained pause…"
- ch13: "Pressure **does not** create skill. **It** reveals whether skill was rehearsed…"
- ch14: "Confidence **is not** a personality prize you wait to receive. **It is** a rehearsed
  expectation…" (also ch01, ch03, ch08, ch11)

## Files
- Chapter JSONs to modify: `state/chapters/psycho-cybernetics-ch{01..15}.v21-native.chapter.json`
- Source notes per chapter (**these exist and are real — ground every rewritten scene in them**):
  `.chapterflow/runs/psycho-cybernetics/20260605-123749/sidecars/source/ch{NN}.source.json`
  (use `namedExamples[]`, `testableFacts[]`, `paraphraseNotes`, `hardEdge` — do **not** invent new
  source facts; only re-stage the teaching beat the scene already carries).
- Book toc: `.chapterflow/runs/psycho-cybernetics/20260605-123749/source-freeze/toc.json`

## Rules

### Rule 1 — `examples[].scenario` composition rule (all 15 chapters)
Rewrite each scenario so the slate of 6 scenes reads like 6 different writers wrote them. The
`requiredBeat`, `domain`, `audience`, and `format` in `planSpec` stay fixed — only the prose staging changes.

1. **Delete every clock-time stamp.** No scenario may contain a digital/named clock time — "7:00 a.m.",
   "6:10 p.m.", "by 10:20 a.m.", "at noon", "Tuesday noon", "Friday's bell" as a time cue. If a scene
   needs temporal grounding use a *natural* beat ("on the third unpaid Saturday", "the morning the lease
   renewed", "after the last patient left") — never a clock reading. (Priority: **ch15** 5 stamps, **ch09** 2.)
2. **Break the "before [event], [Name] must [decide/choose] whether A or B" closer.** **At most ONE**
   scenario per chapter may end on an explicit either/or decision sentence, and at most **two** may use
   a "before [event]" deadline clause at all. Vary how the tension lands across the other scenes: an
   action interrupted mid-step; a number that doesn't reconcile; a thing already done that now has to be
   undone; a line a second person says; a quiet realization with no deadline. Keep the `format` intent
   (dialogue / data_audit / reflection / aftermath / reset_moment …) but realize it differently each
   time. (Priority: **ch15** 6/6, **ch08** 4/6, **ch09/10/13** 3/6.)
3. **Each scene keeps its own concrete, domain-appropriate setting** drawn from `planSpec.domain` —
   not a rotating "[place] at [time]; [Name] must…" header. The named human still acts; the
   `requiredBeat` still happens; the source anchor it cites stays true.
4. **Do not over-correct into a concept essay.** Keep a real, specific, named human doing a concrete
   thing. The fix is *variety of shape*, not *removal of scene*.

Reference point: **ch02 and ch11** already sit at the target (must-frame 0/6, 0 clock-stamps). Match
their naturalness; don't make any chapter look more templated than those.

### Rule 2 — `counterintuition` variation (Ch 1, 2, 3, 7, 8, 9, 11, 12, 13, 14 only)
Each of these opens with the same "X is not Y. [It is / Here it is] [correction]" negation shell. Rewrite
the opener so **no more than ~3 chapters book-wide** still use that exact shape. Keep the *claim*
identical — only the rhetorical frame changes. Vary among: lead with the sharper claim directly; pose
the paradox as a question; open on the consequence; open on the mechanism. Do not change what the
counterintuition asserts, and do not touch any other breakdown text.

### Optional cheap cleanups (do only if zero-risk; non-blocking majors)
- **B13** — 11 chapters open the `hook` with the word "a". If you can vary a few `hook` first words
  without weakening them, do so; skip if it costs quality.
- **F4** — "rather than" appears 22× (budget 15). Replace ~7 instances with "instead of", "not", or a
  recast clause where it reads naturally.

## Procedure
1. Work chapter by chapter, ch01 → ch15. Do **ch02** first as a structure/length reference.
2. After each chapter, run and require **0 blockers** (regression guard — gates already pass; don't
   introduce new blockers):
   `npx tsx src/cli.ts gate-chapter state/chapters/psycho-cybernetics-ch{NN}.v21-native.chapter.json`
3. Self-check each chapter before moving on:
   - `grep -nE '[0-9]{1,2}:[0-9]{2}|[Aa]t noon|noon|midnight' state/chapters/psycho-cybernetics-ch{NN}.v21-native.chapter.json`
     → **no clock-time matches inside any `scenario`** (Rule 1.1).
   - At most **one** scenario ends on "must … whether … or …" and at most **two** contain "before"
     (Rule 1.2).
   - One sentence template must **not** describe all six scenes — read the six openers in a row; they
     should not rhyme.
4. After all chapters: `npx tsx src/cli.ts book-gate psycho-cybernetics` → **0 blockers**. The B11
   major should now be gone (or ≤ a few chapters); B13/F4 majors may remain (non-blocking).

## Done condition
- All 15 chapters' example slates de-templated: no clock stamps; ≤1 either/or closer and ≤2 "before"
  clauses per chapter; the 6 openers in each chapter do not share one sentence template; each scene
  keeps its own domain-appropriate setting and its `requiredBeat`.
- `counterintuition` varied in Ch 1/2/3/7/8/9/11/12/13/14 (claim unchanged; ≤~3 chapters still use the
  negation shell).
- **Untouched fields verified unchanged — especially every `correctIndex`, every quiz choice, every
  breakdown teaching paragraph, every `whatToDo`/`whyItMatters`/`planSpec`.**
- Per-chapter `gate-chapter`: 0 blockers. `book-gate`: 0 blockers.
- **Editing the chapters will mark the existing QC attestations STALE** (ch01 PASS, ch08/ch15 REVISE) —
  that is expected. The book must be **re-QC'd** (re-read + re-attest ch01/ch08/ch15, spot-check 1–2
  fresh chapters) before `promote-book`. **Do not run `promote-book`, `generate`, or `research`
  yourself.**

Report back: per-chapter `gate-chapter` blocker count, `book-gate` blocker count, and — for ch08 and
ch15 — the 6 rewritten scenario openers in a list so the de-templating is visible at a glance.
