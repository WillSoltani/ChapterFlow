import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import {
  bookOk,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserChapterState,
  putUserChapterState,
} from "@/app/app/api/book/_lib/repo";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { nowIso } from "@/app/app/api/book/_lib/keys";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookId: string; chapterNumber: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const { bookId, chapterNumber } = await params;
    const parsedChapterNumber = Number(chapterNumber);
    if (!bookId || !Number.isFinite(parsedChapterNumber) || parsedChapterNumber < 1) {
      throw new BookApiError(400, "invalid_chapter", "Invalid chapter number.");
    }
    const tableName = await getBookTableName();
    const state = await getUserChapterState(
      tableName,
      user.sub,
      bookId,
      Math.floor(parsedChapterNumber)
    );
    return bookOk({ state: state ?? null });
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ bookId: string; chapterNumber: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const { bookId, chapterNumber } = await params;
    const parsedChapterNumber = Number(chapterNumber);
    if (!bookId || !Number.isFinite(parsedChapterNumber) || parsedChapterNumber < 1) {
      throw new BookApiError(400, "invalid_chapter", "Invalid chapter number.");
    }

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }
    const body = requireBodyObject(bodyRaw);
    const rawState =
      body.state && typeof body.state === "object" && !Array.isArray(body.state)
        ? (body.state as Record<string, unknown>)
        : body;

    const tableName = await getBookTableName();
    const existing = await getUserChapterState(
      tableName,
      user.sub,
      bookId,
      Math.floor(parsedChapterNumber)
    );
    const now = nowIso();
    const state = {
      userId: user.sub,
      bookId,
      chapterNumber: Math.floor(parsedChapterNumber),
      chapterId:
        typeof body.chapterId === "string"
          ? body.chapterId
          : existing?.chapterId,
      state: rawState,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await putUserChapterState(tableName, state);
    return bookOk({ state });
  });
}
