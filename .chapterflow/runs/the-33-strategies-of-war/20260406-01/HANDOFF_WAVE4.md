# Handoff Prompt — The 33 Strategies of War, Continue From Wave 4

Copy everything below the `---` line into a fresh Claude Code session. Paste it as the first message.

---

## CONTEXT

You are continuing a ChapterFlow book-generation run for **The 33 Strategies of War by Robert Greene**. Chapters 1 through 7 are complete, validated at 12/12, and user-approved. Their hashes are locked in `continuity/continuity-state.json → approvedChapterHashes`. Wave 3 (Ch6+Ch7) was approved on 2026-04-09.

Your job is to execute **Wave 4 (Ch8+Ch9)**, then the **Wave 4 approval gate**, then **Wave 5 (Ch10 alone)**, then the **Wave 5 approval gate**, then **Phase 8 (release gate)**, then **Phase 9 (repo wire + build)**.

This is an **execution task, not a planning task**. Do not switch into planning behavior. Do not give a plan unless explicitly asked. Start working immediately on Wave 4 Ch8 dossier.

**Working directory:** `/Users/willsoltani/dev/chapterflow-siliconx`
**Run root:** `.chapterflow/runs/the-33-strategies-of-war/20260406-01`
**Book:** The 33 Strategies of War by Robert Greene, First Edition (2006)
**bookId:** `the-33-strategies-of-war`
**Run profile:** `balanced_flagship`
**Output profile:** `flagship_v4_compatible`
**Pack version:** `v12-sealed`
**Wave size:** 2 (Wave 5 is Ch10 alone)
**Chapter range:** 1-10

---

## STATE OF THE RUN (read this carefully)

### Chapters 1-7 are complete and hash-locked

| Ch | Title | Hash (SHA-256) |
|----|-------|---------------|
| Ch1 | Know Your Field of Battle | 95ae8f10ec32725deee1acbb0d08f0270df7fa3dd6ea948d8bd9fd89f26fab65 |
| Ch2 | Leading Through Other People | de1791807573325e7fcad1ed119af5b88ff45d2e9ae3c48652eef1bf72462bcb |
| Ch3 | Choosing Not to Fight | da103a369d710c9d7fdabfe7cfb6e1cd58db7ee179850a9b0ef13dcc7bba3b8a |
| Ch4 | Absorbing and Returning an Attack | 3123fd92921ece401a4e6c1fa3b00629694d78585dc0e3bab9229e39637ec086 |
| Ch5 | The Long View | 5606e79f6f08049efd4fd6bb8683fe6da8787f342a0f326eb58254a23f88d75b |
| Ch6 | Speed, Initiative, and the Decisive Point | 272fc62fc02ffcb5154231227bf09dca6feaf8d8d2f7f491f3b045ea9e73ae86 |
| Ch7 | Indirection: Flank, Wedge, Long Maneuver | eb5965db250f362089e8b8f9aa62d2ebf6cf3affb0aa39119c63cfb911ebe699 |

All 7 hashes are stored at `.chapterflow/runs/the-33-strategies-of-war/20260406-01/continuity/continuity-state.json → approvedChapterHashes`.

### Continuity state after Wave 3
- **Reserved names (64 total):** Devon, Imani, Aiden, Ruth, Priya, Marcus, Elena, Yara (ch01); Naya, Tomas, Camila, Bea, Jamil, Hadiya, Kiran, Sora, Niko, Renzo, Reyna (ch02); Ines, Wesley, Aditi, Rafael, Mira, Linnea, Saira (ch03); Dara, Kenji, Petra, Felix, Chisom, Rowan, Isolde, Clem, Bastian (ch04); Luca, Tariq, Suki, Yemi, Cormac, Nadia, Bram, Orla, Zaid (ch05); Phoebe, Declan, Amara, Kofi, Sigrid, Idris, Wren, Caius (ch06); Maisie, Theron, Fola, Leif, Soren, Tanvi, Gus, Kalani (ch07)
- **School settings used (14):** graduate-writing-seminar, undergraduate-thesis, phd-committee, master-program, high-school-chemistry, high-school-debate, undergraduate-economics-lab, high-school-yearbook, law-school-trial-advocacy, high-school-economics-class, mba-strategy-seminar, high-school-speech-and-debate, phd-defense-seminar, high-school-math-olympiad, undergraduate-political-science, high-school-model-un
- **Do not reuse** any name or school setting from above in Ch8, Ch9, or Ch10.
- Verify by loading `continuity/continuity-state.json` at the start: read `nameUsage` and `schoolSettingUsage` keys.

