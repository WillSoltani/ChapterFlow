"use client";

import type { ReactNode } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { LocalConvertedFile } from "../../_lib/ui-types";

export function StatusBadge({ status }: { status: LocalConvertedFile["status"] }) {
  if (status === "done")
    return (
      <span className="cf-pill cf-pill-success px-2.5 py-1 text-xs font-semibold">
        <Check className="h-3 w-3" />Done
      </span>
    );
  if (status === "failed")
    return (
      <span className="cf-pill cf-pill-danger px-2.5 py-1 text-xs font-semibold">
        <AlertCircle className="h-3 w-3" />Failed
      </span>
    );
  return (
    <span className="cf-pill cf-pill-warning px-2.5 py-1 text-xs font-semibold">
      <Loader2 className="h-3 w-3 animate-spin" />Processing
    </span>
  );
}

export function Badge(props: { children: ReactNode; tone?: "active" }) {
  const cls = props.tone === "active" ? "cf-pill cf-pill-info" : "cf-pill";
  return (
    <span className={["px-2.5 py-1 text-xs font-semibold", cls].join(" ")}>
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
          ? "border-[var(--cf-accent-border)] bg-[var(--cf-accent-soft)] text-[var(--cf-accent)]"
          : "border-[var(--cf-border)] bg-[var(--cf-surface-muted)] text-transparent hover:border-[var(--cf-border-strong)] hover:bg-[var(--cf-input-bg-hover)]",
      ].join(" ")}
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  );
}
