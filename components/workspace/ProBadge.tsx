interface ProBadgeProps {
  className?: string;
}

export function ProBadge({ className = "" }: ProBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${className}`}
      style={{
        background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.08))",
        border: "1px solid rgba(245,158,11,0.25)",
        color: "#F59E0B",
      }}
    >
      PRO
    </span>
  );
}
