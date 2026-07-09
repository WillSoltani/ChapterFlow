# V24 CF-I Prompt Pack — machinery-leakage into reader-facing prose

**Campaign:** CF-I (approved 2026-07-09; folds in the C31 evaluator-voice follow-up)
**Origin:** `docs/v24/V24_CONTENT_FEEDBACK_VERIFICATION_REPORT.md` §7.2–7.3 (the multipliers
direct read) — quote-level evidence for every symptom.
**Companion roadmap:** `docs/v24/V24_CF_I_ROADMAP.md`
**Branch:** `feat/anti-sameness-live-fix` over commit `260fa13e0` (the CF-A..CF-F wave).
**Pipeline root (`PIPE/`):** `scripts/book/prompts/chapterflow-v24-author-pipeline/`

## The disease, precisely

The pipeline narrates its own machinery to the reader. Verified entry points (diagnosed in
code + generated artifacts, 2026-07-09):

| # | Symptom | Verified source | Evidence |
|---|---------|-----------------|----------|
| S1 | Meta-case examples — protagonist is "the case / the draft / the weak version", incl. editor-facing process talk | Writer over-compliance with grounding + rule-7's decision/consequence demand when a source case has no scene actors | multipliers ch02 ex02: "In the weak version, growth mindset stayed as a slogan… The late fix used Nadella's 2014 CEO appointment as the concrete anchor." |
| S2 | Quiz keys/explanations reward citing source lineage instead of applying the idea | No card rule says keys test APPLICATION; `sourceGrounding.ts` demands keyEvidence anchor-traceability and the writer makes traceability the ANSWER | ch08 q01 key: "Tie the move to Getting to Yes and its named authors… so the frame is traceable"; explanation: "The source lineage matters here." |
| S3 | Dealt beat-vocabulary as house phrasing ("return point… set (but not met)", "early signal", "late catch") | **The dealt arc/lens instruction strings themselves** — `PIPE/src/compiler/briefRotation.ts:515` `"still-open": "ends unresolved; the return point is set but not yet met"`, `:495` `"before-anyone-notices": "open on the early signal nobody has flagged yet"` — echoed verbatim into prose (the same mint disease CF-F killed for "agreement nods" at `:111`) | ch06+ch08 body: "the return point is set (but not met)"; verbatim 8-gram in ch04 AND ch07 |
| S4 | Date-as-doorway — CF-A's concrete-doorway rule satisfied by a dated citation, not a scene | Rule 8 DOORWAY says "concrete beat — actor, scene, object, or named cost"; a `2009 deck` / `May 2010 HBR` citation qualifies lexically | 7 of 9 multipliers fastRead ledes open on a dated citation; only ch03/ch07 open on a person in a moment |
| S5 | C31 evaluator voice persists (question-opener example fields) | Write-time rule alone under-enforces; **repair/retry lanes never see the C31 complaint** (rubric-preflight failures carry fix lines into the retry card; C31 advisories do not) | C31 fired multipliers ch02/ch08 (10 openers each; 2.22/ch vs HOM 1.56) |
| S6 | Cross-book leaked lines (4 known beyond "agreement nods") | Unknown origin — detection/planning ONLY this campaign (owner decision 5) | Sweep: "the limit is just as important" [12 books], "the overcorrection is easy to miss" [3], "the ending is evidence not a time machine" [2], "that is part of its value" [2] |

Existing partial defense to build on, not duplicate: self-verify item 4 SCAFFOLD
(`PIPE/src/orchestrator/authorRun.ts:346`) already bans lexical scaffold tokens (slot names,
anchor ids, "Fact 2" numbering). CF-I extends that from *tokens* to *narrative register*.

## Red-team constraints baked into every prompt (Phase-4 results)

1. **Books genuinely about documents/drafts/cases** (e.g. a writing or legal book) must not be
   flagged: the meta-case detector exempts chapters whose source packet's named cases ARE
   documents/artifacts, and it requires machinery nouns in SUBJECT position across MULTIPLE
   fields before firing. Advisory only.
