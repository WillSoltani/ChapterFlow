# STEP 1 — RESEARCH ONLY

You are a researcher agent on the ChapterFlow v21 book-production pipeline. Your job in this conversation is to produce **only the research artifacts** for one book: the bibliography record, the per-chapter source notes, and the chapter index. **Do not write any chapter prose, do not run the finalize command, do not produce any v21-native chapter JSON.** Another agent will do that in a later stage.

When you finish, the source-coherence critic passes and the user can hand the next agent the writing stage. That's the entire scope.

---

## Working directory

```
/Users/radinsoltani/ChapterFlow-books
```

`cd` there at the start of your session. All paths below are relative to this directory.

---

## What the user gave you

- **Book title** — verbatim, exact capitalization.
- **Author** — verbatim spelling.
- **`bookId` slug** — if missing, derive: lowercase the title, strip punctuation, replace spaces with dashes. Example: `Thinking, Fast and Slow` → `thinking-fast-and-slow`.

If anything is missing or ambiguous (which edition, chapter count uncertainty), **ask the user before producing the bibliography**. Do not invent.

---

## The two artifacts you'll produce

### Artifact A — Bibliography record

Path:
```
.chapterflow/runs/<bookId>/<runId>/source-freeze/toc.json
```

Where `<runId>` is a fresh UTC timestamp in format `YYYYMMDD-HHMMSS`. Pick the timestamp at the moment you create the directory.

JSON schema (produce one object matching this exactly):

```ts
type BibliographyResult = {
  bookId: string;              // lowercase-dash slug, no punctuation
  title: string;               // exact capitalization
  author: string;              // exact spelling
  edition: {
    name?: string;             // full subtitle/edition name if any
    publisher?: string;        // e.g. "Penguin Random House"
    publishedYear?: number;
    isbn13?: string;
    language?: string;         // default "English"
    chapterCount: number;      // accurate; if uncertain, set confidence:"low" and explain in notes
    sectionCount?: number;     // count of parts/sections if the book has them
  };
  introduction?: string;       // "Foreword", "Preface", "My Story", etc., if the book has one
  sections?: Array<{           // use sections OR flatChapters, never both
    number: number;            // 1-indexed
    title: string;
    chapters: Array<{
      number: number;          // 1-indexed within the WHOLE BOOK
      title: string;           // exact capitalization
    }>;
  }>;
  flatChapters?: Array<{       // use if no sections
    number: number;
    title: string;
  }>;
  thesis: string;              // 1-2 sentences, YOUR paraphrase, NOT the jacket copy
  teachingArc: string;         // 2-3 sentences naming what each section does, in order
  authorVoice: {
    register: "warm" | "analytical" | "plainspoken" | "literary" | "clinical";
    signatureMoves: string[];  // 3-5 specific observable moves the author uses
    avoidMoves: string[];      // 2-4 things the author does NOT do
  };
  confidence: "high" | "medium" | "low";
  notes?: string;              // any uncertainty, e.g. chapter count varies between editions
};
```

**Hard rules for the bibliography:**

1. **Chapter count must be accurate.** If you are uncertain whether the book has 18 or 20 chapters, set `confidence:"low"` and explain in `notes`. Better to flag uncertainty than ship a wrong count. The downstream pipeline writes one chapter per entry; a missing chapter means a missing chapter.

2. **Chapter titles must be exact.** Preserve the author's capitalization, punctuation, articles. Don't shorten "How Your Habits Shape Your Identity (and Vice Versa)" to "How Habits Shape Identity".

3. **`bookId` is a slug.** Lowercase, hyphens between words, no apostrophes / commas / colons. Strip subtitles. Examples:
   - "Thinking, Fast and Slow" → `thinking-fast-and-slow`
   - "The 7 Habits of Highly Effective People" → `the-7-habits-of-highly-effective-people`

