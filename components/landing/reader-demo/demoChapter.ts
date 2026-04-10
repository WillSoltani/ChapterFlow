/**
 * Single source of truth for the landing-page reader demo content.
 *
 * This file holds curated demo content for "Never Split the Difference · Chapter 1"
 * shaped to match the in-app reader's data types so we can feed the real
 * SummaryCard / ExamplesList / PracticePhase components from the app/book
 * reader directly. This is what makes the landing demo look identical to
 * the actual product.
 *
 * Editorial rule for this file: NO em dashes (U+2014). The phone screen
 * is small and em dashes look noisy at 7-10pt. Use periods, commas, or
 * parentheses instead. Hyphens and en dashes are fine.
 */

import type {
  ChapterExample,
  ChapterQuizQuestion,
  ChapterSummaryBlock,
  ImplementationPlanItem,
  ReadingDepth,
} from "@/app/book/data/mockChapters";

export const DEMO_CHAPTER_ID = "demo-never-split-the-difference-ch1";
export const DEMO_BOOK_ID = "never-split-the-difference";
export const DEMO_BOOK_TITLE = "Never Split the Difference";
export const DEMO_BOOK_AUTHOR = "Chris Voss";
export const DEMO_CHAPTER_NUMBER = 1;
export const DEMO_CHAPTER_TITLE = "The New Rules";

/* ------------------------------------------------------------------ */
/*  Summary blocks (paragraphs + bullets) by depth                    */
/* ------------------------------------------------------------------ */

const summarySimple: ChapterSummaryBlock[] = [
  {
    id: "p1-simple",
    type: "paragraph",
    text: "Old-school negotiation says: be rational, find common ground, split the difference. Voss says that's wrong. Real people don't negotiate with logic. They negotiate with feelings.",
  },
  {
    id: "p2-simple",
    type: "paragraph",
    text: "If you want a better outcome, stop trying to win the argument. Start trying to understand the other person. That's it. That's the whole new rule.",
  },
  {
    id: "b1-simple",
    type: "bullet",
    text: "People decide with emotion, then justify with logic.",
  },
  {
    id: "b2-simple",
    type: "bullet",
    text: "Listening is the cheapest thing you can offer, and the most valuable.",
  },
  {
    id: "b3-simple",
    type: "bullet",
    text: "Compromise (splitting the difference) usually means both sides lose.",
  },
];

const summaryStandard: ChapterSummaryBlock[] = [
  {
    id: "p1-standard",
    type: "paragraph",
    text: "For decades, negotiation theory taught that humans are rational actors who maximize utility. The traditional advice (have a strong BATNA, find a fair middle, split the difference) was built on that assumption. Voss spent two decades as the FBI's lead international hostage negotiator and learned the assumption is wrong.",
  },
  {
    id: "p2-standard",
    type: "paragraph",
    text: "Real negotiations are emotional. People don't decide based on what's logical. They decide based on what feels safe, fair, and respected. Push them toward logic and they dig in. Help them feel heard and they open up.",
  },
  {
    id: "p3-standard",
    type: "paragraph",
    text: "The skill the book teaches is tactical empathy: understanding the other side's emotions and intentions deeply enough to influence the conversation, not by arguing your case, but by making them feel like the case argues itself.",
  },
  {
    id: "b1-standard",
    type: "bullet",
    text: "The old rationalist negotiation playbook (BATNA, win-win, split the difference) was built on a false model of how humans actually decide.",
    detail:
      "Behavioral economics has shown that people are loss-averse, emotionally driven, and routinely irrational. Negotiation strategies that assume the other side is a calculator will lose to strategies that recognize the other side is a person.",
  },
  {
    id: "b2-standard",
    type: "bullet",
    text: "Tactical empathy is the active skill of recognizing the other side's feelings and using that recognition to shift the conversation.",
    detail:
      "It's not the same as sympathy. You don't have to agree. You just have to demonstrate that you understand. That demonstration is what lowers the other side's defenses and makes movement possible.",
  },
  {
    id: "b3-standard",
    type: "bullet",
    text: "Compromising is rarely the right answer. Splitting the difference often produces an outcome both sides feel worse about than the original positions.",
    detail:
      "If you want a black shoe and a brown shoe, splitting the difference gives you one of each. The middle is not always the best. Real negotiators look for asymmetric trades where each side gets what matters most to them.",
  },
  {
    id: "b4-standard",
    type: "bullet",
    text: "The first job in any negotiation is to make the other side feel safe enough to talk.",
    detail:
      "Without safety, you'll get positions, not interests. People defend positions; they share interests. Calibrated questions and labeling emotions are the tools that build that safety quickly.",
  },
];

