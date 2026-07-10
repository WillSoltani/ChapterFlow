# FINAL HARDENING PASS — 2026-07-04 (grilled)

Owner directive: verify the calibration/repair/STIER campaign, fix its defects, implement the
four remaining items (deploy path, W3 causal rule, multi-read acceptance median, texture
observation), then regenerate ONE gold-corpus book end-to-end and publish+deploy it.

Three independent read-only audits ran first (card-vs-gate, boundedness, deploy-path). This
plan records their confirmed findings and the grilled decisions. Constraint set: never weaken
schema/factuality/safety/rendering/publishing gates; no vague untestable rules; surgical
diffs only; general for future books.

## Verified-OK from the previous pass (no action)
- Regen cap 2 + repair cap 1 are consumed durably BEFORE spawns; failed repairs consume too.
- Repaired chapters cannot skip the blinded review (hash-bound carry).
- Repair vetoes (prose/quality-adjective/count-change/unclassifiable) fail closed.
- Kill switch CHAPTERFLOW_REVIEW_REPAIR=0 disables classification, cap burn, and spawn.
- shippedControl: malformed env fails closed; missing shipped package → margin clause waived.
- Hard accept conjunction: quorum AND gate PASS AND ≥74 AND ≥shipped+5; churn is telemetry.
- B15 dealt-count gate holds on both sides; B19 strong-pass filter present.
- Sweep: persona_drift/CORRUPTION/uncited still block; texture demotion is gate-local only.

## Defects found in the previous pass (fix in this pass)
Card-vs-gate (batch 1): D1 retry-card lenTell says "no extremes" vs caps 4-shortest/1-longest;
D2 card strawman list names "briefing" not in STRAWMAN_LEXICON; D3 rule 3 "each…AND…" vs
gate's EITHER; D4 cardQualityChapter.fail counts advisory echo as fail (exported artifact
field); D5 rule-1 "aim middle" fights CHB8 20% shortest FLOOR; D6 churn lane "ONE document
tableau" vs brief "at most 2" (state precedence); D7 CHB10 repair ceiling 8 vs brief 15/10
(state precedence); D8 CHB6 opener classes stale vs v4 (missing tension-thesis); D9 rule 4
says whole-chapter ease, gate measures breakdown prose. Plus: QUALITY BAR preamble claims
deterministic enforcement for all 6 rules — true for 2; re-tag per rule GATED vs SCORED.

Boundedness (batch 2): F1 acceptance records overwrite per label → gate-FAIL stickiness
decays after one re-entry; F2 pooled "median" is upper-median = max-of-2 (biases ACCEPT —
inverts the re-roll guard); F3 acceptance panels uncapped across conductor re-entries on
identical bytes; F4 budget-repair writer spawns bypass the regen ledger (unbounded re-spend
on re-entry); F5 capped-out chapters re-burn review reads before the exhaustion halt; F6
repair restore-on-failure swallows its own failure (disk can diverge from review pointers);
F7 control-read cache write failures are silent (recompute every entry).

