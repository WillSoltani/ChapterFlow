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

---

## ADDENDUM (2026-06-10, after the first pilot was rejected in review) —
## anti-gaming rules. These are not suggestions.

The first pilot hit every numeric target while violating the protocol: it
appended ", because …" padding to 61 distractors (so the keyed answer became
the only CLEAN choice — a new tell), swapped banned tics for new uniform
phrasing ("must decide" → "weighs" ×24; 45 of 81 prompts opening with
"Two "), skipped the anchor-prop and rename steps entirely, and quoted
"collisions 0" from a single-book audit that cannot see cross-book
collisions. All of it was caught and reverted. Therefore:

1. **The metrics are the MEASUREMENT, not the target.** Never edit text to
   move a number. If a metric won't move without mechanical tricks, STOP and
   report why. Padding, synonym-swapping a banned phrase, or rotating to any
   single new template counts as gaming and will be reverted.
2. **Distractor balance comes from SUBSTANCE**: rewrite the distractor as a
   fuller named misconception, or TRIM the key. Appending clauses after a
   period is forbidden. After rebalancing, the keyed-longest rate should land
   NEAR ~33% (chance) — 0% is its own tell.
3. **De-ticking applies to breakdown prose only** — never inside quiz
   prompts/choices/explanations or card text, and never as a 1-for-1 synonym
   swap repeated across chapters.
4. **Renames**: generate the map with
   `name-plan <bookId> --from 1 --to N --force-fresh` (deals fresh,
   catalog-exclusive names even for authored chapters; pair old→new by
   chapter) and check the work against `catalog-audit <bookId>`'s
   "CROSS-BOOK collisions involving" section, which now reads against the
   full catalog. The single-book "collisions: 0" line is NOT evidence.
5. **Anchor props**: count them before you start (grep the chapter for
   taped/pinned/poster/card/margin near anchor names), state the count in
   the commit message, and show it going to ~0 with the anchors still
   PRESENT in scene logic or breakdown.
6. **Quiz openers must follow the dealt pedagogy-plan rotation** — replacing
   one uniform opener with another ("Two …" ×45) is the same defect.

---

## ROUND 3 FOLLOW-UP (2026-06-10) — two de-uniformization passes on outliers

Round 2 was accepted on renames, distractor balance, opener rotation, and
anchor relocation. Two bulk uniformity items remain (review findings F1/F2);
the two single-instance items (ch9 Marita prop, ch7 q4 parallelism) are
already fixed by the operator — do not re-edit them. Also: if a Part-1 item
is already fixed when you arrive, SAY SO in the report — never manufacture
edits to satisfy a deliverable.

1. **Anchor-integration skeleton (~17×)**: the round-2 prop fix installed one
   construction everywhere — "[Anchor] turns/makes/changes [thing] (into)
   the [lesson/test/defect/mechanism]: [gloss]". Rewrite so NO TWO anchor
   integrations in the book share their main verb construction. Vary the
   grammatical position of the anchor (subject, object, possessive, clause),
   the connector (colon, dash, plain sentence), and the relation (the anchor
   can explain, contradict, predict, price, or time-stamp the scene — not
   only "turn X into the lesson"). Substance must stay: the anchor keeps
   doing logical work in the scene.
2. **"weighs" (23×)**: a single decision-verb template across the book's
   scenarios (left over from round 1). Replace with situation-specific
   decision language — but do NOT rotate to one new verb, and do NOT
   reintroduce the "must decide whether A or B" deadline frame R6 caps.
   After the pass, no decision verb/construction should appear in more than
   ~4 scenarios book-wide.

Per chapter: gate-chapter to "Gate verdict: PASS — 0 blockers". Acceptance:
paste `catalog-audit outliers` after-lines + the verb-distribution counts
("weighs" ≤4; top anchor-integration construction ≤2).

---

## PART 4 — SCENE RE-AUTHORING (added 2026-06-10 after the qc-run sweeps)

Three independent sweeps (outliers, rich-dad-poor-dad, the-body-keeps-the-
score) proved the slot refresh is necessary but NOT sufficient for books
authored before the scene-shape plan existed: the templating readers feel
lives in the SCENARIO GRAMMAR. Outliers: all 54 scenarios share one frame
("[At clock time] in [workplace], [role] [Name] studies [artifact]…").
TBKTS: a deadline-decision closer stamps 22+ scenarios across 13 chapters.
RDPD: one property-evaluation scene re-staged across 5 chapters. Per-slot
metrics (catalog-audit) cannot see this; only the qc-run sweep can.

**Scope per book (run per-book, one Codex session each):**

1. `shape-plan <bookId> --from 1 --to N` with the plan regenerated fresh
   (the operator will pre-generate with forceFresh). Each chapter's
   example[i] gets REWRITTEN to its dealt shape — keep the example's anchor,
   teaching point, whatToDo/whyItMatters substance; replace the scene's
   STRUCTURE per the shape definition in config/scene-shapes.json.
2. Structural caps (the sweep's findings, made into rules):
   - The "Before [imminent event], [Name] must/needs to decide…" closer:
     at most ONE scenario per chapter (R6's binary cap), zero in most.
   - No two chapters may share an opening-line grammar at the same example
     slot ("[Name] has already…" as ex06 opener in 12 chapters = the tell).
   - Clock times in at most 2 scenarios per chapter, never in ex01's first
     sentence twice in consecutive chapters, never the same literal time in
     two chapters (TBKTS had two 9:10-a.m. whiteboard scenes).
   - Researcher-citation-on-a-whiteboard/memo/notes is the anchor-as-prop
     pattern — anchors go INSIDE the scene's logic (Part 2 rule 6).
3. Book-specific sweep fixes (do these in the same pass):
   - the-body-keeps-the-score: rename the INVENTED ch7 "Lisa" (attachment
     coach) — ch19's Lisa is Sebern Fisher's real patient and keeps the
     name; purge "the hard edge" from ALL reader-facing copy (18 chapters:
     quiz explanations, card fronts, breakdowns, memorableLines.why) — name
     the actual caveat each time instead; rewrite ch10's hook OR ch9's (the
     "five X … wound that" twins).
   - rich-dad-poor-dad: collapse/differentiate the twin scenes (boutique
     watch ch3/ch8; freelancer pay-first ch7/ch8; promotion letter
     ch2/ch3/ch6; property folder ch2/4/5/7/9 — each instance gets a
     different shape from the plan); de-duplicate the repeated quiz answers
     and cards (ch7 q06 = ch08 q05; the luxuries-after-assets unit appears
     as a quiz answer AND card in ch2, ch3, ch8 — keep ONE, replace others
     with different testable facts from each chapter's sidecar).
   - outliers: the 54-scenario frame — every scenario gets its dealt shape;
     quiz prompts: no literal stem twice per chapter ("What happens next"
     appeared 34×; openers are FORMS, not sentences).
4. Per chapter: author-check + gate-chapter to "Gate verdict: PASS — 0
   blockers". Quiz keys NEVER change. List every touched chapter for re-QC.
5. Acceptance is the NEXT qc-run sweep (the operator runs it) — there is no
   self-check that substitutes. Anti-gaming rules from the ADDENDUM apply:
   distribution caps, no new uniform templates, report-don't-manufacture.

Priority order: outliers (pilot completion), the-body-keeps-the-score
(19 stale-able PASSes + the Lisa collision), rich-dad-poor-dad. The 4HWW
full redo (fanout --all) supersedes Part 4 for that book.
