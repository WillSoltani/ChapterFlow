// ── Extended library data for the psychology-driven redesign ──

import { getBookCoverPath } from "@/lib/book-covers";
import {
  BOOK_PACKAGES,
  getBookPackagePresentation,
} from "@/app/book/data/bookPackages";

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

type LibraryBookOverride = Partial<
  Omit<LibraryBook, "id" | "title" | "author" | "totalChapters" | "estimatedReadingTimeMinutes">
>;

// ── Mock user stats ──
export const MOCK_USER_STATS: UserStats = {
  firstName: "Will",
  level: 4,
  xp: 1250,
  xpToNextLevel: 2000,
  booksCompleted: 0,
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

function inferLibraryCategory(categories: string[]): Category {
  const normalized = categories.map((category) => category.toLowerCase());
  if (normalized.includes("communication")) return "Communication";
  if (normalized.includes("psychology")) return "Psychology";
  if (normalized.includes("productivity")) return "Productivity";
  if (normalized.includes("strategy")) return "Strategy";
  if (normalized.includes("leadership") || normalized.includes("business")) return "Leadership";
  return "Philosophy";
}

function inferCoverGradient(bookId: string): string {
  const gradients = [
    "linear-gradient(135deg, #155e75 0%, #082f49 100%)",
    "linear-gradient(135deg, #1d4ed8 0%, #172554 100%)",
    "linear-gradient(135deg, #0f766e 0%, #134e4a 100%)",
    "linear-gradient(135deg, #be123c 0%, #4c0519 100%)",
    "linear-gradient(135deg, #92400e 0%, #431407 100%)",
    "linear-gradient(135deg, #4f46e5 0%, #312e81 100%)",
  ];

  let hash = 0;
  for (let index = 0; index < bookId.length; index += 1) {
    hash = ((hash << 5) - hash + bookId.charCodeAt(index)) | 0;
  }
  return gradients[Math.abs(hash) % gradients.length];
}

function inferReaderCount(bookId: string): number {
  let hash = 0;
  for (let index = 0; index < bookId.length; index += 1) {
    hash = ((hash << 5) - hash + bookId.charCodeAt(index)) | 0;
  }
  return 900 + (Math.abs(hash) % 700);
}

function inferCompletionRate(bookId: string): number {
  let hash = 0;
  for (let index = 0; index < bookId.length; index += 1) {
    hash = ((hash << 5) - hash + bookId.charCodeAt(index)) | 0;
  }
  return 68 + (Math.abs(hash) % 16);
}

function buildLearningPoints(tags: string[] | undefined, categories: string[]): string[] {
  const base = [...(tags ?? []), ...categories]
    .map((item) => item.replace(/-/g, " ").trim())
    .filter(Boolean);
  const unique = [...new Set(base)];
  return unique.slice(0, 3).map((item) => {
    const sentence = item.charAt(0).toUpperCase() + item.slice(1);
    return `How to apply ${sentence.toLowerCase()} in real conversations and decisions`;
  });
}

function inferBestFor(category: Category): string[] {
  if (category === "Communication") return ["managers", "teams", "partners", "students"];
  if (category === "Leadership") return ["managers", "operators", "founders", "team leads"];
  if (category === "Psychology") return ["psychology enthusiasts", "leaders", "self-improvers"];
  if (category === "Productivity") return ["students", "builders", "self-improvers"];
  if (category === "Strategy") return ["strategists", "operators", "ambitious professionals"];
  return ["curious readers", "students", "professionals"];
}

const GENERATED_LIBRARY_BOOK_OVERRIDES: Record<string, LibraryBookOverride> = {
  "crucial-conversations": {
    authorCredentials:
      "Communication researchers and trainers focused on high-stakes dialogue and conflict repair",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #0f172a 100%)",
    hook: "Handle high-stakes conversations before silence or force takes over",
    description:
      "A practical guide to high-stakes dialogue: spotting crucial conversations early, restoring safety, and moving hard talks toward clarity and action.",
    whatYoullLearn: [
      "How to recognize a crucial conversation before the default pattern takes over",
      "How to keep safety and candor alive when stakes, disagreement, and emotion rise together",
      "How to turn a hard conversation into a clear next step instead of a lingering mess",
    ],
    bestFor: ["managers", "partners", "teams", "students"],
    category: "Communication",
    readerCount: 1580,
    completionRate: 79,
    badges: ["new", "staff-pick"],
    staffPickReason: "Concrete communication mechanics that stay useful under real pressure.",
    similarBookId: "what-every-body-is-saying",
  },
  "the-power-of-habit": {
    authorCredentials:
      "Pulitzer Prize-winning reporter and author focused on habits, decision-making, and organizational behavior",
    coverGradient: "linear-gradient(135deg, #b45309 0%, #1f2937 100%)",
    hook: "Understand the loops that run your behavior before they keep choosing for you",
    description:
      "A modern reading of habit loops across personal routines, willpower, organizations, marketing, social movements, and moral responsibility.",
    whatYoullLearn: [
      "How to identify cue-routine-reward loops instead of treating habits like personality",
      "How craving, willpower, and keystone habits change what repeats under pressure",
      "How routines scale outward into companies, communities, and questions of accountability",
    ],
    bestFor: ["self-improvers", "operators", "leaders", "psychology enthusiasts"],
    category: "Psychology",
    readerCount: 1840,
    completionRate: 77,
    badges: ["new", "staff-pick"],
    staffPickReason: "The best bridge between personal habit mechanics and the systems that amplify them.",
    similarBookId: "tiny-habits",
  },
  "make-time": {
    authorCredentials:
      "Former Google Ventures partners focused on attention design, defaults, and practical daily productivity.",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #1f2937 100%)",
    hook: "Design one meaningful day at a time before defaults and distractions take over",
    description:
      "A practical system for choosing a daily Highlight, protecting focus, supporting energy, and learning from each day without turning productivity into constant optimization.",
    whatYoullLearn: [
      "How to pick one Highlight that makes a day feel meaningful instead of merely busy",
      "How to defend focus by removing distraction defaults before they start choosing for you",
      "How to use energy and reflection as part of a repeatable daily system",
    ],
    bestFor: ["builders", "students", "operators", "self-improvers"],
    category: "Productivity",
    readerCount: 1710,
    completionRate: 81,
    badges: ["new", "staff-pick"],
    staffPickReason: "One of the clearest bridges between attention management and everyday execution.",
    similarBookId: "essentialism",
  },
  essentialism: {
    authorCredentials:
      "Leadership thinker and author focused on trade-offs, priority design, and disciplined exclusion.",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #164e63 100%)",
    hook: "Choose the vital few before the trivial many quietly owns your life",
    description:
      "A practical guide to ranking what matters, refusing what does not, and building systems that make less but better a real operating rule instead of a slogan.",
    whatYoullLearn: [
      "How to separate the vital few from the trivial many before good options dilute your best work",
      "How to use trade-offs, boundaries, and graceful refusal as core tools of focus",
      "How to turn essentialism into daily execution through buffers, routines, and present-tense attention",
    ],
    bestFor: ["leaders", "operators", "students", "self-improvers"],
    category: "Productivity",
    readerCount: 1630,
    completionRate: 80,
    badges: ["new", "staff-pick"],
    staffPickReason: "One of the cleanest frameworks for turning priorities into real exclusion and execution.",
    similarBookId: "make-time",
  },
  "thinking-fast-and-slow": {
    authorCredentials:
      "Nobel Prize-winning psychologist whose work reshaped research on judgment, decision-making, and behavioral economics.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
    hook: "See how fast intuition and slow reasoning quietly shape your best and worst decisions",
    description:
      "A modern reading of Kahneman's five-part, thirty-eight-chapter map of heuristics, bias, overconfidence, prospect theory, memory, and the limits of deliberate control.",
    whatYoullLearn: [
      "How System 1 and System 2 divide fast impressions from slower review",
      "How heuristics like substitution, anchoring, and availability distort judgment under pressure",
      "How prospect theory, reference points, and remembered experience change the way gains, losses, and life satisfaction get evaluated",
    ],
    bestFor: ["psychology enthusiasts", "leaders", "investors", "self-improvers"],
    category: "Psychology",
    difficulty: "hard",
    readerCount: 1975,
    completionRate: 73,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "The most useful single framework in the library for understanding how judgment goes wrong before confidence catches up.",
    similarBookId: "predictably-irrational",
  },
  "the-almanack-of-naval-ravikant": {
    authorCredentials:
      "Curated by Eric Jorgenson from Naval Ravikant's interviews, writing, and talks on wealth, judgment, happiness, and philosophy.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #155e75 100%)",
    hook: "Build wealth more clearly, think more carefully, and stop separating outer success from inner freedom.",
    description:
      "A six-part guide to wealth creation, judgment, happiness, self-governance, philosophy, and the reading life that shapes those outcomes upstream.",
    whatYoullLearn: [
      "How Naval links wealth to ownership, leverage, and long-term reputation instead of status performance",
      "How judgment, desire, and self-observation shape both outer results and inner peace",
      "How a better reading diet becomes upstream infrastructure for worldview, taste, and clearer decisions",
    ],
    bestFor: ["builders", "operators", "students", "curious readers"],
    category: "Philosophy",
    difficulty: "medium",
    readerCount: 1890,
    completionRate: 78,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "Short, dense, and unusually good at connecting money, judgment, and inner life without wasting pages.",
    similarBookId: "thinking-fast-and-slow",
  },
  "the-laws-of-human-nature": {
    authorCredentials:
      "Author focused on power, social perception, self-deception, and recurring patterns in human behavior.",
    coverGradient: "linear-gradient(135deg, #991b1b 0%, #111827 100%)",
    hook: "Read people more clearly before vanity, resentment, and group pressure start reading you.",
    description:
      "A modern reading of Robert Greene's nineteen laws of behavior: irrationality, narcissism, role-playing, envy, conformity, aggression, historical mood, and mortality, all translated into concrete patterns you can recognize in daily life.",
    whatYoullLearn: [
      "How irrationality, narcissism, defensiveness, and envy distort judgment long before people name them",
      "How to read masks, aggression, conformity, and self-sabotage without turning insight into paranoia",
      "How to use perspective, purpose, and mortality as practical correctives against drift and petty conflict",
    ],
    bestFor: ["leaders", "operators", "psychology enthusiasts", "self-improvers"],
    category: "Psychology",
    difficulty: "hard",
    readerCount: 1960,
    completionRate: 74,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "The sharpest broad survey in the library for reading motives, distortion, and social pressure together.",
    similarBookId: "predictably-irrational",
  },
  "the-hard-thing-about-hard-things": {
    authorCredentials:
      "Co-founder of Andreessen Horowitz and former Opsware CEO writing from lived startup and turnaround leadership pressure.",
    coverGradient: "linear-gradient(135deg, #7c2d12 0%, #111827 100%)",
    hook: "Lead through layoffs, chaos, and hard calls before startup mythology makes the crisis worse.",
    description:
      "A practical guide to startup leadership under pressure: surviving the struggle, managing layoffs, hiring executives, shaping culture, and operating as a wartime CEO when no option feels clean.",
    whatYoullLearn: [
      "How to make hard CEO decisions when morale, cash, and time are all under pressure",
      "How to handle layoffs, executive transitions, and organizational design without hiding behind slogans",
      "How culture, communication, and wartime leadership choices shape whether a company survives crisis",
    ],
    bestFor: ["founders", "operators", "managers", "team leads"],
    category: "Leadership",
    difficulty: "hard",
    readerCount: 1870,
    completionRate: 72,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the clearest operator books in the library for leadership when the company is under real strain.",
    similarBookId: "the-prince",
  },
  influence: {
    authorCredentials:
      "Social psychologist Robert B. Cialdini, PhD, writing from decades of research on persuasion, compliance, and the cue patterns behind automatic judgment.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #7c2d12 100%)",
    hook: "See how consent gets shaped before your full judgment arrives, and learn where to slow the pattern down.",
    description:
      "A practical guide to the psychology of persuasion: how reciprocity, commitment, social proof, liking, authority, scarcity, unity, and cue convergence steer real decisions in work, school, and personal life.",
    whatYoullLearn: [
      "How persuasive cues trigger fast agreement before a full case has been reviewed",
      "How the main levers of influence work alone and in stacked combinations across everyday decisions",
      "How to keep useful speed while auditing the cues that are trying to borrow proof from familiarity, belonging, pressure, or authority",
    ],
    bestFor: ["leaders", "operators", "students", "psychology enthusiasts"],
    category: "Psychology",
    difficulty: "medium",
    readerCount: 2260,
    completionRate: 77,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the most durable books in the library for seeing how small cues scale into real compliance before you notice the mechanism.",
    similarBookId: "thinking-fast-and-slow",
  },
  "leaders-eat-last": {
    authorCredentials:
      "Leadership speaker and organizational thinker focused on trust, culture, belonging, and the human biology behind cooperation.",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #1f2937 100%)",
    hook: "Build a culture people will protect before incentives, fear, and politics tear it apart.",
    description:
      "A practical guide to leadership as protection: creating circles of safety, understanding stress chemistry, earning trust, and building cultures where people cooperate instead of merely comply.",
    whatYoullLearn: [
      "How leaders create trust by using status and authority as cover instead of as distance",
      "How cortisol, belonging, and organizational incentives shape whether people hoard information or help each other",
      "How to build cultures where sacrifice, honesty, and shared responsibility become rational behavior",
    ],
    bestFor: ["leaders", "managers", "operators", "team leads"],
    category: "Leadership",
    difficulty: "medium",
    readerCount: 1820,
    completionRate: 76,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the strongest culture books in the library for turning trust from rhetoric into operating practice.",
    similarBookId: "the-hard-thing-about-hard-things",
  },
  "the-one-thing": {
    authorCredentials:
      "Gary Keller is a real-estate entrepreneur and business builder; Jay Papasan is a business writer and editor focused on priority, leverage, and execution.",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #172554 100%)",
    hook:
      "Give the most important work first claim before busyness, urgency, and scattered ambition split your force.",
    description:
      "A practical guide to leverage, priority, sequencing, and the discipline of choosing the one action that makes the next actions easier, fewer, or unnecessary.",
    whatYoullLearn: [
      "How to use the focusing question to identify the next task with the highest leverage",
      "How purpose, priority, and time blocking work together so important work gets first claim instead of leftover attention",
      "How to spot the lies, distractions, and structural habits that make busyness feel productive while producing little",
    ],
    bestFor: ["operators", "founders", "students", "self-improvers"],
    category: "Productivity",
    difficulty: "medium",
    readerCount: 1880,
    completionRate: 81,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the sharpest productivity books in the library for turning priority into sequencing, leverage, and visible consequence.",
    similarBookId: "essentialism",
  },
  "the-charisma-myth": {
    authorCredentials:
      "Executive coach and charisma researcher focused on presence, power, warmth, and trainable interpersonal signal under pressure.",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #172554 100%)",
    hook: "Carry warmth, authority, and presence on purpose before rooms decide who you are without your help.",
    description:
      "A practical guide to charisma as trainable signal: building presence, power, and warmth, shaping first impressions, handling conversation and body language, adapting online, and staying credible in difficult rooms.",
    whatYoullLearn: [
      "How presence, power, and warmth combine into the readable signals people use to judge charisma",
      "How first impressions, conversation, and body language can be trained instead of treated like fixed personality traits",
      "How to carry the same signal through digital communication, hard conversations, presentations, and crisis pressure",
    ],
    bestFor: ["leaders", "professionals", "speakers", "self-improvers"],
    category: "Communication",
    difficulty: "medium",
    readerCount: 1870,
    completionRate: 78,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the cleanest books in the library for turning charisma from vague mystique into trainable signal mechanics.",
    similarBookId: "the-like-switch",
  },
  "the-like-switch": {
    authorCredentials:
      "Former FBI behavioral analyst Jack Schafer with professor and co-author Marvin Karlins, writing on rapport, trust, attraction, and relationship-building cues.",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #172554 100%)",
    hook: "Build rapport faster by noticing the signals that make people feel safe, seen, and open to connection.",
    description:
      "A practical guide to first impressions, friendship cues, attraction, conversation, closeness, and long-term relationship maintenance, ending with a careful look at trust and deception.",
    whatYoullLearn: [
      "How first-impression signals and low-threat cues create the opening for rapport",
      "How conversation, empathy, and reciprocal disclosure turn contact into real closeness",
      "How to maintain relationships while staying alert to the risks that come with trust",
    ],
    bestFor: ["professionals", "self-improvers", "students", "relationship-builders"],
    category: "Psychology",
    difficulty: "medium",
    readerCount: 1760,
    completionRate: 79,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the clearest social-skills books in the library for connecting first-contact mechanics to durable trust.",
    similarBookId: "how-to-talk-to-anyone",
  },
  "good-to-great": {
    authorCredentials:
      "Business researcher and author focused on organizational durability, disciplined leadership, and the conditions behind enduring company performance.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
    hook: "Build an institution that keeps compounding after the first visible breakthrough.",
    description:
      "A practical guide to disciplined leadership, the right people, brutal facts, strategic clarity, organizational discipline, technology restraint, and the flywheel logic behind durable greatness.",
    whatYoullLearn: [
      "How Level 5 leadership combines personal humility with institutional ambition strong enough to outlast ego",
      "How to use people decisions, brutal facts, and the hedgehog concept to narrow a company onto work it can sustain",
      "How discipline, technology restraint, and the flywheel turn improvement into momentum instead of short-lived drama",
    ],
    bestFor: ["leaders", "operators", "founders", "team leads"],
    category: "Leadership",
    difficulty: "hard",
    readerCount: 1940,
    completionRate: 75,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the cleanest books in the library for separating loud business success from disciplined institutional strength.",
    similarBookId: "leaders-eat-last",
  },
  "never-split-the-difference": {
    authorCredentials:
      "Former FBI hostage negotiator Chris Voss, with Tahl Raz, translating crisis negotiation tactics into practical tools for everyday bargaining and difficult conversations.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #0f766e 100%)",
    hook: "Negotiate with more leverage before compromise, ego, and bad assumptions give the room away.",
    description:
      "A practical guide to high-stakes negotiation: using tactical empathy, labeling, mirroring, calibrated questions, and accusation audits to uncover hidden constraints and move difficult conversations toward better outcomes.",
    whatYoullLearn: [
      "How to use tactical empathy to lower defensiveness and surface what the other side actually cares about",
      "How mirroring, labeling, and calibrated questions create information flow without forcing confrontation",
      "How to negotiate deadlines, price, and commitment without defaulting to false splits or weak concessions",
    ],
    bestFor: ["managers", "operators", "founders", "students"],
    category: "Communication",
    difficulty: "medium",
    readerCount: 1910,
    completionRate: 78,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the most practically useful books in the library for handling pressure, leverage, and difficult asks without theatrics.",
    similarBookId: "crucial-conversations",
  },
  "pre-suasion": {
    authorCredentials:
      "Social psychologist Robert B. Cialdini, PhD, extending his persuasion research into attentional setup, association, unity, ethical screening, and durable aftereffects.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #7c3aed 100%)",
    hook:
      "See how the room gets prepared before the pitch, so you can use that power more cleanly and defend against it more clearly.",
    description:
      "A practical guide to pre-suasion: shaping attention, associations, placement, unity, ethical permission, and aftereffects so you can understand what changes judgment before and after the main ask.",
    whatYoullLearn: [
      "How attention, context, and association change receptivity before a proposal is even evaluated",
      "How unity, ethical screening, and timing affect whether influence feels supportive, manipulative, or self-defeating",
      "How to audit persuasive setups and ask not only what wins the moment, but what deserves to be used and what will last",
    ],
    bestFor: ["leaders", "operators", "students", "psychology enthusiasts"],
    category: "Psychology",
    difficulty: "medium",
    readerCount: 2035,
    completionRate: 76,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "The clearest companion in the library to Influence for understanding how persuasion starts before the explicit pitch.",
    similarBookId: "influence",
  },
  "super-thinking": {
    authorCredentials:
      "Entrepreneur and decision-systems writer Gabriel Weinberg with Lauren McCann, focused on practical mental models for everyday judgment.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #155e75 100%)",
    hook:
      "Think with better models before default reactions, shallow frames, and bad incentives keep choosing for you.",
    description:
      "A practical guide to mental models for everyday judgment: reducing unforced error, spotting unintended consequences, protecting future time, reading system dynamics, and updating decisions with cleaner feedback.",
    whatYoullLearn: [
      "How to use mental models to reduce self-created error before confidence turns a weak read into a bigger mistake",
      "How to anticipate second-order effects, incentives, and system behavior instead of stopping at the first visible outcome",
      "How to protect attention, time, and decision quality with repeatable models that stay useful across work and personal life",
    ],
    bestFor: ["operators", "leaders", "students", "self-improvers"],
    category: "Psychology",
    difficulty: "medium",
    readerCount: 1680,
    completionRate: 78,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "A sharp bridge between abstract mental models and the everyday decisions where they either pay off or quietly fail.",
    similarBookId: "thinking-fast-and-slow",
  },
  "extreme-ownership": {
    authorCredentials:
      "Former Navy SEAL officers writing from combat leadership and executive training on accountability, planning, and team command.",
    coverGradient: "linear-gradient(135deg, #334155 0%, #0f172a 100%)",
    hook: "Take ownership early enough that failure becomes a leadership problem you can actually fix.",
    description:
      "A practical guide to leadership under pressure: taking responsibility, building trust through belief and simplicity, coordinating teams, planning clearly, and using disciplined command to keep execution aligned.",
    whatYoullLearn: [
      "How to turn ownership from a slogan into an operational habit after mistakes, confusion, and missed coordination",
      "How belief, simplicity, and decentralized command shape whether teams can act quickly without drifting",
      "How planning, chain communication, and discipline create freedom instead of bureaucratic drag",
    ],
    bestFor: ["leaders", "operators", "managers", "team leads"],
    category: "Leadership",
    difficulty: "hard",
    readerCount: 1880,
    completionRate: 74,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the clearest execution-focused leadership books in the library for turning accountability into repeatable team behavior.",
    similarBookId: "leaders-eat-last",
  },
  "you-can't-hurt-me": {
    authorCredentials:
      "Retired Navy SEAL, ultramarathon runner, and memoirist writing from abuse, military training, endurance, failure, illness, and self-reconstruction under real pressure.",
    coverGradient: "linear-gradient(135deg, #111827 0%, #7f1d1d 100%)",
    hook: "Use pain, failure, and honest self-audit as training grounds instead of final verdicts.",
    description:
      "A memoir-driven guide to accountability, suffering, discipline, identity repair, and recovery that keeps every lesson tied to lived cost instead of motivational fog.",
    whatYoullLearn: [
      "How brutal self-honesty and accountability can break inherited stories before they keep scripting your ceiling",
      "How to use suffering, planning, and disciplined exposure to expand capacity without turning hardship into empty theater",
      "How standards, recovery, and identity repair work when the lesson has been paid for in body, pride, and consequence",
    ],
    bestFor: ["athletes", "operators", "self-improvers", "readers under pressure"],
    category: "Psychology",
    difficulty: "hard",
    readerCount: 2140,
    completionRate: 73,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "It keeps mental toughness tied to cost, planning, and recovery instead of letting intensity collapse into slogans.",
    similarBookId: "extreme-ownership",
  },
  indistractable: {
    authorCredentials:
      "Behavior design author and product thinker focused on attention, habits, technology, and how people can protect what matters from distraction.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #0f766e 100%)",
    hook: "Take back your attention before discomfort, defaults, and other people's agendas keep choosing your life.",
    description:
      "A practical guide to mastering internal triggers, timeboxing traction, hacking back external triggers, using pacts, improving workplace culture, raising less distractible children, and protecting intimacy from chronic partial attention.",
    whatYoullLearn: [
      "How to treat distraction as a response to triggers and pain avoidance instead of blaming devices alone",
      "How to use timeboxing, environmental design, and pacts to protect what matters in work and life",
      "How the same attention framework extends into culture, parenting, friendship, and close relationships",
    ],
    bestFor: ["self-improvers", "builders", "leaders", "students"],
    category: "Productivity",
    difficulty: "medium",
    readerCount: 1690,
    completionRate: 78,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the strongest attention books in the library for connecting personal focus to work, family, and relationships without losing practical mechanics.",
    similarBookId: "make-time",
  },
  "how-to-talk-to-anyone": {
    authorCredentials:
      "Communication coach and bestselling relationship author focused on first impressions, rapport, social tact, and practical conversational skill.",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #1e293b 100%)",
    hook: "Handle first impressions, rapport, and social pressure with more tact before awkward moments start costing you.",
    description:
      "A practical guide to first impressions, conversation momentum, sounding more substantial, reading rooms, building rapport, using praise well, handling phone presence, working a crowd, and protecting dignity when social moments turn hot.",
    whatYoullLearn: [
      "How to make warmer first impressions without looking staged or overeager",
      "How to keep conversations alive, sound more substantial, and read unfamiliar social rooms faster",
      "How to use rapport, praise, and tact without crossing into manipulation or visible social handling",
    ],
    bestFor: ["professionals", "students", "networkers", "self-improvers"],
    category: "Communication",
    difficulty: "medium",
    readerCount: 1660,
    completionRate: 80,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "It turns scattered conversation advice into a clear progression from first hello to tact under pressure.",
    similarBookId: "crucial-conversations",
  },
  "talk-like-ted": {
    authorCredentials:
      "Business communicator and presentation coach focused on TED-style public speaking, storytelling, and memorable idea delivery.",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #1e293b 100%)",
    hook: "Make an idea feel alive enough to hold a room before polished slides start pretending to do that work for you.",
    description:
      "A practical guide to public speaking through nine chapters on passion, storytelling, conversational delivery, novelty, memorable peaks, warmth, compression, vividness, and rehearsal under real audience pressure.",
    whatYoullLearn: [
      "How to find the deeper stake behind a talk so delivery starts from conviction instead of borrowed polish",
      "How to use story, novelty, memorable moments, and vivid framing to make ideas easier to feel and retain",
      "How to balance warmth, brevity, and rehearsal so a talk stays human, clear, and memorable under pressure",
    ],
    bestFor: ["speakers", "founders", "students", "professionals"],
    category: "Communication",
    difficulty: "medium",
    readerCount: 1540,
    completionRate: 79,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "It gives the clearest speaker-focused path in the library from inner stake to delivery mechanics without collapsing into presentation cliches.",
    similarBookId: "how-to-talk-to-anyone",
  },
  "the-art-of-war": {
    authorCredentials:
      "Sun Tzu, a Chinese military strategist writing around 500 BCE, translated by Lionel Giles in 1910 with commentary drawing on classical Chinese scholarship.",
    coverGradient: "linear-gradient(135deg, #1c1917 0%, #78350f 100%)",
    hook: "Win before the contest begins by knowing the terrain, the enemy, and yourself more completely than they know you.",
    description:
      "A modern reading of Sun Tzu's thirteen chapters on strategy, deception, terrain, intelligence, and the conditions that produce victory before battle begins. Each chapter applies the original argument to contemporary decisions in work, school, and personal life.",
    whatYoullLearn: [
      "How to assess any contest across five factors before committing resources or effort",
      "How to use the hierarchy of methods from plan-disruption to field battle to choose the highest-leverage response available to you",
      "How terrain, timing, signal-reading, and intelligence prerequisites shape whether strategic principles can be executed at all",
    ],
    bestFor: ["strategists", "leaders", "operators", "readers who think competitively"],
    category: "Strategy",
    difficulty: "hard",
    readerCount: 2310,
    completionRate: 71,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the most rigorous classical strategy texts in the library for connecting ancient military logic to modern competitive decisions.",
    similarBookId: "the-prince",
  },
  "atomic-habits": {
    authorCredentials:
      "Habit researcher and writer focused on behavior change, identity-based habits, environment design, and small gains that compound over time.",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #172554 100%)",
    hook:
      "Make small behaviors repeat reliably enough that they start compounding before motivation has a chance to disappear.",
    description:
      "A practical guide to building better habits through tiny changes, identity shifts, environment design, repetition, feedback, and review so consistent actions keep improving instead of fading out.",
    whatYoullLearn: [
      "How identity, cues, craving, response, and reward work together to make a habit easier to repeat",
      "How to use environment design, tracking, and friction to make good behaviors more likely and bad ones less automatic",
      "How repetition, challenge calibration, and periodic review turn a habit from a streak into a system that keeps compounding",
    ],
    bestFor: ["self-improvers", "students", "operators", "leaders"],
    category: "Productivity",
    difficulty: "medium",
    readerCount: 2410,
    completionRate: 82,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "The clearest habit book in the library for turning behavior change into a repeatable system instead of a motivation project.",
    similarBookId: "the-power-of-habit",
  },
  "the-great-mental-models-vol-1": {
    authorCredentials:
      "Shane Parrish is the founder of Farnam Street, writing on judgment, decision-making, and the practical use of mental models across work and life.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #0f766e 100%)",
    hook:
      "Build a sharper thinking toolkit before borrowed assumptions and narrow frames keep making your decisions for you.",
    description:
      "A practical guide to foundational mental models: abstraction and reality, competence boundaries, first-principles thinking, second-order effects, probabilistic judgment, inversion, and the habits that make reasoning more reliable under pressure.",
    whatYoullLearn: [
      "How to use foundational mental models to inspect assumptions instead of accepting the first workable story",
      "How to think with range, probability, inversion, and consequences that unfold beyond the first visible outcome",
      "How to spot where your judgment is strong, where it is borrowed, and where a cleaner decision needs a different frame",
    ],
    bestFor: ["leaders", "operators", "investors", "curious readers"],
    category: "Philosophy",
    difficulty: "medium",
    readerCount: 1890,
    completionRate: 78,
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the cleanest entry points in the library for turning general reasoning advice into a reusable decision toolkit.",
    similarBookId: "thinking-fast-and-slow",
  },
};

function buildLibraryBookFromPackage(
  pkg: (typeof BOOK_PACKAGES)[number]
): LibraryBook {
  const bookId = pkg.book.bookId;
  const presentation = getBookPackagePresentation(bookId);
  const category = inferLibraryCategory(pkg.book.categories);
  const overrides = GENERATED_LIBRARY_BOOK_OVERRIDES[bookId] ?? {};
  const chapters = pkg.chapters.length;
  const estimatedReadingTimeMinutes = pkg.chapters.reduce(
    (sum, chapter) => sum + Math.max(chapter.readingTimeMinutes, 1),
    0
  );

  return {
    id: bookId,
    title: pkg.book.title,
    author: pkg.book.author,
    authorCredentials: overrides.authorCredentials,
    coverImage: overrides.coverImage ?? presentation.coverImage,
    coverGradient: overrides.coverGradient ?? inferCoverGradient(bookId),
    hook:
      overrides.hook ??
      presentation.synopsis.split(".")[0]?.trim() ??
      "A focused, chapter-based learning experience with practical examples and quiz gates.",
    description: overrides.description ?? presentation.synopsis,
    whatYoullLearn:
      overrides.whatYoullLearn ??
      buildLearningPoints(pkg.book.tags, pkg.book.categories),
    bestFor: overrides.bestFor ?? inferBestFor(category),
    category: overrides.category ?? category,
    difficulty:
      (overrides.difficulty as Difficulty | undefined) ??
      (presentation.difficulty.toLowerCase() as Difficulty),
    totalChapters: chapters,
    estimatedReadingTimeMinutes,
    readerCount: overrides.readerCount ?? inferReaderCount(bookId),
    completionRate: overrides.completionRate ?? inferCompletionRate(bookId),
    isPro: overrides.isPro ?? true,
    badges: overrides.badges ?? ["new"],
    staffPickReason: overrides.staffPickReason,
    similarBookId: overrides.similarBookId,
    userProgress: overrides.userProgress,
  };
}

// ── All books ──
const BASE_LIBRARY_BOOKS: LibraryBook[] = [
];

const BASE_LIBRARY_BOOK_IDS = new Set(BASE_LIBRARY_BOOKS.map((book) => book.id));

const GENERATED_LIBRARY_BOOKS: LibraryBook[] = BOOK_PACKAGES
  .filter((pkg) => !BASE_LIBRARY_BOOK_IDS.has(pkg.book.bookId))
  .map((pkg) => buildLibraryBookFromPackage(pkg));

export const MOCK_BOOKS: LibraryBook[] = [
  ...BASE_LIBRARY_BOOKS,
  ...GENERATED_LIBRARY_BOOKS,
];

// Sync hardcoded values with authoritative book package data
for (const book of MOCK_BOOKS) {
  const pkg = BOOK_PACKAGES.find((p) => p.book.bookId === book.id);
  if (pkg) {
    const pres = getBookPackagePresentation(book.id);
    book.totalChapters = pkg.chapters.length;
    book.estimatedReadingTimeMinutes = pkg.chapters.reduce(
      (sum, ch) => sum + Math.max(ch.readingTimeMinutes, 1),
      0,
    );
    book.difficulty = pres.difficulty.toLowerCase() as Difficulty;
  }
}

// ── Curated section config (NO duplication across sections) ──
export interface CuratedSectionConfig {
  narrativeTitle: string;
  narrativeSubtitle: string;
  bookIds: string[];
}

export const CURATED_SECTIONS: CuratedSectionConfig[] = [
  {
    narrativeTitle: "Master influence and power.",
    narrativeSubtitle:
      "Timeless wisdom on human connection and strategic awareness.",
    bookIds: [
      "crucial-conversations",
      "what-every-body-is-saying",
      "the-laws-of-human-nature",
    ],
  },
  {
    narrativeTitle: "Build better systems.",
    narrativeSubtitle:
      "Practical frameworks for habits, productivity, and personal growth.",
    bookIds: [
      "the-power-of-habit",
      "make-time",
      "essentialism",
      "tiny-habits",
    ],
  },
  {
    narrativeTitle: "Sharpen judgment under uncertainty.",
    narrativeSubtitle:
      "Decision-making books on bias, heuristics, and the hidden rules behind bad calls.",
    bookIds: [
      "the-almanack-of-naval-ravikant",
      "thinking-fast-and-slow",
      "predictably-irrational",
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
