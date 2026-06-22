/**
 * Single source of truth for the landing-page reader demo content.
 *
 * This file holds curated demo content for "Atomic Habits · Chapter 1"
 * shaped to match the in-app reader's data types so we can feed the real
 * SummaryCard / ExamplesList / PracticePhase components from the app/book
 * reader directly. This is what makes the landing demo look identical to
 * the actual product.
 *
 * All content here is derived from the repo's own authored book package
 * (book-packages/atomic-habits.v21.json, contentOwner "chapterflow"),
 * chapter 1 ("The Surprising Power of Atomic Habits").
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
} from "@/app/book/data/bookChapters";

export const DEMO_CHAPTER_ID = "demo-atomic-habits-ch1";
export const DEMO_BOOK_ID = "atomic-habits";
export const DEMO_BOOK_TITLE = "Atomic Habits";
export const DEMO_BOOK_AUTHOR = "James Clear";
export const DEMO_CHAPTER_NUMBER = 1;
export const DEMO_CHAPTER_TITLE = "The Surprising Power of Atomic Habits";

/* ------------------------------------------------------------------ */
/*  Summary blocks (paragraphs + bullets) by depth                    */
/* ------------------------------------------------------------------ */

const summarySimple: ChapterSummaryBlock[] = [
  {
    id: "p1-simple",
    type: "paragraph",
    text: "An ice cube sits in a cold room. You raise the temperature one degree at a time. Twenty-six. Twenty-seven. Twenty-eight. Nothing. Then thirty-two, and the cube melts. Which degree did the work? All of them.",
  },
  {
    id: "p2-simple",
    type: "paragraph",
    text: "Your habits run on the same physics. The change is banked long before it shows. Most people quit on the day the graph still looks flat, three weeks before it would have bent.",
  },
  {
    id: "b1-simple",
    type: "bullet",
    text: "Useful change is banked long before it shows up on the scoreboard.",
  },
  {
    id: "b2-simple",
    type: "bullet",
    text: "Most people quit on the flat day, just before the line was about to bend.",
  },
  {
    id: "b3-simple",
    type: "bullet",
    text: "You did not lose because the work failed. You stopped reading the scoreboard before the score updated.",
  },
];

const summaryStandard: ChapterSummaryBlock[] = [
  {
    id: "p1-standard",
    type: "paragraph",
    text: "A second-violin section has not improved at concerts in eight weeks. Their teacher is privately drafting a reseating chart. Then she opens her notebook. The intonation drills are logged. The scale tempos have crept up a metronome click each week. Something is moving. It just is not moving where the audience can hear it yet.",
  },
  {
    id: "p2-standard",
    type: "paragraph",
    text: "This is what compounding looks like from the inside. The work goes into the foundation first. The visible part comes later, often all at once. Measure only the surface, and you will pull the plug two weeks before payout.",
  },
  {
    id: "p3-standard",
    type: "paragraph",
    text: "Useful change does not arrive on a slope. It arrives on a step. You add small inputs day after day, and nothing visible moves. Then a threshold breaks and the line jumps. The jump looks like a breakthrough. It is the inputs cashing in.",
  },
  {
    id: "b1-standard",
    type: "bullet",
    text: "Compounding works from the inside out: the work goes into the foundation first, and the visible result shows up later, often all at once.",
    detail:
      "Picture a line cook on a Saturday rush who saves fifteen seconds per plate. On any single ticket, fifteen seconds is nothing. Across forty plates a night, five nights a week, it is an hour he has quietly bought back. He did not get faster. His station did.",
  },
  {
    id: "b2-standard",
    type: "bullet",
    text: "Change arrives on a step, not a slope. Inputs go in evenly, then a threshold breaks and the line jumps all at once.",
    detail:
      "Add small inputs day after day and nothing visible moves. Then a threshold breaks and the line jumps. The jump looks like a breakthrough, but it is just the inputs you already made finally cashing in.",
  },
  {
    id: "b3-standard",
    type: "bullet",
    text: "You act on what you put in, not on what the graph shows. Hold the protocol on the flat days.",
    detail:
      "The graph catches up to work you have already done. If you only judge the work by the surface metric on a flat day, you will quit right before the surface starts to move.",
  },
  {
    id: "b4-standard",
    type: "bullet",
    text: "The flat stretch is a measurement problem, not a progress problem. Trust the inputs you have logged.",
    detail:
      "Skill change shows up in the practice ledger before it shows up in the concert hall. The notebook of logged drills and creeping tempos is the real evidence, weeks before the audience can hear it.",
  },
];