2. **Legitimate historical dates** are content, not gaming: the doorway detector fires only
   when a date/publication citation is the lede's ONLY concreteness — a dated scene ("On May
   25, 1961, Kennedy stood before Congress and…") passes because a person acts.
3. **No bland-prose overcorrection:** prevention rewrites instruction WORDING (the dealt arcs/
   lenses keep their shapes); nothing bans concreteness, artifacts, or structure. No rule may
   mandate a "human scene" per example — that would mint the next mold; the rule targets
   machinery nouns in subject position only.
4. **Quiz rigor preserved:** keyEvidence anchor-traceability (sourceGrounding) is untouched.
   Only the ANSWER CONTENT rule changes: the correct choice tests applying the idea; citations
   may still appear in explanations as support, never as the tested skill.
5. **No gate changes:** every new detector is advisory-minor; C31 stays advisory; repair
   routing is directive-TEXT only. `ENFORCED_MAJOR`, verdict predicates, contracts, D9,
   OPENER_TYPES, rubric weights untouched.
6. **No overfit:** all detectors tuned + pinned on three corpora (v24 gold start-with-why, the
   published HOM package, the fresh multipliers chapters); thresholds justified with measured
   numbers; no book-specific strings in src.
7. **Published books untouched** (multipliers is UNPUBLISHED — its repair in CF-I-4 is legal;
   HOM and the catalog are not edited).

## Global constraints (ALL prompts)

Do not push. Do not publish (CF-I-4 has an explicit owner checkpoint BEFORE its publish step).
Do not lower gates or weaken blockers/contracts. Do not invent facts or fake examples. Do not
break schema. Do not mass-edit published books. Do not reopen `start-with-why` (its tracked
state is the regression corpus — read-only). Do not run CF-G Phase 2 or CF-H. Suite baseline:
**pass 1921 / fail 0 / xenv 6** — must stay fail 0, new tests add to pass. Commit nothing —
leave changes in the working tree for orchestrator verification. Writer-card constants and
`briefRotation.ts` instruction strings are shared surfaces: CF-I-2 and CF-I-3 serialize (see
roadmap). Card char budget: net delta for the whole CF-I campaign ≤ +600 chars (the card is
already at 18,217 vs an 18,700 pin — state your delta; if the pin must move, justify to ≤19,000).

---

## Prompt CF-I-1: Machinery-leakage detector family + fixtures + leaked-line forensics

### Role
Senior pipeline engineer on the v24 deterministic critics. You make CF-I leakage measurable —
detectors first, so prevention (CF-I-2/3) and repair (CF-I-4) have an objective target.

### Context
The table above (S1–S4, S6). Detection must be narrow and evidence-tuned: every symptom has
verbatim fixtures available in `PIPE/state/chapters/multipliers-ch0*.v21-native.chapter.json`
(fresh, uncommitted state — READ-ONLY for this prompt) and the published
`book-packages/high-output-management.v21.json`. House pattern to copy: `exampleRegister.ts`
(C31) — narrow predicate, exported probe function, `finalGate.runShipGate` registration at
severity "minor", gold-corpus pinned counts, distilled fixtures in tests (never runtime-read
the live state in committed tests except via the xenv-guarded pattern of
`scene-concreteness.test.ts`).