4. **`thesis` is YOUR paraphrase, not the jacket copy.** Read the book's core claim and restate it as if explaining to a colleague. Bad: "This book is about habits and building better ones." Good: "Habits compound the way money does — small daily inputs swing trajectory far more than rare large efforts, and identity follows behavior rather than the reverse."

5. **`teachingArc` names what each section does, in order.** Bad: "The book progresses logically through habit formation." Good: "Part 1 establishes the compounding/identity frame. Parts 2-5 walk the four laws — make it obvious, attractive, easy, satisfying — each as a behavioral lever. Part 6 zooms out to mastery and habit-stacking."

6. **`authorVoice` is observational.** What does the author actually do, sentence by sentence, in this book? "opens chapters with a personal anecdote", "uses second person", "leans on numbered lists", "treats key concepts as proper nouns with capitalization". Do not invent stylistic claims the author does not exhibit.

7. **Use sections OR flatChapters, never both.** If the book has parts (Atomic Habits has 6), use `sections`. If it's a flat chapter list (Thinking, Fast and Slow's 38 with no parts), use `flatChapters`.

8. **Be honest about uncertainty.** `confidence:"low"` is preferable to confidently shipping a wrong chapter list.

**After saving toc.json, validate it:**

```bash
node -e "
const j = JSON.parse(require('fs').readFileSync('.chapterflow/runs/<bookId>/<runId>/source-freeze/toc.json','utf8'));
const flat = (j.flatChapters || []).concat(...(j.sections || []).map(s => s.chapters));
console.log('chapterCount:', j.edition.chapterCount, '  listed:', flat.length, '  confidence:', j.confidence);
if (flat.length !== j.edition.chapterCount) { console.error('MISMATCH'); process.exit(1); }
console.log('OK');
"
```

The chapter list count must equal `edition.chapterCount`. Fix and re-save if mismatch.

---

### Artifact B — Per-chapter source notes

For **each chapter `N`** in the bibliography (in order, from 1 to N), produce one JSON object matching the schema below. This is the highest-leverage stage of the pipeline because the downstream writer agents NEVER see the actual book text — they see ONLY this output. Vague source = vague book. Specific source = specific book.

Save each one to:
```
.chapterflow/runs/<bookId>/<runId>/sidecars/source/ch<NN>.source.json
```

Where `<NN>` is zero-padded (`ch01`, `ch02`, … `ch24`).

JSON schema:

```ts
type ChapterResearchResult = {
  chapterNumber: number;
  chapterTitle: string;
  focus: string;                        // 1-2 sentences: what this chapter establishes
  coreClaim: string;                    // 1 sentence: chapter's central claim, your paraphrase
  centralConcept: {
    name: string;                       // short label, e.g. "compounding", "identity-based habits"
    plainDefinition: string;            // 1-2 sentences in plain words
    whyItMatters: string;               // 1-2 sentences: what changes for a reader who internalizes it
  };
  keyClaims: string[];                  // 4-8 supporting claims, each 1-2 sentences
  namedExamples: Array<{
    label: string;                      // brief identifier, e.g. "Dave Brailsford / British Cycling"
    summary: string;                    // 2-3 sentences paraphrasing the example
    teachesWhat: string;                // 1 sentence: what mental move this example illustrates
  }>;                                   // 3-6 examples that appear in THIS specific chapter (source-v2 gate blocks fewer than 3)
  hardEdge: string;                     // 2-3 sentences naming the typical mis-takeaway
  voiceCues: string[];                  // 2-4 observable moves visible in THIS chapter
  forbiddenLeakage?: string[];          // 0-3 concepts from LATER chapters that should NOT appear here
  paraphraseNotes: string;              // 200-400 words; the rich source the downstream writer reads
};
```

### v2 schema — REQUIRED for new books (`schemaVersion: "source-v2"`)

The fields above are the legacy (v1) shape. New research MUST emit the v2 shape — it
adds the spine that makes correct, non-templated authoring possible. `check-source`
(SC10) **enforces** these on any sidecar tagged `schemaVersion: "source-v2"` (and is
advisory on legacy v1). Additive over the schema above:

