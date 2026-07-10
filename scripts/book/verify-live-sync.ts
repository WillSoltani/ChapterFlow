#!/usr/bin/env tsx
/**
 * verify-live-sync — prove that a freshly PUBLISHED book is actually SERVED.
 *
 * publish-final (the v24 one-verb ship) ends at a git push by design (no-AWS
 * invariant). But prod SERVER grading/ask/audio read the package from S3
 * (book-content/packages/<id>.v21.json), synced out-of-band by
 * scripts/book/upload-book-packages-to-s3.ts, and served by a separate web
 * deploy. publish-final records the owed work in a tracked sentinel
 * (book-packages/.pending-deploy.json). This command is the READ-ONLY proof
 * that each pending entry is now live, and clears the ones that are.
 *
 * Four checks per pending book, each reported OK / FAIL / SKIPPED(reason):
 *   (a) repo   — sha256(book-packages/<id>.v21.json) matches the entry's
 *                packageSha256 (a mismatch means a NEWER publish; we then verify
 *                S3/app against the CURRENT repo file's sha, and report the drift).
 *   (b) S3     — GetObject book-content/packages/<id>.v21.json and sha256-compare
 *                to the current repo file. SKIPPED without AWS creds / bucket.
 *   (c) app    — GET <origin>/api/health .commit; assert the last commit that
 *                touched the repo package is an ANCESTOR of the deployed commit.
 *                SKIPPED without a resolvable origin / a locally-absent commit.
 *   (d) api    — the DynamoDB/S3-backed API catalog (the surface the native iOS
 *                app reads — a THIRD surface, populated only by
 *                scripts/book/register-api-books.ts, NOT by the web deploy) serves
 *                the book: GET <origin>/app/api/book/books/<id> must be 200, and
 *                the served version's manifest.json packageId must match the repo
 *                package's (else the API is serving a STALE version). A 404 here
 *                with the app's book_not_found shape is a FAIL — the book is live
 *                on the web but invisible to iOS; 37 books shipped that way before
 *                2026-07-10. Parity SKIPPED without AWS creds / bucket.
 *
 * An entry with ALL FOUR checks OK — no FAIL, no SKIP — is SATISFIED → removed
 * from the sentinel (the file is rewritten; a suggested `git commit` line is
 * printed, never run). Exit 0 only when nothing pending remains; 1 otherwise.
 * NEVER fakes success: a skipped check leaves the entry pending.
 *
 * NEVER writes to S3 or dispatches a deploy. No secrets in code.
 *
 * Usage:
 *   npm run verify:live
 *   BOOK_CONTENT_BUCKET=<bucket> AWS_REGION=us-east-1 CHAPTERFLOW_LIVE_ORIGIN=https://chapterflow.ca npm run verify:live
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const SENTINEL_REL = "book-packages/.pending-deploy.json";
const SENTINEL_ABS = path.join(REPO_ROOT, SENTINEL_REL);
/** Documented prod host (infra hosted-zone chapterflow.ca); override with env. */
const DEFAULT_ORIGIN = "https://chapterflow.ca";

type PendingEntry = { bookId: string; packageSha256: string; publishedAt: string; steps: string[] };
type CheckState = "OK" | "FAIL" | "SKIPPED";
type Check = { name: string; state: CheckState; detail: string };

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function git(args: string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, stdout: (e.stdout ?? "").toString().trim(), stderr: (e.stderr ?? "").toString().trim() };
  }
}

/** (a) repo file present + sha. Returns the CURRENT repo sha (the expectation for b/c). */
function checkRepo(entry: PendingEntry): { check: Check; repoSha: string | null; repoFile: string } {
  const rel = `book-packages/${entry.bookId}.v21.json`;
  const abs = path.join(REPO_ROOT, rel);
  if (!existsSync(abs)) {
    return { check: { name: "repo", state: "FAIL", detail: `missing ${rel} — the published package is gone` }, repoSha: null, repoFile: rel };
  }
  const repoSha = sha256(readFileSync(abs));
  if (repoSha !== entry.packageSha256) {
    return {
      check: { name: "repo", state: "OK", detail: `present but sha DRIFTED from the recorded publish (${entry.packageSha256.slice(0, 12)}… → ${repoSha.slice(0, 12)}…) — a newer publish; verifying S3/app against the current file` },
      repoSha,
      repoFile: rel,
    };
  }
  return { check: { name: "repo", state: "OK", detail: `sha matches the recorded publish (${repoSha.slice(0, 12)}…)` }, repoSha, repoFile: rel };
}

