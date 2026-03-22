const scenarios = [
  {
    tag: "WORK",
    tagColor: "#FF8C42",
    tagBg: "rgba(255,140,66,0.08)",
    tagBorder: "rgba(255,140,66,0.15)",
    situation:
      "You are in a team meeting and a colleague is explaining a project delay. Your instinct is to jump in with solutions before they finish talking.",
    whatToDo:
      "Let them finish completely. Then say: 'It sounds like you have been dealing with a lot on this. What do you think would help most right now?' This validates their experience before problem solving.",
    whyMatters:
      "When people feel heard first, they become more receptive to suggestions. Jumping to solutions signals that you value efficiency over them, which shuts down collaboration.",
  },
  {
    tag: "WORK",
    tagColor: "#FF8C42",
    tagBg: "rgba(255,140,66,0.08)",
    tagBorder: "rgba(255,140,66,0.15)",
    situation:
      "You are meeting a new client for the first time. You prepared a 20 slide pitch about your company's capabilities.",
    whatToDo:
      "Scrap the monologue. Open with: 'Before I share anything, I would love to understand your biggest challenges right now.' Spend the first 15 minutes listening and asking follow up questions. Only then present, and only the parts relevant to what they told you.",
    whyMatters:
      "Carnegie's top salespeople spoke only 30% of the time. Clients who feel understood are far more likely to trust your recommendations because those recommendations are now tailored to their words, not your script.",
  },
  {
    tag: "SCHOOL",
    tagColor: "var(--accent-blue)",
    tagBg: "rgba(79,139,255,0.08)",
    tagBorder: "rgba(79,139,255,0.15)",
    situation:
      "Your study partner is struggling with a concept and keeps explaining their confusion in circles. You understood it hours ago and want to just give them the answer.",
    whatToDo:
      "Instead of explaining, ask: 'What part specifically feels unclear?' Then listen to their answer without correcting. Often, people talk themselves into understanding when given space to think out loud.",
    whyMatters:
      "Giving answers feels helpful but robs the other person of the learning process. Listening and asking questions lets them arrive at understanding on their own, which sticks longer and builds their confidence.",
  },
  {
    tag: "SCHOOL",
    tagColor: "var(--accent-blue)",
    tagBg: "rgba(79,139,255,0.08)",
    tagBorder: "rgba(79,139,255,0.15)",
    situation:
      "A professor gives you critical feedback on your paper. Your first reaction is to defend your argument and explain what they missed.",
    whatToDo:
      "Say 'Thank you, that is helpful' and write down their exact words. Ask one clarifying question: 'What would you suggest I focus on in the revision?' Treat feedback as data, not an attack.",
    whyMatters:
      "Defensiveness kills the conversation. When you listen openly to criticism, two things happen: you actually learn something useful, and the professor sees you as mature and coachable, which influences future interactions and recommendations.",
  },
  {
    tag: "PERSONAL",
    tagColor: "var(--accent-teal)",
    tagBg: "rgba(45,212,191,0.08)",
    tagBorder: "rgba(45,212,191,0.15)",
    situation:
      "Your partner comes home frustrated about their day. You immediately start offering solutions and ways to fix the problem.",
    whatToDo:
      "Stop fixing. Say: 'That sounds really frustrating. Tell me more about what happened.' Let them talk for as long as they need. Only offer advice if they ask for it. Most of the time, they just need to feel heard.",
    whyMatters:
      "Carnegie's principle applies to intimate relationships even more than professional ones. Unsolicited advice signals 'I think you cannot handle this.' Listening signals 'I trust you and I am here.' The second builds connection; the first builds resentment.",
  },
  {
    tag: "PERSONAL",
    tagColor: "var(--accent-teal)",
    tagBg: "rgba(45,212,191,0.08)",
    tagBorder: "rgba(45,212,191,0.15)",
    situation:
      "You are at a family dinner and your uncle starts talking about a topic you strongly disagree with. You feel the urge to debate.",
    whatToDo:
      "Ask questions instead of arguing. 'What made you start thinking about that?' or 'How did you arrive at that view?' Listen to the full answer without planning your rebuttal. You do not have to agree. You just have to understand.",
    whyMatters:
      "Carnegie says you can never win an argument. Even if you prove your point, the other person resents being proven wrong. Listening with genuine curiosity preserves the relationship and often reveals that the disagreement is smaller than it seemed.",
  },
];

export function ScreenScenarioState() {
  return (
    <div
      className="h-full overflow-y-auto hide-scrollbar"
      style={{ padding: "16px 16px 20px" }}
    >
      {/* Section header */}
      <span
        className="text-[8px] font-semibold uppercase"
        style={{ color: "var(--accent-teal)", letterSpacing: "0.12em" }}
      >
        Scenarios
      </span>
      <p className="text-[7px] mt-0.5" style={{ color: "var(--text-muted)" }}>
        6 scenarios · 3 life contexts
      </p>

      {/* 6 scenario cards */}
      <div className="flex flex-col gap-2.5 mt-3">
        {scenarios.map((s, i) => (
          <div
            key={i}
            style={{
              background: "var(--bg-glass)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: 10,
            }}
          >
            {/* Context tag */}
            <span
              className="text-[6px] font-semibold uppercase rounded-full inline-block"
              style={{
                color: s.tagColor,
                background: s.tagBg,
                border: `1px solid ${s.tagBorder}`,
                padding: "1px 6px",
                letterSpacing: "0.05em",
              }}
            >
              {s.tag}
            </span>

            <p
              className="text-[7px] font-semibold mt-1.5"
              style={{ color: "var(--text-heading)" }}
            >
              The Situation
            </p>
            <p
              className="text-[8px] mt-0.5"
              style={{ color: "var(--text-primary)", lineHeight: 1.6 }}
            >
              {s.situation}
            </p>

            <p
              className="text-[7px] font-semibold mt-2"
              style={{ color: "var(--accent-teal)" }}
            >
              What To Do
            </p>
            <p
              className="text-[8px] mt-0.5"
              style={{ color: "var(--text-primary)", lineHeight: 1.6 }}
            >
              {s.whatToDo}
            </p>

            <p
              className="text-[7px] font-semibold mt-2"
              style={{ color: "var(--accent-blue)" }}
            >
              Why This Matters
            </p>
            <p
              className="text-[8px] mt-0.5"
              style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
            >
              {s.whyMatters}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
