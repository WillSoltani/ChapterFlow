import type { LucideIcon } from "lucide-react";
import {
  BrainCircuit,
  Layers3,
  ListChecks,
  NotebookPen,
  Sparkles,
  Target,
} from "lucide-react";

export type LandingNavItem = {
  href: string;
  label: string;
};

export type LandingFeature = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  tags: string[];
  span?: "wide";
};

export type LandingStep = {
  number: string;
  title: string;
  body: string;
};

export type PricingPlan = {
  name: string;
  price: string;
  cadence: string;
  summary: string;
  features: string[];
  ctaLabel: string;
  featured?: boolean;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type ShowcaseMode = {
  id: "simple" | "standard" | "deeper";
  label: string;
  sessionLength: string;
  summaryTitle: string;
  summary: string;
  bullets: [string, string, string];
  progress: number;
  quizQuestions: number;
};

export type ShowcaseAudience = {
  id: "student" | "work" | "personal";
  label: string;
  title: string;
  scenario: string;
  application: string;
  whyItSticks: string;
  quizPrompt: string;
  quizOptions: [string, string, string];
  correctIndex: number;
};

export const landingContent = {
  nav: [
    { href: "#features", label: "Features" },
    { href: "#how-it-works", label: "How it works" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ] satisfies LandingNavItem[],
  hero: {
    eyebrow: "Guided reading platform",
    title: "Finish more books. Understand every chapter.",
    body:
      "ChapterFlow turns each chapter into a guided session with summaries, real-life examples, and quizzes that unlock the next step. You keep moving, and what you read actually sticks.",
    supporting:
      "Built for readers who want momentum and comprehension, not another stack of half-finished books.",
    proofPoints: [
      "Start free with no credit card",
      "Free plan includes up to 2 books",
      "Around 200 books and expanding rapidly",
    ],
    signalCards: [
      {
        label: "Chapter summaries",
        body: "See the point of each chapter before attention fades.",
      },
      {
        label: "Real-life examples",
        body: "Connect ideas to student, work, and personal situations.",
      },
      {
        label: "Quiz gates",
        body: "Prove understanding before the next chapter unlocks.",
      },
    ],
  },
  showcase: {
    eyebrow: "Interactive product preview",
    title: "See the learning loop that keeps readers moving.",
    body:
      "The product is designed around one clear flow: understand the chapter, connect it to real life, pass the quiz, and keep going.",
    surfacePoints: [
      "Three reading depths for different energy levels",
      "Audience-based example tabs that make ideas practical",
      "Quiz gating that rewards comprehension before progression",
    ],
    modes: [
      {
        id: "simple",
        label: "Simple",
        sessionLength: "6 min session",
        summaryTitle: "Quick clarity before you lose the thread",
        summary:
          "Simple mode gives you the core chapter idea, the most important supporting point, and a short quiz so you can keep momentum on busy days.",
        bullets: [
          "One clean chapter summary",
          "One real-life example that makes the idea click",
          "Short quiz to confirm the point landed",
        ],
        progress: 42,
        quizQuestions: 3,
      },
      {
        id: "standard",
        label: "Standard",
        sessionLength: "11 min session",
        summaryTitle: "The default reading flow for steady comprehension",
        summary:
          "Standard mode balances speed and depth with layered chapter takeaways, multiple example angles, and a stronger comprehension check before you move on.",
        bullets: [
          "Key ideas organized in a clear sequence",
          "Examples from multiple day-to-day contexts",
          "Quiz gate strong enough to catch weak understanding",
        ],
        progress: 67,
        quizQuestions: 4,
      },
      {
        id: "deeper",
        label: "Deeper",
        sessionLength: "18 min session",
        summaryTitle: "More context, more nuance, more retention",
        summary:
          "Deeper mode slows down just enough to surface nuance, explain why ideas matter, and help serious learners retain more from each chapter.",
        bullets: [
          "Expanded summary with nuance and chapter intent",
          "Context-rich examples that sharpen application",
          "More demanding quiz before the next chapter unlocks",
        ],
        progress: 83,
        quizQuestions: 5,
      },
    ] satisfies ShowcaseMode[],
    audiences: [
      {
        id: "student",
        label: "Student",
        title: "Use the chapter before the exam, not after the panic.",
        scenario:
          "You are reviewing a chapter the night before class and need the main idea, the real-world meaning, and a fast way to check whether you actually understand it.",
        application:
          "ChapterFlow gives you the summary first, then a student-oriented example, then a quiz so you can find confusion before test day finds it for you.",
        whyItSticks:
          "You are not just rereading. You are seeing the idea, applying it, and retrieving it in one loop.",
        quizPrompt:
          "Which action best turns a chapter summary into stronger exam retention?",
        quizOptions: [
          "Read the summary once and assume it will stick",
          "Pair the summary with examples and then test yourself",
          "Skip the quiz so you can move faster",
        ],
        correctIndex: 1,
      },
      {
        id: "work",
        label: "Work",
        title: "Translate book ideas into decisions you can use this week.",
        scenario:
          "You read to improve judgment, communication, or focus, but you need help turning abstract ideas into situations that actually show up at work.",
        application:
          "ChapterFlow reframes the chapter through work scenarios, then makes you verify the insight before the next chapter opens.",
        whyItSticks:
          "The idea is anchored to a real workplace situation, so recall feels usable instead of theoretical.",
        quizPrompt:
          "What makes a book insight more usable at work?",
        quizOptions: [
          "Seeing the concept in a realistic work scenario",
          "Reading more chapters before applying anything",
          "Relying on memory without a quiz check",
        ],
        correctIndex: 0,
      },
      {
        id: "personal",
        label: "Personal",
        title: "Make the chapter relevant to decisions in daily life.",
        scenario:
          "You want books to change habits, conversations, and choices at home, but it is easy to forget what a chapter meant once the reading session ends.",
        application:
          "ChapterFlow shows the same idea through a personal-life lens, then uses a short quiz to make recall active before you continue.",
        whyItSticks:
          "The chapter becomes connected to your own routines instead of staying trapped in book language.",
        quizPrompt:
          "How does ChapterFlow help an idea carry into daily life?",
        quizOptions: [
          "By attaching the idea to a personal scenario and testing it",
          "By asking you to memorize quotes word for word",
          "By letting you skip the comprehension check",
        ],
        correctIndex: 0,
      },
    ] satisfies ShowcaseAudience[],
  },
  features: {
    eyebrow: "Core features",
    title: "Designed for finishing books with real comprehension.",
    body:
      "Every section of the product supports the same outcome: keep readers moving while making sure the ideas are actually understood.",
    items: [
      {
        icon: Layers3,
        eyebrow: "Chapter summaries",
        title: "Every chapter is broken into a clear, readable learning step.",
        description:
          "Instead of facing another long wall of text, readers enter each chapter through a structured summary that makes the core idea obvious fast.",
        tags: ["Clear progression", "Faster re-entry", "Less friction"],
        span: "wide",
      },
      {
        icon: Sparkles,
        eyebrow: "Real-life relevance",
        title: "Examples that make abstract ideas click.",
        description:
          "Student, work, and personal contexts show how the same concept behaves in real life so the chapter feels useful, not distant.",
        tags: ["Student", "Work", "Personal"],
      },
      {
        icon: ListChecks,
        eyebrow: "Quiz gates",
        title: "Progress only feels earned when comprehension is checked.",
        description:
          "Short quizzes help readers confirm understanding before the next chapter unlocks, which reinforces retention instead of rewarding skimming.",
        tags: ["Unlock next chapter", "Short quizzes", "Retention first"],
      },
      {
        icon: BrainCircuit,
        eyebrow: "Depth modes",
        title: "Choose the right depth for the day without losing the structure.",
        description:
          "Simple, Standard, and Deeper modes let readers stay consistent when energy is low and go deeper when they want more nuance.",
        tags: ["Simple", "Standard", "Deeper"],
      },
      {
        icon: Target,
        eyebrow: "Reading momentum",
        title: "The product helps you keep going, not just start well.",
        description:
          "Guided chapter flow, visible progress, and a strong next step reduce the drift that usually turns books into abandoned intentions.",
        tags: ["Continue faster", "Stay oriented", "Keep finishing"],
      },
      {
        icon: NotebookPen,
        eyebrow: "Retention signals",
        title: "Track whether the chapter actually stayed with you.",
        description:
          "Progress is tied to completion and understanding, so the experience feels closer to guided learning than passive reading.",
        tags: ["Comprehension", "Recall", "Steady growth"],
      },
    ] satisfies LandingFeature[],
  },
  howItWorks: {
    eyebrow: "How it works",
    title: "A simple flow that makes finishing feel natural.",
    body:
      "The experience stays easy to follow even when the material is dense: one chapter, one guided sequence, one clear next step.",
    steps: [
      {
        number: "01",
        title: "Pick a book",
        body: "Start with a title you want to finish and enter the chapter flow instead of facing the whole book at once.",
      },
      {
        number: "02",
        title: "Read the chapter summary",
        body: "See the main idea, the chapter structure, and the key point before attention starts to slip.",
      },
      {
        number: "03",
        title: "Relate it to real life",
        body: "Switch to student, work, or personal examples so the idea becomes relevant outside the page.",
      },
      {
        number: "04",
        title: "Pass the quiz and continue",
        body: "Confirm understanding, unlock the next chapter, and keep the book moving forward with confidence.",
      },
    ] satisfies LandingStep[],
  },
  scale: {
    eyebrow: "Library and scale",
    title: "Substance before social proof.",
    body:
      "ChapterFlow already offers around 200 books, and the library is expanding rapidly. The trust signal is the product itself: more books, more guided reading paths, and a clearer system for working through them.",
    statValue: "Around 200 books",
    statLabel: "Already available",
    companionValue: "Expanding rapidly",
    companionLabel: "New titles added as the library grows",
    categories: [
      "Productivity",
      "Psychology",
      "Communication",
      "Business",
      "Self-improvement",
    ],
    shelf: [
      { title: "Atomic Habits", cover: "/book-covers/atomic-habits.svg" },
      { title: "Deep Work", cover: "/book-covers/deep-work.svg" },
      { title: "Thinking, Fast and Slow", cover: "/book-covers/thinking-fast-and-slow.svg" },
      { title: "Mindset", cover: "/book-covers/mindset.svg" },
    ],
  },
  pricing: {
    eyebrow: "Pricing",
    title: "Start free. Upgrade when you want more depth.",
    body:
      "The free plan is enough to experience the full chapter flow. Pro is there when you want unlimited books and the deepest reading mode.",
    plans: [
      {
        name: "Free",
        price: "$0",
        cadence: "",
        summary: "A clean way to try ChapterFlow and build a reading habit without friction.",
        features: [
          "Up to 2 books",
          "Simple mode",
          "Standard mode",
        ],
        ctaLabel: "Start free",
      },
      {
        name: "Pro",
        price: "7.99 CAD",
        cadence: "/month",
        summary: "For readers who want unlimited books and the deepest version of the chapter experience.",
        features: [
          "Unlimited books",
          "Deeper mode",
          "Cancel anytime",
        ],
        ctaLabel: "Start with Pro access later",
        featured: true,
      },
    ] satisfies PricingPlan[],
  },
  faq: {
    eyebrow: "FAQ",
    title: "Questions serious readers actually ask.",
    body:
      "The product is straightforward on purpose. These are the important details before you start.",
    items: [
      {
        question: "How does ChapterFlow help me finish books?",
        answer:
          "It breaks each book into guided chapter steps. You always know what to read next, what the chapter means, and what you need to do before moving forward.",
      },
      {
        question: "What is included in the free version?",
        answer:
          "The free plan includes up to 2 books plus access to Simple and Standard reading modes, so you can experience the core chapter-by-chapter workflow before upgrading.",
      },
      {
        question: "What is Deeper mode?",
        answer:
          "Deeper mode gives a more detailed chapter experience with added nuance, richer context, and a stronger comprehension loop for readers who want more than the essentials.",
      },
      {
        question: "Do I need to read the full book alongside it?",
        answer:
          "ChapterFlow is designed to help you work through books chapter by chapter with more structure. Depending on how you read, it can support the full book directly or reinforce what you read from the original text.",
      },
      {
        question: "What kinds of books are available?",
        answer:
          "The library focuses on books people return to for learning and growth, including productivity, psychology, communication, business, and self-improvement titles.",
      },
      {
        question: "Can I cancel Pro anytime?",
        answer:
          "Yes. Pro is a straightforward monthly subscription at 7.99 CAD, and you can cancel it whenever you want.",
      },
    ] satisfies FaqItem[],
  },
  finalCta: {
    eyebrow: "Start the first chapter",
    title: "If the goal is to finish books and remember them, start here.",
    body:
      "Create a free account, pick your first book, and see what chapter-by-chapter reading feels like when comprehension is built into the flow.",
  },
  footer: {
    blurb:
      "ChapterFlow is a guided reading app for people who want to finish more books, understand them better, and retain more of what they read.",
  },
} as const;
