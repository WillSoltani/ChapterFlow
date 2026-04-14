import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookAdminGroupName } from "@/app/app/api/book/_lib/env";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const adminGroup = await getBookAdminGroupName();
    const isAdmin = (user.groups ?? []).includes(adminGroup);
    return bookOk({ isAdmin });
  });
}
