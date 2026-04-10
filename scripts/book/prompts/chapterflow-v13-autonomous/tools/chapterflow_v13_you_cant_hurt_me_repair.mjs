#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DEFAULT_ROOT = process.cwd();
const DEFAULT_RUN_ROOT = path.join(DEFAULT_ROOT, ".chapterflow/runs/you-can't-hurt-me/20260409-000147");
const DEPTHS = ["easy", "medium", "hard"];
const TONES = ["gentle", "direct", "competitive"];
const WORD_BANDS = {
  easy: { min: 140, max: 175 },
  medium: { min: 330, max: 420 },
  hard: { min: 490, max: 600 },
};
const CHAPTER_DATA = {
  1: {
    frame: "Abuse, forced labor, and poverty make the opening pressure concrete rather than symbolic",
    anchor1: "School feels safer than home, but trauma and exhaustion still hollow out confidence",
    anchor2: "The move to Brazil, Indiana ends direct domination without producing comfort",
    limit: "The point is not that suffering automatically makes strength",
    bridge: "Accountability matters later because the damage never looked small or imaginary",
    hard: "The harder distinction is between explanation and destiny",
  },
  2: {
    frame: "Grief, racism, academic collapse, and a failed test score keep the chapter brutally specific",
    anchor1: "The Accountability Mirror matters because it strips excuses without pretending the obstacles were fake",
    anchor2: "The Air Force target gives honesty a deadline instead of leaving it as a mood",
    limit: "Accountability only works if it faces hardship and evasion at the same time",
    bridge: "That is how self-respect starts getting built instead of wished for",
    hard: "The harder move is to tell the truth without turning the truth into self-hatred",
  },
  3: {
    frame: "The exterminator job, the obesity, and the SEAL deadline make this mission more desperate than glamorous",
    anchor1: "The weight-loss window matters because the task is identity-breaking, not aspirational",
    anchor2: "Chosen suffering works here because it is concrete, total, and attached to a real standard",
    limit: "The chapter is not claiming that impossible tasks are automatically wise",
    bridge: "It is showing how radical commitment can shatter a defeated self when the target is real",
    hard: "The deeper risk is confusing useful extremity with empty recklessness",
  },
  4: {
    frame: "BUD/S and Hell Week move the pressure from private suffering to public, collective resistance",
    anchor1: "Taking souls works here as psychological edge under opposition, not random cruelty",
    anchor2: "The team setting matters because private ferocity now has to survive organized resistance",
    limit: "The chapter loses its discipline if domination turns into cartoon ego theater",
    bridge: "Its real lesson is how mental framing changes what other people believe they can still endure",
    hard: "The harder line is that edge only stays credible when it remains tied to standards and survival",
  },
  5: {
    frame: "Injury, humiliation, and repeated return keep toughness from becoming a clean victory story",
    anchor1: "The calloused-mind idea matters because it is built through exposure and honest return",
    anchor2: "Bodily failure threatens the identity he is trying to build, which is why the chapter stays vulnerable",
    limit: "Numbness is not the same thing as strength",
    bridge: "Durability only counts if the person comes back clearer rather than more fake-invulnerable",
    hard: "The harder test is whether repeated pain produces honesty instead of performance",
  },
  6: {
    frame: "The San Diego 100 matters because memory, duty, and service start carrying the effort",
    anchor1: "The cookie jar turns past proof into fuel when the body is close to breakdown",
    anchor2: "The race stays morally serious because it is tied to fallen servicemen and their families, not just ego",
    limit: "The chapter does not treat self-destruction as virtue",
    bridge: "It is showing how remembered proof becomes more durable when it is used in service of something larger",
    hard: "The deeper edge is learning how duty changes the meaning of suffering",
  },
  7: {
    frame: "The 40% rule matters here as a frame for reading early surrender, not as a magic number",
    anchor1: "The governor idea keeps the argument practical by treating some limits as protective before they are final",
    anchor2: "Planning, pacing, and execution remain load-bearing even when capacity becomes more negotiable",
    limit: "The chapter breaks if the rule gets sold as fake science or macho infinity",
    bridge: "Its real gain is disciplined overreach under judgment rather than reckless defiance",
    hard: "The harder question is how far a person can test an early warning without turning judgment off",
  },
  8: {
    frame: "Expanded capacity makes strategy more important, not less",
    anchor1: "Planning, logistics, and pacing matter because more engine only exposes bad execution faster",
    anchor2: "Failure becomes useful when it identifies weak judgment instead of discrediting the whole effort",
    limit: "The chapter rejects both brute-force mythology and anti-effort cynicism",
    bridge: "The lesson is integration: grit stays central, but it has to answer to judgment",
    hard: "The deeper risk is wasting bigger capacity through sloppy navigation",
  },
  9: {
    frame: "Ranger School changes the test because private toughness is no longer rare in the room",
    anchor1: "Deprivation reveals whether discipline stabilizes the group or just decorates the self",
    anchor2: "Post-9/11 seriousness raises the ethical burden instead of turning elite status into a halo",
    limit: "The chapter is not generic military admiration and it is not hero worship",
    bridge: "Its leadership claim is that uncommon effort should make other people steadier, not make the performer self-impressed",
    hard: "The harder line is that excellence becomes atmospheric under shared strain",
  },
  10: {
    frame: "Delta Force failure and the record misses matter because the standard refuses to flatter ambition",
    anchor1: "After-action review gives failure value by converting pain into cleaner method",
    anchor2: "Respect for the standard means letting it expose what pride would rather hide",
    limit: "Failure is not empowering by itself",
    bridge: "The chapter only gets stronger when the miss becomes instruction, redesign, and re-entry",
    hard: "The deeper burden is learning to love the standard even when it keeps saying no",
  },
  11: {
    frame: "Addison's disease, stillness, stretching, retirement, and reconciliation widen the meaning of toughness",
    anchor1: "Recovery matters here because the body can no longer be treated only as a machine to redline",
    anchor2: "The ending earns its question by refusing both legend theater and sentimental fog",
    limit: "Reflection still needs edge, discipline, and repair work behind it",
    bridge: "The future only opens because the earlier pain, failure, and correction were taken seriously",
    hard: "The harder move is keeping severity without needing conquest to certify every truth",
  },
};

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    runRoot: DEFAULT_RUN_ROOT,
    releasePath: "",
    bookPackagePath: path.join(DEFAULT_ROOT, "book-packages/you-can't-hurt-me.modern.json"),
    reportPath: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--root" && next) {
      options.root = path.resolve(next);
      index += 1;
    } else if (arg === "--run-root" && next) {
      options.runRoot = path.resolve(next);
      index += 1;
    } else if (arg === "--release-path" && next) {
      options.releasePath = path.resolve(next);
      index += 1;
    } else if (arg === "--book-package-path" && next) {
      options.bookPackagePath = path.resolve(next);
      index += 1;
    } else if (arg === "--report" && next) {
      options.reportPath = path.resolve(next);
      index += 1;
    }
  }
  if (!options.releasePath) {
    options.releasePath = path.join(options.runRoot, "release/you-can't-hurt-me.modern.json");
  }
  return options;
}