const summaryDeeper: ChapterSummaryBlock[] = [
  {
    id: "p1-deeper",
    type: "paragraph",
    text: "Voss opens the book by tracing the intellectual history of modern negotiation theory back to the Harvard Negotiation Project (Getting to Yes, Fisher and Ury) and the rationalist assumptions it inherited from game theory. He argues that while these frameworks built a useful vocabulary (BATNA, ZOPA, interests vs. positions), they were built on a model of human decision-making that the next generation of behavioral research (Kahneman, Tversky) systematically dismantled.",
  },
  {
    id: "p2-deeper",
    type: "paragraph",
    text: "The book's thesis is that negotiation is fundamentally about emotional safety, not rational calculation. People negotiate well when they feel understood and badly when they feel attacked. The FBI hostage program rebuilt its training in the 1990s around this insight, replacing problem-solving frameworks with active listening, emotional labeling, and calibrated questions. Crisis outcomes improved dramatically.",
  },
  {
    id: "p3-deeper",
    type: "paragraph",
    text: "Voss frames the rest of the book as a working translation of those FBI techniques into everyday negotiation: salary, real estate, business deals, parenting, marriage. The mechanics are simple. The execution requires reorientation. Most readers, he warns, will find that the hardest part is not learning the moves, but unlearning the instinct to argue, persuade, and force a decision.",
  },
  {
    id: "b1-deeper",
    type: "bullet",
    text: "The Harvard Negotiation Project gave the field its vocabulary, but its rationalist assumptions don't survive contact with real human decision-making.",
    detail:
      "Getting to Yes (Fisher and Ury, 1981) introduced principled negotiation, BATNA (Best Alternative to a Negotiated Agreement), and the distinction between positions and interests. These concepts are still useful. But the book assumed a Kahneman-and-Tversky-pre-1979 world, where people optimize. They don't.",
  },
  {
    id: "b2-deeper",
    type: "bullet",
    text: "Behavioral economics broke the rational-actor model. Loss aversion, framing effects, and cognitive biases mean that emotion drives decisions even when people insist logic is in the driver's seat.",
    detail:
      "Daniel Kahneman's prospect theory showed that losses hurt about twice as much as equivalent gains feel good. That single asymmetry rewrites how a negotiator should frame proposals. Lead with what the other side stands to lose, not what they could gain, and you'll move them faster.",
  },
  {
    id: "b3-deeper",
    type: "bullet",
    text: "Tactical empathy is the operational concept of the book: deliberate, observable, repeatable techniques for recognizing emotion and using it to shape the other side's decision-making.",
    detail:
      "Tactical empathy is not warm and fuzzy. It is a discipline. Voss breaks it into specific moves: mirroring (repeating the last 1-3 words), labeling ('it sounds like you're worried about...'), accusations audits (naming the worst things they could say about you before they do), and calibrated questions (open questions starting with How and What). Each move has a measurable effect on the conversation.",
  },
  {
    id: "b4-deeper",
    type: "bullet",
    text: "Splitting the difference is a failure mode, not a goal. Compromise outcomes are usually worse for both sides than asymmetric trades that respect each side's actual priorities.",
    detail:
      "The book's title is the thesis. If two people each want something different, splitting the difference gives both of them half of what they don't want. Real negotiators look for trades where one side gives up something they care little about and the other side gets something that matters to them. That asymmetry creates real value, not the illusion of fairness.",
  },
  {
    id: "b5-deeper",
    type: "bullet",
    text: "The first job in any negotiation is to make the other side feel safe enough to share their actual position, not their bargaining position.",
    detail:
      "People defend bargaining positions (numbers, demands) but reveal interests (fears, hopes, constraints) only when they feel safe. Safety is built fast through tone of voice (the late-night FM DJ voice), labeling, and a refusal to argue. Until safety exists, every other technique is wasted.",
  },
];