const summaryDeeper: ChapterSummaryBlock[] = [
  {
    id: "p1-deeper",
    type: "paragraph",
    text: "The ambush goes like this. You have been at something for six weeks. The number on the scale, the balance on the card, the metric you check on Sunday, will not move. You did the work. The work did not show up. So you start asking the dangerous question: maybe this is not for me.",
  },
  {
    id: "p2-deeper",
    type: "paragraph",
    text: "Compounding works against your patience. Inputs go in evenly. Outputs come out in steps. The surface holds still for weeks at a time, and the brain reads still as nothing. It is not nothing. It is everything, stored somewhere you cannot see yet.",
  },
  {
    id: "p3-deeper",
    type: "paragraph",
    text: "Here is the edge worth naming. Treating invisible progress as banked is not the same as trusting any flat stretch. Some flat stretches are flat because the inputs are wrong. So make the inputs themselves auditable. If the small thing happened and the result has not moved, you are in the valley. If the small thing did not happen, you already know why.",
  },
  {
    id: "b1-deeper",
    type: "bullet",
    text: "The plateau is an ambush. After weeks of real work with no visible result, the brain starts asking whether the effort is for you at all.",
    detail:
      "A couple six months into paying down twenty-eight thousand dollars of credit card debt have not missed an autopay, and the balance has barely budged. The instinct is to cash out a small index fund just to feel a win. But the amortization schedule shows the principal line steepening in month fourteen. They are sitting in month six. Eight more months of patience is the difference between a paid card and another decade of minimums.",
  },
  {
    id: "b2-deeper",
    type: "bullet",
    text: "Inputs go in evenly, but outputs come out in steps. The surface holds still for weeks, and the brain misreads still as nothing.",
    detail:
      "It is not nothing. It is everything, stored somewhere you cannot see yet. The phase change hides everything until the threshold breaks, so judging the work by the result on a flat day quits you out one hour before the puddle.",
  },
  {
    id: "b3-deeper",
    type: "bullet",
    text: "Outcomes are lagging measures. The number you check is downstream of mechanics that have already shifted.",
    detail:
      "A stroke patient in week eleven of grip-strength work is ready to walk away because the dynamometer reading has not changed. But the therapist's notes show range of motion creeping up about two degrees a week. The squeeze number is the last thing to move, not the only thing that matters. Strength is a downstream measure of mechanics that already changed.",
  },
  {
    id: "b4-deeper",
    type: "bullet",
    text: "Trusting banked progress is not the same as trusting any flat stretch. Make the inputs themselves auditable.",
    detail:
      "Some flat stretches are flat because the inputs are wrong. So ask what you actually did this week. Did the small thing happen? If the small thing happened and the result has not moved, you are in the valley. If the small thing did not happen, you already know why.",
  },
  {
    id: "b5-deeper",
    type: "bullet",
    text: "Keep two ledgers: one for results you check rarely and judge slowly, one for actions you check daily and judge honestly.",
    detail:
      "The action ledger is where you decide whether to keep going. The result ledger is where the world tells you, eventually, what you already knew. You do not quit on the bad days. You quit one week before the bend, and you never find out it was there.",
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
    "Think of a habit you tracked that hit a plateau and you quit. Hold it in mind as you read.",
  standard:
    "Think of an effort that felt stalled (a fitness routine, a savings plan, a skill you were building). As you read, look for the moment you judged the work by a flat surface number instead of the inputs you had logged.",
  deeper:
    "Identify a high-stakes effort you abandoned at the plateau. What was the headline number you were watching? Were there leading indicators (reps, tempo, smaller habits) that had already moved? How close were you to the bend when you quit?",
};

/* ------------------------------------------------------------------ */
/*  Self-check prompts by depth                                        */
/* ------------------------------------------------------------------ */

export const DEMO_SELF_CHECK_PROMPTS_BY_DEPTH: Partial<
  Record<ReadingDepth, string[]>
> = {
  standard: [
    "In your own words, why does Clear say change arrives on a step instead of a slope?",
    "What is the difference between a leading indicator and a lagging outcome? Give an example from your life.",
  ],
  deeper: [
    "How would you explain 'you do not rise to your goals, you fall to your systems' to someone who has never read the book?",
    "Why does the brain misread a flat stretch as no progress, even when real work is going in every day?",
    "What is the difference between trusting banked progress and stubbornly trusting any flat stretch? How would you tell the two apart?",
  ],
};

/* ------------------------------------------------------------------ */
/*  Key Quote                                                          */
/* ------------------------------------------------------------------ */

export const DEMO_KEY_QUOTE =
  "You do not quit on the bad days. You quit one week before the bend, and you never find out it was there.";

/* ------------------------------------------------------------------ */
/*  1-Minute Recap by depth                                            */
/* ------------------------------------------------------------------ */

export const DEMO_RECAP_BY_DEPTH: Record<ReadingDepth, string[]> = {
  simple: [
    "Useful change is banked long before it shows on the scoreboard.",
    "Most people quit on the flat day, just before the line bends.",
    "You did not lose because the work failed. You stopped reading the scoreboard before the score updated.",
  ],
  standard: [
    "Compounding works from the inside out: the foundation gets built first, and the visible result arrives later, often all at once.",
    "Change arrives on a step, not a slope. Inputs go in evenly, then a threshold breaks and the line jumps.",
    "You act on what you put in, not on what the graph shows. Hold the protocol on the flat days.",
    "Skill change lands in the practice ledger before the concert hall. Trust the inputs you have logged.",
  ],
  deeper: [
    "The plateau is an ambush. After weeks of real work with no visible result, the brain starts asking whether the effort is for you.",
    "Inputs go in evenly but outputs come out in steps. The surface holds still while the work is stored somewhere you cannot see yet.",
    "Outcomes are lagging measures. The number you check is downstream of mechanics that have already shifted.",
    "Trusting banked progress is not the same as trusting any flat stretch. Make the inputs auditable: did the small thing actually happen?",
    "Keep two ledgers. The action ledger (checked daily, judged honestly) is where you decide to keep going. The result ledger only confirms it later.",
  ],
};

/* ------------------------------------------------------------------ */
/*  Examples (scenarios) used for both phone + desktop                */
/* ------------------------------------------------------------------ */

export const DEMO_EXAMPLES: ChapterExample[] = [
  {
    id: "ex-work-1",
    title: "The sales rep a manager almost cut at week eight",
    scope: "work",
    scenario:
      "A junior rep makes eighty cold calls a day for two months and books only three meetings. Her manager has a performance improvement plan half written. The top-line number (meetings booked) has been flat for eight weeks, and the instinct is to cut and move on.",
    whatToDo:
      "Before signing, open the call-quality notes. The discovery questions are sharper, objections are handled cleaner, voicemails are starting to get callbacks. Treat those leading indicators as banked progress, not noise, and hold the protocol while the lagging metric is still flat. The meetings-booked curve bends upward in week ten.",
    whyItMatters:
      "Pipeline outcomes lag behind skill acquisition by weeks. Cutting on the lagging number alone destroys the very habit that was about to produce the result you were measuring for. You do not rise to your goal, you fall to your system, and her system had already turned.",
    reflectionPrompt:
      "Before reading the analysis: what is one leading indicator you would write down before deciding to cut this rep? Name it exactly.",
  },
  {
    id: "ex-personal-1",
    title: "The couple staring at a debt balance that will not move",
    scope: "personal",
    scenario:
      "Ines and Davit are six months into paying down twenty-eight thousand dollars of credit card debt. They have thrown nine thousand at it and the balance still reads twenty-two. It feels like nothing. One of them is hovering over the Sell button on a small index fund, just to feel a win.",
    whatToDo:
      "Pull up the amortization curve and find the month where the principal line steepens. Here it bends in month fourteen. They are standing on the flat part. Keep the autopay running through the flat months instead of cashing out for a feeling of progress, and set a calendar reminder for the date the curve bends.",
    whyItMatters:
      "Compound paydown front-loads interest, so the early months look flat by arithmetic, not by failure. The balance is a lagging measure of a system that is already working. Selling the fund to feel motion would burn the asset that makes the curve bend later.",
    reflectionPrompt:
      "Think of a goal where the headline number feels stuck. What is the underlying input that is actually compounding while the surface holds still?",
  },
  {
    id: "ex-school-1",
    title: "The orchestra teacher with a reseating roster ready to go",
    scope: "school",
    scenario:
      "Brisa's second-violin section has not sounded better at concerts in eight weeks. She has a roster ready to reseat the whole section by morning. The fall concert sounded just like the one before it, and the visible result has not moved.",
    whatToDo:
      "Open the notebook first. Eight weeks of tally marks: intonation drills logged each Monday, scale tempos crept up one click at a time from sixty-eight to seventy-six, bow-distribution notes on every player. Keep the rehearsal protocol running through the spring concert and count those logged reps as progress already made, not progress still owed.",
    whyItMatters:
      "Skill change shows up in the practice ledger before it shows up in the concert hall. Pulling the protocol three weeks early discards gains that exist but have not yet surfaced as sound. The outcome is a lagging measure of the system, and the system was working.",
    reflectionPrompt:
      "What is the difference between asking 'has the result moved' and 'did the small thing happen this week'? Why does the second question keep you from quitting too early?",
  },
];

/* ------------------------------------------------------------------ */
/*  Quiz questions by depth                                            */
/* ------------------------------------------------------------------ */

const quizStandard: ChapterQuizQuestion[] = [
  {
    id: "q1",
    prompt:
      "After ten weeks of marathon training, your weekly long-run pace has not changed. Your training log shows resting heart rate down four beats and recovery time after intervals shortened by two minutes. Which best describes your current state?",
    options: [
      "The pace number is the only honest measure, and it says you have stalled.",
      "The unchanged pace is a lagging readout while the underlying fitness has already begun to shift.",
      "Your body has adapted to the program and you should switch routines to keep progressing.",
    ],
    correctIndex: 1,
    explanation:
      "Resting heart rate and shorter recovery times are the underlying gains that build before pace responds. Treating pace as the only signal misreads banked progress as no progress, and switching routines abandons the work just before it would show.",
  },
  {
    id: "q2",
    prompt:
      "You have used a Spanish flashcard app twenty minutes a day for seven weeks. Your placement quiz score has not moved from A2. You notice you now follow podcast openers without translating in your head. What is the soundest move?",
    options: [
      "Drop the flashcards for a more advanced course since A2 is clearly your ceiling.",
      "Add an extra hour each weekend to force the quiz number up.",
      "Keep the daily twenty minutes and trust the comprehension shift to surface in the quiz over the next month.",
    ],
    correctIndex: 2,
    explanation:
      "Effortless podcast comprehension is the kind of below-the-surface gain that precedes a placement jump. Quitting forfeits banked work, and doubling volume in panic ignores the signal that the protocol is already doing its job.",
  },
  {
    id: "q3",
    prompt:
      "You are a founder five months in. MRR has crawled from 4k to 5k while signups have tripled and churn has dropped from 9% to 3%. Your co-founder wants to overhaul pricing this week to 'finally see growth.' What is the soundest response?",
    options: [
      "Hold the pricing for another two months, since the inputs that drive MRR have already turned.",
      "Pivot pricing now, since five months without a real revenue jump means the model is broken.",
      "Cut marketing spend until MRR responds, then resume.",
    ],
    correctIndex: 0,
    explanation:
      "Tripled signups and a churn drop from 9% to 3% are the upstream gains that produce MRR steepening. Pivoting discards the curve right before it bends, and starving marketing kills the pipeline already feeding the trend.",
  },
];

const quizSimple: ChapterQuizQuestion[] = quizStandard.slice(0, 2);
const quizDeeper: ChapterQuizQuestion[] = [
  ...quizStandard,
  {
    id: "q4",
    prompt:
      "Two friends each invest $400 a month. After four years one has about $19,000 and grumbles that 'compounding is a myth, my returns are barely above what I put in.' Which judgment of his situation is soundest?",
    options: [
      "His result tracks the early years of a compounding curve, where contributions dominate returns, and quitting now forfeits the steepening still ahead.",
      "Four years of modest returns proves that index investing does not work for ordinary savers.",
      "He should switch to higher-risk assets now to generate the returns compounding promised.",
    ],
    correctIndex: 0,
    explanation:
      "Early years of a compounding curve look nearly linear because principal dwarfs gains. Calling it a failed strategy quits at the flat part of the curve, and chasing risk to force the slope abandons the math that would otherwise deliver it.",
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
  "Stop judging the work by a flat surface number. Read the inputs you have banked, hold the protocol through the plateau, and let the graph catch up to work you have already done.";

export const DEMO_IMPLEMENTATION_PLAN: ImplementationPlanItem = {
  coreSkill:
    "The skill is reading flat results as banked progress instead of missing progress. You stop using the headline number as your only signal and start trusting the leading indicators you have logged, so you can hold a protocol steady through the weeks when nothing visible is happening.",
  ifThenPlans: [
    {
      context: "work",
      plan: "If I am about to cut a project or person whose top-line metric has not moved in eight weeks, then before I decide I will write down three leading indicators that have moved and ask whether I am quitting in week ten of a fourteen-week curve.",
    },
    {
      context: "personal",
      plan: "If I feel the urge to break a savings or debt plan because the balance looks stuck, then I will open the schedule, find the month where the curve steepens, and set a calendar reminder for that date instead of acting today.",
    },
    {
      context: "school",
      plan: "If a practice or training number has been flat for three sessions, then I will pull up my own logs from six weeks ago and compare the secondary measures (range, tempo, reps) before I change anything.",
    },
  ],
  twentyFourHourChallenge:
    "In the next 24 hours, pick one effort that feels stalled and spend ten minutes building a one-page log of what you have actually banked: dates, reps, small numbers that crept. Pin it somewhere you open daily.",
  weeklyPractice:
    "Once a week, on the same day, do a fifteen-minute banked-progress review for your two most important efforts. Write the headline number, list three leading indicators underneath it, and decide for each whether you are holding the protocol another week or changing one variable. Keep the reviews in one running document so you can see the curve bend when it bends.",
};

export const DEMO_PREDICTION_PROMPT_BY_DEPTH: Partial<Record<ReadingDepth, string>> = {
  standard:
    "Chapter 2 turns from why tiny habits compound to how identity drives them. Based on what you just read, what do you think Clear will argue matters more: changing your outcomes, or changing who you believe you are?",
  deeper:
    "If outcomes are lagging measures of your systems, what do you predict the next chapter identifies as the deepest layer underneath systems and habits, and how would that reframe what a single 1% action is really a vote for?",
};
