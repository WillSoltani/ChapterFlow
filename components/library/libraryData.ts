// ── Extended library data for the psychology-driven redesign ──

export type Category =
  | "Psychology"
  | "Productivity"
  | "Strategy"
  | "Leadership"
  | "Communication"
  | "Philosophy";

export type Difficulty = "easy" | "medium" | "hard";
export type BadgeType = "trending" | "staff-pick" | "new" | "most-completed";

export interface UserProgress {
  currentChapter: number;
  percentComplete: number;
  lastReadAt: Date;
  xpEarned: number;
  isCompleted: boolean;
  completedAt?: Date;
}

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  authorCredentials?: string;
  coverImage?: string;
  coverGradient: string;
  hook: string;
  description: string;
  whatYoullLearn: string[];
  bestFor: string[];
  category: Category;
  difficulty: Difficulty;
  totalChapters: number;
  estimatedReadingTimeMinutes: number;
  readerCount: number;
  completionRate: number;
  isPro: boolean;
  badges: BadgeType[];
  staffPickReason?: string;
  similarBookId?: string;
  userProgress?: UserProgress;
}

export interface UserStats {
  firstName: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  booksCompleted: number;
  currentStreak: number;
  streakIsActiveToday: boolean;
  nextBadge: { name: string; booksAway: number };
  isPro: boolean;
  freeBooksUsed: number;
  freeBooksLimit: number;
}

export interface WeeklyChallenge {
  description: string;
  category?: Category;
  reward: { xp: number; badge?: string };
  progress: { current: number; target: number };
}

// ── Mock user stats ──
export const MOCK_USER_STATS: UserStats = {
  firstName: "Will",
  level: 4,
  xp: 1250,
  xpToNextLevel: 2000,
  booksCompleted: 3,
  currentStreak: 5,
  streakIsActiveToday: true,
  nextBadge: { name: "Avid Reader", booksAway: 2 },
  isPro: true,
  freeBooksUsed: 1,
  freeBooksLimit: 2,
};

// ── Mock weekly challenge ──
export const MOCK_WEEKLY_CHALLENGE: WeeklyChallenge = {
  description: "Start a book in Psychology",
  category: "Psychology",
  reward: { xp: 100, badge: "Explorer" },
  progress: { current: 1, target: 2 },
};

