/* ── Sample chapter content for Step 5 (First Learning Loop) ── */

import type { Motivation } from "../hooks/useOnboarding";

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

/* Atomic Habits — Chapter 1 */
const atomicHabitsLoop: FirstLoopContent = {
  summary: {
    bookId: "atomic-habits",
    bookTitle: "Atomic Habits",
    author: "James Clear",
    chapterTitle: "The Surprising Power of Atomic Habits",
    readingTime: "~2 min read",
    paragraphs: [
      "The core argument is that small, consistent changes compound over time into remarkable results. A 1% improvement every day leads to being 37 times better after a year, while a 1% decline leads to nearly zero. Most people overestimate the importance of single defining moments and underestimate the value of making slightly better decisions on a daily basis.",
      "The chapter introduces the concept of aggregation of marginal gains — the idea that searching for tiny improvements in everything you do accumulates into a significant overall advantage. This was demonstrated by British cycling coach Dave Brailsford, who improved hundreds of small details (pillow quality, hand-washing technique, tire grip) and led Team Sky to multiple Tour de France victories.",
      "The trap most people fall into is expecting linear progress. In reality, habits follow a valley of disappointment — results seem invisible for weeks or months, then compound suddenly. Understanding this curve is what separates people who stick with new habits from those who quit.",
    ],
    keyInsight:
      "Habits are the compound interest of self-improvement. The same way that money multiplies through compound interest, the effects of your habits multiply as you repeat them.",
  },
  scenarios: {
    work: {
      type: "work",
      situation:
        "You want to become a stronger public speaker at work, but the idea of giving a keynote feels impossible. You've avoided every presentation opportunity this quarter because the gap between where you are and where you want to be feels too large.",
      whatToDo:
        "Start with a 1% improvement: volunteer to give a 30-second status update at your next team standup. Then do it again next week. After a month, volunteer for a 2-minute segment. The goal isn't to become a keynote speaker tomorrow — it's to build the smallest possible speaking habit.",
      whyItMatters:
        "The chapter's core principle is that massive results come from tiny, repeated actions — not from motivation or willpower. By making the habit impossibly small, you remove the friction that causes avoidance. Once the habit of speaking exists, the duration and stakes naturally increase on their own.",
    },
    school: {
      type: "school",
      situation:
        "You have a final exam in six weeks and hundreds of pages to review. You keep planning marathon study sessions but end up procrastinating because the task feels overwhelming. You've barely started and the anxiety is building.",
      whatToDo:
        "Instead of planning to study for 4 hours, commit to reviewing just one page of notes before bed tonight. Put the notes on your desk so they're the first thing you see. The goal isn't to finish reviewing — it's to show up and start. One page is so small it feels almost silly, but that's the point.",
      whyItMatters:
        "Clear explains that habits compound like interest. Reviewing one page tonight leads to two tomorrow, then a full section by next week. The students who succeed aren't the ones with the best cramming sessions — they're the ones who showed up every single day, even when it felt insignificant.",
    },
    personal: {
      type: "personal",
      situation:
        "You've been trying to read more books this year, but after an initial burst of enthusiasm in January, you've barely finished one. Every evening you tell yourself you'll read, but you end up scrolling your phone instead. You're starting to think you're just \"not a reader.\"",
      whatToDo:
        "Instead of setting a goal like \"read 30 books this year,\" commit to reading just two pages before bed tonight. Put the book on your pillow so it's the first thing you touch. The goal isn't to finish — it's to not break the chain. Two pages is so small it feels almost silly, but that's the point.",
      whyItMatters:
        "The chapter's core principle is that massive results come from tiny, repeated actions — not from motivation or willpower. By making the habit impossibly small, you remove the friction that causes you to default to your phone. Once the habit of picking up the book exists, the duration naturally increases on its own.",
    },
  },
  quiz: [
    {
      question:
        "A friend says they want to get fit and plans to go to the gym for 90 minutes every day starting Monday. Based on this chapter, what's the most likely problem with this approach?",
      options: [
        { letter: "A", text: "They should go for 2 hours instead to see faster results", isCorrect: false },
        { letter: "B", text: "The habit is too large to sustain — starting smaller would build a more durable routine", isCorrect: true },
        { letter: "C", text: "They should focus on diet instead of exercise", isCorrect: false },
        { letter: "D", text: "Monday is a bad day to start new habits", isCorrect: false },
      ],
      explanation: "The chapter emphasizes starting with tiny habits that are easy to sustain. A 90-minute daily gym commitment is too ambitious and will likely lead to burnout.",
    },
    {
      question:
        "You've been practicing guitar for 3 weeks but feel like you're not improving at all. According to the chapter's concept of the \"valley of disappointment,\" what should you understand about this feeling?",
      options: [
        { letter: "A", text: "You should try a different instrument", isCorrect: false },
        { letter: "B", text: "Three weeks isn't enough time — real skill requires years of daily practice", isCorrect: false },
        { letter: "C", text: "This plateau is normal — habits compound, and results often appear suddenly after a period of seeming stagnation", isCorrect: true },
        { letter: "D", text: "You need a better teacher", isCorrect: false },
      ],
      explanation: "Clear describes the 'valley of disappointment' where results lag behind effort. Breakthroughs come suddenly after sustained, invisible progress.",
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

/* Export the default first loop content */
export const FIRST_LOOP_CONTENT = atomicHabitsLoop;
