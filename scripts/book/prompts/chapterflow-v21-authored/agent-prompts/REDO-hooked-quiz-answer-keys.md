# Redo `hooked` — quiz answer keys (correctIndex misaligned with explanation)

You are doing **one kind of edit** in 21 specific quiz questions across 7 chapters of the
`hooked` book. **Nothing else changes** — no prose, no scenarios, no choice wording, no
explanations, no other chapters' content, and (critically) **no `correctIndex` values**.

This is a surgical answer-key repair. Read the whole prompt before touching anything.

---

## Why this redo exists

QC found that **21 of the 72 quiz questions ship the wrong answer marked correct.** In every
case the `prompt`, the `choices`, and the `explanation` are well-written and correct — but the
`correctIndex` points to a choice that **contradicts the question's own explanation** (often the
exact opposite of the right answer). Examples:

- **ch5 Q5** marks *"Users prefer products that remove every chance to contribute effort"* correct
  — the **inverted** IKEA effect. The explanation says effort *increases* value.
- **ch6 Q8** marks *"Treat personal use as enough"* correct — the explanation says *"Personal use
  is **not** sufficient."*
- **ch8 Q3** marks *"lower the threshold until five percent appears"* — the explanation says that
  *"would **hide** the problem."*

**Root cause:** the book's answer positions are a perfect 24 / 24 / 24 (book-gate balance). That
balance was achieved by moving `correctIndex` to spread positions evenly **without keeping it
pointed at the actually-correct choice** — STEP-2 says *reorder the choices, don't move the index
off the right answer*, and that rule was inverted. The deterministic gates do **not** validate
`correctIndex` against the explanation, so this shipped silently (book-gate PASSED).

---

## What you change

For each of the **21 questions listed below**, make `correctIndex` point at the correct answer —
**by swapping choice texts, NOT by changing `correctIndex`.**

**The method (do exactly this):**
1. The table gives you, per question, the **`correctIndex` value (leave it as-is)** and the **exact
   text of the correct answer**.
2. Find which choice currently holds that correct-answer text.
3. **Swap** that choice's text with whatever text is currently sitting at the `correctIndex` slot.
4. Leave `correctIndex` itself **unchanged**.

Result: `correctIndex` now points at the correct answer, and because no `correctIndex` *value*
changed, the 24/24/24 position balance and the per-chapter `correctIndex` sequence (AS12) are
**preserved automatically** — you do not need to rebalance anything.

### Worked example (ch1 Q9, correctIndex = 2)
- Correct answer text: *"Can the target behavior occur often enough, and does the user feel enough
  value to return by default?"* — currently at position **0**.
- `correctIndex` is **2**, currently pointing at *"Can the team add enough visible reminders…"* (wrong).
- **Swap the text at position 0 and position 2.** Now position 2 holds the
  "occur often enough / enough value" answer, `correctIndex` stays **2**, and it's correct.

---

## What you do NOT change