/** (b) S3 package byte-identical to the repo file. SKIPPED without creds/bucket. */
async function checkS3(entry: PendingEntry, repoSha: string | null): Promise<Check> {
  const bucket = process.env.BOOK_CONTENT_BUCKET;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  if (!bucket) return { name: "s3", state: "SKIPPED", detail: "BOOK_CONTENT_BUCKET unset — cannot read the served package (set it + AWS creds to verify)" };
  if (repoSha === null) return { name: "s3", state: "SKIPPED", detail: "repo package missing — nothing to compare against" };
  const key = `book-content/packages/${entry.bookId}.v21.json`;
  try {
    // Mirror upload-book-packages-to-s3.ts exactly (same SDK, same key/region).
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({ region });
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    const s3Sha = sha256(Buffer.from(bytes));
    if (s3Sha === repoSha) return { name: "s3", state: "OK", detail: `s3://${bucket}/${key} byte-matches the repo package (${s3Sha.slice(0, 12)}…)` };
    return { name: "s3", state: "FAIL", detail: `s3://${bucket}/${key} sha ${s3Sha.slice(0, 12)}… != repo ${repoSha.slice(0, 12)}… — run upload-book-packages-to-s3` };
  } catch (err) {
    const msg = (err as Error).message;
    // Credential / network / missing-object errors are SKIPPED (unknown), not FAIL —
    // except a definitive NoSuchKey, which means the upload never ran.
    if (/NoSuchKey|NotFound|does not exist/i.test(msg)) return { name: "s3", state: "FAIL", detail: `s3://${bucket}/${key} absent — the package was never uploaded (run upload-book-packages-to-s3)` };
    return { name: "s3", state: "SKIPPED", detail: `could not read S3 (${msg.slice(0, 120)}) — creds/network unavailable here` };
  }
}

/** (c) deployed app serves a commit that INCLUDES the package's last change. */
async function checkApp(entry: PendingEntry, repoFile: string): Promise<Check> {
  const origin = process.env.CHAPTERFLOW_LIVE_ORIGIN || DEFAULT_ORIGIN;
  let deployedCommit: string | null = null;
  try {
    const res = await fetch(`${origin}/api/health`, { headers: { "cache-control": "no-store" } });
    if (!res.ok) return { name: "app", state: "SKIPPED", detail: `${origin}/api/health returned ${res.status} — cannot read the deployed commit` };
    const body = (await res.json()) as { commit?: string | null };
    deployedCommit = body.commit ?? null;
  } catch (err) {
    return { name: "app", state: "SKIPPED", detail: `${origin}/api/health unreachable (${(err as Error).message.slice(0, 100)}) — set CHAPTERFLOW_LIVE_ORIGIN or run from a networked host` };
  }
  if (!deployedCommit) return { name: "app", state: "SKIPPED", detail: `${origin}/api/health reports no commit sha (CHAPTERFLOW_COMMIT_SHA unset in the deploy) — cannot prove freshness` };

  const lastTouch = git(["log", "-n", "1", "--format=%H", "--", repoFile]);
  if (lastTouch.status !== 0 || !lastTouch.stdout) {
    return { name: "app", state: "SKIPPED", detail: `could not resolve the last commit touching ${repoFile}` };
  }
  const pkgCommit = lastTouch.stdout;
  // The deployed commit must exist locally to test ancestry; try a fetch if not.
  if (git(["cat-file", "-e", `${deployedCommit}^{commit}`]).status !== 0) {
    git(["fetch", "origin", "--quiet"]);
    if (git(["cat-file", "-e", `${deployedCommit}^{commit}`]).status !== 0) {
      return { name: "app", state: "SKIPPED", detail: `deployed commit ${deployedCommit.slice(0, 12)} is not in the local repo (fetch it to verify ancestry)` };
    }
  }
  const isAncestor = git(["merge-base", "--is-ancestor", pkgCommit, deployedCommit]).status === 0;
  if (isAncestor) return { name: "app", state: "OK", detail: `deployed commit ${deployedCommit.slice(0, 12)} includes the package's last change ${pkgCommit.slice(0, 12)}` };
  return { name: "app", state: "FAIL", detail: `deployed commit ${deployedCommit.slice(0, 12)} PREDATES the package change ${pkgCommit.slice(0, 12)} — the web deploy has not shipped it (gh workflow run deploy.yml -f environment=prod -f deploy_app=true)` };
}

