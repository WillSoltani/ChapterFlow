import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getDueCards, getReviewStats, getAllCards } from "@/app/app/api/book/_lib/fsrs-repo";
import { getRetrievability } from "@/app/app/api/book/_lib/fsrs";

export const runtime = "nodejs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GET(req: Request) {
  return withBookApiErrors<any>(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") ?? "due";
    const bookId = url.searchParams.get("bookId") ?? undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50);

    if (mode === "stats") {
      const stats = await getReviewStats(tableName, user.sub);
      return bookOk({ stats });
    }

    if (mode === "all") {
      const cards = await getAllCards(tableName, user.sub, bookId);
      const now = new Date();
      return bookOk({
        cards: cards.map((card) => ({
          ...card,
          retrievability: getRetrievability(card, now),
        })),
      });
    }

    const bookIds = bookId ? [bookId] : undefined;
    const dueCards = await getDueCards(tableName, user.sub, limit, bookIds);
    const now = new Date();

    return bookOk({
      cards: dueCards.map((card) => ({
        ...card,
        retrievability: getRetrievability(card, now),
      })),
      count: dueCards.length,
    });
  });
}
