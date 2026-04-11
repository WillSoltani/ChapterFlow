# Handoff Prompt — The 33 Strategies of War, Continue From Wave 5 + Phase 8 + Phase 9

Copy everything below the `---` line into a fresh Claude Code session. Paste it as the first message.

---

## CONTEXT

You are completing a ChapterFlow book-generation run for **The 33 Strategies of War by Robert Greene**. Chapters 1 through 9 are complete, validated at 12/12, and user-approved. Their hashes are locked in `continuity/continuity-state.json → approvedChapterHashes`. Wave 4 (Ch8+Ch9) was approved on 2026-04-10.

Your job is to execute **Wave 5 (Ch10 alone — the meta-frame closing chapter with highest moral complexity)**, then the **Wave 5 approval gate**, then **Phase 8 (release gate)**, then **Phase 9 (repo wire + build)**.

This is an **execution task, not a planning task**. Do not switch into planning behavior. Do not give a plan unless explicitly asked. Start working immediately on Ch10 dossier.

**Working directory:** `/Users/willsoltani/dev/chapterflow-siliconx`
**Run root:** `.chapterflow/runs/the-33-strategies-of-war/20260406-01`
**Book:** The 33 Strategies of War by Robert Greene, First Edition (2006)
**bookId:** `the-33-strategies-of-war`
**Run profile:** `balanced_flagship`
**Output profile:** `flagship_v4_compatible`
**Pack version:** `v12-sealed`
**Wave size:** 2 (Wave 5 is Ch10 alone — the final chapter)
**Chapter range:** 1-10

---

## STATE OF THE RUN

### All 9 chapters are complete and hash-locked

| Ch | Title | Hash (SHA-256) |
|----|-------|---------------|
| Ch1 | Know Your Field of Battle | 95ae8f10ec32725deee1acbb0d08f0270df7fa3dd6ea948d8bd9fd89f26fab65 |
| Ch2 | Leading Through Other People | de1791807573325e7fcad1ed119af5b88ff45d2e9ae3c48652eef1bf72462bcb |
| Ch3 | Choosing Not to Fight | da103a369d710c9d7fdabfe7cfb6e1cd58db7ee179850a9b0ef13dcc7bba3b8a |
| Ch4 | Absorbing and Returning an Attack | 3123fd92921ece401a4e6c1fa3b00629694d78585dc0e3bab9229e39637ec086 |
| Ch5 | The Long View | 5606e79f6f08049efd4fd6bb8683fe6da8787f342a0f326eb58254a23f88d75b |
| Ch6 | Speed, Initiative, and the Decisive Point | 272fc62fc02ffcb5154231227bf09dca6feaf8d8d2f7f491f3b045ea9e73ae86 |
| Ch7 | Indirection: Flank, Wedge, Long Maneuver | eb5965db250f362089e8b8f9aa62d2ebf6cf3affb0aa39119c63cfb911ebe699 |
| Ch8 | Negotiated Outcomes and Clean Exits | 3b5051bafdf21fa7054cad944c06cc75f62e152ba934641d85d1620e829857ba |
| Ch9 | The Line of Least Expectation | aafe75478017068f251b67f80d16232d2761792a8e4b33cf851a7b6f181f781e |

### Continuity state after Wave 4
- **Reserved names (80 total):** Devon, Imani, Aiden, Ruth, Priya, Marcus, Elena, Yara (ch01); Naya, Tomas, Camila, Bea, Jamil, Hadiya, Kiran, Sora, Niko, Renzo, Reyna (ch02); Ines, Wesley, Aditi, Rafael, Mira, Linnea, Saira (ch03); Dara, Kenji, Petra, Felix, Chisom, Rowan, Isolde, Clem, Bastian (ch04); Luca, Tariq, Suki, Yemi, Cormac, Nadia, Bram, Orla, Zaid (ch05); Phoebe, Declan, Amara, Kofi, Sigrid, Idris, Wren, Caius (ch06); Maisie, Theron, Fola, Leif, Soren, Tanvi, Gus, Kalani (ch07); Hana, Vaughn, Noor, Jude, Lila, Eamon, Celia, Tess (ch08); Margot, Ravi, Ingrid, Tobias, Maren, Dante, Sylvie, Koa (ch09); plus Aanya, Junichi, Owen, Vivek from earlier waves.
- **School settings used (18):** graduate-writing-seminar, undergraduate-thesis, phd-committee, master-program, high-school-chemistry, high-school-debate, undergraduate-economics-lab, high-school-yearbook, law-school-trial-advocacy, high-school-economics-class, mba-strategy-seminar, high-school-speech-and-debate, phd-defense-seminar, high-school-math-olympiad, undergraduate-political-science, high-school-model-un, undergraduate-business-negotiation, high-school-student-newspaper, graduate-public-policy, high-school-literary-magazine, graduate-philosophy-seminar, high-school-robotics, high-school-student-government, history-graduate-seminar, organic-chemistry-recitation, university-debate-team
- **Do not reuse** any name or school setting from above in Ch10.
- Verify by loading `continuity/continuity-state.json` at the start: read `nameUsage` and `schoolSettingUsage` keys.

