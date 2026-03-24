"use client";

export function ProBadge() {
  return (
    <span
      aria-hidden="true"
      className="relative ml-1.5 inline-flex items-center overflow-hidden rounded-full bg-gradient-to-r from-amber-500/25 via-rose-500/25 to-pink-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
    >
      <span className="relative z-10 bg-gradient-to-r from-amber-300 to-pink-300 bg-clip-text text-transparent">
        Pro
      </span>
      {/* Shimmer sweep */}
      <span className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      {/* Subtle glow */}
      <span className="absolute inset-0 rounded-full shadow-[inset_0_0_4px_rgba(251,191,36,0.15)]" />
    </span>
  );
}
