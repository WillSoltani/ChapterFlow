import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { bookErr, bookOk, requireBodyObject, requireString, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { bookUserPk, deviceTokenSk, nowIso } from "@/app/app/api/book/_lib/keys";
import { isAllowedPushEndpoint } from "@/app/app/api/book/_lib/push-endpoint-allowlist";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const body = requireBodyObject(await req.json());
    const endpoint = requireString(body.endpoint, "endpoint", { maxLength: 2000 });
    // SSRF/abuse defense: only persist endpoints that point at a known browser
    // push service over HTTPS. This mirrors the send-time guard in push-service.ts
    // so non-allowlisted URLs never enter the device table (and never inflate the
    // per-notification fanout loop).
    if (!isAllowedPushEndpoint(endpoint)) {
      return bookErr(req, 400, "invalid_endpoint", "Push endpoint is not an allowed push service.");
    }
    const keys = body.keys as { p256dh: string; auth: string } | undefined;
    if (!keys?.p256dh || !keys?.auth) {
      return bookOk({ registered: false, reason: "missing_keys" });
    }

    const tableName = await getBookTableName();
    const now = nowIso();

    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: bookUserPk(user.sub),
          SK: deviceTokenSk(endpoint),
          entity: "BOOK_USER_DEVICE_TOKEN",
          userId: user.sub,
          endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
          platform: "web",
          createdAt: now,
          lastSeenAt: now,
        },
      })
    );

    return bookOk({ registered: true });
  });
}
