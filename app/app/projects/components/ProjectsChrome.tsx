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
    <div className="relative min-h-screen text-[var(--cf-text-1)]">
      {!nestedProjectRoute ? (
        <header className="cf-topbar fixed inset-x-0 top-0 z-50">
          <div className="flex w-full items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
              <Link
                href="/"
                className="group inline-flex items-center gap-2 rounded-full border border-[var(--cf-border)] bg-[var(--cf-surface-muted)] px-3 py-1.5 text-xs text-[var(--cf-text-2)] transition hover:bg-[var(--cf-accent-muted)] hover:text-[var(--cf-text-1)] sm:text-sm"
              >
                <span className="text-base opacity-80 group-hover:opacity-100">←</span>
                <span className="hidden sm:inline">Portfolio</span>
                <span className="sm:hidden">Home</span>
              </Link>

              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <div className="cf-icon-wrap grid h-8 w-8 shrink-0 place-items-center rounded-2xl sm:h-9 sm:w-9">
                  <span className="text-base sm:text-lg">⚡</span>
                </div>

                <div className="min-w-0 leading-tight">
                  <p className="truncate text-xs font-semibold text-[var(--cf-text-1)] sm:text-sm">
                    Serverless File Converter
                  </p>
                  <p className="hidden text-xs text-[var(--cf-text-3)] sm:block">
                    Projects, uploads, and pipeline history
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/app/projects?create=1"
              className="cf-btn cf-btn-primary inline-flex shrink-0 rounded-full px-3 py-2 text-xs sm:px-4 sm:text-sm"
            >
              <span className="hidden sm:inline">New Project</span>
              <span className="sm:hidden">New</span>
            </Link>
          </div>

          <div className="h-px w-full bg-[linear-gradient(90deg,transparent,var(--cf-accent-soft),transparent)]" />
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
