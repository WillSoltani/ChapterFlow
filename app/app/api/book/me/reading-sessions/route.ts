import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import {
  bookOk,
  requireBodyObject,
  requireInteger,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  addReadingDayActivity,
  getUserProgress,
  upsertUserProgress,
} from "@/app/app/api/book/_lib/repo";
import { nowIso } from "@/app/app/api/book/_lib/keys";

export const runtime = "nodejs";

function toDayKey(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }

    const body = requireBodyObject(bodyRaw);
    const bookId = requireString(body.bookId, "bookId", { maxLength: 120 });
    const deltaMs = requireInteger(body.deltaMs, "deltaMs", {
      min: 1,
      max: 60 * 60 * 1000,
    });
    const occurredAt =
      typeof body.occurredAt === "string" && body.occurredAt.trim()
        ? body.occurredAt
        : nowIso();
    const dayKey = toDayKey(occurredAt) || toDayKey(nowIso());

    const readingDay = await addReadingDayActivity(tableName, {
      userId: user.sub,
      dayKey,
      deltaMs,
      occurredAt,
    });

    const progress = await getUserProgress(tableName, user.sub, bookId);
    if (progress) {
      await upsertUserProgress(tableName, {
        ...progress,
        lastActiveAt: occurredAt,
        updatedAt: occurredAt,
      });
    }

    return bookOk({
      readingDay,
      trackedMinutesToday: Math.floor(readingDay.totalActiveMs / 60000),
    });
  });
}
