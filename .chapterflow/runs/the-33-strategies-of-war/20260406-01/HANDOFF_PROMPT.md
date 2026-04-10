# Handoff Prompt — The 33 Strategies of War v12 Sealed, Continue From Wave 3

Copy everything below this line into a fresh Claude Code session and paste it as the first message.

---

## CONTEXT

You are picking up a ChapterFlow book-generation run for **The 33 Strategies of War by Robert Greene** that is 5 chapters deep into a 10-chapter book. Five chapters (Ch1–Ch5) have been produced, validated at 12/12, user-approved, and hash-locked into continuity-state.json. Chapters 6 through 10 remain, followed by the release gate (Phase 8) and repo wiring and build (Phase 9).

This is an **execution task, not a planning task**. Do not switch into planning behavior. Do not produce a plan unless explicitly asked. Start working immediately after reading the state summary below.

**Working directory:** `/Users/willsoltani/dev/chapterflow-siliconx`
**Run root:** `.chapterflow/runs/the-33-strategies-of-war/20260406-01`
**Pack root:** `scripts/book/prompts/chapterflow-v12-sealed`
**Book:** The 33 Strategies of War by Robert Greene, First Edition (2006)
**Run profile:** `balanced_flagship`
**Output profile:** `flagship_v4_compatible`
**Wave size:** 2
**Chapter range:** 1–10 (10 chapters total, 5 complete)
**Pack version:** `v12-sealed`

---

## STATE OF THE RUN

### What exists and has been fully approved (hash-locked)

Chapters 1 through 5 are complete. Each has the full 14-artifact pipeline:
- brief, outline, quiz blueprint, source sidecars (txt + json)
- canonical draft, edited draft, critic report (all 12/12, zero auto-fails)
- structured chapter JSON, quiz JSON (10 questions each)
- validation report, validated chapter JSON
- validated review-package JSON, reading-metrics sidecar

All five hashes are locked in `continuity/continuity-state.json → approvedChapterHashes`. All 49 character names from Ch1–Ch5 are reserved in `nameUsage`. All 10 school settings are reserved in `schoolSettingUsage`.

**Approved chapters and their titles:**
- **Ch1 "The First Enemy Is You"** — Greene Strategies 1–4 (Polarity, Guerrilla-War-of-the-Mind, Counterbalance, Death-Ground). Self-directed discipline: managing reactivity, abandoning the worked playbook, building presence of mind, weaponizing constraint. Anchors: Devon (last-war thinking), Imani (presence of mind, 11:42 PM email), Aiden (death ground, non-refundable conference ticket). Hash: `95ae8f10ec32725deee1acbb0d08f0270df7fa3dd6ea948d8bd9fd89f26fab65`
- **Ch2 "Leading Through Other People"** — Greene Strategies 5–7 (Command-and-Control, Controlled-Chaos, Morale). Mission-not-method, segmentation, cause-binding; earned-trust diagnostic as prior skill. Anchors: Naya (Friday memo, 6 regional managers), Tomas (3 pods of 15), Camila (advocacy ED first all-staff). Hash: `de1791807573325e7fcad1ed119af5b88ff45d2e9ae3c48652eef1bf72462bcb`
- **Ch3 "Choosing Not to Fight"** — Greene Strategies 8 & 11 (Perfect-Economy, Nonengagement). Two disciplines of decline for opposite conditions: low-value abundance (perfect economy, two-question test) vs. high-value position deficit (nonengagement, trade space for time). Anchors: Junichi (12 declined/1 entered, two-column sheet), Aanya (espresso→pour-over pivot against $40M giant). Hash: `da103a369d710c9d7fdabfe7cfb6e1cd58db7ee179850a9b0ef13dcc7bba3b8a`
- **Ch4 "Absorbing and Returning an Attack"** — Greene Strategies 9 & 10 (Counterattack, Deterrence). Absorption window, maximum-extension timing, deterrence capital vs. bluff collapse. Anchors: Dara (six-week absorption, board-review counter), Kenji (deterrence capital, rewritten clause), Petra (bluff collapse contrast). Hash: `3123fd92921ece401a4e6c1fa3b00629694d78585dc0e3bab9229e39637ec086`
- **Ch5 "The Long View"** — Greene Strategies 12 & 13 (Grand Strategy, Intelligence). Enabling conditions for offense: explicit revisable long-horizon plan + accurate opponent model. Anchors: Luca (one-page document, three-sentence decline in year three of seven), Tariq (eleven days of research, brand-deadline constraint, twelve extra revenue points). Hash: `5606e79f6f08049efd4fd6bb8683fe6da8787f342a0f326eb58254a23f88d75b`

