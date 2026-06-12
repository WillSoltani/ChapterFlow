# CODEX BRIEF — Stillness remediation: family-by-family de-templating

You are fixing the 22 cross-chapter templating families the QC found in
`stillness-is-the-key` (34 chapters). The authoritative defect list is
`state/qc-runs/stillness.QC-REPORT.md` — read it FIRST, in full. Each
family's **Fix:** line is your instruction; this brief adds the plans,
order, and caps. Work in `scripts/book/prompts/chapterflow-v21-authored/`.

## Ground rules (non-negotiable)

- **REPO MUST BE ON `main`** (`git branch --show-current`). The dealing-layer
  tooling (venue-plan, tactic families, exemplar plans, BP26/BP27) only
  exists there. If not on main, STOP and report.
- FIRST ACTION: commit the untracked stillness content so it is in git
  before you edit it —
  `git add state/chapters/stillness-is-the-key-ch*.json state/briefs/stillness-is-the-key.manual-brief.json state/qc-runs/stillness.QC-REPORT.md`
  then commit ("stillness: commit generated book pre-remediation").
- NEVER run `qc-attest`, `promote-book`, `register-web`, `qc-rehash`,
  `unquarantine-book`, or anything with `--run`. Never edit `state/qc/`.
- **NEVER change any quiz `correctIndex`.** The four confirmed wrong keys
  (ch13, ch14, ch15, ch24) are the OPERATOR's job via the adjudication
  path — not yours, even though you'll see them.
- Stage commits per explicit path. Both typechecks + `npx tsx tests/run.ts`
  stay green.
- Anti-gaming rules (CODEX-BRIEF-CATALOG-REFRESH addendum) apply: metrics
  are measurements, not targets; never rotate to a new uniform template;
  report already-fixed items instead of manufacturing edits.
- All rewritten text follows STEP-2 R2.7 (plain language: concrete within
  two sentences, say-it-to-a-friend) and R2.8 (nothing in any prompt/plan/
  report is copy-paste material — including the QC report's own quoted
  signatures).

## Phase 0 — Deal the plans (before touching any chapter)

1. Read the committed exemplar plan:
   `state/exemplar-plans/stillness-is-the-key.exemplar-plan.json` — it is
   entity-unified (every form of one figure has ONE owner). This is the
   reassignment map for all exemplar-reuse families.
2. Run and read:
   - `npx tsx src/cli.ts venue-plan stillness-is-the-key --from 1 --to 34`
   - `npx tsx src/cli.ts pedagogy-plan stillness-is-the-key --from 1 --to 34`
     (now deals a tryThisNow tactic family per chapter)
   - `npx tsx src/cli.ts name-plan stillness-is-the-key --from 1 --to 34 --force-fresh`
     (source-figure names are now excluded; use this for the renames)

## Phase 1 — The two seed-example families (highest leverage)

`records-audit` (14 ch) and `planning-choice` (13 ch) are the authoring
prompt's own seed examples echoed downstream. Per the report's fix lines:
each format keeps at most ~3 chapters (choose the 3 where it fits the
lesson best); every other instance is REWRITTEN to that example slot's
dealt scene shape (shape-plan exists; read it) at the dealt venue, with the
banned verbatim phrases gone ("Nothing dramatic happens", "the telling
detail", "reviews [N] [units]", "has N minutes before X", "three named
slots"). CH23 and CH25 duplicate the same slides-vs-walk choice nearly
line-for-line — rewrite ONE of them entirely.

## Phase 2 — The other seven scene-skeleton families

Same recipe per the report (postmortem-autopsy, two-person contrast,
kitchen-table TRY-NOW, mistake-recovery "hears themselves", routine
break/stop/restart, Before:/After: diptych, timestamped Subject: memo,
"N minutes before X"): cap ~3 chapters per format, rewrite the rest to
their dealt shapes/venues, ban the listed payoff lines and openers. The
deadline-decision language now belongs ONLY in decision-family formats
(C3 was fixed: audit/vignette/dialogue scenes need NO decision phrasing —
remove it where it was forced in).

## Phase 3 — Exemplars, venues, tactics, names

1. **Exemplars** (Tiger Woods, Dorothy Day, Fred Rogers, Marcus Aurelius,
   Seneca/Nero, Anne Frank, Kennedy, control-distinction unit): the plan's
   owner chapter keeps the case; every other chapter re-sources its example
   from ITS OWN sidecar's namedExamples (the sidecar is ground truth — never
   invent facts; a passing mention without date/place stamping is allowed).
2. **Venues**: kitchen table ≤3 chapters; move stamped scenes to dealt
   venues (minimal diffs — relocate only scenes that carried the stamp).
3. **Tactics**: phone-away remedy ≤2 chapters; every other chapter's
   marquee tryThisNow action comes from its dealt tactic family (grammar
   shapes the sentence, family shapes the action).
4. **Renames**: ch29 "Benjamin" and ch30 "Pascal" protagonists → fresh
   names from the force-fresh name plan, consistent across every field.
5. The smaller repeated_units per the report (input-discipline callback
   rotation, ifThen lead-trigger dedup ch12/ch14, "supervise the sky"
   memorable line to one chapter).

## Per chapter / per phase

- After each edited chapter: `npx tsx src/cli.ts gate-chapter <file>` to
  `Gate verdict: PASS — 0 blockers`.
- After each phase: `npx tsx src/cli.ts book-gate stillness-is-the-key` —
  BP26 (exemplar reuse) and BP27 (venue stamping) now exist and will catch
  residuals deterministically. Gate to clean or report the residue honestly.
- One commit per phase (4 commits), message listing per-family
  before→after instance counts (honest counts — the operator re-counts).

## Deliverable

Final report: per-family instance counts before/after, the book-gate
output, the chapters touched (expect: all 34 need re-QC — list them), and
anything you could NOT fix with a reason. The operator then fixes the four
wrong keys and runs the sweep-first qc-run as acceptance — if it doesn't
early-exit on systemic templating, the remediation worked.

**Recommended session split** (34 chapters × 22 families is too much for
one session): Session A = Phases 0-1, Session B = Phase 2, Session C =
Phase 3 + final report. Each session re-reads this brief and the QC report.
