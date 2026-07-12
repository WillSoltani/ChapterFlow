# V24 Fresh Scene-Origin Gold Run — range

> **ROLLBACK NOTE (2026-07-10, appended):** the campaign this report describes was subsequently
> ABANDONED and rolled back — branch reset to `acdc51c13` (GPT-5.5 baseline), all `range`
> generated state/logs/evidence deleted. This report is retained as evidence by owner
> instruction; the paths and hashes it cites no longer exist on disk (evidence corpus deleted;
> commits preserved on a local backup branch only).

**Date:** 2026-07-10 · **Conductor:** gold-corpus validation conductor (scene-origin campaign,
phases 6–16) · **Branch:** `feat/anti-sameness-live-fix` · **Companion:**
`V24_CF_J_COMMIT_AND_MODEL_MIGRATION_REPORT.md` (phases 1–5).
**Owner directive mid-run:** after repeated ch01 review roulette, "if they fail this time, halt
the pipeline and give me a complete report" — executed; the run is HALTED, not READY.

## 1. Selected book
`range` — "Range: Why Generalists Triumph in a Specialized World", David Epstein. 12 chapters.

## 2. Selection rationale
Zero prior state anywhere in the v24 pipeline (no v24 state, no research runs; NOTE discovered at
rollback: a legacy v21-era `range` entry exists in the tracked gold corpus + books.json registry —
it never interacted with this run); machine-brief path; representative mega-bestseller nonfiction;
deliberately DIFFERENT genre/voice from the four recent leadership/management validation books
(science journalism; the source's own scenes are sports, music, labs, firefighting, art) — so any
office-mold scenes in first drafts would be unambiguous first-write monoculture evidence;
12 chapters = enough to expose book-level repetition.

## 3. Prior state
None in v24. Doctor's `CHSET.index_missing` fatal was the expected from-zero precondition
(research creates the index); "could not resolve range to a known book" is normal for
never-published ids.

## 4. Doctor result
1 expected fatal (index missing — cleared by research), 2 known standing WARNs (HOM+multipliers
pending-deploy sentinels, unrelated), 7 checks passed.

## 5. Run command and logs
`CHAPTERFLOW_ALLOW_MODEL_GEN=1 npx tsx src/cli.ts book-run range --author --no-publish --log …`
Six entries total under `logs/v24-scene-origin-validation/` (deleted at rollback): initial
(research + write), `reentry1` (reviews + regen wave), `reentry2` (resume after conductor crash),
`reentry3` (post-repair reviews), `reentry4` (acceptance + evidence + sweep), `reentry5`,
`reentry6` (post-repair reviews; final halt). Spawn totals: 107 codex sessions (28 writers incl.
12 regens, 70 reviewer/tiebreak reads, 3 acceptance book-readers, 2 key derivations, 1 sweep,
1 research, 2 gate-repair) plus 6 conductor-side repair/coding agents.

## 6. Model/reasoning routing summary
Every codex session ran **gpt-5.6-sol** (choke-point default; verified live on process argv).
Efforts observed: research **xhigh** (sensitive class, per policy); writers/regens **high**
(logged per-spawn: "gpt-5.6-sol @ high"); reviewers/tiebreaks/sweep **high**; key derivations
**low**, sweep-pack readers **medium** (deliberate mechanical lanes); acceptance readers high.
No GPT-5.5 anywhere; no ambient-config inheritance; conductor-side repair/diagnosis agents ran
at maximum capability (sensitive class).

## 7. First-write evidence summary
A diagnostic watcher snapshotted every content-hash version of every chapter + review artifact
(10s cadence) to `logs/v24-scene-origin-validation/evidence/` — 279+ chapter versions across 12
chapters (11–47 each), full review history, the dealt briefs + book design
(`evidence/baseline/`), a first-write manifest, and a version ledger. First-write finals were
recoverable per chapter as the last snapshot before the regen wave (04:53Z). No first-write
evidence was lost to later repair; the watcher also supplied the restore that recovered ch12
after the conductor crash and the failed-draft bytes that proved the D7 matcher bug.
(Corpus deleted at rollback.)

## 8. First-write scene-skeleton analysis (the core result)
Two independent coders (A neutral, B adversarial) on the frozen 12-chapter first-write set:
**scene_skeleton HIGH / HIGH · repeated_unit HIGH / HIGH · prop_stamp MED / MED · proxy_cast
MED / MED.** The radical-candor-era props are ABSENT (deterministic scan: 0 calendars, 0 mugs,
0 checklists/dashboards, 1 meeting across 12 chapters; named real humans 10–23 per chapter) —
but the mold RE-EXPRESSED one abstraction level up: an accounting-drama rhythm ("a verdict/error
is *quietly* hardening → a *check-in* or backward trace pulls it back *just in time*, or the
scene freeze-frame cuts before the outcome"), examples dealt from a five-slot deck, a rotating
small-object sensory twitch (laptop fan / sticky note / phone buzz / marker squeak / screen
light), pairwise-cloned practice shells (audit-10-min ch01/09; scripted-exact-line ch03/07/11;
count-record-compare ch02/04/10; teach-one-person ch02/10), memorableLines minted from a visible
reversal/redefinition/command recipe (self-documented in why-fields), and a VERBATIM hook clone
across ch07/ch12 ("Everyone agreed, but no one knew who/which … would bring back proof").
Deterministic first-write phrase kit: quietly 6 ch · half-works/"The move worked" 6 ch ·
answers-for 5 ch · just-in-time 5 ch · ledger/one-column 5 ch · check-in 4 ch · 8-gram clones 1
family (the hook clone). All of this exists with ZERO repairs — written by gpt-5.6-sol @ high,
so the mold is **pipeline-cultural (card recipes/self-verify shells), not model- or repair-borne**.

## 9. Repair/regeneration history
- Write phase: 16 writer sessions for 12 chapters; 3 lead-thread contract retries (ch03, ch06 ×2,
  ch07) — ALL later proven spurious (D7 matcher bug, §22); ch06's bounded degradation
  (van Gogh → Malamud) was driven by the same false negative and halted entry 1.
- Review phase: 12/12 first-round ship=false at composites 81–91; tiebreaks upheld 10 → full
  regen wave (10 whole-chapter regens with merged complaints). Dominant complaint class:
  **invented stand-in scenes narrated declaratively without hypothetical framing** (+ quiz
  structural ambiguity, distractor-style tells, two factual overreaches).
- Regen outcomes: 7 passed (85.1–92.2, several regens scored HIGHER than first write: ch04 89.1,
  ch05 90.5, ch10 92.2); ch01/ch03/ch08 exhausted the durable budget → targeted agent repairs
  (6 leaf-field fixes) → ch03/ch08 passed fresh review (90.3 / 90.5).
- Sweep blockers (round 1): scene_skeleton "all 12 fullReads" (quoting ch01's limits-shell) +
  ch12 persona_drift (invented editor reused across two examples) → 2 targeted repairs
  (ch01 shell re-grounded in chapter material; Oceane confined to one example).
- ch01 then entered review roulette: three consecutive fresh reads found NEW must-fix items each
  time (fabrication-framing → quiz Q2 keyed-answer-doesn't-fix-the-bias → fullRead causal
  overreach "chess lesson drove youth-sport specialization"), each repaired once; on the owner's
  stop-rule the third upheld FAIL ended the campaign. Chapter file diffs prove all repairs were
  leaf-field-scoped; keys never changed.

## 10. Post-repair scene-skeleton analysis
Same deterministic scan on the FINAL text: phrase kit reduced or flat everywhere — check-in
4 ch → 1 · half-works 7 hits → 4 · just-in-time 6 → 4 · ledger 9 → 5 · quietly 6 → 6 ·
answers-for 6 → 5 · tail clones 0 → 0 · 8-gram clone families 1 → ~1 (hook clone partially
diluted). Containers stayed clean (0 mugs/calendars). The acceptance panel on the post-regen
text: churn **MEDIUM** with texture advisories, not the churn-HIGH collapse radical-candor
suffered under its repair wave.

## 11. Before/after comparison — the answer to the campaign question
Sameness was **fully formed at first write** and **not amplified by repair/regeneration** — the
10-chapter regen wave slightly DILUTED the stamped phrase kit while fixing content defects, and
post-regen churn held at MEDIUM. radical-candor's 78.9→74.3 texture collapse does not generalize:
with CF-J-era briefs + varied-lead deals, a heavy regen wave did not homogenize this book further.

## 12. CF-I result (C30/C32–C35, BP34 aphorism): 0 findings, first write and final.
## 13. CF-J result (C36 apparatus): page-cite 0 · guide-structure 0 · spec-narration 0 ·
machinery-in-quiz 0 — the projection de-mint held on a fresh book (radical-candor's leak class
did not recur). One BP34-class hook clone (ch07/ch12) existed at first write; partially diluted.
## 14. C31 result: evaluator-opener max 2/chapter (threshold 3) — silent, both stages.
## 15. Proxy-cast result: MED — named source humans anchor all 12 chapters (10–23 names/ch);
invented single-name stand-ins carry lead threads in ch4/10/11/12 (per the dealt invented-lead
briefs). No zero-named-human chapter (radical-candor's ch6/8/9 class did not recur).
## 16. Quiz/card result: keys 9/9 on every passing read; key-judge PASS ×12 (keyA/keyB agreement);
3 structurally-broken items found by readers and repaired (ch03 Q3, ch08 Q6, ch01 Q2 — two-
supported-answers / keyed-answer-doesn't-fix-the-mechanism classes); distractor-mold noted
advisory in ch01. Cards clean.
## 17. Source-fidelity result: the review net caught and we repaired: 6+ unlabeled-invented
scenes, 2 causal overreaches (ch03 concerto tally, ch01 Polgár→youth-sports history), 1 factual
error (ch11 "Mach 2.46" foam-strike framing, fixed in regen), 1 unattested Polgár deliberation.
No em-dash/meta-reference violations introduced by repairs; all repair text packet-grounded.

## 18. Chapter statuses and scores (at halt)
11/12 hold durable review PASSes: ch02 88.x, ch03 90.3, ch04 89.1, ch05 90.5, ch06 (passed
regen round), ch07 86.x, ch08 90.5, ch09 8x, ch10 92.2, ch11 90.1, ch12 89.9 (exact per-chapter
records were in `state/reviews/range/`, deleted at rollback). **ch01: upheld FAIL** (median 87.4;
keys 9/9; out of regen budget; three distinct defect classes found by three successive readers).

## 19. Acceptance score and boundary
Pooled **79.8, ACCEPT** (floor 74, premium target 80; 1 read — clear of the binding floor by
more than the ±3.7 band; valid 3/3 readers). Recorded on the post-regen text before the final
ch01 repairs; ch01's hash was stale against it at halt.

## 20. Churn/tone/density
Churn **MEDIUM**. Panel scored tone/density inside the 79.8 pooled composite; chapter readers'
tone complaints concentrated on the ledger/check-in register (one reader flagged the vocabulary
kit as opaque phrasing — the mold is locally visible, not just cross-chapter).

## 21. Red-team findings
1. **Routing migration is clean in production**: every session logged gpt-5.6-sol at its
   policy effort; no hidden 5.5 route; sensitive lanes (research xhigh, key-class repairs)
   verified on live argv. Migration changed routing, not gates or prompts.
2. **SOL@high writer behavior differs from 5.5@xhigh in one material way**: it narrates invented
   stand-in scenes declaratively (no hypothetical framing) — 10/12 first-round ship=false vs
   first-round 9/9 and 16/16 PASS on the two 5.5@xhigh books. The net caught all of it, but at
   ~44 extra review/tiebreak reads + 12 regens. It also produces HIGHER per-chapter ceilings
   (regens to 90.5–92.2) and passed acceptance first-read. Whether labeling-discipline is worth
   a card-line fix is an owner call — per the campaign constraint, prompts were NOT changed.
3. **Reader-depth roulette on ch01**: three successive fresh readers each found a NEW real
   must-fix in different units. Each finding was genuine; the process is honest but
   non-convergent within budget when a chapter's example system sits near the fabrication line.
4. **Scene sameness is first-write, pipeline-cultural**: coded HIGH/HIGH pre-repair, phrase kit
   diluted (not amplified) by regen, mold vocabulary reviewer-visible. radical-candor's
   repair-collapse story does not generalize to CF-J-era briefs.
5. **Anti-leakage rules did NOT make prose generic** — CF-J detectors 0 while named-cast density
   stayed high; the genericness risk expressed instead through the recipe shells (§8).
6. Two verified engineering defects (§22) — one fixed with a regression pin, one noted.
7. **No repair weakened a true blocker**: all repairs are leaf-field diffs; keys unchanged;
   gates/policies untouched; sweep record persisted (promote correctly blocked at halt).
8. **Can the pipeline run this book unattended?** No — with the stop-rule it halted on ch01;
   without conductor-side repairs it would have halted at the first budget exhaustion. The
   bounded machinery + emitted repair prompts worked exactly as designed.

## 22. Verified engineering findings
- **FIXED during campaign, REMOVED at rollback — D7 lead-thread matcher false negative**
  (`d12ace91c`, on the backup branch only): the contract reduced an owned-case label to its
  FIRST proper-noun token ("Vincent"/"Ofer"); writers use surnames ("Van Gogh", "Malamud"), so
  three CORRECT drafts were rejected and entry 1 halted non-convergently. Proven by replaying
  the preserved failed draft (zero complaints under the fixed matcher); ch06 then passed
  attempt 1 with the original dealt lead. ⚠ After rollback, this bug is LIVE again at the
  baseline — it also explains spurious F-1 degradations on earlier books (concept-lead
  "The Measurement Problem" class).
- **OPEN — conductor crash on mid-write chapter bytes**: reading a chapter file while a regen
  writer was mid-save crashed the conductor with a JSON parse error (infra halt) and
  orphan-killed 6 in-flight writer sessions. The F-2 restore machinery did not cover this read
  path. Recommended (future, gated): tolerate/retry parse failures on chapter reads during
  active writes.

## 23. Final classification
**C — first-write scene monoculture confirmed.** Repeated scene mechanics and recipe shells are
already present before any repair (both coders HIGH/HIGH on frozen first-write text, verbatim
hook clone, 4–6-chapter phrase stamps); repair/regeneration did not amplify them (kit diluted,
churn MEDIUM). The next editorial campaign should target **initial scene/architecture dealing**
(the card's example-arc deck, practice-shell recipes, memorable-line recipe, and freeze-frame/
rescue rhythm), not the repair lanes. The run itself ended HALTED on ch01's review roulette
(owner stop-rule) — a fabrication-discipline/model-behavior issue orthogonal to the scene
question, on which the scene evidence is complete and conclusive.

## 24. Follow-up prompt file
Created (classification C): `docs/v24/V24_SCENE_SKELETON_FOLLOWUP_PROMPTS.md` — a narrowly
targeted first-write scene-dealer prompt pack + the SOL labeling-discipline decision item.
NOT implemented in this campaign (freeze respected).

## 25. Publish/deploy/push confirmation
No publish, no S3 upload, no deploy, no push (origin at `3c84ae1ee` throughout). No gate
lowered, no acceptance policy changed, no prompt changes. `multipliers`, `the-culture-code`,
`start-with-why`, `radical-candor` untouched. `range` was never promoted or registered by the
campaign; at rollback its generated state was fully deleted.
