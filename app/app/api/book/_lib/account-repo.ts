// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import { logger } from "@/lib/logging/logger";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  accountStatusChangeSk,
  accountStatusSk,
  bookUserPk,
  nowIso,
  riskEventPk,
  riskEventSk,
} from "./keys";
import type {
  AccountStatus,
  AccountStatusChangeItem,
  AccountStatusItem,
  BookRiskEventItem,
} from "./types";
import { buildRiskEventPointer } from "./erasure-pointers-core";
import {
  parseRecord,
  readStr,
} from "./repo-shared";

export async function recordRiskEvent(
  tableName: string,
  event: BookRiskEventItem
): Promise<void> {
  // Write the externally-keyed risk event AND a reverse-pointer into the user's
  // own partition (#4a) so account-erasure — which sweeps only the user
  // partition — can later reconstruct this event's key and delete it. Forward-
  // only: pointers exist only for events written after this deploy.
  const pointer = buildRiskEventPointer({
    userId: event.userId,
    scope: event.scope,
    fingerprint: event.fingerprint,
    createdAt: event.createdAt,
    eventType: event.eventType,
  });
  // Atomic: write the risk event AND its erasure reverse-pointer together so a
  // partial failure can never leave a risk event with no pointer — which would be
  // unreachable at account-erasure (exactly the gap #4a closes). Matches the
  // referral/pair pointers, which are also written via TransactWrite.
  await ddbDoc.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: {
              // no TTL — retained for legal/fraud/compliance (abuse/fraud investigation)
              PK: riskEventPk(event.scope, event.fingerprint),
              SK: riskEventSk(event.createdAt, event.eventType, event.userId),
              entity: "BOOK_RISK_EVENT",
              ...event,
            },
          },
        },
        { Put: { TableName: tableName, Item: pointer } },
      ],
    })
  );
}

export async function listRecentRiskEvents(
  tableName: string,
  params: {
    scope: BookRiskEventItem["scope"];
    fingerprint: string;
    limit?: number;
  }
): Promise<BookRiskEventItem[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": riskEventPk(params.scope, params.fingerprint),
        ":prefix": "EVENT#",
      },
      ScanIndexForward: false,
      Limit: Math.max(1, Math.min(100, Math.floor(params.limit ?? 40))),
    })
  );

  const items: Array<BookRiskEventItem | null> = (res.Items ?? []).map((item) => {
      const scope =
        item.scope === "device"
          ? "device"
          : item.scope === "network"
            ? "network"
            : item.scope === "network_ua"
              ? "network_ua"
              : null;
      const eventType =
        item.eventType === "onboarding_completed"
          ? "onboarding_completed"
          : item.eventType === "free_unlock_granted"
            ? "free_unlock_granted"
            : null;
      const fingerprint = readStr(item.fingerprint);
      const userId = readStr(item.userId);
      const createdAt = readStr(item.createdAt);
      if (!scope || !eventType || !fingerprint || !userId || !createdAt) return null;
      return {
        scope,
        eventType,
        fingerprint,
        userId,
        createdAt,
        emailVerified: typeof item.emailVerified === "boolean" ? item.emailVerified : undefined,
        deviceId: readStr(item.deviceId),
        metadata: parseRecord(item.metadata),
      } satisfies BookRiskEventItem;
    });
  return items.filter((item): item is BookRiskEventItem => item !== null);
}

// ── Account Status (soft deactivation / soft deletion) ──────────────────────

export async function getAccountStatus(
  tableName: string,
  userId: string
): Promise<AccountStatusItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: accountStatusSk() },
    })
  );
  const item = res.Item;
  if (!item) return null;
  const status = item.status as string;
  if (status !== "active" && status !== "deactivated" && status !== "deleted") return null;
  return {
    userId,
    status: status as AccountStatusItem["status"],
    statusChangedAt: (item.statusChangedAt as string) ?? "",
    statusReason: item.statusReason as string | undefined,
    previousPlan: item.previousPlan as "FREE" | "PRO" | undefined,
    previousProSource: item.previousProSource as string | undefined,
  };
}

export async function setAccountStatus(
  tableName: string,
  userId: string,
  status: AccountStatusItem["status"],
  extras?: {
    statusReason?: string;
    previousPlan?: "FREE" | "PRO";
    previousProSource?: string;
    /** Who made the change: "self" (default), "admin:<adminUserId>", or "system". */
    changedBy?: string;
  }
): Promise<void> {
  const now = nowIso();

  // Capture the prior status for the audit trail (best-effort — never blocks).
  let previousStatus: AccountStatus | null = null;
  try {
    const prev = await getAccountStatus(tableName, userId);
    previousStatus = prev?.status ?? null;
  } catch {
    // ignore — the audit row just won't carry a previousStatus
  }

  const item: Record<string, unknown> = {
    PK: bookUserPk(userId),
    SK: accountStatusSk(),
    entity: "BOOK_ACCOUNT_STATUS",
    userId,
    status,
    statusChangedAt: now,
    updatedAt: now,
  };
  if (extras?.statusReason) item.statusReason = extras.statusReason;
  if (extras?.previousPlan) item.previousPlan = extras.previousPlan;
  if (extras?.previousProSource) item.previousProSource = extras.previousProSource;

  await ddbDoc.send(new PutCommand({ TableName: tableName, Item: item }));

  // Append an immutable audit record (who/when/why). Best-effort: a failed
  // audit write must not undo or block the authoritative status change above.
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          // no TTL — retained for legal/fraud/compliance (immutable account-lifecycle audit)
          PK: bookUserPk(userId),
          SK: accountStatusChangeSk(now),
          entity: "BOOK_ACCOUNT_STATUS_CHANGE",
          userId,
          status,
          previousStatus,
          changedAt: now,
          changedBy: extras?.changedBy ?? "self",
          reason: extras?.statusReason,
        },
      })
    );
  } catch (error) {
    logger.error("account_status_audit_write_failed", {
      userId,
      status,
      err: error,
    });
  }
}

/** List a user's account-status change history (newest first) for the admin UI. */
export async function listAccountStatusChanges(
  tableName: string,
  userId: string,
  limit = 50
): Promise<AccountStatusChangeItem[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "ACCOUNTSTATUSCHANGE#",
      },
      ScanIndexForward: false, // newest first
      Limit: Math.min(Math.max(limit, 1), 200),
    })
  );
  return (res.Items ?? []).map((item) => ({
    userId,
    status: (readStr(item.status) as AccountStatus) ?? "active",
    previousStatus: (readStr(item.previousStatus) as AccountStatus) ?? null,
    changedAt: readStr(item.changedAt) ?? "",
    changedBy: readStr(item.changedBy) ?? "self",
    reason: readStr(item.reason),
  }));
}
