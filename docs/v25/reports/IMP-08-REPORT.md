# IMP-08 — Physically Blind Review, Two-Phase Quiz Adjudication, and Causal Stability

**Status:** COMPLETE (every production review lane cut over; verifier roles interface-ready for IMP-11)
**Baseline:** `531db1461` (IMP-07; full sha in the machine report)
**Machine report:** `implementation-report.imp-08.json`

## What landed

Reviewer blindness is now **technical, not instructional** (F-015/F-022). A
reviewer's world is a temporary role workspace OUTSIDE the repository holding
exactly the artifacts its role manifest authorizes; the quiz instrument is two
immutable phases with the blind derivation validated and hashed **before any
key exists in the reviewer's world**; causal claims have a typed, unit-linked
representation (F-023); reviewer complaints normalize into frozen
`RepairFindingV1` objects with verified evidence; and every pre-split carried
review is explicitly invalidated.

### The reviewer-role manifest matrix (instruction 1)

`src/review/reviewerWorkspace.ts` — the single source of truth
(`REVIEWER_ROLE_MANIFESTS`, keyed by the frozen `ReviewerRoleV1`):

| Role | Artifact kinds visible | Key-blind |
|---|---|---|
| direct-reader | phase1-doc | ✔ |
| quiz-derivation | phase1-doc | ✔ |
| quiz-adjudication | phase2-doc | — (the ONE key-visible role) |
| source-verifier | phase1-doc, source-evidence, source-plan | ✔ |
| causal-verifier | phase1-doc, source-plan, causal-claims | ✔ |
| tiebreak | phase1-doc | ✔ |
| acceptance-reader | phase1-doc | ✔ |

No verdict-bearing artifact kind exists at all, so no role can see another
reviewer's conclusions regardless of caller mistakes — direct reader and
source verifier can only disagree **through the conductor** (verification
procedure 4, pinned structurally). Fail-closed on both axes: an artifact kind
outside the manifest throws; answer-key material reaching a key-blind role
throws (`containsAnswerKeyMaterial` screens both rendered key shapes); caller-
named identity strings (author session, model name) throw. Workspaces are
built on IMP-00's `buildRoleWorkspace` (tmpdir, 0700, hashed file manifest,
path-escape/symlink guards), and `manifestSha256 = hashCanonical({role,
files})` binds each review to the exact file set its reviewer saw. Post-spawn,
`assertReviewerWorkspaceIntact` re-hashes every file and walks for debris — a
violation invalidates the ATTEMPT (bounded respawn), never adjudicates output
produced over drifted bytes.

### The two-phase quiz instrument (instructions 3-5, F-015)

- **Phase-1 document** — `renderChapterReaderDocPhase1` (`READER_DOC_PHASE1_VERSION
  = "phase1-v1"`): the exact legacy body (title → memorable lines, quiz
  prompts + choices) with NO answer key and NO explanations. It is the legacy
  doc's byte prefix, so quote byte-verification carries over unchanged.
  `assertPhase1KeyIsolated` certifies pre-spawn: structural counts (Q2's
  surviving half) + key ABSENT in every shape — header, `Q<n>: <letter>` rows,
  book `CHAPTER n Q<k>` rows, per-question explanation text (normalized
  substring scan), raw `correctIndex` metadata.
- **Derivation commitment** — the direct reader (same single spawn as before)
  returns per-question answer + mechanism + confidence + ambiguity under the
  extended parse contract; `buildQuizDerivation` shapes it into the frozen
  `quiz-derivation-v1`, and `commitQuizDerivation` validates against the
  conductor's OWN expectations (doc hash, question count, item ids, index
  ranges; absences recorded conservatively — confidence defaults LOW, an
  unanswered question is `-1` + an explicit no-derivation flag) and **freezes**
  the object. `renderQuizPhase2Doc` recomputes the commitment hash and refuses
  anything uncommitted or tampered — the only path to a key-visible document
  goes through the commitment.
