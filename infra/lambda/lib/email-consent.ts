/**
 * Canonical opt-IN email-consent gate, shared by every infra/lambda email
 * sender (the reading-reminder cron + the nudge handlers). Mirrors the opt-IN
 * check + CASL/CAN-SPAM rationale in app notifications-repo.ts. Absence of an
 * explicit `true` means NO consent — never send commercial email by default.
 */
export function emailChannelConsented(
  notifications: { channels?: { email?: boolean } } | undefined,
): boolean {
  return notifications?.channels?.email === true;
}
