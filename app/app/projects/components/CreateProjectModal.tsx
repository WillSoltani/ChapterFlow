"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export function CreateProjectModal(props: {
  open: boolean;
  name: string;
  busy: boolean;
  err: string | null;
  onClose: () => void;
  onNameChange: (v: string) => void;
  onCreate: () => void;
  onClear: () => void;
}) {
  return (
    <AnimatePresence>
      {props.open ? (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={props.onClose}
          />

          <motion.div
            className="fixed inset-x-3 bottom-3 z-60 sm:left-1/2 sm:top-1/2 sm:inset-x-auto sm:w-[92vw] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
          >
            <div className="rounded-[28px] border border-white/10 bg-[#0b1224]/95 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.65)] backdrop-blur sm:rounded-[32px] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/6">
                    <span className="text-xl">＋</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      New Project
                    </p>
                    <p className="text-xs text-slate-400">
                      Create a workspace for uploads and conversions
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={props.onClose}
                  className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <input
                  value={props.name}
                  onChange={(e) => props.onNameChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") props.onCreate();
                  }}
                  placeholder="Enter project name..."
                  className="w-full rounded-2xl border border-white/10 bg-[#070b16]/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-white/20 focus:shadow-[0_0_0_4px_rgba(56,189,248,0.12)]"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={props.onCreate}
                    disabled={props.busy || !props.name.trim()}
                    className="flex-1 rounded-2xl bg-sky-600/90 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50 disabled:hover:bg-sky-600/90 transition shadow-[0_10px_30px_rgba(2,132,199,0.25)]"
                  >
                    {props.busy ? "Creating..." : "Create Project"}
                  </button>

                  <button
                    type="button"
                    onClick={props.onClear}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 hover:bg-white/10 transition"
                    aria-label="Clear"
                    title="Clear"
                  >
                    ✕
                  </button>
                </div>

                {props.err ? (
                  <p className="text-xs text-rose-200">{props.err}</p>
                ) : null}
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
