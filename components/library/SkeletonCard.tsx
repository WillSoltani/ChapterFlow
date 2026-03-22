"use client";

interface SkeletonCardProps {
  variant?: "discover" | "browse" | "continue";
}

function ShimmerBar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-shimmer rounded ${className}`}
      style={{ background: "var(--bg-elevated)", ...style }}
    />
  );
}

export function SkeletonCard({ variant = "discover" }: SkeletonCardProps) {
  if (variant === "continue") {
    return (
      <div
        className="flex overflow-hidden"
        style={{
          background: "var(--bg-glass)",
          border: "1px solid var(--border-medium)",
          borderRadius: "var(--radius-xl-val)",
        }}
      >
        <ShimmerBar className="!rounded-none h-[140px] w-[100px] flex-shrink-0" />
        <div className="flex flex-1 flex-col justify-between p-5">
          <div>
            <ShimmerBar className="h-[18px] w-20" />
            <ShimmerBar className="mt-2 h-[16px] w-3/4" />
            <ShimmerBar className="mt-1.5 h-[12px] w-1/2" />
          </div>
          <div>
            <ShimmerBar className="mt-3 h-[4px] w-full" />
            <ShimmerBar className="mt-2 h-[12px] w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "browse") {
    return (
      <div>
        <ShimmerBar
          className="w-full"
          style={
            { aspectRatio: "2/3", borderRadius: "var(--radius-md-val)" } as React.CSSProperties
          }
        />
        <ShimmerBar className="mt-2 h-[13px] w-4/5" />
        <ShimmerBar className="mt-1.5 h-[11px] w-1/2" />
        <div className="mt-1.5 flex gap-1.5">
          <ShimmerBar className="h-[16px] w-16 rounded-full" />
          <ShimmerBar className="h-[16px] w-10 rounded-full" />
        </div>
      </div>
    );
  }

  // discover (default)
  return (
    <div className="w-[160px] flex-shrink-0">
      <ShimmerBar
        className="w-full"
        style={
          { aspectRatio: "2/3", borderRadius: "var(--radius-md-val)" } as React.CSSProperties
        }
      />
      <ShimmerBar className="mt-2 h-[13px] w-4/5" />
      <ShimmerBar className="mt-1.5 h-[11px] w-1/2" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex gap-3.5 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} variant="discover" />
      ))}
    </div>
  );
}
