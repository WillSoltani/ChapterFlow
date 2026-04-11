#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  ANTIFRAGILE_AUTHOR,
  ANTIFRAGILE_BOOK_ID,
  ANTIFRAGILE_TITLE,
  buildAntifragileBookMetadata,
} from "../../../antifragile-book-contract.mjs";

const DEFAULT_ROOT = process.cwd();
const DEFAULT_RUN_ROOT = path.join(DEFAULT_ROOT, ".chapterflow/runs/antifragile/20260410-153130");
const TONES = ["gentle", "direct", "competitive"];

const BRIDGE_DIRECT = {
  1: "Once the triad is visible, the next move is to show why some systems overreact and strengthen instead of merely enduring.",
  2: "Once overreaction can strengthen a system, the next move is to show that pattern in ordinary, concrete life rather than in theory alone.",
  3: "Once bounded stress can help in ordinary life, the next move is to ask why some harms strengthen the larger system even when they destroy the part.",
  4: "Once some losses strengthen the larger order, the next move is to contrast bottom-up trial and error with top-down fragility.",
  5: "Once local trial and error outruns central design, the next move is to clarify why some randomness deserves to stay in the system.",
  6: "Once some randomness is useful, the next move is to draw the line between beneficial variation and naive intervention.",
  7: "Once intervention is shown to create hidden fragility, the next move is to ask why modern prediction keeps overestimating its own reach.",
  8: "Once prediction is cut down to size, the next move is to compare polished abstraction with consequence-bearing judgment.",
  9: "Once consequence-bearing judgment outranks prestige, the next move is to frame upside, downside, and survival directly.",
  10: "Once upside and downside are explicit, the next move is to build a structure that keeps ruin clipped while upside stays alive.",
  11: "Once concentrated downside is rejected, the next move is to show why open favorable exposure beats narrow prestige bets.",
  12: "Once optionality is in place, the next move is to show why practice and tinkering can discover value before theory fully arrives.",
  13: "Once practice beats elegant prediction, the next move is to expose how neat labels flatten real structural difference.",
  14: "Once false sameness is visible in the present, the next move is to show how history cleans the mess even more after the fact.",
  15: "Once hindsight is shown to flatten reality, the next move is to recover what direct trial and bounded disorder teach more honestly.",
  16: "Once disorder becomes a teacher instead of a stain, the next move is to restate the book's argument in a direct fight over practice, theory, and payoff.",
  17: "Once payoff-sensitive judgment is defended directly, the next move is to show why equal totals can still hide unequal effects.",
  18: "Once equal totals are shown to hide unequal effects, the next move is to test intervention under nonlinear and opaque consequences.",
  19: "Once nonlinear harm is visible, the next move is to ask how time filters hidden fragility from durable survival.",
  20: "Once time becomes the filter for fragility, the next move is to revisit intervention where convex harm and opacity make confidence dangerous.",
  21: "Once hidden downside is centered, the next move is to favor subtraction over additive fixes when longevity is at stake.",
  22: "Once subtraction becomes the safer logic under opacity, the next move is to ask who bears the downside when risk is introduced.",
  23: "Once shared downside becomes the ethical core, the next move is to fit that exposure logic to professions instead of leaving it abstract.",
  24: "Once ethics is tied back to exposure, the conclusion can gather fragility, optionality, time, and intervention into one final discipline.",
};

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    runRoot: DEFAULT_RUN_ROOT,
    bookPackagePath: path.join(DEFAULT_ROOT, "book-packages", `${ANTIFRAGILE_BOOK_ID}.modern.json`),
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root" && argv[index + 1]) {
      options.root = path.resolve(argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--run-root" && argv[index + 1]) {
      options.runRoot = path.resolve(argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--book-package-path" && argv[index + 1]) {
      options.bookPackagePath = path.resolve(argv[index + 1]);
      index += 1;
    }
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function shaFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function squeeze(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([?!.,;:])/g, "$1")
    .trim();
}

function ensureSentence(text) {
  const compact = squeeze(text);
  if (!compact) return compact;
  if (/[?!.]$/.test(compact)) return compact;
  return `${compact}.`;
}

