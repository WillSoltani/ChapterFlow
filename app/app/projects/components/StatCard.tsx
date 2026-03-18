"use client";

export function StatCard(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="cf-panel rounded-3xl p-5">
      <div className="flex items-center gap-3 text-[var(--cf-text-2)]">
        <div className="cf-icon-wrap rounded-2xl p-2">
          {props.icon}
        </div>
        <p className="text-xs uppercase tracking-wide">{props.label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold text-[var(--cf-text-1)]">{props.value}</p>
    </div>
  );
}
