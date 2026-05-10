#!/usr/bin/env node

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  ANTIFRAGILE_AUTHOR,
  ANTIFRAGILE_BOUNDARY_EXPECTATIONS,
  ANTIFRAGILE_BRIDGE_EXPECTATIONS,
  ANTIFRAGILE_DEPTH_RULES,
  ANTIFRAGILE_SOFT_DRIFT_PHRASES,
  ANTIFRAGILE_TITLE,
  matchesAntifragilePackage,
} from "./antifragile-book-contract.mjs";

const CATEGORY_LABELS = {
  A: "package shape",
  B: "depth contract",
  C: "word counts",
  D: "examples",
  E: "quiz/supporting structures",
  F: "sealed integrity",
  G: "prose warnings",
};

const SEVERITY_ORDER = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  WARN: 4,
};

const FAILURE_SEVERITIES = new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
const SUPPORTED_SCHEMA_VERSIONS = new Set([
  "1.1.0",
  "chapterflow-v13-release",
  "chapterflow-v21-authored",
]);
const TONE_KEYS = ["gentle", "direct", "competitive"];
const SO_GOOD_GUIDED_CHAPTERS = new Set([2, 6, 10, 12, 14]);
const DEPTHS = ["easy", "medium", "hard"];
const CLAUSE_SCAFFOLDS = [
  "that is why",
  "the point is",
  "what changes is",
  "the chapter also",
  "there is also",
  "the final movement",
];
const PROSE_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "because", "but", "by", "for", "from",
  "how", "if", "in", "into", "is", "it", "of", "on", "or", "so", "that", "the",
  "their", "there", "this", "to", "was", "what", "when", "which", "with", "you", "your",
]);
const LEGACY_CANONICAL_FORMATS = [
  "decision_point",
  "postmortem",
  "dialogue",
  "predict_reveal",
  "dilemma",
  "before_after",
];
const V13_ALLOWED_FORMATS = [
  "decision_point",
  "postmortem",
  "dialogue",
  "predict_reveal",
  "audit",
  "dilemma",
  "before_after",
  "reset_moment",
  "planning_choice",
  "mistake_recovery",
  "synthesis_check",
  "inner_monologue",
  "contrast",
  "vignette",
];
const CONTAMINATION_PHRASES = [
  "keep the prose narrow and concrete",
  "the source is short and works by contrast",
  "used lazily, the point turns into",
  "keep this question alive",
  "one source pressure stays visible",
  "tied to the live constraint",
  "threshold question",
  "reading calibration",
  "unsupported zones",
  "motif watchlist",
  "sourceanchorpriority",
  "internal concept budget",
];
const PITCH_ANYTHING_BANNED_PHRASES = [
  "use it as a practical rule",
  "make it hold in the room",
  "that is the pressure tested edge",
  "that is the practical rule",
  "state the mechanism clearly",
  "use this as the practical mechanism behind the takeaway not as a slogan",
];
const GENERIC_PROMPT_PHRASES = [
  "answer in practical sequence terms",
  "make the room effect unmistakable",
  "what should this chapter alter",
  "what does this chapter change",
  "how does this make your next room",
];
const GENERIC_IMPLEMENTATION_PHRASES = [
  "start small and stay consistent",
  "be consistent every day",
  "track your progress",
  "reflect on what worked",
  "hold yourself accountable",
  "push yourself harder",
  "raise your standards",
];
const REINFORCEMENT_BANNED_OPENERS = [
  "this chapter",
  "the point is",
  "that is why",
];
const COMPETITIVE_SLOGAN_LEADS = [
  "the hard truth is",
  "real winners",
  "dominate the room",
  "become the machine",
];
const SO_GOOD_GENERIC_REVIEW_FRONTS = [
  "state the chapter's central mechanism",
  "which mistaken belief does newport break here",
];
const SO_GOOD_GENERIC_REVIEW_BACKS = [
  "the core mechanism is to",
  "newport is correcting a sequencing error",
];
const SO_GOOD_DIAGNOSTIC_MARKERS = new Set([
  "boundary", "cost", "evidence", "failure", "fragility", "leverage", "limit",
  "misread", "misreading", "resistance", "sequence", "sequencing", "signal",
  "support", "trade", "visibility",
]);
const SO_GOOD_COMPETITIVE_MARKERS = new Set([
  "cheap", "collapses", "consequence", "contact", "cost", "exposes", "fragile",
  "private", "signal", "trap", "visible", "weak",
]);

const DEPTH_RULES = {
  easy: {
    minTakeaways: 3,
    maxTakeaways: 3,
    minWords: 140,
    maxWords: 175,
    requireMoreDetails: false,
    requireActivationPrompt: false,
    requireSelfCheckPrompt: false,
    requireSelfCheckPrompts: false,
    requirePredictionPrompt: false,
    recapShape: "flat",
  },
  medium: {
    minTakeaways: 5,
    maxTakeaways: 6,
    minWords: 330,
    maxWords: 420,
    requireMoreDetails: true,
    requireActivationPrompt: true,
    requireSelfCheckPrompt: true,
    requireSelfCheckPrompts: false,
    requirePredictionPrompt: false,
    recapShape: "structured",
  },
  hard: {
    minTakeaways: 5,
    maxTakeaways: 7,
    minWords: 490,
    maxWords: 600,
    requireMoreDetails: true,
    requireActivationPrompt: true,
    requireSelfCheckPrompt: false,
    requireSelfCheckPrompts: true,
    requirePredictionPrompt: true,
    recapShape: "structured",
  },
};

const V13_AUTONOMOUS_DEPTH_RULES = {
  easy: {
    minTakeaways: 3,
    maxTakeaways: 3,
    minWords: 75,
    maxWords: 180,
    requireMoreDetails: false,
    requireActivationPrompt: false,
    requireSelfCheckPrompt: false,
    requireSelfCheckPrompts: false,
    requirePredictionPrompt: false,
    recapShape: "flat",
  },
  medium: {
    minTakeaways: 5,
    maxTakeaways: 6,
    minWords: 240,
    maxWords: 450,
    requireMoreDetails: true,
    requireActivationPrompt: true,
    requireSelfCheckPrompt: true,
    requireSelfCheckPrompts: false,
    requirePredictionPrompt: false,
    recapShape: "either",
  },
  hard: {
    minTakeaways: 5,
    maxTakeaways: 7,
    minWords: 280,
    maxWords: 650,
    requireMoreDetails: true,
    requireActivationPrompt: true,
    requireSelfCheckPrompt: false,
    requireSelfCheckPrompts: true,
    requirePredictionPrompt: false,
    recapShape: "either",
  },
};

function usage() {
  console.error("Usage: node scripts/book/validate-book.mjs <package-path>");
  process.exit(1);
}

if (process.argv.length !== 3) {
  usage();
}

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isToneObject(value) {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.length !== 3) return false;
  if (keys.join(",") !== TONE_KEYS.slice().sort().join(",")) return false;
  return TONE_KEYS.every((key) => isNonEmptyString(value[key]));
}

function hasGeneratedImplementationShape(value) {
  return isRecord(value) && (
    isToneObject(value.concreteAction) ||
    isToneObject(value.ifThenPlan) ||
    isToneObject(value.friction) ||
    isToneObject(value.checkpoint)
  );
}

function getPackageChapters(pkg) {
  return Array.isArray(pkg?.chapters) ? pkg.chapters : [];
}

function detectPackageProfile(pkg, inputPath = "") {
  if (matchesAntifragilePackage(pkg, inputPath)) return "antifragile";

  const chapters = getPackageChapters(pkg);
  let totalExamples = 0;
  let missingContexts = 0;
  let auditFormats = 0;
  let v13OnlyFormats = 0;
  let generatedQuizMetadata = 0;

  chapters.forEach((chapter) => {
    if (!Array.isArray(chapter?.examples)) return;
    chapter.examples.forEach((example) => {
      if (!isRecord(example)) return;
      totalExamples += 1;
      if (!Array.isArray(example.contexts) || example.contexts.length === 0) {
        missingContexts += 1;
      }
      if (example.format === "audit") {
        auditFormats += 1;
      }
      if (
        isNonEmptyString(example.format) &&
        !LEGACY_CANONICAL_FORMATS.includes(example.format) &&
        V13_ALLOWED_FORMATS.includes(example.format)
      ) {
        v13OnlyFormats += 1;
      }
    });

    if (Array.isArray(chapter?.quiz?.questions)) {
      chapter.quiz.questions.forEach((question) => {
        if (!isRecord(question)) return;
        if (
          isNonEmptyString(question.bloomsLevel) ||
          isNonEmptyString(question.depthLevel)
        ) {
          generatedQuizMetadata += 1;
        }
      });
    }
  });

  if (
    totalExamples > 0 &&
    (auditFormats > 0 || missingContexts === totalExamples || v13OnlyFormats > 0 || generatedQuizMetadata > 0)
  ) {
    return "v13_autonomous";
  }

  return "legacy";
}

