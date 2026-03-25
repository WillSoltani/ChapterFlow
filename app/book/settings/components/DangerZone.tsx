"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Trash2, X } from "lucide-react";
import { Button } from "@/app/book/components/ui/Button";
import { cn } from "@/app/book/components/ui/cn";

type DangerZoneProps = {
  onDeactivate: () => void;
  onDelete: () => void;
  reducedMotion?: boolean;
};

export function DangerZone({ onDeactivate, onDelete, reducedMotion }: DangerZoneProps) {
  const [deleteModal, setDeleteModal] = useState(false);
  const [deactivateModal, setDeactivateModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);

  // Close modals on Escape
  useEffect(() => {
    if (!deleteModal && !deactivateModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDeleteModal(false);
        setDeactivateModal(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteModal, deactivateModal]);

  function handleStartDelete() {
    setDeleteModal(true);
    setDeleteStep(1);
    setConfirmText("");
  }

  function handleConfirmDelete() {
    if (deleteStep === 1) {
      setDeleteStep(2);
    } else if (confirmText === "DELETE") {
      setDeleteModal(false);
      setConfirmText("");
      onDelete();
    }
  }

  return (
    <>
      <div className="mt-4 rounded-2xl border border-(--cf-danger-border) bg-(--cf-danger-bg) p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-(--cf-danger-text)">
          Danger zone
        </p>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => setDeactivateModal(true)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-(--cf-danger-border) px-4 py-3 text-left text-sm font-medium text-(--cf-text-2) transition-colors hover:bg-(--cf-danger-bg) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-danger-border)"
          >
            <LogOut className="h-4 w-4 text-(--cf-danger-text)" />
            <div>
              <span className="text-(--cf-text-1)">Deactivate account</span>
              <p className="text-xs text-(--cf-text-3)">
                Temporarily disable your account. Your data will be preserved.
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={handleStartDelete}
            className="flex w-full items-center gap-2.5 rounded-xl border border-(--cf-danger-border) px-4 py-3 text-left text-sm font-medium text-(--cf-text-2) transition-colors hover:bg-(--cf-danger-bg) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-danger-border)"
          >
            <Trash2 className="h-4 w-4 text-(--cf-danger-text)" />
            <div>
              <span className="text-(--cf-danger-text)">Delete account &amp; all data</span>
              <p className="text-xs text-(--cf-text-3)">
                Permanently erase your account and all associated data. This cannot be
                undone.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Deactivate Modal */}
      <AnimatePresence>
        {deactivateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              className="absolute inset-0 bg-(--cf-overlay) backdrop-blur-sm"
              onClick={() => setDeactivateModal(false)}
            />
            <motion.div
              initial={reducedMotion ? false : { scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reducedMotion ? undefined : { scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md rounded-3xl bg-(--cf-surface-strong) border border-(--cf-border) p-6 shadow-xl"
            >
              <h3 className="text-lg font-bold text-(--cf-text-1)">
                Deactivate your account?
              </h3>
              <p className="mt-2 text-sm text-(--cf-text-3)">
                Your reading history, streaks, and progress will be saved. You can
                reactivate anytime by signing back in.
              </p>
              <div className="mt-5 flex gap-2.5">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setDeactivateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => {
                    setDeactivateModal(false);
                    onDeactivate();
                  }}
                >
                  Deactivate
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal (two-step) */}
      <AnimatePresence>
        {deleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              className="absolute inset-0 bg-(--cf-overlay) backdrop-blur-sm"
              onClick={() => setDeleteModal(false)}
            />
            <motion.div
              initial={reducedMotion ? false : { scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reducedMotion ? undefined : { scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md rounded-3xl bg-(--cf-surface-strong) border border-(--cf-border) p-6 shadow-xl"
            >
              <button
                type="button"
                onClick={() => setDeleteModal(false)}
                aria-label="Close"
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full hover:bg-(--cf-surface-muted) text-(--cf-text-soft)"
              >
                <X className="h-4 w-4" />
              </button>

              {deleteStep === 1 ? (
                <>
                  <h3 className="text-lg font-bold text-(--cf-text-1)">Are you sure?</h3>
                  <p className="mt-2 text-sm text-(--cf-text-3)">
                    This will permanently delete:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-(--cf-text-2)">
                    <li>&bull; All your reading history and progress</li>
                    <li>&bull; Quiz results and highlights</li>
                    <li>&bull; Streaks and badges</li>
                    <li>&bull; Account settings and preferences</li>
                  </ul>
                  <div className="mt-5 flex gap-2.5">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => setDeleteModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={handleConfirmDelete}
                    >
                      Continue
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-(--cf-danger-text)">
                    Final confirmation
                  </h3>
                  <p className="mt-2 text-sm text-(--cf-text-3)">
                    Type <strong className="text-(--cf-text-1)">DELETE</strong> to
                    permanently erase your account.
                  </p>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    placeholder="Type DELETE"
                    className="cf-input mt-3 w-full rounded-xl px-3 py-2 text-sm font-mono uppercase tracking-widest"
                    autoFocus
                  />
                  <div className="mt-5 flex gap-2.5">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => setDeleteModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      disabled={confirmText !== "DELETE"}
                      onClick={handleConfirmDelete}
                    >
                      Permanently delete
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
