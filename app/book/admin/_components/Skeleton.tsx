export function Skeleton({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-(--cf-surface-muted) ${className}`}
      {...props}
    />
  );
}

export function KPITileSkeleton() {
  return (
    <div className="cf-panel rounded-2xl p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-7 w-24" />
      <Skeleton className="mt-2 h-3 w-16" />
      <Skeleton className="mt-3 h-10 w-full" />
    </div>
  );
}

export function ChartSkeleton({ height = "h-56" }: { height?: string }) {
  return (
    <div className={`${height} flex items-end gap-1.5 px-2`}>
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-t-md"
          style={{ height: `${30 + Math.sin(i * 0.7) * 30 + 30}%` }}
        />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden">
      <div className="flex gap-3 border-b border-(--cf-border) pb-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 border-b border-(--cf-border)/50 py-3">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatBoxSkeleton() {
  return (
    <div className="cf-panel-muted rounded-lg px-3 py-2">
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="mt-1.5 h-5 w-20" />
    </div>
  );
}
