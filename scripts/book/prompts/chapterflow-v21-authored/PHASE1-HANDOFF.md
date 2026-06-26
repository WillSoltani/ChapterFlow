# Pipeline 10/10 Campaign — Progress Handoff (resume after compact)

**Read this first to resume.** Companion specs in the same dir:
- `PIPELINE-10of10-FIX-BACKLOG.md` — the master spec (roadmap + Shared Law + a complete agent-prompt per finding #2–#15 + the first-pass-QC track). **This is the authoritative source of the per-worktree prompts.**
- `FAILURE-MODES.md` — the pipeline's defect catalog; every merged finding added rows.
- `tests/fixtures/regressions.ts` + `regression-tiny-habits-regen.json` — the labeled regression corpus (the `REGRESSIONS.f<N>` true-positive spans each finding's gate calibrates against).

## Mission
Deep analysis of 6 books found the **new** v21 pipeline regressed vs the **old** (Atomic Habits / 48 Laws). 20 improvement findings were identified. We are hardening the pipeline (gates + critics + writer-prompt prevention + semantic bar clauses) so it generates **10/10 content** and — the bonus — **passes QC on the first round** (today: 3rd) to save tokens. Finding **#1 (testimonials-as-evidence) was already fixed by the owner** (`evidenceIntegrity.ts`, EI1/EI2) and is the reference template every other fix mirrors.

## Execution model (worktrees)
- **Across worktrees = parallel; within a worktree = sequential** (a worktree is one working copy, and each worktree's findings share a file — e.g. WT-B's #6/#11/#12 all edit `prose.ts`).
- **CP-1 merge ritual per worktree** (I do this): commit deliverables → `git rebase origin/main` (append-only seams: `FAILURE-MODES.md`, `finalGate.ts` `SEVERITY_FROM_CATALOG`, `STEP-2`, `types.ts` union — `types.ts` union conflicts are trivial-additive, keep all members) → re-validate (`npx tsc -p . --noEmit` + `CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx tests/run.ts`, watch the pass count + check-registry) → `git push origin WT-x:main` → `git pull --ff-only origin main` in `~/ChapterFlow`.

## GIT STATE (as of this handoff)
- `origin/main` = `872b32e10` (= WT0 + WT-E + WT-D + WT-A). Local `~/ChapterFlow` (web/main-base) synced to it.
- Test suite on main: **923 pass / 0 fail**. typecheck clean.
- Worktrees: `~/WT0` `~/WT-A` `~/WT-B` `~/WT-C` `~/WT-D` `~/WT-E` (+ `~/ChapterFlow-books` = canonical main checkout).

## PHASE 1 STATUS — 3 of 5 done

| WT | Findings | Status | Merge SHA | Notes |
|---|---|---|---|---|
| WT0 | corpus | ✅ merged | `bfb2fe8c4` | regen fixture + `regressions.ts` (taxonomy f2–f15 = backlog #2–#15; EI spans in `EI_REGRESSION`; self-test) |
| WT-E | #2h #9 #12s #13 #14s #15 | ✅ merged | `ead3db6dc` | 6 `AXIS_RUBRIC` clauses, all FP-guarded; corruption-axis clauses (#2h on `factual_accuracy`, #14s on `example_coherence`) scoped to YELLOW (no RED-veto); mirrored to `QC-SESSION-PROMPT.md`; MB2–MB7 rows. **WATCH: #12s idea-density may over-YELLOW good focused chapters — calibrate at WT-F.** |
| WT-D | #3 | ✅ merged | `e8e87670c` | `D4.recycled_scenario` (recall-frame) + `D6.key_references_chapter_entity` (keyed-choice; D5 was taken). MAJOR/shadow. Zero-FP on 21 real gold ch. Exemplary. |
| WT-A | #4 #2-sidecar | ✅ merged | `872b32e10` | `GN1.ungrounded_number` — precision-unit-bound (only %/×/fold/magnitude), **v2-gated** (dormant on v1 corpus, activates for v2 gen), v2 positive-control + gold zero-FP. MAJOR/shadow. Sidecar field `replicationStatus: "robust"\|"mixed"\|"contested"\|"failed"` **matches WT-E's hedge clause exactly**. (I finished committing its #4 half + resolved a trivial `types.ts` union conflict.) |
| **WT-B** | **#6 #11 #12d** | ⬜ **TODO** | — | ⚠️ **on stale pre-corpus base `74b33d239`** — MUST `git -C ~/WT-B merge origin/main` BEFORE finishing (needs the corpus + merged seams). All items edit `prose.ts`/`intraBookFieldSimilarity.ts` → SEQUENTIAL. #6 = monotone-short cadence (strengthen `checkCadenceVariance`); #11 = cross-tier paraphrase; #12d = idea-density deterministic proxy. |
| **WT-C** | **#5 #7 #8 #14d** | ⬜ **TODO** | — | base `bfb2fe8c4` (has corpus, 2 behind — clean rebase). All edit `narrative.ts`/`catalogAudit.ts` → SEQUENTIAL. #5 cast (re-arm C23 + cast-count + example↔quiz shuffle); #7 scene-abstraction; #8 exotic-names; #14d outcome-uniformity. |
| WT-F | first-pass QC levers 1–5 | ⬜ AFTER Phase 1 | — | Edits `STEP-2` (writer pre-submit runs `qc-converge`), `REPAIR-CODEX-SESSION.md`, `autopilot.ts`. Validated by **regenerating a benchmark book** (`book-autopilot <id> --regen --no-publish`) and confirming round-1 `DETERMINISTIC-CLEAN`. Lever 1 (writer runs qc-converge pre-submit) is the biggest token win. |

## CP-1 verification checklist (apply to WT-B, WT-C)
1. **Scope** — only the expected files (critic + `finalGate` wiring + `types` union + `STEP-2` + matching `writer-*.system.md` + `FAILURE-MODES` row + new test).
2. **Mechanical** — typecheck clean; full suite green; **check-registry passes** (no dup/unregistered catalog id).
3. **Calibration law (deterministic gates)** — the test MUST fire on the bad TPs **and** prove **zero-FP on gold** (synthetic `goldChapterFiles()` + real `daring-greatly`/`start-with-why` via `STATE_CHAPTERS`). VERIFY the gold assertions actually **ran** (not `skip()`ped) and are **meaningful** (a v2-gated gate needs a v2 positive-control, else gold-FP is vacuous — see WT-A).
4. **Severity** = `major` in shadow; `ENFORCED_MAJOR` stays empty (promote to blocker only after gold-clean).
5. **Both prevention surfaces** patched (STEP-2 R-rule + the writer-*.system.md mirror).
6. **Read the detector** for over-fire risk (FP-guards / exemptions — e.g. central-concept, title words, sidecar real entities, mirroring EI/SC9).
7. Then commit + rebase + re-validate + push (the ritual above).

## KEY CONVENTIONS (so we don't re-derive)
- **New deterministic critic** (mirror `src/critics/evidenceIntegrity.ts`): pure detector `(text)→Hit[]` + gate fn `checkX(chapter, sidecarOverride?)` + field-walker `{unit,text}[]`; `.js` imports (NodeNext); `finding("<ID>.<slug>" as any, severity, msg, evidence)` (evidence auto-truncates 200); add id to `CriticCheckId` union in `types.ts`; register `"<ID>.<slug>": "major"` in `SEVERITY_FROM_CATALOG` (`finalGate.ts` ~L122 — `push()` THROWS if unregistered); invoke in `runShipGate` (~L748). Book-level checks go in `bookGate.ts` instead.
- **Re-arm** advisory: one line in `SEVERITY_FROM_CATALOG`. **Next free C-id was C24+**; `D5` taken; in use now: `D4`,`D6`,`GN1`.
- **Semantic bar** (`semantic/publishableBar.ts`): append a clause to the axis string in `AXIS_RUBRIC` (each needs a "NOT the defect:" FP-guard) + mirror into `QC-SESSION-PROMPT.md`; `AXIS_WEIGHTS` must sum to **100** (hard invariant, a test asserts it); add to `CORRUPTION_AXES` only if a hit should RED-veto.
- **Tests**: custom harness `tests/harness.ts` (`test`/`xfail`/`skip`), `node:assert/strict`, fixtures `tests/helpers.ts` (`makeChapter`, `goldChapterFiles`, `STATE_CHAPTERS`). Run: `npm run test` or `npx tsx tests/run.ts <substring>` (always `CHAPTERFLOW_NO_API_CODEX_QC=1`). typecheck: `npm run typecheck`.
- **Two generation surfaces**: `agent-prompts/STEP-2-WRITE-CHAPTERS.md` (the `R<N>` authoring-law rules; `R7` is the EI template) AND the per-field `prompts/writer-*.system.md` (read as `system:` by `generateChapter.ts`). Patch BOTH. `STEP-1-RESEARCH.md` only for a new sidecar field.
- **First-pass QC**: `qc-converge <bookId>` runs the exact deterministic battery `finalize` uses (`CLEAN ⟺ finalize raises zero deterministic findings`). Autopilot's `doGate` already loops it; the WRITER path does NOT — Lever 1 closes that gap.
- **State debris**: tests regenerate untracked `state/zz-fixture-*` files — never commit them; `git add` only the named deliverables.

## OPEN WATCH-ITEMS
1. **#12s idea-density** (WT-E) — over-YELLOW risk on legitimately focused chapters; soften if WT-F's benchmark regen shows it flagging good content.
2. **GN1 + EI v2-gating** — dormant on the all-v1 production corpus; they activate only for v2-sidecar-generated books. Correct design (pairs with prevention rules), but means they don't retroactively scan existing books.
3. The merged quality gates are all **MAJOR/shadow** — they surface as QC debt but do not block ship yet. Promote individually to `blocker` only after the gold-clean proof holds (and only if WT-F shows generation reliably passes them).

## NEXT ACTIONS (after compact)
1. Hand me back this file. Confirm `origin/main` is still `872b32e10` (or note new merges).
2. When WT-B / WT-C arrive: run the CP-1 checklist, then the merge ritual. **WT-B: merge main into it FIRST** (stale base).
3. After both Phase-1 worktrees merge → **WT-F** (first-pass QC), validated by a benchmark regen.
4. Out of scope for the pipeline (the last 0.5 to a true 10): the app track #16–#20 (personalization, doing-loop, spaced retrieval, dual-coding, generative assessment).
