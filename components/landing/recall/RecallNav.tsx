"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { useAuthStatus } from "@/components/auth/useAuthStatus";
import { Dialog } from "@/components/ui/Dialog";
import { useLoadMotionFeatures } from "@/components/MotionFeatureProvider";
import { track } from "@/lib/analytics";
import { performLogout } from "@/lib/logout";
import {
  CTA_OFF_ATTR,
  PUBLIC_NAV_DESKTOP_QUERY,
  PUBLIC_NAV_LINKS,
  publicNavPrefetchProps,
  PUBLIC_NAV_MENU_ID,
  isPublicNavCurrent,
  parseNavLook,
  publicNavHref,
  shouldRenderPersistentCta,
  shouldShowPersistentCta,
} from "./RecallNavModel";
import { SKIP_LINK_CLASS, SKIP_LINK_STYLE } from "./skip-link";

const accentRingStyle = {
  "--tw-ring-color": "var(--cf-recall-accent)",
} as CSSProperties;

const subtleRingStyle = {
  "--tw-ring-color": "var(--cf-recall-accent-line)",
} as CSSProperties;

const navLinkClass =
  "inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-[0.875rem] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

const menuLinkClass =
  "inline-flex min-h-11 w-full items-center justify-between rounded-xl px-4 py-2 text-[1.125rem] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

function RecallLogo() {
  return (
    <svg width={18} height={18} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M4 7C4 5.9 4.9 5 6 5H12C13.1 5 14 5.9 14 7V21C14 22.1 13.1 23 12 23H6C4.9 23 4 22.1 4 21V7Z"
        stroke="var(--cf-recall-accent)"
        strokeWidth={1.5}
      />
      <path
        d="M14 7C14 5.9 14.9 5 16 5H22C23.1 5 24 5.9 24 7V21C24 22.1 23.1 23 22 23H16C14.9 23 14 22.1 14 21V7Z"
        stroke="var(--cf-recall-accent)"
        strokeWidth={1.5}
      />
      <path
        d="M17 12L20 14L17 16"
        stroke="var(--cf-recall-accent)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PrimaryAction({
  loggedIn,
  location,
  onActivate,
}: {
  loggedIn: boolean;
  location: "header" | "menu";
  onActivate?: () => void;
}) {
  const href = loggedIn ? "/dashboard" : AUTH_LOGIN_BOOK_URL;
  const label = loggedIn ? "Dashboard" : "Start free";

  return (
    <a
      href={href}
      data-nav-primary={location === "header" ? "" : undefined}
      onClick={() => {
        track("cta_click", { source: `public_nav_${location}_primary` });
        onActivate?.();
      }}
      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-5 text-cf-label font-semibold transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        background: "var(--cf-recall-accent)",
        color: "var(--cf-recall-bg)",
        ...accentRingStyle,
      }}
    >
      {label}
    </a>
  );
}

const noopSubscribe = () => () => {};
const readNavLook = () => parseNavLook(window.location.search);
const serverNavLook = () => 1 as const;

/**
 * `skipLinks`: a page's own skip links, right after "Skip to main content"
 * (the landing's "Skip the film"), so they are among the first tab stops.
 */