// ── All 25 books ──
export const MOCK_BOOKS: LibraryBook[] = [
  // ═══ IN-PROGRESS BOOKS ═══
  {
    id: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    authorCredentials: "Habits expert, keynote speaker, NYT bestselling author",
    coverImage: "/book-covers/atomic-habits.jpg",
    coverGradient: "linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)",
    hook: "Master the science of tiny improvements",
    description:
      "A proven framework for building good habits and breaking bad ones. Learn why small changes compound into remarkable results over time.",
    whatYoullLearn: [
      "The 4-step habit loop that makes behavior change stick",
      "How to design your environment for automatic success",
      "Why 1% daily improvements lead to 37x growth in a year",
    ],
    bestFor: ["entrepreneurs", "students", "anyone building routines"],
    category: "Productivity",
    difficulty: "easy",
    totalChapters: 12,
    estimatedReadingTimeMinutes: 144,
    readerCount: 4820,
    completionRate: 94,
    isPro: false,
    badges: ["trending", "most-completed"],
    similarBookId: "the-power-of-habit",
    userProgress: {
      currentChapter: 4,
      percentComplete: 33,
      lastReadAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
      xpEarned: 150,
      isCompleted: false,
    },
  },
  {
    id: "deep-work",
    title: "Deep Work",
    author: "Cal Newport",
    authorCredentials: "Georgetown professor, computer scientist, NYT bestselling author",
    coverImage: "/book-covers/deep-work.jpg",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #134e4a 100%)",
    hook: "Reclaim your attention in a noisy world",
    description:
      "Rules for focused success in a distracted world. Learn why the ability to concentrate is the new superpower in the knowledge economy.",
    whatYoullLearn: [
      "Why shallow work is killing your productivity",
      "4 strategies for building deep work into your schedule",
      "How to train your brain for sustained concentration",
    ],
    bestFor: ["knowledge workers", "students", "creative professionals"],
    category: "Productivity",
    difficulty: "medium",
    totalChapters: 14,
    estimatedReadingTimeMinutes: 210,
    readerCount: 3940,
    completionRate: 87,
    isPro: true,
    badges: ["trending"],
    similarBookId: "essentialism",
    userProgress: {
      currentChapter: 8,
      percentComplete: 57,
      lastReadAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      xpEarned: 280,
      isCompleted: false,
    },
  },
  {
    id: "thinking-fast-and-slow",
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    authorCredentials: "Nobel Prize winner in Economics, Princeton professor",
    coverImage: "/book-covers/thinking-fast-and-slow.jpg",
    coverGradient: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
    hook: "Understand the two systems driving every decision",
    description:
      "The definitive exploration of how our minds work. Discover why we make irrational choices and how to think more clearly.",
    whatYoullLearn: [
      "System 1 vs System 2: the fast and slow modes of thought",
      "Common cognitive biases that distort your judgment",
      "How to recognize and correct flawed thinking patterns",
    ],
    bestFor: ["decision-makers", "analysts", "curious minds"],
    category: "Psychology",
    difficulty: "hard",
    totalChapters: 18,
    estimatedReadingTimeMinutes: 324,
    readerCount: 3150,
    completionRate: 72,
    isPro: true,
    badges: ["staff-pick"],
    staffPickReason: "Our team's #1 for critical thinking",
    similarBookId: "predictably-irrational",
    userProgress: {
      currentChapter: 4,
      percentComplete: 22,
      lastReadAt: new Date(Date.now() - 1000 * 60 * 60 * 96),
      xpEarned: 90,
      isCompleted: false,
    },
  },

  // ═══ COMPLETED BOOKS ═══
  {
    id: "never-split-the-difference",
    title: "Never Split the Difference",
    author: "Chris Voss",
    authorCredentials: "Former FBI lead hostage negotiator",
    coverImage: "/book-covers/never-split-the-difference.jpg",
    coverGradient: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
    hook: "Win any negotiation without compromise",
    description:
      "Battle-tested negotiation tactics from the FBI's top negotiator. Learn tactical empathy and calibrated questions that work in any situation.",
    whatYoullLearn: [
      "Tactical empathy: how to read and influence emotions",
      "The power of calibrated 'no' and open-ended questions",
      "Mirroring and labeling techniques for instant rapport",
    ],
    bestFor: ["professionals", "managers", "anyone who negotiates"],
    category: "Communication",
    difficulty: "medium",
    totalChapters: 10,
    estimatedReadingTimeMinutes: 150,
    readerCount: 3680,
    completionRate: 91,
    isPro: true,
    badges: ["most-completed"],
    similarBookId: "influence",
    userProgress: {
      currentChapter: 10,
      percentComplete: 100,
      lastReadAt: new Date("2026-03-15"),
      xpEarned: 350,
      isCompleted: true,
      completedAt: new Date("2026-03-15"),
    },
  },
  {
    id: "friends-and-influence-student-edition",
    title: "How to Win Friends and Influence People",
    author: "Dale Carnegie",
    authorCredentials: "Pioneer of self-improvement, legendary speaker & trainer",
    coverImage: "/book-covers/how-to-win-friends.jpg",
    coverGradient: "linear-gradient(135deg, #d97706 0%, #92400e 100%)",
    hook: "The timeless art of genuine connection",
    description:
      "The original masterclass in human relations. Timeless principles for making friends, winning people over, and leading with warmth.",
    whatYoullLearn: [
      "6 ways to make people genuinely like you",
      "How to win arguments by avoiding them entirely",
      "Leadership techniques that inspire willing cooperation",
    ],
    bestFor: ["leaders", "salespeople", "introverts"],
    category: "Communication",
    difficulty: "easy",
    totalChapters: 12,
    estimatedReadingTimeMinutes: 144,
    readerCount: 4210,
    completionRate: 89,
    isPro: true,
    badges: ["most-completed"],
    similarBookId: "never-split-the-difference",
    userProgress: {
      currentChapter: 12,
      percentComplete: 100,
      lastReadAt: new Date("2026-02-28"),
      xpEarned: 320,
      isCompleted: true,
      completedAt: new Date("2026-02-28"),
    },
  },
  {
    id: "the-7-habits-of-highly-effective-people",
    title: "The 7 Habits of Highly Effective People",
    author: "Stephen R. Covey",
    authorCredentials: "Leadership authority, co-founder FranklinCovey",
    coverImage: "/book-covers/the-7-habits-of-highly-effective-people.jpg",
    coverGradient: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
    hook: "Timeless principles for personal effectiveness",
    description:
      "The foundational guide to character-based effectiveness. Move from dependence to independence to interdependence.",
    whatYoullLearn: [
      "How to be proactive instead of reactive in every situation",
      "The difference between urgency and true importance",
      "Synergy: why collaboration beats solo effort every time",
    ],
    bestFor: ["aspiring leaders", "students", "career changers"],
    category: "Productivity",
    difficulty: "medium",
    totalChapters: 15,
    estimatedReadingTimeMinutes: 225,
    readerCount: 3870,
    completionRate: 82,
    isPro: true,
    badges: ["staff-pick"],
    staffPickReason: "Best foundation for personal growth",
    similarBookId: "atomic-habits",
    userProgress: {
      currentChapter: 15,
      percentComplete: 100,
      lastReadAt: new Date("2026-01-20"),
      xpEarned: 400,
      isCompleted: true,
      completedAt: new Date("2026-01-20"),
    },
  },

  // ═══ NOT STARTED — Section A: "Short on time?" ═══
  {
    id: "art-of-war",
    title: "The Art of War",
    author: "Sun Tzu",
    authorCredentials: "Ancient Chinese military strategist & philosopher",
    coverImage: "/book-covers/art-of-war.jpg",
    coverGradient: "linear-gradient(135deg, #78350f 0%, #451a03 100%)",
    hook: "Ancient strategies for modern challenges",
    description:
      "The most influential strategy text in history. Apply 2,500-year-old military wisdom to business, leadership, and competition.",
    whatYoullLearn: [
      "How to win without fighting through strategic positioning",
      "The art of deception and information advantage",
      "When to engage, when to retreat, and when to wait",
    ],
    bestFor: ["strategists", "entrepreneurs", "competitive thinkers"],
    category: "Strategy",
    difficulty: "easy",
    totalChapters: 8,
    estimatedReadingTimeMinutes: 96,
    readerCount: 2450,
    completionRate: 88,
    isPro: false,
    badges: ["staff-pick"],
    staffPickReason: "Best intro to strategic thinking",
    similarBookId: "the-48-laws-of-power",
  },
  {
    id: "the-one-thing",
    title: "The ONE Thing",
    author: "Gary Keller",
    authorCredentials: "Co-founder of Keller Williams Realty, bestselling author",
    coverImage: "/book-covers/the-one-thing.jpg",
    coverGradient: "linear-gradient(135deg, #e11d48 0%, #9f1239 100%)",
    hook: "Find the single thing that makes everything easier",
    description:
      "Cut through the noise and focus on the one thing that matters most. A simple but powerful approach to extraordinary results.",
    whatYoullLearn: [
      "The focusing question that simplifies every decision",
      "Why multitasking is a myth backed by neuroscience",
      "How to build a domino chain of cascading results",
    ],
    bestFor: ["overwhelmed professionals", "entrepreneurs", "students"],
    category: "Productivity",
    difficulty: "easy",
    totalChapters: 8,
    estimatedReadingTimeMinutes: 96,
    readerCount: 1920,
    completionRate: 90,
    isPro: true,
    badges: [],
    similarBookId: "essentialism",
  },
  {
    id: "ego-is-the-enemy",
    title: "Ego Is the Enemy",
    author: "Ryan Holiday",
    authorCredentials: "Stoic philosophy author, media strategist, NYT bestseller",
    coverImage: "/book-covers/ego-is-the-enemy.jpg",
    coverGradient: "linear-gradient(135deg, #374151 0%, #111827 100%)",
    hook: "Get out of your own way to succeed",
    description:
      "Drawing on Stoic philosophy and historical examples, learn why ego is the invisible force sabotaging your success at every stage.",
    whatYoullLearn: [
      "How ego sabotages aspiration, success, and recovery",
      "Stoic practices for staying grounded at any level",
      "Why humility is the ultimate competitive advantage",
    ],
    bestFor: ["leaders", "athletes", "ambitious professionals"],
    category: "Philosophy",
    difficulty: "easy",
    totalChapters: 9,
    estimatedReadingTimeMinutes: 108,
    readerCount: 1870,
    completionRate: 83,
    isPro: true,
    badges: [],
    similarBookId: "mans-search-for-meaning",
  },

  // ═══ NOT STARTED — Section B: "Rewire how you think" ═══
  {
    id: "predictably-irrational",
    title: "Predictably Irrational",
    author: "Dan Ariely",
    authorCredentials: "Duke professor of behavioral economics, TED speaker",
    coverImage: "/book-covers/predictably-irrational.jpg",
    coverGradient: "linear-gradient(135deg, #c026d3 0%, #701a75 100%)",
    hook: "Discover the hidden forces shaping your choices",
    description:
      "Fascinating experiments reveal why we consistently make irrational decisions — and how understanding this can improve your life.",
    whatYoullLearn: [
      "Why 'free' makes us do irrational things",
      "How anchoring prices manipulate what you'll pay",
      "The predictable patterns behind our worst decisions",
    ],
    bestFor: ["marketers", "decision-makers", "curious minds"],
    category: "Psychology",
    difficulty: "medium",
    totalChapters: 13,
    estimatedReadingTimeMinutes: 195,
    readerCount: 1780,
    completionRate: 78,
    isPro: true,
    badges: ["staff-pick"],
    staffPickReason: "Most eye-opening on behavioral economics",
    similarBookId: "thinking-fast-and-slow",
  },
  {
    id: "influence",
    title: "Influence",
    author: "Robert Cialdini",
    authorCredentials: "Arizona State professor, the godfather of persuasion science",
    coverImage: "/book-covers/influence.jpg",
    coverGradient: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
    hook: "The six weapons of ethical persuasion",
    description:
      "The definitive guide to the psychology of persuasion. Understand why people say yes — and how to apply these insights ethically.",
    whatYoullLearn: [
      "The 6 universal principles that drive compliance",
      "How reciprocity, scarcity, and authority shape decisions",
      "Ethical applications for marketing, leadership, and life",
    ],
    bestFor: ["marketers", "salespeople", "leaders"],
    category: "Psychology",
    difficulty: "medium",
    totalChapters: 12,
    estimatedReadingTimeMinutes: 180,
    readerCount: 2670,
    completionRate: 86,
    isPro: true,
    badges: ["trending"],
    similarBookId: "predictably-irrational",
  },
  {
    id: "mindset",
    title: "Mindset",
    author: "Carol S. Dweck",
    authorCredentials: "Stanford professor, pioneering researcher on motivation",
    coverImage: "/book-covers/mindset.jpg",
    coverGradient: "linear-gradient(135deg, #16a34a 0%, #166534 100%)",
    hook: "How beliefs about talent shape your destiny",
    description:
      "The groundbreaking research on fixed vs. growth mindset. Discover why your beliefs about intelligence matter more than intelligence itself.",
    whatYoullLearn: [
      "Fixed vs. growth mindset: how to identify yours",
      "Why praising effort beats praising intelligence",
      "How to cultivate a growth mindset in yourself and others",
    ],
    bestFor: ["parents", "educators", "anyone feeling stuck"],
    category: "Psychology",
    difficulty: "easy",
    totalChapters: 10,
    estimatedReadingTimeMinutes: 120,
    readerCount: 2530,
    completionRate: 88,
    isPro: true,
    badges: [],
    similarBookId: "drive",
  },
  {
    id: "thinking-in-bets",
    title: "Thinking in Bets",
    author: "Annie Duke",
    authorCredentials: "Former pro poker champion, decision strategist",
    coverImage: "/book-covers/thinking-in-bets.jpg",
    coverGradient: "linear-gradient(135deg, #7e22ce 0%, #581c87 100%)",
    hook: "Make smarter decisions in an uncertain world",
    description:
      "A poker champion's guide to decision-making under uncertainty. Learn to separate skill from luck and outcome from process.",
    whatYoullLearn: [
      "Why resulting (judging by outcome) leads you astray",
      "How to think in probabilities instead of certainties",
      "Building a decision group for better collective thinking",
    ],
    bestFor: ["investors", "managers", "strategic thinkers"],
    category: "Psychology",
    difficulty: "medium",
    totalChapters: 10,
    estimatedReadingTimeMinutes: 150,
    readerCount: 1420,
    completionRate: 80,
    isPro: true,
    badges: [],
    similarBookId: "thinking-fast-and-slow",
  },
  {
    id: "drive",
    title: "Drive",
    author: "Daniel H. Pink",
    authorCredentials: "NYT bestselling author, former chief speechwriter to VP Gore",
    coverImage: "/book-covers/drive.jpg",
    coverGradient: "linear-gradient(135deg, #ea580c 0%, #9a3412 100%)",
    hook: "What really motivates us beyond rewards",
    description:
      "The surprising truth about what drives human performance. Learn why autonomy, mastery, and purpose beat carrots and sticks.",
    whatYoullLearn: [
      "Why traditional rewards actually decrease performance",
      "The 3 pillars of intrinsic motivation: autonomy, mastery, purpose",
      "How to redesign work for engagement and flow",
    ],
    bestFor: ["managers", "HR professionals", "educators"],
    category: "Psychology",
    difficulty: "medium",
    totalChapters: 11,
    estimatedReadingTimeMinutes: 165,
    readerCount: 2180,
    completionRate: 81,
    isPro: true,
    badges: [],
    similarBookId: "mindset",
  },

  // ═══ NOT STARTED — Section C: "Stop relying on willpower" ═══
  {
    id: "the-power-of-habit",
    title: "The Power of Habit",
    author: "Charles Duhigg",
    authorCredentials: "Pulitzer Prize–winning reporter, New Yorker staff writer",
    coverImage: "/book-covers/the-power-of-habit.jpg",
    coverGradient: "linear-gradient(135deg, #059669 0%, #064e3b 100%)",
    hook: "Why we do what we do, and how to change",
    description:
      "The science behind habit formation in individuals, organizations, and societies. Master the habit loop to transform your behavior.",
    whatYoullLearn: [
      "The cue-routine-reward loop that governs every habit",
      "Keystone habits: small changes with cascading effects",
      "How organizations and movements use habits to transform",
    ],
    bestFor: ["self-improvers", "managers", "curious minds"],
    category: "Productivity",
    difficulty: "medium",
    totalChapters: 12,
    estimatedReadingTimeMinutes: 180,
    readerCount: 2890,
    completionRate: 84,
    isPro: true,
    badges: ["trending"],
    similarBookId: "atomic-habits",
  },
  {
    id: "essentialism",
    title: "Essentialism",
    author: "Greg McKeown",
    authorCredentials: "Stanford lecturer, leadership advisor to Apple and Google",
    coverImage: "/book-covers/essentialism.jpg",
    coverGradient: "linear-gradient(135deg, #0284c7 0%, #075985 100%)",
    hook: "Do less, but do it incomparably well",
    description:
      "The disciplined pursuit of less. A systematic approach to determining what's essential and eliminating everything else.",
    whatYoullLearn: [
      "How to identify the vital few from the trivial many",
      "Saying no gracefully without damaging relationships",
      "Creating systems that make execution effortless",
    ],
    bestFor: ["overwhelmed professionals", "leaders", "perfectionists"],
    category: "Productivity",
    difficulty: "easy",
    totalChapters: 10,
    estimatedReadingTimeMinutes: 120,
    readerCount: 2340,
    completionRate: 87,
    isPro: true,
    badges: [],
    similarBookId: "the-one-thing",
  },
  {
    id: "getting-things-done",
    title: "Getting Things Done",
    author: "David Allen",
    authorCredentials: "Productivity consultant, creator of the GTD methodology",
    coverImage: "/book-covers/getting-things-done.jpg",
    coverGradient: "linear-gradient(135deg, #0d9488 0%, #115e59 100%)",
    hook: "Clear your mind. Organize your life.",
    description:
      "The definitive productivity system. Learn to capture, clarify, and organize everything so you can focus with a clear mind.",
    whatYoullLearn: [
      "The 5-step GTD workflow: capture, clarify, organize, reflect, engage",
      "How to achieve 'mind like water' — stress-free productivity",
      "The 2-minute rule and weekly review that change everything",
    ],
    bestFor: ["busy professionals", "project managers", "freelancers"],
    category: "Productivity",
    difficulty: "medium",
    totalChapters: 13,
    estimatedReadingTimeMinutes: 195,
    readerCount: 2040,
    completionRate: 76,
    isPro: true,
    badges: [],
    similarBookId: "deep-work",
  },

  // ═══ NOT STARTED — Section D: "Influence the room" ═══
  {
    id: "extreme-ownership",
    title: "Extreme Ownership",
    author: "Jocko Willink",
    authorCredentials: "Retired Navy SEAL commander, leadership instructor",
    coverImage: "/book-covers/extreme-ownership.jpg",
    coverGradient: "linear-gradient(135deg, #1e3a5f 0%, #0a1628 100%)",
    hook: "Lead by taking total responsibility",
    description:
      "Leadership lessons from the battlefield. A Navy SEAL commander shows how taking complete ownership transforms teams and outcomes.",
    whatYoullLearn: [
      "Why leaders must own everything in their world",
      "How to lead up, down, and across the chain of command",
      "Battlefield-tested principles for any leadership challenge",
    ],
    bestFor: ["team leaders", "managers", "military enthusiasts"],
    category: "Leadership",
    difficulty: "medium",
    totalChapters: 12,
    estimatedReadingTimeMinutes: 180,
    readerCount: 2310,
    completionRate: 85,
    isPro: true,
    badges: [],
    similarBookId: "the-hard-thing-about-hard-things",
  },
  {
    id: "the-48-laws-of-power",
    title: "The 48 Laws of Power",
    author: "Robert Greene",
    authorCredentials: "Bestselling author on strategy, power, and human nature",
    coverImage: "/book-covers/the-48-laws-of-power.jpg",
    coverGradient: "linear-gradient(135deg, #b91c1c 0%, #450a0a 100%)",
    hook: "Navigate power dynamics with strategic awareness",
    description:
      "Drawing on 3,000 years of history, master the laws that govern power, influence, and social dynamics in any environment.",
    whatYoullLearn: [
      "How to read social dynamics and power structures",
      "Strategic principles from Machiavelli to Sun Tzu",
      "Defensive awareness: how to protect yourself from manipulation",
    ],
    bestFor: ["ambitious professionals", "strategists", "history buffs"],
    category: "Strategy",
    difficulty: "hard",
    totalChapters: 16,
    estimatedReadingTimeMinutes: 288,
    readerCount: 2980,
    completionRate: 68,
    isPro: true,
    badges: ["trending"],
    similarBookId: "the-prince",
  },
  {
    id: "the-hard-thing-about-hard-things",
    title: "The Hard Thing About Hard Things",
    author: "Ben Horowitz",
    authorCredentials: "Co-founder of Andreessen Horowitz, tech CEO veteran",
    coverImage: "/book-covers/the-hard-thing-about-hard-things.jpg",
    coverGradient: "linear-gradient(135deg, #44403c 0%, #1c1917 100%)",
    hook: "Survive the hardest parts of building something",
    description:
      "No-BS advice for the moments when there are no easy answers. Real stories from the trenches of building and leading companies.",
    whatYoullLearn: [
      "How to make impossible decisions under extreme pressure",
      "Managing your own psychology as a leader",
      "When to pivot, when to persevere, and when to let go",
    ],
    bestFor: ["founders", "CEOs", "startup teams"],
    category: "Leadership",
    difficulty: "hard",
    totalChapters: 14,
    estimatedReadingTimeMinutes: 252,
    readerCount: 1830,
    completionRate: 74,
    isPro: true,
    badges: [],
    similarBookId: "extreme-ownership",
  },
  {
    id: "measure-what-matters",
    title: "Measure What Matters",
    author: "John Doerr",
    authorCredentials: "Legendary Silicon Valley investor, board member at Google",
    coverImage: "/book-covers/measure-what-matters.jpg",
    coverGradient: "linear-gradient(135deg, #065f46 0%, #022c22 100%)",
    hook: "Set goals that actually drive results",
    description:
      "The OKR system that powered Google, Intel, and the Gates Foundation. A practical guide to setting and achieving ambitious goals.",
    whatYoullLearn: [
      "How OKRs align teams around what truly matters",
      "The difference between key results and vanity metrics",
      "Real case studies from Google, Bono, and the Gates Foundation",
    ],
    bestFor: ["managers", "founders", "team leads"],
    category: "Leadership",
    difficulty: "medium",
    totalChapters: 11,
    estimatedReadingTimeMinutes: 165,
    readerCount: 1650,
    completionRate: 79,
    isPro: true,
    badges: ["new"],
    similarBookId: "getting-things-done",
  },
  {
    id: "the-prince",
    title: "The Prince",
    author: "Niccolò Machiavelli",
    authorCredentials: "Renaissance political philosopher and diplomat",
    coverImage: "/book-covers/the-prince.jpg",
    coverGradient: "linear-gradient(135deg, #6b21a8 0%, #3b0764 100%)",
    hook: "The unfiltered playbook of power and politics",
    description:
      "The most controversial leadership text ever written. A ruthlessly practical guide to acquiring and maintaining political power.",
    whatYoullLearn: [
      "Why it's better to be feared than loved (and the nuance)",
      "How to read political situations and act decisively",
      "The ethics of leadership in an imperfect world",
    ],
    bestFor: ["political minds", "leaders", "history enthusiasts"],
    category: "Strategy",
    difficulty: "medium",
    totalChapters: 10,
    estimatedReadingTimeMinutes: 150,
    readerCount: 1540,
    completionRate: 77,
    isPro: true,
    badges: [],
    similarBookId: "the-48-laws-of-power",
  },

  // ═══ NOT STARTED — Browse All only ═══
  {
    id: "mans-search-for-meaning",
    title: "Man's Search for Meaning",
    author: "Viktor E. Frankl",
    authorCredentials: "Holocaust survivor, psychiatrist, founder of logotherapy",
    coverImage: "/book-covers/mans-search-for-meaning.jpg",
    coverGradient: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
    hook: "Find purpose even in the darkest times",
    description:
      "One of the most profound books ever written. A Holocaust survivor reveals how finding meaning sustains us through any suffering.",
    whatYoullLearn: [
      "Logotherapy: finding meaning as the primary drive of life",
      "How purpose sustains people through unimaginable hardship",
      "Practical exercises for discovering your own meaning",
    ],
    bestFor: ["seekers", "therapists", "anyone at a crossroads"],
    category: "Philosophy",
    difficulty: "medium",
    totalChapters: 9,
    estimatedReadingTimeMinutes: 135,
    readerCount: 2760,
    completionRate: 90,
    isPro: true,
    badges: ["staff-pick"],
    staffPickReason: "Most transformative book in our library",
    similarBookId: "ego-is-the-enemy",
  },
];

