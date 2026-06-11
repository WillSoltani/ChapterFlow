import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { bookUserPk } from "@/app/app/api/book/_lib/keys";
import type { NotebookEntry } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const pk = bookUserPk(user.sub);

    const url = new URL(req.url);
    const bookIdFilter = url.searchParams.get("bookId");
    const searchFilter = url.searchParams.get("search")?.toLowerCase();

    // Query chapter states for notes + bookmarks
    const chapterStatesResult = await ddbDoc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": pk,
          ":prefix": "CHAPTERSTATE#",
        },
      }),
    );

    const entries: NotebookEntry[] = [];

    for (const item of chapterStatesResult.Items ?? []) {
      const state = item.state as Record<string, unknown> | undefined;
      if (!state) continue;

      const sk = item.SK as string;
      const bookId = (item.bookId as string) || sk.split("#")[1] || "";
      const chapterNumber = Number(item.chapterNumber ?? 0);
      const bookTitle = (item.bookTitle as string) || bookId;
      const chapterTitle = (item.chapterTitle as string) || `Chapter ${chapterNumber}`;

      if (bookIdFilter && bookId !== bookIdFilter) continue;

      // Extract notes
      const notes = state.notes;
      if (typeof notes === "string" && notes.trim()) {
        entries.push({
          id: `note:${bookId}:${chapterNumber}`,
          type: "note",
          bookId,
          bookTitle,
          chapterNumber,
          chapterTitle,
          content: notes,
          tags: [],
          createdAt: (item.updatedAt as string) || (item.createdAt as string) || "",
        });
      }

      // Extract bookmarked takeaways
      const bookmarks = state.bookmarkedTakeaways;
      if (Array.isArray(bookmarks)) {
        for (let i = 0; i < bookmarks.length; i++) {
          const text = bookmarks[i];
          if (typeof text !== "string" || !text.trim()) continue;
          entries.push({
            id: `bookmark:${bookId}:${chapterNumber}:${i}`,
            type: "bookmark",
            bookId,
            bookTitle,
            chapterNumber,
            chapterTitle,
            content: text,
            tags: [],
            createdAt: (item.updatedAt as string) || (item.createdAt as string) || "",
          });
        }
      }
    }

    // Query commitments for follow-through reflections
    const commitmentsResult = await ddbDoc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": pk,
          ":prefix": "COMMITMENT#",
        },
      }),
    );

    for (const item of commitmentsResult.Items ?? []) {
      const reflection = item.followThroughReflection as string | null;
      if (!reflection) continue;

      const bookId = item.bookId as string;
      if (bookIdFilter && bookId !== bookIdFilter) continue;

      entries.push({
        id: `commitment:${item.commitmentId}`,
        type: "commitment",
        bookId,
        bookTitle: bookId,
        chapterNumber: item.chapterNumber as number,
        chapterTitle: `Chapter ${item.chapterNumber}`,
        content: `${item.ifThenPlan}\n\nFollow-through: ${reflection}`,
        tags: [],
        createdAt: (item.followThroughSubmittedAt as string) || "",
      });
    }

    // Apply search filter
    let filtered = entries;
    if (searchFilter) {
      filtered = entries.filter(
        (e) =>
          e.content.toLowerCase().includes(searchFilter) ||
          e.bookTitle.toLowerCase().includes(searchFilter) ||
          e.chapterTitle.toLowerCase().includes(searchFilter),
      );
    }

    // Sort by date descending
    filtered.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    return bookOk({ entries: filtered, totalCount: filtered.length });
  });
}
