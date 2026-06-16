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
```bash
cd scripts/book/prompts/chapterflow-v21-authored
npx tsx src/cli.ts doctor <bookId>   # fix anything FATAL before continuing
```

## 1. The loop — ask the book where it is, do that, repeat
```bash
npx tsx src/cli.ts book-status "<book>"
```
Read `phase:` and the `next:` block and run exactly what it prints, then re-run
`book-status`. The research phases and what `next:` points at:
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
