const UNSUB_URL = "https://chapterflow.siliconx.ca/book/settings#notifications";

export function weeklyDigestEmail(params: {
  name: string;
  chaptersCompleted: number;
  currentStreak: number;
  ipBalance: number;
}) {
  const encouragement = params.chaptersCompleted > 0
    ? "Great progress this week! Keep the momentum going."
    : "Take 15 minutes today to get back on track.";

  return {
    subject: `Your ChapterFlow Week: ${params.chaptersCompleted} chapters completed`,
    textBody: `Hi ${params.name},\n\nYour ChapterFlow week: ${params.chaptersCompleted} chapters, ${params.currentStreak}-day streak, ${params.ipBalance} IP. ${encouragement}\n\n— ChapterFlow\n\nManage email preferences: ${UNSUB_URL}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Your Week in Review</h2><p>Hi ${params.name},</p><ul><li><strong>${params.chaptersCompleted}</strong> chapters completed</li><li><strong>${params.currentStreak}</strong>-day streak</li><li><strong>${params.ipBalance}</strong> Insight Points</li></ul><p>${encouragement}</p><p><a href="https://chapterflow.siliconx.ca/book/home" style="color:#6366f1">Open ChapterFlow</a></p><p style="color:#999;font-size:11px;margin-top:24px">— ChapterFlow · <a href="${UNSUB_URL}" style="color:#999">Manage email preferences</a></p></div>`,
  };
}
