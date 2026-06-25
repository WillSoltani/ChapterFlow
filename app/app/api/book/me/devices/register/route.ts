import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { selectDevicesToEvict, type DeviceRowRef } from "@/app/app/api/book/_lib/device-cap-core";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { bookErr, bookOk, requireBodyObject, requireString, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { bookUserPk, deviceTokenSk, nowIso } from "@/app/app/api/book/_lib/keys";
import { isAllowedPushEndpoint } from "@/app/app/api/book/_lib/push-endpoint-allowlist";
import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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
    const pk = bookUserPk(user.sub);
    const sk = deviceTokenSk(endpoint);

    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: pk,
          SK: sk,
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

    // Cap registered devices per user (E4): without a bound, distinct push
    // endpoints accumulate one DEVICE# row each (the SK is a hash of the
    // endpoint) and `createNotification`'s push branch fans out over every one.
    // Read the current device rows and evict the oldest beyond the cap so both
    // the partition and the push fan-out stay bounded. Best-effort: a failure to
    // prune must not fail the registration the client already depends on, and
    // the send-time `MAX_PUSH_FANOUT` cap bounds the loop regardless.
    try {
      const existing = await ddbDoc.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
          ExpressionAttributeValues: { ":pk": pk, ":prefix": "DEVICE#" },
          ProjectionExpression: "SK, lastSeenAt",
        })
      );
      const rows = (existing.Items ?? []) as DeviceRowRef[];
      const evictions = selectDevicesToEvict(rows, sk);
      for (const { SK } of evictions) {
        await ddbDoc.send(
          new DeleteCommand({ TableName: tableName, Key: { PK: pk, SK } })
        );
      }
    } catch (e) {
      console.error("[devices/register] device-cap pruning failed:", e);
    }

    return bookOk({ registered: true });
  });
}
