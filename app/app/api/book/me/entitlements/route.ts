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

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const defaultSlots = await getBookFreeSlotsDefault();
    const price = await getBookPaywallPriceDisplay();
    const [entitlement, annualPriceId, annualUpfrontPriceId] = await Promise.all([
      getUserEntitlement(tableName, user.sub),
      getBookStripePriceIdAnnual(),
      getBookStripePriceIdAnnualUpfront(),
    ]);
    const freeBookSlots = entitlement?.freeBookSlots ?? defaultSlots;
    const unlockedBookIds = entitlement?.unlockedBookIds ?? [];

    const pricingTiers: {
      interval: "monthly" | "annual" | "annual_upfront";
      price: string;
      label: string;
      annualTotal?: string;
      period: string;
    }[] = [
      { interval: "monthly", price: "$7.99", label: "$7.99 CAD/month", period: "month" },
    ];
    if (annualPriceId) {
      pricingTiers.push({
        interval: "annual",
        price: "$5.99",
        label: "$5.99 CAD/month, billed annually",
        annualTotal: "$71.88",
        period: "year",
      });
    }
    if (annualUpfrontPriceId) {
      pricingTiers.push({
        interval: "annual_upfront",
        price: "$59.99",
        label: "$59.99 CAD/year",
        period: "year",
      });
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