// ── Curated section config (NO duplication across sections) ──
export interface CuratedSectionConfig {
  narrativeTitle: string;
  narrativeSubtitle: string;
  bookIds: string[];
}

export const CURATED_SECTIONS: CuratedSectionConfig[] = [
  {
    narrativeTitle: "Short on time? Big on impact.",
    narrativeSubtitle:
      "These books deliver transformative ideas in under 2 hours of focused reading.",
    bookIds: [
      "art-of-war",
      "ego-is-the-enemy",
      "mans-search-for-meaning",
      "the-prince",
      "mastery",
    ],
  },
  {
    narrativeTitle: "Rewire how you think.",
    narrativeSubtitle:
      "Psychology and decision-making frameworks that change your perspective forever.",
    bookIds: [
      "predictably-irrational",
      "influence",
      "mindset",
      "thinking-in-bets",
      "drive",
    ],
  },
  {
    narrativeTitle: "Stop relying on willpower.",
    narrativeSubtitle:
      "Build habits, systems, and routines that do the hard work for you.",
    bookIds: [
      "the-power-of-habit",
      "essentialism",
      "getting-things-done",
      "the-one-thing",
      "the-7-habits-of-highly-effective-people",
    ],
  },
  {
    narrativeTitle: "Influence the room.",
    narrativeSubtitle:
      "Master negotiation, communication, and leadership skills that separate the good from the great.",
    bookIds: [
      "extreme-ownership",
      "the-48-laws-of-power",
      "the-hard-thing-about-hard-things",
      "measure-what-matters",
      "the-prince",
    ],
  },
];

