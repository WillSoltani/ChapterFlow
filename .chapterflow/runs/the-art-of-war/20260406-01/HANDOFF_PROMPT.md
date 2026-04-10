# Handoff Prompt — The Art of War v13 Retargeting and Continuation

Copy everything below into a fresh Claude Code session. Paste it as the first message.

---

## CONTEXT

You are picking up a ChapterFlow book-generation run for **The Art of War by Sun Tzu** that is in a partially-completed, partially-broken state. A previous session produced Chapters 1-3 against the now-deleted `chapterflow-v12-sealed` pack, then retargeted the run to `chapterflow-v13-autonomous`. The retargeting updated all manifest files and source-freeze bundle, but exposed **structural quality failures** in the existing chapter content that must be fixed before continuing.

This is an **execution task, not a planning task**. Do not switch into planning behavior. Do not give me a plan unless I explicitly ask for one. Start working immediately after you finish reading the state summary and rules.

**Working directory:** `/Users/willsoltani/dev/chapterflow-siliconx`
**Run root:** `.chapterflow/runs/the-art-of-war/20260406-01`
**Pack root:** `scripts/book/prompts/chapterflow-v13-autonomous`
**Book:** The Art of War by Sunzi (Sun Tzu), Lionel Giles 1910 translation, Project Gutenberg #17405
**Run profile:** `apex_flagship`
**Chapter range:** 1-13 (13 chapters total)
**Ch1 canonical SHA-256 (hash-locked in continuity-state.json):** `0fe4bf62313aff10ff623b731f8c50f89c1abef404f490a3c9bf01c99beb78c6`

---

## STATE OF THE RUN (read this carefully)

