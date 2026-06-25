import "server-only";

import { getServerEnv } from "@/app/app/api/_lib/server-env";
import type { EmailComplianceConfig } from "@/app/app/api/book/_lib/email-compliance-core";

// Re-export the pure primitives so callers have a single import surface. The
// pure logic (token sign/verify, footer, headers) lives in the dependency-free
// core so it can be unit-tested; only the env-backed config resolver below
// needs server-only.
export * from "@/app/app/api/book/_lib/email-compliance-core";

/** Resolve email-compliance configuration from server env (SSM-backed). */
export async function getEmailComplianceConfig(): Promise<EmailComplianceConfig> {
  const [senderEmail, senderName, supportAddress, postalAddress, appBaseUrl, secret] =
    await Promise.all([
      getServerEnv("SES_SENDER_EMAIL"),
      getServerEnv("EMAIL_SENDER_NAME"),
      getServerEnv("EMAIL_SUPPORT_ADDRESS"),
      getServerEnv("EMAIL_POSTAL_ADDRESS"),
      getServerEnv("CHAPTERFLOW_APP_BASE_URL"),
      getServerEnv("EMAIL_UNSUBSCRIBE_SECRET"),
    ]);
  const configurationSet = await getServerEnv("SES_CONFIGURATION_SET");
  return {
    senderEmail: senderEmail ?? "",
    senderName: senderName || "ChapterFlow",
    supportAddress: supportAddress || "support@chapterflow.ca",
    postalAddress: postalAddress ?? "",
    // No siliconx.ca fallback: the legacy host no longer serves the unsubscribe
    // route. An empty value makes the commercial-email gate (canSendCommercialEmail)
    // refuse to send rather than mint a non-working one-click-unsubscribe link
    // (CASL violation) — byte-for-byte the same kill-switch the cron Lambda enforces
    // (infra/lambda/lib/email-compliance.ts). Set CHAPTERFLOW_APP_BASE_URL to enable.
    appBaseUrl: (appBaseUrl || "").replace(/\/+$/, ""),
    secret: secret ?? "",
    configurationSet: configurationSet ?? "",
  };
}