### Reserved character names (all 49 — zero reuse allowed in Ch6–Ch10)

**Ch1:** Devon, Imani, Aiden, Ruth, Priya, Marcus, Elena, Yara
**Ch2:** Naya, Tomas, Camila, Bea, Jamil, Hadiya, Kiran, Sora, Niko, Renzo, Reyna, Owen
**Ch3:** Junichi, Aanya, Ines, Wesley, Aditi, Rafael, Mira, Linnea, Saira, Vivek
**Ch4:** Dara, Kenji, Petra, Felix, Chisom, Rowan, Isolde, Clem, Bastian
**Ch5:** Luca, Tariq, Suki, Yemi, Cormac, Nadia, Bram, Orla, Zaid

Also banned per book-wide convention (gold-benchmark names from other packs): Maya, Fouquet, Daria, Raj, Jordan, Gloria, Ethan, Harding.

### Reserved school settings (all 10 — no repeats)

`history-graduate-seminar` (ch01), `organic-chemistry-recitation` (ch01), `university-debate-team` (ch02), `high-school-robotics` (ch02), `graduate-philosophy-seminar` (ch03), `high-school-student-government` (ch03), `law-school-trial-advocacy` (ch04), `high-school-economics-class` (ch04), `mba-strategy-seminar` (ch05), `high-school-speech-and-debate` (ch05)

### What remains

- **Wave 3:** Ch6 "Speed, Initiative, and the Decisive Point" + Ch7 "Indirection: Flank, Wedge, Long Maneuver"
- **Wave 4:** Ch8 "Negotiated Outcomes and Clean Exits" + Ch9 "The Line of Least Expectation"
- **Wave 5:** Ch10 "The Edge Cases and When to Put the Framework Down" (solo final chapter — highest moral complexity, meta-frame closing)
- **Phase 8:** Release gate
- **Phase 9:** Wire and build

---

## CHAPTER CONTENT SUMMARY FOR CH6–CH10

Read `skeleton/book-skeleton.md` and `sources/.../chapter-map.md` for full detail. Summary below for quick orientation.

### Ch6 — Speed, Initiative, and the Decisive Point
**Strategies:** 14 (Blitzkrieg/Speed), 15 (Forcing), 16 (Center-of-Gravity)
**Core thesis:** Three offensive disciplines once the long view and intelligence are in place. Speed cycles the opponent's decision loop (OODA loop: the faster side wins). Initiative forces the opponent to respond to your terms rather than executing their own plan. The decisive point is the opponent's center of gravity — the one node whose loss collapses the whole position.
**Source:** `.chapterflow/sources/the-33-strategies-of-war/the-33-strategies-of-war.txt` — read chapter-map.md for exact lines.
**Moral flag:** Low. Standard offensive framing.
**Concept density:** 3. Note: OODA loop was introduced in Ch1's counterbalance section; Ch6 formalizes it. Callback opportunity.

### Ch7 — Indirection: Flank, Wedge, Long Maneuver
**Strategies:** 17 (Divide-and-Conquer), 18 (Turning/Flank), 20 (Ripening-for-the-Sickle)
**Core thesis:** Indirection cluster. Divide coalitions by identifying the wedge between allied parties. Attack the soft flank rather than the defended front. Ripen opponents into collapse by removing the conditions that sustain them rather than striking directly. None of these moves require direct force; all require patience and accurate reading of the environment.
**Source:** Read chapter-map.md for lines.
**Moral flag:** Medium. Every indirect move requires explicitly naming the line between strategic framing of real facts and fabrication or manipulation. Name this line in the hard breakdown.
**Concept density:** 3.

### Ch8 — Negotiated Outcomes and Clean Exits
**Strategies:** 21 (Diplomatic-War/Pressure-with-Exit), 22 (Exit/Sunk-Cost)
**Core thesis:** Pair offensive pressure with a face-saving exit for the opponent. Honor pre-committed exit conditions even when sunk-cost pressure is strong. The exit is part of the strategy, not a concession — the opponent who is given a graceful way out takes it faster and more completely than the opponent who is cornered.
**Source:** Read chapter-map.md for lines.
**Moral flag:** Low. Thin-chapter risk (2 strategies only) — compensate with sharper anchor stories and decisive boundary conditions.
**Concept density:** 2.

