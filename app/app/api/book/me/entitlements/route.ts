import "server-only";
import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookFreeSlotsDefault, getBookPaywallPriceDisplay, getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserEntitlement } from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const defaultSlots = await getBookFreeSlotsDefault();
    const price = await getBookPaywallPriceDisplay();
    const entitlement = await getUserEntitlement(tableName, user.sub);
    const freeBookSlots = entitlement?.freeBookSlots ?? defaultSlots;
    const unlockedBookIds = entitlement?.unlockedBookIds ?? [];
    return bookOk({
      entitlement: {
        plan: entitlement?.plan ?? "FREE",
        proStatus: entitlement?.proStatus ?? "inactive",
        freeBookSlots,
        unlockedBookIds,
        unlockedBooksCount: unlockedBookIds.length,
        remainingFreeStarts: Math.max(0, freeBookSlots - unlockedBookIds.length),
      },
      paywall: {
        price,
        benefits: [
          "Unlock unlimited books",
          "Continue progress across devices",
          "Get advanced learning modes as they ship",
        ],
      },
    });
  });
}
