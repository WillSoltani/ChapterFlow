# V25 S-tier campaign — execution plan (2026-09-02)

Owner mandate: identify every issue, fix the pipeline so it produces high-quality work, test one book, return the output. Orchestrator: Fable (planning, sequencing, verification). Implementation: Opus 5 and Sonnet 5 only. Every change lands through a PR from an isolated worktree under `~/cf-wt/`, with an adversarial reviewer that reproduces RED and runs the full suite. Baseline: `origin/main 7e01a45c7`, typecheck clean, suite 2880 pass / 0 fail, 55 v25 files.

Inputs: `docs/v25/S_TIER_PHASE_A_REPORT_2026-09-02.md` (analysis), `docs/v25/S_TIER_ISSUE_REGISTER_2026-09-02.md` (the full numbered register, R-ids), the release-2026-09-02 discovery workflow (9 surfaces, 181 raw findings, adversarially verified).

## Principles that decide every trade-off

1. Accuracy is born at research. The pipeline never reads the book; sidecars are written from the model's memory, and the Franklin errors were already in the sidecars. Fix: ingest the real text when it exists, judge every chapter against it, and give the researcher a legal way to abstain.
2. Grounding moves from per-unit token quotas to per-chapter presence plus derivability. Verbatim demands in every quiz stem, card, example and tier manufactured the seams and the repetition; they never caught a wrong fact.
3. Nobody edits the chapter today. An editor pass over the assembled chapter, with the source slice and the voice card, is the cheapest route to prose that reads as one piece.
4. One ruler. The book-score rubric with a pinned reader model becomes the promotion gate above the panel floor; a split gate vote fails closed; unchanged bytes are never re-rolled.
5. Never weaken a gate to pass a run. Redesigning a gate is allowed only with a test that states what it now catches and what it stops blocking.

## Waves and work packages

Each package: `wt.sh new <wp>` (worktree from origin/main) → RED tests → fix → `wt.sh verify` → PR → adversarial review (reproduce RED, full suite, claim check) → one fix round → merge (squash) by the orchestrator. Packages in one batch touch disjoint files; dependent packages branch after their predecessor merges.

### Wave 0 — safe fixes, no gate-design change

Batch 1 (parallel):
- 0A quota-classification (Opus high): R-001. Gateway preserves the provider envelope text on non-zero exit; compiler loop consults `isUnretryableProviderMessage`; new terminal code is not operator-retryable; driver stops on it.
- 0C1 voice-and-pins (Opus high): R-002 first (honest length pins with the largest scar file and a real voice card), then R-003 voiceCard wired, R-004 bibliography authorVoice fallback plus a curated Franklin profile, R-005 "short sentences" clauses removed, R-006 budget overflow, R-007 register templates, R-032 optional.
- 0D research-small (Opus medium): R-022, R-023, R-024, R-025, R-027, R-028, R-030, R-034, R-035.
- 0E gate-small (Opus medium): R-010, R-016, R-020, R-040, R-041, R-042, R-043, R-044.
- 0F repair-lane (Opus high): R-037, R-038, R-039, R-036 (judgment).
- 0G record-rev6 (Sonnet): R-045, commit the released revision-6 artifacts for provenance.

Batch 2 (after batch 1 merges):
- 0B effort-tiers (Opus high): R-021 role-threaded routes, provenance of model/route/effort in run manifests, unknown effort fails closed.
- 0C2 contract-truth (Opus high): R-008 notes header, R-009 false "validator enforces" claims, R-011 retry-enumeration matching rule and sentence-initial steer, R-012 tier roles, R-013 staging-direction lines for cards and actions, R-014 disclose the hard-banned phrase list, R-017 choice-parity wording, R-018 chapter/book/author in the writer prompt, R-019 validation paragraph, R-015.
- 0H service-small (Opus medium): register pass-2 items on the service/runtime surfaces that need no design change (attempt budgets, tombstone remedies, late env parsing, unbounded operator loop ceiling, review-repair history record).

### Wave 1 — design changes to research, gates, dealing

