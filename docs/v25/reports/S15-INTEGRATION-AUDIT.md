# §15 Integration-Verification Audit — GPT-5.6-SOL Migration (v25)

**Audit date:** 2026-07-10 · **Auditor:** Claude Fable 5 session `64ea07aa` · **Plan:** `docs/v25/GPT56_SOL_MIGRATION_MASTER_PLAN_AND_PROMPT_PACK.md` §15 (@3257-3376)

**Audited identities:** pipeline tree = campaign tip **`f2079c1c3`**; audit ran at HEAD **`e1a1bc464`** (one foreign documentation-only commit above the tip); the pipeline tree at HEAD is **byte-identical** to `f2079c1c3` (`git diff f2079c1c3..e1a1bc464 -- scripts/` is empty). **Report SHA-256:** recorded in the preserving commit's message — a file cannot embed its own hash. Owner accepted this audit 2026-07-10: §15 = PASS; §16 authorized in principle, execution gated on owner inputs C1–C5.

**Independence disclosure:** this session was also the implementation worker for IMP-08..11. Verification of ALL packages was delegated to five independent read-only audit subagents instructed to treat worker reports as hypotheses and verify adversarially against code and test source; all machine evidence (suite, typecheck, contract-validate, hashes) was recomputed on the integrated tree. The adversarial check had teeth: it surfaced two defects in this session's own work (a false wording claim in the IMP-11 report; an understated matcher-risk in the IMP-09 report — G1/G3 below). The owner may re-run §15 in a fresh session if organizational independence is required; every claim below is file:line-verifiable.

---

## 1. Identity / hash manifest

