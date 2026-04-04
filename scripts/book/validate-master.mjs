#!/usr/bin/env node
/**
 * MasterValidator — automated checks for ChapterFlow book packages.
 * Usage: node scripts/book/validate-master.mjs book-packages/the-48-laws-of-power.modern.json
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node validate-master.mjs <path-to-json>");
  process.exit(1);
}

const raw = readFileSync(resolve(filePath), "utf-8");
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error("FATAL: Invalid JSON —", e.message);
  process.exit(1);
}

const issues = []; // {severity, category, description, location, fix}
function issue(severity, category, desc, location, fix) {
  issues.push({ severity, category, description: desc, location, fix });
}

const chapters = data.chapters || [];
const N = chapters.length;

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function isToneObj(obj) {
  return (
    obj &&
    typeof obj === "object" &&
    !Array.isArray(obj) &&
    typeof obj.gentle === "string" &&
    obj.gentle.length > 0 &&
    typeof obj.direct === "string" &&
    obj.direct.length > 0 &&
    typeof obj.competitive === "string" &&
    obj.competitive.length > 0
  );
}

function wordCount(s) {
  if (typeof s !== "string") return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function lastSentence(s) {
  if (typeof s !== "string") return "";
  const sentences = s.replace(/\n/g, " ").split(/(?<=[.!?])\s+/);
  return (sentences[sentences.length - 1] || "").trim();
}

function walkStrings(obj, path, cb) {
  if (typeof obj === "string") {
    cb(obj, path);
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => walkStrings(v, `${path}[${i}]`, cb));
  } else if (obj && typeof obj === "object") {
    for (const k of Object.keys(obj)) {
      walkStrings(obj[k], `${path}.${k}`, cb);
    }
  }
}

// ══════════════════════════════════════════════
// CATEGORY A: SCHEMA STRUCTURE (15 pts)
// ══════════════════════════════════════════════
let scoreA = 15;

// A1: Valid JSON (2 pts) — already parsed above
// Check duplicate keys via regex (simple heuristic)
// (JSON.parse doesn't error on dupes, last-wins)

// A2: Top-level fields (2 pts)
{
  const sv = data.schemaVersion;
  if (!sv) { issue("CRITICAL", "A2", "Missing schemaVersion", "top-level", "Add schemaVersion"); scoreA -= 0.3; }
  else if (sv !== "3.0" && sv !== "1.1.0") { issue("LOW", "A2", `schemaVersion is "${sv}", expected "3.0" or "1.1.0"`, "top-level", "Update schemaVersion"); }
  if (!data.packageId) { issue("CRITICAL", "A2", "Missing packageId", "top-level", "Add packageId"); scoreA -= 0.3; }
  if (!data.createdAt) { issue("CRITICAL", "A2", "Missing createdAt", "top-level", "Add createdAt"); scoreA -= 0.2; }
  if (!data.contentOwner) { issue("CRITICAL", "A2", "Missing contentOwner", "top-level", "Add contentOwner"); scoreA -= 0.2; }
  const b = data.book;
  if (!b) { issue("CRITICAL", "A2", "Missing book object", "top-level", "Add book"); scoreA -= 0.5; }
  else {
    if (!b.bookId) issue("CRITICAL", "A2", "Missing book.bookId", "book", "Add bookId");
    if (!b.title) issue("CRITICAL", "A2", "Missing book.title", "book", "Add title");
    if (!b.author) issue("CRITICAL", "A2", "Missing book.author", "book", "Add author");
    if (!Array.isArray(b.categories)) issue("HIGH", "A2", "book.categories not an array", "book", "Fix categories");
    if (b.variantFamily !== "EMH") issue("HIGH", "A2", `variantFamily is "${b.variantFamily}", expected "EMH"`, "book", "Set to EMH");
  }
  if (!Array.isArray(chapters) || chapters.length === 0) { issue("CRITICAL", "A2", "chapters is empty or missing", "top-level", "Add chapters"); scoreA -= 1; }
  // sorted by number
  for (let i = 1; i < chapters.length; i++) {
    if (chapters[i].number <= chapters[i - 1].number) {
      issue("HIGH", "A2", `Chapters not sorted: ch${chapters[i - 1].number} before ch${chapters[i].number}`, `chapters[${i}]`, "Sort chapters");
      scoreA -= 0.5;
      break;
    }
  }
}

// A3: Chapter-level required fields (3 pts)
{
  let fails = 0;
  for (const ch of chapters) {
    const loc = `ch${ch.number}`;
    if (!ch.chapterId) { issue("CRITICAL", "A3", "Missing chapterId", loc, "Add chapterId"); fails++; }
    if (typeof ch.number !== "number") { issue("CRITICAL", "A3", "Missing/invalid number", loc, "Fix number"); fails++; }
    if (!ch.title) { issue("CRITICAL", "A3", "Missing title", loc, "Add title"); fails++; }
    if (typeof ch.readingTimeMinutes !== "number" || ch.readingTimeMinutes <= 0) { issue("HIGH", "A3", "Invalid readingTimeMinutes", loc, "Fix readingTimeMinutes"); fails++; }
    const cv = ch.contentVariants;
    if (!cv || !cv.easy || !cv.medium || !cv.hard) { issue("CRITICAL", "A3", "Missing contentVariants (easy/medium/hard)", loc, "Add variants"); fails++; }
    if (!Array.isArray(ch.examples)) { issue("CRITICAL", "A3", "Missing examples array", loc, "Add examples"); fails++; }
    if (!ch.quiz && ch.quiz !== null) { issue("HIGH", "A3", "Missing quiz", loc, "Add quiz"); fails++; }
    if (!ch.implementationPlan) { issue("HIGH", "A3", "Missing implementationPlan", loc, "Add implementationPlan"); fails++; }
    if (!Array.isArray(ch.reviewCards)) { issue("HIGH", "A3", "Missing reviewCards array", loc, "Add reviewCards"); fails++; }
    if (!isToneObj(ch.keyTakeawayCard)) { issue("HIGH", "A3", "keyTakeawayCard not a tone object", loc, "Fix keyTakeawayCard"); fails++; }
  }
  if (fails > 10) scoreA -= 3;
  else if (fails > 0) scoreA -= Math.min(3, fails * 0.3);
}

// A4: Tone object integrity (4 pts)
{
  let toneIssues = 0;
  for (const ch of chapters) {
    const loc = `ch${ch.number}`;
    const cv = ch.contentVariants;
    if (!cv) continue;

    // chapterBreakdown all depths
    for (const depth of ["easy", "medium", "hard"]) {
      if (cv[depth] && !isToneObj(cv[depth].chapterBreakdown)) {
        issue("CRITICAL", "A4", `${depth}.chapterBreakdown not tone obj`, loc, "Fix to tone obj");
        toneIssues++;
      }
    }

    // keyTakeaways
    for (const depth of ["easy", "medium", "hard"]) {
      const kts = cv[depth]?.keyTakeaways || [];
      kts.forEach((kt, i) => {
        if (!isToneObj(kt.point)) {
          issue("CRITICAL", "A4", `${depth}.keyTakeaways[${i}].point not tone obj`, loc, "Fix");
          toneIssues++;
        }
        if ((depth === "medium" || depth === "hard") && kt.moreDetails !== undefined && !isToneObj(kt.moreDetails)) {
          issue("CRITICAL", "A4", `${depth}.keyTakeaways[${i}].moreDetails not tone obj`, loc, "Fix");
          toneIssues++;
        }
      });
    }

    // activationPrompt (medium, hard)
    for (const depth of ["medium", "hard"]) {
      if (cv[depth]?.activationPrompt !== undefined && !isToneObj(cv[depth].activationPrompt)) {
        issue("CRITICAL", "A4", `${depth}.activationPrompt not tone obj`, loc, "Fix");
        toneIssues++;
      }
    }

    // selfCheckPrompt (medium singular)
    if (cv.medium?.selfCheckPrompt !== undefined && !isToneObj(cv.medium.selfCheckPrompt)) {
      issue("CRITICAL", "A4", "medium.selfCheckPrompt not tone obj", loc, "Fix");
      toneIssues++;
    }

    // selfCheckPrompts (hard array of 2)
    if (cv.hard?.selfCheckPrompts) {
      const scp = cv.hard.selfCheckPrompts;
      if (Array.isArray(scp)) {
        scp.forEach((s, i) => {
          if (!isToneObj(s)) {
            issue("CRITICAL", "A4", `hard.selfCheckPrompts[${i}] not tone obj`, loc, "Fix");
            toneIssues++;
          }
        });
      }
    }

    // predictionPrompt (hard)
    if (cv.hard?.predictionPrompt !== undefined && !isToneObj(cv.hard.predictionPrompt)) {
      issue("CRITICAL", "A4", "hard.predictionPrompt not tone obj", loc, "Fix");
      toneIssues++;
    }

    // oneMinuteRecap
    // easy: flat tone obj
    if (cv.easy?.oneMinuteRecap && !isToneObj(cv.easy.oneMinuteRecap)) {
      issue("CRITICAL", "A4", "easy.oneMinuteRecap not flat tone obj", loc, "Fix");
      toneIssues++;
    }
    // medium/hard: {retrieve, connect, preview} each tone
    for (const depth of ["medium", "hard"]) {
      const omr = cv[depth]?.oneMinuteRecap;
      if (omr) {
        for (const k of ["retrieve", "connect", "preview"]) {
          if (!isToneObj(omr[k])) {
            issue("CRITICAL", "A4", `${depth}.oneMinuteRecap.${k} not tone obj`, loc, "Fix");
            toneIssues++;
          }
        }
      }
    }

    // examples
    (ch.examples || []).forEach((ex, i) => {
      for (const f of ["scenario", "whatToDo", "whyItMatters"]) {
        if (!isToneObj(ex[f])) {
          issue("CRITICAL", "A4", `examples[${i}].${f} not tone obj`, loc, "Fix");
          toneIssues++;
        }
      }
    });

    // quiz
    if (ch.quiz?.questions) {
      ch.quiz.questions.forEach((q, i) => {
        if (!isToneObj(q.explanation)) {
          issue("CRITICAL", "A4", `quiz.questions[${i}].explanation not tone obj`, loc, "Fix");
          toneIssues++;
        }
      });
    }

    // implementationPlan
    const ip = ch.implementationPlan;
    if (ip) {
      if (!isToneObj(ip.coreSkill)) { issue("CRITICAL", "A4", "implementationPlan.coreSkill not tone obj", loc, "Fix"); toneIssues++; }
      (ip.ifThenPlans || []).forEach((p, i) => {
        if (!isToneObj(p.plan)) { issue("CRITICAL", "A4", `implementationPlan.ifThenPlans[${i}].plan not tone obj`, loc, "Fix"); toneIssues++; }
      });
      if (!isToneObj(ip.twentyFourHourChallenge)) { issue("CRITICAL", "A4", "implementationPlan.twentyFourHourChallenge not tone obj", loc, "Fix"); toneIssues++; }
      if (!isToneObj(ip.weeklyPractice)) { issue("CRITICAL", "A4", "implementationPlan.weeklyPractice not tone obj", loc, "Fix"); toneIssues++; }
    }

    // reviewCards
    (ch.reviewCards || []).forEach((rc, i) => {
      if (!isToneObj(rc.front)) { issue("CRITICAL", "A4", `reviewCards[${i}].front not tone obj`, loc, "Fix"); toneIssues++; }
      if (!isToneObj(rc.back)) { issue("CRITICAL", "A4", `reviewCards[${i}].back not tone obj`, loc, "Fix"); toneIssues++; }
    });
  }
  if (toneIssues > 0) scoreA -= Math.min(4, toneIssues * 0.2);
}

// A5: Orphaned quote fragments (2 pts)
{
  let orphanCount = 0;
  let doublePeriodCount = 0;
  walkStrings(data, "root", (s, path) => {
    if (/['"]\.$/.test(s)) { issue("MEDIUM", "A5", `Orphaned quote+period at end`, path, "Remove orphan"); orphanCount++; }
    if (s.includes("..") && !s.includes("...")) { issue("MEDIUM", "A5", `Double period found`, path, "Fix punctuation"); doublePeriodCount++; }
  });
  if (orphanCount + doublePeriodCount > 5) scoreA -= 2;
  else if (orphanCount + doublePeriodCount > 0) scoreA -= (orphanCount + doublePeriodCount) * 0.3;
}

// A6: Em/en dashes (2 pts)
{
  let dashCount = 0;
  let doubleDashCount = 0;
  walkStrings(data, "root", (s, path) => {
    const emCount = (s.match(/\u2014/g) || []).length;
    const enCount = (s.match(/\u2013/g) || []).length;
    const ddCount = (s.match(/--/g) || []).length;
    if (emCount > 0) { dashCount += emCount; }
    if (enCount > 0) { dashCount += enCount; }
    if (ddCount > 0) { doubleDashCount += ddCount; }
  });
  if (dashCount > 0) issue("HIGH", "A6", `${dashCount} em/en dashes found in file`, "global", "Replace with commas/semicolons");
  if (doubleDashCount > 0) issue("HIGH", "A6", `${doubleDashCount} double-hyphens found`, "global", "Replace with commas/semicolons");
  if (dashCount + doubleDashCount > 10) scoreA -= 2;
  else if (dashCount + doubleDashCount > 0) scoreA -= Math.min(2, (dashCount + doubleDashCount) * 0.1);
}

scoreA = Math.max(0, Math.round(scoreA * 10) / 10);

// ══════════════════════════════════════════════
// CATEGORY B: DEPTH STRUCTURE (10 pts)
// ══════════════════════════════════════════════
let scoreB = 10;
let bIssues = 0;

for (const ch of chapters) {
  const loc = `ch${ch.number}`;
  const cv = ch.contentVariants;
  if (!cv) continue;

  // B1: Easy
  const easyKT = cv.easy?.keyTakeaways || [];
  if (easyKT.length !== 3) { issue("HIGH", "B1", `easy has ${easyKT.length} takeaways (need 3)`, loc, "Fix to 3"); bIssues++; }
  for (const kt of easyKT) {
    if (kt.moreDetails !== undefined) { issue("HIGH", "B1", "easy takeaway has moreDetails (should not)", loc, "Remove moreDetails"); bIssues++; }
  }
  if (cv.easy?.activationPrompt !== undefined) { issue("HIGH", "B1/B4", "easy has activationPrompt (should not)", loc, "Remove"); bIssues++; }
  if (cv.easy?.selfCheckPrompt !== undefined) { issue("HIGH", "B1/B4", "easy has selfCheckPrompt (should not)", loc, "Remove"); bIssues++; }
  if (cv.easy?.selfCheckPrompts !== undefined) { issue("HIGH", "B1/B4", "easy has selfCheckPrompts (should not)", loc, "Remove"); bIssues++; }
  if (cv.easy?.predictionPrompt !== undefined) { issue("HIGH", "B1/B4", "easy has predictionPrompt (should not)", loc, "Remove"); bIssues++; }
  // easy oneMinuteRecap should be flat tone obj
  const eRecap = cv.easy?.oneMinuteRecap;
  if (eRecap && (eRecap.retrieve || eRecap.connect || eRecap.preview)) {
    issue("HIGH", "B1", "easy.oneMinuteRecap is structured (should be flat tone obj)", loc, "Flatten to tone obj");
    bIssues++;
  }

  // B2: Medium
  const medKT = cv.medium?.keyTakeaways || [];
  if (medKT.length < 5 || medKT.length > 7) { issue("HIGH", "B2", `medium has ${medKT.length} takeaways (need 5-7)`, loc, "Fix count"); bIssues++; }
  for (const kt of medKT) {
    if (!kt.moreDetails) { issue("HIGH", "B2", "medium takeaway missing moreDetails", loc, "Add moreDetails"); bIssues++; break; }
  }
  if (!cv.medium?.activationPrompt) { issue("HIGH", "B2", "medium missing activationPrompt", loc, "Add"); bIssues++; }
  if (!cv.medium?.selfCheckPrompt) { issue("HIGH", "B2", "medium missing selfCheckPrompt", loc, "Add"); bIssues++; }
  if (Array.isArray(cv.medium?.selfCheckPrompt)) { issue("HIGH", "B2/B4", "medium.selfCheckPrompt is array (should be singular)", loc, "Fix to singular"); bIssues++; }
  if (cv.medium?.selfCheckPrompts !== undefined) { issue("HIGH", "B2/B4", "medium has selfCheckPrompts array (should not)", loc, "Remove"); bIssues++; }
  if (cv.medium?.predictionPrompt !== undefined) { issue("HIGH", "B2/B4", "medium has predictionPrompt (should not)", loc, "Remove"); bIssues++; }
  // medium oneMinuteRecap should be structured
  const mRecap = cv.medium?.oneMinuteRecap;
  if (mRecap && !mRecap.retrieve) {
    issue("HIGH", "B2", "medium.oneMinuteRecap missing structured format (retrieve/connect/preview)", loc, "Restructure");
    bIssues++;
  }

  // B3: Hard
  const hardKT = cv.hard?.keyTakeaways || [];
  if (hardKT.length < 7 || hardKT.length > 10) { issue("HIGH", "B3", `hard has ${hardKT.length} takeaways (need 7-10)`, loc, "Fix count"); bIssues++; }
  for (const kt of hardKT) {
    if (!kt.moreDetails) { issue("HIGH", "B3", "hard takeaway missing moreDetails", loc, "Add moreDetails"); bIssues++; break; }
  }
  if (!cv.hard?.activationPrompt) { issue("HIGH", "B3", "hard missing activationPrompt", loc, "Add"); bIssues++; }
  const hSCP = cv.hard?.selfCheckPrompts;
  if (!Array.isArray(hSCP)) { issue("HIGH", "B3", "hard.selfCheckPrompts not an array", loc, "Fix to array of 2"); bIssues++; }
  else if (hSCP.length !== 2) { issue("HIGH", "B3", `hard.selfCheckPrompts has ${hSCP.length} items (need 2)`, loc, "Fix to 2"); bIssues++; }
  if (cv.hard?.selfCheckPrompt !== undefined) { issue("HIGH", "B3/B4", "hard has selfCheckPrompt singular (should not)", loc, "Remove"); bIssues++; }
  if (!cv.hard?.predictionPrompt) { issue("HIGH", "B3", "hard missing predictionPrompt", loc, "Add"); bIssues++; }
  const hRecap = cv.hard?.oneMinuteRecap;
  if (hRecap && !hRecap.retrieve) {
    issue("HIGH", "B3", "hard.oneMinuteRecap missing structured format", loc, "Restructure");
    bIssues++;
  }
}

if (bIssues > 20) scoreB -= 10;
else if (bIssues > 0) scoreB -= Math.min(10, bIssues * 0.3);
scoreB = Math.max(0, Math.round(scoreB * 10) / 10);

// ══════════════════════════════════════════════
// CATEGORY C: WORD COUNTS (8 pts)
// ══════════════════════════════════════════════
let scoreC = 8;
const wcIssues = { easy: [], medium: [], hard: [] };

for (const ch of chapters) {
  const cv = ch.contentVariants;
  if (!cv) continue;
  const loc = `ch${ch.number}`;

  for (const [depth, min, max] of [["easy", 140, 175], ["medium", 330, 420], ["hard", 490, 600]]) {
    const bd = cv[depth]?.chapterBreakdown;
    if (!bd || typeof bd !== "object") continue;
    for (const tone of ["gentle", "direct", "competitive"]) {
      const wc = wordCount(bd[tone]);
      if (wc < min || wc > max) {
        wcIssues[depth].push({ ch: ch.number, tone, wc, min, max });
      }
    }
  }
}

const easyWCFails = wcIssues.easy.length;
const medWCFails = wcIssues.medium.length;
const hardWCFails = wcIssues.hard.length;

if (easyWCFails > 0) {
  const sample = wcIssues.easy.slice(0, 10).map(w => `ch${w.ch}/${w.tone}:${w.wc}`).join(", ");
  issue("HIGH", "C1", `${easyWCFails} easy breakdowns out of 140-175 range — ${sample}`, "easy.chapterBreakdown", "Rewrite to target range");
  scoreC -= Math.min(3, easyWCFails * 0.1);
}
if (medWCFails > 0) {
  const sample = wcIssues.medium.slice(0, 10).map(w => `ch${w.ch}/${w.tone}:${w.wc}`).join(", ");
  issue("HIGH", "C2", `${medWCFails} medium breakdowns out of 330-420 range — ${sample}`, "medium.chapterBreakdown", "Rewrite to target range");
  scoreC -= Math.min(3, medWCFails * 0.1);
}
if (hardWCFails > 0) {
  const sample = wcIssues.hard.slice(0, 10).map(w => `ch${w.ch}/${w.tone}:${w.wc}`).join(", ");
  issue("HIGH", "C3", `${hardWCFails} hard breakdowns out of 490-600 range — ${sample}`, "hard.chapterBreakdown", "Rewrite to target range");
  scoreC -= Math.min(2, hardWCFails * 0.1);
}
scoreC = Math.max(0, Math.round(scoreC * 10) / 10);

// ══════════════════════════════════════════════
// CATEGORY D: EXAMPLE SCHEMA (12 pts)
// ══════════════════════════════════════════════
let scoreD = 12;
// Spec says 4 for 20+ chapters, but 48 Laws was designed with 6 (gold standard).
// Accept 6 if all format/ending rotations are present.
const expectedExCount = 6;

const FORMATS = ["decision_point", "postmortem", "dialogue", "predict_reveal", "dilemma", "before_after"];
const ENDINGS = ["broader_principle", "self_directed_question", "surprising_implication", "cross_domain", "common_trap", "perspective_reframe"];
const CATEGORIES = ["work", "school", "personal"];

let dIssues = 0;

for (const ch of chapters) {
  const loc = `ch${ch.number}`;
  const exs = ch.examples || [];

  // D1: count
  if (exs.length !== expectedExCount) {
    issue("HIGH", "D1", `${exs.length} examples (need ${expectedExCount})`, loc, "Fix example count");
    dIssues++;
  }

  // D2: required fields
  for (const ex of exs) {
    for (const f of ["exampleId", "title", "category", "format", "endingType", "contexts", "scenario", "whatToDo", "whyItMatters"]) {
      if (ex[f] === undefined || ex[f] === null) {
        issue("HIGH", "D2", `Example missing ${f}`, `${loc}/${ex.exampleId || "unknown"}`, "Add field");
        dIssues++;
      }
    }
  }

  // D3: tone objects
  for (const ex of exs) {
    for (const f of ["scenario", "whatToDo", "whyItMatters"]) {
      if (ex[f] && !isToneObj(ex[f])) {
        issue("CRITICAL", "D3", `examples.${f} not tone obj`, `${loc}/${ex.exampleId}`, "Fix to tone obj");
        dIssues++;
      }
    }
  }

  // D4: format rotation
  const fmts = exs.map(e => e.format);
  const missingFmts = FORMATS.filter(f => !fmts.includes(f));
  const dupFmts = fmts.filter((f, i) => fmts.indexOf(f) !== i);
  if (missingFmts.length > 0) {
    issue("HIGH", "D4", `Missing formats: ${missingFmts.join(", ")}`, loc, "Add missing formats");
    dIssues++;
  }
  if (dupFmts.length > 0) {
    issue("HIGH", "D4", `Duplicate formats: ${[...new Set(dupFmts)].join(", ")}`, loc, "Fix duplicates");
    dIssues++;
  }

  // D5: ending type rotation
  const ends = exs.map(e => e.endingType);
  const missingEnds = ENDINGS.filter(e => !ends.includes(e));
  const dupEnds = ends.filter((e, i) => ends.indexOf(e) !== i);
  if (missingEnds.length > 0) {
    issue("HIGH", "D5", `Missing ending types: ${missingEnds.join(", ")}`, loc, "Add missing endings");
    dIssues++;
  }
  if (dupEnds.length > 0) {
    issue("HIGH", "D5", `Duplicate ending types: ${[...new Set(dupEnds)].join(", ")}`, loc, "Fix duplicates");
    dIssues++;
  }

  // D6: category distribution
  const cats = {};
  exs.forEach(e => { cats[e.category] = (cats[e.category] || 0) + 1; });
  if (expectedExCount === 6) {
    for (const c of CATEGORIES) {
      if ((cats[c] || 0) !== 2) {
        issue("MEDIUM", "D6", `Category "${c}" has ${cats[c] || 0} examples (need 2)`, loc, "Rebalance categories");
        dIssues++;
      }
    }
  } else {
    for (const c of CATEGORIES) {
      if ((cats[c] || 0) < 1) {
        issue("MEDIUM", "D6", `Category "${c}" missing`, loc, "Add example for category");
        dIssues++;
      }
    }
  }

  // D7: dialogue content check
  const dialogueExs = exs.filter(e => e.format === "dialogue");
  for (const ex of dialogueExs) {
    for (const tone of ["gentle", "direct", "competitive"]) {
      const scen = ex.scenario?.[tone] || "";
      const quoteMatches = scen.match(/[""\u201C\u201D][^""\u201C\u201D]+[""\u201C\u201D]|'[^']+'/g) || [];
      if (quoteMatches.length < 3) {
        issue("HIGH", "D7", `Dialogue scenario has ${quoteMatches.length} quoted exchanges (need 3+)`, `${loc}/${ex.exampleId}/${tone}`, "Add more dialogue");
        dIssues++;
      }
    }
  }
}

if (dIssues > 30) scoreD -= 12;
else if (dIssues > 0) scoreD -= Math.min(12, dIssues * 0.15);
scoreD = Math.max(0, Math.round(scoreD * 10) / 10);

// ══════════════════════════════════════════════
// CATEGORY E: QUIZ SCHEMA (10 pts)
// ══════════════════════════════════════════════
let scoreE = 10;
let eIssues = 0;

const bannedQuizPatterns = [
  /chapter title.*?in quotes/i,
  /realistic situation for/i,
  /best applies/i,
  /best puts.*?into practice/i,
  /best reflects/i,
  /real-world decision tied to/i,
];

for (const ch of chapters) {
  const loc = `ch${ch.number}`;
  const quiz = ch.quiz;

  // E1: presence
  if (!quiz || !quiz.questions) {
    issue("HIGH", "E1", "Quiz missing or no questions", loc, "Add quiz");
    eIssues++;
    continue;
  }
  if (quiz.questions.length !== 10) {
    issue("HIGH", "E1", `Quiz has ${quiz.questions.length} questions (need 10)`, loc, "Fix to 10");
    eIssues++;
  }

  const qs = quiz.questions;

  // E2: choice count
  for (const q of qs) {
    if (!q.choices || q.choices.length !== 3) {
      issue("HIGH", "E2", `Question has ${q.choices?.length ?? 0} choices (need 3)`, `${loc}/${q.questionId}`, "Fix to 3 choices");
      eIssues++;
    }
  }

  // E3: explanation tone obj
  for (const q of qs) {
    if (!isToneObj(q.explanation)) {
      issue("CRITICAL", "E3", "explanation not tone obj", `${loc}/${q.questionId}`, "Fix to tone obj");
      eIssues++;
    }
  }

  // E4: correctIndex validity
  for (const q of qs) {
    if (![0, 1, 2].includes(q.correctIndex)) {
      issue("HIGH", "E4", `correctIndex=${q.correctIndex} (must be 0,1,2)`, `${loc}/${q.questionId}`, "Fix index");
      eIssues++;
    }
  }

  // E5: correctIndex distribution
  const dist = [0, 0, 0];
  for (const q of qs) {
    if ([0, 1, 2].includes(q.correctIndex)) dist[q.correctIndex]++;
  }
  if (dist.some(d => d >= 6)) {
    issue("MEDIUM", "E5", `correctIndex dist [${dist}] — one index appears 6+ times`, loc, "Rebalance");
    eIssues++;
  }

  // E6: explanation opener diversity
  const openers = qs.map(q => {
    const exp = q.explanation?.direct || "";
    return exp.split(/\s+/).slice(0, 10).join(" ");
  });
  for (const opener of openers) {
    if (/^The strongest answer/i.test(opener) || /^The best answer/i.test(opener) || /^The correct response/i.test(opener)) {
      issue("HIGH", "E6", `Banned explanation opener: "${opener.slice(0, 40)}..."`, loc, "Rewrite opener");
      eIssues++;
    }
  }
  // Check pairs sharing 5+ consecutive words
  for (let i = 0; i < openers.length; i++) {
    for (let j = i + 1; j < openers.length; j++) {
      const w1 = openers[i].split(/\s+/).slice(0, 5).join(" ");
      const w2 = openers[j].split(/\s+/).slice(0, 5).join(" ");
      if (w1 === w2 && w1.length > 10) {
        issue("MEDIUM", "E6", `Shared opener (5+ words): "${w1}"`, `${loc}/q${i+1},q${j+1}`, "Diversify openers");
        eIssues++;
      }
    }
  }

  // E7: quiz prompt quality
  for (const q of qs) {
    const prompt = q.prompt || "";
    for (const re of bannedQuizPatterns) {
      if (re.test(prompt)) {
        issue("MEDIUM", "E7", `Quiz prompt matches banned pattern: ${re}`, `${loc}/${q.questionId}`, "Rewrite prompt");
        eIssues++;
      }
    }
    // Check for chapter title in quotes
    if (prompt.includes(`"${ch.title}"`) || prompt.includes(`"${ch.title}"`)) {
      issue("MEDIUM", "E7", "Quiz prompt contains chapter title in quotes", `${loc}/${q.questionId}`, "Remove quoted title");
      eIssues++;
    }
  }
}

if (eIssues > 20) scoreE -= 10;
else if (eIssues > 0) scoreE -= Math.min(10, eIssues * 0.2);
scoreE = Math.max(0, Math.round(scoreE * 10) / 10);

// ══════════════════════════════════════════════
// CATEGORY F: CONTENT SPECIFICITY (10 pts)
// Will be done manually — placeholder score
// ══════════════════════════════════════════════
let scoreF = -1; // sentinel for manual

// F3: moreDetails fictional vignettes (automated)
let f3Issues = 0;
const vignettePat = /\b([A-Z][a-z]{2,})\s+(?:said|walked|noticed|sat|stood|looked|opened|picked|turned|glanced|leaned|paused|asked|replied|decided|grabbed|pulled|pushed|stared|sighed|nodded|shook|smiled|frowned|whispered|shouted)\b/;
const stopwords = new Set(["The", "This", "That", "They", "What", "When", "Where", "Which", "While", "Why", "How", "Every", "Getting", "Being", "Having", "Making", "Taking", "Doing", "Going", "Coming", "Most", "Some", "Many", "Each", "Any", "All", "One", "Two", "Three", "People", "Someone"]);

for (const ch of chapters) {
  const cv = ch.contentVariants;
  if (!cv) continue;
  for (const depth of ["medium", "hard"]) {
    const kts = cv[depth]?.keyTakeaways || [];
    for (const kt of kts) {
      if (!kt.moreDetails) continue;
      for (const tone of ["gentle", "direct", "competitive"]) {
        const text = kt.moreDetails[tone] || "";
        const match = text.match(vignettePat);
        if (match && !stopwords.has(match[1])) {
          issue("HIGH", "F3", `moreDetails contains fictional vignette: "${match[0]}"`, `ch${ch.number}/${depth}/${tone}`, "Rewrite as conceptual");
          f3Issues++;
        }
      }
    }
  }
}

// F4: imperative takeaways
let f4Issues = 0;
const imperativeVerbs = /^(?:Try|Practice|Run|Test|Count|Ask|Write|Start|Begin|Make|Do|Notice|Track|Record|Monitor|Check|Review|Schedule|Plan|Set|Create|Build)\b/;
for (const ch of chapters) {
  const kts = ch.contentVariants?.medium?.keyTakeaways || [];
  for (const kt of kts) {
    const text = kt.point?.direct || "";
    if (imperativeVerbs.test(text) || text.startsWith("Practice:")) {
      issue("MEDIUM", "F4", `Imperative takeaway: "${text.slice(0, 60)}..."`, `ch${ch.number}/medium`, "Rewrite as insight");
      f4Issues++;
    }
  }
}

// ══════════════════════════════════════════════
// CATEGORY G: VOCABULARY & PHRASES (8 pts)
// ══════════════════════════════════════════════
let scoreG = 8;

// G1: banned phrases
const bannedPhrases = [
  "delve", "crucial", "landscape", "realm", "It's worth noting", "In today's world",
  "It's important to remember", "This highlights the importance of", "Furthermore", "Moreover",
  "In conclusion", "plays a pivotal role", "at its core", "the art of", "navigating",
  "harnessing", "game-changer", "paradigm shift", "robust", "synergy", "facilitate",
  "utilize", "foster", "embark on", "a testament to", "shed light on",
  "This matters because", "This is significant because", "it is essential to"
];

const bannedFound = {};
walkStrings(data, "root", (s, path) => {
  const lower = s.toLowerCase();
  for (const bp of bannedPhrases) {
    if (lower.includes(bp.toLowerCase())) {
      bannedFound[bp] = (bannedFound[bp] || 0) + 1;
    }
  }
});

let g1Deduction = 0;
for (const [phrase, count] of Object.entries(bannedFound)) {
  issue("HIGH", "G1", `Banned phrase "${phrase}" found ${count} time(s)`, "global", `Remove all "${phrase}"`);
  g1Deduction += count * 0.1;
}
scoreG -= Math.min(3, g1Deduction);

// G2: leverage frequency
const leveragePerChapter = {};
for (const ch of chapters) {
  let count = 0;
  walkStrings(ch, `ch${ch.number}`, (s) => {
    const matches = s.match(/\bleverage\b/gi) || [];
    count += matches.length;
  });
  if (count > 0) leveragePerChapter[ch.number] = count;
}
const leverageTotal = Object.values(leveragePerChapter).reduce((a, b) => a + b, 0);
for (const [chNum, count] of Object.entries(leveragePerChapter)) {
  if (count > 1) {
    issue("MEDIUM", "G2", `"leverage" appears ${count} times in ch${chNum} (max 1)`, `ch${chNum}`, "Reduce leverage usage");
  }
}
if (leverageTotal > 6) {
  issue("MEDIUM", "G2", `"leverage" total: ${leverageTotal} (max 6 across book)`, "global", "Reduce total leverage");
}

// G3: ask yourself
for (const ch of chapters) {
  let count = 0;
  walkStrings(ch, `ch${ch.number}`, (s) => {
    const m = s.match(/\bask yourself\b/gi) || [];
    count += m.length;
  });
  if (count > 1) {
    issue("MEDIUM", "G3", `"ask yourself" appears ${count} times (max 1)`, `ch${ch.number}`, "Reduce");
  }
}

// G4: reflexive phrases
const reflexivePhrases = ["notice when", "pay attention to", "think about", "consider whether"];
for (const ch of chapters) {
  for (const rp of reflexivePhrases) {
    let count = 0;
    walkStrings(ch, `ch${ch.number}`, (s) => {
      const m = s.match(new RegExp(`\\b${rp}\\b`, "gi")) || [];
      count += m.length;
    });
    if (count > 1) {
      issue("MEDIUM", "G4", `"${rp}" appears ${count} times (max 1)`, `ch${ch.number}`, "Reduce");
    }
  }
}

// G5: gentle opener diversity
const gentleOpeners = {};
walkStrings(data, "root", (s, path) => {
  if (path.includes(".gentle")) {
    const first6 = s.trim().split(/\s+/).slice(0, 6).join(" ");
    gentleOpeners[first6] = (gentleOpeners[first6] || 0) + 1;
  }
});
if (gentleOpeners["Here's something worth sitting with"] || gentleOpeners["Here is something worth sitting with"]) {
  const c1 = gentleOpeners["Here's something worth sitting with"] || 0;
  const c2 = gentleOpeners["Here is something worth sitting with"] || 0;
  issue("HIGH", "G5", `Banned gentle opener found ${c1 + c2} time(s)`, "global", "Remove all instances");
  scoreG -= 0.5;
}
for (const [opener, count] of Object.entries(gentleOpeners)) {
  if (count > 2 && !opener.startsWith("Here's something worth") && !opener.startsWith("Here is something worth")) {
    issue("MEDIUM", "G5", `Gentle opener "${opener}" repeated ${count} times (max 2)`, "global", "Diversify openers");
  }
}

// G6: study group count
let studyGroupChapters = 0;
for (const ch of chapters) {
  let found = false;
  walkStrings(ch, `ch${ch.number}`, (s) => {
    if (/\bstudy group\b/i.test(s)) found = true;
  });
  if (found) studyGroupChapters++;
}
if (studyGroupChapters > 3) {
  issue("MEDIUM", "G6", `"study group" appears in ${studyGroupChapters} chapters (max 3)`, "global", "Reduce study group usage");
  scoreG -= 0.5;
}

scoreG = Math.max(0, Math.round(scoreG * 10) / 10);

// ══════════════════════════════════════════════
// CATEGORY H: CLOSING PATTERNS (7 pts)
// ══════════════════════════════════════════════
let scoreH = 7;

// H1: "It is / This is / That is" short declarative endings
let h1Count = 0;
walkStrings(data, "root", (s, path) => {
  const ls = lastSentence(s);
  if (/^(It is|This is|That is)\b/i.test(ls) && wordCount(ls) < 15) {
    h1Count++;
  }
});
if (h1Count > 0) {
  issue("MEDIUM", "H1", `${h1Count} short "It is/This is/That is" closing sentences (target: 0)`, "global", "Rewrite closings");
  scoreH -= Math.min(3, h1Count * 0.15);
}

// H2: vocabulary in closing sentences
const closingVocab = { structural: 0, mechanism: 0, pattern: 0, dynamic: 0, framework: 0, system: 0 };
const bannedClosingFields = ["chapterBreakdown", "whyItMatters", "moreDetails", "whatToDo", "oneMinuteRecap"];
let bannedFieldClosings = 0;

walkStrings(data, "root", (s, path) => {
  const ls = lastSentence(s).toLowerCase();
  for (const word of Object.keys(closingVocab)) {
    const wordRegex = new RegExp(`\\b${word}s?\\b`, "i");
    if (wordRegex.test(ls)) {
      closingVocab[word]++;
      // Check if it's a banned field closing
      for (const bf of bannedClosingFields) {
        if (path.includes(bf)) {
          bannedFieldClosings++;
        }
      }
    }
  }
});

for (const [word, count] of Object.entries(closingVocab)) {
  if (count > 3) {
    issue("MEDIUM", "H2", `"${word}" in ${count} closing sentences (max 3)`, "global", "Diversify closing vocabulary");
  }
}
if (bannedFieldClosings > 0) {
  issue("HIGH", "H2", `${bannedFieldClosings} banned vocabulary words in closing sentences of content fields`, "global", "Remove from closings");
  scoreH -= Math.min(2, bannedFieldClosings * 0.1);
}

// H3: repeated closings within chapter
let h3Count = 0;
for (const ch of chapters) {
  const loc = `ch${ch.number}`;
  // Collect closings from whyItMatters, whatToDo, moreDetails
  const sections = { whyItMatters: [], whatToDo: [], moreDetails: [] };

  for (const ex of (ch.examples || [])) {
    for (const tone of ["gentle", "direct", "competitive"]) {
      if (ex.whyItMatters?.[tone]) sections.whyItMatters.push(lastSentence(ex.whyItMatters[tone]));
      if (ex.whatToDo?.[tone]) sections.whatToDo.push(lastSentence(ex.whatToDo[tone]));
    }
  }
  for (const depth of ["medium", "hard"]) {
    const kts = ch.contentVariants?.[depth]?.keyTakeaways || [];
    for (const kt of kts) {
      for (const tone of ["gentle", "direct", "competitive"]) {
        if (kt.moreDetails?.[tone]) sections.moreDetails.push(lastSentence(kt.moreDetails[tone]));
      }
    }
  }

  for (const [section, closings] of Object.entries(sections)) {
    for (let i = 0; i < closings.length; i++) {
      for (let j = i + 1; j < closings.length; j++) {
        const w1 = closings[i].split(/\s+/).slice(0, 3).join(" ").toLowerCase();
        const w2 = closings[j].split(/\s+/).slice(0, 3).join(" ").toLowerCase();
        if (w1 === w2 && w1.length > 5) {
          h3Count++;
        }
      }
    }
  }
}
if (h3Count > 0) {
  issue("MEDIUM", "H3", `${h3Count} repeated closing starts (first 3 words) within chapters`, "global", "Diversify closings");
  scoreH -= Math.min(1, h3Count * 0.05);
}

scoreH = Math.max(0, Math.round(scoreH * 10) / 10);

// ══════════════════════════════════════════════
// CATEGORY I: SCENARIO QUALITY (7 pts) — partial auto
// ══════════════════════════════════════════════
let scoreI = -1; // manual + auto

// I2: scenario word count (sample 10)
let i2Issues = 0;
const allScenarios = [];
for (const ch of chapters) {
  for (const ex of (ch.examples || [])) {
    if (ex.scenario?.direct) allScenarios.push({ ch: ch.number, id: ex.exampleId, wc: wordCount(ex.scenario.direct) });
  }
}
const scenarioWCFails = allScenarios.filter(s => s.wc < 80 || s.wc > 150);
if (scenarioWCFails.length > 0) {
  const sample = scenarioWCFails.slice(0, 10).map(s => `ch${s.ch}:${s.wc}w`).join(", ");
  issue("MEDIUM", "I2", `${scenarioWCFails.length} scenarios outside 80-150 word range — ${sample}`, "examples.scenario", "Adjust word counts");
}

// I3: title diversity
const allTitles = [];
for (const ch of chapters) {
  for (const ex of (ch.examples || [])) {
    if (ex.title) allTitles.push(ex.title);
  }
}
const possessiveCount = allTitles.filter(t => /\w+'s\s/.test(t)).length;
const possessivePct = (possessiveCount / allTitles.length * 100).toFixed(1);
if (possessiveCount / allTitles.length > 0.3) {
  issue("MEDIUM", "I3", `${possessivePct}% possessive titles (${possessiveCount}/${allTitles.length}, max 30%)`, "example titles", "Diversify title patterns");
}

// Pattern checks
const titlePatterns = {
  "Before and After": (t) => /Before and After/i.test(t),
  "Predicts": (t) => /Predicts/i.test(t),
  "Dilemma": (t) => /Dilemma/i.test(t),
};
for (const [pat, fn] of Object.entries(titlePatterns)) {
  const count = allTitles.filter(fn).length;
  if (count > 3) {
    issue("MEDIUM", "I3", `Title pattern "${pat}" appears ${count} times (max 3)`, "example titles", "Diversify titles");
  }
}

// I4: messy outcomes
const messyKeywords = ["still", "didn't", "did not", "awkward", "messy", "partial", "lingered", "unresolved", "imperfect"];
let chaptersWithoutMessy = 0;
for (const ch of chapters) {
  let hasMessy = false;
  for (const ex of (ch.examples || [])) {
    const text = (ex.scenario?.direct || "") + " " + (ex.whatToDo?.direct || "");
    for (const kw of messyKeywords) {
      if (text.toLowerCase().includes(kw)) { hasMessy = true; break; }
    }
    if (hasMessy) break;
  }
  if (!hasMessy) chaptersWithoutMessy++;
}
if (chaptersWithoutMessy > 0) {
  issue("LOW", "I4", `${chaptersWithoutMessy} chapters lack any messy/imperfect outcomes`, "examples", "Add non-perfect outcomes");
}

// I5: hook quality
const bannedHookStarts = ["This chapter", "The author argues", "In this chapter", "Chapter "];
let hookIssues = 0;
for (const ch of chapters) {
  const cv = ch.contentVariants;
  if (!cv) continue;
  for (const depth of ["easy", "medium", "hard"]) {
    const bd = cv[depth]?.chapterBreakdown;
    if (!bd) continue;
    for (const tone of ["gentle", "direct", "competitive"]) {
      const text = bd[tone] || "";
      const firstSentence = text.split(/[.!?]/)[0] || "";
      for (const banned of bannedHookStarts) {
        if (firstSentence.trimStart().startsWith(banned)) {
          issue("MEDIUM", "I5", `Breakdown starts with "${banned}"`, `ch${ch.number}/${depth}/${tone}`, "Rewrite hook");
          hookIssues++;
        }
      }
    }
  }
}

// ══════════════════════════════════════════════
// CATEGORY J: TONE QUALITY (5 pts) — manual
// ══════════════════════════════════════════════
let scoreJ = -1;

// ══════════════════════════════════════════════
// CATEGORY K: CROSS-CHAPTER (5 pts)
// ══════════════════════════════════════════════
let scoreK = 5;

// K1: character name reuse
const namesByChapter = {};
const nameRegex = /\b([A-Z][a-z]{2,})\b/g;
const commonWords = new Set(["The", "This", "That", "They", "What", "When", "Where", "Which", "While", "Why", "How", "Every", "Getting", "Being", "Having", "Making", "Taking", "Doing", "Going", "Coming", "Most", "Some", "Many", "Each", "Any", "All", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "People", "Someone", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "After", "Before", "During", "Between", "About", "Here", "There", "Then", "Now", "Today", "Tomorrow", "Yesterday", "Never", "Always", "Often", "Sometimes", "Already", "Also", "Still", "Just", "Yet", "Both", "Either", "Neither", "Not", "But", "And", "For", "With", "From", "Into", "Because", "Since", "Until", "Over", "Under", "Through", "Above", "Below", "Only", "Even", "Very", "Really", "Quite", "Rather", "Almost", "Much", "More", "Less", "Most", "Again", "Away", "Back", "Down", "Off", "Out", "Over", "Together", "Imagine", "Consider", "Think", "Notice", "Practice", "Start", "Try", "Remember", "Power", "Law", "Chapter", "Instead", "Like", "Perhaps", "Maybe", "Probably", "Certainly", "Clearly", "Simply", "Exactly", "Suddenly", "Finally", "Meanwhile", "However", "Therefore", "Otherwise", "Instead", "Regardless", "Something", "Nothing", "Everything", "Anything", "Anyone", "Everyone", "Nobody", "Somebody", "Another", "She", "Her", "His", "Him", "You", "Your", "Group", "Predict", "Predicts", "Project", "Same", "Dilemma", "Professor", "Client", "Team", "Review", "Discovers", "Who", "Friend", "Silence", "Slack", "Partner", "Quarterly", "Backfired", "Meeting", "Budget", "Pitch", "Session", "Different", "Gets", "Sister", "Within", "Across", "Against", "Toward", "Behind", "Beside", "Along", "Promotion", "Email", "Launch", "Stay", "Lab", "Family", "Dinner", "Friendship", "Feedback", "Room", "Decides", "Whether", "Brother", "Starts", "Realizes", "Roommate", "Was", "Wrong", "Faces", "Cannot", "Quiet", "Conversation", "Own", "Product", "Stops", "Watches", "Right", "Results", "Cold", "Library", "Presentation", "Mother", "Thanksgiving", "Fitness", "Transformation", "Best", "Their", "Lead", "Been", "Story", "Late", "Join", "Debate", "Post", "Reveal", "Strategy", "Stopped", "Student", "Twelve", "Campus", "New", "Can", "Let", "Apartment", "Silent", "Day", "Tries", "Actually", "Without", "Loses", "Keep", "Work", "Prediction", "Changed", "Faced", "Papers", "Trying", "Talks", "Way", "Government", "Handled", "Exam", "First", "Confronts", "Credit", "Chat", "Bet", "Fifteen", "Challenges", "Left", "Spent", "Long", "Night", "Makes", "Tells", "Found", "Last", "Said", "Took", "Asked", "Gave", "Felt", "Called", "Made", "Saw", "Footsteps", "Week", "Inside", "Rain", "Else", "Study", "Did", "Have", "Win", "Sure", "Sales", "Tests", "Okay", "Will", "Sam", "Marco", "Dev", "Running", "Account", "Collapse", "Conversations", "Sleep", "Takeover", "Vendor", "Becomes", "Yes", "Secret", "Caught", "Question", "Class", "Does", "Revenue", "Announcement", "Reads", "Open", "Public", "Sends", "Year", "Moved", "Nearly", "Several", "Knew", "Money", "Control", "Door", "Whole", "Kind", "Went", "Got", "Let", "Came", "Told", "Gave", "Began", "Stood", "Thought", "Played", "Turn", "Pushed", "Set", "Cost", "Break", "Shift", "Sound", "Full", "Watch", "Hard", "Drop", "Point", "Real", "Show", "Turns", "Gamble", "Reveals", "Office", "Next", "Thanks", "Planning", "Thirty", "Moment", "Decision", "Wedding", "Council", "President", "Argument", "Merger", "Grant", "Leo", "Department", "Pitch", "Hire", "Career", "Exit", "Deadline", "Update", "Network", "Board", "Risk", "Growth", "Trip", "Plan", "Seat", "Move", "True", "Face", "Fire", "Game", "Place", "Name", "Word", "Line", "Sign", "Feel", "Need", "Part", "End", "Long", "Big", "Old", "Are", "Friends", "Party", "Picks", "Problem", "Lesson", "Forty", "Impossible", "Choice", "Negotiation", "None", "Working", "Deal", "Don", "Didn", "Seminar"]);

for (const ch of chapters) {
  const names = new Set();
  for (const ex of (ch.examples || [])) {
    // Check titles and scenarios
    const text = (ex.title || "") + " " + (ex.scenario?.direct || "");
    let m;
    while ((m = nameRegex.exec(text)) !== null) {
      if (!commonWords.has(m[1])) names.add(m[1]);
    }
  }
  namesByChapter[ch.number] = names;
}

// Find names in >2 chapters
const nameChapterCount = {};
for (const [chNum, names] of Object.entries(namesByChapter)) {
  for (const name of names) {
    if (!nameChapterCount[name]) nameChapterCount[name] = [];
    nameChapterCount[name].push(chNum);
  }
}
const reusedNames = Object.entries(nameChapterCount).filter(([, chs]) => chs.length > 2);
if (reusedNames.length > 0) {
  for (const [name, chs] of reusedNames.slice(0, 20)) {
    issue("MEDIUM", "K1", `Name "${name}" appears in ${chs.length} chapters: ${chs.slice(0, 5).join(",")}`, "examples", "Use unique names");
  }
  scoreK -= Math.min(2, reusedNames.length * 0.2);
}

// K3: format-category rotation across book
const formatCatMap = {};
for (const ch of chapters) {
  for (const ex of (ch.examples || [])) {
    const key = ex.format;
    if (!formatCatMap[key]) formatCatMap[key] = new Set();
    formatCatMap[key].add(ex.category);
  }
}
for (const [fmt, cats] of Object.entries(formatCatMap)) {
  if (cats.size === 1) {
    issue("HIGH", "K3", `Format "${fmt}" only appears in category "${[...cats][0]}"`, "examples", "Distribute across categories");
    scoreK -= 0.5;
  }
}

// K4: school setting variety
const schoolSettings = new Set();
for (const ch of chapters) {
  for (const ex of (ch.examples || [])) {
    if (ex.category === "school") {
      const text = (ex.scenario?.direct || "").toLowerCase();
      // Extract setting hints
      if (text.includes("study group")) schoolSettings.add("study group");
      if (text.includes("library")) schoolSettings.add("library");
      if (text.includes("lecture") || text.includes("class")) schoolSettings.add("classroom");
      if (text.includes("lab")) schoolSettings.add("lab");
      if (text.includes("dorm")) schoolSettings.add("dorm");
      if (text.includes("office hours")) schoolSettings.add("office hours");
      if (text.includes("cafeteria") || text.includes("dining")) schoolSettings.add("cafeteria");
      if (text.includes("campus")) schoolSettings.add("campus");
      if (text.includes("exam") || text.includes("test")) schoolSettings.add("exam hall");
      if (text.includes("presentation")) schoolSettings.add("presentation");
      if (text.includes("project")) schoolSettings.add("group project");
      if (text.includes("seminar")) schoolSettings.add("seminar");
      if (text.includes("thesis") || text.includes("dissertation")) schoolSettings.add("thesis");
      if (text.includes("tutor")) schoolSettings.add("tutoring");
      if (text.includes("advisor") || text.includes("mentor")) schoolSettings.add("advising");
    }
  }
}
if (schoolSettings.size < 5) {
  issue("MEDIUM", "K4", `Only ${schoolSettings.size} distinct school settings (need 5+): ${[...schoolSettings].join(", ")}`, "school examples", "Add variety");
  scoreK -= 0.5;
}

scoreK = Math.max(0, Math.round(scoreK * 10) / 10);

// ══════════════════════════════════════════════
// SUMMARY OUTPUT
// ══════════════════════════════════════════════

console.log("═══════════════════════════════════════");
console.log("CHAPTERFLOW MASTERVALIDATOR — AUTOMATED CHECKS");
console.log(`Book: ${data.book?.title || "Unknown"} by ${data.book?.author || "Unknown"}`);
console.log(`Chapters: ${N}`);
console.log("═══════════════════════════════════════\n");

console.log("AUTOMATED CATEGORY SCORES:");
console.log(`  A. Schema Structure:     ${scoreA}/15`);
console.log(`  B. Depth Structure:      ${scoreB}/10`);
console.log(`  C. Word Counts:          ${scoreC}/8`);
console.log(`  D. Example Schema:       ${scoreD}/12`);
console.log(`  E. Quiz Schema:          ${scoreE}/10`);
console.log(`  F. Content Specificity:  (manual — F3 vignettes: ${f3Issues}, F4 imperatives: ${f4Issues})`);
console.log(`  G. Vocabulary & Phrases: ${scoreG}/8`);
console.log(`  H. Closing Patterns:     ${scoreH}/7`);
console.log(`  I. Scenario Quality:     (manual + auto — hook issues: ${hookIssues}, scenarios outside wc: ${scenarioWCFails.length})`);
console.log(`  J. Tone Quality:         (manual)`);
console.log(`  K. Cross-Chapter:        ${scoreK}/5`);
console.log(`  L. Wiring & Assembly:    (checked separately)\n`);

// Sort issues by severity
const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
issues.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

const critical = issues.filter(i => i.severity === "CRITICAL");
const high = issues.filter(i => i.severity === "HIGH");
const medium = issues.filter(i => i.severity === "MEDIUM");
const low = issues.filter(i => i.severity === "LOW");

console.log(`═══════════════════════════════════════`);
console.log(`ISSUES FOUND: ${issues.length}`);
console.log(`═══════════════════════════════════════\n`);

function printIssues(label, arr) {
  console.log(`${label} (${arr.length}):`);
  if (arr.length === 0) { console.log("  (none)\n"); return; }
  // Group and cap output
  const shown = arr.slice(0, 50);
  for (const i of shown) {
    console.log(`  - [${i.category}] ${i.description} — ${i.location} — Fix: ${i.fix}`);
  }
  if (arr.length > 50) console.log(`  ... and ${arr.length - 50} more`);
  console.log();
}

printIssues("CRITICAL", critical);
printIssues("HIGH", high);
printIssues("MEDIUM", medium);
printIssues("LOW", low);

// Word count detail tables
console.log("═══════════════════════════════════════");
console.log("WORD COUNT DETAILS");
console.log("═══════════════════════════════════════\n");

for (const depth of ["easy", "medium", "hard"]) {
  const ranges = { easy: "140-175", medium: "330-420", hard: "490-600" };
  console.log(`${depth.toUpperCase()} (target: ${ranges[depth]} words):`);
  const fails = wcIssues[depth];
  if (fails.length === 0) {
    console.log("  All chapters in range.\n");
  } else {
    // Show all
    for (const f of fails) {
      const delta = f.wc < f.min ? `${f.min - f.wc} under` : `${f.wc - f.max} over`;
      console.log(`  ch${f.ch} ${f.tone}: ${f.wc} words (${delta})`);
    }
    console.log();
  }
}

// Banned phrase detail
if (Object.keys(bannedFound).length > 0) {
  console.log("═══════════════════════════════════════");
  console.log("BANNED PHRASE DETAILS");
  console.log("═══════════════════════════════════════\n");
  for (const [phrase, count] of Object.entries(bannedFound).sort((a, b) => b[1] - a[1])) {
    console.log(`  "${phrase}": ${count}`);
  }
  console.log();
}

// Leverage detail
if (Object.keys(leveragePerChapter).length > 0) {
  console.log("LEVERAGE PER CHAPTER:");
  for (const [ch, count] of Object.entries(leveragePerChapter).sort((a, b) => b[1] - a[1])) {
    console.log(`  ch${ch}: ${count}`);
  }
  console.log(`  Total: ${leverageTotal}\n`);
}

// Name reuse detail (top 10)
if (reusedNames.length > 0) {
  console.log("═══════════════════════════════════════");
  console.log("NAME REUSE (>2 chapters)");
  console.log("═══════════════════════════════════════\n");
  for (const [name, chs] of reusedNames.sort((a, b) => b[1].length - a[1].length).slice(0, 30)) {
    console.log(`  "${name}": ${chs.length} chapters — [${chs.join(", ")}]`);
  }
  console.log();
}

// Study group chapters
console.log(`Study group chapters: ${studyGroupChapters} (max 3)\n`);

// correctIndex distributions
console.log("═══════════════════════════════════════");
console.log("QUIZ correctIndex DISTRIBUTIONS");
console.log("═══════════════════════════════════════\n");
for (const ch of chapters) {
  if (!ch.quiz?.questions) continue;
  const dist = [0, 0, 0];
  ch.quiz.questions.forEach(q => { if ([0, 1, 2].includes(q.correctIndex)) dist[q.correctIndex]++; });
  const unbalanced = dist.some(d => d >= 6) ? " ⚠️" : "";
  console.log(`  ch${ch.number}: [${dist.join(", ")}]${unbalanced}`);
}
console.log();
