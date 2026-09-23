# Owner decisions for the v25 execution

How this works: each decision shows the RECOMMENDED choice and why. Confirm by filling the `CHOICE:` line.
Sessions read this file. A session that needs a decision whose `CHOICE:` is blank uses RECOMMENDED only when
the switch below is `yes`; otherwise it stops with BLOCKED and asks. Run prompt S00 for an interactive walkthrough.
D4 has no default below a probe composite of 75 — fill it after S02 reports.

ACCEPT_RECOMMENDED_DEFAULTS: yes
<!-- set to yes to let every session use the RECOMMENDED choice for any blank CHOICE -->

---

## D1 — What counts as done
- A: the full pipeline outcome — a Franklin package promoted through every gate on main code (or D12's fallback if a gate outcome is
  final), scored, delivered, pipeline closed out.
- B: stop after evaluating the current draft (rr21): run S01, S02, S04 (scoring fix only), S12 in CANDIDATE mode on rr21, S13; skip the rest.
- RECOMMENDED: A (your 2026-09-23 instruction: "by the end of it, the whole pipeline work is complete").
- CHOICE: A — full pipeline outcome (owner, S00, 2026-09-23 UTC)

## D2 — Reader-panel blocking rule (S06)
Today any single seat's BLOCKER fails the book: 0 of 14 panels passed; P(pass) ≈ 4e-5. Replayed over the 13 complete panels of run 39a37d06:
- A: 2-of-3 corroboration. A `READER.BLOCKING.<category>` blocks only when ≥2 distinct seats raise the same category on the same chapter;
  a single-seat finding becomes WARN `READER.SINGLE_SEAT.<category>` (kept in the review record). Deterministic matcher: chapter + category.
  Exceptions that still block on ONE seat: `unsafe` and `schema_or_app_breaking`. Historical result: 1 of 13 panels passes (P12);
  P10 has 0 corroborated blockers but is held by a single-seat `unsafe` finding on ch06.
