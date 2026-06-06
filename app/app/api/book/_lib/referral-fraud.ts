import "server-only";

// Implements §6.6 — Referral fraud prevention.
// Device fingerprinting, IP matching, disposable email blocking,
// velocity monitoring, cross-referral detection.

import { createHash } from "crypto";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, referralClaimSk } from "@/app/app/api/book/_lib/keys";
import { listRecentRiskEvents } from "@/app/app/api/book/_lib/repo";
import {
  evaluateReferralFraud,
  DEVICE_VELOCITY_THRESHOLD,
  type ReferralFraudCheckResult,
} from "@/app/app/api/book/_lib/referral-fraud-core";

export type { ReferralFraudCheckResult } from "@/app/app/api/book/_lib/referral-fraud-core";

function sha(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

// ── Main fraud check (§6.6) ────────────────────────────────────────────────

/**
 * Gather the referral-fraud signals (DB queries) and run the pure decision
 * (evaluateReferralFraud). Returns { allowed: true } if clear, or
 * { allowed: false, reason } if blocked.
 */
export async function checkReferralFraud(params: {
  tableName: string;
  inviteeUserId: string;
  inviterUserId: string;
  inviteeEmail: string;
  inviteeDeviceId: string | null;
  inviterDeviceId: string | null;
  inviteeIp: string | null;
  inviterIp: string | null;
}): Promise<ReferralFraudCheckResult> {
  const {
    tableName,
    inviteeUserId,
    inviterUserId,
    inviteeEmail,
    inviteeDeviceId,
    inviterDeviceId,
    inviteeIp,
    inviterIp,
  } = params;

  const crossReferral = await checkCrossReferral(tableName, inviteeUserId, inviterUserId);

  const sameDevice = Boolean(
    inviteeDeviceId && inviterDeviceId && inviteeDeviceId === inviterDeviceId
  );

  // Distinct users on the invitee's device in the last 30 days — queried
  // whenever a device id is present (cheap at solo-founder scale).
  let deviceVelocityCount = 0;
  if (inviteeDeviceId) {
    const deviceHash = sha(`device:${inviteeDeviceId}`);
    const deviceEvents = await listRecentRiskEvents(tableName, {
      scope: "device",
      fingerprint: deviceHash,
      limit: 30,
    });
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    deviceVelocityCount = new Set(
      deviceEvents
        .filter((e) => Date.parse(e.createdAt) > thirtyDaysAgo)
        .map((e) => e.userId)
    ).size;
  }

  const sameIp = Boolean(inviteeIp && inviterIp && inviteeIp === inviterIp);

  // Inviter activations in the last 7 days. Skip the query when an earlier,
  // higher-priority signal already blocks — evaluateReferralFraud short-circuits
  // before inviter velocity, so it only matters when nothing above triggered.
  let inviterVelocityCount = 0;
  const blockedEarlier =
    crossReferral || sameDevice || deviceVelocityCount >= DEVICE_VELOCITY_THRESHOLD;
  if (!blockedEarlier) {
    inviterVelocityCount = await checkInviterVelocity(tableName, inviterUserId);
  }

  return evaluateReferralFraud({
    inviteeEmail,
    crossReferral,
    sameDevice,
    deviceVelocityCount,
    sameIp,
    inviterVelocityCount,
  });
}

// ── Helper functions ────────────────────────────────────────────────────────

async function checkCrossReferral(
  tableName: string,
  inviteeUserId: string,
  inviterUserId: string
): Promise<boolean> {
  // Check if the inviter has a referral claim from the invitee
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(inviterUserId),
        ":sk": referralClaimSk(),
      },
      ProjectionExpression: "inviterUserId",
    })
  );

  if (!res.Items || res.Items.length === 0) return false;
  return res.Items.some((item) => item.inviterUserId === inviteeUserId);
}

async function checkInviterVelocity(
  tableName: string,
  inviterUserId: string
): Promise<number> {
  // Count activated invites in the last 7 days by querying the referral profile
  // For a more accurate check, we'd query individual referral claim records.
  // This is a simplified check using the profile's activatedInvites counter.
  // A proper implementation should track timestamps per activation.

  // Query POINTSGRANT records for referral_activation_inviter source type
  // created in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      FilterExpression: "sourceType = :st AND createdAt > :since",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(inviterUserId),
        ":prefix": "POINTSGRANT#referral_activation_inviter#",
        ":st": "referral_activation_inviter",
        ":since": sevenDaysAgo,
      },
      Select: "COUNT",
    })
  );

  return res.Count ?? 0;
}
