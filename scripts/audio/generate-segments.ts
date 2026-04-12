/**
 * Pre-generate all reusable audio narration segments and upload to S3.
 *
 * Usage:
 *   npx tsx scripts/audio/generate-segments.ts
 *
 * Requires:
 *   OPENAI_API_KEY in environment
 *   BOOK_CONTENT_BUCKET in environment (or defaults to S3 bucket name)
 *
 * This generates:
 *   - 3 time-of-day clips
 *   - 15 greeting clips (5 contextual + 10 generic)
 *   - 21 score callout clips (8 base + 13 trend variants)
 *   - 12 transition clips (2 contextual + 10 generic)
 *   - 14 closing clips (4 contextual + 10 generic)
 *   - 50 chapter number clips
 *   - 1 book intro clip per book in the catalog
 *   Total: ~115 + N books
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const BUCKET = process.env.BOOK_CONTENT_BUCKET!;
const VOICE = "nova";
const MODEL = "tts-1";
const PREFIX = "book-content/audio-segments";

const s3 = new S3Client({});

async function generateTTS(text: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: text, voice: VOICE, response_format: "mp3" }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`TTS failed (${res.status}): ${err.slice(0, 200)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function exists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function generateAndUpload(key: string, text: string, force = false): Promise<void> {
  if (!force && await exists(key)) {
    console.log(`  SKIP (cached): ${key}`);
    return;
  }

  console.log(`  GENERATING: ${key} (${text.length} chars)`);
  const buffer = await generateTTS(text);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "audio/mpeg",
      CacheControl: "public, max-age=31536000",
    }),
  );
  console.log(`  UPLOADED: ${key} (${buffer.length} bytes)`);
}

// ── Segment definitions ──────────────────────────────────────────────

const TIME_OF_DAY = {
  morning: "Good morning,",
  afternoon: "Good afternoon,",
  evening: "Good evening,",
};

const GREETINGS: Record<string, string> = {
  "ctx-first-ever": "Welcome to ChapterFlow. This is your very first chapter, and you picked a great book to start with. Let's get into",
  "ctx-new-book": "New book, fresh start. Let's see what's waiting for you in",
  "ctx-returning": "It's been a while, but you're back, and that's what counts. Let's pick up where you left off in",
  "ctx-hot-streak": "You're on a serious reading streak. That kind of consistency is rare. Let's keep it going with",
  "ctx-weekend": "Weekend reading. That's dedication. Let's make it count with",
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

const SCORES: Record<string, string> = {
  "first-chapter": "This is your first chapter, so let's set the bar high.",
  "score-70": "You scored 70 percent on the last chapter. You made it through, and that's what counts. Let's build on that.",
  "score-75": "You scored 75 percent on the last chapter. Solid work. You're getting the hang of this.",
  "score-80": "You scored 80 percent on the last chapter. That's a strong score. You clearly paid attention.",
  "score-85": "You scored 85 percent on the last chapter. Really well done. You're picking up these ideas fast.",
  "score-90": "You scored 90 percent on the last chapter. Impressive. You've got a real grip on this material.",
  "score-95": "You scored 95 percent on the last chapter. Almost perfect. Seriously, that's hard to pull off.",
  "score-100": "You got a perfect score on the last chapter. That's rare. Whatever you're doing, keep doing it.",
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
  "score-100-improved": "You got a perfect score on the last chapter. Even better than before. You're in a league of your own.",
};

const TRANSITIONS: Record<string, string> = {
  "ctx-challenge": "Here's what you need to know to pass the quiz. Pay attention, these are the ideas that get tested.",
  "ctx-guided": "Let's walk through the key takeaways together. No rush, just focus on understanding each one.",
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

const CLOSINGS: Record<string, string> = {
  "ctx-last-chapter": "And that's the final chapter. You just finished an entire book. Seriously, most people never get this far. Head to the quiz to close it out and earn your completion badge.",
  "ctx-halfway": "You're halfway through the book now. The second half is where it all starts coming together. Head to examples or take the quiz.",
  "ctx-on-streak": "Another chapter done, another day on your streak. Keep this up and you'll finish the book in no time.",
  "ctx-late-night": "That's a wrap. Get some rest, your brain needs time to process what you just learned. The quiz will be here tomorrow.",
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

// ── Book catalog (load dynamically) ──────────────────────────────────

async function getBookCatalog(): Promise<Array<{ bookId: string; title: string; author: string }>> {
  // Load from the local book packages
  try {
    const { BOOK_PACKAGES } = await import("../../app/book/data/bookPackages");
    return (BOOK_PACKAGES as Array<{ book: { bookId: string; title: string; author: string } }>).map(
      (pkg) => ({
        bookId: pkg.book.bookId,
        title: pkg.book.title,
        author: pkg.book.author,
      }),
    );
  } catch {
    console.warn("Could not load book packages, skipping book intros");
    return [];
  }
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const force = process.argv.includes("--force");

  console.log("=== Generating audio narration segments ===\n");

  // Time of day (3)
  console.log("Time of day (3):");
  for (const [id, text] of Object.entries(TIME_OF_DAY)) {
    await generateAndUpload(`${PREFIX}/time-of-day/${id}.mp3`, text, force);
  }

  // Greetings (15)
  console.log("\nGreetings (15):");
  for (const [id, text] of Object.entries(GREETINGS)) {
    await generateAndUpload(`${PREFIX}/greetings/${id}.mp3`, text, force);
  }

  // Scores (21)
  console.log("\nScore callouts (21):");
  for (const [id, text] of Object.entries(SCORES)) {
    await generateAndUpload(`${PREFIX}/scores/${id}.mp3`, text, force);
  }

  // Transitions (12)
  console.log("\nTransitions (12):");
  for (const [id, text] of Object.entries(TRANSITIONS)) {
    await generateAndUpload(`${PREFIX}/transitions/${id}.mp3`, text, force);
  }

  // Closings (14)
  console.log("\nClosings (14):");
  for (const [id, text] of Object.entries(CLOSINGS)) {
    await generateAndUpload(`${PREFIX}/closings/${id}.mp3`, text, force);
  }

  // Chapter numbers (50)
  console.log("\nChapter numbers (50):");
  for (let ch = 1; ch <= 50; ch++) {
    await generateAndUpload(
      `${PREFIX}/chapters/chapter-${ch}.mp3`,
      `Let's see what chapter ${ch} has in store.`,
      force,
    );
  }

  // Book intros
  const books = await getBookCatalog();
  if (books.length > 0) {
    console.log(`\nBook intros (${books.length}):`);
    for (const book of books) {
      await generateAndUpload(
        `${PREFIX}/books/${book.bookId}.mp3`,
        `${book.title} by ${book.author}.`,
        force,
      );
    }
  }

  console.log("\n=== Done! ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
