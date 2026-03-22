export function ChapterHeader() {
  return (
    <div style={{ padding: "0 12px" }}>
      {/* Back button */}
      <div className="flex items-center gap-1" style={{ color: "var(--accent-blue)" }}>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M5 1L2 4L5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[10px]">Atomic Habits</span>
      </div>

      {/* Book info row */}
      <div className="flex gap-2.5 mt-2">
        {/* Book cover thumbnail */}
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 36,
            height: 50,
            borderRadius: 6,
            background: "linear-gradient(135deg, #D97706, #B45309)",
          }}
        >
          <span className="text-white text-[5px] font-bold uppercase tracking-wider text-center leading-tight px-1">
            Atomic Habits
          </span>
        </div>

        <div className="min-w-0">
          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>Chapter 3</span>
          <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--text-heading)" }}>
            How to Build Better Habits in 4 Simple Steps
          </p>
          <span className="text-[9px]" style={{ color: "var(--accent-blue)" }}>James Clear</span>
        </div>
      </div>

      {/* Progress bar - 4 segments */}
      <div className="flex gap-0.5 mt-2.5">
        {["completed", "active", "upcoming", "upcoming"].map((state, i) => (
          <div
            key={i}
            className="flex-1 rounded-full"
            style={{
              height: 3,
              background:
                state === "completed" ? "var(--accent-teal)" :
                state === "active" ? "var(--accent-blue)" :
                "var(--bg-elevated)",
            }}
          />
        ))}
      </div>
      <span className="text-[8px] mt-1 block" style={{ color: "var(--text-muted)" }}>
        Step 2 of 4 · Scenario
      </span>

      {/* Depth selector pills */}
      <div className="flex gap-1.5 mt-2">
        {["Simple", "Standard", "Deeper"].map((depth) => (
          <span
            key={depth}
            className="text-[8px] rounded-full"
            style={{
              padding: "3px 10px",
              background: depth === "Standard" ? "var(--accent-blue)" : "var(--bg-elevated)",
              color: depth === "Standard" ? "white" : "var(--text-muted)",
              border: depth === "Standard" ? "none" : "1px solid var(--border-subtle)",
            }}
          >
            {depth}
          </span>
        ))}
      </div>
    </div>
  );
}