- **`correctIndex` values** — every one stays exactly as it is now.
- Any `prompt`, `explanation`, `bloomsLevel`, `depth`, or the *wording* of any choice (you only
  relocate two choices' text within a question; you do not rewrite them).
- **Chapter 2** — it has zero answer-key errors. Do not touch it.
- The other 51 questions not listed below — they are correct. Do not touch them.
- Everything outside `quiz.questions`: hooks, counterintuition, breakdown tiers, examples,
  reviewCards, implementationPlan, memorableLines, keyTakeaway, tryThisNow — all untouched.

---

## Files

- Chapters to modify: `state/chapters/hooked-ch{01,03,04,05,06,07,08}.v21-native.chapter.json`
  (ch02 is untouched)

---

## The 21 corrections (authoritative answer key)

Question numbers are 1-indexed (Q1 = `quiz.questions[0]`). "Keep correctIndex" = the slot the
correct-answer text must be swapped into.

| Chapter | Q | Keep correctIndex | Correct answer (swap this text into the correctIndex slot) |
|---|---|---|---|
| ch01 | Q9 | 0 | "Can the target behavior occur often enough, and does the user feel enough value to return by default?" |
| ch03 | Q3 | 0 | "The trigger may be arriving where ability is too low." |
| ch03 | Q9 | 0 | "Cut the initial choice set or preselect a sensible template." |
| ch04 | Q5 | 1 | "It showed that uncertain payoff schedules can sustain behavior through anticipation." |
| ch04 | Q8 | 0 | "Points need to answer the user's trigger or they will feel irrelevant." |
| ch05 | Q5 | 1 | "Users may value what they help build more than what they merely receive." |
| ch05 | Q8 | 0 | "Ask the reader to save one passage to a personal collection." |
| ch05 | Q9 | 0 | "The work must store future value or prepare another trigger." |
| ch06 | Q6 | 2 | "Influence still needs scrutiny because defaults and rewards shape real choices." |
| ch06 | Q7 | 2 | "Session length alone as evidence that the habit is good for users." |
| ch06 | Q8 | 2 | "Reopen the benefit question and inspect harm, agency, and user pride." |
| ch06 | Q9 | 0 | "Ask whether the team would use the product, whether it improves users' lives, and what harm evidence would stop the test." |
| ch07 | Q2 | 0 | "Reading plans that break a large text into short passages." |
| ch07 | Q5 | 0 | "It answers the spiritual practice rather than adding unrelated surprise." |
| ch07 | Q6 | 1 | "A noble mission still needs agency, restraint, and genuine user benefit." |
| ch07 | Q8 | 1 | "It can load a future trigger tied to the practice." |
| ch07 | Q9 | 0 | "Do prompts, ease, rewards, and investments each help users pursue a self-endorsed routine?" |
| ch08 | Q3 | 0 | "The product may need concept-level rework before fine optimization." |
| ch08 | Q5 | 0 | "Nascent behavior that may reveal an unmet habit-forming need." |
| ch08 | Q6 | 0 | "Interface change that lowered effort around an existing desire." |
| ch08 | Q9 | 1 | "Which existing motivation becomes easier, faster, or more frequent on the new surface?" |

> Note: the "Correct answer" text above is quoted from the chapter as it exists now; match it to the
> live choice (minor whitespace/punctuation differences are fine — match by meaning). Each correct
> answer is the choice whose content the question's `explanation` describes. If you are ever unsure,
> re-read the `explanation`: it always states the reasoning for the correct choice.

---

## Procedure

1. Work chapter by chapter (ch01, ch03, ch04, ch05, ch06, ch07, ch08).
2. For each listed question, perform the swap exactly as described. Change nothing else.
3. After each chapter, run:
   `npx tsx src/cli.ts gate-chapter state/chapters/hooked-ch{NN}.v21-native.chapter.json`
   It must still report **0 blockers**.
4. After all chapters, run:
   `npx tsx src/cli.ts book-gate hooked`
   It must report **Book gate: PASS** and the answer positions must still be **24 / 24 / 24**
   (because no `correctIndex` value changed). If the balance moved, you changed an index — undo it
   and re-do that question as a text swap.
5. Self-check the answers: for each of the 21, re-read the `prompt` + `explanation` and confirm the
   choice now at `correctIndex` is the one the explanation supports. (The gates cannot verify this —
   it is on you. Watch the "avoid / warning / which should you NOT do" questions: there the correct
   answer is the bad-practice choice the explanation warns against.)

## Done condition

- All 21 questions: the choice at `correctIndex` matches the question's explanation.
- No `correctIndex` value changed anywhere; ch02 and the other 51 questions untouched.
- `gate-chapter` on all 7 modified chapters: 0 blockers.
- `book-gate hooked`: PASS, positions still 24 / 24 / 24.

Report back: confirmation that all 21 were swapped, the book-gate result, and the answer-position line.
