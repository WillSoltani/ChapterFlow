# Playbook — Generate a New Book (end to end)

> **CANONICAL WORKSPACE (2026-06-12): all pipeline work — Codex sessions,
> Claude QC sessions, every CLI command — runs in `~/ChapterFlow-books`
> (a git worktree pinned to `main`). The original `~/ChapterFlow` checkout
> belongs to app campaigns on other branches; running pipeline steps there
> judges/edits STALE copies (this burned a full QC run on 2026-06-11). If a
> session's paths say plain `ChapterFlow/`, stop it.**

The operating model: **Codex (inline) generates, a separate Claude session QCs,
the gates + promote enforce.** Nothing ships that the deterministic gates reject
or that a Claude reviewer hasn't signed off on.

All commands run from `scripts/book/prompts/chapterflow-v21-authored/` (the
pipeline lives on `main` since the v21-redesign merge), Node 20+. Pick a lowercase-hyphen `<bookId>` (e.g.
`deep-work`).

`next-task <bookId>` is your compass: it scans on-disk state and prints the next
artifact to produce, the playbook to read, and where to save it. Run it, do the
task, re-run it. It does NOT yet prompt the two manual steps below (name-plan,
qc-attest) — insert them at the marked points.

---

## 1. Research → v2 source sidecars  (Step 1)

```
npx tsx src/cli.ts next-task <bookId>
```
It walks you through, in order:
1. **Bibliography** → `…/source-freeze/toc.json` (the chapter list). Playbook: `STEP-1-RESEARCH.md`.
2. **Per-chapter source sidecar** → `…/sidecars/source/chNN.source.json`, one per chapter.
   New books are **`schemaVersion: "source-v2"`** — real `testableFacts`
   (claim + becauseMechanism + commonError), `namedExamples` with `hardSpecifics`,
   and anchor ids. This is what powers correct quiz keys + SC11 provenance. Do NOT
   ship v1 sidecars for a new book.
3. **Chapter index** → `state/indexes/<bookId>.json`.

Validate the research before writing:
```
npx tsx src/cli.ts check-source <bookId>      # source coherence; exit 0 = OK
```

## 2. Name plan  (MANUAL — before writing any chapter)

Prevents the parallel-authoring collisions (book-gate F1 reused names / BP13
stock phrases). Deals each chapter a disjoint protagonist-name slice + banned
connectives.
```
npx tsx src/cli.ts name-plan <bookId> --from 1 --to <N>   # N = chapter count
```
Writes `state/name-plans/<bookId>.name-plan.json`. Each chapter's writer reads
its slice from `allocation["<chapterNumber>"]`. (Default 7 names/chapter; if it
warns SHORT, lower `--per-chapter` or grow `config/name-bank.json`.)

## 3. Write chapters  (Step 2)

```
npx tsx src/cli.ts next-task <bookId>     # prints the next chapter to write
```
For each chapter, author it inline (Codex) against:
- `STEP-2-WRITE-CHAPTERS.md` (authoring law: the Bind Block, R1–R6 — R6 is the anti-templating rule: vary the SHAPE of every scene; `fanout` deals each chapter its scene-shape palette),
- the chapter's v2 sidecar,
- its name-plan slice (use ONLY those protagonist names; one name = one person).

