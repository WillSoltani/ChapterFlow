// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  GetCommand,
  PutCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  BookApiError,
  transactionCancellationReasons,
} from "./errors";
import { buildLicenseEntitlementGrant } from "./license-grant-core";
import {
  bookUserPk,
  entitlementSk,
  licenseIndexPk,
  licenseIndexSk,
  licenseKeyPk,
  licenseKeySk,
  nowIso,
} from "./keys";
import type { LicenseKeyItem } from "./types";
import {
  queryAllItems,
  readNum,
  readStr,
} from "./repo-shared";

function parseLicenseKeyItem(item: Record<string, unknown>, code: string): LicenseKeyItem | null {
  const status = item.status;
  if (status !== "available" && status !== "redeemed" && status !== "revoked") return null;
  return {
    code: readStr(item.code) || code,
    plan: "PRO",
    validMonths: readNum(item.validMonths) ?? 1,
    status,
    redeemedBy: readStr(item.redeemedBy),
    redeemedAt: readStr(item.redeemedAt),
    createdAt: readStr(item.createdAt) || "",
    note: readStr(item.note),
  };
}

export async function getLicenseKey(
  tableName: string,
  code: string
): Promise<LicenseKeyItem | null> {
  const normalized = code.toUpperCase().trim();
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: licenseKeyPk(normalized),
        SK: licenseKeySk(),
      },
    })
  );
  if (!res.Item) return null;
  return parseLicenseKeyItem(res.Item, normalized);
}

/**
 * Atomically claims a license key for a user and upgrades their entitlement to PRO.
 * Uses a DynamoDB transaction so two concurrent requests cannot both redeem the same key.
 */
export async function redeemLicenseKey(
  tableName: string,
  params: { userId: string; code: string; validMonths: number }
): Promise<void> {
  const now = nowIso();
  const expiresAt = (() => {
    const d = new Date();
    const day = d.getDate();
    d.setMonth(d.getMonth() + params.validMonths);
    // setMonth rolls an overflowing day-of-month into the following month (e.g.
    // Jan 31 + 1mo -> Mar 3, since Feb has no 31st), silently granting extra
    // days. Clamp back to the last day of the intended month when that happens.
    if (d.getDate() !== day) {
      d.setDate(0);
    }
    return d.toISOString();
  })();
  const normalized = params.code.toUpperCase().trim();

  try {
    await ddbDoc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            // Mark the key as redeemed — fails if already redeemed or revoked
            Update: {
              TableName: tableName,
              Key: {
                PK: licenseKeyPk(normalized),
                SK: licenseKeySk(),
              },
              UpdateExpression:
                "SET #status = :redeemed, redeemedBy = :userId, redeemedAt = :now, updatedAt = :now",
              ConditionExpression: "#status = :available",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: {
                ":redeemed": "redeemed",
                ":available": "available",
                ":userId": params.userId,
                ":now": now,
              },
            },
          },
          {
            // Upgrade the user's entitlement to PRO (license-based). The grant is
            // applied via the SHARED pro-grant guard (license-grant-core): apply
            // only when it does not shorten/destroy a longer or open-ended grant
            // (active Stripe sub, admin comp, or a license/flow_points/gift window
            // that outlasts this license). The route also pre-checks Stripe
            // (license/route.ts), but that read is not atomic with this write — the
            // condition closes that race and the broader stomp cases. On refusal the
            // whole transaction rolls back, so the key is NOT consumed.
            Update: {
              TableName: tableName,
              Key: {
                PK: bookUserPk(params.userId),
                SK: entitlementSk(),
              },
              ...buildLicenseEntitlementGrant({
                code: normalized,
                expiresAt,
                now,
                defaultSlots: 2,
              }),
            },
          },
          {
            // Update the index item so admin listing reflects redeemed status
            Update: {
              TableName: tableName,
              Key: {
                PK: licenseIndexPk(),
                SK: licenseIndexSk(normalized),
              },
              UpdateExpression:
                "SET #status = :redeemed, redeemedBy = :userId, redeemedAt = :now",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: {
                ":redeemed": "redeemed",
                ":userId": params.userId,
                ":now": now,
              },
            },
          },
        ],
      })
    );
  } catch (error: unknown) {
    const reasons = transactionCancellationReasons(error);
    if (reasons) {
      // Index 1 = entitlement guard (the shared pro-grant guard): the redemption
      // would clobber/shorten a longer-lived or open-ended Pro grant — an active
      // paid Stripe sub, an admin comp, or a license/flow_points/gift window that
      // outlasts this license — OR an unresolved chargeback marker (disputeOpen)
      // blocks the (re)grant entirely (C3). We refuse so the longer grant / hold
      // survives; the transaction rolled back, so the key was NOT consumed.
      if (reasons[1]?.Code === "ConditionalCheckFailed") {
        // Re-read to report the accurate reason. The dispute hold takes priority:
        // a charged-back user must not be told their key is "still valid for later"
        // as if they merely had longer access.
        const entRes = await ddbDoc.send(
          new GetCommand({
            TableName: tableName,
            Key: { PK: bookUserPk(params.userId), SK: entitlementSk() },
          })
        );
        if (entRes.Item?.disputeOpen) {
          throw new BookApiError(
            409,
            "dispute_hold",
            "Your account is on hold pending resolution of a payment dispute, so the license key was not applied. The key remains valid once the dispute is resolved."
          );
        }
        throw new BookApiError(
          409,
          "pro_grant_active",
          "You already have Pro access that lasts at least as long as this license, so the key was not applied. It remains valid for later use."
        );
      }
      // Index 0 (or unspecified) = the key was redeemed or revoked between our
      // read and this write.
      throw new BookApiError(409, "code_already_redeemed", "This license key has already been claimed.");
    }
    throw error;
  }
}