### Remaining work

- **Wave 4: Ch8 + Ch9** (this session starts here)
- **Wave 5: Ch10 alone** (meta-frame closer, highest moral complexity)
- **Phase 8: Release gate** (assemble release JSON from validated/ files, hash integrity check, release validation report, release audit report)
- **Phase 9: Wire and build** (copy to book-packages/, run `node scripts/book/validate-book.mjs`, run `npm run build`)

---

## CHAPTER TARGETS FOR WAVE 4 AND WAVE 5

Consult `.chapterflow/sources/the-33-strategies-of-war/chapter-map.md` for the canonical 10-chapter teaching structure and `.chapterflow/sources/the-33-strategies-of-war/the-33-strategies-of-war.txt` (889 lines) for the source. The mapping that has governed Waves 1-3 continues as follows:

### Ch8 — Diplomacy, Pressure, and the Pre-Committed Exit
- **Likely source strategies:** 19 (Maneuver into Position / Carrot-and-Stick / Negotiate While Advancing), 22 (The Exit Strategy), plus callback to 11 (Trading Space for Time from Ch3).
- **Core teaching:** Paired pressure and exit. The skilled operator applies pressure while preserving a genuine exit for the opponent. This includes the discipline of honoring a pre-committed end: once an exit condition has been named publicly, backing out of it poisons future negotiations. The hard-depth analysis covers: (a) the difference between leverage-with-exit and coercion-without-exit; (b) why moral and reputational capital are load-bearing infrastructure for strategies that depend on future negotiations.
- **Register:** Returns to cooperation-adjacent tools after the three indirection moves of Ch7. Feels closer to Ch2 than to Ch6/7.
- **Moral flag:** Medium-high. The ethical line is whether the exit is real or simulated.

### Ch9 — Counter-Force, Escalation, and Chaos
- **Likely source strategies:** 23 (The Political Snake Pit / Slow Drip of Disinformation), 24 (The One-Upmanship Strategy), 25 (The Strategy of the Void / Chaos), possibly 26 (Moral Offensive) or 27 (Seduction Through Fantasy). Source lines roughly 640-760.
- **Core teaching:** When direct confrontation is unavoidable and escalation is live: the disciplines of measured counter-force, escalation management, and operating inside chaos. Covers the failure mode of uncontrolled escalation and the discipline of re-anchoring when the field loses structure.
- **Register:** The most directly confrontational chapter of the book. Pairs with Ch6 (speed/initiative) as its harder twin.
- **Moral flag:** High. This chapter names when force is legitimate and when it tips into coercion and cruelty. It should include explicit ethical analysis in P6 similar to Ch7.

### Ch10 — The Meta-Frame: Choosing When Not to Play
- **Likely source strategies:** 32 (The Strategy of the Grand Gesture / Do Something for Nothing), 33 (Death Ground / Inner Compass / The Ethical Core). Plus a close of the whole book: the recursive move of recognizing when the game itself is the thing to refuse.
- **Core teaching:** The chapter completes the book by pulling back from individual strategies to the meta-question: when does the skilled operator choose not to play? When does victory cost more than the game is worth? The closing discipline is the inner compass — the self-directed judgment that precedes strategic choice. Connects back to Ch1 (field of battle = self) as a deliberate recursion.
- **Register:** Reflective, analytical, slightly slower pace. This is the book's closing note.
- **Moral flag:** Highest. The entire chapter is a moral-structural analysis of strategic choice.
- **Special constraint:** Because Ch10 is a meta-frame, its anchors must be operators who chose not to play a game they could have won. The three anchor situations should each involve a refusal at a moment where strategic action was available and would have succeeded.

---

## THE 14-ARTIFACT PIPELINE (per chapter)

For each chapter, produce these artifacts in order. Never skip a step.

