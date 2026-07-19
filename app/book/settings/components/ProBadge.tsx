"use client";

export function ProBadge() {
  return (
    <span
      className="relative inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white overflow-hidden ml-2"
      style={{ background: "linear-gradient(135deg, var(--accent-amber), var(--accent-rose), var(--cf-palette-pink))" }}
    >
      <span className="relative z-10">Pro</span>
      <span
        className="absolute inset-0 z-0 animate-[proShimmer_3s_ease-in-out_infinite]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--cf-palette-white) 15%, transparent) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
        }}
      />
    </span>
  );
}
