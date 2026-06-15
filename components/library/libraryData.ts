// ── Extended library data for the psychology-driven redesign ──

import { getBookCoverPath } from "@/lib/book-covers";
import {
  BOOKS_CATALOG_METADATA,
  type BookCatalogMetadata,
} from "@/app/book/data/booksCatalog";
import type {
  LibraryCatalogBook,
  LibraryBookEntry,
} from "@/app/book/_lib/library-data";

export type Category =
  | "Psychology"
  | "Productivity"
  | "Strategy"
  | "Leadership"
  | "Communication"
  | "Philosophy";

export type Difficulty = "easy" | "medium" | "hard";
// Only badges backed by real signals: "new" (recently added) and "staff-pick"
// (editorial). "trending"/"most-completed" were dropped — no popularity data.
export type BadgeType = "staff-pick" | "new";

export interface UserProgress {
  currentChapter: number;
  percentComplete: number;
  lastReadAt: Date;
  /** Real insight points earned for this book. Undefined when the backend
   *  exposes no per-book figure — never fabricate a number. */
  xpEarned?: number;
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

// An honest weekly reading suggestion. No reward/progress fields: there is no
// challenge-tracking backend, so a fabricated IP reward or progress bar would
// have no source. The UI renders only the category nudge + a browse CTA.
export interface WeeklyChallenge {
  description: string;
  category?: Category;
}

type LibraryBookOverride = Partial<
  Omit<LibraryBook, "id" | "title" | "author" | "totalChapters" | "estimatedReadingTimeMinutes">
>;

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
    badges: ["new", "staff-pick"],
    staffPickReason: "Concrete communication mechanics that stay useful under real pressure.",
    similarBookId: "what-every-body-is-saying",
  },
  "difficult-conversations": {
    authorCredentials:
      "Harvard Negotiation Project researchers and instructors focused on conflict, feedback, and relationship repair",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #1f2937 100%)",
    hook: "Handle the conversation underneath the conversation before blame, hurt, and identity defense take over",
    description:
      "A practical guide to navigating hard conversations by separating what happened from feelings and identity, listening without surrendering your own view, and speaking with more honesty and less accusation.",
    whatYoullLearn: [
      "How to spot the three conversations running underneath a hard exchange: facts, feelings, and identity",
      "How to shift from blame and certainty toward contribution, curiosity, and clearer listening",
      "How to say what is true for you without retreating, attacking, or turning problem-solving into a fight",
    ],
    bestFor: ["managers", "partners", "teams", "students"],
    category: "Communication",
    difficulty: "medium",
    badges: ["new", "staff-pick"],
    staffPickReason: "One of the clearest books on why hard conversations derail and what to do before they harden.",
    similarBookId: "crucial-conversations",
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
    badges: ["new", "staff-pick"],
    staffPickReason: "One of the clearest bridges between attention management and everyday execution.",
    similarBookId: "essentialism",
  },
  "make-it-stick": {
    authorCredentials:
      "Learning scientists and memory researchers translating cognitive science into practical study design and durable retention.",
    coverGradient: "linear-gradient(135deg, #991b1b 0%, #111827 100%)",
    hook:
      "Build memory that lasts by choosing methods that strengthen retrieval, discrimination, and transfer instead of chasing fluency.",
    description:
      "A practical guide to learning science: why rereading and cramming mislead, how retrieval, spacing, interleaving, generation, and feedback build durable memory, and where desirable difficulty turns into overload instead of growth.",
    whatYoullLearn: [
      "How retrieval practice, spacing, and interleaving strengthen long-term retention more reliably than smooth review",
      "How to distinguish desirable difficulty from overload by checking for correction, support, and another attempt",
      "How to calibrate your learning by testing understanding instead of trusting familiarity, confidence, or effort alone",
    ],
    bestFor: ["students", "professionals", "teachers", "lifelong learners"],
    category: "Psychology",
    difficulty: "medium",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "The strongest learning-science book in the library for separating durable memory from study habits that only feel effective.",
    similarBookId: "the-power-of-habit",
  },
  "made-to-stick": {
    authorCredentials:
      "Chip Heath and Dan Heath write on communication, decision-making, and what makes ideas memorable enough to survive real-world retelling.",
    coverGradient: "linear-gradient(135deg, #7c2d12 0%, #1f2937 100%)",
    hook:
      "Design messages people can remember, believe, care about, and actually repeat after the room changes.",
    description:
      "A practical guide to the SUCCESs framework: building ideas that stay simple without becoming simplistic, earn attention and trust, feel meaningful, and travel through stories instead of dying as explanation.",
    whatYoullLearn: [
      "How simplicity, surprise, concreteness, credibility, emotion, and stories each solve a different failure mode in communication",
      "How to turn a correct idea into a message that still works after attention shifts and retelling begins",
      "How to sharpen a message without drifting into gimmickry, manipulation, or empty slogans",
    ],
    bestFor: ["leaders", "teachers", "marketers", "founders"],
    category: "Communication",
    difficulty: "medium",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the clearest books in the library for turning abstract communication advice into repeatable message design choices.",
    similarBookId: "talk-like-ted",
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
    badges: ["new", "staff-pick"],
    staffPickReason: "One of the cleanest frameworks for turning priorities into real exclusion and execution.",
    similarBookId: "make-time",
  },
  "so-good-they-cant-ignore-you": {
    authorCredentials:
      "Computer science professor and author focused on deep work, deliberate practice, career capital, and building meaningful work through skill rather than early passion myths.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #0f766e 100%)",
    hook:
      "Build rare and valuable skills before asking work to feel meaningful, autonomous, or mission-driven.",
    description:
      "A practical guide to rejecting the passion hypothesis in favor of a stronger sequence: adopt the craftsman mindset, build career capital, use that capital to buy control, and let mission emerge only after the underlying structure can support it.",
    whatYoullLearn: [
      "How the anti-passion argument replaces identity-first career searching with a cleaner build-from-skill sequence",
      "How career capital works as the exchange mechanism that turns rare ability into autonomy, flexibility, and better work",
      "How to tell the difference between environments that compound value and dead environments that consume effort without minting leverage",
    ],
    bestFor: ["students", "builders", "operators", "ambitious professionals"],
    category: "Productivity",
    difficulty: "medium",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "The clearest career book in the library for replacing vague passion talk with a mechanism-driven path from skill to leverage to mission.",
    similarBookId: "deep-work",
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
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the clearest operator books in the library for leadership when the company is under real strain.",
    similarBookId: "the-prince",
  },
  "thinking-in-bets": {
    authorCredentials:
      "Former professional poker player and decision strategist writing about probabilistic judgment, resulting, and truth-seeking under uncertainty.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
    hook:
      "Separate decision quality from outcome quality before hindsight and social comfort turn bad reasoning into false certainty.",
    description:
      "A practical guide to better judgment under uncertainty: treating choices as bets, updating beliefs in percentages instead of absolutes, using disagreement to surface hidden evidence, and planning for risk before luck tells a simpler story.",
    whatYoullLearn: [
      "How to judge a decision by the information and process behind it instead of by the outcome alone",
      "How probabilistic language, calibration, and truth-seeking disagreement improve judgment when certainty is not available",
      "How to spot false consensus, separate evidential challenge from ego conflict, and use mental time travel to prepare for uncertainty",
    ],
    bestFor: ["leaders", "operators", "investors", "curious readers"],
    category: "Psychology",
    difficulty: "medium",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the sharpest books in the library for learning how better decisions survive uncertainty, disagreement, and noisy outcomes.",
    similarBookId: "thinking-fast-and-slow",
  },
  superforecasting: {
    authorCredentials:
      "Political scientist Philip E. Tetlock and science writer Dan Gardner writing on probabilistic judgment, forecasting tournaments, and institutional accountability under uncertainty.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
    hook:
      "Learn to think in probabilities before pundit certainty and hindsight turn the future into theater.",
    description:
      "A practical guide to better forecasting: keeping score, updating in small steps, breaking big questions into tractable parts, working in teams, and building institutions that reward calibration over confident performance.",
    whatYoullLearn: [
      "How superforecasters think in probabilities, revise without ego, and keep track of what the record actually says",
      "How scorekeeping, decomposition, and team process improve judgment more than confident punditry does",
      "How forecasting stays useful even with black swans, institutional resistance, and the hard limits of long-range certainty",
    ],
    bestFor: ["leaders", "operators", "investors", "curious readers"],
    category: "Psychology",
    difficulty: "medium",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the strongest books in the library for turning judgment under uncertainty into a trainable, scoreable practice.",
    similarBookId: "thinking-in-bets",
  },
  "the-black-swan": {
    authorCredentials:
      "Essayist, trader, and risk thinker writing on uncertainty, rare events, probability, and the limits of prediction in complex systems.",
    coverGradient: "linear-gradient(135deg, #111827 0%, #1d4ed8 100%)",
    hook:
      "See how rare events reshape history before tidy stories and expert confidence trick you into thinking the world was predictable.",
    description:
      "A practical reading of Taleb's argument about black swans: why consequential surprises dominate history, why narrative and statistical habits hide that fact, and how to live with more asymmetry, less ruin, and less faith in polished forecasts.",
    whatYoullLearn: [
      "How black swan events differ from ordinary uncertainty and why hindsight makes them feel falsely explainable",
      "How narrative fallacy, silent evidence, and extremistan distort judgment in markets, careers, and public thinking",
      "How to build a practical posture around capped downside, optionality, and skepticism toward phony precision",
    ],
    bestFor: ["investors", "operators", "leaders", "curious readers"],
    category: "Psychology",
    difficulty: "hard",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the strongest books in the library for learning where prediction breaks and how better risk posture begins.",
    similarBookId: "superforecasting",
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
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the most durable books in the library for seeing how small cues scale into real compliance before you notice the mechanism.",
    similarBookId: "thinking-fast-and-slow",
  },
  "built-to-last": {
    authorCredentials:
      "Business researchers Jim Collins and Jerry I. Porras writing on visionary companies, institutional durability, and the management habits that outlast charismatic founders.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #14532d 100%)",
    hook: "Build an institution that can outlast its founders before success hardens into drift, ego, or short-termism.",
    description:
      "A practical guide to institutional durability: preserving core ideology while stimulating progress, developing leaders from within, testing ideas through action, and designing companies to keep compounding across decades.",
    whatYoullLearn: [
      "How clock building shifts attention from one heroic leader toward systems a company can keep using after the founder is gone",
      "How core ideology and experimentation can coexist so a company protects what matters while still adapting in motion",
      "How mechanisms like home-grown management, aligned goals, and productive discomfort help a strong institution endure",
    ],
    bestFor: ["founders", "leaders", "operators", "team leads"],
    category: "Leadership",
    difficulty: "hard",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the strongest institution-building books in the library for separating durable company design from founder mythology.",
    similarBookId: "good-to-great",
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
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the strongest culture books in the library for turning trust from rhetoric into operating practice.",
    similarBookId: "the-hard-thing-about-hard-things",
  },
  limitless: {
    authorCredentials:
      "Brain coach and learning strategist focused on memory, focus, speed reading, mindset, and practical cognitive performance.",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #172554 100%)",
    hook:
      "Upgrade how you learn before old beliefs, weak methods, and scattered attention keep deciding your ceiling.",
    description:
      "A practical guide to learning as a trainable system: reshaping mindset, building motivation, improving methods, protecting focus, strengthening memory, and reading faster without sacrificing comprehension.",
    whatYoullLearn: [
      "How to stop treating intelligence as fixed by rebuilding beliefs about learning, energy, and personal capability",
      "How motivation becomes more reliable when purpose, identity, and small wins support the work instead of waiting for inspiration",
      "How focus, memory, note-taking, and speed reading can become repeatable methods instead of occasional bursts",
    ],
    bestFor: ["students", "professionals", "self-improvers", "lifelong learners"],
    category: "Productivity",
    difficulty: "medium",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the clearest practical books in the library for turning learning ability into a trainable system instead of a fixed trait.",
    similarBookId: "make-it-stick",
  },
  peak: {
    authorCredentials:
      "K. Anders Ericsson was a psychologist known for expertise and deliberate-practice research; Robert Pool was a science writer focused on translating that research for general readers.",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #172554 100%)",
    hook:
      "Build skill with deliberate practice before talent stories convince you that your ceiling is fixed.",
    description:
      "A practical guide to expertise: why improvement depends on purposeful and deliberate practice, how adaptation and mental representations support growth, where coaching matters, and why the structure of a field changes what practice can produce.",
    whatYoullLearn: [
      "How deliberate practice differs from repetition by demanding specific targets, feedback, stretch, and redesign",
      "How mental representations, adaptation, and domain structure explain why experts notice, remember, and correct differently",
      "How teachers, coaches, and training design shape whether effort becomes real improvement or just more time spent",
    ],
    bestFor: ["students", "coaches", "professionals", "self-improvers"],
    category: "Psychology",
    difficulty: "medium",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "The clearest expertise book in the library for replacing talent myths with a mechanism-driven account of skill growth.",
    similarBookId: "make-it-stick",
  },
  "the-first-20-hours": {
    authorCredentials:
      "Josh Kaufman is a business educator and author focused on rapid skill acquisition, practical learning systems, and lowering the barrier to starting useful new skills.",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #172554 100%)",
    hook:
      "Get to usable performance faster by designing the first twenty hours instead of worshipping mastery from the start.",
    description:
      "A practical guide to rapid skill acquisition: choosing a lovable project, deconstructing the skill, removing barriers to practice, and building early repetitions that get you to real performance faster.",
    whatYoullLearn: [
      "How to lower the entry cost of a new skill by narrowing the target and choosing a real performance threshold",
      "How to deconstruct a complex skill into trainable parts, feedback loops, and shorter practice windows",
      "How the book's case studies turn rapid skill acquisition into usable action across learning, habit repair, and real-world practice",
    ],
    bestFor: ["self-improvers", "students", "professionals", "generalists"],
    category: "Productivity",
    difficulty: "medium",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the clearest books in the library for turning learning ambition into an actual early-stage practice system.",
    similarBookId: "peak",
  },
  "the-innovators-dilemma": {
    authorCredentials:
      "Clayton M. Christensen was a Harvard Business School professor and innovation theorist whose work defined disruptive innovation and incumbent failure under structural change.",
    coverGradient: "linear-gradient(135deg, #111827 0%, #0f766e 100%)",
    hook:
      "See why strong firms can fail rationally before disruption makes good management feel like the trap itself.",
    description:
      "A mechanism-driven guide to disruptive innovation: why incumbents miss it, how value networks and market size shape response, and what organizational design, capability appraisal, and strategy process have to do differently.",
    whatYoullLearn: [
      "How disruptive innovation differs from sustaining improvement and why incumbents can still fail while listening to customers",
      "How value networks, small-market economics, and organizational fit shape what looks rational inside the core business",
      "How to respond through structure, market discovery, capability realism, and a strategy process that can learn under uncertainty",
    ],
    bestFor: ["strategists", "operators", "founders", "leaders"],
    category: "Strategy",
    difficulty: "hard",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the foundational strategy books in the library for explaining why competent incumbents can still get disruption badly wrong.",
    similarBookId: "playing-to-win",
  },
  "competing-against-luck": {
    authorCredentials:
      "Clayton M. Christensen was a Harvard Business School professor and innovation theorist; Taddy Hall, Karen Dillon, and David S. Duncan helped translate Jobs Theory into practical innovation research and operating choices.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #0f766e 100%)",
    hook:
      "See what customers are really hiring before feature talk, segmentation, and product certainty blur the job.",
    description:
      "A practical strategy book on Jobs Theory: how customer progress drives choice, why products compete against hidden alternatives, how to hear causal demand more clearly, and what organizations must change to build around jobs instead of categories.",
    whatYoullLearn: [
      "How to define a job around customer progress, circumstance, and tradeoffs instead of product attributes or demographics",
      "How to uncover causal demand by tracing what customers pull into their lives and what competing solutions they are firing",
      "How to translate jobs thinking into innovation choices, messaging, integration, and organization design",
    ],
    bestFor: ["strategists", "product teams", "founders", "operators"],
    category: "Strategy",
    difficulty: "hard",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the clearest books in the library for turning vague customer research into a sharper mechanism for innovation choice.",
    similarBookId: "the-innovators-dilemma",
  },
  "playing-to-win": {
    authorCredentials:
      "A.G. Lafley is the former CEO of Procter & Gamble; Roger L. Martin is a strategy scholar and former Rotman School dean focused on integrated strategic choice.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #0f766e 100%)",
    hook:
      "Make strategy a set of choices before vague ambition, generic planning, and internal busyness pretend to be winning.",
    description:
      "A practical guide to strategy as an integrated cascade of choices: defining a winning aspiration, choosing where to play, deciding how to win, building the capabilities that support that choice, and using management systems to keep the whole game coherent.",
    whatYoullLearn: [
      "How to turn strategy from broad goals into a disciplined sequence of interconnected choices",
      "How where-to-play and how-to-win decisions shape the capabilities and systems a company actually needs",
      "How to think through strategy under uncertainty by generating options, testing conditions, and shortening the odds instead of waiting for certainty",
    ],
    bestFor: ["strategists", "operators", "leaders", "founders"],
    category: "Strategy",
    difficulty: "hard",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the clearest strategy books in the library for turning competitive ambition into a coherent set of reinforcing choices.",
    similarBookId: "good-to-great",
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
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the cleanest books in the library for separating loud business success from disciplined institutional strength.",
    similarBookId: "leaders-eat-last",
  },
  "seven-powers": {
    authorCredentials:
      "Strategy scholar and investor Hamilton Helmer writing on durable competitive advantage, strategic sequencing, and the conditions that make power persist.",
    coverGradient: "linear-gradient(135deg, #111827 0%, #1d4ed8 100%)",
    hook:
      "See which moats actually endure before strategy talk drifts into slogans, wishful thinking, or category confusion.",
    description:
      "A practical guide to Hamilton Helmer's seven powers: scale economies, network economies, counter-positioning, switching costs, branding, cornered resource, and process power, plus the path and timing logic that determine when those advantages can still be built.",
    whatYoullLearn: [
      "How each of the seven powers works, why it persists, and what has to be true before it becomes strategically real",
      "How to distinguish operational improvement from genuine power, including when a move changes the route toward a moat instead of polishing exposed competition",
      "How stage and timing constrain strategy by making some advantages plausible early, others plausible later, and some effectively unavailable once the window has closed",
    ],
    bestFor: ["strategists", "founders", "operators", "leaders"],
    category: "Strategy",
    difficulty: "hard",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the sharpest strategy books in the library for separating real durable advantage from generic competitive ambition.",
    similarBookId: "good-to-great",
  },
  "the-outsiders": {
    authorCredentials:
      "Investor and business writer William N. Thorndike Jr. writing on capital allocation, CEO performance, and long-term value creation.",
    coverGradient: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
    hook:
      "Study the rare CEOs who compounded value rationally before prestige habits and empire-building distort the scorecard.",
    description:
      "A practical guide to outsider-style leadership through nine chapters on capital allocation, decentralization, disciplined restraint, selective acquisitions, buybacks, and the managerial habits that drove exceptional shareholder returns.",
    whatYoullLearn: [
      "How outsider CEOs used per-share value, not executive theater or raw size, as the operating scorecard that kept decisions honest",
      "How lean headquarters, delegated operators, and patient capital allocation reinforced each other across very different businesses",
      "How to recognize the limits of thrift, dealmaking, and decentralization so discipline stays rational instead of turning into dogma",
    ],
    bestFor: ["leaders", "operators", "investors", "founders"],
    category: "Leadership",
    difficulty: "hard",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the strongest leadership books in the library for showing how capital allocation and managerial restraint actually compound together.",
    similarBookId: "seven-powers",
  },
  ultralearning: {
    authorCredentials:
      "Writer and self-education researcher focused on aggressive skill acquisition, direct practice, and self-directed learning design.",
    coverGradient: "linear-gradient(135deg, #0f766e 0%, #1e3a8a 100%)",
    hook: "Learn hard skills faster by designing projects that force proof instead of passive familiarity.",
    description:
      "A practical guide to self-directed skill acquisition through metalearning, directness, drill design, retrieval, feedback, retention, intuition, and experimentation.",
    whatYoullLearn: [
      "How to scope a serious learning project before enthusiasm turns into drift",
      "How to use direct practice, feedback, and drills to turn weak spots into usable skill",
      "How to retain, experiment, and sustain effort long enough for hard learning to compound",
    ],
    bestFor: ["students", "career switchers", "self-improvers", "builders"],
    category: "Productivity",
    difficulty: "medium",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "It gives the clearest end-to-end playbook in the library for turning ambition into a testable learning project.",
    similarBookId: "make-it-stick",
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
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the most rigorous classical strategy texts in the library for connecting ancient military logic to modern competitive decisions.",
    similarBookId: "the-prince",
  },
  "the-war-of-art": {
    authorCredentials:
      "Steven Pressfield is a novelist and nonfiction writer focused on creative resistance, professional discipline, and the inner life of making serious work.",
    coverGradient: "linear-gradient(135deg, #111827 0%, #7c2d12 100%)",
    hook:
      "Beat the inner resistance that keeps meaningful work unreal before delay, vanity, and fear quietly bury the thing you are meant to make.",
    description:
      "A practical guide to creative resistance: naming the force that blocks meaningful work, learning to turn pro through disciplined return, and finally treating the work as service to something larger than ego or self-display.",
    whatYoullLearn: [
      "How to recognize Resistance as the force that grows strongest around work that actually matters",
      "How turning pro changes the day from mood-based waiting into disciplined return and repeated labor",
      "How to keep the work from becoming vanity theater by treating it as service, stewardship, and faithful delivery",
    ],
    bestFor: ["writers", "builders", "artists", "self-improvers"],
    category: "Productivity",
    difficulty: "medium",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the clearest books in the library for moving from blocked intention to serious creative labor without collapsing into grind rhetoric.",
    similarBookId: "deep-work",
  },
  "the-33-strategies-of-war": {
    authorCredentials:
      "Robert Greene is a strategy and power writer known for synthesizing historical case material into modern frameworks for conflict, leverage, positioning, and self-command.",
    coverGradient: "linear-gradient(135deg, #111827 0%, #7c2d12 100%)",
    hook:
      "Learn when to escalate, flank, negotiate, disappear, or refuse the game before conflict starts choosing for you.",
    description:
      "A modern reading of Robert Greene's thirty-three strategy chapters on polarity, momentum, intelligence, maneuver, moral positioning, hidden pressure, and the ethical limits of strategic thinking when the field stops being a battlefield.",
    whatYoullLearn: [
      "How to read a conflict for terrain, tempo, leverage, morale, and hidden asymmetry before you commit to a move",
      "How to use strategy families such as presence, maneuver, negotiation, deception, pressure, and timing without collapsing them into reflexive aggression",
      "How to recognize the ethical edge of the framework and put it down in intimacy, grief, collaboration, and other settings where the other side is not an opponent",
    ],
    bestFor: ["strategists", "operators", "leaders", "readers who think competitively"],
    category: "Strategy",
    difficulty: "hard",
    badges: ["new", "staff-pick"],
    staffPickReason:
      "It is the sharpest modern strategy package in the library for separating legitimate competitive moves from ego, cruelty, and overreach.",
    similarBookId: "the-art-of-war",
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
    badges: ["new", "staff-pick"],
    staffPickReason:
      "One of the cleanest entry points in the library for turning general reasoning advice into a reusable decision toolkit.",
    similarBookId: "thinking-fast-and-slow",
  },
};

