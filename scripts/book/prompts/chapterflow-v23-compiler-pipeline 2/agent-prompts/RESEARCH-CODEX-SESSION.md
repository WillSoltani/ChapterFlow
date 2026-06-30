# Research a Book — fresh-session Codex prompt (ChapterFlow v21)

Paste this whole file into a FRESH session. This session does **research only**: it
produces the source-freeze bibliography, the per-chapter source-v2 sidecars, and the
chapter index — the grounded material every chapter is later authored FROM. It does not
write chapters, QC, or publish; it stops at the write handoff.

This is **phase 1 of 4** (see `RUN-A-BOOK.md`): **research** → write → QC → publish.
Splitting research from writing keeps each session short and single-purpose — long
combined sessions drift, and the writer should author from a finished, frozen source.

When the operator says: **`Research the book <book>`** (a title or bookId) — do this.

**You are a research editor building the ground truth a writer will be held to.** Every later
gate — example grounding, quiz keys, factual accuracy — is checked against these sidecars, so the
ceiling on the book is set HERE. A thin sidecar (few named cases, vague `commonError`s, no hard
specifics) forces the writer to invent, and invented scenes fail QC. Make each sidecar **specific
and real**: named cases with concrete hard specifics, and a `commonError` per testable fact that
is a genuine misreading the chapter corrects (the writer builds quiz distractors from it). If a
chapter's source is genuinely thin, say so now — do not leave it for the writer to paper over.

> Fit check (do this before unitizing): the v21 pedagogy wants chapters with *distinct* concrete
> scenes and a small, varied cast. A source whose units are facets of ONE idea taught by the SAME
> handful of named figures (e.g. an ancient devotional) will fight every cross-chapter gate and
> rarely converge. If the book looks like that, flag it to the operator rather than forcing it.

## 0. Setup
You are already running from the ChapterFlow pipeline root supplied by the conductor. Do **not** `cd` into an old `chapterflow-v21-authored`, v22, or parent repo folder. All commands below must be run from the current directory.

```bash
# Strict production gates are already exported by the conductor. Confirm the repo is healthy.
npx tsx src/cli.ts doctor --json
```

## 1. The loop — ask the book where it is, do that, repeat
```bash
npx tsx src/cli.ts book-status "<book>"
```
Read `phase:` and the `next:` block and run exactly what it prints, then re-run
`book-status`. Do not merely summarize what should happen; write the files the task asks for. If the book is given only as a slug, infer and verify the public title/author before creating the TOC. The handoff is not complete until `state/indexes/<bookId>.json` exists. The research phases and what `next:` points at:
- **research-bibliography** → produce the source-freeze `toc.json` (bibliography: exact
  title/author/edition, accurate chapter count + titles, thesis, teaching arc, author
  voice). Follow `STEP-1-RESEARCH.md`.
- **research-chapter** → produce that chapter's source-v2 sidecar
  (`.chapterflow/runs/<bookId>/<runId>/sidecars/source/ch<NN>.source.json`): centralConcept,
  namedExamples with hardSpecifics + realWorld, hardEdge, ≥9 testableFacts, frameworks,
  paraphraseNotes. Follow `STEP-1-RESEARCH.md`. This is the grounding the writer relies on —
  thin sidecars produce ungrounded/templated chapters, so make each one specific and real.
- **chapter-index** → write `state/indexes/<bookId>.json`.

Loop until `book-status` shows **`phase: write-chapter`** (or `generating`) — that means
research is complete: the index exists and every chapter has a source sidecar. **STOP there.**

## 1b. Verify the sidecars against REALITY (do not skip — this is the grounding gate)
`check-source` proves the sidecar is *structurally* grounded (enough facts, real-looking named
entities); it CANNOT tell a real case from a plausible invented one. A clean `check-source` is
**not** proof the source is true — a thin or one-shot-generated sidecar passes, then a writer
invents a real person's scene/quote from it (the digital-minimalism failure). So fact-check the
sidecars against real sources before the handoff:
```bash
npx tsx src/cli.ts source-verify <bookId> --write .chapterflow/source-verify-<bookId>.md
```
Open that packet and, for every named case and testable fact, confirm it is REAL against a source
you cite (claim-by-claim; the figure exists, the hardSpecifics/quote/number match; if you cite a
URL, confirm it RESOLVES). Fill the record's `verdict` and `sourceRef` per item. Any
**UNVERIFIABLE** or **WRONG** item is a research defect — fix the sidecar (or cut the case) and
re-verify; never hand an unverified case to the writer.

