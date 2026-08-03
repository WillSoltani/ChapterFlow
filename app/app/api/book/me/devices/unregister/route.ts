import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { parseDeviceUnregistration } from "@/app/app/api/book/_lib/device-register-core";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { bookErr, bookOk, requireBodyObject, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { deleteDeviceTokenByIdentifier } from "@/app/app/api/book/_lib/device-token-repo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const body = requireBodyObject(await req.json());

    // Remove by identifier: a web `endpoint` or an iOS `apnsToken`. Both hash to
    // the same device SK the register route wrote (see device-register-core.ts).
    const parsed = parseDeviceUnregistration(body);
    if (!parsed) {
      return bookErr(req, 400, "invalid_input", "Provide an endpoint (web) or apnsToken (ios).");
    }

    const tableName = await getBookTableName();

    await deleteDeviceTokenByIdentifier(tableName, user.sub, parsed.identifier);

    return bookOk({ unregistered: true });
  });
}
