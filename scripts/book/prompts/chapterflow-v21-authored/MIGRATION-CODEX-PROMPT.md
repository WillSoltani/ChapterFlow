# v13 → v21 Migration: Codex/GPT Operator Prompt

For when the operator is GPT/Codex (not Claude Code). Uses the GPT Max subscription — no API key, no paid spend. The agent in this session *is* the writer: it produces each chapter's content via its own turn output, validates against the v21 ship gate, then saves.

> If you're driving migrations from a Claude Code session instead, use [MIGRATION-OPERATOR-PROMPT.md](MIGRATION-OPERATOR-PROMPT.md) — that flow runs the deterministic pipeline via the `claude` CLI subprocess.

Before pasting, replace `<BOOK_ID>` everywhere with the kebab-case bookId from the next `○ ready` row in [MIGRATION-ROSTER.md](MIGRATION-ROSTER.md).

---

## Mission

Migrate `<BOOK_ID>` from v13 to v21 by hand-writing the chapter content yourself (you, the GPT agent in this session). Use the chapter index pre-staged at `scripts/book/prompts/chapterflow-v21-authored/state/indexes/<BOOK_ID>.json`. For each chapter, produce a complete `ChapterV21` JSON, validate it against the ship gate, save it. After all chapters, assemble the book package and ship it to production.

You are the model. Don't try to run `generate-book` — that subprocess uses `claude` CLI which is the Claude Max sub. We're using your GPT Max sub here instead, which means the writing happens in your turn output.

## Setup

```bash
cd /Users/willsoltani/dev/chapterflow-siliconx
set -a; source .env.local; set +a
```

Loads AWS credentials and bucket names from `.env.local` so the publish step works later. No API keys for model access — you ARE the model.

## Read these once before writing anything

In order of importance:

