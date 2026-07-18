# IMP-24 Protocol Decision

## Decision

Adopt **Review Evidence Envelope v1** and the new qualification identity
`s16-forward-role-qualification-v3-envelope` as an additive, forward-only
replacement for the invalid review transport used by the two prior identities.

Starting branch and commit:

- branch: `feat/v25-pipeline-live`
- starting HEAD: `19e1837e6d6d1f2ebc6997700956fc0798aa21ca`
- draft pull request: `#401`

This decision changes the review transport and model-output responsibility
boundary. It does not reopen the archived Section 16 campaign, redesign the
split-lane authority model, or reinterpret an earlier model judgment.

## Preserved historical identities

The following tracked trees are immutable historical evidence:

| Identity | Git tree | Disposition | Resumable | May qualify a profile |
| --- | --- | --- | --- | --- |
| `s16-forward-role-qualification-v1` | `6e8b88c60ddf6972dc5f296926d4221c459d713f` | `INVALID_INSTRUMENT_DO_NOT_ATTEST` | no | no |
| `s16-forward-role-qualification-v2` | `2522d62da3b17cc3de799c85172c5f5780df532c` | `BLOCKED_CALIBRATION_INVALID` | no | no |

Their requests, receipts, raw outputs, route sidecars, manifests, invalidation
reports, and ledgers remain byte-for-byte preserved. No V1 or V2 output can
satisfy V3 freshness. Their recorded dispositions above are quoted without
relabeling, attestation, or reinterpretation and remain non-qualifying.

## Responsibility boundary

The model owns semantic judgment only. The conductor owns identity, immutable
plan metadata, content and instrument hashes, keyed and derived quiz indexes,
agreement, final lane status, blocking-finding identifiers, reference
resolution, and downstream freshness.

Every reviewer receives the complete evidence envelope inline and is told to
use no filesystem, shell, network, or external tool. The exact canonical
envelope bytes remain in the isolated read-only workspace as audit evidence,
but that workspace is not the evidence-delivery channel.

Models cite packet-local `evidenceRefIds`. The conductor verifies existence,
kind, uniqueness, and envelope binding, then resolves the references to exact
retained spans. Copied-quote fidelity is not a scoring dimension.

## Frozen invariants

- Envelope segment order and hashes are deterministic.
- `envelopeSha256` excludes only itself and binds all substantive fields.
- Missing, empty, duplicate, wrong-kind, drifted, or oversized evidence fails
  before spawn; evidence is never silently truncated.
- Reader review remains key-free and cannot decide external source truth.
- Source primary-category precedence is:
  `source_contradiction`, `unsupported_attribution`,
  `claim_strength_overreach`, `missing_visible_framing`,
  `generic_specificity_leak`, `invented_detail`,
  `missing_required_evidence`.
- Required source evidence missing yields `INCONCLUSIVE`, never a guessed pass.
- Quiz phase-one commitment remains immutable; the model emits no internal item
  ID, stored/derived index, agreement flag, document hash, or session identity.
- Qualification and production use the same compiler, task renderer, reference
  resolver, and conductor-owned assembly contracts.
- Every model-bearing operation is ChatGPT-authenticated `codex exec` through
  the centralized hermetic broker, with API keys and provider fallback absent.

## V3 governance

Before the first live canary, the implementation, V3 corpora, output schemas,
prompts, thresholds, candidate order, certification, and production seal must
be committed, pushed, and pass dedicated V25 CI on that exact commit.

Each profile receives exactly two protocol canaries for a role before any role
holdout. Canary semantic correctness is recorded but excluded from protocol
validity and holdout metrics. A protocol failure disqualifies only that
profile/role. Frozen holdouts determine capability, with sequential stopping at
two reader profiles, two source profiles, and one quiz profile.

After the first V3 canary, no V3 prompt, schema, gold label, threshold, or case
may change. A verified instrument defect stops the campaign; it does not create
an automatic V4.

## Capability boundary

This work has no publication, promotion, deployment, upload, merge, API,
direct-SDK, or direct-HTTP capability. Pushes are normal, the pull request stays
draft, and local SOL activation remains impossible until role qualification,
fresh pilot, fresh gold, the full local suite, and dedicated V25 CI all pass.
