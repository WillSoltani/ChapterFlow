import friendsAndInfluencePackageJson from "@/book-packages/friends-and-influence-student-edition.student.json";
import artOfWarPackageJson from "@/book-packages/art-of-war.modern.json";
import thePrincePackageJson from "@/book-packages/the-prince.modern.json";
import strategiesOfWarPackageJson from "@/book-packages/33-strategies-of-war.modern.json";
import influencePackageJson from "@/book-packages/influence.modern.json";
import lawsOfHumanNaturePackageJson from "@/book-packages/laws-of-human-nature.modern.json";
import preSuasionPackageJson from "@/book-packages/pre-suasion.modern.json";
import neverSplitTheDifferencePackageJson from "@/book-packages/never-split-the-difference.modern.json";
import gamesPeoplePlayPackageJson from "@/book-packages/games-people-play.modern.json";
import crucialConversationsPackageJson from "@/book-packages/crucial-conversations.modern.json";
import difficultConversationsPackageJson from "@/book-packages/difficult-conversations.modern.json";
import charismaMythPackageJson from "@/book-packages/the-charisma-myth.modern.json";
import whatEveryBodyIsSayingPackageJson from "@/book-packages/what-every-body-is-saying.modern.json";
import powerOfHabitPackageJson from "@/book-packages/the-power-of-habit.modern.json";
import tinyHabitsPackageJson from "@/book-packages/tiny-habits.modern.json";
import essentialismPackageJson from "@/book-packages/essentialism.modern.json";
import deepWorkPackageJson from "@/book-packages/deep-work.modern.json";
import drivePackageJson from "@/book-packages/drive.modern.json";
import mindsetPackageJson from "@/book-packages/mindset.modern.json";
import gritPackageJson from "@/book-packages/grit.modern.json";
import courageToBeDislikedPackageJson from "@/book-packages/the-courage-to-be-disliked.modern.json";
import attachedPackageJson from "@/book-packages/attached.modern.json";
import startWithWhyPackageJson from "@/book-packages/start-with-why.modern.json";
import sevenHabitsPackageJson from "@/book-packages/the-7-habits-of-highly-effective-people.modern.json";
import millionaireFastlanePackageJson from "@/book-packages/the-millionaire-fastlane.modern.json";
import richDadPoorDadPackageJson from "@/book-packages/rich-dad-poor-dad.modern.json";
import makeTimePackageJson from "@/book-packages/make-time.modern.json";
import psychologyOfMoneyPackageJson from "@/book-packages/the-psychology-of-money.modern.json";
import thinkingFastAndSlowPackageJson from "@/book-packages/thinking-fast-and-slow.modern.json";
import predictablyIrrationalPackageJson from "@/book-packages/predictably-irrational.modern.json";
import almanackOfNavalRavikantPackageJson from "@/book-packages/the-almanack-of-naval-ravikant.modern.json";
import extremeOwnershipPackageJson from "@/book-packages/extreme-ownership.modern.json";
import hardThingAboutHardThingsPackageJson from "@/book-packages/the-hard-thing-about-hard-things.modern.json";
import goodToGreatPackageJson from "@/book-packages/good-to-great.modern.json";
import lawsOfPowerPackageJson from "@/book-packages/the-48-laws-of-power.modern.json";
import atomicHabitsPackageJson from "@/book-packages/atomic-habits.modern.json";
import oneThingPackageJson from "@/book-packages/the-one-thing.modern.json";
import indistractablePackageJson from "@/book-packages/indistractable.modern.json";
import cantHurtMePackageJson from "@/book-packages/cant-hurt-me.modern.json";
import soGoodTheyCantIgnoreYouPackageJson from "@/book-packages/so-good-they-cant-ignore-you.modern.json";
import talkLikeTedPackageJson from "@/book-packages/talk-like-ted.modern.json";
import likeSwitchPackageJson from "@/book-packages/the-like-switch.modern.json";
import pitchAnythingPackageJson from "@/book-packages/pitch-anything.modern.json";
import howToTalkToAnyonePackageJson from "@/book-packages/how-to-talk-to-anyone.modern.json";
import righteousMindPackageJson from "@/book-packages/the-righteous-mind.modern.json";
import zeroToOnePackageJson from "@/book-packages/zero-to-one.modern.json";
import leanStartupPackageJson from "@/book-packages/the-lean-startup.modern.json";
import blueOceanStrategyPackageJson from "@/book-packages/blue-ocean-strategy.modern.json";
import goodStrategyBadStrategyPackageJson from "@/book-packages/good-strategy-bad-strategy.modern.json";
import antifragilePackageJson from "@/book-packages/antifragile.modern.json";
import masteryPackageJson from "@/book-packages/mastery.modern.json";
import obstacleIsTheWayPackageJson from "@/book-packages/the-obstacle-is-the-way.modern.json";
import disciplineIsDestinyPackageJson from "@/book-packages/discipline-is-destiny.modern.json";
import meditationsPackageJson from "@/book-packages/meditations.modern.json";
import mansSearchForMeaningPackageJson from "@/book-packages/mans-search-for-meaning.modern.json";