- 1A source-ingestion (Opus xhigh): R-046, R-047, R-048, R-049. `book-run --source-text <path>` (or `sources/<bookId>.txt` discovery) frozen into the research run with a hash; bibliography maps chapters to text spans; chapter researcher receives its span and must quote it for every hardSpecific and testable fact; the existing source-verify checker is switched on when text is present; absence of text is recorded as a first-class provenance state.
- 1A2 research-rules (Opus high): R-050, R-051, R-052, R-053, R-054, R-055, R-056, R-057, R-058. Abstain path; fragment rejection; genre-gated rule 9 (memoir subject named as actor); packet carries thesis fields; other-book content removed from the system prompt.
- 1B grounding-redesign (Opus xhigh): R-059, R-060, R-061, R-063, R-066, R-068, R-069, R-070, R-071, R-072, R-073, R-076. Per-chapter grounding replaces per-unit verbatim quotas; memorable lines validated as shipped; intra-chapter tier overlap measured and enforced; opener-signature checks within a chapter; quiz transfer measured on the stem, not metadata; memorable lines re-validated after repair.
- 1C dealing-redesign (Opus high): R-062, R-064, R-065 plus pass-2 blueprint items. Fact-aware case cues; derived frames limited to the chapter's own packet; example format order rotated per chapter; name window that cannot reuse a name; genre resolution.

### Wave 2 — new stages

- 2A source-fidelity-judge (Opus xhigh): R-077, R-078. A QC judge per chapter that holds the source span (or, without text, a second-model cross-check marked as weaker evidence) and checks every named fact, date, sequence, quotation, quiz key and explanation; blockers carry the source quote; the answer-key judge receives the same context.
- 2B editor-pass (Opus xhigh): R-079. One bounded pass per chapter after assembly and before review: whole chapter plus source span plus voice card plus the defect classes; output re-validated by the section gates; on failure the unedited chapter proceeds with a durable record.
- 2C rubric-gate (Opus high): R-080. Whole-book catalog-rubric panel (three readers, pinned model and effort, the book-score reader prompt), composite with the rubric weights, split gate votes fail closed, promotion requires composite at or above `CHAPTERFLOW_RUBRIC_BAR` (default 80; the owner may set 85), verdict bound to the manifest digest.

### Wave 3 — Franklin content

- 3A scars-rewrite (Opus medium): R-081 to R-086. Scar file reduced to fact pins with source quotes, scar 24 corrected, naming and cast rules in prohibitions, craft scars removed where wave 0/1 made them generic.

### Wave 4 — the test book

- 4A driver (orchestrator): a new `~/cf-canary/drive-franklin-v7.sh` that evicts the section-pack cache (the cache key does not include prompt text), passes `--source-text` for the Gutenberg Autobiography, stops on provider-blocked codes, logs the provider message, and runs under `caffeinate`.
- 4B run, promote, release (pipeline drivers only; the publish stays the owner's).
- 4C score (six blind readers, same reader class as Phase A), adjudicate the gate against the source text, deliver the package plus a scorecard and a plain-language evaluation to the owner.

## Verification contract for every PR

- RED test exists and was observed failing before the change.
- `npm run typecheck` clean; `npm test` shows fail 0 and pass count at or above 2880 plus the tests added.
- No gate, threshold or fail-closed path weakened without a rationale in the test file.
- PR body lists issue ids done, skipped with reasons, tests added, and contains no statement the reviewer cannot verify in the diff.
- Reviewer verdict APPROVE required before merge; at most one fix round per package before the orchestrator intervenes.

## Known constraints

- The claude weekly usage cap is shared between this session's agents and the pipeline's own model calls. The live run in wave 4 needs headroom; batches are sized to leave it.
- `tests/contract-refactor.test.ts` pins task-card lengths; R-002 makes the pin honest first so later prompt additions are budgeted.
- The section-pack cache key omits the writer prompt, so every prompt fix reaches a book only through a fresh run with the cache evicted.
- `~/cf-canary` is read-only for agents; only the pipeline's own drivers write there.