// ── Helpers ──

export function getBookById(id: string): LibraryBook | undefined {
  return MOCK_BOOKS.find((b) => b.id === id);
}

export function getBooksById(ids: string[]): LibraryBook[] {
  const map = new Map(MOCK_BOOKS.map((b) => [b.id, b]));
  return ids.map((id) => map.get(id)).filter((b): b is LibraryBook => !!b);
}

export function getInProgressBooks(): LibraryBook[] {
  return MOCK_BOOKS.filter(
    (b) => b.userProgress && !b.userProgress.isCompleted && b.userProgress.percentComplete > 0
  );
}

export function getCompletedBooks(): LibraryBook[] {
  return MOCK_BOOKS.filter((b) => b.userProgress?.isCompleted);
}

export function getNotStartedBooks(): LibraryBook[] {
  return MOCK_BOOKS.filter((b) => !b.userProgress);
}

export function formatReadingTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function getProgressMicrocopy(percent: number, chaptersLeft: number): string {
  if (percent === 100) return "Completed!";
  if (percent >= 75) return `Almost done! Just ${chaptersLeft} chapter${chaptersLeft === 1 ? "" : "s"} left`;
  if (percent >= 50) return "More than halfway there — keep going!";
  if (percent >= 25) return "Building momentum — you're into the good stuff";
  return "Just getting started — the best insights are ahead";
}

