// WS6-002 origin-verify wrapper for the image-optimization Function URL. That URL
// is authType NONE (public); CloudFront injects a shared-secret x-origin-verify
// header (infra/lib/chapterflow-frontend-stack.ts) and this wrapper enforces it
// so a request that hits the raw Function URL directly — bypassing the edge — is
// rejected. Applied unconditionally: with no ORIGIN_VERIFY_SECRET set it no-ops
// and just delegates, so envs that have not introduced the secret are unaffected.
//
// Plain ESM, Node 20, no dependencies. node:crypto is available in the Lambda
// runtime here (unlike the edge-compiled middleware), so the compare uses
// timingSafeEqual over Buffers with an explicit length guard.
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";

// Read once at module load; a warm container reuses these across invocations.
const SECRET_BUF = process.env.ORIGIN_VERIFY_SECRET
  ? Buffer.from(process.env.ORIGIN_VERIFY_SECRET)
  : null;
const MODE = process.env.ORIGIN_VERIFY_MODE;

let warned = false;
let cachedInner = null;

// Resolve the real image-optimization handler. The generated function dir is
// copied alongside this file into the asset, so the relative import lands inside
// the bundle. OpenNext emits the entry as index.mjs (ESM); fall back to index.js.
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

// Function URL v2 events lowercase header keys.
function headerMatches(event) {
  const provided = event?.headers?.["x-origin-verify"];
  if (typeof provided !== "string") return false;
  const providedBuf = Buffer.from(provided);
  if (providedBuf.length !== SECRET_BUF.length) return false;
  return timingSafeEqual(providedBuf, SECRET_BUF);
}

export async function handler(event, context) {
  if (SECRET_BUF && !headerMatches(event)) {
    if (MODE === "log") {
      if (!warned) {
        warned = true;
        console.warn(
          "origin_verify_mismatch: x-origin-verify absent or wrong (log mode) — delegating",
        );
      }
    } else {
      return {
        statusCode: 403,
        headers: { "content-type": "text/plain" },
        body: "Forbidden",
      };
    }
  }
  const inner = await loadInner();
  return inner(event, context);
}