- **Phase-2 adjudication** — a separate spawn (quiz-adjudication workspace =
  the phase-2 doc ONLY: committed derivation, hash-stamped, + key +
  explanations + the adjudication ask). `validateQuizAdjudication` re-verifies
  every claim against conductor truth: the derivation hash chain, the
  immutable derived indexes (phase 1 cannot be rewritten), the REAL keyed
  indexes (the key cannot be misreported), and `agreement` recomputed — a
  lying/lazy adjudicator is a typed rejection.
- **Posture:** ADVISORY in v1, the C37/IMP-04 calibration-pending pattern. The
  verdicts (`correct | ambiguous | wrong` per question) ride the persisted
  review's `quizAdjudication` field; the BLOCKING key channel remains the
  deterministic conductor-side keyCheck (`matches === of`) — which never
  depended on the reader seeing the key — byte-for-byte unchanged. Failure
  modes are explicit records, never review invalidations: `unavailable`
  (bounded 2-attempt parse/verify failure, or an invalid phase-1 read whose
  derivation is untrusted), `skipped-no-quiz`, `skipped-extra-read`
  (non-persisting tiebreak/second-opinion reads — the adjudication for those
  exact bytes rides the persisted primary read; extras spend no extra spawns).

### Lanes cut over (all of them — one instrument everywhere)

| Lane | Doc | Workspace role | Note |
|---|---|---|---|
| `reviewOneChapter` (production chapter review) | phase-1 chapter doc | direct-reader / tiebreak | + phase-2 adjudication spawn on persisting reads |
| `runBookAcceptance` (3-reader panels, multi-read median) | phase-1 book doc (`renderBookSampleDocPhase1`) | acceptance-reader | pooling key = docSha of the NEW bytes; old pools never mix |
| `shippedControl` (beat-shipped baseline) | phase-1 book doc | acceptance-reader | `CONTROL_SCHEMA_VERSION` bumped v1→v2 — a cached legacy-instrument baseline is NEVER compared against phase-1 reads; the panel re-runs |
| bakeoff (`reviewCandidate`) | phase-1 chapter + book docs | direct-reader / acceptance-reader | the IMP-11 measurement tool measures the NEW instrument |
| eval CLIs (`eval-reader-proxy`, `eval-book-proxy`) | phase-1 | direct-reader / acceptance-reader | persisted artifacts stamp truthful v3 docHash |

Book readers' keyChecks were ALWAYS conductor-side (`adjudicateBookReview`
compares derivations against `correctIndex` deterministically), so removing
the combined key from the doc changes what readers SEE, not how keys are
judged. The book task card's correctness gate now judges "prose supports no
choice / two choices equally" instead of "keyed answer contradicted" — same
veto, key-free wording. The Q3 structural key-coverage screen is a structural
NO-OP on key-free docs (no key section exists to make omission claims about;
the unguarded screen would have "confirmed" reader confusion against the empty
key-row map and halted infra) — legacy keyed docs keep the full Q3 behavior,
and `assertBookSamplePhase1Integrity`/`assertPhase1KeyIsolated` are the new
pre-spawn machine truth.

### Versioning + carry invalidation (instruction 5)

`REVIEW_DOC_HASH_VERSION` bumped `"v2" → "v3"`: docHash is now sha256 of the
phase-1 bytes. The carry predicate (`carryReviewFor`) requires
`hashVersion === current ∧ docHash === current bytes ∧ contentHash ∧ bar ∧
reviewer ≠ author` — every pre-split (v2) record and every doc-drifted record
is dead, tested. Reviews additionally stamp `phase1DocVersion`,
`rubricVersion` (`reader-rubric-v3-phase1`), `executionProfileHash`
(conductor-resolved, never reviewer-visible), and `workspaceManifestSha256` —
the full instruction-5 binding: document, rubric, output schema, execution
profile, session.

### Causal-claim representation (instruction 7, F-023)