export const DEMO_SUMMARY_BY_DEPTH: Record<ReadingDepth, ChapterSummaryBlock[]> = {
  simple: summarySimple,
  standard: summaryStandard,
  deeper: summaryDeeper,
};

/* ------------------------------------------------------------------ */
/*  Takeaways (the bullet text only) by depth                         */
/* ------------------------------------------------------------------ */

export const DEMO_TAKEAWAYS_BY_DEPTH: Record<ReadingDepth, string[]> = {
  simple: summarySimple
    .filter((b) => b.type === "bullet")
    .map((b) => b.text),
  standard: summaryStandard
    .filter((b) => b.type === "bullet")
    .map((b) => b.text),
  deeper: summaryDeeper
    .filter((b) => b.type === "bullet")
    .map((b) => b.text),
};

/* ------------------------------------------------------------------ */
/*  Activation prompts (Before You Read) by depth                     */
/* ------------------------------------------------------------------ */

export const DEMO_ACTIVATION_PROMPT_BY_DEPTH: Partial<
  Record<ReadingDepth, string>
> = {
  simple:
    "Think of a recent negotiation where you walked away frustrated. Hold it in mind as you read.",
  standard:
    "Think of a recent negotiation that didn't go the way you wanted (a salary talk, a price haggle, a tough conversation with a partner). As you read, look for the moment you reached for logic when the other side needed empathy.",
  deeper:
    "Identify a high-stakes negotiation in your past where the outcome felt unfair to both sides. Was it a compromise nobody loved? Why did splitting the difference feel like the only option in the moment? What were the actual interests on each side that never got named?",
};

/* ------------------------------------------------------------------ */
/*  Self-check prompts by depth                                        */
/* ------------------------------------------------------------------ */

export const DEMO_SELF_CHECK_PROMPTS_BY_DEPTH: Partial<
  Record<ReadingDepth, string[]>
> = {
  standard: [
    "In your own words, why does Voss say splitting the difference is usually a failure?",
    "What's the difference between a position and an interest? Give an example from your life.",
  ],
  deeper: [
    "How would you explain tactical empathy to a colleague who's never read the book?",
    "If the rationalist negotiation framework was so wrong, why did it survive for forty years before being challenged?",
    "What's the connection between Kahneman's loss aversion and Voss's claim that you should frame proposals around what the other side stands to lose?",
  ],
};

/* ------------------------------------------------------------------ */
/*  Key Quote                                                          */
/* ------------------------------------------------------------------ */

export const DEMO_KEY_QUOTE =
  "He who has learned to disagree without being disagreeable has discovered the most valuable secret of negotiation.";

/* ------------------------------------------------------------------ */
/*  1-Minute Recap by depth                                            */
/* ------------------------------------------------------------------ */

export const DEMO_RECAP_BY_DEPTH: Record<ReadingDepth, string[]> = {
  simple: [
    "People decide with emotion, then justify with logic.",
    "Listening is the cheapest move and the most powerful.",
    "Splitting the difference usually means both sides lose.",
  ],
  standard: [
    "The old rationalist negotiation playbook was built on a model of how humans decide that turns out to be wrong.",
    "Tactical empathy (recognizing emotion and reflecting it back) is the operational replacement.",
    "Compromise is a failure mode. Real negotiators find asymmetric trades where each side gets what matters most.",
    "The first move in any negotiation is making the other side feel safe enough to share their actual interests.",
  ],
  deeper: [
    "Modern negotiation theory inherited rationalist assumptions from game theory and the Harvard Negotiation Project. Behavioral economics has since shown those assumptions are wrong about how people actually decide.",
    "Tactical empathy is a discipline of specific, observable moves: mirroring, labeling, calibrated questions, accusations audit. Each has a measurable effect on the conversation.",
    "Loss aversion (Kahneman) is the single most important framing tool. People will work harder to avoid losing than to gain something equivalent.",
    "Splitting the difference is the thesis the book is built against. Asymmetric trades that respect each side's actual priorities produce better outcomes than fair-feeling middles.",
    "Safety precedes everything. Until the other side feels safe, you'll get bargaining positions instead of interests, and no technique will work.",
  ],
};

