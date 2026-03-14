export function isDevAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_AUTH_BYPASS === "1"
  );
}

export const DEV_BYPASS_USER = {
  sub: "dev-local-user",
  email: "dev@localhost",
} as const;

