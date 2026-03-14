"use client";

export function SiteFooter() {
  return (
    <div className="mt-10 flex flex-col items-center justify-center gap-2 text-center">
      <div className="h-px w-full max-w-6xl bg-white/5" />

      <p className="mt-6 text-xs text-slate-500">
        © {new Date().getFullYear()} Will Soltani · Hosted on AWS
      </p>
    </div>
  );
}