---

## CHAPTER 10 TARGET — THE MOST IMPORTANT CHAPTER

### Ch10 — The Edge Cases and When to Put the Framework Down

**Covers:** Strategies 19 (Annihilation), 25 (Righteous / Moral High Ground), 28 (One-Upmanship), 30 (Communication / Penetrate Minds), 31 (Inner-Front / Destroy from Within), 32 (Passive-Aggression), 33 (Chain-Reaction / Sow Panic). These are the highest-risk, highest-ethical-weight strategies from the book, consolidated into the closing chapter.

**Source lines:** `.chapterflow/sources/the-33-strategies-of-war/the-33-strategies-of-war.txt` lines ~550-560 (Strategy 19 Annihilation), 663-680 (Strategy 25 Righteous), 709-720 (Strategy 28 One-Upmanship), 737-748 (Strategy 30 Communication), 750-759 (Strategy 31 Inner-Front), 761-771 (Strategy 32 Passive-Aggression), 773-791 (Strategy 33 Chain-Reaction). Plus Part VI meta-lessons at lines 793-835.

**Core teaching:** Three things the reader should leave with:
1. An understanding of what the dirty/high-cost strategies actually do and when they apply in their legitimate forms
2. A clear sense of the ethical limits the book itself underplays — when these strategies shade into manipulation, coercion, or cruelty, stated explicitly
3. An explicit list of situations in which the framework should be put down entirely (intimacy, grief, genuine collaboration, contexts where the other side is not an opponent)

**Register:** Reflective, analytical, slightly slower pace. This is the book's closing note. Not a triumphant summary — a sobering one that completes the recursive loop back to Ch1 (the first enemy is you → the final question is whether to play at all).

**Moral flag:** HIGHEST of the entire book. The entire chapter is a moral-structural analysis of strategic choice. The hard breakdown should be the book's most honest and careful ethical analysis.

**Special constraints:**
- The anchors must be operators who chose NOT to play a game they could have won, or who recognized that strategic framing was the wrong frame for the situation.
- The chapter must explicitly name situations where the framework should not be applied: intimacy, grief, genuine collaboration, contexts where the counterparty is not an opponent.
- The chapter must NOT romanticize the dirty strategies. Present what they do, name their legitimate applications, name their illegitimate applications, and name the ethical limits Greene underplays.
- The bridge/closing should complete the book's loop: Ch1 started with the self as the first opponent; Ch10 ends with the self-directed judgment to know when not to play.

**Meta-lessons from the source (Part VI, lines 793-835) — weave these into Ch10:**
- Self-mastery before any external move
- The indirect move is usually better than the direct one
- Strategy is the long view; tactics is the short view
- The best fight is the one you don't have to fight
- Know when NOT to use the framework

---

## THE 14-ARTIFACT PIPELINE (per chapter)

For Ch10, produce these artifacts in order. Never skip a step.

1. `sidecars/source/ch10.source.txt` — paraphrased summary of source material
2. `sidecars/source/ch10.source.json` — structured index
3. `briefs/ch10.md` — full brief with anchors, example names, school settings, ethical notes
4. `outlines/ch10.md` — 7-paragraph map
5. `quiz-blueprints/ch10.md` — 10-question blueprint, correctIndex `{0:3, 1:4, 2:3}`
6. `drafts/canonical/ch10.md` — ~1080-1150 words, 7 paragraphs, opens concretely
7. `drafts/edited/ch10.md` — tightened, zero em dashes, zero banned phrases
8. `reports/ch10.critic.md` — 12-point rubric, must be 12/12 clean
9. `structured/ch10.chapter.json` — full EMH via Python (see schema below)
10. Word count check — fix any FAILs via Python patch
11. `quizzes/ch10.quiz.json` — extracted from structured JSON
12. Compute contentHash, write `validated/ch10.chapter.json`
13. `validated/ch10.review-package.json`
14. `reports/ch10.validation.md` + `sidecars/ch10.reading-metrics.json` + update continuity (do NOT add to approvedChapterHashes yet)

