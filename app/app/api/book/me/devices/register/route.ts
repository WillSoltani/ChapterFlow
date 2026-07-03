import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { selectDevicesToEvict, type DeviceRowRef } from "@/app/app/api/book/_lib/device-cap-core";
import { parseDeviceRegistration } from "@/app/app/api/book/_lib/device-register-core";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { bookErr, bookOk, requireBodyObject, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { bookUserPk, deviceTokenSk, nowIso } from "@/app/app/api/book/_lib/keys";
import { isAllowedPushEndpoint } from "@/app/app/api/book/_lib/push-endpoint-allowlist";
import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const body = requireBodyObject(await req.json());

    // Discriminate web-push vs iOS/APNs and validate the matching shape. Pure —
    // see device-register-core.ts. `identifier` is the endpoint (web) or the
    // apnsToken (ios); it is hashed into the device SK so both platforms key the
    // same way and unregister can delete by the same value.
    const parsed = parseDeviceRegistration(body);
    if (!parsed.ok) {
      // A web subscription missing its encryption keys stays a soft 200 (the old
      // behavior) so browser clients can distinguish "not persisted" from an error.
      if ("soft" in parsed) {
        return bookOk({ registered: false, reason: parsed.reason });
      }
      const message =
        parsed.reason === "invalid_apns_token"
          ? "apnsToken must be a hex APNs device token."
          : parsed.reason === "invalid_platform"
            ? "platform must be \"web\" or \"ios\"."
            : "endpoint is required.";
      return bookErr(req, 400, parsed.reason, message);
    }

    // SSRF/abuse defense (web only): only persist endpoints that point at a known
    // browser push service over HTTPS. This mirrors the send-time guard in
    // push-service.ts so non-allowlisted URLs never enter the device table (and
    // never inflate the per-notification fanout loop). iOS tokens never touch a
    // URL, so the allowlist does not apply to them.
    if (parsed.platform === "web" && !isAllowedPushEndpoint(parsed.endpoint)) {
      return bookErr(req, 400, "invalid_endpoint", "Push endpoint is not an allowed push service.");
    }

    const tableName = await getBookTableName();
    const now = nowIso();
    const pk = bookUserPk(user.sub);
    const sk = deviceTokenSk(parsed.identifier);

    const item =
      parsed.platform === "ios"
        ? {
            PK: pk,
            SK: sk,
            entity: "BOOK_USER_DEVICE_TOKEN",
            userId: user.sub,
            apnsToken: parsed.apnsToken,
            platform: "ios",
            createdAt: now,
            lastSeenAt: now,
          }
        : {
            PK: pk,
            SK: sk,
            entity: "BOOK_USER_DEVICE_TOKEN",
            userId: user.sub,
            endpoint: parsed.endpoint,
            keys: { p256dh: parsed.keys.p256dh, auth: parsed.keys.auth },
            platform: "web",
            createdAt: now,
            lastSeenAt: now,
          };

    await ddbDoc.send(new PutCommand({ TableName: tableName, Item: item }));

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
