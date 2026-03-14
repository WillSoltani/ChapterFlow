export type BadgeCategory =
  | "Getting Started"
  | "Consistency"
  | "Reading Depth"
  | "Mastery"
  | "Books"
  | "Examples"
  | "Notes"
  | "Exploration"
  | "Premium";

export type BadgeTier = "Bronze" | "Silver" | "Gold" | "Platinum";
export type BadgePrestige = 1 | 2 | 3 | 4;
export type BadgeNotificationStyle = "quiet" | "toast" | "celebration";

export type BadgeDefinition = {
  id: string;
  name: string;
  category: BadgeCategory;
  tier?: BadgeTier;
  description: string;
  whyItMatters: string;
  howToEarn: string;
  icon: string;
  prestige: BadgePrestige;
  notificationStyle: BadgeNotificationStyle;
  hiddenUntilDiscovered?: boolean;
  accent: "sky" | "emerald" | "amber" | "violet" | "rose";
};

export type BadgeProgressStats = {
  totalCompletedChapters: number;
  completedBooks: number;
  startedBooks: number;
  streakDays: number;
  longestStreak: number;
  avgQuizScore: number;
  maxQuizScore: number;
  quizzesPassed: number;
  perfectQuizCount: number;
  distinctQuizBooks: number;
  quizzesPassedInDeeperMode: number;
  quizCount: number;
  totalQuizQuestionsAnswered: number;
  completedGoalDays: number;
  activeWeeks: number;
  weekendActiveDays: number;
  weekdayActiveDays: number;
  recoveredAfterMiss: number;
  chaptersSimpleCompleted: number;
  chaptersStandardCompleted: number;
  chaptersDeeperCompleted: number;
  usedAllReadingModes: boolean;
  chaptersCompletedWithFocusMode: number;
  completedChaptersWithNotes: number;
  completedBooksInDeeperMode: number;
  examplesViewedChapters: number;
  viewedExampleContexts: Array<"personal" | "school" | "work">;
  personalExamplesChapters: number;
  schoolExamplesChapters: number;
  workExamplesChapters: number;
  notesCount: number;
  noteBooksCount: number;
  completedChaptersWithReflection: number;
  exploredCategories: number;
  challengingBooksStarted: number;
  returnedAfterLongGap: number;
  readingListCount: number;
  challengingBooksCompleted: number;
  strategyBooksCompleted: number;
  psychologyBooksCompleted: number;
  completedCategoriesCount: number;
  booksCompletedWithAllQuizzesPassed: number;
  proActivated: boolean;
  proMultiTrack: boolean;
  recapCompletions: number;
};

