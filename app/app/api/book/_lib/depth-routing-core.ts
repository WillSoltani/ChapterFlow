import { bookUserPk, depthModelSk } from "./keys";

/**
 * DynamoDB primary key for a per-user, per-book depth model item.
 *
 * The app table key schema uses UPPERCASE `PK`/`SK` (see infra appTable in
 * chapterflow-backend-stack.ts). Using lowercase `pk`/`sk` causes DynamoDB to
 * reject Get/Put with a ValidationException (and the route then 500s). Kept in
 * a `server-only`/AWS-free core module so the casing can be unit-tested and the
 * regression guarded against recurring.
 */
export function depthModelKey(
  userId: string,
  bookId: string
): { PK: string; SK: string } {
  return { PK: bookUserPk(userId), SK: depthModelSk(bookId) };
}