- Repository `~/ChapterFlow-books`, branch `feat/v25-pipeline` (no upstream; never pushed).
- **Base:** `b8815ca028a492e09e62be57c17b29346bcce3a6` · **Campaign tip (integrated identity):** `f2079c1c35ef38b81564bc72370e9d6ec2a55cc4` (IMP-11) · **Audit HEAD:** `e1a1bc4648323ed6ff7f3d71b034ce8a9d37a751` (tree `fd5fd83cab9c…`).
- HEAD − campaign tip = one foreign docs-only commit (owner's 140-book evaluation snapshot + 4 `.gitignore` lines). **`git diff f2079c1c3..e1a1bc464 -- scripts/` is EMPTY** — the pipeline tree audited/tested at HEAD is byte-identical to the integrated tip; all evidence binds to `f2079c1c3` for pipeline code.
- Campaign diff `b8815ca02..f2079c1c3`: **174 files, +31,650/−1,251, every file inside the pipeline dir or `docs/v25/`** (exclusion grep = zero files elsewhere; web app/infra/v21 untouched).
- 13 commits, one per package. Report `baselineHash` → parent-commit chain exact for all 13 (§2).

## 2. Contract-version and requirement-traceability audit

- `contract-validate` on the integrated tree: **contract-freeze PASS** (live contracts match the frozen 9-contract manifest) + **13/13 `implementation-report.imp-*.json` PASS**. Field-level drift is caught as hash divergence (`tests/contracts-freeze.test.ts:29-58`); the freeze test also validates the landed reports against the frozen worker-report schema with adverse arrays present (`tests/migration-contracts.test.ts:48-62`).
- Hash chain: every report's `baselineHash` = previous package's commit sha, `b8815ca02` → … → `c9d77f499` (imp-11). No package built on an unidentified base.
- Traceability: **207 requirements — 191 implemented, 13 partial, 3 deferred; 0 `bookSpecificExceptions`; 0 `unexpectedWrites`** in every report. Every partial/deferred names an owner that subsequently landed (00→01/08/10; 01-R05→07; 03-R06→10; 05-R07→07/08; 12-R13→06; 12-R14/15→11) or a §16-execution input (02-R16/R18 usage/live-qualification; 10-R03 usage stream) or an out-of-scope-by-no-push item (12-R19 outer CI). None is an unresolved P0/P1 code gap on the bakeoff path.
- IMP-11's experiment schemas are versioned module types (model-bakeoff-v1 tradition), not forks of frozen contracts; frozen AgentRole union untouched.

## 3. Changed-file classification

| Commit | Package | Files | +/− |
|---|---|---|---|
| 1946b320b | IMP-00 envelope + contract freeze | 39 | +7,449/−72 |
| d2361b757 | IMP-01 transactions/CAS | 31 | +5,779/−438 |
| 365d5b3c6 | IMP-02 model policy/outcomes | 8 | +792/−31 |
| 39a172d00 | IMP-03 source ontology/envelope | 16 | +1,917/−37 |
| d4c4416d0 | IMP-12 hermetic/hostile fixtures | 14 | +1,380/−1 |
| e076c9ff1 | IMP-10 evidence store | 10 | +1,159/−2 |
| 500705668 | IMP-05 prompt diet | 11 | +657/−447 |
| ebac39cec | IMP-04 register critics | 13 | +929/−13 |
| e6f38dc16 | IMP-06 de-recipe + shadow diversity | 17 | +1,797/−87 |
| 531db1461 | IMP-07 typed repair | 7 | +1,111/−41 |
| 8653046c1 | IMP-08 blind review/2-phase quiz | 26 | +2,769/−172 |
| c9d77f499 | IMP-09 validator hardening | 12 | +920/−39 |
| f2079c1c3 | IMP-11 bakeoff harness | 25 | +5,122/−2 |

- All five subagent diff reviews: **no out-of-scope or unexplained change** in any commit. Cross-file touches are documented integration (e.g. IMP-04's 3 lines into the IMP-03 plan block; IMP-11's additive `authorRun.ts` opts + one CLI case). Notable disclosed items: IMP-00 committed the 3,993-line master plan (docs-only); **IMP-01 committed + adapted the owner's pre-branch model-bakeoff module** (`src/bakeoff/**`, ~3.5k LOC, compare-only by default — the baseline tool F-017 analyzes; disclosed in the commit body and report; explains the only `--publish`/`--force` boundary-grep hits, neither reachable from the migration harness).
- Lane-order compliance (plan §12): 00 first; 01/02/03/12 post-freeze; 05→04→06; 07→08→09; 12 before 11; 11 last ✓. IMP-10 landed per its Lane-A rule (after 00–02); its deferred review-linkage hooks wired when IMP-08 landed.
- Suite pass-count monotone across the campaign (2086→…→2323); **skip=18/xenv=6 constant — no test disabled to get green**.

## 4. F-001–F-024 evidence matrix

| F | Sev | Pkg(s) | Verdict | Load-bearing evidence |
|---|---|---|---|---|
| F-001 atomic writes | **P0** | 01 | **pass** | `.attempts/<id>/workspace` candidates; CAS `commitChapterCandidate` sha-compare + pending→committed manifests (`chapterTransaction.ts:269-309`); exactly ONE canonical write path (static test `chapter-transaction.test.ts:230-240`); crash recovery idempotent (`:338-359`) |
| F-002 model/effort confound | P1 | 02, 11 | **pass** | explicit 4-cell candidates; baseline pinned `NORMAL_PROFILE="baseline-55"`; confirmatory spec = exactly 55-H/55-XH/56S-H/56S-XH one stack (`spec.ts:81-88`) |
| F-003 scattered routing | P1 | 02 (13 dormant) | **pass** | one `resolveRoute` authority on every hermetic spawn (`codexAgent.ts:288`); static scans forbid baseline literals + silent SOL defaults; RouteResultV1 sidecar per spawn |
| F-004 source ontology absent | P1 | 03, 04 | **pass** | typed origin/form/claimStrength/sufficiency (`sourceUsePlan.ts:14-36`); compiler-owned, hash-bound (`sourceUsePlanCompiler.ts:283`) |
| F-005 projection drops permissions | P1 | 03 | **pass** | projection restores replicationStatus/doNotRestamp/naturalSetting/capped risks (`sourcePacketProjection.ts:76-105,144-190`); provenance still excluded |
| F-006 concreteness > evidence | P1 | 04, 05 | **pass** | 5-arm sufficiency policy on the plan block; <2 hardSpecifics ⇒ explanation-only, `"full"` never minted (`sourceUsePlanCompiler.ts:204-238`) |
| F-007 invented-lead register | P1 | 04, 09 | **pass** | generic⇒role labels; constructed applications typed + framed; lead thread typed non-factual; D7 structured aliases (R3 nuance §13) |
| F-008 recipe monoculture | P1 | 05, 06 | **pass** | arc-table/lens/shape taxonomies de-minted from writer render; requirement ledger maps every removed rule to a retained owner; outcome constraints kept |
| F-009 duplicate card instructions | P2 | 05 | **pass** | ledger `docs/v25/IMP-05-REQUIREMENT-LEDGER.md:33-66`; precedence rendered first (`authorRun.ts:291-298,596`); card drift hash pinned |
| F-010 repair dependency closure | P1 | 07, 08 | **pass** | typed patches only; full battery re-run on patched candidate incl. plan-mutation scan + non-scope byte-drift proof (`authorRepair.ts:526-573`) |
| F-011 quiz/causal late + regress | P1 | 08 | **pass** | two-phase quiz with commit-before-key (`quizDerivation.ts:115-155`); **blocking keyCheck predicate byte-identical** (`readerReview.ts:518,539`; test proves mismatch still blocks); causal claim map advisory |
| F-012 brittle lexical matchers | P2 | 09 | **pass** | structured alias sets; shadow corpus zero old-correct-new-wrong; concept-lead STRICTER (vacuous skip closed); residual R3 |
| F-013 grounding≠named entities | P2 | 04, 09 | **pass** | register critics judge by DECLARED kind (license-gated tests); SC9 plan-aware, only shrinks findings, bounded by plan, fail-closed on corrupt plan |
| F-014 evidence not durable | P2 | 10 | **pass** | content-addressed store, append-only journal, reconstruct-from-manifest tests, retention classes; capture opt-in (documented) |
| F-015 late/noisy review | P2 | 02, 08, 11 | **pass** | pre-commit invariants (03/04/07/08); evidence-bound complaints; agreement double-reads + kappa in harness metrics |
| F-016 diversity = new mold | P2 | 06 | **pass** | shadow-only config, activation structurally requires held-out evidence record (none exists); only exact-clone may ever block; no writer-visible taxonomy (tests) |
| F-017 bakeoff unsafe for migration | P2 | 11 | **pass** | no-publish sibling harness; 3-layer no-promotion; production model-bakeoff remains separate/compare-only |
| F-018 CI hermeticity weak | P3 | 12 | **partial (honest)** | temp-root abstraction + always-on shadow-state gate + opt-in full leak guard; legacy tests still write pipeline-local dirs — disclosed ratchet, non-blocking (P3) |
| F-019 ambient Codex context | P1 | 00 | **pass** | auth-only isolated CODEX_HOME; env allowlist; `project_doc_max_bytes=0` + `--ignore-user-config/--ignore-rules`; hashed manifests fail-closed; exec-qualify |
| F-020 write authority | **P0** | 00, 01 | **pass** (author route) | isolated-workspace profiles, `writableRoots=[]` ⇒ no `--add-dir`; unexpected-write scan; conductor-owned CAS; legacy v23/compilerRun routes retain broad authority — disclosed, off migration path (G4) |
| F-021 artifacts trusted | P1 | 03 | **pass** | one untrusted envelope at author/repair (+review via findings normalization); delimiter-forgery defusal; adversarial injection fixtures prove route identity unchanged |
| F-022 procedural blindness | P1 | 08 | **pass** | reviewer cwd = isolated tmp workspace (manifest matrix: phase-1 doc ONLY); key-blind fail-closed; renderer-version carry invalidation; R1 substrate note §13 |
| F-023 bakeoff stats/qualification | P1 | 11 | **pass** | Stage-Q 8-class qualification wired before review; cluster bootstrap over blocks; rule-of-three pinned; frozen stopping vocabulary; inconclusive-over-overstated thresholds |
| F-024 activation safety | P1 | 13 | **not assessable — dormant by design (dormancy VERIFIED)** | zero IMP-13 artifacts; no activation/canary engine (grep clean); baseline default proven; prerequisite mechanisms landed (outcome taxonomy, drift fingerprints, decision-file activation refusal). Per §15 instr. 4 + 22 ("through IMP-12"), excluded from the bakeoff bar; it gates CUTOVER, not the bakeoff |

**All P0/P1 findings whose packages are in scope (F-001..F-023): pass.** F-024 is the plan's own post-bakeoff package.

## 5. IMP-00–IMP-12 implementation matrix; IMP-13 dormancy

All 13 packages **pass** (per-package evidence: agent reports A–E, summarized in §§4,6-10). IMP-13: **dormant confirmed** — no reports, no activation code, `BASELINE_MODEL="gpt-5.5"` + `NORMAL_PROFILE="baseline-55"` resolve every task class to GPT-5.5; SOL profiles exist only as call-explicit candidate matrices (`modelPolicy.ts:108-126`).

## 6. Role permission and effective-context matrix

- Spawn boundary: only `defaultCodexRunner`; real spawn without a role THROWS (`codexAgent.ts:237-243`); static scan pins `role:` on every spawn literal + exactly one legacy `...process.env` (test-double branch).
- Envelope per spawn: mkdtemp CODEX_HOME copying ONLY `auth.json` (fail-closed if absent); 20-name env allowlist (secrets/ambient `CHAPTERFLOW_*`/hostile `CODEX_HOME` proven dropped); explicit `--sandbox`, `--ignore-user-config`, `--ignore-rules`, `-c project_doc_max_bytes=0`, `-c model=`, `-c model_reasoning_effort=`; effective-context manifest hashed + persisted PRE-spawn, sink failure ⇒ refuse to run.
- Role profiles: author-writer/author-repair = isolated-workspace + workspace-write (cwd = attempt workspace, `writableRoots=[]`); direct/tiebreak/quiz-derivation/acceptance readers = isolated-workspace + read-only, workspace contains ONLY the phase-1 doc; quiz-adjudication alone receives the phase-2 doc; key-material to a key-blind role THROWS.
- CLI qualification: `exec-qualify` verifies required flags; missing capability ⇒ `policy_preflight_failure` (fail-closed).
- Enumerated non-codex model path: legacy Claude/API route (`claudeClient.ts`/`providers/router.ts` — generateBook/generateChapter, agents, quizKeyJudge) is NOT enveloped but is unreachable from the audited codex conductor and API-backed promotion is blocked (`no-api-promote.test.ts`; envelope forces `CHAPTERFLOW_NO_API_CODEX_QC=1`). Documented residual, off the migration path.

## 7. Transaction / write-path matrix

Successful commit ✓ (validate→pending→atomic write→committed manifest) · malformed/truncated ⇒ `malformed_output` vs `validation_failed` distinct · crash mid-commit ⇒ pending bracket + idempotent recovery · unexpected write ⇒ workspace post-scan failure · stale base ⇒ `stale_base` + `aborted_stale_base`, **never auto-retried** · concurrent candidates ⇒ CAS first-wins, loser recorded `superseded` · rename failure ⇒ thrown infra error, pending resolves next mint · provenance failure ⇒ post-commit try/catch + hash-binding auto-stales acceptance (`isAttestationFresh`) · candidate files excluded from readers/monitor (`.attempts` outside `state/`, gitignored). Preferred schema-output protocol was QUALIFIED AND REJECTED ON EVIDENCE (33 KB echo did not complete via `-o`/`--output-schema`); the isolated-workspace fallback is the active protocol — plan-sanctioned, recorded.

## 8. Source / repair / review invariant matrix

- Source plan: compiler-owned, immutable per attempt, hash-bound (`sourcePlanHash` in transaction), package-excluded, compact; relabel via metadata rejected + routed upstream (fake-writer test proves zero canonical writes); prose-only relabel covered by advisory C37 + unchanged SC11 anchors (R-C1 note).
- Repair: typed leaf-replacement patches; base/plan/old-value hash pins; in-memory apply on deep clone; dependency closure re-run incl. plan-mutation scan + non-scope byte-drift proof; stale ⇒ reject never rebase; regen separate, cap 2.
- Review: physical workspace isolation; phase-1 renderer contains no key/explanation (`renderReaderDoc.ts:60-64,98-100`); derivation frozen + hash-committed BEFORE key reveal; adjudication advisory — blocking keyCheck unchanged; REVIEW_DOC_HASH v2→v3 kills stale carries; byte-quote verification preserved (phase-1 = legacy byte-prefix).
- Injection: 7-shape hostile strings inert through the untrusted envelope (exactly-one opener/closer; forged-close defused); spawn-boundary test proves requestedModel/effort/taskClass/profile identical under hostile card.

## 9. Conflict-matrix resolution (§13 → evidence)

All 29 rows resolve with direct code/test evidence; the load-bearing ones: hermetic-vs-credentials (exec-qualify fail-closed) · guidance-vs-card (hostile AGENTS.md tests; filename-agnostic neutralization) · conductor-output-vs-self-check (card's "write exactly one file" targets the isolated candidate; conductor gates; no self-check loop) · structured-output-vs-truncation (both protocols qualified, evidence-recorded choice) · diet-vs-source-rules (03→05→04 order held) · diet-vs-diversity (05/04 before 06; taxonomy-leak tests) · relabel-vs-immutability (hash input + negative tests in 03/04/07) · patch-vs-schema-evolution (versioned patch, stale-base tests) · quiz-blindness-vs-quote-compat (versioned renderer, byte-prefix preserved) · isolation-vs-source-review (manifest matrix per role kind) · critic-expansion-vs-FPs (C37 advisory; activation contract requires held-out record) · lexical-vs-weakening (shadow corpus, zero regressions, concept stricter) · routing-vs-comparability (candidate/judge explicit; route logged; harness identity asserts) · reviewer-bias (qualified panel + human adjudication + per-judge metrics) · legacy-vs-SOL-stack (diagnostic factorial separate from qualification) · rare-defect-vs-N (precision plan + pinned rule-of-three) · first-write-vs-infra (≤1 replay, originals retained, reported separately) · safeguard-vs-content (distinct outcome, no replay; markers empty-by-design — G6) · retention-vs-debris (classes; cleanup refuses active/cited) · acceptance-vs-post-change (hash-bound auto-stale) · contract-drift (freeze + this audit) · activation-vs-rollback (IMP-13 dormant; `last-qualified-sol` inert).

## 10. Evaluation / statistical readiness

- Design frozen in code: confirmatory exactly 4 cells/1 stack/≥2 books/4 strata/samples≥2; diagnostic factorial both stacks; seal freezes spec+inputs+stacks+thresholds+schedule+instruments+panel+prices; unblind refuses until metric-tables hash + thresholds copy match the seal; screening→expansion decision persisted once; frozen stopping vocabulary (unknown rule throws; futility beats expansion).
- Qualification: 8-class Stage-Q over the REAL reviewer; `assertJudgeQualified` wired before any scoring; refuses missing/failed/stale-instrument/dryRunOnly-in-live.
- Statistics independently recomputed: rule-of-three 300/n (36→8.3333%, 150→2%, 300→1%); cluster bootstrap resamples (book,chapter) BLOCKS (2-block/10-sample test: CI width driven by blocks); pairedBlockDeltas exposes missingBlocks; kappa + material-disagreement in reviewer-reliability inputs.
- Thresholds vs plan §16 (@3499-3514): faithful on all 12 groups; T3 = {75%, −10pp, ci-lower-above-floor, point-clears/interval-misses ⇒ INCONCLUSIVE} exact; sole asymmetry = T10 economics passes on null bounds (owner hasn't frozen them) — every other group is inconclusive-on-missing (condition C5).
- Tokens/cost: honest-null + `TOKENS_UNAVAILABLE_REASON`; no estimation (route exposes no usage — verified).
- §15 input 8 (dry-run manifest): produced structurally by conductor tests driving the REAL phase ladder to real manifests under temp roots; the §16-specific no-model dry run is §16 execution-procedure step 2 (the specs it seals are owner inputs). Mechanisms verified; artifact pending §16 seal.
- **Conditions-precedent for §16 EXECUTION (harness enforces each absence — these do not weaken authorization):** C1 human-labeled Stage-Q corpus (synthetic ⇒ dryRunOnly ⇒ live review refuses); C2 legacy-v24 card snapshot dir (combinedSha256 pinned; verified again at use); C3 `human-adjudication.json` (absent ⇒ zero-severity groups INCONCLUSIVE — no profile can QUALIFY); C4 owner-frozen thresholds file (defaults are plan-sanctioned starting point); C5 freeze economics bounds or accept T10 as informational.

## 11. Exact test commands and unedited log references

On the integrated tree (HEAD `e1a1bc464`, pipeline-identical to `f2079c1c3`), from the pipeline dir, this audit:

- `CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx tests/run.ts` → **pass 2323 · fail 0 · xfail 0 · xpass 0 · xenv 6 · skip 18** (exit 0) — log `s15-full-suite.log` in the audit session's scratchpad (session-local; the summary line quoted here is the unedited output).
- `npx tsc -p . --noEmit` → clean (exit 0).
- `CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts contract-validate` → contract-freeze PASS + 13/13 reports PASS.

## 12. Gate / hard-code / fallback / retry / publish audit + red-team

- Gate changes: exactly 2 declared, both ADDITIVE (SP15/SP16 blockers; always-on test hermeticity gate). Five independent diff reviews found **no weakened gate/threshold/acceptance predicate** (gate `blockers===0`, bars 80/74, caps, keyCheck predicate, D7/SC9 severities all byte-preserved), **no unbounded retry** (all caps pinned; stale-base never auto-retries; `infraReplay ≤1`, safeguard/content never replayable), **no book/chapter/range branch** (static anti-hardcode scans + 0 declared exceptions), **no publish/deploy/push/S3** (containment + added-line scans; migration harness structurally cannot promote), **no silent fallback** (typed outcomes; refuse-to-spawn on invalid route; loud shadow-degrade).
- §15 red-team checklist — **11/11 defeated**, each with mechanism + test: hostile `AGENTS.override.md` (filename-agnostic neutralization) · personal-config model default (auth-only CODEX_HOME + explicit argv) · writer side-effect mutation (sandbox cwd + workspace scan) · concurrent commits (CAS first-wins, loser typed) · fake tool-call in source/complaint (envelope; route identity proven unchanged) · sourced→generic relabel (metadata channel closed; upstream routing) · patch touching plan/non-approved path (hash pins + allowlist + mutation scan) · key in phase-1 metadata/sibling (workspace = exactly one file; in-memory manifest; `assertPhase1KeyIsolated` pins 5 leak shapes) · qualification passes after threshold tweak (thresholds sealed + hash-gated unblind; qual bound to instrument versions) · quiz items as independent chapters (block-resampling bootstrap) · no-promotion reaches packaging via alternate flag (subverbs audited; no promote rung; verb-stripped deps; rooted writes).

## 13. Residual risks and gap prompts (verified only; none blocks the bakeoff)

Risks: R1 reviewer sandbox restricts writes/network not READS — blindness rests on pointer-starvation (workspace/prompt contain no repo path/book id/model) + neutralized discovery; key-bearing forensic copies live in-repo under `scratch/review/` · R2 shared tmpdir base could transiently expose sibling workspaces to concurrent same-uid runs · R3 single-token alias grants entity-suffix tokens ("Airlines") — a same-suffix decoy could satisfy D7 on multi-word entity leads (P2; still needs fastRead + 2-example use; shadow corpus lacks this fixture; worker report understated this) · R4 legacy v23/compilerRun routes keep broad write authority (off migration path) · R5 `SAFEGUARD_MARKERS` empty ⇒ real refusals classify conservatively as content/infra until calibrated (never replayed either way; cell-symmetric) · R6 IMP-10 evidence capture is opt-in (§16 harness sets its own roots) · R7 CAS is single-process (PID-locked conductor) · R8 suite hermeticity is a ratchet (F-018 P3) · R9 legacy Claude/API route un-enveloped (unreachable from conductor; promotion-blocked) · R10 judge-qual thresholds are source constants, not seal data (instrument-version-bound; a change is a reviewable code edit).

Gap prompts (post-audit, per §15 "verified gaps become separate prompts"):
- **G1 (doc):** the IMP-11 report and a `runExperiment.ts` header comment say "verifySealIntact runs before EVERY phase". Precisely: `verifySealIntact` — the FULL seal re-verification (spec/thresholds/schedule byte-hashes, frozen shared inputs, current-builder card re-render, snapshot re-hash, instrument versions) — runs before the **qualify, generate/review, metrics, and analyze** phases (`runExperiment.ts:232,277,320,337`). The **unblind** phase is gated instead by the narrower frozen-artifact checks: the metric-tables file must re-hash to the manifest's frozen `metricTablesSha256` and the thresholds copy must re-hash to the sealed `thresholdsSha256` (`runExperiment.ts:367-372`); **decide and report** run strictly downstream of that gate and consume only the already-frozen artifacts. No live-model or frozen-input-consuming phase runs unguarded — the wording overstated uniformity, not safety. Fix the two sentences.
- **G2:** reviewer read-jail follow-on — per-spawn workspace baseDir + relocate/purge in-repo `scratch/review` key-bearing forensic copies (R1/R2).
- **G3:** D7 suffix-decoy fixture + entity-suffix stopwording or bigram requirement (R3).
- **G4:** narrow legacy v23 fanout/compilerRun write authority to the IMP-01 pattern (R4).
- **G5:** ratchet `CHAPTERFLOW_LEAK_GUARD=1` to always-on once legacy leak offenders are closed (R8).
- **G6:** calibrate `SAFEGUARD_MARKERS` from observed refusals during §16 (record manually if observed; do not guess markers) (R5).

## 14. Decision

Every §15 stop criterion was checked and none fires: base identified; no P0/P1 partial/untested (F-024 dormant-by-design per §15 instr. 4); no ambient instruction/config/model path on any audited spawn (hostile fixtures pass); content-agent authority isolated on the migration path with disclosed, justified legacy debt; CAS complete; source plan writer-immutable; artifacts cannot expand authority; phase-1 cannot access the key; judge qualification + statistical plan present and frozen; no blocker weakened; no book-specific fix; evidence current to the exact hash; tests pass in full on the integrated tree.

**BAKEOFF AUTHORIZED: YES — all P0/P1 findings pass with file:line evidence on integrated tree `f2079c1c3` (audited at HEAD `e1a1bc464`, pipeline-identical); contract-freeze + 13/13 worker reports PASS; full suite 2323/0; no gate weakened, no unbounded retry, no book-specific branch, no publish/promotion path reachable from the migration harness; IMP-13 dormant and its activation remains UNAUTHORIZED. §16 execution remains gated on operator inputs C1–C5 (the harness enforces each absence: dryRunOnly ⇒ live refusal; missing adjudication ⇒ INCONCLUSIVE).**
