"use client";

export type PersistedReadingActivity = {
  totalActiveMs: number;
  dailyActiveMs: Record<string, number>;
  /** Hourly breakdown keyed by "YYYY-MM-DDTHH" (e.g. "2026-03-29T14") */
  hourlyActiveMs?: Record<string, number>;
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
      hourlyActiveMs:
        parsed.hourlyActiveMs && typeof parsed.hourlyActiveMs === "object"
          ? Object.fromEntries(
              Object.entries(parsed.hourlyActiveMs as Record<string, unknown>)
                .filter(
                  ([key, value]) =>
                    typeof key === "string" &&
                    /^\d{4}-\d{2}-\d{2}T\d{2}$/.test(key) &&
                    Number.isFinite(Number(value)) &&
                    Number(value) >= 0
                )
                .map(([key, value]) => [key, Number(value)])
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

/**
 * Aggregate hourly reading data for a given day across all book/chapter
 * localStorage entries. Returns an array of 24 entries (hours 0-23).
 */
export function aggregateHourlyForDay(dayKey: string): Array<{ hour: number; minutes: number }> {
  const hourlyMs: number[] = new Array(24).fill(0);

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(READING_ACTIVITY_PREFIX)) continue;

    const parsed = parseReadingActivity(localStorage.getItem(key));
    if (!parsed?.hourlyActiveMs) continue;

    for (let h = 0; h < 24; h++) {
      const hourKey = `${dayKey}T${String(h).padStart(2, "0")}`;
      const ms = Number(parsed.hourlyActiveMs[hourKey] ?? 0);
      if (ms > 0) hourlyMs[h] += ms;
    }
  }

  return hourlyMs.map((ms, hour) => ({
    hour,
    minutes: Math.round(ms / 60000),
  }));
}

export function toHourKey(value: Date): string {
  const dayPart = toDayKey(value);
  if (!dayPart) return "";
  const hour = String(value.getHours()).padStart(2, "0");
  return `${dayPart}T${hour}`;
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
  const hourKey = toHourKey(now);
  return {
    totalActiveMs: base.totalActiveMs + safeDelta,
    dailyActiveMs: {
      ...base.dailyActiveMs,
      [dayKey]: Math.max(0, Number(base.dailyActiveMs[dayKey] ?? 0)) + safeDelta,
    },
    hourlyActiveMs: {
      ...(base.hourlyActiveMs ?? {}),
      [hourKey]: Math.max(0, Number(base.hourlyActiveMs?.[hourKey] ?? 0)) + safeDelta,
    },
    updatedAt: now.toISOString(),
  };
}

