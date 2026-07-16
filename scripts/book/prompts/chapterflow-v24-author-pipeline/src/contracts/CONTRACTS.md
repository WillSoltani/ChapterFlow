# Phase-0 frozen integration contracts (GPT-5.6 SOL migration)

Frozen 2026-07-10 by IMP-00 per master plan §8.2 / §12
(`docs/v25/GPT56_SOL_MIGRATION_MASTER_PLAN_AND_PROMPT_PACK.md`). Every parallel
work package builds against THESE shapes; a package that finds a contract gap
must stop, file a versioned contract-change proposal with blast-radius analysis,
and get integration approval — silent local variants are a merge blocker.

| Contract | Version | Owner | Consumers |
|---|---|---|---|
| `execution-profile` | 1 | IMP-00 | every spawn; IMP-01 attempt binding; IMP-02 routing |
| `effective-context-manifest` | 1 | IMP-00 | IMP-10 evidence links; §15 audit; §16 bakeoff manifests |
| `candidate-transaction` | 1 | IMP-01 | IMP-07 patches; IMP-10 evidence; final gate freshness |
| `source-use-plan` | 1 | IMP-03 | IMP-04 critics; IMP-05 card; IMP-07 dependency closure; IMP-09 validators |
| `repair` | 1 | IMP-07 | IMP-08 finding normalization; IMP-05 prior-finding rendering |
| `review-output` | 1 | IMP-08 | acceptance/carry; IMP-11 judge outputs |
| `route-result` | 1 | IMP-02 | IMP-10 evidence; IMP-11 cells; IMP-13 drift triggers |
| `attempt-evidence-manifest` | 1 | IMP-10 | §15 audit; §16–§19 evidence; IMP-13 monitoring |
| `worker-implementation-report` | 1 | IMP-00 | every IMP package; §15 integration audit |
| `reader-experience-review` | 1 | IMP-20 | split-lane reader lane; aggregate-chapter-review; recovery instrument manifest |
| `source-integrity-review` | 1 | IMP-20 | split-lane source lane (only external-truth authority); aggregate-chapter-review |
| `quiz-integrity-result` | 1 | IMP-20 | split-lane quiz two-phase lane; aggregate-chapter-review |
| `aggregated-chapter-review` | 1 | IMP-20 | conductor-owned final status over the three lanes + deterministic bundle |
| `judge-capability-qualification` | 1 | IMP-20 | per-role judge registry; recovery role-set readiness; qualification freshness |
| `review-evidence-envelope` | 1 | IMP-24 | qualification and production inline evidence delivery; request/result freshness |
| `review-model-output-v2` | 2 | IMP-24 | semantic-only reader/source/quiz outputs; conductor-owned V2 assembly |
| `emission-package` | 1 | WP-102 | terminal v21 emission ↔ web-adapter parity surface; `contract-validate` drift gate; WP-101 field-parity reference |
| `source-projection-boundary` | 1 | WP-305 | three-surface source boundary (full packet ⊇ source-review packet ⊋ writer projection); advisory source lane's source-EQUIPPED inputs (WP-403 consumer); WP-404 repair from source findings |

## Additive change note (IMP-20, 2026-07-12)

The five `IMP-20` rows above are ADDITIVE — the split-lane reviewer & §16
recovery contracts. Registering them regenerated the manifest to **14 contracts**;
no pre-existing descriptor was edited, so no existing `contractHash` moved (the
freeze test recomputes every hash and confirms only the five new rows). Each
descriptor exports its `V1` type, a strict unknown-key-rejecting `validateX`
validator, and the `X_CONTRACT` descriptor; they are inert until this registration
(Wave-C single owner) imports them into `ALL_CONTRACTS`.

## Additive change note (IMP-24, 2026-07-13)

The two `IMP-24` rows are additive protocol contracts. `review-evidence-envelope`
defines deterministic inline evidence and packet-local references;
`review-model-output-v2` removes conductor-owned identity, hash, index, and final
status fields from model output. Registering them expands the manifest from 14
to **16 contracts** without changing any pre-existing descriptor.

## Additive change note (WP-102, 2026-07-16)

The `emission-package` row is additive (V25 S-Tier §8 Lane 1). Registering it
regenerated the manifest from 16 to **17 contracts**; no pre-existing descriptor
was edited, so no existing `contractHash` moved (the freeze test recomputes every
hash and pins the sixteen prior values in `PRE_WP102_HASHES`).

**Emission ↔ web-adapter parity rule.** The pipeline's terminal artifact — the
`book-packages/<id>.v21.json` bytes `promoteBook` writes — is the load-bearing
interface to the two hand-maintained web adapters that render every book:

