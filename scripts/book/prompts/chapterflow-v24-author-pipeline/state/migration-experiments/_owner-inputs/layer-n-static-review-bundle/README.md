# Layer-N Static-Review Bundle

**Purpose:** a self-contained, read-only, credential-free bundle for the owner-directed **offline static review**
of the native Layer-N judge-qualification instrument, which failed live on 2026-07-11 with an instrument-invalid
signature. **No remedy is proposed in this bundle, and no further live model calls are authorized** until the
static review resolves Layer-N's intended purpose (A / B / C — see below).

- **HEAD:** `23c4ede4efe88722a658130ad536a2fcf34ef51d`
- **Result:** `LAYER_N_INSTRUMENT_INVALID_PENDING_STATIC_REVIEW` — **not** a judge-capability verdict.
- Every file below is a **copy** (or a computed extract) — the live corpus, thresholds, scorer, anchor matcher,
  reader-review prompts, gate, and seals were **not modified**.

## The decision the static review must make

The instrument fails on an unresolved design question — **what is Layer-N meant to qualify?**

- **A** — full **shippable-chapter review** (fixtures must be ~80+ quality chapters carrying planted defects).
- **B** — **targeted defect detection** (the gate must not use the ship/pass bar as the flag/detection signal).
- **C** — a capability **distinct from Layer-O** (must be defined; Layer-O already covers structured
  candidate-content / review-finding / security / injection judging).

A vs B vs C decides whether the fix is the corpus, the scorer, or the gate's purpose. See
`LAYER-N-GATE-FAILURE-REPORT.md` §4.

## Start here

1. `RESULT.json` — the classification record and the A/B/C question, machine-readable.
2. `LAYER-N-GATE-FAILURE-REPORT.md` — the narrative: run, failure signature, code-level root cause.
3. `LAYER-N-FAILURE-EVIDENCE.json` — per-judge metrics, fixture sizes, clean-control composites, partial judge-3.
4. `MANIFEST.json` — every file in this bundle with its repo path, sha256, and git blob (at HEAD), by category.

## Layout

- `code/` — the gate & scorer: conductor (`runExperiment.ts`, qualify phase), and
  `qualification.ts` (validator `validateQualCorpus`, scorer `scoreJudgeQualification`, detector `anchorMatched`,
  `DEFAULT_QUAL_THRESHOLDS`, gate `assertJudgeQualified`), plus `experimentTypes.ts` and `thresholds.ts`.
- `review-code/` — the real reader-review instrument the gate drives: `authorReview.ts` (`reviewOneChapter`,
  phase-1 + phase-2), `readerReview.ts` (`AUTHOR_CHAPTER_BAR = 80`, rubric), `renderReaderDoc.ts`
  (`renderChapterReaderDocPhase1`), `reviewFindings.ts`, `reviewerWorkspace.ts`.
- `fixtures/` — `original/<itemId>.chapter.json` (source chapters), `rendered/<itemId>.phase1.txt` (the exact
  docs each judge read), `expectations.json` (class, cleanControl, planted `mustQuote` anchors, injectionMarker,
  labelProvenance), and `corpus/` (the corpus JSON + pending-ratification + seed fixtures + mapping table).
- `results/` — `qualification/*.qualification.json` (authoritative per-judge scores, 2 completed judges),
  `driver-log.txt` (per-item composites/verdicts incl. partial judge-3), `exec-records/` (token-free per-spawn
  `.manifest/.result/.route` records for this run).
- `seals/` — sealed `schedule.json`, `sealed.json`, `spec.sealed.json`, `thresholds.sealed.json`, run `manifest.json`.
- `tests/` — perfect-oracle and real-instrument qualification/review tests.
- `git-context.txt` — HEAD, working-tree status, and Layer-N implementation history.

## Credential exclusion

This bundle contains **no** credentials, OAuth tokens, `auth.json`, or temporary Codex home material. Per-spawn
records store only hashes and route metadata (`executionRoute` / `authMode` / `apiKeyPresent:false`), never token
contents; a full token-pattern scan of every included file was run at assembly time and is recorded in
`MANIFEST.json` (`scrub`).

## Preservation limit (read this before asking for raw judge text)

Qualification reads run with `persist=false`, and `exec-records/*.result.json` store only **hashes** of the model
output — the judges' raw complaint **text** was not written to disk. Re-deriving it would require live calls, which
are not authorized. The aggregated scores, the rendered docs the judges read, and the per-item composites/verdicts
are fully preserved and are sufficient to assess the instrument statically.
