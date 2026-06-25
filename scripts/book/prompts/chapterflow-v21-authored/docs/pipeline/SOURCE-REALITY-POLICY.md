# Source-reality policy (WS-4)

Sidecar-versus-reality verification of a **newly produced source-v2 book** is a **production
invariant**, enforced identically on every promotion path. It is no longer an entrypoint
convention that a strict runbook switches on with an environment variable.

## The rule

A book is classified by its **content**, not by any environment variable:

- **new-source-v2** — the book has source-v2 sidecars on disk. It MUST carry a valid, VERIFIED
  `source-verify-record-v1` before any production promotion succeeds. A missing, malformed,
  incomplete, non-VERIFIED, uncited, or rubber-stamped record **blocks**.
- **legacy** — the book has no source-v2 sidecars. Verification does not apply to it by default.

Absence of a record is acceptable for new content **only** through an explicit, durable,
content-bound **legacy exemption** (below). There is no env-var or no-API-mode bypass.

`CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1` may only **strengthen** the policy — it extends the
requirement to books with no verifiable source content. It can never weaken the default for a new
book, and it cannot reclassify a new book as legacy.

A book CANNOT self-classify as legacy via an environment variable. Only a human-approved,
content-bound entry in the registry below makes a specific package legacy-exempt, and any drift in
the bound content invalidates that exemption.

## The decision (reported in promote + publish-preflight output)

The single evaluator `evaluateSourceRealityPolicy` (`src/qc/sourceRealityPolicy.ts`) returns exactly
one decision, surfaced in `publish-after-qc`'s preflight checklist (`source-reality [<decision>]`)
and in `promote-book`'s result + gate report (`sourceReality`):

| decision | meaning | blocks? |
| --- | --- | --- |
| `required-and-verified` | a present record passed the source-verify checker | no |
| `legacy-exempt` | no record, but a valid content-bound legacy exemption covers it | no |
| `missing` | verification is required, but no record and no exemption exist | **yes** |
| `invalid` | a present record is bad, OR a present exemption is malformed / wrong-book / content-mismatched | **yes** |
| `stale` | a present, otherwise-valid exemption is past its expiry | **yes** |
| `not-applicable` | the book has no source-v2 content to reality-check (and the strengthening flag is off) | no |

`promote-book` and `publish-after-qc` call the same evaluator with the same inputs, so a direct
`promote-book` cannot bypass the requirement and the two paths always agree.

## Legacy exemptions (migration policy)

Existing checked-in legacy packages remain usable. To keep a legacy package promotable without a
source-verify record, add a narrow, auditable, content-bound exemption to:

```
config/source-reality-legacy-exemptions.json   (schema: config/source-reality-legacy-exemptions.schema.json)
```

Each exemption is validated at promote AND publish-preflight. A malformed, wrong-book,
content-mismatched, or expired exemption **blocks** (fail closed). Required fields:

```jsonc
{
  "schemaVersion": "source-reality-legacy-exemption-v1",
  "bookId": "<book id>",
  "reason": "<why this legacy package is grandfathered>",
  "approvedBy": "<human approver>",
  "approvedAt": "<ISO timestamp>",
  // At least ONE content identity — the durable, cross-path one is canonicalIndexHash:
  "canonicalIndexHash": "<from `runbook <book>` / canonicalIndexHashFor>",
  "packageId": "<optional>",
  "contentId": "<optional>",
  "expiresAt": "<optional ISO timestamp; once past, the exemption is stale and blocks>"
}
```

The `canonicalIndexHash` binds the exemption to the book's canonical chapter index (id + number +
title, ordered). It survives in-chapter content edits but breaks on any chapter add / remove /
reorder / rename — so a grandfathered structure can never silently absorb a different book. Prefer
the narrowest binding plus an `expiresAt`, so an exemption is reviewed again rather than living
forever.

The correct long-term fix for a legacy book is to produce a real verified record
(`source-verify <bookId> --write`, verify every item against a real source, then
`source-verify-check <bookId>`), not to extend an exemption.
