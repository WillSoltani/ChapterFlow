# §16 Preflight Addendum — 2026-07-11 (pre-first-live-call)

Owner directive of 2026-07-11 (recorded verbatim: `owner-ratification.received.md`). All nine
required items follow. **Item 6 (B2) FAILED against the supplied archive — live execution is
withheld** (§5's authorization lists B2 verification as a precondition); every other condition
passes. No live model call has been made (item 9).

---

## 1. Whole-pipeline model-call inventory (§16 call graph)

Every §16 model-bearing operation reaches ONE broker: `spawnCodexAgent`
(`src/orchestrator/codexAgent.ts`), wired as `AutopilotDeps.spawn` by `resolveDeps`
(`src/orchestrator/autopilot.ts:66,127,132`) or imported directly. Sites in the §16 EXECUTION
graph (role → effective spawn):

| # | Operation | Call site | Role | Sandbox | Caps |
|---|---|---|---|---|---|
| 1 | Stage-Q Layer-O read (64 × 3 judges) | `_owner-inputs/layer-o-qualification-runner.mts:83` → `spawnCodexAgent` | `bakeoff-judge` | read-only, tmp ws | ≤2/read; expected 192, max 384 |
| 2 | Stage-Q Layer-N read (43 × 3 judges) | `qualification.ts:273` → `reviewOneChapter(persist=false)` → `authorReview.ts:995` `deps.spawn` (judge model/effort pinned via `judgeDeps`, `bakeoff/review.ts:116`) | `chapter-reviewer` | read-only, reviewer ws | ≤2/read (phase-1 only; phase-2 is persist-gated, `authorReview.ts:1038-1040`) |
| 3 | Sample authoring (48 diagnostic) | `sampleRunner.ts:178` → `authorRun.ts:973` `deps.spawn` | `author-writer` (`:975`) | workspace-write, isolated attempt ws | 1 attempt + ≤1 infra replay (same blindSampleId) |
| 4 | Sample review phase-1 | `reviewRunner.ts` → `reviewOneChapter(persist=true)` → `authorReview.ts:995` | `chapter-reviewer` | read-only | ≤2 |
| 5 | Sample review phase-2 (quiz adjudication, advisory) | `authorReview.ts:896` (`role:` at `:898`) | `chapter-reviewer` | read-only, phase2-doc-only ws | ≤2 |
| 6 | Agreement review (sampleIndex-1 samples) | same instrument as #4 | `chapter-reviewer` | read-only | ≤2 |

Phases `seal / metrics / analyze / unblind / decide / report` make **zero** model calls (pure
computation — proven by the zero-call dry run). Repair/regeneration (`authorRepair.ts:446`,
role `author-repair`) exists in the codebase but is **not invoked by the §16 conductor ladder**
(repair demand is a projection from review outcomes, never executed live in §16). Other spawn
sites in the import closure (`autopilot.ts:398`, `compilerRun.ts:45`, `polishPass.ts:297`,
`shippedControl.ts:182`, `bakeoff/review.ts:225`) are v24-autopilot/legacy-bakeoff paths no §16
stage calls — and every one of them also routes through the same broker with a declared role.

## 2. Proof every call uses ChatGPT-authenticated codex exec

- **Effective executable/args:** `codex exec --sandbox <role-gated> [--skip-git-repo-check]
  --ignore-user-config --ignore-rules -c project_doc_max_bytes=0 -c model=<explicit>
  -c model_reasoning_effort=<explicit> [--add-dir …] --output-last-message <capture> <task>`
  (`executionEnvelope.ts:276-287`; flag support qualification-gated; codex-cli 0.144.1 PASS).
- **Authentication:** per-spawn isolated `CODEX_HOME` receives ONLY a copy of `~/.codex/auth.json`
  (0700 dir / 0600 file, tmpdir outside the repo, deleted in `finally`; stale-sweep crash net).
  **NEW fail-closed assertion (commit `d6f25f1c8`):** the copy must prove `auth_mode: "chatgpt"`,
  no usable `OPENAI_API_KEY`, OAuth tokens present — else `ExecPreflightError` BEFORE any process,
  session dir removed. Probed against the LIVE auth material: `{authMode: "chatgpt",
  apiKeyPresent: false, source: "auth.json"}` ✓.
- **Environment:** allowlist-built child env (18 benign names); `FORBIDDEN_PROVIDER_ENV`
  (OPENAI_API_KEY, CODEX_API_KEY, OPENAI_BASE_URL/API_BASE/ORG/PROJECT, AZURE_OPENAI_*,
  ANTHROPIC_*) refused even when caller-injected. No base-URL/config override path exists
  (isolated CODEX_HOME carries no config.toml; `--ignore-user-config`).
- **No API-provider branch reachable (runtime-proven):** V8 coverage over the §16 entry modules
  (198 pipeline modules evaluated): `providers/openai-api.ts`, `providers/anthropic-api.ts`,
  `providers/cli.ts`, `claudeClient.ts`, `critics/semantic/quizKeyJudge.ts`, and all v21 agents
  **never evaluate**. `providers/router.ts` evaluates only for a string constant
  (`autopilot.ts:76` → `cost-tracker.ts` → router value-import); its factories are lazy dynamic
  imports and its callable entries (`callModel`/`pingProvider`/`makeProvider`) have zero
  §16-reachable callers (exhaustive sweep). `openai-api.ts:42` additionally throws without a key.
- **Per-attempt recording:** every spawn writes `<ts>-<sessionId>.route.json` beside its
  effective-context manifest (`logs/exec/`), now carrying `executionRoute:
  "codex_exec_chatgpt_subscription"`, `authMode: "chatgpt"`, `apiKeyPresent: false`,
  `apiFallbackAllowed: false` (route-result contract v2; validator enforces the pairing; a
  metered/fallback route is unrepresentable). Suite-written sidecars stamp
  `injected_test_runner`/`test` — honest test provenance.
- **Capacity events:** `provider_rate_or_capacity` is a distinct recorded outcome, eligible only
  for the sealed ≤1 same-route replay — no fallback branch exists to switch to.
- **Frozen:** `execution-policy.frozen.json` v2, sha
  `7c2e87d041ac9b95d6ff7a342178a7f3577849827a6e402ab2943a30e0975ac3`.

## 3. The three sealed SEED-* records + condition checks

`stage-q/seed-fixtures.sealed.json` — sha256
`4f74837cb0ead4114047d9e0b1c379af70891b2935beb66df1f0e08881a7634f` (full verbatim content,
labels, per-item hashes, provenance statement). Items: `SEED-causal-overreach` (high-sev,
anchor "the memo alone caused the turnaround"), `SEED-two-valid-answer-quiz` (high-sev, anchor
"two defensible answers"), `SEED-unsupported-complaint-bait` (clean control, expected []).
Condition results: **(1)** sealed ✓ **(2)** the 64-case gate is untouched — Layer O scores all
64 against C4 bounds and runs FIRST ✓ **(3)** provenance says owner-approved compatibility
fixture, NOT independent human rating; `independentHumanRater: false` preserved ✓ **(4)** a
Layer-O failure halts before any Layer-N/candidate call, and the owner-policy evaluator's
`stageQ.layerO.*` / `stageQ.layerN.*` verdicts enforce the conjunction fail-closed (proven:
missing evidence ⇒ both SOL cells fail) ✓ **(5)** each instantiates an existing C1/C4 class
(causal-overreach / quiz-defect / clean-control specificity) — no new ground-truth rule ✓
**(6)** the mapping table discloses the three Layer-O-only classes; SEED items are counted
separately in all reporting ✓. Ratified corpus: `layer-n-corpus.ratified.v1.json` sha
`fd9b3d8719d4b593093a4e15ed60f633e27d5133ca0ec63b04e2dc0cb42ba98e` (43/43 human-ratified,
`validateQualCorpus` = [], dryRunOnly clears).

## 4. Repair-demand correction — commit + test evidence

Commit `ec29c6825` (`thresholds.ts` + `tests/migration-thresholds.test.ts`): T9 blocks on the
relative rule ONLY when the 55-XH baseline ≥ `relativeRuleAppliesWhenBaselineAtLeast` (0.1 in
the owner-frozen file); below the floor it is reported informationally and cannot independently
fail. Owner's four mandated cases pinned and green: 0.05→0.09 **pass** (relative informational),
0.05→0.11 **fail** (absolute), 0.20→0.23 **pass**, 0.20→0.25 **fail** (relative blocks at
exactly +5pp absolute). Plus legacy-preservation (no floor ⇒ old behavior) and validator tests.
Targeted files green; **full suite 2,332 pass / 0 fail**. Thresholds r2 sha
`6a90acea1c94f124a5d14ba15d1dcab42ba0b8f64e9ef01df1cab7ca2dcc8c44` (provenance notes record the
correction and supersede `b62459fa…`). Companion commit `d6f25f1c8` = item-2 route hardening
(route-result v1→v2 with regenerated, committed contract manifest `43f1e2db…9ac0`).

## 5. Updated semantic-equivalence verdict

**CLEAN.** Rev 2 of `S16-SEMANTIC-EQUIVALENCE-REPORT.md`: the repairDemand row is now EXACT
MATCH; no unratified deviation remains anywhere in C1/C3/C4/C5; every owner bound is transcribed
exactly or enforced strictly additively (native gate ∧ sealed owner-policy extension).

## 6. B2 extraction manifest — **FAILED (files absent from the supplied archive)**

- ZIP hash: `5e7ec1179d444e99f2a30d6a0c0cfd0c5cd33ead945b1c0cd8778fbf8c8149a2` — **verified,
  matches your statement** (10,690 entries).
- Internal source paths: **none exist.** `V24_CF_J_BUNDLE/chapterflow-v24-author-pipeline/state/indexes/`
  contains ONLY `start-with-why.json`, `the-culture-code.json`, `radical-candor.json`;
  `.chapterflow/runs/` contains ONLY those same three books. Exhaustive listing search: no
  `multipliers.json` index anywhere; no multipliers `*.source.json` under any path. (The zip's
  multipliers material is the CF-I-4 backup — briefs/packets/chapters — already restored earlier;
  it does not include the chapter index or the source-v2 sidecars.)
- Extracted destinations / per-file hashes / byte-match: **N/A — nothing was extracted.** Per
  your rule, nothing was reconstructed, regenerated, paraphrased, or substituted.
- Confirmatory seal hash after inclusion: **does not exist** — the confirmatory remains
  unfreezable (`freeze-check`: multipliers BLOCKED) and unsealed.
- **Cure options (owner):** (a) supply `state/indexes/multipliers.json` + the 9
  `chNN.source.json` sidecars from another authoritative archive, or (b) explicitly waive the B2
  precondition and scope the live authorization to the diagnostic while the confirmatory waits.

## 7. Final seal hashes

**Diagnostic `diagnostic-stack-2026-07` (RESEALED post-correction):**
sealed-manifest self-hash `e8e5d4bb0e98c195c9207a7149cf0361a13ddbe357a3328ded9504fbe3234241` ·
spec `5f27cc1e862b2921e51184d6c98c34a6430bbcbc2c23cf921502f6f18d560616` ·
thresholds **r2** `6a90acea1c94f124a5d14ba15d1dcab42ba0b8f64e9ef01df1cab7ca2dcc8c44` ·
schedule `218a11d7fae8c84a073a8b00e7187d4982018fa5906eff5ca7fc6743fe3e9505` (48 entries) ·
stacks legacy-v24 `0264aa00…` / sol-native-current `16197264…` ·
contract manifest `43f1e2dbc847ca1db981361f367186ca69be6c93397cf7c577b436fa91549ac0`.
Zero-call dry run re-proven GREEN on this seal (ladder complete, 3/48/48 stage calls, honest
INCONCLUSIVE, canonical trees untouched). Pre-correction seal archived, not deleted.
**Confirmatory:** spec valid `8f503c26006a5ab103c7082ac2be81351448a31ec292aeb9cc47e379d271735c`
— **NO SEAL** (B2).

## 8. Expected and maximum call counts (unchanged by the corrections)

Diagnostic: expected **513** / sealed max **1,026** (Layer-O 192/384 · Layer-N 129/258 · writers
48/96 · reviews+agreement 144/288). Confirmatory (post-B2): expected **577** screening / **673**
expanded / sealed max **1,346**. **Campaign sealed maximum: 2,372 live invocations** — finite,
schedule-enforced; the ceiling is a safety bound, not a target; no output-informed calls, bonus
samples, replacement samples, judge retries, or hidden replays (stopping decision persists once;
replays are recorded fields; hash gates detect any sealed-file edit).

## 9. Confirmation: the first live call has not occurred

Zero live model calls to date. Machine-checkable: **0** route sidecars in `logs/exec/` claim
`codex_exec_chatgpt_subscription` (all 29 existing sidecars are `injected_test_runner` suite
doubles or pre-date the telemetry); the only codex-binary invocation this session was
`exec-qualify`'s flag probe (`codex exec --help`, no model); both dry runs and all `--dry` plans
spawn nothing; the auth probe reads auth material without spawning.

---

**Standing state:** corrections complete and committed (`ec29c6825`, `d6f25f1c8`), B1 ratified
and applied, diagnostic resealed and dry-run-proven, route invariant proven whole-graph. **Live
execution is withheld solely on §5's B2 precondition, which cannot be satisfied from the
supplied archive.** On your cure or explicit waiver, the frozen sequence begins immediately with
the diagnostic exactly as scheduled (Layer-O first, serial, C3 pause before unblind) under the
standing authorization — no further general authorization will be requested. IMP-13 remains
dormant; nothing here authorizes publication, promotion, deployment, production routing, gate
weakening, or post-output threshold changes.
