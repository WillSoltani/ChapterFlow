# V24 CF-I Release Verification Report

**Date:** 2026-07-09 · **Verifier:** release verifier / red-team lead / autonomy conductor
(the campaign-orchestrator session, per the CF-I roadmap's orchestrator contract)
**Branch:** `feat/anti-sameness-live-fix` · **Pipeline root (`PIPE/`):**
`scripts/book/prompts/chapterflow-v24-author-pipeline/`
**Method:** diffs-not-reports — two independent verification agents (code-vs-spec, artifact-vs-
claims) + orchestrator-run suites and probes. No worker claim accepted without code/test/
artifact evidence.

## 1. Branch and commit state

| Commit | What |
|---|---|
| `260fa13e0` | CF-A..CF-F content-feedback wave (committed 2026-07-09, pre-CF-I) |
| `116527f92` | **CF-I campaign commit** (this verification): detectors C32–C35, de-minted rotation, register rule, advisory surfacing incl. the regen fix, quiz application keys, promote tag strip, forensics doc, CF-I prompt pack/roadmap — 33 files, +2,959/−17 |
| `3c84ae1eef98` | `chore(books): publish multipliers package to live catalog` — created and **pushed** by the canonical publish-final transaction (4 files) |

**Push disclosure:** publish-final's atomic transaction (bridge→register→commit→push→verify)
pushed the branch through `3c84ae1eef98` — carrying `260fa13e0` and `116527f92` to origin — as
designed and as disclosed before running it (HOM precedent, owner-instructed publish). No other
push was made. Intentionally NOT committed: multipliers working state (swept by publish-final's
canonical cleanup; the git-committed package is the durable record), run logs, `.chapterflow/`
run dirs, the pre-repair backup, stray parallel-session test files.

## 2. Worker reports reviewed

- CF-I-4 repair report (memory: `cf-i-4-multipliers-repair-2026-07-09`) — mechanism, detector
  before/after, waiver, the regen re-mint finding, publish command.
- CF-I-1 forensics deliverable: `PIPE/docs/v24/CF-I-LEAKED-LINES-FORENSICS.md`.
- Implementation evidence in-tree (critics, tests, card diffs) — treated as the primary record;
  no separate CF-I-1/2/3 prose reports existed, so verification went straight to diffs.

## 3. Worker verification matrix (condensed; full detail in the agents' findings)

| Prompt | Objective | Status | Key evidence |
|---|---|---|---|
| CF-I-1 C32 meta-case | artifact-protagonist detector | **VERIFIED** | subject-position heuristic + doc-sidecar exemption; fires on distilled ch02 fixture; gold pin = 1 (SWW ch07) |
| CF-I-1 C33 beat-vocab | dealt-vocabulary echo | **VERIFIED (calibrated)** | single source of truth `machineryPhrases.ts`; per-chapter threshold ≥3 families (spec said ≥2; gold measurement authorized narrowing per the spec's own >50% rule); book-level ≥3 chapters per spec |
| CF-I-1 C34 doorway | citation-date-as-scene | **VERIFIED** | person-acts-with-date exemption incl. provenance-verb exclusion; "Kennedy stood before Congress" negative fixture |
| CF-I-1 C35 lineage-key | quiz key rewards citation | **VERIFIED** | key+explanation dual pattern; distractor citations stay legal |
| CF-I-1 BP34 hook | aphorism scan incl. hooks | **VERIFIED** | bookRepetition.ts:499 + test |
| CF-I-1 forensics | 4 leaked lines classified | **VERIFIED** | all 4 classified with proposed fix class; banned-phrases.json diff EMPTY (report-only, per owner decision 5) |
| CF-I-2 de-mint | instruction strings unquotable | **VERIFIED + hardened** | 6 strings de-minted; release red-team found the replacements minted NEW quotables ("reckoning" ×2, "set but not yet met") → fixed (see §8) |
| CF-I-2 register rule | card-level prevention | **VERIFIED** | rule 8 REGISTER + DOORWAY tightening; CF-A/CF-B pins intact; card delta +600 = exactly at cap (pin 18,700→18,820, under the ≤19,000 rule) |
| CF-I-2 surfacing | advisories reach repair lanes | **PARTIAL → FIXED** | wired into write-retry + review-repair but NOT the three regen paths (live-proven re-mint on ch02) → fixed at authorRun.ts:755 (see §8) |
| CF-I-3 quiz rule | keys test application | **VERIFIED** | "KEY IS A MOVE" rule + schemaHint + self-verify; `sourceGrounding.ts` byte-unchanged |
| CF-I-4 repair | multipliers leak-free + gates | **VERIFIED** | all 8 artifact claims confirmed (see §9); acceptance 80.4 record real and operative |

Advisory-only contract held everywhere: C31–C35 map to "minor"; `ENFORCED_MAJOR` = {EW1, SEAM1,
SEAM2} unchanged; ship-gate predicate `blockers===0 && enforcedMajors===0` and book-gate
`blockers===0` byte-unchanged.

## 4. CF-I verification result

**LANDED.** Detection (4 detectors + BP34 hooks, corpus-pinned), prevention (de-minted
instructions + register rule + deal↔gate pin over all 15 instruction maps), repair routing
(write-retry, review-repair, and — after the release fix — all three regen paths), packaging
(promote-time machinery-tag strip + `PPKG.machinery_tag` verifier check). Pipeline-wide, not
book-specific (grep-verified: book names in comments/fixtures only; one cosmetic note — C34's
org/publication head list carries corpus-derived proper nouns in matching logic).

## 5. C31 verification result

**LANDED as designed (advisory + routed, not gated).** C31 remains advisory-minor; advisories
now reach retry cards, review-repair directives, and regen attempt-1 cards (the release fix);
repaired multipliers measures 0 evaluator-opener findings across 9 chapters (was 2 chapters ×10
pre-repair); direct assertion added that advisory-carrying chapters still pass the ship gate.
The fresh-book run (§autonomy report) is the live test of prevention-at-write-time.

## 6. Cross-book leaked-line verification result

**Handled as intended (detection/planning only).** All 4 lines classified in
`CF-I-LEAKED-LINES-FORENSICS.md` ("the limit is just as important" [12 books] writer-default →
banned-phrases entry proposed; "the overcorrection is easy to miss" [3] → instruction rewrite
proposed; 2 lines under threshold → no action). No fixes implemented, banned-phrases.json
untouched — awaiting the owner checkpoint.

## 7. Tests run and results

- Targeted CF-I files (7): pass 55 / fail 0. author-arch: 68 / 0.
- Full suite at intake: **pass 1967 / fail 0 / xenv 6** (worker claim reproduced exactly).
- Full suite after release fixes: **pass 1974 / fail 0 / xenv 6** (+7 = exactly the new tests) —
  run twice (fix agent + orchestrator), identical counts. Typecheck clean throughout.
- No new failure hidden under baseline: fail 0 at every step; xenv 6 is the standing
  gold-corpus-absent set.

## 8. Red-team findings and fixes (all fixed same-session, committed in `116527f92`)

1. **Regen re-mint gap (S1, live-proven):** review-FAIL/acceptance/budget-repair regens never
   received C31–C35 advisories → ch02's regen re-minted 10 evaluator openers. Fixed:
   `authorRun.ts:755` — regen attempt-1 cards now carry the advisory block reflecting the exact
   draft reviewers saw; empty-safe; text-only. Tests: seeded-regen carries block, clean-regen
   doesn't, fresh writes unchanged, advisory-only chapters still `passed === true`.
2. **De-mint minted new quotables:** "reckoning" appeared in two instruction strings and the
   stem "set but not yet met" survived. Fixed: both strings re-worded (stage-direction voice);
   watchlist gained `reckoning` (bare; corpus-measured 0/0/1 — the one hit IS the ch02 leak),
   `first sign nobody` (scoped — ch06's "first sign of strain" is legitimate idiom, spared),
   `set but not yet met` (0/0/0 reader-facing). Gold pins unchanged after re-measure.
3. **C32 exemption over-breadth:** modal `will` in case summaries could silently disable C32.
   Fixed: `will` dropped; ambiguous doc-nouns (brief/letter) exempt only as the case LABEL's
   head noun. Gold pin unchanged (= 1).
4. **Machinery beat labels shipping in example display `tags`** (multipliers ch07 "early
   signal"/"return point"; also latent in HOM/execution packages): not rendered by the reader
   UI today (verified: `ExamplesList.tsx` never reads tags) but reader-deliverable JSON. Fixed
   at the strip layer (`stripInternalFields` — required placement: the verifier recomputes the
   strip on both sides) + `PPKG.machinery_tag` verifier check (blocker severity, mirroring
   every other check in that file). Whole-tag equality for "reckoning" — `dare-to-lead` ships
   the legitimate framework tag "reckoning, rumble, revolution". Verified live: the published
   multipliers package contains ZERO machinery tags and no planSpec keys.

Red-team questions answered without code change: bad-chapter-passes-because-advisory → by
design, layered with review bar 80 + acceptance panel + routed repair text (recorded, not a
gate change); quiz-easier risk → keys now test application while keyEvidence grounding is
untouched; synonym leakage → partially mitigated (new families), honestly residual for
paraphrase-level echoes — detection is a watchlist, prevention is the register rule; stale
artifact promotion → promote verified "review 9/9 at current contentHash" for all 9 and the
operative acceptance record post-dates the final write.

## 9. multipliers final validation result

All 8 CF-I-4 claims independently CONFIRMED: detectors 0/9 (only the waived C33 book-level
"early-signal" family — fleet-baseline waiver independently reproduced: multipliers 5/9 = 56%
vs gold 57% / HOM 56%); per-chapter composites 84.3–88.1 (ch02 86.1); repairs changed real
bytes with untouched chapters byte-identical; quiz lineage→application flips genuine (before/
after quoted); facts preserved (Nadella 2014, Project Aristotle 180 teams, Pixar Braintrust);
hook clone broken; no collateral damage to any other book. Honest residuals recorded: ch02 ex02
("The Bare Year") retains machinery texture one notch under C32's density gate — deliberately
NOT rewritten (the artifact published is the owner-approved artifact); the C33 waiver has no
durable artifact in `state/waivers/` (report-text only — process note).

## 10. multipliers acceptance score and boundary

**Pooled composite 80.4** (median 80.4), gate PASS 3P/0F, 3/3 valid readers, 36/36 quiz-key
checks each, vs floor 74 — and above the premium telemetry target 80 (first v24 book to clear
it). Operative record `acceptance.round1.47158612.r1.json` (post-dates the final ch02 write;
two earlier stale reads identified and set aside). QC: 9/9 PUBLISHABLE stamped post-repair.

## 11. Whether multipliers was published

**YES — published 2026-07-09.**

## 12. Publish command used

Canonical chain, exactly as the pipeline prints it:
1. Operator self-heal (documented HOM-precedent action for the promote fail-close, §13):
   `normalizeChapterProvenance("multipliers")` — reconstructed ch06/ch09 (`kind: "reconstruct"`).
2. `npx tsx src/cli.ts promote-book multipliers --title "Multipliers, Revised and Updated"
   --author "Liz Wiseman"` (title/author from the run's own frozen research TOC — never
   synthesized) → **PROMOTED, 0 blockers** across every stack.
3. `npx tsx src/cli.ts publish-final "multipliers"` → all preflights ✓, bridge sha256 MATCH,
   register, sentinel, commit `3c84ae1eef98`, push, sync 0 0, canonical cleanup (72 paths).

## 13. Package/bundle verification

- Package `book-packages/multipliers.v21.json`: sha256 `3c97829d0f3b…`, 193,219 B, 9 chapters,
  overhead 14.5%; `verifyProductionPackage` PASS (sidecar-aware) at preflight.
- Zero machinery tags, zero planSpec keys (direct read post-publish).
- Registration: `bookPackages.ts:134` import + auto-register block at `:2063+` — this is the
  bundled-package wiring prod quiz grading reads (grading correct once deployed; until then the
  app has neither the book nor its grading — consistent).
- Catalog entry: `id: multipliers, title: Multipliers, Revised and Updated, author: Liz
  Wiseman` in `booksCatalog.metadata.json`.
- Promote fail-close root cause (2 × `PPKG.authoring_provenance_missing`) resolved by the
  documented self-heal; no code change, nothing staled (authoring excluded from attestation
  hashes).

## 14. Deploy / live verification status

**NOT deployed — honestly pending.** No deploy was faked. Sentinel
`book-packages/.pending-deploy.json` now tracks BOTH `high-output-management` (published
2026-07-08) and `multipliers`. Exact commands (as printed by publish-final):
```bash
BOOK_CONTENT_BUCKET=<bucket> AWS_REGION=us-east-1 npx tsx scripts/book/upload-book-packages-to-s3.ts
gh workflow run deploy.yml -f environment=prod -f deploy_app=true
npm run verify:live   # clears the sentinel on repo↔S3↔deployed parity
```

## 15. Confirmation no unrelated book was promoted

Verified: `git status` over `book-packages/` shows only `multipliers.v21.json` + the sentinel;
the publish commit touches exactly 4 files; no other book's state or package modified;
`start-with-why` untouched (read-only gold corpus); `high-output-management` untouched.

## 16. Remaining non-blocking risks

1. Paraphrase-level machinery echo is invisible to C33 (watchlist is literal) — the register
   rule is the real defense; monitor in the fresh run's direct read.
2. ch02 ex02 residual texture (below C32's gate) — editorial polish candidate if the book is
   ever content-repaired again; shipped as owner-approved.
3. HOM/execution published packages still carry machinery tags + the "agreement nods" line —
   re-promote of those books (which would now strip tags) and the forensics-proposed
   banned-phrases additions await the owner checkpoint (no mass edit without approval).
4. `state/waivers/` has no durable artifact for the C33 fleet-baseline waiver.
5. Two books now share one pending deploy — a single deploy run clears both.
6. C34's org/publication head list carries corpus-derived proper nouns in src (cosmetic).

**Companion:** `docs/v24/V24_AUTONOMY_GOLD_CORPUS_RUN_REPORT.md` (the-culture-code fresh run —
in progress at time of writing; classification lands there).