/** (d) the API catalog (iOS surface) serves this book, at a version built from
 *  the CURRENT repo package. Presence is proven over public HTTP; version parity
 *  reads the served version's manifest.json from S3 (same bucket/creds as (b))
 *  and compares its packageId to the repo package's. Fail-closed: anything
 *  unprovable is SKIPPED (stays pending), a definitive absence or mismatch FAILs. */
async function checkApi(entry: PendingEntry, repoSha: string | null): Promise<Check> {
  const origin = process.env.CHAPTERFLOW_LIVE_ORIGIN || DEFAULT_ORIGIN;
  const url = `${origin}/app/api/book/books/${entry.bookId}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return { name: "api", state: "SKIPPED", detail: `${url} unreachable (${(err as Error).message.slice(0, 100)}) — cannot read the API catalog` };
  }
  if (res.status === 404) {
    let code = "";
    try { code = String(((await res.json()) as { error?: { code?: string } })?.error?.code ?? ""); } catch { /* non-JSON 404 body */ }
    if (code === "book_not_found") {
      return { name: "api", state: "FAIL", detail: `${url} → 404 book_not_found — NOT in the API catalog (live on the web, INVISIBLE to the iOS app); run register-api-books (npm run register:api -- ${entry.bookId})` };
    }
    return { name: "api", state: "SKIPPED", detail: `${url} → 404 without the app's book_not_found shape — wrong origin? (set CHAPTERFLOW_LIVE_ORIGIN)` };
  }
  if (!res.ok) {
    return { name: "api", state: "SKIPPED", detail: `${url} → ${res.status} — cannot read the API catalog entry` };
  }
  let publishedVersion: number | null = null;
  try {
    const body = (await res.json()) as { book?: { publishedVersion?: unknown } };
    publishedVersion = typeof body?.book?.publishedVersion === "number" ? body.book.publishedVersion : null;
  } catch { /* non-JSON 200 → parity unprovable below */ }
  if (publishedVersion === null) {
    return { name: "api", state: "SKIPPED", detail: `${url} → 200 but no book.publishedVersion — present in the API catalog, version parity unprovable` };
  }

  // Version parity: the served version must be built from the CURRENT package.
  const bucket = process.env.BOOK_CONTENT_BUCKET;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  if (!bucket) return { name: "api", state: "SKIPPED", detail: `API serves v${publishedVersion}, but BOOK_CONTENT_BUCKET is unset — cannot prove it was built from the CURRENT package` };
  if (repoSha === null) return { name: "api", state: "SKIPPED", detail: "repo package missing — nothing to compare the served API version against" };
  let localPackageId: string | null = null;
  try {
    const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "book-packages", `${entry.bookId}.v21.json`), "utf8")) as { packageId?: unknown };
    localPackageId = typeof pkg.packageId === "string" && pkg.packageId ? pkg.packageId : null;
  } catch { /* unreadable package → repo check already reports it */ }
  if (!localPackageId) {
    return { name: "api", state: "SKIPPED", detail: `API serves v${publishedVersion}, but the repo package has no packageId — version parity unprovable (stamp a packageId and re-publish)` };
  }
  const manifestKey = `book-content/books/${entry.bookId}/v${String(publishedVersion).padStart(6, "0")}/manifest.json`;
  try {
    // Same SDK/bucket/creds as check (b).
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({ region });
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: manifestKey }));
    const manifest = JSON.parse(Buffer.from(await obj.Body!.transformToByteArray()).toString("utf8")) as { packageId?: unknown };
    const served = typeof manifest.packageId === "string" && manifest.packageId ? manifest.packageId : null;
    if (!served) {
      return { name: "api", state: "SKIPPED", detail: `API serves v${publishedVersion} but its manifest records no packageId (pre-packageId ingest) — parity unprovable; stamp a new packageId and re-run register-api-books` };
    }
    if (served === localPackageId) {
      return { name: "api", state: "OK", detail: `API catalog serves v${publishedVersion} built from the CURRENT package (packageId ${served})` };
    }
    return { name: "api", state: "FAIL", detail: `API serves v${publishedVersion} from packageId ${served}, but the repo package is ${localPackageId} — the API is STALE; re-run register-api-books (npm run register:api -- ${entry.bookId})` };
  } catch (err) {
    return { name: "api", state: "SKIPPED", detail: `could not read s3://${bucket}/${manifestKey} (${(err as Error).message.slice(0, 120)}) — creds/network unavailable here` };
  }
}

