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

export const SILENCE_S3_KEY = `${AUDIO_SEGMENTS_PREFIX}/silence/1500ms.mp3`;

export function segmentS3Key(type: string, id: string): string {
  return `${AUDIO_SEGMENTS_PREFIX}/${type}/${id}.mp3`;
}

export function userGreetingS3Key(userId: string, timeOfDay: TimeOfDay): string {
  return `${AUDIO_SEGMENTS_PREFIX}/names/${userId}-${timeOfDay}.mp3`;
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
//   1. [silence]           1.5s breathing room
//   2. User greeting       "Good evening, Will."
//   3. Greeting            "Weekend reading? Love to see it. Let's make it count with"
//   4. Book intro          "Crucial Conversations by Joseph Grenny..."
//   5. Score callout       "90 percent — even better than last time..."
//   6. Chapter number      "Let's see what chapter 4 has for us."
//   7. SUMMARY body        [chapterBreakdown audio]
//   8. TRANSITION          "Got the gist? Good. Let's pull out the ideas..."
//   9. TAKEAWAYS body      [keyTakeaways with connectors]
//  10. RECAP body          [oneMinuteRecap audio]
//  11. CLOSING CTA         "Another chapter down, another day on your streak..."

export function getSegmentKeys(
  plan: SegmentPlan,
  ctx: NarrationContext,
  tone: string,
  variant: string,
): string[] {
  const keys: string[] = [];

  // 1. User greeting ("Good evening, Will.")
  if (ctx.userName) {
    keys.push(userGreetingS3Key(ctx.userId, plan.timeOfDay));
  }

  // 3. Greeting
  keys.push(segmentS3Key("greetings", plan.greetingId));

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

  // 9. Takeaways body (with connectors baked in)
  keys.push(chapterBodySegmentS3Key(ctx.bookId, ctx.chapterNumber, tone, variant, "takeaways"));

  // 10. Recap body
  keys.push(chapterBodySegmentS3Key(ctx.bookId, ctx.chapterNumber, tone, variant, "recap"));

  // 11. Closing CTA
  keys.push(segmentS3Key("closings", plan.closingId));

  return keys;
}

// ── Takeaway connectors ──────────────────────────────────────────────
// Used by the audio route to wrap each takeaway with natural transitions.
// Two versions: with moreDetails and without (point-only).

const CONNECTORS_WITH_DETAILS = {
  first: "The first key takeaway from this chapter — {point}. And what that means is — {moreDetails}.",
  second: "Second thing worth remembering — {point}. To break that down a bit — {moreDetails}.",
  third: "Here's another one — {point}. The reason this matters? {moreDetails}.",
  fourth: "This one's easy to miss, but it's important — {point}. Basically — {moreDetails}.",
  middle: "One more — {point}. {moreDetails}.",
  last: "And the last one, which kind of ties everything together — {point}. {moreDetails}.",
};

const CONNECTORS_POINT_ONLY = {
  first: "The first key takeaway from this chapter — {point}.",
  second: "Second thing worth remembering — {point}.",
  third: "Here's another one — {point}.",
  fourth: "This one's easy to miss, but it's important — {point}.",
  middle: "One more — {point}.",
  last: "And the last one, which kind of ties everything together — {point}.",
};

export function buildTakeawayText(
  takeaways: Array<{ point: string; moreDetails: string }>,
): string {
  if (takeaways.length === 0) return "";

  const parts: string[] = [];
  const total = takeaways.length;

  for (let i = 0; i < total; i++) {
    const { point, moreDetails } = takeaways[i];
    const hasDetails = moreDetails && moreDetails.trim().length > 0;
    const connectors = hasDetails ? CONNECTORS_WITH_DETAILS : CONNECTORS_POINT_ONLY;

    let key: keyof typeof connectors;

    if (total === 1) {
      key = "first";
    } else if (i === total - 1 && total >= 3) {
      key = "last";
    } else if (i === 0) {
      key = "first";
    } else if (i === 1) {
      key = "second";
    } else if (i === 2) {
      key = "third";
    } else if (i === 3) {
      key = "fourth";
    } else {
      key = "middle";
    }

    let text = connectors[key].replace("{point}", point);
    if (hasDetails) {
      text = text.replace("{moreDetails}", moreDetails);
    }
    parts.push(text);
  }

  return parts.join("\n\n");
}

// ── All segment scripts (for pre-generation) ─────────────────────────

export const GREETING_SCRIPTS: Record<string, string> = {
  "ctx-first-ever":
    "This is your very first chapter — and honestly, you picked a great book to start with. Let's get into",
  "ctx-new-book":
    "New book! Fresh start. Let's see what's in",
  "ctx-returning":
    "It's been a minute... but you're back, and that's what matters. Let's pick things up with",
  "ctx-hot-streak":
    "You've been showing up every single day — that kind of consistency is rare, you know? Let's keep it going with",
  "ctx-weekend":
    "Weekend reading? Love to see it. Let's make it count with",
  "generic-01": "Great to have you back. Let's get into",
  "generic-02": "Welcome back! Let's pick up where we left off in",
  "generic-03": "Ready for another one? Let's jump into",
  "generic-04": "Glad you're here — let's keep this going with",
  "generic-05": "You showed up again — that's half the battle right there. Let's get into",
  "generic-06": "Another day, another chapter. Let's see what's next in",
  "generic-07": "Good to see you. Let's keep building on what you've learned in",
  "generic-08": "You're on a roll! Let's keep it moving with",
  "generic-09": "Let's make this one count. Next up —",
  "generic-10": "Right on time. Let's dive into",
};

export const SCORE_SCRIPTS: Record<string, string> = {
  "first-chapter":
    "This is your first chapter — so let's set the bar high.",
  "score-70":
    "You scored 70 percent on the last chapter. Hey — you made it through, and that's what counts.",
  "score-75":
    "You got 75 percent on the last chapter — solid. You're getting the hang of this.",
  "score-80":
    "80 percent on the last chapter — that's a strong score. You were paying attention.",
  "score-85":
    "85 percent on the last chapter — really well done. You're picking these ideas up fast.",
  "score-90":
    "You pulled 90 percent on the last chapter — that's impressive. You've clearly got a grip on this.",
  "score-95":
    "95 percent... seriously? That's hard to pull off. Nice work.",
  "score-100":
    "Perfect score on the last chapter — that's rare. Whatever you're doing, don't stop.",
  "score-100-improved":
    "Perfect score — and better than last time. You're on another level right now.",
  "score-70-improved": "70 percent — that's up from before. You're heading the right way.",
  "score-75-improved": "75 percent — better than the chapter before. The ideas are starting to click.",
  "score-80-improved": "80 percent — up from last time. You're getting sharper.",
  "score-85-improved": "85 percent — that's up from the chapter before. Definite upward trend.",
  "score-90-improved": "90 percent — even better than last time. You're dialing in.",
  "score-95-improved": "95 percent — up from the chapter before. You're almost untouchable at this point.",
  "score-70-dipped": "70 percent on the last one. That chapter was tough — no shame in it. Let's see if this one clicks better.",
  "score-75-dipped": "75 on the last chapter — small dip, but still solid. Let's bounce back.",
  "score-80-dipped": "80 on the last chapter. Still a good score, even if it dipped a little.",
  "score-85-dipped": "85 on the last chapter — down a bit, but that's still really strong.",
  "score-90-dipped": "90 on the last chapter. Tiny dip — but come on, 90 is 90.",
  "score-95-dipped": "95 on the last one — down a touch, but... 95? You're fine.",
};

export const TRANSITION_SCRIPTS: Record<string, string> = {
  "ctx-challenge":
    "Here's what you need to know for the quiz — pay close attention, because these are the ideas that get tested.",
  "ctx-guided":
    "Let's walk through the key takeaways together. No rush — just take each one in.",
  "generic-01": "So — now that you've got the big picture, let's break it down. These are the key takeaways.",
  "generic-02": "That's the overview. Now let's make sure the important stuff actually sticks.",
  "generic-03": "Let's zoom in on what really matters here.",
  "generic-04": "Got the gist? Good. Let's pull out the ideas worth holding onto.",
  "generic-05": "That's the chapter in a nutshell. Here's what you should actually walk away with.",
  "generic-06": "Let's get specific — these are the ones you'll want to remember.",
  "generic-07": "This is the part that matters most — let's lock in the key ideas.",
  "generic-08": "You've got the context. Let's make sure you leave with the right pieces.",
  "generic-09": "Let's cut to what counts.",
  "generic-10": "Big picture — done. Now let's pull out what you can actually use.",
};

export const CLOSING_SCRIPTS: Record<string, string> = {
  "ctx-last-chapter":
    "That's the final chapter. You just finished an entire book — and honestly, most people never make it this far. Go take the quiz, close it out, and grab your badge. You earned it.",
  "ctx-halfway":
    "You're halfway through the book! The second half is where everything starts clicking. Check out the examples or go take the quiz — your call.",
  "ctx-on-streak":
    "Another chapter down, another day on your streak. You keep this up? You'll be done with the book before you know it.",
  "ctx-late-night":
    "That's a wrap for tonight. Seriously — get some sleep. Your brain needs time to process all this. The quiz will be here tomorrow.",
  "generic-01": "And that's this chapter! If you want to see how any of this plays out in real life — check out the examples. Or if you're feeling good about it, go take the quiz.",
  "generic-02": "We made it through — nice work. Check out some real-world scenarios, or go straight to the quiz whenever you're ready.",
  "generic-03": "That's everything for this one. I'd say check the examples — it makes way more sense when you can picture it in your own life. But if you want to test yourself, the quiz is right there.",
  "generic-04": "Done! Want to see this stuff in action? The examples are worth a look. Or just skip to the quiz if you're feeling sharp.",
  "generic-05": "That wraps it up! The examples will show you where these ideas actually matter — or you can go straight to the quiz.",
  "generic-06": "We covered a lot. Take a look at the examples to connect it to real situations, or go see how much stuck in the quiz.",
  "generic-07": "That's this chapter done! The examples will help you see how to actually use what you just learned — or test yourself in the quiz right now.",
  "generic-08": "We're through it! If you want it to really sink in, the examples are worth your time. Otherwise — quiz is right there.",
  "generic-09": "Another chapter down! Check out the examples to see how this looks in practice, or go prove what you know in the quiz.",
  "generic-10": "And we're done! Two paths from here — examples to see it in context, or quiz to see what you retained. Either way, you're making real progress.",
};

export function getChapterNumberScript(chapterNumber: number): string {
  return `Let's see what chapter ${chapterNumber} has for us.`;
}

export function getBookIntroScript(bookTitle: string, authorName: string): string {
  return `${bookTitle} by ${authorName}.`;
}

export function getUserGreetingScript(name: string, timeOfDay: TimeOfDay): string {
  const tod = timeOfDay === "morning" ? "morning" : timeOfDay === "afternoon" ? "afternoon" : "evening";
  return `Good ${tod}, ${name}.`;
}