function normalizeText(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function wordCount(value) {
  if (!isNonEmptyString(value)) return 0;
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function splitSentences(value) {
  if (!isNonEmptyString(value)) return [];
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function sentenceWindows(sentences, size = 3) {
  if (sentences.length < size) return [];
  const windows = [];
  for (let index = 0; index <= sentences.length - size; index += 1) {
    windows.push(sentences.slice(index, index + size).join(" ").trim());
  }
  return windows;
}

function normalizeSentence(value) {
  return normalizeText(value).replace(/['’]/g, "").replace(/[^a-z0-9%\s]/g, " ").replace(/\s+/g, " ").trim();
}

function repeatedSentenceCluster(leftText, rightText, minSentences = 2, minWords = 20) {
  const left = splitSentences(leftText);
  const right = splitSentences(rightText);
  let best = null;
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      let width = 0;
      let words = 0;
      while (
        leftIndex + width < left.length &&
        rightIndex + width < right.length &&
        normalizeSentence(left[leftIndex + width]) === normalizeSentence(right[rightIndex + width])
      ) {
        words += wordCount(left[leftIndex + width]);
        width += 1;
      }
      if (width >= minSentences && words >= minWords) {
        if (!best || width > best.width || words > best.words) {
          best = { width, words };
        }
      }
    }
  }
  return best;
}

function tokens(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9%\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !PROSE_STOPWORDS.has(token));
}

function jaccard(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size === 0 || rightSet.size === 0) return 0;
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function suffixKey(value, size = 6) {
  const parts = tokens(value);
  if (parts.length < size) return null;
  return parts.slice(-size).join(" ");
}

function prefixKey(value, size = 4) {
  const parts = tokens(value);
  if (parts.length < size) return null;
  return parts.slice(0, size).join(" ");
}

function firstSentence(value) {
  if (!isNonEmptyString(value)) return "";
  const compact = value.trim().replace(/\s+/g, " ");
  const match = compact.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : compact).trim();
}

function toneHasCollapse(toneObject) {
  const variants = TONE_KEYS.map((key) => normalizeText(toneObject[key]));
  return new Set(variants).size < 3;
}

function isPitchAnythingPackage(pkg, inputPath = "") {
  const bookId = normalizeText(pkg?.book?.bookId ?? "");
  const title = normalizeText(pkg?.book?.title ?? "");
  const pathText = normalizeText(inputPath);
  return bookId.includes("pitch anything") || bookId.includes("pitch-anything") || title.includes("pitch anything") || pathText.includes("pitch anything") || pathText.includes("pitch-anything");
}

function isSoGoodPackage(pkg, inputPath = "") {
  const bookId = normalizeText(pkg?.book?.bookId ?? "");
  const title = normalizeText(pkg?.book?.title ?? "");
  const pathText = normalizeText(inputPath);
  return bookId.includes("so-good-they-cant-ignore-you") || title.includes("so good they cant ignore you") || pathText.includes("so-good-they-cant-ignore-you");
}

function walkToneObjects(value, path, callback) {
  if (isToneObject(value)) {
    callback(path, value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkToneObjects(entry, `${path}[${index}]`, callback));
    return;
  }

  if (isRecord(value)) {
    Object.entries(value).forEach(([key, entry]) => {
      const nextPath = path ? `${path}.${key}` : key;
      walkToneObjects(entry, nextPath, callback);
    });
  }
}

function pushToneObjectSurfaces(surfaces, value, location, kind, depth, family) {
  if (!isToneObject(value)) return;
  TONE_KEYS.forEach((tone) => {
    surfaces.push({
      location: `${location}.${tone}`,
      text: value[tone],
      tone,
      kind,
      depth,
      family,
    });
  });
}

function collectChapterToneSurfaces(chapter) {
  const surfaces = [];
  const chapterRoot = `ch${chapter.number}`;

  DEPTHS.forEach((depthName) => {
    const depth = chapter.contentVariants?.[depthName];
    if (!isRecord(depth)) return;

    pushToneObjectSurfaces(surfaces, depth.chapterBreakdown, `${chapterRoot}.${depthName}.chapterBreakdown`, "chapterBreakdown", depthName, `chapterBreakdown.${depthName}`);

    if (Array.isArray(depth.keyTakeaways)) {
      depth.keyTakeaways.forEach((takeaway, index) => {
        if (!isRecord(takeaway)) return;
        pushToneObjectSurfaces(surfaces, takeaway.point, `${chapterRoot}.${depthName}.keyTakeaways[${index}].point`, "takeawayPoint", depthName, `takeawayPoint.${depthName}`);
        pushToneObjectSurfaces(surfaces, takeaway.moreDetails, `${chapterRoot}.${depthName}.keyTakeaways[${index}].moreDetails`, "moreDetails", depthName, `moreDetails.${depthName}`);
      });
    }

    if (isRecord(depth.oneMinuteRecap)) {
      if (isToneObject(depth.oneMinuteRecap)) {
        pushToneObjectSurfaces(surfaces, depth.oneMinuteRecap, `${chapterRoot}.${depthName}.oneMinuteRecap`, "recap", depthName, `recap.${depthName}`);
      } else {
        ["retrieve", "connect", "preview"].forEach((field) => {
          pushToneObjectSurfaces(surfaces, depth.oneMinuteRecap?.[field], `${chapterRoot}.${depthName}.oneMinuteRecap.${field}`, "recap", depthName, `recap.${depthName}.${field}`);
        });
      }
    }

    ["activationPrompt", "selfCheckPrompt", "predictionPrompt"].forEach((field) => {
      pushToneObjectSurfaces(surfaces, depth[field], `${chapterRoot}.${depthName}.${field}`, "prompt", depthName, `prompt.${depthName}`);
    });
    if (Array.isArray(depth.selfCheckPrompts)) {
      depth.selfCheckPrompts.forEach((prompt, index) => {
        pushToneObjectSurfaces(surfaces, prompt, `${chapterRoot}.${depthName}.selfCheckPrompts[${index}]`, "prompt", depthName, `prompt.${depthName}`);
      });
    }
  });

  if (Array.isArray(chapter.reviewCards)) {
    chapter.reviewCards.forEach((card, index) => {
      if (!isRecord(card)) return;
      pushToneObjectSurfaces(surfaces, card.front, `${chapterRoot}.reviewCards[${index}].front`, "reviewCard", card.difficulty ?? "unknown", "reviewCard.front");
      pushToneObjectSurfaces(surfaces, card.back, `${chapterRoot}.reviewCards[${index}].back`, "reviewCard", card.difficulty ?? "unknown", "reviewCard.back");
    });
  }

  pushToneObjectSurfaces(surfaces, chapter.keyTakeawayCard, `${chapterRoot}.keyTakeawayCard`, "keyTakeawayCard", "supporting", "keyTakeawayCard");

  if (isRecord(chapter.implementationPlan)) {
    pushToneObjectSurfaces(surfaces, chapter.implementationPlan.coreSkill, `${chapterRoot}.implementationPlan.coreSkill`, "implementationPlan", "supporting", "implementationPlan.coreSkill");
    pushToneObjectSurfaces(surfaces, chapter.implementationPlan.concreteAction, `${chapterRoot}.implementationPlan.concreteAction`, "implementationPlan", "supporting", "implementationPlan.concreteAction");
    if (Array.isArray(chapter.implementationPlan.ifThenPlans)) {
      chapter.implementationPlan.ifThenPlans.forEach((plan, index) => {
        if (!isRecord(plan)) return;
        pushToneObjectSurfaces(surfaces, plan.plan, `${chapterRoot}.implementationPlan.ifThenPlans[${index}].plan`, "implementationPlan", "supporting", "implementationPlan.ifThenPlans");
      });
    }
    pushToneObjectSurfaces(surfaces, chapter.implementationPlan.ifThenPlan, `${chapterRoot}.implementationPlan.ifThenPlan`, "implementationPlan", "supporting", "implementationPlan.ifThenPlan");
    pushToneObjectSurfaces(surfaces, chapter.implementationPlan.twentyFourHourChallenge, `${chapterRoot}.implementationPlan.twentyFourHourChallenge`, "implementationPlan", "supporting", "implementationPlan.challenge");
    pushToneObjectSurfaces(surfaces, chapter.implementationPlan.weeklyPractice, `${chapterRoot}.implementationPlan.weeklyPractice`, "implementationPlan", "supporting", "implementationPlan.weeklyPractice");
    pushToneObjectSurfaces(surfaces, chapter.implementationPlan.friction, `${chapterRoot}.implementationPlan.friction`, "implementationPlan", "supporting", "implementationPlan.friction");
    pushToneObjectSurfaces(surfaces, chapter.implementationPlan.checkpoint, `${chapterRoot}.implementationPlan.checkpoint`, "implementationPlan", "supporting", "implementationPlan.checkpoint");
  }

  return surfaces;
}

function pushChapterPackageDuplicateIssues(chapter, surfaces, issues) {
  const sentenceMap = new Map();
  surfaces.forEach((surface) => {
    if (surface.kind === "chapterBreakdown") return;
    splitSentences(surface.text).forEach((sentence) => {
      if (tokens(sentence).length < 5) return;
      const key = normalizeText(sentence);
      if (!key) return;
      const seen = sentenceMap.get(key) ?? [];
      seen.push({ location: surface.location, sentence });
      sentenceMap.set(key, seen);
    });
  });

  sentenceMap.forEach((entries) => {
    const unique = [];
    entries.forEach((entry) => {
      if (!unique.find((item) => item.location === entry.location)) {
        unique.push(entry);
      }
    });
    if (unique.length > 1) {
      pushIssue(
        issues,
        "HIGH",
        "G",
        unique[0].location,
        `Repeated sentence appears across chapter-package surfaces, including ${unique.slice(1).map((item) => item.location).join(", ")}.`
      );
    }
  });
}

function pushRepeatedTemplateTailIssues(surfaces, issues) {
  const groups = new Map();
  surfaces.forEach((surface) => {
    const key = `${surface.family}|${surface.tone}`;
    const list = groups.get(key) ?? [];
    list.push(surface);
    groups.set(key, list);
  });

  groups.forEach((items, key) => {
    const suffixes = new Map();
    items.forEach((item) => {
      const suffix = suffixKey(item.text, 5);
      if (!suffix) return;
      const list = suffixes.get(suffix) ?? [];
      list.push(item.location);
      suffixes.set(suffix, list);
    });
    suffixes.forEach((locations) => {
      if (locations.length > 1) {
        pushIssue(issues, "HIGH", "G", locations[0], `Repeated template tail detected within ${key}: ${locations.join(", ")}.`);
      }
    });
  });
}

function pushRepeatedCardScaffoldIssues(chapter, issues) {
  const chapterRoot = `ch${chapter.number}`;
  ["front", "back"].forEach((field) => {
    TONE_KEYS.forEach((tone) => {
      let previous = null;
      chapter.reviewCards?.forEach((card, index) => {
        const text = card?.[field]?.[tone];
        if (!isNonEmptyString(text)) return;
        const current = {
          location: `${chapterRoot}.reviewCards[${index}].${field}.${tone}`,
          prefix: tokens(text).slice(0, 3).join(" "),
          suffix: tokens(text).slice(-4).join(" "),
        };
        if (previous && ((current.prefix && current.prefix === previous.prefix) || (current.suffix && current.suffix === previous.suffix))) {
          pushIssue(
            issues,
            "HIGH",
            "G",
            current.location,
            `Adjacent review cards reuse the same ${field} scaffold as ${previous.location}.`
          );
        }
        previous = current;
      });
    });
  });
}

function pushGenericMoreDetailsIssues(chapter, issues) {
  ["medium", "hard"].forEach((depthName) => {
    chapter.contentVariants?.[depthName]?.keyTakeaways?.forEach((takeaway, index) => {
      if (!isRecord(takeaway?.point) || !isRecord(takeaway?.moreDetails)) return;
      TONE_KEYS.forEach((tone) => {
        const point = takeaway.point?.[tone];
        const details = takeaway.moreDetails?.[tone];
        if (!isNonEmptyString(point) || !isNonEmptyString(details)) return;
        const location = `ch${chapter.number}.${depthName}.keyTakeaways[${index}].moreDetails.${tone}`;
        const overlap = jaccard(tokens(point), tokens(details));
        const newTokens = tokens(details).filter((token) => !new Set(tokens(point)).has(token));
        if (overlap >= 0.72 || newTokens.length < 4) {
          pushIssue(
            issues,
            "HIGH",
            "G",
            location,
            "moreDetails mostly restates the takeaway instead of adding mechanism, limit, failure mode, or operational implication."
          );
        }
      });
    });
  });
}

function pushGenericPromptIssues(surfaces, issues) {
  surfaces.forEach((surface) => {
    if (surface.kind !== "prompt" && surface.kind !== "recap") return;
    const normalized = normalizeText(surface.text);
    GENERIC_PROMPT_PHRASES.forEach((phrase) => {
      if (normalized.includes(phrase)) {
        pushIssue(issues, "HIGH", "G", surface.location, `Prompt uses reusable template wording: "${phrase}".`);
      }
    });
  });
}

function pushGenericImplementationWarnings(surfaces, issues) {
  surfaces.forEach((surface) => {
    if (surface.kind !== "implementationPlan") return;
    const normalized = normalizeText(surface.text);
    GENERIC_IMPLEMENTATION_PHRASES.forEach((phrase) => {
      if (normalized.includes(phrase)) {
        pushIssue(issues, "WARN", "G", surface.location, `Implementation plan uses generic coaching language: "${phrase}".`);
      }
    });
  });
}

function pushReinforcementEchoWarnings(surfaces, issues) {
  const relevant = surfaces.filter((surface) => ["takeawayPoint", "moreDetails", "reviewCard", "keyTakeawayCard", "recap", "prompt"].includes(surface.kind));
  relevant.forEach((surface, index) => {
    const opening = normalizeText(firstSentence(surface.text));
    if (REINFORCEMENT_BANNED_OPENERS.some((prefix) => opening.startsWith(prefix))) {
      pushIssue(issues, "WARN", "G", surface.location, `Reinforcement surface opens with a reusable stem: "${firstSentence(surface.text)}".`);
    }
    if (surface.kind === "moreDetails") {
      for (let cursor = index + 1; cursor < relevant.length; cursor += 1) {
        const other = relevant[cursor];
        if (surface.tone !== other.tone) continue;
        if (other.kind !== "takeawayPoint") continue;
        const sameStem = prefixKey(surface.text, 4) && prefixKey(surface.text, 4) === prefixKey(other.text, 4);
        const overlap = jaccard(tokens(surface.text), tokens(other.text));
        if (sameStem || overlap >= 0.84) {
          pushIssue(issues, "WARN", "G", surface.location, `moreDetails is too close to takeaway phrasing near ${other.location}.`);
          break;
        }
      }
    }
  });
}

function pushPitchAnythingIssues(pkg, surfaces, issues, inputPath) {
  if (!isPitchAnythingPackage(pkg, inputPath)) return;
  surfaces.forEach((surface) => {
    const normalized = normalizeText(surface.text);
    PITCH_ANYTHING_BANNED_PHRASES.forEach((phrase) => {
      if (normalized.includes(phrase)) {
        pushIssue(issues, "HIGH", "G", surface.location, `Pitch Anything boilerplate detected: "${phrase}".`);
      }
    });
  });
}

function isArtOfWarPackage(pkg, inputPath = "") {
  const bookId = normalizeText(pkg?.book?.bookId ?? "");
  const title = normalizeText(pkg?.book?.title ?? "");
  const pathText = normalizeText(inputPath);
  return bookId.includes("art-of-war") || title.includes("art of war") || pathText.includes("art-of-war");
}

function pushArtOfWarIssues(pkg, chapter, issues, inputPath) {
  if (!isArtOfWarPackage(pkg, inputPath)) return;
  const chapterRoot = `ch${chapter.number ?? chapter.chapterId ?? "?"}`;
  const cv = chapter.contentVariants;
  if (!isRecord(cv)) return;

  // Check breakdown paragraph density
  ["easy", "medium", "hard"].forEach((depth) => {
    const breakdown = cv[depth]?.chapterBreakdown;
    if (!isRecord(breakdown)) return;
    TONE_KEYS.forEach((tone) => {
      const text = breakdown[tone];
      if (!isNonEmptyString(text)) return;
      const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
      // Wall-of-text: only 1 paragraph in medium or hard
      if (paragraphs.length <= 1 && (depth === "medium" || depth === "hard") && wordCount(text) > 200) {
        pushIssue(issues, "HIGH", "G", `${chapterRoot}.contentVariants.${depth}.chapterBreakdown.${tone}`, `Art of War: wall-of-text breakdown (${paragraphs.length} paragraph, ${wordCount(text)} words). Must have 4-6 paragraphs.`);
      }
      // Over-dense paragraphs
      paragraphs.forEach((para, idx) => {
        const wc = wordCount(para);
        if (wc > 140) {
          pushIssue(issues, "WARN", "G", `${chapterRoot}.contentVariants.${depth}.chapterBreakdown.${tone}`, `Art of War: paragraph ${idx + 1} is ${wc} words (max 120 recommended). Consider splitting.`);
        }
      });
    });
  });

  // Check keyTakeawayCard word count
  if (isRecord(chapter.keyTakeawayCard)) {
    TONE_KEYS.forEach((tone) => {
      const text = chapter.keyTakeawayCard[tone];
      if (isNonEmptyString(text)) {
        const wc = wordCount(text);
        if (wc > 100) {
          pushIssue(issues, "HIGH", "G", `${chapterRoot}.keyTakeawayCard.${tone}`, `Art of War: keyTakeawayCard is ${wc} words (max 80 recommended). Must be a distilled thesis, not a compressed essay.`);
        }
      }
    });
  }

  // Check review card back length
  if (Array.isArray(chapter.reviewCards)) {
    chapter.reviewCards.forEach((card, idx) => {
      if (!isRecord(card) || !isRecord(card.back)) return;
      TONE_KEYS.forEach((tone) => {
        const text = card.back[tone];
        if (isNonEmptyString(text)) {
          const wc = wordCount(text);
          if (wc > 65) {
            pushIssue(issues, "WARN", "G", `${chapterRoot}.reviewCards[${idx}].back.${tone}`, `Art of War: review card back is ${wc} words (max 50 recommended). Tighten for crisp retrieval.`);
          }
        }
      });
    });
  }

  // Check hard-variant meta-framework language
  const hardBreakdown = cv.hard?.chapterBreakdown;
  if (isRecord(hardBreakdown)) {
    const metaPatterns = [
      "the competence the chapter assumes",
      "the sequential structure has a confidence trap",
      "the argument has a live tension",
      "the framework does not resolve",
      "the classification error is not correctable",
      "the competence required",
    ];
    TONE_KEYS.forEach((tone) => {
      const text = hardBreakdown[tone];
      if (!isNonEmptyString(text)) return;
      const normalized = normalizeText(text);
      metaPatterns.forEach((pattern) => {
        if (normalized.includes(pattern)) {
          pushIssue(issues, "WARN", "G", `${chapterRoot}.contentVariants.hard.chapterBreakdown.${tone}`, `Art of War: hard variant contains meta-framework language: "${pattern}". Consider rewriting to teach directly.`);
        }
      });
    });
  }
}

function pushSoGoodIssues(pkg, chapter, surfaces, issues, inputPath) {
  if (!isSoGoodPackage(pkg, inputPath)) return;
  if (!SO_GOOD_GUIDED_CHAPTERS.has(chapter.number)) return;
  const chapterRoot = `ch${chapter.number}`;
  const supportSurfaces = surfaces.filter((surface) => ["implementationPlan", "reviewCard", "recap", "keyTakeawayCard"].includes(surface.kind));
  const breakdowns = surfaces.filter((surface) => surface.kind === "chapterBreakdown");

  supportSurfaces.forEach((surface) => {
    const normalized = normalizeText(surface.text);
    if (surface.kind === "implementationPlan" && /\bthen i will if\b/.test(normalized)) {
      pushIssue(issues, "HIGH", "G", surface.location, "So Good: implementation plan contains doubled conditional scaffolding.");
    }
    if (surface.kind === "reviewCard") {
      const opening = normalizeText(firstSentence(surface.text));
      if (SO_GOOD_GENERIC_REVIEW_FRONTS.some((prefix) => opening.startsWith(prefix)) || SO_GOOD_GENERIC_REVIEW_BACKS.some((prefix) => opening.startsWith(prefix))) {
        pushIssue(issues, "HIGH", "G", surface.location, "So Good: review card uses a reusable scaffold instead of a chapter-earned retrieval cue.");
      }
    }
    if (surface.tone === "competitive") {
      const directSibling = supportSurfaces.find((item) => item.location.replace(/\.competitive$/, ".direct") === surface.location.replace(/\.competitive$/, ".direct") && item.tone === "direct");
      if (directSibling) {
        const overlap = jaccard(tokens(surface.text), tokens(directSibling.text));
        const newTokens = new Set(tokens(surface.text).filter((token) => !new Set(tokens(directSibling.text)).has(token)));
        const sharpEnough = [...newTokens].some((token) => SO_GOOD_COMPETITIVE_MARKERS.has(token));
        if (overlap >= 0.74 && (wordCount(surface.text) >= wordCount(directSibling.text) || !sharpEnough)) {
          pushIssue(issues, "HIGH", "G", surface.location, "So Good: competitive surface is too close to direct without becoming sharper.");
        }
      }
    }
    const bodyMatch = breakdowns.find((item) => item.tone === surface.tone);
    if (bodyMatch) {
      const overlap = jaccard(tokens(surface.text), tokens(bodyMatch.text));
      if (overlap >= 0.66) {
        pushIssue(issues, "HIGH", "G", surface.location, `So Good: support surface overlaps chapter body too closely (overlap=${overlap.toFixed(2)}).`);
      }
    }
  });

  const medium = chapter.contentVariants?.medium?.chapterBreakdown;
  const hard = chapter.contentVariants?.hard?.chapterBreakdown;
  ["easy", "medium", "hard"].forEach((depthName) => {
    const breakdown = chapter.contentVariants?.[depthName]?.chapterBreakdown;
    if (!isToneObject(breakdown)) return;
    const tonePairs = [["gentle", "direct"], ["gentle", "competitive"], ["direct", "competitive"]];
    tonePairs.forEach(([leftTone, rightTone]) => {
      const cluster = repeatedSentenceCluster(breakdown[leftTone], breakdown[rightTone]);
      if (cluster) {
        pushIssue(
          issues,
          "HIGH",
          "G",
          `${chapterRoot}.contentVariants.${depthName}.chapterBreakdown.${rightTone}`,
          `So Good: ${depthName} ${rightTone} reuses a repeated paragraph-family from ${leftTone} (${cluster.width} sentences / ${cluster.words} words).`
        );
      }
    });
  });
  if (isToneObject(medium) && isToneObject(hard)) {
    ["direct", "competitive"].forEach((tone) => {
      const mediumText = medium[tone];
      const hardText = hard[tone];
      const repeatedCluster = repeatedSentenceCluster(mediumText, hardText);
      if (repeatedCluster) {
        pushIssue(issues, "HIGH", "G", `${chapterRoot}.hard.chapterBreakdown.${tone}`, `So Good: hard ${tone} repeats a medium paragraph-family (${repeatedCluster.width} sentences / ${repeatedCluster.words} words).`);
      }
      const overlap = jaccard(tokens(mediumText), tokens(hardText));
      if (overlap >= 0.62) {
        const hardTokens = new Set(tokens(hardText));
        const markerHits = [...hardTokens].filter((token) => SO_GOOD_DIAGNOSTIC_MARKERS.has(token)).length;
        if (markerHits < 2) {
          pushIssue(issues, "HIGH", "G", `${chapterRoot}.hard.chapterBreakdown.${tone}`, "So Good: hard variant broadens medium without enough diagnostic precision.");
        }
      }
      if (jaccard(tokens(firstSentence(mediumText)), tokens(firstSentence(hardText))) >= 0.74) {
        pushIssue(issues, "HIGH", "G", `${chapterRoot}.hard.chapterBreakdown.${tone}`, "So Good: hard breakdown reuses medium's opening claim.");
      }
    });
  }
}

function pushHardMediumSupportOverlapIssues(chapter, issues) {
  if (detectPackageProfile({ chapters: [chapter] }) === "v13_autonomous") {
    return;
  }
  const medium = chapter.contentVariants?.medium;
  const hard = chapter.contentVariants?.hard;
  if (!isRecord(medium) || !isRecord(hard)) return;

  const families = {
    chapterBreakdown: (depth, tone) => depth.chapterBreakdown?.[tone] ?? "",
    keyTakeaways: (depth, tone) => Array.isArray(depth.keyTakeaways) ? depth.keyTakeaways.map((item) => [item?.point?.[tone] ?? "", item?.moreDetails?.[tone] ?? ""].join(" ")).join(" ") : "",
    recap: (depth, tone) => {
      const recap = depth.oneMinuteRecap;
      if (!isRecord(recap)) return "";
      if (isToneObject(recap)) return recap[tone] ?? "";
      return ["retrieve", "connect", "preview"].map((field) => recap?.[field]?.[tone] ?? "").join(" ");
    },
    prompts: (depth, tone) => {
      const parts = [
        depth.activationPrompt?.[tone] ?? "",
        depth.selfCheckPrompt?.[tone] ?? "",
        depth.predictionPrompt?.[tone] ?? "",
      ];
      if (Array.isArray(depth.selfCheckPrompts)) {
        depth.selfCheckPrompts.forEach((prompt) => parts.push(prompt?.[tone] ?? ""));
      }
      return parts.join(" ");
    },
  };

  Object.entries(families).forEach(([family, extractor]) => {
    TONE_KEYS.forEach((tone) => {
      const mediumText = extractor(medium, tone);
      const hardText = extractor(hard, tone);
      if (!isNonEmptyString(mediumText) || !isNonEmptyString(hardText)) return;
      const overlap = jaccard(tokens(mediumText), tokens(hardText));
      const threshold = family === "chapterBreakdown" ? 0.72 : 0.66;
      if (overlap >= threshold) {
        pushIssue(
          issues,
          "HIGH",
          "G",
          `ch${chapter.number}.hard.${family}.${tone}`,
          `Hard overlaps medium too closely in ${family} for ${tone} tone (overlap=${overlap.toFixed(2)}).`
        );
      }
    });
  });
}

function severityHeading(severity) {
  switch (severity) {
    case "CRITICAL":
      return "Critical";
    case "HIGH":
      return "High";
    case "MEDIUM":
      return "Medium";
    case "LOW":
      return "Low";
    default:
      return "Warnings";
  }
}

function pushIssue(issues, severity, category, location, message) {
  issues.push({ severity, category, location, message });
}

function validateRequiredString(issues, category, value, location, label) {
  if (!isNonEmptyString(value)) {
    pushIssue(issues, "CRITICAL", category, location, `${label} must be a non-empty string.`);
    return false;
  }
  return true;
}

function validateToneField(issues, category, value, location, label, severity = "CRITICAL") {
  if (!isToneObject(value)) {
    pushIssue(issues, severity, category, location, `${label} must be a tone object.`);
    return false;
  }
  return true;
}

function validateTakeaways(chapter, depthName, depth, issues) {
  const rules = arguments[4][depthName];
  const takeaways = depth?.keyTakeaways;
  const location = `ch${chapter.number}.${depthName}.keyTakeaways`;

  if (!Array.isArray(takeaways)) {
    pushIssue(issues, "CRITICAL", "B", location, "keyTakeaways must be an array.");
    return;
  }

  if (takeaways.length < rules.minTakeaways || takeaways.length > rules.maxTakeaways) {
    pushIssue(
      issues,
      "HIGH",
      "B",
      location,
      `${depthName} must have ${rules.minTakeaways === rules.maxTakeaways ? `exactly ${rules.minTakeaways}` : `${rules.minTakeaways}-${rules.maxTakeaways}`} keyTakeaways.`
    );
  }

  takeaways.forEach((takeaway, index) => {
    const takeawayLocation = `${location}[${index}]`;
    if (!isRecord(takeaway)) {
      pushIssue(issues, "CRITICAL", "B", takeawayLocation, "Each takeaway must be an object.");
      return;
    }

    validateToneField(issues, "B", takeaway.point, takeawayLocation, "point");

    if (rules.requireMoreDetails) {
      validateToneField(issues, "B", takeaway.moreDetails, takeawayLocation, "moreDetails");
    } else if ("moreDetails" in takeaway) {
      pushIssue(issues, "HIGH", "B", takeawayLocation, `${depthName} takeaways must not include moreDetails.`);
    }
  });
}

function validateOneMinuteRecap(chapter, depthName, depth, issues) {
  const location = `ch${chapter.number}.${depthName}.oneMinuteRecap`;
  const rules = arguments[4][depthName];
  const packageProfile = detectPackageProfile({ chapters: [chapter] });

  if (rules.recapShape === "flat") {
    validateToneField(issues, "B", depth?.oneMinuteRecap, location, "oneMinuteRecap");
    return;
  }

  if (rules.recapShape === "either" && packageProfile === "v13_autonomous") {
    const recap = depth?.oneMinuteRecap;
    if (isToneObject(recap)) {
      return;
    }
    if (!isRecord(recap)) {
      pushIssue(issues, "CRITICAL", "B", location, "oneMinuteRecap must be a tone object or an object with retrieve, connect, and preview.");
      return;
    }
    ["retrieve", "connect", "preview"].forEach((field) => {
      validateToneField(issues, "B", recap[field], `${location}.${field}`, field);
    });
    return;
  }

  if (!isRecord(depth?.oneMinuteRecap)) {
    pushIssue(issues, "CRITICAL", "B", location, "oneMinuteRecap must be an object with retrieve, connect, and preview.");
    return;
  }

  ["retrieve", "connect", "preview"].forEach((field) => {
    validateToneField(issues, "B", depth.oneMinuteRecap[field], `${location}.${field}`, field);
  });
}

function validateWordCounts(chapter, depthName, depth, issues, summaries) {
  const rules = arguments[5][depthName];
  const counts = {};

  if (!isToneObject(depth?.chapterBreakdown)) {
    summaries.wordCounts.push({
      chapter: chapter.number,
      depth: depthName,
      counts: null,
    });
    return;
  }

  TONE_KEYS.forEach((tone) => {
    const count = wordCount(depth.chapterBreakdown[tone]);
    counts[tone] = count;
    if (count < rules.minWords || count > rules.maxWords) {
      pushIssue(
        issues,
        "MEDIUM",
        "C",
        `ch${chapter.number}.${depthName}.chapterBreakdown.${tone}`,
        `${depthName} chapterBreakdown must be ${rules.minWords}-${rules.maxWords} words per tone; found ${count}.`
      );
    }
  });

  summaries.wordCounts.push({
    chapter: chapter.number,
    depth: depthName,
    counts,
  });
}

function validateDepth(chapter, depthName, depth, issues, summaries) {
  const location = `ch${chapter.number}.${depthName}`;
  const rules = arguments[5][depthName];
  const packageProfile = detectPackageProfile({ chapters: [chapter] });

  if (!isRecord(depth)) {
    pushIssue(issues, "CRITICAL", "A", location, `${depthName} contentVariant must be an object.`);
    summaries.wordCounts.push({
      chapter: chapter.number,
      depth: depthName,
      counts: null,
    });
    return;
  }

  validateToneField(issues, "B", depth.chapterBreakdown, `${location}.chapterBreakdown`, "chapterBreakdown");
  validateTakeaways(chapter, depthName, depth, issues, arguments[5]);

  if (rules.requireActivationPrompt) {
    validateToneField(issues, "B", depth.activationPrompt, `${location}.activationPrompt`, "activationPrompt");
  } else if ("activationPrompt" in depth) {
    pushIssue(issues, "HIGH", "B", `${location}.activationPrompt`, `${depthName} must not include activationPrompt.`);
  }

  if (rules.requireSelfCheckPrompt) {
    validateToneField(issues, "B", depth.selfCheckPrompt, `${location}.selfCheckPrompt`, "selfCheckPrompt");
  } else if ("selfCheckPrompt" in depth) {
    pushIssue(issues, "HIGH", "B", `${location}.selfCheckPrompt`, `${depthName} must not include selfCheckPrompt.`);
  }

  if (rules.requireSelfCheckPrompts) {
    if (packageProfile === "v13_autonomous" && isToneObject(depth.selfCheckPrompts)) {
      validateToneField(
        issues,
        "B",
        depth.selfCheckPrompts,
        `${location}.selfCheckPrompts`,
        "selfCheckPrompts"
      );
    } else if (packageProfile === "v13_autonomous" && depth.selfCheckPrompts == null) {
      // Autonomous synthesis chapters may omit hard self-check prompts while keeping the rest of the hard-depth surface.
    } else if (!Array.isArray(depth.selfCheckPrompts) || depth.selfCheckPrompts.length !== 2) {
      pushIssue(
        issues,
        "HIGH",
        "B",
        `${location}.selfCheckPrompts`,
        "hard.selfCheckPrompts must be an array of exactly 2 tone objects."
      );
    } else {
      depth.selfCheckPrompts.forEach((prompt, index) => {
        validateToneField(
          issues,
          "B",
          prompt,
          `${location}.selfCheckPrompts[${index}]`,
          `selfCheckPrompts[${index}]`
        );
      });
    }
  } else if ("selfCheckPrompts" in depth) {
    pushIssue(issues, "HIGH", "B", `${location}.selfCheckPrompts`, `${depthName} must not include selfCheckPrompts.`);
  }

  if (rules.requirePredictionPrompt) {
    validateToneField(issues, "B", depth.predictionPrompt, `${location}.predictionPrompt`, "predictionPrompt");
  } else if (
    packageProfile === "v13_autonomous" &&
    depth.predictionPrompt != null
  ) {
    validateToneField(issues, "B", depth.predictionPrompt, `${location}.predictionPrompt`, "predictionPrompt");
  } else if ("predictionPrompt" in depth) {
    pushIssue(issues, "HIGH", "B", `${location}.predictionPrompt`, `${depthName} must not include predictionPrompt.`);
  }

  validateOneMinuteRecap(chapter, depthName, depth, issues, arguments[5]);
  validateWordCounts(chapter, depthName, depth, issues, summaries, arguments[5]);
}

function getDepthRulesForPackage(pkg, inputPath = "") {
  const profile = detectPackageProfile(pkg, inputPath);
  if (profile === "antifragile") return ANTIFRAGILE_DEPTH_RULES;
  if (profile === "v13_autonomous") return V13_AUTONOMOUS_DEPTH_RULES;
  return DEPTH_RULES;
}

function validateAntifragileMetadata(pkg, issues) {
  if (!matchesAntifragilePackage(pkg)) return;
  if (!isRecord(pkg.book)) return;

  if (pkg.book.title !== ANTIFRAGILE_TITLE) {
    pushIssue(issues, "CRITICAL", "A", "book.title", `Antifragile title must normalize exactly to "${ANTIFRAGILE_TITLE}".`);
  }
  if (pkg.book.author !== ANTIFRAGILE_AUTHOR) {
    pushIssue(issues, "CRITICAL", "A", "book.author", `Antifragile author must normalize exactly to "${ANTIFRAGILE_AUTHOR}".`);
  }
  if (/[“”‘’]/.test(`${pkg.book.title ?? ""}${pkg.book.author ?? ""}`)) {
    pushIssue(issues, "CRITICAL", "A", "book", "Antifragile metadata contains curly-quote corruption.");
  }
  if (!isRecord(pkg.book.edition)) {
    pushIssue(issues, "CRITICAL", "A", "book.edition", "Antifragile book.edition must be an object.");
  } else {
    validateRequiredString(issues, "A", pkg.book.edition.name, "book.edition.name", "edition.name");
    validateRequiredString(issues, "A", pkg.book.edition.sourceText, "book.edition.sourceText", "edition.sourceText");
    validateRequiredString(issues, "A", pkg.book.edition.sourceProvenance, "book.edition.sourceProvenance", "edition.sourceProvenance");
    if (!Number.isInteger(pkg.book.edition.publishedYear)) {
      pushIssue(issues, "CRITICAL", "A", "book.edition.publishedYear", "Antifragile edition.publishedYear must be an integer when source support exists.");
    }
  }
  validateRequiredString(issues, "A", pkg.book.chapterRange, "book.chapterRange", "chapterRange");
}

function validateAntifragileChapterContract(chapter, issues) {
  if (!matchesAntifragilePackage(chapter)) return;
  const chapterRoot = `ch${chapter.number}`;
  if (!isRecord(chapter.book)) {
    pushIssue(issues, "CRITICAL", "A", `${chapterRoot}.book`, "Antifragile chapter must include a nested book object.");
  } else {
    if (chapter.book.bookId !== "antifragile" || chapter.book.title !== ANTIFRAGILE_TITLE || chapter.book.author !== ANTIFRAGILE_AUTHOR) {
      pushIssue(issues, "CRITICAL", "A", `${chapterRoot}.book`, "Antifragile nested chapter book metadata must match the canonical book object.");
    }
  }

  const supportSurfaces = collectChapterToneSurfaces(chapter).filter((surface) =>
    ["implementationPlan", "reviewCard", "recap", "keyTakeawayCard", "prompt"].includes(surface.kind)
  );
  supportSurfaces.forEach((surface) => {
    const normalized = normalizeText(surface.text);
    ANTIFRAGILE_SOFT_DRIFT_PHRASES.forEach((phrase) => {
      if (normalized.includes(phrase)) {
        pushIssue(
          issues,
          "HIGH",
          "G",
          surface.location,
          `Antifragile surface drifted into generic or softened language: "${phrase}".`
        );
      }
    });
  });

  const bridgeTerms = ANTIFRAGILE_BRIDGE_EXPECTATIONS[chapter.number];
  if (bridgeTerms) {
    const bridgeTexts = [];
    const preview = chapter.contentVariants?.medium?.oneMinuteRecap?.preview;
    if (isToneObject(preview)) {
      bridgeTexts.push(...TONE_KEYS.map((tone) => preview[tone]));
    }
    const reviewBack = chapter.reviewCards?.[4]?.back;
    if (isToneObject(reviewBack)) {
      bridgeTexts.push(...TONE_KEYS.map((tone) => reviewBack[tone]));
    }
    const normalizedBridge = normalizeText(bridgeTexts.join(" "));
    if (!bridgeTerms.some((term) => normalizedBridge.includes(term))) {
      pushIssue(
        issues,
        "HIGH",
        "G",
        `${chapterRoot}.bridge`,
        "Antifragile bridge does not point to the book's actual next conceptual move."
      );
    }
  }

  const boundaryTerms = ANTIFRAGILE_BOUNDARY_EXPECTATIONS[chapter.number];
  if (boundaryTerms) {
    const bodyBits = [];
    ["medium", "hard"].forEach((depthName) => {
      const breakdown = chapter.contentVariants?.[depthName]?.chapterBreakdown;
      if (isToneObject(breakdown)) {
        bodyBits.push(...TONE_KEYS.map((tone) => breakdown[tone]));
      }
      const takeaways = chapter.contentVariants?.[depthName]?.keyTakeaways;
      if (Array.isArray(takeaways)) {
        takeaways.forEach((takeaway) => {
          if (isToneObject(takeaway?.point)) bodyBits.push(...TONE_KEYS.map((tone) => takeaway.point[tone]));
          if (isToneObject(takeaway?.moreDetails)) bodyBits.push(...TONE_KEYS.map((tone) => takeaway.moreDetails[tone]));
        });
      }
    });
    const normalizedBody = normalizeText(bodyBits.join(" "));
    if (![...boundaryTerms].every((term) => normalizedBody.includes(term))) {
      pushIssue(
        issues,
        "HIGH",
        "G",
        `${chapterRoot}.boundary`,
        "Antifragile chapter is missing the boundary that keeps this argument from turning into caricature."
      );
    }
  }
}

function validateExamples(chapter, issues, summaries) {
  const location = `ch${chapter.number}.examples`;
  const examples = chapter.examples;
  const packageProfile = detectPackageProfile({ chapters: [chapter] });
  const requiresContexts = packageProfile === "legacy" || packageProfile === "antifragile";
  const requiredFormats =
    packageProfile === "legacy" || packageProfile === "antifragile"
      ? LEGACY_CANONICAL_FORMATS
      : null;
  const allowedFormats =
    packageProfile === "legacy" || packageProfile === "antifragile"
      ? LEGACY_CANONICAL_FORMATS
      : V13_ALLOWED_FORMATS;

  if (!Array.isArray(examples)) {
    pushIssue(issues, "CRITICAL", "D", location, "examples must be an array.");
    summaries.exampleSummaries.push({
      chapter: chapter.number,
      formats: [],
      endings: [],
      categories: { work: 0, school: 0, personal: 0, other: 0 },
      quizQuestions: Array.isArray(chapter.quiz?.questions) ? chapter.quiz.questions.length : 0,
      choiceSizes: Array.isArray(chapter.quiz?.questions) ? [...new Set(chapter.quiz.questions.map((question) => Array.isArray(question.choices) ? question.choices.length : 0))] : [],
      reviewDistribution: countDifficulties(chapter.reviewCards),
    });
    return;
  }

  if (examples.length !== 6) {
    pushIssue(issues, "HIGH", "D", location, `Each chapter must contain exactly 6 examples; found ${examples.length}.`);
  }

  const formats = [];
  const endings = [];
  const categories = { work: 0, school: 0, personal: 0, other: 0 };

  examples.forEach((example, index) => {
    const exampleLocation = `${location}[${index}]`;
    if (!isRecord(example)) {
      pushIssue(issues, "CRITICAL", "D", exampleLocation, "Each example must be an object.");
      return;
    }

    if (example.exampleId != null) {
      validateRequiredString(issues, "D", example.exampleId, `${exampleLocation}.exampleId`, "exampleId");
    }
    if (example.title != null) {
      validateRequiredString(issues, "D", example.title, `${exampleLocation}.title`, "title");
    }
    validateRequiredString(issues, "D", example.category, `${exampleLocation}.category`, "category");
    validateRequiredString(issues, "D", example.format, `${exampleLocation}.format`, "format");
    validateRequiredString(issues, "D", example.endingType, `${exampleLocation}.endingType`, "endingType");

    if (requiresContexts && (!Array.isArray(example.contexts) || example.contexts.length === 0 || !example.contexts.every(isNonEmptyString))) {
      pushIssue(issues, "HIGH", "D", `${exampleLocation}.contexts`, "contexts must be a non-empty array of strings.");
    }

    ["scenario", "whatToDo", "whyItMatters"].forEach((field) => {
      if (!isToneObject(example[field])) {
        pushIssue(
          issues,
          "HIGH",
          "D",
          `${exampleLocation}.${field}`,
          `${field} must be a tone object under v12 required-mode content.`
        );
      }
    });

    if (isNonEmptyString(example.format)) {
      formats.push(example.format);
      if (!allowedFormats.includes(example.format)) {
        pushIssue(
          issues,
          "MEDIUM",
          "D",
          `${exampleLocation}.format`,
          `format must be one of: ${allowedFormats.join(", ")}.`
        );
      }
    }

    if (isNonEmptyString(example.endingType)) {
      endings.push(example.endingType);
    }

    if (isNonEmptyString(example.category)) {
      if (Object.hasOwn(categories, example.category)) {
        categories[example.category] += 1;
      } else {
        categories.other += 1;
      }
    }
  });

  const formatCounts = new Map();
  formats.forEach((format) => {
    formatCounts.set(format, (formatCounts.get(format) ?? 0) + 1);
  });

  if (requiredFormats) {
    requiredFormats.forEach((format) => {
      if ((formatCounts.get(format) ?? 0) !== 1) {
        pushIssue(
          issues,
          "HIGH",
          "D",
          location,
          `Each chapter must use ${format} exactly once; found ${formatCounts.get(format) ?? 0}.`
        );
      }
    });
  } else if (new Set(formats).size !== 6 || formats.length !== 6) {
    pushIssue(issues, "HIGH", "D", location, "Each v13 chapter must use 6 unique example formats exactly once.");
  }

  if (packageProfile !== "v13_autonomous" && (new Set(endings).size !== 6 || endings.length !== 6)) {
    pushIssue(issues, "HIGH", "D", location, "Each chapter must use 6 unique endingType values exactly once.");
  }

  if (categories.work !== 2 || categories.school !== 2 || categories.personal !== 2 || categories.other !== 0) {
    pushIssue(
      issues,
      "HIGH",
      "D",
      location,
      `Example categories must distribute as 2 work / 2 school / 2 personal; found work=${categories.work}, school=${categories.school}, personal=${categories.personal}, other=${categories.other}.`
    );
  }

  summaries.exampleSummaries.push({
    chapter: chapter.number,
    formats,
    endings,
    categories,
    quizQuestions: Array.isArray(chapter.quiz?.questions) ? chapter.quiz.questions.length : 0,
    choiceSizes: Array.isArray(chapter.quiz?.questions) ? [...new Set(chapter.quiz.questions.map((question) => Array.isArray(question.choices) ? question.choices.length : 0))] : [],
    reviewDistribution: countDifficulties(chapter.reviewCards),
  });
}

function countDifficulties(reviewCards) {
  const distribution = { easy: 0, medium: 0, hard: 0, other: 0 };
  if (!Array.isArray(reviewCards)) return distribution;

  reviewCards.forEach((card) => {
    if (isNonEmptyString(card?.difficulty) && Object.hasOwn(distribution, card.difficulty)) {
      distribution[card.difficulty] += 1;
    } else {
      distribution.other += 1;
    }
  });

  return distribution;
}

function validateQuizAndSupporting(chapter, issues) {
  const baseLocation = `ch${chapter.number}`;
  const quiz = chapter.quiz;
  const packageProfile = detectPackageProfile({ chapters: [chapter] });

  if (!isRecord(quiz)) {
    pushIssue(issues, "CRITICAL", "E", `${baseLocation}.quiz`, "quiz must be an object.");
  } else {
    if (!Number.isFinite(quiz.passingScorePercent)) {
      pushIssue(issues, "MEDIUM", "E", `${baseLocation}.quiz.passingScorePercent`, "passingScorePercent must be numeric.");
    }

    if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      pushIssue(issues, "CRITICAL", "F", `${baseLocation}.quiz.questions`, "quiz.questions must not be empty.");
    } else {
      if (quiz.questions.length !== 10) {
        pushIssue(issues, "HIGH", "E", `${baseLocation}.quiz.questions`, `quiz must contain exactly 10 questions; found ${quiz.questions.length}.`);
      }

      quiz.questions.forEach((question, index) => {
        const questionLocation = `${baseLocation}.quiz.questions[${index}]`;
        if (!isRecord(question)) {
          pushIssue(issues, "CRITICAL", "E", questionLocation, "Each quiz question must be an object.");
          return;
        }

        validateRequiredString(issues, "E", question.questionId, `${questionLocation}.questionId`, "questionId");
        validateRequiredString(issues, "E", question.prompt, `${questionLocation}.prompt`, "prompt");

        if (!Array.isArray(question.choices) || question.choices.length !== 3 || !question.choices.every(isNonEmptyString)) {
          pushIssue(issues, "HIGH", "E", `${questionLocation}.choices`, "Each quiz question must provide exactly 3 non-empty choices.");
        }

        const correctIndex = Number.isInteger(question.correctIndex)
          ? question.correctIndex
          : Number.isInteger(question.correctAnswerIndex)
            ? question.correctAnswerIndex
            : null;

        if (correctIndex == null || correctIndex < 0 || correctIndex > 2) {
          pushIssue(issues, "HIGH", "E", questionLocation, "Each quiz question must include a valid correctIndex or correctAnswerIndex in the range 0-2.");
        }

        if (
          Number.isInteger(question.correctIndex) &&
          Number.isInteger(question.correctAnswerIndex) &&
          question.correctIndex !== question.correctAnswerIndex
        ) {
          pushIssue(issues, "MEDIUM", "E", questionLocation, "correctIndex and correctAnswerIndex disagree.");
        }

        validateToneField(issues, "E", question.explanation, `${questionLocation}.explanation`, "explanation", "HIGH");
      });
    }
  }

  if (!isRecord(chapter.implementationPlan)) {
    if (packageProfile !== "v13_autonomous") {
      pushIssue(issues, "CRITICAL", "E", `${baseLocation}.implementationPlan`, "implementationPlan must be an object.");
    }
  } else {
    const generatedImplementation = hasGeneratedImplementationShape(chapter.implementationPlan);
    if (generatedImplementation) {
      validateToneField(
        issues,
        "E",
        chapter.implementationPlan.concreteAction,
        `${baseLocation}.implementationPlan.concreteAction`,
        "concreteAction",
        "HIGH"
      );
      validateToneField(
        issues,
        "E",
        chapter.implementationPlan.ifThenPlan,
        `${baseLocation}.implementationPlan.ifThenPlan`,
        "ifThenPlan",
        "HIGH"
      );
      validateToneField(
        issues,
        "E",
        chapter.implementationPlan.friction,
        `${baseLocation}.implementationPlan.friction`,
        "friction",
        "HIGH"
      );
      validateToneField(
        issues,
        "E",
        chapter.implementationPlan.checkpoint,
        `${baseLocation}.implementationPlan.checkpoint`,
        "checkpoint",
        "HIGH"
      );
    } else {
      validateToneField(issues, "E", chapter.implementationPlan.coreSkill, `${baseLocation}.implementationPlan.coreSkill`, "coreSkill", "HIGH");

      if (!Array.isArray(chapter.implementationPlan.ifThenPlans) || chapter.implementationPlan.ifThenPlans.length === 0) {
        pushIssue(issues, "HIGH", "E", `${baseLocation}.implementationPlan.ifThenPlans`, "ifThenPlans must be a non-empty array.");
      } else {
        chapter.implementationPlan.ifThenPlans.forEach((plan, index) => {
          const planLocation = `${baseLocation}.implementationPlan.ifThenPlans[${index}]`;
          if (!isRecord(plan)) {
            pushIssue(issues, "HIGH", "E", planLocation, "Each ifThenPlan must be an object.");
            return;
          }
          validateRequiredString(issues, "E", plan.context, `${planLocation}.context`, "context");
          validateToneField(issues, "E", plan.plan, `${planLocation}.plan`, "plan", "HIGH");
        });
      }

      validateToneField(
        issues,
        "E",
        chapter.implementationPlan.twentyFourHourChallenge,
        `${baseLocation}.implementationPlan.twentyFourHourChallenge`,
        "twentyFourHourChallenge",
        "HIGH"
      );
      validateToneField(
        issues,
        "E",
        chapter.implementationPlan.weeklyPractice,
        `${baseLocation}.implementationPlan.weeklyPractice`,
        "weeklyPractice",
        "HIGH"
      );
    }
  }

  if (!Array.isArray(chapter.reviewCards)) {
    pushIssue(issues, "CRITICAL", "E", `${baseLocation}.reviewCards`, "reviewCards must be an array.");
  } else {
    if (chapter.reviewCards.length !== 5) {
      pushIssue(issues, "HIGH", "E", `${baseLocation}.reviewCards`, `reviewCards must contain exactly 5 items; found ${chapter.reviewCards.length}.`);
    }

    chapter.reviewCards.forEach((card, index) => {
      const cardLocation = `${baseLocation}.reviewCards[${index}]`;
      if (!isRecord(card)) {
        pushIssue(issues, "HIGH", "E", cardLocation, "Each review card must be an object.");
        return;
      }
      if (card.cardId != null) {
        validateRequiredString(issues, "E", card.cardId, `${cardLocation}.cardId`, "cardId");
      }
      validateToneField(issues, "E", card.front, `${cardLocation}.front`, "front", "HIGH");
      validateToneField(issues, "E", card.back, `${cardLocation}.back`, "back", "HIGH");
      validateRequiredString(issues, "E", card.difficulty, `${cardLocation}.difficulty`, "difficulty");
    });

    const distribution = countDifficulties(chapter.reviewCards);
    if (distribution.easy !== 2 || distribution.medium !== 2 || distribution.hard !== 1 || distribution.other !== 0) {
      pushIssue(
        issues,
        "HIGH",
        "E",
        `${baseLocation}.reviewCards`,
        `reviewCards difficulty distribution must be 2 easy / 2 medium / 1 hard; found easy=${distribution.easy}, medium=${distribution.medium}, hard=${distribution.hard}, other=${distribution.other}.`
      );
    }
  }

  if (packageProfile !== "v13_autonomous" || chapter.keyTakeawayCard != null) {
    validateToneField(issues, "E", chapter.keyTakeawayCard, `${baseLocation}.keyTakeawayCard`, "keyTakeawayCard", "HIGH");
  }
}