export type VariantFamily = "EMH" | "PBC";
export type VariantKey =
  | "easy"
  | "medium"
  | "hard"
  | "precise"
  | "balanced"
  | "challenging";

export type PackageVariantContent = {
  importantSummary?: string;
  summaryBullets?: string[];
  keyTakeaways?: string[];
  takeaways?: string[];
  practice?: string[];
};

export type PackageQuizQuestion = {
  questionId: string;
  prompt: string;
  choices: string[];
  correctIndex?: number;
  correctAnswerIndex?: number;
  explanation?: string;
};

export type PackageQuiz = {
  passingScorePercent: number;
  questions: PackageQuizQuestion[];
};

export type PackageExample = {
  exampleId: string;
  title: string;
  scenario: string;
  whatToDo: string[];
  whyItMatters: string;
  contexts?: string[];
};

export type PackageChapter = {
  chapterId: string;
  number: number;
  title: string;
  readingTimeMinutes: number;
  contentVariants: Partial<Record<VariantKey, PackageVariantContent>>;
  examples: PackageExample[];
  quiz: PackageQuiz;
};

export type PackageBook = {
  bookId: string;
  title: string;
  author: string;
  categories: string[];
  tags?: string[];
  edition?: string | { name: string; publishedYear?: number };
  variantFamily: VariantFamily;
};

export type BookPackage = {
  schemaVersion: string;
  packageId: string;
  createdAt: string;
  contentOwner: string;
  book: PackageBook;
  chapters: PackageChapter[];
};

export type BookPackagePresentation = {
  icon: string;
  coverImage: string;
  difficulty: "Easy" | "Medium" | "Hard";
  synopsis: string;
  pages?: number;
};

export const FRIENDS_AND_INFLUENCE_PACKAGE =
  friendsAndInfluencePackageJson as BookPackage;
export const ART_OF_WAR_PACKAGE = artOfWarPackageJson as BookPackage;
export const THE_PRINCE_PACKAGE = thePrincePackageJson as BookPackage;
export const STRATEGIES_OF_WAR_PACKAGE =
  strategiesOfWarPackageJson as BookPackage;
export const INFLUENCE_PACKAGE = influencePackageJson as BookPackage;
export const LAWS_OF_HUMAN_NATURE_PACKAGE =
  lawsOfHumanNaturePackageJson as BookPackage;
export const PRE_SUASION_PACKAGE = preSuasionPackageJson as BookPackage;
export const NEVER_SPLIT_THE_DIFFERENCE_PACKAGE =
  neverSplitTheDifferencePackageJson as BookPackage;
export const GAMES_PEOPLE_PLAY_PACKAGE =
  gamesPeoplePlayPackageJson as BookPackage;
export const CRUCIAL_CONVERSATIONS_PACKAGE =
  crucialConversationsPackageJson as BookPackage;
export const DIFFICULT_CONVERSATIONS_PACKAGE =
  difficultConversationsPackageJson as BookPackage;
export const CHARISMA_MYTH_PACKAGE = charismaMythPackageJson as BookPackage;
export const WHAT_EVERY_BODY_IS_SAYING_PACKAGE =
  whatEveryBodyIsSayingPackageJson as BookPackage;
export const POWER_OF_HABIT_PACKAGE = powerOfHabitPackageJson as BookPackage;
export const TINY_HABITS_PACKAGE = tinyHabitsPackageJson as BookPackage;
export const ESSENTIALISM_PACKAGE = essentialismPackageJson as BookPackage;
export const DEEP_WORK_PACKAGE = deepWorkPackageJson as BookPackage;
export const DRIVE_PACKAGE = drivePackageJson as BookPackage;
export const MINDSET_PACKAGE = mindsetPackageJson as BookPackage;
export const GRIT_PACKAGE = gritPackageJson as BookPackage;
export const COURAGE_TO_BE_DISLIKED_PACKAGE =
  courageToBeDislikedPackageJson as BookPackage;
