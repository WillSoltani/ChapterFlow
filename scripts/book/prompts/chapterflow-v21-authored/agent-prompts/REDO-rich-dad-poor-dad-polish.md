# REDO (polish pass) — rich-dad-poor-dad

**Verdict:** YELLOW / REVISE (not RED). All deterministic gates PASS and **all 81 quiz
keys are correct** — there is NO corruption (no wrong key, no false fact, no word-salad).
These are reader-facing consistency/copyedit defects that keep the book below the
"finished, publishable" bar. Do a targeted polish; do NOT rewrite chapters.

## What must change (and ONLY these)

### 1. Wrong persona named inside quiz explanations (highest priority)
Each `quiz.questions[].explanation` must reference the SAME persona as its own `prompt`.
Several explanations cite a persona that belongs to a *different* question in the chapter.

- **ch01 q03** — prompt is about **Kathleen** (coin attempt); explanation says
  *"Ravi's energy is useful…"* → change **Ravi → Kathleen**.
- **ch01 q05** — prompt is about **Ravi** (comic books); explanation says
  *"Min sees cash flow through access…"* → change **Min → Ravi**.
- **ch01 q06** — prompt is about **Min** (blame at register); explanation says
  *"It asks Caroline to avoid letting blame hide…"* → change **Caroline → Min**.
- **ch02 q04** — prompt is about **Beatrice** (mixed records); explanation says
  *"Sorting the statements lets Claire see…"* → change **Claire → Beatrice**.

Sweep every chapter for this same class (explanation persona ≠ prompt persona) and fix all hits.

### 2. Pronoun mismatch (ch09)
`breakdown.fullRead`: *"Then the checklist slows **him** down."* — the subject is **Darya**
(she/her everywhere else in the paragraph). Change **him → her**. Sweep all breakdowns for
stray gender/pronoun mismatches.

### 3. Example-slate variety (ch05 — milder)
`examples` ex02, ex04, ex06 all run the same shape: *"[Name] finds a real-estate deal under
seller time-pressure with uncertain repairs, and drafts cautious terms with a walk-away."*
Three of six scenes share that skeleton. Re-domain at least one of them (ex04 or ex06) to a
non-real-estate opportunity (e.g. equipment, inventory, a service contract, a licensing deal)
so the slate reads as varied while keeping each scene's teaching beat
(structuring terms / partnering for capital).

### 4. (Optional, low priority) Quiz-only persona names
Some quizzes introduce names absent from the 6 examples/breakdown:
ch03 **Henry** (q04/q08 — overlaps Blake's cash-flow-audit role; prefer reusing **Blake**),
ch04 **Hunter** (q07), ch06 **Jacqueline** (q08), ch08 **Helene** (q07). Reuse an existing
chapter persona where the role already exists; otherwise leave as-is (not a bar failure).

### 5. (Optional) Hook-opener variety (B13 major, book-wide)
6 of 9 chapters open with "a" as the first word (ch 2,5,6,7,8,9; cap is 5). Vary 1–2 hooks.

## What must NOT change
- Do **not** touch any `correctIndex` — every key is already correct.
- Do **not** alter quiz prompts, choices, breakdown teaching content, cards' facts,
  implementation plans, or memorable lines beyond the specific fixes above.
- Keep all `sourceAnchorId`s.

## Done-condition
- `gate-chapter` on every edited chapter: 0 blockers.
- `book-gate rich-dad-poor-dad`: 0 blockers (B13 may remain unless you vary hooks).
- Every quiz explanation names its own question's persona; no pronoun mismatches.
- ch05 example slate no longer has ≥3 real-estate-deal scenes sharing the same shape.
- Then the QC reviewer re-reads and re-attests (current ch01/05/09 attestations go STALE on edit).
