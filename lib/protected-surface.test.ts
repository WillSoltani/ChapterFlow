import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { isProtectedSurfacePath } from "./protected-surface";

/**
 * The middleware's sign-in gate, table-driven against the real middleware in
 * its production configuration (no dev bypass, Cognito configured, no session
 * cookie). Every row is a path a logged-out visitor or a crawler can request;
 * the expected outcome is one of:
 *
 *   "login"  — 3xx to /auth/login (a protected surface)
 *   "public" — passes through to the page (NextResponse.next())
 *   "orphan" — 308 to the canonical book slug (PROD-DUP), before the gate
 *
 * The public catalog page /books (with or without a query or trailing slash)
 * is public; /book, /app and /dashboard and everything under them are not.
 */

type Outcome = "login" | "public" | "orphan";

const MANAGED_ENV_KEYS = [
  "NODE_ENV",
  "DEV_AUTH_BYPASS",
  "COGNITO_REGION",
  "COGNITO_USER_POOL_ID",
  "APP_BASE_URL",
  "CHAPTERFLOW_APP_BASE_URL",
  "ALLOW_APP_BASE_URL_IN_DEV",
  "ORIGIN_VERIFY_SECRET",
  "ORIGIN_VERIFY_MODE",
] as const;

function withProductionEnv<T>(run: () => T): T {
  const env = process.env as Record<string, string | undefined>;
  const previous = new Map(MANAGED_ENV_KEYS.map((key) => [key, env[key]] as const));
  try {
    for (const key of MANAGED_ENV_KEYS) delete env[key];
    Object.assign(env, {
      NODE_ENV: "production",
      DEV_AUTH_BYPASS: "0",
      COGNITO_REGION: "us-east-1",
      COGNITO_USER_POOL_ID: "pool-test",
      CHAPTERFLOW_APP_BASE_URL: "https://app.chapterflow.ca",
    });
    return run();
  } finally {
    for (const key of MANAGED_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  }
}

function outcomeOf(pathAndQuery: string): Outcome | string {
  const response = withProductionEnv(() =>
    middleware(new NextRequest(`https://app.chapterflow.ca${pathAndQuery}`)),
  );
  if (response.headers.get("x-middleware-next") === "1") return "public";
  const location = response.headers.get("location");
  if (response.status === 308 && location) return "orphan";
  if (response.status >= 300 && response.status < 400 && location) {
    if (new URL(location).pathname === "/auth/login") return "login";
  }
  return `status ${response.status} location ${location ?? "-"}`;
}

const PROTECTED: readonly string[] = [
  "/book",
  "/book/",
  "/book?x=1",
  "/book/library",
  "/book/library/",
  "/book/library/atomic-habits",
  "/book/library/atomic-habits/chapter/1",
  "/book/library/atomic-habits/chapter/1?session=1",
  "/book/settings",
  "/book/settings?upgrade=1",
  "/book/admin",
  "/book/admin/users",
  "/book/home",
  "/book/gift/abc",
  "/app",
  "/app/",
  "/app/anything",
  "/app/anything/deeper",
  "/dashboard",
  "/dashboard/",
  "/dashboard/anything",
  // Odd casing.
  "/BOOK",
  "/Book/library",
  "/BOOK/LIBRARY/atomic-habits",
  "/APP",
  "/Dashboard",
  // Double and triple slashes.
  "//book/library",
  "///book",
  "//app",
  "//dashboard/x",
  "/book//library",
  // Encoded slashes and encoded letters.
  "/book%2Flibrary",
  "/book%2flibrary",
  "/book%252Flibrary",
  "/%62ook/library",
  "/%42OOK",
  "/books%2F..%2Fbook",
  "/books%2F..%2Fbook%2Flibrary",
  // Dot segments (the URL parser resolves the plain and %2e forms).
  "/book/./library",
  "/./book",
  "/books/../book/library",
  "/books/%2e%2e/book/library",
  "/%2e%2e/book",
  "/x/../book",
  // Trailing junk on the protected segment itself.
  "/book;jsessionid=1",
  "/book.json",
  "/book%00",
  "/book%20",
  "/book~",
  "/book-",
  "/app;x",
  "/app.json",
  "/dashboard;x",
  "/dashboard.",
  // Backslashes (the URL parser turns them into slashes).
  "/book\\library",
];

const PUBLIC: readonly string[] = [
  // The intended change: the catalog page is public.
  "/books",
  "/books/",
  "/books?q=habit",
  "/books?q=Deep%20Work",
  "/books/?q=habit",
  // Already public before the change, and still public.
  "/",
  "/pricing",
  "/contact",
  "/legal",
  "/legal/terms",
  "/signup",
  "/onboarding",
  "/rewards",
  "/review",
  "/gift/abc",
  "/pair/accept/abc",
  "/account-deleted",
  "/chapterflow",
  "/auth/login",
  "/og",
  "/api/health",
  // Documented exception: /app/api/* never takes the cookie gate.
  "/app/api/book/books",
  "/app/api/auth/session",
  "/app/api/billing/webhook",
];

const ORPHAN: readonly string[] = [
  "/book/library/art-of-war",
  "/book/library/art-of-war/chapter/laying-plans",
  "/book/library/you-can%27t-hurt-me",
];

for (const p of PROTECTED) {
  test(`gate: ${JSON.stringify(p)} redirects a logged-out visitor to sign-in`, () => {
    assert.equal(outcomeOf(p), "login");
  });
}

for (const p of PUBLIC) {
  test(`gate: ${JSON.stringify(p)} is public`, () => {
    assert.equal(outcomeOf(p), "public");
  });
}

for (const p of ORPHAN) {
  test(`gate: ${JSON.stringify(p)} keeps the orphan slug redirect`, () => {
    assert.equal(outcomeOf(p), "orphan");
  });
}

test("gate: the sign-in redirect keeps a relative returnTo with the query", () => {
  const response = withProductionEnv(() =>
    middleware(new NextRequest("https://app.chapterflow.ca/book/library?chapter=2")),
  );
  const location = new URL(response.headers.get("location") ?? "");
  assert.equal(location.pathname, "/auth/login");
  assert.equal(location.searchParams.get("returnTo"), "/book/library?chapter=2");
});

/**
 * Every route under app/, as a URL path (dynamic segments filled with a
 * sample). The gate before this change protected any path that started with
 * the raw strings "/app", "/book" or "/dashboard"; the only route that rule
 * protected by accident is /books. Each real route keeps its old outcome
 * except /books, which becomes public.
 */
function appRoutes(): string[] {
  const root = path.join(process.cwd(), "app");
  const out: string[] = [];
  const walk = (dir: string, segments: string[]) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name.startsWith("_") || name === "node_modules") continue;
        const seg = /^\(.*\)$/.test(name)
          ? null
          : /^\[\[?\.\.\..+\]\]?$/.test(name)
            ? "a/b"
            : /^\[.+\]$/.test(name)
              ? "sample"
              : name;
        walk(full, seg === null ? segments : [...segments, seg]);
      } else if (/^(page|route)\.(tsx?|jsx?)$/.test(name)) {
        out.push(`/${segments.join("/")}`);
      }
    }
  };
  walk(root, []);
  return [...new Set(out)].sort();
}