export const ATTACHED_PACKAGE = attachedPackageJson as BookPackage;
export const START_WITH_WHY_PACKAGE =
  startWithWhyPackageJson as BookPackage;
export const SEVEN_HABITS_PACKAGE =
  sevenHabitsPackageJson as BookPackage;
export const MILLIONAIRE_FASTLANE_PACKAGE =
  millionaireFastlanePackageJson as BookPackage;
export const RICH_DAD_POOR_DAD_PACKAGE =
  richDadPoorDadPackageJson as BookPackage;
export const MAKE_TIME_PACKAGE = makeTimePackageJson as BookPackage;
export const PSYCHOLOGY_OF_MONEY_PACKAGE =
  psychologyOfMoneyPackageJson as BookPackage;
export const THINKING_FAST_AND_SLOW_PACKAGE =
  thinkingFastAndSlowPackageJson as BookPackage;
export const PREDICTABLY_IRRATIONAL_PACKAGE =
  predictablyIrrationalPackageJson as BookPackage;
export const ALMANACK_OF_NAVAL_RAVIKANT_PACKAGE =
  almanackOfNavalRavikantPackageJson as BookPackage;
export const EXTREME_OWNERSHIP_PACKAGE =
  extremeOwnershipPackageJson as BookPackage;
export const HARD_THING_ABOUT_HARD_THINGS_PACKAGE =
  hardThingAboutHardThingsPackageJson as BookPackage;
export const GOOD_TO_GREAT_PACKAGE = goodToGreatPackageJson as BookPackage;
export const LAWS_OF_POWER_PACKAGE = lawsOfPowerPackageJson as BookPackage;
export const ATOMIC_HABITS_PACKAGE = atomicHabitsPackageJson as BookPackage;
export const ONE_THING_PACKAGE = oneThingPackageJson as BookPackage;
export const INDISTRACTABLE_PACKAGE = indistractablePackageJson as BookPackage;
export const CANT_HURT_ME_PACKAGE = cantHurtMePackageJson as BookPackage;
export const SO_GOOD_THEY_CANT_IGNORE_YOU_PACKAGE =
  soGoodTheyCantIgnoreYouPackageJson as BookPackage;
export const TALK_LIKE_TED_PACKAGE = talkLikeTedPackageJson as BookPackage;
export const LIKE_SWITCH_PACKAGE = likeSwitchPackageJson as BookPackage;
export const PITCH_ANYTHING_PACKAGE = pitchAnythingPackageJson as BookPackage;
export const HOW_TO_TALK_TO_ANYONE_PACKAGE =
  howToTalkToAnyonePackageJson as BookPackage;
export const RIGHTEOUS_MIND_PACKAGE =
  righteousMindPackageJson as BookPackage;
export const ZERO_TO_ONE_PACKAGE = zeroToOnePackageJson as BookPackage;
export const LEAN_STARTUP_PACKAGE = leanStartupPackageJson as BookPackage;
export const BLUE_OCEAN_STRATEGY_PACKAGE =
  blueOceanStrategyPackageJson as BookPackage;
export const GOOD_STRATEGY_BAD_STRATEGY_PACKAGE =
  goodStrategyBadStrategyPackageJson as BookPackage;
export const ANTIFRAGILE_PACKAGE = antifragilePackageJson as BookPackage;
export const MASTERY_PACKAGE = masteryPackageJson as BookPackage;
export const OBSTACLE_IS_THE_WAY_PACKAGE =
  obstacleIsTheWayPackageJson as BookPackage;
export const DISCIPLINE_IS_DESTINY_PACKAGE =
  disciplineIsDestinyPackageJson as BookPackage;
export const MEDITATIONS_PACKAGE = meditationsPackageJson as BookPackage;
export const MANS_SEARCH_FOR_MEANING_PACKAGE =
  mansSearchForMeaningPackageJson as BookPackage;

