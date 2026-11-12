/**
 * Which paths the middleware sends a logged-out visitor to sign-in for.
 *
 * A path is a protected surface when its first segment is one of the roots
 * below: `/book` and anything under `/book/`, likewise `/app` and
 * `/dashboard`. The match is by whole path segment, so the public catalog page
 * `/books` is NOT protected (the old rule, a raw `startsWith("/book")`, sent it
 * to sign-in while robots, the sitemap and the landing's SearchAction called
 * it public).
 *
 * The check is deliberately generous about odd spellings, so that none of
 * them turns a protected surface public: it lowercases, turns backslashes into
 * slashes, collapses repeated slashes, resolves dot segments, and looks at the
 * raw path and at its percent-decoded forms (up to three rounds, for
 * double-encoded slashes); if any form starts with a protected root, the path
 * is protected. A first segment that is a root followed by a character that
 * cannot continue a word (`/book;x`, `/book.json`, `/book%00`, `/app-x`)
 * counts as that root.
 *
 * Every route under app/ that the old raw prefix matched was checked
 * (lib/protected-surface.test.ts): /app, /book, /dashboard and /books. No
 * other route (no /bookmarks, no /application) exists, so none needs an
 * explicit entry; the test fails if one appears.
 *
 * Pure and Edge-safe: imported by middleware.ts and by client components that
 * decide whether a <Link> may prefetch.
 */

export const PROTECTED_SURFACE_ROOTS = ["app", "book", "dashboard"] as const;

const MAX_DECODE_ROUNDS = 3;

/** The raw path and each successive percent-decoding of it, while it changes. */
function pathForms(pathname: string): string[] {
  const forms = [pathname];
  let current = pathname;
  for (let i = 0; i < MAX_DECODE_ROUNDS; i += 1) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      break; // malformed %-sequence: the forms so far are judged
    }
    if (next === current) break;
    forms.push(next);
    current = next;
  }
  return forms;
}

/** First path segment after normalising slashes and dot segments, lowercased. */
function firstSegment(form: string): string {
  const stack: string[] = [];
  for (const segment of form.replace(/\\/g, "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  return (stack[0] ?? "").toLowerCase();
}

function isProtectedSegment(segment: string): boolean {
  return PROTECTED_SURFACE_ROOTS.some((root) => {
    if (!segment.startsWith(root)) return false;
    const next = segment.charAt(root.length);
    // Exactly the root, or the root followed by junk that cannot be part of
    // another word (books, bookmarks, application stay distinct segments).
    return next === "" || !/[a-z0-9_]/.test(next);
  });
}

/** True when the middleware must send a visitor without a session to sign-in. */
export function isProtectedSurfacePath(pathname: string): boolean {
  return pathForms(pathname).some((form) => isProtectedSegment(firstSegment(form)));
}