export function getProgressColor(percent: number): string {
  if (percent >= 75) return "var(--accent-gold)";
  if (percent >= 50) return "var(--accent-green)";
  return "var(--accent-teal)";
}

export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

/** Days since date */
export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/** Returns urgency color based on days since last read */
export function getLastReadUrgencyColor(date: Date): string {
  const days = daysSince(date);
  if (days >= 6) return "var(--accent-red)";
  if (days >= 3) return "var(--accent-flame)";
  return "var(--text-muted)";
}

/** Returns urgency copy for stale reads */
export function getLastReadCopy(date: Date): string {
  const days = daysSince(date);
  const base = timeAgo(date);
  if (days >= 6) return `Last read: ${base} — don't lose your progress!`;
  return `Last read: ${base}`;
}

/** Estimated minutes per chapter */
export function getPerChapterMinutes(book: LibraryBook): number {
  return Math.round(book.estimatedReadingTimeMinutes / book.totalChapters);
}

/** Free-plan progress bar color */
export function getFreePlanColor(used: number, limit: number): string {
  if (used >= limit) return "var(--accent-red)";
  if (used >= limit / 2) return "var(--accent-flame)";
  return "var(--accent-teal)";
}

export type SortOption =
  | "popular"
  | "shortest"
  | "completion"
  | "beginner"
  | "recent"
  | "alphabetical";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popular", label: "Most popular" },
  { value: "shortest", label: "Shortest first" },
  { value: "completion", label: "Highest completion rate" },
  { value: "beginner", label: "Best for beginners" },
  { value: "recent", label: "Recently added" },
  { value: "alphabetical", label: "Alphabetical" },
];