---

## STRUCTURED JSON SCHEMA

Top-level keys: `chapterId`, `chapterNumber`, `title`, `readingTimeMinutes`, `contentVariants`, `examples`, `quiz`, `implementationPlan`, `reviewCards`, `keyTakeawayCard`.

- `chapterId`: `the-33-strategies-of-war-ch10`
- `chapterNumber`: 10
- `implementationPlan`: `{}` (empty object)

### contentVariants.easy
- `chapterBreakdown`: tone object `{gentle, direct, competitive}` — **each tone 140-175 words**
- `takeaways`: array of **2**, each `{point: "..."}` (no `moreDetails`)
- `oneMinuteRecap`: **flat string** (not tone object)

### contentVariants.medium
- `chapterBreakdown`: tone object — **each tone 330-420 words**
- `takeaways`: array of **5**, each `{point, moreDetails}`
- `selfCheckPrompt`: **singular** tone object
- `activationPrompt`: tone object
- `oneMinuteRecap`: `{retrieve, connect, preview}`

### contentVariants.hard
- `chapterBreakdown`: tone object — **each tone 490-600 words**
- `takeaways`: array of **6**, each `{point, moreDetails}`
- `selfCheckPrompts`: **array of exactly 2** tone objects
- `predictionPrompt`: tone object
- `activationPrompt`: tone object
- `oneMinuteRecap`: `{retrieve, connect, preview}`

### examples (6 total)
- `{exampleId, title, format, category, endingType, scenario, whatToDo, whyItMatters}`
- `scenario`, `whatToDo`, `whyItMatters` are all tone objects `{gentle, direct, competitive}`
- **Formats (all 6 exactly once):** `decision_point`, `cold_open`, `dialogue`, `case_in_progress`, `dilemma`, `aftermath`
- **Ending types (all 6 exactly once):** `lever`, `pivot`, `resolution`, `discipline`, `commitment`, `lesson`
- **Categories:** 2 work / 2 school / 2 personal
- `exampleId`: `ch10-ex01` through `ch10-ex06`

### quiz
- `passingScorePercent: 70`
- `questions`: array of 10, each `{questionId, bloomLevel, depth, prompt, choices, correctIndex, explanation}`
- `choices`: exactly 3
- `explanation`: tone object — **direct openers must be unique across all 10 questions**
- **correctIndex distribution: `{0:3, 1:4, 2:3}`**
- **Bloom:** q01-03 remember/understand, q04-08 apply/analyze, q09-10 evaluate

### reviewCards — 5 total: 2 easy, 2 medium, 1 hard
Each: `{cardId, depth, question, answer}`

### keyTakeawayCard — `{headline, body}`

---

## PYTHON PATTERNS

### Writing structured JSON
```python
import json
d = { ... }  # full chapter dict
with open('.chapterflow/runs/the-33-strategies-of-war/20260406-01/structured/ch10.chapter.json', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
with open('.chapterflow/runs/the-33-strategies-of-war/20260406-01/structured/ch10.chapter.json') as f:
    d2 = json.load(f)
print('Keys:', list(d2.keys()))
print('Examples:', len(d2['examples']))
print('Quiz questions:', len(d2['quiz']['questions']))
print('ReviewCards:', len(d2['reviewCards']))
```

### Word count check
```python
import json
with open('.chapterflow/runs/the-33-strategies-of-war/20260406-01/structured/ch10.chapter.json') as f:
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
```

### Content hash computation
```python
import json, hashlib
path = '.chapterflow/runs/the-33-strategies-of-war/20260406-01/structured/ch10.chapter.json'
with open(path) as f:
    d = json.load(f)
hash_input = json.dumps(d, sort_keys=True, ensure_ascii=False)
content_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
d['contentHash'] = content_hash
with open('.chapterflow/runs/the-33-strategies-of-war/20260406-01/validated/ch10.chapter.json', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
```

---

## VALIDATION CHECKLIST (run before writing validation report)