### Input
- `PIPE/src/critics/exampleRegister.ts` + `PIPE/tests/example-register.test.ts` (the pattern)
- `PIPE/src/critics/bookRepetition.ts` (`checkBookAphorismRepetition`, BP34) + its test
- `PIPE/src/critics/finalGate.ts` (severity map + runShipGate push loops), `bookGate.ts`
- `PIPE/src/compiler/briefRotation.ts` — the arc/lens instruction strings (S3's mint source;
  you DETECT against them, CF-I-2 rewrites them — export or duplicate the phrase list in a
  shared module so detector and future card text can't drift apart)
- `PIPE/src/critics/crossBookSignatureAudit.ts` + `PIPE/src/scratch/run-cross-book-audit.ts`
  (S6 forensics)
- Evidence quotes: verification report §7.2–7.3
- `PIPE/src/types.ts` (CriticCheckId union)

### Objective
Four advisory detectors (one CriticCheckId each, or one C32 family with sub-checks — your
call, but each symptom independently reportable), plus the BP34 `hook` field addition, plus a
forensics REPORT (no fix) for the 4 leaked cross-book lines.

### Specific instructions
1. **C32 meta-case protagonist** (S1): flag a chapter when ≥2 example fields across ≥2
   examples have an internal-artifact noun phrase in SUBJECT position ("the case", "the
   draft", "the weak version", "the source", "the anchor", "the chapter", "the example", "the
   packet", "the repair", "the fix" as grammatical actor — e.g. "The late fix used…", "the
   case would rest on…"). Subject-position heuristic: sentence-initial (or after a fronted
   clause) determiner+noun from the list followed by a verb. EXEMPTION: skip entirely when the
   chapter's source packet `namedCases` are themselves documents/artifacts (accept a sidecar
   param like C30's `sidecarOverride`; absent packet → run, it's advisory).
