import "server-only";

import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import type { EventDefinition } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

// Event definitions would typically come from S3, but for now we return
// an empty array. Populate by uploading event JSON to S3.
export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const events: EventDefinition[] = [];

    // Filter to active events only
    const now = new Date();
    const active = events.filter(
      (e) => new Date(e.startDate) <= now && new Date(e.endDate) >= now,
    );

    return bookOk({ events: active });
  });
}