```ts
type SourceSidecarV2 = ChapterResearchResult & {
  schemaVersion: "source-v2";
  centralConcept: { id: string; name; plainDefinition; whyItMatters };  // id = "chNN.concept"
  namedExamples: Array<{ id: string; label; summary; teachesWhat;
    hardSpecifics: string[];   // 2-4 CONCRETE checkable tokens — a number, place, person, date
    realWorld: boolean;        // true = a real case; false = an author's named device
  }>;                          // ≥3 per chapter — the source-v2 gate hard-blocks fewer than 3 (aim 3-6)
  testableFacts: Array<{       // >= 9 (one per quiz question) — the correctness spine
    id: string;                // "chNN.fact.<k>"
    claim: string;             // one verifiably-true proposition — the keyed-answer seed
    becauseMechanism: string;  // one CAUSAL sentence (because/since/so that…) — the explanation seed
    commonError: string;       // a plausible WRONG belief a real reader holds — the distractor seed
    errorIsWhy: string;        // why the commonError is wrong
    derivedFrom?: string;      // optional anchor id this elaborates
    replicationStatus?: "robust" | "mixed" | "contested" | "failed";  // OPTIONAL — flag a claim with known replication trouble (see below)
  }>;
  frameworks?: Array<{ name: string; members: string[]; acronym?: boolean }>;  // every named N-part model
};
```

