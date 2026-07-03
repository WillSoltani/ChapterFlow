/**
 * Device-registration body parsing (B2) — pure, no I/O, no `server-only`.
 *
 * `POST /me/devices/register` accepts TWO device shapes and this module owns the
 * discrimination + validation so the route stays a thin DynamoDB wrapper and the
 * rules are unit-testable without the `server-only` seam:
 *
 *   • Web-Push  — `{ platform?: "web", endpoint, keys:{p256dh,auth} }`. `platform`
 *     is optional for back-compat with existing browser clients that predate the
 *     field (absent ⇒ "web").
 *   • iOS/APNs  — `{ platform: "ios", apnsToken }` where `apnsToken` is the hex
 *     device token from the native app. Web-push `endpoint`/`keys` are ignored.
 *
 * The SSRF allowlist for web endpoints (`isAllowedPushEndpoint`) stays in the
 * route — it is a `server-only` policy module. This core validates SHAPE and
 * returns the stable `identifier` (endpoint for web, apnsToken for ios) the route
 * hashes into the device SK (`deviceTokenSk`), so both platforms key the same way
 * and unregister can delete by the same identifier.
 */

export const MAX_ENDPOINT_LENGTH = 2000;

/**
 * APNs device tokens are hex. Classic tokens are 64 hex chars (32 bytes); Apple
 * has signalled they may grow, so we accept 64–200 hex chars (even length). We
 * DON'T hard-pin 64 so a longer future token still registers.
 */
const APNS_TOKEN_RE = /^[0-9a-f]{64,200}$/;

/**
 * Normalize a client-supplied APNs token: strip the angle brackets / spaces the
 * legacy `description` format wraps a token in (`<abcd 1234 …>`) and lowercase
 * the hex so the SK is stable regardless of how the client formatted it.
 */
export function normalizeApnsToken(raw: string): string {
  return raw.replace(/[<>\s]/g, "").toLowerCase();
}

/** True when `raw` normalizes to a plausible APNs hex device token. */
export function isValidApnsToken(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const n = normalizeApnsToken(raw);
  return n.length % 2 === 0 && APNS_TOKEN_RE.test(n);
}

export type ParsedDeviceRegistration =
  | {
      ok: true;
      platform: "web";
      endpoint: string;
      keys: { p256dh: string; auth: string };
      /** Stable identifier hashed into the device SK. */
      identifier: string;
    }
  | {
      ok: true;
      platform: "ios";
      apnsToken: string;
      identifier: string;
    }
  | {
      ok: false;
      /** 400-worthy hard rejection (bad platform / malformed token / no endpoint). */
      reason: "invalid_platform" | "missing_endpoint" | "invalid_apns_token";
    }
  | {
      ok: false;
      /**
       * Soft rejection: a web subscription without encryption keys. The route
       * historically replied 200 `{ registered:false, reason:"missing_keys" }`
       * rather than a 400, so callers can distinguish "not persisted" from an
       * error. Kept as a distinct outcome to preserve that behavior.
       */
      soft: true;
      reason: "missing_keys";
    };

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

/**
 * Parse + validate a register request body. Pure: the route applies the DynamoDB
 * write from the returned shape.
 */
export function parseDeviceRegistration(body: Record<string, unknown>): ParsedDeviceRegistration {
  const rawPlatform = body.platform;
  // Absent platform ⇒ legacy web client.
  const platform = rawPlatform === undefined ? "web" : rawPlatform;

  if (platform !== "web" && platform !== "ios") {
    return { ok: false, reason: "invalid_platform" };
  }

  if (platform === "ios") {
    const apnsToken = body.apnsToken;
    if (!isValidApnsToken(apnsToken)) {
      return { ok: false, reason: "invalid_apns_token" };
    }
    const normalized = normalizeApnsToken(apnsToken as string);
    return { ok: true, platform: "ios", apnsToken: normalized, identifier: normalized };
  }

  // Web-Push.
  const endpoint = asString(body.endpoint);
  if (!endpoint || endpoint.length > MAX_ENDPOINT_LENGTH) {
    return { ok: false, reason: "missing_endpoint" };
  }
  const keys = body.keys as { p256dh?: unknown; auth?: unknown } | undefined;
  const p256dh = asString(keys?.p256dh);
  const auth = asString(keys?.auth);
  if (!p256dh || !auth) {
    return { ok: false, soft: true, reason: "missing_keys" };
  }
  return {
    ok: true,
    platform: "web",
    endpoint,
    keys: { p256dh, auth },
    identifier: endpoint,
  };
}

/**
 * Parse an UNREGISTER request body. Accepts either a web `endpoint` or an iOS
 * `apnsToken` (or an explicit `platform`), returning the identifier the route
 * hashes into the device SK to delete. Returns null when neither is present.
 */
export function parseDeviceUnregistration(body: Record<string, unknown>): { identifier: string } | null {
  // iOS: an apnsToken (validated + normalized so it matches the SK the register
  // route wrote).
  if (body.platform === "ios" || body.apnsToken !== undefined) {
    if (isValidApnsToken(body.apnsToken)) {
      return { identifier: normalizeApnsToken(body.apnsToken as string) };
    }
    // Fall through to endpoint in case a client sent platform:"ios" but really
    // means a web endpoint (defensive); otherwise reject below.
  }
  const endpoint = asString(body.endpoint);
  if (endpoint && endpoint.length <= MAX_ENDPOINT_LENGTH) {
    return { identifier: endpoint };
  }
  return null;
}