### Ch9 — The Line of Least Expectation
**Strategies:** 23 (Misperception), 24 (Ordinary-Extraordinary), 26 (Void), 27 (Alliance), 29 (Fait Accompli)
**Core thesis:** Five asymmetric/indirect moves for the operator who is weaker, smarter, or both. Use opponent misperception as terrain. Move between ordinary and extraordinary to create pattern disruption. Find the void in the opponent's position (the part they are not defending). Build alliances from behind the apparent front. Execute fait accompli: the move that presents the outcome as already complete before the opponent can respond.
**Source:** Read chapter-map.md for lines.
**Moral flag:** HIGH. This is the densest moral chapter in the book. Every technique here has a legitimate-strategic form and a fabrication/coercion form. The legitimate form: strategic framing of real facts, alliance of real interests, exploitation of actual misperceptions. The coercion form: lying, manufacturing alliance through pressure, fait accompli that bypasses consent. The chapter must name the line every single time. Never let a technique be presented without its ethical boundary condition.
**Concept density:** 5 (only 5-concept chapter in the book — premium routing candidate, highest list-collapse risk).

### Ch10 — The Edge Cases and When to Put the Framework Down
**Strategies:** 19, 25, 28, 30, 31, 32, 33 (Annihilation, Righteous/Moral Positioning, One-Upmanship, Communication/Propaganda, Inner-Front, Passive-Aggression, Chain-Reaction) + the closing meta-frame
**Core thesis:** The highest-cost, most ethically loaded strategies in the book — plus the meta-skill that is this book's actual final lesson: knowing when to put the strategic framework down entirely. Some conflicts are not games to be won with better strategy; some relationships are not optimization problems; some moments call for directness and honesty rather than positioning. The chapter closes the arc by naming explicitly what the framework cannot do.
**Source:** Near end of source document. Read chapter-map.md for lines.
**Moral flag:** HIGHEST. This chapter carries the book's ethical ceiling. It must explicitly state which strategies from this chapter should not be used by most operators in most contexts, and why. It must also name the category of situation where the entire strategic frame is wrong — where deploying strategic thinking is itself a form of harm, distancing, or bad faith. This is not self-help moralizing; it is structural: some competitive frames are destructive to apply in intimate, collaborative, or trust-based contexts.
**Concept density:** 4. Premium routing required.

---

## YOUR TASK (execute in order; do not deviate)

### Phase A — Load context (read once; do not re-plan)

1. Read the pack: `scripts/book/prompts/chapterflow-v12-sealed/README.md`, `SCHEMA_NOTES.md`, `MasterGenerator-v12.md`
2. Read key rules: `rules/chapter-quality-gate.md`, `rules/chapter-structure.md`, `rules/hard-depth-rules.md`, `rules/scenario-tone-rules.md`, `rules/quiz-rules.md`
3. Read style files: `style/voice.md`, `style/constraints.md` (full banned-phrase list), `style/bad-patterns.md`, `style/grade-bands.md`
4. Read template files: `briefs/brief-template.md`, `briefs/chapter-outline-template.md`, `briefs/quiz-blueprint-template.md`
5. Read run state: `manifests/run-manifest.json`, `reports/run-log.md`, `continuity/continuity-state.json`, `skeleton/book-skeleton.md`
6. Read memory files: `memory/style-memory.md`, `memory/quality-memory.md`, `memory/role-cards/writer.md`, `memory/role-cards/editor.md`, `memory/role-cards/critic.md`, `memory/role-cards/converter.md`, `memory/role-cards/quiz.md`, `memory/role-cards/validator.md`, `memory/role-cards/patch.md`
7. Read sample approved chapters for voice calibration:
   - `drafts/edited/ch01.md` (cleanest opener)
   - `drafts/edited/ch04.md` (two-discipline synthesis)
   - `drafts/edited/ch05.md` (most recent wave)
   - `validated/ch04.chapter.json` (structural JSON shape reference)
8. Read the source material planning file: `.chapterflow/sources/the-33-strategies-of-war/chapter-map.md` — this gives line ranges for Ch6–Ch10 in the source document
9. Read source lines for the active wave (Ch6 and Ch7) from `.chapterflow/sources/the-33-strategies-of-war/the-33-strategies-of-war.txt`

