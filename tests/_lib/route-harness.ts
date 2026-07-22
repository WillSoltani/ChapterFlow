/**
 * Shared harness for route-wrapper tests (WS7-003).
 *
 * Routes under app/app/api/** import `server-only` (directly or via http.ts /
 * auth.ts / env.ts), which throws under `tsx --test`. This harness patches
 * CommonJS Module._load BEFORE the route is imported so those modules resolve
 * to stubs. Rules:
 *  - NEVER import a route statically at test top-level. Call
 *    installRouteHarness(...) at module scope, then `await import("./route")`
 *    inside `before()`; call restore() in `after()`.
 *  - Stub keys may be "@/..." alias specifiers or relative specifiers
 *    ("./env"); relative keys also match by trailing segment (so "./env"
 *    intercepts http.ts's own "./env" import when http.ts loads for real).
 *  - Assert seams only: (1) guard invoked, (2) parsed field reaches core,
 *    (3) thrown BookApiError -> correct status envelope. Pure decisions stay
 *    in *-core.ts tests. Reference: app/app/api/book/me/streak/route.test.ts.
 */
import { createRequire } from "node:module";
import { BookApiError } from "@/app/app/api/book/_lib/errors";

const requireCjs = createRequire(import.meta.url);
const Module = requireCjs("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

export function makeSpy<TArgs extends unknown[], TResult>(
  impl: (...args: TArgs) => TResult,
) {
  const spy = ((...args: TArgs) => {
    spy.calls.push(args);
    return impl(...args);
  }) as ((...args: TArgs) => TResult) & { calls: TArgs[] };
  spy.calls = [];
  return spy;
}

export function installRouteHarness(
  stubs: Record<string, unknown>,
): { restore: () => void } {
  const originalLoad = Module._load;
  Module._load = function patchedLoad(
    request: string,
    parent: unknown,
    isMain: boolean,
  ) {
    if (request === "server-only") return {};
    if (Object.prototype.hasOwnProperty.call(stubs, request)) {
      return stubs[request];
    }
    // Relative specifiers: match a "./env"-style key against the request's
    // trailing segment so the SAME stub serves both the route's "@/..." alias
    // import and a transitively-loaded real module's relative import. Keep
    // matching narrow (exact tail) to avoid hijacking unrelated basenames.
    if (request.startsWith(".")) {
      for (const key of Object.keys(stubs)) {
        if (!key.startsWith(".")) continue;
        const keyTail = key.replace(/^\.\//, "");
        if (request === key || request.endsWith(`/${keyTail}`)) {
          return stubs[key];
        }
      }
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  return {
    restore: () => {
      Module._load = originalLoad;
    },
  };
}

export type GuardUser = { sub: string; email: string; groups?: string[] };

/**
 * Spy-wrapped auth guards. Tests assert `.calls.length` (guard invoked) and
 * inject a BookApiError via setError(...) to drive the 401/403 envelope path.
 */
export function guardStub(
  user: GuardUser = { sub: "user-1", email: "user@test" },
) {
  let error: BookApiError | null = null;
  const requireActiveBookUser = makeSpy(async () => {
    if (error) throw error;
    return user;
  });
  const requireAdminUser = makeSpy(async () => {
    if (error) throw error;
    return user;
  });
  return {
    requireActiveBookUser,
    requireAdminUser,
    setError(next: BookApiError | null) {
      error = next;
    },
    reset() {
      error = null;
      requireActiveBookUser.calls.length = 0;
      requireAdminUser.calls.length = 0;
    },
  };
}
