# AGENT BRIEFING — ChapterFlow v21 Inline-Operator Mode

You are a writer agent on the ChapterFlow v21 pipeline. The user has assigned you one book to produce end-to-end. You work **inline**: every model call replaced by you producing the output directly from your own context. No `claude -p` subprocess, no API key calls, no external researcher — just you, the deterministic critics, and the on-disk state.

When you are done, the book exists at `book-packages/<bookId>.v21.json` and has passed every quality gate.

---

## Inputs the user gave you

You should have:
- **Book title** (verbatim)
- **Author** (verbatim)
- (Optional) **bookId slug** — if missing, derive: lowercase the title, strip punctuation, replace spaces with dashes. Example: "Thinking, Fast and Slow" → `thinking-fast-and-slow`.
- (Optional) **Categories + tags** for the final package — if missing, ask the user before finalization.

If anything is ambiguous (chapter count, which edition), ask the user before producing the bibliography. Do not invent.

---

## Working directory

```
/Users/willsoltani/dev/chapterflow-siliconx
```

All paths in this briefing are relative to that repo root. Use `cd` to that directory at the start of your session.

---

## The one command that drives everything

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts next-task <bookId>
```

It prints the **next artifact to produce**, the **path to save to**, the **playbook to read**, and the **validation command to run** after saving. Loop:

1. Run `next-task <bookId>`.
2. Read the printed playbook.
3. Produce the artifact (use the `Write` tool, or whatever your file-writing tool is).
4. Run the printed validation command (use `Bash` or equivalent).
5. If the validator blocks, edit the file and re-run the validator until it passes.
6. Re-run `next-task` to advance.
7. Stop when next-task prints `=== ALL DONE ===`.

That is the entire workflow. Everything below is reference for **what each artifact should look like**.

---

## Artifacts you'll produce, in order

### 1. Bibliography (`source-freeze/toc.json`)

Read [prompts/researcher-bibliography.system.md](prompts/researcher-bibliography.system.md) for the schema. Produce one `BibliographyResult` JSON object with:
- Canonical `title`, `author`, `bookId` slug
- `edition.chapterCount` (be accurate; if unsure, set `confidence: "low"` and explain in `notes`)
- Either `sections` (with parts) or `flatChapters` (no parts) — never both
- `thesis` (1-2 sentences, your paraphrase, not jacket copy)
- `teachingArc` (2-3 sentences naming what each section does)
- `authorVoice` (register + 3-5 signatureMoves + 2-4 avoidMoves)
- `confidence`: high/medium/low (be honest)

Save to the path next-task prints. Then run:
```bash
# (next-task will print this command after you save the toc)
```

### 2. Chapter sources (`sidecars/source/chNN.source.json` + `.txt`)

For each chapter, read [prompts/researcher-chapter.system.md](prompts/researcher-chapter.system.md) for the schema. Produce one `ChapterResearchResult` JSON object per chapter. Critical fields:

- `paraphraseNotes` — 600-3000 chars (target 1200-2400). This is THE source the downstream chapter writer reads. Specificity here directly determines book quality.
- `namedExamples` — 1-5 real examples FROM THIS SPECIFIC CHAPTER (not invented, not from a different chapter).
- `hardEdge` — 80+ chars naming the typical mis-takeaway. ("A careless reader walks away with X, but the actual claim is Y.")
- `keyClaims` — 4-8 supporting claims, each a single proposition.
- `voiceCues` — 2-4 observable moves in THIS chapter (not aspirational).
- No `this chapter` / `the author` / `Chapter N` / author-surname-verb constructions.
- No verbatim text from the book — paraphrase only.

After writing the `.json`, generate the `.txt` from it:
```bash
npx tsx -e "
import { renderChapterSidecar } from './scripts/book/prompts/chapterflow-v21-authored/src/agents/researcher-chapter.ts';
import { readFileSync, writeFileSync } from 'fs';
const p = '<path-to-json>';
writeFileSync(p.replace('.json','.txt'), renderChapterSidecar(JSON.parse(readFileSync(p,'utf8'))), 'utf8');
"
```

After all chapters' sources exist, run:
```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts check-source <bookId>
```

Fix any blockers it reports before continuing.

### 3. Chapter index (`state/indexes/<bookId>.json`)

A JSON array, one entry per chapter:
```json
[
  { "chapterId": "<bookId>-ch01", "chapterNumber": 1, "chapterTitle": "<exact title from bibliography>" },
  { "chapterId": "<bookId>-ch02", "chapterNumber": 2, "chapterTitle": "..." }
]
```

Zero-pad the chapter number in `chapterId`. Use the EXACT chapter titles from the bibliography.

### 4. Chapter outputs (`state/chapters/<chapterId>.v21-native.chapter.json`)

The big one. For each chapter, read [prompts/PLAYBOOK-OPERATOR-CHAPTER.md](prompts/PLAYBOOK-OPERATOR-CHAPTER.md). The playbook walks 12 sub-steps:

1. `hook` (60-120 chars; varied opener; no meta-refs)
2. `counterintuition` (1-2 sentences; varied shape across chapters)
3. `tryThisNow` (80-220 chars; directive, not question)
4. `keyTakeaway` (140-220 chars; ≤30 words)
5. `breakdown.fastRead` / `deepRead` / `fullRead` (3 tiers, length floors 350/1000/2400 chars; readability constraints; tier progression; cross-tier 4-word phrases banned)
6. `examples` (3-9 per chapter; each has named protagonist, specific scene, decision-point cue, scenario-anchored content; no template across examples)
7. `quiz` (6-12 questions; **read this section twice** — most defects emerge here):
   - Application questions, not recall
   - Distractors mirror real mistakes; no absolute words (`always`, `never`, `forever`, `automatically`, `impossible`, `entirely`, `ever`, `completely`)
   - Correct/avg-distractor word-count ratio < 1.4
   - Correct-index distribution balanced (never >50% in any position)
   - No banned tail clauses (see [config/banned-phrases.json](config/banned-phrases.json) hardBanned)
   - No 5+ word phrase repeated across this chapter's distractors AND any prior chapter's distractors
   - No `whyItMatters` field (validator returns 422)
   - All choices capitalized; no duplicate choices in a question
   - Max 5/9 prompts opening "A "/"An "
8. `reviewCards` (5-9 cards)
9. `implementationPlan` (title + coreSkill + 3-5 ifThenPlans + 24hr challenge + weekly practice)
10. `memorableLines` (exactly 3; **each text MUST appear verbatim in the breakdown**; the ship gate enforces this)
11. Assemble into one JSON object
12. Run the ship gate:
    ```bash
    npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts gate-chapter <path-to-chapter-json>
    ```

If the gate blocks (it usually will on first attempt), fix the offending fields and re-run. Common blockers:
- `B1` meta-reference → strip "the book / the chapter / the author"
- `B5` em dash → replace `—` with `,` / `.` / `:`
- `A15` tier too short → expand
- `A11` memorable line not in breakdown → repoint or restore
- `C1`-`C3` examples lack name / scene / decision → add
- `BP15` strawman → replace absolute word with scenario-anchored qualifier
- `BP16` length ratio → shorten correct or expand distractors with specific content
- `BP19` banned tail → rewrite distractor with prompt-specific language
- `A4` answer-position skew → swap choices in some questions to balance

Iterate until PASS. Then re-run next-task for the next chapter.

### 5. Derive artifacts (BP7 prerequisites)

After every chapter's ChapterV21 JSON exists, next-task will print:
```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts derive-artifacts <bookId>
```

Just run it. It auto-generates the `<bookId>.manual-brief.json` + `<chapterId>.manual-plan.json` stubs that the book-pattern audit requires.

### 6. Finalize

Next-task will print the finalize command:
```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts generate-book <bookId> \
  --title "<title>" --author "<author>" \
  --no-categorizer \
  --categories "<2-4 comma-separated>" \
  --tags "<4-8 comma-separated>"
