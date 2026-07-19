"use client";

export function ProBadge() {
  return (
    <span
      className="relative inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white overflow-hidden ml-2"
      style={{ background: "linear-gradient(135deg, var(--accent-amber), var(--accent-rose), var(--cf-palette-pink))" }}
    >
      <span>Pro</span>
    </span>
  );
}
