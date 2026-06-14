import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

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

interface BookRequestRecord {
  requestId: string;
  title: string;
  author?: string;
  email: string;
  note?: string;
  createdAt: string;
  source: string;
  userAgent?: string;
  ip?: string;
}

function cleanString(value: unknown, max: number): string {
  // Collapse embedded newlines/tabs to spaces so values stay single-line when
  // used in the SES notification subject/body (defense-in-depth; the SES
  // structured API already prevents header injection).
  return typeof value === "string"
    ? value.replace(/[\r\n\t]+/g, " ").trim().slice(0, max)
    : "";
}

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const obj =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const title = cleanString(obj.title, MAX.title);
  const author = cleanString(obj.author, MAX.author);
  const email = cleanString(obj.email, MAX.email);
  const note = cleanString(obj.note, MAX.note);

  if (title.length < 2) {
    return jsonError(400, "invalid_title", "Please enter the book title.");
  }
  if (!EMAIL_RE.test(email)) {
    return jsonError(400, "invalid_email", "Please enter a valid email address.");
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
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()?.slice(0, 64) ||
      undefined,
  };

  try {
    await persist(record);
  } catch (err) {
    console.error("book_request_persist_failed", err);
    return jsonError(
      500,
      "server_error",
      "We couldn’t save your request just now. Please try again.",
    );
  }

  // Best-effort team notification — never blocks or fails the request.
  void notifyTeam(record);

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
export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
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
    console.error("book_request_read_failed", err);
    return jsonError(500, "server_error", "Unable to read requests.");
  }
}

async function persist(record: BookRequestRecord): Promise<void> {
  const tableName = process.env.BOOK_TABLE_NAME;

  if (tableName) {
    const { ddbDoc } = await import("@/app/app/api/_lib/aws");
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: `BOOKREQUEST#${record.requestId}`,
          SK: `REQUEST#${record.createdAt}`,
          entity: "BOOK_REQUEST",
          ...record,
        },
      }),
    );
    return;
  }

  // Local-dev fallback: no DynamoDB configured. Append to a writable temp file
  // so requests aren't lost and the flow can be verified end-to-end. Production
  // always has BOOK_TABLE_NAME set, so this branch never runs there.
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
  const sender =
    process.env.BOOK_REQUESTS_FROM_EMAIL || process.env.SES_SENDER_EMAIL;
  const to = process.env.BOOK_REQUESTS_TO_EMAIL;
  if (!sender || !to) return;

  try {
    const { SESv2Client, SendEmailCommand } = await import(
      "@aws-sdk/client-sesv2"
    );
    const client = new SESv2Client({
      region: process.env.AWS_REGION ?? "us-east-1",
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
    console.warn("book_request_notify_failed", err);
  }
}