export const BOOK_PACKAGES: BookPackage[] = [
  FRIENDS_AND_INFLUENCE_PACKAGE,
  ART_OF_WAR_PACKAGE,
  THE_PRINCE_PACKAGE,
  STRATEGIES_OF_WAR_PACKAGE,
  INFLUENCE_PACKAGE,
  LAWS_OF_HUMAN_NATURE_PACKAGE,
  PRE_SUASION_PACKAGE,
  NEVER_SPLIT_THE_DIFFERENCE_PACKAGE,
  GAMES_PEOPLE_PLAY_PACKAGE,
  CRUCIAL_CONVERSATIONS_PACKAGE,
  DIFFICULT_CONVERSATIONS_PACKAGE,
  CHARISMA_MYTH_PACKAGE,
  WHAT_EVERY_BODY_IS_SAYING_PACKAGE,
  POWER_OF_HABIT_PACKAGE,
  TINY_HABITS_PACKAGE,
  ESSENTIALISM_PACKAGE,
  DEEP_WORK_PACKAGE,
  DRIVE_PACKAGE,
  MINDSET_PACKAGE,
  GRIT_PACKAGE,
  COURAGE_TO_BE_DISLIKED_PACKAGE,
  ATTACHED_PACKAGE,
  START_WITH_WHY_PACKAGE,
  SEVEN_HABITS_PACKAGE,
  MILLIONAIRE_FASTLANE_PACKAGE,
  RICH_DAD_POOR_DAD_PACKAGE,
  MAKE_TIME_PACKAGE,
  PSYCHOLOGY_OF_MONEY_PACKAGE,
  THINKING_FAST_AND_SLOW_PACKAGE,
  PREDICTABLY_IRRATIONAL_PACKAGE,
  ALMANACK_OF_NAVAL_RAVIKANT_PACKAGE,
  EXTREME_OWNERSHIP_PACKAGE,
  HARD_THING_ABOUT_HARD_THINGS_PACKAGE,
  GOOD_TO_GREAT_PACKAGE,
  LAWS_OF_POWER_PACKAGE,
  ATOMIC_HABITS_PACKAGE,
  ONE_THING_PACKAGE,
  INDISTRACTABLE_PACKAGE,
  CANT_HURT_ME_PACKAGE,
  SO_GOOD_THEY_CANT_IGNORE_YOU_PACKAGE,
  TALK_LIKE_TED_PACKAGE,
  LIKE_SWITCH_PACKAGE,
  PITCH_ANYTHING_PACKAGE,
  HOW_TO_TALK_TO_ANYONE_PACKAGE,
  RIGHTEOUS_MIND_PACKAGE,
  ZERO_TO_ONE_PACKAGE,
  LEAN_STARTUP_PACKAGE,
  BLUE_OCEAN_STRATEGY_PACKAGE,
  GOOD_STRATEGY_BAD_STRATEGY_PACKAGE,
  ANTIFRAGILE_PACKAGE,
  MASTERY_PACKAGE,
  OBSTACLE_IS_THE_WAY_PACKAGE,
  DISCIPLINE_IS_DESTINY_PACKAGE,
  MEDITATIONS_PACKAGE,
  MANS_SEARCH_FOR_MEANING_PACKAGE,
];

