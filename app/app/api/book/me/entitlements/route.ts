import "server-only";
import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import {
  getBookFreeSlotsDefault,
  getBookPaywallPriceDisplay,
  getBookStripePriceIdAnnual,
  getBookStripePriceIdAnnualUpfront,
  getBookTableName,
} from "@/app/app/api/book/_lib/env";
import { getUserEntitlement } from "@/app/app/api/book/_lib/repo";
import { PRICING_TIER_DISPLAY, type PricingTierDisplay } from "@/lib/pricing";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const [entitlement, annualPriceId, annualUpfrontPriceId, defaultSlots, price] = await Promise.all([
      getBookTableName().then((tableName) => getUserEntitlement(tableName, user.sub)),
      getBookStripePriceIdAnnual(),
      getBookStripePriceIdAnnualUpfront(),
      getBookFreeSlotsDefault(),
      getBookPaywallPriceDisplay(),
    ]);
    const freeBookSlots = entitlement?.freeBookSlots ?? defaultSlots;
    const unlockedBookIds = entitlement?.unlockedBookIds ?? [];

    // Display strings come from the central pricing config; this route only
    // decides which tiers to expose based on which Stripe Price IDs exist.
    const pricingTiers: PricingTierDisplay[] = [PRICING_TIER_DISPLAY.monthly];
    if (annualPriceId) {
      pricingTiers.push(PRICING_TIER_DISPLAY.annual);
    }
    if (annualUpfrontPriceId) {
      pricingTiers.push(PRICING_TIER_DISPLAY.annual_upfront);
    }

    return bookOk({
      entitlement: {
        plan: entitlement?.plan ?? "FREE",
        proStatus: entitlement?.proStatus ?? "inactive",
        proSource: entitlement?.proSource,
        freeBookSlots,
        unlockedBookIds,
        unlockedBooksCount: unlockedBookIds.length,
        remainingFreeStarts: Math.max(0, freeBookSlots - unlockedBookIds.length),
        currentPeriodEnd: entitlement?.currentPeriodEnd,
        cancelAtPeriodEnd: entitlement?.cancelAtPeriodEnd ?? false,
        licenseKey: entitlement?.licenseKey,
        licenseExpiresAt: entitlement?.licenseExpiresAt,
      },
      paywall: {
        price,
        pricingTiers,
        benefits: [
          "Unlock unlimited books",
          "Continue progress across devices",
          "Get advanced learning modes as they ship",
        ],
      },
    });
  });
}
