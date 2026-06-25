// Pure admin-group decision — the single source of truth for "is this user an
// admin?". Admin status is Cognito-group membership (the `cognito:groups` claim
// carried on the verified id_token), NOT an env allowlist of subs/emails: those
// would have to be injected into the prod Lambda to work, and the same check
// already drives `requireAdminUser()`.
//
// Kept free of `server-only` / network so it is unit-testable directly. The
// caller supplies the resolved admin group name (from `getBookAdminGroupName()`)
// and the user's groups (from `requireUser().groups`).

/**
 * True iff `groups` contains `adminGroupName`. Defensive against a missing
 * groups array (synthetic dev-bypass user / a token with no `cognito:groups`
 * claim → not admin) and an empty/whitespace group name (treated as "no admin
 * group configured" → never matches, so a misconfig can't grant admin to all).
 */
export function isUserInAdminGroup(
  groups: readonly string[] | undefined,
  adminGroupName: string,
): boolean {
  const target = adminGroupName.trim();
  if (!target) return false;
  if (!groups || groups.length === 0) return false;
  return groups.includes(target);
}
