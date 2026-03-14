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
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={props.onClose}
          />

          <motion.div
            className="fixed z-50 w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1224]/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur"
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
              className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-white/10"
              onClick={() => props.onRename(menu.projectId)}
            >
              Rename
            </button>
            <button
              type="button"
              className="w-full px-4 py-3 text-left text-sm text-rose-200 hover:bg-rose-500/10"
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
