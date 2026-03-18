"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import type { ProjectRow } from "../_lib/types";
import { ClientDate } from "../[projectId]/components/ClientDate";

export function ProjectCard(props: {
  project: ProjectRow;
  busy: boolean;
  fileCount: number;
  latestActivityAt: string;
  onMenu: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const p = props.project;

  const activityLine =
    props.fileCount > 0 ? (
      <>
        Latest activity <ClientDate iso={props.latestActivityAt} /> •{" "}
        <span className="text-[var(--cf-text-2)]">{props.fileCount} files</span>
      </>
    ) : (
      <>
        No activity yet • <span className="text-[var(--cf-text-2)]">0 files</span>
      </>
    );

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="group relative"
    >
      <div
        className="pointer-events-none absolute -inset-0.5 rounded-[30px] opacity-0 blur-xl transition group-hover:opacity-100
        bg-[radial-gradient(1000px_circle_at_20%_0%,rgba(56,189,248,0.20),transparent_35%),radial-gradient(900px_circle_at_80%_100%,rgba(168,85,247,0.18),transparent_40%)]"
      />

      <Link
        href={`/app/projects/${encodeURIComponent(p.projectId)}`}
        className="cf-panel cf-panel-hover relative block rounded-[26px] p-5 sm:rounded-[30px] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-[var(--cf-text-1)]">
              {p.name}
            </h3>
            <p className="mt-3 text-xs text-[var(--cf-text-3)]">{activityLine}</p>
          </div>

          <button
            type="button"
            onClick={props.onMenu}
            className="opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
            aria-label="Project options"
            title="Options"
          >
            <div className="rounded-full border border-[var(--cf-border)] bg-[var(--cf-surface-muted)] p-2 text-[var(--cf-text-2)] hover:bg-[var(--cf-accent-muted)]">
              <MoreHorizontal className="h-4 w-4" />
            </div>
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end text-xs">
          {props.busy ? (
            <span className="rounded-full border border-[var(--cf-border)] bg-[var(--cf-surface-muted)] px-3 py-1 text-[var(--cf-text-2)]">
              Working…
            </span>
          ) : (
            <span className="opacity-0 transition group-hover:opacity-100 rounded-full border border-[var(--cf-border)] bg-[var(--cf-surface-muted)] px-3 py-1 text-[var(--cf-text-2)]">
              Open →
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
