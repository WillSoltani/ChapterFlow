export const PUBLIC_NAV_DESKTOP_QUERY = "(min-width: 1024px)";
export const PUBLIC_NAV_MENU_ID = "chapterflow-public-navigation";

export type PublicNavLink =
  | {
      id: string;
      label: string;
      kind: "section";
      target: string;
    }
  | {
      id: string;
      label: string;
      kind: "route";
      target: `/${string}`;
    };

export const PUBLIC_NAV_LINKS = [
  { id: "how", label: "How it works", kind: "section", target: "how-it-works" },
  { id: "why", label: "Why it works", kind: "section", target: "why-it-works" },
  { id: "books", label: "Books", kind: "route", target: "/books" },
  { id: "pricing", label: "Pricing", kind: "route", target: "/pricing" },
  { id: "support", label: "Support", kind: "route", target: "/contact" },
] as const satisfies readonly PublicNavLink[];

/**
 * Routes that middleware auth-gates (307 → /auth/login → Cognito) for
 * anonymous visitors. A Next <Link> prefetches its route on viewport entry;
 * for these routes the prefetch follows that redirect chain to another origin
 * and the browser blocks it under CSP connect-src 'self' — a console error on
 * every public page view and a wasted request. Clicks are unaffected.
 */
export const AUTH_GATED_NAV_ROUTES: ReadonlySet<string> = new Set(["/books"]);

/**
 * Extra <Link> props for a public nav link: `{ prefetch: false }` for an
 * auth-gated route while the visitor is not known to be logged in (loading
 * counts as not logged in — the first paint is anonymous), otherwise nothing,
 * so Next's default prefetch applies. Returned as a spreadable object because
 * exactOptionalPropertyTypes forbids passing `prefetch={undefined}`.
 */
export function publicNavPrefetchProps(
  link: PublicNavLink,
  loggedIn: boolean,
): { prefetch: false } | Record<string, never> {
  if (link.kind !== "route") return {};
  return !loggedIn && AUTH_GATED_NAV_ROUTES.has(link.target) ? { prefetch: false } : {};
}

export function publicNavHref(pathname: string, link: PublicNavLink): string {
  if (link.kind === "route") return link.target;
  return pathname === "/" ? `#${link.target}` : `/#${link.target}`;
}

export function isPublicNavCurrent(pathname: string, route: string): boolean {
  const normalizedPath =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const normalizedRoute = route.length > 1 ? route.replace(/\/+$/, "") : route;
  return (
    normalizedPath === normalizedRoute ||
    normalizedPath.startsWith(`${normalizedRoute}/`)
  );
}

export function shouldShowPersistentCta({
  hasSentinel,
  sentinelTop,
  headerBottom,
  suppressionVisible,
}: {
  hasSentinel: boolean;
  sentinelTop: number | null;
  headerBottom: number;
  suppressionVisible: boolean;
}): boolean {
  if (suppressionVisible) return false;
  if (!hasSentinel) return true;
  return sentinelTop != null && sentinelTop <= headerBottom;
}
