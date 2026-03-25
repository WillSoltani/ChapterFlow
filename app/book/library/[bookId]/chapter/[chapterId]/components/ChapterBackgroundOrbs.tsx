"use client";

export function ChapterBackgroundOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Orb 1 — teal, top-left */}
      <div
        className="absolute -left-[200px] -top-[100px] h-[600px] w-[600px] rounded-full opacity-[0.12]"
        style={{
          background: "radial-gradient(circle, var(--cr-accent) 0%, transparent 70%)",
          animation: "cr-float 30s ease-in-out infinite alternate",
        }}
      />

      {/* Orb 2 — purple, bottom-right */}
      <div
        className="absolute -bottom-[150px] -right-[200px] h-[500px] w-[500px] rounded-full opacity-[0.10]"
        style={{
          background: "radial-gradient(circle, #2A1A4E 0%, transparent 70%)",
          animation: "cr-float-alt 25s ease-in-out infinite alternate",
        }}
      />

      {/* Orb 3 — teal subtle, center-right */}
      <div
        className="absolute right-[10%] top-[40%] h-[400px] w-[400px] rounded-full opacity-[0.08]"
        style={{
          background: "radial-gradient(circle, var(--cr-accent) 0%, transparent 70%)",
          animation: "cr-float 35s ease-in-out infinite alternate-reverse",
        }}
      />
    </div>
  );
}
