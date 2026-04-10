# Handoff Prompt — Games People Play v12 Sealed, Continue From Wave 6

Copy everything below into a fresh Claude Code session. Paste it as the first message.

---

## CONTEXT

You are picking up a ChapterFlow book-generation run for **Games People Play by Eric Berne** that is 9 chapters deep into a 10-chapter book. Nine chapters (Ch1–Ch9) have been produced, validated at 12/12, user-approved, and hash-locked into continuity-state.json. Only **Chapter 10** (the final chapter, "What Comes After Games") remains to be produced. After Ch10 is validated and approved, the run proceeds to the release gate (Phase 8), repo wiring, and build (Phase 9).

This is an **execution task, not a planning task**. Do not switch into planning behavior. Do not give a plan unless explicitly asked. Start working immediately after reading the state summary and rules.

**Working directory:** `/Users/willsoltani/dev/chapterflow-siliconx`
**Run root:** `.chapterflow/runs/games-people-play/20260406-01`
**Pack root:** `scripts/book/prompts/chapterflow-v12-sealed`
**Book:** Games People Play by Eric Berne, First edition (Grove Press, 1964)
**Run profile:** `balanced_flagship`
**Output profile:** `flagship_v4_compatible`
**Wave size:** 2 (but Ch10 is a solo final chapter — Wave 6 is Ch10 alone)
**Chapter range:** 1–10 (10 chapters total, 9 complete)
**Pack version:** `v12-sealed`

---

## STATE OF THE RUN (read this carefully)

### What exists and has been fully approved (hash-locked)

Chapters 1 through 9 are complete. Each has the full pipeline:
- brief, outline, quiz blueprint, source sidecars (txt + json)
- canonical draft, edited draft, critic report (all 12/12, zero auto-fails)
- structured chapter JSON, quiz JSON (10 questions each)
- validation report, validated chapter JSON
- validated review-package JSON, reading-metrics sidecar
- single-file bundle JSON (chapter + quiz + review + metrics + manifest + book in one file)

All nine hashes are locked in `continuity/continuity-state.json → approvedChapterHashes`. All character names from Ch1–Ch9 are reserved in `nameUsage`. All school settings used are reserved in `schoolSettingUsage`.

