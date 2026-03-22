interface DashboardBookCoverProps {
  title: string;
  gradient: string;
  width?: number;
  height?: number;
  className?: string;
}

export function DashboardBookCover({
  title,
  gradient,
  width = 80,
  height = 112,
  className = "",
}: DashboardBookCoverProps) {
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center ${className}`}
      style={{
        width,
        height,
        background: gradient,
        borderRadius: "var(--radius-md-val)",
        boxShadow:
          "0 6px 20px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1) inset",
      }}
    >
      <span
        className="px-2 text-center font-bold uppercase text-white leading-tight"
        style={{
          fontSize: Math.max(7, Math.min(9, width / 10)),
        }}
      >
        {title}
      </span>
    </div>
  );
}
