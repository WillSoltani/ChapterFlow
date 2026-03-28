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

/* The 48 Laws of Power — Law 1 */
const firstLoopData: FirstLoopContent = {
  summary: {
    bookId: "the-48-laws-of-power",
    bookTitle: "The 48 Laws of Power",
    author: "Robert Greene",
    chapterTitle: "Never Outshine the Master",
    readingTime: "~2 min read",
    paragraphs: [
      "The first law of power is deceptively simple: always make those above you feel comfortably superior. When you try to impress them by displaying your talents too eagerly, you risk triggering their insecurities. The result is the opposite of what you intended — instead of admiration, you inspire fear and resentment.",
      "Greene illustrates this through the story of Nicolas Fouquet, finance minister to Louis XIV, who threw a lavish party at his estate that outshone the king's own palace. Within weeks, Fouquet was arrested and spent the rest of his life in prison. The lesson: your superiors want to feel secure in their position, not threatened by your brilliance.",
      "The key distinction is between making your master look good versus making yourself look good. The most successful courtiers throughout history understood that their power came from being indispensable to those above them — not from showcasing their own superiority. Discretion, not display, is the foundation of lasting influence.",
    ],
    keyInsight:
      "Make your superiors feel comfortably superior. Your restraint in displaying talent is itself a form of strategic intelligence that builds lasting influence.",
  },
  scenarios: {
    work: {
      type: "work",
      situation:
        "You just joined a new team and your manager presents a strategy you think has obvious flaws. In the next meeting, you feel the urge to propose your own superior plan in front of everyone to make a strong first impression.",
      whatToDo:
        "Instead of publicly correcting your manager, request a one-on-one conversation. Frame your ideas as building on their strategy: 'I was thinking about your plan and had some ideas that might support it.' Let them take ownership of the improvements. Your goal is to become their trusted advisor, not their rival.",
      whyItMatters:
        "Greene's first law warns that outshining your superiors triggers defensiveness, not gratitude. By channeling your ideas through your manager, you make them look good while positioning yourself as indispensable. The credit comes later — once trust is established, your influence grows naturally.",
    },
    school: {
      type: "school",
      situation:
        "Your professor makes a factual error during a lecture. You know the correct answer and several classmates are looking at you expectantly, knowing you're well-read on the topic. You're tempted to raise your hand and correct the mistake publicly.",
      whatToDo:
        "Let the moment pass in class. After the lecture, approach the professor privately and frame it as a question: 'I was curious about that point — I'd read something slightly different. Could you help me understand?' This lets them save face while still correcting the record. They'll remember you as thoughtful, not threatening.",
      whyItMatters:
        "The law teaches that people in authority positions are especially sensitive to being shown up publicly. A professor who feels embarrassed by a student is unlikely to become a mentor or advocate. By protecting their dignity, you gain an ally instead of creating a subtle adversary.",
    },
    personal: {
      type: "personal",
      situation:
        "You're at a family dinner and your older sibling — who everyone looks up to — shares advice about finances that you know is outdated. You've been studying personal finance extensively and could easily correct them with better information.",
      whatToDo:
        "Rather than contradicting them at the table, acknowledge their point first: 'That's a great foundation.' Later, in a private moment, share what you've learned as something you recently discovered — not as a correction. Let them feel like they inspired your interest in the topic rather than feeling shown up.",
      whyItMatters:
        "Greene's principle applies beyond professional settings. Family dynamics have their own power structures, and publicly outshining a respected family member can create lasting resentment. Preserving the relationship while subtly sharing knowledge is the more powerful move.",
    },
  },
  quiz: [
    {
      question:
        "Your new boss asks for your honest opinion on their proposed marketing strategy. You think it's mediocre. Based on Law 1, what's the best approach?",
      options: [
        { letter: "A", text: "Give a detailed critique showing all the weaknesses to demonstrate your expertise", isCorrect: false },
        { letter: "B", text: "Praise the strategy's strengths, then suggest enhancements that build on their vision", isCorrect: true },
        { letter: "C", text: "Say it's perfect to avoid any conflict", isCorrect: false },
        { letter: "D", text: "Email your own strategy to their boss instead", isCorrect: false },
      ],
      explanation: "Law 1 teaches that you should make superiors feel comfortably superior. Building on their ideas lets you improve the outcome while preserving the relationship.",
    },
    {
      question:
        "Nicolas Fouquet threw a magnificent party that impressed everyone — yet it destroyed his career. What was his critical mistake according to Greene?",
      options: [
        { letter: "A", text: "He spent too much money on the event", isCorrect: false },
        { letter: "B", text: "He invited the wrong guests", isCorrect: false },
        { letter: "C", text: "He made the king feel inferior by outshining him in splendor", isCorrect: true },
        { letter: "D", text: "He forgot to invite the king", isCorrect: false },
      ],
      explanation: "Fouquet's party was so magnificent it made Louis XIV feel overshadowed. The king's insecurity turned into swift punishment — a powerful reminder that those above you must always feel secure.",
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
      "This opening law is a thoughtful reminder that relationships with people in positions above you require care and awareness. When you display your talents too openly, it can unintentionally make others feel insecure — even if that's not your intention at all.",
      "Greene tells the story of Nicolas Fouquet, who threw an incredible party that accidentally overshadowed the king. It's a poignant example of how good intentions can backfire when we don't consider how others might feel. The takeaway isn't to hide who you are — it's to be mindful of the dynamics around you.",
      "The most reassuring part of this law is that restraint isn't weakness — it's wisdom. By making the people around you feel valued and secure, you build the kind of trust that opens doors naturally over time.",
    ],
    keyInsight:
      "Making others feel secure in your presence isn't about dimming your light — it's about building the trust that lets your influence grow naturally.",
  },
  direct: {
    paragraphs: firstLoopData.summary.paragraphs,
    keyInsight: firstLoopData.summary.keyInsight,
  },
  competitive: {
    paragraphs: [
      "Most people sabotage themselves before they even start by making the dumbest possible move: showing up their boss. Law 1 is Greene's warning shot — the people who climb fastest aren't the ones who broadcast their superiority. They're the ones who make the people above them feel brilliant while quietly becoming indispensable.",
      "Nicolas Fouquet had it all — wealth, taste, connections. He threw a party so stunning it made Louis XIV feel like a guest in someone else's kingdom. Weeks later, Fouquet was in chains. The lesson: your talent means nothing if it threatens the wrong person. The smartest players in history understood that discretion is the ultimate power move.",
      "Here's the edge: while your competition is busy trying to impress everyone in the room, you're making the decision-maker feel like a genius. That's not weakness — that's the kind of strategic restraint that separates people who have influence from people who just want attention.",
    ],
    keyInsight:
      "While others compete for attention, the real players make the people above them feel brilliant — and get rewarded with trust, access, and lasting power.",
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
