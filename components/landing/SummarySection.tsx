export function SummarySection() {
  return (
    <div style={{ padding: "0 12px", marginTop: 16 }}>
      <span
        className="text-[8px] font-semibold uppercase"
        style={{ color: "var(--accent-blue)", letterSpacing: "0.12em" }}
      >
        Summary
      </span>

      {/* Summary card */}
      <div
        className="mt-2 rounded-lg"
        style={{
          background: "var(--bg-glass)",
          border: "1px solid var(--border-subtle)",
          padding: 12,
        }}
      >
        <span
          className="text-[7px] font-semibold uppercase"
          style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
        >
          Main Idea
        </span>
        <p className="text-[9px] mt-1" style={{ color: "var(--text-primary)", lineHeight: 1.6 }}>
          All habits follow a four step pattern: cue, craving, response, and reward. The cue triggers a craving, which motivates a response, which provides a reward that satisfies the craving and becomes associated with the cue.
        </p>

        <div className="my-2" style={{ height: 1, background: "var(--border-subtle)" }} />

        <span
          className="text-[7px] font-semibold uppercase"
          style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
        >
          Key Insight
        </span>
        <p className="text-[9px] mt-1" style={{ color: "var(--text-primary)", lineHeight: 1.6 }}>
          To change a habit, you do not need more motivation. You need to redesign the four steps. Make the cue obvious, the craving attractive, the response easy, and the reward satisfying.
        </p>

        {/* Highlight box */}
        <div
          className="mt-2 rounded-r-md"
          style={{
            background: "rgba(217,119,6,0.06)",
            borderLeft: "2px solid #D97706",
            padding: "8px 10px",
          }}
        >
          <p className="text-[8px] italic" style={{ color: "var(--text-primary)", lineHeight: 1.5 }}>
            The Four Laws of Behavior Change are the framework for the rest of this book.
          </p>
        </div>
      </div>
    </div>
  );
}
