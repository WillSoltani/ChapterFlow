# Redo the-5-am-club — quiz answer-POSITION rebalance (reorder only)

This is a **surgical, correctness-preserving** pass. You are changing **only the
position** of the correct answer in quiz questions, by **reordering the 3 choices**
in an question and updating `correctIndex` to match. **You are NOT changing which
answer is correct, and you are NOT changing any text.** The book's content is good
and was just recovered from a full rewrite — do not regenerate anything.

> ⚠️ The single catastrophic risk in this pass is setting `correctIndex` to a new
> number **without** moving the choices — that silently marks a wrong answer
> correct (the `hooked` defect). Read the invariant below twice before you start.

## What you change
- For the questions listed in the per-chapter table below: **reorder the elements
  of the `choices` array** and set `correctIndex` to the new index of the **same**
  correct choice. Nothing else.

## What you do NOT change (byte-for-byte identical)
- The **text** of any choice, `prompt`, or `explanation`.
- **Which proposition is correct** — the correct answer stays the exact same
  sentence; only its slot moves.
- `hook`, `counterintuition`, `keyTakeaway`, `breakdown`, `examples`,
  `reviewCards`, `implementationPlan`, `memorableLines`, titles, ids — untouched.
- **ch01 and ch14 — do not open them.** They are already balanced 3-3-3.
- Do **not** fix B11 / B13 / BP16 / F4 in this pass (separate optional polish).
  Touching prose here risks re-corrupting a just-rewritten book. Stay in `quiz`.

## The invariant (this is the whole job — get it exactly right)
For each question you touch:
1. **Before** editing, copy the full text of the currently-correct choice
   (`choices[oldCorrectIndex]`).
2. Reorder the 3 choices into the new order.
3. Set `correctIndex` to the slot where that **copied text** now sits.
4. **Verify:** `choices[newCorrectIndex]` is byte-identical to the text you copied,
   and the multiset of the 3 choice strings is unchanged (same 3 strings, new
   order). If either check fails, you changed content — undo and redo.

A correct reorder never alters the set of three sentences; it only permutes them.

## Why this redo exists
The rewrite fixed the word-salad and the quiz **keys are correct** — but the
correct answer's **position** is badly skewed toward index 0. The `F3` major
fires: **index 0 wins 88/162 questions (54%)**, over the 45% ceiling. Nine
chapters break the "never 5+ of one position" rule, worst of all **ch13, where
all 9 correct answers are at index 0** (a learner scores 100% by always picking
the first choice). ch12 is 8/9 at index 0, ch11 and ch17 are 7/9.

## Per-chapter assignment (target `correctIndex` sequences)
Make each chapter's 9 correct answers land exactly **3 at index 0, 3 at index 1,
3 at index 2** (3-3-3). Use these exact target sequences (already chosen to be
balanced, all-distinct across chapters, and minimal-change from current). The
`moves` column is how many questions in that chapter need reordering.

| ch | current correctIndex seq | TARGET correctIndex seq | moves |
|----|--------------------------|--------------------------|-------|
| 01 | `0 1 2 0 1 2 0 2 1` | **keep — do not touch** | 0 |
| 02 | `1 2 0 1 0 2 0 1 1` | `2 2 0 1 0 2 0 1 1` | 1 |
| 03 | `1 0 2 0 1 1 0 1 0` | `1 0 2 0 2 1 2 1 0` | 2 |
| 04 | `1 0 2 0 1 1 0 1 1` | `2 0 2 0 2 1 0 1 1` | 2 |
| 05 | `0 1 2 0 1 1 0 1 0` | `0 1 2 0 1 2 0 1 2` | 2 |
| 06 | `0 1 2 0 0 1 0 1 1` | `0 2 2 2 0 1 0 1 1` | 2 |
| 07 | `0 1 0 1 0 1 0 0 1` | `0 1 2 1 2 1 0 0 2` | 3 |
| 08 | `0 0 1 0 0 1 1 0 0` | `2 2 1 2 0 1 1 0 0` | 3 |
| 09 | `1 0 2 0 1 2 1 0 0` | `1 0 2 2 1 2 1 0 0` | 1 |
| 10 | `0 1 2 0 0 1 1 0 1` | `0 2 2 0 2 1 1 0 1` | 2 |
| 11 | `0 0 1 0 0 1 0 0 0` | `2 1 1 2 0 1 0 0 2` | 4 |
| 12 | `0 0 0 0 0 1 0 0 0` | `0 0 2 1 2 1 1 0 2` | 5 |
| 13 | `0 0 0 0 0 0 0 0 0` | `1 1 0 1 0 2 0 2 2` | 6 |
| 14 | `0 1 2 1 2 1 0 2 0` | **keep — do not touch** | 0 |
| 15 | `0 1 2 0 0 1 0 0 0` | `0 1 2 2 0 1 0 1 2` | 3 |
| 16 | `0 1 2 0 1 0 0 0 0` | `2 1 2 1 1 0 2 0 0` | 3 |
| 17 | `0 1 2 0 0 0 0 0 0` | `2 1 2 1 2 0 0 1 0` | 4 |
| 18 | `0 1 2 1 2 1 2 2 0` | `0 1 0 1 2 1 2 2 0` | 1 |

For each question where target ≠ current, move the correct choice to the target
index per the invariant above. Where target = current, leave that question alone.
(You may use a different balanced ordering if you prefer, but it must still be
exactly 3-3-3 per chapter and no two chapters may share an identical 9-sequence —
the gate fails closed on duplicate sequences.)

## Procedure
1. Work chapter by chapter, ch02→ch18 (skip ch01, ch14).
2. After each chapter:
   `npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts gate-chapter \
    scripts/book/prompts/chapterflow-v21-authored/state/chapters/the-5-am-club-chNN.v21-native.chapter.json`
   — must stay 0 blockers.
3. After all chapters:
   `npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts book-gate the-5-am-club`
   — `F3` must be gone and `0 blockers`.

## Done condition
- Every chapter's `correctIndex` distribution is exactly 3-3-3.
- `book-gate the-5-am-club`: 0 blockers and **no `F3`**.
- The invariant held for every touched question: each chapter still has the same
  set of 3 choices per question, and `choices[correctIndex]` is the same correct
  proposition it was before. (The human QC will re-read keys against explanations
  to confirm nothing was silently changed — if any key now contradicts its
  explanation, the pass is rejected.)

Report back: per-chapter new correctIndex sequences, and confirmation that no
choice/prompt/explanation text changed.
