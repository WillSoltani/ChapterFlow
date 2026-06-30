# PLAYBOOK — Operator-driven research

This playbook is for **inline-operator mode**: the Claude session you are running in IS the researcher. Read this playbook, produce the artifacts using your own model (no subprocess calls, no API usage), save them to disk in the on-disk shape the existing pipeline expects, and the downstream critics + assembler + gates do the rest.

You're producing two kinds of files for one book: (1) a single book-level bibliography record, and (2) one chapter-source sidecar per chapter. After both are in place, you run the source-coherence critic via Bash; if it passes, the book is ready for the per-chapter playbook.

---

## Inputs you need

- Book **title** (verbatim, exact capitalization).
- Book **author** (verbatim).
- A book you know well from training data, or that the user is willing to walk you through. If you do not recognize the book, set `confidence: "low"` and add `notes` describing the uncertainty — never invent a chapter list.

## What you are producing

```
.chapterflow/runs/<bookId>/<runId>/source-freeze/
  toc.json                          # bibliography record
  book-source.md                    # book-level summary (auto-rendered from toc + chapter sources)
  source-freeze-report.md           # provenance log (auto-rendered)
.chapterflow/runs/<bookId>/<runId>/sidecars/source/
  ch01.source.txt                   # human-readable chapter notes
  ch01.source.json                  # same content as structured JSON
  ch02.source.txt
  ch02.source.json
  ...
scripts/book/prompts/chapterflow-v21-authored/state/indexes/
  <bookId>.json                     # ChapterSpec[] used by generate-book
```

- `<bookId>` is a lowercase-dash slug (e.g., `atomic-habits`, `thinking-fast-and-slow`).
- `<runId>` is `YYYYMMDD-HHMMSS` UTC.

---

## Step 1 — Produce the bibliography

Read [researcher-bibliography.system.md](researcher-bibliography.system.md) in full. That file IS your system prompt; treat it as authoritative.

Produce a `BibliographyResult` JSON object matching the schema in that file. Specifically:

- `bookId` — slug
- `title`, `author` — verbatim
- `edition.chapterCount` — accurate; if uncertain, set `confidence: "low"` and explain in `notes`
- `sections` (parts/sections exist) OR `flatChapters` (flat list), never both
- `thesis` — your paraphrase of the book's central argument, NOT the jacket copy
- `teachingArc` — how the chapters compound (2-3 sentences naming what each section does)
- `authorVoice` — observable register, 3-5 signature moves, 2-4 avoid moves
- `confidence` — high / medium / low; be honest

Save the bibliography to:
```
.chapterflow/runs/<bookId>/<runId>/source-freeze/toc.json
```

The on-disk format adds an `edition.language: "English"` default if missing.

### Validation gate

Run:

```bash
node -e "
const j = JSON.parse(require('fs').readFileSync('.chapterflow/runs/<bookId>/<runId>/source-freeze/toc.json','utf8'));
console.log('chapterCount:', j.edition.chapterCount);
const flat = (j.flatChapters || []).concat(...(j.sections || []).map(s => s.chapters));
console.log('chapters listed:', flat.length);
console.log('confidence:', j.confidence || 'not set');
if (flat.length !== j.edition.chapterCount) console.error('MISMATCH'); else console.log('OK');
"
```

The chapter list count must equal `edition.chapterCount`. If mismatch, fix and re-save.

---

## Step 2 — Produce per-chapter sources

Read [researcher-chapter.system.md](researcher-chapter.system.md) in full. That file IS your system prompt for this step.

For each chapter `N` in the bibliography, produce a `ChapterResearchResult` JSON matching the schema. The non-negotiables:

- `paraphraseNotes` — 600-3000 chars (target 1200-2400). This is what the downstream breakdown writer reads; specificity here directly determines book quality.
- `namedExamples` — 1-5 real examples from this specific chapter (not from a different chapter of the same book; not invented). Each with `label`, `summary` (2-3 sentences), `teachesWhat` (1 sentence).
- `hardEdge` — 80+ chars. Identify the typical mis-takeaway (the obvious-but-wrong reading) so quiz writers can craft distractors around it.
- `keyClaims` — 4-8 items.
- `voiceCues` — 2-4 observable moves in THIS chapter (not aspirational).
- No meta-references ("this chapter…", "the author…", "Chapter N…").
- No author-surname-verb constructions ("Clear argues", "Kahneman says").

Save each chapter as both a `.json` and a human-readable `.txt`:

