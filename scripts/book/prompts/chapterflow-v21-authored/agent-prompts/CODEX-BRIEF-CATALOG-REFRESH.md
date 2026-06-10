# CODEX BRIEF — Defect fixes + slot-level catalog refresh (campaign Phase C)

You are fixing reader-found content defects and (once piloted) refreshing
existing books' most-templated slots. Work in
`scripts/book/prompts/chapterflow-v21-authored/`.

## Ground rules (non-negotiable — the trust system treats you as the adversary)

- **NEVER run `qc-attest`.** Every chapter you edit goes stale by content
  hash, on purpose; re-attestation happens through the operator's `qc-run`
  harness. The replay guard will refuse author-side PUBLISHABLE flips and
  the attempt is logged. Your output is edited chapters that pass
  `gate-chapter`, plus a list of what needs re-QC.
- Never run `promote-book`, `register-web`, `qc-rehash`, `unquarantine-book`,
  or anything with `--run`. Never edit `state/qc/`.
- Stage commits explicitly per file; the working tree carries the operator's
  unrelated uncommitted changes (`src/types.ts`, `src/critics/narrative.ts`,
  `src/critics/quizQuality.ts`) — never sweep them.
- After every chapter edit:
  `npx tsx src/cli.ts gate-chapter state/chapters/<file>` until it prints
  `Gate verdict: PASS — 0 blockers`. The top "Ship gate:" line is NOT the
  verdict.

## Part 1 — Defect fixes (no dependencies; start immediately)

1. **`range-ch01`**: `memorableLines[0]` is literally `null` (reader-visible
   hole). Write a real memorable line from the chapter's own content
   (`text` must be an exact sentence present in the chapter — add it to the
   prose if needed; `location`, `why` per the type in `src/types.ts`).
2. **`start-with-why-ch01`**: two syntactically broken example-scenario
   sentences (find them — read every `examples[].scenario`; one is a
   garbled splice). Repair minimally, preserving the scene.
   **Also**: run `npx tsx src/cli.ts quiz-blind` on the chapter, derive
   every answer, run `quiz-verify`. A reviewer claims one key is wrong.
   DO NOT change any `correctIndex` — report your derivation + the
   mismatch (if you find one) for QC adjudication.
3. **`the-body-keeps-the-score-ch10`**: a near-verbatim duplicated paragraph
   inside `breakdown.fullRead`. Rewrite the second occurrence to advance the
   argument instead of repeating it.
4. **`rich-dad-poor-dad-ch05`**: broken punctuation in the fullRead's
   climactic paragraph ("Instead of asking, Do I already have enough money
   to invest? The better question is…" — repair the quotation/sentence
   structure); and `reviewCards[3]` (card03) back parrots its front —
   rewrite the back to ANSWER the front with substance.

Deliverable: 4 commits (one per book), each listing the chapters now
needing re-QC in the commit message.

## Part 2 — Slot-refresh protocol (pilot first; depends on the pedagogy
palettes brief being implemented — check `config/pedagogy-palettes.json`
exists before starting)

**Pilot book: operator picks (default `outliers`).** Refresh ONLY these
slots; do not touch breakdown tiers except for de-ticking (readers rate the
breakdowns 7/10 — the fingerprints live in the slots):

1. **Generate fresh plans**: `name-plan <bookId> --from 1 --to N` (now
   cross-book exclusive) and `pedagogy-plan <bookId> --from 1 --to N`
   (and read `shape-plan` if rewriting any scene). Print and follow them.
2. **Character renames**: build an old→new map — old = bank names this book
   shares with other books (run `catalog-audit <bookId>` to list its
   `bankNames`, cross-check collisions in the catalog-wide run), new = fresh
   names from the new name-plan. Rename CONSISTENTLY across every field of
   the chapter (scenario, whatToDo, whyItMatters, quiz prompts/choices/
   explanations, card fronts/backs, plan text). One name = one person still
   holds.
3. **Hooks**: rewrite each chapter's hook in its dealt hook shape
   (pedagogy plan). The hook must still be true to the chapter.
4. **`tryThisNow`**: rewrite in the dealt grammar. Keep it ≤220 chars,
   directive, doable in 30–90s.
5. **Quiz**: rewrite prompts toward the dealt openers; rebalance choice
   lengths until the keyed answer is the longest in ≤45% of questions
   (BP25 prints the rate; also re-check with `quiz-verify` that your edits
   didn't change any correctness semantics). Every distractor = a named
   misconception.
6. **Anchor props**: find anchors stapled to the scene as set dressing
   (case cards on walls, quotes "in the margin", flyers about the source's
   anecdote) and either move the anchor into the scene's LOGIC or relocate
   it to the breakdown. See STEP-2's anchor rule for the good/bad pair.
7. **De-tic**: remove/recast "The point is" / "the question is" /
   "that is the …" / "scoreboard" beyond ~2 total per chapter; break
   triadic abstract-noun lists where they cluster.
8. Per chapter: `author-check` + `gate-chapter` to PASS, then move on.

**Acceptance (run `catalog-audit <bookId>` after)**: 0 cross-book name
collisions for this book; ≥3 hook shapes; distractor tell ≤45%; tics ≤2;
deadline-tic rate ≤15%. Paste the before/after audit lines in the final
commit message, plus the full list of chapters for `qc-run` re-attestation.

**STOP after the pilot.** The operator reviews cost + a reader re-panel
before authorizing the rollout order.
