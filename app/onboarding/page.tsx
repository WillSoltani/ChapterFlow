import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { redirectIfOnboarded } from "@/app/_lib/redirect-if-onboarded";
import { OnboardingFlow } from "./components/OnboardingFlow";

export default async function OnboardingPage() {
  // This route renders the onboarding flow, so it must opt out of the helper's
  // un-onboarded redirect (which targets "/book") — otherwise an un-onboarded
  // user here would be bounced away from onboarding.
  await requireDashboardAccess({ allowUnonboarded: true });

  // Already-onboarded → /dashboard (no client flash). Shared with app/book/page.tsx
  // so both funnel entry points fail open identically on a non-auth backend hiccup.
  await redirectIfOnboarded();

  return <OnboardingFlow />;
}
