import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import {
  persistBookRequestRecord,
  reserveBookRequestRateLimitSlot,
  type BookRequestRecord,
} from "./_lib/book-request-repo";
import { logger } from "@/lib/logging/logger";
import { jsonErrorResponse } from "@/lib/api/error-envelope";

/**
 * Public book-request intake endpoint.
 *
 * Lives at top-level `/api/book-requests` (NOT under `/app`, `/book`, or
 * `/dashboard`) on purpose — it must be reachable by logged-out visitors, and
 * middleware.ts only guards those protected prefixes. See app/api/health for
 * the same pattern.
 *
 * A POST persists the request so the team can see what readers want next:
 *   • In production (BOOK_TABLE_NAME set) it writes to the operational
 *     DynamoDB table under a BOOKREQUEST# partition.
 *   • In local dev (no table configured) it appends to a JSONL file under the
 *     OS temp dir so requests are never silently dropped and the pipeline is
 *     demonstrably end-to-end (see GET below to read them back).
 * Persistence failures return 500 so the UI can show an honest error — we
 * never tell a reader we saved their request when we didn't.
 *
 * An optional best-effort SES notification (when BOOK_REQUESTS_TO_EMAIL +
 * sender are configured) forwards the request to the team; it never blocks or
 * fails the submission.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = { title: 200, author: 160, email: 254, note: 1000 } as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanString(value: unknown, max: number): string {
  // Collapse embedded newlines/tabs to spaces so values stay single-line when
  // used in the SES notification subject/body (defense-in-depth; the SES
  // structured API already prevents header injection).
  return typeof value === "string"
    ? value.replace(/[\r\n\t]+/g, " ").trim().slice(0, max)
    : "";
}

function jsonError(req: Request, status: number, code: string, message: string) {
  return jsonErrorResponse(req, status, code, message);
}

// --- Abuse controls --------------------------------------------------------
//
// This endpoint is intentionally public (logged-out readers must be able to
// request a book), so it cannot lean on the per-user DynamoDB rate markers the
// authenticated /app/api/book/* routes use. Instead it self-limits with the
// same atomic conditional-increment counter pattern as the AI rate limiter
// (app/app/api/book/books/[bookId]/ask/route.ts), keyed on a fixed time window
// plus either the caller's IP (per-source cap) or a global bucket (SES cap).

const RATE_WINDOW_SECONDS = 60 * 60; // fixed 1-hour window
const MAX_REQUESTS_PER_IP = 10; // submissions per source IP, per window
const MAX_TEAM_EMAILS = 60; // total SES notifications, per window (all IPs)

// Local-dev fallback only (no BOOK_TABLE_NAME). A single dev process is fine;
// production always has the table, so the weak cross-instance semantics here
// never apply in prod.
const memoryCounters = new Map<string, { count: number; resetAt: number }>();

function memoryReserve(key: string, max: number): boolean {
  const now = Date.now();
  const slot = memoryCounters.get(key);
  if (!slot || now >= slot.resetAt) {
    memoryCounters.set(key, {
      count: 1,
      resetAt: now + RATE_WINDOW_SECONDS * 1000,
    });
    return true;
  }
  if (slot.count >= max) return false;
  slot.count += 1;
  return true;
}

// Trusted proxy hops (CloudFront, plus any edge layer) in front of this app.
// The real client IP is the X-Forwarded-For entry this many positions from the
// RIGHT — the one our own edge appended. The leftmost entries are supplied by
// the client and MUST NOT be trusted for throttling: an attacker could rotate a
// fake leftmost token to mint a fresh limiter bucket per request. Override via
// env if the deployment adds/removes a hop (too low → clients collapse into one
// bucket and over-throttle; too high → re-introduces the spoofable left side).
const TRUSTED_PROXY_HOPS = Number(process.env.RATE_LIMIT_TRUSTED_PROXY_HOPS) || 1;

function readClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (chain.length > 0) {
      // Trust the Nth entry from the right (appended by our edge), never the
      // leftmost client-controlled token.
      const idx = Math.max(0, chain.length - TRUSTED_PROXY_HOPS);
      return chain[idx] ?? chain[chain.length - 1];
    }
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const viewer = req.headers.get("cloudfront-viewer-address")?.trim();
  if (viewer) {
    const host = viewer.split(":")[0]?.trim();
    if (host) return host;
  }
  return null;
}

function hashIp(ip: string): string {
  // Hash so the limiter partition key never stores a raw IP.
  return createHash("sha256").update(`book-request:${ip}`).digest("base64url");
}

// A conditional-write rejection can surface with the marker on either `name`
// (SDK class) or `__type` (wire field); match both, mirroring the repo-wide
// isConditionalCheckFailed helpers (e.g. _lib/repo.ts).
function isConditionalCheckFailed(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const rec = err as Record<string, unknown>;
  return (
    rec.name === "ConditionalCheckFailedException" ||
    rec.__type === "ConditionalCheckFailedException"
  );
}

/**
 * Atomically reserve one slot in the current window for (scope, key). Returns
 * true when the request is allowed, false when the window's cap is exhausted.
 *
 * A single conditional UpdateCommand (mirroring the authenticated AI rate
 * limiter) serializes concurrent requests even across Lambda instances; the
 * per-window item self-expires via the table's `ttl` attribute.
 */
