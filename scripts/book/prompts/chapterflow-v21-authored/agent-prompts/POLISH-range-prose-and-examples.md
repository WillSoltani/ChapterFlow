# Polish range — readability, example scenes, opener variety, stylistic budget

You are doing a **polish pass** on a book that already SHIPS clean: 0 blockers
at chapter, intra-book, and book gate. Nothing here is a blocker. You are
reducing *major-severity* technical debt only. The danger in a polish pass is
**introducing a new blocker** (cross-chapter templating) while fixing majors —
so the hard rule is: every edit must leave the gates at **0 blockers**.

You edit exactly the fields listed under "What you change." Everything else —
hook claims, titles, plans, review cards, breakdown *structure and meaning*,
quiz `correctIndex` sequences — stays byte-for-byte unless a rule below names it.

## What you change (per chapter, in order)
1. Breakdown tier prose (`fastRead` / `deepRead` / `fullRead`) — readability only.
2. Example `scenario` text — add concrete staging + a decision point; source-anchor the flagged ones.
3. The counterintuition **opener sentence shape** in the 8 listed chapters.
4. `"rather than"` occurrences book-wide — reduce to budget.
5. The specific banned phrases in Ch5.
6. The specific quiz distractors / prompts / answer lengths listed.

## What you do NOT change
- Hook core claim, chapter title, thesis framing — leave meaning intact.
- Plan fields, review card fronts/backs.
- Breakdown **content, order, examples cited, conclusions** — only sentence
  length and word choice change for readability.
- Quiz `correctIndex` values or their cross-chapter sequence (currently clean —
  changing them risks AS12/BP14 blockers).
- Any example that is **not** named below — do not rewrite scenarios wholesale.
- The meaning of any counterintuition opener — only its surface shape.

## Why this polish exists
QC graded range **YELLOW — shippable with debt**. 0 blockers, but 133 chapter
majors + 2 book majors. None block ship; together they read as "competent but
slightly generic." Four clusters dominate, plus a few one-offs.

## Files
- Chapters: `state/chapters/range-ch{NN}.v21-native.chapter.json` (NN = 01..12)
- Source notes: `.chapterflow/runs/range/20260601-083123/sidecars/source/ch{NN}.source.json`
- Book toc: `.chapterflow/runs/range/20260601-083123/source-freeze/toc.json`

---

## Rules

### Rule 1 — Breakdown readability (E1, 31 majors)
The three breakdown tiers exceed their Flesch-Kincaid grade ceilings. Lower the
grade by **shortening sentences and swapping academic vocabulary for plain
words** — do NOT cut content or change the point.

| Tier | Target grade | Hard ceiling |
|---|---|---|
| `fastRead` | 7–8 | 8.5 |
| `deepRead` | 9–11 | 11 |
| `fullRead` | 10–12 | 12 |

Extra `fastRead` rule: **max 2 four-plus-syllable words per paragraph.** Replace
e.g. "automatically" → "on its own", "discrimination" → "telling apart".
Every chapter's `fastRead`/`deepRead`/`fullRead` should clear its ceiling.

### Rule 2 — Example scenes (C2 = 58, C3 = 22 majors)
Every flagged example `scenario` is abstract. Two defects:
- **C2** — "lacks specific setting (time/place/role) — feels abstract."
- **C3** — "no explicit decision point — doesn't force the reader into the protagonist's shoes."

Rewrite each weak scenario so it has BOTH:
1. A concrete **setting**: a named role, a place, a moment in time
   (e.g. "A second-year ER resident, 2 a.m., third trauma of the shift…").
