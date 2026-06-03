# v21 Prose Polish Pass

Paste this entire document into a fresh Claude Code or GPT/Codex session. The agent reads every shipped v21 book in `book-packages/`, finds chapters with wordy or aphoristic prose, rewrites only the problem passages, re-validates, and re-publishes. Doesn't change meaning. Doesn't touch examples, quiz, cards, plan. Free of API spend (uses the session's own model under your Max subscription).

---

## Mission

The user's reader feedback on v21 books: *"kinda wordy and not as easy to understand"*. The pipeline added two new gates (E1 tighter FK ceilings, E4 aphoristic-opener detection) and a stronger plain-language writer prompt, but those only affect FUTURE generation. The 13 books already shipped to production as v21 still carry the wordy prose. This pass fixes them in place.

> **SCOPE — v21 only, never touch v13.**
>
> This pass operates exclusively on the new v21 schema books:
> - Files: `book-packages/<bookId>.v21.json` (the `.v21.json` extension is mandatory)
> - Chapter sidecars: `scripts/book/prompts/chapterflow-v21-authored/state/chapters/<bookId>-chNN.v21-native.chapter.json`
> - Production catalog entries that have a v21-shaped manifest
>
> **Do NOT touch the legacy v13 packages.** Those live at `book-packages/<bookId>.modern.json` and `book-packages/_legacy/*.modern.json`. They have a completely different schema (tone matrix, `chapterBreakdown` as `{gentle/direct/competitive}` objects, etc.) and editing them would corrupt them. The v13 corpus is read-only for this pass — the chapter index extractor and v13 normalize scripts reference them, but you don't.
>
> Every file path in this prompt references `.v21.json` or the v21-native chapter sidecars. If you find yourself opening anything in `book-packages/_legacy/` or anything ending in `.modern.json`, you've gone outside scope — back out.

You will:
1. Identify which chapters across all shipped **v21** books need polish.
2. Polish ONLY the breakdown prose (fastRead, deepRead, fullRead) in **v21** chapter sidecars and the matching v21 book package. Don't touch examples, quiz, cards, plan, or schema fields.
3. Preserve every sentence that appears verbatim in a chapter's `memorableLines` (those are pinned).
4. Re-validate each chapter against the ship gate (must still PASS after polish).
5. Re-promote and re-publish each v21 book on completion.

## Setup

```bash
cd /Users/radinsoltani/ChapterFlow
set -a; source .env.local; set +a
```

Don't set `CHAPTERFLOW_PROVIDER` — you're the writer.

## Step 1 — Audit which chapters need polish

Note: the glob `book-packages/*.v21.json` matches **only** the v21 packages. It will not match `*.modern.json` or anything in `_legacy/`. Don't change the glob.

```bash
for book in $(ls book-packages/*.v21.json | xargs -n1 basename | sed 's/.v21.json//'); do
  echo "=== $book ==="
  npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/score-chapters.ts \
    "book-packages/${book}.v21.json" 2>&1 | grep -E "Weakest|breakdown\."
done
```

Build a worklist: any chapter where the score output mentions `breakdown.fastRead`, `breakdown.deepRead`, or `breakdown.fullRead` in the gaps section is a polish candidate. Also flag chapters where:
- score is <96
- the book is Antifragile (it has known E4 issues across most chapters)

Prioritize Antifragile first. It's the worst offender — 19 of 25 chapters fail E4. The other 12 books are mostly clean.

Skip these — they're already the quality reference:
- `how-to-win-friends-and-influence-people`
- `tiny-habits`

## Step 2 — Per chapter, polish each tier

For each chapter on the worklist, load:

```bash
cat scripts/book/prompts/chapterflow-v21-authored/state/chapters/<bookId>-ch<NN>.v21-native.chapter.json
```

Read all four of these fields:
- `breakdown.fastRead`
- `breakdown.deepRead`
- `breakdown.fullRead`
- `memorableLines` (each `.text` field — these sentences are PINNED)

### Find the problem sentences in each tier

Scan for these patterns and mark them for rewrite:

**Aphoristic paragraph openers (the wordiness signature):**
- "The mechanism is X..." / "The practical test is cold..." / "The better move is Y..."
- "There is a limit." / "There are three reasons..."
- "Most people assume..." / "Most arguments..."
- "This is what changes..." / "It comes down to..."
- "Antifragility is..." / "Resilience matters..." (bare abstract noun openers)
- Numbered rule cascades: "First, locate the downside. Second, look for optionality. Third..."

**Sentences too dense for grade 10-12:**
- >25 words in a single sentence with subordinate clauses
- >2 multi-syllable abstract words per paragraph in fastRead (e.g. "fluency", "cognitive", "credible", "plausibility")
- Multi-clause sentences that stack abstract claims

**Word-choice failures:**
- *utilize* → *use*; *demonstrate* → *show*; *leverage* → *pull*
- *appears* → *looks*; *registers* → *feels*
- *plausible* → *true*; *corresponds* → *fits*; *holds up* → *checks out*
- *transformation* → *change*; *facilitate* → *help*; *attempt* → *try*
- *sufficient* → *enough*; *obtain* → *get*; *provide* → *give*
- *typography* → *fonts*; *cognitive* (sparingly; define on first use)

### Rewrite rules

When you rewrite a sentence or paragraph:

1. **Don't change the idea.** The rewrite must teach exactly the same thing. You're shortening and grounding the prose, not rethinking the chapter.

2. **Don't touch sentences pinned in `memorableLines`.** If a sentence appears verbatim in any `memorableLines[].text` field, leave it exactly as written. Rewrite the prose around it.

3. **Aphoristic openers → scene anchors.** Replace "The practical test is cold. First, locate the downside." with something like: "Picture a controller checking a single failure point on a Friday afternoon: if one bad signal can break the whole shipment, calm is decoration." A named or implied character, a moment, a stake.

4. **Long sentences → shorter sentences.** "A thing can look calm and powerful while one hidden strand holds all the downside; the stronger design gains from small shocks with survivable stakes." becomes: "Something can look strong and still fail in one shot. Better designs absorb small hits and keep going. The trick is to make sure no single hit can end the game."

5. **Plain words across all three tiers.** fullRead is NOT a college register tier. It's a longer, deeper plain-language read.

6. **Em dashes stay banned**, meta-references stay banned, every other v21 rule still applies. Don't introduce new failure modes while fixing old ones.

### Save the polished chapter

Write the updated chapter JSON back to:

```
scripts/book/prompts/chapterflow-v21-authored/state/chapters/<bookId>-ch<NN>.v21-native.chapter.json
```

Don't change any field other than the three `breakdown.*` strings. `examples`, `quiz`, `reviewCards`, `implementationPlan`, `memorableLines`, `hook`, `counterintuition`, `keyTakeaway`, `tryThisNow`, `chapterId`, `number`, `title`, `readingTimeMinutes` — all stay byte-identical.

### Validate

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts gate-chapter \
  scripts/book/prompts/chapterflow-v21-authored/state/chapters/<bookId>-ch<NN>.v21-native.chapter.json
```

Must print `Ship gate: PASS`. Common failures during polish:

- **E4**: paragraph openers are still aphoristic. Restructure — open with a named character or specific moment, not "The X is…" / "There is…" / numbered-rule cascades. The critic looks at the FIRST 30 chars of each paragraph, but the polish should improve the WHOLE paragraph; surface-only rephrasing to evade the regex is gaming, not fixing.
- **E1**: sentences too long or words too multisyllabic. Apply the plain-word swaps; break long subordinated sentences.
- **A11**: you rewrote a sentence that was pinned in `memorableLines`. Either restore it or repoint the pin (see next step).

Don't move on until the chapter passes clean.

### Verify memorableLines still match

You don't need a separate bash check — the ship gate now enforces this as **A11** (BLOCKER). `gate-chapter` will fail any chapter whose `memorableLines[].text` no longer appears verbatim in `breakdown.fastRead`, `breakdown.deepRead`, or `breakdown.fullRead`. Two recovery options when A11 fires:

1. **Restore the original sentence** verbatim into the prose (preferred when the prose around it is fine and you only need to put the pinned sentence back in).
2. **Repoint the pin** by updating `memorableLines[i].text` to a sentence you actually wrote in the new prose. Pick a sentence that's quotable on its own and as memorable as the original.

If neither feels right, run [scripts/book/prompts/chapterflow-v21-authored/src/scratch/regenerate-broken-memorable-lines.ts](scripts/book/prompts/chapterflow-v21-authored/src/scratch/regenerate-broken-memorable-lines.ts) `--book <bookId>`. It calls the memorable-lines agent on each broken chapter to pick 3 fresh lines from the current prose. Free under Anthropic CLI / Max — costs about $0 and ~30s per chapter.

## Step 3 — After every problem chapter in a book is polished, re-promote

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts promote-book <bookId> \
  --title "<title>" --author "<author>"
```

This re-runs every gate (ship + book), refreshes the categorizer, and writes the updated `book-packages/<bookId>.v21.json`.

## Step 4 — Re-validate the package

```bash
node scripts/book/validate-book.mjs book-packages/<bookId>.v21.json
```

Must print `RESULT: PASS`.

## Step 5 — Re-publish to production catalog

```bash
npx tsx scripts/book/publish-single-package.ts --file book-packages/<bookId>.v21.json
```

Bumps `currentPublishedVersion` in DDB. The production reader will pick up the new content on next request.

## Step 6 — After ALL books polished, rebuild search index ONCE

```bash
npx tsx scripts/book/rebuild-search-index.ts
```

Don't do this per book — it's expensive. Do it once at the end.

## Step 7 — Report back

For each book polished:
- Book ID
- Chapters polished (count + numbers)
- E4 hits before → after
- New average score (run score-chapters.ts again)
- New catalog version

Summary across all books:
- Total chapters polished
- Estimated time spent
- Books that needed no polish (already clean)
- Books that took the most polish (likely Antifragile)

## What to NEVER do

- **Never edit a `.modern.json` file** — those are the legacy v13 corpus, read-only for this pass. The publish guard and gate-chapter critics don't even apply to them; their schema is completely different. If you open one by mistake, close it.
- **Never edit anything under `book-packages/_legacy/`** — that's the archive of v13 packages that have been migrated. Same reason: wrong schema, wrong content, out of scope.
- Don't polish chapters that already pass cleanly (no E1/E4 findings, score ≥96). Leave them alone.
- Don't touch examples, quiz, cards, plan, or any non-breakdown field. The scope is breakdown prose only.
- Don't rewrite sentences pinned in `memorableLines`. Those are quotable lines the reader expects to find verbatim.
- Don't introduce em dashes, meta-references, banned phrases, or any other forbidden pattern. The ship gate will reject you.
- Don't change a chapter's meaning. The polish must teach exactly the same idea. If you find yourself rewriting the IDEA rather than the prose, you've gone too far — back out.
- Don't skip `gate-chapter` validation. Every polished chapter must pass before moving on.
- Don't re-run the search index per book. Once at the end.

## Order of operations (suggested)

1. Antifragile (worst offender — likely 19 chapters need polish)
2. Clear Thinking (some E4 fires)
3. Seven Powers (1 chapter has E4)
4. Anything else with E4 hits or score <96
5. Skip HWF, Tiny Habits, the new SFB (already clean)
