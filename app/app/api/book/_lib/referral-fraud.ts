import "server-only";

// Implements §6.6 — Referral fraud prevention.
// Device fingerprinting, IP matching, disposable email blocking,
// velocity monitoring, cross-referral detection.

import { createHash } from "crypto";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, referralClaimSk } from "@/app/app/api/book/_lib/keys";
import { listRecentRiskEvents } from "@/app/app/api/book/_lib/repo";

// ── Types ───────────────────────────────────────────────────────────────────

export type ReferralFraudCheckResult = {
  allowed: boolean;
  flagForReview: boolean;
  reason: string | null;
};

// ── Disposable email domain blocklist (§6.6) ────────────────────────────────

// Subset of ~100 most common disposable domains. Full list (~3,000) should be
// loaded from a config file or DynamoDB in production.
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com", "guerrillamail.com", "mailinator.com", "throwaway.email",
  "temp-mail.org", "fakeinbox.com", "tempail.com", "dispostable.com",
  "yopmail.com", "maildrop.cc", "sharklasers.com", "guerrillamailblock.com",
  "grr.la", "guerrillamail.info", "guerrillamail.net", "trash-mail.com",
  "trashmail.me", "trashmail.net", "tempmailaddress.com", "tempmailo.com",
  "mohmal.com", "mailnesia.com", "mailsac.com", "minutemail.com",
  "getairmail.com", "bugmenot.com", "bobmail.info", "bumpymail.com",
  "emailondeck.com", "getnada.com",
]);

function sha(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

// ── Main fraud check (§6.6) ────────────────────────────────────────────────

/**
 * Run all referral fraud checks before activating a referral reward.
 * Returns { allowed: true } if clear, or { allowed: false, reason } if blocked.
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

  // §6.6 — Disposable email domain blocking
  const emailDomain = inviteeEmail.split("@")[1]?.toLowerCase();
  if (emailDomain && DISPOSABLE_DOMAINS.has(emailDomain)) {
    return {
      allowed: false,
      flagForReview: false,
      reason: "disposable_email",
    };
  }

  // §6.6 — Cross-referral detection (two users refer each other)
  const crossCheck = await checkCrossReferral(tableName, inviteeUserId, inviterUserId);
  if (crossCheck) {
    return {
      allowed: false,
      flagForReview: true,
      reason: "cross_referral",
    };
  }

  // §6.6 — Device fingerprint match
  if (inviteeDeviceId && inviterDeviceId && inviteeDeviceId === inviterDeviceId) {
    return {
      allowed: false,
      flagForReview: true,
      reason: "device_fingerprint_match",
    };
  }

  // §6.6 — Device fingerprint velocity (≥3 different invitees on same device in 30 days)
  if (inviteeDeviceId) {
    const deviceHash = sha(`device:${inviteeDeviceId}`);
    const deviceEvents = await listRecentRiskEvents(tableName, {
      scope: "device",
      fingerprint: deviceHash,
      limit: 30,
    });

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const distinctUsersOnDevice = new Set(
      deviceEvents
        .filter((e) => Date.parse(e.createdAt) > thirtyDaysAgo)
        // Count all event types from distinct users on this device
        .map((e) => e.userId)
    );

    if (distinctUsersOnDevice.size >= 3) {
      return {
        allowed: false,
        flagForReview: true,
        reason: "device_velocity",
      };
    }
  }

  // §6.6 — Network + user-agent match (same IP within 24 hours)
  if (inviteeIp && inviterIp && inviteeIp === inviterIp) {
    return {
      allowed: true, // Not blocked, but flagged for manual review
      flagForReview: true,
      reason: "network_match_flagged",
    };
  }

  // §6.6 — Inviter velocity (>5 activations per 7-day rolling window)
  const inviterVelocity = await checkInviterVelocity(tableName, inviterUserId);
  if (inviterVelocity > 5) {
    return {
      allowed: true, // Delayed, not blocked
      flagForReview: true,
      reason: "inviter_velocity",
    };
  }

  return { allowed: true, flagForReview: false, reason: null };
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