```

Pick categories from [config/categories.json](config/categories.json) (2-4 of them). Pick 4-8 tags freely. If the book gate blocks, the report names which chapter / which check failed. Fix and re-run.

If the book gate passes, the package is at `book-packages/<bookId>.v21.json`. Run next-task one more time to confirm "ALL DONE".

---

## Hard rules across every artifact

1. **No external model calls.** Do not invoke `claude -p`, do not use the OpenAI API, do not run the v21 `research` / `generate` subprocess CLI. Everything happens in your conversation.
2. **No verbatim book text.** Paraphrase only. The pipeline checks for long quoted spans.
3. **No banned phrases.** The list lives in [config/banned-phrases.json](config/banned-phrases.json) — the writer-quiz.system.md prompt repeats the most critical entries. The ship gate fails closed on every occurrence.
4. **No em dashes (`—`).** Anywhere. Use commas, periods, parens, semicolons.
5. **No meta-references.** Never "this chapter", "the chapter", "the author", "the book", "Chapter N", or author-surname-verb constructions ("Clear argues", "Kahneman says").
6. **No `whyItMatters` on quiz questions.** Validator returns 422 on any field outside the allowed quiz-question schema.
7. **Unique protagonist names per chapter.** No name from the banned pool: `Priya, Omar, Maya, Marcus, Elena, Lena, Victor, Theo, Jonah, Mateo, Tessa, Owen, Mira, Malik, Nadia, Felix, Caleb, Talia, Elise, Naomi`. No name reused across chapters of this book.
8. **Vary openers across chapters.** Hook first-words: no single word should be the opener of >50% of chapters. Counter shapes: no single shape >40% of chapters.
9. **When uncertain, ask the user.** Better to clarify than to ship a wrong chapter count or wrong edition.
10. **When blocked, iterate.** The ship gate is your QC partner. If it fires, fix the field it names and re-run. Do not bypass.

---

## When to stop and report back

- **Bibliography confidence is "low".** Surface the chapter count uncertainty; ask the user to verify before producing per-chapter sources.
- **The ship gate fires the same blocker after 3 iterations.** Probably a structural issue — surface the finding and ask the user how to proceed.
- **The book gate fires a cross-chapter blocker (BP-codes).** Likely template substitution or duplicate names — pause and report; fixing usually requires revising multiple chapters.
- **You're not sure a named example actually appears in the chapter.** Flag it; do not invent.
- **The book is `ALL DONE`.** Report the package path and the summary numbers (chapters, examples, quiz questions total).

When stopping, write a one-paragraph status with: bookId, what stage you're at, what artifact is open, what blocker (if any). The user passes this to QC if they want a review.

---

## What the user is doing while you work

The user is the orchestrator. They may be running you in parallel with other agents on other books. They are NOT writing prose; you are. They will:
- Pick the book and pass it to you.
- Answer when you ask clarifying questions.
- Bring your output to a separate QC agent for review if needed.
- Run `next-task` themselves to check progress.

Do not wait for permission between steps unless the briefing says to stop. Run next-task → produce → validate → repeat until done.

---

## File map (so you don't have to hunt)

| What | Path |
|---|---|
| This briefing | `scripts/book/prompts/chapterflow-v21-authored/AGENT-BRIEFING.md` |
| Bibliography schema | `scripts/book/prompts/chapterflow-v21-authored/prompts/researcher-bibliography.system.md` |
| Chapter source schema | `scripts/book/prompts/chapterflow-v21-authored/prompts/researcher-chapter.system.md` |
| Chapter writer playbook | `scripts/book/prompts/chapterflow-v21-authored/prompts/PLAYBOOK-OPERATOR-CHAPTER.md` |
| Finalize playbook | `scripts/book/prompts/chapterflow-v21-authored/prompts/PLAYBOOK-OPERATOR-FINALIZE.md` |
| ChapterV21 type | `scripts/book/prompts/chapterflow-v21-authored/src/types.ts` (line 364) |
| Banned phrases | `scripts/book/prompts/chapterflow-v21-authored/config/banned-phrases.json` |
| Categories | `scripts/book/prompts/chapterflow-v21-authored/config/categories.json` |
| Failure-mode catalog | `scripts/book/prompts/chapterflow-v21-authored/FAILURE-MODES.md` |
| CLI | `scripts/book/prompts/chapterflow-v21-authored/src/cli.ts` |

---

## TL;DR

```bash
cd /Users/willsoltani/dev/chapterflow-siliconx
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts next-task <bookId>
# read what it says, produce that artifact, save to that path,
# run the validation command, fix any blockers, re-run next-task.
# loop until ALL DONE.
```
