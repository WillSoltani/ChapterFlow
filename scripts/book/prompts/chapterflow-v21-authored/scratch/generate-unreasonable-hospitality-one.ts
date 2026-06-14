import { generateChapter } from "../src/generateChapter.js";

const n = Number(process.argv[2] ?? "1");
if (!Number.isInteger(n) || n < 1 || n > 20) {
  console.error("Usage: npx tsx scratch/generate-unreasonable-hospitality-one.ts <1-20>");
  process.exit(2);
}

const titles = [
  "Welcome to the Hospitality Economy",
  "Making Magic in a World That Could Use More of It",
  "The Extraordinary Power of Intention",
  "Lessons in Enlightened Hospitality",
  "Restaurant-Smart vs. Corporate-Smart",
  "Pursuing a True Partnership",
  "Setting Expectations",
  "Breaking Rules and Building a Team",
  "Working with Purpose, on Purpose",
  "Creating a Culture of Collaboration",
  "Pushing Toward Excellence",
  "Relationships Are Simple. Simple Is Hard.",
  "Leveraging Affirmation",
  "Restoring Balance",
  "The Best Offense Is Offense",
  "Earning Informality",
  "Learning to Be Unreasonable",
  "Improvisational Hospitality",
  "Scaling a Culture",
  "Back to Basics",
];

async function main() {
  await generateChapter(
    {
      bookId: "unreasonable-hospitality",
      title: "Unreasonable Hospitality",
      author: "Will Guidara",
    },
    {
      chapterId: `unreasonable-hospitality-ch${String(n).padStart(2, "0")}`,
      chapterNumber: n,
      chapterTitle: titles[n - 1],
    },
    {
      candidatesPerSlot: 2,
      voicePassMaxIterations: 2,
    },
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