```
.chapterflow/runs/<bookId>/<runId>/sidecars/source/ch<NN>.source.json
.chapterflow/runs/<bookId>/<runId>/sidecars/source/ch<NN>.source.txt
```

Where `<NN>` is zero-padded (`ch01`, `ch02`, … `ch24`).

The `.txt` form follows the shape rendered by [src/agents/researcher-chapter.ts](../src/agents/researcher-chapter.ts) `renderChapterSidecar()`:

```
Chapter N focus: <focus>

Core claim: <coreClaim>

Central concept (<name>):
  <plainDefinition>
  Why it matters: <whyItMatters>

Key claims:
- <claim 1>
- <claim 2>
...

Named examples:
- <label>: <summary> (teaches: <teachesWhat>)
...

Hard edge / typical misreading:
  <hardEdge>

Voice cues observed in this chapter:
- <cue 1>
...

Paraphrase notes:
<paraphraseNotes>
```

You can produce both formats together by writing the JSON, then rendering the txt from it — or use Bash to call `renderChapterSidecar` directly:

```bash
npx tsx -e "
import { renderChapterSidecar } from './scripts/book/prompts/chapterflow-v21-authored/src/agents/researcher-chapter.ts';
import { readFileSync, writeFileSync } from 'fs';
const j = JSON.parse(readFileSync(process.argv[1], 'utf8'));
writeFileSync(process.argv[1].replace('.json', '.txt'), renderChapterSidecar(j), 'utf8');
" .chapterflow/runs/<bookId>/<runId>/sidecars/source/ch01.source.json
```

### How to research efficiently

The downstream pipeline needs the source notes to be specific (named examples, real numbers, concrete claims). Generic paraphrase produces generic prose. To produce specific notes:

1. **Anchor on examples first.** For each chapter, identify the 2-3 named anchors (a study, a person, a place, a number) that the chapter actually uses. If you can't name a specific anchor, the chapter source isn't ready.
2. **Identify the misreading explicitly.** Write `hardEdge` by completing the sentence: "A careless reader walks away with [X], but the actual claim is [Y]." X and Y must differ.
3. **List 4-8 keyClaims.** Each should be a single proposition the chapter argues. Not "X is discussed" but "X causes Y when Z."
4. **paraphraseNotes is dense.** Tell what the chapter does, the order of its moves, the examples it uses, the conclusion it lands on. No marketing copy, no jacket-blurb language.
5. **Note voice cues.** Look at the chapter's actual moves: does it open with a scene, a definition, a quote? Use the word "system" or "process"? Ask the reader rhetorical questions or instruct directly?

---

## Step 3 — Write the chapter index

Produce a `ChapterSpec[]` JSON array at:

```
scripts/book/prompts/chapterflow-v21-authored/state/indexes/<bookId>.json
```

Shape:

```json
[
  { "chapterId": "<bookId>-ch01", "chapterNumber": 1, "chapterTitle": "<exact title from bibliography>" },
  { "chapterId": "<bookId>-ch02", "chapterNumber": 2, "chapterTitle": "..." },
  ...
]
```

The `chapterId` is `<bookId>-ch<NN>` zero-padded. The pipeline reads this file to know what chapters exist.

---

## Step 4 — Run the source-coherence critic

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts check-source <bookId>
```

If the critic fails with blockers, fix the offending chapter sources and re-run. The downstream pipeline trusts this output absolutely.

Common findings the critic surfaces:
- `SC1.chapter_count_mismatch` — bibliography says N chapters, but you saved a different count
- `SC2.chapter_numbers_not_sequential` — gap or duplicate in your chapter file numbers
- `SC3.paraphrase_too_short` — a chapter's paraphraseNotes is under 600 chars
- `SC4.meta_reference` — a "this chapter / the author / Chapter N" leaked into source notes
- `SC5.author_surname_verb` — an "Pressfield argues" / "Clear says" leaked in
- `SC6.long_quoted_span` — a 40+ char quoted span (possible verbatim citation; review)
- `SC7.no_named_examples` — a chapter has no named examples; downstream will be abstract
- `SC8.cross_chapter_paraphrase_duplicate` — two chapters share 3+ 8-gram signatures; you reused text

---

## Done

Once the source-coherence critic passes, the book is ready for per-chapter generation. Move to [PLAYBOOK-OPERATOR-CHAPTER.md](PLAYBOOK-OPERATOR-CHAPTER.md).
