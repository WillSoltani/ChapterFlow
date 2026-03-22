interface ProBadgeProps {
  className?: string;
}

export function ProBadge({ className = "" }: ProBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${className}`}
      style={{
        background: "linear-gradient(135deg, #F59E0B, #D97706)",
        color: "#000",
        boxShadow: "0 0 10px -2px rgba(245,158,11,0.4)",
      }}
    >
      PRO
    </span>
  );
}
