// WS6-002 origin-verify wrapper for the ISR revalidation function. OpenNext's
// revalidation adapter re-renders a stale page by making a HEAD request to
// `https://${host}${url}` — and `host` is the RAW server Function URL domain
// (CloudFront strips the viewer Host header via ALL_VIEWER_EXCEPT_HOST_HEADER,
// so that is the Host the server saw when it enqueued the message). That HEAD
// therefore bypasses CloudFront and arrives WITHOUT the x-origin-verify header
// the middleware enforces; in enforce mode it would 403, ISR would never
// regenerate, and retries would page ops via RevalidationDlqDepthAlarm.
//
// Fix: inject the shared secret into this function's outbound HTTPS requests.
// The adapter does `import https from "node:https"` and calls `https.request()`
// at call time, so patching the shared core-module object here (before any
// request fires) is seen by the generated code without modifying it. This
// function's only outbound HTTPS is the self-fetch HEAD (SQS events are pushed
// to it; it makes no SDK calls), and an extra unsigned header would be ignored
// by SigV4 anyway. No-ops without ORIGIN_VERIFY_SECRET — envs that have not
// introduced the secret are unaffected.
import https from "node:https";

const SECRET = process.env.ORIGIN_VERIFY_SECRET;

if (SECRET) {
  const originalRequest = https.request.bind(https);
  // node:https request forms: (options[, cb]) or (url[, options][, cb]).
  https.request = function patchedRequest(arg1, arg2, arg3) {
    if (typeof arg1 === "string" || arg1 instanceof URL) {
      if (typeof arg2 === "function" || arg2 === undefined) {
        // (url[, cb]) — inject via a fresh options bag.
        return originalRequest(
          arg1,
          { headers: { "x-origin-verify": SECRET } },
          arg2,
        );
      }
      // (url, options[, cb])
      const options = {
        ...arg2,
        headers: { ...(arg2.headers ?? {}), "x-origin-verify": SECRET },
      };
      return originalRequest(arg1, options, arg3);
    }
    // (options[, cb])
    const options = {
      ...arg1,
      headers: { ...(arg1?.headers ?? {}), "x-origin-verify": SECRET },
    };
    return originalRequest(options, arg2);
  };
}

let cachedInner = null;

// Resolve the real revalidation handler. The generated function dir is copied
// alongside this file into the asset; OpenNext emits index.mjs (ESM), fall back
// to index.js.
async function loadInner() {
  if (cachedInner) return cachedInner;
  let mod;
  try {
    mod = await import("./index.mjs");
  } catch {
    mod = await import("./index.js");
  }
  cachedInner = mod.handler ?? mod.default?.handler ?? mod.default;
  return cachedInner;
}

export async function handler(event, context) {
  const inner = await loadInner();
  return inner(event, context);
}