async function main(): Promise<number> {
  if (!existsSync(SENTINEL_ABS)) {
    console.log("live-sync: nothing pending (no book-packages/.pending-deploy.json)");
    return 0;
  }
  let doc: { schemaVersion?: string; pending?: PendingEntry[] };
  try {
    doc = JSON.parse(readFileSync(SENTINEL_ABS, "utf8"));
  } catch (err) {
    console.error(`live-sync: cannot parse ${SENTINEL_REL}: ${(err as Error).message}`);
    return 1;
  }
  const pending = Array.isArray(doc.pending) ? doc.pending : [];
  if (pending.length === 0) {
    console.log("live-sync: nothing pending");
    return 0;
  }

  console.log(`live-sync: ${pending.length} pending deploy(s)\n`);
  const stillPending: PendingEntry[] = [];
  const rows: string[] = [];
  for (const entry of pending) {
    const { check: repoCheck, repoSha, repoFile } = checkRepo(entry);
    const s3Check = await checkS3(entry, repoSha);
    const appCheck = await checkApp(entry, repoFile);
    const apiCheck = await checkApi(entry, repoSha);
    const checks = [repoCheck, s3Check, appCheck, apiCheck];
    console.log(`■ ${entry.bookId} (published ${entry.publishedAt})`);
    for (const c of checks) console.log(`    ${c.state === "OK" ? "✓" : c.state === "FAIL" ? "✗" : "–"} ${c.name}: ${c.detail}`);

    const anyFail = checks.some((c) => c.state === "FAIL");
    const anySkipped = checks.some((c) => c.state === "SKIPPED");
    // SATISFIED only when every check ran and passed — a skip never clears it.
    const satisfied = !anyFail && !anySkipped;
    if (satisfied) {
      rows.push(`  ${entry.bookId}: SATISFIED — cleared from the sentinel`);
    } else {
      stillPending.push(entry);
      rows.push(`  ${entry.bookId}: ${anyFail ? "FAILED" : "PENDING"} — ${anyFail ? "resolve the ✗ above" : "re-run once the skipped check can run (creds / origin / deploy)"}`);
    }
    console.log("");
  }

  if (stillPending.length !== pending.length) {
    const next = { schemaVersion: doc.schemaVersion ?? "pending-deploy-v1", pending: stillPending };
    writeFileSync(SENTINEL_ABS, JSON.stringify(next, null, 2) + "\n");
    console.log(`live-sync: cleared ${pending.length - stillPending.length} satisfied entry(ies); ${SENTINEL_REL} updated.`);
    console.log(`           commit it:  git add ${SENTINEL_REL} && git commit -m "chore(deploy): clear satisfied deploy sentinel entries"\n`);
  }

  console.log("Summary:");
  for (const r of rows) console.log(r);
  return stillPending.length === 0 ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(`live-sync: unexpected error: ${(err as Error).stack ?? err}`);
  process.exit(1);
});