All of these must PASS:
- `chapterId == 'the-33-strategies-of-war-ch10'`, `chapterNumber == 10`
- `contentHash` present, `implementationPlan == {}`
- All 9 word count tones in band
- Easy: 2 takeaways, no moreDetails, flat string oneMinuteRecap
- Medium: 5 takeaways with moreDetails, singular selfCheckPrompt, activationPrompt, oneMinuteRecap {r,c,p}
- Hard: 6 takeaways with moreDetails, selfCheckPrompts list of 2, predictionPrompt, activationPrompt, oneMinuteRecap {r,c,p}
- Examples: 6 count, all 6 formats, all 6 endings, 2/2/2 categories
- Quiz: 10 questions, correctIndex {0:3,1:4,2:3}, 3 choices each, unique direct openers
- ReviewCards: 5 count, 2/2/1 split
- keyTakeawayCard present
- Zero em dashes in breakdowns
- No name reuse from continuity state

---

## STYLE RULES

### Banned globally
- **Em dashes (`—`) — zero tolerance.** Use `--` or rewrite.
- **Banned phrases:** "in this chapter," "this material teaches," "as mentioned," "let's dive in," "it's important to note," "at the end of the day," "in today's world," "in the modern era," "needless to say," "as we discussed," "by and large," "that being said," delve, crucial, landscape, realm, "It's worth noting," Furthermore, Moreover, "In conclusion," "at its core," "the art of," navigating, harnessing, robust, synergy, "paradigm shift," "game-changer," facilitate, utilize, foster, "embark on," "a testament to," "shed light on," "This matters because," "This is significant because," "It is essential to."
- **Banned skeletons:** "X is not Y. It is Z." / "The real issue is..." / "What matters is..." / "This changes everything." / "The difference is..."
- **First sentence must NOT be thesis-first.** Open concretely.
- **No Greene historical case studies.** No Napoleon, Hannibal, Sun Tzu, Mao, Patton, Rommel, Lawrence of Arabia.

### Tone differentiation
- **Gentle:** lower resistance, warmer framing, room to breathe.
- **Direct:** clearest mechanics, decision line, no decoration.
- **Competitive:** sharper stakes, leverage, consequence, who-eats-whom framing.
- Tones must do **different jobs**, not say the same thing louder.

---

## CONTINUITY DISCIPLINE

- **Zero name reuse** across all 10 chapters. Load continuity state and verify.
- **Anchor/example separation within the chapter:** 2 breakdown anchors must NOT appear in examples. 6 example characters must NOT appear in breakdown text.
- **School settings** also cannot be reused.
- Update continuity after Ch10 (names, schools, withinChapterNames). Do NOT add to approvedChapterHashes until user approves Wave 5.

---

## WAVE 5 GATE FORMAT

After completing Ch10, run the artifact guard, update run log, and present:

```
## WAVE 5 GATE — Chapter 10

Status: READY FOR APPROVAL
Artifact guard: FAIL=0 WARN=0

### Ch10 — <title>
| Item | Value |
|---|---|
| Critic score | 12/12, zero auto-fails |
| Validation | 28/28 PASS |
| contentHash | <hash> |
| Word counts | <summary> |
| Examples | decision_point · cold_open · dialogue · case_in_progress · dilemma · aftermath |
| Endings | lever · pivot · resolution · discipline · commitment · lesson |
| Category split | 2 work / 2 school / 2 personal |
| Quiz distribution | {0:3, 1:4, 2:3} ✓ |
| Anchors | <names> |
| Example chars | <6 names> |
| School settings | <2 settings> |
| Moral flag | Highest — <one sentence> |

### Continuity state
- Reserved names: <total>
- School settings: <total>

**Approve Wave 5 to lock Ch10 hash and begin Phase 8 release gate?**
```

Wait for user approval. On approval, lock Ch10 hash into `approvedChapterHashes`, then proceed immediately to Phase 8.

---

## PHASE 8 — RELEASE GATE (after Ch10 is approved)

### Step 1: Assemble the release package

Write: `.chapterflow/runs/the-33-strategies-of-war/20260406-01/release/the-33-strategies-of-war.modern.json`

Create the `release/` directory if needed. Use Python:

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

