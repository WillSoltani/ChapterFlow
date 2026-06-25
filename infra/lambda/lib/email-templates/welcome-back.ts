// Returns the core email body only. The compliant footer (sender identity,
// postal address, one-click unsubscribe) is appended by sendCompliantEmail.
import { escapeHtml } from "../email-compliance";

export function welcomeBackEmail(params: {
  name: string;
  daysSinceActive: number;
  appBaseUrl: string;
}) {
  const cta = `${params.appBaseUrl}/dashboard`;
  // displayName is user-controlled — escape before interpolating into HTML.
  const name = escapeHtml(params.name);
  return {
    subject: `We saved your spot, ${params.name}`,
    textBody: `Hi ${params.name},\n\nIt's been ${params.daysSinceActive} days since your last reading session. Your progress is right where you left it.\n\nJump back in and earn 30 Insight Points just for returning.\n\nPick up where you left off: ${cta}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Welcome Back, ${name}</h2><p>It's been ${params.daysSinceActive} days since your last reading session. Your progress is right where you left it.</p><p>Jump back in and earn <strong>30 Insight Points</strong> just for returning.</p><p><a href="${cta}" style="color:#6366f1">Pick up where you left off</a></p></div>`,
  };
}