export type BadgeState = BadgeDefinition & {
  earned: boolean;
  earnedAt: string | null;
  progressValue: number;
  targetValue: number;
  progressLabel: string;
  isVisible: boolean;
  nextTierId?: string;
};

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first-chapter",
    name: "First Chapter",
    category: "Getting Started",
    description: "Complete your first chapter and turn intention into momentum.",
    whyItMatters: "The first real completion is what converts setup into a habit.",
    howToEarn: "Complete one chapter.",
    icon: "📘",
    prestige: 1,
    notificationStyle: "quiet",
    accent: "sky",
  },
  {
    id: "first-quiz-pass",
    name: "First Pass",
    category: "Getting Started",
    description: "Pass your first chapter quiz.",
    whyItMatters: "Early mastery signals that the app is helping ideas stick.",
    howToEarn: "Pass one chapter quiz.",
    icon: "✅",
    prestige: 1,
    notificationStyle: "quiet",
    accent: "emerald",
  },
  {
    id: "first-note",
    name: "First Note",
    category: "Getting Started",
    description: "Save your first note while reading.",
    whyItMatters: "Writing turns passive reading into active processing.",
    howToEarn: "Save one note in any chapter.",
    icon: "📝",
    prestige: 1,
    notificationStyle: "quiet",
    accent: "amber",
  },
  {
    id: "first-book-started",
    name: "Book in Motion",
    category: "Getting Started",
    description: "Start your first book inside the app.",
    whyItMatters: "Real engagement begins when one title becomes a live commitment.",
    howToEarn: "Start one book.",
    icon: "📚",
    prestige: 1,
    notificationStyle: "quiet",
    accent: "sky",
  },
  {
    id: "first-goal-hit",
    name: "Goal Hit",
    category: "Getting Started",
    description: "Complete your daily reading goal for the first time.",
    whyItMatters: "Meeting a target once makes the habit feel real and repeatable.",
    howToEarn: "Finish your daily reading goal on one day.",
    icon: "🎯",
    prestige: 1,
    notificationStyle: "quiet",
    accent: "emerald",
  },
  {
    id: "first-examples-viewed",
    name: "Applied Reading",
    category: "Getting Started",
    description: "Open examples and use the app beyond summary alone.",
    whyItMatters: "Examples are where abstract ideas start to feel usable.",
    howToEarn: "View chapter examples in any context.",
    icon: "💡",
    prestige: 1,
    notificationStyle: "quiet",
    accent: "amber",
  },
  {
    id: "first-standard-depth",
    name: "Deeper Start",
    category: "Getting Started",
    description: "Complete a chapter in Standard or Deeper mode.",
    whyItMatters: "This marks the move from quick reading into stronger retention.",
    howToEarn: "Complete one chapter in Standard or Deeper mode.",
    icon: "📗",
    prestige: 1,
    notificationStyle: "quiet",
    accent: "sky",
  },
  {
    id: "streak-3",
    name: "Rhythm Bronze",
    category: "Consistency",
    tier: "Bronze",
    description: "Build a three day streak.",
    whyItMatters: "Three connected days are often enough to establish momentum.",
    howToEarn: "Reach a three day streak.",
    icon: "🔥",
    prestige: 2,
    notificationStyle: "toast",
    accent: "amber",
  },
  {
    id: "streak-7",
    name: "Rhythm Silver",
    category: "Consistency",
    tier: "Silver",
    description: "Hold a seven day streak.",
    whyItMatters: "A full week of continuity is one of the strongest early habit signals.",
    howToEarn: "Reach a seven day streak.",
    icon: "🔥",
    prestige: 2,
    notificationStyle: "toast",
    accent: "amber",
  },
  {
    id: "streak-14",
    name: "Rhythm Gold",
    category: "Consistency",
    tier: "Gold",
    description: "Hold a fourteen day streak.",
    whyItMatters: "Two strong weeks means the product is becoming part of your routine.",
    howToEarn: "Reach a fourteen day streak.",
    icon: "🔥",
    prestige: 3,
    notificationStyle: "toast",
    accent: "amber",
  },
  {
    id: "streak-30",
    name: "Rhythm Platinum",
    category: "Consistency",
    tier: "Platinum",
    description: "Hold a thirty day streak.",
    whyItMatters: "At this point consistency is no longer random. It is identity level behavior.",
    howToEarn: "Reach a thirty day streak.",
    icon: "🔥",
    prestige: 4,
    notificationStyle: "celebration",
    accent: "amber",
    hiddenUntilDiscovered: true,
  },
  {
    id: "goal-5",
    name: "Goal Keeper",
    category: "Consistency",
    tier: "Bronze",
    description: "Complete your daily goal five times.",
    whyItMatters: "Consistent goal completion matters more than one unusually long session.",
    howToEarn: "Finish your daily goal on five days.",
    icon: "📈",
    prestige: 2,
    notificationStyle: "toast",
    accent: "emerald",
  },
  {
    id: "goal-10",
    name: "Goal Keeper Plus",
    category: "Consistency",
    tier: "Silver",
    description: "Complete your daily goal ten times.",
    whyItMatters: "Reliable goal completion compounds reading progress quietly and steadily.",
    howToEarn: "Finish your daily goal on ten days.",
    icon: "📈",
    prestige: 3,
    notificationStyle: "toast",
    accent: "emerald",
  },
  {
    id: "week-reader",
    name: "Week by Week",
    category: "Consistency",
    description: "Read across four separate weeks.",
    whyItMatters: "Spacing engagement across weeks builds a durable reading rhythm.",
    howToEarn: "Read in four distinct weeks.",
    icon: "🗓️",
    prestige: 2,
    notificationStyle: "toast",
    accent: "sky",
  },
  {
    id: "weekend-weekday",
    name: "Balanced Rhythm",
    category: "Consistency",
    description: "Read consistently on both weekdays and weekends.",
    whyItMatters: "A habit that survives schedule changes is a habit that lasts.",
    howToEarn: "Build meaningful activity on weekdays and weekends.",
    icon: "⚖️",
    prestige: 2,
    notificationStyle: "quiet",
    accent: "emerald",
  },
  {
    id: "comeback-reader",
    name: "Comeback Reader",
    category: "Consistency",
    description: "Miss a day and return quickly instead of drifting away.",
    whyItMatters: "Returning after a miss is one of the strongest behaviors behind long term retention.",
    howToEarn: "Come back after a missed day and restart momentum.",
    icon: "↺",
    prestige: 2,
    notificationStyle: "quiet",
    accent: "sky",
  },
  {
    id: "standard-five",
    name: "Standard Form",
    category: "Reading Depth",
    description: "Complete five chapters in Standard mode.",
    whyItMatters: "Standard mode is where speed and depth start to balance well.",
    howToEarn: "Complete five chapters in Standard mode.",
    icon: "📙",
    prestige: 2,
    notificationStyle: "toast",
    accent: "sky",
  },
  {
    id: "deeper-five",
    name: "Deep Reader",
    category: "Reading Depth",
    description: "Complete five chapters in Deeper mode.",
    whyItMatters: "Deeper mode rewards patience and produces stronger understanding over time.",
    howToEarn: "Complete five chapters in Deeper mode.",
    icon: "🧠",
    prestige: 3,
    notificationStyle: "toast",
    accent: "violet",
  },
  {
    id: "mode-explorer",
    name: "Mode Explorer",
    category: "Reading Depth",
    description: "Use all three reading modes.",
    whyItMatters: "Great readers know when to skim, when to settle, and when to go deep.",
    howToEarn: "Use Simple, Standard, and Deeper mode across your reading.",
    icon: "🧭",
    prestige: 2,
    notificationStyle: "quiet",
    accent: "sky",
  },
  {
    id: "focus-finish",
    name: "Focused Finish",
    category: "Reading Depth",
    description: "Complete a chapter with focus mode turned on.",
    whyItMatters: "Deliberate focus is one of the fastest ways to improve comprehension quality.",
    howToEarn: "Finish one chapter while using focus mode.",
    icon: "🎧",
    prestige: 2,
    notificationStyle: "quiet",
    accent: "violet",
  },
  {
    id: "annotated-run",
    name: "Annotated Run",
    category: "Reading Depth",
    description: "Complete ten chapters with notes saved.",
    whyItMatters: "Notes taken during progress usually predict better retention later.",
    howToEarn: "Finish ten chapters that include saved notes.",
    icon: "✍️",
    prestige: 3,
    notificationStyle: "toast",
    accent: "amber",
  },
  {
    id: "deeper-book",
    name: "Deep Finish",
    category: "Reading Depth",
    description: "Complete one full book in Deeper mode.",
    whyItMatters: "A whole book completed at depth shows real endurance and intent.",
    howToEarn: "Finish one book with every chapter completed in Deeper mode.",
    icon: "📓",
    prestige: 4,
    notificationStyle: "celebration",
    accent: "violet",
    hiddenUntilDiscovered: true,
  },
  {
    id: "perfect-one",
    name: "Perfect Pass",
    category: "Mastery",
    description: "Score one perfect quiz.",
    whyItMatters: "Perfect recall shows the chapter truly settled, not just passed.",
    howToEarn: "Earn one one hundred percent quiz score.",
    icon: "✨",
    prestige: 2,
    notificationStyle: "toast",
    accent: "emerald",
  },
  {
    id: "perfect-three",
    name: "Perfect Series",
    category: "Mastery",
    description: "Score three perfect quizzes.",
    whyItMatters: "Repeated perfect performance signals durable mastery, not luck.",
    howToEarn: "Earn three one hundred percent quiz scores.",
    icon: "🌟",
    prestige: 3,
    notificationStyle: "toast",
    accent: "emerald",
  },
  {
    id: "quiz-pass-10",
    name: "Quiz Runner",
    category: "Mastery",
    tier: "Bronze",
    description: "Pass ten quizzes.",
    whyItMatters: "Frequent quiz completion keeps reading tied to understanding.",
    howToEarn: "Pass ten chapter quizzes.",
    icon: "🏅",
    prestige: 2,
    notificationStyle: "toast",
    accent: "emerald",
  },
  {
    id: "quiz-pass-25",
    name: "Quiz Runner Plus",
    category: "Mastery",
    tier: "Gold",
    description: "Pass twenty five quizzes.",
    whyItMatters: "This level of review shows serious long term use of the learning loop.",
    howToEarn: "Pass twenty five chapter quizzes.",
    icon: "🏆",
    prestige: 4,
    notificationStyle: "celebration",
    accent: "emerald",
    hiddenUntilDiscovered: true,
  },
  {
    id: "deeper-pass",
    name: "Depth Check",
    category: "Mastery",
    description: "Pass a quiz after reading in Deeper mode.",
    whyItMatters: "It connects effortful reading with effortful recall.",
    howToEarn: "Pass one quiz tied to a Deeper mode chapter session.",
    icon: "🔍",
    prestige: 2,
    notificationStyle: "quiet",
    accent: "violet",
  },
  {
    id: "score-80-ten",
    name: "Mastery Baseline",
    category: "Mastery",
    description: "Hold an average quiz score above eighty across ten quizzes.",
    whyItMatters: "Consistency at a strong level matters more than one lucky high score.",
    howToEarn: "Average at least eighty percent across ten quizzes.",
    icon: "📐",
    prestige: 3,
    notificationStyle: "toast",
    accent: "emerald",
  },
  {
    id: "hundred-answers",
    name: "Answer Bank",
    category: "Mastery",
    description: "Answer one hundred quiz questions.",
    whyItMatters: "Volume with feedback is what turns recall into a durable skill.",
    howToEarn: "Answer one hundred quiz questions in total.",
    icon: "🧩",
    prestige: 3,
    notificationStyle: "toast",
    accent: "sky",
  },
  {
    id: "mastery-three-books",
    name: "Cross Book Mastery",
    category: "Mastery",
    description: "Pass quizzes in three different books.",
    whyItMatters: "Mastery across books is stronger than mastery inside one comfort zone.",
    howToEarn: "Pass quizzes in three separate books.",
    icon: "🗂️",
    prestige: 3,
    notificationStyle: "toast",
    accent: "emerald",
  },
  {
    id: "recap-finish",
    name: "Review Closer",
    category: "Mastery",
    description: "Complete a chapter review with recap opened.",
    whyItMatters: "Recap strengthens the handoff from reading to long term memory.",
    howToEarn: "Pass a quiz in a chapter where recap was used.",
    icon: "🔁",
    prestige: 2,
    notificationStyle: "quiet",
    accent: "sky",
  },
  {
    id: "first-book",
    name: "First Book",
    category: "Books",
    tier: "Bronze",
    description: "Finish your first book.",
    whyItMatters: "Book completion is the clearest sign of sustained commitment.",
    howToEarn: "Complete one book.",
    icon: "🏁",
    prestige: 3,
    notificationStyle: "toast",
    accent: "amber",
  },
  {
    id: "three-books",
    name: "Shelf Builder",
    category: "Books",
    tier: "Silver",
    description: "Finish three books.",
    whyItMatters: "Progress across several books shows the habit is portable and repeatable.",
    howToEarn: "Complete three books.",
    icon: "📚",
    prestige: 3,
    notificationStyle: "toast",
    accent: "amber",
  },
  {
    id: "five-books",
    name: "Library Finisher",
    category: "Books",
    tier: "Gold",
    description: "Finish five books.",
    whyItMatters: "This is a major milestone that reflects serious long term product use.",
    howToEarn: "Complete five books.",
    icon: "🏛️",
    prestige: 4,
    notificationStyle: "celebration",
    accent: "amber",
    hiddenUntilDiscovered: true,
  },
  {
    id: "challenging-finish",
    name: "Hard Finish",
    category: "Books",
    description: "Finish a challenging book.",
    whyItMatters: "Finishing hard material is one of the clearest marks of intellectual stamina.",
    howToEarn: "Complete one book labeled Hard.",
    icon: "⛰️",
    prestige: 4,
    notificationStyle: "celebration",
    accent: "amber",
  },
  {
    id: "strategy-finish",
    name: "Strategy Closer",
    category: "Books",
    description: "Finish a strategy category book.",
    whyItMatters: "This rewards applied decision making rather than only passive reading.",
    howToEarn: "Complete one strategy book.",
    icon: "♟️",
    prestige: 3,
    notificationStyle: "toast",
    accent: "sky",
  },
  {
    id: "psychology-finish",
    name: "Mind Reader",
    category: "Books",
    description: "Finish a psychology category book.",
    whyItMatters: "Psychology reading often pays off when insight is carried back into daily life.",
    howToEarn: "Complete one psychology book.",
    icon: "🧠",
    prestige: 3,
    notificationStyle: "toast",
    accent: "violet",
  },
  {
    id: "category-triad",
    name: "Range Builder",
    category: "Books",
    description: "Complete books across three categories.",
    whyItMatters: "Breadth improves transfer because insights start connecting across domains.",
    howToEarn: "Finish books from three categories.",
    icon: "🌐",
    prestige: 4,
    notificationStyle: "celebration",
    accent: "sky",
    hiddenUntilDiscovered: true,
  },
  {
    id: "mastered-book",
    name: "Full Mastery",
    category: "Books",
    description: "Complete a book with quizzes passed across every chapter.",
    whyItMatters: "This is one of the strongest signals that reading and retention stayed aligned to the end.",
    howToEarn: "Finish one book with quizzes passed in every chapter.",
    icon: "👑",
    prestige: 4,
    notificationStyle: "celebration",
    accent: "emerald",
    hiddenUntilDiscovered: true,
  },
  {
    id: "context-triad",
    name: "Context Switcher",
    category: "Examples",
    description: "Use personal, school, and work examples.",
    whyItMatters: "Learning becomes more useful when ideas transfer across contexts.",
    howToEarn: "View examples in all three contexts.",
    icon: "🔄",
    prestige: 2,
    notificationStyle: "quiet",
    accent: "sky",
  },
  {
    id: "personal-five",
    name: "Personal Lens",
    category: "Examples",
    description: "Use personal examples across five chapters.",
    whyItMatters: "Personal examples are where abstract ideas start turning into real choices.",
    howToEarn: "Use personal examples in five chapters.",
    icon: "🪞",
    prestige: 2,
    notificationStyle: "quiet",
    accent: "rose",
  },
  {
    id: "school-five",
    name: "Study Lens",
    category: "Examples",
    description: "Use school examples across five chapters.",
    whyItMatters: "It helps connect reading to work that already matters in your week.",
    howToEarn: "Use school examples in five chapters.",
    icon: "🎓",
    prestige: 2,
    notificationStyle: "quiet",
    accent: "sky",
  },
  {
    id: "work-five",
    name: "Work Lens",
    category: "Examples",
    description: "Use work examples across five chapters.",
    whyItMatters: "The more often ideas land in work contexts, the more durable their value becomes.",
    howToEarn: "Use work examples in five chapters.",
    icon: "💼",
    prestige: 2,
    notificationStyle: "quiet",
    accent: "amber",
  },
  {
    id: "examples-ten",
    name: "Applied Reader",
    category: "Examples",
    description: "Complete ten chapters where examples were actively used.",
    whyItMatters: "Application focused reading usually leads to stronger follow through outside the app.",
    howToEarn: "Use examples across ten completed chapters.",
    icon: "🛠️",
    prestige: 3,
    notificationStyle: "toast",
    accent: "amber",
  },
  {
    id: "notes-ten",
    name: "Notebook Builder",
    category: "Notes",
    tier: "Silver",
    description: "Save notes across ten chapters.",
    whyItMatters: "A body of notes turns the app into a personal learning archive.",
    howToEarn: "Save notes in ten chapters.",
    icon: "📓",
    prestige: 3,
    notificationStyle: "toast",
    accent: "amber",
  },
  {
    id: "notes-three-books",
    name: "Cross Book Notes",
    category: "Notes",
    description: "Save notes in three different books.",
    whyItMatters: "Reflection across books usually signals deeper engagement than isolated annotation.",
    howToEarn: "Save notes in three books.",
    icon: "🗒️",
    prestige: 3,
    notificationStyle: "toast",
    accent: "amber",
  },
  {
    id: "reflection-finish",
    name: "Reflection Closer",
    category: "Notes",
    description: "Finish chapters that also contain written reflection.",
    whyItMatters: "Reflection after completion helps connect understanding with memory.",
    howToEarn: "Complete five chapters that include notes.",
    icon: "🪶",
    prestige: 3,
    notificationStyle: "quiet",
    accent: "rose",
  },
  {
    id: "category-explorer",
    name: "Explorer",
    category: "Exploration",
    description: "Start books across three categories.",
    whyItMatters: "Exploration broadens what the app can do for you over time.",
    howToEarn: "Start books from three categories.",
    icon: "🧭",
    prestige: 2,
    notificationStyle: "quiet",
    accent: "sky",
  },
  {
    id: "challenging-trial",
    name: "Challenge Accepted",
    category: "Exploration",
    description: "Start a hard book.",
    whyItMatters: "Trying demanding material expands both confidence and range.",
    howToEarn: "Start one book labeled Hard.",
    icon: "⚡",
    prestige: 2,
    notificationStyle: "quiet",
    accent: "amber",
  },
  {
    id: "long-gap-return",
    name: "Return Loop",
    category: "Exploration",
    description: "Come back after a long gap and restart progress.",
    whyItMatters: "Reactivation matters because sustainable use is never perfectly linear.",
    howToEarn: "Return after a longer gap in activity.",
    icon: "🪃",
    prestige: 2,
    notificationStyle: "quiet",
    accent: "emerald",
  },
  {
    id: "reading-list-five",
    name: "Path Builder",
    category: "Exploration",
    description: "Build a five book reading list.",
    whyItMatters: "A thoughtful queue increases the chance that momentum survives your current title.",
    howToEarn: "Select five books for your reading list.",
    icon: "🗂",
    prestige: 2,
    notificationStyle: "quiet",
    accent: "sky",
  },
  {
    id: "pro-activated",
    name: "Pro Activated",
    category: "Premium",
    description: "Upgrade to Pro.",
    whyItMatters: "It marks a stronger commitment to long term use of the product.",
    howToEarn: "Activate Pro access.",
    icon: "♦️",
    prestige: 2,
    notificationStyle: "toast",
    accent: "violet",
    hiddenUntilDiscovered: true,
  },
  {
    id: "pro-multi-track",
    name: "Pro Multi Track",
    category: "Premium",
    description: "Maintain active progress across multiple books with Pro.",
    whyItMatters: "It rewards a more ambitious reading practice without punishing free users.",
    howToEarn: "Use Pro while actively progressing in three books.",
    icon: "💠",
    prestige: 3,
    notificationStyle: "toast",
    accent: "violet",
    hiddenUntilDiscovered: true,
  },
];

