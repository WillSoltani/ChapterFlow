import "server-only";

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { BookApiError } from "./errors";
import { bookUserPk, HIGHLIGHT_SK_PREFIX, highlightSk, nowIso } from "./keys";
import type { ParsedHighlightUpdate } from "./notebook-highlights-core";
import { queryAllItems } from "./repo-shared";
import type { BookUserHighlightItem } from "./types";

/**
 * Persistence for first-class reader highlights (Feature B6). Rows live under
 * the user partition keyed `HIGHLIGHT#<highlightId>` so a per-user Query lists
 * them and the account-erasure partition sweep deletes them. Validation lives in
 * notebook-highlights-core.ts (pure); this module is the `server-only` DynamoDB
 * seam, mirroring commitment-repo.ts.
 */

export async function createHighlight(
  tableName: string,
  item: BookUserHighlightItem,
): Promise<BookUserHighlightItem> {
  const now = nowIso();
  const record: BookUserHighlightItem = { ...item, createdAt: now, updatedAt: now };
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(item.userId),
        SK: highlightSk(item.highlightId),
        entity: "BOOK_USER_HIGHLIGHT",
        ...record,
      },
      ConditionExpression: "attribute_not_exists(SK)",
    }),
  );
  return record;
}

export async function getHighlight(
  tableName: string,
  userId: string,
  highlightId: string,
): Promise<BookUserHighlightItem | null> {
  const result = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: highlightSk(highlightId) },
    }),
  );
  return (result.Item as BookUserHighlightItem) ?? null;
}

export async function listHighlights(
  tableName: string,
  userId: string,
): Promise<BookUserHighlightItem[]> {
  // WS4-009: paginate to completion (was a single unpaginated QueryCommand,
  // which silently truncated at the first 1MB page).
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": bookUserPk(userId),
      ":prefix": HIGHLIGHT_SK_PREFIX,
    },
  });
  return rows as BookUserHighlightItem[];
}

/**
 * Apply a validated partial update to a highlight. Throws
 * `BookApiError(404, "not_found")` when the highlight does not exist (the
 * `attribute_exists(SK)` guard fails), so a user can't touch another user's row
 * (wrong partition → not found).
 */
export async function updateHighlight(
  tableName: string,
  userId: string,
  highlightId: string,
  patch: ParsedHighlightUpdate,
): Promise<BookUserHighlightItem | null> {
  const now = nowIso();
  // Alias every mutable field (`#color`/`#snippet`/`#anchor`) defensively so a
  // future DynamoDB reserved word can't break the expression, matching the
  // house style in commitment-repo.ts.
  const setParts: string[] = ["updatedAt = :now"];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ":now": now };

  if (patch.color !== undefined) {
    setParts.push("#color = :color");
    names["#color"] = "color";
    values[":color"] = patch.color;
  }
  if (patch.snippet !== undefined) {
    setParts.push("#snippet = :snippet");
    names["#snippet"] = "snippet";
    values[":snippet"] = patch.snippet;
  }
  if (patch.anchor !== undefined) {
    setParts.push("#anchor = :anchor");
    names["#anchor"] = "anchor";
    values[":anchor"] = patch.anchor;
  }

  try {
    const result = await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: bookUserPk(userId), SK: highlightSk(highlightId) },
        UpdateExpression: `SET ${setParts.join(", ")}`,
        ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
        ExpressionAttributeValues: values,
        ConditionExpression: "attribute_exists(SK)",
        ReturnValues: "ALL_NEW",
      }),
    );
    return (result.Attributes as BookUserHighlightItem) ?? null;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      throw new BookApiError(404, "not_found", "Highlight not found.");
    }
    throw err;
  }
}

/**
 * Delete a highlight. Throws `BookApiError(404, "not_found")` when it does not
 * exist so a delete of a missing / other-user row is a clean 404, not a silent
 * success.
 */
export async function deleteHighlight(
  tableName: string,
  userId: string,
  highlightId: string,
): Promise<void> {
  try {
    await ddbDoc.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { PK: bookUserPk(userId), SK: highlightSk(highlightId) },
        ConditionExpression: "attribute_exists(SK)",
      }),
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      throw new BookApiError(404, "not_found", "Highlight not found.");
    }
    throw err;
  }
}