1. `sidecars/source/chNN.source.txt` — paraphrased summary of the source material this chapter teaches (no verbatim quotes)
2. `sidecars/source/chNN.source.json` — structured index: keyConcepts, connectingThread, reversalFlags, callbackOpportunities, moralFlag, moralFlagNote
3. `briefs/chNN.md` — full brief: anchors (2 breakdown characters), example names (6), school settings (2), ethical notes, target word counts, Bloom distribution for quiz
4. `outlines/chNN.md` — 7-paragraph map with per-paragraph job
5. `quiz-blueprints/chNN.md` — 10-question blueprint with correctIndex target `{0:3, 1:4, 2:3}`, Bloom levels q01-03 remember/understand, q04-08 apply/analyze, q09-10 evaluate
6. `drafts/canonical/chNN.md` — ~1080-1150 word canonical draft, 7 paragraphs, opens concretely (not thesis-first), ends with explicit bridge to next chapter
7. `drafts/edited/chNN.md` — tightened version, zero em dashes, zero banned phrases
8. `reports/chNN.critic.md` — 12-point rubric with auto-fail screen; must hit 12/12 and clean auto-fails; if not, apply local patch and re-score
9. `structured/chNN.chapter.json` — full EMH structured JSON (write via Python; see schema below)
10. Verify word counts via `python3` script (see "Word count checks" below); fix any out-of-band tones before proceeding
11. `quizzes/chNN.quiz.json` — extracted from structured JSON with chapterId/chapterNumber/title + full quiz object
12. Compute `contentHash` (SHA-256 of the structured JSON) and write `validated/chNN.chapter.json` (structured JSON + contentHash field)
13. `validated/chNN.review-package.json` — wrapper with schemaVersion 1.1.0, book object, chapters array containing one chapter
14. `reports/chNN.validation.md` + `sidecars/chNN.reading-metrics.json` + update `continuity/continuity-state.json` (add names to `nameUsage`, school settings to `schoolSettingUsage`, names to `withinChapterNames.chNN`) — do NOT add to `approvedChapterHashes` yet (that happens only after user approves the wave)

---

## STRUCTURED JSON SCHEMA

Top-level keys: `chapterId`, `chapterNumber`, `title`, `readingTimeMinutes`, `contentVariants`, `examples`, `quiz`, `implementationPlan`, `reviewCards`, `keyTakeawayCard`.

- `chapterId`: `the-33-strategies-of-war-chNN`
- `chapterNumber`: integer
- `implementationPlan`: `{}` (empty object — per ch04 convention)
- `contentVariants`: `{ easy, medium, hard }`
- `examples`: array of 6
- `quiz`: `{ passingScorePercent, questions }` (questions array of 10)
- `reviewCards`: array of 5 (`{cardId, depth, question, answer}`)
- `keyTakeawayCard`: object

### contentVariants.easy
- `chapterBreakdown`: tone object `{gentle, direct, competitive}` — **each tone 140-175 words**
- `takeaways`: array of **2**, each `{point: "..."}` (no `moreDetails`)
- `oneMinuteRecap`: **flat string** (not tone object)

### contentVariants.medium
- `chapterBreakdown`: tone object `{gentle, direct, competitive}` — **each tone 330-420 words**
- `takeaways`: array of **5**, each `{point, moreDetails}` where moreDetails is a string
- `selfCheckPrompt`: **singular** tone object `{gentle, direct, competitive}`
- `activationPrompt`: tone object `{gentle, direct, competitive}`
- `oneMinuteRecap`: `{retrieve, connect, preview}` — each a string

### contentVariants.hard
- `chapterBreakdown`: tone object `{gentle, direct, competitive}` — **each tone 490-600 words**
- `takeaways`: array of **6**, each `{point, moreDetails}`
- `selfCheckPrompts`: **array of exactly 2** tone objects
- `predictionPrompt`: tone object
- `activationPrompt`: tone object
- `oneMinuteRecap`: `{retrieve, connect, preview}` — each a string

### examples (6 total, each exactly one canonical format and one ending type)
- `{exampleId, title, format, category, endingType, scenario, whatToDo, whyItMatters}`
- `scenario`, `whatToDo`, `whyItMatters` are all tone objects `{gentle, direct, competitive}`
- **Formats (all 6 exactly once):** `decision_point`, `cold_open`, `dialogue`, `case_in_progress`, `dilemma`, `aftermath`
- **Ending types (all 6 exactly once):** `lever`, `pivot`, `resolution`, `discipline`, `commitment`, `lesson`
- **Categories (2 work, 2 school, 2 personal)**
- `exampleId`: `chNN-ex01` through `chNN-ex06`