async function reserveSlot(
  scope: string,
  key: string,
  max: number,
  // Direction on an UNEXPECTED limiter failure (not a cap rejection). The per-IP
  // throttle fails OPEN — it is a guard, not the source of truth, so a limiter
  // outage must not block a legitimate reader (persist() still decides whether
  // the request is saved). The global email cap passes failClosed=true: it is
  // the ONLY backstop against SES fan-out and the request is already persisted,
  // so suppressing a notification on an outage is harmless; an unbounded send is
  // not.
  failClosed = false,
): Promise<boolean> {
  const tableName = process.env.BOOK_TABLE_NAME;
  if (!tableName) return memoryReserve(`${scope}#${key}`, max);

  const windowStart =
    Math.floor(Date.now() / 1000 / RATE_WINDOW_SECONDS) * RATE_WINDOW_SECONDS;
  try {
    await reserveBookRequestRateLimitSlot(
      tableName,
      scope,
      key,
      max,
      windowStart,
      RATE_WINDOW_SECONDS,
    );
    return true;
  } catch (err) {
    if (isConditionalCheckFailed(err)) {
      return false; // window cap reached
    }
    // Unexpected limiter failure: log and apply the configured fail direction.
    logger.warn("book_request_ratelimit_failed", { scope, err });
    return !failClosed;
  }
}

/**
 * Optional Cloudflare Turnstile verification. Inert (always passes) until
 * TURNSTILE_SECRET_KEY is configured, so the server can be wired ahead of the
 * form. Once configured, a missing/invalid token is rejected; a verification
 * outage fails OPEN (the IP + global caps still apply) so a Cloudflare incident
 * cannot take the intake form down.
 */
async function verifyCaptcha(
  obj: Record<string, unknown>,
  ip: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;

  const token =
    cleanString(obj.turnstileToken, 2048) ||
    cleanString(obj["cf-turnstile-response"], 2048);
  if (!token) return false;

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (ip) params.set("remoteip", ip);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      },
    );
    const data = (await res.json()) as { success?: boolean };
    return data?.success === true;
  } catch (err) {
    logger.warn("book_request_captcha_failed", { err });
    return true;
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(req, 400, "invalid_json", "Request body must be valid JSON.");
  }

  const obj =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const title = cleanString(obj.title, MAX.title);
  const author = cleanString(obj.author, MAX.author);
  const email = cleanString(obj.email, MAX.email);
  const note = cleanString(obj.note, MAX.note);

  // Honeypot: the public form renders a hidden field a human never sees or
  // fills (see HANDOFF for the field names). Bots that auto-populate every
  // input trip it. Respond with the normal success shape but persist nothing
  // and send no email, so the bot cannot tell its submission was dropped.
  if (cleanString(obj.website, 1) || cleanString(obj.company, 1)) {
    return NextResponse.json(
      {
        ok: true,
        requestId: randomUUID(),
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  }

  if (title.length < 2) {
    return jsonError(req, 400, "invalid_title", "Please enter the book title.");
  }
  if (!EMAIL_RE.test(email)) {
    return jsonError(req, 400, "invalid_email", "Please enter a valid email address.");
  }

  const clientIp = readClientIp(req);

  // Per-IP throttle BEFORE any expensive work (DynamoDB write, optional captcha
  // verification, SES email): a single source is capped to MAX_REQUESTS_PER_IP
  // per window; over that we 429 without persisting or notifying.
  const withinIpLimit = await reserveSlot(
    "ip",
    clientIp ? hashIp(clientIp) : "unknown",
    MAX_REQUESTS_PER_IP,
  );
  if (!withinIpLimit) {
    return jsonError(
      req,
      429,
      "rate_limited",
      "You’ve sent several requests recently. Please try again in a little while.",
    );
  }

  // Optional CAPTCHA, placed after the per-IP throttle so a flood cannot amplify
  // outbound siteverify calls.
  if (!(await verifyCaptcha(obj, clientIp))) {
    return jsonError(
      req,
      403,
      "captcha_failed",
      "Please complete the verification challenge and try again.",
    );
  }

  const record: BookRequestRecord = {
    requestId: randomUUID(),
    title,
    author: author || undefined,
    email,
    note: note || undefined,
    createdAt: new Date().toISOString(),
    source: "website",
    userAgent: req.headers.get("user-agent")?.slice(0, 400) || undefined,
    ip: clientIp?.slice(0, 64) || undefined,
  };

  try {
    await persist(record);
  } catch (err) {
    logger.error("book_request_persist_failed", { err });
    return jsonError(
      req,
      500,
      "server_error",
      "We couldn’t save your request just now. Please try again.",
    );
  }

  // Best-effort team notification — never blocks or fails the request, and is
  // gated behind a GLOBAL per-window email cap so even a distributed burst
  // across many IPs cannot fan out unbounded SES sends (cost / quota /
  // reputation / inbox flooding). The request is already persisted above, so a
  // suppressed notification only delays team visibility, it never loses data.
  if (await reserveSlot("email", "global", MAX_TEAM_EMAILS, /* failClosed */ true)) {
    void notifyTeam(record);
  }

  return NextResponse.json(
    { ok: true, requestId: record.requestId, createdAt: record.createdAt },
    { status: 201 },
  );
}

/**
 * Dev-only retrieval of the locally-persisted requests, so the file-fallback
 * pipeline can be verified end-to-end (`GET /api/book-requests`). Returns 404
 * in production — book requests contain reader emails and must never be served
 * publicly; in prod they live in DynamoDB behind the team's normal access.
 */
export async function GET(req: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return jsonError(req, 404, "not_found", "Not found.");
  }
  try {
    const [{ readFile }, os, path] = await Promise.all([
      import("node:fs/promises"),
      import("node:os"),
      import("node:path"),
    ]);
    const file = path.join(os.tmpdir(), "chapterflow", "book-requests.jsonl");
    const raw = await readFile(file, "utf8").catch(() => "");
    const requests = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as BookRequestRecord;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return NextResponse.json({ ok: true, count: requests.length, requests });
  } catch (err) {
    logger.error("book_request_read_failed", { err });
    return jsonError(req, 500, "server_error", "Unable to read requests.");
  }
}

