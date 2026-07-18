// Boot-time fail-fast validation for required server env (WS3-012).
//
// This is Next's `instrumentation.ts` hook: a file at the project root (there
// is no `src/` here) whose exported `register()` Next calls once per server
// runtime it boots, before that runtime serves any request. Stable since
// Next 15 — confirmed against the `next` version actually installed in this
// repo (16.2.9, see package.json / node_modules/next/package.json), so no
// `experimental.instrumentationHook` flag is needed in next.config.ts.
// `output: "standalone"` (next.config.ts) does pick this file up: `next build`
// copies root `instrumentation.ts` into `.next/standalone/instrumentation.js`
// automatically as part of the standalone output, and the standalone
// `server.js` entrypoint loads it before listening — no extra wiring required
// here.
//
// Kept free of `server-only` and any Node/AWS-SDK-only import — Next can load
// this file under either the "nodejs" or "edge" runtime (see the guard
// below), and keeping it import-light also means it can be required directly
// from a plain `tsx --test` run (see tests/instrumentation.test.ts) without
// needing to fake `server-only`.
import {
  REQUIRED_SERVER_ENV,
  validateRequiredServerEnv,
} from "@/app/app/api/_lib/boot-env-core";

export async function register(): Promise<void> {
  // Next invokes register() once per runtime present in the build (it can be
  // called for "nodejs" and, separately, for "edge"). The env vars this
  // module checks are only ever read by Node.js server code (route handlers
  // under app/app/api/**), so skip outright on any other runtime rather than
  // validating something that runtime doesn't use.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Two independent reasons this must stay a no-op outside a real production
  // boot:
  //
  //  1. NODE_ENV !== "production" — local dev intentionally runs without
  //     most of this env (DEV_AUTH_BYPASS skips Cognito verification
  //     entirely; see app/app/_lib/dev-auth-bypass.ts, isDevAuthBypassEnabled
  //     is hard-gated to NODE_ENV !== "production"). Validating in dev would
  //     fail every local boot for no reason.
  //
  //  2. NEXT_PHASE === "phase-production-build" — `next build` sets
  //     NODE_ENV to "production" for the duration of the build, and Next
  //     calls register() during that build step too, but a build environment
  //     (including this repo's `npm run build` / `npm run verify`, and CI)
  //     carries none of the real deploy secrets. Verified empirically in this
  //     worktree: running `npm run build` with no BOOK_TABLE_NAME/COGNITO_*
  //     set in the shell succeeds with this guard in place; removing the
  //     guard makes the build itself throw during the production-build
  //     invocation of register(), which would break CI on every PR. Skipping
  //     the build phase preserves that while still catching a genuinely
  //     misconfigured runtime boot (phase is "phase-production-server" there,
  //     not "phase-production-build").
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { missing } = validateRequiredServerEnv(process.env);
  if (missing.length > 0) {
    throw new Error(
      `WS3-012 boot validation failed — missing required server env var(s): ${missing.join(", ")}. ` +
        "See app/app/api/_lib/boot-env-core.ts (REQUIRED_SERVER_ENV) for what each " +
        "one gates and why it is fail-fast rather than a lazy per-request throw.",
    );
  }

  // Observable success signal so a boot that validated cleanly shows up in
  // logs, not just the absence of the error above.
  console.log(
    `boot_env_validated: ${REQUIRED_SERVER_ENV.length} required server env var(s) present`,
  );
}