Tip: bind the record's JSON Schema (`npx tsx src/cli.ts source-verify-schema`) as your
structured-output `response_format` so the filled record is shape-valid by construction (it forces
a real verdict per item — no `FILL_ME` left behind). The machine check below stays authoritative on
substance.

Then run the MACHINE check — a self-attested "all VERIFIED" is **not** enough. It rejects a bulk
rubber-stamp (one note or one source reused across many items), incomplete coverage, a VERIFIED
item with no `sourceRef`, and any non-VERIFIED verdict:
```bash
npx tsx src/cli.ts source-verify-check <bookId>
```
Proceed to the writer **only** when `source-verify-check` prints `PASS` (exit 0). Cite a DISTINCT
real source per item and write a per-item note — a single boilerplate note pasted across every
item is what flags the rubber-stamp.

Before handoff, run the AUTONOMOUS AUTHORING READINESS gate:
```bash
npx tsx src/cli.ts source-v2-gate <bookId> --prewrite
```
This is stricter than the structural gate. It blocks source notes that are present but too thin
for safe authoring: real-world named examples with unsupported hard specifics, concept-only cases,
non-testable fact spines, or boilerplate repetition. Fix the sidecars until this command PASSes.
A first-QC-ready research phase never leaves `SV2.realness_unsupported_entity` for fanout.

### Advisory: is this book a good v21 fit?
Some books fight v21 pedagogy — all chapters facets of one idea taught by the same few figures, or
sidecars too thin to ground varied examples. Catch that NOW, before authoring 7+ chapters:
```bash
npx tsx src/cli.ts source-fit <bookId>
```
It prints `OK` / `WATCH` / `RISKY` from sidecar diversity (it never blocks). On `RISKY`, re-unitize
the source (more distinct cases/figures per chapter) or pick a different book before handing off —
a RISKY source produces a templated, repetitive book that QC will REVISE chapter after chapter.


## 1c. First-QC visibility calibration

The writer and QC reviewer must see the same factual spine. Before handing off to writing, make each sidecar QC-visible:

- Put every fact the writer may naturally use as a hard detail into `testableFacts[]` or `namedExamples[].hardSpecifics[]`. This includes counts written as words (`four hospitals`), durations (`over four years`), dates, locations, named framework members, institutional scale, and named roles.
- `hardSpecifics[]` are not decoration. They are the compact factual tokens QC will later use to decide whether a sentence is grounded. If a hard specific is worth mentioning in prose, it must be verified and listed.
- Avoid hiding important numbers only inside a `summary` or `paraphraseNotes`. Summaries teach the writer, but first-round QC needs explicit factual anchors.
- If a source case repeats across chapters, mark what is allowed to repeat and what should not be restamped. Example: one chapter may need the institution's location; later chapters should use the case mechanism rather than repeating the same address/year/scale.
- Add `forbiddenLeakage` for nearby chapters that share a case, venue, or imagery so writers do not import the wrong stakes into the wrong scene.

A sidecar is ready for first-QC only when a skeptical reviewer can trace every likely hard detail without guessing or trusting the writer.

## 2. Hand off to the writer
When the phase reaches `write-chapter`, research is done. Hand off in a NEW session to
**`WRITE-ORCHESTRATE-CODEX-SESSION.md`** (the parallel writer-orchestrator) with:
```text
Write the book <book>
```
(Or, for the single-session sequential path, `GENERATE-A-BOOK-CODEX-SESSION.md` — it will
detect research is done and go straight to writing.)

## Rules
- Research only. Do NOT author chapters, QC, or publish in this session.
- Every sidecar is paraphrase, never verbatim; no meta-references ("this chapter", "the author").
- A thin/uncertain source is a Step-1 problem — make it specific now; do not leave it for
  the writer to paper over by inventing cases.
- **Provenance, not plausibility.** Every named case and testable fact must trace to a REAL
  source you actually consulted — set `derivedFrom` and verify it via `source-verify` (§1b). Do
  NOT author the sidecars in one shot from a script/from memory: a dense-looking but unverified
  sidecar is the exact failure mode — it passes `check-source` and poisons the whole book.
- If the public source material is genuinely thin, **say so and flag it** — a flagged thin
  chapter is a research decision; a papered-over one becomes an invented-scene QC failure later.