1. **[FAILURE-MODES.md](FAILURE-MODES.md)** — the canonical list of every v13 failure the v21 gate enforces. Every rule here is a BLOCKER you must follow.
2. **[src/types.ts](src/types.ts)** lines 305–360 — the `ChapterV21` TypeScript shape your output must match exactly.
3. **[prompts/writer-breakdown.system.md](prompts/writer-breakdown.system.md)** — how to write the three reading tiers.
4. **[prompts/writer-example.system.md](prompts/writer-example.system.md)** — how to write a scene-based example.
5. **[prompts/writer-quiz.system.md](prompts/writer-quiz.system.md)** — quiz rules (application not recall, balanced answer positions, valid Bloom's levels).
6. **[prompts/writer-cards.system.md](prompts/writer-cards.system.md)** — retrieval card framing.
7. **[prompts/writer-hook.system.md](prompts/writer-hook.system.md)** — hook constraints.

Internalize the rules. The ship gate enforces every one. You'll know if you got it wrong because `gate-chapter` will fail your output.

## Step 1 — Read book metadata + chapter index

```bash
jq '.book | {bookId, title, author}' book-packages/<BOOK_ID>.modern.json
jq '.' scripts/book/prompts/chapterflow-v21-authored/state/indexes/<BOOK_ID>.json
```

Clean the title/author of stray curly quotes and dashes if present (some v13 books have `"Smarter-Faster-Better"` baked in).

## Step 2 — Establish the book brief (in your own context)

You won't write a JSON brief; just decide and write down (in this conversation, not a file) the following so you stay consistent across all chapters of this book:

- **Thesis** — 1 sentence summarizing what the book argues.
- **Voice charter** — 2–3 sentences describing the prose voice you'll write. Be specific: short clipped sentences vs. long lyric sentences; concrete sensory detail vs. abstract; conversational vs. instructional. Pick one. Stick with it for every chapter.
- **Signature moves** — 3 voice patterns to keep using (e.g., "open every breakdown with a concrete scene", "end every section with a one-line landing").
- **Avoid moves** — 3 patterns to reject. **DO NOT** echo "the chapter", "this chapter", "the author", "the book", or any banned phrase from FAILURE-MODES. Describe what to avoid structurally.
- **Protagonist name list** — keep a running list of named characters you've used so far. No name appears twice across the same book (block F1).

## Step 3 — For each chapter, in order

For chapter N (N starts at 1), do the following:

### 3a. Decide the chapter's core move

In one sentence, what's the single mental move the reader should walk away able to do? Write it in this conversation; keep it short. Every part of the chapter teaches this one move.

### 3b. Write the chapter content

Produce a single JSON object matching the `ChapterV21` shape. Required fields and constraints:

```jsonc
{
  "chapterId": "<BOOK_ID>-ch<NN>",  // zero-padded to 2 digits, e.g. ch01
  "number": <N>,                     // 1..total
  "title": "<chapter title from the index>",
  "readingTimeMinutes": 8,           // realistic estimate, integer

  // 60–120 chars. Specific image or one-line counterintuition. Not abstract.
  "hook": "...",

  // 1–2 sentences. What people assume that's wrong about this idea.
  "counterintuition": "...",

  // 80–220 chars, directive (not a question). One specific 30–90s action the
  // reader can do right now. Renders as a mid-chapter callout.
  "tryThisNow": "...",

  // 140–220 chars. Single sentence carrying the whole lesson.
  "keyTakeaway": "...",

  "breakdown": {
    // 400–700 chars. Scene + rule, 2-min read. Open in a moment. No abstraction.
    "fastRead": "...",
    // 1200–1800 chars. Mechanism + second scene + the move + a limit.
    "deepRead": "...",
    // 2500–3500 chars. Depth + third angle + counter-objection + tie back.
    "fullRead": "..."
  },

  "examples": [
    // 5–7 entries. Each named protagonist, specific time/place anchor,
    // decision point, mixed formats across the slate. No protagonist name
    // appears twice in the same book.
    {
      "exampleId": "ch<NN>-ex01-<protagonist-slug>",
      "title": "...",
      "tags": ["scene", "..."],
      "planSpec": {
        "domain": "...",
        "audience": "...",
        "stakes": "...",
        "format": "scene",   // or vignette, dialogue, decision_point, predict_reveal, postmortem, before_after, reflection, thought_experiment
        "requiredBeat": "..."
      },
      "scenario": "...",    // 200–700 chars. Opens with the named protagonist in a specific moment.
      "whatToDo": "...",    // 60+ chars. Imperative move the reader takes from this scene.
      "whyItMatters": "..." // 60+ chars. Mechanism: why the move works.
    }
  ],

  "quiz": {
    "passingScorePercent": 70,
    "questions": [
      // 9 questions. Application not recall. No "What does the chapter say...".
      // Each question has 3 choices. Correct-index distribution across the
      // 9 questions: no single position >45%. Aim for ~3/3/3.
      // Bloom's levels: mix across understand/apply/analyze/evaluate.
      // depthLevel: mix across simple/standard/deep.
      {
        "questionId": "q01",
        "prompt": "...",  // 150+ chars — scenario-based, not recall.
        "choices": ["...", "...", "..."],
        "correctIndex": 0,
        "explanation": "...",
        "bloomsLevel": "apply",
        "depthLevel": "standard"
      }
    ]
  },

  "reviewCards": [
    // 3–5 cards. Front is retrieval-framed (ends with a question or scenario).
    // Back teaches the move. Difficulty mix across easy/medium/hard.
    {
      "cardId": "rc01",
      "front": "...",        // 30–200 chars
      "back": "...",         // 80–400 chars
      "difficulty": "easy"
    }
  ],

  "implementationPlan": {
    "coreSkill": "...",
    "ifThenPlans": [
      // 4 entries. Each: concrete trigger ("If <specific moment>") +
      // concrete response ("then <specific action>"). Avoid generic advice.
      { "context": "work",         "plan": "..." },
      { "context": "health",       "plan": "..." },
      { "context": "personal",     "plan": "..." },
      { "context": "relationships","plan": "..." }
    ],
    "twentyFourHourChallenge": "...",  // 100+ chars, specific
    "weeklyPractice": "..."             // structured weekly cadence
  },

  "memorableLines": [
    // Exactly 3. Each .text is a verbatim sentence from the chapter content.
    // Each ≥30 chars. No em dashes.
    {
      "text": "...",
      "location": "breakdown.deepRead",  // or hook, examples[N].scenario, etc.
      "why": "..."
    }
  ]
}
```

### 3c. Hard rules — every chapter, no exceptions

- **Zero em dashes (`—`)**. Use periods, commas, parentheses, or colons.
- **Zero meta-references**. Never write "the chapter", "this chapter", "the author", "the book", "Chapter N" anywhere in the chapter prose. Write to the reader directly.
- **Zero v13-pool names**: don't use Priya, Omar, Maya, Marcus, Elena, Lena, Victor, Theo, Jonah, Mateo, Tessa, Owen, Mira, Malik, Nadia, Felix, Caleb, Talia, Elise, Naomi as protagonist names. Choose fresh names.
- **Zero banned stock phrases** (FAILURE-MODES B4): no "boundary condition", "double down", "hold lightly", "stack the deck", "decision fatigue", "low-hanging fruit", "skin in the game", "lean in", "move the needle", "circle back".
- **Cross-chapter name discipline**: keep your running protagonist-name list updated; never reuse a name as a recurring character in a later chapter.
- **Voice consistency**: every chapter's prose voice should match the voice charter you established in Step 2. Don't drift.

### 3d. Save the chapter

```bash
# Save the JSON you just wrote to:
scripts/book/prompts/chapterflow-v21-authored/state/chapters/<BOOK_ID>-ch<NN>.v21-native.chapter.json
```

Make sure it's valid JSON (no trailing commas, escaped strings).

### 3e. Validate against the ship gate

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts gate-chapter \
  scripts/book/prompts/chapterflow-v21-authored/state/chapters/<BOOK_ID>-ch<NN>.v21-native.chapter.json
```

If it prints `Ship gate: PASS`, move to the next chapter. If you see `blockers: N` with N > 0, the output lists each blocker with the catalog ID (B1, C1, etc.) and the offending text. Fix the chapter JSON, save again, re-run. **Don't move on until the ship gate passes.**

### 3f. Ingest into the librarian ledger

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts ledger ingest \
  scripts/book/prompts/chapterflow-v21-authored/state/chapters/<BOOK_ID>-ch<NN>.v21-native.chapter.json \
  --book-id <BOOK_ID> --title "<title>" --author "<author>"
```

This adds the protagonist names from this chapter to the cross-book ledger so future books don't reuse them.

## Step 4 — Assemble the book package

After every chapter is saved and ship-gate-passing, run the book-level gate via the existing promote command:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts promote-book <BOOK_ID> \
  --title "<title>" --author "<author>"
```

This:
1. Loads every `state/chapters/<BOOK_ID>-chNN.v21-native.chapter.json` file
2. Re-runs the ship gate on each (defense in depth)
3. Runs the book gate (cumulative answer-position balance, within-book name uniqueness, schema completeness, voice consistency)
4. Runs the categorizer (uses `claude` CLI under the hood — that's fine; categories are book-level metadata, one cheap call)
5. Writes `book-packages/<BOOK_ID>.v21.json` if everything passes

If the book gate fails, it'll tell you which check failed. Fix the offending chapter, re-save, re-run `promote-book`.

## Step 5 — Validate the package

```bash
node scripts/book/validate-book.mjs book-packages/<BOOK_ID>.v21.json
```

Must print `RESULT: PASS`.

## Step 6 — Score the chapters

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/score-chapters.ts \
  book-packages/<BOOK_ID>.v21.json
```

Aim for avg ≥95/100. If you're below 90 on any chapter, look at the listed gaps and decide whether to rewrite that chapter.

## Step 7 — Publish to production catalog

```bash
npx tsx scripts/book/publish-single-package.ts --file book-packages/<BOOK_ID>.v21.json
```

Should print `✓ Published <BOOK_ID> v<N>`.

## Step 8 — Wire into library metadata

Add an entry to `app/book/data/booksCatalog.metadata.json` modeled on the existing tiny-habits or how-to-win-friends-and-influence-people row. Pull the categories/tags from the v21 package, compute `estimatedMinutes` as the sum of `readingTimeMinutes` across chapters.

## Step 9 — Wire into bookPackages.ts (localhost reader)

Edit `app/book/data/bookPackages.ts` and mirror the existing v21 book pattern at all 7 sites: import, normalize constant, raw-chapters export, tone-getter function, registry array entry, tone-getter map entry, presentation entry.

## Step 10 — Rebuild search index

```bash
npx tsx scripts/book/rebuild-search-index.ts
```

## Step 11 — Mark this book done

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/extract-all-chapter-indexes.ts
```

Flips this book's roster row from `○ ready` to `✓ shipped`.

## Step 12 — Report back

Tell the user:
- `<BOOK_ID>` migrated end-to-end
- Wall time (Codex sessions are slower than the deterministic pipeline; expect 3–6 hours for a 12-chapter book at a deliberate pace)
- Avg chapter score
- Categories assigned
- Catalog version
- Any chapters that needed re-writing after ship gate failure, and why
- Next pending bookId from the roster

## What to NEVER do

- Don't try to run `generate-book` — that uses the `claude` CLI subprocess. We're using your GPT context to write directly.
- Don't ship a chapter that didn't pass `gate-chapter`. Always validate first.
- Don't reuse a protagonist name across chapters of the same book.
- Don't use em dashes. Anywhere.
- Don't reference "the chapter", "the author", "the book", or any banned phrase.
- Don't skip the ledger ingest in step 3f — without it, cross-book name discipline breaks for future migrations.