### quiz
- `passingScorePercent: 70`
- `questions`: array of 10
- Each question: `{questionId, bloomLevel, depth, prompt, choices, correctIndex, explanation}`
- `choices`: exactly 3
- `explanation`: tone object `{gentle, direct, competitive}` — **direct openers must be unique across all 10 questions**
- **correctIndex distribution target: `{0:3, 1:4, 2:3}`** — run the check before writing validated
- **Bloom distribution:** q01-03 remember/understand, q04-08 apply/analyze, q09-10 evaluate

### reviewCards
- 5 total: **2 easy, 2 medium, 1 hard**
- Each card: `{cardId, depth, question, answer}`

### keyTakeawayCard
- Object with `headline` and `body` (check ch06 or ch07 validated file for exact shape)

---

## WRITING THE STRUCTURED JSON — PYTHON SCRIPT PATTERN

Build the dict in Python (single Bash `python3 << 'EOF'` block), dump with `json.dump(indent=2, ensure_ascii=False)`, verify parses, then verify key counts:

```python
import json
d = { ... }  # full chapter dict
with open('.chapterflow/runs/the-33-strategies-of-war/20260406-01/structured/ch08.chapter.json', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
# verify
with open('.chapterflow/runs/the-33-strategies-of-war/20260406-01/structured/ch08.chapter.json') as f:
    d2 = json.load(f)
print('Keys:', list(d2.keys()))
print('Examples:', len(d2['examples']))
print('Quiz questions:', len(d2['quiz']['questions']))
print('ReviewCards:', len(d2['reviewCards']))
```

**Never** attempt to build the structured JSON through Edit/Write calls that type the JSON by hand. Always use Python.

---

## WORD COUNT CHECKS

After writing structured JSON, run this check and fix any FAILs before proceeding:

```bash
python3 << 'EOF'
import json
with open('.chapterflow/runs/the-33-strategies-of-war/20260406-01/structured/ch08.chapter.json') as f:
    d = json.load(f)
cv = d['contentVariants']
bands = {'easy': (140,175), 'medium': (330,420), 'hard': (490,600)}
tones = ['gentle','direct','competitive']
all_ok = True
for depth, (lo, hi) in bands.items():
    bd = cv[depth]['chapterBreakdown']
    for tone in tones:
        wc = len(bd[tone].split())
        status = 'OK' if lo <= wc <= hi else 'FAIL'
        if status == 'FAIL': all_ok = False
        print(f'{depth}.{tone}: {wc} [{lo}-{hi}] {status}')
print('ALL OK' if all_ok else 'BAND FAILURES DETECTED')
EOF
```

If any tones fail, patch only the failing tone(s) using a Python script that loads the JSON, modifies the specific `cv[depth]['chapterBreakdown'][tone]` string, writes the JSON back, and re-runs the check. Do not touch the structured JSON through Edit/Write.

---

## CONTENT HASH COMPUTATION (exact method)

```python
import json, hashlib
path = '.chapterflow/runs/the-33-strategies-of-war/20260406-01/structured/ch08.chapter.json'
with open(path) as f:
    d = json.load(f)
hash_input = json.dumps(d, sort_keys=True, ensure_ascii=False)
content_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
print("contentHash:", content_hash)
d['contentHash'] = content_hash
validated_path = '.chapterflow/runs/the-33-strategies-of-war/20260406-01/validated/ch08.chapter.json'
with open(validated_path, 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
```

The hash is computed on the structured JSON **before** the `contentHash` field is added. The resulting hash is then inserted into the validated copy.

---

## VALIDATION CHECKLIST (run before writing validation report)

Run a Python check that confirms ALL of these PASS before writing the validation report:

- `chapterId == 'the-33-strategies-of-war-chNN'`
- `chapterNumber == N`
- `contentHash` present (non-empty)
- `implementationPlan == {}`
- All 9 word count tones in band
- Easy: 2 takeaways, no `moreDetails`, flat string `oneMinuteRecap`
- Medium: 5 takeaways with `moreDetails`, singular `selfCheckPrompt` tone object, `oneMinuteRecap {retrieve, connect, preview}`
- Hard: 6 takeaways with `moreDetails`, `selfCheckPrompts` list of exactly 2, `predictionPrompt` present, `oneMinuteRecap {retrieve, connect, preview}`
- Examples: 6 count, all 6 `format` values present, all 6 `endingType` values present, 2/2/2 `category` split
- Quiz: 10 questions, correctIndex distribution `{0:3, 1:4, 2:3}`, 3 choices each, unique direct-opener explanations
- ReviewCards: 5 count, split 2 easy / 2 medium / 1 hard
- `keyTakeawayCard` present
- **Zero em dashes** (`\u2014`) in any breakdown text
- No names or school settings reused from `continuity-state.json`

See Ch6 and Ch7 validation reports at `reports/ch06.validation.md` and `reports/ch07.validation.md` for the exact template.

---

## STYLE RULES (read this carefully — lifted from `memory/style-memory.md`)

### Banned globally
- **Em dashes (`—`) — zero tolerance.** Use a hyphen `-` or rewrite the sentence. Run a post-write scan for `\u2014` on every draft and every breakdown text.
- **Banned phrases:** "in this chapter," "this material teaches," "as mentioned," "let's dive in," "it's important to note," "at the end of the day," "in today's world," "in the modern era," "needless to say," "as we discussed," "by and large," "that being said." Zero tolerance. Run a phrase scan on edited drafts.
- **Banned skeletons:** "X is [adjective1] and [adjective2] and [adjective3]" (triadic listing), "It's not about X, it's about Y" (it's-not-it's construction), "Let me explain..." (meta-explanation openers).
- **First sentence must NOT be thesis-first.** Open on a concrete situation. The thesis emerges from the concrete.
- **No Greene historical case studies.** Napoleon, Hannibal, Sun Tzu, Mao, Patton, Rommel, Lawrence of Arabia, Cannae, Austerlitz — none of these may appear. All examples and scenarios are invented fresh.

### Tone differentiation (gentle/direct/competitive)
- **Gentle:** explanatory, patient, uses more verbs of invitation ("notice," "consider"). Slightly higher word count within band.
- **Direct:** information-dense, minimal hedging, lean prose. Mid-to-low within band.
- **Competitive:** framed around advantage, margins, and what the disciplined operator gains relative to others. Mid within band. **Not aggressive — just competitive in framing.**