### Phase B — Execute Wave 3 (Ch6 + Ch7)

Run the full pipeline for each chapter in sequence. Complete Ch6 fully before starting Ch7.

**Per-chapter pipeline order:**
1. Write `sidecars/source/chNN.source.txt` (paraphrased structural summary; no verbatim; Greene's historical case studies excluded)
2. Write `sidecars/source/chNN.source.json` (structured index with keyConcepts, connectingThread, reversalFlags)
3. Write `briefs/chNN.md` (per brief-template.md; fill all fields including Anchor Requirements, Secondary Names for quiz/breakdowns, School Settings, Vocabulary Watchlist, Moral Complexity Flag, Motif/Callback notes)
4. Write `outlines/chNN.md` (7-paragraph map; threshold question; hard-depth analytical climax; continuity notes)
5. Write `quiz-blueprints/chNN.md` (10 questions; each with prompt, 3 choices, key, Bloom level, depth level; correctIndex target summing to ~3/4/3 or ~4/3/3)
6. Write `drafts/canonical/chNN.md` (7 paragraphs, ~1000–1200 words)
7. Write `drafts/edited/chNN.md` (tighten openers; remove filler; zero em dashes; no banned phrases; forward-bridge in P7)
8. Write `reports/chNN.critic.md` (12/12 rubric; auto-fail screen; strongest qualities; PASS or PATCH decision)
9. If critic finds patches needed: apply them in the edited draft before advancing. 12/12 with zero auto-fails is required before Phase 5.
10. Write `structured/chNN.chapter.json` (full EMH structured JSON; all tone objects; all 6 examples; 10 quiz questions in the JSON; reviewCards; keyTakeawayCard) — **use Python via Bash for the write; verify word counts before saving**
11. Check word counts via `python3 -c "import json; ..."` (see Word Count Checks section below); fix any out-of-band tones before proceeding
12. Write `quizzes/chNN.quiz.json` (10 questions extracted from structured JSON; tone-object explanations; verify correctIndex distribution is ~3/4/3)
13. Compute content hash: `python3 -c "import json,hashlib; ..."`
14. Write `validated/chNN.chapter.json` (copy of structured JSON + contentHash field)
15. Write `validated/chNN.review-package.json`
16. Write `reports/chNN.validation.md` (all mechanical checks PASS; prose checks; word count repair log if applicable; verdict VALIDATED)
17. Write `sidecars/chNN.reading-metrics.json`
18. Update `continuity/continuity-state.json`: add new names to `nameUsage` and `withinChapterNames`, add school settings to `schoolSettingUsage`, add formats to `formatCategoryHistory`

After both Ch6 and Ch7 are validated, present the Wave 3 approval gate and stop. **Do not start Wave 4 until the user approves.**

### Phase C — Wave 4 (Ch8 + Ch9) and Wave 5 (Ch10)

After Wave 3 approval: lock Ch6+Ch7 hashes in `approvedChapterHashes`, then run Wave 4 (Ch8 + Ch9) with the same pipeline. After Wave 4 approval, run Wave 5 (Ch10 alone — final chapter, highest moral complexity). After Wave 5 approval, lock all remaining hashes.

### Phase D — Release gate (Phase 8)

Only after all 10 chapters are user-approved and hash-locked:

1. Assemble `release/the-33-strategies-of-war.modern.json` — load each `validated/chNN.chapter.json` in order 1–10 and wrap in the envelope:
   ```json
   {
     "schemaVersion": "1.1.0",
     "packageId": "<new uuid v4>",
     "createdAt": "<iso timestamp>",
     "contentOwner": "ChapterFlow",
     "book": { /* from manifest.book, minus sourceText/sourceProvenance */ },
     "chapters": [ /* validated ch01..ch10 in order */ ]
   }
   ```
   **Do not regenerate chapter bodies.** Assemble only from `validated/` files (`releaseAssembleFromValidatedOnly: true`).

2. Verify `preserveApprovedChapterHashes: true`: re-compute SHA-256 of each validated chapter and confirm it still matches `continuity-state.json → approvedChapterHashes`. If any hash has drifted, stop and investigate.

3. Run release guard if available:
   ```bash
   ls scripts/book/prompts/chapterflow-v12-sealed/tools/ 2>/dev/null
   # If release guard exists, run it; if not (v12 tooling may not exist), proceed to repo validator
   ```

4. Write `reports/release-validation.md` and `reports/release-audit.md`.

### Phase E — Wire into repo and build (Phase 9)

1. Copy release file:
   ```bash
   cp .chapterflow/runs/the-33-strategies-of-war/20260406-01/release/the-33-strategies-of-war.modern.json book-packages/the-33-strategies-of-war.modern.json
   ```

2. Run repo validator:
   ```bash
   node scripts/book/validate-book.mjs book-packages/the-33-strategies-of-war.modern.json
   ```
   Require zero errors. Common failures: word counts outside band (fix in validated chapter, recopy, revalidate); wrong-shaped tone objects; wrong counts of examples / ending types / review cards.

3. Build:
   ```bash
   npm run build
   ```
   All must pass. If the build fails on a field the ChapterFlow schema allows but the repo TypeScript types do not, flag it and ask the user before proceeding.

4. Update the run log with Phase 8 and Phase 9 completion records.

---

## CHAPTER CONTENT RULES (learned across 5 chapters — do not deviate)

### Style rules

1. **Zero em dashes in any reader-facing content.** The character is "—". Use commas, colons, parentheses, or period breaks instead. After writing any draft or JSON, run: `python3 -c "import json; d=open('path').read(); print(d.count('—'))"` and confirm zero.

2. **Zero banned phrases.** Full list in `style/constraints.md`. Partial list: *delve, crucial, landscape, realm, "at its core", "the art of", navigating, harnessing, robust, synergy, "paradigm shift", "game-changer", facilitate, utilize, foster, "embark on", "a testament to", "shed light on", "This matters because", "It is essential to", "It's worth noting", "In today's world", Furthermore, Moreover, "In conclusion".*

3. **Zero banned sentence skeletons.** No "X is not Y. It is Z." (rewrite as "X is Z, not Y" or restructure entirely). No "The real issue is...", "What matters is...", "This changes everything.", "The difference is...".

4. **No contamination phrases from brief/outline scaffolding.** Do not leak "threshold question", "anchor", "moreDetails", "concept budget", "sourceAnchorPriority", "motif watchlist", "hard-depth" into reader prose.

5. **Hard depth must be structurally different from medium, not a longer version.** Medium answers "how does this work?" Hard answers "what breaks it, or what does it imply downstream that the mechanism alone does not explain?" At least one new boundary condition, failure mode, or cross-chapter synthesis must be present in hard that is absent from medium.

6. **Tone objects must produce 3 substantively different strings.** Gentle / direct / competitive differ in function (reassure / clean mechanism / stakes/edge), not just in adjective swaps. If you can mechanically transform one to another by swapping a handful of words, they are collapsed. This is the most common validation failure.

7. **No reuse of Greene's historical case studies.** Per manifest `sourceProvenance`: Napoleon Austerlitz, Hannibal Cannae, Sun Tzu, Mao, Patton, Rommel, Lawrence of Arabia, the Spartans, Caesar, Khrushchev, etc. — all excluded. All examples are invented fresh.

8. **No moralization.** In Greene's framework, strategic actors are adaptive and rational, not contemptible. Do not dramatize their suffering, cast them as villains, or editorialize about whether a move is "good" or "bad" outside of the moral-flag chapters (Ch7, Ch9, Ch10), where the ethical boundary is part of the chapter's analytical content.

9. **Ch9 moral-flag rule:** Every indirect technique must be paired with its ethical boundary condition in the same breath. Strategic framing of real facts = legitimate. Fabrication, manufactured consent, coercion = explicitly named as the failure mode, not mentioned in passing.

10. **Ch10 closing rule:** Ch10 must include a meta-frame section that names when the strategic framework itself should be put down. It closes the arc and must not open a new question or bridge to a next chapter.

### Structural rules

11. **Examples:** exactly 6 per chapter. All 6 canonical formats exactly once: `decision_point`, `cold_open`, `dialogue`, `case_in_progress`, `dilemma`, `aftermath`. Distribution: 2 work / 2 school / 2 personal. All 6 canonical ending types exactly once: `lever`, `pivot`, `resolution`, `discipline`, `commitment`, `lesson`. Every `scenario`, `whatToDo`, and `whyItMatters` is a tone object `{gentle, direct, competitive}`.

12. **Review cards:** exactly 5. Distribution 2 easy / 2 medium / 1 hard.

13. **Quiz:** exactly 10 questions, exactly 3 choices each, correctIndex ∈ {0, 1, 2}, target distribution ≈ {0:3, 1:4, 2:3}. Bloom levels: q01–q03 remember/understand (easy), q04–q08 apply/analyze (medium), q09–q10 evaluate (hard). Every explanation is a tone object `{gentle, direct, competitive}`. Direct-explanation openers must all differ: no two share 4+ opening words; no banned opener phrases ("The strongest answer", "The best answer", "The correct response").

14. **Takeaway counts:**
    - Easy: exactly 2, each with `point` only (no `moreDetails`)
    - Medium: 5, each with `point` + `moreDetails`, plus singular `selfCheckPrompt` and `oneMinuteRecap {retrieve, connect, preview}`
    - Hard: 6, each with `point` + `moreDetails`, plus `selfCheckPrompts` array of exactly 2, plus `predictionPrompt`

    *(These counts match Ch1–Ch5 convention for this run. Confirm by reading any validated chapter JSON.)*

15. **Word count bands** (enforced at release gate):
    - Easy: 140–175 words per tone
    - Medium: 330–420 words per tone
    - Hard: 490–600 words per tone
    
    Verify with `len(text.split())` before writing the validated file. Over-band tones: trim excess. Under-band tones: expand with substantive concept development, not padding.

16. **Continuity discipline:** zero character-name reuse across Ch1–Ch10. The full reserved list (49 names) is in this document above and in `continuity/continuity-state.json → nameUsage`. Before assigning a name to any chapter, check the list.

17. **No new game catalog names in Ch10** and no new structural concepts beyond what the 10-chapter arc introduces. Ch10 is post-catalog; it closes the arc, does not extend it.

### Process rules

18. **No planning mode.** Execute phases in sequence. Do not ask permission between pipeline steps. The pipeline is known.

19. **Use Python via Bash for structured JSON writes.** Writing large JSON via multiple Edit tool calls is unreliable. Build the full dict in Python, dump once with `json.dump(indent=2, ensure_ascii=False)`, verify it parses with a readback.

20. **Verify word counts before every validation.** Run the word count check script after writing the structured JSON and before writing the validation report. Fix any out-of-band tones before advancing.

21. **Artifact guard:** Run the manual artifact check after each wave:
    ```bash
    RUN=".chapterflow/runs/the-33-strategies-of-war/20260406-01"
    FAIL=0
    for ch in chNN chMM; do
      for f in "briefs/${ch}.md" "outlines/${ch}.md" "quiz-blueprints/${ch}.md" \
                "sidecars/source/${ch}.source.txt" "sidecars/source/${ch}.source.json" \
                "drafts/canonical/${ch}.md" "drafts/edited/${ch}.md" \
                "reports/${ch}.critic.md" "structured/${ch}.chapter.json" \
                "quizzes/${ch}.quiz.json" "validated/${ch}.chapter.json" \
                "validated/${ch}.review-package.json" "reports/${ch}.validation.md" \
                "sidecars/${ch}.reading-metrics.json"; do
        [ ! -f "$RUN/$f" ] && echo "FAIL missing: $f" && FAIL=$((FAIL+1))
      done
    done
    echo "Artifact check: FAIL=${FAIL} WARN=0"
    ```
    Note: the v12-sealed tooling directory does not exist in the filesystem (`scripts/book/prompts/chapterflow-v12-sealed/tools/` contains no .py files). Use the manual bash check above.

22. **Update the run log after every wave approval.** Append to `reports/run-log.md` after each wave production, each wave approval, after the release gate, and after the build.

---

## WORD COUNT CHECKS (run after every structured JSON write)

```python
import json

with open('.chapterflow/runs/the-33-strategies-of-war/20260406-01/structured/chNN.chapter.json') as f:
    data = json.load(f)

cv = data['contentVariants']
bands = {'easy': (140, 175), 'medium': (330, 420), 'hard': (490, 600)}
for depth in ['easy', 'medium', 'hard']:
    lo, hi = bands[depth]
    for tone in ['gentle', 'direct', 'competitive']:
        text = cv[depth]['chapterBreakdown'][tone]
        wc = len(text.split())
        status = 'OK' if lo <= wc <= hi else 'FAIL'
        print(f'{depth}.{tone}: {wc} [{lo}-{hi}] {status}')
```

From Ch1–Ch5 experience: **under-band is more common than over-band**. Expansions must be substantive concept development. Do not pad with transitional sentences. Common under-band tones: medium.direct (tends short), medium.competitive (tends short), hard.competitive (tends short). Check all 9 tones.

---

## HASH COMPUTATION (run after every validated chapter write)

```python
import json, hashlib

with open('.chapterflow/runs/the-33-strategies-of-war/20260406-01/structured/chNN.chapter.json') as f:
    data = json.load(f)

canonical = json.dumps(data, sort_keys=True, ensure_ascii=False)
h = hashlib.sha256(canonical.encode('utf-8')).hexdigest()
print(h)
```

The hash is computed from the **structured** JSON (before adding `contentHash`). Add `contentHash: h` to produce the validated chapter JSON.

---

## CORRECTINDEX BALANCE FIX (if needed)

From Ch1–Ch5 experience, the quiz generator tends to cluster correctIndex at 1. After writing the quiz JSON, check distribution:

```python
import json
with open('...quizzes/chNN.quiz.json') as f:
    data = json.load(f)
dist = {0:0, 1:0, 2:0}
for q in data['questions']:
    dist[q['correctIndex']] += 1
print(dist)
```

Target: {0:3, 1:4, 2:3} or {0:4, 1:3, 2:3}. If imbalanced (e.g., {0:2, 1:6, 2:2}), swap choices within specific questions to move correctIndex. **When swapping, always verify that `choices[correctIndex]` still points to the semantically correct answer after the swap.** This was the source of a correctIndex error in Ch3 (a swap script set an index to 2 when the correct answer was already at position 0).

---

## NAME SUGGESTIONS FOR CH6–CH10

All fresh, none reserved. Suggestions only — pick freely from these or invent others that are:
- Cross-cultural, contemporary, one-word first names
- Gender-neutral or clearly varied in gender across the chapter
- Not already on the 49-name reserved list above

Ch6 suggestions: Phoebe, Declan, Amara, Kofi, Sigrid, Idris, Wren, Caius, Fumiko, Ondine
Ch7 suggestions: Maisie, Theron, Fola, Leif, Priscilla, Soren, Tanvi, Gus, Kalani, Else
Ch8 suggestions: Bridget, Axel, Simone, Elan, Haruki, Vera, Kwame, Isolde (already used in Ch4), Ode, Nils
Ch9 suggestions: Astrid, Renato, Zara, Callum, Yuna, Pierre, Ingrid, Theo (check if used), Lyra, Emeka
Ch10 suggestions: Solveig, Dante, Mirembe, Caspar, Femi, Oksana, Ruben, Linh, Matteo, Imara

Check each name against the reserved list before using. Also check `continuity-state.json → nameUsage` (always authoritative).

---

## SCHOOL SETTING SUGGESTIONS FOR CH6–CH10

All fresh. Used settings are listed in the reserved list above. Some options:

- undergraduate-creative-writing (novel to use)
- medical-school-clinical-ethics (appropriate for Ch9/Ch10 moral content)
- law-school-trial-practice (wait — law-school-trial-advocacy used in Ch4; vary the setting name)
- undergraduate-political-science (good for Ch7 indirection)
- high-school-model-un (appropriate for diplomacy/alliance themes in Ch9)
- business-school-negotiation-lab (appropriate for Ch8)
- phd-defense-seminar (appropriate for high-stakes competition themes)
- undergraduate-theatre-directing (appropriate for Ch6 initiative/decisive-point)
- high-school-math-olympiad (good for Ch6 speed/iteration)
- community-college-paralegal-studies (Ch8 exit/negotiation themes)

Pair 2 school settings per chapter. Check the used list before assigning.

---

## FIRST CONCRETE STEPS

1. Read all files listed in Phase A above, in order.

2. Confirm the state:
   ```bash
   ls .chapterflow/runs/the-33-strategies-of-war/20260406-01/validated/ch*.chapter.json
   ```
   Expected: ch01 through ch05.

3. Confirm continuity:
   ```bash
   python3 -c "
   import json
   cs = json.load(open('.chapterflow/runs/the-33-strategies-of-war/20260406-01/continuity/continuity-state.json'))
   print('Approved:', list(cs['approvedChapterHashes'].keys()))
   print('Reserved names:', len(cs['nameUsage']))
   print('School settings:', list(cs['schoolSettingUsage'].keys()))
   "
   ```
   Expected: 5 approved chapters, 49 reserved names, 10 school settings.

4. Read the chapter-map source file to confirm source line ranges for Ch6 and Ch7:
   ```bash
   cat .chapterflow/sources/the-33-strategies-of-war/chapter-map.md
   ```

5. Read source lines for Ch6 (Strategies 14, 15, 16) from the main source document.

6. **Start Wave 3 immediately.** Do not produce a plan. Write Ch6 source sidecars first, then brief, outline, quiz blueprint, canonical draft, edited draft, critic, structured JSON, quiz, validator, validated artifacts. Then Ch7. Then present the Wave 3 approval gate and stop.

---

## WAVE GATE FORMAT (match this format for every wave gate presentation)

```
**Wave N approval gate**

Both chapters validated. Awaiting your approval to lock hashes and start Wave N+1.

---

**Chapter N — [Title]**
- Critic score: **12/12** | No auto-fails | [Patches if any, else "No patches"]
- Strategies covered: N (Name) + M (Name)
- Anchor characters: [name] ([concept]), [name] ([concept])
- Core thesis: [1-2 sentences]
- Content hash: `[64-char hex]`

**Chapter M — [Title]**
- [same format]

**Artifact guard:** FAIL=0 WARN=0 (manual check across all 14 artifact types per chapter)

Approve this wave to continue with Wave N+1 (Chapters X and Y).
```

---

## KNOWN PIPELINE ISSUES FROM CH1–CH5

1. **Under-band word counts** (most common): medium.direct and medium.competitive tend to come in short (250–280 words against a 330 floor). Hard.competitive also tends short (320–350 against a 490 floor). Expect to expand after the word-count check. All expansions must add concept content, not padding.

2. **Over-band word counts** (occasional): hard.gentle and hard.direct occasionally come in over 600. Trim by removing redundant examples or collapsing two similar sentences.

3. **correctIndex clustering at 1**: The quiz tends to produce too many correctIndex=1 answers. Check distribution after writing each quiz. Apply targeted choice swaps as needed. After swapping, verify the correct answer is still at the new index.

4. **Within-chapter name collisions**: Anchor characters introduced in breakdowns (who appear in the prose) can accidentally match example character names. Before finalizing the structured JSON, cross-check all names used in chapterBreakdown text against the six example character names. This caused collisions in Ch2 (Jamil/Sora) and Ch3 (Linnea).

5. **Two-hyphen sequences ("--") in prose**: These are not em dashes ("—") and do not trigger the em-dash rule. They appear occasionally in drafted JSON text. They are acceptable.

6. **v12-sealed tooling**: The `scripts/book/prompts/chapterflow-v12-sealed/tools/` directory does not exist. Use the manual bash artifact check script above. The v13+ tools have incompatible manifest schemas and should not be run against this run directory.

---

## IMPORTANT PATHS

```
Pack root:       scripts/book/prompts/chapterflow-v12-sealed/
Run root:        .chapterflow/runs/the-33-strategies-of-war/20260406-01/
Source dir:      .chapterflow/sources/the-33-strategies-of-war/
Source file:     .chapterflow/sources/the-33-strategies-of-war/the-33-strategies-of-war.txt  (889 lines)
Chapter map:     .chapterflow/sources/the-33-strategies-of-war/chapter-map.md
Continuity:      .chapterflow/runs/the-33-strategies-of-war/20260406-01/continuity/continuity-state.json
Run log:         .chapterflow/runs/the-33-strategies-of-war/20260406-01/reports/run-log.md
Skeleton:        .chapterflow/runs/the-33-strategies-of-war/20260406-01/skeleton/book-skeleton.md
Memory:          .chapterflow/runs/the-33-strategies-of-war/20260406-01/memory/
Validated Ch1:   .chapterflow/runs/the-33-strategies-of-war/20260406-01/validated/ch01.chapter.json
Validated Ch4:   .chapterflow/runs/the-33-strategies-of-war/20260406-01/validated/ch04.chapter.json  (closest structural analog for complex waves)
Validated Ch5:   .chapterflow/runs/the-33-strategies-of-war/20260406-01/validated/ch05.chapter.json  (most recent; match voice)
Edited Ch5:      .chapterflow/runs/the-33-strategies-of-war/20260406-01/drafts/edited/ch05.md
Book packages:   book-packages/  (release target: the-33-strategies-of-war.modern.json)
Repo validator:  scripts/book/validate-book.mjs
```

Begin now.
