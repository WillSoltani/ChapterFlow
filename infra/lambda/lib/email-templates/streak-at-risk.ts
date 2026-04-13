const UNSUB_URL = "https://chapterflow.siliconx.ca/book/settings#notifications";

export function streakAtRiskEmail(params: {
  name: string;
  currentStreak: number;
  hoursRemaining: number;
}) {
  return {
    subject: `Your ${params.currentStreak}-day streak ends in ${params.hoursRemaining} hours`,
    textBody: `Hi ${params.name},\n\nYour ${params.currentStreak}-day reading streak ends tonight. Open ChapterFlow and complete one chapter to keep it alive.\n\n— ChapterFlow\n\nManage email preferences: ${UNSUB_URL}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">${params.currentStreak}-Day Streak at Risk</h2><p>Hi ${params.name},</p><p>Your <strong>${params.currentStreak}-day</strong> reading streak ends in <strong>${params.hoursRemaining} hours</strong>.</p><p>Open ChapterFlow and complete one chapter to keep it alive.</p><p><a href="https://chapterflow.siliconx.ca/book/home" style="color:#6366f1">Keep your streak alive</a></p><p style="color:#999;font-size:11px;margin-top:24px">— ChapterFlow · <a href="${UNSUB_URL}" style="color:#999">Manage email preferences</a></p></div>`,
  };
}
