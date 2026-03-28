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
      className={`flex shrink-0 items-center justify-center shadow-shadow-book ${className}`}
      style={{
        width,
        height,
        aspectRatio: "2/3",
        background: gradient,
        borderRadius: "4px",
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
