# Polish the-let-them-theory — example scenes, readability, opener/stem cleanup

You are doing a **polish pass** on a book that already SHIPS clean: 0 blockers at
chapter, intra-book, and book gate. Nothing here is a blocker. You are reducing
*major-severity* debt only. The danger in a polish pass is **introducing a new
blocker** (cross-chapter templating) while fixing majors — so the hard rule is:
every edit must leave the gates at **0 blockers**.

You edit exactly the fields listed under "What you change." Everything else —
hook claims, titles, plans, review cards, breakdown *structure and meaning*, quiz
questions and `correctIndex` sequences — stays byte-for-byte unless a rule below
names it. Examples are already source-grounded (SC9 = 0); **do not change which
real case each example uses** — only how it's staged.

## What you change (per chapter)
1. Example `scenario` text — add concrete staging + a decision point (C2/C3).
2. Breakdown `fastRead` prose — readability only (E1).
3. The Ch4 and Ch12 counterintuition opener — break the run-on (A13).
4. The three banned stems in Ch7 / Ch8 / Ch10 (B4).
5. `"rather than"` occurrences book-wide — reduce to budget (F4).

## What you do NOT change
- Which real-world case/person each example references (keep the source anchor).
- Hook core claim, chapter title, thesis framing.
- Plan fields, review card fronts/backs.
- Breakdown **content, order, examples cited, conclusions** — for E1, only
  sentence length and word choice change.
- Quiz questions, choices, or `correctIndex` values / sequence (clean — changing
  them risks AS12/BP14 blockers). D1 majors are a known false positive; ignore.
- The meaning of any counterintuition opener — only its surface shape.

## Why this polish exists
QC graded the-let-them-theory **YELLOW — shippable with debt**. 0 blockers, but
271 chapter majors + 1 book major. None block ship; together they read as
"competent but slightly abstract." This is the same profile a sister book (Range)
had — that polish took it from 133 majors to 0 with no new blockers.

## Files
- Chapters: `state/chapters/the-let-them-theory-ch{NN}.v21-native.chapter.json` (NN = 01..20)
- Source notes: `.chapterflow/runs/the-let-them-theory/20260601-083644/sidecars/source/ch{NN}.source.json`
- Book toc: `.chapterflow/runs/the-let-them-theory/20260601-083644/source-freeze/toc.json`

---

## Rules

### Rule 1 — Example scenes (C2 = 88, C3 = 96 majors — the main job)
These two fire on nearly every example in the book (~9 per chapter). Two defects:
- **C2** — "scenario lacks specific setting (time/place/role) — feels abstract."
- **C3** — "no explicit decision point — doesn't force the reader into the protagonist's shoes."

For **every flagged example `scenario`**, keep the underlying case the same but
rewrite the scene so it has BOTH:
1. A concrete **setting**: a named role, a place, a moment in time
   (e.g. "Sunday night, a group chat of six college friends, one of them just
   left on read for three days…").
2. A forced **decision**: the protagonist hits a fork and must choose now
   (e.g. "…she can fire off the 'you okay?' text she's drafted four times, or
   she can let them be and go to bed — her thumb is over send").

Keep each scenario **distinct across chapters** — do not reuse a staging skeleton
(role + place + fork) you already used in another chapter. Reusing structure across
20 chapters will trip AS9/AS10 (blockers). Vary the relationship and domain every
time — partner, coworker, parent, friend, stranger, boss; kitchen, office, text
thread, car, group chat.

### Rule 2 — fastRead readability (E1 = 32 majors)
The breaches are almost entirely in the **`fastRead`** tier (grades 8.8–12.4 vs
ceiling 8.5). `deepRead`/`fullRead` are mostly fine — focus on `fastRead`. Lower
the grade by **shortening sentences and swapping academic words for plain ones** —
do NOT cut content or change the point.

- `fastRead` target grade **7–8**, hard ceiling **8.5**.
- **Max 2 four-plus-syllable words per paragraph.** Several chapters have 4–8 in
  `fastRead ¶1` — that paragraph is the priority. Replace e.g. "automatically" →
  "on its own", "responsibility" → "what's yours to carry", "relationship" →
  "the people in your life" where it reads naturally.

Every chapter's `fastRead` should clear grade 8.5 after the pass.

### Rule 3 — Run-on counterintuition openers (A13, Ch4 & Ch12)
- Ch4: opener has **4 commas in the first 80 chars** — break it into shorter sentences.
- Ch12: opener has **3 commas in the first 80 chars** — same.
Keep the claim; just split the run-on into 2–3 clean sentences.

### Rule 4 — Banned counter-payoff stems (B4)
Remove these exact stems and rephrase the point in plain, varied language. Do not
swap all three to a single new stem (that just relocates the template):
- **Ch7** — "the stronger move is" (×3)
- **Ch8** — "The easy mistake is" (×4)
- **Ch10** — "the real test is" (×3)

### Rule 5 — "rather than" budget (F4)
The gate counts **51** occurrences in prose; budget is **15**. Cut to ≤15
book-wide. Replace with "instead of", recast as "not X but Y", or restructure the
sentence. Don't mechanically swap every one to the same substitute — that moves
the overuse to a new bigram.

---

## Procedure
1. Work chapter by chapter, Ch1 → Ch20.
2. After each chapter, run:
   `npx tsx src/cli.ts gate-chapter state/chapters/the-let-them-theory-ch{NN}.v21-native.chapter.json`
   It must still report **0 blockers**, and `fastRead` should be under grade 8.5.
   (Majors should be dropping — C2/C3 to ~0, E1 to 0.)
3. After all 20 chapters, run:
   `npx tsx src/cli.ts book-gate the-let-them-theory`
   It must report **0 blockers**, and F4 `"rather than"` ≤ 15.
4. Confirm you introduced no new templating: gate output shows no
   AS5–AS12 / BP10/BP11/BP13/BP14 blockers anywhere.

## Done condition
- Per-chapter `gate-chapter`: still 0 blockers; `fastRead` under grade 8.5; C2/C3
  cleared; B4 stems gone (Ch7/8/10); A13 openers fixed (Ch4/12).
- `book-gate the-let-them-theory`: 0 blockers; `"rather than"` ≤ 15.
- Untouched fields (correctIndex, plans, cards, hook claims, which case each
  example uses) verified unchanged.

## Report back
- Per-chapter major counts before/after (show the drop).
- Book-gate: blocker count (must be 0), `"rather than"` count.
- Confirm 0 new blockers introduced.
