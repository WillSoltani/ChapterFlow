import { requireUser } from "@/app/app/api/_lib/auth";
import { BookApiError } from "./errors";
import { getBookAdminGroupName } from "./env";

export async function requireAdminUser() {
  const user = await requireUser();
  const adminGroup = await getBookAdminGroupName();
  const groups = user.groups ?? [];
  if (!groups.includes(adminGroup)) {
    throw new BookApiError(403, "forbidden", "Admin access is required.");
  }
  return user;
}