async function persist(record: BookRequestRecord): Promise<void> {
  const tableName = process.env.BOOK_TABLE_NAME;

  if (tableName) {
    await persistBookRequestRecord(tableName, record);
    return;
  }

  // In production the table MUST be configured. If it isn't, fail loudly with a
  // 500 (the caller's catch returns an honest error to the reader) rather than
  // silently writing to an ephemeral temp file and telling them we saved it —
  // a standalone prod build's temp dir is not durable team-visible storage.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "BOOK_TABLE_NAME is not configured; refusing to silently drop a book request in production.",
    );
  }

  // Local-dev fallback: no DynamoDB configured. Append to a writable temp file
  // so requests aren't lost and the flow can be verified end-to-end. Production
  // never reaches here — the guard above throws when the table is unset.
  const [{ appendFile, mkdir }, os, path] = await Promise.all([
    import("node:fs/promises"),
    import("node:os"),
    import("node:path"),
  ]);
  const dir = path.join(os.tmpdir(), "chapterflow");
  await mkdir(dir, { recursive: true });
  await appendFile(
    path.join(dir, "book-requests.jsonl"),
    JSON.stringify(record) + "\n",
    "utf8",
  );
}

async function notifyTeam(record: BookRequestRecord): Promise<void> {
  // Resolve recipient + sender through the app's two-tier resolver (process.env
  // first, then SSM at ${SSM_PARAMETER_PREFIX}/<KEY>) so a runtime SSM param is
  // enough to enable team emails — no Lambda env injection or redeploy. The FROM
  // falls back to SES_SENDER_EMAIL, which is already an SSM-configured verified
  // sender used by the app's other mail. Whole body is guarded: this runs
  // fire-and-forget (void notifyTeam(...)), so it must never throw.
  try {
    const { getServerEnv } = await import("@/app/app/api/_lib/server-env");
    const sender =
      (await getServerEnv("BOOK_REQUESTS_FROM_EMAIL")) ||
      (await getServerEnv("SES_SENDER_EMAIL"));
    const to = await getServerEnv("BOOK_REQUESTS_TO_EMAIL");
    if (!sender || !to) return;

    const [{ SESv2Client, SendEmailCommand }, { awsClientConfig }] = await Promise.all([
      import("@aws-sdk/client-sesv2"),
      import("@/app/app/api/_lib/aws-client-config-core"),
    ]);
    const client = new SESv2Client({
      region: process.env.AWS_REGION ?? "us-east-1",
      ...awsClientConfig,
    });
    const lines = [
      `Title:  ${record.title}`,
      record.author ? `Author: ${record.author}` : null,
      `Reader: ${record.email}`,
      record.note ? `Note:   ${record.note}` : null,
      `When:   ${record.createdAt}`,
      `Id:     ${record.requestId}`,
    ]
      .filter(Boolean)
      .join("\n");
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: sender,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: `Book request: ${record.title}` },
            Body: { Text: { Data: lines } },
          },
        },
      }),
    );
  } catch (err) {
    logger.warn("book_request_notify_failed", { err });
  }
}
