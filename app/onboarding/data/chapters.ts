/* ── Sample chapter content for Step 6 (First Learning Loop) ── */

import type { Motivation, Tone } from "../hooks/useOnboarding";

export interface ChapterSummary {
  bookId: string;
  bookTitle: string;
  author: string;
  chapterTitle: string;
  readingTime: string;
  paragraphs: string[];
  keyInsight: string;
}

export interface ChapterScenario {
  type: "work" | "school" | "personal";
  situation: string;
  whatToDo: string;
  whyItMatters: string;
}

export interface QuizQuestion {
  question: string;
  options: { letter: string; text: string; isCorrect: boolean }[];
  explanation: string;
}

export interface FirstLoopContent {
  summary: ChapterSummary;
  scenarios: {
    work: ChapterScenario;
    school: ChapterScenario;
    personal: ChapterScenario;
  };
  quiz: QuizQuestion[];
}

/* Generic onboarding sample lesson */
const firstLoopData: FirstLoopContent = {
  summary: {
    bookId: "chapterflow-sample",
    bookTitle: "ChapterFlow Sample Lesson",
    author: "ChapterFlow",
    chapterTitle: "Spot the Turn Before It Hardens",
    readingTime: "~2 min read",
    paragraphs: [
      "Many hard interactions do not start with yelling. They start with a small turn in the room: tension rises, people protect themselves, and the real point gets avoided. A useful reader learns to catch that turn early instead of treating the fallout as a separate problem later.",
      "The core move is simple. Notice the moment when stakes rise, disagreement sharpens, and emotion starts changing how people speak. Once you can name that shift, you stop reacting only to tone and start asking what the conversation now needs.",
      "That early recognition creates better options. You can slow the pace, ask a cleaner question, or reset the goal before people drift into silence, defensiveness, or point-scoring. The chapter is not about winning the exchange. It is about keeping the exchange usable.",
    ],
    keyInsight:
      "The first useful skill in any difficult exchange is recognizing the turn early enough to change how you respond.",
  },
  scenarios: {
    work: {
      type: "work",
      situation:
        "Your manager asks for updates on a delayed project. A teammate starts explaining why another group caused the problem, and the room shifts from solving the issue to protecting reputations.",
      whatToDo:
        "Name the shift without attacking anyone. Try: 'It sounds like we may be moving from the deadline problem to the blame problem. Can we separate those for a minute and get clear on what is still blocking delivery?'",
      whyItMatters:
        "You are protecting the conversation from hardening into defense. Once people start guarding themselves, the useful facts usually disappear first.",
    },
    school: {
      type: "school",
      situation:
        "Your group project is falling behind. During a planning meeting, one student says, 'Some people clearly care more than others,' and everyone goes quiet.",
      whatToDo:
        "Reset the goal before the comment turns into a status fight. Try: 'I think the tension just jumped. Can we get specific about what is unfinished and who needs help, instead of guessing at motivation?'",
      whyItMatters:
        "The group is more likely to recover when you move from accusation to observable facts. That keeps the team focused on the task instead of the insult.",
    },
    personal: {
      type: "personal",
      situation:
        "A friend says, 'You never make time for me anymore,' after you cancel a plan. You can feel yourself preparing a defense before you fully understand what they mean.",
      whatToDo:
        "Pause and ask for the real concern before replying to the accusation. Try: 'I want to understand what made this feel bigger than one canceled plan. What has it been like from your side lately?'",
      whyItMatters:
        "That question shifts the exchange from self-defense to understanding. You are much more likely to solve the real issue when you respond to the concern underneath the sentence.",
    },
  },
  quiz: [
    {
      question:
        "What is the main skill this sample chapter is trying to build first?",
      options: [
        { letter: "A", text: "Recognizing when an exchange has turned tense enough to need a different approach", isCorrect: true },
        { letter: "B", text: "Winning the argument before the other person can respond", isCorrect: false },
        { letter: "C", text: "Collecting as many opinions as possible before saying anything", isCorrect: false },
        { letter: "D", text: "Avoiding all disagreement so the interaction stays calm", isCorrect: false },
      ],
      explanation: "The lesson starts with recognition. If you can spot the shift early, you still have room to change the conversation before it locks into defense or blame.",
    },
    {
      question:
        "A discussion suddenly becomes about blame instead of the actual problem. What is the strongest next move?",
      options: [
        { letter: "A", text: "Match the intensity so people know you are taking it seriously", isCorrect: false },
        { letter: "B", text: "Name the shift and redirect the conversation toward concrete facts and goals", isCorrect: true },
        { letter: "C", text: "Let the tension sit because strong emotion usually clears things up", isCorrect: false },
        { letter: "D", text: "Move to a new topic so nobody feels uncomfortable", isCorrect: false },
      ],
      explanation: "Once a conversation turns into defense, the useful information usually gets buried. Naming the shift helps the group recover the original problem.",
    },
  ],
};

