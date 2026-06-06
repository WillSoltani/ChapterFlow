import { requireActiveBookUser } from "./account-guard";
import { BookApiError } from "./errors";
import { getBookAdminGroupName } from "./env";

export async function requireAdminUser() {
  // Enforce account lifecycle status before the admin group check: a
  // deactivated/deleted account must not be able to operate admin endpoints.
  const user = await requireActiveBookUser();
  const adminGroup = await getBookAdminGroupName();
  const groups = user.groups ?? [];
  if (!groups.includes(adminGroup)) {
    throw new BookApiError(403, "forbidden", "Admin access is required.");
  }
  return user;
}
