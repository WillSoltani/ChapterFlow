# CODEX BRIEF — The last dealing layers: exemplars, venues, tactics, source-figure names

You are building four allocators that close the book-level repetition classes
the stillness QC found (state/qc-runs/stillness.QC-REPORT.md): the same
historical exemplar anchoring 2-3 chapters (Tiger Woods ×3, Dorothy Day ×3,
Fred Rogers ×3), one venue stamped across 14/34 chapters (kitchen table), one
marquee tactic recycled in 7 chapters (phone-facedown), and source figures'
first names reused for fictional protagonists (Benjamin Franklin / Benjamin
the consultant). Work in `scripts/book/prompts/chapterflow-v21-authored/`.

Follow the existing allocator pattern — read `src/librarian/shapePlan.ts` and
`src/librarian/pedagogyPlan.ts` FIRST; your code must look like theirs:
deterministic (FNV-1a book offset, stepping co-prime to palette length, NO
Math.random/Date.now), idempotent, plan written to `state/<kind>-plans/`,
printed by the CLI, injected by `fanout`.

## Ground rules (non-negotiable)

- NEVER run `qc-attest`, `promote-book`, `register-web`, `qc-rehash`,
  `unquarantine-book`, or anything with `--run`. Never edit `state/qc/`.
- Stage commits per explicit path; never sweep the operator's unrelated
  working-tree changes.
- BOTH typechecks must stay clean: `npx tsx tests/run.ts` AND
  `npx tsc -p . --noEmit` in the pipeline dir AND `npx tsc -p . --noEmit`
  at the REPO ROOT (it sweeps pipeline .ts at ES2017/strict — no `/s` regex
  flags, no implicit any).
- Tests must use the REAL instrument, never fixtures that mirror your own
  implementation (the circular-test trap has recurred twice).
- All prompt text you add follows form-not-stamp: palettes are FORMS;
  example wording in definitions must never be reproducible into prose
  (STEP-2 R2.8). No catch-phrases in definitions — the scene-shape palette's
  "the telling detail" became a 14-chapter stamp.
- If something is already implemented when you arrive, SAY SO in the report;
  never manufacture edits.

## Part 1 — Exemplar ledger (`src/librarian/exemplarPlan.ts`)

**Goal: one marquee historical figure/case per book = exactly one chapter.**

1. `planExemplars(bookId, from, to)`:
   - For each chapter, resolve its source sidecar via
     `findRunArtifact(runsRoot, bookId, "sidecars/source/chXX.source.json")`
     (see `src/lib/runDirs.ts:82`; runsRoot is the repo-root `.chapterflow/runs`
     — copy how `fanout` resolves it). Sidecars may be missing → console.warn
     and continue (plan still produced, with empty candidates for that chapter).
   - Extract marquee-exemplar candidates from each sidecar's `namedExamples[]`
     entries. Each entry is an OBJECT `{ label, summary, teachesWhat,
     hardSpecifics?: string[], realWorld? }` — mine the `label`/`summary`
     strings plus the nested `hardSpecifics` array WHERE PRESENT (it is
     optional; ~half the catalog's sidecars, incl. daring-greatly's, have
     none — handle absence silently). Newer source-v2 sidecars also carry a
     top-level `properNouns: string[]` — use it as an extra candidate source
     when present. Mirror fanout's defensive string-or-object handling
     (src/cli.ts:1438-1442). A candidate is a named person, case, or event
     (multi-word proper noun or name+year cluster).
   - DEAL each exemplar appearing in 2+ chapters' sidecars to exactly ONE
     chapter: the chapter whose sidecar treats it most centrally (appears
     earliest in `namedExamples` order; tie → lowest chapter number).
     Exemplars unique to one chapter stay with it.
   - Output `state/exemplar-plans/<bookId>.exemplar-plan.json`:
     per chapter `{ assigned: string[], forbidden: { name, ownerChapter }[] }`
     plus diagnostics `{ contested: number, chaptersWithoutSidecar: number[] }`.
