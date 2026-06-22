"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStatus } from "@/components/auth/useAuthStatus";
import { performLogout } from "@/lib/logout";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { track } from "@/lib/analytics";

/* ── Logo Icon (matches /dashboard DashboardNavbar) ── */

function LogoIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M4 7C4 5.9 4.9 5 6 5H12C13.1 5 14 5.9 14 7V21C14 22.1 13.1 23 12 23H6C4.9 23 4 22.1 4 21V7Z"
        stroke="var(--accent-cyan)"
        strokeWidth={1.5}
        fill="none"
      />
      <path
        d="M14 7C14 5.9 14.9 5 16 5H22C23.1 5 24 5.9 24 7V21C24 22.1 23.1 23 22 23H16C14.9 23 14 22.1 14 21V7Z"
        stroke="var(--accent-cyan)"
        strokeWidth={1.5}
        fill="none"
      />
      <path
        d="M17 12L20 14L17 16"
        stroke="var(--accent-cyan)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Data ──────────────────────────────────────────── */

// Instrument-header anchors: mono §NN · LABEL, matching the folio/spec-sheet system
// the whole page runs on. The `num` is the section's folio stamp; `label` is its
// short name. Anchor ids MUST match real section ids on app/page.tsx
// (#retention-engine = §01 signature, #features = §02 Ledger spec, #why-it-works =
// §03 trust/evidence, #library = §04 catalog index, #pricing = §05 terms).
const NAV_LINKS = [
  { id: "retention-engine", num: "01", label: "LOOP" },
  { id: "features", num: "02", label: "SPEC" },
  { id: "why-it-works", num: "03", label: "EVIDENCE" },
  { id: "library", num: "04", label: "LIBRARY" },
  { id: "pricing", num: "05", label: "PRICING" },
] as const;

const AUTH_URL = AUTH_LOGIN_BOOK_URL;

/* ── Component ─────────────────────────────────────── */