export const BOOK_PACKAGE_PRESENTATION: Record<string, BookPackagePresentation> = {
  "friends-and-influence-student-edition": {
    icon: "🤝",
    coverImage: "/book-covers/friends-and-influence-student-edition.svg",
    difficulty: "Medium",
    synopsis:
      "A classic communication guide focused on first impressions, attentive listening, better questions, respectful disagreement, and the habits that make relationships stronger over time.",
    pages: 304,
  },
  "art-of-war": {
    icon: "🐉",
    coverImage: "/book-covers/art-of-war.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of strategy, incentives, leadership, legitimacy, coalition management, and ethical tradeoffs for students and early career builders.",
    pages: 288,
  },
  "the-prince": {
    icon: "👑",
    coverImage: "/book-covers/the-prince.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of leadership, legitimacy, incentives, reputation, and ethical tradeoffs in governance for students and early career builders.",
    pages: 272,
  },
  "33-strategies-of-war": {
    icon: "🛡️",
    coverImage: "/book-covers/33-strategies-of-war.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of conflict, leverage, reputation, timing, coalition building, and strategic discipline for students and early career builders.",
    pages: 336,
  },
  influence: {
    icon: "🧠",
    coverImage: "/book-covers/influence.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of persuasion, reciprocity, consistency, social proof, authority, scarcity, and ethical influence for students and early career builders.",
    pages: 336,
  },
  "laws-of-human-nature": {
    icon: "🫀",
    coverImage: "/book-covers/laws-of-human-nature.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of self awareness, group dynamics, hidden motives, insecurity, ambition, and leadership for students and early career builders.",
    pages: 624,
  },
  "pre-suasion": {
    icon: "🎯",
    coverImage: "/book-covers/pre-suasion.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of attention, framing, timing, readiness, unity, and ethical persuasion for students and early career builders.",
    pages: 432,
  },
  "never-split-the-difference": {
    icon: "🗣️",
    coverImage: "/book-covers/never-split-the-difference.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of negotiation, tactical empathy, calibrated questions, commitment, and leverage for students and early career builders.",
    pages: 320,
  },
  "games-people-play": {
    icon: "♟️",
    coverImage: "/book-covers/games-people-play.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of transactional analysis, repeated social scripts, hidden payoffs, and autonomy for students and early career builders.",
    pages: 272,
  },
  "crucial-conversations": {
    icon: "💬",
    coverImage: "/book-covers/crucial-conversations.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of dialogue, shared meaning, safety, accountability, and high stakes communication for students and early career builders.",
    pages: 336,
  },
  "difficult-conversations": {
    icon: "🧩",
    coverImage: "/book-covers/difficult-conversations.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of hard conversations, contribution, feelings, identity, and learning under pressure for students and early career builders.",
    pages: 400,
  },
  "the-charisma-myth": {
    icon: "✨",
    coverImage: "/book-covers/the-charisma-myth.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of presence, power, warmth, composure, social perception, and ethical influence for students and early career builders.",
    pages: 320,
  },
  "what-every-body-is-saying": {
    icon: "👁️",
    coverImage: "/book-covers/what-every-body-is-saying.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of body language, nonverbal signals, observation, baseline, context, and ethical interpretation for students and early career builders.",
    pages: 304,
  },
  "the-power-of-habit": {
    icon: "🔁",
    coverImage: "/book-covers/the-power-of-habit.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of cue, routine, reward, craving, willpower, keystone habits, and behavioral design for students and early career builders.",
    pages: 384,
  },
  "tiny-habits": {
    icon: "🌱",
    coverImage: "/book-covers/tiny-habits.svg",
    difficulty: "Easy",
    synopsis:
      "A modern reading of behavior design, prompts, tiny actions, celebration, scaling, and compassionate habit change for students and early career builders.",
    pages: 320,
  },
  essentialism: {
    icon: "🎯",
    coverImage: "/book-covers/essentialism.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of focus, priorities, tradeoffs, boundaries, editing, and disciplined selection for students and early career builders.",
    pages: 272,
  },
  "deep-work": {
    icon: "🌊",
    coverImage: "/book-covers/deep-work.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of concentration, cognitive depth, digital discipline, shallow work reduction, and focused value creation for students and early career builders.",
    pages: 304,
  },
  drive: {
    icon: "⚙️",
    coverImage: "/book-covers/drive.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of motivation, autonomy, mastery, purpose, and how incentives shape performance for students and early career builders.",
    pages: 256,
  },
  mindset: {
    icon: "🌱",
    coverImage: "/book-covers/mindset.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of fixed and growth mindsets, learning, effort, feedback, resilience, and the beliefs that shape development across school, work, and relationships.",
    pages: 320,
  },
  grit: {
    icon: "🏔️",
    coverImage: "/book-covers/grit.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of perseverance, passion, deliberate practice, purpose, hope, and the long term habits that make difficult goals achievable.",
    pages: 352,
  },
  "the-courage-to-be-disliked": {
    icon: "🕊️",
    coverImage: "/book-covers/the-courage-to-be-disliked.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of Adlerian psychology, freedom, boundaries, contribution, courage, and the social choices that shape a meaningful life.",
    pages: 288,
  },
  attached: {
    icon: "🧷",
    coverImage: "/book-covers/attached.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of attachment styles, dating patterns, secure communication, conflict, and the relational habits that make love steadier and healthier.",
    pages: 304,
  },
  "start-with-why": {
    icon: "🎯",
    coverImage: "/book-covers/start-with-why.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of purpose, trust, leadership, strategy, communication, and how clear belief creates stronger alignment and followership.",
    pages: 256,
  },
  "the-7-habits-of-highly-effective-people": {
    icon: "🧭",
    coverImage: "/book-covers/the-7-habits-of-highly-effective-people.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of principles, priorities, trust, proactivity, interdependence, and the habits that turn character into lasting effectiveness.",
    pages: 432,
  },
  "the-millionaire-fastlane": {
    icon: "🏎️",
    coverImage: "/book-covers/the-millionaire-fastlane.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of leverage, control, value creation, entrepreneurship, and the systems that can accelerate financial freedom faster than conventional scripts.",
    pages: 352,
  },
  "rich-dad-poor-dad": {
    icon: "💼",
    coverImage: "/book-covers/rich-dad-poor-dad.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of financial literacy, assets, cash flow, ownership, money habits, and the mindset shifts that can improve long term financial freedom.",
    pages: 336,
  },
  "make-time": {
    icon: "⏳",
    coverImage: "/book-covers/make-time.svg",
    difficulty: "Easy",
    synopsis:
      "A modern reading of daily highlights, distraction defense, energy design, reflection, and practical attention management for students and early career builders.",
    pages: 304,
  },
  "the-psychology-of-money": {
    icon: "💸",
    coverImage: "/book-covers/the-psychology-of-money.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of money behavior, risk, patience, enough, visible status, and financial resilience for students and early career builders.",
    pages: 256,
  },
  "thinking-fast-and-slow": {
    icon: "🧠",
    coverImage: "/book-covers/thinking-fast-and-slow.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of judgment, bias, intuition, framing, risk, prediction, and the limits of confidence for students and early career builders.",
    pages: 512,
  },
  "predictably-irrational": {
    icon: "🎲",
    coverImage: "/book-covers/predictably-irrational.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of behavioral economics, anchoring, pricing, self control, honesty, social norms, and choice design for students and early career builders.",
    pages: 384,
  },
  "the-almanack-of-naval-ravikant": {
    icon: "📘",
    coverImage: "/book-covers/the-almanack-of-naval-ravikant.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of wealth, leverage, judgment, happiness, freedom, and practical philosophy for students and early career builders.",
    pages: 242,
  },
  "extreme-ownership": {
    icon: "🪖",
    coverImage: "/book-covers/extreme-ownership.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of accountability, leadership, team clarity, execution, discipline, and calm decision making under pressure for students and early career builders.",
    pages: 320,
  },
  "the-hard-thing-about-hard-things": {
    icon: "🧱",
    coverImage: "/book-covers/the-hard-thing-about-hard-things.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of startup leadership, crisis management, truth telling, painful decisions, and management under pressure for students and early career builders.",
    pages: 304,
  },
  "good-to-great": {
    icon: "📈",
    coverImage: "/book-covers/good-to-great.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of disciplined leadership, people choices, brutal facts, strategic focus, and momentum building for students and early career builders.",
    pages: 320,
  },
  "the-48-laws-of-power": {
    icon: "♜",
    coverImage: "/book-covers/the-48-laws-of-power.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of power, timing, reputation, influence, and strategic awareness for students and early career builders.",
    pages: 480,
  },
  "atomic-habits": {
    icon: "⚛️",
    coverImage: "/book-covers/atomic-habits.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of habit loops, identity based change, environment design, and compounding improvement for students and early career builders.",
    pages: 320,
  },
  "the-one-thing": {
    icon: "🎯",
    coverImage: "/book-covers/the-one-thing.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of focus, leverage, time blocking, tradeoffs, and extraordinary results through strategic simplicity for students and early career builders.",
    pages: 240,
  },
  indistractable: {
    icon: "🧭",
    coverImage: "/book-covers/indistractable.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of attention control, distraction design, timeboxing, precommitment, and value aligned focus for students and early career builders.",
    pages: 304,
  },
  "cant-hurt-me": {
    icon: "💪",
    coverImage: "/book-covers/cant-hurt-me.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of self discipline, accountability, resilience, pain tolerance, and deliberate mental toughness for students and early career builders.",
    pages: 364,
  },
  "so-good-they-cant-ignore-you": {
    icon: "🛠️",
    coverImage: "/book-covers/so-good-they-cant-ignore-you.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of career capital, craftsmanship, autonomy, mission, and skill first career strategy for students and early career builders.",
    pages: 288,
  },
  "talk-like-ted": {
    icon: "🎤",
    coverImage: "/book-covers/talk-like-ted.svg",
    difficulty: "Easy",
    synopsis:
      "A modern reading of storytelling, memorable speaking, audience attention, and authentic presentation design for students and early career builders.",
    pages: 288,
  },
  "the-like-switch": {
    icon: "🤝",
    coverImage: "/book-covers/the-like-switch.svg",
    difficulty: "Easy",
    synopsis:
      "A modern reading of rapport, likability, social signals, trust building, and conversational skill for students and early career builders.",
    pages: 288,
  },
  "pitch-anything": {
    icon: "📣",
    coverImage: "/book-covers/pitch-anything.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of frame control, status, persuasion structure, and high stakes pitching for students and early career builders.",
    pages: 240,
  },
  "how-to-talk-to-anyone": {
    icon: "🗨️",
    coverImage: "/book-covers/how-to-talk-to-anyone.svg",
    difficulty: "Easy",
    synopsis:
      "A modern reading of first impressions, rapport, conversational ease, networking, and relationship building for students and early career builders.",
    pages: 368,
  },
  "the-righteous-mind": {
    icon: "⚖️",
    coverImage: "/book-covers/the-righteous-mind.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of moral psychology, intuition, reasoning, polarization, group identity, and ethical disagreement for students and early career builders.",
    pages: 528,
  },
  "zero-to-one": {
    icon: "🚀",
    coverImage: "/book-covers/zero-to-one.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of startup strategy, innovation, monopoly, distribution, contrarian thinking, and durable value creation for students and early career builders.",
    pages: 224,
  },
  "the-lean-startup": {
    icon: "🧪",
    coverImage: "/book-covers/the-lean-startup.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of startup experiments, validated learning, pivots, metrics, feedback loops, and innovation management for students and early career builders.",
    pages: 336,
  },
  "blue-ocean-strategy": {
    icon: "🌊",
    coverImage: "/book-covers/blue-ocean-strategy.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of market creation, strategy canvas thinking, differentiation, noncustomers, sequencing, and execution alignment for students and early career builders.",
    pages: 320,
  },
  "good-strategy-bad-strategy": {
    icon: "♞",
    coverImage: "/book-covers/good-strategy-bad-strategy.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of diagnosis, leverage, coherent action, strategic focus, and the difference between real strategy and empty ambition for students and early career builders.",
    pages: 336,
  },
  antifragile: {
    icon: "🦂",
    coverImage: "/book-covers/antifragile.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of fragility, optionality, nonlinear risk, skin in the game, and how systems can gain from stress and variability.",
    pages: 544,
  },
  mastery: {
    icon: "🎻",
    coverImage: "/book-covers/mastery.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of apprenticeship, deliberate practice, mentorship, social intelligence, creativity, and the long path to deep skill.",
    pages: 352,
  },
  "the-obstacle-is-the-way": {
    icon: "🪨",
    coverImage: "/book-covers/the-obstacle-is-the-way.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of stoic resilience, disciplined perception, purposeful action, and steady will under pressure for students and early career builders.",
    pages: 224,
  },
  "discipline-is-destiny": {
    icon: "🛡️",
    coverImage: "/book-covers/discipline-is-destiny.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of self control, temperance, routines, boundaries, endurance, and character shaped through disciplined daily practice.",
    pages: 352,
  },
  meditations: {
    icon: "🏛️",
    coverImage: "/book-covers/meditations.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of stoic self command, mortality, duty, perspective, and ethical conduct under pressure.",
    pages: 304,
  },
  "mans-search-for-meaning": {
    icon: "🕯️",
    coverImage: "/book-covers/mans-search-for-meaning.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of suffering, responsibility, purpose, logotherapy, and the search for meaning under constraint.",
    pages: 200,
  },
};

export function getBookPackageById(bookId: string): BookPackage | undefined {
  return BOOK_PACKAGES.find((pkg) => pkg.book.bookId === bookId);
}

export function getBookPackagePresentation(bookId: string): BookPackagePresentation {
  return (
    BOOK_PACKAGE_PRESENTATION[bookId] ?? {
      icon: "📘",
      coverImage: `/book-covers/${bookId}.svg`,
      difficulty: "Medium",
      synopsis:
        "A focused, chapter-based learning experience with examples, quizzes, and measurable progress.",
    }
  );
}
