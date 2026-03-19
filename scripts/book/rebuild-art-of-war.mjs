import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outputPath = resolve(process.cwd(), "book-packages/art-of-war.modern.json");

const t = (base, balanced = "", deep = "") => ({ base, balanced, deep });

const compose = (value, level) =>
  [value.base, level !== "easy" ? value.balanced : "", level === "hard" ? value.deep : ""]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const bullet = (text, base, balanced = "", deep = "") => ({
  text,
  detail: t(base, balanced, deep),
});

const example = (exampleId, title, contexts, scenario, whatToDo, whyItMatters) => ({
  exampleId,
  title,
  contexts,
  scenario,
  whatToDo,
  whyItMatters,
});

const sanitizePrompt = (value) =>
  value
    .replace(/\bthis chapter's\b/gi, "this")
    .replace(/\bthis chapter\b/gi, "this idea")
    .replace(/\bthe chapter\b/gi, "the idea")
    .replace(/\s+/g, " ")
    .trim();

const question = (questionId, prompt, choices, correctAnswerIndex, explanation) => ({
  questionId,
  prompt: sanitizePrompt(prompt),
  choices,
  correctAnswerIndex,
  explanation,
});

const chapter = ({
  chapterId,
  number,
  title,
  readingTimeMinutes,
  summary,
  bullets,
  takeaways,
  practice,
  examples,
  questions,
}) => ({
  chapterId,
  number,
  title,
  readingTimeMinutes,
  contentVariants: Object.fromEntries(
    ["easy", "medium", "hard"].map((level) => {
      const paragraphOne = compose(summary.p1, level);
      const paragraphTwo = compose(summary.p2, level);
      return [
        level,
        {
          importantSummary: `${paragraphOne} ${paragraphTwo}`.trim(),
          summaryBullets: bullets.map((item) => item.text),
          takeaways,
          practice,
          summaryBlocks: [
            { type: "paragraph", text: paragraphOne },
            { type: "paragraph", text: paragraphTwo },
            ...bullets.map((item) => ({
              type: "bullet",
              text: item.text,
              detail: compose(item.detail, level),
            })),
          ],
        },
      ];
    })
  ),
  examples,
  quiz: {
    passingScorePercent: 80,
    questions,
  },
});

const chapters = [
  chapter({
    chapterId: "ch01-calculate-before-conflict",
    number: 1,
    title: "Calculate Before Conflict",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Victory begins before conflict through careful comparison. Sun Tzu says you should weigh purpose, leadership, timing, terrain, and discipline before you commit, because the side that understands the real conditions first usually gains the advantage.",
        "The chapter is not praising caution for its own sake. It is teaching disciplined judgment, so action rests on clear comparison rather than impulse or pride.",
        "What looks like sudden success is often the visible end of invisible preparation. Sound plans come from seeing the structure of the contest before emotion narrows your view."
      ),
      p2: t(
        "This matters because people often enter disputes by reacting to insult, pressure, or excitement. Sun Tzu argues that good strategy starts by asking whether the contest is worth having and whether the conditions truly favor you.",
        "That lesson applies in meetings, negotiations, friendships, and leadership decisions. When you compare realities first, you waste less energy and choose fewer fights that drain more than they return.",
        "The deeper point is that judgment is itself an advantage. If you can see incentives, morale, and constraints more clearly than others, you can often shape the outcome before open conflict ever begins."
      ),
    },
    bullets: [
      bullet(
        "Start with comparison. Before you move, compare the real strengths, aims, and conditions on both sides.",
        "Sun Tzu opens by insisting that clear comparison comes before action.",
        "Without that comparison, confidence is only mood.",
        "Strategy begins when you stop treating desire as evidence."
      ),
      bullet(
        "Measure what decides outcomes. Purpose, leadership, timing, terrain, and discipline matter more than noise.",
        "The chapter narrows attention to the factors that actually change results.",
        "That keeps you from overvaluing a dramatic detail that feels important but is not decisive.",
        "People lose early when they judge by what is vivid instead of what is structurally important."
      ),
      bullet(
        "Shared purpose is leverage. A side that is aligned around a real objective can endure strain better.",
        "When people understand what they are serving, coordination becomes easier.",
        "Confusion about purpose weakens morale long before a visible failure appears.",
        "Sun Tzu treats moral alignment as practical strength, not as decoration."
      ),
      bullet(
        "Leadership shapes morale. Trust in the person directing the effort changes how well people hold together under pressure.",
        "Skillful leadership makes disciplined action possible.",
        "Poor leadership creates hesitation, second guessing, and private resistance.",
        "That is why the quality of command matters before the contest becomes chaotic."
      ),
      bullet(
        "Timing and setting are never neutral. Conditions outside your control still shape what is wise.",
        "The same action can be smart in one moment and foolish in another.",
        "Strategic people read the environment instead of forcing one favorite move into every setting.",
        "Sun Tzu treats awareness of conditions as part of intelligence, not as an excuse."
      ),
      bullet(
        "Discipline makes plans real. Order, training, and clear systems turn intention into repeatable performance.",
        "Loose structure collapses when the stakes rise.",
        "If people do not know roles, signals, and standards in advance, pressure will expose the gap.",
        "Prepared systems protect judgment when emotion runs high."
      ),
      bullet(
        "Compare both sides honestly. Strategy fails when you study only your own hopes and not the other side's reality.",
        "You need a sober read of both advantage and weakness.",
        "That includes asking what the other side values, fears, and can sustain.",
        "Honest comparison prevents the lazy habit of planning against a fantasy opponent."
      ),
      bullet(
        "Do not confuse boldness with readiness. Fast commitment can feel strong while hiding weak preparation.",
        "The chapter warns against acting just to prove resolve.",
        "Force without preparation often hands the other side the easier win.",
        "Courage matters, but Sun Tzu wants courage that has been positioned well."
      ),
      bullet(
        "Keep recalculating. Early judgments help, but conditions change and smart leaders keep updating the picture.",
        "A good plan is not frozen after the first draft.",
        "You continue comparing signals as new facts appear.",
        "That is how preparation stays alive instead of turning into stubbornness."
      ),
      bullet(
        "Prepared victory looks simple later. Most wins seem obvious only after the hidden work has already been done.",
        "The chapter closes the gap between planning and outcome.",
        "What outsiders call luck is often disciplined evaluation that happened before the visible moment.",
        "That is why the calm work before conflict is part of the victory itself."
      ),
    ],
    takeaways: [
      "Compare before you commit",
      "Read both sides honestly",
      "Purpose and discipline matter",
      "Timing changes the same move",
      "Preparation beats impulse",
      "Recalculate as conditions shift",
    ],
    practice: [
      "Write the actual objective before you respond",
      "List the real strengths and limits on both sides",
      "Ask which factor matters most in this situation",
      "Delay any move that is driven mainly by pride",
    ],
    examples: [
      example(
        "ch01-ex01",
        "Vendor negotiation",
        ["work"],
        "Your team is angry after a supplier raises prices, and several people want to threaten a public breakup right away. You have not yet compared your switching cost, the supplier's leverage, or how much time you truly have.",
        [
          "Pause the emotional reaction and map the real factors first, including alternatives, timing, budget pressure, and the supplier's likely incentives.",
          "Choose a response only after you know whether you are actually negotiating from strength or just trying to look strong.",
        ],
        "The first visible move should come after the real comparison, not before it. That keeps the conversation tied to leverage and limits instead of anger."
      ),
      example(
        "ch01-ex02",
        "Student club conflict",
        ["school"],
        "Two leaders in a student club are drifting toward a public argument over an event plan. Everyone is picking sides, but nobody has clarified the real objective, the decision rules, or which constraints are actually binding.",
        [
          "Bring the group back to the core goal, the timeline, the budget, and who owns each decision.",
          "Compare the actual options against those conditions before you let the disagreement turn into a status contest.",
        ],
        "Many school conflicts get bigger because people fight over identity when the real issue is structure. Clear comparison shrinks noise and reveals what the decision should really turn on."
      ),
      example(
        "ch01-ex03",
        "Family confrontation",
        ["personal"],
        "You are tempted to confront a family member after hearing a hurtful comment through someone else. You know the relationship matters, but you have not checked the full context, the timing, or what you actually want from the conversation.",
        [
          "Decide whether the goal is clarity, repair, or simply release, and gather enough context before you call or text.",
          "Choose a setting and tone that fit the real objective instead of letting the first wave of emotion decide for you.",
        ],
        "The chapter teaches that not every strong feeling deserves an immediate move. When you compare aims and conditions first, you protect both truth and the relationship."
      ),
    ],
    questions: [
      question(
        "ch01-q01",
        "A rival company undercuts your price and your team wants an instant public response. What is the strongest first move?",
        [
          "Compare your margins, customer loyalty, timing, and the rival's likely goal before choosing a response",
          "Drop your price immediately so you do not look weak",
          "Attack the rival on social media to shift attention",
          "Wait silently and hope the market corrects itself",
        ],
        0,
        "The best move is to compare the real conditions first, because strategy starts with judgment rather than emotional display."
      ),
      question(
        "ch01-q02",
        "Which factor fits Sun Tzu's logic most closely when deciding whether to enter a conflict?",
        [
          "Whether the crowd will admire your confidence",
          "Whether the key conditions actually favor your side",
          "Whether the issue feels morally frustrating",
          "Whether delaying action makes you uncomfortable",
        ],
        1,
        "The chapter focuses on conditions that change outcomes, not on feelings about image or urgency."
      ),
      question(
        "ch01-q03",
        "A manager knows her team is talented, but roles are fuzzy and deadlines are slipping. What hidden weakness does the chapter highlight here?",
        [
          "A lack of discipline and order",
          "A lack of ambition",
          "A lack of technical skill",
          "A lack of public praise",
        ],
        0,
        "Talent does not replace discipline. Sun Tzu treats structure as one of the conditions that makes success possible."
      ),
      question(
        "ch01-q04",
        "A student wants to challenge a professor's decision in front of the whole class. Which question should come first?",
        [
          "How can I sound the most forceful",
          "What outcome am I trying to create and what setting gives me the best chance of creating it",
          "Who in the room might clap for me",
          "What would make the moment feel satisfying right now",
        ],
        1,
        "The chapter pushes you to define the real objective and compare conditions before taking action."
      ),
      question(
        "ch01-q05",
        "What is the common mistake in entering a hard conversation simply to prove you are not afraid?",
        [
          "It centers appearance instead of conditions",
          "It shows too much patience",
          "It gives the other side too much information",
          "It makes compromise impossible in every case",
        ],
        0,
        "Boldness alone is not readiness. The error is letting pride choose the contest."
      ),
      question(
        "ch01-q06",
        "Why does Sun Tzu care about leadership so early in the analysis?",
        [
          "Because charisma is the fastest way to win any dispute",
          "Because people endure strain better when they trust the direction they are being given",
          "Because leaders should make every decision alone",
          "Because strict control matters more than shared purpose",
        ],
        1,
        "Leadership matters because it affects morale, trust, and the ability to coordinate under pressure."
      ),
      question(
        "ch01-q07",
        "A founder keeps using the same launch plan even after the market shifts. Which principle is being ignored?",
        [
          "You should always move first",
          "You should protect secrecy at all costs",
          "You should keep recalculating as conditions change",
          "You should reward confidence more than caution",
        ],
        2,
        "Early calculation helps, but the chapter assumes real strategy keeps updating the picture."
      ),
      question(
        "ch01-q08",
        "Which choice best reflects disciplined comparison in a personal decision?",
        [
          "Move quickly because hesitation always weakens you",
          "Ask what you want, what the other person likely wants, and what conditions would make the conversation useful",
          "Speak only when you can win the argument completely",
          "Avoid the issue forever so you do not create tension",
        ],
        1,
        "Disciplined comparison means clarifying aims, incentives, and timing before you act."
      ),
      question(
        "ch01-q09",
        "What deeper lesson sits beneath the chapter's focus on planning?",
        [
          "Most conflicts are decided by personality",
          "Good judgment creates advantage before force is needed",
          "Winning is mostly about looking confident in public",
          "Risk should be avoided whenever possible",
        ],
        1,
        "The chapter teaches that clearer judgment often shapes the contest before open conflict begins."
      ),
      question(
        "ch01-q10",
        "If two sides seem equally motivated, what may still separate them according to Sun Tzu?",
        [
          "Who speaks first",
          "Who makes the conflict more dramatic",
          "Who has done the better hidden comparison and preparation",
          "Who looks calmer under pressure",
        ],
        2,
        "Motivation matters, but preparation and comparison usually decide which side is truly advantaged."
      ),
    ],
  }),
  chapter({
    chapterId: "ch02-count-the-cost",
    number: 2,
    title: "Count the Cost of Prolonged Conflict",
    readingTimeMinutes: 11,
    summary: {
      p1: t(
        "Prolonged conflict weakens even the side that looks strong at the start. Sun Tzu warns that long campaigns burn money, supplies, attention, and morale, so a leader should seek resolution before delay eats the value of winning.",
        "The chapter is not saying speed is always good and patience is always bad. It is saying that drawn out struggle creates hidden losses that leaders must count honestly.",
        "Sun Tzu treats duration as a strategic variable, not a side effect. The longer a conflict drags on, the more your own capacity can decay while you are still telling yourself the plan is working."
      ),
      p2: t(
        "This matters because people often focus on the visible contest and ignore the carrying cost of staying in it. A fight can become expensive long before it becomes dramatic.",
        "That lesson transfers to legal disputes, office feuds, stalled projects, and personal arguments that consume attention for months. If you do not count the cost of continuation, you can win the point and still damage yourself.",
        "The deeper lesson is that endurance is not the same as wisdom. Strategic restraint means knowing when time is helping you and when time is quietly turning your own strength into waste."
      ),
    },
    bullets: [
      bullet(
        "Long conflict consumes strength. Even a capable side becomes weaker if the struggle drags on.",
        "Sun Tzu's first warning is simple: time itself can become an enemy.",
        "Resources, morale, and judgment all wear down under prolonged strain.",
        "A plan that ignores duration may fail from internal erosion rather than external defeat."
      ),
      bullet(
        "Winning has a cost curve. The longer you continue, the less valuable the same win may become.",
        "A late victory can cost more than it returns.",
        "That is why leaders must compare the value of the objective against the price of reaching it.",
        "The point is not just to win, but to win without hollowing out what you needed to protect."
      ),
      bullet(
        "Supplies include more than money. Attention, trust, energy, and focus are strategic resources too.",
        "Modern people often count budget and ignore exhaustion.",
        "But time spent in unresolved conflict also drains concentration and emotional capacity.",
        "Sun Tzu's logic applies anywhere sustained strain reduces the quality of future action."
      ),
      bullet(
        "Speed needs clarity. Quick resolution matters, but rushed confusion is not the same as strategic speed.",
        "The chapter favors decisiveness, not panic.",
        "You move faster after you know the objective and the carrying cost of delay.",
        "That difference keeps urgency from turning into self inflicted waste."
      ),
      bullet(
        "Feed the effort realistically. A campaign without sound support becomes brittle.",
        "Ambition must be matched by real capacity.",
        "If support systems are weak, continuation becomes a gamble against your own limits.",
        "Sun Tzu keeps logistics close to strategy because they decide what can be sustained."
      ),
      bullet(
        "Do not romanticize endurance. Staying in the fight is not always proof of strength.",
        "Sometimes persistence is just refusal to admit the math changed.",
        "Good leaders distinguish noble sacrifice from expensive drift.",
        "That protects them from confusing stubbornness with resolve."
      ),
      bullet(
        "Fatigue distorts judgment. People under long pressure start choosing relief over wisdom.",
        "Weariness narrows options and lowers standards.",
        "That is one reason drawn out conflict invites bad decisions late in the game.",
        "Counting cost means tracking how duration changes the quality of thinking itself."
      ),
      bullet(
        "Protect the productive core. Do not spend your best people and systems on a conflict that keeps expanding.",
        "Every long struggle has an opportunity cost.",
        "What you feed into it cannot strengthen something else.",
        "Sun Tzu is protecting future power, not just current position."
      ),
      bullet(
        "Set a clear end state. If you do not know what resolution looks like, conflict can become its own routine.",
        "A vague objective makes delay feel normal.",
        "Specific end states help leaders decide when to press, settle, or stop.",
        "That is how strategy prevents drift."
      ),
      bullet(
        "A smart leader asks what continuation is already costing. That question often reveals the real decision.",
        "The chapter's practical gift is not just speed but honesty about drag.",
        "Once the hidden costs are visible, better options come into view.",
        "That is how you keep a long struggle from quietly becoming self harm."
      ),
    ],
    takeaways: [
      "Delay can erase the value of winning",
      "Count morale and attention too",
      "Endurance is not always wisdom",
      "Support must match ambition",
      "Fatigue changes judgment",
      "Define the end state early",
    ],
    practice: [
      "List the hidden costs of letting the conflict continue",
      "Define what resolution would actually look like",
      "Decide which resources you cannot keep draining",
      "Choose the smallest move that shortens the struggle well",
    ],
    examples: [
      example(
        "ch02-ex01",
        "Office feud",
        ["work"],
        "A disagreement between two managers has been going on for months, and every meeting now burns time on side comments and defensive updates. The issue started small, but the team is losing focus and trust while the leaders keep telling themselves they are just standing their ground.",
        [
          "Measure the cost of continuation in missed work, slower decisions, and falling morale before you decide what to do next.",
          "Push for a concrete end state and a decision process that closes the dispute instead of feeding it.",
        ],
        "The conflict is no longer costing only pride. It is now taxing the whole system, which is exactly the kind of slow drain Sun Tzu wants leaders to notice."
      ),
      example(
        "ch02-ex02",
        "Group project drift",
        ["school"],
        "A group project has turned into weeks of back and forth because nobody wants to settle one design choice. The team keeps adding more discussion, but the deadline is closer and the quality of the rest of the work is getting worse.",
        [
          "Ask what the delay is now costing in time, quality, and teammate goodwill, then set a decision point with clear criteria.",
          "End the cycle by choosing a workable direction instead of protecting every opinion indefinitely.",
        ],
        "Drawn out conflict often feels thoughtful while it is actually expensive. Counting the full cost helps the group stop confusing endless debate with care."
      ),
      example(
        "ch02-ex03",
        "Recurring argument at home",
        ["personal"],
        "You and your partner keep having the same unresolved argument every few weeks. Each round seems manageable on its own, but the repeated tension is wearing down trust and making smaller issues harder to discuss calmly.",
        [
          "Treat the pattern as a cost problem, not just a communication problem, and name what the repetition is doing to the relationship.",
          "Work toward a real resolution step instead of another temporary pause that guarantees the cycle will return.",
        ],
        "Some conflicts feel normal only because people count each episode separately. The chapter asks you to look at cumulative cost, because repetition can become more damaging than any single exchange."
      ),
    ],
    questions: [
      question(
        "ch02-q01",
        "A conflict keeps going mostly because nobody wants to be the one who backs down. What does this chapter push you to examine first?",
        [
          "Whether the conflict is still costing more than it is worth",
          "Whether you can sound tougher in the next exchange",
          "Whether the other side feels embarrassed",
          "Whether more time will automatically improve clarity",
        ],
        0,
        "The chapter asks leaders to count the carrying cost of continuation before they keep paying it."
      ),
      question(
        "ch02-q02",
        "Why is a slow win dangerous in Sun Tzu's logic?",
        [
          "Because speed is always morally better",
          "Because the same victory may lose value as the cost of reaching it keeps rising",
          "Because patience prevents learning",
          "Because public audiences only respect fast action",
        ],
        1,
        "A victory can become less valuable when the struggle drains too much strength on the way there."
      ),
      question(
        "ch02-q03",
        "Which resource is easiest to miss when counting the cost of a long conflict?",
        [
          "Money",
          "Time on the calendar",
          "Attention and morale",
          "Physical supplies",
        ],
        2,
        "Modern people often count cash and ignore the way long strain erodes focus, trust, and judgment."
      ),
      question(
        "ch02-q04",
        "A founder says, \"We have already invested so much that we have to keep pushing.\" Which mistake is most visible here?",
        [
          "Treating past cost as proof that continuation is wise",
          "Moving too quickly toward resolution",
          "Giving the team too much structure",
          "Sharing the end state too clearly",
        ],
        0,
        "The chapter wants leaders to judge current and future cost honestly, not stay trapped by prior investment."
      ),
      question(
        "ch02-q05",
        "A student team keeps debating one issue until the rest of the assignment suffers. What is the best interpretation?",
        [
          "They are showing admirable thoroughness",
          "They are paying a rising cost for unresolved conflict",
          "They are proving that more discussion always improves quality",
          "They should avoid deciding until everyone fully agrees",
        ],
        1,
        "The growing delay is consuming other valuable work, which is exactly the kind of drag Sun Tzu warns about."
      ),
      question(
        "ch02-q06",
        "What separates strategic speed from reckless haste here?",
        [
          "Strategic speed follows from clear objectives and visible costs",
          "Strategic speed means deciding before facts are complete",
          "Strategic speed avoids any disagreement",
          "Strategic speed depends on sounding decisive in public",
        ],
        0,
        "The chapter wants resolution shaped by clarity, not by impatience."
      ),
      question(
        "ch02-q07",
        "Which choice best protects the productive core of a team?",
        [
          "Keep your best people tied up in a symbolic dispute to show commitment",
          "Limit how much top talent and attention a drawn out conflict is allowed to consume",
          "Let every conflict run until one side is exhausted",
          "Avoid measuring opportunity cost so people stay motivated",
        ],
        1,
        "Sun Tzu's logic protects future strength by limiting how much of it you spend on one long struggle."
      ),
      question(
        "ch02-q08",
        "What practical question can reveal that a conflict has started to drift?",
        [
          "Who looks strongest right now",
          "What is the latest rumor about the other side",
          "What specific end state are we trying to reach and what is delay already costing",
          "How can we make the next response more memorable",
        ],
        2,
        "A clear end state and an honest cost review help expose when conflict is continuing by habit."
      ),
      question(
        "ch02-q09",
        "A relationship argument keeps pausing and returning with more resentment each time. Which principle applies most directly?",
        [
          "Repeated unresolved conflict creates cumulative cost",
          "You should always force immediate closure",
          "More time alone always heals tension",
          "The person with stronger feelings should decide the pace",
        ],
        0,
        "The chapter teaches you to notice cumulative drain instead of treating each round as isolated."
      ),
      question(
        "ch02-q10",
        "What deeper standard does the chapter set for leadership?",
        [
          "Leaders should show they can outlast anyone",
          "Leaders should end struggles before drag destroys their own capacity",
          "Leaders should avoid all costly decisions",
          "Leaders should prefer symbolic wins over efficient ones",
        ],
        1,
        "Good leadership is not blind endurance. It is protecting strength by resolving conflict wisely and early enough."
      ),
    ],
  }),
  chapter({
    chapterId: "ch03-win-with-strategy",
    number: 3,
    title: "Win With Strategy Instead of Collision",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "The best victory preserves what you want instead of destroying it. Sun Tzu ranks strategic wins above brute force, arguing that the highest skill is to break resistance through planning, positioning, alliances, and pressure before direct collision becomes necessary.",
        "This chapter keeps asking a simple question: can you get the result without paying the full cost of a head on clash. It shifts attention from raw force to intelligent design.",
        "Sun Tzu is protecting value at two levels at once. He wants you to win, but he also wants the thing you win over to remain useful, stable, and governable afterward."
      ),
      p2: t(
        "This matters because many people mistake intensity for strength. They attack the visible problem directly even when a smarter move would reshape the situation first.",
        "In business, politics, relationships, and leadership, the strongest move is often the one that changes incentives, isolates resistance, or makes open conflict unnecessary. That is not softness. It is economy and control.",
        "The deeper lesson is that great strategy works on structure before it works on surface. If you can disrupt plans, split alignment, or narrow options, you may never need the costly fight people were expecting."
      ),
    },
    bullets: [
      bullet(
        "The best win leaves value intact. Destroying what you want to control is a costly kind of success.",
        "Sun Tzu prefers outcomes that preserve people, systems, and assets.",
        "That makes victory easier to hold and more useful afterward.",
        "A strategist thinks beyond the moment of triumph to the condition of what remains."
      ),
      bullet(
        "Attack plans before positions. If you can disrupt the other side's design, force becomes less necessary.",
        "Strategy is strongest when it breaks coherence early.",
        "A weak plan can collapse before open conflict fully forms.",
        "That is why thinking ahead can outperform dramatic confrontation."
      ),
      bullet(
        "Break alignment when needed. An isolated opponent is easier to influence than a unified one.",
        "Alliances, support, and shared resolve are part of real strength.",
        "If you can weaken coordination, you reduce the price of resistance.",
        "Sun Tzu is looking for leverage in the relationships around the conflict, not just inside it."
      ),
      bullet(
        "Avoid expensive sieges. Slow direct attacks on strong positions usually waste too much.",
        "When the other side is prepared where you are striking, cost rises fast.",
        "The chapter wants you to question whether the obvious attack is also the worst bargain.",
        "Smart strategy looks for the cheaper path to the same result."
      ),
      bullet(
        "Know when to fight and when not to. Restraint is part of intelligence, not evidence of fear.",
        "Not every conflict deserves the same level of force.",
        "Sometimes declining a bad contest is the strongest move available.",
        "This protects strength for battles that matter more."
      ),
      bullet(
        "Keep leadership and execution aligned. Strategy collapses when direction and action pull apart.",
        "A good plan needs support from the people carrying it out.",
        "If execution is confused, even a sharp idea can die in translation.",
        "Sun Tzu keeps strategy close to coordination because one without the other is fragile."
      ),
      bullet(
        "Do not let ego choose the method. Wanting a dramatic win can make you ignore a simpler one.",
        "People often overpay because they want visible dominance.",
        "The chapter favors effectiveness over performance.",
        "That is a disciplined refusal to waste strength on vanity."
      ),
      bullet(
        "Indirect pressure can be stronger than open force. Change the setting and resistance often changes with it.",
        "If you alter incentives or options, the other side may move without direct collision.",
        "That gives you influence while lowering cost.",
        "The smartest pressure often works by changing the field rather than by shouting louder."
      ),
      bullet(
        "Strategic success compounds. When you win with economy, you keep capacity for what comes next.",
        "Low cost wins leave you stronger after the conflict, not just alive through it.",
        "That creates follow on advantage across multiple decisions.",
        "Sun Tzu is building durable power, not just single event success."
      ),
      bullet(
        "Great strategy changes the contest before the clash. If the terms have shifted, the visible fight may never need to happen.",
        "The highest form of control works upstream.",
        "You win early by shaping incentives, alignment, and perception before force becomes central.",
        "That is why true mastery can look calm from the outside."
      ),
    ],
    takeaways: [
      "Preserve value while winning",
      "Disrupt plans before force",
      "Split alignment when useful",
      "Avoid costly direct attacks",
      "Restraint can be strength",
      "Change the contest early",
    ],
    practice: [
      "Ask whether the direct attack is the most expensive option",
      "Identify which plan or alliance actually holds the resistance together",
      "Choose one indirect move that changes incentives",
      "Define success in a way that preserves value after the win",
    ],
    examples: [
      example(
        "ch03-ex01",
        "Negotiation without a showdown",
        ["work"],
        "A client is pushing for terms your team cannot accept, and several people want to draw a hard public line. You realize the client's urgency, internal politics, and fear of delay may matter more than one loud confrontation.",
        [
          "Look for the plan behind the demand, then change the pressure by offering a structure that solves the client's real concern without conceding the bad terms.",
          "Aim to move the decision before it hardens into a public clash that damages both sides.",
        ],
        "This follows Sun Tzu by reshaping the contest instead of charging into the most obvious collision. The goal is not to look soft. It is to get the result without paying the full price of a fight."
      ),
      example(
        "ch03-ex02",
        "Student campaign",
        ["school"],
        "You are running for a leadership role in a campus group, and another candidate is trying to bait you into open argument at every meeting. A direct fight would dominate attention and pull the whole group into factions.",
        [
          "Refuse the bait and shift the contest toward organization, endorsements, and a clearer plan for the group.",
          "Win support by strengthening your position and narrowing theirs rather than by feeding the public clash they want.",
        ],
        "The chapter teaches that the best win often happens before the visible showdown. You gain more by changing how people evaluate the choice than by trading blows in the loudest room."
      ),
      example(
        "ch03-ex03",
        "Conflict with a friend group",
        ["personal"],
        "A friend keeps trying to pull you into a dramatic all or nothing argument in front of others. You could meet the energy directly, but doing that would likely damage the group and make repair harder later.",
        [
          "Move the issue into a private setting, narrow the topic, and separate the real concern from the public performance around it.",
          "Choose the route that protects the relationship and lowers the cost of honesty, even if it looks less dramatic in the moment.",
        ],
        "This is a personal version of winning without collision. You are still dealing with the issue, but you are doing it in a way that preserves what matters instead of destroying it just to prove force."
      ),
    ],
    questions: [
      question(
        "ch03-q01",
        "What kind of victory does Sun Tzu value most here?",
        [
          "A win that leaves what you need intact",
          "A win that proves you are more aggressive",
          "A win that humiliates the other side publicly",
          "A win that uses the maximum amount of force",
        ],
        0,
        "The chapter favors victories that preserve value rather than wasting it through unnecessary destruction."
      ),
      question(
        "ch03-q02",
        "If you can disrupt the other side's plan before the conflict hardens, what have you done well?",
        [
          "Avoided responsibility",
          "Applied strategy at a higher level than direct force",
          "Shown that the issue was never real",
          "Guaranteed there will be no resistance at all",
        ],
        1,
        "Attacking plans before positions is a stronger use of strategy than waiting for a full collision."
      ),
      question(
        "ch03-q03",
        "Why does the chapter warn against siege like thinking?",
        [
          "Because patience is always weakness",
          "Because strong positions are often the most expensive places to attack directly",
          "Because leaders should always avoid risk",
          "Because indirect action is never ethical",
        ],
        1,
        "The point is economic. Direct attacks on prepared strength often cost too much."
      ),
      question(
        "ch03-q04",
        "A founder wants to crush a smaller rival publicly even though a private partnership would give better terms. What is the clearest mistake?",
        [
          "Letting ego choose a costlier method",
          "Thinking too far ahead",
          "Protecting value after the deal",
          "Using structure instead of intensity",
        ],
        0,
        "The chapter warns that people often overpay for dramatic dominance when a simpler win is available."
      ),
      question(
        "ch03-q05",
        "Which move best reflects strategic pressure instead of blunt collision?",
        [
          "Escalating the conflict as quickly as possible",
          "Changing incentives so the other side has reason to move without a direct fight",
          "Attacking the strongest point to prove resolve",
          "Keeping the issue vague so nobody can respond clearly",
        ],
        1,
        "Indirect pressure is powerful when it changes the other side's calculations without requiring the most expensive clash."
      ),
      question(
        "ch03-q06",
        "Why is preserving value after the win strategically important?",
        [
          "It helps the victory remain useful and easier to hold",
          "It guarantees universal approval",
          "It removes every future risk",
          "It proves you did not care about winning",
        ],
        0,
        "A low cost win leaves systems, relationships, or assets in better condition afterward."
      ),
      question(
        "ch03-q07",
        "A student leader keeps taking every baited argument in public meetings. Which principle is being ignored?",
        [
          "The strongest move may be to change the contest instead of feeding it",
          "Public conflict always builds respect",
          "Victory requires immediate domination",
          "All direct clashes are noble",
        ],
        0,
        "The chapter pushes you to reshape the field before accepting the loudest version of the conflict."
      ),
      question(
        "ch03-q08",
        "What does it mean to know when not to fight?",
        [
          "You should avoid difficult decisions whenever possible",
          "You should refuse contests whose cost or structure make them bad bargains",
          "You should give in before the other side gets upset",
          "You should wait until every outcome is certain",
        ],
        1,
        "Restraint is strategic when it prevents you from entering a contest on bad terms."
      ),
      question(
        "ch03-q09",
        "What deeper skill is the chapter trying to teach?",
        [
          "How to appear dangerous",
          "How to work on structure before surface conflict",
          "How to avoid all opposition",
          "How to make every problem personal",
        ],
        1,
        "The chapter values the kind of strategy that changes incentives, plans, and alignment before open clash takes over."
      ),
      question(
        "ch03-q10",
        "Which result best shows strategic success compounding over time?",
        [
          "You win one argument but damage your team",
          "You win at low cost and keep capacity for the next challenge",
          "You defeat one rival and exhaust all your best people",
          "You make the conflict more public than necessary",
        ],
        1,
        "Economical wins matter because they leave you stronger for what comes next."
      ),
    ],
  }),
  chapter({
    chapterId: "ch04-build-a-secure-position",
    number: 4,
    title: "Build a Secure Position First",
    readingTimeMinutes: 11,
    summary: {
      p1: t(
        "A wise leader first makes defeat difficult before looking for a chance to win. Sun Tzu separates what you can control from what you cannot, arguing that secure positioning comes first and visible opportunity comes second.",
        "This chapter is built on a disciplined sequence. You strengthen your own structure, reduce avoidable weakness, and wait for openings instead of trying to create victory by force alone.",
        "The distinction is subtle but powerful. You may not be able to manufacture the perfect opening on demand, but you can refuse to be easy to break while you watch for one."
      ),
      p2: t(
        "This matters because many people chase upside while neglecting basic security. They reach for a big win from a fragile position.",
        "Sun Tzu treats stability as active strategy, not timid delay. When your foundation is sound, you can act with more patience, clearer judgment, and less panic when conditions shift.",
        "The deeper lesson is that control begins with self arrangement. By fixing what is yours to fix, you stop depending on luck for survival and become ready to use opportunity well when it finally appears."
      ),
    },
    bullets: [
      bullet(
        "Secure yourself against easy loss. The first job is to make defeat harder, not to chase a flashy win.",
        "Sun Tzu starts with defense against avoidable failure.",
        "You protect position before you press for advantage.",
        "That sequence keeps ambition from outrunning structural safety."
      ),
      bullet(
        "Control what is yours first. Your preparation, discipline, and arrangement matter before external openings do.",
        "The chapter distinguishes internal readiness from external chance.",
        "You may not control timing, but you do control whether you are exposed when timing arrives.",
        "This is strategy rooted in responsibility rather than wishful thinking."
      ),
      bullet(
        "Openings cannot be forced on command. You prepare for them and use them when they become real.",
        "Trying to manufacture victory from a weak base often makes the base weaker.",
        "Patience here is not passivity. It is refusal to lunge from instability.",
        "Sun Tzu is teaching disciplined timing through secure posture."
      ),
      bullet(
        "Visible calm can hide serious readiness. Real strength does not need to look frantic.",
        "A secure position often appears quiet from the outside.",
        "That quiet matters because panic driven motion usually reveals weakness.",
        "Stability changes how you interpret pressure and how others read you."
      ),
      bullet(
        "Small protections compound. Minor improvements in structure can greatly reduce future risk.",
        "Security rarely comes from one dramatic fix.",
        "It often comes from repeated attention to standards, roles, and exposure.",
        "That is why disciplined maintenance has strategic value."
      ),
      bullet(
        "Do not expose yourself just to seem active. Movement without protection can invite the very loss you hoped to avoid.",
        "The chapter warns against action taken for appearance.",
        "When leaders feel pressure to show momentum, they can give away good ground.",
        "Secure positioning resists that trap."
      ),
      bullet(
        "Patience works better from strength. Waiting is safer when your base is already sound.",
        "Weak people wait nervously because they are hoping not to break.",
        "Strong people wait differently because they have reduced avoidable risk first.",
        "That is why the same delay can mean caution in one case and mastery in another."
      ),
      bullet(
        "Offense should follow stability. Push when the opening is real and your structure can support the move.",
        "This keeps attack tied to readiness instead of appetite.",
        "The chapter is sequencing aggression, not rejecting it.",
        "That order makes bold action more precise and less wasteful."
      ),
      bullet(
        "A secure position clarifies judgment. When survival is less shaky, you can read the field better.",
        "Fragility distorts perception because every threat feels immediate.",
        "Reducing that fragility gives your mind more room to see accurately.",
        "Security therefore improves both endurance and judgment."
      ),
      bullet(
        "The strongest base creates freedom. When you are hard to break, you gain more choice in how and when to act.",
        "This is the payoff of disciplined positioning.",
        "Security is not merely defense. It is what makes controlled offense possible later.",
        "That is why building a secure position is already part of winning."
      ),
    ],
    takeaways: [
      "Make defeat hard first",
      "Fix your own exposure early",
      "Do not force openings",
      "Quiet structure is real strength",
      "Patience works better from security",
      "Stability creates freedom to act",
    ],
    practice: [
      "List the weak points you can remove without waiting on anyone else",
      "Strengthen one system that would fail under pressure",
      "Delay big moves that depend on a fragile base",
      "Define what a real opening would look like before it appears",
    ],
    examples: [
      example(
        "ch04-ex01",
        "Launch from a weak process",
        ["work"],
        "A team wants to push a major launch this week because a competitor is moving fast. The product still has onboarding gaps, support is understaffed, and the handoff process is shaky, but the pressure to act is high.",
        [
          "Secure the obvious weak points first, especially the systems that would fail under real customer pressure.",
          "Only push hard once the base can support the move, even if that means giving up a little speed now to avoid a larger failure later.",
        ],
        "The chapter teaches that rushed offense from a fragile position is often self sabotage. Stability is not delay for its own sake. It is protection against preventable loss."
      ),
      example(
        "ch04-ex02",
        "Club president transition",
        ["school"],
        "A new club president wants to announce a bold agenda immediately, but the club has weak role clarity, inconsistent attendance, and no reliable budget process. Big promises would excite people now but collapse under execution.",
        [
          "Tighten the structure first by clarifying roles, routines, and what the club can actually sustain.",
          "Build credibility through a stable base so later opportunities can be used without chaos.",
        ],
        "A secure position gives future ambition somewhere to stand. Without that base, even good ideas become harder to trust."
      ),
      example(
        "ch04-ex03",
        "Personal boundary reset",
        ["personal"],
        "You want to repair a strained relationship, but every attempt turns into a long emotional spiral because neither side has clear limits, timing, or rules for the conversation.",
        [
          "Strengthen the position first by setting boundaries around when, how, and what will be discussed.",
          "Enter the next conversation only after the structure is strong enough to keep the exchange from collapsing again.",
        ],
        "The chapter's logic works in relationships too. Security comes from building conditions that make a good outcome more possible and a bad spiral less likely."
      ),
    ],
    questions: [
      question(
        "ch04-q01",
        "What comes first in this chapter's sequence?",
        [
          "Making defeat harder",
          "Creating public momentum",
          "Searching for a dramatic win",
          "Pressuring the other side immediately",
        ],
        0,
        "Sun Tzu begins by securing position against avoidable loss before chasing opportunity."
      ),
      question(
        "ch04-q02",
        "Why is a fragile push dangerous even when the opportunity looks attractive?",
        [
          "Because ambition is always wrong",
          "Because attacking from a weak base can create the very loss you hoped to avoid",
          "Because leaders should never move first",
          "Because stable systems make people too cautious",
        ],
        1,
        "The chapter warns that force from instability often exposes weakness instead of creating advantage."
      ),
      question(
        "ch04-q03",
        "Which factor is most under your control according to the chapter?",
        [
          "Whether the perfect opening appears",
          "Whether your own structure is prepared for pressure",
          "Whether other people make mistakes",
          "Whether timing always favors you",
        ],
        1,
        "You cannot command openings, but you can improve your own readiness."
      ),
      question(
        "ch04-q04",
        "A leader keeps making visible moves so nobody thinks the team is slow. What principle is being ignored?",
        [
          "Security matters more than appearance",
          "Every opening should be used immediately",
          "Silence always signals weakness",
          "Good strategy depends on surprise only",
        ],
        0,
        "The chapter rejects motion for show. It favors secure positioning over activity that only looks impressive."
      ),
      question(
        "ch04-q05",
        "Why can patience be a form of strength here?",
        [
          "Because waiting guarantees success",
          "Because waiting from a secure position lets you use openings without panic",
          "Because delay always confuses the other side",
          "Because leaders should avoid responsibility until conditions improve",
        ],
        1,
        "Patience works differently when your base is already sound. It becomes controlled readiness instead of anxious stalling."
      ),
      question(
        "ch04-q06",
        "What practical effect does a secure base have on judgment?",
        [
          "It makes every risk disappear",
          "It reduces fragility so you can read conditions more clearly",
          "It removes the need for timing",
          "It proves you no longer need offense",
        ],
        1,
        "Less fragility means less panic, which improves perception and decision quality."
      ),
      question(
        "ch04-q07",
        "A student team wants to promise a huge event before roles and budget are settled. What is the strongest advice from this chapter?",
        [
          "Make the promise so the team feels inspired",
          "Secure the operating base first, then expand ambition",
          "Avoid all visible goals",
          "Wait until another team acts first",
        ],
        1,
        "The chapter favors building a reliable base before making a big offensive move."
      ),
      question(
        "ch04-q08",
        "Which statement best fits Sun Tzu's view of openings?",
        [
          "They can always be forced if you want them enough",
          "They should be used only after your position can support the move",
          "They matter less than raw energy",
          "They are mostly a myth",
        ],
        1,
        "Openings matter, but they should be used from strength rather than desperation."
      ),
      question(
        "ch04-q09",
        "What deeper discipline is the chapter teaching?",
        [
          "How to control everything outside you",
          "How to distinguish what you can secure from what you must wait to exploit",
          "How to make defense your final goal",
          "How to avoid competitive situations altogether",
        ],
        1,
        "The core distinction is between self arrangement and the external opening you do not fully control."
      ),
      question(
        "ch04-q10",
        "What is the strategic payoff of being hard to break?",
        [
          "You never need to adapt again",
          "You gain more freedom in how and when you act",
          "You can ignore the other side completely",
          "You no longer need to think about risk",
        ],
        1,
        "Security creates choice, and choice is a major form of strategic power."
      ),
    ],
  }),
  chapter({
    chapterId: "ch05-turn-energy-into-leverage",
    number: 5,
    title: "Turn Energy Into Leverage",
    readingTimeMinutes: 11,
    summary: {
      p1: t(
        "Raw effort is not enough. Sun Tzu shows how organized force, timing, rhythm, and variation can turn ordinary action into leverage, so the same people achieve far more than scattered energy ever could.",
        "The chapter is about multiplication, not mere intensity. It explains how direct action and indirect action work together, with structure creating the conditions for momentum to matter.",
        "Sun Tzu wants leaders to stop admiring strain by itself. The question is not how hard people are pushing, but how well their motion has been shaped so force arrives concentrated and timely."
      ),
      p2: t(
        "This matters because many teams and individuals waste energy through bad timing, weak coordination, and constant friction. They work hard without generating pressure where it counts.",
        "In modern life, leverage appears when preparation, sequencing, and signals let many small actions land as one coherent effect. That is true in launches, negotiations, performances, and even difficult conversations.",
        "The deeper lesson is that force is designed before it is released. When a system is arranged well, one small trigger can produce outsized effect because the energy was stored and directed in advance."
      ),
    },
    bullets: [
      bullet(
        "Organized effort beats scattered effort. Structure lets the same energy land with more force.",
        "Sun Tzu treats organization as a multiplier.",
        "When people know roles and timing, their work combines instead of colliding.",
        "That is how a team becomes stronger than the sum of isolated contributors."
      ),
      bullet(
        "Direct action sets the stage. Indirect action often creates the opening that wins.",
        "The obvious move and the surprising move work together.",
        "One stabilizes the field while the other exploits the gap it creates.",
        "This is why strategy uses variation instead of repeating one visible method."
      ),
      bullet(
        "Timing magnifies impact. A modest move at the right moment can outperform a larger move at the wrong one.",
        "The chapter links force to release, not just to amount.",
        "That means leaders must think about when energy lands, not only how much is available.",
        "Well timed pressure can make limited resources feel large."
      ),
      bullet(
        "Rhythm creates control. Coordinated pace keeps people from wasting effort against each other.",
        "Good rhythm helps teams stay responsive without becoming chaotic.",
        "It also makes sudden changes easier to absorb because the underlying cadence is already strong.",
        "Order in motion is one of the chapter's main forms of power."
      ),
      bullet(
        "Signals matter because speed alone is not enough. Fast action without clear cues often becomes confusion.",
        "Shared signals let many people move as one.",
        "That keeps momentum from breaking at the point of execution.",
        "Sun Tzu pairs energy with communication because leverage depends on coherent release."
      ),
      bullet(
        "Ordinary moves and surprising moves should reinforce each other. One without the other is easier to predict.",
        "Predictability lowers pressure because others can prepare for it.",
        "Variation makes your effort harder to absorb cleanly.",
        "That is why the chapter treats creativity as a structural tool."
      ),
      bullet(
        "Momentum must be prepared before it can be felt. The visible surge depends on invisible setup.",
        "People often notice the burst and miss the arrangement behind it.",
        "Preparation stores force so the later move can travel farther.",
        "Leverage is usually built quietly before it becomes obvious."
      ),
      bullet(
        "Concentrated force matters more than equal force spread thin. Focus changes what effort can do.",
        "If attention is dispersed everywhere, pressure is weak everywhere.",
        "Concentration makes limited energy decisive.",
        "This is one reason leaders must choose where not to spend strength."
      ),
      bullet(
        "Do not confuse strain with leverage. Working harder is not the same as working with force.",
        "A strained system may look intense while producing little effect.",
        "The chapter asks whether effort is being directed well, not merely displayed.",
        "That question protects people from burnout disguised as commitment."
      ),
      bullet(
        "Great leaders turn many parts into one effect. The art is in design, not noise.",
        "Sun Tzu ends by treating force as something that can be composed.",
        "When parts are aligned, the final result feels smooth even if the preparation was demanding.",
        "That is the signature of leverage rather than brute exertion."
      ),
    ],
    takeaways: [
      "Structure multiplies force",
      "Direct and indirect work together",
      "Timing changes impact",
      "Signals protect momentum",
      "Concentrate where it counts",
      "Strain is not leverage",
    ],
    practice: [
      "Choose the one point where force needs to land most clearly",
      "Define the signal that tells everyone when to move",
      "Sequence the obvious move and the surprising move on purpose",
      "Cut one area where effort is being spread too thin",
    ],
    examples: [
      example(
        "ch05-ex01",
        "Product launch sequence",
        ["work"],
        "A team is preparing a product launch, but marketing, support, and engineering are each pushing hard on their own timeline. Everyone is busy, yet the work is landing in fragments instead of compounding into one strong release.",
        [
          "Reshape the launch around clear sequencing, shared signals, and one point of concentration so each team reinforces the same moment.",
          "Use the direct work to establish confidence and the indirect work to create surprise or extra pull where the market is not expecting it.",
        ],
        "The chapter teaches that energy becomes powerful when it is arranged before it is released. A launch should feel like one designed surge, not a pile of unrelated effort."
      ),
      example(
        "ch05-ex02",
        "Campus event planning",
        ["school"],
        "A student team is planning a large event and everyone is volunteering hard, but the promotion, speaker outreach, and room logistics are out of sync. The group feels overworked even though the result is still weak.",
        [
          "Create rhythm by setting a shared timeline, clear signals, and one real priority for the week instead of many equal ones.",
          "Use ordinary work to stabilize the event and one well timed surprise to increase turnout rather than asking everyone to push harder everywhere.",
        ],
        "This is a classic leverage problem. More effort alone does not fix scattered effort. The gain comes from arrangement, timing, and focus."
      ),
      example(
        "ch05-ex03",
        "Difficult family conversation",
        ["personal"],
        "You need to raise a sensitive issue with family members, but every past attempt has become a messy pile of interruptions and side topics. The problem is not lack of care. It is that the conversation has no structure and no timing.",
        [
          "Choose a calmer moment, narrow the topic, and set a simple sequence so the conversation does not spend all its energy on noise.",
          "Let one clear question open the discussion, then use follow up points only when they support that main line instead of scattering attention.",
        ],
        "Even personal conversations can benefit from leverage. A structured exchange often reaches more truth with less force than a passionate but disordered one."
      ),
    ],
    questions: [
      question(
        "ch05-q01",
        "What turns ordinary effort into leverage in this chapter?",
        [
          "Greater emotional intensity",
          "Organization, timing, and concentration",
          "Public pressure alone",
          "Constant unpredictability with no structure",
        ],
        1,
        "The chapter teaches that arranged force, not raw strain, creates leverage."
      ),
      question(
        "ch05-q02",
        "How do direct and indirect action relate here?",
        [
          "They should never be used together",
          "Direct action sets the stage and indirect action often creates the decisive opening",
          "Direct action is weak and indirect action is always superior",
          "Indirect action only matters when resources are low",
        ],
        1,
        "Sun Tzu pairs the obvious move and the surprising move so they reinforce each other."
      ),
      question(
        "ch05-q03",
        "A team is working hard but producing little combined force. What is the clearest diagnosis?",
        [
          "The team lacks enough emotion",
          "The team has energy without structure",
          "The team should add more projects at once",
          "The team should avoid signals so work feels more natural",
        ],
        1,
        "Hard work without coordination often stays scattered instead of compounding."
      ),
      question(
        "ch05-q04",
        "Why do signals matter in a fast moving effort?",
        [
          "They let people move together instead of turning speed into confusion",
          "They remove the need for leadership",
          "They guarantee surprise by themselves",
          "They replace the need for timing",
        ],
        0,
        "Signals protect coherence at the moment force is released."
      ),
      question(
        "ch05-q05",
        "What is the mistake in telling a burned out team to simply push harder?",
        [
          "It assumes more strain will solve a leverage problem",
          "It always reduces morale instantly",
          "It gives the team too much clarity",
          "It prevents any future surprise",
        ],
        0,
        "The chapter asks whether effort is well directed, not just whether it is intense."
      ),
      question(
        "ch05-q06",
        "Which move best fits the chapter in a product launch?",
        [
          "Run every team at full speed on separate timelines",
          "Align teams around one shared release moment and one concentrated point of impact",
          "Delay all visible action until the perfect surprise appears",
          "Treat timing as less important than total hours worked",
        ],
        1,
        "Leverage comes from aligned sequence and concentration, not from isolated bursts of effort."
      ),
      question(
        "ch05-q07",
        "What deeper principle explains why a small move can create a large effect?",
        [
          "People usually overreact to anything new",
          "Prepared force can be released at the right time and place",
          "Luck favors teams that act quickly",
          "Indirect action is always hidden from view",
        ],
        1,
        "The chapter treats force as something prepared in advance and released where timing magnifies it."
      ),
      question(
        "ch05-q08",
        "A student event team has volunteers everywhere but no clear weekly focus. What is missing most?",
        [
          "A shared rhythm and point of concentration",
          "A more competitive atmosphere",
          "More last minute changes",
          "Less communication between subgroups",
        ],
        0,
        "When effort is spread thin, pressure stays weak. Rhythm and focus are what convert activity into effect."
      ),
      question(
        "ch05-q09",
        "Why does Sun Tzu care about variation in method?",
        [
          "Because unpredictability without order is ideal",
          "Because repeating one visible method makes your force easier to absorb",
          "Because surprise matters more than preparation",
          "Because direct action is always inferior",
        ],
        1,
        "Variation matters because it keeps pressure from becoming easy to predict and neutralize."
      ),
      question(
        "ch05-q10",
        "What is the clearest sign that leverage is present?",
        [
          "Everyone looks exhausted",
          "Small well timed actions produce a coherent result larger than the parts",
          "The plan changes every day",
          "People are busy in many directions at once",
        ],
        1,
        "Leverage appears when design lets limited actions combine into outsized effect."
      ),
    ],
  }),
  chapter({
    chapterId: "ch06-attack-weakness",
    number: 6,
    title: "Attack Weakness Without Feeding Strength",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "The smartest attack avoids strength and moves toward weakness. Sun Tzu teaches that you should choose where the contest happens, strike where the other side is unprepared, and avoid feeding the very areas where they are strongest.",
        "This chapter is about selective pressure. Instead of meeting force where it is ready, you create movement, expose gaps, and concentrate where resistance is thin.",
        "Sun Tzu is also teaching shape control. If you can stay hard to read while forcing the other side to stretch or react, you gain a major advantage before the clash is even clear."
      ),
      p2: t(
        "This matters because people often attack the most visible point instead of the most vulnerable one. They spend energy proving courage rather than creating leverage.",
        "In markets, classrooms, and relationships, progress often comes from seeing where the system is overextended, inattentive, or slow. When you choose your point of pressure well, you need less force to get movement.",
        "The deeper lesson is that strength is relative to placement. A powerful side can be made awkward if it has to defend too much at once, while a smaller side can grow stronger by choosing the right place and terms."
      ),
    },
    bullets: [
      bullet(
        "Do not hit the strongest point if you have other options. Obvious force can be the most expensive force.",
        "Sun Tzu rejects the lazy urge to attack where resistance is most prepared.",
        "A strong front invites you to spend too much for too little.",
        "Strategic pressure looks for the cheaper path to movement."
      ),
      bullet(
        "Move toward what is unready. Weakness often appears where attention, time, or capacity are thin.",
        "The chapter treats unpreparedness as a real opening.",
        "You gain more by finding a neglected gap than by proving you can survive a hard wall.",
        "That is how smaller force can matter more."
      ),
      bullet(
        "Create dilemmas. When the other side must cover many points, each point becomes thinner.",
        "A stretched opponent is easier to influence than a concentrated one.",
        "Good strategy does not just find weakness. It can also create it by forcing dispersion.",
        "This is why choice architecture matters in conflict."
      ),
      bullet(
        "Choose the ground of the contest. Whoever selects place and pace often selects the outcome too.",
        "If you let the other side decide where everything happens, you inherit their advantage.",
        "The chapter pushes you to move conflict onto terms that fit your strengths.",
        "Selection itself is a form of power."
      ),
      bullet(
        "Protect your own weak points at the same time. Seeking openings does not excuse exposure.",
        "The chapter pairs attack with self protection.",
        "A careless push can open your own flank while you chase theirs.",
        "Smart pressure keeps your structure intact while it looks for theirs to bend."
      ),
      bullet(
        "Stay hard to read when possible. Clear patterns make it easier for others to defend correctly.",
        "Formlessness here means limiting obvious targets and habits.",
        "If others cannot predict you cleanly, they have to guard more territory.",
        "That raises their cost and lowers their certainty."
      ),
      bullet(
        "Concentrate where they are thin. Focused force on a weak point matters more than equal force spread everywhere.",
        "Pressure only becomes decisive when it lands with density.",
        "This chapter keeps linking selection to concentration.",
        "You find the gap so you can make your limited energy count."
      ),
      bullet(
        "Force reaction instead of only reacting yourself. The side making choices usually gains tempo.",
        "If the other side has to answer you repeatedly, their freedom shrinks.",
        "That makes them easier to read and harder to organize.",
        "Initiative grows when you shape their movement."
      ),
      bullet(
        "Speed matters most after the opening is found. Delay can let weakness harden back into strength.",
        "Recognition alone is not enough.",
        "Once the right point is visible, timely movement helps convert it into real advantage.",
        "This is selective speed, not blind hurry."
      ),
      bullet(
        "True strength is choosing where force matters. Selection is often more decisive than volume.",
        "The chapter ends by redefining power as intelligent placement.",
        "You do not need to be strongest everywhere if you can be strongest where the issue turns.",
        "That is the strategic heart of attacking weakness well."
      ),
    ],
    takeaways: [
      "Avoid prepared strength",
      "Find what is unready",
      "Create dilemmas when possible",
      "Choose the terms of pressure",
      "Hide your own weak points",
      "Concentrate where the gap is real",
    ],
    practice: [
      "Name the point the other side is strongest and stop attacking it by default",
      "Look for where attention or capacity is thin",
      "Choose one move that forces the other side to spread out",
      "Protect your own exposed area before you press further",
    ],
    examples: [
      example(
        "ch06-ex01",
        "Competing without a feature war",
        ["work"],
        "A larger competitor has more money and stronger brand recognition, and your team is tempted to challenge them directly on the area where they are already best. Meanwhile, one customer segment remains poorly served because the bigger company is optimized elsewhere.",
        [
          "Stop trying to win where the competitor is most prepared and focus instead on the neglected segment where their structure is thinner.",
          "Concentrate your product, messaging, and service around that real gap instead of feeding the rival's strongest advantage.",
        ],
        "The chapter teaches that selective pressure beats proud collision. You do not need to overpower a giant everywhere if you can matter where they are inattentive."
      ),
      example(
        "ch06-ex02",
        "Class debate strategy",
        ["school"],
        "In a class debate, the other team is very strong on broad theory but weak on concrete examples and time management. If you try to outdo them on abstract argument, you are fighting on their best ground.",
        [
          "Push the debate toward specifics, evidence, and pacing where the other team is less settled.",
          "Keep your own weak area protected by preparing tight responses instead of improvising where you are thin.",
        ],
        "This is Sun Tzu in a school setting. You are not avoiding competition. You are choosing the form of competition that gives your effort leverage."
      ),
      example(
        "ch06-ex03",
        "Recurring argument with a partner",
        ["personal"],
        "Every time you raise a sensitive issue, the conversation gets pulled into one old topic where both of you are fully defended and nothing moves. The result is a long fight on the one piece of ground where each person already knows how to resist.",
        [
          "Do not attack the most defended version of the problem again. Shift toward the overlooked pattern that actually keeps hurting the relationship.",
          "Pick a calmer moment and a narrower entry point so the discussion can move where there is still room to think.",
        ],
        "The chapter's logic applies here because some conversations fail not from lack of honesty but from bad choice of target. A better entry point can create movement that force never produced."
      ),
    ],
    questions: [
      question(
        "ch06-q01",
        "What is the central mistake this chapter warns against?",
        [
          "Attacking where the other side is most prepared when you have better options",
          "Taking any risk at all",
          "Trying to move quickly after a gap appears",
          "Protecting your own weak points",
        ],
        0,
        "The chapter teaches you not to feed strength by attacking it on its best terms."
      ),
      question(
        "ch06-q02",
        "Why does forcing the other side to cover many points create leverage?",
        [
          "It always makes them panic instantly",
          "It spreads their attention and can thin their defenses",
          "It proves you are more aggressive",
          "It removes the need for concentration",
        ],
        1,
        "When they must defend more territory, each defended point can become weaker."
      ),
      question(
        "ch06-q03",
        "A small company copies the market leader on the very feature the leader does best. What is the likely problem?",
        [
          "The company is attacking strength instead of weakness",
          "The company is moving too indirectly",
          "The company is protecting its own weak points too much",
          "The company is using concentration well",
        ],
        0,
        "This feeds the rival's advantage instead of finding a thinner area to pressure."
      ),
      question(
        "ch06-q04",
        "What does formlessness accomplish in this chapter?",
        [
          "It removes the need for planning",
          "It makes your moves harder to predict and defend against cleanly",
          "It guarantees secrecy forever",
          "It means never committing to any course of action",
        ],
        1,
        "Being hard to read forces the other side to guard more broadly and less efficiently."
      ),
      question(
        "ch06-q05",
        "Why is concentration important after you find a weak point?",
        [
          "Because equal pressure everywhere is usually stronger",
          "Because a gap matters most when force lands densely enough to use it",
          "Because speed should replace judgment",
          "Because weakness stays open forever",
        ],
        1,
        "Finding the opening is only part of the work. You still need concentrated force where the gap is real."
      ),
      question(
        "ch06-q06",
        "Which move best fits the chapter in a difficult conversation?",
        [
          "Raise the most defended accusation first because it is the biggest issue",
          "Enter through a narrower, less defended pattern where honest thought is still possible",
          "Say everything at once so nothing is hidden",
          "Wait until the other person brings it up for you",
        ],
        1,
        "A better entry point can create movement that direct force on a defended topic never could."
      ),
      question(
        "ch06-q07",
        "What must you do while pursuing the other side's weakness?",
        [
          "Ignore your own structure so you can move faster",
          "Protect your own weak points at the same time",
          "Choose visibility over security",
          "Accept that exposure is unavoidable",
        ],
        1,
        "The chapter pairs pressure on the other side with care for your own exposure."
      ),
      question(
        "ch06-q08",
        "What does it mean to choose the ground of the contest?",
        [
          "To control where and how pressure is applied",
          "To insist on literal physical movement",
          "To avoid all situations you did not initiate",
          "To make the issue more public",
        ],
        0,
        "Choosing the terms of engagement is a powerful way to shift relative strength."
      ),
      question(
        "ch06-q09",
        "Why can a powerful opponent still become vulnerable?",
        [
          "Because strength disappears under criticism",
          "Because pressure can stretch their attention or expose neglected areas",
          "Because size always creates slowness",
          "Because direct attack weakens all strong players equally",
        ],
        1,
        "Strength is relative to placement. Even a strong side can become awkward if it must cover too much."
      ),
      question(
        "ch06-q10",
        "What deeper lesson about power does the chapter teach?",
        [
          "Power is mostly about volume",
          "Power often comes from placement and selection rather than raw size alone",
          "Power belongs only to the larger side",
          "Power grows when you confront every issue directly",
        ],
        1,
        "The chapter redefines strength as the ability to choose where force matters most."
      ),
    ],
  }),
  chapter({
    chapterId: "ch07-move-with-cohesion",
    number: 7,
    title: "Move With Cohesion Under Friction",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Movement creates confusion unless cohesion is protected on purpose. Sun Tzu shows that maneuvering is difficult not because motion is bad, but because distance, fatigue, mixed signals, and competing priorities can cause an organized force to damage itself.",
        "The chapter treats friction as a normal part of coordinated action. Once people are moving under pressure, communication, morale, and supply become strategic issues, not background details.",
        "Sun Tzu is warning that progress can unravel from the inside long before the other side defeats you. Poorly managed movement turns your own effort into noise, delay, and disorder."
      ),
      p2: t(
        "This matters because leaders often focus on momentum and forget what sustained movement costs. They want speed, but they do not build the cohesion that makes speed usable.",
        "In teams, projects, campaigns, and relationships, transitions are where confusion often grows. The chapter teaches you to protect unity, signals, and endurance so movement does not consume the very force it was meant to apply.",
        "The deeper lesson is that coordinated motion is expensive. If you want flexibility and reach, you must pay for them with clarity, discipline, and realistic management of human strain."
      ),
    },
    bullets: [
      bullet(
        "Movement creates friction. The harder the motion, the more strain coordination must absorb.",
        "Sun Tzu begins by treating maneuver as difficult by nature.",
        "Distance, speed, and uncertainty all raise the cost of staying aligned.",
        "That means motion is never free, even when it looks exciting from the outside."
      ),
      bullet(
        "Unclear signals create self inflicted disorder. People cannot move together without shared cues.",
        "Confusion in communication turns strength into delay and mistake.",
        "The chapter keeps linking movement to signaling because cohesion breaks first at the point of interpretation.",
        "You lose power quickly when each person starts guessing the plan."
      ),
      bullet(
        "Distance changes cost. The farther you move, the more you must think about supply, timing, and fatigue.",
        "Long movement stretches every system behind it.",
        "A plan that looks workable on paper can fail once the carrying cost of motion is real.",
        "This is why logistics sit inside the chapter's view of strategy."
      ),
      bullet(
        "Do not chase easy bait. A tempting opening can become a trap if it pulls you into disorder.",
        "The chapter warns that visible opportunities can be designed to separate you from cohesion.",
        "Not every attractive move improves your position.",
        "Good judgment asks what a chase would cost your shape, not just what it might gain."
      ),
      bullet(
        "Supplies and rest matter because tired people think and coordinate worse.",
        "Endurance depends on physical and mental replenishment.",
        "When those supports weaken, discipline and morale usually weaken with them.",
        "Sun Tzu treats exhaustion as strategic risk, not merely as discomfort."
      ),
      bullet(
        "Morale moves during motion. People feel different when they are advancing, stalled, lost, or stretched.",
        "Leaders must read how movement affects confidence.",
        "Otherwise they may misread silence, irritation, or hesitation as character instead of strain.",
        "The chapter ties morale to the conditions of movement itself."
      ),
      bullet(
        "Keep the aim unified while the path stays flexible. Cohesion comes from shared direction, not from rigid sameness in every detail.",
        "People can adapt locally if they understand the common purpose.",
        "Without that unity, every adjustment starts to feel like drift.",
        "The chapter is protecting collective intent while permitting practical adaptation."
      ),
      bullet(
        "Ambition can outrun logistics. Wanting a fast move does not mean your systems can support one.",
        "This is a recurring danger in any coordinated effort.",
        "If pace exceeds support, breakdown follows even before external resistance matters much.",
        "Strong leaders keep desire aligned with what can actually be carried."
      ),
      bullet(
        "Cohesion is what makes mobility useful. Fast scattered movement often does less than slower coordinated movement.",
        "The chapter values usable speed, not theatrical speed.",
        "Coordination determines whether motion produces pressure or just activity.",
        "That is why cohesion is not separate from action. It is what action depends on."
      ),
      bullet(
        "The side that moves well protects itself from its own disorder. That is already a major advantage.",
        "Sun Tzu's lesson is partly defensive.",
        "You gain strength when motion does not break your own formation, morale, or decision quality.",
        "That is how disciplined movement turns friction into an advantage instead of a liability."
      ),
    ],
    takeaways: [
      "Motion creates friction",
      "Signals protect cohesion",
      "Distance raises hidden cost",
      "Do not chase bait blindly",
      "Fatigue is strategic",
      "Usable speed needs unity",
    ],
    practice: [
      "Clarify the one signal people should follow when conditions change",
      "Review the real cost of the movement you are planning",
      "Name what would count as bait in this situation",
      "Protect one source of rest, supply, or coordination before pushing harder",
    ],
    examples: [
      example(
        "ch07-ex01",
        "Cross team transition",
        ["work"],
        "A company is shifting ownership of a major account from one team to another. Everyone wants the transition to happen quickly, but roles, client communication, and escalation rules are still vague, so each fast move creates more internal confusion.",
        [
          "Slow the transfer just enough to lock in signals, responsibilities, and support paths before speed becomes chaos.",
          "Protect cohesion first so the move can stay fast later without damaging trust or service quality.",
        ],
        "The chapter teaches that movement is expensive when coordination is weak. A rushed handoff can hurt you more through internal friction than through outside pressure."
      ),
      example(
        "ch07-ex02",
        "Student competition trip",
        ["school"],
        "A student team is traveling for a competition and keeps changing plans on the fly. People are missing updates, supplies are scattered, and the mood is turning tense because nobody knows the current plan with confidence.",
        [
          "Reestablish one clear chain of communication, one timing plan, and one basic standard for what must stay together during the trip.",
          "Ignore tempting side opportunities if they would split the group or create more confusion than value.",
        ],
        "This is maneuvering in everyday form. The challenge is not talent alone. It is whether movement can happen without your own coordination collapsing."
      ),
      example(
        "ch07-ex03",
        "Family move",
        ["personal"],
        "Your household is moving apartments and everyone is stressed. The schedule keeps changing, people are tired, and small misunderstandings are starting to feel personal even though the real issue is strain and weak coordination.",
        [
          "Reset the move around a simple plan, clear check ins, and realistic pacing instead of trying to power through chaos.",
          "Treat exhaustion and confusion as part of the problem to manage rather than as proof that people do not care.",
        ],
        "The chapter reminds you that bad movement can turn your own side against itself. Cohesion protects relationships while the pressure is high."
      ),
    ],
    questions: [
      question(
        "ch07-q01",
        "What makes maneuvering difficult in this chapter?",
        [
          "Movement adds friction that can damage coordination",
          "People always dislike change",
          "Speed is inherently bad",
          "Planning removes every risk",
        ],
        0,
        "The chapter focuses on the friction created by movement itself and the need to manage it well."
      ),
      question(
        "ch07-q02",
        "Why are signals so important during movement?",
        [
          "They make rest unnecessary",
          "They keep people aligned when conditions are changing fast",
          "They let leaders avoid giving direction",
          "They guarantee that no mistakes will happen",
        ],
        1,
        "Shared cues protect cohesion at the moment when guesswork would otherwise take over."
      ),
      question(
        "ch07-q03",
        "A tempting opportunity would split your team and strain communication. What does the chapter suggest?",
        [
          "Take it because visible opportunity always matters most",
          "Refuse it if the chase would cost too much cohesion",
          "Let each person decide privately",
          "Increase pressure so nobody notices the confusion",
        ],
        1,
        "The chapter warns against bait that damages your own shape even if it looks attractive in the moment."
      ),
      question(
        "ch07-q04",
        "Why do logistics matter here?",
        [
          "Because movement stretches the systems that support coordinated action",
          "Because logistics replace the need for morale",
          "Because supply is only relevant in literal warfare",
          "Because speed makes support less important",
        ],
        0,
        "Longer movement raises the cost of supply, timing, and endurance."
      ),
      question(
        "ch07-q05",
        "What is the danger in confusing ambition with feasible movement?",
        [
          "It can push the plan beyond what support systems can carry",
          "It always makes people too cautious",
          "It removes the need for leadership",
          "It guarantees a slower result",
        ],
        0,
        "Wanting a fast move does not mean your people, timing, and logistics can support one."
      ),
      question(
        "ch07-q06",
        "A household move is becoming tense because everyone is tired and plans keep shifting. Which reading fits the chapter best?",
        [
          "The main problem is probably weak character",
          "The main problem is probably unmanaged friction and unclear coordination",
          "The main problem is that nobody wants speed",
          "The main problem is too much preparation",
        ],
        1,
        "The chapter teaches you to see strain and confusion as strategic conditions, not just as personality flaws."
      ),
      question(
        "ch07-q07",
        "What kind of speed does the chapter value?",
        [
          "Any speed that looks bold",
          "Speed that remains coherent enough to produce real pressure",
          "Speed without signals",
          "Speed chosen by the loudest person",
        ],
        1,
        "Usable speed depends on cohesion. Scattered motion often produces less than disciplined motion."
      ),
      question(
        "ch07-q08",
        "Why does morale matter during movement?",
        [
          "Because changing conditions alter confidence and discipline",
          "Because morale replaces the need for structure",
          "Because low morale proves the plan is wrong",
          "Because morale is fixed once a move begins",
        ],
        0,
        "Sun Tzu treats morale as something shaped by the experience of movement itself."
      ),
      question(
        "ch07-q09",
        "What keeps a group flexible without becoming chaotic?",
        [
          "Shared purpose with clear local signals",
          "Total improvisation",
          "No change after the first plan",
          "Competing leaders and overlapping orders",
        ],
        0,
        "Unity of aim allows local adaptation without the whole effort feeling directionless."
      ),
      question(
        "ch07-q10",
        "What deeper advantage does disciplined movement create?",
        [
          "It removes the need to observe the other side",
          "It prevents your own effort from collapsing into self inflicted disorder",
          "It guarantees faster results in every case",
          "It makes supply and rest irrelevant",
        ],
        1,
        "The chapter values the side that can move without breaking itself in the process."
      ),
    ],
  }),
  chapter({
    chapterId: "ch08-adapt-the-rules",
    number: 8,
    title: "Adapt the Rules to Conditions",
    readingTimeMinutes: 10,
    summary: {
      p1: t(
        "Good strategy uses principles without becoming trapped by fixed formulas. Sun Tzu argues that changing conditions require changing tactics, and that rigid adherence to one favorite method turns strength into vulnerability.",
        "The chapter teaches disciplined flexibility. You hold to strategic purpose, but you adjust the route, the pace, and the method when the field changes.",
        "Sun Tzu is defending judgment against habit. A tactic that once worked can fail badly when reality shifts, especially if pride makes you cling to it after its usefulness is gone."
      ),
      p2: t(
        "This matters because people love rules that save them from thinking. They want certainty, so they keep repeating a move even after the conditions that once justified it have changed.",
        "The chapter also warns that leaders carry personal blind spots into strategy. Traits like recklessness, fear, anger, vanity, or overprotectiveness can all distort adaptation if they start choosing tactics for you.",
        "The deeper lesson is that flexibility is not randomness. It is the ability to read changing reality without losing purpose, and to keep your own temperament from becoming a predictable weakness."
      ),
    },
    bullets: [
      bullet(
        "Principles are stronger than formulas. You need guidance that can survive changing conditions.",
        "Sun Tzu does not want mindless rule following.",
        "He wants rules that serve judgment rather than replace it.",
        "That is what lets strategy stay alive in a changing field."
      ),
      bullet(
        "Conditions can make yesterday's good tactic today's mistake. Success does not travel unchanged across situations.",
        "A method must be read against the present environment.",
        "If the setting changes, the same move can lose its logic.",
        "This is why adaptation belongs inside strategy rather than after it."
      ),
      bullet(
        "Flexibility should serve purpose, not impulse. Changing course is wise only when it responds to reality clearly.",
        "The chapter is not praising restless novelty.",
        "It is praising disciplined adjustment grounded in the actual field.",
        "That keeps adaptation from becoming random flailing."
      ),
      bullet(
        "Every advantage carries some risk. A strength can expose you if you overuse it.",
        "Aggression can become overextension, patience can become drift, confidence can become blindness.",
        "The chapter asks leaders to read the downside tucked inside each apparent benefit.",
        "Wise adaptation notices when a strength is starting to bend toward weakness."
      ),
      bullet(
        "Rigid habits are easy to exploit. Predictability helps the other side prepare.",
        "If your reactions are known in advance, your options shrink.",
        "Flexibility preserves uncertainty where you need it most.",
        "That uncertainty can itself become a source of leverage."
      ),
      bullet(
        "Temperament can distort tactics. Your character strengths can become decision errors under pressure.",
        "Sun Tzu names dangerous tendencies because strategy is not separate from the person using it.",
        "Recklessness, fear, anger, vanity, and misplaced care can all produce bad choices.",
        "Adaptation therefore requires some mastery over self as well as field."
      ),
      bullet(
        "Weigh gain against danger at the same time. A useful move can still be too costly in context.",
        "The chapter keeps tradeoff thinking close at hand.",
        "Leaders should ask not only what a tactic can gain but also what it exposes.",
        "That habit makes flexibility safer and more intelligent."
      ),
      bullet(
        "Orders must fit reality. A command that ignores the situation creates strain instead of strength.",
        "Top down certainty can become a liability when it stops listening.",
        "Adaptation often means adjusting execution because the field is not matching the plan.",
        "This is how strategy stays connected to truth."
      ),
      bullet(
        "Stubbornness can look principled while quietly becoming costly. Refusal to adjust is not always integrity.",
        "Sometimes a leader protects identity rather than outcome.",
        "The chapter separates steadiness of purpose from rigidity of method.",
        "That distinction is central to wise adaptation."
      ),
      bullet(
        "Mastery is judgment in motion. The best leader can change method without losing direction.",
        "Sun Tzu closes by making flexibility a mark of control rather than confusion.",
        "Adaptation works when purpose remains stable while tactics stay responsive.",
        "That is the mature form of strategic discipline."
      ),
    ],
    takeaways: [
      "Do not confuse principles with formulas",
      "Change method when conditions change",
      "Strengths can bend into risks",
      "Predictable habits invite exploitation",
      "Temperament shapes tactics",
      "Flexible judgment preserves purpose",
    ],
    practice: [
      "Write the principle you want to keep before you change the tactic",
      "Ask what has changed enough to make the old method weaker",
      "Name the personal bias most likely to distort your read",
      "Compare gain and exposure before you adjust course",
    ],
    examples: [
      example(
        "ch08-ex01",
        "Sales script problem",
        ["work"],
        "A sales team has one script that worked well last quarter, so leadership keeps forcing the same approach even though customer objections and buying conditions have changed. Reps are now sounding polished but increasingly ineffective.",
        [
          "Hold onto the core value proposition, but adjust the questions, pace, and framing so the method fits current conditions instead of last quarter's habits.",
          "Review whether attachment to the old script is coming from evidence or from comfort and pride.",
        ],
        "The chapter teaches that repeating a once useful tactic can become its own weakness. Purpose should stay steady while method remains responsive."
      ),
      example(
        "ch08-ex02",
        "Exam study routine",
        ["school"],
        "A student keeps using the same study routine for every class even though one course is heavy on problem solving and another is heavy on interpretation. The routine feels safe because it is familiar, but results are slipping.",
        [
          "Keep the principle of steady preparation, but adapt the actual method to the kind of performance each class requires.",
          "Notice whether stubbornness is being driven by comfort rather than by honest evidence about what is working.",
        ],
        "This is disciplined flexibility in everyday learning. The goal is not to abandon structure. It is to keep structure tied to reality."
      ),
      example(
        "ch08-ex03",
        "Family care decision",
        ["personal"],
        "You are helping a family member through a difficult period and keep using the same approach even though their needs, energy, and openness are changing week to week. Good intention is present, but the method has become rigid.",
        [
          "Stay anchored to the goal of support, but change the timing, tone, and kind of help so it fits what is true now rather than what was true a month ago.",
          "Watch whether guilt, pride, or fear is keeping you locked into one style after it stopped helping.",
        ],
        "The chapter's warning about rigid method applies in caring roles too. Real support often requires steady purpose with changing tactics."
      ),
    ],
    questions: [
      question(
        "ch08-q01",
        "What is the main strategic error this chapter warns against?",
        [
          "Changing methods too often for no reason",
          "Clinging to one tactic after conditions have changed",
          "Holding to any principle at all",
          "Adjusting orders to fit reality",
        ],
        1,
        "The chapter criticizes rigid method, not disciplined principle."
      ),
      question(
        "ch08-q02",
        "How should flexibility be understood here?",
        [
          "As constant novelty",
          "As adjustment that remains tied to purpose and conditions",
          "As avoiding commitment",
          "As reacting to every mood change",
        ],
        1,
        "Sun Tzu wants responsive method without losing strategic direction."
      ),
      question(
        "ch08-q03",
        "Why can a strength become risky?",
        [
          "Because every strength is secretly bad",
          "Because overuse or wrong context can turn an advantage into exposure",
          "Because strong people stop working",
          "Because the other side always adapts perfectly",
        ],
        1,
        "A strength can bend toward weakness when context changes or usage becomes excessive."
      ),
      question(
        "ch08-q04",
        "What makes rigid habits dangerous in conflict?",
        [
          "They always slow you down",
          "They make your responses easier to predict and exploit",
          "They remove all morale",
          "They prevent any kind of planning",
        ],
        1,
        "Predictable patterns give the other side cleaner information about how to prepare."
      ),
      question(
        "ch08-q05",
        "A leader refuses to adjust because changing course would feel like admitting error. Which issue is most visible?",
        [
          "Temperament is distorting tactics",
          "The leader is showing useful consistency",
          "The team is adapting too well",
          "The field has become too simple",
        ],
        0,
        "Sun Tzu warns that pride and temperament can become strategic liabilities."
      ),
      question(
        "ch08-q06",
        "Why does the chapter keep gain and danger together?",
        [
          "To make decision making slower in every case",
          "To help leaders see tradeoffs instead of chasing benefits alone",
          "To discourage ambition completely",
          "To prove that no tactic is ever worth using",
        ],
        1,
        "Wise adaptation weighs what a move can gain and what it can expose at the same time."
      ),
      question(
        "ch08-q07",
        "A student uses one study method for every subject because it feels disciplined. What is the strongest correction?",
        [
          "Keep the habit and ignore outcomes",
          "Keep the goal of steady study but adapt the method to the task",
          "Study less so you can stay flexible",
          "Wait until grades force a crisis",
        ],
        1,
        "The principle can stay the same while the method changes to fit reality."
      ),
      question(
        "ch08-q08",
        "What is the difference between purpose and method in this chapter?",
        [
          "Purpose should change often and method should stay fixed",
          "Purpose can stay stable while method adapts to current conditions",
          "Purpose and method are effectively the same thing",
          "Method matters more than purpose",
        ],
        1,
        "Sun Tzu separates stable direction from flexible execution."
      ),
      question(
        "ch08-q09",
        "What does it mean for orders to fit reality?",
        [
          "Orders should stay unchanged once given",
          "Commands should reflect the actual field rather than the leader's preferred image of it",
          "Orders should depend mostly on morale",
          "Orders should avoid all risk",
        ],
        1,
        "Adaptation keeps strategy connected to what is actually true now."
      ),
      question(
        "ch08-q10",
        "What deeper quality does the chapter associate with mastery?",
        [
          "The ability to hold one tactic forever",
          "The ability to change method without losing direction",
          "The ability to avoid uncertainty completely",
          "The ability to force certainty on others",
        ],
        1,
        "Mastery here is judgment in motion rather than attachment to fixed form."
      ),
    ],
  }),
  chapter({
    chapterId: "ch09-read-signals-on-the-ground",
    number: 9,
    title: "Read Signals on the Ground",
    readingTimeMinutes: 11,
    summary: {
      p1: t(
        "The field is always giving information to anyone patient enough to read it. Sun Tzu shows how small visible signs in movement, mood, order, noise, and posture can reveal hidden conditions long before people state them openly.",
        "This chapter treats observation as practical intelligence. Instead of waiting for direct explanation, you learn to read what repeated signals imply about confidence, strain, readiness, and intent.",
        "Sun Tzu is pushing against lazy interpretation. One sign alone may mislead, but patterned signals let a careful observer see structure before the obvious event arrives."
      ),
      p2: t(
        "This matters because surprise is often preceded by ignored evidence. People miss it because they are distracted, impatient, or too attached to their first story about what is happening.",
        "The lesson applies anywhere conditions must be read from behavior, including negotiations, classrooms, teams, and relationships. Good observers notice the small shifts that tell them whether a situation is steady, defensive, scattered, or preparing to move.",
        "The deeper lesson is that reading reality well is a discipline. Clear observation protects you from projection, from taking bait, and from walking into patterns the environment was already showing you."
      ),
    },
    bullets: [
      bullet(
        "Small signals often reveal large conditions. What looks minor can point to a deeper shift.",
        "Sun Tzu wants leaders to respect small evidence.",
        "Repeated cues can expose morale, readiness, or confusion before open statements do.",
        "This is why careful observation can feel quiet but become strategically decisive."
      ),
      bullet(
        "Patterns matter more than isolated moments. A single sign may mislead, but repeated signs build a trustworthy read.",
        "The chapter favors accumulation over snap judgment.",
        "Observation improves when you compare signals across time and context.",
        "That keeps you from overreacting to one dramatic but shallow clue."
      ),
      bullet(
        "Disorder leaks. Confusion usually becomes visible in behavior before people admit it.",
        "Sun Tzu treats visible disorder as information, not just as surface noise.",
        "Mixed movement, inconsistent response, and strained coordination can all signal weakness.",
        "A good reader notices where structure is starting to fray."
      ),
      bullet(
        "Calm can mean confidence or bait. Observation matters because the same appearance can hide different realities.",
        "The chapter resists naive reading of surface composure.",
        "You look for surrounding signs before deciding what a calm posture means.",
        "This helps you avoid being seduced by appearances alone."
      ),
      bullet(
        "Read the environment and the people together. Signals make more sense when tied to context.",
        "Behavior is easier to interpret when you know what conditions produced it.",
        "The field and the actors are always interacting.",
        "That is why observation needs both detail and setting."
      ),
      bullet(
        "Do not rush to attack every apparent weakness. Some signals are meant to pull you in.",
        "The chapter warns that bait can look like opportunity.",
        "A visible opening should be tested against the wider pattern before you commit.",
        "Observation protects action from being manipulated."
      ),
      bullet(
        "Read your own side too. Your team is also sending signals about its condition.",
        "Good observers do not only study the outside.",
        "They watch morale, readiness, fatigue, and confusion at home as carefully as they watch the other side.",
        "That is how observation becomes self correcting instead of self flattering."
      ),
      bullet(
        "Repeated observation improves timing. If you read the field well, you move earlier and more accurately.",
        "Good timing is often downstream of good perception.",
        "People who observe poorly keep acting late or reacting to the wrong thing.",
        "This is why seeing clearly becomes a form of speed."
      ),
      bullet(
        "The meaning of a sign depends on surrounding signs. Interpretation requires comparison, not superstition.",
        "The chapter is empirical in spirit.",
        "You compare noise with order, motion with stillness, confidence with strain, and pattern with disruption.",
        "That helps you separate real indicators from random activity."
      ),
      bullet(
        "Careful reading prevents ugly surprises. Most preventable shocks arrive after evidence was visible.",
        "The chapter's promise is not perfect prediction but fewer blind entries.",
        "Observation shrinks the space where denial and projection can survive.",
        "That is why signal reading belongs at the center of strategy."
      ),
    ],
    takeaways: [
      "Watch patterns not isolated moments",
      "Disorder usually leaks early",
      "Context gives signals meaning",
      "Bait often looks inviting",
      "Read your own side too",
      "Observation improves timing",
    ],
    practice: [
      "Write down three repeated signals before making an interpretation",
      "Check whether the signal fits the wider context or only one moment",
      "Look for what your own team is signaling under pressure",
      "Test tempting openings for signs that they are bait",
    ],
    examples: [
      example(
        "ch09-ex01",
        "Client meeting read",
        ["work"],
        "In a negotiation, the other side keeps saying they are comfortable with delay, but their questions are growing more urgent and internal responses are becoming less coordinated. The surface message sounds steady, but the pattern underneath does not.",
        [
          "Read the repeated signs rather than the official line, and update your timing based on the mismatch between words and behavior.",
          "Do not force the issue yet, but stop treating their posture as fully stable just because they say it is.",
        ],
        "The chapter teaches that important information often appears in patterns of behavior before it appears in clear statements. Better reading gives you better timing without forcing a reckless move."
      ),
      example(
        "ch09-ex02",
        "Group project warning signs",
        ["school"],
        "A group project still sounds fine in the chat, but missed updates, uneven work quality, and vague replies are starting to pile up. Nobody has said the team is in trouble, yet the signals are pointing there.",
        [
          "Treat the pattern as real information and intervene early with a clearer plan, instead of waiting for an obvious collapse.",
          "Check both the visible output and the tone of coordination so you are reading the full condition of the team.",
        ],
        "Most group failures announce themselves quietly before they become public. The chapter rewards the person who notices the pattern before the deadline makes it painful."
      ),
      example(
        "ch09-ex03",
        "Friendship strain",
        ["personal"],
        "A friend keeps insisting that everything is fine, but replies are shorter, plans are less definite, and ordinary warmth has been replaced by careful distance. One sign alone might mean little, but together the pattern has changed.",
        [
          "Respect the pattern instead of arguing with the words, and approach the conversation with curiosity rather than accusation.",
          "Use the signals to guide timing and tone, not to build a dramatic story before you have spoken honestly.",
        ],
        "The chapter is not telling you to become suspicious of every shift. It is telling you to observe carefully enough that changing reality does not catch you pretending nothing moved."
      ),
    ],
    questions: [
      question(
        "ch09-q01",
        "What gives a signal strategic value in this chapter?",
        [
          "It is dramatic and easy to notice",
          "It repeats within a broader pattern that reveals condition or intent",
          "It confirms your first assumption",
          "It is spoken directly by the other side",
        ],
        1,
        "The chapter values repeated signals interpreted in context, not isolated moments or convenient guesses."
      ),
      question(
        "ch09-q02",
        "Why can a calm surface be misleading?",
        [
          "Because calm always hides fear",
          "Because the same appearance can point to confidence or bait depending on surrounding signs",
          "Because calm proves nothing ever matters",
          "Because strategy should ignore emotional tone",
        ],
        1,
        "Surface composure has to be read against the wider pattern before you trust what it means."
      ),
      question(
        "ch09-q03",
        "A team says it is on track, but missed updates and uneven work keep increasing. What is the strongest reading?",
        [
          "The team is fine because nobody has raised a formal concern",
          "The pattern suggests disorder even if the verbal message stays positive",
          "The issue is probably only mood",
          "You should ignore the signals until a crisis appears",
        ],
        1,
        "The chapter teaches that disorder often leaks through behavior before it is admitted openly."
      ),
      question(
        "ch09-q04",
        "Why does the chapter warn against attacking every visible opening?",
        [
          "Because every opening is false",
          "Because some openings are bait meant to pull you into a worse position",
          "Because action should always be delayed",
          "Because weakness can never be read from behavior",
        ],
        1,
        "Observation helps you test whether an apparent gap is genuine or designed to lure you in."
      ),
      question(
        "ch09-q05",
        "What should you read alongside people when interpreting signals?",
        [
          "The broader environment and context",
          "Only your preferred theory",
          "Only the loudest recent event",
          "Only what benefits your side",
        ],
        0,
        "Signals make sense when tied to the conditions that produced them."
      ),
      question(
        "ch09-q06",
        "Why does Sun Tzu want you to read your own side too?",
        [
          "Because your own condition can distort action if you ignore it",
          "Because the other side matters less",
          "Because self observation replaces planning",
          "Because internal signs are always clearer than external ones",
        ],
        0,
        "Good observation includes your own readiness, morale, and coordination, not just the other side's."
      ),
      question(
        "ch09-q07",
        "A friend says nothing is wrong, but warmth, pace, and follow through have all changed. What is the most disciplined response?",
        [
          "Treat the words as the only relevant data",
          "Notice the pattern, stay curious, and choose a better timed conversation",
          "Assume betrayal immediately",
          "Confront publicly so the pattern cannot continue",
        ],
        1,
        "The chapter rewards careful reading without jumping to a theatrical conclusion."
      ),
      question(
        "ch09-q08",
        "How does observation improve timing?",
        [
          "It removes uncertainty completely",
          "It helps you move earlier and more accurately because you are noticing changes sooner",
          "It guarantees that every move will work",
          "It tells you to act on every sign immediately",
        ],
        1,
        "Better perception often produces better timing because you are not waiting for the situation to become obvious."
      ),
      question(
        "ch09-q09",
        "What is the danger of relying on one sign by itself?",
        [
          "One sign is always false",
          "It can tempt you into superstition or overreaction without enough context",
          "It makes the situation too simple",
          "It prevents adaptation later",
        ],
        1,
        "The chapter prefers pattern reading over snap interpretation."
      ),
      question(
        "ch09-q10",
        "What deeper strategic skill is this chapter training?",
        [
          "How to predict everything perfectly",
          "How to read reality before denial or surprise becomes costly",
          "How to make every situation suspicious",
          "How to ignore verbal communication",
        ],
        1,
        "Signal reading protects you from projection and from preventable surprise."
      ),
    ],
  }),
  chapter({
    chapterId: "ch10-know-the-terrain",
    number: 10,
    title: "Know the Terrain You Are In",
    readingTimeMinutes: 10,
    summary: {
      p1: t(
        "The setting shapes what is wise. Sun Tzu describes different forms of terrain to show that strategy must match the actual ground rather than the move you happen to prefer.",
        "This chapter is about fit. Terrain does not decide everything by itself, but it changes speed, exposure, retreat, pressure, and the cost of every option you are considering.",
        "Sun Tzu is broadening strategy beyond people and plans alone. Even excellent forces can fail when leaders ignore the realities of the environment they are moving through."
      ),
      p2: t(
        "This matters because people often blame character for problems created by setting. They judge outcomes without noticing that the environment made some moves easy and others almost impossible.",
        "In work, study, and personal life, terrain can mean market structure, incentives, room dynamics, time pressure, or emotional climate. The chapter teaches you to read those conditions before praising or condemning any tactic.",
        "The deeper lesson is that wise action is relational. A move is not strong or weak in the abstract. It is strong or weak relative to the ground it enters."
      ),
    },
    bullets: [
      bullet(
        "Terrain changes options. The same tactic can work well on one ground and fail badly on another.",
        "Sun Tzu begins by making environment a strategic variable.",
        "You cannot judge a move well without asking what the setting permits or punishes.",
        "This keeps tactics tied to reality instead of to preference."
      ),
      bullet(
        "Some ground favors advance and some favors withdrawal. Good judgment includes knowing which is which.",
        "The chapter resists one universal answer about whether to push or hold.",
        "Different terrain creates different risks around movement and exposure.",
        "This is why leaders must read before they decide."
      ),
      bullet(
        "Position matters more than bravado. Desire cannot erase structural disadvantage.",
        "A bad location can overpower good intention.",
        "Strong leaders respect the constraints of the ground instead of trying to shout past them.",
        "That humility prevents expensive self deception."
      ),
      bullet(
        "Terrain and force interact. Your own condition changes how usable a given environment is.",
        "The chapter does not talk about the ground in isolation.",
        "It asks how the ground combines with morale, structure, and readiness.",
        "Fit depends on both the setting and the force entering it."
      ),
      bullet(
        "Speed depends on the route. Efficient movement comes from understanding what the path allows.",
        "Some routes drain strength even when they look direct.",
        "Others may take longer on paper but preserve more control.",
        "Sun Tzu wants leaders to see the route as part of the decision, not as a later detail."
      ),
      bullet(
        "Do not blame people for physics. Some failures come from ignoring environmental constraint rather than from weak character.",
        "This chapter makes leaders more honest about cause.",
        "A bad match between tactic and terrain can break a good team.",
        "That insight improves both judgment and accountability."
      ),
      bullet(
        "Leaders can cause disaster by misreading the ground. Poor interpretation at the top spreads pain quickly.",
        "Because terrain shapes options, bad reading distorts every later command.",
        "This is why environmental awareness is a leadership duty.",
        "You cannot manage well if you are wrong about the field itself."
      ),
      bullet(
        "Shared understanding of the setting helps coordination. Teams act better when everyone understands the real constraints.",
        "People coordinate more intelligently when they know what the ground is doing to the plan.",
        "That shared read reduces frustration and naive expectations.",
        "Clarity about terrain therefore improves execution."
      ),
      bullet(
        "A good plan respects exit, exposure, and pressure at the same time. Ground shapes all three.",
        "The chapter asks you to think about movement options broadly.",
        "Where can you press, where can you withdraw, and where can you be trapped.",
        "These are terrain questions before they become tactical ones."
      ),
      bullet(
        "Wise strategy begins with fit. Match the move to the ground before you judge the move itself.",
        "The chapter closes by turning environmental reading into a basic discipline.",
        "When you know the terrain, you choose with more realism and less ego.",
        "That is how setting becomes an ally instead of a hidden enemy."
      ),
    ],
    takeaways: [
      "Ground changes what is wise",
      "Advance and retreat depend on setting",
      "Position beats bravado",
      "Route shapes cost and speed",
      "Misreading terrain creates failure",
      "Judge tactics by fit",
    ],
    practice: [
      "Describe the real setting before you choose the move",
      "Ask what the environment makes easier and harder",
      "Review exit, exposure, and pressure together",
      "Make sure your team shares the same read of the ground",
    ],
    examples: [
      example(
        "ch10-ex01",
        "Crowded market entry",
        ["work"],
        "Your company wants to enter a market where distribution is locked up, customer switching is slow, and the dominant players can afford a long response. The team keeps debating tactics without first naming what the ground itself makes difficult.",
        [
          "Study the terrain before choosing the play, including barriers, switching behavior, and how much pressure the incumbents can sustain.",
          "Pick a move that fits the actual market structure instead of forcing the same entry strategy that worked elsewhere.",
        ],
        "The chapter teaches that a tactic cannot be judged apart from the setting. What worked on different ground may fail here even with the same talent and effort."
      ),
      example(
        "ch10-ex02",
        "Course load reality",
        ["school"],
        "A student tries to use the same study and activity plan in a semester with two lab courses, a part time job, and a long commute. The issue is not laziness. The terrain itself is tighter than last term, but the plan has not changed to match it.",
        [
          "Recognize the new constraints honestly and rebuild the schedule around the actual pressure points of this semester.",
          "Judge choices by fit with the current ground instead of by loyalty to last term's routine.",
        ],
        "This is terrain in academic form. A strong plan in one setting can become unrealistic in another because the environment has changed what is possible."
      ),
      example(
        "ch10-ex03",
        "Holiday family gathering",
        ["personal"],
        "You want to address a sensitive issue during a family holiday, but the setting is crowded, emotionally loaded, and full of social pressure. The topic may still matter, but the ground makes a careful outcome less likely.",
        [
          "Read the environment before you act and decide whether this setting supports clarity or only increases exposure and defensiveness.",
          "Move the conversation to ground that better fits the outcome you actually want.",
        ],
        "The chapter reminds you that the same conversation can go very differently depending on where and under what pressure it happens. Good judgment begins with fit."
      ),
    ],
    questions: [
      question(
        "ch10-q01",
        "What is the main lesson of this chapter?",
        [
          "A strong tactic works in any setting",
          "Strategy must match the actual ground it enters",
          "Terrain matters only in literal warfare",
          "Confidence can overcome environmental limits",
        ],
        1,
        "Sun Tzu argues that the setting changes what is wise, so tactics must be judged by fit."
      ),
      question(
        "ch10-q02",
        "Why is bravado a poor substitute for position?",
        [
          "Because strong feelings change terrain",
          "Because desire cannot erase structural disadvantage",
          "Because retreat is always superior",
          "Because bold action never works",
        ],
        1,
        "The chapter warns that courage alone does not cancel what the environment is doing to your options."
      ),
      question(
        "ch10-q03",
        "A team keeps using a market entry play from another industry even though the current market has different barriers and customer behavior. What is the clearest problem?",
        [
          "They are ignoring terrain",
          "They are moving too slowly",
          "They are observing too much",
          "They are protecting exits too carefully",
        ],
        0,
        "The tactic is being judged without respect for the actual setting it now enters."
      ),
      question(
        "ch10-q04",
        "What does it mean to say terrain and force interact?",
        [
          "The setting matters more than people in every case",
          "The same ground affects different groups differently based on their condition and structure",
          "Terrain is only useful as metaphor",
          "Good morale removes the need to read the environment",
        ],
        1,
        "Fit depends on both the environment and the force moving through it."
      ),
      question(
        "ch10-q05",
        "Why does the chapter care about routes, not just destinations?",
        [
          "Because the path shapes speed, exposure, and cost",
          "Because longer routes are usually wiser",
          "Because direct paths are always traps",
          "Because route choice matters only after action begins",
        ],
        0,
        "Routes change the real cost and control of a move, so they are part of strategy from the start."
      ),
      question(
        "ch10-q06",
        "A student says, \"I should be able to handle this schedule because I handled last term.\" Which principle is most relevant?",
        [
          "The same plan can fail when the terrain changes",
          "Past success always predicts current capacity",
          "Environment matters less than determination",
          "Retreat is the best answer to pressure",
        ],
        0,
        "The chapter asks you to read the current ground honestly rather than import old assumptions into a new setting."
      ),
      question(
        "ch10-q07",
        "What kind of failure does this chapter help leaders avoid?",
        [
          "Failure caused by misreading the field before issuing commands",
          "Failure caused by too much shared understanding",
          "Failure caused by asking for patience",
          "Failure caused by strong morale",
        ],
        0,
        "Bad environmental reading at the top can distort every later decision."
      ),
      question(
        "ch10-q08",
        "Why should a team share the same read of the terrain?",
        [
          "So nobody has to think independently",
          "So coordination reflects real constraints instead of conflicting assumptions",
          "So the leader can avoid accountability",
          "So the plan never has to change again",
        ],
        1,
        "Shared understanding of the field makes execution more realistic and less frustrating."
      ),
      question(
        "ch10-q09",
        "What should you review together before a major move according to this chapter?",
        [
          "Only the desired outcome",
          "Exit, exposure, and pressure in the current setting",
          "Only how fast you can act",
          "Only how committed the team feels",
        ],
        1,
        "Ground shapes how easily you can press, withdraw, or become trapped."
      ),
      question(
        "ch10-q10",
        "What deeper standard for judgment does the chapter set?",
        [
          "Judge tactics by their reputation",
          "Judge tactics by how well they fit the real environment",
          "Judge tactics by how bold they sound",
          "Judge tactics by whether they avoid discomfort",
        ],
        1,
        "The chapter teaches relational judgment. A move is wise or foolish partly because of the ground it enters."
      ),
    ],
  }),
  chapter({
    chapterId: "ch11-match-the-situation",
    number: 11,
    title: "Match the Situation Before Choosing Tactics",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Different situations require different behavior. Sun Tzu describes kinds of strategic positions to show that a leader must read the pressure people are under before deciding how to move them.",
        "This chapter links tactics to psychology. The same group will act differently depending on whether it feels open, contested, deep inside a commitment, trapped, or forced to rely on one another for survival.",
        "Sun Tzu is showing that situation itself shapes conduct. When leaders ignore that, they prescribe one method for conditions that create entirely different kinds of response."
      ),
      p2: t(
        "This matters because people often choose tactics from preference instead of from position. They reach for their favorite move and ignore how the situation is changing incentives, fear, urgency, and cooperation.",
        "The chapter teaches leaders to use the pressure of the situation intelligently. Some conditions need speed, some need unity, some need caution, and some awaken extraordinary effort only because retreat has become impossible.",
        "The deeper lesson is that strategy works through human context. If you understand what a situation is doing to attention and resolve, you can choose a tactic that fits reality instead of fighting both the problem and your own people at once."
      ),
    },
    bullets: [
      bullet(
        "Situation changes behavior. The same people act differently under different strategic pressure.",
        "Sun Tzu begins by tying tactics to circumstance rather than personality alone.",
        "That keeps leaders from expecting one uniform response across very different conditions.",
        "Behavior makes more sense once you read what the situation is doing to people."
      ),
      bullet(
        "Open conditions need cohesion more than desperation. When options feel wide, people can drift.",
        "Not every situation creates urgency on its own.",
        "Some require leaders to create focus because the environment still allows distraction.",
        "This shows why tactic must follow situational pressure."
      ),
      bullet(
        "Contested situations reward speed and clarity. Delay can let the position harden against you.",
        "Some ground punishes hesitation more than others.",
        "The right response there is often more decisive movement, not broader discussion.",
        "The chapter keeps distinguishing when to tighten pace and when not to."
      ),
      bullet(
        "Deep commitment requires unity. When people are invested far in, internal division becomes especially costly.",
        "Sun Tzu treats depth as a force that can either strengthen resolve or expose fractures.",
        "A leader must keep people aligned when backing out is no longer simple.",
        "That is how commitment becomes power instead of strain."
      ),
      bullet(
        "Some conditions require careful resource management. Hard situations punish waste quickly.",
        "Pressure can narrow options until every misstep costs more.",
        "This means tactic has to include preservation, not just aggression.",
        "The chapter is constantly fitting behavior to constraint."
      ),
      bullet(
        "Desperate situations can produce unusual resolve. People may fight hardest when retreat is gone.",
        "Sun Tzu sees psychological transformation in extreme pressure.",
        "This does not mean leaders should recklessly create panic, but it does mean they should understand how necessity changes effort.",
        "The chapter uses pressure carefully instead of denying its effect."
      ),
      bullet(
        "Urgency should be shaped, not sprayed everywhere. Too much undirected pressure can break clarity.",
        "A leader's job is to fit the amount of pressure to the kind of situation.",
        "Wrong pressure can create panic where discipline was needed or drift where commitment was needed.",
        "This is tactical psychology, not motivational theater."
      ),
      bullet(
        "One tactic everywhere is a form of blindness. What works in one position can fail in another.",
        "The chapter sharply rejects universal method.",
        "Situational fit matters because each kind of ground changes what people need most.",
        "That is why good leaders are diagnosticians before they are commanders."
      ),
      bullet(
        "Leaders can use the situation to unify people around the essential. Good framing helps people understand what matters now.",
        "The right framing reduces distraction and internal conflict.",
        "When people know what the situation demands, cooperation becomes easier.",
        "This makes context a tool for disciplined action."
      ),
      bullet(
        "Match pressure, pace, and method to the actual position. That is the chapter's operating rule.",
        "Sun Tzu closes by tying tactical choice to situational truth.",
        "You do not ask what move you like. You ask what this position requires.",
        "That is the habit that keeps tactics realistic and alive."
      ),
    ],
    takeaways: [
      "Situation shapes behavior",
      "Different pressure needs different response",
      "Open ground can create drift",
      "Deep commitment needs unity",
      "Necessity changes resolve",
      "Choose tactic by position",
    ],
    practice: [
      "Name what kind of pressure this situation is creating for people",
      "Decide whether the group needs more unity, speed, caution, or urgency",
      "Remove one tactic you are choosing only from habit",
      "Frame the situation clearly so people know what matters now",
    ],
    examples: [
      example(
        "ch11-ex01",
        "Team reorganization",
        ["work"],
        "Your company is entering a major reorganization. Some teams still feel they have many options, while others are already deeply committed to new reporting lines and deadlines. Leadership is giving everyone the same message even though their situations are not the same.",
        [
          "Match the message and the tactic to the pressure each group is actually under, instead of assuming one tone and pace will work everywhere.",
          "Give clarity and urgency where drift is the problem, and give unity and support where commitment is already deep and friction is rising.",
        ],
        "The chapter teaches that tactics should follow the real position people are in. When leaders flatten different situations into one script, they create confusion instead of coordination."
      ),
      example(
        "ch11-ex02",
        "Final exam season",
        ["school"],
        "A student is treating every class with the same study rhythm even though one exam is tomorrow, one project is already far behind, and another class is still flexible. The tactics are being chosen from routine instead of from the current situation.",
        [
          "Sort each commitment by the kind of pressure it now creates and match your pace to that reality.",
          "Use speed where the window is closing, unity where a heavy project needs sustained commitment, and restraint where rushing would only create mistakes.",
        ],
        "This is situational strategy in normal life. Different positions ask for different behavior, even when the person and the goals are the same."
      ),
      example(
        "ch11-ex03",
        "Family crisis planning",
        ["personal"],
        "A family is dealing with a medical scare and everyone is reacting differently. One person wants constant action, one is shutting down, and one is trying to keep options open even though some decisions are now urgent.",
        [
          "Read what the situation is doing to each person's focus and choose a response that fits the moment instead of judging everyone by one emotional standard.",
          "Create clear priorities and roles so the pressure of the situation produces unity instead of chaotic overreaction.",
        ],
        "The chapter helps because it treats pressure as something to understand, not just to endure. When you name the kind of situation you are in, better tactics become easier to choose."
      ),
    ],
    questions: [
      question(
        "ch11-q01",
        "What is the central principle of this chapter?",
        [
          "Use the same tactic consistently so others trust you",
          "Choose tactics according to the actual situation and the pressure it creates",
          "Prefer urgency in every condition",
          "Avoid changing pace once action starts",
        ],
        1,
        "Sun Tzu argues that tactics should be matched to the kind of position you are actually in."
      ),
      question(
        "ch11-q02",
        "Why can open situations create drift?",
        [
          "Because too many visible options can weaken focus and commitment",
          "Because freedom always lowers morale",
          "Because open situations remove strategy entirely",
          "Because urgency is impossible to create",
        ],
        0,
        "When options feel wide, people often need more cohesion and focus from leadership."
      ),
      question(
        "ch11-q03",
        "What kind of response often fits a contested situation best?",
        [
          "Endless discussion",
          "Clearer and faster movement",
          "Complete withdrawal",
          "No change in pace",
        ],
        1,
        "Some positions punish hesitation and reward speed with clarity."
      ),
      question(
        "ch11-q04",
        "Why does deep commitment increase the need for unity?",
        [
          "Because retreat is simple and cheap",
          "Because internal division becomes more costly once people are heavily invested",
          "Because speed no longer matters at all",
          "Because morale becomes irrelevant",
        ],
        1,
        "When people are far in, fractures inside the group become especially dangerous."
      ),
      question(
        "ch11-q05",
        "How does the chapter view desperate situations?",
        [
          "As always worth creating deliberately",
          "As conditions that can produce fierce resolve because retreat is gone",
          "As proof that the strategy failed completely",
          "As moments when leadership should disappear",
        ],
        1,
        "Sun Tzu notes that necessity can intensify commitment, though it must be understood carefully."
      ),
      question(
        "ch11-q06",
        "A leader gives the same message to teams facing very different kinds of pressure. What is the likely problem?",
        [
          "The leader is ignoring situational fit",
          "The leader is adapting too quickly",
          "The teams need less context",
          "The teams are reading too much into pressure",
        ],
        0,
        "Flattening unlike situations into one script often creates mismatch instead of coordination."
      ),
      question(
        "ch11-q07",
        "What does it mean to shape urgency rather than spray it everywhere?",
        [
          "Pressure should be matched to what the situation actually needs",
          "Pressure should always be kept low",
          "Pressure should be emotional rather than practical",
          "Pressure should come only from deadlines",
        ],
        0,
        "The chapter treats pressure as something to use precisely, not indiscriminately."
      ),
      question(
        "ch11-q08",
        "A student has one exam tomorrow, one project deep behind, and one class still flexible. What is the strongest lesson here?",
        [
          "Use the same routine for all three so you stay disciplined",
          "Match pace and method to the kind of pressure each commitment now creates",
          "Focus only on the flexible class so you feel less stress",
          "Wait until urgency feels equal across all three",
        ],
        1,
        "Different positions require different tactics even when they belong to the same person."
      ),
      question(
        "ch11-q09",
        "Why does the chapter make leaders diagnosticians before commanders?",
        [
          "Because describing the situation correctly comes before choosing the right tactic",
          "Because command is mostly unnecessary",
          "Because diagnosis replaces action",
          "Because people never change under pressure",
        ],
        0,
        "You cannot match the method well if you have not read the position clearly first."
      ),
      question(
        "ch11-q10",
        "What deeper skill is the chapter building?",
        [
          "Using one powerful style everywhere",
          "Seeing how context shapes psychology and then choosing accordingly",
          "Avoiding all urgent situations",
          "Treating pressure as purely negative",
        ],
        1,
        "The chapter links strategy to the human effects of different kinds of position."
      ),
    ],
  }),
  chapter({
    chapterId: "ch12-use-pressure-with-restraint",
    number: 12,
    title: "Use Pressure With Restraint",
    readingTimeMinutes: 10,
    summary: {
      p1: t(
        "Powerful forms of pressure are useful only when conditions, timing, and control support them. Sun Tzu's discussion of fire is really about escalation tools that can create major effect but also major spillover if used badly.",
        "This chapter is not glorifying destruction. It is governing it. Sun Tzu cares about when pressure works, how to support it once it starts, and why emotion is a dangerous commander of any irreversible move.",
        "The point is strategic restraint, not weakness. Some tools are powerful precisely because they can outrun control, which is why leaders must use them only within sound conditions and clear purpose."
      ),
      p2: t(
        "This matters because anger, fear, and impatience often tempt people to escalate before they are ready. They reach for a severe move because it feels decisive, not because it fits the objective.",
        "The chapter teaches that pressure should remain governable. If it spreads beyond your aim, injures what you needed to preserve, or traps you in reaction, it was not wise force at all.",
        "The deeper lesson is that real strength includes the ability not to escalate at the wrong time. Discipline shows up not only in what force you can use, but in what force you refuse to use without the right conditions."
      ),
    },
    bullets: [
      bullet(
        "Pressure tools need the right conditions. A powerful move can fail or backfire if the setting does not support it.",
        "Sun Tzu begins with timing and environment, not with excitement about force.",
        "That keeps leaders from treating every strong tool as universally available.",
        "Context decides whether escalation creates value or chaos."
      ),
      bullet(
        "Timing determines usefulness. The same pressure at the wrong moment can be wasteful.",
        "This chapter links effect closely to release conditions.",
        "Act too early or too late and you may spend force for little return.",
        "Governed escalation starts with temporal judgment."
      ),
      bullet(
        "Follow through matters once pressure begins. If you ignite something, you must know how it connects to the next move.",
        "A strong action without support can produce spectacle instead of progress.",
        "The chapter wants leaders to think beyond initiation to consequence and completion.",
        "Pressure should open a path, not create a mess with no plan."
      ),
      bullet(
        "Emotion is a poor commander. Anger can make escalation feel necessary when it is merely tempting.",
        "Sun Tzu directly warns against acting from rage.",
        "An emotional leader often chooses force to satisfy feeling rather than to serve objective.",
        "That is how destructive tools get used on bad terms."
      ),
      bullet(
        "Irreversible harm deserves higher discipline. Some moves cannot be easily undone.",
        "The chapter raises the standard when spillover is large.",
        "This means the burden of timing, purpose, and control should rise with the tool's reach.",
        "Not every available pressure should be considered acceptable pressure."
      ),
      bullet(
        "Protect yourself from blowback. Pressure that spreads beyond the target can damage your own side.",
        "Leaders must think about exposure, not just effect.",
        "If escalation harms your own position badly, its apparent power was misleading.",
        "That is why restraint and self protection belong together here."
      ),
      bullet(
        "Severe pressure should serve a clear end. Escalation without a specific strategic purpose is reckless.",
        "A leader should know what the move is for before unleashing it.",
        "This clarity keeps force tied to outcome instead of to mood or symbolism.",
        "Purpose is what separates governed pressure from destructive impulse."
      ),
      bullet(
        "Do not escalate because patience feels weak. Waiting can preserve control where premature force would lose it.",
        "The chapter respects disciplined delay when conditions are not ready.",
        "That is not passivity. It is refusal to spend irreversible force on poor terms.",
        "Restraint can be the higher form of strength."
      ),
      bullet(
        "Some pressure is useful only when coordinated with other moves. Support turns force into strategy.",
        "A severe action by itself can create noise without result.",
        "Connected action is what converts pressure into advantage.",
        "This keeps the chapter focused on orchestration rather than spectacle."
      ),
      bullet(
        "The strongest leader knows when not to burn. Control over escalation is part of mastery.",
        "Sun Tzu closes by making restraint a strategic virtue.",
        "Power is not just the ability to intensify, but the discipline to intensify only when it serves the whole design.",
        "That is how force stays intelligent."
      ),
    ],
    takeaways: [
      "Strong pressure needs conditions",
      "Timing changes severity into value",
      "Emotion is a bad commander",
      "Follow through must be planned",
      "Blowback matters",
      "Restraint is strategic strength",
    ],
    practice: [
      "Name the exact objective before you consider escalation",
      "Check whether the conditions truly support a severe move",
      "List how the pressure could spread back onto your side",
      "Delay action that is being chosen mainly from anger",
    ],
    examples: [
      example(
        "ch12-ex01",
        "Public escalation with a client",
        ["work"],
        "A client has crossed an important line, and your team wants to escalate publicly right away. The move might create pressure, but it could also harden the conflict, damage future options, and expose your own weak preparation.",
        [
          "Check whether public escalation serves a clear objective, whether the timing supports it, and what follow through would look like if it works.",
          "If those answers are weak, use a more governable form of pressure first rather than choosing intensity because it feels satisfying.",
        ],
        "The chapter teaches that severe pressure is not wise just because it is available. It must fit conditions, purpose, and control."
      ),
      example(
        "ch12-ex02",
        "Academic complaint",
        ["school"],
        "A student feels mistreated by a professor and wants to post a long public accusation that night. Some concerns are real, but the student has not gathered the full record or thought through the next step after the post goes live.",
        [
          "Separate the need for justice from the urge for immediate release, then decide what pressure actually supports the intended outcome.",
          "Choose a route that remains controllable and evidence based instead of escalating at the peak of emotion.",
        ],
        "The chapter's warning about anger applies strongly here. A severe move taken too early can create more heat than progress and make the path harder to govern afterward."
      ),
      example(
        "ch12-ex03",
        "Family ultimatum",
        ["personal"],
        "You are tempted to deliver a harsh ultimatum in a family conflict because softer approaches have not worked yet. The move could create urgency, but it might also cause lasting damage if it is not timed and framed well.",
        [
          "Ask whether the ultimatum has a clear purpose, whether you are ready for every consequence it creates, and whether a less destructive pressure can still work.",
          "Do not confuse emotional exhaustion with strategic readiness to escalate.",
        ],
        "This chapter is about governed force. Severe pressure may sometimes be needed, but using it without timing, support, and restraint is usually a sign of weak command rather than strong command."
      ),
    ],
    questions: [
      question(
        "ch12-q01",
        "What is the first question this chapter asks before severe pressure is used?",
        [
          "How dramatic the move will look",
          "Whether conditions and timing support it",
          "Whether the other side deserves punishment",
          "Whether patience feels weak",
        ],
        1,
        "Sun Tzu starts with conditions and timing because powerful pressure is not wise in every setting."
      ),
      question(
        "ch12-q02",
        "Why is anger a dangerous commander here?",
        [
          "Because it can make escalation feel necessary even when it does not serve the objective",
          "Because anger always means the issue is unimportant",
          "Because strategic people never feel it",
          "Because it makes timing irrelevant",
        ],
        0,
        "The chapter warns that emotional release is not the same as strategic judgment."
      ),
      question(
        "ch12-q03",
        "Why does follow through matter after pressure begins?",
        [
          "Because strong action without support may create spectacle without progress",
          "Because pressure always solves the problem immediately",
          "Because follow through removes the need for timing",
          "Because severe tools are self guiding",
        ],
        0,
        "A powerful move needs connection to the next step or it risks creating noise instead of outcome."
      ),
      question(
        "ch12-q04",
        "What makes a pressure move strategically unacceptable even if it is powerful?",
        [
          "It feels uncomfortable",
          "It creates major spillover or blowback that undermines your own position",
          "It takes planning",
          "It does not happen quickly enough",
        ],
        1,
        "The chapter asks leaders to weigh spread, exposure, and self harm alongside effect."
      ),
      question(
        "ch12-q05",
        "A student wants to post a public accusation immediately after a bad meeting. Which principle fits best?",
        [
          "Escalate while the feeling is strongest",
          "Choose only the pressure that remains governable and tied to objective",
          "Public force is always the clearest signal",
          "Evidence matters less than timing",
        ],
        1,
        "The chapter favors controlled escalation over emotional escalation."
      ),
      question(
        "ch12-q06",
        "What is the mistake in using severe pressure mainly because patience feels weak?",
        [
          "It confuses discomfort with strategic necessity",
          "It makes you too flexible",
          "It protects the other side too much",
          "It removes the need for follow through",
        ],
        0,
        "The chapter treats disciplined delay as strength when conditions for escalation are not ready."
      ),
      question(
        "ch12-q07",
        "Why does the burden of judgment rise with more destructive tools?",
        [
          "Because irreversible harm requires stronger discipline around purpose and timing",
          "Because severe tools are always morally wrong",
          "Because destructive tools never work",
          "Because mild tools are more complex",
        ],
        0,
        "The more a move can spread and damage, the more careful the leader must be."
      ),
      question(
        "ch12-q08",
        "What keeps escalation inside strategy rather than turning it into theater?",
        [
          "A clear end, fitting conditions, and supported follow through",
          "Public attention",
          "Personal anger",
          "Maximum speed",
        ],
        0,
        "Pressure becomes strategic when it is connected to purpose, timing, and the next move."
      ),
      question(
        "ch12-q09",
        "What does the chapter suggest about waiting?",
        [
          "Waiting is a sign of fear",
          "Waiting can preserve control when conditions for force are poor",
          "Waiting removes the need for pressure forever",
          "Waiting matters only when resources are low",
        ],
        1,
        "Disciplined waiting is sometimes the wiser way to keep severe tools from being wasted."
      ),
      question(
        "ch12-q10",
        "What deeper form of strength does the chapter praise?",
        [
          "The ability to intensify more than anyone else",
          "The ability to govern escalation and refuse bad uses of force",
          "The ability to avoid all conflict",
          "The ability to frighten others early",
        ],
        1,
        "Sun Tzu links mastery not just to force, but to control over when force should and should not be used."
      ),
    ],
  }),
  chapter({
    chapterId: "ch13-use-information-carefully",
    number: 13,
    title: "Use Information Without Illusion",
    readingTimeMinutes: 11,
    summary: {
      p1: t(
        "Reliable information is worth more than blind action. Sun Tzu argues that leaders should invest in intelligence because knowing what is actually happening reduces waste, improves timing, and makes strategy far less dependent on guesswork.",
        "This chapter is about human sourced understanding, not abstract data alone. Sun Tzu explains different kinds of intelligence and emphasizes careful handling because information is useful only when it is credible, connected, and interpreted well.",
        "He is also pushing against fantasy. Strategy fails when leaders act on rumor, projection, or wishful stories instead of on disciplined knowledge about people, motives, and conditions."
      ),
      p2: t(
        "This matters because uncertainty tempts people into either paralysis or confident invention. They fill gaps with stories, then act as if those stories were facts.",
        "The chapter teaches that good intelligence is built through trust, cross checking, and thoughtful use. It also shows that information and deception interact, which means careless handling of sources can spoil both insight and timing.",
        "The deeper lesson is that information is a strategic asset only when it stays close to truth. Leaders need sources, but they also need humility about what they do and do not know."
      ),
    },
    bullets: [
      bullet(
        "Good information reduces waste. Clearer knowledge helps leaders avoid costly blind moves.",
        "Sun Tzu opens by making intelligence a practical necessity.",
        "When uncertainty falls, timing and resource use usually improve.",
        "That is why information is treated as part of strategy rather than as a luxury."
      ),
      bullet(
        "Human sources matter because motive and intention often live in people, not just in numbers.",
        "The chapter focuses on information gathered through relationships and access.",
        "That is how leaders learn what simple observation cannot fully show.",
        "Intelligence often depends on understanding people as much as events."
      ),
      bullet(
        "Different sources play different roles. One source type rarely tells the whole story.",
        "Sun Tzu separates kinds of intelligence so leaders do not expect one stream to do every job.",
        "Each source adds a different angle on risk, intent, or opportunity.",
        "This makes collection broader and interpretation more careful."
      ),
      bullet(
        "Cross check before acting. Confidence should rise from convergence, not from one attractive report.",
        "The chapter resists single source certainty.",
        "When reports align across sources, leaders can move with more confidence.",
        "That discipline protects you from being guided by noise or manipulation."
      ),
      bullet(
        "Sources must be handled with care. Trust, secrecy, and reward all matter.",
        "People share valuable information only under conditions that feel safe and worthwhile.",
        "Poor handling can dry up access or corrupt what comes back.",
        "This is why intelligence is relational work, not just extraction."
      ),
      bullet(
        "Do not confuse rumor with intelligence. Fast information is not always good information.",
        "The chapter pushes leaders to filter, not just collect.",
        "Rumor feels useful because it relieves uncertainty quickly.",
        "But acting on it can create confident error instead of strategic advantage."
      ),
      bullet(
        "Use intelligence to shape timing. Information matters most when it changes what you do next.",
        "Knowing more should alter sequence, pace, or choice.",
        "Otherwise collection becomes decorative rather than strategic.",
        "Sun Tzu wants intelligence connected to action through timing."
      ),
      bullet(
        "Information and deception interact. What you know and what others think you know both matter.",
        "The chapter treats intelligence as part of a broader contest of perception.",
        "That means careless leaks can damage advantage while thoughtful concealment can preserve it.",
        "Good leaders manage both insight and exposure."
      ),
      bullet(
        "Humility improves intelligence. You need discipline about what remains uncertain.",
        "Overconfidence can turn partial knowledge into false certainty.",
        "The chapter therefore rewards leaders who keep updating their read instead of falling in love with one story.",
        "Better knowing often begins with cleaner admission of what you do not yet know."
      ),
      bullet(
        "The leader who knows more can risk less and choose better. That is the chapter's enduring promise.",
        "Information is not magic, but it changes the quality of decision making.",
        "It reduces avoidable surprises and helps force land where it matters.",
        "That is why intelligence sits at the close of the book as a capstone discipline."
      ),
    ],
    takeaways: [
      "Good intelligence reduces waste",
      "Human sources reveal intent",
      "Different sources serve different roles",
      "Cross check before acting",
      "Rumor is not knowledge",
      "Humility protects judgment",
    ],
    practice: [
      "Write what you know, what you think, and what you are only guessing",
      "Check whether one source is carrying too much weight",
      "Ask how better information would change timing or choice",
      "Protect the trust that makes future information possible",
    ],
    examples: [
      example(
        "ch13-ex01",
        "Market intelligence",
        ["work"],
        "Your team is about to respond to a competitor move, but most of the internal discussion is being driven by rumor, secondhand interpretation, and one dramatic screenshot. The loudest story is outrunning the quality of the evidence.",
        [
          "Separate confirmed facts from assumptions, gather input from more than one reliable source, and ask what decision the information actually supports.",
          "Move only when the picture is strong enough to improve timing rather than just satisfy uncertainty.",
        ],
        "The chapter teaches that acting on weak information can feel decisive while actually increasing waste. Better intelligence means better timing, not just more noise."
      ),
      example(
        "ch13-ex02",
        "Campus rumor spiral",
        ["school"],
        "A rumor spreads through a student organization about why a leader made a controversial decision. People are reacting quickly, but almost nobody has checked the source chain or asked who actually knows what happened.",
        [
          "Pause the story spiral and separate rumor from verified information before deciding what the situation means.",
          "Use trusted direct sources and compare accounts instead of letting one dramatic version become the truth by repetition.",
        ],
        "This is the chapter in everyday form. Intelligence is not the same as gossip, and fast certainty can become a costly mistake when it outruns evidence."
      ),
      example(
        "ch13-ex03",
        "Family misunderstanding",
        ["personal"],
        "A family member hears that another relative said something hurtful, and the whole room starts reacting before anyone checks context, source, or wording. The conflict is being built on uncertain information.",
        [
          "Clarify who knows what directly, what is inference, and what is rumor before you choose a response.",
          "Protect trust by handling the information carefully rather than using it as fuel for a faster emotional confrontation.",
        ],
        "The chapter's lesson is simple and difficult: better information often prevents conflict that would have felt justified in the moment but rested on illusion."
      ),
    ],
    questions: [
      question(
        "ch13-q01",
        "Why does Sun Tzu value intelligence so highly?",
        [
          "It removes uncertainty completely",
          "It reduces waste and improves timing compared with acting blindly",
          "It makes strategy unnecessary",
          "It guarantees that deception will work",
        ],
        1,
        "The chapter treats reliable information as a practical way to improve decision quality and reduce avoidable cost."
      ),
      question(
        "ch13-q02",
        "Why are human sources important in this chapter?",
        [
          "Because numbers are never useful",
          "Because motives and intentions often live in people and relationships",
          "Because rumor is more accurate than data",
          "Because direct observation is always impossible",
        ],
        1,
        "Sun Tzu emphasizes human intelligence because many crucial facts involve intent, trust, and hidden movement."
      ),
      question(
        "ch13-q03",
        "What is the danger of relying on one exciting report?",
        [
          "It can create false certainty without enough cross checking",
          "It makes strategy too slow",
          "It reduces creativity",
          "It always comes from deception",
        ],
        0,
        "The chapter wants convergence across sources, not confidence built on one attractive signal."
      ),
      question(
        "ch13-q04",
        "Why does the chapter care about secrecy and reward in handling sources?",
        [
          "Because sources are relational and can be damaged by poor treatment",
          "Because secrecy is more important than truth",
          "Because people always tell the truth when pressured",
          "Because intelligence works best without trust",
        ],
        0,
        "Useful sources depend on careful handling, trust, and conditions that keep information flowing well."
      ),
      question(
        "ch13-q05",
        "A team is reacting to a competitor based mainly on rumor and one viral image. What is the strongest correction?",
        [
          "Move faster before the rumor fades",
          "Separate facts from assumptions and gather stronger intelligence before acting",
          "Ignore the issue because rumors are always false",
          "Counter the rumor with a bigger rumor",
        ],
        1,
        "The chapter warns against treating quick uncertainty relief as if it were real knowledge."
      ),
      question(
        "ch13-q06",
        "What makes information strategically useful rather than merely interesting?",
        [
          "It changes timing, sequence, or choice in a better informed way",
          "It is surprising",
          "It supports the leader's preferred story",
          "It comes from a senior person",
        ],
        0,
        "Good intelligence matters because it improves what you do next, not because it sounds impressive."
      ),
      question(
        "ch13-q07",
        "Why does humility improve intelligence?",
        [
          "Because admitting uncertainty keeps partial knowledge from becoming false certainty",
          "Because humble leaders never need to act",
          "Because humility replaces verification",
          "Because bold leaders ignore information anyway",
        ],
        0,
        "The chapter values leaders who know the boundary between evidence and inference."
      ),
      question(
        "ch13-q08",
        "What is the difference between rumor and intelligence?",
        [
          "Rumor is emotional and intelligence is always unemotional",
          "Intelligence is checked, sourced, and useful for action, while rumor is not",
          "Rumor comes from people and intelligence does not",
          "There is no real difference if the story spreads widely",
        ],
        1,
        "The chapter draws a sharp line between fast stories and disciplined knowledge."
      ),
      question(
        "ch13-q09",
        "Why does the chapter connect information and deception?",
        [
          "Because what others believe about your knowledge can shape behavior too",
          "Because all intelligence work is dishonest",
          "Because truth no longer matters once deception begins",
          "Because concealment is more important than collection",
        ],
        0,
        "The chapter treats perception as part of strategy, which makes handling of information doubly important."
      ),
      question(
        "ch13-q10",
        "What deeper discipline closes the book?",
        [
          "Using information to confirm your instincts",
          "Building decisions on disciplined knowledge rather than illusion",
          "Collecting as much data as possible without filtering",
          "Avoiding action until certainty is perfect",
        ],
        1,
        "Sun Tzu ends by making information quality a final test of strategic maturity."
      ),
    ],
  }),
];

