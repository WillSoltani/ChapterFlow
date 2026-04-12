export function streakReminderEmail(params: { name: string; currentStreak: number }) {
  return {
    subject: `Don't break your ${params.currentStreak}-day streak!`,
    textBody: `Hi ${params.name},\n\nYou're on a ${params.currentStreak}-day reading streak. Open ChapterFlow today to keep it going!\n\n— ChapterFlow`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">${params.currentStreak}-Day Streak</h2><p>Hi ${params.name},</p><p>You're on a <strong>${params.currentStreak}-day</strong> reading streak. Open ChapterFlow today to keep it going!</p><p style="color:#888;font-size:12px">— ChapterFlow</p></div>`,
  };
}
