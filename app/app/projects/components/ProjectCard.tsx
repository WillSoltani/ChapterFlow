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
        <span className="text-slate-300">{props.fileCount} files</span>
      </>
    ) : (
      <>
        No activity yet • <span className="text-slate-300">0 files</span>
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
        className="relative block rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_14px_40px_rgba(0,0,0,0.40)] sm:rounded-[30px] sm:p-7
          transition group-hover:border-white/15 group-hover:bg-white/7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-slate-100">
              {p.name}
            </h3>
            <p className="mt-3 text-xs text-slate-400">{activityLine}</p>
          </div>

          <button
            type="button"
            onClick={props.onMenu}
            className="opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
            aria-label="Project options"
            title="Options"
          >
            <div className="rounded-full border border-white/10 bg-white/8 p-2 text-slate-200 hover:bg-white/12">
              <MoreHorizontal className="h-4 w-4" />
            </div>
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end text-xs">
          {props.busy ? (
            <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-slate-200">
              Working…
            </span>
          ) : (
            <span className="opacity-0 transition group-hover:opacity-100 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
              Open →
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
