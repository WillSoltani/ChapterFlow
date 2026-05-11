# v13 → v21 Migration: Codex/GPT Operator Prompt

For when the operator is GPT/Codex (not Claude Code). Uses your GPT Pro/Max subscription — no API key, no paid spend. The agent in this session *is* the writer: you produce each chapter's content via your own turn output, validate against the v21 ship gate, then save.

> If you're driving migrations from a Claude Code session, use [MIGRATION-OPERATOR-PROMPT.md](MIGRATION-OPERATOR-PROMPT.md) instead — that flow runs the deterministic pipeline via `claude` CLI subprocess.

Before pasting, replace `<BOOK_ID>` everywhere with the **kebab-case lowercase** bookId from the next `○ ready` row in [MIGRATION-ROSTER.md](MIGRATION-ROSTER.md). Examples: `getting-things-done`, `atomic-habits`, `the-power-of-habit`. **NEVER** use the v13 file's mixed-case form (`Getting-Things-Done`) — the publish step rejects non-kebab-case bookIds.

---

## Mission

Migrate `<BOOK_ID>` from v13 to v21. Quality target: **match the output we shipped for How to Win Friends and Influence People** ([book-packages/how-to-win-friends-and-influence-people.v21.json](book-packages/how-to-win-friends-and-influence-people.v21.json)). Browse a couple of HWF chapters before you start so you know the bar.

The v21 ship gate enforces structural rules (no em dashes, no meta-references, balanced quiz answer positions, named protagonists, etc.) AND a new C8 templating check that rejects Cartesian-product output. If your examples are 6 substitutions of one template, gate-chapter fails the chapter and you have to rewrite. Don't try to game it — write distinct scenes the first time.

## Setup

```bash
cd /Users/willsoltani/dev/chapterflow-siliconx
set -a; source .env.local; set +a
```

Don't set `CHAPTERFLOW_PROVIDER` — leave it unset. You're the writer, not the API.

## Required reading before you write anything

Open these files. Spend real time on them. Don't skim.

1. **[book-packages/how-to-win-friends-and-influence-people.v21.json](book-packages/how-to-win-friends-and-influence-people.v21.json)** — pick chapters 5, 11, and 15. Read the full scenario for every example. This is your quality bar.
2. **[FAILURE-MODES.md](FAILURE-MODES.md)** — every BLOCKER from this list is enforced by the ship gate. Internalize them.
3. **[src/types.ts](src/types.ts)** lines 305–360 — the `ChapterV21` TypeScript shape your output must match exactly.
4. **[prompts/writer-example.system.md](prompts/writer-example.system.md)** — the example writer prompt the deterministic pipeline uses. Follow it as if you were that writer.

## What "HWF-quality" actually means for examples

Read this twice. This is where most agents fail.

A v21 example is **not** "one paragraph about a person doing something." It's a **scene** — a specific moment with sensory detail, captured at the exact point a decision is being made. Look at this HWF Ch15 example:

> "It is 7:14 p.m. and Anika, a small-animal vet two years out of school, is sitting in her car in the clinic parking lot with her phone in her lap. She gave a beagle named Biscuit twice the prescribed dose of phenobarbital this afternoon. Biscuit is fine for now, but needs to be watched. She has rehearsed three sentences that make the error sound like a software glitch. The owner picks up on the second ring..."

Notice:
- Specific clock time (7:14 p.m., not "evening")
- Specific role (small-animal vet two years out of school, not "professional")
- Specific place (her car in the clinic parking lot, not "the office")
- Specific concrete object (phone in her lap, Biscuit the beagle, three rehearsed sentences)
- A decision happening **right now** in the present moment of the scene
- Sensory anchor (phone, lap, second ring)

Compare to a **bad** templated example we've shipped and now reject:

> "Bastien is an analyst in Tallinn at Monday morning, standing over a marked-up spreadsheet and a cold cup of coffee. Two options look similar until Bastien traces the unit cost curve..."

Notice: vague role ("analyst"), vague time ("Monday morning" — what time?), vague stake, no sensory detail, no specific objects beyond stock office props. It's a thesis dressed up with a name and a city. The C8 critic now rejects this pattern when 3+ examples share a 5-word phrase.

**Your job for every example: write a scene with the specificity of the Anika excerpt.** If you find yourself writing "X is a [role] in [city] at [time]" you've fallen back to the template trap — start over with a real moment.

## Hard rules — every chapter, no exceptions

