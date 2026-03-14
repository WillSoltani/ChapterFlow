"use client";

import { Download, Pin, Plus, X } from "lucide-react";

type NotesDrawerProps = {
  open: boolean;
  onClose: () => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onAddNote: () => void;
  onExport: () => void;
  onPinTakeaway: () => void;
};

export function NotesDrawer({
  open,
  onClose,
  notes,
  onNotesChange,
  onAddNote,
  onExport,
  onPinTakeaway,
}: NotesDrawerProps) {
  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={[
          "fixed z-[60] border-white/12 bg-[#090f1d] shadow-[0_28px_60px_rgba(2,6,23,0.55)] transition-transform duration-200",
          "inset-x-0 bottom-0 max-h-[75vh] rounded-t-3xl border p-4 md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0",
          open ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label="Chapter notes"
      >
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-white/12 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Notes</p>
            <p className="text-sm text-slate-300">Capture your insights for this chapter.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/6 text-slate-200"
            aria-label="Close notes"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddNote}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300/35 bg-sky-500/14 px-3 py-1.5 text-sm text-sky-100"
          >
            <Plus className="h-4 w-4" />
            Add note
          </button>
          <button
            type="button"
            onClick={onPinTakeaway}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/35 bg-amber-500/12 px-3 py-1.5 text-sm text-amber-100"
          >
            <Pin className="h-4 w-4" />
            Pin takeaway
          </button>
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/7 px-3 py-1.5 text-sm text-slate-200"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>

        <textarea
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Write your notes here..."
          className="h-[48vh] w-full resize-none rounded-2xl border border-white/12 bg-white/3 p-4 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45 md:h-[calc(100vh-12.5rem)]"
        />
      </aside>
    </>
  );
}
