import "server-only";

import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";

export type DdbKey = { PK: string; SK: string };

/**
 * Delete a list of (PK, SK) keys from a single table in chunks of 25 (the
 * DynamoDB BatchWriteItem limit), retrying `UnprocessedItems` a few times within
 * each chunk.
 *
 * Returns BOTH the count actually deleted and the count that survived all retries
 * (still in the table). A non-zero `unprocessed` means the delete is INCOMPLETE —
 * callers MUST surface it (e.g. the per-book reset turns it into a retryable 503,
 * account erasure flags the result `partial`), never report it as fully deleted.
 *
 * Idempotent: deleting an absent key is a no-op, so a retry is safe. Shared by
 * `resetUserBookLearningState` (repo.ts) and `eraseUserData` (account-erasure.ts)
 * so the chunk-and-retry logic lives in exactly one place.
 */
export async function batchDeleteKeys(
  tableName: string,
  keys: DdbKey[]
): Promise<{ deleted: number; unprocessed: number }> {
  let deleted = 0;
  let unprocessed = 0;
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    let requestItems: Record<string, { DeleteRequest: { Key: DdbKey } }[]> = {
      [tableName]: chunk.map((Key) => ({ DeleteRequest: { Key } })),
    };
    let remaining = chunk.length;
    for (let attempt = 0; attempt < 4; attempt++) {
      const pending = requestItems[tableName]?.length ?? 0;
      if (pending === 0) {
        remaining = 0;
        break;
      }
      const res = await ddbDoc.send(new BatchWriteCommand({ RequestItems: requestItems }));
      const leftover = (res.UnprocessedItems ?? {}) as typeof requestItems;
      remaining = leftover[tableName]?.length ?? 0;
      deleted += pending - remaining;
      requestItems = remaining ? leftover : { [tableName]: [] };
    }
    // Whatever is still pending after the final retry was NOT deleted.
    unprocessed += remaining;
  }
  return { deleted, unprocessed };
}
