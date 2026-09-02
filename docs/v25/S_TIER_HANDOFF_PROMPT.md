# ChapterFlow v25 pipeline — S-tier campaign handoff

You are taking over a long-running autonomous campaign on the ChapterFlow book pipeline. Read this whole document before touching anything. Your first job is **analysis and exploration**; you continue the remaining work **only after the owner says go**.

## 0. Rules of engagement (non-negotiable)

1. **Never assert what you have not verified** — not in a commit message, a PR body, a code comment, a report, or a model-facing prompt. Eight adversarial-review rounds in this campaign each produced a demonstrated REJECT for exactly this (a test-fixture number presented as live evidence; "the panel named no defect" where advisories existed; a sibling lane "never had" a bug it demonstrably had). Code gets verified by tests; prose about code gets verified by nobody unless you do it.
2. **Every non-trivial change goes through an adversarial review** before it lands. Use the Workflow tool (ultracode is enabled): one build agent in an isolated worktree, one reviewer that must reproduce RED itself, name file and line, and REJECT on any unverifiable claim. Roughly half of first drafts in this campaign were rejected, and every reject was real. Treat a REJECT as the most valuable output of the round.
3. **PR discipline.** Branch from `origin/main`, squash-merge, look up the PR number with `gh pr list --head <branch>` — never guess it (a guessed number merged an unrelated Dependabot PR once, #505).
4. **Never `git stash`.** `refs/stash` is shared across worktrees; sibling agents cross-contaminated through it. Copy files to scratch instead.
5. **Never weaken a gate, threshold, or fail-closed path** to make a run pass. Three deterministic semantic gates were built and rejected this campaign because a lexical instrument cannot judge a semantic property; contradiction, topic-alignment, and similar classes stay panel-judged and are handled per book with scars.
6. **Outward actions are the owner's.** The real `publish-final` (commits + pushes the book into the app repo) is classifier-gated; do not work around it. Surface the exact command and stop.
7. **Canary state is precious.** `~/cf-canary` is the live v25 root. Read it freely; never mutate it from a test or an agent worktree.

## 1. Where things live

- **Repo:** `~/ChapterFlow-books-v25-completion` (canonical worktree for this campaign). Pipeline code: `scripts/book/prompts/chapterflow-v24-author-pipeline/` (call it `$P`). `~/ChapterFlow` is a separate checkout with a `cli.ts` tripwire that refuses to run the pipeline from under it — agent worktrees under `~/ChapterFlow/.claude/worktrees/` therefore fail ~53 CLI-spawning tests. That is environmental; agents must measure their own pristine baseline and prove zero new failures.
- **Verify:** `cd $P && env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY npm run typecheck && npm test`. Main is green at **2880 pass / 0 fail, 55 v25 files**. Always strip the API-key env vars; ambient keys trip the v25 harness.
- **Live root:** `~/cf-canary` (v25 root) and `~/cf-canary-att` (attempt root). Home directory on purpose: macOS reaps `/private/tmp` and ate every earlier root.
- **Drivers:** `~/cf-canary/drive-*.sh` — resume loops with fail-closed stops (provider block, disk < 3 GB, diagnosis gate, non-retryable). Read one before writing another.
- **Scars (per-book content rules):** `$P/config/book-scars/<bookId>.json` — schema requires `$schema, _comment, bookId, phrases, frames, notes, prohibitions`. `prohibitions` are binding writer rules; `phrases` are literal strings banned at the drafting prompt.
- **Scoring skill:** `~/ChapterFlow/.claude/skills/book-score/` (`score.py`, `compose.py`, `RUBRIC.md`, `baseline.json`).
- **Memory:** `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/v25-gpt-audit-2026-07-22.md` carries the full 52-finding ledger. Read it.
- **Report:** `docs/v25/V25_CANARY_COMPLETION_REPORT.md`.
- **Model:** the pipeline runs on `codex exec`; the live pin is `~/.codex/config.toml` (`model = "gpt-5.5"`). `gpt-5.6-sol` was dropped by the provider mid-campaign; 5.5 is the only surviving model on this account and is a single point of failure.

## 2. The pipeline, stage by stage

The entry point is `book-run <bookId> --title … --author … --v25-root … --attempt-root … --source-git-sha <sha> [--regen] [--resume-run-id <id>] [--reconcile-unsettled] [--promote-local] [--no-publish]`.

**Run identity rules (they bit repeatedly):** a run's definition pins `sourceGitSha` and every flag including `--regen`; a resume must pass the run's *own* recorded SHA (read it from `~/cf-canary/run-state/books/<book>/runs/<runId>/run.json`) and identical intent, or it refuses with "already exists with a different definition". The resumable run is the one with an `intake COMPLETED` event in `~/cf-canary/book-run-events/<book>.jsonl` — never "newest directory by mtime". A COMPLETED compile is immutable (11ab): a code fix to a compile-time artifact reaches a book only through a fresh run. A scar edited after a candidate is staged binds only through a fresh run — the repair prompt carries the candidate's own rules digest and logs `book-rules-stale` when they differ.

### 2.1 Research
Per chapter, a model writes a `source-v2` sidecar: named cases with `hardSpecifics` (short tokens, ≤5 words), testable facts, concepts, frameworks. A validator refuses meta-references ("the chapter", "the author") and rejects schema drift; bounded retry with feedback; successor recovery reuses digest-valid sidecars. Anchor ids are chapter-prefixed (`ch01.case.…`, `ch01.fact.…`).

### 2.2 Compile (section packs)
Each chapter is drafted as four packs — summary (hook, counterintuition, fast/deep/full read tiers, key takeaway), example, learning (quiz + review cards), action (if-then plans, 24-hour challenge, weekly practice) — each against a blueprint and a source packet. **Section gates (`SEC*` in `sectionGate.ts`)** validate every pack: anchor citation/resolution (SEC47/51/122), hardSpecific presence per claim class (SEC14/16/33/56/58/74 — quiz/cards need ≥1, narration ≥2, memorable lines ≥1 fully-grounding cited case), derivability from the standalone tiers (SEC120 — stands down when no cited specific reached the page, or SEC58 becomes unsatisfiable), dealt-name discipline (SEC35 — three false-positive batches fixed: temporal adverbs, conjunct adverbs, interjections), em dash (SEC123, mirror of ship-side B5), phrase bans (SEC92), and cross-chapter checks at assembly. Failures produce retry cards with the gate's rule stated; attempts are bounded; operator retries mint fresh attempt ids. Packs are cached (`section-pack-cache`, keyed by blueprint + packet + scars digests) — **scar edits change the digest, so a scar edit forces a full redraft**.

### 2.3 Assembly
Cross-chapter gates (SEC83/89 literal 5-gram reuse, SEC93/94/114 venue and opener saturation, SEC95 batch-relative) run over all packs. A blocking cross-chapter phrase evicts the implicated cached packs and writes durable avoid-context that renders into the redraft card; the avoid-context escalates per round (exact banned tokens, which chapters may keep the phrase) and fails closed as `ASSEMBLY_REDRAFT_UNCONVERGED` after 3 rounds. Memorable lines are selected by one grounding-aware selector that both the gate and the assembler read (compile used to validate sentences that never shipped).

### 2.4 Canonical review (the blind panel)
Three blind reader seats (cold, skeptic, practitioner) read the whole book and return per-chapter factor scores plus blockers. Outcome `PASS` / `FAIL` / `ERROR`. Chapter composite bar is 80 (anchored to the published band taxonomy). Blocker classes seen live: `internal_contradiction`, `structurally_invalid`, `unsafe`, `READER.PANEL.BELOW_FLOOR`, `AUDIT_FALSE_ATTESTATION` / `AUDIT_FALSE_CLEAN` (the panel catching the deterministic audit lying about itself), `ANCHOR_CONTENT_MISMATCH`, `CM0.content_machinery_monoculture`, `PLANSPEC_DOMAIN_LITERAL_DUPLICATE`. **Review-repair lane:** a FAIL routes into a bounded repair of the named chapters and a full re-review of the repaired candidate; the repaired bytes must earn their own PASS. Rounds are a per-invocation spend cap (`CHAPTERFLOW_REVIEW_REPAIR_ROUNDS`, default 2); ordinals are durable identities (`review-repair-N`, ceiling 20); replays are free of the cap. Blockers naming several chapters fan out to each. `ERROR` is an infrastructure outcome, never a verdict: seats retry schema-invalid output with the rejecting message fed back (budget 4), and a repair whose re-review errors retries the review under fresh derived ids before failing with `REPAIR_REVIEW_ERROR`.

### 2.5 Fresh QC
Deterministic sweep (`B5` em dash; `SC11.x` source grounding — `SC11.2` memorable lines use OR-semantics across cited cases; `A11` pinned memorable lines must appear verbatim in a tier; `BP*` book-pattern audit incl. `BP35` per-unit anchor alignment; `PPKG*` package integrity) plus the LLM answer-key judge (every quiz key derived blind). Outcome `PASS`/`FAIL`. **QC-repair lane:** ordinals `repair`, `repair-r2`, … (`CHAPTERFLOW_QC_REPAIR_RUNS`, default 3). A repair that completes with QC still failing is `REPAIR_UNSUCCESSFUL` and stops the walk at the designed escalation `REPAIR_DIAGNOSIS_REQUIRED` naming the round; the operator runs `qc-diagnose <book> --round <id> --v25-root … --attempt-root … --candidate-id … --manifest-digest … --source-git-sha <run's sha>`; the next resume finds the durable diagnosis (earliest by createdAt — append-stable) and chains ordinal N+1 onto ordinal N's successor with `diagnosisId`, which the port's `priorUnsuccessful` gate demands. Ordinals lost to a review ERROR are forgiven (walked past without spend, ceiling +1, bounded 2). Repair briefs are bounded coverage-first (one line per distinct code always survives, remainder counted by code).

### 2.6 Promotion
`--promote-local` advances `~/cf-canary/books/<book>/current.json` (candidate id + manifest digest + revision) by CAS. It does not produce a reader package; the run prints the exact release command.

### 2.7 Release (`promote-book --candidate-id …`)
Builds the reader package (`$P/book-packages/<book>.v21.json`) and the production-manifest sidecar (`$P/state/books/<book>.production-manifest.json`) from the candidate: chapter set from the candidate's own CHAPTER artifacts, per-chapter source evidence from candidate-carried sidecars, QC evidence recorded as `candidateQcEvidence` naming the v25 round (per-chapter v21 attestations are unproducible on a candidate root and the trade is stated in the payload). Verification is two-layer: an optional caller expectation (`expectedChapterSetSource`) must match the declaration, and the manifest's contentId-bound recorded chapter set is the evidence the package must match (truncation, body-swap, and extra-chapter tampers all refuse). The pointer commit is journalled (`~/cf-canary/books/_release-journal/…`); an interrupted release resumes with `--resume-unfinished-release --expected-book-revision <original>` and never double-advances; a stale `pointer-pending` record is resolved by pointer readback. A release advances the revision, so the run's printed `--expected-book-revision` is the value to pass.

### 2.8 Publish
`publish-final <book> [--dry-run] [--v25-root …]` copies the package into the app tree, registers it in the catalog, writes a deploy sentinel, commits and pushes. The preflight states its strength every run: `candidate-store re-verify` (with `--v25-root`: pointer equality, candidate opened from the content-addressed store, candidate-inventory equality — this closes the re-authoring residual), `recorded-evidence replay` (no root), or `legacy-canonical-index`. `register-web` is a dev verb; `publish-final` is the production route. Runbook: `$P/docs/v25-candidate-release-to-reader.md`.

## 3. The quality rubric (the deliverable's yardstick)

The owner's goal is an **S-tier book produced by the pipeline**, measured by the `book-score` skill against the catalog of ~98 gate-passing books.

**Two layers.** A hard correctness **gate** (any reader-visible defect caps the score regardless of composite): quiz-key soundness derived blind; prose/example coherence (no templated loops, cutoffs, scaffold leaks, concept-label-as-subject); factual accuracy of every named framework/study/case/document (a false statement about a real document is a gate failure); grounded numbers; evidence integrity; no invented witness inside a real case; contested claims hedged. Then a **0–100 weighted composite** over ten factors, each scored 0–100 by three independent blind readers and medianed:

| Factor | Weight | What it measures |
|---|---|---|
| Retention | 13 | Portable memorable lines, reworded card backs, one idea per card, sticky framing |
| Quizzes | 12 | Sound keys, distractors that are real misconceptions, application over recall, explanations that say why wrong is wrong |
| Transfer (lens > tactic) | 11 | A reusable way of seeing a class of situations, naming the mechanism, generalizing across domains |
| Practicalness | 11 | Specific varied if-then plans; concrete, doable 24-hour challenge and weekly practice |
| Quality of summaries | 11 | Fast/deep/full tiers progressively deepen without paste-duplication; fast read alone carries the core idea |
| Tone | 10 | Fidelity to the source author's register; non-generic; no aphorism stacking |
| Honesty about limits | 9 | Teaches when the idea does not apply and its failure modes |
| Insight & concreteness | 8 | Reverses a default; real specific cases over hollow proxy characters; outcome variety |
| Idea density | 8 | Every paragraph adds; restatement and padding penalized |
| Beginner-friendliness | 7 | Zero-background reader can follow; terms defined on first use; gentle on-ramp |

Also judged: `book3_churn` (one-house-voice sameness across chapters, LOW/MED/HIGH).

**Tiers:** <60 not publishable · 60–70 mediocre · 70–80 draft · 80–90 ships · 90+ premium. **High-quality bar:** gate PASS · composite ≥85 · no factor <70 · Retention and Quizzes ≥80 · churn ≠ HIGH. S-tier means clearing that bar with a composite above 90.

**Procedure:** `python3 score.py <id> --path <pkg>` (deterministic metrics + seeded chapter indices) → spawn three reader subagents in parallel with the skill's verbatim reader prompt → collect into `readers.json` → **adjudicate a split gate yourself by verifying the disputed fact** (a reader may hallucinate a "verification") → `python3 compose.py --det <det.json> --readers readers.json`.

## 4. Where the two books stand

**Franklin (`the-autobiography-of-benjamin-franklin`, 4 chapters, 37 scars).** Released **revision 6, VERIFIED**. Blind scores: 72.4 with a unanimous 3/3 gate FAIL (analogy-graft machinery inverted two historical facts inside quiz stems) → after the S-tier regeneration, **76.4 with a 1/3 gate FAIL** that I adjudicated as real: ch4 q03's explanation says "Pennsylvania's own charter says nothing about religion", which is false (the 1701 Charter of Privileges opens with a liberty-of-conscience article). Factor medians: retention 76, quizzes 78, transfer 79, practical 75, summaries 74, tone 74, limits 83, insight 77, density 69, beginner 79; churn MED; placement ~#91 of 98. All three readers independently named the same residue: set-phrase token recycling ("forty shillings", "three puffy rolls", "speckled axe" hammered across tiers, cards and prompts), one identical six-example skeleton per chapter, quote-splice seams where memorable lines are re-injected into prose, contrived implementation scaffolding. Those are the next scar classes. The real publish is one owner command (`publish-final … --v25-root ~/cf-canary`), classifier-gated.

**Bennett (`how-to-live-on-24-hours-a-day`, 13 chapters, generality proof, started with zero scars).** Research one-shot, compiles clean under all generic fixes, reaches review; verdicts oscillated 3–6 blockers on the 13-chapter surface and were repeatedly eaten by the reader-lane flake that is now fixed. Scars: gradualism consistency, stated-causes-only, drafting-prompt phrase ban `"strips away"`. Not yet promoted. Its verdict: every defect it surfaced was pipeline machinery, fixed generically; Franklin's scars were book-specific.

## 5. Known debts and open questions

- S-tier not reached; the gap is writing quality (density, tone, summaries), not correctness.
- The panel bar (80 per chapter) passed a book the catalog rubric scores at 72–76. The two instruments measure different things; consider whether the review seats should carry the catalog factors directly.
- `runBookAutopilot` (~600 lines) is unreachable from dispatch; quarantined, cleanup candidate.
- `runFromReviewFail` writes no repair-history record, so `priorUnsuccessful` cannot see review-lane repairs.
- F1: scar edits do not invalidate cache entries directly; the scars digest in the cache key forces a full redraft instead (expensive but correct).
- D4: the 11p memorable-line semantics change (OR across cited cases) was made under delegation and awaits owner sign-off.
- Publish-time candidate-store re-verification exists only when `--v25-root` is supplied; without it the residual (full re-authoring of both files with a recomputed contentId) is disclosed, not closed.
- Disk: the volume hit 100% twice; campaign-generated Codex session logs were deleted, the owner's dev caches (~15 GB) were not. Check `df` before long runs.
- Dependabot #505 was merged by PR-number collision; disclosed to the owner.

## 6. Traps ledger (read before every live action)

`/private/tmp` reaper; `refs/stash` shared across worktrees; `cli.ts` canonical-workspace tripwire; ambient API keys break the harness; resume needs the run's own SHA and identical flags; pick the run by `intake COMPLETED`, not mtime; `--regen` is part of the run definition; a scar edit after staging binds only through a fresh run; immutable COMPLETED compiles; PR numbers must be looked up; agent-reported file names and line numbers can be wrong (verify with `git grep`); a test-fixture number is not live evidence; identical-failure-forever is the signature of an unsatisfiable gate pair, not a content problem; two seats naming the same item means it is in the artifact, seats naming different novel items each round means sampling noise.

## 7. Your tasks

**Phase A — analysis (do now, report before acting):**
1. Read the memory ledger and the completion report; reconcile them with `git log origin/main --oneline -60`.
2. Score Franklin revision 6 yourself with the skill (fresh readers) and compare to the 76.4 card; note reader variance.
3. Read the actual revision-6 package (`$P/book-packages/the-autobiography-of-benjamin-franklin.v21.json`) as a reader would and write your own assessment of what separates it from a book scoring above 90 — with quoted evidence, not impressions.
4. Map each below-80 factor to the pipeline component that produces it (which pack, which gate, which prompt) and propose the smallest generic change or scar class that would move it, with the false-positive risk of each stated.
5. Examine the panel-vs-rubric calibration question in §5 and recommend whether the review seats should score the ten factors directly.
6. Check disk, provider availability (`codex exec --skip-git-repo-check 'reply with exactly OK'`), and the live root's integrity before proposing any run.

**Phase B — on the owner's go-ahead only:**
1. Land the next Franklin scar classes (token recycling, single example mold, quote-splice seams, the charter slip) through review, regenerate with `--regen` (fresh run; scars change the cache digest), drive through promotion, release, and re-score. Repeat until the high-quality bar is met, then push the composite past 90.
2. Resume Bennett (`~/cf-canary/drive-bennett.sh`) with the reader-lane fixes live; scar its residue; promote, release, score.
3. When a Franklin revision clears the bar, hand the owner the `publish-final` command and stop.

Report in the owner's terms: what the book scores, what changed, what was rejected and why, and what is blocked on whom.