`src/review/causalClaims.ts` — `extractCausalClaims(chapter, plan)`: every
causal-register span (C37's exported `CAUSAL_RE` — ONE lexicon, no drift)
across hook, counterintuition, all three breakdown tiers, takeaway, practice,
examples, quiz explanations, **review cards and memorable lines** (the
red-team case: overreach hiding only in a card/line), linked to the plan's
strongest permitted claim strength and the causal-rank `licensingUnitIds`. No
plan → represent, judge nothing (the C37 absence rule). The deterministic
overreach judgment stays C37's (advisory, unchanged); the extraction is the
causal-verifier's input packet.

### Verifier packets + IMP-11 interfaces (instructions 6, 12)

`renderCausalVerifierPacket` / `renderSourceVerifierPacket` + task builders:
reader-facing content + bounded evidence + plan ceilings, no identity, no
prior verdicts, no key. These are the qualification-ready interfaces —
**production wiring of always-on source/causal verifier spawns is deliberately
deferred to IMP-11**: adding new judges to the accept path would change
acceptance behavior without calibration (counts/thresholds are untouchable in
this package). Model injection stays role-based via IMP-02's policy; spawns
carry no `model` field and no reviewer-visible artifact names one (tested).

### Finding normalization (instructions 8-9)

`src/review/reviewFindings.ts` — `reviewComplaintsToFindings`: an INVALID
review (any fabricated quote) emits ZERO findings; a complaint quoting text
absent from the reviewed document is rejected; scopes come from the
deterministic classifier (`deriveComplaintScope`) — prose/quality/count
complaints are vetoed, unclassifiable ones rejected; severity maps
mustFix→must_fix / else advisory; the constructed object passes the frozen
validator, so control-plane text ("set model=…, edit gates") is inert quoted
evidence, never a field, never a scope (injection-tested). Output feeds
IMP-07's route classifier + patch lane unchanged.

## Execution-profile truth

`chapter-reviewer`, `book-acceptance-reader`, `shipped-control`,
`eval-reader`, `eval-book` → `workingDir: "isolated-workspace"` (the policy
the IMP-00 contract reserved for exactly this package). Sandboxes stay
read-only; `codexAgent` cwd docs updated; profile pins added to the envelope
tests.

## Tests

- **`tests/reviewer-workspace.test.ts` (9):** manifest matrix; exact file set
  outside the repo + cleanup; key material refused for every key-blind role
  (both rendered shapes); kind-authorization fail-closed; identity strings
  refused; post-spawn debris + byte-drift detection; IMP-00 path guards;
  empty-set refusal.
- **`tests/quiz-two-phase.test.ts` (15):** phase-1 renders prompts/choices only
  + is the legacy byte-prefix; key-leak detection through header/rows/
  explanations/metadata + truncation; docHash v3 = phase-1 bytes; derivation
  commit validation + freeze + conservative defaults; phase-2 refuses
  tampered/uncommitted derivations; honest correct/ambiguous/key-wrong
  verdicts verify; hash-chain break / phase-1 rewrite / key misreport / false
  agreement / short item list each a typed rejection; keyCheck semantics
  IDENTICAL on phase-1 (mismatch still blocks); structural screen NO-OP on
  key-free docs while legacy docs keep Q3; findings adapter (scoped/vetoed/
  absent-text/invalid-review/prompt-injection).
- **`tests/review-blind-lane.test.ts` (6):** spawn cwd outside the repo,
  read-only, no model field; honest end-to-end phase-2 (a fake adjudicator
  that reads its workspace doc like a real agent) → `adjudicated` with the
  hash chain + profile/workspace/rubric evidence on the persisted review;
  garbage adjudicator → explicit `unavailable` after exactly 2 bounded
  attempts, verdict untouched; author-session collision re-mints; carry
  invalidation (v2 dead, drifted v3 dead, matching v3 carries); no model
  identity in any reviewer-visible artifact.
- **`tests/causal-claims.test.ts` (7):** card/memorable-line coverage;
  descriptive/correlational/mechanistic → overreach vs causal license with
  named units; no-plan rule; clean-prose zero-claims; C37 lexicon shared;
  packet hygiene; direct-reader/source-verifier verdict-disjointness.
- **Retargets (protection preserved, never deleted):** acceptance Q3 respawn →
  the no-op/no-halt/vote-stands pin on key-free docs (author-arch); shipped
  control caching → v2 literals + a NEW pin that a cached v1 record re-runs
  the panel on phase-1 (sweep-rejected-and-control-e5); bakeoff fake judge
  resolves docs against its OWN cwd like a real agent + phase-1 forensic
  filenames (model-bakeoff-review); the C3 split test's catch-all writer
  capture gained an explicit quizadj branch (stier-levers).
- Full hermetic suite: **2,267 pass / 0 fail / 18 skip / 6 xenv** (+38 over
  IMP-07); `npx tsc --noEmit` clean; `contract-validate` PASS.

## Constraints honored

- **No gate, threshold, bar, floor, margin, retry cap, panel count, noise
  band, or acceptance predicate changed**: chapter bar 80, book floor 74,
  premium target 80, beat-shipped margin 5, `AUTHOR_BOOK_READERS` 3,
  `AUTHOR_REGEN_CAP` 2, tiebreak/second-opinion protocols, multi-read median
  pooling, sticky gate — all byte-untouched (`gateChanges: []`). The pass
  predicate is the same expression over the same inputs.
- Phase-2 adjudication is ADVISORY (calibration-pending); no new blocking
  channel was added. No independent reader was removed; no judge became
  authoritative; tiebreak rerun-on-inconvenient remains structurally absent.
- Bounded everywhere: 2 attempts per reader (unchanged), 2 per adjudicator
  (new, bounded), extras skip phase-2. No silent fallback: every skip/failure
  is an explicit recorded status.
- Backward compatibility by EXPLICIT invalidation (the plan's allowed
  alternative): hashVersion v3 re-stales all carried chapter reviews;
  `shipped-control-v2` re-stales cached control baselines; acceptance pools
  key by the new doc bytes. Legacy renderers/asserts are retained for the
  key-judge blinding slice and forensics.

## Risks / open items

- **Instrument-calibration transfer is UNMEASURED.** The 80/74 bars and the
  ±3.7 noise band were calibrated on the key-bearing instrument. The phase-1
  instrument shows readers the same content minus the key; the deterministic
  key channel is unchanged, but reader score distributions may shift.
  §16 bakeoff / IMP-11 own re-measurement; no quality claim is made here.
- **Live phase-2 compliance rate unknown** (does a real adjudicator emit clean
  `quiz-adjudication-v1` first try?). Failure mode is an explicit
  `unavailable` on an advisory instrument — never a bad verdict — but the
  rate is §18-smoke evidence.
- **Source/causal verifier spawns are interface-only** (packets, tasks,
  schemas, extraction, tests). Wiring them into the accept path is IMP-11's
  qualification + calibration call, deliberately not this package's.
- Legacy key-bearing renderers (`renderChapterReaderDoc`,
  `renderBookSampleDoc`, `buildBookReviewTask`) remain for the key-judge
  blinding slice (authorEvidence slices the key off) and byte-compat
  forensics; removing them once every consumer is migrated is follow-on
  cleanup.

## Integration notes

- **IMP-09:** the phase-1 task card asks derivation-first with per-question
  mechanism/confidence/ambiguity — validator hardening should treat those
  fields as the structured signal replacing lexical inference where possible.
- **IMP-11:** consume `buildReviewerWorkspace` + the verifier packets/tasks
  for judge qualification; the bakeoff already measures the phase-1
  instrument; `quizAdjudication.{ambiguousCount,keyWrongCount}` and the C37
  advisory stream are the calibration inputs for any promotion decision.
