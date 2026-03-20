import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import {
  bookOk,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserSettingsItem,
  putUserSettingsItem,
} from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeSettings(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...existing };

  for (const [key, value] of Object.entries(incoming)) {
    if (isRecord(value) && isRecord(existing[key])) {
      next[key] = mergeSettings(existing[key] as Record<string, unknown>, value);
      continue;
    }
    next[key] = value;
  }

  return next;
}

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const item = await getUserSettingsItem(tableName, user.sub);
    return bookOk({
      settings: item?.settings ?? null,
      updatedAt: item?.updatedAt ?? null,
    });
  });
}

export async function PATCH(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const existing = await getUserSettingsItem(tableName, user.sub);

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }

    const body = requireBodyObject(bodyRaw);
    const settings =
      body.settings && typeof body.settings === "object" && !Array.isArray(body.settings)
        ? (body.settings as Record<string, unknown>)
        : body;
    const mergedSettings = mergeSettings(existing?.settings ?? {}, settings);

    const saved = await putUserSettingsItem(tableName, {
      userId: user.sub,
      settings: mergedSettings,
      createdAt: existing?.createdAt,
    });

    return bookOk({
      settings: saved.settings,
      updatedAt: saved.updatedAt,
    });
  });
}
