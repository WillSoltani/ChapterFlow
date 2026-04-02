// Implements P3 Task 31 — A/B test readiness.
// Runtime-configurable IP values that can be overridden via environment variables
// without code deployment. Falls back to the spec values from flow-points-economy.ts.
//
// Usage: Import getIPConfig() instead of using CHAPTER_FP / LOOP_COMPLETE_IP directly.
// Override any value by setting the environment variable:
//   IP_QUIZ_PASS_STANDARD_FIRST=70  → quiz pass standard first attempt = 70 IP
//
// This layer sits on top of the static constants and allows gradual tuning.

import {
  CHAPTER_FP,
  LOOP_COMPLETE_IP,
  INSIGHT_POINTS_AMOUNTS,
} from "@/app/book/_lib/flow-points-economy";
import { STREAK_MILESTONES } from "@/app/app/api/book/_lib/streak-repo";

// ── Types ───────────────────────────────────────────────────────────────────

export type IPConfig = {
  quiz: {
    guided: { firstAttempt: number; retry: number; perfectBonus: number };
    standard: { firstAttempt: number; retry: number; perfectBonus: number };
    challenge: { firstAttempt: number; retry: number; perfectBonus: number };
  };
  loop: {
    guided: { firstAttempt: number; retry: number };
    standard: { firstAttempt: number; retry: number };
    challenge: { firstAttempt: number; retry: number };
  };
  streakDayBonus: number;
  welcomeBack: number;
  bookComplete: number;
  onboardingComplete: number;
  firstBookStarted: number;
  scenarioApproved: number;
  streakShieldCost: number;
  giftAFriendCost: number;
  insightSparkProbability: number;
};

// ── Runtime config reader ───────────────────────────────────────────────────

function envNum(key: string, fallback: number): number {
  if (typeof process === "undefined") return fallback;
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Get the current IP configuration, with environment variable overrides.
 * All values fall back to the spec defaults.
 *
 * Call this in server-side code at the point of use, not at module load time,
 * so environment variable changes take effect without restart.
 */
export function getIPConfig(): IPConfig {
  return {
    quiz: {
      guided: {
        firstAttempt: envNum("IP_QUIZ_PASS_GUIDED_FIRST", CHAPTER_FP.quizPassFirstAttempt.guided),
        retry: envNum("IP_QUIZ_PASS_GUIDED_RETRY", CHAPTER_FP.quizPassRetry.guided),
        perfectBonus: envNum("IP_QUIZ_PERFECT_GUIDED", CHAPTER_FP.quizPerfectScore.guided),
      },
      standard: {
        firstAttempt: envNum("IP_QUIZ_PASS_STANDARD_FIRST", CHAPTER_FP.quizPassFirstAttempt.standard),
        retry: envNum("IP_QUIZ_PASS_STANDARD_RETRY", CHAPTER_FP.quizPassRetry.standard),
        perfectBonus: envNum("IP_QUIZ_PERFECT_STANDARD", CHAPTER_FP.quizPerfectScore.standard),
      },
      challenge: {
        firstAttempt: envNum("IP_QUIZ_PASS_CHALLENGE_FIRST", CHAPTER_FP.quizPassFirstAttempt.challenge),
        retry: envNum("IP_QUIZ_PASS_CHALLENGE_RETRY", CHAPTER_FP.quizPassRetry.challenge),
        perfectBonus: envNum("IP_QUIZ_PERFECT_CHALLENGE", CHAPTER_FP.quizPerfectScore.challenge),
      },
    },
    loop: {
      guided: {
        firstAttempt: envNum("IP_LOOP_GUIDED_FIRST", LOOP_COMPLETE_IP.guided.firstAttempt),
        retry: envNum("IP_LOOP_GUIDED_RETRY", LOOP_COMPLETE_IP.guided.retry),
      },
      standard: {
        firstAttempt: envNum("IP_LOOP_STANDARD_FIRST", LOOP_COMPLETE_IP.standard.firstAttempt),
        retry: envNum("IP_LOOP_STANDARD_RETRY", LOOP_COMPLETE_IP.standard.retry),
      },
      challenge: {
        firstAttempt: envNum("IP_LOOP_CHALLENGE_FIRST", LOOP_COMPLETE_IP.challenge.firstAttempt),
        retry: envNum("IP_LOOP_CHALLENGE_RETRY", LOOP_COMPLETE_IP.challenge.retry),
      },
    },
    streakDayBonus: envNum("IP_STREAK_DAY_BONUS", INSIGHT_POINTS_AMOUNTS.streakDayBonus),
    welcomeBack: envNum("IP_WELCOME_BACK", INSIGHT_POINTS_AMOUNTS.welcomeBack),
    bookComplete: envNum("IP_BOOK_COMPLETE", INSIGHT_POINTS_AMOUNTS.bookComplete),
    onboardingComplete: envNum("IP_ONBOARDING_COMPLETE", INSIGHT_POINTS_AMOUNTS.onboardingComplete),
    firstBookStarted: envNum("IP_FIRST_BOOK_STARTED", INSIGHT_POINTS_AMOUNTS.firstBookStarted),
    scenarioApproved: envNum("IP_SCENARIO_APPROVED", INSIGHT_POINTS_AMOUNTS.scenarioApproved),
    streakShieldCost: envNum("IP_STREAK_SHIELD_COST", 100),
    giftAFriendCost: envNum("IP_GIFT_FRIEND_COST", 800),
    insightSparkProbability: envNum("IP_INSIGHT_SPARK_PROBABILITY", 0.12),
  };
}

/**
 * Get a flat summary of all IP values for admin/debugging display.
 */
export function getIPConfigSummary(): Record<string, number> {
  const config = getIPConfig();
  return {
    "quiz.guided.firstAttempt": config.quiz.guided.firstAttempt,
    "quiz.guided.retry": config.quiz.guided.retry,
    "quiz.guided.perfectBonus": config.quiz.guided.perfectBonus,
    "quiz.standard.firstAttempt": config.quiz.standard.firstAttempt,
    "quiz.standard.retry": config.quiz.standard.retry,
    "quiz.standard.perfectBonus": config.quiz.standard.perfectBonus,
    "quiz.challenge.firstAttempt": config.quiz.challenge.firstAttempt,
    "quiz.challenge.retry": config.quiz.challenge.retry,
    "quiz.challenge.perfectBonus": config.quiz.challenge.perfectBonus,
    "loop.guided.firstAttempt": config.loop.guided.firstAttempt,
    "loop.guided.retry": config.loop.guided.retry,
    "loop.standard.firstAttempt": config.loop.standard.firstAttempt,
    "loop.standard.retry": config.loop.standard.retry,
    "loop.challenge.firstAttempt": config.loop.challenge.firstAttempt,
    "loop.challenge.retry": config.loop.challenge.retry,
    streakDayBonus: config.streakDayBonus,
    welcomeBack: config.welcomeBack,
    bookComplete: config.bookComplete,
    onboardingComplete: config.onboardingComplete,
    firstBookStarted: config.firstBookStarted,
    scenarioApproved: config.scenarioApproved,
    streakShieldCost: config.streakShieldCost,
    giftAFriendCost: config.giftAFriendCost,
    insightSparkProbability: config.insightSparkProbability,
  };
}