/* ------------------------------------------------------------------ */
/*  Examples (scenarios) used for both phone + desktop                */
/* ------------------------------------------------------------------ */

export const DEMO_EXAMPLES: ChapterExample[] = [
  {
    id: "ex-work-1",
    title: "The salary negotiation that hit a wall at 'final offer'",
    scope: "work",
    scenario:
      "You've been offered a job at $95K. You want $110K. The recruiter says the offer is final and there's no more room. You're tempted to either accept, walk away, or split the difference at $102K. Voss would say all three are mistakes.",
    whatToDo:
      "Don't argue the number. Ask a calibrated question: 'How am I supposed to make that work given the cost of living here and what I'd be leaving behind?' Then go silent and let them solve your problem. The recruiter often has more authority than they admit, and the question gives them a face-saving way to find more.",
    whyItMatters:
      "Splitting the difference at $102K leaves you frustrated for a year. The calibrated question shifts the burden of solving the problem onto the other side without forcing them into a corner. That's the move.",
    reflectionPrompt:
      "Before reading the analysis: what would you actually say in this moment? Type the exact sentence you'd send.",
  },
  {
    id: "ex-personal-1",
    title: "The argument with your partner about where to live",
    scope: "personal",
    scenario:
      "Your partner wants to move to the suburbs. You want to stay in the city. You've each made your case three times. Neither of you is moving. The conversation is starting to get tense, and you can feel it sliding into 'who wins'.",
    whatToDo:
      "Stop arguing your case. Try labeling: 'It sounds like the suburbs feel like the only place we can actually have the life you want.' Then shut up. Let them tell you what's underneath the position. Once you understand the actual interest (space, quiet, kids' future, escape from a hard memory), you can find a solution neither of you saw.",
    whyItMatters:
      "You weren't fighting about geography. You were fighting about an unspoken interest the position was hiding. Labeling brings the interest to the surface where it can actually be solved.",
    reflectionPrompt:
      "Think of a recurring fight in your relationship. What's the interest hiding behind the position?",
  },
  {
    id: "ex-school-1",
    title: "The professor who won't budge on your grade",
    scope: "school",
    scenario:
      "You got a B+ on a paper you thought was an A. You email the professor. They reply with a polite no. Most students would either accept it or argue point-by-point about the rubric. Both lose.",
    whatToDo:
      "Open with an accusations audit: 'I know this email probably feels like I'm just trying to argue my way to a better grade. I'm not. I'm trying to understand what I missed so I do better next time.' That preempts their defenses. Then ask: 'How could I have made the argument stronger?' Now they're teaching, not defending.",
    whyItMatters:
      "Arguing the rubric makes you look like every other grade-grubbing student. Asking how to improve makes you the rare student who actually wants to learn. Sometimes the grade changes. Always the relationship does.",
    reflectionPrompt:
      "What's the difference between asking 'why is this a B+' and 'how could I have made it stronger'? Why does the second one work?",
  },
];

/* ------------------------------------------------------------------ */
/*  Quiz questions by depth                                            */
/* ------------------------------------------------------------------ */

