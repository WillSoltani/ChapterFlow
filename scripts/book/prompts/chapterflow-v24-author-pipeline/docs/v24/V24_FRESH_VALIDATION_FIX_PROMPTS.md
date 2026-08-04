# V24 Fresh-Validation Fix Prompts

**Companion to:** `V24_FRESH_GOLD_VALIDATION_REPORT.md` (2026-07-08 fresh run on
`high-output-management`). Three bugs found mid-run were fixed inline under the owner's
pause-fix-resume instruction (lead-deal consistency ×2, failed-write draft restore/removal — all
suite-gated at 1873/0). What remains: **one open design gap (F-1, the run's blocker)** and **one
test debt (F-2)**. Both prompts are standalone.

Global constraints: do not push/publish/deploy; do not lower gates or change acceptance policy;
do not hard-code `high-output-management` or `start-with-why`; back up state before rewriting;
every new write path consumes an existing bounded budget; suite must stay `fail 0` with new tests
added.

---

## Prompt F-1: Bounded lead-thread degradation — close the uncarriable-lead convergence trap

### Role
Senior pipeline engineer on the v24 author write phase and brief compiler. You close the one
convergence trap the fresh gold-corpus validation exposed, without weakening the lead-thread
contract or inventing a semantic label classifier.

### Context
The STIER-2 lead-thread write contract (`authorWriteContractFindings`, consumed in
`src/orchestrator/authorRun.ts` `authorWriteOneChapter`) requires the DEALT lead (an owned case or
invented character from the brief's `leadThread`) to carry the fastRead and ≥2 examples. The dealer
(`resolveLeadThread` in `src/compiler/chapterBrief.ts`, preference from `dealLeadPreference` in
`briefRotation.ts`) accepts any token-bearing owned-case label — including bare concept labels.
Live evidence (high-output-management ch14, lead "Task-focused interview questions", a packet whose
three cases are ALL concept labels with no named actors): **5 of 6 writer drafts across three
conductor entries failed the contract**; each entry ends in an honest bounded halt; re-entry
re-deals the identical lead → an unbreakable halt cycle. A lexical carriability classifier was
evaluated and REJECTED during the run: seven comparable concept-ish leads in the same book
("Salary review", "One-on-one meeting", "Manager as judge and jury"…) carried fine — labels are
not lexically separable, so deal-time classification would overfit. The signal that IS reliable:
**the writer's own repeated contract failure on the specific lead**.

### Input
- `src/orchestrator/authorRun.ts` — `authorWriteOneChapter` (attempt loop, `AUTHOR_WRITE_GATE_RETRIES`,
  the contract-failure `continue` branch with `lastReason`, the new write-failure restore block)
- `src/compiler/chapterBrief.ts` — `resolveLeadThread` (incl. the new `avoidInvented` option),
  `briefVarietyInstructionLines` (LEAD THREAD renderer, incl. the new no-stand-ins variant)
- `src/compiler/contentDeviceDeal.ts` — `dealContentDeviceBans` (proxy-cast ban lookup)
- The contract itself (`authorWriteContractFindings` — locate; likely `authoringGuardrails` or
  `chapterBrief`) — read what it verifies so degradation re-verifies the SAME bar against the new lead
- Ledger: `computeRegenLineage` (`authorRegenLedger.ts:111`) — lineage includes `leadThread`, so a
  degraded deal legitimately re-keys lineage; understand before touching
- Evidence: `logs/v24-fresh-validation/*.log` (ch14 failures), packet
  `state/books/high-output-management/runs/v23-current/source-packets/ch14.source-packet.json`
- Report §5.6 in `V24_FRESH_GOLD_VALIDATION_REPORT.md`

### Objective
A chapter whose dealt lead repeatedly fails the lead-thread contract degrades ONCE, deterministically
and boundedly, to the next-best lead — and the contract then enforces THAT lead at full strength.
No chapter can loop forever on an uncarriable lead; no contract requirement is dropped.

### Requirements
1. **Trigger:** inside `authorWriteOneChapter`, when every configured attempt failed AND every
   failure's contract findings were lead-thread findings (only — a rubric/gate failure must not
   trigger degradation), perform ONE extra attempt (`+1`, a new bounded constant, e.g.
   `AUTHOR_WRITE_LEAD_DEGRADE_RETRIES = 1`) with a DEGRADED lead.
2. **Degradation order (deterministic):** (a) the next owned case in the packet's list that was not
   the failed lead; (b) if none remain (or all have already failed in this call), an invented lead
   from the dealt cast — **only if the chapter's content-device deal does NOT ban proxy-cast**;
   (c) if proxy-banned and no owned case remains, fail as today (honest halt — nothing carriable
   exists; surface a distinct reason naming the exhausted candidates).
3. **The contract still gates:** the degraded attempt's card carries the NEW lead in the LEAD
   THREAD line (reuse the existing renderers, including the no-stand-ins variant for proxy-banned
   chapters), and `authorWriteContractFindings` verifies the NEW lead at full strength. Never relax
   the 2-example/fastRead requirements.
4. **Durability & honesty:** log the degradation loudly (`lead degraded: "<old>" → "<new>" after N
   contract failures`); the written chapter's brief-vs-content divergence must not break later
   carry/lineage logic — decide explicitly whether to (a) persist the degraded lead back into the
   compiled brief (recompile-stable? it is derived — a recompile would revert it; if so, make the
   degradation a pure write-time overlay and ensure the contract at REVIEW time, if any re-check
   exists, uses the chapter's actual lead), or (b) thread a `leadOverride` through the card only.
   Document the choice in code.
5. **Bounded:** at most one degradation per `authorWriteOneChapter` call; the global write/regen
   budgets are unchanged.
6. Do not modify `dealLeadPreference` parity or the existing `avoidInvented` semantics.

### Implementation plan
1. Locate the contract-finding classification (lead findings vs others) — the strings are stable
   (`lead thread:` prefix); prefer a structured discriminator if `authorWriteContractFindings`
   returns typed findings.
2. Extract the lead-selection candidates (packet cases minus failed, then cast) as a pure function
   with the proxy-ban guard — unit-testable.
3. Wire the +1 degraded attempt into the loop; render the card with the overridden lead.
4. Decide requirement 4's persistence question with a comment + test.
5. Tests; full suite.

### Tests
- Unit (pure candidate function): concept-lead failed + 2 remaining cases → next case; all cases
  failed + proxy allowed → invented from cast; all failed + proxy banned → null (halt path).
- Integration (stubbed writer, fixture book): writer fails the lead contract on every attempt with
  lead A, passes with lead B → degraded attempt runs, chapter lands with B carried, log line
  present, total spawns = attempts+1.
- Integration: rubric-failure-only attempts do NOT trigger degradation.
- Integration: proxy-banned chapter with a single (failed) owned case → honest halt with the
  distinct exhausted-candidates reason; no invented lead dealt.
- Regression: the new stier2-levers deal-consistency tests stay green; full suite `fail 0`.

### Red-team checklist
- Can degradation be used to dodge a legitimately-failed lead the writer COULD carry? (Trigger only
  on lead-only failures across ALL attempts; the degraded lead is verified at full strength — show
  a test where the degraded attempt also fails and the halt reason names both leads.)
- Does the write-failure restore block (added 2026-07-08) still fire correctly when the degraded
  attempt also fails? (Prior bytes restored / orphan removed — extend its test.)
- Lineage: does a degraded-lead chapter's lineage stay consistent across re-entries (requirement 4)?
  A recompile must not silently resurrect the uncarriable lead for FUTURE regens of the same
  chapter — if it can, say so in the report and propose the follow-up.
- No unbounded path: prove max writer spawns per call = 1 + AUTHOR_WRITE_GATE_RETRIES + 1.
- Fresh-book determinism: same book, same failures → same degradation choice.

### Output
Report: files changed; the candidate-order function; the requirement-4 persistence decision and its
consequences; test list + full-suite counts; a dry re-run plan for `high-output-management` ch14
(the live validation target awaiting this fix).

### Constraints
Global constraints above. The lead-thread contract's strength is untouchable; degradation changes
WHICH lead is enforced, never WHETHER one is.

---

## Prompt F-2: Fixture tests for the failed-write restore/removal (all three lanes)

### Role
Test engineer on the v24 author pipeline. You add the regression tests for the 2026-07-08 inline
fix that stopped failed writer drafts from replacing (or orphaning onto) disk.

### Context
`authorWriteOneChapter` (`src/orchestrator/authorRun.ts`) now snapshots `preWriteBytes` via the new
injectable `AuthorIo.readChapterFile` and, on total failure, restores them (or
`removeChapterFile`s the orphan when no chapter existed). A call-site restore also exists in the
review-regen block (`authorReview.ts`, re-persists the prior review + provenance). The fix shipped
suite-green (1873/0) but WITHOUT a dedicated fixture test — driving it requires a writer stub whose
draft lands on disk and then fails the write self-checks, which needs the authorRun gate fixtures
(`deps.runVerb(["gate-chapter", …])` / rubric / contract stubbing). The live failure it must pin:
high-output-management ch14 — an 87-composite original overwritten by a contract-failing draft and
lost (disk hash `553e81ec…` vs review-bound `3d10c422…`).

### Input
- `src/orchestrator/authorRun.ts` (the restore block near the final `ok:false` return; AuthorIo
  hooks with real defaults)
- `tests/author-arch.test.ts` — `mkDeps`/`mkIo` harness, the real-file acceptance-restore test
  (`driveRealFileAcceptanceRegen`) as the pattern; note how `deps.runVerb` is stubbed there
- `src/orchestrator/authorReview.ts` review-regen restore call-site
- Report §5.5 in `V24_FRESH_GOLD_VALIDATION_REPORT.md`

### Objective
Every lane's on-disk outcome after a fully-failed write is pinned by tests: prior bytes restored
byte-for-byte where a chapter existed; orphan removed where none did; prior review pointer +
provenance re-bound in the review lane.

### Requirements
1. Harness: a writer stub that WRITES a draft file (via the io hooks or real tmp path per the
   existing pattern) and a `runVerb` stub whose `gate-chapter` (or contract path) fails every
   attempt.
2. Three cases: (a) missing-chapter write fails → file absent afterward + "removed the unreviewed
   failed draft" log; (b) existing-chapter regen fails → bytes byte-identical to prior + restore
   log; (c) review-lane regen write-failure → prior review re-persisted (latest pointer matches
   restored hash) + provenance rolled back (extend the existing R2 four-state test).
3. A cleanup-error case: `writeChapterFile` throws during restore → the original failure reason is
   still returned and the cleanup-failure log fires (no masking).
4. No real `state/` writes: use the injectable hooks or the tests' tmp-root pattern with cleanup.

### Implementation plan
Model on `driveRealFileAcceptanceRegen`; stub `runVerb` for gate failure; add the four cases; full
suite.

### Tests
This prompt IS tests. Acceptance: the four cases green; full suite `pass ≥ 1877 / fail 0`.

### Red-team checklist
- Does case (b) distinguish restore from "the writer just wrote identical bytes"? (Make the draft
  differ.)
- Does the byte-identical-regen early-return path (`:~670`) stay untouched by the cleanup?
- Crashed-process simulation is out of scope (the cleanup runs in-process) — note the residual:
  a SIGKILL mid-write still orphans; the doctor stale-lock check is the operator signal there.

### Output
Report: test list, suite counts, any behavior nit the fixtures exposed in the restore block.

### Constraints
Global constraints. Tests only — if a fixture exposes a code bug, report it; fix only with its own
test.

---

## Explicitly NOT prompted (decided during the run, with evidence)

- **Lexical lead-carriability classifier** — rejected: would misclassify 7 working concept-ish
  leads in the validation book alone (overfit).
- **Relaxing the lead-thread contract on degraded attempts** — rejected: gate-lowering.
- **Card-size diet** (26-31k vs 25k target, warning-only) and **CHB1 anchor advisories on ch15** —
  pre-existing, non-blocking, tracked in the previous campaign's observations.
- **Provider routing for the standalone `research` verb** (anthropic-cli/openai-api both unusable
  on this machine) — environment; the autopilot's codex research path is the working production
  route. Optional future nicety: a codex-backed provider for the router.
