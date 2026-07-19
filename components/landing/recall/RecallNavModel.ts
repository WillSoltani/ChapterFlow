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
