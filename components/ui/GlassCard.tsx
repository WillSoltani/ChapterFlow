interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({
  children,
  className = "",
  hover = true,
}: GlassCardProps) {
  return (
    <div
      className={`glass-card ${
        hover
          ? ""
          : "[&]:hover:transform-none [&]:hover:shadow-none [&]:hover:bg-(--bg-glass) [&]:hover:border-(--border-subtle)"
      } ${className}`}
    >
      {children}
    </div>
  );
}