2. CLI: `exemplar-plan <bookId> --from 1 --to N` (mirror `shape-plan`'s
   handler at src/cli.ts:1501-1515 — parse --from/--to, plan, write, print
   via a formatExemplarPlan. The plan commands do NOT call shadowGuard();
   don't add one).
3. `fanout` injection — next to the `• SCENE SHAPES —` bullet at
   src/cli.ts:1469, inside the blocks.push template at ~1463-1483. Build
   your exemplar string the way `shapeLines`/`pedagogyLines` are built at
   ~1411-1424 and interpolate it after `specificsLine`:
   `• MARQUEE EXEMPLARS: this chapter owns X, Y. FORBIDDEN (owned by other
   chapters): Z (ch4), W (ch12) — at most a passing mention, never with
   date/place stamping, never as a teaching unit, never in quiz/cards.`

## Part 2 — Venue palette (`config/venue-palette.json` + `src/librarian/venuePlan.ts`)

**Goal: no venue in more than 2 chapters per book; within a chapter, 6
distinct venues.**

1. `config/venue-palette.json`: ~40 venues across domains — clinical,
   education, trades/workshop, food service, transit, outdoors, retail,
   home (SPECIFIC rooms/objects, not "kitchen table"), civic, sports,
   lab/studio, small business. Entries are nouns only ("a hospital supply
   room", "a transit control booth") — NO scene wording, NO adjectives that
   would become stamps.
2. `planVenues(bookId, from, to)` mirrors `planShapes`: 6 venues per chapter,
   distinct within chapter, zero overlap between consecutive chapters,
   deterministic per book, runtime assert on distinctness. Palette length
   and steps must be co-prime (verify like shapePlan's SLOT_STEP/CHAPTER_STEP
   over L=16; pick L=40+ accordingly — write the proof in a comment).
3. CLI `venue-plan <bookId>` + fanout bullet:
   `• VENUES: example[i] is set at the dealt venue[i] (a venue is a PLACE,
   not a script — furnish it from the scene's own logic). Never relocate two
   examples to the same venue.`

## Part 3 — Tactic families for tryThisNow (extend `config/pedagogy-palettes.json` + `src/librarian/pedagogyPlan.ts`)

**Goal: the marquee tryThisNow ACTION never recycles across chapters
(phone-facedown was the move in 7 stillness chapters).**

1. Add `tacticFamilies` to `config/pedagogy-palettes.json` (current keys:
   comment, hookShapes, tryThisNowGrammars, quizOpeners): ~24 families, each
   `{ id, definition, example }` — e.g. breath/counting, write-one-line,
   subtract-one-thing, environment-move, single-question-conversation,
   timer-block, object-relocation, read-aloud, walk-and-decide,
   comparison-of-two, calendar-edit, checklist-mark, observation-log,
   teach-someone, rehearse-once… Definitions are abstract families;
   examples follow R2.8 (illustrative, never reproducible). The palette
   loader ignores unknown top-level keys, so the addition is safe — extend
   the PedagogyPalettes type and add a cleanTacticFamily parser in
   pedagogyPlan.ts; pick the family-mix step COPRIME with your palette size
   (24) or pickIds' runtime invariant (pedagogyPlan.ts:199-204) will throw.
2. `planPedagogy` deals each chapter 1 `tacticFamily` alongside the existing
   grammar: no family repeats within any 12-chapter window; book-level cap 2.
   Keep the existing dealing deterministic and extend the plan JSON +
   `pedagogy-plan` CLI printout (the plan format is consumed by fanout —
   update both ends).
3. The fanout `• TRY-THIS-NOW GRAMMAR:` bullet (src/cli.ts:1422, inside
   `pedagogyLines`) gains: `marquee tactic family: <id> —
   <definition>. The dealt GRAMMAR shapes the sentence; the dealt FAMILY
   shapes the action. Other chapters own other families — do not borrow
   their moves (no phone-facedown unless dealt).`

## Part 4 — Source-figure names excluded from the protagonist pool (`src/librarian/namePlan.ts`)

In `planNames`, additionally load THIS book's sidecars (same resolution as
Part 1) and run `extractNamesFromText` over each namedExamples entry's
label/summary strings, its nested `hardSpecifics` array (when present), and
top-level `properNouns` (when present). The extractor returns EVERY
capitalized word as a separate token ("Benjamin Franklin" → ["Benjamin",
"Franklin"]) — exclude every returned token from the dealt pool for this
book (intersecting with the bank keeps it bounded); first names are covered
automatically. Add `diagnostics.sourceFigureExcluded: number`. Missing sidecars →
warn + proceed. Do NOT change the cross-book/scale-guard behavior — read the
existing forceFresh/fallback logic and leave its contract intact.

## Part 5 — Deterministic gate checks (the cheap catch so QC never pays for these again)

1. **BP26.exemplar_chapter_reuse** (book-level): a multi-word proper-noun
   n-gram (or Name+year pair) appearing inside `examples[]` or `breakdown`
   text of 2+ chapters → MAJOR (advisory first — see calibration note).
   WIRING: follow BP20/BP21 — a check function in its own critic module
   returning findings with the dotted id and the severity baked into the
   `finding()` call (src/critics/quizQuality.ts:450,590), forwarded from
   `runBookGate` (src/critics/bookGate.ts:226-245). runBookGate uses the
   EMIT-SITE severity, not finalGate's map. Do NOT copy BP13
   (bookPatternAudit's separate code/severity scheme, unregistered in the
   catalog map) or BP24 (a per-chapter ship-gate check, finalGate.ts:652).
   Whitelist the book's own framework terms — `centralConcept.name`
   (centralConcept is an OBJECT `{name, plainDefinition, whyItMatters}`)
   plus `frameworks[].name`/`members` where present.
2. **BP27.venue_stamping** (book-level): the same venue noun-phrase as
   example setting in >2 chapters → MAJOR. Detection: match against
   `config/venue-palette.json` entries + a small hand list ("kitchen table",
   "conference room", "break room").
3. Register BOTH in `CriticCheckId` (src/types.ts — BP25 is the last
   taken; BP22/BP23 are skipped, never used) and in SEVERITY_FROM_CATALOG
   (src/critics/finalGate.ts:89) for registry consistency.
   `tests/check-registry.test.ts` needs no edits (it parses the map from
   source) — but ADD a required-ids assertion for the two new ids, the way
   AS5-AS12 are pinned (tests/check-registry.test.ts:87-105).
   CALIBRATION: run against the gold books. KNOWN GAP: start-with-why has
   NO run dir under .chapterflow/runs (its sidecars are not on disk;
   daring-greatly's resolve fine). Calibrate the whitelist on daring-greatly;
   for start-with-why the whitelist will be empty — console.warn every
   unresolved sidecar and SAY SO in the report (a 0 produced under missing
   sidecars is not proof; see finalGate.ts:213-215). Do not regenerate
   start-with-why sources yourself. Current gold baseline: daring-greatly
   0 blockers/0 majors, start-with-why 0 blockers/1 major — if either check
   fires there, downgrade to minor and report the hits verbatim; never tune
   fixtures to pass (anti-gaming rules apply to you).

## Tests (zero-dep harness, `tests/`)

- exemplar-plan: contested exemplar dealt to exactly one chapter; forbidden
  lists symmetric; deterministic across two runs; missing-sidecar chapters
  warn but plan.
- venue-plan: 6 distinct per chapter, zero consecutive-chapter overlap,
  ≤2 book-wide per venue across a 34-chapter plan (the stillness size),
  deterministic.
- pedagogy tactic: no family within a 12-window, cap 2 enforced at 34
  chapters; existing pedagogy tests still pass unchanged.
- namePlan: planted sidecar fixture with "Benjamin Franklin" → "Benjamin"
  not dealt; diagnostics count it.
- BP26/BP27: planted synthetic fixture fires; gold books stay at their
  current blocker count (0).
- check-registry passes with the two new ids.

## Deliverables

One commit per part (5 commits), each listing files + test names. Final
report: per-part status, the BP26/BP27 gold-calibration outcome verbatim,
and the output of `npx tsx src/cli.ts exemplar-plan stillness-is-the-key
--from 1 --to 34` showing Tiger Woods, Dorothy Day, Fred Rogers, Marcus
Aurelius, Anne Frank, and Kennedy each owned by exactly one chapter.

**STOP after Part 5.** The operator verifies the diffs and runs all QC.