- server `app/app/api/book/_lib/v21-adapter.ts` → `adaptV21ToV13`
- client `app/book/lib/v21-adapter.ts` → `normalizeV21Package` + `extractV21ChapterExtras`

The rule the contract enforces: **every field a fresh emission carries at the
consumer envelope (package / book / chapter / breakdown) must be a field the web
adapters read.** A new envelope field the adapters do not consume is silently
dropped in the reader today; the contract makes that drift a `contract-validate`
failure so the field is wired into BOTH adapters (or removed) before it ships.

The `emission-package` descriptor's field lists (`EMISSION_ADAPTER_SURFACE`) are
derived ONLY from the keys those two adapters actually read — never a superset
that would let a dropped field pass. Closed-world drift detection is enforced at
the four envelope levels where the emission surface and the consumer surface
coincide; the deeper sub-object shapes (example, quiz question, review card,
implementation plan, memorable line, experience plan) are documented here as the
consumed reference but validated by `validateChapterV21`, which `contract-validate`
runs alongside the parity check. Rationale: `validateChapterV21` legitimately
requires internal-only emission fields the adapters never read (e.g.
`implementationPlan.title`, `example.planSpec.{audience,stakes,requiredBeat}`,
`*.sourceAnchorIds`), so a naive whole-tree closed-world check would flag
deliberate internal metadata as drift. The two checks together are the parity
gate. `contract-validate` self-checks a canonical conformant emission by default;
`CHAPTERFLOW_EMISSION_FIXTURE=<path>` overrides it to validate any emission bytes.

## Additive change note (WP-305, 2026-07-16)

The `source-projection-boundary` row is additive (V25 S-Tier §8 Lane 3).
Registering it regenerated the manifest from 17 to **18 contracts**; no
pre-existing descriptor was edited, so no existing `contractHash` moved (the
freeze test recomputes every hash and pins the seventeen prior values in
`PRE_WP305_HASHES`).

The contract freezes the **three-surface source boundary** — the deliberate
asymmetry in how much source truth reaches each downstream consumer:

- FULL source packet (`SourcePacketV1` + sidecar + `SourceUsePlanV1` + anchor
  catalog) — compiler / QC truth.
- SOURCE-REVIEW packet (`assembleSourceReviewPacket`, `SourceReviewPacketV1`) —
  the advisory review lane's fuller-than-writer projection: the WHOLE packet
  (still carrying case `allowedUses`/`forbiddenUses` and provenance), the
  sidecar, the compiler-owned plan license, and full anchor bodies. Key-blind,
  **never source-blind**.
- WRITER projection (`writerPacketProjection`, `WriterPacketProjection`) — the
  card diet: the same source-evidence fields are STRIPPED (case permissions,
  provenance/grounding inventories, frameworks, fact verification refs, anchor
  bodies → ids only).

Containment: **FULL ⊇ SOURCE-REVIEW ⊋ WRITER**. WHY (V25-09/10, §5 target
architecture): the historical source-reviewer false positives (cleanPass 0.125)
were partly an instrument artifact of a SOURCE-BLIND lane — handed the reader
document alone it flagged legitimately source-bound named examples as invented.
The fix is a source-EQUIPPED advisory lane. The descriptor's field lists
(`WRITER_STRIPPED_SOURCE_EVIDENCE`, `SOURCE_REVIEW_PACKET_SURFACE`) are the
load-bearing freeze: `sourceReviewPacketEquippedErrors` / `assertSourceReviewPacketEquipped`
prove a real assembled input is equipped (refusing a source-blind or dieted
input fail-closed — the helper WP-403 wires), and `writerProjectionLeakedSourceEvidence`
proves the writer diet is not weakened. The origin/form/claim-strength ONTOLOGY
is frozen separately by `source-use-plan` (v1) and imported here, never
re-declared; an ontology change moves the source-use-plan hash and stales the
bound source review.

## Change protocol

1. Bump the contract's `version` and edit its descriptor + TS types together.
2. `npx tsx src/contracts/generateManifest.ts` (regenerates `contract-manifest.json`;
   the freeze timestamp is preserved — it marks the ORIGINAL Phase-0 freeze).
3. `tests/contracts-freeze.test.ts` enforces manifest ↔ descriptor agreement; a
   hash change without a version bump fails the suite.
4. Record the change + blast radius in the owning package's implementation report.

## Related

- `requirement-traceability.json` — IMP-00 requirement → surface → test map.
- `logs/exec/` (gitignored) — per-spawn effective-context manifests, result
  sidecars, and the CLI qualification cache produced by the envelope at runtime.
