import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  bookOk,
  requireBodyObject,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { putShareEvent } from "@/app/app/api/book/_lib/repo";
import { nowIso } from "@/app/app/api/book/_lib/keys";
import type { BookUserShareEventItem } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

const VALID_CARD_TYPES = new Set(["chapter", "badge", "streak", "book"]);
const VALID_DESTINATIONS = new Set(["clipboard", "twitter", "linkedin", "download"]);

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const body = requireBodyObject(await req.json());

    const cardType = requireString(body, "cardType");
    const destination = requireString(body, "destination");

    if (!VALID_CARD_TYPES.has(cardType)) {
      throw new BookApiError(400, "invalid_card_type", "Invalid cardType.");
    }
    if (!VALID_DESTINATIONS.has(destination)) {
      throw new BookApiError(400, "invalid_destination", "Invalid destination.");
    }

    const now = nowIso();
    const shareId = crypto.randomUUID();

    const event: BookUserShareEventItem = {
      userId: user.sub,
      shareId,
      cardType: cardType as BookUserShareEventItem["cardType"],
      destination: destination as BookUserShareEventItem["destination"],
      referralCode: typeof body.referralCode === "string" ? body.referralCode : "",
      bookId: typeof body.bookId === "string" ? body.bookId : undefined,
      chapterNumber: typeof body.chapterNumber === "number" ? body.chapterNumber : undefined,
      badgeId: typeof body.badgeId === "string" ? body.badgeId : undefined,
      createdAt: now,
    };

    await putShareEvent(tableName, user.sub, event);

    return bookOk({ ok: true, shareId });
  });
}
