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
            className="cf-overlay fixed inset-0 z-50"
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
            <div className="cf-panel-strong rounded-[28px] p-4 sm:rounded-[32px] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="cf-icon-wrap grid h-11 w-11 place-items-center rounded-2xl">
                    <span className="text-xl">＋</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--cf-text-1)]">
                      New Project
                    </p>
                    <p className="text-xs text-[var(--cf-text-3)]">
                      Create a workspace for uploads and conversions
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={props.onClose}
                  className="rounded-full border border-[var(--cf-border)] bg-[var(--cf-surface-muted)] p-2 text-[var(--cf-text-2)] hover:bg-[var(--cf-accent-muted)]"
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
                  className="cf-input w-full rounded-2xl px-4 py-3 text-sm"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={props.onCreate}
                    disabled={props.busy || !props.name.trim()}
                    className="cf-btn cf-btn-primary flex-1 rounded-2xl px-4 py-3 text-sm"
                  >
                    {props.busy ? "Creating..." : "Create Project"}
                  </button>

                  <button
                    type="button"
                    onClick={props.onClear}
                    className="cf-btn cf-btn-secondary rounded-2xl px-4 py-3 text-sm"
                    aria-label="Clear"
                    title="Clear"
                  >
                    ✕
                  </button>
                </div>

                {props.err ? (
                  <p className="text-xs text-[var(--cf-danger-text)]">{props.err}</p>
                ) : null}
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
