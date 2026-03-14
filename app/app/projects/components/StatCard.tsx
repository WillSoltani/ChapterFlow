"use client";

export function StatCard(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-3 text-slate-300">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200">
          {props.icon}
        </div>
        <p className="text-xs uppercase tracking-wide">{props.label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-100">{props.value}</p>
    </div>
  );
}
