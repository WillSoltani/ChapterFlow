import { defineConfig, devices } from "@playwright/test";
import { buildSyntheticRuntimeEnvironment } from "./app/app/api/_lib/boot-env-core";

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
// Opt-in (local only): run the @visual screenshot specs instead of the smoke suite.
const RUN_VISUAL = process.env.RUN_VISUAL === "1";
const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

// Production smoke build: a real `next build` + `next start`. Test-only,
// non-secret placeholders satisfy the same boot contract as a deployed server
// while middleware.ts still runs its real unauthenticated redirect path. The
// @prod suite never follows that redirect into Cognito or reaches the data
// plane. NEXT_DIST_DIR keeps the prod build out of the dev
// `.next-chapterflow` dir. DEV_AUTH_BYPASS is intentionally NOT set — under
// NODE_ENV=production it is a no-op anyway.
export const PROD_E2E_ENV: Readonly<Record<string, string>> = {
  ...buildSyntheticRuntimeEnvironment("prod"),
  // The server listens on loopback, but production redirects must use the same
  // trusted public authority as a deployed environment. A loopback public base
  // is intentionally rejected by the middleware origin boundary.
  CHAPTERFLOW_APP_BASE_URL: "https://app.chapterflow.ca",
  NEXT_DIST_DIR: ".next-prod-e2e",
  NEXT_TELEMETRY_DISABLED: "1",
};
export const PROD_E2E_HEADERS: Readonly<Record<string, string>> = {
  // Production traffic reaches the public Function URL through CloudFront,
  // which injects this header. The direct local/CI harness must emulate that
  // edge hop now that the runtime manifest correctly requires enforcement.
  "x-origin-verify": PROD_E2E_ENV.ORIGIN_VERIFY_SECRET ?? "",
};
const PROD_ENV = Object.entries(PROD_E2E_ENV)
  .map(([name, value]) => `${name}=${value}`)
  .join(" ");
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
  // @visual specs are EXCLUDED from both CI jobs by default — their screenshot
  // baselines are host-specific (committed as chromium-darwin) and would fail on
  // the Linux CI runner. They are a LOCAL gate, opted into with RUN_VISUAL=1
  // (`npm run test:visual`), which flips the selection to ONLY @visual.
  grep: IS_PROD ? /@prod/ : RUN_VISUAL ? /@visual/ : undefined,
  grepInvert: IS_PROD ? undefined : RUN_VISUAL ? undefined : /@prod|@visual/,
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: "on-first-retry",
    extraHTTPHeaders: IS_PROD ? PROD_E2E_HEADERS : undefined,
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