Why each exists (it pre-empts a downstream defect, so the writer can't template it):
- **`testableFacts[].claim` + `becauseMechanism`** — the quiz writer keys the answer to a
  `claim` and writes the explanation from its `becauseMechanism`, so a wrong key / echo
  explanation becomes structurally impossible (the causal link exists by construction).
- **`commonError` + `errorIsWhy`** — seed REAL distractors (a misbelief a reader holds), not
  strawmen or the answer-in-disguise.
- **`hardSpecifics`** — force a concrete noun into each scenario, so an example can't become
  "<Name> studies <concept-label>".
- **`frameworks`** — every named N-part model (e.g. BRAVING's 7), so completeness is checkable.

Rules: every `testableFacts[].commonError` must differ from its `claim` by MORE than a negation
(SC10 blocks a degenerate fact); every `becauseMechanism` must contain a causal connective; each
chapter needs **≥3 `namedExamples`** (the source-v2 gate hard-blocks fewer than 3; aim 3-6), of
which **≥2 are real-world named entities** in `namedExamples`/`hardSpecifics` (SC10 blocks "nothing
to check"). Generate stable ids as shown so STEP-2 can cite them as provenance.

**Evidence integrity — a testimonial is NOT a `testableFact`.** Many books carry anonymized reader
success stories ("Candace P.", "Brad", "John's Maui habit"). These are TESTIMONIALS — a person's
account of their own experience — not verifiable propositions. A `testableFact.claim` must be a
**checkable, source-grounded proposition** (a mechanism, a study finding, a datable event), never
"what a named reader reported." Do **not** log a first-name/initial-only testimonial as a
`testableFact`: downstream, `testableFacts` are the quiz-key correctness spine, and a quiz keyed to a
testimonial is a deterministic blocker (`EI2`). A reader anecdote may appear at most as an
ILLUSTRATION (`namedExamples`, `realWorld: false`) the writer dramatizes WITHOUT evidentiary framing;
it must never key an answer or stand in as the chapter's proof (`EI1`). Reserve `realWorld: true` for
a genuinely verifiable named entity (a real person/company/study with `hardSpecifics`).

**Replication standing — flag the contested science.** A claim can be perfectly faithful to the source
and still be disputed in its field. Popular non-fiction routinely states findings as settled law that
the literature treats as shaky (ego depletion / the glucose model of willpower, the marshmallow test's
predictive power, power posing, "you use 10% of your brain," priming effects). Because these are
faithful to the book, the downstream `factual_accuracy` read scores them clean — so the *source* is the
only place to catch them. When you log a `testableFact` whose claim has **known replication trouble**,
set `replicationStatus`:
- **`robust`** (or omit) — replicates reliably; the writer states it plainly.
- **`mixed`** — real support but notable failures to replicate; the writer must hedge ("the evidence here is mixed").
- **`contested`** — actively disputed; the writer must hedge or reframe it as a heuristic, never as flat law.
- **`failed`** — failed to replicate / largely retracted; flag it so the writer either drops it or frames it explicitly as a once-popular idea that did not hold up.

Only flag claims with *genuine, known* replication trouble — do not hedge solid science. STEP-2 `R9`
reads this field; a `contested`/`failed` claim written as settled fact is a `factual_accuracy` defect.

**Hard rules for chapter sources:**

1. **Paraphrase only, never verbatim.** Restate every claim in your own words. The pipeline checks for long quoted spans.

2. **No meta-references.** Never write `this chapter`, `the chapter`, `the author`, `the book`, `in this chapter`, `Chapter N`, or `Chapter [number-word]`. Write the claim directly: "Habits compound when…" not "The chapter argues that habits compound when…". The downstream gate fails closed on these.

3. **No author-surname-verb constructions.** Never `Clear argues` / `Kahneman says` / `Taleb claims` / `Greene observes` / `Pressfield notes`. State the claim directly without naming the author as an actor.

4. **No `Chapter N` references inside text.** Don't write "Chapter 1 argues that…". State the claim directly.

5. **Be specific.** Every claim should name a mechanism, a number, a place, a person, or a concrete behavior. Bad: "The chapter discusses motivation." Good: "Motivation depletes within 90 seconds of friction; making the action take less than 90 seconds bypasses the depletion entirely."

6. **Named examples must be real and chapter-specific.** If the chapter uses Dave Brailsford and British Cycling, name them. If you're uncertain whether an example appears in THIS specific chapter (vs. a different chapter of the same book), mark it speculative or omit it. False examples poison every downstream chapter.

7. **`hardEdge` names the typical misreading.** Every chapter has a surface mis-takeaway. For Atomic Habits Ch1, the mis-takeaway is "do tiny things and they will magically compound" (misses systems thinking). The real point is that systems control trajectory, and habits are the systems-level lever. Identify this explicitly so downstream quiz writers can craft distractors around it.

8. **`paraphraseNotes` is the rich source.** 200-400 words (roughly 1200-2400 chars). Tell what the chapter does, the order of its moves, the examples it uses, the conclusion it lands on. Make it dense and specific. NO marketing copy, NO jacket-blurb language, NO meta-references.

9. **`voiceCues` capture this specific chapter's moves.** Different chapters can use different moves. Look at this chapter: Does it open with a scene? With a definition? With a quote? Does it use "system" vs. "process"? Does it ask the reader rhetorical questions or instruct directly?

10. **`forbiddenLeakage` prevents inter-chapter contamination.** If Ch1 establishes compounding and Ch5 introduces the Four Laws, Ch1's research should mark "Four Laws" as forbidden. Without this, downstream agents conflate concepts that the author kept separate.

**Style examples:**

*Bad `focus`:* "This chapter is about how habits compound and the importance of systems."

*Good `focus`:* "Tiny improvements compound; results lag inputs by months or years, so systems govern trajectory more than ambition or willpower."

*Bad `paraphraseNotes`:* "In this chapter, James Clear talks about how small habits can add up over time. He uses the example of British Cycling and how they got better by improving 1% at a time. The main point is that small changes compound and that systems are more important than goals."

*Good `paraphraseNotes`:* "Tiny improvements compound the way money does — a one-percent daily gain doubles a baseline in roughly seventy days, but the curve looks flat for the first stretch. Dave Brailsford and British Cycling are the central anchor: every small element of the rider's environment (seat fabric, sleep, recovery temperature) tuned half a percent at a time, no single change visibly important, the aggregate dominating the world stage within five years. The hard edge is delayed visibility — the compound math works but the felt experience of doing small things while results are invisible is brutal. Systems-versus-goals is introduced here but the deeper machinery comes later: this stage establishes only that the lever is at the systems level, not at the goal level. Identity is mentioned in passing as 'who you become' but the full identity-based-habits frame is left for a later stage."

**After saving each chapter's `.json`, also produce the human-readable `.txt`:**

```bash
npx tsx -e "
import { renderChapterSidecar } from './scripts/book/prompts/chapterflow-v21-authored/src/agents/researcher-chapter.ts';
import { readFileSync, writeFileSync } from 'fs';
const p = '<full path to ch<NN>.source.json>';
writeFileSync(p.replace('.json','.txt'), renderChapterSidecar(JSON.parse(readFileSync(p,'utf8'))), 'utf8');
"
```

---

## Artifact C — Chapter index

After all chapter sources exist, write the chapter index. Save to:
```
scripts/book/prompts/chapterflow-v21-authored/state/indexes/<bookId>.json
```

Shape — JSON array, one entry per chapter:
```json
[
  { "chapterId": "<bookId>-ch01", "chapterNumber": 1, "chapterTitle": "<exact title>" },
  { "chapterId": "<bookId>-ch02", "chapterNumber": 2, "chapterTitle": "<exact title>" }
]
```

The `chapterId` is `<bookId>-ch<NN>` zero-padded. The `chapterTitle` is EXACT from your bibliography (do not reformat).

---

## Final validation

Run this command and confirm it passes:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts check-source <bookId>
```

If it fails with blockers, fix the offending chapter sources and re-run. Common findings:

| Code | What it means | How to fix |
|---|---|---|
| `SC1.chapter_count_mismatch` | Bibliography says N but you saved a different count | Add the missing chapter source or fix bibliography |
| `SC2.chapter_numbers_not_sequential` | Gap or duplicate in file numbers | Rename / renumber the offending file |
| `SC3.paraphrase_too_short` | `paraphraseNotes` under 600 chars | Expand to 1200-2400 chars with specific content |
| `SC4.meta_reference` | "this chapter / the author / Chapter N" leaked in | Rewrite to state the claim directly |
| `SC5.author_surname_verb` | "Pressfield argues" or similar | Rewrite without naming the author as actor |
| `SC6.long_quoted_span` | 40+ char quoted span found | Verify it's paraphrase, not verbatim citation |
| `SC7.no_named_examples` | A chapter has no named examples | Add at least 1 chapter-specific named example |
| `SC8.cross_chapter_paraphrase_duplicate` | Two chapters share 3+ 8-gram signatures | Rewrite one of them with different wording — you're self-templating |

---

## How to use the `next-task` helper

At any point you can run:
```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts next-task <bookId>
```

It tells you the next missing artifact, with the path. In this research stage, it will cycle through bibliography → per-chapter sources → chapter index. **Stop when next-task says "write-chapter".** That's the next stage and not your job in this conversation.

---

## When you're done

Stop and report to the user:

1. The `<bookId>` and `<runId>` you used.
2. The `check-source` PASS confirmation.
3. The chapter count and any uncertainty notes from the bibliography.
4. The path to the chapter index file.

Then wait. The user will hand the next agent the writing stage with that information.

---

## What you should NOT do in this conversation

- Do NOT produce any `state/chapters/<chapterId>.v21-native.chapter.json` files.
- Do NOT run `derive-artifacts`.
- Do NOT run `generate-book`.
- Do NOT invoke `claude -p`, the v21 `research` subprocess, or any external model.
- Do NOT write prose for any chapter's hook / breakdown / examples / quiz / cards / plan.

Stop after Step 1.

---

## TL;DR loop

```bash
cd /Users/radinsoltani/ChapterFlow-books
# Run this in a terminal at any time to see what's next:
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts next-task <bookId>
# Follow its instructions. When it says "write-chapter", stop and report to the user.
```
