/**
 * Pre-generate all reusable audio narration segments and upload to S3.
 *
 * Usage:
 *   AWS_REGION=us-east-1 OPENAI_API_KEY="..." BOOK_CONTENT_BUCKET="..." npx tsx scripts/audio/generate-segments.ts
 *   Add --force to regenerate all segments (even if already cached in S3)
 *
 * Generates:
 *   - 1 silence clip (1.5s lead-in)
 *   - 15 greeting clips (5 contextual + 10 generic)
 *   - 22 score callout clips
 *   - 12 transition clips (2 contextual + 10 generic)
 *   - 14 closing clips (4 contextual + 10 generic)
 *   - 50 chapter number clips
 *   - 1 book intro clip per book in the catalog
 *   Total: ~114 + N books
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const BUCKET = process.env.BOOK_CONTENT_BUCKET!;
const VOICE = "nova";
const MODEL = "tts-1-hd";
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

// ── Segment definitions (matching audio-narration.ts) ────────────────

const GREETINGS: Record<string, string> = {
  "ctx-first-ever": "This is your very first chapter — and honestly, you picked a great book to start with. Let's get into",
  "ctx-new-book": "New book! Fresh start. Let's see what's in",
  "ctx-returning": "It's been a minute... but you're back, and that's what matters. Let's pick things up with",
  "ctx-hot-streak": "You've been showing up every single day — that kind of consistency is rare, you know? Let's keep it going with",
  "ctx-weekend": "Weekend reading? Love to see it. Let's make it count with",
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

const SCORES: Record<string, string> = {
  "first-chapter": "This is your first chapter — so let's set the bar high.",
  "score-70": "You scored 70 percent on the last chapter. Hey — you made it through, and that's what counts.",
  "score-75": "You got 75 percent on the last chapter — solid. You're getting the hang of this.",
  "score-80": "80 percent on the last chapter — that's a strong score. You were paying attention.",
  "score-85": "85 percent on the last chapter — really well done. You're picking these ideas up fast.",
  "score-90": "You pulled 90 percent on the last chapter — that's impressive. You've clearly got a grip on this.",
  "score-95": "95 percent... seriously? That's hard to pull off. Nice work.",
  "score-100": "Perfect score on the last chapter — that's rare. Whatever you're doing, don't stop.",
  "score-100-improved": "Perfect score — and better than last time. You're on another level right now.",
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

const TRANSITIONS: Record<string, string> = {
  "ctx-challenge": "Here's what you need to know for the quiz — pay close attention, because these are the ideas that get tested.",
  "ctx-guided": "Let's walk through the key takeaways together. No rush — just take each one in.",
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

const CLOSINGS: Record<string, string> = {
  "ctx-last-chapter": "That's the final chapter. You just finished an entire book — and honestly, most people never make it this far. Go take the quiz, close it out, and grab your badge. You earned it.",
  "ctx-halfway": "You're halfway through the book! The second half is where everything starts clicking. Check out the examples or go take the quiz — your call.",
  "ctx-on-streak": "Another chapter down, another day on your streak. You keep this up? You'll be done with the book before you know it.",
  "ctx-late-night": "That's a wrap for tonight. Seriously — get some sleep. Your brain needs time to process all this. The quiz will be here tomorrow.",
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

// ── Book catalog ─────────────────────────────────────────────────────

async function getBookCatalog(): Promise<Array<{ bookId: string; title: string; author: string }>> {
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

  console.log(`=== Generating audio narration segments (model: ${MODEL}, voice: ${VOICE}) ===\n`);

  // Silence (1 clip)
  console.log("Silence lead-in (1):");
  await generateAndUpload(
    `${PREFIX}/silence/1500ms.mp3`,
    "...",
    force,
  );

  // Greetings (15)
  console.log("\nGreetings (15):");
  for (const [id, text] of Object.entries(GREETINGS)) {
    await generateAndUpload(`${PREFIX}/greetings/${id}.mp3`, text, force);
  }

  // Scores (22)
  console.log("\nScore callouts (22):");
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
      `Let's see what chapter ${ch} has for us.`,
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
