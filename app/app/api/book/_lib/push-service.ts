import "server-only";

import http2 from "node:http2";
import webpush from "web-push";
import { importPKCS8, SignJWT } from "jose";
import { getServerEnv } from "@/app/app/api/_lib/server-env";
import { isAllowedPushEndpoint } from "@/app/app/api/book/_lib/push-endpoint-allowlist";
import {
  apnsJwtClaims,
  apnsRequestHeaders,
  buildApnsPayload,
  buildWebPushPayload,
  routeSpecFor,
  type PushMessage,
} from "@/app/app/api/book/_lib/push-payload-core";

let configured = false;

async function ensureConfigured() {
  if (configured) return;
  const publicKey = await getServerEnv("VAPID_PUBLIC_KEY");
  const privateKey = await getServerEnv("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");
  }
  webpush.setVapidDetails("mailto:info@chapterflow.ca", publicKey, privateKey);
  configured = true;
}

export type PushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushResult = { sent: boolean; expired?: boolean; error?: string };

/**
 * Send a Web-Push notification to a browser subscription. Serializes the
 * documented web-push payload (`{ title, body, url, type, route }`, see
 * push-payload-core) that `public/sw.js` consumes.
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  message: PushMessage,
): Promise<PushResult> {
  // SSRF guard: web-push POSTs to this endpoint server-side, and it originates
  // from client-supplied device registration. Refuse anything that isn't a known
  // browser push service over HTTPS so a crafted endpoint can't make us hit
  // internal hosts / cloud metadata.
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    console.warn("[push-service] refusing send to non-allowlisted endpoint");
    return { sent: false, error: "endpoint_not_allowed" };
  }
  try {
    await ensureConfigured();
    const payload = buildWebPushPayload(message);
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      JSON.stringify(payload),
      // Coalesce supersedable pushes (reminders, streak-at-risk) via the Web-Push
      // `Topic` header — the web equivalent of APNs apns-collapse-id.
      collapseIdFor(message),
    );
    return { sent: true };
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 410 || statusCode === 404) {
      return { sent: false, expired: true };
    }
    console.error("[push-service] send failed:", String(error));
    return { sent: false, error: String(error) };
  }
}

function collapseIdFor(message: PushMessage): { topic?: string } | undefined {
  const collapseId = routeSpecFor(message.type, message.metadata).collapseId;
  // Web-Push Topic must be a short URL-safe token; our collapse ids already are.
  return collapseId ? { topic: collapseId } : undefined;
}

// ── APNs (iOS) ────────────────────────────────────────────────────────────────
//
// Token-based (`.p8`) auth: a short-lived ES256 provider JWT (iss=team, kid=key
// id) is sent as `authorization: bearer <jwt>` on an HTTP/2 POST to
// `/3/device/<token>`. Apple rejects tokens older than 1h and rate-limits
// re-issuing them faster than ~20m, so we cache one JWT and refresh at ~50m.
//
// Config (SSM/env — see docs/ENVIRONMENT.md):
//   APNS_KEY_ID   — the .p8 key's Key ID (10 chars)
//   APNS_TEAM_ID  — Apple Developer Team ID (10 chars)
//   APNS_AUTH_KEY — the .p8 private key PEM (PKCS#8). `\n` escapes are allowed.
//   APNS_BUNDLE_ID— the app bundle id → apns-topic
//   APNS_HOST     — optional override; defaults to api.push.apple.com (prod).
//                   Set to api.sandbox.push.apple.com for debug builds.

const APNS_DEFAULT_HOST = "api.push.apple.com";
const APNS_JWT_REFRESH_SECONDS = 50 * 60;

type ApnsConfig = {
  keyId: string;
  teamId: string;
  authKey: string;
  bundleId: string;
  host: string;
};

let cachedApnsJwt: { token: string; iat: number } | null = null;

async function loadApnsConfig(): Promise<ApnsConfig | null> {
  const [keyId, teamId, authKey, bundleId, host] = await Promise.all([
    getServerEnv("APNS_KEY_ID"),
    getServerEnv("APNS_TEAM_ID"),
    getServerEnv("APNS_AUTH_KEY"),
    getServerEnv("APNS_BUNDLE_ID"),
    getServerEnv("APNS_HOST"),
  ]);
  if (!keyId || !teamId || !authKey || !bundleId) return null;
  return { keyId, teamId, authKey, bundleId, host: host || APNS_DEFAULT_HOST };
}

/** Normalize a PEM whose newlines were escaped as literal `\n` in SSM/env. */
function normalizePem(pem: string): string {
  return pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
}