function lcFirst(text) {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function normalizeChapterBook() {
  return {
    bookId: ANTIFRAGILE_BOOK_ID,
    title: ANTIFRAGILE_TITLE,
    author: ANTIFRAGILE_AUTHOR,
  };
}

function toneBridgeTriplet(chapterNumber) {
  const direct = ensureSentence(BRIDGE_DIRECT[chapterNumber] ?? "The next move keeps the same payoff logic but makes the structure more explicit.");
  return {
    gentle: ensureSentence(`The handoff is simple: ${lcFirst(direct)}`),
    direct,
    competitive: ensureSentence(`The next pressure is simple: ${lcFirst(direct)}`),
  };
}

function reviewBackTriplet(base, index) {
  const direct = ensureSentence(base);
  const gentleLeads = [
    "Keep in view that",
    "Notice that",
    "The practical point is that",
    "The limit is that",
    "The handoff is that",
  ];
  const competitiveLeads = [
    "The bill is simple:",
    "The edge is simple:",
    "The trap is simple:",
    "The limit is simple:",
    "The next move is simple:",
  ];
  return {
    gentle: ensureSentence(`${gentleLeads[index] ?? "Keep in view that"} ${lcFirst(direct)}`),
    direct,
    competitive: ensureSentence(`${competitiveLeads[index] ?? "The edge is simple:"} ${lcFirst(direct)}`),
  };
}

function questionTriplet(base) {
  const direct = squeeze(base)
    .replace(/^What is the chapter's /i, "What is the ")
    .replace(/^What is the chapter /i, "What is the ")
    .replace(/^How does the chapter /i, "How does this ")
    .replace(/^How does Chapter \d+ /i, "How does this ")
    .replace(/^How does this chapter /i, "How does this ")
    .replace(/^What limit keeps the chapter /i, "What limit keeps this ")
    .replace(/^What does the chapter /i, "What does this ")
    .replace(/^What is the chapter's main /i, "What is the main ")
    .replace(/^What is the chapter's central /i, "What is the central ");

  let gentle = squeeze(direct)
    .replace(/^What is the main claim about /i, "What matters most about ")
    .replace(/^What is the main warning about /i, "What warning matters most about ")
    .replace(/^What is the main warning/i, "What warning matters most")
    .replace(/^What is the central contrast/i, "What contrast matters most")
    .replace(/^How does this lead into /i, "What does this hand off to ")
    .replace(/^How does this prepare /i, "What does this prepare ");

  let competitive = squeeze(direct)
    .replace(/^What is the main claim about /i, "What decides the argument about ")
    .replace(/^What is the main warning about /i, "Where does ")
    .replace(/^What is the main warning/i, "Where is the trap")
    .replace(/^What is the central contrast/i, "What contrast decides the argument")
    .replace(/^How does this lead into (.+)\?$/i, "Why does $1 come next?")
    .replace(/^How does this prepare (.+)\?$/i, "Why does $1 come next?")
    .replace(/^What limit keeps this /i, "What stops this ");

  if (gentle === direct) {
    if (/^Why /i.test(direct)) {
      gentle = direct.replace(/\?$/, " in practical terms?");
    } else if (/^How /i.test(direct)) {
      gentle = direct.replace(/\?$/, " in practical terms?");
    } else if (/^What /i.test(direct)) {
      gentle = direct.replace(/\?$/, " in practical terms?");
    }
  }

  if (competitive === direct || competitive === gentle) {
    if (/^Why /i.test(direct)) {
      competitive = direct.replace(/^Why /i, "Why, exactly, ");
    } else if (/^How /i.test(direct)) {
      competitive = direct.replace(/^How /i, "How, exactly, ");
    } else if (/^What /i.test(direct)) {
      competitive = direct.replace(/^What /i, "What, exactly, ");
    }
  }

  return {
    gentle: gentle.endsWith("?") ? gentle : `${gentle}?`,
    direct: direct.endsWith("?") ? direct : `${direct}?`,
    competitive: competitive.endsWith("?") ? competitive : `${competitive}?`,
  };
}

function normalizeIfThenPlans(chapter) {
  const plan = chapter?.implementationPlan;
  if (!plan || !Array.isArray(plan.ifThenPlans)) return;
  plan.ifThenPlans = plan.ifThenPlans.map((item, index) => {
    if (item?.context && item?.plan) {
      return item;
    }
    if (item?.cue && item?.response) {
      return {
        context: squeeze(item.cue).replace(/,\s*$/, ""),
        plan: item.response,
      };
    }
    return {
      context: `context ${index + 1}`,
      plan: item?.plan ?? item?.response ?? {
        gentle: "I will slow down and inspect the downside before I move.",
        direct: "I will inspect the payoff shape before I commit.",
        competitive: "I will not let a neat story hide the bill.",
      },
    };
  });
}

function normalizeReviewCards(chapter) {
  if (!Array.isArray(chapter.reviewCards)) return;
  chapter.reviewCards = chapter.reviewCards.map((card, index) => {
    const regenerateLateFront = chapter.number >= 11;
    const directFront = typeof card?.front === "string" ? card.front : card?.front?.direct ?? card?.front?.gentle ?? card?.front?.competitive ?? "What matters here?";
    const directBack = typeof card?.back === "string" ? card.back : card?.back?.direct ?? card?.back?.gentle ?? card?.back?.competitive ?? "The chapter keeps payoff and consequence visible.";
    const normalizedFront = questionTriplet(directFront);
    const normalized = {
      cardId: card?.cardId ?? `ch${String(chapter.number).padStart(2, "0")}-rc${String(index + 1).padStart(2, "0")}`,
      difficulty: card?.difficulty ?? (index < 2 ? "easy" : index < 4 ? "medium" : "hard"),
      // Earlier repair passes converted some late-card fronts into stale tone objects with identical text.
      // Rebuild those fronts deterministically from the direct prompt on every rerun.
      front: regenerateLateFront ? normalizedFront : (typeof card?.front === "object" && card?.front?.direct ? card.front : normalizedFront),
      back: typeof card?.back === "object" && card?.back?.direct ? card.back : reviewBackTriplet(directBack, index),
    };
    return normalized;
  });
  if (chapter.reviewCards[4]) {
    chapter.reviewCards[4].back = toneBridgeTriplet(chapter.number);
  }
}

function normalizeBookMetadataForScope(bookMetadata, chapterRange) {
  return {
    ...bookMetadata,
    chapterRange,
  };
}

function normalizeChapter(chapter) {
  chapter.book = normalizeChapterBook();
  normalizeIfThenPlans(chapter);
  normalizeReviewCards(chapter);
  if (chapter?.contentVariants?.medium?.oneMinuteRecap?.preview) {
    const preview = chapter.contentVariants.medium.oneMinuteRecap.preview;
    if (typeof preview === "object") {
      const bridge = toneBridgeTriplet(chapter.number);
      chapter.contentVariants.medium.oneMinuteRecap.preview = {
        gentle: preview.gentle || bridge.gentle,
        direct: preview.direct || bridge.direct,
        competitive: preview.competitive || bridge.competitive,
      };
    }
  }
  if (chapter?.number === 16) {
    const details = chapter?.contentVariants?.hard?.keyTakeaways?.[3]?.moreDetails;
    if (details?.gentle) {
      details.gentle = "The limit matters because bounded failure can teach, while wreckage only destroys the conditions for learning.";
    }
  }
  return chapter;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const runRoot = options.runRoot;
  const validatedDir = path.join(runRoot, "validated");
  const structuredDir = path.join(runRoot, "structured");
  const releasePath = path.join(runRoot, "release", `${ANTIFRAGILE_BOOK_ID}.modern.json`);
  const continuityPath = path.join(runRoot, "continuity", "continuity-state.json");
  const editionLock = readJson(path.join(runRoot, "manifests", "edition-lock.json"));
  const sourceLedger = readJson(path.join(runRoot, "manifests", "source-ledger.json"));
  const manifest = readJson(path.join(runRoot, "manifests", "run-manifest.json"));
  const validatedFiles = fs.readdirSync(validatedDir).filter((file) => /^ch\d+\.chapter\.json$/.test(file)).sort();
  const fullBook = buildAntifragileBookMetadata({
    editionLock,
    sourceLedger,
    chapterRange: `Chapters 1-${validatedFiles.length}`,
  });
  const chapters = [];

  validatedFiles.forEach((file) => {
    const chapterPath = path.join(validatedDir, file);
    const chapter = normalizeChapter(readJson(chapterPath));
    writeJson(chapterPath, chapter);
    writeJson(path.join(structuredDir, file), chapter);
    const reviewPackage = {
      schemaVersion: "1.1.0",
      packageId: `${ANTIFRAGILE_BOOK_ID}-${file.replace(".chapter.json", "")}-review`,
      createdAt: manifest?.lockedAt ?? editionLock?.lockedAt ?? new Date().toISOString(),
      contentOwner: "ChapterFlow v13 Autonomous",
      book: normalizeBookMetadataForScope(fullBook, `Chapter ${chapter.number}`),
      chapters: [chapter],
    };
    writeJson(path.join(validatedDir, file.replace(".chapter.json", ".review-package.json")), reviewPackage);
    chapters.push(chapter);
  });

  const releasePayload = {
    schemaVersion: "1.1.0",
    packageId: `${ANTIFRAGILE_BOOK_ID}-${manifest.runId}`,
    createdAt: manifest?.lockedAt ?? editionLock?.lockedAt ?? new Date().toISOString(),
    contentOwner: "ChapterFlow v13 Autonomous",
    book: fullBook,
    chapters,
  };
  writeJson(releasePath, releasePayload);
  writeJson(options.bookPackagePath, releasePayload);

  const continuity = readJson(continuityPath);
  continuity.approvedChapterHashes = {};
  validatedFiles.forEach((file) => {
    continuity.approvedChapterHashes[file.replace(".chapter.json", "")] = shaFile(path.join(validatedDir, file));
  });
  writeJson(continuityPath, continuity);

  console.log(`repaired ${chapters.length} chapters for ${ANTIFRAGILE_BOOK_ID}`);
}

main();
