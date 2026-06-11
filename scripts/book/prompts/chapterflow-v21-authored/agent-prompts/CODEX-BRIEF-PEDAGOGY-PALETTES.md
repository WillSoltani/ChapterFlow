# CODEX BRIEF — Pedagogy-slot palettes (catalog campaign, Phase B2)

You are implementing a TypeScript feature in the ChapterFlow v21 pipeline.
Work in `scripts/book/prompts/chapterflow-v21-authored/` (commands run from
there: `npx tsx src/cli.ts <cmd>`).

## Why this exists (read first)

The 2026-06-10 reader review found the catalog speaks in ONE voice at the
slot level: 90% of all 325 hooks are the same rhetorical shape (2 questions
in the whole catalog), `tryThisNow` is one exercise grammar in 26 skins
("Write one" ×118 of ~300), and quiz prompts are one opener family
("a <role>" ×354). The fix is the pipeline's proven pattern — allocate
variety BEFORE parallel authoring (see `src/librarian/namePlan.ts` and
`src/librarian/shapePlan.ts`; read both before writing code, your module
mirrors their conventions exactly).

The meter is `npx tsx src/cli.ts catalog-audit` (`src/critics/catalogAudit.ts`).
Your feature exists to move its numbers; its classifier definitions are your
ground truth.

## Deliverables

1. **`config/pedagogy-palettes.json`** — three palettes, definitions written
   to be pasted verbatim into authoring prompts (match the quality bar of
   `config/scene-shapes.json`):
   - `hookShapes` (~10). Each entry: `id`, `definition` (concrete, with a
     miniature example), and `auditClass` — which `classifyHook` category in
     `src/critics/catalogAudit.ts` it lands in (`question`, `direct_address`,
     `numeric`, `first_person`, `declarative_image`). At most 3 of the 10 may
     be `declarative_image` (the saturated house shape); include at least 2
     `question`, 2 `direct_address`, 1 `numeric`, 1 `first_person`.
   - `tryThisNowGrammars` (~8). Each: `id`, `definition`, `example`. Vary the
     STRUCTURE, not the verb: timer-based ("For the next 10 minutes…"),
     conversation ("Ask one person…"), observation-count, environment change,
     deliberate abstention, schedule-an-event, notice-and-record, the current
     write-one (keep it — capped, not banned).
   - `quizOpeners` (~6). Each: `id`, `definition`, `example`. E.g. direct
     second-person situation, quote-interpretation, what-happens-next
     prediction, compare-two-responses, data/number reading, plus the current
     scenario-role (kept, capped).

2. **`src/librarian/pedagogyPlan.ts`** — allocator. Semantics (different
   from shapePlan — variety here is needed ACROSS books first):
   - `planPedagogy(bookId, from, to, opts?: { forceFresh?: boolean }): PedagogyPlan`
   - **Book-level dealing**: FNV-1a(bookId) (copy the hash from shapePlan)
     selects the book's hook-shape palette (a dominant + 2 secondaries),
     its 3-grammar `tryThisNow` mix, and its 2-opener quiz mix. Adjacent
     rotations must differ (use coprime stepping like shapePlan's header
     math — document YOUR step constants and their invariant the same way).
   - **Chapter-level dealing within the book's mix**: no two consecutive
     chapters get the same hook shape; tryThisNow grammars rotate through
     the book's 3; quiz openers alternate.
   - **Idempotency**: a chapter whose file exists in `state/chapters/` is
     carried (marked in `carriedChapters`, like shapePlan) — UNLESS
     `forceFresh` (the redo path). Use `chapterFileName` from
     `src/lib/chapterPaths.ts` for the existence check and note: existence
     checks must tolerate capital-letter bookIds (see shapePlan's
     `onDiskFormats` — replicate its approach, including its known
     case-sensitivity caveat fix if you can do it via `isSiblingFile`).
   - `writePedagogyPlan` → `state/pedagogy-plans/<bookId>.pedagogy-plan.json`,
     `formatPedagogyPlan` — mirror shapePlan's exports.
   - **Runtime invariant check** like shapePlan's: throw if the dealt
     chapter-level sequence violates the no-consecutive-repeat rule (the
     config can change underneath the step math).

3. **`cli.ts` wiring**:
   - `pedagogy-plan <bookId> --from N --to M` command (mirror `shape-plan`'s
     handler, dispatch entry, and help text — all three places).
   - **fanout integration**: in `runFanout`, call `planPedagogy` next to
     `planShapes` (same `forceFresh: includeAll` rule) and add to each
     chapter's prompt block, after the SCENE SHAPES bullet:
     - `• HOOK SHAPE: <id> — <definition>` (the chapter's dealt shape)
     - `• TRY-THIS-NOW GRAMMAR: <id> — <definition> (example: <example>)`
     - `• QUIZ OPENERS: rotate between <id> (<example>) and <id> (<example>); keyed answer must NOT be reliably the longest choice (BP25 — target ≤45% of questions).`

4. **`tests/pedagogy-plan.test.ts`** — model on `tests/shape-plan.test.ts`:
   - palette loads, ids unique, definitions substantial, auditClass values
     valid and the declarative_image cap respected;
   - determinism (two runs byte-identical); different books → different
     dominant hook shapes (test 5 bookIds, require ≥3 distinct dominants);
   - no consecutive same hook shape within a 20-chapter plan;
   - carried vs forceFresh behavior (use `makeChapter`/`writeFixtureBook`
     from `tests/helpers.ts`, clean up in `finally` — fixtures are
     `zz-fixture-*` and EVERY test must remove what it writes);
   - a synthetic check that 10 books planned fresh produce
     `catalogAudit`-classified hook distribution with dominant share < 0.5
     (import `classifyHook`, classify each book's dealt shapes via their
     auditClass).

## Conventions you MUST follow (this repo bites otherwise)

- **Tests**: run `npx tsx tests/run.ts` from the pipeline dir — must stay
  84+ pass / 0 fail. New known-bugs go in as `xfail()` (read
  `tests/README.md` first; XPASS fails the suite by design).
- **Two typechecks, both must stay at zero errors**:
  `npx tsc -p . --noEmit` in the pipeline dir, AND
  `npx tsc -p . --noEmit` at the REPO ROOT — the root Next.js tsconfig
  sweeps `**/*.ts` at ES2017/strict. No ES2018+ regex flags, annotate
  callback params (noImplicitAny), no implicit any.
- **No new gate checks** in this task — if you think one is needed, write it
  in the PR notes instead. (If you ever add one elsewhere: catalog ids
  C11–C23 and BP14–BP25 are taken; `tests/check-registry.test.ts` guards the
  namespace; new finding ids must be added to the `CriticCheckId` union in
  `src/types.ts`.)
- **Do not touch** `state/qc/` or run `promote-book`, `register-web`,
  `qc-attest`, `qc-rehash`, or anything with `--run`.
- **Commit discipline**: the working tree has the operator's uncommitted
  changes in `src/types.ts`, `src/critics/narrative.ts`,
  `src/critics/quizQuality.ts` (plus various `state/` deletions). Stage ONLY
  your files explicitly (`git add <each path>`); never `git add -A` or a
  directory that sweeps those in. Commit message explains the invariants.

## Done means

- `npx tsx src/cli.ts pedagogy-plan zz-test --from 1 --to 20` prints a sane
  plan; `npx tsx src/cli.ts fanout rework --from 8 --to 8` shows the three
  new bullets with real definitions; suite green; both typechecks clean;
  `state/pedagogy-plans/zz-test*` removed before commit.
