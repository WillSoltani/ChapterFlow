const UNSUB_URL = "https://chapterflow.siliconx.ca/book/settings#notifications";

export function readingReminderEmail(params: { name: string }) {
  return {
    subject: "Time to read!",
    textBody: `Hi ${params.name},\n\nThis is your daily reading reminder. A few minutes of focused reading can make a real difference.\n\n— ChapterFlow\n\nManage email preferences: ${UNSUB_URL}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Time to Read</h2><p>Hi ${params.name},</p><p>This is your daily reading reminder. A few minutes of focused reading can make a real difference.</p><p style="color:#999;font-size:11px;margin-top:24px">— ChapterFlow · <a href="${UNSUB_URL}" style="color:#999">Manage email preferences</a></p></div>`,
  };
}
