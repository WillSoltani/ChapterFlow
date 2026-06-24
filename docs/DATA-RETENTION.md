# Data Retention Matrix

How long ChapterFlow keeps each class of stored record, and how that retention
is enforced. Authored for #16 (launch-readiness hardening). For the privacy-policy
wording shown to users see [`app/legal/privacy/page.tsx`](../app/legal/privacy/page.tsx);
for account-deletion vs erasure mechanics see
[`ACCOUNT_LIFECYCLE.md`](./ACCOUNT_LIFECYCLE.md).

> **Periods below are operational defaults, owner-ratifiable.** "Retained —
> legal/fraud" classes have NO automatic expiry on purpose; their concrete legal
> retention period is an owner/counsel decision and is enforced by *not* stamping
> a TTL, not by this doc.

## Enforcement mechanisms

- **DynamoDB TTL** — a numeric `ttl` attribute holding the expiry as **epoch
  SECONDS** (DynamoDB requirement; never milliseconds). DynamoDB reaps expired
  items **asynchronously, typically within ~48h** (occasionally longer). TTL is a
  best-effort lifetime floor, **not** a precise or secure delete. Two tables have
  the attribute enabled: the main app table (`ChapterFlowApp`) and the analytics
  table (`ChapterFlowAnalytics`). The helper is `ttlEpochSeconds(retentionDays)`
  in [`keys.ts`](../app/app/api/book/_lib/keys.ts); the single ttl-vs-durable
  source of truth is `retentionPolicyFor(entity)` in the same file (pinned by
  [`keys.retention.test.ts`](../app/app/api/book/_lib/keys.retention.test.ts)).
- **On-request erasure** — swept by [`account-erasure.ts`](../app/app/api/book/_lib/account-erasure.ts)
  when a user deletes their account or requests erasure (GDPR/CCPA).
- **Indefinite** — retained until an explicit operator/legal action; no automatic
  deletion.

> **No backfill.** Enabling TTL on the analytics table is online and
> non-destructive: existing rows that predate the change carry no `ttl` and are
> **never** reaped. We deliberately do **not** backfill `ttl` onto historical
> rows — doing so would mass-delete history the moment TTL turned on. Only rows
> written after the deploy age out.

## Matrix

| Record class (`entity`) | Store | Retention | Mechanism | Notes |
|---|---|---|---|---|
| Analytics **EVENT** rows (`BOOK_ANALYTICS_EVENT`) | analytics table | ~18 months | **DynamoDB TTL** | Append-only event stream (`putEvent` in `analytics-repo.ts`); unbounded growth. |
| Analytics **SNAPSHOT** (`BOOK_ANALYTICS_SNAPSHOT`) | analytics table | Indefinite (until erasure) | On-request erasure | Durable per-user rollup. Written via `UpdateCommand` and **never** carries `ttl`. NOT the same as the event stream. |
| Operational failures (`BOOK_OPS_FAILURE`) | app table | ~18 months | **DynamoDB TTL** | High-volume ops log; no compliance value once acted on. |
| Share events (`BOOK_USER_SHARE_EVENT`) | app table | ~18 months | **DynamoDB TTL** | Engagement telemetry. |
| Rate-limit / dedup counters (export limit, nudge dedup, Ask cache, pairing invites) | app table | Hours–days | **DynamoDB TTL** | Ephemeral; ttl set at write time by their own writers (pre-existing). |
| Stripe webhook idempotency marker (`BOOK_STRIPE_WEBHOOK_EVENT`) | app table | PROCESSING lease ttl'd; **DONE retained forever** | DynamoDB TTL (lease only) | Owned by #10's claim-lease (`claimStripeWebhookEvent`/`completeStripeWebhookEvent`). The DONE flip **REMOVEs** the ttl. Retention (#16) must never stamp/alter this marker. |
| Billing events — refunds, disputes (`BOOK_BILLING_EVENT`) | app table | **Retained — legal/tax** | Indefinite | Finance audit. Period is an owner/counsel decision. |
| Risk / fraud events (`BOOK_RISK_EVENT`) | app table | **Retained — fraud** | Indefinite | Abuse/fraud investigation. Period is an owner/counsel decision. Reachable by erasure via #4 reverse-pointers. |
| Account-status changes (`BOOK_ACCOUNT_STATUS_CHANGE`) | app table | **Retained — compliance** | Indefinite (within user partition) | Immutable account-lifecycle audit; swept by erasure with the rest of the user partition. |
| Erasure audit log (`BOOK_ERASURE_LOG`) | app table | **Retained — compliance** | Indefinite | Permanent proof an erasure occurred (HMAC of the sub, no plaintext identifier — #4b). Lives **outside** the user partition so it survives erasure. |
| Core user data — entitlement, progress, profile, settings, book/chapter state, quiz state, notes, FSRS cards | app table | Account lifetime | On-request erasure | Kept while the account is active/deactivated; removed on deletion/erasure. |

## TTL defaults summary

| Class | Default period | Owner-ratifiable? |
|---|---|---|
| Analytics events | 18 months | yes |
| Ops failures | 18 months | yes |
| Share events | 18 months | yes |
| Billing/tax (refunds, disputes) | retained (legal/tax) — period TBD by counsel | **requires legal confirmation** |
| Risk/fraud events | retained (fraud) — period TBD by owner | **requires owner confirmation** |

## Deploy note

Enabling the analytics-table TTL attribute is the one owner-operated gate for
this change (online, non-destructive, no backfill). The real risk is **code**
mis-stamping a durable class with a `ttl` — that is guarded by the no-ttl
comments at each durable write site and by `retentionPolicyFor` +
`keys.retention.test.ts`.
