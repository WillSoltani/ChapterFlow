/**
 * Pure parser for SES bounce/complaint events (delivered via a configuration-set
 * event destination → SNS). Dependency-free so it can be unit-tested; the
 * suppression-handler Lambda (`infra/lambda/suppression-handler.ts`, a separate
 * build root) replicates this logic — keep the two in sync.
 *
 * Policy: suppress on PERMANENT (hard) bounces and on complaints. Transient
 * (soft) bounces are not suppressed — they are often temporary.
 */

export type SuppressionReason = "bounce" | "complaint";
export type SuppressionEntry = { email: string; reason: SuppressionReason; subtype?: string };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function recipientEmails(recipients: unknown): string[] {
  if (!Array.isArray(recipients)) return [];
  return recipients
    .map((r) => asRecord(r)?.emailAddress)
    .filter((e): e is string => typeof e === "string" && e.length > 0);
}

/**
 * Parse one SES event (raw JSON string or already-parsed object) into the list
 * of addresses to suppress. Handles both the configuration-set event shape
 * (`eventType`) and the legacy direct-SNS shape (`notificationType`).
 */
export function parseSesSuppressionEvent(raw: unknown): SuppressionEntry[] {
  let msg: unknown = raw;
  if (typeof raw === "string") {
    try {
      msg = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const root = asRecord(msg);
  if (!root) return [];

  const type = root.eventType ?? root.notificationType;

  if (type === "Bounce") {
    const bounce = asRecord(root.bounce);
    if (!bounce || bounce.bounceType !== "Permanent") return [];
    const subtype = typeof bounce.bounceSubType === "string" ? bounce.bounceSubType : undefined;
    return recipientEmails(bounce.bouncedRecipients).map((email) => ({
      email,
      reason: "bounce" as const,
      subtype,
    }));
  }

  if (type === "Complaint") {
    const complaint = asRecord(root.complaint);
    if (!complaint) return [];
    const subtype =
      typeof complaint.complaintFeedbackType === "string"
        ? complaint.complaintFeedbackType
        : undefined;
    return recipientEmails(complaint.complainedRecipients).map((email) => ({
      email,
      reason: "complaint" as const,
      subtype,
    }));
  }

  return [];
}