function buildLibraryBookFromMetadata(
  entry: BookCatalogMetadata,
): LibraryBook {
  const bookId = entry.id;
  const category = inferLibraryCategory(entry.categories);
  const overrides = GENERATED_LIBRARY_BOOK_OVERRIDES[bookId] ?? {};

  return {
    id: bookId,
    title: entry.title,
    author: entry.author,
    authorCredentials: overrides.authorCredentials,
    coverImage: overrides.coverImage ?? entry.coverImage,
    coverGradient: overrides.coverGradient ?? inferCoverGradient(bookId),
    hook:
      overrides.hook ??
      entry.synopsis.split(".")[0]?.trim() ??
      "A focused, chapter-based learning experience with practical examples and quiz gates.",
    description: overrides.description ?? entry.synopsis,
    whatYoullLearn:
      overrides.whatYoullLearn ??
      buildLearningPoints(entry.tags, entry.categories),
    bestFor: overrides.bestFor ?? inferBestFor(category),
    category: overrides.category ?? category,
    difficulty:
      (overrides.difficulty as Difficulty | undefined) ??
      (entry.difficulty.toLowerCase() as Difficulty),
    totalChapters: entry.chapterCount,
    estimatedReadingTimeMinutes: entry.estimatedMinutes,
    isPro: overrides.isPro ?? true,
    badges: overrides.badges ?? ["new"],
    staffPickReason: overrides.staffPickReason,
    similarBookId: overrides.similarBookId,
    userProgress: overrides.userProgress,
  };
}

