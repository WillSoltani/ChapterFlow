import "server-only";

/**
 * Audio Narration Engine
 *
 * Builds a personalized narration script by selecting contextual greeting,
 * score callout, transition, and closing segments based on user state.
 * All segments are pre-generated MP3 files in S3 — this module only
 * decides WHICH segments to stitch together.
 */

// ── Segment types ────────────────────────────────────────────────────

export type TimeOfDay = "morning" | "afternoon" | "evening";
export type BodySegmentType = "summary" | "takeaways" | "recap";
export const BODY_SEGMENT_TYPES: BodySegmentType[] = ["summary", "takeaways", "recap"];

export type NarrationContext = {
  userName: string | null;
  userId: string;
  bookId: string;
  bookTitle: string;
  authorName: string;
  chapterNumber: number;
  totalChapters: number;
  previousChapterScore: number | null;
  previousChapterScoreBefore: number | null;
  currentStreak: number;
  daysSinceLastSession: number;
  totalChaptersCompleted: number;
  booksCompleted: number;
  learningMode: "guided" | "standard" | "challenge";
  isFirstEverChapter: boolean;
  isFirstChapterOfBook: boolean;
  isLastChapterOfBook: boolean;
  isHalfwayThroughBook: boolean;
  isWeekend: boolean;
  isLateNight: boolean;
  timeOfDay: TimeOfDay;
};

export type SegmentPlan = {
  timeOfDay: TimeOfDay;
  greetingId: string;
  scoreId: string | null;
  transitionId: string;
  closingId: string;
};

// ── S3 key helpers ───────────────────────────────────────────────────

const AUDIO_SEGMENTS_PREFIX = "book-content/audio-segments";

export function segmentS3Key(type: string, id: string): string {
  return `${AUDIO_SEGMENTS_PREFIX}/${type}/${id}.mp3`;
}

export function userNameS3Key(userId: string): string {
  return `${AUDIO_SEGMENTS_PREFIX}/names/${userId}.mp3`;
}

export function bookIntroS3Key(bookId: string): string {
  return `${AUDIO_SEGMENTS_PREFIX}/books/${bookId}.mp3`;
}

export function chapterNumberS3Key(chapterNumber: number): string {
  return `${AUDIO_SEGMENTS_PREFIX}/chapters/chapter-${chapterNumber}.mp3`;
}

export function chapterBodySegmentS3Key(
  bookId: string,
  chapterNumber: number,
  tone: string,
  variant: string,
  segment: BodySegmentType,
): string {
  return `book-content/audio/${bookId}/ch${String(chapterNumber).padStart(4, "0")}.${tone}.${variant}.${segment}.mp3`;
}

// ── Time of day ──────────────────────────────────────────────────────

export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

// ── Greeting selection ───────────────────────────────────────────────

function selectGreeting(ctx: NarrationContext): string {
  if (ctx.isFirstEverChapter) return "ctx-first-ever";
  if (ctx.isFirstChapterOfBook && ctx.booksCompleted > 0) return "ctx-new-book";
  if (ctx.daysSinceLastSession >= 7) return "ctx-returning";
  if (ctx.currentStreak >= 7) return "ctx-hot-streak";
  if (ctx.isWeekend) return "ctx-weekend";

  const index = Math.floor(Math.random() * 10) + 1;
  return `generic-${String(index).padStart(2, "0")}`;
}

// ── Score callout selection ──────────────────────────────────────────

function selectScore(ctx: NarrationContext): string | null {
  if (ctx.isFirstChapterOfBook || ctx.previousChapterScore === null) {
    return "first-chapter";
  }

  const buckets = [70, 75, 80, 85, 90, 95, 100];
  const score = ctx.previousChapterScore;
  const closest = buckets.reduce((prev, curr) =>
    Math.abs(curr - score) < Math.abs(prev - score) ? curr : prev,
  );

  if (score === 100) {
    if (ctx.previousChapterScoreBefore !== null && score > ctx.previousChapterScoreBefore) {
      return "score-100-improved";
    }
    return "score-100";
  }

  if (ctx.previousChapterScoreBefore !== null && score > ctx.previousChapterScoreBefore) {
    return `score-${closest}-improved`;
  }
  if (ctx.previousChapterScoreBefore !== null && score < ctx.previousChapterScoreBefore) {
    return `score-${closest}-dipped`;
  }

  return `score-${closest}`;
}

// ── Transition selection ─────────────────────────────────────────────

function selectTransition(ctx: NarrationContext): string {
  if (ctx.learningMode === "challenge") return "ctx-challenge";
  if (ctx.learningMode === "guided") return "ctx-guided";

  const index = Math.floor(Math.random() * 10) + 1;
  return `generic-${String(index).padStart(2, "0")}`;
}

// ── Closing selection ────────────────────────────────────────────────

function selectClosing(ctx: NarrationContext): string {
  if (ctx.isLastChapterOfBook) return "ctx-last-chapter";
  if (ctx.isHalfwayThroughBook) return "ctx-halfway";
  if (ctx.currentStreak >= 3) return "ctx-on-streak";
  if (ctx.isLateNight) return "ctx-late-night";

  const index = Math.floor(Math.random() * 10) + 1;
  return `generic-${String(index).padStart(2, "0")}`;
}