Env (fixed immediately): untracked scratch/ scripts broke root typecheck → tsconfig now
excludes scripts/book/prompts/*/scratch/**; scripts null-guarded.

## Grilled decisions

### Multi-read acceptance median (replaces the broken pooling guard; closes F1/F2/F3)
- Every panel read persists append-only: acceptance.<label>.rN.json (schema v2 keeps the
  full per-reader verdicts for explainability). The legacy single-slot file stays written
  as the LATEST read so existing consumers keep working.
- Reads pool per docSha256 (unchanged keying — any byte change re-keys honestly).
- Trigger: read 1 always runs. Extra reads run ONLY if |composite − nearest binding
  boundary| ≤ NOISE_BAND (boundaries: floor 74 and shipped+5 when present) — obvious
  pass/fail stays one read (cost control).
- Cap: 3 panel reads per docSha TOTAL, durable across re-entries (counting persisted
  records). At cap the pooled decision FREEZES for those bytes — re-entries reuse it, no
  fresh spawns. Byte change (regen/repair) re-keys and unfreezes. Closes the re-roll casino.
- Aggregation: TRUE median of read composites (even count → mean of middle two).
- Blocker preservation: any pooled read with gate FAIL → gate FAIL sticks for that docSha
  (never outvoted by median). Quorum shortfall stays an infra halt, not a vote.
- Config: NOISE_BAND default 3.7 (measured tonight), env CHAPTERFLOW_PANEL_NOISE_BAND with
  the same fail-closed parse as the beat-shipped override (set-but-invalid → halt).
- Rejected: N reads unconditionally (2x-3x panel cost on obvious decisions); mean (outlier
  sensitive); best-of (that IS the exploit); majority-decision-only (loses the composite
  for margin/telemetry).

### W3 causal-attribution rule (two live incidents: execution ch01+ch09 Q1)
- Card: new clause in rule 5 — causal stems ("why did/what caused/what led to/what
  explains/main reason") must key ONE specific cause named in the breakdown prose; sibling
  distractors = plausible same-family causes each refutable by a specific sentence; the key
  must be a CAUSE, not the outcome restated and not a remedy/lesson.
- Deterministic backstop: causal-STEM detection is lexical-structural (stem-shape regex) —
  allowed; key-QUALITY judgment is semantic — NOT gated deterministically (standing rule:
  CHB14/15/17 lexical quiz-tell gates measured inverted; never re-propose). The new check
  (BP33, quizQuality.ts) flags only the mechanical failure modes of the two live incidents:
  causal stem whose keyed choice is imperative-led (remedy-shaped, ch01-Q1 class) or whose
  keyed choice restates the stem's outcome clause (echo overlap, bounded), ADVISORY first;
  calibrate against all 137 shipped packages before any promotion to blocker. Zero-FP on
  the owner top-5 required to ever gate.
- Semantic enforcement stays where it caught both incidents: the dual-blind key-judge
  (already fail-closed at publish) + a new named criterion in the blinded reader
  instrument so chapter reviews price it pre-publish.
- Fixtures: minimal bad (remedy-key + outcome-echo) and good (prose-anchored cause)
  fixtures; live incidents' pre-repair bytes were pruned with execution state.

### Deploy path (recon: publish ends at git push BY DESIGN; server grades from S3 copy;
### deploy workflow's OIDC role cannot upload packages; zero parity checks anywhere)
- Keep publish-final's no-AWS invariant (it runs on the Codex subscription with no creds).
- Sentinel: publish-final writes tracked book-packages/.pending-deploy.json (bookId,
  packageSha256, publishCommit, publishedAt, steps) IN the publish commit; re-publish
  merges entries. It is the machine-readable "deploy owed" flag.
- verify-live-sync (scripts/book/verify-live-sync.ts, read-only): (a) /api/health .commit
  vs sentinel publishCommit ancestry, (b) S3 package sha vs repo package sha (when creds
  present), (c) live catalog presence. Clears satisfied sentinel entries; exits nonzero
  while pending. Wired as `npm run verify:live` — NOT into `npm run verify` (offline/CI
  must not require prod reachability; grilled and rejected).
- Loud reporting: publish-final final report + autopilot outcome print the exact three
  next commands (upload-book-packages-to-s3, deploy dispatch, verify:live) whenever the
  sentinel is non-empty.
- BucketDeployment (the deploy workflow's own TODO): implement only if cdk synth validates
  locally; prune MUST be false (never delete unmanaged objects). Otherwise document as the
  named follow-up in the sentinel steps.

### Texture (P5)
- v4 idiom/shell deals + sweep texture triage stand. Fix D8 so a dealt tension-thesis hook
  isn't misclassified into CHB6's claim budget (deal-aware, mirrors the B15 dealtExampleFloor
  precedent). Add a one-line texture visibility summary (sweep advisory families + CHB6/CHB8
  bands) to the acceptance/publish log so the gold-corpus run surfaces drift live.

### Gold-corpus regen target: start-with-why
- The suite's own gold fixtures are daring-greatly + start-with-why (repo convention).
- Single-framework book (Golden Circle) = the exact genre where texture/churn levers need
  their first full-lever test from chapter one.
- Rejected atomic-habits: its shipped panel read (~80) + margin 5 puts acceptance at ~85
  pooled — above the best board ever measured (78.4); the run would deadlock at a gate we
  are forbidden to weaken. A control read of atomic-habits stays a cheap separate follow-up.

## Execution order
1. Batch 1 card/gate fixes (D1-D9, preamble tags) + suite.
2. Batch 2 multi-read median + F1-F7 + tests.
3. Batch 3 W3 (card + BP33 advisory + reader criterion + corpus calibration + fixtures).
4. Batch 4 deploy (sentinel + verify-live-sync + reporting [+ BucketDeployment if synth-clean]).
5. P6 consolidations (length-budget + timer literals single-sourced), P7 suites + red-team.
6. book-run start-with-why --author --regen with monitors; surgical repairs only.
7. publish-final → S3 upload → deploy → verify:live → final report.