/**
 * Build the presentational `LibraryBook` UI shape from a published catalog book
 * (`/api/book/me/dashboard` → `catalog[]`) plus the viewer's per-book progress
 * entry. This is the production-data counterpart to `buildLibraryBookFromMetadata`
 * (which reads the local static catalog). Editorial config (overrides + visual
 * fields) is reused so the presentational components don't change. Fields with
 * no backend source (gradient, badges) are deterministic/static — see TODOs in
 * `dashboardToLibraryUi.ts`. Social-proof fields (reader counts, completion
 * rates) were removed: there is no honest source for them.
 */
export function buildLibraryBookFromCatalog(
  book: LibraryCatalogBook,
  entry?: LibraryBookEntry,
): LibraryBook {
  const bookId = book.id;
  const category = inferLibraryCategory(book.categories);
  const overrides = GENERATED_LIBRARY_BOOK_OVERRIDES[bookId] ?? {};

  const userProgress: UserProgress | undefined =
    entry && entry.status !== "not_started"
      ? {
          currentChapter: Math.min(
            entry.chaptersCompleted + 1,
            Math.max(1, entry.chaptersTotal),
          ),
          percentComplete: entry.progressPercent,
          lastReadAt: new Date(entry.lastActivityAt),
          // No per-book IP figure in the dashboard payload — leave undefined
          // rather than fabricate a "+0 IP earned" line.
          isCompleted: entry.status === "completed",
          completedAt:
            entry.status === "completed" ? new Date(entry.lastActivityAt) : undefined,
        }
      : undefined;

  return {
    id: bookId,
    title: book.title,
    author: book.author,
    authorCredentials: overrides.authorCredentials,
    coverImage: overrides.coverImage ?? book.coverImage,
    coverGradient: overrides.coverGradient ?? inferCoverGradient(bookId),
    hook:
      overrides.hook ??
      book.synopsis.split(".")[0]?.trim() ??
      "A focused, chapter-based learning experience with practical examples and quiz gates.",
    description: overrides.description ?? book.synopsis,
    whatYoullLearn:
      overrides.whatYoullLearn ?? buildLearningPoints(book.tags, book.categories),
    bestFor: overrides.bestFor ?? inferBestFor(category),
    category: overrides.category ?? category,
    difficulty:
      (overrides.difficulty as Difficulty | undefined) ??
      (book.difficulty.toLowerCase() as Difficulty),
    totalChapters: book.chapterCount,
    estimatedReadingTimeMinutes: book.estimatedMinutes,
    isPro: overrides.isPro ?? true,
    badges: overrides.badges ?? ["new"],
    staffPickReason: overrides.staffPickReason,
    similarBookId: overrides.similarBookId,
    userProgress,
  };
}