**Approved chapters and their titles:**
- Ch1 "The Three Voices Inside You" (Parent / Adult / Child as three observable behavioral states)
- Ch2 "What a Transaction Is and Why They Go Wrong" (complementary vs crossed transactions as two-arrow diagrams)
- Ch3 "Ulterior Transactions and the Anatomy of a Game" (two-level transactions + four-part game anatomy)
- Ch4 "Why Games Feel So Hard to Stop" (strokes + life positions + order-of-operations limit)
- Ch5 "Life Games" (biographical-scale patterns: exploitability, righteous-outrage, displaced-blame, over-commitment)
- Ch6 "Marital Games" (intimacy-avoidance mechanisms: Corner, IWFY, Sweetheart)
- Ch7 "Party and Social Games" (short-duration group patterns: AIA, WDYYB, Blemish; with the moving-vs-circling limit)
- Ch8 "Professional and Therapy-Room Games" (ITHY, Wooden Leg, Greenhouse; helper as structural part of game)
- Ch9 "Games That Aren't Worth Fighting" (good games: Busman's Holiday, Homely Sage, Happy To Help; see-and-leave-alone discipline)

### What remains

- **Ch10 "What Comes After Games"** (the final chapter, about Awareness, Spontaneity, and Intimacy as the three qualities of autonomy — all Ch10-reserved vocabulary)
- **Phase 8:** Release gate (assemble release package, run release lint and release guard)
- **Phase 9:** Wire and build (copy into repo at `book-packages/games-people-play.modern.json`, validate, build)

### Supporting files already in place

- `scripts/book/prompts/chapterflow-v12-sealed/` — full pack, audit passes
- `.chapterflow/sources/games-people-play/games-people-play.txt` — paraphrased reference source (601 lines)
- `.chapterflow/sources/games-people-play/chapter-map.md` — 10-chapter mapping with intents
- `.chapterflow/sources/games-people-play/criticism-and-limits.md` — moral-complexity guidance (especially for gendered 1964 framings)
- `.chapterflow/sources/games-people-play/key-concepts.md`, `historical-context.md`, `modern-applications.md`

---

## YOUR TASK (execute in order; do not deviate)

### Phase A — Load context (read, do not re-plan)

1. Read `scripts/book/prompts/chapterflow-v12-sealed/README.md`
2. Read `scripts/book/prompts/chapterflow-v12-sealed/SCHEMA_NOTES.md`
3. Read `scripts/book/prompts/chapterflow-v12-sealed/MasterGenerator-v12.md`
4. Read `scripts/book/prompts/chapterflow-v12-sealed/rules/chapter-quality-gate.md`
5. Read `scripts/book/prompts/chapterflow-v12-sealed/rules/chapter-structure.md`
6. Read `scripts/book/prompts/chapterflow-v12-sealed/rules/hard-depth-rules.md`
7. Read `scripts/book/prompts/chapterflow-v12-sealed/rules/scenario-tone-rules.md`
8. Read `scripts/book/prompts/chapterflow-v12-sealed/rules/quiz-rules.md`
9. Read `scripts/book/prompts/chapterflow-v12-sealed/style/voice.md`
10. Read `scripts/book/prompts/chapterflow-v12-sealed/style/constraints.md` (banned phrases, sentence skeletons, em dash rule)
11. Read `scripts/book/prompts/chapterflow-v12-sealed/style/bad-patterns.md`
12. Read `scripts/book/prompts/chapterflow-v12-sealed/briefs/brief-template.md`, `chapter-outline-template.md`, `quiz-blueprint-template.md`

13. Read `.chapterflow/runs/games-people-play/20260406-01/manifests/run-manifest.json`
14. Read `.chapterflow/runs/games-people-play/20260406-01/reports/run-log.md` (full history of all five waves)
15. Read `.chapterflow/runs/games-people-play/20260406-01/continuity/continuity-state.json` (approved hashes + all reserved names)
16. Read `.chapterflow/runs/games-people-play/20260406-01/skeleton/book-skeleton.md` (10-chapter plan)
17. Read `.chapterflow/runs/games-people-play/20260406-01/memory/style-memory.md` and `memory/quality-memory.md`
18. Read `.chapterflow/runs/games-people-play/20260406-01/memory/role-cards/writer.md`, `editor.md`, `critic.md`, `converter.md`, `quiz.md`, `validator.md`, `patch.md`

19. Read a few of the approved chapters to match the voice and depth:
    - `.chapterflow/runs/games-people-play/20260406-01/drafts/edited/ch01.md` (shortest, cleanest example)
    - `.chapterflow/runs/games-people-play/20260406-01/drafts/edited/ch04.md` (concept-dense synthesis chapter, closest structurally to Ch10)
    - `.chapterflow/runs/games-people-play/20260406-01/drafts/edited/ch09.md` (most recent catalog chapter)
    - `.chapterflow/runs/games-people-play/20260406-01/validated/ch04.chapter.json` (structured JSON shape reference; Ch4 is the densest synthesis and the closest analog to what Ch10 needs)

20. Read Ch10 source material:
    - `.chapterflow/sources/games-people-play/games-people-play.txt` lines 531–572 (Part III: Beyond Games, including the Autonomy triad)
    - `.chapterflow/sources/games-people-play/chapter-map.md` for Ch10 intent

---

### Phase B — Produce Ch10 "What Comes After Games"

Ch10 is the final chapter and the synthesis chapter. It pays the debt left by every prior chapter about what replaces games. The structure is:

**Core claim to deliver:** Berne named three qualities that together constitute autonomy — the capacity to live without games. They are awareness (perceiving directly, in the present, rather than through Parent programming or Child reaction), spontaneity (choosing and expressing feelings from the full range of one's ego states rather than being locked into pre-programmed responses), and intimacy (game-free directness in relation to another person). These are not techniques. They are what remains when the games fall away. The chapter is honest about how hard that is: autonomy is available but requires giving up the strokes that games provide, which is much harder than it sounds.

**Critical structural moves the chapter must make:**
1. The chapter has to pay the debt Ch4 left open. Ch4 said leaving games requires replacement strokes and life position updates. Ch10 has to name what the replacement is: awareness as a substitute for the stroke delivery of a pattern, spontaneity as the alternative to pre-programmed response, intimacy as the game-free direct contact that the closest relationships were organized around avoiding.
2. The chapter has to extend Ch9's see-and-leave-alone discipline into the positive direction: what do you do when the destructive games are slowly left and the good games are protected? The answer is this triad.
3. The chapter has to honestly refuse the self-help read. Berne thought autonomy was available but not easy, and the chapter must hold that tension. Awareness is not "mindfulness." Spontaneity is not "just be yourself." Intimacy is not a technique. Each is the thing that happens when the structure around it is slowly dismantled.
4. The chapter closes the book. Its ending has to close a ten-chapter arc, not open a new question. This is the only chapter in the pipeline where the ending is not a bridge to a next chapter.

**Anchor requirements:** use three neutral, contemporary anchors that show one of the three qualities each, in real-world rather than clinical settings. These must not reuse any Ch1–Ch9 character names (see the name ledger). Examples of the kind of anchor that works: a person slowly building awareness by catching themselves mid-pattern over weeks; a person experiencing spontaneity for the first time in a specific situation where their Parent or Child had always spoken first; two friends in a conversation that is intimate in Berne's sense precisely because neither of them is running a pattern anymore. The anchors must be specific and vivid, not abstract.

**Hard-depth tension (the chapter's honest limit):** Autonomy is easier to describe than to reach, and the chapter has to say this. Each of the three qualities has a failure mode that the chapter names. Awareness can collapse back into observation-as-practice, which is itself a kind of pattern. Spontaneity can collapse into compulsive reaction. Intimacy is rare in Berne's framing and the chapter should not promise it will be frequent. The threshold question: if the triad is rare even for people who have done the work, is naming it still worth doing? The chapter answers yes, and says why.

**Forbidden content:**
- Any new game names not already covered in Ch1–Ch9
- Any return to the catalog (Ch5–Ch9 cover the catalog; Ch10 is post-catalog)
- Pop-mindfulness framing
- Neurochemistry, evolutionary psychology, or brain-region claims
- Character names already used in Ch1–Ch9 (check `continuity/continuity-state.json → nameUsage` for the full list of 76+ reserved names)
- Contamination phrases from bad-patterns.md
- Em dashes (use commas, colons, parentheses, or period breaks)
- Banned phrases from constraints.md (delve, crucial, landscape, realm, "at its core", "the art of", navigating, harnessing, robust, synergy, "paradigm shift", "game-changer", facilitate, utilize, foster, "embark on", "a testament to", "shed light on", "This matters because", "This is significant because", "It is essential to", "It's worth noting", "In today's world", Furthermore, Moreover, "In conclusion")
- Banned sentence skeletons (X is not Y. It is Z., "The real issue is...", "What matters is...", "This changes everything.", "The difference is...")

**New Ch10 cast suggestions** (all fresh, none used in Ch1–Ch9): Solenne, Casimir, Anneli, Ottavia, Takeshi, Fenna, Galina, Coach Oduya, Mikkel, Valeria, Elio.

**Produce the full 16-artifact bundle for Ch10:**
1. `briefs/ch10.md` (use brief-template.md as the template; fill every field; include Source Sidecar Path, Required Anchors with concrete detail, Author Logic Chain, Frameworks/Terms Introduced, Moral Complexity, Concept Budget, Hard-Depth Minimum, Unsupported Zones, Assigned Scenario Assets with primary names and format/category map for 6 examples, Banned Names from Ch1–Ch9, Paths block)
2. `outlines/ch10.md` (use chapter-outline-template.md; paragraph job map for 7 paragraphs; scenario lesson map for 6 examples; takeaway count lock — Easy 3, Medium 5 or 6, Hard 5 or 6 or 7; threshold question; forbidden drift)
3. `quiz-blueprints/ch10.md` (10 questions: q01–q03 remember/understand, q04–q08 apply/analyze with q04–q06 using named-character scenarios, q09–q10 evaluate/create; correctIndex plan roughly balanced 0/1/2; draft plan must sum to 10 with each index appearing 3–4 times)
4. `sidecars/source/ch10.source.txt` (authorized source slices from Part III of the source document; include the hard-depth tension as a slice; include continuity discipline slice listing the new Ch10 cast)
5. `sidecars/source/ch10.source.json` (structured index of those slices; `forbiddenContent` array; `provenance` note)
6. `drafts/canonical/ch10.md` (7 paragraphs, flagship length ~800–900 words, movement Hook → Build → Deliver → Close. The final paragraph is a close, not a bridge, because there is no next chapter.)
7. `drafts/edited/ch10.md` (remove any em dashes; scan for banned phrases; verify no Ch1–Ch9 names reused; verify ending closes the book)
8. `reports/ch10.critic.md` (12/12 rubric with auto-fail scan, craft checks, strongest sentence, verdict)
9. `structured/ch10.chapter.json` (full structured shape matching Ch4's structure; use the Ch4 validated JSON as the structural template)
10. `quizzes/ch10.quiz.json` (exactly 10 questions, 3 choices each, tone-object explanations, correctIndex balanced, direct-explanation openers all distinct with no 4+ word overlap and no banned openers like "The strongest answer", "The best answer", "The correct response")
11. `reports/ch10.validation.md` (mechanical checks, prose checks, verdict PASS)
12. `validated/ch10.chapter.json` (copy of structured, no patches needed if lint passes)
13. `validated/ch10.review-package.json` (wrapper with coreClaim, anchorsUsed, hardDepthTension, strongestQualities, remainingConcerns, approvalRequired, preserveApprovedHash)
14. `sidecars/ch10.reading-metrics.json` (word counts per tone per depth, examples breakdown, quiz breakdown, review cards breakdown)
15. `validated/ch10.bundle.json` (single-file bundle: manifest policy block + book block + chapter + quiz + reviewPackage + readingMetrics + validationStatus)
16. Update `reports/run-log.md` with the Wave 6 Ch10 production record

**Word count targets per tone per depth:**
- Easy: 140–175 words each for gentle, direct, competitive
- Medium: 330–420 words each for gentle, direct, competitive
- Hard: 490–600 words each for gentle, direct, competitive
Use `len(text.split())` to verify. These are hard limits for the release gate.

**Examples structure:** exactly 6 examples, all 6 canonical formats once (short_dialogue, first_person, third_person_scene, coaching_script, narrative_flashback, inner_monologue), 2 work / 2 school / 2 personal, each of the 6 canonical ending types once (observation, reflection, reframe, forward_question, decision_point, unresolved_tension). Every scenario / whatToDo / whyItMatters must be a tone object with gentle / direct / competitive that are substantively different in function, not adjective swaps.

**Review cards:** exactly 5, distribution 2 easy / 2 medium / 1 hard. Each with front + back. Front and back can be plain strings (not tone objects) to match the Ch1–Ch9 convention.

**Key takeaway card:** tone object with gentle / direct / competitive.

**Implementation plan:** title + steps array (4 steps, actionable, specific to the reader's own life).

### Phase C — Ch10 approval gate

After Ch10 validates clean at 12/12:
1. Lock ch10 hash into `continuity/continuity-state.json → approvedChapterHashes.ch10`
2. Add Ch10 cast to `nameUsage`
3. Present the approval gate to the user, matching the format of the previous gates (which are visible in the run log): chapter title, 12/12 quality-gate breakdown, bundle path, artifact list, strongest qualities, remaining concerns, and the required line "**Chapter 10 is ready for review. Approve this chapter to proceed to the release gate and build.**"
4. Wait for user approval.

### Phase D — Release gate (Phase 8)

Only after Ch10 is user-approved and hash-locked:

1. Assemble the release package at `.chapterflow/runs/games-people-play/20260406-01/release/games-people-play.modern.json`. Load each `validated/chNN.chapter.json` in order 1–10 and wrap in the envelope:
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
   **Do not regenerate chapter bodies.** Only assemble from `validated/` files. This is required by `releaseAssembleFromValidatedOnly: true` in the manifest.

2. Verify `preserveApprovedChapterHashes: true` by re-computing the canonical SHA-256 of each validated chapter file and confirming it still matches `continuity-state.json → approvedChapterHashes`. If any hash has drifted, stop and investigate.

3. If the pack provides release-gate tools, run them:
   ```bash
   # Check for release guard tool
   ls scripts/book/prompts/chapterflow-v12-sealed/tools/ 2>/dev/null
   # If release guard exists:
   python3 scripts/book/prompts/chapterflow-v12-sealed/tools/chapterflow_v12_release_guard.py .chapterflow/runs/games-people-play/20260406-01 .chapterflow/runs/games-people-play/20260406-01/release/games-people-play.modern.json
   ```
   v12-sealed may not have tooling parity with v13 — if the tools do not exist, skip to the repo validator (Phase E).

4. Write `reports/release-validation.md` and `reports/release-audit.md` per the MasterGenerator Phase 8 requirement.

### Phase E — Wire into repo and build (Phase 9)

1. Copy the release file into the repo's book-packages directory:
   ```bash
   cp .chapterflow/runs/games-people-play/20260406-01/release/games-people-play.modern.json book-packages/games-people-play.modern.json
   ```

2. Run the repo validator:
   ```bash
   node scripts/book/validate-book.mjs book-packages/games-people-play.modern.json
   ```
   Require zero errors. Common failures to expect:
   - Word counts outside the 140–175 / 330–420 / 490–600 bands → fix in the validated chapter, recopy, revalidate
   - Missing or wrong-shaped tone objects → fix in the validated chapter
   - Wrong counts of examples / ending types / review cards → fix in the validated chapter

3. Run lint on the repo package:
   ```bash
   # If v12 lint tool exists
   python3 scripts/book/prompts/chapterflow-v12-sealed/tools/chapterflow_v12_lint.py book-packages/games-people-play.modern.json release_gate 2>/dev/null || echo "v12 lint tool not available, continuing"
   ```

4. Build:
   ```bash
   npm run build
   ```
   All must pass before the run is complete. If the build fails on a field the ChapterFlow schema allows but the repo's TypeScript types do not, flag it and ask the user.

5. Update the run log with Phase 8 and Phase 9 completion notes.

---

## NON-NEGOTIABLE RULES (learned across 9 chapters; do not deviate)

### Content rules

1. **Zero em dashes in any reader-facing content.** Use commas, colons, parentheses, or period breaks. Scan every draft and every structured JSON with `grep -c "—"` before validating. If you find any, replace them.

2. **Zero banned phrases.** See `scripts/book/prompts/chapterflow-v12-sealed/style/constraints.md` for the full list. Partial list: delve, crucial, landscape, realm, "at its core", "the art of", navigating, harnessing, robust, synergy, "paradigm shift", "game-changer", facilitate, utilize, foster, "embark on", "a testament to", "shed light on", "This matters because", "This is significant because", "It is essential to", "It's worth noting", "In today's world", Furthermore, Moreover, "In conclusion".

3. **Zero banned sentence skeletons.** No "X is not Y. It is Z.", no "The real issue is...", no "What matters is...", no "This changes everything.", no "The difference is...". Rewrite as `X is Z, not Y` or `X is Z rather than Y` or restructure entirely.

4. **Zero contamination phrases from brief/outline language.** Do not leak "threshold question", "anchor", "moreDetails", "concept budget", "sourceAnchorPriority", "motif watchlist", "hard-depth" into reader prose. These are internal scaffolding words and they break the fourth wall.

5. **Hard depth must be structurally different from medium, not a longer version.** This is the specific failure mode the pack warns about. Hard must add a boundary condition, failure mode, contradiction, threshold question, unresolved tension, or synthesis across concepts that is not present in medium at all. Medium answers "how does this work?" and hard answers "what breaks it, or what does it imply downstream that the mechanism alone does not explain?"

6. **Tone objects must produce 3 substantively different strings.** Gentle / direct / competitive must differ in function (reassure / clean mechanism / stakes), not just in adjectives. Spot-check: if you can mechanically transform one tone to another by swapping a few words, the tones are collapsed and the chapter will fail validation.

7. **Moral framing:** Berne's book is built on the claim that game-players are adaptive, not contemptible. Every chapter must hold this. Do not moralize the players. Do not dramatize their suffering. Do not cast them as victims or villains. The framing is structural-diagnostic throughout.

8. **No gendered 1964 framings.** All anchors must use neutral, contemporary settings with modern names. See `.chapterflow/sources/games-people-play/criticism-and-limits.md` for the full guidance.

### Structural rules

9. **Examples:** exactly 6 per chapter. All 6 canonical formats exactly once: short_dialogue, first_person, third_person_scene, coaching_script, narrative_flashback, inner_monologue. Distribution: 2 work / 2 school / 2 personal. All 6 canonical ending types exactly once: observation, reflection, reframe, forward_question, decision_point, unresolved_tension. Every scenario, whatToDo, and whyItMatters is a tone object.

10. **Review cards:** exactly 5. Distribution 2 easy / 2 medium / 1 hard. Each has id, difficulty, front (string), back (string). This matches the Ch1–Ch9 convention. Do not switch to tone objects for review cards without reason.

11. **Quiz:** exactly 10 questions. Exactly 3 choices each. `correctIndex` ∈ {0, 1, 2}. Distribution q01–q03 easy (remember/understand), q04–q08 medium (apply/analyze with q04–q06 using named-character scenarios), q09–q10 hard (evaluate/create). Roughly balanced correctIndex (target ≈3-4-3 across 0/1/2). Every explanation is a tone object.

12. **Quiz explanation openers:** each direct-explanation opener must begin differently. No two direct explanations share 4+ opening words. No banned opener phrases ("The strongest answer...", "The best answer...", "The correct response..."). Verify by extracting the first 4 words of each direct explanation and checking for uniqueness.

13. **Quiz prompt shape:** all 10 prompts must vary their opening shape. No "best applies", "best reflects", "real-world decision tied to" canned phrasings. No chapter titles in quotes in the prompts.

14. **keyTakeaways counts:**
    - Easy: exactly 3, each with `point` only (no `moreDetails`)
    - Medium: 5 or 6, each with `point` + `moreDetails`
    - Hard: 5, 6, or 7, each with `point` + `moreDetails`

15. **contentVariants shape:**
    - `easy`: `{chapterBreakdown (tone object), keyTakeaways (3 items, point only), oneMinuteRecap (flat tone object)}`
    - `medium`: `{chapterBreakdown (tone object), keyTakeaways (5-6 items with moreDetails), activationPrompt (tone object), selfCheckPrompt (singular, tone object), oneMinuteRecap {retrieve, connect, preview}}`
    - `hard`: `{chapterBreakdown (tone object), keyTakeaways (5-7 items with moreDetails), activationPrompt (tone object), selfCheckPrompts (array of exactly 2 tone objects), predictionPrompt (tone object), oneMinuteRecap {retrieve, connect, preview}}`

16. **Word counts** (enforced at release gate):
    - Easy: 140–175 words per tone
    - Medium: 330–420 words per tone
    - Hard: 490–600 words per tone
    Verify with `len(text.split())` before writing the validated file.

17. **Continuity discipline:** zero character-name reuse across Ch1–Ch10. The full list of reserved names is in `continuity/continuity-state.json → nameUsage`. Before assigning a name to Ch10, grep for it in that file. There are 76+ reserved names across nine chapters.

18. **No Berne catalog names in reader prose unless already established.** Ch10 should not introduce new game catalog names. All catalog coverage is complete in Ch5–Ch9.

19. **Forbidden scope drift in Ch10:**
    - Do not return to the catalog
    - Do not introduce new structural concepts beyond the Autonomy triad
    - Do not preempt anything (there is no next chapter)
    - Do not moralize or self-help

### Process rules

20. **No planning mode.** Execute phases in order. Do not generate plans, do not ask permission between steps. The pipeline is known.

21. **Use Python via Bash for large JSON writes.** Writing the structured chapter JSON via multiple Edit tool calls is unreliable. Use a single Python script via the Bash tool with a heredoc that builds the full dict, writes it once with `json.dump(indent=2, ensure_ascii=False)`, and verifies it parses with a readback. This was the reliable approach across Ch1–Ch9.

22. **Always use absolute paths** or paths relative to the repo root `/Users/willsoltani/dev/chapterflow-siliconx`. Use the Bash tool with commands that assume the working directory is the repo root.

23. **Update the run log after every phase.** The run log at `.chapterflow/runs/games-people-play/20260406-01/reports/run-log.md` is the source of truth for what has happened. Append to it after Ch10 production, after approval, after release gate, after build.

24. **Source-of-truth order for every chapter:** (1) chapter brief, (2) chapter outline, (3) edited draft, (4) rules/chapter-structure.md. Never invent facts beyond the brief and the edited draft.

### Quality escalation

25. **If Ch10 scores below 12/12 on the critic, do not force it through.** Either local-patch specific paragraphs (patch agent) or escalate to a repair pass (repair agent) that rewrites the flagged sections. All nine prior chapters scored 12/12 with zero auto-fails; Ch10 should meet the same bar.

26. **If you get stuck in a retry loop** (same validation failure after 3 attempts), stop and ask the user. Do not keep pounding on the same problem with the same approach.

---

## STRUCTURAL TEMPLATE FOR CH10 PROSE

The chapter's seven paragraphs should map approximately as:

- **P1:** Open in a scene. A specific person in a specific moment where something that has always been a pattern is not, this time, a pattern. They do not yet have a word for what is different. Do not name awareness, spontaneity, or intimacy yet. The reader should feel the absence of the game before the vocabulary arrives.

- **P2:** Name the question the book has been building toward. The first nine chapters have been about patterns. This chapter is about what remains when the patterns go. Introduce Berne's claim: he named three qualities that together constitute autonomy. Name the three briefly (awareness, spontaneity, intimacy) but do not unpack them yet.

- **P3:** Awareness. Not as mindfulness, not as observation-practice. As the capacity to perceive what is actually in front of you, in the present, rather than through the filters of Parent programming or Child reaction. Use one of the three anchors. The anchor should show someone noticing something directly that they would previously have filed into a pattern. Name the failure mode: awareness can collapse back into observation-as-practice, which is itself a structure.

- **P4:** Spontaneity. Not as impulsivity, not as "being yourself". As the freedom to respond from whichever of the three ego states is actually appropriate to the situation in front of you, rather than being locked into the one your history keeps reaching for. Use a second anchor. The anchor should show someone responding from a state they do not usually have access to, in a setting where their default state would have been counter-productive. Name the failure mode: spontaneity can collapse into compulsive reaction, which is also a pattern.

- **P5:** Intimacy. The term has been reserved for this chapter through nine chapters. Now it gets its definition: game-free direct contact between two people who are both, in the moment, present with each other rather than with their patterns. This is Berne's rarest and hardest quality. Use a third anchor. The anchor should show a specific exchange between two people where neither is running a pattern on the other, and both of them can tell. Do not dramatize it. Keep it concrete and small.

- **P6:** The honest limit. The triad is available but rare. It is not a technique. It is what remains when the structure around it is slowly dismantled. The chapter is not promising the reader will have it frequently. The chapter is saying it exists and is worth knowing about, and that most of the work in the previous nine chapters was quietly about making the triad possible.

- **P7:** The close. This is the only chapter in the book where the ending is not a bridge. Close the ten-chapter arc. Do not ask a new question. Do not preview. Name what the book has tried to give the reader and what it has refused to promise. End with a sentence that could stand as the last sentence of the book.

---

## APPROACH FOR WRITING CH10 QUICKLY AND CLEANLY

1. Read Ch4's validated JSON first. Ch4 is structurally the closest analog to Ch10: it is the densest synthesis chapter in the book, it handles multiple interlocking concepts (strokes + life positions + stickiness equation), it has a strict order-of-operations limit in hard depth, and it carries the premium-routing designation. The JSON shape you want for Ch10 is the same shape Ch4 uses.

2. Read Ch9's validated JSON second. Ch9 is the most recent chapter and handles the transition from catalog to post-catalog. Its see-and-leave-alone discipline directly sets up Ch10's positive framing. Ch9 also uses a shorter word count profile (per the skeleton's thin-chapter mitigation); Ch10 should use the standard flagship profile (targets at the upper end of each range).

3. For the structured JSON, use a Python heredoc script. Build the dict in pieces:
   - Start with the metadata (chapterId, number, title, readingTimeMinutes)
   - Build contentVariants with easy, medium, hard — write the three breakdown tones for each depth first, then the keyTakeaways, then the prompts and recaps
   - Build the examples array (6 items), using Ch4 or Ch9 as the structural template
   - Build the quiz questions array (10 items)
   - Add implementationPlan, reviewCards, keyTakeawayCard
   - Dump with `json.dump(indent=2, ensure_ascii=False)`
   - Verify it parses and count key structural elements (6 examples, 10 questions, correct takeaway counts per depth)

4. After writing the structured JSON, extract the quiz to `quizzes/ch10.quiz.json`, copy to `validated/ch10.chapter.json`, build the review package and reading metrics, then build the bundle. All of this can be one Python script.

5. Run a word-count audit on the six chapterBreakdown paragraphs before writing the validation report. If any are outside the target range, fix them before advancing.

---

## FILES YOU SHOULD READ FIRST (in this order)

```
scripts/book/prompts/chapterflow-v12-sealed/README.md
scripts/book/prompts/chapterflow-v12-sealed/SCHEMA_NOTES.md
scripts/book/prompts/chapterflow-v12-sealed/MasterGenerator-v12.md
scripts/book/prompts/chapterflow-v12-sealed/rules/chapter-quality-gate.md
scripts/book/prompts/chapterflow-v12-sealed/rules/chapter-structure.md
scripts/book/prompts/chapterflow-v12-sealed/rules/hard-depth-rules.md
scripts/book/prompts/chapterflow-v12-sealed/rules/scenario-tone-rules.md
scripts/book/prompts/chapterflow-v12-sealed/rules/quiz-rules.md
scripts/book/prompts/chapterflow-v12-sealed/style/voice.md
scripts/book/prompts/chapterflow-v12-sealed/style/constraints.md
scripts/book/prompts/chapterflow-v12-sealed/style/bad-patterns.md

.chapterflow/runs/games-people-play/20260406-01/manifests/run-manifest.json
.chapterflow/runs/games-people-play/20260406-01/reports/run-log.md
.chapterflow/runs/games-people-play/20260406-01/continuity/continuity-state.json
.chapterflow/runs/games-people-play/20260406-01/skeleton/book-skeleton.md
.chapterflow/runs/games-people-play/20260406-01/memory/style-memory.md
.chapterflow/runs/games-people-play/20260406-01/memory/quality-memory.md

.chapterflow/runs/games-people-play/20260406-01/drafts/edited/ch01.md
.chapterflow/runs/games-people-play/20260406-01/drafts/edited/ch04.md
.chapterflow/runs/games-people-play/20260406-01/drafts/edited/ch09.md
.chapterflow/runs/games-people-play/20260406-01/validated/ch04.chapter.json
.chapterflow/runs/games-people-play/20260406-01/validated/ch09.chapter.json

.chapterflow/sources/games-people-play/games-people-play.txt
.chapterflow/sources/games-people-play/chapter-map.md
.chapterflow/sources/games-people-play/criticism-and-limits.md
```

---

## FIRST CONCRETE STEPS

1. Read all files in the list above, in order. Do not skip the tool sources (constraints.md, bad-patterns.md) — the banned-phrase list is long and specific.

2. Confirm the state by running:
   ```bash
   ls .chapterflow/runs/games-people-play/20260406-01/validated/ch*.chapter.json
   ```
   You should see ch01 through ch09.

3. Confirm the continuity state:
   ```bash
   python3 -c "import json; cs=json.load(open('.chapterflow/runs/games-people-play/20260406-01/continuity/continuity-state.json')); print('Approved:', list(cs['approvedChapterHashes'].keys())); print('Reserved names:', len(cs['nameUsage']))"
   ```
   You should see 9 approved chapters and 76+ reserved names.

4. Start Phase B: produce Ch10. Begin work immediately. Do not produce a plan. Do not ask permission. Write the brief first, then the outline, then the quiz blueprint, then the source sidecars, then the canonical draft, then the edited draft, then the critic report, then the structured JSON (via Python heredoc), then the quiz JSON, then the validation report, then the validated chapter, then the review package, then the reading metrics, then the bundle. Update the run log. Present the approval gate to the user.

Begin now.
