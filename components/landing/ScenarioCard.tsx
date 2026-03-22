interface ScenarioCardProps {
  tag: string;
  tagColor: string;
  tagBg: string;
  tagBorder: string;
  situation: string;
  whatToDo: string;
  whyMatters: string;
}

export function ScenarioCard({ tag, tagColor, tagBg, tagBorder, situation, whatToDo, whyMatters }: ScenarioCardProps) {
  return (
    <div
      className="rounded-lg"
      style={{
        background: "var(--bg-glass)",
        border: "1px solid var(--border-subtle)",
        padding: 12,
      }}
    >
      {/* Context tag */}
      <span
        className="text-[7px] font-semibold uppercase rounded-full inline-block"
        style={{
          color: tagColor,
          background: tagBg,
          border: `1px solid ${tagBorder}`,
          padding: "2px 8px",
          letterSpacing: "0.05em",
        }}
      >
        {tag}
      </span>

      <p className="text-[8px] font-semibold mt-2" style={{ color: "var(--text-heading)" }}>
        The Situation
      </p>
      <p className="text-[9px] mt-0.5" style={{ color: "var(--text-primary)", lineHeight: 1.6 }}>
        {situation}
      </p>

      <p className="text-[8px] font-semibold mt-2.5" style={{ color: "var(--accent-teal)" }}>
        What To Do
      </p>
      <p className="text-[9px] mt-0.5" style={{ color: "var(--text-primary)", lineHeight: 1.6 }}>
        {whatToDo}
      </p>

      <p className="text-[8px] font-semibold mt-2.5" style={{ color: "var(--accent-blue)" }}>
        Why This Matters
      </p>
      <p className="text-[9px] mt-0.5" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
        {whyMatters}
      </p>
    </div>
  );
}
