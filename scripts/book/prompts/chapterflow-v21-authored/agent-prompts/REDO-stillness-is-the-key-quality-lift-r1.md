# REDO — stillness-is-the-key: axis-targeted quality lift (round 1)

You are an AUTHORING session (never run `qc-attest`; a fresh QC session
re-scores after you). Work in
`~/ChapterFlow-books/scripts/book/prompts/chapterflow-v21-authored/`.

29 of 34 chapters sit at YELLOW (~80-84/100) on the SAME TWO AXES, per the
2026-06-12 codex-qc round. This is a craft lift, not a bug-fix list: the
cited quotes below are EXAMPLES of each pattern — fix the PATTERN everywhere
it occurs, in every YELLOW chapter (all except ch13, ch18, ch19, ch24, ch33
— run `npx tsx src/cli.ts qc-status stillness-is-the-key` for the live list).

## Axis 1 — quiz_distractor_quality (scoring ~0.55-0.7; floor is 0.6, target ≥0.85)

Rubric (what 0.85+ means): "Distractors must be realistic wrong answers a
thoughtful reader could pick. DRAFT if a distractor is the correct sentence
wearing a junk prefix, a generated source-summary, the only 'clean' choice is
the key (format-identifiable), or the answer is decided by a trailing
container-noun. FP-guard: genuinely tempting near-misses are GOOD."

The reviewers' finding, stamped across ~27 chapters: **distractors are
label/format-identifiable** — the key reads as a full reasoned sentence while
distractors read as short labels, so a reader picks by FORMAT without
understanding anything.

Fix the pattern: every distractor becomes a **named misconception written in
the same grammatical form and register as the key** — a full claim a smart
reader who half-understood the chapter would genuinely consider. Same
sentence shape, similar length (keyed-longest rate must stay near ~33% —
check with gate-chapter's BP25 line; 0% is its own tell). NEVER touch
`correctIndex` or the keyed choice's meaning; explanations may be touched
only if a rewritten distractor makes them stale.

## Axis 2 — example_coherence / anchor integration (scoring ~0.6-0.75; target ≥0.85)

Rubric tell: "a source anchor appearing as SET DRESSING rather than in the
scene's logic — a case card pinned to a wall, a quote 'in the margin', a
flyer about the source's anecdote — reads as product placement and marks an
ungrounded scene wearing a grounding costume."

The reviewers' finding: **source-as-prop** — the chapter's real exemplar is
staged as an object near the scene instead of doing work inside the
protagonist's reasoning. Rewrite each instance so the anchor changes what the
character SEES, DECIDES, or PREDICTS (STEP-2's anchor rule has the good/bad
pair). The exemplar plan (`state/exemplar-plans/stillness-is-the-key.
exemplar-plan.json`) still governs who may use which figure — never import
another chapter's exemplar. Vary the integration construction per the
anti-stamp rules (no two chapters share their main verb construction —
the outliers round proved one construction ×17 is just a new stamp).

## Do NOT change

- Any `correctIndex` (keys are verified clean — 9/9 every chapter).
- Hooks, tryThisNow, plans, cards, breakdowns, memorableLines — they score
  fine; touching them risks new staleness for nothing.
- The 5 non-YELLOW chapters (ch13, ch18, ch19, ch24, ch33).

## Done-condition (per chapter)

1. Self-read every quiz question: no distractor identifiable by format alone;
   every distractor a plausible misconception.
2. Self-read every example: each anchor does logical work in the scene.
3. `npx tsx src/cli.ts gate-chapter state/chapters/<file>` →
   `Gate verdict: PASS — 0 blockers`.
4. One commit per ~5 chapters, listing chapters touched.

After all chapters: `book-gate stillness-is-the-key` clean, then report.
A FRESH QC session re-scores. **If this round leaves either axis below 0.85
on chapters you reworked, the next step is operator escalation, not a
round-2 of this prompt** (convergence rule, QC-SESSION-PROMPT §4).
