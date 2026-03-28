type Persona = "coach" | "partner" | "rival";

type Event =
  | "quiz_pass"
  | "quiz_fail"
  | "chapter_complete"
  | "daily_goal"
  | "weekly_goal"
  | "streak_milestone"
  | "streak_broken";

interface MessageContext {
  score?: number;
  streak?: number;
  goal?: number;
  remaining?: number;
  chaptersThisWeek?: number;
}

type MessageFactory = (ctx: MessageContext) => string;

function pick(messages: MessageFactory[], ctx: MessageContext): string {
  const index = Math.floor(Math.random() * messages.length);
  return messages[index](ctx);
}

const messages: Record<Persona, Record<Event, MessageFactory[]>> = {
  // ---------------------------------------------------------------------------
  // COACH — warm, supportive, celebrates effort
  // ---------------------------------------------------------------------------
  coach: {
    quiz_pass: [
      (ctx) =>
        ctx.score != null
          ? `${ctx.score}% — you clearly absorbed the key ideas. Well done.`
          : "You passed. The concepts are sticking.",
      (ctx) =>
        ctx.score != null
          ? `Scored ${ctx.score}%. That kind of retention takes real focus.`
          : "Solid pass. Your comprehension is building nicely.",
      (ctx) =>
        ctx.score != null
          ? `${ctx.score}% on that one. You're putting in the work and it shows.`
          : "Another quiz in the books. You're making real progress.",
      (ctx) =>
        ctx.score != null
          ? `Nice — ${ctx.score}%. The material is landing where it should.`
          : "Passed with confidence. Keep that momentum going.",
    ],
    quiz_fail: [
      (ctx) =>
        ctx.score != null
          ? `${ctx.score}% this time. The chapter has more to offer — revisit the parts that tripped you up.`
          : "Not quite there yet. A second read will make a difference.",
      (ctx) =>
        ctx.score != null
          ? `Landed at ${ctx.score}%. That's useful feedback — it shows exactly where to focus next.`
          : "Missed the mark, but now you know what to revisit.",
      (ctx) =>
        ctx.score != null
          ? `${ctx.score}% — some of the ideas need another pass. That's completely normal.`
          : "This chapter has some nuance. Give it another look and you'll get there.",
      (ctx) =>
        ctx.score != null
          ? `You got ${ctx.score}%. Learning is rarely linear — circle back and you'll lock it in.`
          : "A second attempt usually clears things up. You've got this.",
    ],
    chapter_complete: [
      () => "That chapter was a great one to finish. Your understanding is growing.",
      (ctx) =>
        ctx.remaining != null && ctx.remaining > 0
          ? `Chapter done. ${ctx.remaining} left — you're building real momentum.`
          : "Another chapter complete. You should feel good about that.",
      () => "Finished. Every chapter deepens your perspective a little more.",
      () => "One more chapter down. The discipline you're showing is the real win here.",
    ],
    daily_goal: [
      () => "Daily goal hit. Consistency is how knowledge compounds.",
      (ctx) =>
        ctx.streak != null && ctx.streak > 1
          ? `Goal met — that's ${ctx.streak} days running. You're building a real habit.`
          : "Today's goal is done. That's what matters.",
      () => "You showed up today. That counts for more than most people realize.",
      () => "Daily reading complete. Small sessions add up to big understanding.",
    ],
    weekly_goal: [
      (ctx) =>
        ctx.chaptersThisWeek != null
          ? `${ctx.chaptersThisWeek} chapters this week. That's meaningful progress.`
          : "Weekly goal reached. You're staying on track.",
      () => "Full week done. Your commitment to learning is paying off.",
      (ctx) =>
        ctx.goal != null
          ? `You hit your weekly target of ${ctx.goal}. That takes real follow-through.`
          : "Another strong week. The consistency is what separates you.",
      () => "Week complete. You're proving that you take this seriously.",
    ],
    streak_milestone: [
      (ctx) =>
        ctx.streak != null
          ? `${ctx.streak}-day streak. That kind of consistency reshapes how you think.`
          : "Streak milestone hit. This habit is becoming part of who you are.",
      (ctx) =>
        ctx.streak != null
          ? `${ctx.streak} days in a row. Most people don't make it this far — remember that.`
          : "Major milestone. You've earned this one.",
      (ctx) =>
        ctx.streak != null
          ? `${ctx.streak} days. You're not just reading — you're building a practice.`
          : "That's a real streak. The compound effect of daily learning is powerful.",
    ],
    streak_broken: [
      () => "Streak reset. It happens. What matters is that you're back today.",
      (ctx) =>
        ctx.streak != null
          ? `Your ${ctx.streak}-day streak ended, but the knowledge didn't. Pick it back up.`
          : "The streak broke, but your progress didn't. Start fresh.",
      () => "Missing a day doesn't erase what you've built. Jump back in.",
      () => "A gap in the streak, not in your growth. Let's keep going.",
    ],
  },

  // ---------------------------------------------------------------------------
  // PARTNER — clear, factual, honest
  // ---------------------------------------------------------------------------
  partner: {
    quiz_pass: [
      (ctx) =>
        ctx.score != null
          ? `${ctx.score}%. Above the threshold. Moving on.`
          : "Quiz passed. Ready for the next chapter.",
      (ctx) =>
        ctx.score != null
          ? `Scored ${ctx.score}%. The material is retained — next chapter unlocked.`
          : "Pass confirmed. You're clear to continue.",
      (ctx) =>
        ctx.score != null
          ? `${ctx.score}% — solid retention. Onward.`
          : "Passed. No need to revisit this one.",
      (ctx) =>
        ctx.score != null
          ? `Quiz result: ${ctx.score}%. That's a pass.`
          : "You've demonstrated comprehension. Moving forward.",
    ],
    quiz_fail: [
      (ctx) =>
        ctx.score != null
          ? `${ctx.score}%. Below the passing mark. Review the chapter and retry.`
          : "Didn't pass. The chapter needs another read.",
      (ctx) =>
        ctx.score != null
          ? `Scored ${ctx.score}%. Some key concepts didn't land. Worth revisiting.`
          : "Quiz not passed. Go back to the sections you're unsure about.",
      (ctx) =>
        ctx.score != null
          ? `${ctx.score}% — not enough to move on. Identify the gaps and try again.`
          : "Below threshold. Re-read the flagged sections before retaking.",
      (ctx) =>
        ctx.score != null
          ? `Result: ${ctx.score}%. A focused re-read should close the gap.`
          : "Not a pass. One more read-through should do it.",
    ],
    chapter_complete: [
      (ctx) =>
        ctx.remaining != null && ctx.remaining > 0
          ? `Chapter done. ${ctx.remaining} remaining in this book.`
          : "Chapter complete.",
      () => "Finished. Progress logged.",
      (ctx) =>
        ctx.remaining != null && ctx.remaining > 0
          ? `One chapter checked off. ${ctx.remaining} to go.`
          : "Chapter wrapped up. On to the next.",
      () => "Complete. Your reading log has been updated.",
    ],
    daily_goal: [
      () => "Daily goal met.",
      (ctx) =>
        ctx.streak != null
          ? `Done for today. Current streak: ${ctx.streak} days.`
          : "Today's target reached.",
      () => "Daily reading complete. You're on schedule.",
      (ctx) =>
        ctx.streak != null && ctx.streak > 1
          ? `Goal hit. ${ctx.streak} consecutive days logged.`
          : "Today's goal is done. See you tomorrow.",
    ],
    weekly_goal: [
      (ctx) =>
        ctx.chaptersThisWeek != null
          ? `Weekly goal reached. ${ctx.chaptersThisWeek} chapters completed this week.`
          : "Weekly target met.",
      (ctx) =>
        ctx.goal != null
          ? `You hit your goal of ${ctx.goal} for the week. Resetting for next week.`
          : "Week complete. Goal achieved.",
      () => "Weekly progress on track. Consistent output.",
      (ctx) =>
        ctx.chaptersThisWeek != null
          ? `${ctx.chaptersThisWeek} chapters this week. Target cleared.`
          : "This week's reading goal is done.",
    ],
    streak_milestone: [
      (ctx) =>
        ctx.streak != null
          ? `${ctx.streak}-day streak recorded.`
          : "Streak milestone reached.",
      (ctx) =>
        ctx.streak != null
          ? `${ctx.streak} consecutive days. That's a notable milestone.`
          : "You've hit a streak milestone. Logged.",
      (ctx) =>
        ctx.streak != null
          ? `Streak: ${ctx.streak} days. Keep the pace.`
          : "Milestone noted. Maintain the rhythm.",
    ],
    streak_broken: [
      () => "Streak reset to zero. Start a new one today.",
      (ctx) =>
        ctx.streak != null
          ? `Previous streak was ${ctx.streak} days. Counter resets now.`
          : "Streak broken. New streak begins with today's session.",
      () => "Missed a day. Streak cleared. Today is day one again.",
      () => "The streak ended. No points lost — just the counter. Resume when ready.",
    ],
  },

  // ---------------------------------------------------------------------------
  // RIVAL — competitive, challenge-driven, bold
  // ---------------------------------------------------------------------------
  rival: {
    quiz_pass: [
      (ctx) =>
        ctx.score != null
          ? `${ctx.score}% — not bad, but the next chapter won't be as easy.`
          : "You passed. Don't get comfortable.",
      (ctx) =>
        ctx.score != null
          ? `${ctx.score}%. Acceptable. Think you can keep that up?`
          : "A pass is a pass. Let's see if you can do better next time.",
      (ctx) =>
        ctx.score != null && ctx.score >= 90
          ? `${ctx.score}%. Alright, that's actually impressive. Prove it wasn't a fluke.`
          : ctx.score != null
            ? `${ctx.score}%. Passed, but there's room to sharpen up.`
            : "You scraped through. The next quiz will be harder.",
      (ctx) =>
        ctx.score != null
          ? `${ctx.score}% — decent. But decent isn't what you're here for, is it?`
          : "Passed. Now raise the bar.",
    ],
    quiz_fail: [
      (ctx) =>
        ctx.score != null
          ? `${ctx.score}%. That's a fail. Go back and actually learn it this time.`
          : "Didn't pass. The chapter deserves more than a skim.",
      (ctx) =>
        ctx.score != null
          ? `${ctx.score}%. The material beat you. Are you going to let that stand?`
          : "Failed. The question is whether you'll come back stronger.",
      (ctx) =>
        ctx.score != null
          ? `Scored ${ctx.score}%. That's not going to cut it. Re-read and come back ready.`
          : "Not even close. This chapter clearly needs more of your attention.",
      (ctx) =>
        ctx.score != null
          ? `${ctx.score}%. You can do better than that, and you know it.`
          : "A stumble. The real test is what you do next.",
    ],
    chapter_complete: [
      (ctx) =>
        ctx.remaining != null && ctx.remaining > 0
          ? `One down, ${ctx.remaining} to go. Think you can finish the whole book?`
          : "Chapter done. But finishing one chapter isn't the goal — finishing the book is.",
      () => "You finished the chapter. Now prove you understood it.",
      (ctx) =>
        ctx.remaining != null && ctx.remaining > 0
          ? `Chapter complete. ${ctx.remaining} remaining. Don't slow down now.`
          : "Another chapter cleared. The pace is the real challenge.",
      () => "Done with that one. Let's see if you keep this energy for the next.",
    ],
    daily_goal: [
      () => "Daily goal met. That's the minimum. Can you go further?",
      (ctx) =>
        ctx.streak != null && ctx.streak > 1
          ? `${ctx.streak} days straight. Not bad — but streaks are easy to start. Let's see how far you take it.`
          : "One day done. The real test is doing it again tomorrow.",
      () => "Goal hit. Most people would stop here. Will you?",
      () => "Today's done. But today is never the hard part — tomorrow is.",
    ],
    weekly_goal: [
      (ctx) =>
        ctx.chaptersThisWeek != null
          ? `${ctx.chaptersThisWeek} chapters this week. Solid — now beat it next week.`
          : "Weekly goal reached. Time to raise the target.",
      (ctx) =>
        ctx.goal != null
          ? `Hit your goal of ${ctx.goal}. Was it too easy? Maybe set a higher one.`
          : "You met the weekly goal. The question is whether it was challenging enough.",
      () => "Full week complete. But consistency over one week isn't a pattern yet.",
      (ctx) =>
        ctx.chaptersThisWeek != null
          ? `${ctx.chaptersThisWeek} chapters done. That's a baseline now — not a ceiling.`
          : "Week cleared. Let's see if you can sustain it.",
    ],
    streak_milestone: [
      (ctx) =>
        ctx.streak != null
          ? `${ctx.streak}-day streak. Getting serious. Don't let up now.`
          : "Streak milestone. You've got momentum — don't waste it.",
      (ctx) =>
        ctx.streak != null
          ? `${ctx.streak} days. That's starting to look like discipline. Keep proving it.`
          : "A real streak forming. Let's see how far you push it.",
      (ctx) =>
        ctx.streak != null
          ? `${ctx.streak} consecutive days. Impressive — if you can hold it.`
          : "Milestone reached. Now defend it.",
    ],
    streak_broken: [
      () => "Streak gone. Back to zero. What are you going to do about it?",
      (ctx) =>
        ctx.streak != null
          ? `${ctx.streak}-day streak — done. You'll need to rebuild from scratch.`
          : "Streak broken. The counter doesn't lie.",
      () => "You dropped the streak. Starting over. Make this run longer.",
      () => "Reset. The only question that matters: are you done, or are you reloading?",
    ],
  },
};

export function getMotivationMessage(
  persona: Persona,
  event: Event,
  context?: MessageContext
): string {
  const ctx = context ?? {};
  const variants = messages[persona]?.[event];

  if (!variants || variants.length === 0) {
    return "";
  }

  return pick(variants, ctx);
}
