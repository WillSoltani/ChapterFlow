import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Monkey-patch `Module._load` to return `{}` for the `server-only` import so a
 * test/script can dynamically import server-only-guarded app code (everything
 * under `@/app/app/api/**`) without the `import "server-only"` guard throwing at
 * module-load time.
 *
 * Lifted VERBATIM (behaviour-identical) from
 * `scripts/book/check-catalog-state.ts` so the integration tests and the
 * publish/maintenance scripts share one implementation. Call it BEFORE the
 * dynamic `import()`, then call the returned function to restore the original
 * loader.
 *
 *   const restore = installServerOnlyShim();
 *   const repo = await import("@/app/app/api/book/_lib/repo");
 *   restore();
 */
export function installServerOnlyShim(): () => void {
  const Module = require("node:module") as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = Module._load;
  Module._load = function patchedLoad(
    request: string,
    parent: unknown,
    isMain: boolean,
  ) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  return () => {
    Module._load = originalLoad;
  };
}
