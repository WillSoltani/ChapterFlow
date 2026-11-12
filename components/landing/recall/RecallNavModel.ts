import { isProtectedSurfacePath } from "@/lib/protected-surface";

export const PUBLIC_NAV_DESKTOP_QUERY = "(min-width: 1024px)";
export const PUBLIC_NAV_MENU_ID = "chapterflow-public-navigation";

/**
 * On a suppression zone ([data-public-sticky-cta-suppress]): the zone's start
 * link is not shown right now although its box is in view (a film pin faded
 * out; FramePin writes it). The nav treats such a zone as out of view.
 */
export const CTA_OFF_ATTR = "data-cta-off";

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
 * Whether a same-origin href answers a logged-out visitor with a redirect to
 * another origin: a protected surface (the middleware's own rule,
 * lib/protected-surface: /book, /app, /dashboard and below; the public
 * catalog /books is not one) sends them to /auth/login, and the /auth/ routes
 * hand off to Cognito. A Next <Link> prefetches its route on viewport entry;
 * for these the prefetch follows the redirect chain to Cognito and the
 * browser blocks it under CSP connect-src 'self' — a console error and a
 * wasted request. Clicks are unaffected.
 */
function hrefPath(href: string): string {
  return href.split(/[?#]/, 1)[0] ?? href;
}

function isAuthRoute(path: string): boolean {
  return path === "/auth" || path.startsWith("/auth/");
}

/**
 * `{ prefetch: false }` for a link whose prefetch would follow a sign-in
 * redirect: an /auth/ route always, a protected surface unless the visitor is
 * known to be logged in. A component that cannot know the login state (the
 * server-rendered footer, the catalog's book cards) omits `loggedIn`: the
 * anonymous first paint would otherwise prefetch into the login redirect. A
 * client component that has it (CityChapters, via useAuthStatus) passes it,
 * so a logged-in visitor keeps Next's default prefetch. Returned as a
 * spreadable object because exactOptionalPropertyTypes forbids passing
 * `prefetch={undefined}`.
 */
export function gatedRoutePrefetchProps(
  href: string,
  loggedIn = false,
): { prefetch: false } | Record<string, never> {
  const path = hrefPath(href);
  if (isAuthRoute(path)) return { prefetch: false };
  return !loggedIn && isProtectedSurfacePath(path) ? { prefetch: false } : {};
}

/** {@link gatedRoutePrefetchProps} for a public nav link (sections never prefetch). */
export function publicNavPrefetchProps(
  link: PublicNavLink,
  loggedIn: boolean,
): { prefetch: false } | Record<string, never> {
  if (link.kind !== "route") return {};
  return gatedRoutePrefetchProps(link.target, loggedIn);
}

/**
 * Touch nav look over the film (globals.css, data-nav-look): ?nav=1…5, read
 * once at mount. Temporary until the owner picks one; 1 is the default.
 */
export function parseNavLook(search: string): 1 | 2 | 3 | 4 | 5 {
  const raw = new URLSearchParams(search).get("nav");
  return raw === "2" ? 2 : raw === "3" ? 3 : raw === "4" ? 4 : raw === "5" ? 5 : 1;
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

/**
 * The nav's persistent start button. Hidden while a suppression zone (an
 * equivalent start link) is shown below the header. Otherwise shown once the
 * hero-end sentinel has crossed the header line, or at once on a page whose
 * hero carries its own start button (`hasHeroCta`, the film landing's
 * [data-public-hero-cta]): that button is itself a suppression zone, so the
 * nav's takes over the moment it fades or scrolls away instead of when the
 * whole hero chapter has passed.
 */
export function shouldShowPersistentCta({
  hasSentinel,
  sentinelTop,
  headerBottom,
  suppressionVisible,
  hasHeroCta = false,
}: {
  hasSentinel: boolean;
  sentinelTop: number | null;
  headerBottom: number;
  suppressionVisible: boolean;
  hasHeroCta?: boolean;
}): boolean {
  if (suppressionVisible) return false;
  if (hasHeroCta || !hasSentinel) return true;
  return sentinelTop != null && sentinelTop <= headerBottom;
}

/**
 * Whether the header renders its persistent start button now. It waits for
 * the session (it shows "Dashboard" to a signed-in visitor) except on a page
 * whose hero carries its own start button (the film landing): there the nav's
 * button is what keeps a start button in reach once the hero's fades, so
 * while the session is unresolved (slow, or failing and left unresolved by
 * useAuthStatus) it shows the signed-out "Start free", the same link the
 * film's own buttons always show. Never while the mobile menu is open.
 */
export function shouldRenderPersistentCta({
  show,
  authResolved,
  hasHeroCta,
  mobileOpen,
}: {
  show: boolean;
  authResolved: boolean;
  hasHeroCta: boolean;
  mobileOpen: boolean;
}): boolean {
  return show && !mobileOpen && (authResolved || hasHeroCta);
}
