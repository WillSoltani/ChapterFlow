# Polish everything-is-fcked — counterintuition variety (B11)

You are doing one narrow polish edit on the 9 chapters for
`everything-is-fcked`.

The book already passed deterministic gates with 0 blockers, and QC read raw
content from ch01, ch05, and ch09 without finding wrong quiz keys, false review
cards, incoherent examples, word-salad, or bad prose. This is **not** a rewrite
and **not** a content-correction pass. Your job is to remove the remaining
book-level pattern-audit major:

- `B11 major`: 6 of 9 chapters open `counterintuition` with a
  negation-correction shell (`"X is not Y. [correction]"` or
  `"X does not Y. [correction]"`). Affected: ch01, ch04, ch05, ch06, ch07,
  ch09.

## What you change

Change only the `counterintuition` field in these six chapter JSONs:

- `state/chapters/everything-is-fcked-ch01.v21-native.chapter.json`
- `state/chapters/everything-is-fcked-ch04.v21-native.chapter.json`
- `state/chapters/everything-is-fcked-ch05.v21-native.chapter.json`
- `state/chapters/everything-is-fcked-ch06.v21-native.chapter.json`
- `state/chapters/everything-is-fcked-ch07.v21-native.chapter.json`
- `state/chapters/everything-is-fcked-ch09.v21-native.chapter.json`

Rewrite the opening shape so each field keeps the same insight but no longer
uses the repeated `is not` / `does not` negation-correction shell. Make the six
rewrites structurally distinct from each other.

## What you do NOT change

- Do not change `hook`, `keyTakeaway`, `tryThisNow`, `title`,
  `readingTimeMinutes`, `implementationPlan`, `memorableLines`, `examples`,
  `quiz`, `reviewCards`, or any `breakdown.*` prose.
- Do not change `counterintuition` in ch02, ch03, or ch08; those already vary.
- Do not change any quiz `correctIndex`, answer sequence, or explanation.
- Do not rewrite the book, regenerate chapters, promote the book, or run
  research.
- Do not spell out the censored title in notes or reports; use only the slug
  `everything-is-fcked`.

## Why this polish exists

The QC verdict was **YELLOW polish**, not RED. The content is semantically
sound, but the repeated counterintuition shell is reader-visible templating
debt. Fix the shell without disturbing the already-verified content.

## Current affected lines

Rewrite the framing of these six lines. Preserve each chapter's meaning.

| Ch | Current `counterintuition` |
|----|----|
| 01 | "The bleak fact is not that life is hard. It is that most lives vanish, so hope has to invent a reason to move anyway." |
| 04 | "The danger is not belief itself. The danger starts when one value becomes sacred enough to excuse blindness." |
| 05 | "Rejecting hope is not nihilism here. It is the demand to affirm life without needing tomorrow to redeem today." |
| 06 | "Dignity is not niceness or purity. It is the refusal to turn conscious beings into tools for payoff." |
| 07 | "The point is not that suffering is noble. It is that pain persists, and avoidance can make people easier to break." |
| 09 | "The real fear is not a robot movie. It is immature values scaled by systems people treat like higher powers." |

These three are already varied. Leave them untouched and use them as range
references, not templates to copy:

- ch02: "Self-control fails when reason lectures a feeling that has not agreed to the trip. The answer is not surrender; it is negotiation."
- ch03: "Old wounds persist because they become moral accounts. The mind keeps trying to balance a gap long after the scene has ended."
- ch08: "More choice can become fake freedom when every option trains the Feeling Brain to stay reactive."

## Composition rules

Use a different paradox-signal shape for each affected chapter. Good options:

- Lead with the consequence: "Hope has to invent motion once the scale of life
  removes comfort."
- Name the hidden cost of the obvious reading.
- Use a concrete contrast inside one sentence.
- Pose a question that overturns the easy interpretation.
- Start with the chapter's active force instead of a negated misconception.
- Concede a partial truth, then pivot without using `is not`, `are not`,
  `does not`, or `do not`.

Hard constraints:

- Avoid first-sentence `is not`, `are not`, `does not`, or `do not` in every
  edited `counterintuition`.
- Do not replace the old repeated shell with a new repeated shell such as
  "The real problem is..." in multiple chapters.
- Keep each `counterintuition` concise, display-ready, and faithful to its
  chapter's verified thesis.
- Read all 9 `counterintuition` lines aloud after edits. They should sound like
  nine different chapter-specific turns, not one template with swapped nouns.

## Validation

After each edited chapter, run:

```bash
npx tsx src/cli.ts gate-chapter state/chapters/everything-is-fcked-ch{NN}.v21-native.chapter.json
```

Confirm `Gate verdict: PASS` and `blockers: 0`.

After all six edits, run:

```bash
npx tsx src/cli.ts book-gate everything-is-fcked
```

It must report:

- `Book gate: PASS`
- 0 blockers
- `B11` no longer present in the pattern audit findings

## Done condition

- Only the six named `counterintuition` fields changed.
- ch02, ch03, and ch08 `counterintuition` fields are byte-identical.
- No quiz, card, example, breakdown, hook, takeaway, or try-this-now fields
  changed.
- Per-chapter `gate-chapter`: PASS with 0 blockers for every edited chapter.
- `book-gate everything-is-fcked`: PASS with 0 blockers and B11 cleared.

Report back with the six new `counterintuition` lines and the final book-gate
result.
