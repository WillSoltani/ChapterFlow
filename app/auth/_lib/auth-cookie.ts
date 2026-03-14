import "server-only";

type AuthCookieBase = {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  domain?: string;
};

function normalizeCookieDomain(value: string | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

export function getAuthCookieDomain(): string | undefined {
  return normalizeCookieDomain(
    process.env.AUTH_COOKIE_DOMAIN || process.env.CHAPTERFLOW_COOKIE_DOMAIN
  );
}

export function getAuthCookieBase(): AuthCookieBase {
  const secure = process.env.NODE_ENV === "production";
  const domain = secure ? getAuthCookieDomain() : undefined;
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    ...(domain ? { domain } : {}),
  };
}
