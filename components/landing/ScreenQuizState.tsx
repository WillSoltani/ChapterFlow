const questions = [
  {
    question:
      "Your colleague keeps interrupting you in meetings. Based on this chapter, what is the most effective response?",
    options: [
      "Interrupt them back to establish equal ground",
      "Send them an email after the meeting explaining the issue",
      "In your next conversation, ask about their perspective on meetings and listen before sharing yours",
      "Ask the manager to set ground rules about interrupting",
    ],
    correctIndex: 2,
  },
  {
    question:
      "A friend is venting about a bad day at work. They have not asked for advice. What should you do?",
    options: [
      "Share a similar experience so they feel less alone",
      "Suggest specific steps they could take to fix the situation",
      "Ask follow up questions and let them keep talking until they feel heard",
      "Change the subject to something more positive to cheer them up",
    ],
    correctIndex: 2,
  },
  {
    question:
      "You are networking at a conference and meet someone in your field. What approach would Carnegie recommend?",
    options: [
      "Share your elevator pitch and key accomplishments",
      "Ask what they are working on and follow up with genuine questions about their answers",
      "Find common interests and steer the conversation toward them",
      "Exchange business cards and suggest a follow up meeting",
    ],
    correctIndex: 1,
  },
  {
    question:
      "Your professor criticizes your research methodology. Carnegie's chapter suggests you should:",
    options: [
      "Politely explain why your methodology was actually correct",
      "Accept the feedback silently and fix it without discussion",
      "Thank them, ask clarifying questions about what specifically to improve, and listen to the full answer",
      "Ask other students if they received similar feedback",
    ],
    correctIndex: 2,
  },
  {
    question:
      "At a dinner party, the person next to you starts talking about their hobby, something you know nothing about. What does this chapter say you should do?",
    options: [
      "Steer the conversation toward a topic you both know about",
      "Politely listen while waiting for a chance to change the subject",
      "Ask curious questions about their hobby and encourage them to go deeper, even if you are unfamiliar",
      "Share your own hobby and find common ground",
    ],
    correctIndex: 2,
  },
];

const letters = ["A", "B", "C", "D"];

const confettiDots = [
  { top: 4, left: 8, size: 4, color: "var(--accent-teal)", opacity: 0.7 },
  { top: 2, right: 12, size: 5, color: "var(--accent-amber)", opacity: 0.6 },
  { bottom: 6, left: 20, size: 3, color: "var(--accent-blue)", opacity: 0.8 },
  { bottom: 4, right: 16, size: 4, color: "var(--accent-teal)", opacity: 0.5 },
  { top: 10, left: 40, size: 3, color: "var(--text-heading)", opacity: 0.4 },
  { top: 6, right: 32, size: 5, color: "var(--accent-blue)", opacity: 0.6 },
  { bottom: 10, left: 50, size: 4, color: "var(--accent-amber)", opacity: 0.7 },
  { bottom: 2, right: 40, size: 3, color: "var(--accent-teal)", opacity: 0.5 },
];

export function ScreenQuizState() {
  return (
    <div
      className="h-full overflow-y-auto hide-scrollbar"
      style={{ padding: "16px 16px 20px" }}
    >
      {/* Header */}
      <span
        className="text-[8px] font-semibold uppercase"
        style={{ color: "var(--accent-amber)", letterSpacing: "0.12em" }}
      >
        Quiz
      </span>
      <p className="text-[7px] mt-0.5" style={{ color: "var(--text-muted)" }}>
        5 scenario based questions
      </p>
      <p className="text-[8px] mt-0.5" style={{ color: "var(--accent-teal)" }}>
        5/5 correct
      </p>

      {/* 5 questions */}
      <div className="flex flex-col gap-2 mt-3">
        {questions.map((q, qIdx) => (
          <div
            key={qIdx}
            style={{
              background: "var(--bg-glass)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: 10,
            }}
          >
            {/* Badge + question */}
            <div className="flex items-start gap-2">
              <span
                className="text-[7px] font-bold shrink-0 flex items-center justify-center rounded-full"
                style={{
                  width: 20,
                  height: 20,
                  color: "var(--accent-amber)",
                  background: "rgba(232,185,49,0.08)",
                }}
              >
                Q{qIdx + 1}
              </span>
              <p
                className="text-[8px] font-medium"
                style={{ color: "var(--text-heading)" }}
              >
                {q.question}
              </p>
            </div>

            {/* 4 options */}
            <div className="flex flex-col gap-1 mt-2">
              {q.options.map((opt, i) => {
                const isCorrect = i === q.correctIndex;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 rounded-sm"
                    style={{
                      padding: "4px 6px",
                      background: isCorrect
                        ? "rgba(34,211,238,0.08)"
                        : "transparent",
                      borderLeft: isCorrect
                        ? "2px solid var(--accent-teal)"
                        : "2px solid transparent",
                      opacity: isCorrect ? 1 : 0.4,
                    }}
                  >
                    <span
                      className="text-[6px] font-semibold shrink-0 flex items-center justify-center rounded-full"
                      style={{
                        width: 12,
                        height: 12,
                        background: isCorrect
                          ? "var(--accent-teal)"
                          : "var(--bg-elevated)",
                        color: isCorrect ? "white" : "var(--text-muted)",
                      }}
                    >
                      {letters[i]}
                    </span>
                    <span
                      className="text-[8px]"
                      style={{
                        color: isCorrect
                          ? "var(--text-primary)"
                          : "var(--text-muted)",
                      }}
                    >
                      {opt}
                    </span>
                    {isCorrect && (
                      <span
                        className="text-[8px] ml-auto"
                        style={{ color: "var(--accent-teal)" }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sparkle divider */}
      <div
        className="my-4 mx-auto"
        style={{
          width: "80%",
          height: 1,
          background:
            "linear-gradient(90deg, transparent, var(--accent-amber), transparent)",
        }}
      />

      {/* Celebration card */}
      <div
        className="relative text-center"
        style={{
          background: "rgba(34,211,238,0.06)",
          border: "1px solid rgba(34,211,238,0.15)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <p
          className="text-[12px] font-bold"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--accent-teal)",
          }}
        >
          Chapter 4 Unlocked!
        </p>
        <p className="text-[9px] mt-0.5" style={{ color: "var(--accent-amber)" }}>
          Quiz score: 5/5 · Perfect
        </p>
        <p
          className="text-[8px] mt-1"
          style={{ color: "var(--text-secondary)" }}
        >
          Next: Chapter 5 · How to Interest People
        </p>

        {/* Static confetti dots */}
        {confettiDots.map((dot, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: dot.size,
              height: dot.size,
              background: dot.color,
              opacity: dot.opacity,
              top: dot.top,
              left: dot.left,
              right: dot.right,
              bottom: dot.bottom,
            }}
          />
        ))}
      </div>

      <p
        className="text-[8px] text-center mt-2"
        style={{ color: "var(--accent-amber)" }}
      >
        +15 Flow Points
      </p>
    </div>
  );
}
