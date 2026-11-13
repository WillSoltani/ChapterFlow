/**
 * The one rule for client-side onboarding redirects (SHELL-02 / PROG-06 /
 * DATA-03). Every in-app page is already gated on the server by
 * requireDashboardAccess, so the client redirect is only a backstop: it fires
 * only when the server has positively answered "not onboarded". The local
 * default (`setupComplete: false` on a fresh browser), a pending status check
 * and a failed one never redirect, so an onboarded reader on a new device is
 * never bounced off the page they opened.
 */
export type OnboardingServerAnswer =
  | { onboardingCompleted?: unknown }
  | null
  | undefined;

export function shouldRedirectToOnboarding(input: {
  hydrated: boolean;
  setupComplete: boolean;
  serverAnswer: OnboardingServerAnswer;
  skip?: boolean;
}): boolean {
  if (input.skip || !input.hydrated || input.setupComplete) return false;
  return input.serverAnswer?.onboardingCompleted === false;
}