### Reader prose rules
- Every chapter has 7 paragraphs.
- Paragraph 1 opens concretely (hook via the first breakdown anchor's situation).
- Paragraphs 2-6 are the teaching body with clear per-paragraph jobs; no paragraph-job overlap.
- Paragraph 7 is a bridge to the next chapter with explicit forward-reference.
- Every moral or ethical flag must be stated once in the medium breakdown and given full treatment in the hard breakdown. Medium = name the line. Hard = analyze both sides and give the structural (not just moral) argument for staying on the legitimate side.
- Reversals must be explicit: each core discipline taught in the chapter must name the failure mode where the discipline backfires.

### Prose quality markers
- Sharp and specific sentences; avoid general maxims.
- "Strongest sentence" of the chapter should do analytical work, not emotional work.
- Anchor characters' situations must be load-bearing (carry the teaching), not decorative.

---

## CONTINUITY DISCIPLINE

- **Zero name reuse across all 10 chapters.** Before choosing names for a new chapter, load `continuity/continuity-state.json`, read `nameUsage` keys, and pick new names that do not appear. Avoid near-homophones of used names.
- **Anchor/example separation within a chapter:** The 2 breakdown anchor names must NOT appear in any example. The 6 example character names must NOT appear in any breakdown text. Within-chapter cross-check this before writing validated.
- **School setting reuse is also banned** across the book. Use the `schoolSettingUsage` key as the reference.
- **Update the continuity state** after each chapter (add names to `nameUsage`, schools to `schoolSettingUsage`, names to `withinChapterNames.chNN`). Do NOT add to `approvedChapterHashes` until the user approves the wave.

---

## PIPELINE EXECUTION FOR EACH CHAPTER

For Ch8, Ch9, and Ch10, execute in this exact order:

1. Read `.chapterflow/sources/the-33-strategies-of-war/the-33-strategies-of-war.txt` at the relevant line range (use chapter-map.md as the guide) and extract the core teaching
2. Read `continuity/continuity-state.json` to pick fresh names and school settings
3. Write `sidecars/source/chNN.source.txt` (paraphrased, no verbatim)
4. Write `sidecars/source/chNN.source.json` (structured index)
5. Write `briefs/chNN.md` with anchors, example names, school settings, ethical notes, word count targets, Bloom distribution
6. Write `outlines/chNN.md` (7-paragraph map)
7. Write `quiz-blueprints/chNN.md` (10-question plan with target correctIndex distribution)
8. Write `drafts/canonical/chNN.md` (~1080-1150 words, 7 paragraphs, opens concrete)
9. Write `drafts/edited/chNN.md` (tighten, scan for em dashes, scan for banned phrases)
10. Write `reports/chNN.critic.md` (12-point rubric + auto-fail screen; must be 12/12 clean or apply local patch and re-score)
11. Write `structured/chNN.chapter.json` via Python (full EMH + examples + quiz + reviewCards + keyTakeawayCard)
12. Run word count check; fix any FAILs via Python patch
13. Extract and write `quizzes/chNN.quiz.json`
14. Compute contentHash and write `validated/chNN.chapter.json`
15. Write `validated/chNN.review-package.json`
16. Run full validation checklist; write `reports/chNN.validation.md`
17. Write `sidecars/chNN.reading-metrics.json`
18. Update `continuity/continuity-state.json` (names, schools, withinChapterNames) — do NOT add approvedChapterHashes

After completing both chapters in a wave, run the artifact guard (see below), update the run log, and present the wave gate.

---

## ARTIFACT GUARD (run between chapters and before wave gate)

```python
import os
run_root = '/Users/willsoltani/dev/chapterflow-siliconx/.chapterflow/runs/the-33-strategies-of-war/20260406-01'
artifacts = [
    'sidecars/source/ch{n:02d}.source.txt',
    'sidecars/source/ch{n:02d}.source.json',
    'briefs/ch{n:02d}.md',
    'outlines/ch{n:02d}.md',
    'quiz-blueprints/ch{n:02d}.md',
    'drafts/canonical/ch{n:02d}.md',
    'drafts/edited/ch{n:02d}.md',
    'reports/ch{n:02d}.critic.md',
    'structured/ch{n:02d}.chapter.json',
    'quizzes/ch{n:02d}.quiz.json',
    'validated/ch{n:02d}.chapter.json',
    'validated/ch{n:02d}.review-package.json',
    'reports/ch{n:02d}.validation.md',
    'sidecars/ch{n:02d}.reading-metrics.json',
]
fail, warn = 0, 0
for ch_num in [8, 9]:  # or [10] for Wave 5
    for pat in artifacts:
        path = os.path.join(run_root, pat.format(n=ch_num))
        if not os.path.exists(path):
            print(f'FAIL: {path}'); fail += 1
        elif os.path.getsize(path) == 0:
            print(f'WARN: {path}'); warn += 1
print(f'FAIL={fail} WARN={warn}')
```

Require `FAIL=0 WARN=0` before presenting the wave gate.

---

## WAVE GATE FORMAT

After completing Ch8+Ch9 (or Ch10 for Wave 5), update `reports/run-log.md` with a "Phase 7 Wave N" entry, then present the wave gate to the user in this format:

```
## WAVE N GATE — Chapters X & Y

Status: READY FOR APPROVAL
Artifact guard: FAIL=0 WARN=0

### Ch0X — <title>
| Item | Value |
|---|---|
| Critic score | 12/12, zero auto-fails |
| Validation | N/N PASS |
| contentHash | <hash> |
| Word counts | <summary> |
| Examples | decision_point · cold_open · dialogue · case_in_progress · dilemma · aftermath |
| Endings | lever · pivot · resolution · discipline · commitment · lesson |
| Category split | 2 work / 2 school / 2 personal |
| Quiz distribution | {0:3, 1:4, 2:3} ✓ |
| Anchors | <name1>, <name2> |
| Example chars | <6 names> |
| School settings | <2 settings> |
| Moral flag | <low/medium/high> — <one sentence> |

### Ch0Y — <title>
[same structure]

### Continuity state
- Reserved names: <total>
- School settings: <total>
- No name reuse detected across any chapter

**Approve Wave N to lock Ch0X+Ch0Y hashes and begin Wave N+1?**
```

Stop and wait for user approval. Do not begin the next wave or phase until the user types approval. When the user approves, lock the wave's chapter hashes into `continuity/continuity-state.json → approvedChapterHashes` (as plain strings, matching existing entries), then begin the next wave immediately.

---

## PHASE 8 — RELEASE GATE (after Ch10 is approved)

### Step 1: Assemble the release package

Write the release file at:
`.chapterflow/runs/the-33-strategies-of-war/20260406-01/release/the-33-strategies-of-war.modern.json`

Create the `release/` directory if needed. Use Python via Bash:

```python
import json, uuid
from datetime import datetime, timezone

run_root = '/Users/willsoltani/dev/chapterflow-siliconx/.chapterflow/runs/the-33-strategies-of-war/20260406-01'
chapters = []
for n in range(1, 11):
    with open(f'{run_root}/validated/ch{n:02d}.chapter.json') as f:
        chapters.append(json.load(f))

envelope = {
    "schemaVersion": "1.1.0",
    "packageId": str(uuid.uuid4()),
    "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "contentOwner": "ChapterFlow",
    "book": {
        "bookId": "the-33-strategies-of-war",
        "title": "The 33 Strategies of War",
        "author": "Robert Greene",
        "edition": "First Edition (2006)"
    },
    "chapters": chapters
}

import os
os.makedirs(f'{run_root}/release', exist_ok=True)
with open(f'{run_root}/release/the-33-strategies-of-war.modern.json', 'w') as f:
    json.dump(envelope, f, indent=2, ensure_ascii=False)

print(f"Chapters in release: {len(envelope['chapters'])}")
print(f"packageId: {envelope['packageId']}")
```

**Critical constraint:** `releaseAssembleFromValidatedOnly: true`. Load from `validated/` only. Do not modify any chapter content during assembly.

### Step 2: Hash integrity check

Re-compute the SHA-256 content hash of each chapter in the release and confirm it matches the locked hash in `continuity-state.json`. The hash method is the same used when writing validated (SHA-256 of `json.dumps(chapter_without_contentHash, sort_keys=True, ensure_ascii=False)`). Implementation:

```python
import json, hashlib
run_root = '/Users/willsoltani/dev/chapterflow-siliconx/.chapterflow/runs/the-33-strategies-of-war/20260406-01'
with open(f'{run_root}/continuity/continuity-state.json') as f:
    cs = json.load(f)
for ch_num in range(1, 11):
    ch_id = f'ch{ch_num:02d}'
    path = f'{run_root}/validated/{ch_id}.chapter.json'
    with open(path) as f:
        d = json.load(f)
    stored_hash = d.pop('contentHash', None)
    recomputed = hashlib.sha256(json.dumps(d, sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()
    locked = cs['approvedChapterHashes'].get(ch_id)
    match_locked = (recomputed == locked)
    match_stored = (recomputed == stored_hash)
    print(f'{ch_id}: locked_match={"OK" if match_locked else "DRIFT"} stored_match={"OK" if match_stored else "DRIFT"}')
```

If any hash drifts, stop and investigate before proceeding. Do not assemble the release with drifted hashes.

### Step 3: Write release validation and audit reports

Write:
- `reports/release-validation.md` — record hash check results, assembly method, chapter count (10), schema version, packageId
- `reports/release-audit.md` — record that `releaseAssembleFromValidatedOnly` was honored, that `preserveApprovedChapterHashes` was verified, that no chapter content was modified during assembly

### Step 4: Update run log with Phase 8 completion

---

## PHASE 9 — WIRE AND BUILD

### Step 1: Copy release file into book-packages

```bash
cp /Users/willsoltani/dev/chapterflow-siliconx/.chapterflow/runs/the-33-strategies-of-war/20260406-01/release/the-33-strategies-of-war.modern.json /Users/willsoltani/dev/chapterflow-siliconx/book-packages/the-33-strategies-of-war.modern.json
```

### Step 2: Run the repo validator

```bash
cd /Users/willsoltani/dev/chapterflow-siliconx && node scripts/book/validate-book.mjs book-packages/the-33-strategies-of-war.modern.json
```

Require **zero errors**. Common failures:

- **Word counts outside bands:** Find the specific chapter and depth in the validated JSON. Fix the minimum number of words via Python patch. Recompute SHA-256. Update `continuity-state.json`. Re-assemble the release. Re-copy to book-packages.
- **Missing or wrong-shaped tone objects:** Fix in the validated chapter JSON, re-copy, re-assemble.
- **Wrong example/ending/review-card counts:** Fix in the validated chapter JSON, re-copy, re-assemble.
- **TypeScript type mismatch on a field ChapterFlow schema allows:** Flag it and ask the user before modifying anything.

If the build fails after 3 repair attempts on the same issue, stop and ask the user.

### Step 3: Build

```bash
cd /Users/willsoltani/dev/chapterflow-siliconx && npm run build
```

All must pass.

### Step 4: Update run log with Phase 9 completion

---

## NON-NEGOTIABLE RULES

1. **Never regenerate chapter content.** Once validated, chapters are hash-locked. If you need to fix a word count, change only the specific text that is out of range. Do not rewrite surrounding prose. Do not change structural fields that are not failing.

2. **After any modification to a validated chapter file, recompute SHA-256 and update `continuity-state.json → approvedChapterHashes`.** The hash in continuity-state.json is ground truth. If you modify a file and do not update the hash, the integrity chain is broken.

3. **Assemble from `validated/` only.** Never from `structured/` or `drafts/`.

4. **Use Python via Bash for all JSON assembly and modification.** Do not hand-type JSON through Edit/Write calls. Build the dict in Python, dump, verify parses.

5. **Update the run log after each phase and wave.** The log at `reports/run-log.md` is the source of truth.

6. **If the build fails after 3 repair attempts on the same issue, stop and ask the user.** Do not keep iterating without progress.

7. **Always use absolute paths** from `/Users/willsoltani/dev/chapterflow-siliconx`.

8. **Never use the Bash `find` or `grep` commands.** Use the Grep and Glob tools. Use Read instead of cat/head/tail. Use Edit instead of sed/awk. Use Write for new files. The Bash tool is reserved for shell execution that requires shell features (Python scripts, `npm`, `node`, `cp`, etc.).

9. **Zero em dashes, zero banned phrases, zero Greene historical case studies.** These are auto-fail conditions.

10. **The pack root `scripts/book/prompts/chapterflow-v12-sealed/` does not physically exist.** All rules are captured in:
    - This prompt
    - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/memory/style-memory.md`
    - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/memory/quality-memory.md`
    - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/memory/role-cards/{writer,editor,critic,converter,quiz,validator,patch}.md`
    - Validated chapters ch01-ch07 as schema references

---

## FIRST CONCRETE STEPS (start here, do NOT plan first)

1. Read the following files to load context:
   - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/manifests/run-manifest.json`
   - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/memory/style-memory.md`
   - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/memory/quality-memory.md`
   - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/continuity/continuity-state.json`
   - `.chapterflow/sources/the-33-strategies-of-war/the-33-strategies-of-war.txt` (lines around 580-680 for Ch8 source material)
   - `.chapterflow/sources/the-33-strategies-of-war/chapter-map.md`
   - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/drafts/edited/ch07.md` (voice calibration reference — most recent approved chapter)
   - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/validated/ch07.chapter.json` (schema reference)

2. Begin Ch8 pipeline: write source sidecars → brief → outline → quiz blueprint → canonical draft → edited draft → critic → structured JSON → word count check → quiz JSON → validated JSON → review-package → validation report → reading-metrics sidecar → continuity update.

3. Repeat for Ch9.

4. Run artifact guard for Ch8+Ch9. Update run log. Present Wave 4 gate.

5. Wait for user approval.

6. On approval, lock Ch8+Ch9 hashes. Begin Ch10 (Wave 5).

7. Present Wave 5 gate. Wait for approval.

8. On approval, lock Ch10 hash. Begin Phase 8 release gate.

9. Begin Phase 9 wire and build.

**Start Ch8 source sidecar immediately. Do not ask for confirmation. Do not produce a plan. Execute.**