/** Insert a license key record (used by the seed script / admin tooling). */
export async function seedLicenseKey(
  tableName: string,
  key: Omit<LicenseKeyItem, "status"> & { status?: LicenseKeyItem["status"] }
): Promise<void> {
  const normalized = key.code.toUpperCase().trim();
  const status = key.status ?? "available";
  const now = key.createdAt;
  await Promise.all([
    ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: licenseKeyPk(normalized),
          SK: licenseKeySk(),
          entity: "BOOK_LICENSE_KEY",
          code: normalized,
          plan: "PRO",
          validMonths: key.validMonths,
          status,
          createdAt: now,
          note: key.note ?? null,
          updatedAt: now,
        },
        // Do not overwrite an already-redeemed key if re-seeding
        ConditionExpression: "attribute_not_exists(PK) OR #status = :available",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":available": "available" },
      })
    ),
    // Write an index item so admin can list all keys via Query
    ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: licenseIndexPk(),
          SK: licenseIndexSk(normalized),
          entity: "BOOK_LICENSE_KEY_INDEX",
          code: normalized,
          status,
          validMonths: key.validMonths,
          createdAt: now,
          note: key.note ?? null,
        },
        ConditionExpression: "attribute_not_exists(PK) OR #status = :available",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":available": "available" },
      })
    ),
  ]);
}

/** List all license keys by querying the shared index partition. */
export async function listLicenseKeys(
  tableName: string,
  statusFilter?: "available" | "redeemed" | "revoked"
): Promise<LicenseKeyItem[]> {
  // All license-key index items live under one constant partition, so a single
  // page (1MB) silently truncates once the program scales. Read every page
  // first, then apply the status filter client-side: a server-side
  // FilterExpression is evaluated per 1MB page before truncation, so it would
  // under-count whenever the partition exceeds one page.
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": licenseIndexPk(),
      ":prefix": "CODE#",
    },
  });
  return rows
    .map((item) => ({
      code: item.code as string,
      plan: "PRO" as const,
      validMonths: (item.validMonths as number) ?? 1,
      status: item.status as "available" | "redeemed" | "revoked",
      redeemedBy: item.redeemedBy as string | undefined,
      redeemedAt: item.redeemedAt as string | undefined,
      createdAt: item.createdAt as string,
      note: item.note as string | undefined,
    }))
    .filter((key) => !statusFilter || key.status === statusFilter);
}

/** Revoke a license key. Updates both the main record and the index item. */
export async function revokeLicenseKey(
  tableName: string,
  code: string
): Promise<void> {
  const normalized = code.toUpperCase().trim();
  const now = nowIso();
  await ddbDoc.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: tableName,
            Key: { PK: licenseKeyPk(normalized), SK: licenseKeySk() },
            UpdateExpression: "SET #status = :revoked, updatedAt = :now",
            ConditionExpression: "#status = :available",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":revoked": "revoked", ":available": "available", ":now": now },
          },
        },
        {
          Update: {
            TableName: tableName,
            Key: { PK: licenseIndexPk(), SK: licenseIndexSk(normalized) },
            UpdateExpression: "SET #status = :revoked",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":revoked": "revoked" },
          },
        },
      ],
    })
  );
}

// ── Share Events ─────────────────────────────────────────────────────────────