// ── Main: build the segment plan ─────────────────────────────────────

export function buildSegmentPlan(ctx: NarrationContext): SegmentPlan {
  return {
    timeOfDay: ctx.timeOfDay,
    greetingId: selectGreeting(ctx),
    scoreId: selectScore(ctx),
    transitionId: selectTransition(ctx),
    closingId: selectClosing(ctx),
  };
}

// ── Segment list for stitching ───────────────────────────────────────
//
// Narration order:
//   1. Time of day       "Good evening,"
//   2. Greeting          "It's great to have you back..."
//   3. User name         "Will"
//   4. Book intro        "Atomic Habits by James Clear."
//   5. Score callout     "You scored 85 percent..."
//   6. Chapter number    "Let's see what chapter 3 has in store."
//   7. SUMMARY body      [chapterBreakdown audio]
//   8. TRANSITION        "Alright, let's break it down..."
//   9. TAKEAWAYS body    [keyTakeaways audio]
//  10. RECAP body        [oneMinuteRecap audio]
//  11. CLOSING CTA       "And that's a wrap..."

export function getSegmentKeys(
  plan: SegmentPlan,
  ctx: NarrationContext,
  tone: string,
  variant: string,
): string[] {
  const keys: string[] = [];

  // 1. Time of day
  keys.push(segmentS3Key("time-of-day", plan.timeOfDay));

  // 2. Greeting
  keys.push(segmentS3Key("greetings", plan.greetingId));

  // 3. User's name (if generated)
  if (ctx.userName) {
    keys.push(userNameS3Key(ctx.userId));
  }

  // 4. Book name + author
  keys.push(bookIntroS3Key(ctx.bookId));

  // 5. Score callout
  if (plan.scoreId) {
    keys.push(segmentS3Key("scores", plan.scoreId));
  }

  // 6. Chapter number lead-in
  keys.push(chapterNumberS3Key(ctx.chapterNumber));

  // 7. Summary body
  keys.push(chapterBodySegmentS3Key(ctx.bookId, ctx.chapterNumber, tone, variant, "summary"));

  // 8. Transition (between summary and takeaways)
  keys.push(segmentS3Key("transitions", plan.transitionId));

  // 9. Takeaways body
  keys.push(chapterBodySegmentS3Key(ctx.bookId, ctx.chapterNumber, tone, variant, "takeaways"));

  // 10. Recap body
  keys.push(chapterBodySegmentS3Key(ctx.bookId, ctx.chapterNumber, tone, variant, "recap"));

  // 11. Closing CTA
  keys.push(segmentS3Key("closings", plan.closingId));

  return keys;
}

// ── All segment scripts (for pre-generation) ─────────────────────────

export const GREETING_SCRIPTS: Record<string, string> = {
  "ctx-first-ever":
    "Welcome to ChapterFlow. This is your very first chapter, and you picked a great book to start with. Let's get into",
  "ctx-new-book":
    "New book, fresh start. Let's see what's waiting for you in",
  "ctx-returning":
    "It's been a while, but you're back, and that's what counts. Let's pick up where you left off in",
  "ctx-hot-streak":
    "You're on a serious reading streak. That kind of consistency is rare. Let's keep it going with",
  "ctx-weekend":
    "Weekend reading. That's dedication. Let's make it count with",
  "generic-01": "It's great to have you back for another chapter of",
  "generic-02": "Welcome back. Let's pick up where we left off in",
  "generic-03": "Ready for another round? Let's jump into",
  "generic-04": "Glad you're here. Let's keep the momentum going with",
  "generic-05": "You showed up again, and that's what matters. Let's get into",
  "generic-06": "Another day, another chapter. Let's see what's next in",
  "generic-07": "Good to see you back. Let's keep building on what you've learned in",
  "generic-08": "You're on a roll. Let's continue with",
  "generic-09": "Let's make this count. Here's your next chapter of",
  "generic-10": "Right on time. Let's dive into",
};

