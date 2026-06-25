// Returns the core email body only. The compliant footer (sender identity,
// postal address, one-click unsubscribe) is appended by sendCompliantEmail.
import { escapeHtml } from "../email-compliance";

export function commitmentFollowupEmail(params: {
  name: string;
  ifThenPlan: string;
  appBaseUrl: string;
  commitmentId: string;
}) {
  // Deep-link to the exact dashboard check-in (parity with the in-app NotificationBell link).
  const cta = `${params.appBaseUrl}/dashboard?focusCommitment=${encodeURIComponent(params.commitmentId)}`;
  // Keep the plan short in the subject/body so a long if-then doesn't blow up the line.
  const plan =
    params.ifThenPlan.length > 120
      ? `${params.ifThenPlan.slice(0, 117)}...`
      : params.ifThenPlan;
  // Both displayName and the user-authored if-then plan are user-controlled —
  // escape before interpolating into HTML so neither can inject markup.
  const name = escapeHtml(params.name);
  const planHtml = escapeHtml(plan);
  return {
    subject: `How did it go, ${params.name}?`,
    textBody: `Hi ${params.name},\n\nA little while ago you committed to one small action:\n\n"${plan}"\n\nDid you get a chance to try it? Take a moment to reflect on how it went — and earn 25 Insight Points for closing the loop.\n\nReflect now: ${cta}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">How did it go, ${name}?</h2><p>A little while ago you committed to one small action:</p><blockquote style="margin:12px 0;padding:8px 14px;border-left:3px solid #6366f1;color:#444">${planHtml}</blockquote><p>Did you get a chance to try it? Take a moment to reflect on how it went — and earn <strong>25 Insight Points</strong> for closing the loop.</p><p><a href="${cta}" style="color:#6366f1">Reflect now</a></p></div>`,
  };
}