async function getApnsProviderToken(cfg: ApnsConfig, nowSeconds: number): Promise<string> {
  if (cachedApnsJwt && nowSeconds - cachedApnsJwt.iat < APNS_JWT_REFRESH_SECONDS) {
    return cachedApnsJwt.token;
  }
  const claims = apnsJwtClaims({ keyId: cfg.keyId, teamId: cfg.teamId, iatSeconds: nowSeconds });
  const key = await importPKCS8(normalizePem(cfg.authKey), "ES256");
  const token = await new SignJWT({})
    .setProtectedHeader(claims.header)
    .setIssuer(claims.payload.iss)
    .setIssuedAt(claims.payload.iat)
    .sign(key);
  cachedApnsJwt = { token, iat: claims.payload.iat };
  return token;
}

/** Map an APNs HTTP response to our unified PushResult. */
function classifyApnsResponse(status: number, bodyText: string): PushResult {
  if (status === 200) return { sent: true };
  // 410 Unregistered, or 400 BadDeviceToken/DeviceTokenNotForTopic ⇒ prune it.
  let reason = "";
  try {
    reason = String((JSON.parse(bodyText) as { reason?: string })?.reason ?? "");
  } catch {
    /* non-JSON body */
  }
  const expired =
    status === 410 ||
    reason === "Unregistered" ||
    reason === "BadDeviceToken" ||
    reason === "DeviceTokenNotForTopic";
  if (expired) return { sent: false, expired: true };
  return { sent: false, error: reason || `apns_status_${status}` };
}

function apnsPost(
  host: string,
  path: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const session = http2.connect(`https://${host}`);
    const settle = (fn: () => void) => {
      try {
        session.close();
      } catch {
        /* already closing */
      }
      fn();
    };
    session.on("error", (err) => settle(() => reject(err)));

    const req = session.request({ ":method": "POST", ":path": path, ...headers });
    let status = 0;
    let data = "";
    req.setEncoding("utf8");
    req.on("response", (h) => {
      status = Number(h[":status"] ?? 0);
    });
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => settle(() => resolve({ status, body: data })));
    req.on("error", (err) => settle(() => reject(err)));
    req.write(body);
    req.end();
  });
}

/**
 * Send an APNs (iOS) notification for a device token. Emits the documented
 * `aps` + `{ type, route, data }` payload (see docs/ios/PUSH-CONTRACT.md and
 * push-payload-core). Returns `{ sent:false, expired:true }` for a dead token so
 * the caller can prune it, and `{ sent:false, error:"apns_not_configured" }`
 * (best-effort no-op) when the APNS_* env is unset.
 */
export async function sendApnsNotification(
  apnsToken: string,
  message: PushMessage,
): Promise<PushResult> {
  const cfg = await loadApnsConfig();
  if (!cfg) {
    // TODO(B2): APNs credentials not configured in this environment. Registration
    // still works end-to-end; wiring the APNS_* SSM params (docs/ENVIRONMENT.md)
    // switches real delivery on with no code change.
    console.warn("[push-service] APNs not configured; skipping iOS push");
    return { sent: false, error: "apns_not_configured" };
  }
  try {
    const spec = routeSpecFor(message.type, message.metadata);
    const payload = buildApnsPayload(message);
    const headers = apnsRequestHeaders({ bundleId: cfg.bundleId, spec });
    const jwt = await getApnsProviderToken(cfg, Math.floor(Date.now() / 1000));
    headers["authorization"] = `bearer ${jwt}`;
    const res = await apnsPost(cfg.host, `/3/device/${apnsToken}`, headers, JSON.stringify(payload));
    return classifyApnsResponse(res.status, res.body);
  } catch (error: unknown) {
    console.error("[push-service] APNs send failed:", String(error));
    return { sent: false, error: String(error) };
  }
}

export async function getVapidPublicKey(): Promise<string | undefined> {
  return getServerEnv("VAPID_PUBLIC_KEY");
}
