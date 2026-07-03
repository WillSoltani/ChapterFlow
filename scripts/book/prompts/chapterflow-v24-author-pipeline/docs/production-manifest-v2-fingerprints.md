# Production package manifest v2 — source-reality evidence & build-input fingerprints

`book-packages/<bookId>.v21.json` embeds a `productionManifest` whose `contentId`
is the package's content-addressed identity (`packageId === contentId`). The
manifest is built by [`src/productionManifest.ts`](../src/productionManifest.ts)
and independently recomputed by
[`src/verifyProductionPackage.ts`](../src/verifyProductionPackage.ts).

## Why v2

The v1 manifest bound the per-chapter source **sidecars** and QC attestations,
but it did **not** bind:

1. the **source-reality verification record** — so a package proved *which*
   sidecars were used, not that those sidecars passed reality verification; and
2. the **actual prompt/config/code bytes** — `versions.promptSet`,
   `versions.config`, and `versions.code` were static string labels
   (`"chapterflow-v21-authored-prompts-v1"`, …). A label never changes when the
   bytes it names change, so two packages produced from materially different
   prompts, config, or code carried an identical identity.

v2 closes both gaps. It is the schema stamped on every newly promoted package.

## Schema versions & read-compatibility

| Envelope `schemaVersion`                 | Payload `schemaVersion`                         |
| ---------------------------------------- | ----------------------------------------------- |
| `chapterflow-production-manifest-v1`     | `chapterflow-production-manifest-payload-v1`     |
| `chapterflow-production-manifest-v2`     | `chapterflow-production-manifest-payload-v2`     |

- New packages are **v2**.
- v1 packages are still read and verified, **under v1 rules**: the verifier
  reconstructs the expected manifest at the package's own schema version, so a v1
  package is never granted v2 (source-reality / fingerprint) evidence it does not
  carry. The verify result reports `manifestSchemaVersion` so a caller can tell a
  v1-legacy PASS from a v2 PASS.
- The envelope and payload versions must agree. A v1 payload relabeled as v2 (or
  vice-versa) fails validation (`PPKG.manifest_payload_schema_mismatch`), so a v1
  package cannot masquerade as carrying v2 evidence.

## Source-reality evidence (`payload.sourceRealityEvidence`, v2 only)

Bound from [`evaluateSourceRealityPolicy`](../src/qc/sourceRealityPolicy.ts). A
v2 manifest can be built **only** when the source-reality verdict is non-blocking
(`required-and-verified`, `legacy-exempt`, or `not-applicable`). Fields:

| Field                         | Meaning                                                            |
| ----------------------------- | ----------------------------------------------------------------- |
| `bookId`                      | The book the verdict belongs to.                                  |
| `policyResult`                | `required-and-verified` \| `legacy-exempt` \| `not-applicable`.   |
| `classification`              | `new-source-v2` \| `legacy`.                                      |
| `record` (verified branch)    | `path` (logical), `schemaVersion`, `semanticHash` (canonical), `bookId`, `verifier`, `verifiedAt`. |
| `exemption` (exempt branch)   | `path` (logical), `schemaVersion`, `semanticHash`, `approvedBy`, `approvedAt`, `expiresAt`, `boundIdentity`. |

The record/exemption logical `path` is derived from the bookId
(`.chapterflow/source-verify-<bookId>.md`,
`config/source-reality-legacy-exemptions.json`), never from a read-location
override, so the identity is checkout-independent.

`verifyProductionPackage` re-evaluates the policy from disk and re-reads the
record/exemption, detecting:

- **tampering** — the record's recomputed `semanticHash` no longer matches
  (`PPKG.source_reality_record_hash_mismatch` / whole-payload mismatch), or an
  edit invalidated it (`PPKG.source_reality.SV*`);
- **deletion** — `required-and-verified` becomes `missing` and reconstruction
  fails (`PPKG.SR.record_missing`);
- **replacement / wrong-book** — item coverage no longer maps to the sidecars, or
  the on-disk record names another book
  (`PPKG.source_reality_record_wrong_book`);
- **stale exemption** — the bound exemption is past its `expiresAt`
  (`PPKG.SR.exemption_expired`).

## Build-input fingerprints (`payload.versions`, v2 only)

Each replaces a v1 static label. A fingerprint is the sha256 of the canonical
JSON of a deterministically **sorted** list of `{ path, sha256(content) }`
entries — one per input file. Implementation:
[`src/lib/pipelineFingerprint.ts`](../src/lib/pipelineFingerprint.ts).

Properties:

- **Deterministic** — paths are sorted; filesystem read order is irrelevant.
- **Checkout-independent** — every entry's `path` is a fixed-prefix *logical*
  path (`src/promoteBook.ts`, `config/name-bank.json`, `package-lock.json`),
  never an absolute machine path. The same bytes in a different checkout hash
  identically.
- **No forbidden inputs** — no timestamps, absolute paths, secrets, temporary
  files, or generated state (`state/`, `.chapterflow/runs`, `src/scratch/`) enter
  any hash.
- The file **set** is part of the hash: adding or removing a relevant file moves
  the bundle hash, not only editing one.

The human-readable labels are retained as `versions.labels` (metadata only).

### Exactly which files enter each fingerprint

| Bundle                       | Inputs (relative to the pipeline dir unless noted)                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `versions.promptBundle`      | every `*.md` under `agent-prompts/` (the live authoring "law") and `prompts/` (modular system prompts), recursive. |
| `versions.configBundle`      | every `*.json` under `config/` **except** `*.schema.json` (validators, not generation inputs) and `source-reality-legacy-exemptions.json` (an operational registry already bound per-book by the source-reality evidence). |
| `versions.codeFingerprint`   | every `*.ts` under `src/` **except** `src/scratch/**` (throwaway experiments), plus the pipeline `package.json` and the repo-root `package-lock.json`. |

The exclusions are intentional:

- `*.schema.json` validates config shape; it is not itself a generation input.
- `source-reality-legacy-exemptions.json` would otherwise churn every package's
  identity whenever an unrelated book's exemption is edited.
- `src/scratch/**` holds experiments that never run in a production build.

The code fingerprint is a conservative over-approximation of "the code that
produced the package": it may change `contentId` when an unrelated pipeline file
changes, but it can never *fail* to change when a relevant file changes — the
safety property that matters (no false "unchanged" identity).

## `contentId` invariants

`contentId === payloadHash === sha256(canonicalJSON(payload))`. The promotion
timestamp, generator, runId, and package path live in `metadata` (outside the
payload), so they never affect identity.

`contentId` **changes** when any bound item changes: reader content, canonical
index, a source sidecar, the source-verification record, a QC attestation, prompt
bytes, config bytes, or relevant code bytes.

`contentId` is **unchanged** by: JSON key-order differences or insignificant
whitespace in the semantically-hashed bound items (index, sidecars, record, QC),
a different promotion timestamp, or a different absolute checkout path.

## Verification & promotion

- `verifyProductionPackage` independently recomputes **all** hashes (payload,
  source-reality evidence, all three fingerprints, per-chapter reader content) and
  fails closed on any mismatch or when the expected manifest cannot be
  reconstructed.
- `promoteBook` stages, then verifies the candidate before the atomic publish; if
  expected-manifest reconstruction fails (e.g. the source-reality record is
  missing), it does not publish.