2. **C33 beat-vocabulary echo** (S3): flag reader-facing prose containing the dealt-machinery
   phrases. Build the phrase list from the actual `briefRotation.ts` instruction strings
   ("return point", "early signal", "late catch", "case stays home", "hard detail", "source
   packet" + any others you find by reading ALL arc/lens/idiom/shell instruction strings — do
   the inventory, don't trust this list). Threshold: ≥2 distinct machinery phrases in one
   chapter's reader-facing fields, or the same phrase in ≥3 chapters (book-level). One
   advisory per chapter/book respectively.
3. **C34 citation-date doorway** (S4): flag a chapter whose fastRead lede's ONLY concreteness
   before the first abstract term is a date/year/publication reference (year regex + publication
   nouns: study/deck/edition/article/HBR/press). A lede where a named person ACTS in the same
   sentence as the date does NOT fire (red-team rule 2).
4. **C35 lineage-key quiz** (S2): flag a quiz question whose CORRECT choice or explanation
   rewards naming/citing the source rather than applying the idea — correct-choice text
   matching cite-verbs+source-nouns patterns ("tie the move to <Title>", "name <Person> …as
   the lineage", "so the frame is traceable", "cite", "attribute") AND explanation reinforcing
   ("lineage", "traceable", "real source", "checkable"). Flag per-question; one advisory per
   chapter listing the question indices. Distractors citing sources are fine — only the KEY.
5. **BP34 hook field**: add `hook` to the aphorism scan set (the ch1/ch6 clone stays legal at
   2 chapters — this is future-proofing, not a threshold change).
6. **Registration**: all advisory ("minor") in the C29/C30/C31 house pattern; NOT in any
   blocker/enforced set.
7. **Tuning + pins**: run all detectors over (a) v24 gold corpus (xenv-guarded), (b) the HOM
   package, (c) multipliers state. Pin measured counts in tests. Expected from the direct
   read: C32 fires multipliers ch02 (and likely ch06/ch08), C33 fires ch06/ch08 (+ book-level),
   C34 fires most multipliers chapters, C35 fires ch02/ch08. If a detector fires on >50% of
   gold-corpus chapters, it is too broad — narrow it and re-measure. Report every number.
8. **S6 forensics (report only):** for each of the 4 leaked lines, grep prompts/instruction
   strings/legacy `PIPE/prompts/*.md`/voice-bible surfaces for the phrase or its stem; classify
   PROMPT-MINT vs WRITER-DEFAULT vs OLD-PACKAGE-RESIDUE; propose (do not implement) the fix
   class for each (banned-phrases entry / instruction rewrite / no action). Deliver as a table
   in your report + a short section appended to your test file as comments or a
   `PIPE/docs/v24/CF-I-LEAKED-LINES-FORENSICS.md` doc.

### Constraints
Global constraints. Detectors are pure/deterministic (no LLM). Do not modify `briefRotation.ts`
(CF-I-2 owns it) — the shared phrase list module must read as data, not change behavior. Do not
edit multipliers state. Do not add anything to banned-phrases.json (that's a CF-I-2/owner
decision informed by your forensics).

### Tests
Per detector: fires on a distilled multipliers-derived fixture; silent on a legitimate
counterpart (document-subject book fixture for C32; dated-scene lede for C34; source-citing
DISTRACTOR for C35; a chapter using "early signal" once for C33). Pinned corpus counts (gold /
HOM / multipliers). Ship-gate wiring test: findings land in minors, never blockers. Full suite
fail 0.

### Verification
Standalone probe run over all three corpora; paste the per-chapter findings tables in the
report.

### Output
Report: detector specs + thresholds + measured counts; the S6 forensics table with origin
classification and proposed fix class per line; files changed; suite counts; card char delta
(should be 0 — no card changes in this prompt).

---

## Prompt CF-I-2: Write-time prevention + de-minting + repair-directive surfacing

### Role
Senior pipeline engineer on the v24 writer card, brief rotation, and repair lanes. You stop
the leak at the source and make the repair/retry lanes carry the complaint.

### Context
S3's root cause is the instruction text itself (the CF-F "agreement nods" precedent at
`briefRotation.ts:111` proves the fix pattern: neutralize the quotable phrasing, keep the
dealt SHAPE, pin deal↔gate consistency). S5's root cause is that repair/retry lanes never see
C31/CF-I complaints: rubric-preflight failures inject fix lines into the retry card (observed
live: "ch04 fix: echo-tell: quiz q09 key lifts…"), but advisory critic findings do not.
Depends on CF-I-1's detectors + shared phrase list being landed.

### Input
- `PIPE/src/compiler/briefRotation.ts` — ALL arc/lens/idiom/shell instruction strings
  (inventory from CF-I-1's report); the CF-F neutralization diff at line ~111 as the pattern
- `PIPE/src/orchestrator/authorRun.ts` — `AUTHOR_QUALITY_BAR` (rules 7/8), `AUTHOR_PREMIUM_BLOCK`,
  `authorSelfVerify` item 4 SCAFFOLD (line ~346), the retry-loop `lastReason` / card fix-line
  mechanism (how rubric-preflight complaints reach attempt N+1 — find it), review-repair
  directive builder (`authorReview.ts` / repair directive text)
- `PIPE/src/critics/exampleRegister.ts` (C31) + CF-I-1's new detectors
- `PIPE/tests/rhetoric-plan.test.ts` — the deal↔gate banned-phrase guard to extend
- `PIPE/tests/author-arch.test.ts` — card pins to update

### Objective
(a) No dealt instruction string hands the writer quotable machinery prose; (b) the card names
the register rule (machinery nouns never protagonists; beat labels never prose; a citation
date is not a doorway); (c) C31/C32/C33/C34/C35 advisories on a draft reach the NEXT attempt's
card and the review-repair directive as concrete fix lines.

### Specific instructions
1. **De-mint the instruction strings:** rewrite every arc/lens instruction that contains
   reader-quotable phrasing so it describes the shape in stage-direction voice the writer
   cannot paste (e.g. "still-open" → describe an unresolved ending WITHOUT the phrase "return
   point is set but not met"; "before-anyone-notices" → describe opening pre-discovery WITHOUT
   "early signal"). Every dealt shape keeps its identity and id — deal parity and determinism
   untouched (existing rotation tests must stay green unmodified except pinned-text updates).
2. **Deal↔gate pin:** extend the rhetoric-plan guard: no instruction string anywhere in the
   rotation may contain a phrase in CF-I-1's machinery-phrase list (shared module — one source
   of truth).
3. **Card register rule** (ONE compact rule or an extension of self-verify SCAFFOLD, ≤ +400
   chars total): the reader never meets the machinery — no internal artifact as protagonist,
   no beat labels as prose, no drafting/process narration ("in the weak version…"), doorway =
   someone acting or a cost landing (a citation date alone is not a doorway), quiz keys test
   what the reader can DO (the source may support the explanation, never BE the answer). Fold
   the S4 tightening into rule 8's existing DOORWAY clause rather than adding a new rule.
4. **Repair/retry surfacing (the C31 fold-in, owner decision 4):** when a written draft carries
   C31/C32/C33/C34/C35 advisories, inject a concrete fix line into (a) the write-retry card
   (same mechanism as rubric-preflight fix lines) and (b) the review-repair directive text.
   Advisory stays advisory: the finding must NOT change any pass/fail predicate — it only
   changes the TEXT the next writer sees. Verify by test that a draft failing ONLY with these
   advisories still passes the gate (no new blocking path).
5. Update card pins; state net card delta.

### Constraints
Global constraints. Deal determinism and parity untouched (same inputs → same deals). Do not
change severity of anything. Do not touch sourceGrounding/keyEvidence requirements. Rule-7/8
substance from CF-A/CF-B stays (you are adding the register dimension, not rewording their
requirements). Runs AFTER CF-I-1; CF-I-3 runs after you (same card file).

### Tests
- Rotation: every de-minted instruction still deals deterministically; machinery-phrase pin
  over ALL instruction strings green.
- Card pins: register rule present; DOORWAY tightening present; prior CF-A/CF-B pins still green.
- Retry surfacing: fixture where attempt-1 draft trips C31 → attempt-2 card contains the fix
  line; review-repair directive contains it; and a draft with ONLY these advisories still
  passes (no gate change).
- Full suite fail 0.

### Verification
Render a real card for a fixture book: paste the de-minted arc lines and the register rule.
Show the retry fix-line in a driven fixture run.

### Output
Report: instruction strings changed (before/after table); card delta; the surfacing mechanism
(file:line); proof advisories still never block; suite counts.

---

## Prompt CF-I-3: Quiz/card application-over-lineage

### Role
Pipeline engineer on quiz/card generation instructions. Smallest prompt: make keys test
application, verifiably, without weakening grounding.

### Context
S2. `sourceGrounding.ts` (keyEvidence anchor-traceability) is correct and untouchable — the
defect is the card never telling the writer what a KEY is FOR. Verified leak: multipliers ch08
q01/q04, ch02 q03/q08 (keys reward naming the source). CF-I-1's C35 detector defines the
failure operationally; CF-I-2's register rule states the principle at card level. This prompt
adds the quiz-specific instruction + the schemaHint note + pins, and it runs LAST of the
card-editing prompts.

### Input
- `PIPE/src/orchestrator/authorRun.ts` — quiz section of `authorSchemaHint` + any quiz rules in
  `AUTHOR_QUALITY_BAR`; `authorSelfVerify`
- `PIPE/src/critics/sourceGrounding.ts` (read-only — understand what must keep passing)
- CF-I-1's C35 + its fixtures
- `PIPE/tests/author-arch.test.ts`

### Objective
Card + schemaHint state: the correct choice is always something the reader DOES or DECIDES in
a situation; source names/dates may appear in distractors or as supporting context in the
explanation, never as the tested skill; explanations explain WHY the move works, not why the
citation is trustworthy. One self-verify item.

### Specific instructions
1. Add the quiz-application rule (≤ +200 chars) where the card's quiz guidance lives; extend
   the schemaHint quiz note.
2. Self-verify: "for each quiz key, ask: does the right answer name a source or make a move?
   If it names a source, rewrite."
3. Pins for the new lines; confirm C35's fixture chapter would violate the new instruction
   text (consistency check between rule and detector — cite both in a comment).
4. Do NOT touch sourceGrounding, keyEvidence, quiz schema, or bloom/depth enums.

### Constraints
Global constraints. Runs after CF-I-2 (same file). Net delta counted against the campaign's
≤ +600 budget with CF-I-2's.

### Tests
Card pins; negative pins (sourceGrounding untouched — no diff hunks in it); full suite fail 0.

### Verification
Render a card; paste the quiz instruction block before/after.

### Output
Report: exact new lines, delta, suite counts.

---

## Prompt CF-I-4: multipliers targeted repair + revalidation (publish gated on owner)

### Role
v24 conductor for a targeted content repair of the UNPUBLISHED `multipliers` book, under the
pause-fix-resume discipline. You repair only what the CF-I detectors flag, re-gate everything,
and STOP before publish.

### Context
`multipliers` is READY-TO-PUBLISH (9/9 PASS 85.0–88.6, acceptance 79.4) but held for CF-I
(reader-visible, premium-feel). State lives at
`PIPE/state/chapters/multipliers-ch0*.v21-native.chapter.json` + reviews/attestations.
Depends on CF-I-1 (detectors), CF-I-2/3 (so repair rewrites happen under the new instructions).
Repair targets from the verification report + detectors: ch02 meta-case examples + evaluator
openers, ch08 evaluator openers + lineage keys (q01/q04) + ch02 lineage keys (q03/q08),
"return point set (but not met)" echoes (ch06/ch08), the ch04+ch07 verbatim 8-gram ("Rescue can
finish the task while teaching…"), the ch01/ch06 hook clone, date-only doorways where the fix
is cheap (do NOT rewrite all 7 ledes if the review bar doesn't demand it — targeted, not
wholesale).

### Input
- CF-I-1 detector probe outputs over multipliers (the authoritative repair list)
- The repair lane: `PIPE/src/orchestrator/authorRepair.ts` / `content-repair-book` verb /
  review-repair — find the canonical targeted-repair path for an unpublished authored book and
  USE it (do not hand-edit chapter JSON unless the canonical path cannot express a targeted
  rewrite; if you must hand-edit, preserve schema, sourceAnchorIds, quiz keys' correctness,
  contentHash re-binding via the canonical re-gate, and say so loudly)
- Gates: gate-chapter, rubric, reader review, acceptance (`book-run multipliers --author
  --no-publish` re-entry re-runs what's needed)
- Verification report §7 checklist

### Objective
All CF-I detector findings on multipliers resolved or explicitly waived-with-reason; every
touched chapter re-gated and re-reviewed ≥ its prior bar; acceptance re-run and still ACCEPT;
a fresh direct-read of the repaired chapters confirms the leakage reads gone; **STOP — publish
only after the owner checkpoint.**

### Specific instructions
1. Back up the current multipliers chapter state before any repair (sibling `.bak` dir).
2. Run the CF-I detectors → fix list. Repair via the canonical lane, chapter by chapter:
   rewrite the leaking sentence/example-opening/quiz key+explanation/doorway — never regenerate
   a whole chapter when a targeted rewrite serves; preserve facts, schema, and everything the
   reviews praised.
3. Re-gate + re-review every touched chapter (blind review; carried reviews for untouched
   chapters must CARRY, not respawn). Re-run acceptance. All prior bars hold (chapter ≥80,
   acceptance ≥ floor; no weakening).
4. Re-run the C31/C32/C33/C34/C35 probes: target ZERO findings on repaired chapters (waivers
   need written justification per finding).
5. Direct-read the repaired ch02 + one other repaired chapter yourself; quote before/after for
   3 repairs in the report.
6. Print the publish command; DO NOT run it. (Note: the canonical publish transaction includes
   a `git push` — publish requires the owner checkpoint AND acknowledgment of that push
   behavior, per the HOM precedent.)

### Constraints
Global constraints. multipliers only — no other book's state. No gate/threshold changes. If a
repair drops a chapter below its bar or acceptance fails, restore from backup and report — do
not iterate past bounded budgets (respect the repair lane's own caps).

### Tests
No new src tests required (this is a content operation), but the full suite must still pass
(fail 0) and any incidental engineering bug found gets reported, not silently fixed.

### Verification
Detector probes before/after (tables); per-chapter review scores before/after; acceptance
record id; the three quoted repairs; suite counts.

### Output
Report: repair list with per-item resolution; scores before/after; acceptance verdict;
remaining waivers; the exact publish command for the owner; confirmation nothing was published
or pushed.
