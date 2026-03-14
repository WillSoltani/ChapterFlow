"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#070b16]/65 backdrop-blur-xl">
      <div className="flex w-full items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3.5">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href={backHref}
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10 sm:text-sm"
          >
            <span className="text-base opacity-80 group-hover:opacity-100">←</span>
            <span className="max-w-[42vw] truncate sm:max-w-none">{backLabel}</span>
          </Link>

          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] sm:h-9 sm:w-9">
              <span className="text-lg">📁</span>
            </div>
            <div className="leading-tight">
              <p className="max-w-[52vw] truncate text-xs font-semibold text-slate-100 sm:max-w-none sm:text-sm">{projectName}</p>
              <p className="hidden text-xs text-slate-400 sm:block">{fileCount} {fileCount === 1 ? "file" : "files"}</p>
            </div>
          </div>
        </div>

        <div className="h-8 w-8 sm:h-9 sm:w-9" aria-hidden="true" />
      </div>

      <div className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.18),transparent)]" />
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
      <div className="relative min-h-screen text-slate-100">
        <ProjectHeader projectId={projectId} projectName={projectName} guestMode={guestMode} />
        <main className="w-full px-0 pb-10 pt-16 sm:pt-20">
          {children}
        </main>
      </div>
    </FileCountProvider>
  );
}
