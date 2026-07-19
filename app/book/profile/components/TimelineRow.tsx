"use client";



export function TimelineRow({ title, detail, meta }: { title: string; detail: string; meta: string }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3.5">
      <div className="flex flex-col items-center">
        <span className="mt-1 inline-flex h-3 w-3 rounded-full bg-(--cf-accent)" />
        <span className="mt-2 h-full w-px bg-(--cf-border)" />
      </div>
      <div>
        <p className="text-sm font-medium text-(--cf-text-1)">{title}</p>
        <p className="mt-1 text-sm leading-6 text-(--cf-text-3)">{detail}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-(--cf-text-3)">{meta}</p>
      </div>
    </div>
  );
}
