# ChapterFlow v10 — Setup Prompt

> **Usage:** Paste this prompt into Claude Code. Replace the two fields below with your book info. Claude will handle everything else.

```
BOOK_TITLE = The Art of War
BOOK_AUTHOR = Sun Tzu
```

---

You are preparing a ChapterFlow v10 book generation run. Your job is to bootstrap the run, research the book entirely from the web, gather comprehensive source material, and configure the manifest. After you finish, the user will start a separate orchestration session.

## Instructions

### 1. Derive identifiers

From the BOOK_TITLE and BOOK_AUTHOR above, derive:
- `bookId`: kebab-case of the title (e.g. "The Art of War" → "the-art-of-war")
- `runId`: today's date as YYYYMMDD plus "-01" (e.g. "20260405-01")
- `PACK_ROOT`: `scripts/book/prompts/chapterflow-v10-ultimate`
- `RUN_ROOT`: `.chapterflow/runs/{bookId}/{runId}`
- `SOURCES`: `.chapterflow/sources/{bookId}`

### 2. Bootstrap the run

```bash
bash scripts/book/prompts/chapterflow-v10-ultimate/bootstrap.sh \
  scripts/book/prompts/chapterflow-v10-ultimate \
  {bookId} \
  {runId}
```

Create the sources directory:
```bash
mkdir -p .chapterflow/sources/{bookId}
```

### 3. Research the book from the web

You must research the book thoroughly using web search and web fetch. Gather real, substantive information — not placeholders. Everything below must come from actual web research.

**Research tasks (do these in parallel where possible):**

a) **Determine the book's structure.** Find the complete table of contents — every chapter/section title and the number of chapters. This is critical; the entire pipeline depends on accurate chapter structure.

b) **Determine copyright status.** Search for whether the book and its primary English translation are in the public domain. If public domain, find the full text online (Project Gutenberg, Wikisource, etc.). If not public domain, note that only paraphrased content and fair-use quotes are available.

c) **Research the author.** Biography, historical context, why they wrote the book, their credentials/authority on the subject.

d) **Research the book's core ideas.** For each chapter: the central claim, key concepts, notable examples/stories/evidence, famous quotes. Use multiple sources — Wikipedia, book summary sites, academic references, reviews.

e) **Research modern applications.** How the book's ideas have been applied in business, education, personal development, sports, negotiation, leadership, etc. Find concrete real-world examples.

f) **Research counterarguments and criticism.** Where the book's ideas fail, overreach, or have been challenged.

### 4. Create source files

Write all source files to `.chapterflow/sources/{bookId}/`:

#### `full-text.txt` (if public domain)
If the book is public domain, fetch the complete text from the web and save it. If not public domain, skip this file and note the limitation in the manifest.

#### `chapter-map.md`
For every chapter in the book:

```markdown
## Chapter N: [Title]
- **Core subject**: [1-2 sentences]
- **Key concepts**: [bulleted list of principles/ideas introduced]
- **Notable examples/evidence**: [stories, studies, cases the author uses]
- **Source richness**: rich / limited
- **Concept density**: low / medium / high
- **Key quotes**: [2-4 important lines from this chapter]
```

#### `historical-context.md`
- Author biography and credentials
- Historical/cultural context of the book
- Why and when the book was written
- Publication history, editions, translations
- The book's influence and legacy
- Any authorship debates or controversies

#### `modern-applications.md`
For each chapter, provide 1-2 modern application examples across three categories. The ChapterFlow brief template requires scenarios mapped to work, school, and personal contexts:

- **Work**: corporate strategy, leadership, management, negotiation, startups, sales
- **School**: study strategy, debate, group projects, academic competition, exam prep
- **Personal**: relationships, conflict resolution, finance, health discipline, career planning, decision-making

#### `key-quotes.md`
For each chapter, 3-5 of the most important quotes. For each quote:
- The quote text
- Chapter number
- Why it's load-bearing (captures the chapter's core mechanism, not just famous-sounding)

If the book is under copyright, note which quotes are direct vs. paraphrased.

#### `criticism-and-limits.md`
- Common misreadings of the book
- Where the book's ideas fail or overreach
- Academic criticism
- Counterarguments from competing frameworks
- Moral complexity or ethical concerns

### 5. Configure the run manifest

Update `.chapterflow/runs/{bookId}/{runId}/manifests/run-manifest.json`:

```json
{
  "bookId": "{bookId}",
  "runId": "{runId}",
  "title": "{BOOK_TITLE}",
  "author": "{BOOK_AUTHOR}",
  "packRoot": "scripts/book/prompts/chapterflow-v10-ultimate",
  "runRoot": ".chapterflow/runs/{bookId}/{runId}",
  "outputProfile": "flagship_v4_compatible",
  "learningContract": "research_native",
  "runProfile": "apex_flagship",
  "validationMode": "chapter_gate",
  "chapterGateQuizMode": "generate",
  "scenarioTonePolicy": "required",
  "rightsMode": "startup_light",
  "chapterCount": {N},
  "publicDomain": {true/false},
  "notes": "{any relevant notes about source availability, translation used, quote clearance}"
}
```

### 6. Verify setup

Run these checks and report results:

1. Confirm `.chapterflow/runs/{bookId}/{runId}/` has all subdirectories (manifests, memory/role-cards, skeleton, briefs, outlines, quiz-blueprints, drafts/canonical, drafts/edited, structured, quizzes, validated, continuity, reports, sidecars, release)
2. Confirm `run-manifest.json` is valid JSON
3. Print word counts for every source file — each must be substantive (chapter-map should be the longest)
4. Confirm the chapter count in the manifest matches the chapter-map

**Report format at the end:**
```
Setup complete for: {BOOK_TITLE} by {BOOK_AUTHOR}
Book ID: {bookId}
Run ID: {runId}
Chapters: {N}
Public domain: {yes/no}
Source files:
  - full-text.txt: {word count} words (or SKIPPED — not public domain)
  - chapter-map.md: {word count} words
  - historical-context.md: {word count} words
  - modern-applications.md: {word count} words
  - key-quotes.md: {word count} words
  - criticism-and-limits.md: {word count} words

Next step: Start a new Claude session and paste prompt-starter.txt + MasterGenerator-v10.md
```

---

## Important Rules

- **Do not skip web research.** Every source file must contain real researched content. The orchestration session's quality depends entirely on source richness.
- **Do not start the orchestration.** Your job ends after setup. The user handles the generation session separately.
- **Be thorough on the chapter map.** This is the most critical file — it drives every brief the orchestrator writes. Each chapter entry must have real concepts and quotes, not generic summaries.
- **Research from multiple sources.** Don't rely on a single website. Cross-reference Wikipedia, book summary sites, academic sources, reviews, and the original text if available.
- **Handle copyright correctly.** Public domain = fetch full text + use direct quotes freely. Under copyright = no full text + mark quotes as paraphrased unless clearly fair use.
