"use client";

import type { ProgressPageData } from "./progressTypes";
import { PersonalizedGreeting } from "./PersonalizedGreeting";
import { DailyGoalRing } from "./DailyGoalRing";
import { StreakDisplay } from "./StreakDisplay";
import { FlowPointsIndicator } from "./FlowPointsIndicator";
import {
  ContinueLearningCard,
  NoActiveBooksCard,
} from "./ContinueLearningCard";

interface HeroSectionProps {
  data: ProgressPageData;
  onSwitchBook?: (bookId: string) => void;
}

export function HeroSection({ data, onSwitchBook }: HeroSectionProps) {
  const goalComplete =
    data.todayGoal.completedMinutes >= data.todayGoal.targetMinutes;
  const hasEndowedProgress =
    data.todayGoal.completedMinutes === 0 && data.activeBooks.length > 0;

  const primaryBook = data.activeBooks[0] ?? null;
  const otherBooks = data.activeBooks.slice(1);

  // Estimate available FP today from incomplete quests
  const availableFP = data.dailyQuests
    .filter((q) => !q.completed)
    .reduce((sum) => sum + 25, 0);

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
      {/* Left Column — Motivation Cluster */}
      <div className="flex flex-col gap-6">
        {/* Flow Points — top right on mobile, absolute on desktop */}
        <div className="flex items-start justify-between">
          <PersonalizedGreeting
            name={data.user.name}
            readerLevel={data.user.readerLevel}
            readerLevelProgress={data.user.readerLevelProgress}
            streak={data.streak}
            goalCompletedToday={goalComplete}
            nextMilestones={data.nextMilestones}
            completedMinutesToday={data.todayGoal.completedMinutes}
            targetMinutes={data.todayGoal.targetMinutes}
          />
          <FlowPointsIndicator
            points={data.user.flowPoints}
            availableFPToday={availableFP}
          />
        </div>

        {/* Daily Goal Ring — centered */}
        <div className="flex justify-center">
          <DailyGoalRing
            completedMinutes={data.todayGoal.completedMinutes}
            targetMinutes={data.todayGoal.targetMinutes}
            stepsCompleted={data.todayGoal.stepsCompletedToday}
            totalSteps={data.todayGoal.totalStepsToday}
            hasEndowedProgress={hasEndowedProgress}
          />
        </div>

        {/* Streak */}
        <StreakDisplay streak={data.streak} />
      </div>

      {/* Right Column — Primary Action Card */}
      <div>
        {primaryBook ? (
          <ContinueLearningCard
            primaryBook={primaryBook}
            otherBooks={otherBooks}
            onSwitchBook={onSwitchBook}
          />
        ) : (
          <NoActiveBooksCard />
        )}
      </div>
    </section>
  );
}
