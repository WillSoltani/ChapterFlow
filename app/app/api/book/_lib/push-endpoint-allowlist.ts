/**
 * Allowlist for Web Push endpoints (SSRF defense). The web-push library POSTs to
 * subscription.endpoint server-side, and that endpoint is supplied by the client
 * at device registration — an arbitrary URL would let a caller make the server
 * issue requests to internal hosts / cloud metadata (169.254.169.254) / etc.
 *
 * Real push endpoints come from a small set of browser push services. We require
 * HTTPS and an exact host or a dot-bounded subdomain of a known push host. Pure
 * (no I/O) so it is unit-testable and reusable at both the send sink and at
 * registration.
 */

const ALLOWED_PUSH_HOST_SUFFIXES = [
  "fcm.googleapis.com", // Chrome / Android (FCM)
  "android.googleapis.com", // legacy GCM
  "push.services.mozilla.com", // Firefox (autopush)
  "push.apple.com", // Safari (web.push.apple.com)
  "notify.windows.com", // Edge / WNS
  "push.microsoft.com", // Edge (newer)
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_PUSH_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}
