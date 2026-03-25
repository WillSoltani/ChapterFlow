"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

/* ── Logo Icon (matches /dashboard DashboardNavbar) ── */

function LogoIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M4 7C4 5.9 4.9 5 6 5H12C13.1 5 14 5.9 14 7V21C14 22.1 13.1 23 12 23H6C4.9 23 4 22.1 4 21V7Z"
        stroke="var(--accent-teal)"
        strokeWidth={1.5}
        fill="none"
      />
      <path
        d="M14 7C14 5.9 14.9 5 16 5H22C23.1 5 24 5.9 24 7V21C24 22.1 23.1 23 22 23H16C14.9 23 14 22.1 14 21V7Z"
        stroke="var(--accent-teal)"
        strokeWidth={1.5}
        fill="none"
      />
      <path
        d="M17 12L20 14L17 16"
        stroke="var(--accent-teal)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Data ──────────────────────────────────────────── */

const NAV_LINKS = [
  { id: "how-it-works", label: "How it works" },
  { id: "library", label: "Library" },
  { id: "pricing", label: "Pricing" },
] as const;

const AUTH_URL = "/auth/login?returnTo=%2Fbook";

/* ── Component ─────────────────────────────────────── */

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

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
      { threshold: 0.15, rootMargin: "-10% 0px -70% 0px" },
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
          {/* ── Logo ────────────────────────────── */}
          <Link href="/" className="flex items-center gap-2">
            <LogoIcon />
            <span className="font-(family-name:--font-display) text-[18px] font-semibold text-(--text-heading)">
              ChapterFlow
            </span>
          </Link>

          {/* ── Desktop center links ────────────── */}
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  onClick={() => handleNavClick(link.id)}
                  className={`relative font-(family-name:--font-body) text-[14px] font-medium transition-colors duration-200 ${
                    isActive
                      ? "text-(--text-heading)"
                      : "text-(--text-secondary) hover:text-(--text-heading)"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-dot"
                      className="absolute -bottom-2.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-(--accent-teal)"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  )}
                </a>
              );
            })}
          </div>

          {/* ── Desktop right actions ───────────── */}
          <div className="hidden items-center gap-4 md:flex">
            <a
              href={AUTH_URL}
              className="font-(family-name:--font-body) text-[14px] font-medium text-(--text-secondary) transition-colors duration-200 hover:text-(--text-heading)"
            >
              Sign in
            </a>
            <a
              href={AUTH_URL}
              className="rounded-full bg-(--accent-teal) px-5 py-2 font-(family-name:--font-body) text-[13px] font-semibold text-primary-foreground transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_16px_rgba(45,212,191,0.4)]"
            >
              Start free &rarr;
            </a>
          </div>

          {/* ── Mobile hamburger ────────────────── */}
          <button
            type="button"
            className="relative flex h-8 w-8 flex-col items-center justify-center gap-[5px] md:hidden"
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
                    href={`#${link.id}`}
                    onClick={() => handleNavClick(link.id)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
                    className={`relative font-(family-name:--font-body) text-[24px] font-medium transition-colors duration-200 ${
                      isActive
                        ? "text-(--text-heading)"
                        : "text-(--text-secondary)"
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute -bottom-2 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-(--accent-teal)" />
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
            >
              <a
                href={AUTH_URL}
                className="font-(family-name:--font-body) text-[16px] font-medium text-(--text-secondary) transition-colors duration-200 hover:text-(--text-heading)"
                onClick={closeMobile}
              >
                Sign in
              </a>
              <a
                href={AUTH_URL}
                className="rounded-full bg-(--accent-teal) px-7 py-3 font-(family-name:--font-body) text-[15px] font-semibold text-primary-foreground transition-all duration-200 hover:brightness-110"
                onClick={closeMobile}
              >
                Start free &rarr;
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