### What exists and passes v13 artifact guard
- **v13 manifests complete:** `manifests/run-manifest.json` (updated to `packVersion: v13-autonomous`), `manifests/source-ledger.json`, `manifests/edition-lock.json`
- **source-freeze/:** contains `book-source.txt` (PG #17405 Giles translation, frozen) plus 5 supporting research files (chapter-map.md, historical-context.md, key-quotes.md, modern-applications.md, criticism-and-limits.md)
- **continuity/continuity-state.json:** includes `approvedChapterHashes.ch01 = 0fe4bf62313aff10ff623b731f8c50f89c1abef404f490a3c9bf01c99beb78c6`
- **Ch1 complete bundle:** brief, outline, quiz-blueprint, source sidecars (txt + json), canonical draft, edited draft, critic report (11/12), structured chapter JSON, quiz JSON (10 questions), validation report, validated chapter JSON, validated review-package JSON, reading-metrics sidecar
- **Ch2 complete bundle:** same 11 artifacts as Ch1. Critic 11/12.
- **Ch3 partial bundle:** brief, outline, quiz-blueprint, source sidecars, canonical draft, edited draft, critic report (11/12), structured chapter JSON. **Missing:** quiz JSON, validated chapter, validated review-package, validation report, reading-metrics sidecar.
- **skeleton/book-skeleton.md:** covers all 13 chapters with one-line intent, source richness, moral flags, cross-chapter motifs, vocabulary watchlist, wave plan.
- **memory/:** style-memory.md, quality-memory.md, and 7 role cards (writer, editor, critic, converter, quiz, validator, patch).
- **reports/run-log.md:** full run log through Phase 6 (Ch1 approval gate).

### What passes
- `python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_pack_audit.py scripts/book/prompts/chapterflow-v13-autonomous` → `FAIL=0`
- `python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_artifact_guard.py .chapterflow/runs/the-art-of-war/20260406-01` → `FAIL=0 WARN=0` (no missing files per the v13 artifact guard, because it does not currently track Ch3's missing validated file set as a failure in the same way).

### What FAILS under v13 chapter_gate lint
The previous session wrote Ch1 and Ch2 against v12-sealed's looser constraints. v13 has stricter quality checks:
- **Duplicate sentence detection:** same sentence appearing in both `medium.keyTakeaways[i].moreDetails.<tone>` and `hard.keyTakeaways[i].moreDetails.<tone>` → FAIL.
- **`more_details_restate`:** hard's moreDetails reusing the same wording as medium's moreDetails → FAIL.
- **`hard_medium_overlap`:** text-similarity overlap between hard.keyTakeaways and medium.keyTakeaways above threshold (~0.70) → FAIL.

Current lint output:
```
Ch1: FAIL=25 (duplicate sentences only)
Ch2: FAIL=65 (duplicates + more_details_restate + hard_medium_overlap)
Ch3: not yet tested; structured only (no quiz). Expected to fail similarly.
```

---

## YOUR TASK (execute this in order; do not deviate)

### Phase A — Load v13 context (read but do not re-plan)

1. Read `scripts/book/prompts/chapterflow-v13-autonomous/README.md`
2. Read `scripts/book/prompts/chapterflow-v13-autonomous/SCHEMA_NOTES.md`
3. Read `scripts/book/prompts/chapterflow-v13-autonomous/MasterGenerator-v13.md`
4. Read `scripts/book/prompts/chapterflow-v13-autonomous/rules/chapter-quality-gate.md`
5. Read `scripts/book/prompts/chapterflow-v13-autonomous/rules/hard-depth-rules.md`
6. Read `scripts/book/prompts/chapterflow-v13-autonomous/rules/chapter-structure.md`
7. Read `scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py` and `chapterflow_v13_prose_audit.py` — understand exactly what the lint checks so you can write compliant content the first time
8. Read `.chapterflow/runs/the-art-of-war/20260406-01/manifests/run-manifest.json` and `.chapterflow/runs/the-art-of-war/20260406-01/reports/run-log.md`
9. Read the existing memory files under `.chapterflow/runs/the-art-of-war/20260406-01/memory/`
10. Read the skeleton at `.chapterflow/runs/the-art-of-war/20260406-01/skeleton/book-skeleton.md`

### Phase B — Fix Ch1 (hash-locked, must be rehashed after fix)

**Important:** Ch1 is hash-locked. The current hash in `continuity-state.json` is `0fe4bf62...`. Because you must rewrite Ch1's moreDetails, the hash will change. **You must update the hash in continuity-state.json after fixing Ch1, because the v13 retargeting explicitly allows this.** Treat the old hash as invalidated by the v12 → v13 migration. Announce this in the run log.

1. Read the current `validated/ch01.chapter.json` and `structured/ch01.chapter.json` to understand the existing content.
2. Rewrite **every** `medium.keyTakeaways[i].moreDetails.<tone>` and `hard.keyTakeaways[i].moreDetails.<tone>` so that:
   - **No sentence appears in both medium and hard moreDetails.** Use the lint's duplicate-sentence check as your ground truth. Extract the duplicated sentences by running the lint and addressing each one specifically.
   - **Hard moreDetails must contain structurally different material from medium moreDetails.** Medium explains the mechanism. Hard must add a boundary condition, failure mode, contradiction, unresolved tension, or synthesis across concepts that is not present in medium at all. Not just "more detail" — genuinely different analytical content.
   - **Similarity overlap must drop below ~0.50.** Compute word-set overlap and ensure each tone's hard.keyTakeaways differs from the corresponding medium.keyTakeaways at a word level, not just sentence level.
3. Preserve the edited draft (`drafts/edited/ch01.md`) — do not touch the prose. Only the structured breakdowns and takeaways need rewriting.
4. Preserve word count targets: easy 140-175, medium 330-420, hard 490-600 per tone.
5. Re-compute canonical SHA-256 of the updated `validated/ch01.chapter.json` using `hashlib.sha256(json.dumps(ch, sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()` and update `continuity/continuity-state.json → approvedChapterHashes.ch01`.
6. Run `python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py .chapterflow/runs/the-art-of-war/20260406-01/validated/ch01.chapter.json chapter_gate` until `FAIL=0`.

### Phase C — Fix Ch2 in the same way

Apply the same rewrite rules to Ch2's medium and hard `keyTakeaways[i].moreDetails.<tone>` fields. Also address `hard.chapterBreakdown` vs `medium.chapterBreakdown` overlap (Ch2's hard.gentle scored 0.84 overlap — that needs restructuring, not just tweaking).

The Ch2 hard breakdown must:
- Add at least one concept not present in medium (e.g., explicit discussion of the arbiter-of-the-people's-fate governance claim as an ethical imperative, not just a governance observation; or the epistemic asymmetry between peace-time knowledge and war-time knowledge).
- Rewrite the compounding-cost chain in hard at a different level of analysis — discuss the irreversibility point explicitly, or the second-order effects on neighboring states.
- Close with a genuinely harder question than medium closes with.

Re-run lint until `FAIL=0`.

### Phase D — Complete Ch3 under v13 discipline

Ch3 has a structured JSON written but no quiz, no validated, no review-package, no reading-metrics. Also: Ch3 was written with the same flawed pattern as Ch1 and Ch2 (hard as extended medium). You must:

1. Read `structured/ch03.chapter.json`.
2. Run v13 lint on it to see the failure count. Expect duplicate-sentence and overlap failures.
3. Rewrite medium and hard `moreDetails` to be structurally different.
4. Write `quizzes/ch03.quiz.json` with 10 questions. Use the blueprint at `quiz-blueprints/ch03.md`. Follow the same rules as Ch1/Ch2 quizzes (10 questions, 3 choices each, tone-object explanations, balanced correctIndex, varied direct openers, no banned opener phrases).
5. Merge structured + quiz → `validated/ch03.chapter.json`.
6. Write `validated/ch03.review-package.json` (the wrapper).
7. Write `sidecars/ch03.reading-metrics.json`.
8. Write `reports/ch03.validation.md`.
9. Run `python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py .chapterflow/runs/the-art-of-war/20260406-01/validated/ch03.chapter.json chapter_gate` until `FAIL=0`.
10. Compute and store Ch3's canonical hash in `continuity-state.json → approvedChapterHashes.ch03`.

### Phase E — Run Wave 1 artifact guard

```bash
python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_artifact_guard.py .chapterflow/runs/the-art-of-war/20260406-01
```

Require `FAIL=0`. Fix anything it flags.

### Phase F — Continue automatically through Waves 2-6 under v13 autopilot

Per v13's `chapterGateMode: automatic_continue`, do **not** stop for user approval between chapters. Continue through:
- Wave 2: Ch4 (Tactical Dispositions) + Ch5 (Energy)
- Wave 3: Ch6 (Weak Points and Strong) + Ch7 (Maneuvering)
- Wave 4: Ch8 (Variation in Tactics) + Ch9 (The Army on the March)
- Wave 5: Ch10 (Terrain) + Ch11 (The Nine Situations) — consider splitting Ch11 solo because of density
- Wave 6: Ch12 (The Attack by Fire) — solo because source is thin + Ch13 (The Use of Spies)

Between every wave, run:
```bash
python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_artifact_guard.py .chapterflow/runs/the-art-of-war/20260406-01
```

Require `FAIL=0` before starting the next wave.

For each chapter, produce the full 11-artifact bundle plus source sidecars, then lint the validated chapter JSON with `chapter_gate` mode and fix all failures before advancing. The bundle for each chapter is:
1. `briefs/chNN.md`
2. `outlines/chNN.md`
3. `quiz-blueprints/chNN.md`
4. `sidecars/source/chNN.source.txt`
5. `sidecars/source/chNN.source.json`
6. `drafts/canonical/chNN.md`
7. `drafts/edited/chNN.md`
8. `reports/chNN.critic.md`
9. `structured/chNN.chapter.json`
10. `quizzes/chNN.quiz.json`
11. `reports/chNN.validation.md`
12. `validated/chNN.chapter.json` (merged structured + quiz)
13. `validated/chNN.review-package.json`
14. `sidecars/chNN.reading-metrics.json`

After each chapter validates clean, write its canonical hash to `continuity-state.json → approvedChapterHashes.chNN`.

### Phase G — Release gate (Phase 8)

After all 13 chapters have `validated/chNN.chapter.json` and the artifact guard passes:

1. Assemble the release file at `.chapterflow/runs/the-art-of-war/20260406-01/release/the-art-of-war.modern.json`. Load each `validated/chNN.chapter.json` in order 1-13 and wrap in the envelope:
   ```json
   {
     "schemaVersion": "1.1.0",
     "packageId": "<new uuid v4>",
     "createdAt": "<iso timestamp>",
     "contentOwner": "ChapterFlow",
     "book": { /* from manifest book block, minus sourceText/sourceProvenance */ },
     "chapters": [ /* validated ch01..ch13 in order */ ]
   }
   ```
   **Do not regenerate chapter bodies.** Only assemble.

2. Run release guard:
   ```bash
   python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_release_guard.py .chapterflow/runs/the-art-of-war/20260406-01 .chapterflow/runs/the-art-of-war/20260406-01/release/the-art-of-war.modern.json
   ```
   Require `FAIL=0`.

3. Run release lint:
   ```bash
   python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py .chapterflow/runs/the-art-of-war/20260406-01/release/the-art-of-war.modern.json release_gate
   ```
   Require `FAIL=0`.

### Phase H — Wire into repo and build

```bash
cp .chapterflow/runs/the-art-of-war/20260406-01/release/the-art-of-war.modern.json book-packages/the-art-of-war.modern.json
node scripts/book/validate-book.mjs book-packages/the-art-of-war.modern.json
python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py book-packages/the-art-of-war.modern.json release_gate
npm run build
```

All must pass before the run is complete.

---

## NON-NEGOTIABLE RULES (learned the hard way; do not deviate)

### Content rules

1. **Zero meta-distance in reader-facing content.** No "the chapter", "this chapter", "the book", "this book" in any field inside: keyTakeaways, moreDetails, activationPrompt, selfCheckPrompt(s), predictionPrompt, oneMinuteRecap, examples (scenario/whatToDo/whyItMatters), reviewCards (front/back), keyTakeawayCard, quiz explanations, chapterBreakdown. Use "Sun Tzu's opening", "the argument here", "the passage", "the closing line" — or just teach directly without narrating the text as a text.

2. **Zero `X is not Y. It is Z.` sentence skeleton.** This is a banned skeleton in bad-patterns.md. Rewrite as `X is Z, not Y.` or `X is Z rather than Y.` or restructure entirely.

3. **Zero em dashes.** Use commas, colons, parentheses, or period breaks. The lint and guards explicitly check for `—`.

4. **No banned phrases:** delve, crucial, landscape, realm, "It's worth noting", "In today's world", Furthermore, Moreover, "In conclusion", "at its core", "the art of" (except when quoting the book's title verbatim as "The Art of War"), navigating, harnessing, robust, synergy, "paradigm shift", "game-changer", facilitate, utilize, foster, "embark on", "a testament to", "shed light on", "This matters because", "This is significant because", "It is essential to".

5. **Zero contamination phrases** from bad-patterns.md and chapterflow_v13_lint.py: "keep the prose narrow and concrete", "the source is short and works by contrast", "used lazily, the point turns into", "keep this question alive", "one source pressure stays visible", "tied to the live constraint", "threshold question" (in reader-facing content), "reading calibration", "unsupported zones", "motif watchlist", "sourceanchorpriority", "internal concept budget".

6. **Hard depth must be structurally different from medium, not a longer version.** This is the specific failure the previous session made. Hard must add: a boundary condition, a failure mode, a contradiction, a threshold question, an unresolved tension, or a synthesis across concepts that is not present in medium at all. If you can compress hard into medium by shortening sentences, you have failed the hard depth rule.

7. **No sentence may appear in both `medium.keyTakeaways[i].moreDetails.<tone>` and `hard.keyTakeaways[i].moreDetails.<tone>`.** Check this explicitly before writing. Write hard's moreDetails as a genuinely new paragraph of analysis, not an expansion of medium's.

8. **Tone objects must produce 3 unique normalized strings.** The lint computes `re.sub(r'\s+', ' ', s.strip().lower())` and requires 3 distinct values. Gentle / direct / competitive must differ in **function** (reassure / mechanism / stakes), not just in adjectives.

9. **Word count targets per tone per depth:**
   - Easy: 140-175 words each tone
   - Medium: 330-420 words each tone
   - Hard: 490-600 words each tone
   Use `len(text.split())` to verify. These are enforced by `scripts/book/validate-book.mjs` at the release stage and by the converter's internal rules.

### Structural rules

10. **Examples: exactly 6 per chapter, each format once, each ending once, 2 work / 2 school / 2 personal.** Canonical formats: `decision_point, postmortem, dialogue, predict_reveal, dilemma, before_after`. Canonical endings: `broader_principle, self_directed_question, surprising_implication, cross_domain, common_trap, perspective_reframe`. Use all six of each across the 6 examples.

11. **Every example's `scenario`, `whatToDo`, `whyItMatters` must be a tone object (gentle/direct/competitive), not a plain string.** `scenarioTonePolicy: required` is set in the manifest. Plain strings are an immediate fail.

12. **exampleId format:** `chNN-exMM-<short-slug>` where slug is 2-4 words hyphenated, describing the scene.

13. **Review cards: exactly 5 per chapter, 2 easy / 2 medium / 1 hard distribution.** Each has `cardId` (`chNN-rcMM`), `difficulty`, `type` (scenario or concept), `front` (tone object), `back` (tone object).

14. **Quiz: exactly 10 questions per chapter, 3 choices each, correctIndex ∈ {0,1,2}, explanation is a tone object.** Distribution: q01-q03 remember/understand, q04-q08 apply/analyze with q04-q06 using named-character scenarios, q09-q10 evaluate/create. No banned opener phrases ("The strongest answer...", "The best answer...", "The correct response..."). No two direct explanations share 4+ opening words. No prompt uses "best applies", "best reflects", or "real-world decision tied to". Roughly balanced correctIndex across 0/1/2.

15. **keyTakeaways counts:** Easy has exactly 3 (each with `point` only, no `moreDetails`). Medium has 5 or 6 (each with `point` + `moreDetails`). Hard has 5, 6, or 7 (each with `point` + `moreDetails`).

16. **contentVariants shape:**
    - `easy`: `{chapterBreakdown, keyTakeaways, oneMinuteRecap}` — oneMinuteRecap is a flat tone object
    - `medium`: `{chapterBreakdown, keyTakeaways, activationPrompt, selfCheckPrompt (singular), oneMinuteRecap}` — oneMinuteRecap is `{retrieve, connect, preview}` each a tone object
    - `hard`: `{chapterBreakdown, keyTakeaways, activationPrompt, selfCheckPrompts (array of 2), predictionPrompt, oneMinuteRecap}` — oneMinuteRecap is `{retrieve, connect, preview}` each a tone object

17. **chapterId format:** `ch<NN>-<slug>` where slug is the chapter title slugified, e.g. `ch01-laying-plans`, `ch02-waging-war`, `ch03-attack-by-stratagem`.

18. **Name ledger:** Do not reuse character names across chapters. Check against existing names in Ch1-Ch3 before assigning new names. Current banned names (used in Ch1-Ch3 + gold examples):
    - Ch1: Lena, Priya (secondary), Ravi, Elias (secondary), Dr. Albright (secondary), Aisha, Marcus, Tomás, Jess (secondary), Devin, Sana (secondary)
    - Ch2: Naomi, Ana (secondary), Mei, Mr. Ferrer (secondary), Theo, David (secondary), Hector, Diego (secondary), Nia, Rosa, Linda (secondary)
    - Ch3: Yusuf, Omar (secondary), Amara, Kwame (secondary), Nadia, Fatima (secondary), Petra, Leon, Ingrid (secondary), Kwame (again — fix), Sol (secondary)
    - Gold examples (never use): Maya, Jordan, Elena, Raj, Daria, Olivia, Steve Jobs, Marilyn Monroe, Galileo, Fouquet, Louis, Cosimo, Grace
    - Fix needed: Ch3 uses "Kwame" twice — once as a secondary in Ex2 (Amara's co-captain) and once as a primary in Ex6 (partnership exit). Rename the Ex2 secondary to something fresh like "Dayo" or "Kofi".

19. **Do not touch `drafts/canonical/chNN.md` or `drafts/edited/chNN.md` for Ch1-Ch3.** The existing edited drafts are clean and critic-approved. The failures are all in the structured chapter JSONs. Fix only those.

### Process rules

20. **No planning mode.** Execute the phases in order. Do not generate plans, do not ask permission between steps, do not wait for approval. The chapter gate is `automatic_continue` under v13.

21. **Do not run v12 tools.** They no longer exist. Only use `chapterflow_v13_*` tools.

22. **Always use absolute paths or paths relative to the repo root `/Users/willsoltani/dev/chapterflow-siliconx`.** Use the Bash tool with `cd`-less commands that assume the working directory is the repo root.

23. **For editing large JSON files, prefer a Python script via Bash rather than many Edit tool calls.** The previous session's Ch2 rewrite took 30+ Edit calls and still had issues. A single Python script that loads the JSON, makes targeted mutations, and writes it back is more reliable for bulk fixes.

24. **After every chapter validates, update the run log** at `.chapterflow/runs/the-art-of-war/20260406-01/reports/run-log.md` with: what was produced, the critic score, the SHA-256 hash, and any notes about quality decisions.

25. **Source-of-truth order for every chapter:** (1) chapter brief, (2) chapter outline, (3) edited draft, (4) rules/chapter-structure.md. Never invent facts beyond the brief and the edited draft.

### Quality escalation

26. **If a chapter scores below 10/12 on the critic, do not force it through.** Either local-patch specific paragraphs (patch agent) or escalate to a repair pass (repair agent) that rewrites the flagged sections. Do not silently ship a <10/12 chapter.

27. **If the quality sentry (`chapterflow_v13_you_cant_hurt_me_sentry.py`) flags a chapter, address the flag before advancing.** Check what it does by reading the source.

28. **If you get stuck in a retry loop (same lint failure after 3 attempts), stop and ask the user.** Do not keep pounding on the same problem with the same approach.

---

## APPROACH FOR FIXING HARD VS MEDIUM OVERLAP

The previous session's failure mode is worth understanding. Here's the problem pattern:

**Bad (v12-style, fails v13):**
- Medium P1: "Sun Tzu opens with a cost estimate that lands harder than its number..."
- Hard P1: "Sun Tzu opens with the only cost estimate in The Art of War. A thousand swift chariots..." (same anchor, same framing, more words)

The hard paragraph covers the same content as the medium paragraph with slightly expanded sentences. The lint catches this as `hard_medium_overlap`.

**Good (v13-compliant):**
- Medium P1: introduces the cost estimate as an economic framing argument.
- Hard P1: starts in a different place entirely — e.g. the neighboring states watching the campaign drain the treasury, OR the information-asymmetry problem where the attacker's audit ages faster than the defender's, OR the irreversibility threshold where the compounding cost chain becomes self-sustaining regardless of intervention.

The hard paragraph must cover an **additional conceptual layer** — a boundary condition, a failure mode, a second-order effect, an unresolved epistemic question — that medium does not touch at all. If you can delete hard and medium still teaches the full chapter, hard has failed.

**Practical rule for hard.keyTakeaways moreDetails:** For each takeaway, medium's moreDetails should answer *"how does this work?"* and hard's moreDetails should answer *"what breaks it, or what does it imply downstream that the mechanism alone doesn't explain?"* Those are different questions, which forces different content.

---

## FILES YOU SHOULD READ FIRST (in this order)

```
scripts/book/prompts/chapterflow-v13-autonomous/README.md
scripts/book/prompts/chapterflow-v13-autonomous/SCHEMA_NOTES.md
scripts/book/prompts/chapterflow-v13-autonomous/MasterGenerator-v13.md
scripts/book/prompts/chapterflow-v13-autonomous/rules/chapter-quality-gate.md
scripts/book/prompts/chapterflow-v13-autonomous/rules/hard-depth-rules.md
scripts/book/prompts/chapterflow-v13-autonomous/rules/chapter-structure.md
scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py
scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_prose_audit.py
.chapterflow/runs/the-art-of-war/20260406-01/manifests/run-manifest.json
.chapterflow/runs/the-art-of-war/20260406-01/reports/run-log.md
.chapterflow/runs/the-art-of-war/20260406-01/skeleton/book-skeleton.md
.chapterflow/runs/the-art-of-war/20260406-01/briefs/ch01.md
.chapterflow/runs/the-art-of-war/20260406-01/briefs/ch02.md
.chapterflow/runs/the-art-of-war/20260406-01/briefs/ch03.md
.chapterflow/runs/the-art-of-war/20260406-01/memory/style-memory.md
.chapterflow/runs/the-art-of-war/20260406-01/memory/quality-memory.md
.chapterflow/runs/the-art-of-war/20260406-01/validated/ch01.chapter.json
.chapterflow/runs/the-art-of-war/20260406-01/validated/ch02.chapter.json
.chapterflow/runs/the-art-of-war/20260406-01/structured/ch03.chapter.json
.chapterflow/runs/the-art-of-war/20260406-01/source-freeze/chapter-map.md
.chapterflow/runs/the-art-of-war/20260406-01/source-freeze/book-source.txt
```

---

## FIRST CONCRETE STEPS

1. Read all the files in the list above.
2. Run the v13 lint on Ch1 and Ch2 to see the exact current failures:
   ```bash
   python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py .chapterflow/runs/the-art-of-war/20260406-01/validated/ch01.chapter.json chapter_gate
   python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py .chapterflow/runs/the-art-of-war/20260406-01/validated/ch02.chapter.json chapter_gate
   ```
3. Read the source of `chapterflow_v13_prose_audit.py` to understand exactly how `hard_medium_overlap`, `more_details_restate`, and `chapter_package_duplicate_sentence` are computed. This will let you write compliant content on the first try.
4. Start Phase B (fix Ch1). Begin work immediately.

Begin now.
