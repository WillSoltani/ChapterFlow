// Returns the core email body only. The compliant footer (sender identity,
// postal address, one-click unsubscribe) is appended by sendCompliantEmail.
import { escapeHtml } from "../email-compliance";

export function streakAtRiskEmail(params: {
  name: string;
  currentStreak: number;
  hoursRemaining: number;
  appBaseUrl: string;
}) {
  const cta = `${params.appBaseUrl}/dashboard`;
  // displayName is user-controlled — escape before interpolating into HTML.
  const name = escapeHtml(params.name);
  return {
    subject: `Your ${params.currentStreak}-day streak ends in ${params.hoursRemaining} hours`,
    textBody: `Hi ${params.name},\n\nYour ${params.currentStreak}-day reading streak ends tonight. Open ChapterFlow and complete one chapter to keep it alive.\n\nKeep your streak alive: ${cta}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">${params.currentStreak}-Day Streak at Risk</h2><p>Hi ${name},</p><p>Your <strong>${params.currentStreak}-day</strong> reading streak ends in <strong>${params.hoursRemaining} hours</strong>.</p><p>Open ChapterFlow and complete one chapter to keep it alive.</p><p><a href="${cta}" style="color:#6366f1">Keep your streak alive</a></p></div>`,
  };
}