export const BADGE_FILTERS = [
  "All",
  "Earned",
  "Locked",
  "Streak",
  "Mastery",
  "Books",
  "Notes",
  "Exploration",
  "Premium",
] as const;

export type BadgeFilter = (typeof BADGE_FILTERS)[number];

function progressForBadge(id: string, stats: BadgeProgressStats) {
  switch (id) {
    case "first-chapter":
      return { current: stats.totalCompletedChapters, target: 1, label: `${Math.min(stats.totalCompletedChapters, 1)} of 1 chapter` };
    case "first-quiz-pass":
      return { current: stats.quizzesPassed, target: 1, label: `${Math.min(stats.quizzesPassed, 1)} of 1 quiz` };
    case "first-note":
      return { current: stats.notesCount, target: 1, label: `${Math.min(stats.notesCount, 1)} of 1 note` };
    case "first-book-started":
      return { current: stats.startedBooks, target: 1, label: `${Math.min(stats.startedBooks, 1)} of 1 book` };
    case "first-goal-hit":
      return { current: stats.completedGoalDays, target: 1, label: `${Math.min(stats.completedGoalDays, 1)} of 1 day` };
    case "first-examples-viewed":
      return { current: stats.examplesViewedChapters, target: 1, label: `${Math.min(stats.examplesViewedChapters, 1)} of 1 chapter` };
    case "first-standard-depth":
      return { current: stats.chaptersStandardCompleted + stats.chaptersDeeperCompleted, target: 1, label: `${Math.min(stats.chaptersStandardCompleted + stats.chaptersDeeperCompleted, 1)} of 1 chapter` };
    case "streak-3":
      return { current: stats.longestStreak, target: 3, label: `${Math.min(stats.longestStreak, 3)} of 3 days` };
    case "streak-7":
      return { current: stats.longestStreak, target: 7, label: `${Math.min(stats.longestStreak, 7)} of 7 days` };
    case "streak-14":
      return { current: stats.longestStreak, target: 14, label: `${Math.min(stats.longestStreak, 14)} of 14 days` };
    case "streak-30":
      return { current: stats.longestStreak, target: 30, label: `${Math.min(stats.longestStreak, 30)} of 30 days` };
    case "goal-5":
      return { current: stats.completedGoalDays, target: 5, label: `${Math.min(stats.completedGoalDays, 5)} of 5 days` };
    case "goal-10":
      return { current: stats.completedGoalDays, target: 10, label: `${Math.min(stats.completedGoalDays, 10)} of 10 days` };
    case "week-reader":
      return { current: stats.activeWeeks, target: 4, label: `${Math.min(stats.activeWeeks, 4)} of 4 weeks` };
    case "weekend-weekday":
      return { current: Math.min(stats.weekendActiveDays, 4) + Math.min(stats.weekdayActiveDays, 10), target: 14, label: `${Math.min(stats.weekendActiveDays, 4)} weekend days and ${Math.min(stats.weekdayActiveDays, 10)} weekdays` };
    case "comeback-reader":
      return { current: stats.recoveredAfterMiss, target: 1, label: `${Math.min(stats.recoveredAfterMiss, 1)} of 1 return` };
    case "standard-five":
      return { current: stats.chaptersStandardCompleted, target: 5, label: `${Math.min(stats.chaptersStandardCompleted, 5)} of 5 chapters` };
    case "deeper-five":
      return { current: stats.chaptersDeeperCompleted, target: 5, label: `${Math.min(stats.chaptersDeeperCompleted, 5)} of 5 chapters` };
    case "mode-explorer":
      return { current: stats.usedAllReadingModes ? 3 : Number(stats.chaptersSimpleCompleted > 0) + Number(stats.chaptersStandardCompleted > 0) + Number(stats.chaptersDeeperCompleted > 0), target: 3, label: `${Number(stats.chaptersSimpleCompleted > 0) + Number(stats.chaptersStandardCompleted > 0) + Number(stats.chaptersDeeperCompleted > 0)} of 3 modes` };
    case "focus-finish":
      return { current: stats.chaptersCompletedWithFocusMode, target: 1, label: `${Math.min(stats.chaptersCompletedWithFocusMode, 1)} of 1 chapter` };
    case "annotated-run":
      return { current: stats.completedChaptersWithNotes, target: 10, label: `${Math.min(stats.completedChaptersWithNotes, 10)} of 10 chapters` };
    case "deeper-book":
      return { current: stats.completedBooksInDeeperMode, target: 1, label: `${Math.min(stats.completedBooksInDeeperMode, 1)} of 1 book` };
    case "perfect-one":
      return { current: stats.perfectQuizCount, target: 1, label: `${Math.min(stats.perfectQuizCount, 1)} of 1 perfect score` };
    case "perfect-three":
      return { current: stats.perfectQuizCount, target: 3, label: `${Math.min(stats.perfectQuizCount, 3)} of 3 perfect scores` };
    case "quiz-pass-10":
      return { current: stats.quizzesPassed, target: 10, label: `${Math.min(stats.quizzesPassed, 10)} of 10 quizzes` };
    case "quiz-pass-25":
      return { current: stats.quizzesPassed, target: 25, label: `${Math.min(stats.quizzesPassed, 25)} of 25 quizzes` };
    case "deeper-pass":
      return { current: stats.quizzesPassedInDeeperMode, target: 1, label: `${Math.min(stats.quizzesPassedInDeeperMode, 1)} of 1 quiz` };
    case "score-80-ten":
      return { current: stats.quizCount >= 10 ? Math.min(stats.avgQuizScore, 80) : Math.min(stats.quizCount, 10) * 8, target: 80, label: stats.quizCount >= 10 ? `${Math.min(stats.avgQuizScore, 80)} of 80 average score` : `${stats.quizCount} of 10 quizzes tracked` };
    case "hundred-answers":
      return { current: stats.totalQuizQuestionsAnswered, target: 100, label: `${Math.min(stats.totalQuizQuestionsAnswered, 100)} of 100 answers` };
    case "mastery-three-books":
      return { current: stats.distinctQuizBooks, target: 3, label: `${Math.min(stats.distinctQuizBooks, 3)} of 3 books` };
    case "recap-finish":
      return { current: stats.recapCompletions, target: 1, label: `${Math.min(stats.recapCompletions, 1)} of 1 recap` };
    case "first-book":
      return { current: stats.completedBooks, target: 1, label: `${Math.min(stats.completedBooks, 1)} of 1 book` };
    case "three-books":
      return { current: stats.completedBooks, target: 3, label: `${Math.min(stats.completedBooks, 3)} of 3 books` };
    case "five-books":
      return { current: stats.completedBooks, target: 5, label: `${Math.min(stats.completedBooks, 5)} of 5 books` };
    case "challenging-finish":
      return { current: stats.challengingBooksCompleted, target: 1, label: `${Math.min(stats.challengingBooksCompleted, 1)} of 1 book` };
    case "strategy-finish":
      return { current: stats.strategyBooksCompleted, target: 1, label: `${Math.min(stats.strategyBooksCompleted, 1)} of 1 book` };
    case "psychology-finish":
      return { current: stats.psychologyBooksCompleted, target: 1, label: `${Math.min(stats.psychologyBooksCompleted, 1)} of 1 book` };
    case "category-triad":
      return { current: stats.completedCategoriesCount, target: 3, label: `${Math.min(stats.completedCategoriesCount, 3)} of 3 categories` };
    case "mastered-book":
      return { current: stats.booksCompletedWithAllQuizzesPassed, target: 1, label: `${Math.min(stats.booksCompletedWithAllQuizzesPassed, 1)} of 1 book` };
    case "context-triad":
      return { current: stats.viewedExampleContexts.length, target: 3, label: `${stats.viewedExampleContexts.length} of 3 contexts` };
    case "personal-five":
      return { current: stats.personalExamplesChapters, target: 5, label: `${Math.min(stats.personalExamplesChapters, 5)} of 5 chapters` };
    case "school-five":
      return { current: stats.schoolExamplesChapters, target: 5, label: `${Math.min(stats.schoolExamplesChapters, 5)} of 5 chapters` };
    case "work-five":
      return { current: stats.workExamplesChapters, target: 5, label: `${Math.min(stats.workExamplesChapters, 5)} of 5 chapters` };
    case "examples-ten":
      return { current: stats.examplesViewedChapters, target: 10, label: `${Math.min(stats.examplesViewedChapters, 10)} of 10 chapters` };
    case "notes-ten":
      return { current: stats.notesCount, target: 10, label: `${Math.min(stats.notesCount, 10)} of 10 notes` };
    case "notes-three-books":
      return { current: stats.noteBooksCount, target: 3, label: `${Math.min(stats.noteBooksCount, 3)} of 3 books` };
    case "reflection-finish":
      return { current: stats.completedChaptersWithReflection, target: 5, label: `${Math.min(stats.completedChaptersWithReflection, 5)} of 5 chapters` };
    case "category-explorer":
      return { current: stats.exploredCategories, target: 3, label: `${Math.min(stats.exploredCategories, 3)} of 3 categories` };
    case "challenging-trial":
      return { current: stats.challengingBooksStarted, target: 1, label: `${Math.min(stats.challengingBooksStarted, 1)} of 1 book` };
    case "long-gap-return":
      return { current: stats.returnedAfterLongGap, target: 1, label: `${Math.min(stats.returnedAfterLongGap, 1)} of 1 return` };
    case "reading-list-five":
      return { current: stats.readingListCount, target: 5, label: `${Math.min(stats.readingListCount, 5)} of 5 books` };
    case "pro-activated":
      return { current: stats.proActivated ? 1 : 0, target: 1, label: `${stats.proActivated ? 1 : 0} of 1 upgrade` };
    case "pro-multi-track":
      return { current: stats.proMultiTrack ? 3 : 0, target: 3, label: stats.proMultiTrack ? "3 of 3 active books" : "0 of 3 active books" };
    default:
      return { current: 0, target: 1, label: "Not started" };
  }
}

