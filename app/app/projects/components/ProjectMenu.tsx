"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { MenuState } from "../_lib/types";

export function ProjectMenu(props: {
  menu: MenuState;
  viewportW: number;
  onClose: () => void;
  onRename: (projectId: string) => void;
  onDelete: (projectId: string) => void;
}) {
  const { menu } = props;

  return (
    <AnimatePresence>
      {menu.open ? (
        <>
          <motion.div
            className="cf-overlay fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={props.onClose}
          />

          <motion.div
            className="cf-panel-strong fixed z-50 w-44 overflow-hidden rounded-2xl"
            style={{
              left: Math.max(
                12,
                Math.min(menu.x - 176, (props.viewportW || 1000) - 200)
              ),
              top: menu.y + 10,
            }}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
          >
            <button
              type="button"
              className="w-full px-4 py-3 text-left text-sm text-[var(--cf-text-2)] hover:bg-[var(--cf-accent-muted)] hover:text-[var(--cf-text-1)]"
              onClick={() => props.onRename(menu.projectId)}
            >
              Rename
            </button>
            <button
              type="button"
              className="w-full px-4 py-3 text-left text-sm text-[var(--cf-danger-text)] hover:bg-[var(--cf-danger-soft)]"
              onClick={() => props.onDelete(menu.projectId)}
            >
              Delete
            </button>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
