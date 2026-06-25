// Returns the core email body only. The compliant footer (sender identity,
// postal address, one-click unsubscribe) is appended by sendCompliantEmail.
import { escapeHtml } from "../email-compliance";

export function weeklyDigestEmail(params: {
  name: string;
  chaptersCompleted: number;
  currentStreak: number;
  ipBalance: number;
  appBaseUrl: string;
}) {
  const encouragement = params.chaptersCompleted > 0
    ? "Great progress this week! Keep the momentum going."
    : "Take 15 minutes today to get back on track.";
  const cta = `${params.appBaseUrl}/dashboard`;
  // displayName is user-controlled — escape before interpolating into HTML.
  const name = escapeHtml(params.name);

  return {
    subject: `Your ChapterFlow Week: ${params.chaptersCompleted} chapters completed`,
    textBody: `Hi ${params.name},\n\nYour ChapterFlow week: ${params.chaptersCompleted} chapters, ${params.currentStreak}-day streak, ${params.ipBalance} IP. ${encouragement}\n\nOpen ChapterFlow: ${cta}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Your Week in Review</h2><p>Hi ${name},</p><ul><li><strong>${params.chaptersCompleted}</strong> chapters completed</li><li><strong>${params.currentStreak}</strong>-day streak</li><li><strong>${params.ipBalance}</strong> Insight Points</li></ul><p>${encouragement}</p><p><a href="${cta}" style="color:#6366f1">Open ChapterFlow</a></p></div>`,
  };
}
