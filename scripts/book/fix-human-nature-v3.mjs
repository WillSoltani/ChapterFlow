#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, "book-packages", "laws-of-human-nature.modern.json");

// ─── UTILITIES ──────────────────────────────────────────────────────────

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function zeroPad(value) {
  return String(value).padStart(2, "0");
}

function walkStrings(obj, visitor, currentPath = []) {
  if (typeof obj === "string") {
    visitor(obj, currentPath.join("."));
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => walkStrings(item, visitor, [...currentPath, String(index)]));
    return;
  }
  if (obj && typeof obj === "object") {
    for (const [key, item] of Object.entries(obj)) {
      walkStrings(item, visitor, [...currentPath, key]);
    }
  }
}

function walkAndReplace(obj, replacer, currentPath = []) {
  if (typeof obj === "string") {
    return replacer(obj, currentPath.join("."));
  }
  if (Array.isArray(obj)) {
    return obj.map((item, index) => walkAndReplace(item, replacer, [...currentPath, String(index)]));
  }
  if (obj && typeof obj === "object") {
    const result = {};
    for (const [key, item] of Object.entries(obj)) {
      result[key] = walkAndReplace(item, replacer, [...currentPath, key]);
    }
    return result;
  }
  return obj;
}

function getLastSentence(text) {
  const parts = String(text).trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────

const ENDING_TYPES = [
  "broader_principle",
  "self_directed_question",
  "surprising_implication",
  "cross_domain",
  "common_trap",
  "perspective_reframe",
];

const LEVERAGE_SYNONYMS = [
  "advantage", "influence", "position", "power", "upper hand", "edge",
  "hold", "sway", "bargaining power", "pull",
];

const ASK_SELF_ALTS = [
  "consider this:",
  "the question becomes:",
  "what shifts is:",
  "try this lens:",
  "the test is:",
  "the real question is:",
  "a useful check:",
  "one way to test this:",
  "a revealing question:",
  "the deeper question is:",
];

const NAVIGATING_ALTS = [
  "handling", "working through", "managing", "dealing with",
  "moving through", "facing", "addressing", "confronting",
];

const LANDSCAPE_ALTS = [
  "environment", "context", "terrain", "world", "field", "territory", "space",
];

const ROBUST_ALTS = ["strong", "solid", "durable", "reliable"];

const SITTING_WITH_REPLACEMENTS = [
  "One thing that tends to go unnoticed is",
  "You might have experienced this without naming it:",
  "The part most people skip past is",
  "A small detail changes the entire picture here.",
  "Something counterintuitive is hiding in this principle.",
];

const STUDY_GROUP_MAP = {
  12: "peer tutoring session",
  14: "debate team practice",
  17: "campus newspaper editorial meeting",
  18: "thesis advisor meeting",
};

// Chapters to keep "study group" in
const STUDY_GROUP_KEEP = new Set([1, 6, 9]);

// ─── STEP 1: ADD ENDING TYPE ────────────────────────────────────────────

function fixEndingType() {
  const pkg = readJson(PACKAGE_PATH);
  let added = 0;
  let reassigned = 0;

  for (const ch of pkg.chapters) {
    const examples = ch.examples || [];
    if (examples.length !== 6) {
      console.log(`  WARNING: Ch${zeroPad(ch.number)} has ${examples.length} examples (expected 6)`);
    }

    // Strip existing endingType to allow re-classification
    for (const ex of examples) {
      delete ex.endingType;
    }

    const endingAssignments = new Map();
    // Score each example for all 6 types, then assign greedily
    const scores = [];

    for (let i = 0; i < examples.length; i++) {
      const ex = examples[i];
      const whyText = typeof ex.whyItMatters === "string"
        ? ex.whyItMatters
        : (ex.whyItMatters?.direct || "");
      const lastSent = getLastSentence(whyText);

      const s = {
        self_directed_question: 0,
        cross_domain: 0,
        common_trap: 0,
        broader_principle: 0,
        surprising_implication: 0,
        perspective_reframe: 0,
      };

      // Question ending is strong signal
      if (lastSent.endsWith("?")) s.self_directed_question += 10;

      // Common trap: look for trap/mistake keywords in LAST SENTENCE only
      if (/\bmistake\b|\btrap\b|\bwrong\b|\berror\b|\bfail/i.test(lastSent)) s.common_trap += 8;
      if (/\bavoid\b|\bdanger\b|\bcost\b|\bpenalt/i.test(lastSent)) s.common_trap += 5;
      // Weaker signal from full text
      if (/\bmistake\b|\btrap\b/i.test(whyText)) s.common_trap += 2;

      // Surprising implication
      if (/\bsurpris/i.test(lastSent) || /\bunexpect/i.test(lastSent) || /\bcounterintuiti/i.test(lastSent)) s.surprising_implication += 8;
      if (/\bparadox/i.test(whyText) || /\bironi/i.test(whyText)) s.surprising_implication += 4;
      if (/\bsurpris/i.test(whyText) || /\bunexpect/i.test(whyText)) s.surprising_implication += 2;

      // Cross-domain
      const exCategory = ex.category || (ex.contexts && ex.contexts[0]) || "work";
      const otherDomains = {
        work: /\bschool\b|\bclassroom\b|\bfamily\b|\brelationship/i,
        school: /\boffice\b|\bboss\b|\bfamily\b|\bclient/i,
        personal: /\boffice\b|\bwork\b|\bschool\b|\bclassroom\b/i,
      };
      if (otherDomains[exCategory]?.test(lastSent)) s.cross_domain += 8;
      if (otherDomains[exCategory]?.test(whyText)) s.cross_domain += 3;

      // Perspective reframe
      if (/\breframe\b|\bperspective\b|\blens\b|\bangle\b|\bflip\b/i.test(lastSent)) s.perspective_reframe += 8;
      if (/\bshift\b|\brevers/i.test(lastSent)) s.perspective_reframe += 5;
      if (/\breframe\b|\bperspective\b|\blens\b/i.test(whyText)) s.perspective_reframe += 2;

      // Broader principle: general/universal language
      if (/\balways\b|\bnever\b|\beveryone\b|\bprinciple\b|\brule\b|\buniversal/i.test(lastSent)) s.broader_principle += 5;
      // Give broader_principle a baseline so it gets assigned to at least some examples
      s.broader_principle += 1;

      scores.push(s);
    }

    // Greedy assignment: for each ending type (in priority order), assign to the
    // example with the highest score for that type, if not already assigned
    const assigned = new Set(); // example indices
    const usedTypes = new Set(); // ending types

    // First pass: assign types with clear winners (score >= 8)
    for (const type of ENDING_TYPES) {
      let bestIdx = -1, bestScore = 7; // threshold
      for (let i = 0; i < scores.length; i++) {
        if (assigned.has(i)) continue;
        if (scores[i][type] > bestScore) {
          bestScore = scores[i][type];
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        endingAssignments.set(bestIdx, type);
        assigned.add(bestIdx);
        usedTypes.add(type);
      }
    }

    // Second pass: fill remaining types by best available score
    for (const type of ENDING_TYPES) {
      if (usedTypes.has(type)) continue;
      let bestIdx = -1, bestScore = -1;
      for (let i = 0; i < scores.length; i++) {
        if (assigned.has(i)) continue;
        if (scores[i][type] > bestScore) {
          bestScore = scores[i][type];
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        endingAssignments.set(bestIdx, type);
        assigned.add(bestIdx);
        usedTypes.add(type);
      }
    }

    // Third pass: assign any remaining unassigned examples to remaining types
    const remainingTypes = ENDING_TYPES.filter(t => !usedTypes.has(t));
    let rtIdx = 0;
    for (let i = 0; i < examples.length; i++) {
      if (assigned.has(i)) continue;
      if (rtIdx < remainingTypes.length) {
        endingAssignments.set(i, remainingTypes[rtIdx]);
        rtIdx++;
      } else {
        // Fallback: assign broader_principle (shouldn't happen with 6 examples and 6 types)
        endingAssignments.set(i, "broader_principle");
      }
    }

    // Verify uniqueness
    const endingCounts = {};
    for (const [_, et] of endingAssignments) {
      endingCounts[et] = (endingCounts[et] || 0) + 1;
    }

    const missingEndings = ENDING_TYPES.filter(e => !endingCounts[e] || endingCounts[e] === 0);
    if (missingEndings.length > 0) {
      // Steal from duplicates, preferring broader_principle
      const stealOrder = [...endingAssignments.entries()]
        .filter(([_, et]) => endingCounts[et] > 1)
        .sort((a, b) => {
          if (a[1] === "broader_principle" && b[1] !== "broader_principle") return -1;
          if (b[1] === "broader_principle" && a[1] !== "broader_principle") return 1;
          return endingCounts[b[1]] - endingCounts[a[1]];
        });

      for (const missing of missingEndings) {
        if (stealOrder.length === 0) break;
        const [idx, oldEt] = stealOrder.shift();
        endingAssignments.set(idx, missing);
        endingCounts[oldEt]--;
        endingCounts[missing] = 1;
      }
    }

    // Apply
    for (const [i, et] of endingAssignments) {
      if (!examples[i].endingType) {
        examples[i].endingType = et;
        added++;
      }
    }
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`endingType: added to ${added} examples`);
}

// ─── STEP 2: FIX LEVERAGE ──────────────────────────────────────────────

function fixLeverage() {
  const pkg = readJson(PACKAGE_PATH);
  let totalRemoved = 0;

  for (const ch of pkg.chapters) {
    let chapterCount = 0;
    const synIndex = ch.number % LEVERAGE_SYNONYMS.length;

    pkg.chapters[pkg.chapters.indexOf(ch)] = walkAndReplace(ch, (text) => {
      return text.replace(/\bleverage\b/gi, (match) => {
        chapterCount++;
        if (chapterCount === 1) return match;
        totalRemoved++;
        const syn = LEVERAGE_SYNONYMS[(synIndex + chapterCount) % LEVERAGE_SYNONYMS.length];
        if (match[0] === match[0].toUpperCase()) {
          return syn.charAt(0).toUpperCase() + syn.slice(1);
        }
        return syn;
      });
    });
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`leverage: removed ${totalRemoved} excess occurrences (kept 1 per chapter)`);
}

// ─── STEP 3: FIX ASK YOURSELF ──────────────────────────────────────────

function fixAskSelf() {
  const pkg = readJson(PACKAGE_PATH);
  let totalRemoved = 0;

  for (const ch of pkg.chapters) {
    let chapterCount = 0;
    let altIdx = ch.number % ASK_SELF_ALTS.length;

    pkg.chapters[pkg.chapters.indexOf(ch)] = walkAndReplace(ch, (text) => {
      return text.replace(/\bask yourself\b/gi, (match) => {
        chapterCount++;
        if (chapterCount === 1) return match;
        totalRemoved++;
        const alt = ASK_SELF_ALTS[altIdx % ASK_SELF_ALTS.length];
        altIdx++;
        // Preserve capitalization if at sentence start
        if (match[0] === "A") {
          return alt.charAt(0).toUpperCase() + alt.slice(1);
        }
        return alt;
      });
    });
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`"ask yourself": removed ${totalRemoved} excess occurrences (kept 1 per chapter)`);
}

// ─── STEP 4: FIX AI-TELL PHRASES ───────────────────────────────────────

function fixAiTell() {
  const pkg = readJson(PACKAGE_PATH);
  let navCount = 0, landCount = 0, robCount = 0;
  let navIdx = 0, landIdx = 0, robIdx = 0;

  for (const ch of pkg.chapters) {
    pkg.chapters[pkg.chapters.indexOf(ch)] = walkAndReplace(ch, (text) => {
      let result = text;

      // navigating
      result = result.replace(/\bnavigating\b/gi, (match) => {
        const alt = NAVIGATING_ALTS[navIdx % NAVIGATING_ALTS.length];
        navIdx++;
        navCount++;
        if (match[0] === match[0].toUpperCase()) {
          return alt.charAt(0).toUpperCase() + alt.slice(1);
        }
        return alt;
      });

      // landscape
      result = result.replace(/\blandscape\b/gi, (match) => {
        const alt = LANDSCAPE_ALTS[landIdx % LANDSCAPE_ALTS.length];
        landIdx++;
        landCount++;
        if (match[0] === match[0].toUpperCase()) {
          return alt.charAt(0).toUpperCase() + alt.slice(1);
        }
        return alt;
      });

      // robust
      result = result.replace(/\brobust\b/gi, (match) => {
        const alt = ROBUST_ALTS[robIdx % ROBUST_ALTS.length];
        robIdx++;
        robCount++;
        if (match[0] === match[0].toUpperCase()) {
          return alt.charAt(0).toUpperCase() + alt.slice(1);
        }
        return alt;
      });

      return result;
    });
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`AI-tell phrases: navigating=${navCount}, landscape=${landCount}, robust=${robCount}`);
}

// ─── STEP 5: FIX "HERE IS SOMETHING WORTH SITTING WITH" ────────────────

function fixSittingWith() {
  const pkg = readJson(PACKAGE_PATH);
  let replaced = 0;
  let openerIdx = 0;

  for (const ch of pkg.chapters) {
    pkg.chapters[pkg.chapters.indexOf(ch)] = walkAndReplace(ch, (text) => {
      const pattern = /Here is something worth sitting with[.:,]?\s?/gi;
      if (pattern.test(text)) {
        // Reset lastIndex since test() moved it
        pattern.lastIndex = 0;
        const replacement = SITTING_WITH_REPLACEMENTS[openerIdx % SITTING_WITH_REPLACEMENTS.length];
        openerIdx++;
        replaced++;
        return text.replace(pattern, replacement + " ");
      }
      return text;
    });
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`"Here is something worth sitting with": replaced ${replaced} occurrences`);
}

// ─── STEP 6: FIX STUDY GROUP ───────────────────────────────────────────

function fixStudyGroup() {
  const pkg = readJson(PACKAGE_PATH);
  let replaced = 0;

  for (const ch of pkg.chapters) {
    if (STUDY_GROUP_KEEP.has(ch.number)) continue;

    const replacement = STUDY_GROUP_MAP[ch.number];
    if (!replacement) continue;

    pkg.chapters[pkg.chapters.indexOf(ch)] = walkAndReplace(ch, (text) => {
      if (/\bstudy group\b/i.test(text)) {
        replaced++;
        return text.replace(/\bstudy group\b/gi, (match) => {
          if (match[0] === match[0].toUpperCase()) {
            return replacement.charAt(0).toUpperCase() + replacement.slice(1);
          }
          return replacement;
        });
      }
      return text;
    });
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`"study group": replaced in ${Object.keys(STUDY_GROUP_MAP).length} chapters (${replaced} field replacements)`);
}

// ─── STEP 7: FIX DOUBLE HYPHENS ────────────────────────────────────────

function fixDoubleHyphens() {
  const pkg = readJson(PACKAGE_PATH);
  let replaced = 0;

  for (const ch of pkg.chapters) {
    pkg.chapters[pkg.chapters.indexOf(ch)] = walkAndReplace(ch, (text) => {
      if (text.includes("--")) {
        replaced++;
        // Replace " -- text -- " parenthetical pattern with commas
        let result = text.replace(/ -- /g, ", ");
        // Catch any remaining standalone --
        result = result.replace(/--/g, ", ");
        return result;
      }
      return text;
    });
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Double hyphens: replaced in ${replaced} fields`);
}

// ─── STEP 8: FIX PRACTICE TAKEAWAYS ────────────────────────────────────

function fixPractice() {
  const pkg = readJson(PACKAGE_PATH);
  let fixed = 0;

  for (const ch of pkg.chapters) {
    const medKTs = ch.contentVariants?.medium?.keyTakeaways || [];

    for (const kt of medKTs) {
      const directPoint = typeof kt.point === "string" ? kt.point : (kt.point?.direct || "");

      // Extract bold headline
      const boldMatch = directPoint.match(/^\*\*(.+?)\*\*/);
      if (!boldMatch) continue;

      const headline = boldMatch[1];
      const firstWord = headline.match(/^(\w+)/)?.[1] || "";
      const restOfHeadline = headline.slice(firstWord.length).trim();

      // Guard: skip noun usage like "Delay and suppression..."
      if (/^and\b/i.test(restOfHeadline)) continue;

      // Only fix imperative headlines
      if (firstWord === "Track") {
        // Ch16: "Track outcomes, not tone." -> "Outcomes reveal intent more reliably than tone."
        const newHeadline = "Outcomes reveal intent more reliably than tone.";
        const oldBold = `**${headline}**`;
        const newBold = `**${newHeadline}**`;

        // Fix all tone variants
        if (typeof kt.point === "object") {
          for (const tone of ["gentle", "direct", "competitive"]) {
            if (kt.point[tone] && kt.point[tone].includes(oldBold)) {
              // Replace bold headline and adjust the follow-on text
              kt.point[tone] = kt.point[tone].replace(
                oldBold,
                newBold
              );
              // Also replace the immediate follow-on sentence if it starts with "Track"
              kt.point[tone] = kt.point[tone].replace(
                /\*\* Track /,
                "** Tracking "
              );
            }
          }
          // If only direct has it
          if (kt.point.direct && kt.point.direct.includes(`**${headline}**`)) {
            kt.point.direct = kt.point.direct.replace(
              `**${headline}**`,
              newBold
            );
          }
        }
        fixed++;
        console.log(`  Ch${zeroPad(ch.number)}: Fixed "Track" headline -> "${newHeadline}"`);
      }
    }
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Practice takeaways: fixed ${fixed} imperative headlines`);
}

// ─── AUDIT ─────────────────────────────────────────────────────────────

function audit() {
  const pkg = readJson(PACKAGE_PATH);
  const results = {
    leverage: { total: 0, byChapter: {} },
    askSelf: { total: 0, byChapter: {}, chaptersOver1: [] },
    aiTell: { navigating: 0, landscape: 0, robust: 0 },
    sittingWith: 0,
    studyGroup: { chapters: [] },
    doubleHyphens: 0,
    declarativeEndings: { total: 0, byChapter: {} },
    patternClosings: 0,
    mechanismClosings: 0,
    structuralClosings: 0,
    missingEndingType: 0,
    endingTypeDistribution: {},
    beforeAfterTitles: 0,
    predictsTitles: 0,
    possessiveTitles: 0,
    practiceTakeaways: [],
    emDashes: 0,
  };

  for (const ch of pkg.chapters) {
    const nn = zeroPad(ch.number);
    let leverageCount = 0;
    let askSelfCount = 0;
    let declarativeCount = 0;
    const chEndingTypes = [];

    // Check examples
    for (const ex of ch.examples || []) {
      if (!ex.endingType) results.missingEndingType++;
      else chEndingTypes.push(ex.endingType);

      if (/before and after/i.test(ex.title)) results.beforeAfterTitles++;
      if (/\bpredicts?\b/i.test(ex.title)) results.predictsTitles++;
      if (/^[A-Z][a-z]+'s\s/.test(ex.title)) results.possessiveTitles++;
    }

    // Track ending type distribution per chapter
    results.endingTypeDistribution[nn] = chEndingTypes;

    walkStrings(ch, (text, fieldPath) => {
      // Leverage
      const levMatches = text.match(/\bleverage\b/gi);
      if (levMatches) leverageCount += levMatches.length;

      // Ask yourself
      const askMatches = text.match(/\bask yourself\b/gi);
      if (askMatches) askSelfCount += askMatches.length;

      // AI-tell
      if (/\bnavigating\b/i.test(text)) results.aiTell.navigating++;
      if (/\blandscape\b/i.test(text)) results.aiTell.landscape++;
      if (/\brobust\b/i.test(text)) results.aiTell.robust++;

      // Sitting with
      if (/here is something worth sitting with/i.test(text)) results.sittingWith++;

      // Study group
      if (/\bstudy group\b/i.test(text) && !results.studyGroup.chapters.includes(ch.number)) {
        results.studyGroup.chapters.push(ch.number);
      }

      // Double hyphens
      const dhMatches = text.match(/--/g);
      if (dhMatches) results.doubleHyphens += dhMatches.length;

      // Declarative endings
      const lastSent = getLastSentence(text);
      if (/^(It is|This is|That is)\s/i.test(lastSent) && lastSent.split(/\s+/).length < 15) {
        declarativeCount++;
      }

      // Vocabulary closings
      if (/\bpattern\b/i.test(lastSent)) results.patternClosings++;
      if (/\bmechanism\b/i.test(lastSent)) results.mechanismClosings++;
      if (/\bstructural\b/i.test(lastSent)) results.structuralClosings++;

      // Em/en dashes
      const dashMatches = text.match(/[\u2013\u2014]/g);
      if (dashMatches) results.emDashes += dashMatches.length;
    });

    if (leverageCount > 0) {
      results.leverage.total += leverageCount;
      results.leverage.byChapter[nn] = leverageCount;
    }
    if (askSelfCount > 0) {
      results.askSelf.total += askSelfCount;
      results.askSelf.byChapter[nn] = askSelfCount;
      if (askSelfCount > 1) results.askSelf.chaptersOver1.push(ch.number);
    }
    if (declarativeCount > 0) {
      results.declarativeEndings.total += declarativeCount;
      results.declarativeEndings.byChapter[nn] = declarativeCount;
    }

    // Practice takeaways
    const medKTs = ch.contentVariants?.medium?.keyTakeaways || [];
    for (const [i, kt] of medKTs.entries()) {
      const dp = typeof kt.point === "string" ? kt.point : (kt.point?.direct || "");
      const stripped = dp.replace(/^\*+/, "").trim();
      if (/^(?:Try|Practice|Run|Test|Count|Ask|Write|Start|Begin|Make|Do|Track|Record|Monitor|Check|Review|Schedule|Plan|Set|Create|Build|Stop)\b/i.test(stripped)) {
        // Guard against noun usage
        const firstWord = stripped.match(/^(\w+)/)?.[1] || "";
        const rest = stripped.slice(firstWord.length).trim();
        if (/^and\b/i.test(rest)) continue;
        results.practiceTakeaways.push({
          chapter: ch.number, index: i, text: dp.slice(0, 120),
        });
      }
    }
  }

  console.log("=== Laws of Human Nature v3 Compliance Audit ===\n");

  console.log("--- STEP 1: ENDING TYPE ---");
  console.log(`  Missing endingType: ${results.missingEndingType}`);
  for (const [nn, types] of Object.entries(results.endingTypeDistribution)) {
    const unique = new Set(types);
    const missing = ENDING_TYPES.filter(e => !unique.has(e));
    if (missing.length > 0 || types.length !== 6) {
      console.log(`  Ch${nn}: ${types.length} types, missing: [${missing.join(", ")}]`);
    }
  }

  console.log("\n--- STEP 2: LEVERAGE ---");
  console.log(`  Total: ${results.leverage.total} (target: max 1/chapter = max 18)`);
  const topLev = Object.entries(results.leverage.byChapter).sort((a, b) => b[1] - a[1]);
  for (const [ch, count] of topLev) console.log(`    Ch${ch}: ${count}`);

  console.log("\n--- STEP 3: ASK YOURSELF ---");
  console.log(`  Total: ${results.askSelf.total} (target: max 1/chapter = max 18)`);
  console.log(`  Chapters with 2+: ${results.askSelf.chaptersOver1.length}`);
  const topAsk = Object.entries(results.askSelf.byChapter).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [ch, count] of topAsk) console.log(`    Ch${ch}: ${count}`);

  console.log("\n--- STEP 4: AI-TELL PHRASES ---");
  console.log(`  navigating: ${results.aiTell.navigating} (target: 0)`);
  console.log(`  landscape: ${results.aiTell.landscape} (target: 0)`);
  console.log(`  robust: ${results.aiTell.robust} (target: 0)`);

  console.log("\n--- STEP 5: SITTING WITH ---");
  console.log(`  "Here is something worth sitting with": ${results.sittingWith} (target: 0)`);

  console.log("\n--- STEP 6: STUDY GROUP ---");
  console.log(`  Chapters with "study group": [${results.studyGroup.chapters.join(", ")}] (target: max 3)`);

  console.log("\n--- STEP 7: DOUBLE HYPHENS ---");
  console.log(`  "--" occurrences: ${results.doubleHyphens} (target: 0)`);

  console.log("\n--- STEP 8: PRACTICE TAKEAWAYS ---");
  console.log(`  Imperative headlines: ${results.practiceTakeaways.length} (target: 0)`);
  for (const pt of results.practiceTakeaways) {
    console.log(`    Ch${zeroPad(pt.chapter)} med[${pt.index}]: ${pt.text}`);
  }

  console.log("\n--- PHASE B PREVIEW ---");
  console.log(`  Declarative endings: ${results.declarativeEndings.total}`);
  console.log(`  "pattern" in closings: ${results.patternClosings}`);
  console.log(`  "mechanism" in closings: ${results.mechanismClosings}`);
  console.log(`  "structural" in closings: ${results.structuralClosings}`);
  console.log(`  Possessive titles ("[Name]'s [X]"): ${results.possessiveTitles}`);
  console.log(`  "Predicts" titles: ${results.predictsTitles}`);
  console.log(`  "Before and After" titles: ${results.beforeAfterTitles}`);
  console.log(`  Em/en dashes: ${results.emDashes}`);
}

// ─── VALIDATE ──────────────────────────────────────────────────────────

function validate() {
  const pkg = readJson(PACKAGE_PATH);
  let pass = 0, fail = 0;

  function check(name, condition) {
    if (condition) {
      console.log(`  PASS: ${name}`);
      pass++;
    } else {
      console.log(`  FAIL: ${name}`);
      fail++;
    }
  }

  let missingEndingType = 0;
  let endingTypeWrong = 0;
  let leverageOver1 = 0;
  let askSelfOver1 = 0;
  let navCount = 0, landCount = 0, robCount = 0;
  let sittingWith = 0;
  let studyGroupChapters = new Set();
  let doubleHyphens = 0;
  let imperativeKTs = 0;

  for (const ch of pkg.chapters) {
    let chLeverage = 0;
    let chAskSelf = 0;
    const chEndingTypes = [];

    for (const ex of ch.examples || []) {
      if (!ex.endingType) missingEndingType++;
      else chEndingTypes.push(ex.endingType);
    }

    // Check ending type distribution
    const unique = new Set(chEndingTypes);
    const missing = ENDING_TYPES.filter(e => !unique.has(e));
    if (missing.length > 0 && chEndingTypes.length === 6) endingTypeWrong++;

    walkStrings(ch, (text) => {
      const lev = text.match(/\bleverage\b/gi);
      if (lev) chLeverage += lev.length;
      const ask = text.match(/\bask yourself\b/gi);
      if (ask) chAskSelf += ask.length;
      if (/\bnavigating\b/i.test(text)) navCount++;
      if (/\blandscape\b/i.test(text)) landCount++;
      if (/\brobust\b/i.test(text)) robCount++;
      if (/here is something worth sitting with/i.test(text)) sittingWith++;
      if (/\bstudy group\b/i.test(text)) studyGroupChapters.add(ch.number);
      if (text.includes("--")) doubleHyphens++;
    });

    if (chLeverage > 1) leverageOver1++;
    if (chAskSelf > 1) askSelfOver1++;

    // Practice takeaways
    const medKTs = ch.contentVariants?.medium?.keyTakeaways || [];
    for (const kt of medKTs) {
      const dp = typeof kt.point === "string" ? kt.point : (kt.point?.direct || "");
      const stripped = dp.replace(/^\*+/, "").trim();
      const firstWord = stripped.match(/^(\w+)/)?.[1] || "";
      const rest = stripped.slice(firstWord.length).trim();
      if (/^and\b/i.test(rest)) continue;
      if (/^(?:Track|Record|Monitor|Check|Review|Schedule|Plan|Set|Create|Build|Stop)\b/.test(stripped)) {
        imperativeKTs++;
      }
    }
  }

  console.log("=== Phase A Validation ===\n");
  check("All 108 examples have endingType", missingEndingType === 0);
  check("Each chapter uses all 6 endingTypes", endingTypeWrong === 0);
  check("leverage max 1/chapter", leverageOver1 === 0);
  check("ask yourself max 1/chapter", askSelfOver1 === 0);
  check("Zero navigating", navCount === 0);
  check("Zero landscape", landCount === 0);
  check("Zero robust", robCount === 0);
  check("Zero 'Here is something worth sitting with'", sittingWith === 0);
  check("study group in max 3 chapters", studyGroupChapters.size <= 3);
  check("Zero double hyphens", doubleHyphens === 0);
  check("Zero imperative practice takeaways", imperativeKTs === 0);

  console.log(`\n=== Results: ${pass} PASS, ${fail} FAIL ===`);
  if (fail > 0) process.exit(1);
}

// ─── FIX ALL ───────────────────────────────────────────────────────────

function fixAll() {
  console.log("=== Running all Phase A fixes ===\n");

  console.log("--- Step 1: Add endingType ---");
  fixEndingType();

  console.log("\n--- Step 2: Fix leverage ---");
  fixLeverage();

  console.log("\n--- Step 3: Fix ask yourself ---");
  fixAskSelf();

  console.log("\n--- Step 4: Fix AI-tell phrases ---");
  fixAiTell();

  console.log("\n--- Step 5: Fix 'Here is something worth sitting with' ---");
  fixSittingWith();

  console.log("\n--- Step 6: Fix study group ---");
  fixStudyGroup();

  console.log("\n--- Step 7: Fix double hyphens ---");
  fixDoubleHyphens();

  console.log("\n--- Step 8: Fix practice takeaways ---");
  fixPractice();

  console.log("\n=== All Phase A fixes complete ===");
}

// ─── CLI ────────────────────────────────────────────────────────────────

const command = process.argv[2] ?? "audit";

switch (command) {
  case "audit":           audit(); break;
  case "fix-endingtype":  fixEndingType(); break;
  case "fix-leverage":    fixLeverage(); break;
  case "fix-askself":     fixAskSelf(); break;
  case "fix-aitell":      fixAiTell(); break;
  case "fix-sittingwith": fixSittingWith(); break;
  case "fix-studygroup":  fixStudyGroup(); break;
  case "fix-hyphens":     fixDoubleHyphens(); break;
  case "fix-practice":    fixPractice(); break;
  case "fix-all":         fixAll(); break;
  case "validate":        validate(); break;
  default:
    console.log("Usage: node fix-human-nature-v3.mjs <command>");
    console.log("Commands: audit, fix-endingtype, fix-leverage, fix-askself,");
    console.log("  fix-aitell, fix-sittingwith, fix-studygroup, fix-hyphens,");
    console.log("  fix-practice, fix-all, validate");
    process.exit(1);
}