export function Navbar() {
  const { loggedIn, loading, user } = useAuthStatus();
  const pathname = usePathname();
  // Section anchors (#retention-engine, #features, …) only exist on the home page.
  // Off-home (e.g. /pricing, /books) they must point back to /#section.
  const anchorHref = useCallback(
    (id: string) => (pathname === "/" ? `#${id}` : `/#${id}`),
    [pathname],
  );
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const authResolved = !loading;
  const isLoggedIn = loggedIn === true;
  const displayName = user?.displayName ?? "Reader";

  const linkIds = useMemo(() => NAV_LINKS.map((l) => l.id), []);

  /* ── Scroll detection (100px threshold) ────────── */

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Close mobile menu on resize to desktop ─────── */

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ── Lock body scroll when mobile menu open ─────── */

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  /* ── Escape closes menu + Tab focus trap (aria-modal) ──── */

  // The overlay declares role="dialog" aria-modal="true", so per WCAG 2.4.3 focus
  // must NOT escape it while open: Tab/Shift+Tab cycle first↔last focusable inside
  // the dialog instead of landing on the page content behind the modal.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  /* ── Focus first link when mobile menu opens ───── */

  useEffect(() => {
    if (mobileOpen) {
      const t = setTimeout(() => firstLinkRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [mobileOpen]);

  /* ── IntersectionObserver for active section ─────── */

  useEffect(() => {
    const elements = linkIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0),
          )[0];

        if (visible?.target?.id) {
          setActiveSection(visible.target.id);
        }
      },
      // threshold 0 (not 0.15): the §01 signature section is ~420svh tall, so its
      // max intersectionRatio inside the -10%/-70% band is ~5% — a 0.15 threshold
      // would never fire for it and the §01 LOOP nav link could never light. The
      // band keeps ~one section in view at a time; the ratio sort still picks it.
      { threshold: 0, rootMargin: "-10% 0px -70% 0px" },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [linkIds]);

  /* ── Handlers ───────────────────────────────────── */

  const handleNavClick = useCallback((id: string) => {
    setActiveSection(id);
    setMobileOpen(false);
  }, []);

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <>
      {/* ── Header ──────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={
          scrolled
            ? {
                background: "color-mix(in srgb, var(--bg-base) 80%, transparent)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderBottom: "1px solid var(--border-subtle)",
              }
            : {
                background: "transparent",
                borderBottom: "1px solid transparent",
              }
        }
      >
        <nav className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4">
          {/* ── Logo + spec stamp ───────────────── */}
          <Link href="/" className="flex items-center gap-2.5">
            <LogoIcon />
            <span className="font-(family-name:--font-display) text-[18px] font-semibold text-(--text-heading)">
              ChapterFlow
            </span>
            {/* mono spec stamp — part of the instrument-header system */}
            <span
              aria-hidden
              className="hidden cf-folio rounded border px-1.5 py-0.5 leading-none sm:inline-block"
              style={{
                color: "var(--cf-axis-tint)",
                borderColor: "var(--border-subtle)",
              }}
            >
              SPEC v1.0
            </span>
          </Link>

          {/* ── Desktop center links — §NN · LABEL spec anchors ── */}
          <div className="hidden items-center gap-6 md:flex lg:gap-7">
            {NAV_LINKS.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <a
                  key={link.id}
                  href={anchorHref(link.id)}
                  onClick={() => handleNavClick(link.id)}
                  className={`relative cf-folio rounded transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2 ${
                    isActive
                      ? "text-(--text-heading)"
                      : "text-(--text-tertiary) hover:text-(--text-heading)"
                  }`}
                >
                  <span style={{ color: isActive ? "var(--accent-cyan)" : "var(--cf-axis-tint)" }}>
                    §{link.num}
                  </span>{" "}
                  {link.label}
                  {/* cyan underline marks the active section */}
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-2 left-0 h-px w-full origin-left rounded-full bg-(--accent-cyan) transition-transform duration-200"
                    style={{ transform: isActive ? "scaleX(1)" : "scaleX(0)" }}
                  />
                </a>
              );
            })}
          </div>

          {/* ── Desktop right actions ───────────── */}
          <div
            className="hidden items-center gap-4 md:flex transition-opacity duration-200"
            style={{
              opacity: authResolved ? 1 : 0,
              pointerEvents: authResolved ? "auto" : "none",
            }}
          >
            {isLoggedIn ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    track("cta_click", { source: "navbar_desktop_signout" });
                    performLogout();
                  }}
                  className="font-(family-name:--font-body) text-[14px] font-medium text-(--text-secondary) transition-colors duration-200 hover:text-(--text-heading) rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
                >
                  Sign out
                </button>
                <Link
                  href="/dashboard"
                  onClick={() => track("cta_click", { source: "navbar_desktop_dashboard" })}
                  className="rounded-full bg-(--accent-cyan) px-5 py-2 font-(family-name:--font-body) text-[13px] font-semibold text-primary-foreground transition-all duration-200 hover:brightness-110 hover:shadow-[var(--shadow-glow-cyan)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
                >
                  {displayName}&rsquo;s Dashboard
                </Link>
              </>
            ) : (
              <>
                <a
                  href={AUTH_URL}
                  onClick={() => track("cta_click", { source: "navbar_desktop_signin" })}
                  className="font-(family-name:--font-body) text-[14px] font-medium text-(--text-secondary) transition-colors duration-200 hover:text-(--text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2 rounded"
                >
                  Sign in
                </a>
                <a
                  href={AUTH_URL}
                  onClick={() => track("cta_click", { source: "navbar_desktop_primary" })}
                  className="rounded-full bg-(--accent-cyan) px-5 py-2 font-(family-name:--font-body) text-[13px] font-semibold text-primary-foreground transition-all duration-200 hover:brightness-110 hover:shadow-[var(--shadow-glow-cyan)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
                >
                  Start reading free &rarr;
                </a>
              </>
            )}
          </div>

          {/* ── Mobile hamburger ────────────────── */}
          <button
            type="button"
            className="relative flex h-11 w-11 flex-col items-center justify-center gap-[5px] md:hidden rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
            onClick={toggleMobile}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            <span
              className="block h-[2px] w-5 rounded-full bg-(--text-heading) transition-all duration-300"
              style={{
                transform: mobileOpen
                  ? "translateY(7px) rotate(45deg)"
                  : "none",
              }}
            />
            <span
              className="block h-[2px] w-5 rounded-full bg-(--text-heading) transition-all duration-300"
              style={{
                opacity: mobileOpen ? 0 : 1,
              }}
            />
            <span
              className="block h-[2px] w-5 rounded-full bg-(--text-heading) transition-all duration-300"
              style={{
                transform: mobileOpen
                  ? "translateY(-7px) rotate(-45deg)"
                  : "none",
              }}
            />
          </button>
        </nav>
      </header>

      {/* ── Mobile overlay ──────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[49] flex flex-col items-center justify-center md:hidden"
            style={{
              background: "color-mix(in srgb, var(--bg-base) 98%, transparent)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
          >
            {/* Mobile nav links — centered */}
            <nav className="flex flex-col items-center gap-8">
              {NAV_LINKS.map((link, i) => {
                const isActive = activeSection === link.id;
                return (
                  <motion.a
                    key={link.id}
                    ref={i === 0 ? firstLinkRef : undefined}
                    href={anchorHref(link.id)}
                    onClick={() => handleNavClick(link.id)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
                    className={`relative font-(family-name:--font-mono) text-[22px] font-medium uppercase tracking-[0.04em] transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2 ${
                      isActive
                        ? "text-(--text-heading)"
                        : "text-(--text-secondary)"
                    }`}
                  >
                    <span style={{ color: "var(--accent-cyan)" }}>§{link.num}</span>{" "}
                    {link.label}
                    {isActive && (
                      <span className="absolute -bottom-2 left-1/2 h-px w-8 -translate-x-1/2 rounded-full bg-(--accent-cyan)" />
                    )}
                  </motion.a>
                );
              })}
            </nav>

            {/* Mobile CTA — at bottom */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.1 + NAV_LINKS.length * 0.08,
                duration: 0.3,
              }}
              className="mt-12 flex flex-col items-center gap-4"
              style={{
                opacity: authResolved ? 1 : 0,
                pointerEvents: authResolved ? "auto" : "none",
              }}
            >
              {isLoggedIn ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      track("cta_click", { source: "navbar_mobile_signout" });
                      closeMobile();
                      performLogout();
                    }}
                    className="font-(family-name:--font-body) text-[16px] font-medium text-(--text-secondary) transition-colors duration-200 hover:text-(--text-heading) rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
                  >
                    Sign out
                  </button>
                  <Link
                    href="/dashboard"
                    onClick={() => {
                      track("cta_click", { source: "navbar_mobile_dashboard" });
                      closeMobile();
                    }}
                    className="rounded-full bg-(--accent-cyan) px-7 py-3 font-(family-name:--font-body) text-[15px] font-semibold text-primary-foreground transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
                  >
                    {displayName}&rsquo;s Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <a
                    href={AUTH_URL}
                    className="font-(family-name:--font-body) text-[16px] font-medium text-(--text-secondary) transition-colors duration-200 hover:text-(--text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2 rounded"
                    onClick={() => {
                      track("cta_click", { source: "navbar_mobile_signin" });
                      closeMobile();
                    }}
                  >
                    Sign in
                  </a>
                  <a
                    href={AUTH_URL}
                    className="rounded-full bg-(--accent-cyan) px-7 py-3 font-(family-name:--font-body) text-[15px] font-semibold text-primary-foreground transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
                    onClick={() => {
                      track("cta_click", { source: "navbar_mobile_primary" });
                      closeMobile();
                    }}
                  >
                    Start reading free &rarr;
                  </a>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