1. **Write each example as a fresh, focused turn**. Do not use a helper script that loops through an array of names/cities/roles to emit all examples at once. The previous Codex agents that did this all produced template-locked output. Even if it's faster, don't.
2. **No Cartesian products**. No `for name in [...]: for city in [...]: writeExample(name, city)`. Each example must be conceived independently.
3. **6 examples per chapter, each in a different format** from {scene, vignette, dialogue, decision_point, predict_reveal, postmortem, before_after, reflection, thought_experiment}. Format repeats are OK up to 2; 3+ of the same format in one chapter is a fail.
4. **Specific time anchors**: every scenario opens with a clock time, a day-and-time, or an unmistakable temporal marker. "7:14 p.m." is good. "Monday morning" alone is not.
5. **Specific place anchors**: not "the office" — "the Glenmoor warehouse back room", "diesel pump 4 at the Pinedale truck stop", "her car in the clinic parking lot".
6. **Specific objects/sensory detail in the first 80 chars**: phone in her lap, mason jar on the dais, knife still in her hand. The reader needs to see something concrete immediately.
7. **No em dashes (`—`)** anywhere. Commas, periods, parens, colons only.
8. **No meta-references**: never "the chapter", "this chapter", "the author", "the book", "Chapter N".
9. **No v13-pool names**: Priya, Omar, Maya, Marcus, Elena, Lena, Victor, Theo, Jonah, Mateo, Tessa, Owen, Mira, Malik, Nadia, Felix, Caleb, Talia, Elise, Naomi.
10. **No protagonist name repeats across the book** — keep a running list in this conversation; check it before naming each new protagonist.
11. **No alphabet-cycling names** (Amara, Bastien, Cyra, Dario, Eulalie, Farid...). That's a script tell.
12. **Banned stock phrases** (FAILURE-MODES B4): no "boundary condition", "double down", "hold lightly", "stack the deck", "decision fatigue", "low-hanging fruit", "skin in the game", "lean in", "move the needle", "circle back".

## Step 1 — Read book metadata + chapter index

```bash
jq '.book | {bookId, title, author}' book-packages/<BOOK_ID>.modern.json
jq '.' scripts/book/prompts/chapterflow-v21-authored/state/indexes/<BOOK_ID>.json
```

Clean the title/author of stray curly quotes and dashes if present. The bookId you use throughout MUST be kebab-case lowercase — match the value from the roster, not the v13 filename casing.

## Step 2 — Establish voice + protagonist-name list

In this conversation (not a file), write:

- **Thesis**: 1 sentence on what the book argues.
- **Voice charter**: 2–3 sentences describing the prose voice. Short clipped vs. long lyric; concrete sensory vs. abstract; conversational vs. instructional. Pick one. Stick with it for every chapter.
- **Signature moves**: 3 voice patterns to keep using.
- **Protagonist name list**: empty to start. Add every name as you write it. No reuse across chapters.

## Step 3 — For each chapter, in order

### 3a. Plan the chapter's example slate FIRST

Before writing any prose, list the 6 example slots for this chapter. For each slot, write 3 lines in this conversation:

```
Slot 1
  format: scene
  protagonist: Tomek, a 53-year-old machinist on overnight shift
  requiredBeat: he catches a tool slipping in the chuck and decides whether to stop the lathe or finish the cut
  setting: 3:18 a.m. at the Pittsburgh fab shop's #6 lathe

Slot 2
  format: dialogue
  protagonist: Pemma, a fourth grader at her grandmother's kitchen table
  requiredBeat: she asks the grandmother whether the recipe needs salt; the grandmother answers by handing her the spoon
  setting: Sunday 10:42 a.m., flour on the counter

Slot 3
  format: postmortem
  protagonist: ...
```