export function RecallNav({ skipLinks }: { skipLinks?: ReactNode } = {}) {
  const pathname = usePathname() || "/";
  const { loggedIn, loading } = useAuthStatus();
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  // The persistent start button: hidden, or shown on a page whose hero has
  // its own start button ([data-public-hero-cta], "hero") or not ("page").
  const [persistentCta, setPersistentCta] = useState<false | "page" | "hero">(false);
  const loadMotionFeatures = useLoadMotionFeatures();
  const headerRef = useRef<HTMLElement>(null);
  const brandLinkRef = useRef<HTMLAnchorElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = useId();
  const authResolved = !loading;
  const isLoggedIn = loggedIn === true;
  const mobileOpen = mobileMenuPath === pathname;
  const mobileOpenRef = useRef(mobileOpen);

  const closeMobile = useCallback(() => setMobileMenuPath(null), []);
  // Touch nav look over the film (?nav=1…5, read once; globals.css). Server
  // snapshot 1, so SSR and hydration agree.
  const navLook = useSyncExternalStore(noopSubscribe, readNavLook, serverNavLook);

  useEffect(() => {
    mobileOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  useEffect(() => {
    const media = window.matchMedia(PUBLIC_NAV_DESKTOP_QUERY);
    let focusFrame = 0;
    const closeAtDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
      if (!event.matches) return;
      setMobileMenuPath(null);
      if (mobileOpenRef.current) {
        focusFrame = window.requestAnimationFrame(() => brandLinkRef.current?.focus());
      }
    };

    closeAtDesktop(media);
    media.addEventListener("change", closeAtDesktop);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      media.removeEventListener("change", closeAtDesktop);
    };
  }, []);

  // Persistent CTA: shown once the hero-end sentinel has crossed the header
  // line (or at once on a page whose hero has its own start button,
  // [data-public-hero-cta]), hidden while a suppression zone (an equivalent
  // signup link) is in view below the header and shown (a zone marked
  // data-cta-off, a faded film pin, does not count). Observers only: nothing
  // in the scroll path reads layout (IntersectionObserver for the boxes, a
  // MutationObserver for data-cta-off). The header line is re-read only when
  // the header's own size changes (a ResizeObserver; the 1024px
  // breakpoint), which rebuilds them.
  useEffect(() => {
    const sentinel = document.querySelector<HTMLElement>("[data-public-hero-end]");
    const suppressionZones = Array.from(
      document.querySelectorAll<HTMLElement>("[data-public-sticky-cta-suppress]"),
    );
    const hasHeroCta = document.querySelector("[data-public-hero-cta]") != null;
    const shownAs = hasHeroCta ? "hero" : "page";
    const zoneOff = (zone: Element) => zone.hasAttribute(CTA_OFF_ATTR);
    const header = headerRef.current;
    if (!header || typeof window.IntersectionObserver === "undefined") {
      // Fallback for engines without IntersectionObserver (and jsdom): a
      // rAF-throttled scroll/resize read. Every engine the landing targets
      // has observers, so this path never runs under the film.
      let frame = 0;
      const update = () => {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          const headerBottom = headerRef.current?.getBoundingClientRect().bottom ?? 0;
          const suppressionVisible = suppressionZones.some((zone) => {
            if (zoneOff(zone)) return false;
            const bounds = zone.getBoundingClientRect();
            return bounds.bottom > headerBottom && bounds.top < window.innerHeight;
          });
          setPersistentCta(
            shouldShowPersistentCta({
              hasSentinel: sentinel != null,
              sentinelTop: sentinel?.getBoundingClientRect().top ?? null,
              headerBottom,
              suppressionVisible,
              hasHeroCta,
            })
              ? shownAs
              : false,
          );
        });
      };
      update();
      window.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      return () => {
        window.cancelAnimationFrame(frame);
        window.removeEventListener("scroll", update);
        window.removeEventListener("resize", update);
      };
    }

    let headerBottom = 0;
    // null while the sentinel is below the header line (or not yet observed).
    let sentinelTop: number | null = null;
    const zoneVisible = new Map<Element, boolean>();
    const publish = () => {
      let suppressionVisible = false;
      for (const [zone, v] of zoneVisible) suppressionVisible ||= v && !zoneOff(zone);
      setPersistentCta(
        shouldShowPersistentCta({
          hasSentinel: sentinel != null,
          sentinelTop,
          headerBottom,
          suppressionVisible,
          hasHeroCta,
        })
          ? shownAs
          : false,
      );
    };
    // A zone's start link fading in or out (data-cta-off) re-decides.
    const offWatch =
      typeof window.MutationObserver === "undefined"
        ? null
        : new window.MutationObserver(publish);
    for (const zone of suppressionZones)
      offWatch?.observe(zone, { attributes: true, attributeFilter: [CTA_OFF_ATTR] });

    let observers: IntersectionObserver[] = [];
    const build = () => {
      for (const o of observers) o.disconnect();
      headerBottom = Math.ceil(header.getBoundingClientRect().bottom);
      // A zone counts while it is in view between the header line and the
      // viewport bottom.
      const zones = new window.IntersectionObserver(
        (entries) => {
          for (const e of entries) zoneVisible.set(e.target, e.isIntersecting);
          publish();
        },
        { threshold: 0, rootMargin: `-${headerBottom}px 0px 0px 0px` },
      );
      for (const zone of suppressionZones) zones.observe(zone);
      observers = [zones];
      if (sentinel) {
        // The sentinel's root is everything from the header line DOWN (the
        // bottom margin reaches far below the viewport), so it intersects
        // exactly while it is below the line. A jump across the line in one
        // step (an anchor into a later section, a restored scroll position,
        // the film reel's tall hero) still flips that state and reports.
        const line = new window.IntersectionObserver(
          (entries) => {
            const e = entries[entries.length - 1];
            if (!e) return;
            sentinelTop = e.isIntersecting ? null : e.boundingClientRect.top;
            publish();
          },
          { threshold: 0, rootMargin: `-${headerBottom}px 0px 1000000px 0px` },
        );
        line.observe(sentinel);
        observers.push(line);
      }
    };

    // Without ResizeObserver (Safari 12.2-13.0): build once and rebuild on
    // window resize (not a scroll-path read).
    if (typeof window.ResizeObserver === "undefined") {
      build();
      window.addEventListener("resize", build);
      return () => {
        window.removeEventListener("resize", build);
        for (const o of observers) o.disconnect();
        offWatch?.disconnect();
      };
    }

    // Delivers once on observe (the first build), then on header size changes.
    let lastSize = "";
    const sized = new window.ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.borderBoxSize?.[0];
      const size = box ? `${box.inlineSize}x${box.blockSize}` : "";
      if (size && size === lastSize) return;
      lastSize = size;
      build();
    });
    sized.observe(header);

    return () => {
      sized.disconnect();
      for (const o of observers) o.disconnect();
      offWatch?.disconnect();
    };
  }, [pathname]);

  const signOut = useCallback(() => {
    closeMobile();
    track("cta_click", { source: "public_nav_signout" });
    performLogout();
  }, [closeMobile]);

  return (
    <>
      <a href="#main" className={SKIP_LINK_CLASS} style={SKIP_LINK_STYLE}>
        Skip to main content
      </a>
      {skipLinks}

      <div className="rl-nav-scrim" data-nav-look={navLook} aria-hidden="true" />
      <header ref={headerRef} className="rl-nav" data-nav-look={navLook}>
        <Link
          ref={brandLinkRef}
          href="/"
          className="rl-nav-brand min-h-11 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          aria-label="ChapterFlow home"
          aria-current={pathname === "/" ? "page" : undefined}
          style={subtleRingStyle}
        >
          <span className="rl-nav-mark" aria-hidden="true">
            <RecallLogo />
          </span>
          <span
            className="font-(family-name:--font-display)"
            style={{ color: "var(--cf-recall-ink)" }}
          >
            ChapterFlow
          </span>
        </Link>

        <nav className="hidden items-center gap-3 lg:flex" aria-label="Primary">
          {PUBLIC_NAV_LINKS.map((link) => {
            const href = publicNavHref(pathname, link);
            const current =
              link.kind === "route" && isPublicNavCurrent(pathname, link.target);
            return (
              <Link
                key={link.id}
                href={href}
                {...publicNavPrefetchProps(link, isLoggedIn)}
                aria-current={current ? "page" : undefined}
                className={navLinkClass}
                style={{
                  color: current
                    ? "var(--cf-recall-ink)"
                    : "var(--cf-recall-ink-soft)",
                  ...subtleRingStyle,
                }}
              >
                <span>{link.label}</span>
                {current ? (
                  <span
                    data-public-current-marker
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--cf-recall-accent)" }}
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 lg:gap-3">
          {authResolved ? (
            isLoggedIn ? (
              <button
                type="button"
                onClick={signOut}
                className="hidden min-h-11 items-center rounded-lg px-2 text-cf-label font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 lg:inline-flex"
                style={{ color: "var(--cf-recall-ink-soft)", ...subtleRingStyle }}
              >
                Sign out
              </button>
            ) : (
              <a
                href={AUTH_LOGIN_BOOK_URL}
                onClick={() =>
                  track("cta_click", { source: "public_nav_header_signin" })
                }
                className="hidden min-h-11 items-center rounded-lg px-2 text-cf-label font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 lg:inline-flex"
                style={{ color: "var(--cf-recall-ink-soft)", ...subtleRingStyle }}
              >
                Sign in
              </a>
            )
          ) : null}

          {shouldRenderPersistentCta({
            show: persistentCta !== false,
            authResolved,
            hasHeroCta: persistentCta === "hero",
            mobileOpen,
          }) ? (
            <PrimaryAction loggedIn={isLoggedIn} location="header" />
          ) : null}

          <button
            type="button"
            onClick={() => setMobileMenuPath(pathname)}
            // Intent: start loading the menu's animation features before the
            // tap lands (no-op outside the landing's MotionFeatureGate).
            onPointerEnter={loadMotionFeatures}
            onTouchStart={loadMotionFeatures}
            onFocus={loadMotionFeatures}
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
            aria-expanded={mobileOpen}
            aria-controls={PUBLIC_NAV_MENU_ID}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 lg:hidden"
            style={{ color: "var(--cf-recall-ink)", ...subtleRingStyle }}
          >
            <Menu size={21} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </header>

      <Dialog
        open={mobileOpen}
        onClose={closeMobile}
        labelledBy={dialogTitleId}
        initialFocusRef={closeButtonRef}
        size="fullscreen"
        className="rl-public-menu landing-dark"
      >
        <div
          id={PUBLIC_NAV_MENU_ID}
          className="rl-public-menu-body flex min-h-[100dvh] flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-10"
        >
          <div className="flex min-h-11 items-center justify-between gap-4">
            <h2
              id={dialogTitleId}
              className="font-(family-name:--font-display) text-[1.125rem] font-semibold"
              style={{ color: "var(--cf-recall-ink)" }}
            >
              Navigation
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeMobile}
              aria-label="Close navigation menu"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ color: "var(--cf-recall-ink)", ...subtleRingStyle }}
            >
              <X size={22} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Primary" className="my-auto py-10">
            <ul className="mx-auto flex w-full max-w-lg flex-col gap-2">
              {PUBLIC_NAV_LINKS.map((link) => {
                const href = publicNavHref(pathname, link);
                const current =
                  link.kind === "route" &&
                  isPublicNavCurrent(pathname, link.target);
                return (
                  <li key={link.id}>
                    <Link
                      href={href}
                      {...publicNavPrefetchProps(link, isLoggedIn)}
                      onClick={closeMobile}
                      aria-current={current ? "page" : undefined}
                      className={menuLinkClass}
                      style={{
                        color: current
                          ? "var(--cf-recall-ink)"
                          : "var(--cf-recall-ink-soft)",
                        background: current
                          ? "var(--cf-recall-accent-wash)"
                          : "transparent",
                        ...subtleRingStyle,
                      }}
                    >
                      <span>{link.label}</span>
                      {current ? (
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: "var(--cf-recall-accent)" }}
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {authResolved ? (
            <div
              className="mx-auto flex w-full max-w-lg flex-col gap-3 border-t pt-6"
              style={{ borderColor: "var(--cf-recall-frame)" }}
            >
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-cf-body font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ color: "var(--cf-recall-ink-soft)", ...subtleRingStyle }}
                >
                  Sign out
                </button>
              ) : (
                <a
                  href={AUTH_LOGIN_BOOK_URL}
                  onClick={() => {
                    track("cta_click", { source: "public_nav_menu_signin" });
                    closeMobile();
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-cf-body font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ color: "var(--cf-recall-ink-soft)", ...subtleRingStyle }}
                >
                  Sign in
                </a>
              )}
              <PrimaryAction
                loggedIn={isLoggedIn}
                location="menu"
                onActivate={closeMobile}
              />
            </div>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
