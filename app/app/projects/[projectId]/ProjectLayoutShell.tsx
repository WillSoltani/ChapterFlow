"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, FolderOpen } from "lucide-react";
import { FileCountProvider, useFileCount } from "./FileCountContext";

function ProjectHeader({
  projectName,
  projectId,
  guestMode,
}: {
  projectName: string;
  projectId: string;
  guestMode?: boolean;
}) {
  const pathname = usePathname();
  const inFillFlow = pathname.includes("/fill/");
  const backHref = inFillFlow
    ? `/app/projects/${encodeURIComponent(projectId)}`
    : guestMode
      ? "/projects/serverless-file-pipeline"
      : "/app/projects";
  const backLabel = inFillFlow
    ? `Back to ${projectName}`
    : guestMode
      ? "Back to Case Study"
      : "Back to Projects";
  const fileCount = useFileCount();
  return (
    <header className="cf-topbar fixed inset-x-0 top-0 z-50">
      <div className="flex w-full items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3.5">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href={backHref}
            className="cf-btn cf-btn-secondary group rounded-full px-3 py-1.5 text-xs sm:text-sm"
          >
            <ChevronLeft className="h-4 w-4 opacity-80 transition group-hover:opacity-100" />
            <span className="max-w-[42vw] truncate sm:max-w-none">{backLabel}</span>
          </Link>

          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="cf-icon-wrap grid h-8 w-8 shrink-0 place-items-center rounded-2xl sm:h-9 sm:w-9">
              <FolderOpen className="h-4.5 w-4.5" />
            </div>
            <div className="leading-tight">
              <p className="max-w-[52vw] truncate text-xs font-semibold text-[var(--cf-text-1)] sm:max-w-none sm:text-sm">
                {projectName}
              </p>
              <p className="hidden text-xs text-[var(--cf-text-3)] sm:block">
                {fileCount} {fileCount === 1 ? "file" : "files"}
              </p>
            </div>
          </div>
        </div>

        <div className="h-8 w-8 sm:h-9 sm:w-9" aria-hidden="true" />
      </div>

      <div className="h-px w-full bg-[linear-gradient(90deg,transparent,var(--cf-accent-muted),transparent)]" />
    </header>
  );
}

export function ProjectLayoutShell({
  projectId,
  projectName,
  initialFileCount,
  guestMode,
  children,
}: {
  projectId: string;
  projectName: string;
  initialFileCount: number;
  guestMode?: boolean;
  children: React.ReactNode;
}) {
  return (
    <FileCountProvider initial={initialFileCount}>
      <div className="relative min-h-screen text-[var(--cf-text-1)]">
        <ProjectHeader projectId={projectId} projectName={projectName} guestMode={guestMode} />
        <main className="w-full px-0 pb-10 pt-16 sm:pt-20">
          {children}
        </main>
      </div>
    </FileCountProvider>
  );
}
