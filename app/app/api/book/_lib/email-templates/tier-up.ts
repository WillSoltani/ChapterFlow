export function tierUpEmail(params: { name: string; tierName: string; ip: number }) {
  return {
    subject: `Tier Advancement: ${params.tierName}`,
    textBody: `Hi ${params.name},\n\nYou've advanced to ${params.tierName}! +${params.ip} Insight Points.\n\n— ChapterFlow`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Tier Up!</h2><p>Hi ${params.name},</p><p>You've advanced to <strong>${params.tierName}</strong>! +${params.ip} Insight Points.</p><p style="color:#888;font-size:12px">— ChapterFlow</p></div>`,
  };
}