function validateSealedIntegrity(pkg, chapter, issues, inputPath) {
  const chapterRoot = `ch${chapter.number}`;
  const surfaces = collectChapterToneSurfaces(chapter);

  walkToneObjects(chapter, chapterRoot, (path, toneObject) => {
    if (toneHasCollapse(toneObject)) {
      pushIssue(issues, "HIGH", "F", path, "Tone collapse detected: gentle/direct/competitive variants must stay materially distinct.");
    }

    const flat = TONE_KEYS.map((tone) => toneObject[tone]).join(" ").toLowerCase();
    CONTAMINATION_PHRASES.forEach((phrase) => {
      if (flat.includes(phrase)) {
        pushIssue(issues, "HIGH", "F", path, `Contamination phrase detected: "${phrase}".`);
      }
    });
  });

  const thesisFirstPattern = /^(this chapter|in this chapter|chapter\s+\d+|the author argues|the authors argue)\b/i;
  DEPTHS.forEach((depthName) => {
    const breakdown = chapter.contentVariants?.[depthName]?.chapterBreakdown;
    if (!isToneObject(breakdown)) return;

    TONE_KEYS.forEach((tone) => {
      const breakdownText = breakdown[tone];
      const sentence = firstSentence(breakdownText);
      if (thesisFirstPattern.test(sentence)) {
        pushIssue(
          issues,
          "WARN",
          "G",
          `${chapterRoot}.${depthName}.chapterBreakdown.${tone}`,
          `First sentence opens thesis-first: "${sentence}".`
        );
      }
      if (tone === "competitive" && COMPETITIVE_SLOGAN_LEADS.some((prefix) => normalizeText(sentence).startsWith(prefix))) {
        pushIssue(
          issues,
          "WARN",
          "G",
          `${chapterRoot}.${depthName}.chapterBreakdown.${tone}`,
          `Competitive breakdown opens with a slogan lead: "${sentence}".`
        );
      }

      const sentences = splitSentences(breakdownText);
      const normalized = new Map();
      sentences.forEach((entry, index) => {
        const key = normalizeText(entry);
        if (!key) return;
        if (normalized.has(key)) {
          pushIssue(
            issues,
            "WARN",
            "G",
            `${chapterRoot}.${depthName}.chapterBreakdown.${tone}`,
            `Repeated sentence detected between positions ${normalized.get(key) + 1} and ${index + 1}.`
          );
        } else {
          normalized.set(key, index);
        }
      });

      const endings = new Map();
      sentences.forEach((entry, index) => {
        const key = suffixKey(entry, 6);
        if (!key) return;
        const seen = endings.get(key) ?? [];
        seen.push(index + 1);
        endings.set(key, seen);
      });
      endings.forEach((positions) => {
        if (positions.length > 1) {
          pushIssue(
            issues,
            "WARN",
            "G",
            `${chapterRoot}.${depthName}.chapterBreakdown.${tone}`,
            `Repeated ending beat detected across sentences ${positions.join(", ")}.`
          );
        }
      });

      const normalizedBreakdown = normalizeText(breakdownText);
      CLAUSE_SCAFFOLDS.forEach((scaffold) => {
        const matches = normalizedBreakdown.match(new RegExp(`\\b${scaffold.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")) ?? [];
        if (matches.length > 1) {
          pushIssue(
            issues,
            "WARN",
            "G",
            `${chapterRoot}.${depthName}.chapterBreakdown.${tone}`,
            `Repeated clause scaffold "${scaffold}" appears ${matches.length} times.`
          );
        }
      });
    });
  });

  pushGenericImplementationWarnings(surfaces, issues);
  pushReinforcementEchoWarnings(surfaces, issues);

  if (!isSoGoodPackage(pkg, inputPath)) {
    pushChapterPackageDuplicateIssues(chapter, surfaces, issues);
    pushRepeatedTemplateTailIssues(surfaces, issues);
    pushRepeatedCardScaffoldIssues(chapter, issues);
  }
  pushGenericMoreDetailsIssues(chapter, issues);
  pushGenericPromptIssues(surfaces, issues);
  pushPitchAnythingIssues(pkg, surfaces, issues, inputPath);
  pushArtOfWarIssues(pkg, chapter, issues, inputPath);
  pushSoGoodIssues(pkg, chapter, surfaces, issues, inputPath);
  pushHardMediumSupportOverlapIssues(chapter, issues);
}

function validatePackage(pkg, inputPath = "") {
  const issues = [];
  const summaries = {
    wordCounts: [],
    exampleSummaries: [],
  };
  const depthRules = getDepthRulesForPackage(pkg, inputPath);

  validateRequiredString(issues, "A", pkg.packageId, "root.packageId", "packageId");

  if (!isNonEmptyString(pkg.createdAt) || Number.isNaN(Date.parse(pkg.createdAt))) {
    pushIssue(issues, "CRITICAL", "A", "root.createdAt", "createdAt must be a valid ISO date string.");
  }

  validateRequiredString(issues, "A", pkg.contentOwner, "root.contentOwner", "contentOwner");

  if (!isRecord(pkg.book)) {
    pushIssue(issues, "CRITICAL", "A", "root.book", "book must be an object.");
  } else {
    validateRequiredString(issues, "A", pkg.book.bookId, "book.bookId", "book.bookId");
    validateRequiredString(issues, "A", pkg.book.title, "book.title", "book.title");
    validateRequiredString(issues, "A", pkg.book.author, "book.author", "book.author");

    if (!Array.isArray(pkg.book.categories) || pkg.book.categories.length === 0 || !pkg.book.categories.every(isNonEmptyString)) {
      pushIssue(issues, "CRITICAL", "A", "book.categories", "book.categories must be a non-empty array of strings.");
    }

    if (pkg.book.variantFamily !== "EMH") {
      pushIssue(issues, "CRITICAL", "A", "book.variantFamily", 'variantFamily must equal "EMH".');
    }
  }
  validateAntifragileMetadata(pkg, issues);

  if (!Array.isArray(pkg.chapters) || pkg.chapters.length === 0) {
    pushIssue(issues, "CRITICAL", "A", "root.chapters", "chapters must be a non-empty array.");
    return { issues, summaries };
  }

  const seenNumbers = new Set();
  const seenChapterIds = new Set();
  let previousNumber = -Infinity;

  pkg.chapters.forEach((chapter, index) => {
    const chapterLocation = `chapters[${index}]`;

    if (!isRecord(chapter)) {
      pushIssue(issues, "CRITICAL", "A", chapterLocation, "Each chapter must be an object.");
      return;
    }

    validateRequiredString(issues, "A", chapter.chapterId, `${chapterLocation}.chapterId`, "chapterId");
    validateRequiredString(issues, "A", chapter.title, `${chapterLocation}.title`, "title");

    if (!isPositiveInteger(chapter.number)) {
      pushIssue(issues, "CRITICAL", "A", `${chapterLocation}.number`, "number must be a positive integer.");
    } else {
      if (seenNumbers.has(chapter.number)) {
        pushIssue(issues, "HIGH", "A", `${chapterLocation}.number`, `Duplicate chapter number ${chapter.number}.`);
      }
      if (chapter.number <= previousNumber) {
        pushIssue(issues, "HIGH", "A", `${chapterLocation}.number`, "Chapters must be sorted in strictly increasing number order.");
      }
      seenNumbers.add(chapter.number);
      previousNumber = chapter.number;
    }

    if (isNonEmptyString(chapter.chapterId)) {
      if (seenChapterIds.has(chapter.chapterId)) {
        pushIssue(issues, "HIGH", "A", `${chapterLocation}.chapterId`, `Duplicate chapterId "${chapter.chapterId}".`);
      }
      seenChapterIds.add(chapter.chapterId);
    }

    if (!isPositiveInteger(chapter.readingTimeMinutes)) {
      pushIssue(issues, "MEDIUM", "A", `${chapterLocation}.readingTimeMinutes`, "readingTimeMinutes must be a positive integer.");
    }

    if (!isRecord(chapter.contentVariants)) {
      pushIssue(issues, "CRITICAL", "A", `${chapterLocation}.contentVariants`, "contentVariants must be an object.");
      DEPTHS.forEach((depthName) => {
        summaries.wordCounts.push({
          chapter: chapter.number ?? `idx${index + 1}`,
          depth: depthName,
          counts: null,
        });
      });
    } else {
      DEPTHS.forEach((depthName) => {
        validateDepth(chapter, depthName, chapter.contentVariants[depthName], issues, summaries, depthRules);
      });
    }

    validateExamples(chapter, issues, summaries);
    validateQuizAndSupporting(chapter, issues);
    validateSealedIntegrity(pkg, chapter, issues, inputPath);
    validateAntifragileChapterContract(chapter, issues);
  });

  return { issues, summaries };
}

function validateModernReleasePackage(pkg) {
  const issues = [];
  const summaries = {
    wordCounts: [],
    exampleSummaries: [],
  };

  validateRequiredString(issues, "A", pkg.packageId, "root.packageId", "packageId");

  if (!isNonEmptyString(pkg.createdAt) || Number.isNaN(Date.parse(pkg.createdAt))) {
    pushIssue(issues, "CRITICAL", "A", "root.createdAt", "createdAt must be a valid ISO date string.");
  }

  validateRequiredString(issues, "A", pkg.contentOwner, "root.contentOwner", "contentOwner");

  if (!isRecord(pkg.book)) {
    pushIssue(issues, "CRITICAL", "A", "root.book", "book must be an object.");
  } else {
    validateRequiredString(issues, "A", pkg.book.bookId, "book.bookId", "book.bookId");
    validateRequiredString(issues, "A", pkg.book.title, "book.title", "book.title");
    validateRequiredString(issues, "A", pkg.book.author, "book.author", "book.author");

    if (!Array.isArray(pkg.book.categories) || pkg.book.categories.length === 0 || !pkg.book.categories.every(isNonEmptyString)) {
      pushIssue(issues, "CRITICAL", "A", "book.categories", "book.categories must be a non-empty array of strings.");
    }

    if (pkg.book.variantFamily !== "EMH") {
      pushIssue(issues, "CRITICAL", "A", "book.variantFamily", 'variantFamily must equal "EMH".');
    }
  }

  if (!Array.isArray(pkg.chapters) || pkg.chapters.length === 0) {
    pushIssue(issues, "CRITICAL", "A", "root.chapters", "chapters must be a non-empty array.");
    return { issues, summaries };
  }

  const seenNumbers = new Set();
  const seenChapterIds = new Set();
  let previousNumber = -Infinity;

  pkg.chapters.forEach((chapter, index) => {
    const chapterLocation = `chapters[${index}]`;

    if (!isRecord(chapter)) {
      pushIssue(issues, "CRITICAL", "A", chapterLocation, "Each chapter must be an object.");
      return;
    }

    validateRequiredString(issues, "A", chapter.chapterId, `${chapterLocation}.chapterId`, "chapterId");
    validateRequiredString(issues, "A", chapter.title, `${chapterLocation}.title`, "title");

    if (!isPositiveInteger(chapter.number)) {
      pushIssue(issues, "CRITICAL", "A", `${chapterLocation}.number`, "number must be a positive integer.");
    } else {
      if (seenNumbers.has(chapter.number)) {
        pushIssue(issues, "HIGH", "A", `${chapterLocation}.number`, `Duplicate chapter number ${chapter.number}.`);
      }
      if (chapter.number <= previousNumber) {
        pushIssue(issues, "HIGH", "A", `${chapterLocation}.number`, "Chapters must be sorted in strictly increasing number order.");
      }
      seenNumbers.add(chapter.number);
      previousNumber = chapter.number;
    }

    if (isNonEmptyString(chapter.chapterId)) {
      if (seenChapterIds.has(chapter.chapterId)) {
        pushIssue(issues, "HIGH", "A", `${chapterLocation}.chapterId`, `Duplicate chapterId "${chapter.chapterId}".`);
      }
      seenChapterIds.add(chapter.chapterId);
    }

    if (!isPositiveInteger(chapter.readingTimeMinutes)) {
      pushIssue(issues, "MEDIUM", "A", `${chapterLocation}.readingTimeMinutes`, "readingTimeMinutes must be a positive integer.");
    }

    if (!isRecord(chapter.contentVariants)) {
      pushIssue(issues, "CRITICAL", "A", `${chapterLocation}.contentVariants`, "contentVariants must be an object.");
    } else {
      DEPTHS.forEach((depthName) => {
        const depth = chapter.contentVariants[depthName];
        const depthLocation = `${chapterLocation}.contentVariants.${depthName}`;
        if (!isRecord(depth)) {
          pushIssue(issues, "CRITICAL", "B", depthLocation, `${depthName} contentVariant must be an object.`);
          return;
        }

        validateToneField(issues, "B", depth.chapterBreakdown, `${depthLocation}.chapterBreakdown`, "chapterBreakdown");

        if (!Array.isArray(depth.keyTakeaways) || depth.keyTakeaways.length === 0) {
          pushIssue(issues, "HIGH", "B", `${depthLocation}.keyTakeaways`, "keyTakeaways must be a non-empty array.");
        }
      });
    }

    if (!Array.isArray(chapter.examples) || chapter.examples.length === 0) {
      pushIssue(issues, "HIGH", "D", `${chapterLocation}.examples`, "examples must be a non-empty array.");
    }

    if (!isRecord(chapter.quiz) || !Array.isArray(chapter.quiz.questions) || chapter.quiz.questions.length === 0) {
      pushIssue(issues, "CRITICAL", "E", `${chapterLocation}.quiz`, "quiz.questions must not be empty.");
    }
  });

  return { issues, summaries };
}

function printReport(filePath, pkg, issues, summaries) {
  const sortedIssues = [...issues].sort((a, b) => {
    const severityDelta = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDelta !== 0) return severityDelta;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.location.localeCompare(b.location);
  });

  const result = sortedIssues.some((issue) => FAILURE_SEVERITIES.has(issue.severity)) ? "FAIL" : "PASS";
  const categoryCounts = Object.fromEntries(
    Object.keys(CATEGORY_LABELS).map((category) => [
      category,
      sortedIssues.filter((issue) => issue.category === category).length,
    ])
  );

  console.log("ChapterFlow Package Validator");
  console.log(`Target: ${filePath}`);
  if (isRecord(pkg)) {
    console.log(`Schema Version: ${pkg.schemaVersion ?? "(missing)"}`);
    console.log(`Package ID: ${pkg.packageId ?? "(missing)"}`);
  }
  console.log(`RESULT: ${result}`);
  console.log("");
  console.log("Issue Counts by Category");
  Object.entries(CATEGORY_LABELS).forEach(([category, label]) => {
    console.log(`- ${category} ${label}: ${categoryCounts[category]}`);
  });

  const severityGroups = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "WARN"];
  severityGroups.forEach((severity) => {
    const group = sortedIssues.filter((issue) => issue.severity === severity);
    if (group.length === 0) return;

    console.log("");
    console.log(`${severityHeading(severity)} (${group.length})`);
    group.forEach((entry) => {
      console.log(`- [${entry.category}] ${entry.location}: ${entry.message}`);
    });
  });

  console.log("");
  console.log("Appendix: Word Counts");
  const chapters = [...new Set(summaries.wordCounts.map((entry) => entry.chapter))];
  chapters.forEach((chapter) => {
    const lines = DEPTHS.map((depthName) => {
      const row = summaries.wordCounts.find((entry) => entry.chapter === chapter && entry.depth === depthName);
      if (!row || row.counts == null) {
        return `${depthName}=missing`;
      }
      return `${depthName}=${row.counts.gentle}/${row.counts.direct}/${row.counts.competitive}`;
    });
    console.log(`- ch${chapter}: ${lines.join(" | ")}`);
  });

  console.log("");
  console.log("Appendix: Example and Quiz Summary");
  summaries.exampleSummaries
    .sort((a, b) => Number(a.chapter) - Number(b.chapter))
    .forEach((summary) => {
      const uniqueFormats = new Set(summary.formats).size;
      const uniqueEndings = new Set(summary.endings).size;
      const choiceSummary = summary.choiceSizes.length === 0 ? "missing" : summary.choiceSizes.join("/");
      console.log(
        `- ch${summary.chapter}: formats=${uniqueFormats}/6 endings=${uniqueEndings}/6 categories=work:${summary.categories.work},school:${summary.categories.school},personal:${summary.categories.personal},other:${summary.categories.other} quiz=${summary.quizQuestions} choices=${choiceSummary} review=easy:${summary.reviewDistribution.easy},medium:${summary.reviewDistribution.medium},hard:${summary.reviewDistribution.hard},other:${summary.reviewDistribution.other}`
      );
    });
}

const inputPath = resolve(process.argv[2]);
let pkg;

try {
  pkg = JSON.parse(readFileSync(inputPath, "utf8"));
} catch (error) {
  console.error("ChapterFlow Package Validator");
  console.error(`Target: ${inputPath}`);
  console.error("RESULT: FAIL");
  console.error("");
  console.error(`- [A] root: Invalid JSON: ${error.message}`);
  process.exit(1);
}

if (!SUPPORTED_SCHEMA_VERSIONS.has(pkg?.schemaVersion)) {
  const issues = [];
  pushIssue(
    issues,
    "CRITICAL",
    "A",
    "root.schemaVersion",
    `Unsupported schemaVersion "${pkg?.schemaVersion ?? "(missing)"}". Supported schema versions: ${[...SUPPORTED_SCHEMA_VERSIONS].join(", ")}.`
  );
  printReport(inputPath, pkg, issues, { wordCounts: [], exampleSummaries: [] });
  process.exit(1);
}

// v21-authored packages are gated by the v21 ship gate during generation.
// Here we just confirm shape and required fields. For deeper validation, run:
//   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/run-ship-gate.ts <chapter.json>
function validateV21AuthoredPackage(pkg) {
  const issues = [];
  const requiredBookFields = ["bookId", "title", "author"];
  for (const f of requiredBookFields) {
    if (!pkg.book?.[f]) {
      pushIssue(issues, "HIGH", "A", `book.${f}`, `Missing required field for v21 schema.`);
    }
  }
  if (!Array.isArray(pkg.chapters) || pkg.chapters.length === 0) {
    pushIssue(issues, "CRITICAL", "A", "chapters", `v21 package has no chapters.`);
    return { issues, summaries: { wordCounts: [], exampleSummaries: [] } };
  }
  const requiredChapterFields = ["chapterId", "number", "title", "hook", "keyTakeaway", "breakdown", "examples", "quiz", "reviewCards", "implementationPlan"];
  for (const ch of pkg.chapters) {
    for (const f of requiredChapterFields) {
      if (ch[f] === undefined || ch[f] === null) {
        pushIssue(issues, "HIGH", "A", `chapters[${ch.number ?? "?"}].${f}`, `Missing required v21 field.`);
      }
    }
    const tiers = ["fastRead", "deepRead", "fullRead"];
    for (const t of tiers) {
      if (typeof ch.breakdown?.[t] !== "string" || ch.breakdown[t].length < 200) {
        pushIssue(issues, "HIGH", "A", `chapters[${ch.number}].breakdown.${t}`, `v21 breakdown.${t} missing or too short.`);
      }
    }
    if (!Array.isArray(ch.examples) || ch.examples.length < 3) {
      pushIssue(issues, "HIGH", "A", `chapters[${ch.number}].examples`, `v21 expects ≥3 examples per chapter.`);
    }
  }
  return { issues, summaries: { wordCounts: [], exampleSummaries: [] } };
}

const { issues, summaries } =
  pkg.schemaVersion === "chapterflow-v21-authored"
    ? validateV21AuthoredPackage(pkg)
    : pkg.schemaVersion === "chapterflow-v13-release"
      ? validateModernReleasePackage(pkg)
      : validatePackage(pkg, inputPath);
printReport(inputPath, pkg, issues, summaries);
process.exit(issues.some((entry) => FAILURE_SEVERITIES.has(entry.severity)) ? 1 : 0);