const quizStandard: ChapterQuizQuestion[] = [
  {
    id: "q1",
    prompt: "What's the core argument Voss makes against traditional negotiation theory?",
    options: [
      "It's too aggressive for modern workplaces",
      "It assumes people decide rationally when they actually decide emotionally",
      "It only works in business, not personal life",
      "It requires too much preparation to be practical",
    ],
    correctIndex: 1,
    explanation:
      "Voss argues that the rationalist model (BATNA, win-win, split the difference) was built on a flawed assumption about how humans decide. Behavioral economics has shown that people are loss-averse and emotionally driven, not utility-maximizing calculators.",
  },
  {
    id: "q2",
    prompt: "Why does Voss say splitting the difference is usually a failure?",
    options: [
      "It takes too long to reach the middle",
      "It produces an outcome both sides feel worse about than asymmetric trades that respect each side's priorities",
      "It only works when both parties trust each other",
      "It violates the principle of fairness",
    ],
    correctIndex: 1,
    explanation:
      "If you want a black shoe and a brown shoe, splitting the difference gives you one of each. Real negotiators look for asymmetric trades where one side gives up something they care little about and the other side gets something that matters most to them.",
  },
  {
    id: "q3",
    prompt: "What is tactical empathy?",
    options: [
      "Pretending to agree with the other side to win them over",
      "The deliberate skill of recognizing the other side's emotions and using that recognition to shape the negotiation",
      "A psychological trick that only works on inexperienced negotiators",
      "The same thing as sympathy",
    ],
    correctIndex: 1,
    explanation:
      "Tactical empathy is not sympathy. You don't have to agree with the other side, you just have to demonstrate that you understand them. That demonstration is what lowers their defenses and makes movement possible.",
  },
];

const quizSimple: ChapterQuizQuestion[] = quizStandard.slice(0, 2);
const quizDeeper: ChapterQuizQuestion[] = [
  ...quizStandard,
  {
    id: "q4",
    prompt: "How does Kahneman's loss aversion connect to Voss's framing advice?",
    options: [
      "It doesn't, they're unrelated fields",
      "Loss aversion explains why framing proposals around what the other side stands to lose moves them faster than framing around gains",
      "Loss aversion only applies to financial negotiations",
      "It's the reason the book uses storytelling instead of data",
    ],
    correctIndex: 1,
    explanation:
      "Kahneman's prospect theory showed that losses feel about twice as painful as equivalent gains feel good. Voss uses this to argue that negotiators should lead with what the other side stands to lose, not what they could gain. That single asymmetry is one of the most powerful tools in the book.",
  },
];

export const DEMO_QUIZ_BY_DEPTH: Record<ReadingDepth, ChapterQuizQuestion[]> = {
  simple: quizSimple,
  standard: quizStandard,
  deeper: quizDeeper,
};

/* ------------------------------------------------------------------ */
/*  Practice: One Takeaway, Implementation Plan, Predict              */
/* ------------------------------------------------------------------ */

export const DEMO_KEY_TAKEAWAY_CARD =
  "Stop arguing logic when the other side is running on emotion. Make them feel understood first, then watch the position shift.";

export const DEMO_IMPLEMENTATION_PLAN: ImplementationPlanItem = {
  coreSkill:
    "Recognize when a conversation is being driven by emotion (not logic) and respond with tactical empathy: label the feeling out loud, then go silent and let the other side fill the space.",
  ifThenPlans: [
    {
      context: "work",
      plan: "If a salary or scope conversation hits 'final offer', then I will ask one calibrated question ('How am I supposed to make that work?') and stay silent until they answer.",
    },
    {
      context: "personal",
      plan: "If a recurring fight is escalating, then I will pause and label the underlying feeling out loud before responding to the surface topic.",
    },
    {
      context: "school",
      plan: "If I'm pushing back on a grade or assignment, then I will open with an accusations audit (naming what they probably think I'm trying to do) before making my case.",
    },
  ],
  twentyFourHourChallenge:
    "In the next 24 hours, find one conversation where someone is upset and try a single label ('It sounds like you're frustrated with...'). Don't try to fix anything. Just notice what happens after you name the feeling.",
  weeklyPractice:
    "At the end of each week, list the conversations where you reached for logic when the other side needed empathy. Mark which ones you'd handle differently with tactical empathy. Track the trend.",
};

export const DEMO_PREDICTION_PROMPT_BY_DEPTH: Partial<Record<ReadingDepth, string>> = {
  standard:
    "Chapter 2 is called 'Be a Mirror'. Based on what you just read, what specific technique do you think Voss will introduce next, and why does mirroring matter for tactical empathy?",
  deeper:
    "If tactical empathy is the operational concept, what specific moves do you think the next chapter will introduce first, and how do they build on what Chapter 1 established about emotion vs. logic?",
};
