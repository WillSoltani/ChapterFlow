import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getVapidPublicKey } from "@/app/app/api/book/_lib/push-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireActiveBookUser();
    const key = await getVapidPublicKey();
    return bookOk({ vapidPublicKey: key ?? null });
  });
}