const INTENDED_PUBLIC = new Set(["/books"]);
const rawPrefixRule = (p: string) =>
  p.startsWith("/app") || p.startsWith("/book") || p.startsWith("/dashboard");

test("gate: every route under app/ keeps its outcome, except /books which becomes public", () => {
  const routes = appRoutes();
  assert.ok(routes.length > 50, `found ${routes.length} routes under app/`);
  // Every top-level route the raw prefix matched, listed: anything here
  // besides /app, /book, /dashboard and /books would be a route the old rule
  // protected by accident and must be decided explicitly.
  const rawTopLevel = [
    ...new Set(routes.filter(rawPrefixRule).map((r) => r.split("/")[1])),
  ].sort();
  assert.deepEqual(rawTopLevel, ["app", "book", "books", "dashboard"]);
  const wrong: string[] = [];
  for (const route of routes) {
    const expected: Outcome = route.startsWith("/app/api/")
      ? "public"
      : rawPrefixRule(route) && !INTENDED_PUBLIC.has(route)
        ? "login"
        : "public";
    const got = outcomeOf(route);
    if (got !== expected) wrong.push(`${route}: ${got}, expected ${expected}`);
  }
  assert.deepEqual(wrong, []);
});

test("predicate: whole segments, so look-alike words are not protected surfaces", () => {
  // No route exists at these paths (a 404 either way); they are listed so a
  // change to the predicate that re-protects or un-protects them is a choice.
  for (const p of ["/books", "/Books", "/books/x", "/bookmarks", "/booking", "/application", "/apps", "/dashboards", "/appendix", "/book_x"]) {
    assert.equal(isProtectedSurfacePath(p), false, p);
  }
  for (const p of ["/book", "/book/", "book", "/book-club", "/app-x", "/dashboard%2Fx", "/BOOK%2Flibrary", "\\book", "/%2e%2e/%2e%2e/book", "/books/%2E%2E/book", "/book%E0%A4%A"]) {
    assert.equal(isProtectedSurfacePath(p), true, p);
  }
});

test("predicate: agrees with the middleware on every table row", () => {
  for (const p of [...PROTECTED, ...PUBLIC]) {
    const pathname = new NextRequest(`https://app.chapterflow.ca${p}`).nextUrl.pathname;
    if (pathname.startsWith("/app/api/")) continue; // the documented pass-through
    assert.equal(isProtectedSurfacePath(pathname), PROTECTED.includes(p), p);
  }
});
