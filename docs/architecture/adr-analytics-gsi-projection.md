# ADR: Right-size analytics-table GSI projections

- Status: Accepted (revised after a failed in-place deploy — see "Failed first
  attempt" below)
- Finding: WS6-008
- Scope: `ChapterFlowInsights-*` (the analytics table) global secondary indexes
  defined in `infra/lib/chapterflow-backend-stack.ts`.

## Context

The analytics table carries three global secondary indexes. All three were
originally created with `ProjectionType.ALL`, which replicates the entire item
(including the wide per-user snapshot Sets — `readingDays`, `activeBookIds`,
`completedBookIds`, `badgeIds`) into every index on every write. On PAY_PER_REQUEST
billing this is paid write amplification and storage for attributes no reader
consumes. We audited every query against each index to right-size the projections.

### Per-index read audit

**`eventDate-eventType-index` (GSI1, PK=`eventDate`, SK=`eventType`).**
Read by `queryEventsForDay` in `app/app/api/book/_lib/admin-metrics.ts`, which
feeds ~12 admin routes. Callers read event-type-specific payload fields off the
returned items: `deltaMs`, `subscription_change` fields, `beacon_performance`
fields, and scenario/quiz payloads. The set of consumed attributes is unbounded
across event types and grows whenever a new event type is added. A single query
therefore needs the whole item.
**Decision: keep `ALL`.**

**`plan-updatedAt-index` (GSI2, PK=`plan`, SK=`updatedAt`).**
Three consumers:
- `listRecentUsersByPlan` (admin-metrics.ts) returns full items that
  `formatUser` + `readTime` in `app/app/api/book/admin/users/search/route.ts`
  read. The exact attribute union consumed is:
  `userId, email, proStatus, proSource, firstSeenAt, lastActiveAt,
  totalReadingMs, totalQuizAttempts, totalQuizPasses, flowPoints,
  booksCompleted, badgeCount, onboardingCompletedAt`. `plan`/`updatedAt` are the
  index keys and `PK`/`SK` are the table keys — all four are auto-projected and
  are NOT listed in `nonKeyAttributes`.
- `activeUsersByPlan` and `totalUsersByPlan` (admin-metrics.ts) both issue
  `Select: "COUNT"` queries — they need index keys only, no projected attributes.

None of these consumers read the wide snapshot Sets. **Decision: right-size to
`INCLUDE`** with exactly the 13 non-key attributes above. Because a projection
cannot be changed in place (see below), the target `INCLUDE` shape is delivered
as a NEW index `plan-updatedAt-index-v2`; readers move onto it, then the original
`ALL` index is deleted.

**`contextKey-occurredAt-index` (GSI3, PK=`contextKey`, SK=`occurredAt`).**
Write-only. Quiz and commitment events stamp `contextKey` in `analytics-repo.ts`,
but no code queries this index (no `IndexName: "contextKey-occurredAt-index"`
anywhere). Because it has zero readers, the right-size is not a narrower
projection but **outright DELETION** — a KEYS_ONLY replacement would still cost a
backfill and index maintenance for an index nobody queries. **Decision: delete.**

## Silent under-projection failure mode

DynamoDB returns only the projected attributes for an index query and raises **no
error** for attributes that are not projected. If a reader consumes an attribute
that is missing from an `INCLUDE` list, the attribute simply comes back absent.
For `plan-updatedAt-index-v2` that means `formatUser` emits `null`/`0` for the
missing field with no exception, no log, and a green build — the defect surfaces
only as wrong numbers on the admin screen. Two guards mitigate this:

1. A guard comment above `listRecentUsersByPlan` (admin-metrics.ts) and above
   `formatUser` (users/search/route.ts) stating that every attribute read there
   must be in the GSI `nonKeyAttributes` list.
2. `infra/lib/backend-gsi-projection.test.ts` asserts the `INCLUDE` list on
   `plan-updatedAt-index-v2` equals exactly the reader's attribute union (sorted
   deep-equal), so widening the reader without widening the index fails the test.

This is also why GSI1 stays `ALL`: an `INCLUDE` union there would silently drop
attributes for any future event type, and the failure would be invisible.

## Failed first attempt (in-place projection edit)

The first implementation (commit `693ad9908`) edited the projections **in place**
on the existing indexes — `plan-updatedAt-index` from `ALL` to `INCLUDE`, and
`contextKey-occurredAt-index` from `ALL` to `KEYS_ONLY`. CloudFormation rejected
the stack update at deploy (GitHub Actions deploy run **29965752218**) with:

> Cannot update GSI's properties other than Provisioned Throughput and
> Contributor Insights Specification. You can create a new GSI with a different
> name.

The stack rolled back cleanly. The live table is therefore unchanged: all three
analytics GSIs still exist under their ORIGINAL names with `ProjectionType.ALL`
(`eventDate-eventType-index`, `plan-updatedAt-index`, `contextKey-occurredAt-index`).

Root cause: a GSI projection change is a delete-and-recreate of the index, and
CloudFormation cannot express that on an existing index resource. DynamoDB
additionally permits only **one GSI create or delete per table update**, so the
correct approach is a sequence of separate deploys, each doing exactly one GSI
operation, with a new index name for any projection change.

## Rollout as executed (one GSI mutation per deploy)

Each stage is a separate stack update performing exactly ONE GSI create OR
delete; `cdk diff` before each follow-up must show exactly one GSI operation.
`GSI1` (`eventDate-eventType-index`) is untouched and stays `ALL` throughout.

**Stage 1 — this PR (one GSI create, zero deletes):**
- Revert the two in-place projection edits so `plan-updatedAt-index` and
  `contextKey-occurredAt-index` are back to `ProjectionType.ALL` — a NO-OP diff
  against the live rolled-back table.
- Add a NEW index `plan-updatedAt-index-v2` with the `INCLUDE` projection (13
  non-key attributes). This is the single GSI create.
- Switch every reader (`admin-metrics.ts` — `activeUsersByPlan`,
  `totalUsersByPlan`, `listRecentUsersByPlan`) from `plan-updatedAt-index` to
  `plan-updatedAt-index-v2`. Safe within the one workflow run: the app job
  deploys only after the infra job's CFN update completes, and CFN does not
  complete until the new GSI reaches `ACTIVE` (backfilled).

**Stage 2 — follow-up deploy (one GSI delete):**
Delete `contextKey-occurredAt-index`. It has zero readers, so outright deletion
beats re-adding it as `KEYS_ONLY`. One GSI mutation; nothing else touched.

**Stage 3 — follow-up deploy (one GSI delete):**
Delete the original `plan-updatedAt-index`. By this point every reader has been
serving off `plan-updatedAt-index-v2` since stage 1, so the original `ALL` index
is dead weight. One GSI mutation; nothing else touched.

Stages 2 and 3 are separate deploys and are never combined (two deletes in one
table update would violate the one-GSI-mutation limit). Each recreate/delete on
PAY_PER_REQUEST billing incurs a one-time backfill/teardown cost proportional to
matching items.

## End state

- `eventDate-eventType-index` — `ALL` (unchanged).
- `plan-updatedAt-index-v2` — `INCLUDE` (the 13-attribute reader union).
- `plan-updatedAt-index` — deleted (stage 3).
- `contextKey-occurredAt-index` — deleted (stage 2).
