// Returns the core email body only. The compliant footer (sender identity,
// postal address, one-click unsubscribe) is appended by sendCompliantEmail.
export function readingReminderEmail(params: { name: string; appBaseUrl: string }) {
  const cta = `${params.appBaseUrl}/dashboard`;
  return {
    subject: "Time to read!",
    textBody: `Hi ${params.name},\n\nThis is your daily reading reminder. A few minutes of focused reading can make a real difference.\n\nOpen ChapterFlow: ${cta}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Time to Read</h2><p>Hi ${params.name},</p><p>This is your daily reading reminder. A few minutes of focused reading can make a real difference.</p><p><a href="${cta}" style="color:#6366f1">Open ChapterFlow</a></p></div>`,
  };
}
