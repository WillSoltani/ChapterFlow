export function QuizPreview() {
  return (
    <div style={{ padding: "0 12px", marginTop: 20, marginBottom: 20 }}>
      <span
        className="text-[8px] font-semibold uppercase"
        style={{ color: "#D4A853", letterSpacing: "0.12em" }}
      >
        Quiz
      </span>

      <div
        className="mt-2 rounded-lg text-center"
        style={{
          background: "var(--bg-glass)",
          border: "1px solid var(--border-subtle)",
          padding: 16,
          opacity: 0.5,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mx-auto">
          <rect x="3" y="9" width="14" height="9" rx="2" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" />
          <path d="M7 9V6a3 3 0 016 0v3" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <circle cx="10" cy="13.5" r="1.5" fill="var(--text-muted)" />
        </svg>
        <p className="text-[9px] mt-1" style={{ color: "var(--text-secondary)" }}>
          Complete the scenarios to unlock the quiz
        </p>
        <p className="text-[8px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          5 questions · ~3 minutes
        </p>
      </div>
    </div>
  );
}