// ── All books ──
const BASE_LIBRARY_BOOKS: LibraryBook[] = [
];

const BASE_LIBRARY_BOOK_IDS = new Set(BASE_LIBRARY_BOOKS.map((book) => book.id));

const GENERATED_LIBRARY_BOOKS: LibraryBook[] = BOOKS_CATALOG_METADATA
  .filter((entry) => !BASE_LIBRARY_BOOK_IDS.has(entry.id))
  .map((entry) => buildLibraryBookFromMetadata(entry));

export const MOCK_BOOKS: LibraryBook[] = [
  ...BASE_LIBRARY_BOOKS,
  ...GENERATED_LIBRARY_BOOKS,
];

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

// "popular" / "completion" were dropped — both sorted on fabricated metrics.
// "recent" was dropped too: LibraryCatalogBook has no addedAt/publishedAt/createdAt
// field, so labelling a catalog-order reversal "Recently added" is the same
// fabricated-signal class. Restore it only when a real date field exists.
// "featured" keeps the catalog's curated order (no claim of popularity).
export type SortOption =
  | "featured"
  | "shortest"
  | "beginner"
  | "alphabetical";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "shortest", label: "Shortest first" },
  { value: "beginner", label: "Best for beginners" },
  { value: "alphabetical", label: "Alphabetical" },
];