print(f"Chapters: {len(envelope['chapters'])}")
print(f"packageId: {envelope['packageId']}")
```

**Critical:** `releaseAssembleFromValidatedOnly: true`. Load from `validated/` only. Do not modify chapter content.

### Step 2: Hash integrity check

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
    match = (recomputed == locked) and (recomputed == stored_hash)
    print(f'{ch_id}: {"OK" if match else "DRIFT"} — {recomputed[:16]}...')
```

If any hash drifts, **stop and investigate**.

### Step 3: Write release reports

- `reports/release-validation.md` — hash results, assembly method, chapter count (10), schema version, packageId
- `reports/release-audit.md` — `releaseAssembleFromValidatedOnly` honored, `preserveApprovedChapterHashes` verified, no content modified

### Step 4: Update run log with Phase 8 completion

---

## PHASE 9 — WIRE AND BUILD

### Step 1: Copy to book-packages
```bash
cp /Users/willsoltani/dev/chapterflow-siliconx/.chapterflow/runs/the-33-strategies-of-war/20260406-01/release/the-33-strategies-of-war.modern.json /Users/willsoltani/dev/chapterflow-siliconx/book-packages/the-33-strategies-of-war.modern.json
```

### Step 2: Validate
```bash
cd /Users/willsoltani/dev/chapterflow-siliconx && node scripts/book/validate-book.mjs book-packages/the-33-strategies-of-war.modern.json
```

Require **zero errors**. If word counts fail: fix in validated JSON via Python, recompute hash, update continuity, re-assemble, re-copy. If TypeScript type mismatch: flag and ask user.

### Step 3: Build
```bash
cd /Users/willsoltani/dev/chapterflow-siliconx && npm run build
```

### Step 4: Update run log with Phase 9 completion

If build fails after 3 repair attempts on the same issue, stop and ask the user.

---

## NON-NEGOTIABLE RULES

1. **Never regenerate chapter content.** Hash-locked chapters are immutable. Fix only the specific failing text.
2. **After any modification to a validated file, recompute SHA-256 and update `continuity-state.json → approvedChapterHashes`.** The hash is ground truth.
3. **Assemble from `validated/` only.** Never from `structured/` or `drafts/`.
4. **Use Python via Bash for all JSON assembly.** Do not hand-type JSON.
5. **Update the run log after each phase.**
6. **If the build fails after 3 attempts, stop and ask the user.**
7. **Always use absolute paths** from `/Users/willsoltani/dev/chapterflow-siliconx`.
8. **Never use Bash `find` or `grep`.** Use Grep and Glob tools. Use Read instead of cat. Use Edit instead of sed.
9. **Zero em dashes, zero banned phrases, zero Greene historical case studies.** Auto-fail conditions.
10. **The pack root `scripts/book/prompts/chapterflow-v12-sealed/` does not exist.** All rules are captured in:
    - This prompt
    - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/memory/style-memory.md`
    - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/memory/quality-memory.md`
    - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/memory/role-cards/{writer,editor,critic,converter,quiz,validator,patch}.md`
    - Validated chapters ch01-ch09 as schema references

---

## FIRST CONCRETE STEPS (start here, do NOT plan first)

1. Read the following files to load context:
   - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/manifests/run-manifest.json`
   - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/memory/style-memory.md`
   - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/memory/quality-memory.md`
   - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/continuity/continuity-state.json`
   - `.chapterflow/sources/the-33-strategies-of-war/the-33-strategies-of-war.txt` (lines 550-560 for Strategy 19, lines 663-791 for Strategies 25-33, lines 793-835 for meta-lessons)
   - `.chapterflow/sources/the-33-strategies-of-war/chapter-map.md` (Ch10 section at lines 281-312)
   - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/drafts/edited/ch09.md` (voice calibration reference)
   - `.chapterflow/runs/the-33-strategies-of-war/20260406-01/validated/ch09.chapter.json` (schema reference)

2. Begin Ch10 pipeline: source sidecars → brief → outline → quiz blueprint → canonical draft → edited draft → critic → structured JSON → word count check → quiz JSON → validated JSON → review-package → validation report → reading-metrics sidecar → continuity update.

3. Run artifact guard for Ch10 (check all 14 artifacts). Update run log. Present Wave 5 gate.

4. Wait for user approval.

5. On approval, lock Ch10 hash. Begin Phase 8 release gate immediately.

6. Begin Phase 9 wire and build.

**Start Ch10 source sidecar immediately. Do not ask for confirmation. Do not produce a plan. Execute.**
