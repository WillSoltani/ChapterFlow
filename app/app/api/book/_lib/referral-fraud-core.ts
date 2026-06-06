/**
 * Pure referral-fraud decision logic (§6.6) — no I/O, so it is unit-testable.
 * referral-fraud.ts gathers the signals (DB queries) and calls evaluateReferralFraud.
 */

export type ReferralFraudCheckResult = {
  allowed: boolean;
  flagForReview: boolean;
  reason: string | null;
};

// Subset of common disposable email domains. A production list (~3,000) should
// be loaded from config/DynamoDB.
export const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com", "guerrillamail.com", "mailinator.com", "throwaway.email",
  "temp-mail.org", "fakeinbox.com", "tempail.com", "dispostable.com",
  "yopmail.com", "maildrop.cc", "sharklasers.com", "guerrillamailblock.com",
  "grr.la", "guerrillamail.info", "guerrillamail.net", "trash-mail.com",
  "trashmail.me", "trashmail.net", "tempmailaddress.com", "tempmailo.com",
  "mohmal.com", "mailnesia.com", "mailsac.com", "minutemail.com",
  "getairmail.com", "bugmenot.com", "bobmail.info", "bumpymail.com",
  "emailondeck.com", "getnada.com",
]);

/** ≥ this many distinct users on one device in 30 days blocks the reward. */
export const DEVICE_VELOCITY_THRESHOLD = 3;
/** > this many inviter activations in a 7-day window flags (does not block). */
export const INVITER_VELOCITY_THRESHOLD = 5;

export type ReferralFraudSignals = {
  inviteeEmail: string;
  /** Inviter holds a referral claim from the invitee (mutual referral). */
  crossReferral: boolean;
  /** Invitee and inviter share the same device fingerprint (both present). */
  sameDevice: boolean;
  /** Distinct users seen on the invitee's device in the last 30 days. */
  deviceVelocityCount: number;
  /** Invitee and inviter share the same IP (both present). */
  sameIp: boolean;
  /** Inviter activations in the last 7 days. */
  inviterVelocityCount: number;
};

export function evaluateReferralFraud(s: ReferralFraudSignals): ReferralFraudCheckResult {
  // Disposable email — hard block, no review needed.
  const emailDomain = s.inviteeEmail.split("@")[1]?.toLowerCase();
  if (emailDomain && DISPOSABLE_DOMAINS.has(emailDomain)) {
    return { allowed: false, flagForReview: false, reason: "disposable_email" };
  }
  // Mutual referral — block + review.
  if (s.crossReferral) {
    return { allowed: false, flagForReview: true, reason: "cross_referral" };
  }
  // Same device — block + review.
  if (s.sameDevice) {
    return { allowed: false, flagForReview: true, reason: "device_fingerprint_match" };
  }
  // Too many accounts on one device — block + review.
  if (s.deviceVelocityCount >= DEVICE_VELOCITY_THRESHOLD) {
    return { allowed: false, flagForReview: true, reason: "device_velocity" };
  }
  // Same network — allow but flag for manual review.
  if (s.sameIp) {
    return { allowed: true, flagForReview: true, reason: "network_match_flagged" };
  }
  // Inviter activating very fast — allow but flag.
  if (s.inviterVelocityCount > INVITER_VELOCITY_THRESHOLD) {
    return { allowed: true, flagForReview: true, reason: "inviter_velocity" };
  }
  return { allowed: true, flagForReview: false, reason: null };
}
