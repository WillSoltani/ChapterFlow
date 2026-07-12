import { withBookApiErrors, bookOk } from "../../_lib/http";
import { BookApiError } from "../../_lib/errors";
import {
  buildIosAppConfig,
  IosConfigValidationError,
} from "./config-core";

export const runtime = "nodejs";

/**
 * Public, cacheable native-iOS launch config.
 *
 * The app fetches this on every launch to drive its force-update gate,
 * kill-switch feature flags, StoreKit product list, and maintenance mode —
 * see `config-core.ts` for the full contract. It is intentionally unauthenticated
 * (the app hits it before the user has a session, and force-update must work even
 * when auth is down) — middleware.ts passes everything under `/app/api/` through
 * without a cookie check, so no session is required.
 *
 * Values come straight from the server Lambda's env vars. Invalid required
 * identity fails closed with an uncached 503; successful validated responses use
 * `max-age=300`, balancing origin load with operational flag propagation.
 */
export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    let config;
    try {
      config = buildIosAppConfig(process.env);
    } catch (error) {
      if (error instanceof IosConfigValidationError) {
        throw new BookApiError(
          503,
          "ios_config_unavailable",
          "The iOS application configuration is temporarily unavailable.",
          { issues: error.issues },
        );
      }
      throw error;
    }
    return bookOk(config, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    });
  });
}
