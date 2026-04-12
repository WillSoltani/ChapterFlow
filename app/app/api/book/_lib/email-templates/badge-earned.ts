export function badgeEarnedEmail(params: { name: string; badgeName: string; ip: number }) {
  return {
    subject: `Achievement Unlocked: ${params.badgeName}`,
    textBody: `Hi ${params.name},\n\nYou just earned the "${params.badgeName}" achievement! +${params.ip} Insight Points.\n\nKeep reading to unlock more.\n\n— ChapterFlow`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Achievement Unlocked</h2><p>Hi ${params.name},</p><p>You just earned <strong>${params.badgeName}</strong>! +${params.ip} Insight Points.</p><p>Keep reading to unlock more.</p><p style="color:#888;font-size:12px">— ChapterFlow</p></div>`,
  };
}
