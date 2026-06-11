# Polish drive — example decision forks, source-grounding, opener/stem cleanup

You are doing a **light polish pass** on a book that already SHIPS clean: 0
blockers at chapter, intra-book, and book gate. Nothing here is a blocker. You are
reducing *major-severity* debt only. The danger in a polish pass is **introducing
a new blocker** (cross-chapter templating) while fixing majors — so the hard rule
is: every edit must leave the gates at **0 blockers**.

You edit exactly the fields listed under "What you change." Everything else — hook
claims, titles, plans, review cards, breakdown *structure and meaning*, quiz
`correctIndex` sequences — stays byte-for-byte unless a rule below names it.

## What you change
1. Example `scenario` text — add an explicit decision point (C3); for the 10
   listed scenarios, also name a source anchor (SC9).
2. Three run-on field openers (A13).
3. One banned stem in Ch9 (B4).
4. Two quiz answer-length imbalances (BP16).
5. `"rather than"` occurrences book-wide — reduce to budget (F4).

## What you do NOT change
- Hook core claim, chapter title, thesis framing.
- Plan fields, review card fronts/backs.
- Breakdown content, order, examples cited, conclusions.
- Quiz `correctIndex` values / sequence, and which answer is correct (clean —
  changing them risks AS12/BP14 blockers). **D1 majors are a known false positive;
  ignore them entirely — do not touch quiz prompts to chase D1.**
- Which real-world case each example uses (keep the source anchor; only stage it).

## Why this polish exists
QC graded drive **YELLOW (light) — shippable with modest debt**. 0 blockers, but
115 chapter majors + 1 book major. ~67 of those are D1 false positives; real debt
is ~48, dominated by C3 (missing decision forks). A sister book (Range) ran an
identical polish and went 133 majors → 0 with no new blockers.

## Files
- Chapters: `state/chapters/drive-ch{NN}.v21-native.chapter.json` (NN = 01..11)
- Source notes: `.chapterflow/runs/drive/20260601-083118/sidecars/source/ch{NN}.source.json`
- Book toc: `.chapterflow/runs/drive/20260601-083118/source-freeze/toc.json`
  (Note: sidecars ch12–14 are unused back-matter — ignore them, the book is 11 chapters.)

---

## Rules

### Rule 1 — Example decision forks (C3 = 31 majors — the main job)
C3 fires when a `scenario` has "no explicit decision point — doesn't force the
reader into the protagonist's shoes." Settings are mostly fine here (C2 fires only
once), so **do not rewrite scenes wholesale** — just add a forced choice. For each
flagged scenario, end the scene on a fork the protagonist must resolve *now*:
e.g. "…she can post the leaderboard that's always lit a fire under the team, or
kill it and trust the work itself to pull them — the all-hands is in an hour."

Keep each scenario **distinct across chapters** — don't reuse a fork skeleton you
already used. Reusing structure trips AS9/AS10 (blockers). Vary the domain.

### Rule 2 — Source-ground these 10 scenarios (SC9 = 10 majors)
These scenarios reference no named entity from their own chapter's source.
Rewrite each to name at least one anchor **from that chapter's sidecar** — this
satisfies the C3 fork at the same time (anchor the scene in the real case, then
add the fork):

| Chapter | Example(s) | Use one of these anchors |
|---|---|---|
| Ch1 | `examples[3]`, `examples[4]` | Wikipedia, Microsoft, Encarta |
| Ch2 | `examples[4]` | Mark Twain, *Tom Sawyer* (whitewashing the fence), Edward Deci |
| Ch4 | `examples[2]`, `examples[4]` | Edward Deci, Richard Ryan, Self-Determination Theory |
| Ch6 | `examples[3]` | Mihaly Csikszentmihalyi, flow, Carol Dweck |
| Ch7 | `examples[3]`, `examples[4]` | TOMS Shoes, Mayo Clinic |
| Ch9 | `examples[5]` | FedEx Day, autonomy, peer/divergent |
| Ch10 | `examples[4]` | George Akerlof, gift-exchange |

### Rule 3 — Run-on field openers (A13)
Each opens with too many commas in the first 80 chars — split into 2–3 short
sentences, keep the meaning:
- **Ch6** `keyTakeaway` (3 commas)
- **Ch8** `keyTakeaway` (3 commas)
- **Ch9** `tryThisNow` (3 commas)

### Rule 4 — Banned stem (B4, Ch9)
Remove "the real test is" from Ch9 and rephrase the point in plain language.

### Rule 5 — Quiz answer-length balance (BP16)
The correct answer is too long relative to distractors (readers can spot it by
length). Tighten the correct answer OR lengthen distractors so correct is <1.4×
the average distractor. **Do not change which answer is correct.**
- **Ch3** q04 (currently 1.63×)
- **Ch10** q02 (currently 1.60×)

### Rule 6 — "rather than" budget (F4)
The gate counts **30** occurrences in prose; budget is **15**. Cut to ≤15
book-wide. Replace with "instead of", recast as "not X but Y", or restructure.
Don't swap every one to the same substitute — that moves the overuse to a new bigram.

---

## Procedure
1. Work chapter by chapter, Ch1 → Ch11.
2. After each chapter, run:
   `npx tsx src/cli.ts gate-chapter state/chapters/drive-ch{NN}.v21-native.chapter.json`
   It must still report **0 blockers** (majors should be dropping; ignore D1).
3. After all 11 chapters, run:
   `npx tsx src/cli.ts book-gate drive`
   It must report **0 blockers**, and F4 `"rather than"` ≤ 15.
4. Confirm no new templating: gate output shows no AS5–AS12 / BP10/BP11/BP13/BP14
   blockers anywhere.

## Done condition
- Per-chapter `gate-chapter`: still 0 blockers; C3 cleared; the 10 SC9 scenarios
  now name a source anchor; A13 openers fixed (Ch6/8/9); B4 stem gone (Ch9);
  BP16 balanced (Ch3 q04, Ch10 q02).
- `book-gate drive`: 0 blockers; `"rather than"` ≤ 15.
- Untouched fields (correctIndex, plans, cards, hook claims, which case each
  example uses) verified unchanged.

## Report back
- Per-chapter major counts before/after (show the drop; note D1 is expected to remain).
- Book-gate: blocker count (must be 0), `"rather than"` count.
- Confirm 0 new blockers introduced.