export function evaluateBadges(
  stats: BadgeProgressStats,
  earnedHistory: Record<string, string> = {}
): BadgeState[] {
  return BADGE_DEFINITIONS.map((definition) => {
    const progress = progressForBadge(definition.id, stats);
    const achieved = progress.current >= progress.target;
    const earnedAt = earnedHistory[definition.id] ?? null;
    const earned = achieved || Boolean(earnedAt);
    const isVisible = earned || !definition.hiddenUntilDiscovered || progress.current > 0;
    return {
      ...definition,
      earned,
      earnedAt,
      progressValue: progress.current,
      targetValue: progress.target,
      progressLabel: progress.label,
      isVisible,
    };
  });
}

export function filterBadges(badges: BadgeState[], filter: BadgeFilter) {
  if (filter === "All") return badges;
  if (filter === "Earned") return badges.filter((badge) => badge.earned);
  if (filter === "Locked") return badges.filter((badge) => !badge.earned);
  if (filter === "Streak") return badges.filter((badge) => badge.category === "Consistency");
  if (filter === "Mastery") return badges.filter((badge) => badge.category === "Mastery" || badge.category === "Reading Depth");
  if (filter === "Books") return badges.filter((badge) => badge.category === "Books");
  if (filter === "Notes") return badges.filter((badge) => badge.category === "Notes");
  if (filter === "Exploration") return badges.filter((badge) => badge.category === "Exploration" || badge.category === "Examples");
  if (filter === "Premium") return badges.filter((badge) => badge.category === "Premium");
  return badges;
}