export const SCORE_SCRIPTS: Record<string, string> = {
  "first-chapter":
    "This is your first chapter, so let's set the bar high.",
  "score-70":
    "You scored 70 percent on the last chapter. You made it through, and that's what counts. Let's build on that.",
  "score-75":
    "You scored 75 percent on the last chapter. Solid work. You're getting the hang of this.",
  "score-80":
    "You scored 80 percent on the last chapter. That's a strong score. You clearly paid attention.",
  "score-85":
    "You scored 85 percent on the last chapter. Really well done. You're picking up these ideas fast.",
  "score-90":
    "You scored 90 percent on the last chapter. Impressive. You've got a real grip on this material.",
  "score-95":
    "You scored 95 percent on the last chapter. Almost perfect. Seriously, that's hard to pull off.",
  "score-100":
    "You got a perfect score on the last chapter. That's rare. Whatever you're doing, keep doing it.",
  "score-100-improved":
    "You got a perfect score on the last chapter. Even better than before. You're in a league of your own.",
  "score-70-improved": "You scored 70 percent on the last chapter. That's up from before. You're heading in the right direction.",
  "score-75-improved": "You scored 75 percent. That's an improvement from the chapter before. The ideas are clicking.",
  "score-80-improved": "You scored 80 percent. That's up from last time. You're clearly getting sharper.",
  "score-85-improved": "You scored 85 percent. That's up from the chapter before. You're on an upward trend.",
  "score-90-improved": "You scored 90 percent. Even better than last time. You're really dialing in.",
  "score-95-improved": "You scored 95 percent. Better than the chapter before. You're almost untouchable.",
  "score-70-dipped": "You scored 70 on the last chapter. That one was tough, no shame in it. Let's see if this chapter clicks better.",
  "score-75-dipped": "You scored 75 on the last chapter. Slight dip, but still solid. Let's bounce back.",
  "score-80-dipped": "You scored 80 on the last chapter. Still a good score, even if it's down a bit.",
  "score-85-dipped": "You scored 85 on the last chapter. Down slightly, but that's still impressive.",
  "score-90-dipped": "You scored 90 on the last chapter. Tiny dip, but come on, 90 is still exceptional.",
  "score-95-dipped": "You scored 95 on the last chapter. Down a touch, but 95 is nothing to worry about.",
};

export const TRANSITION_SCRIPTS: Record<string, string> = {
  "ctx-challenge":
    "Here's what you need to know to pass the quiz. Pay attention, these are the ideas that get tested.",
  "ctx-guided":
    "Let's walk through the key takeaways together. No rush, just focus on understanding each one.",
  "generic-01": "Alright, now that you've got the big picture, let's break it down. Here are the key takeaways you need to remember.",
  "generic-02": "Okay, that's the overview. But let's make sure the important parts actually stick with you.",
  "generic-03": "Now let's zoom in on what really matters from this chapter.",
  "generic-04": "Good so far? Let's pull out the ideas that are worth holding onto.",
  "generic-05": "That's the chapter in a nutshell. Now here's what you should actually take away from it.",
  "generic-06": "Alright, let's get specific. These are the takeaways you'll want to remember.",
  "generic-07": "Now for the part that matters most. Let's lock in the key ideas.",
  "generic-08": "You've got the context. Now let's make sure you walk away with the right pieces.",
  "generic-09": "Let's cut to what counts. Here are the takeaways from this chapter.",
  "generic-10": "Okay, big picture done. Let's pull out the ideas you can actually use.",
};

export const CLOSING_SCRIPTS: Record<string, string> = {
  "ctx-last-chapter":
    "And that's the final chapter. You just finished an entire book. Seriously, most people never get this far. Head to the quiz to close it out and earn your completion badge.",
  "ctx-halfway":
    "You're halfway through the book now. The second half is where it all starts coming together. Head to examples or take the quiz.",
  "ctx-on-streak":
    "Another chapter done, another day on your streak. Keep this up and you'll finish the book in no time.",
  "ctx-late-night":
    "That's a wrap. Get some rest, your brain needs time to process what you just learned. The quiz will be here tomorrow.",
  "generic-01": "And that's a wrap on this chapter. If you want to see how this plays out in real life, head to the examples section. Or if you're feeling confident, jump straight to the quiz and lock it in.",
  "generic-02": "We made it through. Nice work. You can check out some real-world scenarios next, or go right to the quiz whenever you're ready.",
  "generic-03": "That's everything for this one. I'd recommend checking the examples to see how this applies to your own life. But if you're ready to test yourself, the quiz is waiting.",
  "generic-04": "Done and done. Want to see this in action? The examples section has real scenarios. Or skip ahead to the quiz if you're feeling sharp.",
  "generic-05": "And that wraps it up. The examples section will show you where these ideas actually matter. Or go straight to the quiz, your call.",
  "generic-06": "Alright, we covered a lot. Take a look at the examples to connect this to real situations, or head to the quiz to see how much stuck.",
  "generic-07": "That's this chapter in the books. The examples will help you see how to actually use what you just learned. Or you can test yourself with the quiz right now.",
  "generic-08": "We're through it. If you want it to really sink in, the examples section is worth a look. Otherwise, the quiz is right there whenever you're ready.",
  "generic-09": "Nice, another chapter down. Check out the examples to see how this looks in practice, or prove what you know in the quiz.",
  "generic-10": "And we're done. You've got two paths from here. Examples to see it in context, or quiz to test your understanding. Either way, you're making progress.",
};

export const TIME_OF_DAY_SCRIPTS: Record<TimeOfDay, string> = {
  morning: "Good morning,",
  afternoon: "Good afternoon,",
  evening: "Good evening,",
};

export function getChapterNumberScript(chapterNumber: number): string {
  return `Let's see what chapter ${chapterNumber} has in store.`;
}

export function getBookIntroScript(bookTitle: string, authorName: string): string {
  return `${bookTitle} by ${authorName}.`;
}