/* Map motivations to scenario types */
export function getScenarioForMotivation(motivation: Motivation | null): "work" | "school" | "personal" {
  switch (motivation) {
    case "career":
      return "work";
    case "academic":
      return "school";
    case "personal":
    case "curiosity":
    default:
      return "personal";
  }
}

/* ── Tone-aware summary variants ── */

const toneSummaries: Record<Tone, { paragraphs: string[]; keyInsight: string }> = {
  gentle: {
    paragraphs: [
      "This sample chapter is meant to help you notice the moment a conversation becomes harder than it first looked. That shift can feel subtle at the start, which is why recognizing it calmly matters so much.",
      "When stakes rise and emotion changes how people speak, it becomes easier to react to surface tone than to the real issue underneath. The chapter invites you to slow down just enough to see what the conversation now needs.",
      "That is a reassuring skill because it gives you options. Recognition lets you move from reflex to intention before the exchange hardens into something more expensive.",
    ],
    keyInsight:
      "A calmer read of the moment often gives you the best chance to protect both the relationship and the real problem.",
  },
  direct: {
    paragraphs: firstLoopData.summary.paragraphs,
    keyInsight: firstLoopData.summary.keyInsight,
  },
  competitive: {
    paragraphs: [
      "Most people lose the conversation at the exact moment it changes and they fail to notice it. The room tightens, someone gets defensive, and the exchange stops being about the issue while everyone still pretends it is.",
      "The advantage goes to the person who catches that turn first. If you can name the shift before the room locks into blame, you control the next move instead of reacting to the mess after it spreads.",
      "That is the edge in this sample lesson: early recognition creates leverage. You do not need more intensity. You need a clearer read of what the conversation has become.",
    ],
    keyInsight:
      "The fastest way to regain control in a hard exchange is to notice the turn before everyone else starts fighting the wrong problem.",
  },
};

/* ── Tone-aware quiz feedback ── */

const toneQuizFeedback: Record<Tone, { correct: string; wrongPrefix: string }> = {
  gentle: {
    correct: "Exactly right — you're getting this.",
    wrongPrefix: "Not quite — here's another way to think about it.",
  },
  direct: {
    correct: "Correct.",
    wrongPrefix: "Wrong —",
  },
  competitive: {
    correct: "That's the move. You're ahead of 90% of people.",
    wrongPrefix: "Miss. That's the average answer —",
  },
};

/* ── Public API ── */

/** Get the first loop content adapted to the user's selected tone */
export function getFirstLoopContent(tone: Tone): FirstLoopContent {
  const variant = toneSummaries[tone];
  return {
    ...firstLoopData,
    summary: {
      ...firstLoopData.summary,
      paragraphs: variant.paragraphs,
      keyInsight: variant.keyInsight,
    },
    quiz: firstLoopData.quiz.map((q) => ({
      ...q,
      explanation: `${toneQuizFeedback[tone].wrongPrefix} ${q.explanation.charAt(0).toLowerCase()}${q.explanation.slice(1)}`,
    })),
  };
}

/** Get quiz feedback text for correct/wrong answers based on tone */
export function getQuizFeedback(tone: Tone) {
  return toneQuizFeedback[tone];
}

/* Export the default first loop content (direct tone) */
export const FIRST_LOOP_CONTENT = firstLoopData;