**The 6 slots must use at least 4 different formats. The 6 protagonists must be unique to this chapter. The 6 settings must be in unrelated domains** (don't have 3 office-meeting scenes; mix work, home, hospital, classroom, kitchen, etc.).

If you find yourself wanting to share a phrase or template across slots, **stop and rewrite the slots so they're actually different**.

### 3b. Write each example, one turn at a time

For Slot 1: produce the full Example JSON (exampleId, title, tags, planSpec, scenario, whatToDo, whyItMatters) for that slot, and only that slot. Save it to memory (don't write a file yet).

Then Slot 2 as a separate output, and so on. Don't batch. Don't write a helper that emits all 6.

Each scenario must:
- Open with the named protagonist doing something concrete in the first 80 chars
- Include the specific clock time + place
- Include at least one sensory anchor (object, action, smell, sound)
- Reach a decision point or revelation moment
- Be 350–700 chars

The `title` must be a specific phrase about THIS scene, not a template. Compare:
- Good: "Saffi sets two heads of romaine on the table"
- Bad: "Saffi tests scale economies in Reno"

### 3c. Write the rest of the chapter

Once all 6 examples are drafted, write the remaining ChapterV21 fields:

- **hook** (60–120 chars): specific concrete image or one-line counterintuition. Not abstract.
- **counterintuition** (80–400 chars): what most readers assume + what's actually true.
- **tryThisNow** (80–220 chars): one specific 30–90s action, directive not question.
- **keyTakeaway** (140–220 chars): single sentence carrying the lesson.
- **breakdown.fastRead** (400–700 chars): scene + rule, 2-min read. Open in a moment.
- **breakdown.deepRead** (1200–1800 chars): mechanism + second scene + the move + a limit.
- **breakdown.fullRead** (2500–3500 chars): depth + third angle + counter-objection + tie back.
- **quiz**: 9 questions. Each is a NEW scenario (different from the chapter's examples). Application not recall. 3 choices each. Answer-index distribution: no single position >45% across the 9 questions. Mix Bloom's levels and depthLevel.
- **reviewCards**: 3–5 cards. Front is retrieval-framed (a situation + question). Back teaches a move. Difficulty mix.
- **implementationPlan**: 4 ifThen plans (work/health/personal/relationships), concrete triggers and responses. twentyFourHourChallenge (100+ chars, specific). weeklyPractice.
- **memorableLines**: exactly 3. Each `.text` is verbatim from your chapter prose. Each ≥30 chars. No em dashes.

### 3d. Assemble the full chapter JSON

Combine into one `ChapterV21` object matching the type at `src/types.ts:305–360`. The `chapterId` MUST be `<BOOK_ID>-ch<NN>` with `<NN>` zero-padded to 2 digits (e.g., `getting-things-done-ch01`).

### 3e. Save the chapter file

Write the JSON to:

```
scripts/book/prompts/chapterflow-v21-authored/state/chapters/<BOOK_ID>-ch<NN>.v21-native.chapter.json
```

### 3f. Validate against the ship gate

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts gate-chapter \
  scripts/book/prompts/chapterflow-v21-authored/state/chapters/<BOOK_ID>-ch<NN>.v21-native.chapter.json
```

If it prints `Ship gate: PASS`, move on. If it shows blockers, fix the chapter JSON, save again, re-run. The output lists each blocker with the catalog ID — common ones:

- **C8** (NEW): example templating detected. Multiple examples share a verbatim 5-word phrase. **You MUST rewrite the affected examples as distinct scenes. Don't just rename — restructure.** If C8 fires, your slate plan in Step 3a was templated; redo it.
- **C1/C2/C3**: missing named protagonist, missing scene specificity, missing decision point.
- **B1/B2/B5**: meta-reference / chapter literal / em dash. Find and remove.

Don't move to the next chapter until C8 (and everything else) passes.

### 3g. Ingest into the librarian ledger

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts ledger ingest \
  scripts/book/prompts/chapterflow-v21-authored/state/chapters/<BOOK_ID>-ch<NN>.v21-native.chapter.json \
  --book-id <BOOK_ID> --title "<title>" --author "<author>"
```

This adds your protagonist names to the cross-book ledger so future books don't reuse them.

## Step 4 — Book-level promotion

After every chapter is saved and ship-gate-passing:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts promote-book <BOOK_ID> \
  --title "<title>" --author "<author>"
```

Runs the ship gate again on every chapter (defense in depth), runs the book gate (cumulative answer-position balance, within-book name uniqueness, schema completeness, voice consistency), runs the categorizer, writes `book-packages/<BOOK_ID>.v21.json`.

If the book gate fails on F1 (within-book name dup), you reused a protagonist name across chapters. Fix it and re-run.

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

Aim for avg ≥95/100, range narrow. If a chapter is below 92, look at the listed gaps and decide whether to rewrite that chapter.

## Step 7 — Publish to production catalog

```bash
npx tsx scripts/book/publish-single-package.ts --file book-packages/<BOOK_ID>.v21.json
```

The publish script rejects non-kebab-case bookIds and mismatched filenames. If you see an error here, fix the bookId/filename and re-run.

## Step 8 — Wire into library metadata

Add an entry to `app/book/data/booksCatalog.metadata.json` modeled on the existing tiny-habits / how-to-win-friends-and-influence-people row. Pull categories/tags from the v21 package; compute `estimatedMinutes` as the sum of `readingTimeMinutes` across chapters. Pick an icon emoji that fits.

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
- Wall time (expect 4–6+ hours for a proper Codex run — if you finished in under an hour, you probably templated; check C8)
- Avg chapter score
- How many chapters needed C8 rewrites
- Categories assigned
- Catalog version
- Next pending bookId from the roster

## What to NEVER do

- Don't write a helper script that loops over an array to emit all examples. The C8 critic will catch the templating; don't waste cycles on it.
- Don't ship a chapter that didn't pass `gate-chapter`. Always validate first.
- Don't reuse a protagonist name across chapters of the same book.
- Don't use em dashes. Anywhere.
- Don't reference "the chapter", "the author", "the book", or any banned phrase.
- Don't use a mixed-case bookId. Always lowercase kebab-case.
- Don't finish a 25-chapter book in 15 minutes. That's templating speed. HWF took the deterministic pipeline ~4 hours. Your time should be similar or longer.