2. A forced **decision**: the protagonist hits a fork and must choose now
   (e.g. "…orders the scan everyone expects, or trusts the one number that
   contradicts it — and the clock is running").

Keep each scenario **distinct across chapters** — do not reuse a staging
skeleton (role + place + fork) you already used. Reusing structure trips AS9/AS10
(blockers). Vary the domain every time.

### Rule 3 — Source-grounding the flagged scenarios (SC9, 6 majors)
These six example scenarios reference no named entity from their own chapter's
source. Rewrite each to name at least one anchor **from that chapter's sidecar**:

| Chapter | Example | Use one of these anchors |
|---|---|---|
| Ch2 | `examples[3]` | Flynn, IQ, Raven's Progressive Matrices |
| Ch3 | `examples[4]` | the figlie, the Ospedale, Venetian girls |
| Ch5 | `examples[5]` | Johannes Kepler, radiation, Kevin Dunbar |
| Ch6 | `examples[5]` | Vincent van Gogh, Ofer Malamud, England/Wales |
| Ch8 | `examples[5]` | Alph Bingham, Eli Lilly, InnocentiveOPEN, Einstellung |
| Ch10 | `examples[3]` | Paul Ehrlich, Julian Simon, the population-resource bet |

This satisfies Rule 2's "concrete setting" at the same time — anchor the scene
in the real case, then add the decision fork.

### Rule 4 — Vary the counterintuition opener (B11, book gate)
8 of 12 chapters open the counterintuition with the **negation-correction shell**
`"X is not Y. [correction]"`. That uniform shape is a templating tell. Reshape
**at least 4 of these 8** so no more than ~4/12 use the negation shell. Keep the
claim identical; change only the rhetorical shape. Current openers (verbatim):

- Ch2: "Rising abstract reasoning does not prove older practical worlds were foolish…"
- Ch3: "Variety does not replace repetition…"
- Ch4: "Confusion is not automatically useful…"
- Ch5: "Analogy is not decorative metaphor…"
- Ch6: "Quitting is not the opposite of character…"
- Ch8: "Outsiders do not replace insiders…"
- Ch9: "Old technology is not automatically wiser…"
- Ch12: "Amateur energy alone is not enough…"

Alternative paradox-signal shapes to rotate through (don't make these uniform
either):
- Lead with the surprising consequence: "The cyclists who improved fastest
  trained slowest first."
- Pose the question the reader assumes is settled: "Why would mixing problems
  make practice feel worse and work better?"
- Concede then pivot: "Everyone can see repetition builds skill. What it hides
  is which skill."
- Name the cost of the obvious move: "Specialize early and you buy speed now by
  borrowing it from later."

### Rule 5 — "rather than" budget (F4)
`"rather than"` appears **95 times** across the book; budget is **15**. Cut to
≤15 book-wide. Replace with "instead of", recast as "not X but Y", or restructure
the sentence. Don't mechanically swap every one to the same substitute — that
just moves the overuse to a new bigram.

### Rule 6 — Ch5 banned phrases (B4)
Remove these exact stems from Ch5 and rephrase in plain language:
- "is not decorative" (×2) — overused rhetorical move across the corpus.
- "the real move is" (×3) — banned counter-payoff template.

### Rule 7 — Quiz fixes (BP15, BP16, D1, A13)
Surgical, named:
- **BP15 strawman distractors** — remove the absolute trigger word and make the
  distractor a scenario-anchored, wrong-but-plausible claim:
  - Ch4 q01 choice[1] ("automatically"), q03 choice[2] ("impossible"), q06 choice[0] ("impossible")
  - Ch7 q01 choice[1] ("impossible")
  - Ch11 q05 choice[1] ("automatically"), q08 choice[0] ("automatically")
- **BP16 answer length** — Ch3 q02 and Ch8 q02: the correct answer is 1.5× the
  average distractor. Tighten the correct answer OR lengthen distractors so the
  correct one is <1.4× average. Do NOT change which answer is correct.
- **D1 prompt framing** — Ch8 and Ch9: reframe the short prompt as a scenario-based
  application question.
- **A13 run-on** — Ch5 `tryThisNow` opens with 3 commas in the first 80 chars;
  break the opener into shorter sentences.

---

## Procedure
1. Work chapter by chapter, Ch1 → Ch12.
2. After each chapter, run:
   `npx tsx src/cli.ts gate-chapter state/chapters/range-ch{NN}.v21-native.chapter.json`
   It must still report **0 blockers**. (Majors should be dropping.)
3. After all 12 chapters, run:
   `npx tsx src/cli.ts book-gate range`
   It must report **0 blockers**, and B11 should no longer fire.
4. Sanity-check you introduced no new templating: confirm gate output shows no
   AS5–AS12 / BP10/BP11/BP13/BP14 blockers anywhere.

## Done condition
- Per-chapter `gate-chapter`: still 0 blockers, all three breakdown tiers under
  their FK ceilings.
- `book-gate range`: 0 blockers; B11 gone; `"rather than"` ≤ 15; the 6 SC9
  scenarios now name a source anchor.
- All untouched fields (correctIndex, plans, cards, hook claims) verified unchanged.

## Report back
- Per-chapter major counts before/after (show the drop).
- Book-gate: blocker count (must be 0), whether B11 cleared, `"rather than"` count.
- Confirm 0 new blockers introduced.
