"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { useAuthStatus } from "@/components/auth/useAuthStatus";
import { Dialog } from "@/components/ui/Dialog";
import { track } from "@/lib/analytics";
import { performLogout } from "@/lib/logout";
import {
  PUBLIC_NAV_DESKTOP_QUERY,
  PUBLIC_NAV_LINKS,
  PUBLIC_NAV_MENU_ID,
  isPublicNavCurrent,
  publicNavHref,
  shouldShowPersistentCta,
} from "./RecallNavModel";

const accentRingStyle = {
  "--tw-ring-color": "var(--cf-recall-accent)",
} as CSSProperties;

const subtleRingStyle = {
  "--tw-ring-color": "var(--cf-recall-accent-line)",
} as CSSProperties;

const navLinkClass =
  "inline-flex min-h-11 items-center rounded-lg px-2 text-[0.875rem] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

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

export function RecallNav() {
  const pathname = usePathname() || "/";
  const { loggedIn, loading } = useAuthStatus();
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const [showPersistentCta, setShowPersistentCta] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = useId();
  const authResolved = !loading;
  const isLoggedIn = loggedIn === true;
  const mobileOpen = mobileMenuPath === pathname;

  const closeMobile = useCallback(() => setMobileMenuPath(null), []);

  useEffect(() => {
    const media = window.matchMedia(PUBLIC_NAV_DESKTOP_QUERY);
    const closeAtDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) setMobileMenuPath(null);
    };

    closeAtDesktop(media);
    media.addEventListener("change", closeAtDesktop);
    return () => media.removeEventListener("change", closeAtDesktop);
  }, []);

  useEffect(() => {
    const sentinel = document.querySelector<HTMLElement>("[data-public-hero-end]");
    if (!sentinel) {
      const frame = window.requestAnimationFrame(() => setShowPersistentCta(true));
      return () => window.cancelAnimationFrame(frame);
    }

    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const headerBottom = headerRef.current?.getBoundingClientRect().bottom ?? 0;
        setShowPersistentCta(
          shouldShowPersistentCta({
            hasSentinel: true,
            sentinelTop: sentinel.getBoundingClientRect().top,
            headerBottom,
          }),
        );
      });
    };

    update();
    const headerBottom = Math.ceil(
      headerRef.current?.getBoundingClientRect().bottom ?? 0,
    );
    let observer: IntersectionObserver | null = null;
    const supportsObserver = typeof window.IntersectionObserver !== "undefined";

    if (supportsObserver) {
      observer = new window.IntersectionObserver(update, {
        threshold: 0,
        rootMargin: `-${headerBottom}px 0px 0px 0px`,
      });
      observer.observe(sentinel);
    } else {
      window.addEventListener("scroll", update, { passive: true });
    }
    window.addEventListener("resize", update, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      if (!supportsObserver) window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname]);

  const signOut = useCallback(() => {
    closeMobile();
    track("cta_click", { source: "public_nav_signout" });
    performLogout();
  }, [closeMobile]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-lg focus:px-4 focus:font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{
          background: "var(--cf-recall-accent)",
          color: "var(--cf-recall-bg)",
          ...accentRingStyle,
        }}
      >
        Skip to main content
      </a>

      <div className="rl-nav-scrim" aria-hidden="true" />
      <header ref={headerRef} className="rl-nav">
        <Link
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
                aria-current={current ? "page" : undefined}
                className={navLinkClass}
                style={{
                  color: current
                    ? "var(--cf-recall-ink)"
                    : "var(--cf-recall-ink-soft)",
                  ...subtleRingStyle,
                }}
              >
                {link.label}
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

          {showPersistentCta && authResolved && !mobileOpen ? (
            <PrimaryAction loggedIn={isLoggedIn} location="header" />
          ) : null}

          <button
            type="button"
            onClick={() => setMobileMenuPath(pathname)}
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
          className="flex min-h-[100dvh] flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-10"
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
