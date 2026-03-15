"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { ChapterFlowMark } from "@/app/book/components/ChapterFlowMark";
import { cn } from "@/app/book/components/ui/cn";
import { landingContent } from "@/app/book/components/site/content";

type ChapterFlowLandingNavProps = {
  signInHref: string;
};

export function ChapterFlowLandingNav({
  signInHref,
}: ChapterFlowLandingNavProps) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const dropdownTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: "easeOut" as const };

  return (
    <header className="sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <div className="cf-site-panel relative overflow-hidden rounded-[28px]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(460px_circle_at_0%_0%,rgba(56,189,248,0.14),transparent_44%),radial-gradient(380px_circle_at_100%_0%,rgba(20,184,166,0.12),transparent_40%)]" />

          <div className="relative flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <a href="#top" className="shrink-0">
              <ChapterFlowMark compact />
            </a>

            <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 lg:flex">
              {landingContent.nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3 py-2 text-sm text-slate-300 transition hover:bg-white/[0.08] hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href={signInHref}
                className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              >
                Log in
              </Link>
              <Link
                href={signInHref}
                className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,rgba(94,234,212,0.98),rgba(56,189,248,0.94))] px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(45,212,191,0.22)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <button
              type="button"
              aria-expanded={open}
              aria-controls="chapterflow-mobile-nav"
              onClick={() => setOpen((current) => !current)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 sm:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {open ? (
              <motion.div
                id="chapterflow-mobile-nav"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={dropdownTransition}
                className="overflow-hidden sm:hidden"
              >
                <div className="border-t border-white/10 px-4 pb-4 pt-3">
                  <div className="space-y-1">
                    {landingContent.nav.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-2xl px-3 py-3 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-slate-50"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-2">
                    <Link
                      href={signInHref}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-100 transition",
                        "hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                      )}
                    >
                      Log in
                    </Link>
                    <Link
                      href={signInHref}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,rgba(94,234,212,0.98),rgba(56,189,248,0.94))] px-4 py-3 text-sm font-semibold text-slate-950",
                        "shadow-[0_16px_40px_rgba(45,212,191,0.22)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
                      )}
                    >
                      Start free
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
