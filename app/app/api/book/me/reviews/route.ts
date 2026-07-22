import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getDueCardsSorted, getReviewStats, getAllCards } from "@/app/app/api/book/_lib/fsrs-repo";
import { getRetrievability } from "@/app/app/api/book/_lib/fsrs";
import { paginateArray, parseListPaginationParams } from "@/app/app/api/book/_lib/list-pagination-core";
import type { FSRSCardState } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

const REVIEWS_DEFAULT_PAGE_SIZE = 20;
const REVIEWS_MAX_PAGE_SIZE = 50;

const cardCursorKey = (card: FSRSCardState) => ({ id: card.cardId, createdAt: card.createdAt });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GET(req: Request) {
  return withBookApiErrors<any>(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") ?? "due";
    const bookId = url.searchParams.get("bookId") ?? undefined;

    if (mode === "stats") {
      const stats = await getReviewStats(tableName, user.sub);
      return bookOk({ stats });
    }

    if (mode === "all") {
      const cards = await getAllCards(tableName, user.sub, bookId);
      const now = new Date();
      const hasPaginationParams = url.searchParams.has("limit") || url.searchParams.has("cursor");
      if (!hasPaginationParams) {
        // Opt-in only: mode=all has always returned the full, unbounded card
        // set with no query-param gate. Adding a default cap here would be a
        // real behavior change for any caller that never asked for one — so,
        // like saved.get, the additive envelope only appears once the caller
        // explicitly opts in via ?limit=/?cursor=.
        return bookOk({
          cards: cards.map((card) => ({
            ...card,
            retrievability: getRetrievability(card, now),
          })),
        });
      }

      const params = parseListPaginationParams(url, {
        defaultLimit: REVIEWS_DEFAULT_PAGE_SIZE,
        maxLimit: REVIEWS_MAX_PAGE_SIZE,
      });
      const page = paginateArray(cards, {
        limit: params.limit,
        cursor: params.cursor,
        cursorKey: cardCursorKey,
      });
      return bookOk({
        cards: page.items.map((card) => ({ ...card, retrievability: getRetrievability(card, now) })),
        items: page.items.map((card) => ({ ...card, retrievability: getRetrievability(card, now) })),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      });
    }

    // mode === "due" (default). `count` has always meant "cards returned on
    // this page" (it's `dueCards.length` post-slice below, never the total
    // due count) — WS4-004 keeps that exact meaning while adding
    // items/nextCursor/hasMore additively.
    const params = parseListPaginationParams(url, {
      defaultLimit: REVIEWS_DEFAULT_PAGE_SIZE,
      maxLimit: REVIEWS_MAX_PAGE_SIZE,
    });
    const bookIds = bookId ? [bookId] : undefined;
    const allDue = await getDueCardsSorted(tableName, user.sub, bookIds);
    const page = paginateArray(allDue, {
      limit: params.limit,
      cursor: params.cursor,
      cursorKey: cardCursorKey,
    });
    const now = new Date();

    return bookOk({
      cards: page.items.map((card) => ({ ...card, retrievability: getRetrievability(card, now) })),
      count: page.items.length,
      items: page.items.map((card) => ({ ...card, retrievability: getRetrievability(card, now) })),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    });
  });
}
