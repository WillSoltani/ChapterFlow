# REDO — the-body-keeps-the-score (QC round 1)

Reviewer: `claude-qc:tbkts-20260606` · Book gate: PASS (0 blockers) · Semantic QC: **9 of 20 chapters need work.**

---

## ROUND 2 STATUS (re-QC 2026-06-10, reviewer `claude-qc:tbkts-r2-20260610`)

Codex applied the round-1 fixes and self-attested all 9 PASS. On independent re-review (every key
re-derived, all defects re-checked), **8 of 9 are genuinely fixed and now PUBLISHABLE**: ch02, ch04,
ch07, ch08, ch09, ch15, ch16, ch17. The two wrong keys (ch06 q07, ch17 q04) and all four renames /
skeleton rewrites verified clean, no new defects.

**One chapter still needs a fix — ch06 (now REVISE):** the round-1 defects ARE fixed (q07 keys 0 =
safe sensation; the ex06 clinician is renamed Rafael). But a *separate* one-name-two-people collision
remains and must be resolved:
- **"Genevieve"** is the **clinician** in `breakdown.fullRead` ("Genevieve uses that limit in a
  community clinic…") and `ex05` ("Genevieve notices the sweater cuff pressing Mariette's wrist…
  needs to choose a smaller entry point"), but the **dissociating patient** in `q05` ("Genevieve
  describes an accident as if she watched it happen to someone else").
- **Fix:** rename ONE role to a fresh name (e.g. keep Genevieve as the clinician and give q05's
  patient a new name, or vice-versa). Change only the name tokens; keep the q05 key (currently
  correct) and everything else. Then re-run `gate-chapter` + `book-gate`, and the chapter must be
  re-reviewed (its `qc-attest` hash will be STALE) to PUBLISHABLE before promote.

Note: do **not** self-attest. The attestation is the reviewer's, not the writer's — a writer-written
PASS is treated as STALE/untrusted and re-reviewed.

---

Deterministic gates (`gate-chapter`, `book-gate`, `author-check`, `check-source`) all pass GREEN for
this book — these defects are the semantic class the gates cannot see. **11 chapters are
PUBLISHABLE and must NOT be touched:** ch01, ch03, ch05, ch10, ch11, ch12, ch13, ch14, ch18, ch19, ch20.

Fix only the 9 chapters below. Each fix is field-scoped. After each edit, the chapter's `qc-attest`
hash goes STALE and `promote-book` will block it until it is re-reviewed — that is expected.

**Global rule:** change ONLY the fields named per defect. Do NOT alter the breakdown facts, quiz
keys that are already correct, sourceAnchorIds, or any PUBLISHABLE chapter. Every quiz key in these 9
chapters was independently re-derived; only the two below (ch06 q07, ch17 q04) are wrong — do not
"fix" any other key.

---

## TIER 1 — CORRUPTION (RED). Wrong quiz keys. MUST fix; these block ship.

### ch06 · q07 — key points to the wrong answer
- **Field to change:** `quiz.questions[q07].correctIndex` only.
- **Now:** `correctIndex: 1` → choice 1 = *"Mariette should push through the story quickly so the body learns that disclosure is survivable."*
- **Correct:** `correctIndex: 0` → choice 0 = *"Mariette should begin with a safe sensation, such as pressure or breath, before forcing the whole narrative."*
- **Proof:** the question's own `explanation` already reads *"The right sequence starts with safe sensation. A rushed story or avoidance of body attention can deepen detachment instead of restoring choice."* That describes choice 0. The stored key contradicts its own explanation and the chapter thesis (interoception before narrative).
- **Do NOT** change the prompt, the three choices, or the explanation. Only flip the index to 0.

### ch17 · q04 — key marks the "good" conclusion as the one to avoid (and the stem has two valid "avoid" answers)
- **Now:** prompt = *"…Which conclusion should he avoid?"* with `correctIndex: 0` = *"Psychological safety may be relevant to stress-related bodily systems, but the claim should stay cautious."* That choice is the **endorsed cautious view** — the one to KEEP. Choices 1 ("immune symptoms are always unrelated…") and 2 ("a safety question can replace medical evaluation…") are BOTH avoidable errors, so "which to avoid" has two right answers.
- **Recommended fix (cleanest, preserves the existing explanation):** change the stem to ask which conclusion is **best supported** —
  - prompt → *"At a clinic meeting, Aditya cites Nancy Shadick's rheumatoid arthritis studies. Which conclusion is best supported?"*
  - keep `correctIndex: 0` (choice 0 is the supported cautious view).
  - the existing explanation still applies verbatim.
- **Fields to change:** `quiz.questions[q04].prompt` (stem only) — `correctIndex` stays 0. Do NOT change the three choices or the explanation.
- *(Alternative if you prefer to keep an "avoid" stem: rewrite choices 1 and 2 so only ONE is an avoidable error, and key that one. The recommended fix above is simpler.)*

---

## TIER 2 — COHERENCE: one-name-two-people collisions (REVISE)

Each chapter reuses a single first name for two different people (a clinician/trainer in one place,
a patient/survivor in another). A publishable chapter maps one name → one person. **Fix by renaming
ONE of the two roles to a fresh name not used elsewhere in that chapter.** Change only the name
tokens in the cited fields; keep every storyline, fact, and key identical.

| Ch | Name | Role A (keep this name) | Role B (rename) |
|----|------|--------------------------|------------------|
| ch04 | **Gracie** | dissociating survivor/witness — `ex06`, `q06`, `q09` | observing clinician in `breakdown.fastRead` ("Gracie listens as a crash survivor…") and `breakdown.deepRead` ("Gracie sees the problem in the scan report") → rename the breakdown clinician |
| ch06 | **Mariette** | survivor — `breakdown.fullRead`, `ex05`, `q07` | clinician in `ex06` ("Mariette will decide whether the first goal should be a body signal the patient can actually feel") → rename the ex06 clinician |
| ch08 | **Reza** | intimacy-panic case — `ex03` | `q03` gives "Reza" the autoimmune-disease + vision-loss profile that belongs to **Fabienne** (`ex02`, `q09`). Rename the q03 patient (give q03 its own name, OR make q03's patient = Fabienne to match the body-cost storyline) |
| ch16 | **Mariana** | fearful survivor-student — `breakdown.fastRead` ("Mariana sits near the yoga room door… Her shoulders climb…") | facilitator-trainer in `breakdown.fullRead` ("Mariana keeps the claim modest when she trains new facilitators") and `q07` → rename the trainer |
| ch17 | **Roman** | client with a "manager" part — `breakdown.fullRead` ("Roman hears this in his own morning routine: an hour of checking, correcting, and rehearsing") | IFS teacher in `q07` ("Roman is teaching the IFS role map and leaves out Self") → rename the q07 teacher (the breakdown's IFS teacher is **Jack** — reuse Jack or a new name) |

---

## TIER 3 — example slate shares one skeleton (REVISE)

In each chapter below, ≥half the 6 example `scenario` blocks are built from one reusable
sentence-template (only nouns/times swapped). Rewrite the affected `scenario` texts so the six scenes
have genuinely different structures — vary the opening move, drop the uniform clock-time/deadline
scaffold, and let each scene's shape follow its own domain. **Keep** each example's `exampleId`,
`sourceAnchorId`, teaching point (`whatToDo`/`whyItMatters`), and the quiz/cards untouched.

- **ch02** — all 6 scenes = *"[Name] holds [a note/document] [imminent-deadline clause]; [complication]; [Name] must [ask the agency question]."* Deadline stamps to break up: ex01 "The ward review starts in five minutes", ex02 "The class begins in four minutes", ex03 "Before lunch", ex04 "when morning rounds begin", ex05 "before the bell", ex06 "Minutes before the parent call".
- **ch07** — 4/6 scenes mechanically insert the same triad *"John Bowlby, secure attachment, and [avoidant/disorganized] attachment"* (ex02, ex03, ex04, ex06). Vary how attachment concepts enter each scene; do not paste the term-list.
- **ch09** — 5/6 scenes = *"[Name] keeps the DSM codes/services, then adds the trauma history/timeline."* Vary the resolution beat across scenes. (See also Tier 4 below for this chapter.)
- **ch15** — all 6 scenes = *"[Name] handles an object at [clock time] in [place]; a countdown looms; before [trigger], [Name] must protect the EMDR ethic."* (8:15a/seven min; 4:40p/eleven min; noon; 2:20p; 9:00a; 11:35a/seconds). Drop the uniform clock-time + countdown mold.

---

## TIER 4 — ch09 unsourced statistics (REVISE; not corruption)

`ex02` cites *"the 87 percent multiple ACE exposure figure"* and `ex04` cites *"the 81 percent BPD
trauma finding."* **These figures are REAL** — 87% is Felitti's ACE co-occurrence statistic (of those
with one ACE, ~87% had ≥1 more) and ~81% is the Herman/Perry/van der Kolk 1989 BPD childhood-trauma
finding — so this is **not** a false-fact corruption. But neither number appears in the ch09 source
sidecar (it only says the book "uses percentages"). Either:
- (a) ground them: add the citation so the figures trace to the actual ACE Study / Herman 1989, or
- (b) drop the specific numbers and keep the qualitative claim.
Do not invent any other statistics.

---

## Done-condition (per redone chapter)
1. `npx tsx src/cli.ts gate-chapter state/chapters/the-body-keeps-the-score-ch<NN>.v21-native.chapter.json` → `Gate verdict: PASS`, 0 blockers.
2. `npx tsx src/cli.ts book-gate the-body-keeps-the-score` → `Book gate: PASS`, 0 blockers (run once after all edits).
3. The specific fix verified: ch06 q07 key = 0; ch17 q04 stem/key consistent; each renamed chapter has one name → one person; each Tier-3 chapter's six scenarios no longer share one sentence-template; ch09 figures sourced or removed.
4. Re-QC and refresh the attestation to `PUBLISHABLE` (the edit makes the current `qc-attest` hash STALE). `npx tsx src/cli.ts qc-status the-body-keeps-the-score` should end at 20/20 PASS before `promote-book`.

## Process note (systemic)
Name collisions (5 chapters) and shared scene-skeletons (4 chapters) recur across the book — they are
authoring-process artifacts, not one-off slips. Consider a per-chapter character registry (one name =
one role; never reuse a clinician's name for a patient) and a scene-template diversity check before
the next book, so these do not need a QC round to catch.
