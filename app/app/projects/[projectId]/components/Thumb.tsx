"use client";

function extChip(text: string) {
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5">
      <span className="text-[10px] font-semibold tracking-wide text-slate-200/90">
        {text}
      </span>
    </div>
  );
}

export function Thumb(props: { src?: string; alt: string; fallbackLabel?: string }) {
  const src = props.src?.trim();

  // Always show ext/format if we don't have a src
  if (!src) return extChip((props.fallbackLabel ?? "IMG").toUpperCase());

  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
      {/* If image fails, hide it and keep a visible fallback */}
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-[10px] font-semibold tracking-wide text-slate-200/90">
          {(props.fallbackLabel ?? "IMG").toUpperCase()}
        </span>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- thumbs render signed or object URLs that are not optimized by next/image. */}
      <img
        key={src}
        src={src}
        alt={props.alt}
        className="absolute inset-0 h-full w-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </div>
  );
}
