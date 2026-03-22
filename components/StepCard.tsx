import { GlassCard } from "@/components/ui/GlassCard";

interface StepCardProps {
  number: string;
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
}

export function StepCard({
  number,
  icon,
  label,
  title,
  description,
}: StepCardProps) {
  return (
    <GlassCard className="relative overflow-hidden p-7">
      {/* Step number watermark */}
      <span
        className="absolute top-[20px] right-[20px] text-[44px] font-bold text-white/[0.06] select-none"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {number}
      </span>

      {/* Icon container */}
      <div
        className="flex h-10 w-10 items-center justify-center bg-[rgba(79,139,255,0.1)]"
        style={{ borderRadius: "var(--radius-md-val)" }}
      >
        <span className="flex h-5 w-5 items-center justify-center text-(--accent-blue)">
          {icon}
        </span>
      </div>

      {/* Label */}
      <p
        className="mt-4 text-[12px] font-semibold uppercase tracking-[0.15em] text-(--accent-blue)"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {label}
      </p>

      {/* Title */}
      <h3
        className="mt-2 text-[20px] font-semibold text-(--text-heading)"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className="mt-2 text-[14px] leading-[1.6] text-(--text-secondary)"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {description}
      </p>
    </GlassCard>
  );
}
