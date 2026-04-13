const UNSUB_URL = "https://chapterflow.siliconx.ca/book/settings#notifications";

export function welcomeBackEmail(params: {
  name: string;
  daysSinceActive: number;
}) {
  return {
    subject: `We saved your spot, ${params.name}`,
    textBody: `Hi ${params.name},\n\nIt's been ${params.daysSinceActive} days since your last reading session. Your progress is right where you left it.\n\nJump back in and earn 30 Insight Points just for returning.\n\n— ChapterFlow\n\nManage email preferences: ${UNSUB_URL}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Welcome Back, ${params.name}</h2><p>It's been ${params.daysSinceActive} days since your last reading session. Your progress is right where you left it.</p><p>Jump back in and earn <strong>30 Insight Points</strong> just for returning.</p><p><a href="https://chapterflow.siliconx.ca/book/home" style="color:#6366f1">Pick up where you left off</a></p><p style="color:#999;font-size:11px;margin-top:24px">— ChapterFlow · <a href="${UNSUB_URL}" style="color:#999">Manage email preferences</a></p></div>`,
  };
}
