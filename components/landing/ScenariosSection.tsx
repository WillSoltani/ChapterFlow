import { ScenarioCard } from "./ScenarioCard";

const scenarios = [
  {
    tag: "WORK",
    tagColor: "var(--accent-amber)",
    tagBg: "rgba(245,158,11,0.08)",
    tagBorder: "rgba(245,158,11,0.15)",
    situation: "You want to start journaling after work, but you keep forgetting. By the time you remember, you are already on the couch watching TV.",
    whatToDo: "Stack the new habit onto an existing one. Place your journal on your keyboard before leaving work. When you sit down the next day, the journal is the cue. This is called implementation intention, linking a specific time and place to the desired behavior.",
    whyMatters: "People who use implementation intentions are 2 to 3 times more likely to follow through. The cue removes the need for motivation. The environment does the work.",
  },
  {
    tag: "PERSONAL",
    tagColor: "var(--accent-teal)",
    tagBg: "rgba(34,211,238,0.08)",
    tagBorder: "rgba(34,211,238,0.15)",
    situation: "You want to drink more water throughout the day but you always forget until you are already dehydrated in the afternoon.",
    whatToDo: "Fill a water bottle the night before and place it next to your coffee maker. The morning routine becomes the cue. Making the response easy, the bottle is already there, already full, removes friction.",
    whyMatters: "The third law says make it easy. Every point of friction between you and a habit reduces the chance you will do it. Reducing steps from 5 to 1 can be the difference between doing it and not.",
  },
  {
    tag: "SCHOOL",
    tagColor: "var(--accent-blue)",
    tagBg: "rgba(34,211,238,0.08)",
    tagBorder: "rgba(34,211,238,0.15)",
    situation: "You want to review your notes after each lecture but you keep scrolling social media on the bus ride home instead.",
    whatToDo: "Redesign the cue: open your notes app before getting on the bus. Remove social media from your home screen so the craving has no trigger. After 10 minutes of review, allow yourself the social media scroll as a reward.",
    whyMatters: "This applies all four laws at once: make the cue obvious (open notes first), make the craving less attractive (remove social triggers), make the response easy (notes already open), and make the reward satisfying (earned social time).",
  },
];

export function ScenariosSection() {
  return (
    <div style={{ padding: "0 12px", marginTop: 20 }}>
      <span
        className="text-[8px] font-semibold uppercase"
        style={{ color: "var(--accent-teal)", letterSpacing: "0.12em" }}
      >
        Scenarios
      </span>
      <p className="text-[8px] mt-0.5" style={{ color: "var(--text-muted)" }}>
        3 scenarios for this chapter
      </p>

      <div className="flex flex-col gap-2.5 mt-2">
        {scenarios.map((s, i) => (
          <ScenarioCard key={i} {...s} />
        ))}
      </div>
    </div>
  );
}
