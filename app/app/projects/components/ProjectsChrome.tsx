"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function isNestedProjectRoute(pathname: string): boolean {
  const path = pathname.split("?")[0];
  const parts = path.split("/").filter(Boolean);
  return parts[0] === "app" && parts[1] === "projects" && parts.length > 2;
}

export function ProjectsChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const nestedProjectRoute = isNestedProjectRoute(pathname);

  return (
    <div className="relative min-h-screen text-slate-100">
      {!nestedProjectRoute ? (
        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#070b16]/55 backdrop-blur-xl">
          <div className="flex w-full items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
              <Link
                href="/"
                className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10 sm:text-sm"
              >
                <span className="text-base opacity-80 group-hover:opacity-100">←</span>
                <span className="hidden sm:inline">Portfolio</span>
                <span className="sm:hidden">Home</span>
              </Link>

              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 sm:h-9 sm:w-9">
                  <span className="text-base sm:text-lg">⚡</span>
                </div>

                <div className="min-w-0 leading-tight">
                  <p className="truncate text-xs font-semibold text-slate-100 sm:text-sm">
                    Serverless File Converter
                  </p>
                  <p className="hidden text-xs text-slate-400 sm:block">
                    Projects, uploads, and pipeline history
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/app/projects?create=1"
              className="inline-flex shrink-0 items-center rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/15 sm:px-4 sm:text-sm"
            >
              <span className="hidden sm:inline">New Project</span>
              <span className="sm:hidden">New</span>
            </Link>
          </div>

          <div className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.18),transparent)]" />
        </header>
      ) : null}

      <div
        className={
          nestedProjectRoute
            ? "pt-0"
            : "px-3 pb-8 pt-20 sm:px-6 sm:pb-10 sm:pt-24"
        }
      >
        {children}
      </div>
    </div>
  );
}