- A2: as A, but `unsafe` also needs two seats; only `schema_or_app_breaking` still blocks on one seat (its two historical hits were the
  card-back renderer bug fixed by #573). Historical result: 2 of 13 pass (P10, P12). The single-seat `unsafe` findings seen so far were
  practical-advice framing (ch05, ch06 debt revival, ch12, ch16) — S06 lists them for you in its PR.
- A-semantic: a model adjudicator decides "same problem" (≈2 of 13 with A's exceptions; adds calls; non-deterministic).
- B: keep the union rule (no path to PASS; D1-A becomes unreachable).
- Context: the historical rates include the raw early panels; once the loop plateaued (P8–P14) A2 passed 2 of 7. Every QC-repair link
  also needs a PASS on its first verdict, so the pass rate drives the whole run's length and cost.
- RECOMMENDED: A2. Factual single-seat defects it lets through are meant to be caught by the source-fidelity judge in fresh QC (S02 measures that).
- CHOICE: A2 — 2-of-3 corroboration (chapter + category); `unsafe` also needs two seats; only `schema_or_app_breaking` blocks on one seat (owner, S00, 2026-09-23 UTC)

## D3 — "Each summary tier must stand alone" findings (28.5% of all panel blockers)
- A: unchanged (under D2 they block only when two seats agree).
- B: downgrade to WARN — needs a design first: these are ordinary `structurally_invalid` findings with no code or tag of their own.
- RECOMMENDED: A.
- CHOICE: A — unchanged (owner, S00, 2026-09-23 UTC)

## D4 — Rubric promotion bar (fill AFTER S02 reports its probe)
The rubric needs composite ≥ bar (default 80; knob 60-95; re-judged each run at no cost) AND every factor median ≥ 70 (code constant)
AND a unanimous correctness verdict (a SPLIT fails). Panel proxy today: 75.9-77.5; fresh readers scored rev-6 ~12 points lower.
- A: keep 80.
- B: a different bar for this test book: ____ (the factor floor 70 and the correctness gate stay).
- C: do not start S11; apply D12-A to rr21. Choose C when S02 shows a correctness SPLIT/FAIL or a factor median below 65 — the bar cannot
  fix either, and both are final for a candidate.
- RECOMMENDED: A when S02's probe composite is ≥ 75 and its correctness vote is PASS; otherwise no default — decide from status/S02.md.
- CHOICE:

## D5 — Align QC rule BP15 with the compile rule SEC52 (prose carve-out for absolute words in quiz distractors)
The two gates disagree; aligning clears 16 of 19 BP15 blockers on rr21. It loosens the QC gate.
- A: keep BP15 strict (the QC-repair lane rewrites the distractors). Cost: on rr21 the QC blockers touch 15 of 19 chapters, and every chapter a
  QC-repair link rewrites is re-read by a panel that must PASS on its first verdict.
- B: align BP15 with SEC52 (QC blockers would touch about 11 chapters).
- RECOMMENDED: A (no gate loosening). Revisit B only if QC repair cannot converge in S11.
- CHOICE: A — keep BP15 strict (owner, S00, 2026-09-23 UTC)

## D6 — The final Franklin run (S11)
- A: FRESH run from main after all fixes, reusing run 39a37d06's research (`RESEARCH_RUN_ID=20260918T123418217Z-0e835cda-3c5b-4984-8a0b-105634df246a`)
  so the 19-chapter map is exactly the one S09b keys the fact pins to (a regenerated map comes from a model call and can shift boundaries).
  Content fixes (S09a/S09b) apply; all section packs recompile (~3 h); the dispute budget starts fresh; provenance on origin.
- B: RESUME run 39a37d06 (cheaper; no content fixes; its dispute budget is already spent, so any new all-declined ordinal forces a fresh run).
- RECOMMENDED: A.
- CHOICE: A — FRESH run from main, reusing run 39a37d06's research (owner, S00, 2026-09-23 UTC)

## D7 — How #566–#575 land on main (S01)
- A: fast-forward `main` to the tested combined commit 9f0117cb7 (exact tree, full suite 3291/0), then close #567–#575 as superseded
  (GitHub marks #566 merged automatically — same SHA).
- B: merge each PR (3 need manual rebase/re-resolution: #571, #574, #575; #574/#575 must be retargeted to main first).
- Note: `assessment/reports/open-ledger.md` uses the opposite letters (its "Option B" is the fast-forward = D7-A here).
- RECOMMENDED: A, after S01's adversarial review of the three hand-resolved commits passes.
- CHOICE: A — fast-forward main to 9f0117cb7 after S01's review passes; close #567–#575 as superseded (owner, S00, 2026-09-23 UTC)

## D8 — #559 (draft-time banned-phrase refusal; parked, conflicting, never CI'd)
- A: close it (not needed; assembly eviction converges).  B: rebase + review + merge after the book.
- RECOMMENDED: A.
- CHOICE: A — close #559 (owner, S00, 2026-09-23 UTC)

## D9 — Quota and machine discipline
- Engineering sessions (S02–S10): at most 3 running at once, and at most 2 adversarial-fix workflows in their review phase at once.
- S11 starts within 24 h after a Tuesday 23:00Z reset, with no other Claude Code sessions or agent workflows running (other projects' agents
  share the same weekly cap) until it reaches promotion. Keep the Mac awake and the S11 terminal open.
- RECOMMENDED: as written.
- CHOICE: as written (owner, S00, 2026-09-23 UTC)

## D10 — Push / merge authority for sessions
- A: sessions may push branches and open PRs; the OWNER merges (sessions stop and list PRs to merge).
- B: sessions may also squash-merge a PR whose two adversarial reviewers PASSed with RED reproduced and whose full suite shows fail 0
  (and, after S10, the v25 CI job is green). Fast-forwarding main in S01 and deleting merged v25 branches in S13 count as merges.
- RECOMMENDED: B for speed (the permission classifier may still refuse; then the session prints the commands).
- CHOICE: B — sessions may squash-merge PRs meeting the stated bar (incl. S01 fast-forward, S13 branch deletes) (owner, S00, 2026-09-23 UTC)

## D11 — publish-final
Always the owner. Not a choice.

## D12 — If the final run cannot be promoted
Triggers: a rubric FAIL on the factor floor, churn or correctness (FAIL/SPLIT) — final for that candidate; the QC-repair budget exhausted;
a second disputed review (if D13 says stop); quota exhausted with no promotion in sight; D4 = C; or D1 = B.
- A: stop spending. S12 runs in CANDIDATE mode on the best candidate (the last one that passed the panel or QC, else the latest): a scratch
  assembly, both scorecards, the accuracy audit and the evaluation page. No release and no publish-final. Then S13.
- B: one more FRESH run (~$120 of compile plus the review loop), then A if that also fails.
- RECOMMENDED: A.
- CHOICE: A — stop spending; S12 CANDIDATE mode on the best candidate, then S13 (owner, S00, 2026-09-23 UTC)

## D13 — Run budgets and optional hardening (env knobs only; no gate or verdict change)
- `CHAPTERFLOW_OPERATOR_COMPILE_RETRIES` = 50 (code default 20; a Franklin run exhausted 20 once — franklin-v7b-driver.out:73-74).
- `CHAPTERFLOW_REVIEW_REPAIR_ORDINALS` = 40.
- `CHAPTERFLOW_QC_REPAIR_RUNS` = ____ (range 1-10; driver default 4). Each link needs a first-verdict panel PASS.
- After a PROVIDER BLOCK, S11 may raise `CHAPTERFLOW_QC_JUDGE_RUNS`, `CHAPTERFLOW_RUBRIC_RUNS` or `CHAPTERFLOW_QC_REPAIR_RUNS` by the number of
  ordinals the block provably burned (provider text in that ordinal's records), within each knob's range.
- S08 scope: A skip it (the knob authority above covers provider burns; S13 registers the items as deferred); B items 1-3; C all items.
- A second disputed review in the final run (`MAX_DISPUTED_REVIEW_SUPERSESSIONS=1` is a constant): A stop and apply D12;
  B S11 lands a small PR making it an env knob (default 1, range 1-3; #574 precedent) and resumes with 2.
- RECOMMENDED: 50 / 40 / 6 / yes / S08 = A / dispute = B.
- CHOICE: COMPILE_RETRIES=50 / REVIEW_REPAIR_ORDINALS=40 / QC_REPAIR_RUNS=6 / provider-burn top-up = yes / S08 = A (skip) / dispute = B (knob, resume with 2) (owner, S00, 2026-09-23 UTC)

## D14 — Candidate release (`promote-book … --resume-unfinished-release`)
Deterministic, 0 model calls. It overwrites the tracked `$PIPE/book-packages/the-autobiography-of-benjamin-franklin.v21.json` and writes the
production-manifest sidecar. The printed command carries literal placeholder `--categories` and `--tags`.
- A: S12 runs it, filling categories and tags from the tracked rev-6 package on origin/main (re-read them; never invent reader-facing metadata).
- B: the owner runs it; S12 waits.
- RECOMMENDED: A.
- CHOICE: A — S12 runs it, categories/tags from the tracked rev-6 package on origin/main (owner, S00, 2026-09-23 UTC)
