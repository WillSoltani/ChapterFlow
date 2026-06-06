# Account Lifecycle & Privacy

How ChapterFlow handles account **deactivation**, **deletion**, **data export**, and **complete erasure**, plus the operational alerting around them. Scope is the web app (`app/`, `infra/`).

## Status model

Each user has one account-status item in the main table:

- `PK = BOOKUSER#<userId>`, `SK = ACCOUNT_STATUS`
- `status ∈ { active | deactivated | deleted }` (`AccountStatus` in `app/app/api/book/_lib/types.ts`)
- Read/write via `getAccountStatus` / `setAccountStatus` (`repo.ts`). No record == `active`.

Every transition also appends an **immutable audit row** (`setAccountStatus` writes it best-effort):

- `PK = BOOKUSER#<userId>`, `SK = ACCOUNTSTATUSCHANGE#<iso>`, `entity = BOOK_ACCOUNT_STATUS_CHANGE`
- fields: `status`, `previousStatus`, `changedAt`, `changedBy` (`"self"` | `"admin:<id>"` | `"system"`), `reason`
- listed newest-first by `listAccountStatusChanges`.

## Enforcement (the important part)

`requireUser()` (`app/app/api/_lib/auth.ts`) only proves the Cognito token is valid — it does **not** know the account status. Status is enforced by **`requireActiveBookUser()`** (`app/app/api/book/_lib/account-guard.ts`):

- `deleted` → throws `BookApiError(403, "account_deleted")`.
- `deactivated` → **auto-reactivates** (a valid token means the user signed back in) then proceeds. Consistent with the page guard `app/_lib/require-dashboard-access.ts`.
- `active` / no record → proceeds.
- **Dev bypass** short-circuits (no status read).
- **Fail-open**: a DynamoDB read error logs `account_status_gate_error` and allows the request — a status-store outage must not lock out all users.

The decision is factored into a pure `decideAccountAccess(status)` for unit testing.

**Every user-facing Book API route uses `requireActiveBookUser`** (≈60 routes were migrated). `requireAdminUser` composes on it, so a deleted/deactivated admin can't operate admin endpoints either.

**Exempt routes** (intentionally stay on bare `requireUser` so a deactivated/deleted user can still use them):

| Route | Why |
| --- | --- |
| `POST me/account/delete` | self-service delete must work |
| `POST me/account/deactivate` | self-service deactivate must work |
| `GET me/export` | data portability (must work post-delete) |
| `GET me/entitlements` | subscription info |

Non-book `auth/session` and `me` already degrade gracefully and are left as-is. The 5 public/no-auth routes (catalog, book detail, concept-graph, search-index, Stripe webhook) are untouched.

> **When adding a new user route:** use `requireActiveBookUser`, not `requireUser`, unless it must be reachable while deactivated/deleted.

## Self-service flows

- **Deactivate** (`me/account/deactivate`): status → `deactivated`; Stripe sub set to `cancel_at_period_end`. Reversible — signing back in reactivates.
- **Delete** (`me/account/delete`, requires body `{confirm:"DELETE"}`): status → `deleted` (soft); Stripe sub cancelled immediately. **Soft-delete**: data is retained per the Privacy Policy and the account becomes permanently inaccessible (only an admin can reverse). Complete erasure is on request (see below). UI: `app/book/settings/components/DangerZone.tsx`.
- **Export** (`me/export?format=json|csv|markdown`): full personal data export, wired in `ExportModal.tsx`. (Note: does not yet include the analytics table — tracked separately.)

## Admin tooling

- **View** current status + history in the user-detail drawer (`UsersClient.tsx`); `GET admin/users/[userId]` now returns `accountStatus`, `accountStatusChangedAt`, `accountStatusHistory`.
- **Lifecycle actions** — `POST admin/users/[userId]/account-status` `{ action: "reactivate" | "deactivate" | "delete", reason? }`. Pure status transitions (no Stripe/data side effects); records `changedBy: admin:<id>`.
- **Complete erasure** — `POST admin/users/[userId]/erase` `{ confirm: "ERASE" }`. **Irreversible.** Cascades (`account-erasure.ts`):
  1. main partition `BOOKUSER#<userId>` (all personal data)
  2. derived `QUIZATTEMPT#<userId>#…` partitions
  3. analytics partition `USER#<userId>` (snapshot + events)
  4. Stripe customer object + reverse map
  5. Cognito user (resolve `Username` by `sub` filter → `AdminDeleteUser`)
  Stripe/Cognito steps are best-effort: a failure is recorded as an ops-failure (+ CloudWatch metric) and surfaced in the returned summary's `residualWarnings`, never hidden. A permanent record is written to `BOOKERASURE#LOG` (outside the deleted user partition).
  - **Known residuals** (no `userId` GSI in the single-table design): risk/fraud events keyed by device fingerprint, and any referral-code reverse index, are **not** auto-erased.

## Operational alerting (Stripe / erasure failures)

Stripe cancellation failures during delete/deactivate are **no longer swallowed**. `captureStripeCancelFailure` (`ops-failure-repo.ts`) does three things:

1. `console.error("stripe_cancellation_failed", …)`
2. records a `BOOK_OPS_FAILURE` item (partition `BOOKOPSFAILURE`) for in-app follow-up
3. `recordOpsFailure` emits a single unified CloudWatch metric `ChapterFlow/Ops · OpsFailure` (dimensioned by `kind`) — emitted for every failure kind (stripe cancellation, stripe customer delete, cognito delete) and for a partial erasure, so one alarm covers them all. Emitted even if the DynamoDB persist fails.

Surfaced in the **admin Ops dashboard** (`OpsClient.tsx`): an "Operational failures" panel lists unresolved items with **Retry** (re-attempts the Stripe call for cancellation kinds only; `resource_missing` counts as success) and **Resolve** (mark handled). Backed by `GET/POST admin/ops-failures`.

A backend **CloudWatch alarm** (`OpsFailure ≥ 1` in 5 min) and the existing table-throttle alarms publish to the **`ChapterFlowOpsAlerts` SNS topic**.

## Required infra / deploy steps

The app code works without these, but the alerting + erasure aren't fully live until deployed:

1. **`CHAPTERFLOW_OPS_ALERT_EMAIL`** at CDK synth time → subscribes that inbox to `ChapterFlowOpsAlerts` (confirm the SNS subscription email).
2. **IAM** (auto-added in CDK, needs deploy):
   - server Lambda: `cloudwatch:PutMetricData` (namespace-scoped to `ChapterFlow/Ops`).
   - server Lambda: `cognito-idp:ListUsers` + `cognito-idp:AdminDeleteUser` (scoped to `COGNITO_USER_POOL_ID` when set at synth).
3. **`COGNITO_USER_POOL_ID`** must be set in the server runtime env for Cognito erasure.
4. New dependency: **`@aws-sdk/client-cognito-identity-provider`**.
5. Deploy both stacks: `npm --prefix infra run build` then `cdk deploy` (backend + frontend).

## Reversal & recovery

- **Deactivated** users self-reactivate by signing in.
- **Deleted** users are reactivated only by an admin via the lifecycle action (`reactivate`).
- **Erased** users cannot be recovered — that is the point.
