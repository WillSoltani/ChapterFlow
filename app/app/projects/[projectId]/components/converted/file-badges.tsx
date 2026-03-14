"use client";

import type { ReactNode } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { LocalConvertedFile } from "../../_lib/ui-types";

export function StatusBadge({ status }: { status: LocalConvertedFile["status"] }) {
  if (status === "done")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
        <Check className="h-3 w-3" />Done
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-200">
        <AlertCircle className="h-3 w-3" />Failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
      <Loader2 className="h-3 w-3 animate-spin" />Processing
    </span>
  );
}

export function Badge(props: { children: ReactNode; tone?: "active" }) {
  const cls =
    props.tone === "active"
      ? "bg-sky-500/15 text-sky-200 border-sky-400/20"
      : "bg-white/5 text-slate-200 border-white/10";
  return (
    <span className={["inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", cls].join(" ")}>
      {props.children}
    </span>
  );
}

export function MultiOutputBadge({ file }: { file: LocalConvertedFile }) {
  if (file.packaging !== "zip") return null;
  const count = file.outputCount ?? file.pageCount ?? 0;
  if (count <= 1) return <Badge>ZIP</Badge>;
  return <Badge>{`${count} pages (ZIP)`}</Badge>;
}

export function Checkbox({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={[
        "grid h-6 w-6 shrink-0 place-items-center rounded-md border transition",
        checked
          ? "border-sky-400/40 bg-sky-500/20 text-sky-200"
          : "border-white/15 bg-white/5 text-transparent hover:bg-white/10",
      ].join(" ")}
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  );
}
