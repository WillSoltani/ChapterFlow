import "server-only";

// Server entrypoint. The implementation lives in client-ip-core.ts (no
// server-only) so it can be unit-tested; this file just marks it server-only
// and re-exports.
export { readClientIp, coarseNetworkPrefix } from "./client-ip-core";
