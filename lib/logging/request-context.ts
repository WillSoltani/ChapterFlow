import { AsyncLocalStorage } from "node:async_hooks";

// WS6-031: AsyncLocalStorage-backed request context so the structured logger
// (./logger) can resolve a correlation id for any log emitted deep inside a
// request's async call tree without threading `requestId` through every
// signature. The book-API error boundary (app/app/api/book/_lib/http.ts) runs
// each route body inside `runWithRequestContext(requestId, …)`.
//
// NODE RUNTIME ONLY. `node:async_hooks` is unavailable on the edge runtime, so
// this module must never be reached transitively from middleware.ts (edge). That
// holds today: middleware imports only dev-auth-bypass, book-slug-aliases, and
// origin-verify-core, none of which import this module or ./logger. Keep it that
// way — do not import the logger into any edge-runtime code path.

type RequestContext = {
  requestId: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Run `fn` with `requestId` bound to the ambient request context. Everything
 * `fn` awaits can read it back via {@link getRequestId}.
 */
export function runWithRequestContext<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId }, fn);
}

/**
 * The requestId of the enclosing {@link runWithRequestContext} scope, or
 * `undefined` when called outside any request context.
 */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
