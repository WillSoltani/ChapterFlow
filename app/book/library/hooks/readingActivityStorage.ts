"use client";

export type PersistedReadingActivity = {
  totalActiveMs: number;
  dailyActiveMs: Record<string, number>;
  updatedAt: string;
};

export const READING_ACTIVITY_PREFIX = "book-accelerator:reading-activity:v1";

export function getReadingActivityStorageKey(bookId: string, chapterId: string) {
  return `${READING_ACTIVITY_PREFIX}:${bookId}:${chapterId}`;
}

export function parseReadingActivity(raw: string | null): PersistedReadingActivity | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedReadingActivity>;
    return {
      totalActiveMs:
        Number.isFinite(Number(parsed.totalActiveMs)) && Number(parsed.totalActiveMs) >= 0
          ? Math.round(Number(parsed.totalActiveMs))
          : 0,
      dailyActiveMs:
        parsed.dailyActiveMs && typeof parsed.dailyActiveMs === "object"
          ? Object.fromEntries(
              Object.entries(parsed.dailyActiveMs).filter(
                ([dayKey, value]) =>
                  typeof dayKey === "string" &&
                  /^\d{4}-\d{2}-\d{2}$/.test(dayKey) &&
                  Number.isFinite(Number(value)) &&
                  Number(value) >= 0
              )
            )
          : {},
      updatedAt:
        typeof parsed.updatedAt === "string" && parsed.updatedAt.trim()
          ? parsed.updatedAt
          : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function emptyReadingActivity(): PersistedReadingActivity {
  return {
    totalActiveMs: 0,
    dailyActiveMs: {},
    updatedAt: new Date(0).toISOString(),
  };
}

export function toDayKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function appendReadingActivity(
  current: PersistedReadingActivity | null,
  now: Date,
  deltaMs: number
): PersistedReadingActivity {
  const safeDelta = Math.max(0, Math.round(deltaMs));
  const base = current ?? emptyReadingActivity();
  if (safeDelta <= 0) return base;

  const dayKey = toDayKey(now);
  return {
    totalActiveMs: base.totalActiveMs + safeDelta,
    dailyActiveMs: {
      ...base.dailyActiveMs,
      [dayKey]: Math.max(0, Number(base.dailyActiveMs[dayKey] ?? 0)) + safeDelta,
    },
    updatedAt: now.toISOString(),
  };
}

