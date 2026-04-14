import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "cf-panel-muted rounded-2xl text-center",
        compact ? "px-4 py-6" : "px-6 py-10",
      ].join(" ")}
    >
      <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl bg-(--cf-accent-soft) text-(--cf-accent)">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-3 text-base font-semibold text-(--cf-text-1)">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-(--cf-text-3)">
          {description}
        </p>
      )}
      {action && <div className="mt-4 inline-flex">{action}</div>}
    </div>
  );
}
