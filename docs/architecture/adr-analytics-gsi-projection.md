# ADR: Right-size analytics-table GSI projections

- Status: Accepted
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

None of these consumers read the wide snapshot Sets. **Decision: `INCLUDE`** with
exactly the 13 non-key attributes above. This stops replicating the snapshot Sets
into the index on every snapshot `UpdateCommand`.

**`contextKey-occurredAt-index` (GSI3, PK=`contextKey`, SK=`occurredAt`).**
Write-only. Quiz and commitment events stamp `contextKey` in `analytics-repo.ts`,
but no code queries this index (no `IndexName: "contextKey-occurredAt-index"`
anywhere). **Decision: `KEYS_ONLY`.**

## Silent under-projection failure mode

DynamoDB returns only the projected attributes for an index query and raises **no
error** for attributes that are not projected. If a reader consumes an attribute
that is missing from an `INCLUDE` list, the attribute simply comes back absent.
For `plan-updatedAt-index` that means `formatUser` emits `null`/`0` for the
missing field with no exception, no log, and a green build — the defect surfaces
only as wrong numbers on the admin screen. Two guards mitigate this:

1. A guard comment above `listRecentUsersByPlan` (admin-metrics.ts) and above
   `formatUser` (users/search/route.ts) stating that every attribute read there
   must be in the GSI `nonKeyAttributes` list.
2. `infra/lib/backend-gsi-projection.test.ts` asserts the `INCLUDE` list equals
   exactly the reader's attribute union (sorted deep-equal), so widening the
   reader without widening the index fails the test.

This is also why GSI1 stays `ALL`: an `INCLUDE` union there would silently drop
attributes for any future event type, and the failure would be invisible.

## Rollout (deploy-gated)

CloudFormation **cannot change a GSI projection in place** — a projection change
is a delete-and-recreate of the index. DynamoDB additionally permits only **one
GSI create or delete per table update**, so a stack update must never mix two
index operations. On PAY_PER_REQUEST billing each recreate incurs a one-time
backfill cost proportional to matching items.

The zero-outage sequence is therefore staged across separate deploys, each doing
exactly one GSI operation:

**`plan-updatedAt-index` (has live readers — must not disappear):**
1. Deploy 1: add a NEW index `plan-updatedAt-index-v2` with the `INCLUDE`
   projection (one GSI create; old index still serves reads).
2. App deploy: flip the three `IndexName` references
   (`admin-metrics.ts:168, 195, 766`) from `plan-updatedAt-index` to
   `plan-updatedAt-index-v2`.
3. Deploy 2: delete the old `plan-updatedAt-index` (one GSI delete).

**`contextKey-occurredAt-index` (no readers — safe to drop):**
1. Deploy 1: delete the index (one GSI delete).
2. Deploy 2: re-add it as `KEYS_ONLY` (one GSI create).

Each stack update performs exactly one GSI op and is never mixed with the other
index's ops. `GSI1` (`eventDate-eventType-index`) is untouched and stays `ALL`.

Committed here is the desired end-state projection on each index. The staged
create/flip/delete choreography above is executed by the deploy operator across
the required number of stack updates; `cdk diff` before each phase must show
exactly one GSI create OR delete.