const bookPackage = {
  schemaVersion: "1.1.0",
  packageId: "7e0cafbe-bb30-495b-9351-efa8e4b9ac2f",
  createdAt: "2026-03-18T00:00:00Z",
  contentOwner: "Will Soltani",
  book: {
    bookId: "art-of-war",
    title: "The Art of War",
    author: "Sun Tzu",
    categories: ["Strategy", "Leadership", "Decision Making"],
    tags: ["strategy", "timing", "leadership", "conflict", "judgment"],
    edition: {
      name: "13 Chapter Structure Student Interpretation",
      publishedYear: 2026,
    },
    variantFamily: "EMH",
  },
  chapters,
};

const disallowedDashPattern = /[\u2010-\u2015-]/;
const ignoredDashKeys = new Set([
  "bookId",
  "packageId",
  "chapterId",
  "exampleId",
  "questionId",
  "createdAt",
]);

function walk(value, visitor, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, [...path, String(index)]));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, next]) => walk(next, visitor, [...path, key]));
    return;
  }
  visitor(value, path);
}

walk(bookPackage, (value, path) => {
  if (typeof value !== "string") return;
  const lastKey = path[path.length - 1];
  if (ignoredDashKeys.has(lastKey)) return;
  if (disallowedDashPattern.test(value)) {
    throw new Error(`Disallowed dash found at ${path.join(".")}: ${value}`);
  }
});

for (const ch of chapters) {
  for (const [variantKey, variant] of Object.entries(ch.contentVariants)) {
    const paragraphs = variant.summaryBlocks.filter((block) => block.type === "paragraph");
    const bullets = variant.summaryBlocks.filter((block) => block.type === "bullet");
    if (paragraphs.length !== 2) {
      throw new Error(`${ch.chapterId} ${variantKey} must have exactly 2 summary paragraphs`);
    }
    if (bullets.length !== 10) {
      throw new Error(`${ch.chapterId} ${variantKey} must have exactly 10 bullets`);
    }
    if (variant.summaryBullets.length !== 10) {
      throw new Error(`${ch.chapterId} ${variantKey} must have exactly 10 summary bullets`);
    }
  }
  if (ch.quiz.questions.length !== 10) {
    throw new Error(`${ch.chapterId} must have exactly 10 quiz questions`);
  }
  ch.quiz.questions.forEach((q) => {
    if (q.choices.length !== 4) {
      throw new Error(`${q.questionId} must have 4 answer choices`);
    }
    if (/\bchapter\b/i.test(q.prompt)) {
      throw new Error(`${q.questionId} prompt mentions chapter`);
    }
  });
}

writeFileSync(outputPath, `${JSON.stringify(bookPackage, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
