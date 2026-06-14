interface ProBadgeProps {
  className?: string;
}

export function ProBadge({ className = "" }: ProBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${className}`}
      style={{
        background: "linear-gradient(135deg, var(--accent-amber), var(--accent-gold))",
        color: "#000",
        boxShadow: "0 0 10px -2px var(--accent-amber-glow)",
      }}
    >
      PRO
    </span>
  );
}
