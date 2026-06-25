import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { redirectIfOnboarded } from "@/app/_lib/redirect-if-onboarded";
import { OnboardingFlow } from "@/app/onboarding/components/OnboardingFlow";

export default async function BookOnboardingPage() {
  // This route IS the onboarding funnel, so it must opt out of the helper's
  // un-onboarded redirect (which targets "/book") to avoid an infinite loop.
  await requireDashboardAccess({ allowUnonboarded: true });

  // Already-onboarded → /dashboard (no client flash). Shared with app/onboarding/page.tsx
  // so both funnel entry points fail open identically on a non-auth backend hiccup.
  await redirectIfOnboarded();

  return <OnboardingFlow />;
}
