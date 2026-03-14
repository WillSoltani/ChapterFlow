#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

function usage() {
  console.log(`\nUsage:\n  node scripts/book/upload-book-package.mjs --origin <https://app-url> --token <id_token> --file <book.json> [--publish]\n\nOptions:\n  --origin   App origin, e.g. https://soltani.org\n  --token    Cognito id_token for an admin user\n  --file     Path to book package JSON\n  --publish  Publish immediately after ingestion (default: draft only)\n\nYou can also set BOOK_ADMIN_TOKEN in env and omit --token.\n`);
}

function parseArgs(argv) {
  const args = {
    origin: "",
    token: process.env.BOOK_ADMIN_TOKEN || "",
    file: "",
    publish: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === "--origin" && next) {
      args.origin = next;
      i += 1;
      continue;
    }
    if (key === "--token" && next) {
      args.token = next;
      i += 1;
      continue;
    }
    if (key === "--file" && next) {
      args.file = next;
      i += 1;
      continue;
    }
    if (key === "--publish") {
      args.publish = true;
      continue;
    }
    if (key === "--help" || key === "-h") {
      usage();
      process.exit(0);
    }
  }

  return args;
}

function normalizeOrigin(origin) {
  return origin.replace(/\/+$/, "");
}

async function requestJson(url, init = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const errorMessage =
      json?.error?.message || json?.message || `${res.status} ${res.statusText}`;
    throw new Error(`${errorMessage} (${res.status})`);
  }

  return json;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.origin || !args.file || !args.token) {
    usage();
    process.exit(1);
  }

  const origin = normalizeOrigin(args.origin);
  const packagePath = path.resolve(process.cwd(), args.file);
  const raw = await fs.readFile(packagePath, "utf8");
  const parsed = JSON.parse(raw);
  const bookId = parsed?.book?.bookId || "pending";

  const authHeaders = {
    "Content-Type": "application/json",
    Cookie: `id_token=${args.token}`,
  };

  console.log(`1) Requesting upload URL for bookId=${bookId} ...`);
  const uploadReq = await requestJson(
    `${origin}/app/api/book/admin/books/upload-request`,
    {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ bookId }),
    }
  );

  console.log(`   jobId: ${uploadReq.jobId}`);
  console.log("2) Uploading JSON package to presigned S3 URL ...");
  const uploadRes = await fetch(uploadReq.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: raw,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`S3 upload failed: ${uploadRes.status} ${uploadRes.statusText} ${errText}`);
  }

  console.log(`3) Starting ingestion (publishNow=${args.publish}) ...`);
  const runRes = await requestJson(`${origin}/app/api/book/admin/ingest/run`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      jobId: uploadReq.jobId,
      publishNow: args.publish,
    }),
  });

  if (runRes?.ok && runRes?.version) {
    console.log(`   ingestion completed immediately: version=${runRes.version}`);
  }

  console.log("4) Polling ingestion status ...");
  const timeoutAt = Date.now() + 3 * 60 * 1000;
  let lastStatus = "PENDING";

  while (Date.now() < timeoutAt) {
    const statusRes = await requestJson(
      `${origin}/app/api/book/admin/ingestions/${encodeURIComponent(uploadReq.jobId)}`,
      {
        method: "GET",
        headers: {
          Cookie: `id_token=${args.token}`,
        },
      }
    );

    const status = statusRes?.job?.status || "UNKNOWN";
    if (status !== lastStatus) {
      console.log(`   status: ${status}`);
      lastStatus = status;
    }

    if (status === "SUCCEEDED") {
      console.log("✅ Done. Book package ingested successfully.");
      console.log(`   bookId: ${statusRes?.job?.bookId || bookId}`);
      console.log(`   details: ${JSON.stringify(statusRes?.job?.details || {}, null, 2)}`);
      return;
    }

    if (status === "FAILED") {
      const details = statusRes?.job?.details || {};
      const report = statusRes?.job?.errorReportKey || "(none)";
      throw new Error(
        `Ingestion failed. errorReportKey=${report} details=${JSON.stringify(details)}`
      );
    }

    await sleep(2000);
  }

  throw new Error("Timed out while waiting for ingestion status.");
}

main().catch((error) => {
  console.error("❌ Upload failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