Save to `state/chapters/<bookId>-chNN.v21-native.chapter.json`, then **self-gate to green**:
```
npx tsx src/cli.ts author-check  state/chapters/<bookId>-chNN.v21-native.chapter.json
npx tsx src/cli.ts gate-chapter  state/chapters/<bookId>-chNN.v21-native.chapter.json
```
Fix every blocker the **`Gate verdict:`** line names (re-author the field from the
sidecar — don't game the check). Repeat until `Gate verdict: PASS — 0 blockers`.
Re-run `next-task`; loop until every chapter is written.

## 4. Book gate  (cross-chapter)

```
npx tsx src/cli.ts book-gate <bookId>     # must be PASS (0 blockers, 0 majors)
```
Catches cross-chapter templating (F1 names, BP13 phrases, skeleton drift) that
per-chapter gates can't see. The name plan should keep F1/BP13 clean; fix any
hit before QC.

## 5. Semantic QC  (separate Claude session — the no-API judge)

Open a fresh QC session and give it `QC-SESSION-PROMPT.md`. It reads each
chapter, scores the publishable bar, and **hidden-key-derives every quiz answer**
(derive the key independently, then compare). In v21.1 no-api Codex QC mode
(`CHAPTERFLOW_NO_API_CODEX_QC=1`), first open a role-separated round and produce
the required artifacts:
```
npx tsx src/cli.ts qc-open-round <bookId>
npx tsx src/cli.ts sweep-pack <bookId> --round <roundId>
npx tsx src/cli.ts key-pack <bookId> --round <roundId>
# two independent readers:
npx tsx src/cli.ts key-derive <bookId> --round <roundId> --role keyA --token <keyA-token> --answers-file <path>
npx tsx src/cli.ts key-derive <bookId> --round <roundId> --role keyB --token <keyB-token> --answers-file <path>
npx tsx src/cli.ts key-resolve <bookId> --round <roundId>
npx tsx src/cli.ts sweep-attest <bookId> --round <roundId> --token <sweep-token> --verdict PASS --reviewer "<id>" --findings-file <sweep-findings.json>
npx tsx src/cli.ts bar-pack <bookId> --round <roundId>
npx tsx src/cli.ts bar-attest <bookId> --round <roundId> --token <bar-token> --scores-file <filled-bar-scores.json> --reviewer "<id>"
npx tsx src/cli.ts major-status <bookId>   # every current major needs major-disposition
```
For small/manual rechecks, record one chapter verdict directly:
```
npx tsx src/cli.ts qc-attest state/chapters/<bookId>-chNN.v21-native.chapter.json \
  --verdict PUBLISHABLE|REVISE|CORRUPTION --reviewer "claude-qc:<session>" \
  --round <roundId> --token <bar|confirm|attest-token> \
  --dimensions "keysCorrect=true,grounded=true,nonTemplated=true,frameworkComplete=true,cardsAnswerFronts=true,distractorsReal=true" \
  --notes "<bar score; reason>"
```
Track coverage:
```
npx tsx src/cli.ts qc-status <bookId>     # every chapter must read PASS
```
A `REVISE`/`CORRUPTION` verdict → Codex fixes the chapter, then it's re-reviewed
(the edit makes the old attestation STALE automatically). Turnkey alternative:
the `qc-review` workflow (`src/scratch/qc-review.workflow.js`) reviews + attests a
batch in one run.

## 6. Promote → ship the package  (Step 3)

```
npx tsx src/cli.ts promote-book <bookId> --title "Full Title" --author "Author Name"
```
Promote re-runs the **ship gate + book gate + QC-attestation gate** — ALL must be
blocker-clean. It strips the internal `sourceAnchorId` and writes
`book-packages/<bookId>.v21.json`. On any failure it quarantines the report and
does NOT ship. **Categories + tags are auto-derived (no-API) from the book's
content** — preview them with `npx tsx src/cli.ts categorize <bookId>`, or override
with `--categories "A,B" --tags "x,y"`.

## 7. Make it render in the reader  (one command)

```
npx tsx src/cli.ts register-web <bookId>
```
Covers BOTH surfaces:
- **Static `/books` browse page** — append-only registration into
  `app/book/data/bookPackages.ts` (touches no existing line) + catalog refresh.
- **In-app reader + library** (the actual reading experience, backed by
  DynamoDB/S3) — if your AWS env is set (`BOOK_TABLE_NAME` / `BOOK_INGEST_BUCKET`
  / `BOOK_CONTENT_BUCKET` / `AWS_REGION`), it **auto-runs the ingest**; otherwise
  it prints the `publish-single-package.ts` command to run when you have AWS.

Idempotent. Refresh the page after — no dev-server restart needed for the reader.

---

## Fast path — write every chapter in parallel (`fanout`)

Steps 2+3 above are the slow, serial way. To write the whole book at once, after
research is done run:
```
npx tsx src/cli.ts fanout <bookId>
```
It runs `name-plan` for you and prints **one ready-to-paste prompt per chapter** —
title, the real source-notes path, that chapter's names, the save path, and the
self-gate command all filled in. Paste each block into its own Codex agent and let
them run in parallel; each self-gates to `PASS — 0 blockers` on its own. Re-run
`fanout` any time to see only what's still unwritten. Then `book-gate`, QC, promote
as normal. This replaces the manual per-chapter `name-plan` + `next-task` + edit-the-
prompt-by-hand loop.

## Quick reference — the happy path

```
next-task <bookId>            # → research: toc + v2 sidecars + index (loop)
check-source <bookId>
name-plan <bookId> --from 1 --to <N>
next-task <bookId>            # → write each chapter (loop)
  author-check / gate-chapter # → self-gate each to 0 blockers
book-gate <bookId>            # → 0 blockers cross-chapter
# (Claude QC session) qc-attest each chapter ; qc-status <bookId> → all PASS
promote-book <bookId> --title … --author …          # categories/tags auto-derived
register-web <bookId>                                # show it in the reader
```

Not yet automated: `name-plan` and `qc-attest` are manual inserts (the `next-task`
ladder doesn't prompt them). Wiring them into `next-task` would make the whole
flow a single `next-task`-driven loop.
