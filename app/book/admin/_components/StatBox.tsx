export function StatBox({
  label,
  value,
  hint,
  large = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  large?: boolean;
}) {
  return (
    <div className="cf-panel-muted rounded-xl px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.08em] text-(--cf-text-soft)">{label}</p>
      <p
        className={[
          "mt-0.5 font-semibold tabular-nums tracking-tight text-(--cf-text-1)",
          large ? "text-xl" : "text-cf-body-sm",
        ].join(" ")}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint && <p className="mt-0.5 text-cf-caption text-(--cf-text-3)">{hint}</p>}
    </div>
  );
}