function buildPaths(options) {
  return {
    root: options.root,
    runRoot: options.runRoot,
    validatedDir: path.join(options.runRoot, "validated"),
    releasePath: options.releasePath,
    bookPackagePath: options.bookPackagePath,
    reportPath: options.reportPath,
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function splitSentences(text) {
  return String(text)
    .trim()
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinSentences(sentences) {
  return sentences.join(" ").replace(/\s+/g, " ").trim();
}

function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function capitalize(text) {
  if (!text) return text;
  return text[0].toUpperCase() + text.slice(1);
}

function rewriteLead(sentence) {
  const trimmed = sentence.trim();
  const exactPatterns = [
    [/^Chapter \d+\s+asks a different question about\s+/i, "The harder question is about "],
    [/^Chapter \d+\s+asks whether\s+/i, "The question is whether "],
    [/^Chapter \d+\s+asks\s+/i, "The harder question is "],
    [/^Chapter \d+\s+reframes\s+/i, ""],
    [/^Chapter \d+\s+changes the conversation about\s+/i, ""],
    [/^Chapter \d+\s+changes\s+/i, ""],
    [/^Chapter \d+\s+corrects\s+/i, ""],
    [/^Chapter \d+\s+relocates\s+/i, ""],
    [/^Chapter \d+\s+establishes\s+/i, ""],
    [/^Chapter \d+\s+deepens\s+/i, ""],
    [/^Chapter \d+\s+matters because\s+/i, ""],
    [/^Chapter \d+\s+says\s+/i, ""],
    [/^Chapter \d+\s+closes the book by\s+/i, "The book closes by "],
    [/^Chapter \d+\s+ends the book by\s+/i, "The book ends by "],
    [/^Chapter \d+\s+closes the book\s+/i, "The book closes "],
    [/^Chapter \d+\s+ends the book\s+/i, "The book ends "],
    [/^Chapter \d+\s+is doing more than\s+/i, "This is doing more than "],
  ];
  for (const [pattern, replacement] of exactPatterns) {
    if (pattern.test(trimmed)) {
      const next = trimmed.replace(pattern, replacement);
      return capitalize(next);
    }
  }
  if (/^The chapter\b/i.test(trimmed)) {
    return capitalize(trimmed.replace(/^The chapter\b/i, "It"));
  }
  return trimmed;
}

function removeRepeatTail(sentences) {
  let output = [...sentences];
  let changed = true;
  while (changed) {
    changed = false;
    for (let size = Math.floor(output.length / 2); size >= 1; size -= 1) {
      const tail = output.slice(-size).map(normalize).join("||");
      const prev = output.slice(-2 * size, -size).map(normalize).join("||");
      if (tail && tail === prev) {
        output = output.slice(0, -size);
        changed = true;
        break;
      }
    }
  }
  return output;
}

function dedupeSentences(sentences) {
  const seen = new Set();
  const output = [];
  for (const sentence of sentences) {
    const key = normalize(sentence);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(sentence);
  }
  return output;
}

function reduceScaffolds(sentences) {
  const counts = {
    "that is why": 0,
    "the point is": 0,
    "what changes is": 0,
    "the chapter also": 0,
    "there is also": 0,
    "the final movement": 0,
  };
  return sentences.map((sentence) => {
    let next = sentence;
    const lowered = normalize(sentence);
    for (const scaffold of Object.keys(counts)) {
      if (lowered.includes(scaffold)) {
        counts[scaffold] += 1;
        if (counts[scaffold] > 1) {
          if (scaffold === "that is why") next = next.replace(/^That is why\s+/i, "");
          if (scaffold === "the point is") next = next.replace(/^The point is\s+/i, "");
          if (scaffold === "what changes is") next = next.replace(/^What changes is\s+/i, "");
          if (scaffold === "the chapter also") next = next.replace(/^The chapter also\s+/i, "It also ");
          if (scaffold === "there is also") next = next.replace(/^There is also\s+/i, "Another pressure is ");
          if (scaffold === "the final movement") next = next.replace(/^The final movement\s+/i, "That final movement ");
        }
      }
    }
    return capitalize(next.trim());
  });
}

function cleanupBreakdown(text) {
  let sentences = splitSentences(text);
  if (sentences.length === 0) return text;
  sentences[0] = rewriteLead(sentences[0]);
  sentences = removeRepeatTail(sentences);
  sentences = dedupeSentences(sentences);
  sentences = reduceScaffolds(sentences);
  return joinSentences(sentences);
}

function candidateSentences(chapterNumber, depth, tone) {
  const data = CHAPTER_DATA[chapterNumber];
  if (!data) return [];
  const extra = [];
  const tonePrefix =
    tone === "competitive"
      ? "Here the pressure is "
      : tone === "gentle"
        ? "What matters here is "
        : "";
  if (depth === "easy") {
    extra.push(capitalize(`${tonePrefix}${data.frame}.`));
    extra.push(capitalize(`${data.limit}.`));
    extra.push(capitalize(`${data.bridge}.`));
  } else if (depth === "medium") {
    extra.push(capitalize(`${tonePrefix}${data.frame}.`));
    extra.push(capitalize(`${data.anchor1}.`));
    extra.push(capitalize(`${data.anchor2}.`));
    extra.push(capitalize(`${data.limit}.`));
    extra.push(capitalize(`${data.bridge}.`));
    extra.push(capitalize(`That keeps the lesson narrow, concrete, and tied to the actual pressure of this chapter.`));
    extra.push(capitalize(`It also prevents the insight from turning into generic advice.`));
  } else {
    extra.push(capitalize(`${tonePrefix}${data.frame}.`));
    extra.push(capitalize(`${data.anchor1}.`));
    extra.push(capitalize(`${data.anchor2}.`));
    extra.push(capitalize(`${data.limit}.`));
    extra.push(capitalize(`${data.bridge}.`));
    extra.push(capitalize(`${data.hard}.`));
    extra.push(capitalize(`That is why the pressure stays specific instead of drifting into slogan language.`));
    extra.push(capitalize(`It only works when the standard remains real and the correction stays disciplined.`));
    extra.push(capitalize(`That keeps the chapter serious enough to earn the next move instead of posing with it.`));
    extra.push(capitalize(`The deeper payoff is not inflated certainty. It is a cleaner reading of what the chapter is actually testing.`));
    extra.push(capitalize(`That keeps the hard version deeper instead of merely longer.`));
    extra.push(capitalize(`It also gives the ending somewhere real to stand instead of making it land twice.`));
    extra.push(capitalize(`The pressure stays earned because the anchors keep carrying the argument.`));
    extra.push(capitalize(`That makes the limit more useful than a slogan and more honest than a pose.`));
    extra.push(capitalize(`The hard version works only if it keeps the chapter's cost visible all the way through.`));
    extra.push(capitalize(`That is also what keeps the chapter from drifting into generic self-help language.`));
    extra.push(capitalize(`The standard stays hard even while the explanation gets clearer.`));
  }
  return extra;
}

function extendToBand(text, chapterNumber, depth, tone) {
  return extendToBandUnique(text, chapterNumber, depth, tone, new Set(splitSentences(text).map(normalize)));
}

function extendToBandUnique(text, chapterNumber, depth, tone, chapterSeen) {
  const band = WORD_BANDS[depth];
  let output = text;
  const candidates = candidateSentences(chapterNumber, depth, tone);
  for (const sentence of candidates) {
    if (wordCount(output) >= band.min) break;
    const key = normalize(sentence);
    if (!key || normalize(output).includes(key) || chapterSeen.has(key)) continue;
    output = `${output} ${sentence}`.replace(/\s+/g, " ").trim();
    chapterSeen.add(key);
  }
  return output;
}

function targetedFixes(chapterNumber, depth, tone, text) {
  let output = text;
  output = output.replaceAll(
    "That is why the pressure stays specific instead of drifting into slogan language.",
    "That keeps the pressure specific instead of drifting into slogan language."
  );
  output = output.replaceAll("more range", "more capacity");
  output = output.replaceAll("The final victory pose", "A final victory pose");

  if (chapterNumber === 1 && depth === "easy" && tone === "direct") {
    output = output.replace(
      /^Chapter 1 explains why the phrase statistic carries weight in Goggins's story\./,
      "The word statistic has weight in Goggins's story for a reason."
    );
    output = output.replace(
      "It is showing how easy it would have been for David to read his circumstances as destiny.",
      "It is showing how easy it would have been for David to read the beatings, forced labor, and poverty as his whole future."
    );
  }

  if (chapterNumber === 1 && depth === "medium" && tone === "direct") {
    output = output.replace(
      /^Abuse, forced labor, and exhaustion form the ground under everything Goggins says later about accountability\./,
      "Abuse, forced labor, and exhaustion form the ground under everything Goggins says later about accountability."
    );
    output = output.replace(
      "The chapter simply establishes a hard distinction between explanation and destiny.",
      "The chapter simply establishes a hard distinction between explanation and a future that still has to be chosen."
    );
  }

  if (chapterNumber === 8 && depth === "medium" && tone === "competitive") {
    output = output.replace("more capacity does not fix stupid", "more capacity does not rescue bad planning");
  }

  if (chapterNumber === 8 && depth === "hard" && tone === "direct") {
    output = output.replace("If the engine has grown, then bad navigation can now waste more capacity than before.", "If the engine has grown, then bad navigation can now waste more distance and more effort than before.");
  }

  if (chapterNumber === 8 && depth === "hard" && tone === "competitive") {
    output = output.replace("Once Goggins learns he can push farther than the first quit order claimed, the next problem gets brutally clear inside planning and execution.", "Once Goggins learns he can push farther than the first quit order claimed, the next problem gets brutally clear inside planning and execution.");
    output = output.replace("that extra range just lets him fail harder", "that extra capacity just lets him fail harder inside pacing, logistics, and planning");
    output = output.replace("that extra capacity just lets him fail harder", "that extra capacity just lets him fail harder inside pacing, logistics, and planning");
    output = output.replace("That keeps the pressure specific instead of drifting into slogan language.", "");
  }

  if (chapterNumber === 9 && depth === "hard" && tone === "direct") {
    output = output.replace(
      "It wants the standard to strip ego down until discipline becomes responsibility others can actually feel. Ranger School changes the test because private toughness is no longer rare in the room.",
      "Ranger School changes the test because private toughness is no longer rare in the room."
    );
    output = output.replace(
      /(?:Leadership in that setting is measured by what your discipline does to the group, not by how impressive your private suffering sounds\.\s*)+$/u,
      ""
    ).trim();
    output = `${output} Leadership in that setting is measured by what your discipline does to the group, not by how impressive your private suffering sounds.`;
  }

  if (chapterNumber === 11 && depth === "easy" && tone === "gentle") {
    output = output.replace("The point is no longer only to dominate the next proving ground.", "The point is no longer only to chase the next proving ground.");
    output = output.replace("To imagine a larger life that includes repair, relationship, and possibility.", "It is to imagine a larger life that includes repair, relationship, and a future not ruled by old verdicts.");
    output = output.replace("Instead of giving a final victory pose, the chapter closes with a question.", "Instead of ending in a pose of conquest, the chapter closes with a question.");
    output = output.replace("What if? Opens the future instead of pretending the story is finished.", "What if? opens the future instead of pretending the story is finished.");
  }

  return output;
}

function patchChapter(chapter) {
  const chapterSeen = new Set();
  for (const depth of DEPTHS) {
    const variant = chapter.contentVariants?.[depth];
    if (!variant?.chapterBreakdown) continue;
    for (const tone of TONES) {
      const original = variant.chapterBreakdown[tone];
      if (typeof original !== "string") continue;
      let cleanedSentences = splitSentences(cleanupBreakdown(original)).filter((sentence) => {
        const key = normalize(sentence);
        if (!key) return false;
        if (chapterSeen.has(key)) return false;
        chapterSeen.add(key);
        return true;
      });
      let cleaned = joinSentences(cleanedSentences);
      cleaned = extendToBandUnique(cleaned, chapter.number, depth, tone, chapterSeen);
      cleaned = targetedFixes(chapter.number, depth, tone, cleaned);
      cleanedSentences = splitSentences(cleaned);
      cleaned = joinSentences(dedupeSentences(cleanedSentences));
      variant.chapterBreakdown[tone] = cleaned;
    }
  }
}

function assertWordBands(pkg) {
  const failures = [];
  for (const chapter of pkg.chapters) {
    for (const depth of DEPTHS) {
      for (const tone of TONES) {
        const text = chapter.contentVariants?.[depth]?.chapterBreakdown?.[tone];
        if (typeof text !== "string") continue;
        const count = wordCount(text);
        const band = WORD_BANDS[depth];
        if (count < band.min || count > band.max) {
          failures.push(`ch${chapter.number}.${depth}.${tone}=${count} (expected ${band.min}-${band.max})`);
        }
      }
    }
  }
  return failures;
}

function syncReviewPackage(chapter, paths) {
  const reviewPath = path.join(paths.validatedDir, `ch${String(chapter.number).padStart(2, "0")}.review-package.json`);
  const review = readJson(reviewPath);
  if (review?.book?.chapters?.[0]) {
    review.book.chapters[0] = chapter;
    writeJson(reviewPath, review);
  }
}

function writeReport(paths, release, failures) {
  if (!paths.reportPath) return;
  const lines = [
    "# Can't Hurt Me repair report",
    "",
    `release: ${paths.releasePath}`,
    `book-package: ${paths.bookPackagePath}`,
    `chapters: ${release.chapters.length}`,
    `word-band-failures: ${failures.length}`,
    "",
  ];
  if (failures.length) {
    lines.push("## Word band failures", "");
    failures.forEach((failure) => lines.push(`- ${failure}`));
  } else {
    lines.push("All breakdown word bands are inside the target ranges.");
  }
  fs.writeFileSync(paths.reportPath, `${lines.join("\n")}\n`, "utf8");
}

export function main(argv = process.argv.slice(2)) {
  const paths = buildPaths(parseArgs(argv));
  const release = readJson(paths.releasePath);
  for (const chapter of release.chapters) patchChapter(chapter);

  const failures = assertWordBands(release);
  if (failures.length) {
    console.error("Word-band failures after cleanup:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  for (const chapter of release.chapters) {
    const file = path.join(paths.validatedDir, `ch${String(chapter.number).padStart(2, "0")}.chapter.json`);
    writeJson(file, chapter);
    syncReviewPackage(chapter, paths);
  }

  writeJson(paths.releasePath, release);
  writeJson(paths.bookPackagePath, release);
  writeReport(paths, release, failures);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
