import { defineConfig, devices } from "@playwright/test";

// Smoke E2E config. Drives the real app in a browser to catch "page loads but
// is broken" regressions that unit tests miss.
//
// Two modes, selected by E2E_MODE (default "dev"):
//
//   • dev  — `npm run dev` (Turbopack dev server, DEV_AUTH_BYPASS=1, no data
//            plane). Fast feedback that the authed app SHELL renders. Auth is
//            bypassed and there is no DynamoDB, so this mode CANNOT verify the
//            production bundle, real-auth redirects, or data-backed pages. It
//            runs every spec EXCEPT the prod-only ones (grep-inverted "@prod").
//
//   • prod — `next build` + `next start` (production bundle, NODE_ENV=production,
//            DEV_AUTH_BYPASS unset so it has no effect — see
//            app/app/_lib/dev-auth-bypass.ts). Catches prod-build-only crashes,
//            dev-vs-prod hydration mismatches, and verifies the real-auth
//            bounce (unauthenticated protected route -> /auth/login) that the
//            dev-bypass mode hides. It runs ONLY the "@prod" specs.
//
// Both modes are wired as separate CI jobs (.github/workflows/ci.yml).
const E2E_MODE = process.env.E2E_MODE === "prod" ? "prod" : "dev";
const IS_PROD = E2E_MODE === "prod";
const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

// Production smoke build: a real `next build` + `next start`, with the COGNITO
// vars set so middleware.ts runs its real auth check (it skips auth in
// non-production when those are absent — but NODE_ENV is "production" under
// `next start` regardless, so the bounce fires). NEXT_DIST_DIR keeps the prod
// build out of the dev `.next-chapterflow` dir. DEV_AUTH_BYPASS is intentionally
// NOT set — under NODE_ENV=production it is a no-op anyway.
const PROD_ENV = [
  "NEXT_DIST_DIR=.next-prod-e2e",
  "NEXT_TELEMETRY_DISABLED=1",
  "COGNITO_REGION=us-east-1",
  "COGNITO_USER_POOL_ID=e2e-user-pool",
].join(" ");
const PROD_COMMAND =
  `${PROD_ENV} next build && ` +
  `${PROD_ENV} next start --hostname 127.0.0.1 --port 3000`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // dev mode: run everything EXCEPT prod-only specs. prod mode: run ONLY them.
  grep: IS_PROD ? /@prod/ : undefined,
  grepInvert: IS_PROD ? undefined : /@prod/,
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: IS_PROD ? PROD_COMMAND : "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // The prod webServer command runs `next build` first, so allow extra time.
    timeout: IS_PROD ? 300_000 : 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
