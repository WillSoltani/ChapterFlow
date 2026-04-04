#!/usr/bin/env node
/**
 * MasterValidator — automated checks for ChapterFlow book packages.
 * Usage: node scripts/book/validate-book.mjs book-packages/friends-and-influence.modern.json
 */

import { readFileSync } from "fs";

const filePath = process.argv[2];
if (!filePath) { console.error("Usage: node validate-book.mjs <path-to-json>"); process.exit(1); }

const raw = readFileSync(filePath, "utf-8");
let pkg;
try { pkg = JSON.parse(raw); } catch (e) { console.error("FATAL: Invalid JSON —", e.message); process.exit(1); }

const chapters = pkg.chapters ?? pkg.book?.chapters ?? [];
const N = chapters.length;
const book = pkg.book ?? {};
const issues = []; // {severity, category, description, location, fix}

function issue(severity, category, desc, loc, fix) {
  issues.push({ severity, category, description: desc, location: loc, fix: fix || "" });
}

// Helper: check if object is a valid tone object
function isToneObj(obj) {
  return obj && typeof obj === "object" && !Array.isArray(obj) &&
    typeof obj.gentle === "string" && obj.gentle.length > 0 &&
    typeof obj.direct === "string" && obj.direct.length > 0 &&
    typeof obj.competitive === "string" && obj.competitive.length > 0;
}

// Helper: count words in a string
function wordCount(s) { return s ? s.trim().split(/\s+/).length : 0; }

// Helper: get last sentence
function lastSentence(s) {
  if (!s) return "";
  const trimmed = s.trim();
  // Split on sentence-ending punctuation followed by space or end
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  return (sentences[sentences.length - 1] || "").trim();
}

// Helper: walk all string values in object, calling fn(value, path)
function walkStrings(obj, path, fn) {
  if (typeof obj === "string") { fn(obj, path); return; }
  if (Array.isArray(obj)) { obj.forEach((v, i) => walkStrings(v, `${path}[${i}]`, fn)); return; }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) walkStrings(v, `${path}.${k}`, fn);
  }
}

// Collect all strings for global searches
const allStrings = [];
const chapterStrings = {}; // chNum -> [{value, path}]
chapters.forEach(ch => {
  chapterStrings[ch.number] = [];
  walkStrings(ch, `ch${ch.number}`, (val, path) => {
    allStrings.push({ value: val, path, chNum: ch.number });
    chapterStrings[ch.number].push({ value: val, path });
  });
});

// ═══════════════════════════════════════
// CATEGORY A: SCHEMA STRUCTURE (15 points)
// ═══════════════════════════════════════
const scores = {};

// A1: Valid JSON (2 pts) — already parsed
let a1 = 2;
// Check duplicate keys via raw text heuristic (simple)
// JSON.parse doesn't error on dupes, it just takes last. Skip deep check.

// A2: Top-level fields (2 pts)
let a2 = 2;
const requiredTop = [
  ["schemaVersion", pkg.schemaVersion, v => v === "3.0" || v === "1.1.0"],
  ["packageId", pkg.packageId, v => typeof v === "string" && v.length > 0],
  ["createdAt", pkg.createdAt, v => typeof v === "string" && !isNaN(Date.parse(v))],
  ["contentOwner", pkg.contentOwner, v => !!v],
];
for (const [name, val, check] of requiredTop) {
  if (!check(val)) { issue("CRITICAL", "A2", `Missing or invalid top-level field: ${name}`, "root", `Add valid ${name}`); a2 -= 0.5; }
}
const bookFields = ["bookId", "title", "author", "categories", "variantFamily"];
for (const f of bookFields) {
  if (!book[f]) { issue("CRITICAL", "A2", `Missing book.${f}`, "book", `Add book.${f}`); a2 -= 0.4; }
}
if (!Array.isArray(book.categories)) { issue("HIGH", "A2", "book.categories is not an array", "book.categories"); a2 -= 0.2; }
if (book.variantFamily !== "EMH") { issue("HIGH", "A2", `variantFamily is "${book.variantFamily}", expected "EMH"`, "book.variantFamily"); }
if (N === 0) { issue("CRITICAL", "A2", "No chapters found", "chapters"); a2 = 0; }
// Check sorted by number
for (let i = 1; i < N; i++) {
  if (chapters[i].number <= chapters[i - 1].number) {
    issue("HIGH", "A2", `Chapters not sorted: ch${chapters[i - 1].number} before ch${chapters[i].number}`, "chapters");
    a2 -= 0.5; break;
  }
}
a2 = Math.max(0, a2);

// A3: Chapter-level required fields (3 pts)
let a3 = 3;
const chReqFields = ["chapterId", "number", "title", "readingTimeMinutes", "contentVariants", "examples", "quiz", "implementationPlan", "reviewCards", "keyTakeawayCard"];
let a3fails = 0;
for (const ch of chapters) {
  for (const f of chReqFields) {
    if (f === "quiz" && ch[f] === null) continue; // null quiz is ok
    if (ch[f] === undefined || ch[f] === null) {
      issue("CRITICAL", "A3", `Missing ${f}`, `ch${ch.number}`, `Add ${f} to chapter ${ch.number}`);
      a3fails++;
    }
  }
  // Check contentVariants has easy/medium/hard
  if (ch.contentVariants) {
    for (const d of ["easy", "medium", "hard"]) {
      if (!ch.contentVariants[d]) {
        issue("CRITICAL", "A3", `Missing contentVariants.${d}`, `ch${ch.number}`, `Add ${d} variant`);
        a3fails++;
      }
    }
  }
}
a3 = Math.max(0, a3 - a3fails * 0.1);

// A4: Tone object integrity (4 pts)
let a4 = 4;
let toneFailCount = 0;
for (const ch of chapters) {
  const cv = ch.contentVariants || {};
  const depths = { easy: cv.easy, medium: cv.medium, hard: cv.hard };

  for (const [depthName, depth] of Object.entries(depths)) {
    if (!depth) continue;
    // chapterBreakdown
    if (depth.chapterBreakdown && !isToneObj(depth.chapterBreakdown)) {
      issue("CRITICAL", "A4", `chapterBreakdown is not a tone object`, `ch${ch.number}.${depthName}`, "Convert to {gentle,direct,competitive}");
      toneFailCount++;
    }
    // keyTakeaways
    if (depth.keyTakeaways) {
      depth.keyTakeaways.forEach((kt, i) => {
        if (kt.point && !isToneObj(kt.point)) {
          issue("CRITICAL", "A4", `keyTakeaways[${i}].point not tone obj`, `ch${ch.number}.${depthName}`, "Convert to tone object");
          toneFailCount++;
        }
        if (kt.moreDetails && !isToneObj(kt.moreDetails)) {
          issue("CRITICAL", "A4", `keyTakeaways[${i}].moreDetails not tone obj`, `ch${ch.number}.${depthName}`, "Convert to tone object");
          toneFailCount++;
        }
      });
    }
    // activationPrompt
    if (depth.activationPrompt && !isToneObj(depth.activationPrompt)) {
      issue("CRITICAL", "A4", `activationPrompt not tone obj`, `ch${ch.number}.${depthName}`);
      toneFailCount++;
    }
    // selfCheckPrompt (singular)
    if (depth.selfCheckPrompt && !isToneObj(depth.selfCheckPrompt)) {
      issue("CRITICAL", "A4", `selfCheckPrompt not tone obj`, `ch${ch.number}.${depthName}`);
      toneFailCount++;
    }
    // selfCheckPrompts (array)
    if (depth.selfCheckPrompts && Array.isArray(depth.selfCheckPrompts)) {
      depth.selfCheckPrompts.forEach((scp, i) => {
        if (!isToneObj(scp)) {
          issue("CRITICAL", "A4", `selfCheckPrompts[${i}] not tone obj`, `ch${ch.number}.${depthName}`);
          toneFailCount++;
        }
      });
    }
    // predictionPrompt
    if (depth.predictionPrompt && !isToneObj(depth.predictionPrompt)) {
      issue("CRITICAL", "A4", `predictionPrompt not tone obj`, `ch${ch.number}.${depthName}`);
      toneFailCount++;
    }
    // oneMinuteRecap
    if (depth.oneMinuteRecap) {
      const omr = depth.oneMinuteRecap;
      if (depthName === "easy") {
        if (!isToneObj(omr)) {
          issue("CRITICAL", "A4", `easy.oneMinuteRecap not flat tone obj`, `ch${ch.number}`, "Should be {gentle,direct,competitive}");
          toneFailCount++;
        }
      } else {
        // medium/hard: structured
        for (const k of ["retrieve", "connect", "preview"]) {
          if (omr[k] && !isToneObj(omr[k])) {
            issue("CRITICAL", "A4", `${depthName}.oneMinuteRecap.${k} not tone obj`, `ch${ch.number}`);
            toneFailCount++;
          }
        }
      }
    }
  }
  // Examples
  if (ch.examples) {
    ch.examples.forEach((ex, i) => {
      for (const f of ["scenario", "whatToDo", "whyItMatters"]) {
        if (ex[f] && !isToneObj(ex[f])) {
          issue("CRITICAL", "A4", `example[${i}].${f} not tone obj`, `ch${ch.number}`, "Convert to {gentle,direct,competitive}");
          toneFailCount++;
        }
      }
    });
  }
  // Quiz explanations
  if (ch.quiz && ch.quiz.questions) {
    ch.quiz.questions.forEach((q, i) => {
      if (q.explanation && !isToneObj(q.explanation)) {
        issue("CRITICAL", "A4", `quiz.questions[${i}].explanation not tone obj`, `ch${ch.number}`);
        toneFailCount++;
      }
    });
  }
  // implementationPlan
  if (ch.implementationPlan) {
    const ip = ch.implementationPlan;
    if (ip.coreSkill && !isToneObj(ip.coreSkill)) { issue("CRITICAL", "A4", "implementationPlan.coreSkill not tone obj", `ch${ch.number}`); toneFailCount++; }
    if (ip.ifThenPlans) {
      ip.ifThenPlans.forEach((itp, i) => {
        if (itp.plan && !isToneObj(itp.plan)) { issue("CRITICAL", "A4", `implementationPlan.ifThenPlans[${i}].plan not tone obj`, `ch${ch.number}`); toneFailCount++; }
      });
    }
    if (ip.twentyFourHourChallenge && !isToneObj(ip.twentyFourHourChallenge)) { issue("CRITICAL", "A4", "implementationPlan.twentyFourHourChallenge not tone obj", `ch${ch.number}`); toneFailCount++; }
    if (ip.weeklyPractice && !isToneObj(ip.weeklyPractice)) { issue("CRITICAL", "A4", "implementationPlan.weeklyPractice not tone obj", `ch${ch.number}`); toneFailCount++; }
  }
  // reviewCards
  if (ch.reviewCards) {
    ch.reviewCards.forEach((rc, i) => {
      if (rc.front && !isToneObj(rc.front)) { issue("CRITICAL", "A4", `reviewCards[${i}].front not tone obj`, `ch${ch.number}`); toneFailCount++; }
      if (rc.back && !isToneObj(rc.back)) { issue("CRITICAL", "A4", `reviewCards[${i}].back not tone obj`, `ch${ch.number}`); toneFailCount++; }
    });
  }
  // keyTakeawayCard
  if (ch.keyTakeawayCard && !isToneObj(ch.keyTakeawayCard)) {
    issue("CRITICAL", "A4", "keyTakeawayCard not tone obj", `ch${ch.number}`);
    toneFailCount++;
  }
}
a4 = Math.max(0, toneFailCount === 0 ? 4 : 4 - Math.min(4, toneFailCount * 0.2));

// A5: No orphaned quote fragments (2 pts)
let a5 = 2;
let orphanCount = 0;
allStrings.forEach(({ value, path }) => {
  if (/'\.$/.test(value) || /"\.$/.test(value)) {
    issue("HIGH", "A5", `Orphaned quote fragment at end`, path, "Fix trailing quote+period");
    orphanCount++;
  }
  if (/\.\./.test(value) && !/\.\.\./.test(value)) {
    issue("MEDIUM", "A5", `Double period found`, path, "Remove extra period");
    orphanCount++;
  }
});
a5 = Math.max(0, orphanCount === 0 ? 2 : 2 - Math.min(2, orphanCount * 0.25));

// A6: No em/en dashes (2 pts)
let a6 = 2;
let dashCount = 0;
allStrings.forEach(({ value, path }) => {
  const em = (value.match(/\u2014/g) || []).length;
  const en = (value.match(/\u2013/g) || []).length;
  const dd = (value.match(/--/g) || []).length;
  if (em) { issue("HIGH", "A6", `${em} em dash(es)`, path, "Replace with comma or semicolon"); dashCount += em; }
  if (en) { issue("HIGH", "A6", `${en} en dash(es)`, path, "Replace with hyphen or comma"); dashCount += en; }
  if (dd) { issue("HIGH", "A6", `${dd} double-hyphen(s)`, path, "Replace with comma or semicolon"); dashCount += dd; }
});
a6 = Math.max(0, dashCount === 0 ? 2 : 2 - Math.min(2, dashCount * 0.1));

scores.A = Math.min(15, Math.max(0, Math.round((a1 + a2 + a3 + a4 + a5 + a6) * 10) / 10));

// ═══════════════════════════════════════
// CATEGORY B: DEPTH STRUCTURE (10 points)
// ═══════════════════════════════════════
let b1 = 3, b2 = 3, b3 = 3, b4 = 1;

for (const ch of chapters) {
  const cv = ch.contentVariants || {};
  const easy = cv.easy;
  const medium = cv.medium;
  const hard = cv.hard;

  // B1: Easy
  if (easy) {
    const kt = easy.keyTakeaways || [];
    if (kt.length !== 3) { issue("HIGH", "B1", `Easy keyTakeaways count=${kt.length}, expected 3`, `ch${ch.number}.easy`); b1 -= 0.1; }
    kt.forEach((t, i) => {
      if (t.moreDetails) { issue("HIGH", "B1", `Easy keyTakeaways[${i}] has moreDetails (forbidden)`, `ch${ch.number}.easy`); b1 -= 0.05; }
    });
    if (easy.activationPrompt) { issue("HIGH", "B1", "Easy has activationPrompt (forbidden)", `ch${ch.number}.easy`); b1 -= 0.05; }
    if (easy.selfCheckPrompt) { issue("HIGH", "B1", "Easy has selfCheckPrompt (forbidden)", `ch${ch.number}.easy`); b1 -= 0.05; }
    if (easy.selfCheckPrompts) { issue("HIGH", "B1", "Easy has selfCheckPrompts (forbidden)", `ch${ch.number}.easy`); b1 -= 0.05; }
    if (easy.predictionPrompt) { issue("HIGH", "B1", "Easy has predictionPrompt (forbidden)", `ch${ch.number}.easy`); b1 -= 0.05; }
    // oneMinuteRecap: flat tone obj
    if (easy.oneMinuteRecap) {
      if (easy.oneMinuteRecap.retrieve || easy.oneMinuteRecap.connect || easy.oneMinuteRecap.preview) {
        issue("HIGH", "B1", "Easy oneMinuteRecap is structured (should be flat tone obj)", `ch${ch.number}.easy`);
        b1 -= 0.05;
      }
    }
  }

  // B2: Medium
  if (medium) {
    const kt = medium.keyTakeaways || [];
    if (kt.length < 5 || kt.length > 7) { issue("HIGH", "B2", `Medium keyTakeaways count=${kt.length}, expected 5-7`, `ch${ch.number}.medium`); b2 -= 0.1; }
    kt.forEach((t, i) => {
      if (!t.point) { issue("HIGH", "B2", `Medium keyTakeaways[${i}] missing point`, `ch${ch.number}.medium`); b2 -= 0.05; }
      if (!t.moreDetails) { issue("HIGH", "B2", `Medium keyTakeaways[${i}] missing moreDetails`, `ch${ch.number}.medium`); b2 -= 0.05; }
    });
    if (!medium.activationPrompt) { issue("HIGH", "B2", "Medium missing activationPrompt", `ch${ch.number}.medium`); b2 -= 0.05; }
    if (!medium.selfCheckPrompt) { issue("HIGH", "B2", "Medium missing selfCheckPrompt", `ch${ch.number}.medium`); b2 -= 0.05; }
    if (Array.isArray(medium.selfCheckPrompt)) { issue("HIGH", "B2", "Medium selfCheckPrompt is array (should be singular)", `ch${ch.number}.medium`); b2 -= 0.05; }
    // oneMinuteRecap: structured
    if (medium.oneMinuteRecap) {
      for (const k of ["retrieve", "connect", "preview"]) {
        if (!medium.oneMinuteRecap[k]) { issue("HIGH", "B2", `Medium oneMinuteRecap missing ${k}`, `ch${ch.number}.medium`); b2 -= 0.03; }
      }
    }
    // Must not have
    if (medium.selfCheckPrompts) { issue("HIGH", "B4", "Medium has selfCheckPrompts array (forbidden)", `ch${ch.number}.medium`); b4 -= 0.03; }
    if (medium.predictionPrompt) { issue("HIGH", "B4", "Medium has predictionPrompt (forbidden)", `ch${ch.number}.medium`); b4 -= 0.03; }
  }

  // B3: Hard
  if (hard) {
    const kt = hard.keyTakeaways || [];
    if (kt.length < 7 || kt.length > 10) { issue("HIGH", "B3", `Hard keyTakeaways count=${kt.length}, expected 7-10`, `ch${ch.number}.hard`); b3 -= 0.1; }
    kt.forEach((t, i) => {
      if (!t.point) { issue("HIGH", "B3", `Hard keyTakeaways[${i}] missing point`, `ch${ch.number}.hard`); b3 -= 0.05; }
      if (!t.moreDetails) { issue("HIGH", "B3", `Hard keyTakeaways[${i}] missing moreDetails`, `ch${ch.number}.hard`); b3 -= 0.05; }
    });
    if (!hard.activationPrompt) { issue("HIGH", "B3", "Hard missing activationPrompt", `ch${ch.number}.hard`); b3 -= 0.05; }
    if (!hard.selfCheckPrompts || !Array.isArray(hard.selfCheckPrompts)) {
      issue("HIGH", "B3", "Hard missing selfCheckPrompts array", `ch${ch.number}.hard`); b3 -= 0.1;
    } else if (hard.selfCheckPrompts.length !== 2) {
      issue("HIGH", "B3", `Hard selfCheckPrompts count=${hard.selfCheckPrompts.length}, expected 2`, `ch${ch.number}.hard`); b3 -= 0.05;
    }
    if (!hard.predictionPrompt) { issue("HIGH", "B3", "Hard missing predictionPrompt", `ch${ch.number}.hard`); b3 -= 0.05; }
    // oneMinuteRecap: structured
    if (hard.oneMinuteRecap) {
      for (const k of ["retrieve", "connect", "preview"]) {
        if (!hard.oneMinuteRecap[k]) { issue("HIGH", "B3", `Hard oneMinuteRecap missing ${k}`, `ch${ch.number}.hard`); b3 -= 0.03; }
      }
    }
    // Must not have singular selfCheckPrompt
    if (hard.selfCheckPrompt && !Array.isArray(hard.selfCheckPrompt)) {
      issue("HIGH", "B4", "Hard has singular selfCheckPrompt (forbidden)", `ch${ch.number}.hard`); b4 -= 0.03;
    }
  }

  // B4: Easy field leakage
  if (easy) {
    if (easy.activationPrompt) { /* already counted in B1 */ }
    if (easy.predictionPrompt) { issue("HIGH", "B4", "Easy has predictionPrompt (forbidden)", `ch${ch.number}.easy`); b4 -= 0.03; }
  }
}
b1 = Math.max(0, b1); b2 = Math.max(0, b2); b3 = Math.max(0, b3); b4 = Math.max(0, b4);
scores.B = Math.min(10, Math.max(0, Math.round((b1 + b2 + b3 + b4) * 10) / 10));

// ═══════════════════════════════════════
// CATEGORY C: WORD COUNTS (8 points)
// ═══════════════════════════════════════
let c1 = 3, c2 = 3, c3 = 2;

for (const ch of chapters) {
  const cv = ch.contentVariants || {};
  // C1: Easy 140-175
  if (cv.easy?.chapterBreakdown) {
    for (const tone of ["gentle", "direct", "competitive"]) {
      const wc = wordCount(cv.easy.chapterBreakdown[tone]);
      if (wc < 140 || wc > 175) {
        issue("MEDIUM", "C1", `Easy breakdown.${tone} = ${wc} words (need 140-175)`, `ch${ch.number}`);
        c1 -= 0.03;
      }
    }
  }
  // C2: Medium 330-420
  if (cv.medium?.chapterBreakdown) {
    for (const tone of ["gentle", "direct", "competitive"]) {
      const wc = wordCount(cv.medium.chapterBreakdown[tone]);
      if (wc < 330 || wc > 420) {
        issue("MEDIUM", "C2", `Medium breakdown.${tone} = ${wc} words (need 330-420)`, `ch${ch.number}`);
        c2 -= 0.03;
      }
    }
  }
  // C3: Hard 490-600
  if (cv.hard?.chapterBreakdown) {
    for (const tone of ["gentle", "direct", "competitive"]) {
      const wc = wordCount(cv.hard.chapterBreakdown[tone]);
      if (wc < 490 || wc > 600) {
        issue("MEDIUM", "C3", `Hard breakdown.${tone} = ${wc} words (need 490-600)`, `ch${ch.number}`);
        c3 -= 0.02;
      }
    }
  }
}
c1 = Math.max(0, c1); c2 = Math.max(0, c2); c3 = Math.max(0, c3);
scores.C = Math.min(8, Math.max(0, Math.round((c1 + c2 + c3) * 10) / 10));

// ═══════════════════════════════════════
// CATEGORY D: EXAMPLE SCHEMA (12 points)
// ═══════════════════════════════════════
let d1 = 1, d2 = 2, d3 = 2, d4 = 2, d5 = 2, d6 = 1, d7 = 2;

const expectedExCount = 6;
const FORMATS = ["decision_point", "postmortem", "dialogue", "predict_reveal", "dilemma", "before_after"];
const ENDINGS = ["broader_principle", "self_directed_question", "surprising_implication", "cross_domain", "common_trap", "perspective_reframe"];

for (const ch of chapters) {
  const exs = ch.examples || [];
  // D1: count
  if (exs.length !== expectedExCount) {
    issue("HIGH", "D1", `${exs.length} examples, expected ${expectedExCount}`, `ch${ch.number}`);
    d1 -= 0.05;
  }
  // D2: required fields
  const reqFields = ["exampleId", "title", "category", "format", "endingType", "contexts", "scenario", "whatToDo", "whyItMatters"];
  for (const ex of exs) {
    for (const f of reqFields) {
      if (ex[f] === undefined || ex[f] === null) {
        issue("HIGH", "D2", `Example "${ex.title || ex.exampleId}" missing ${f}`, `ch${ch.number}`);
        d2 -= 0.02;
      }
    }
  }
  // D3: tone objects on examples
  for (const ex of exs) {
    for (const f of ["scenario", "whatToDo", "whyItMatters"]) {
      if (ex[f] && !isToneObj(ex[f])) {
        issue("CRITICAL", "D3", `Example "${ex.title}".${f} not tone obj`, `ch${ch.number}`);
        d3 -= 0.05;
      }
    }
  }
  // D4: format rotation
  const formats = exs.map(e => e.format).filter(Boolean);
  const fmtSet = new Set(formats);
  for (const f of FORMATS) {
    if (!fmtSet.has(f)) { issue("HIGH", "D4", `Missing format "${f}"`, `ch${ch.number}`); d4 -= 0.02; }
  }
  const fmtDups = formats.filter((f, i) => formats.indexOf(f) !== i);
  if (fmtDups.length) { issue("HIGH", "D4", `Duplicate formats: ${[...new Set(fmtDups)].join(", ")}`, `ch${ch.number}`); d4 -= 0.02; }

  // D5: ending type rotation
  const endings = exs.map(e => e.endingType).filter(Boolean);
  const endSet = new Set(endings);
  for (const e of ENDINGS) {
    if (!endSet.has(e)) { issue("HIGH", "D5", `Missing endingType "${e}"`, `ch${ch.number}`); d5 -= 0.02; }
  }
  const endDups = endings.filter((e, i) => endings.indexOf(e) !== i);
  if (endDups.length) { issue("HIGH", "D5", `Duplicate endingTypes: ${[...new Set(endDups)].join(", ")}`, `ch${ch.number}`); d5 -= 0.02; }

  // D6: category distribution
  const cats = exs.map(e => e.category).filter(Boolean);
  const catCount = {};
  cats.forEach(c => { catCount[c] = (catCount[c] || 0) + 1; });
  if (expectedExCount === 6) {
    for (const c of ["work", "school", "personal"]) {
      if ((catCount[c] || 0) !== 2) {
        issue("MEDIUM", "D6", `Category "${c}" count=${catCount[c] || 0}, expected 2`, `ch${ch.number}`);
        d6 -= 0.01;
      }
    }
  } else {
    for (const c of ["work", "school", "personal"]) {
      if ((catCount[c] || 0) < 1) {
        issue("MEDIUM", "D6", `Category "${c}" missing`, `ch${ch.number}`);
        d6 -= 0.02;
      }
    }
  }

  // D7: dialogue content check
  const dialogueExs = exs.filter(e => e.format === "dialogue");
  for (const ex of dialogueExs) {
    if (ex.scenario && isToneObj(ex.scenario)) {
      for (const tone of ["gentle", "direct", "competitive"]) {
        const text = ex.scenario[tone] || "";
        const quoteCount = (text.match(/"/g) || []).length;
        // Each speech exchange needs at least 2 quotes (open+close), 3 exchanges = 6 quotes
        if (quoteCount < 6) {
          issue("HIGH", "D7", `Dialogue "${ex.title}" ${tone} has only ~${Math.floor(quoteCount / 2)} quote pairs (need 3+)`, `ch${ch.number}`);
          d7 -= 0.05;
        }
      }
    }
  }
}
d1 = Math.max(0, d1); d2 = Math.max(0, d2); d3 = Math.max(0, d3);
d4 = Math.max(0, d4); d5 = Math.max(0, d5); d6 = Math.max(0, d6); d7 = Math.max(0, d7);
scores.D = Math.min(12, Math.max(0, Math.round((d1 + d2 + d3 + d4 + d5 + d6 + d7) * 10) / 10));

// ═══════════════════════════════════════
// CATEGORY E: QUIZ SCHEMA (10 points)
// ═══════════════════════════════════════
let e1 = 1, e2 = 2, e3 = 2, e4 = 1, e5 = 1, e6 = 2, e7 = 1;
let quizzesExist = true;

for (const ch of chapters) {
  if (!ch.quiz || !ch.quiz.questions) {
    if (ch.quiz === null) { /* pre-quiz phase, noted */ }
    else { issue("HIGH", "E1", "Missing quiz or questions", `ch${ch.number}`); e1 -= 0.05; }
    quizzesExist = false;
    continue;
  }
  const qs = ch.quiz.questions;
  // E1
  if (qs.length !== 10) { issue("HIGH", "E1", `Quiz has ${qs.length} questions, expected 10`, `ch${ch.number}`); e1 -= 0.05; }

  // E2: choice count
  for (const [i, q] of qs.entries()) {
    if (!q.choices || q.choices.length !== 3) {
      issue("HIGH", "E2", `Question ${i + 1} has ${q.choices?.length ?? 0} choices, expected 3`, `ch${ch.number}`);
      e2 -= 0.02;
    }
  }
  // E3: explanation type
  for (const [i, q] of qs.entries()) {
    if (q.explanation && !isToneObj(q.explanation)) {
      issue("HIGH", "E3", `Question ${i + 1} explanation not tone obj`, `ch${ch.number}`);
      e3 -= 0.02;
    }
  }
  // E4: correctIndex validity
  for (const [i, q] of qs.entries()) {
    if (q.correctAnswerIndex !== undefined) {
      if (![0, 1, 2].includes(q.correctAnswerIndex)) {
        issue("CRITICAL", "E4", `Question ${i + 1} correctAnswerIndex=${q.correctAnswerIndex}, expected 0-2`, `ch${ch.number}`);
        e4 -= 0.05;
      }
    } else if (q.correctIndex !== undefined) {
      if (![0, 1, 2].includes(q.correctIndex)) {
        issue("CRITICAL", "E4", `Question ${i + 1} correctIndex=${q.correctIndex}, expected 0-2`, `ch${ch.number}`);
        e4 -= 0.05;
      }
    }
  }
  // E5: correctIndex distribution
  const idxCounts = [0, 0, 0];
  for (const q of qs) {
    const idx = q.correctAnswerIndex ?? q.correctIndex ?? 0;
    if (idx >= 0 && idx <= 2) idxCounts[idx]++;
  }
  for (let i = 0; i < 3; i++) {
    if (idxCounts[i] >= 6) {
      issue("MEDIUM", "E5", `correctIndex ${i} appears ${idxCounts[i]} times (max 5)`, `ch${ch.number}`);
      e5 -= 0.02;
    }
  }
  // E6: Explanation opener diversity
  const openers = qs.map(q => {
    const text = q.explanation?.direct || "";
    return text.split(/\s+/).slice(0, 10).join(" ");
  });
  for (const opener of openers) {
    if (/^the (strongest|best|correct)/i.test(opener)) {
      issue("HIGH", "E6", `Banned opener: "${opener.substring(0, 40)}..."`, `ch${ch.number}`);
      e6 -= 0.05;
    }
  }
  // Check for shared 5+ consecutive opening words
  for (let i = 0; i < openers.length; i++) {
    for (let j = i + 1; j < openers.length; j++) {
      const w1 = openers[i].split(/\s+/).slice(0, 5).join(" ").toLowerCase();
      const w2 = openers[j].split(/\s+/).slice(0, 5).join(" ").toLowerCase();
      if (w1.length > 10 && w1 === w2) {
        issue("HIGH", "E6", `Questions ${i + 1} and ${j + 1} share opener: "${w1}"`, `ch${ch.number}`);
        e6 -= 0.03;
      }
    }
  }
  // E7: Quiz prompt quality
  const bannedQuizPatterns = [/".+"/, /realistic situation for/i, /best applies/i, /best puts.*into practice/i, /best reflects/i, /real-world decision tied to/i];
  for (const [i, q] of qs.entries()) {
    for (const pat of bannedQuizPatterns) {
      if (pat.test(q.prompt || "")) {
        // Only flag chapter title in quotes if it actually contains the chapter title
        if (pat === bannedQuizPatterns[0]) {
          const quoted = (q.prompt || "").match(/".+"/)?.[0] || "";
          if (quoted.toLowerCase().includes(ch.title.toLowerCase().substring(0, 15))) {
            issue("MEDIUM", "E7", `Question ${i + 1} prompt contains chapter title in quotes`, `ch${ch.number}`);
            e7 -= 0.02;
          }
        } else {
          issue("MEDIUM", "E7", `Question ${i + 1} prompt matches banned pattern: ${pat}`, `ch${ch.number}`);
          e7 -= 0.02;
        }
      }
    }
  }
}
e1 = Math.max(0, e1); e2 = Math.max(0, e2); e3 = Math.max(0, e3);
e4 = Math.max(0, e4); e5 = Math.max(0, e5); e6 = Math.max(0, e6); e7 = Math.max(0, e7);
scores.E = Math.min(10, Math.max(0, Math.round((e1 + e2 + e3 + e4 + e5 + e6 + e7) * 10) / 10));

// ═══════════════════════════════════════
// CATEGORY G: VOCABULARY & PHRASES (8 points)
// ═══════════════════════════════════════
let g1 = 3, g2 = 1, g3 = 1, g4 = 1, g5 = 1, g6 = 1;

// G1: Banned phrases
const bannedPhrases = [
  "delve", "crucial", "landscape", "realm", "it's worth noting", "in today's world",
  "it's important to remember", "this highlights the importance of", "furthermore", "moreover",
  "in conclusion", "plays a pivotal role", "at its core", "the art of", "navigating",
  "harnessing", "game-changer", "paradigm shift", "robust", "synergy", "facilitate",
  "utilize", "foster", "embark on", "a testament to", "shed light on",
  "this matters because", "this is significant because", "it is essential to"
];
const entireText = raw.toLowerCase();
for (const phrase of bannedPhrases) {
  const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi");
  const matches = raw.match(regex);
  if (matches && matches.length > 0) {
    // Find which chapters
    const chapLocs = [];
    for (const ch of chapters) {
      const chText = JSON.stringify(ch).toLowerCase();
      if (chText.includes(phrase.toLowerCase())) chapLocs.push(ch.number);
    }
    issue("HIGH", "G1", `Banned phrase "${phrase}" found ${matches.length}x in ch${chapLocs.join(",")}`, "global");
    g1 -= Math.min(0.3, matches.length * 0.1);
  }
}
g1 = Math.max(0, g1);

// G2: "leverage" frequency
let leverageTotal = 0;
for (const ch of chapters) {
  const chText = JSON.stringify(ch);
  const leverageMatches = chText.match(/\bleverage\b/gi) || [];
  if (leverageMatches.length > 1) {
    issue("MEDIUM", "G2", `"leverage" appears ${leverageMatches.length}x (max 1)`, `ch${ch.number}`);
    g2 -= 0.05;
  }
  // Check verb usage: "to leverage", "leveraging", "leveraged"
  const verbMatches = chText.match(/\b(to leverage|leveraging|leveraged)\b/gi) || [];
  if (verbMatches.length > 0) {
    issue("HIGH", "G2", `"leverage" used as verb ${verbMatches.length}x`, `ch${ch.number}`);
    g2 -= 0.1;
  }
  leverageTotal += leverageMatches.length;
}
g2 = Math.max(0, g2);

// G3: "ask yourself" frequency
for (const ch of chapters) {
  const chText = JSON.stringify(ch);
  const matches = chText.match(/\bask yourself\b/gi) || [];
  if (matches.length > 1) {
    issue("MEDIUM", "G3", `"ask yourself" appears ${matches.length}x (max 1)`, `ch${ch.number}`);
    g3 -= 0.05;
  }
}
g3 = Math.max(0, g3);

// G4: Reflexive phrase caps
const reflexivePhrases = ["notice when", "pay attention to", "think about", "consider whether"];
for (const ch of chapters) {
  const chText = JSON.stringify(ch).toLowerCase();
  for (const rp of reflexivePhrases) {
    const matches = chText.match(new RegExp(`\\b${rp}\\b`, "gi")) || [];
    if (matches.length > 1) {
      issue("MEDIUM", "G4", `"${rp}" appears ${matches.length}x (max 1)`, `ch${ch.number}`);
      g4 -= 0.03;
    }
  }
}
g4 = Math.max(0, g4);

// G5: Gentle opener diversity
const gentleOpeners = {};
for (const ch of chapters) {
  const strs = chapterStrings[ch.number] || [];
  for (const { value, path } of strs) {
    if (path.includes("gentle")) {
      const first6 = value.trim().split(/\s+/).slice(0, 6).join(" ");
      gentleOpeners[first6] = (gentleOpeners[first6] || []);
      gentleOpeners[first6].push(ch.number);
    }
  }
}
// Check banned openers
for (const [opener, chs] of Object.entries(gentleOpeners)) {
  if (/here['']?s something worth sitting with/i.test(opener) || /here is something worth sitting with/i.test(opener)) {
    issue("HIGH", "G5", `Banned gentle opener "${opener}" in ${chs.length} chapters`, `ch${[...new Set(chs)].join(",")}`);
    g5 -= 0.5;
  } else if (new Set(chs).size > 2) {
    issue("MEDIUM", "G5", `Gentle opener "${opener}" in ${new Set(chs).size} chapters (max 2)`, `ch${[...new Set(chs)].join(",")}`);
    g5 -= 0.1;
  }
}
g5 = Math.max(0, g5);

// G6: "study group" count
let studyGroupChapters = 0;
for (const ch of chapters) {
  const chText = JSON.stringify(ch).toLowerCase();
  if (chText.includes("study group")) studyGroupChapters++;
}
if (studyGroupChapters > 3) {
  issue("MEDIUM", "G6", `"study group" in ${studyGroupChapters} chapters (max 3)`, "global");
  g6 -= 0.5;
}
g6 = Math.max(0, g6);

scores.G = Math.min(8, Math.max(0, Math.round((g1 + g2 + g3 + g4 + g5 + g6) * 10) / 10));

// ═══════════════════════════════════════
// CATEGORY H: CLOSING PATTERNS (7 points)
// ═══════════════════════════════════════
let h1 = 3, h2 = 2, h3 = 1;

// H1: "It is [declarative]" endings
let itIsCount = 0;
allStrings.forEach(({ value, path }) => {
  const ls = lastSentence(value);
  if (/^(It is|This is|That is)\b/i.test(ls) && wordCount(ls) < 15) {
    itIsCount++;
    if (itIsCount <= 20) { // limit logged issues
      issue("MEDIUM", "H1", `Short declarative ending: "${ls.substring(0, 60)}..."`, path);
    }
  }
});
if (itIsCount > 0) {
  issue("HIGH", "H1", `Total "It/This/That is" short declarative endings: ${itIsCount}`, "global", "Rewrite closing sentences");
  h1 = Math.max(0, 3 - itIsCount * 0.15);
}

// H2: Vocabulary in closing sentences
const closingBanned = ["structural", "mechanism", "pattern", "dynamic", "framework", "system"];
const closingCounts = {};
closingBanned.forEach(w => { closingCounts[w] = 0; });
const closingFieldPaths = ["chapterBreakdown", "whyItMatters", "moreDetails", "whatToDo", "oneMinuteRecap"];
allStrings.forEach(({ value, path }) => {
  const ls = lastSentence(value).toLowerCase();
  for (const w of closingBanned) {
    if (ls.includes(w)) {
      closingCounts[w]++;
      // Check if in banned field
      const inBannedField = closingFieldPaths.some(fp => path.toLowerCase().includes(fp.toLowerCase()));
      if (inBannedField) {
        issue("HIGH", "H2", `Closing sentence contains "${w}" in banned field`, path, `Rewrite closing to remove "${w}"`);
        h2 -= 0.05;
      }
    }
  }
});
for (const [w, count] of Object.entries(closingCounts)) {
  if (count > 3) {
    issue("MEDIUM", "H2", `"${w}" in ${count} closing sentences (max 3)`, "global");
    h2 -= 0.1;
  }
}
h2 = Math.max(0, h2);

// H3: Repeated closings within chapter
for (const ch of chapters) {
  // Collect whyItMatters endings and whatToDo endings and moreDetails endings
  const sections = { whyItMatters: [], whatToDo: [], moreDetails: [] };
  if (ch.examples) {
    for (const ex of ch.examples) {
      for (const section of ["whyItMatters", "whatToDo"]) {
        if (ex[section] && isToneObj(ex[section])) {
          for (const tone of ["gentle", "direct", "competitive"]) {
            const ls = lastSentence(ex[section][tone]);
            if (ls) sections[section].push(ls);
          }
        }
      }
    }
  }
  // moreDetails from medium/hard takeaways
  const cv = ch.contentVariants || {};
  for (const depth of ["medium", "hard"]) {
    if (cv[depth]?.keyTakeaways) {
      for (const kt of cv[depth].keyTakeaways) {
        if (kt.moreDetails && isToneObj(kt.moreDetails)) {
          for (const tone of ["gentle", "direct", "competitive"]) {
            const ls = lastSentence(kt.moreDetails[tone]);
            if (ls) sections.moreDetails.push(ls);
          }
        }
      }
    }
  }
  // Check for shared first 3 words in same section
  for (const [section, endings] of Object.entries(sections)) {
    const first3s = endings.map(e => e.split(/\s+/).slice(0, 3).join(" ").toLowerCase());
    for (let i = 0; i < first3s.length; i++) {
      for (let j = i + 1; j < first3s.length; j++) {
        if (first3s[i].length > 5 && first3s[i] === first3s[j]) {
          issue("MEDIUM", "H3", `Repeated closing start "${first3s[i]}" in ${section}`, `ch${ch.number}`);
          h3 -= 0.02;
        }
      }
    }
  }
}
h3 = Math.max(0, h3);

scores.H = Math.min(7, Math.max(0, Math.round((h1 + h2 + h3) * 10) / 10));

// ═══════════════════════════════════════
// CATEGORY I: SCENARIO QUALITY (7 points) — partial automated
// ═══════════════════════════════════════
let i2 = 1, i3 = 2, i4 = 1, i5 = 1;

// I2: Scenario word count (sample 10)
let scenarioWCIssues = 0;
const allScenarios = [];
for (const ch of chapters) {
  for (const ex of (ch.examples || [])) {
    if (ex.scenario && isToneObj(ex.scenario)) {
      allScenarios.push({ ch: ch.number, title: ex.title, scenario: ex.scenario });
    }
  }
}
const sampleScenarios = allScenarios.sort(() => Math.random() - 0.5).slice(0, 10);
for (const s of sampleScenarios) {
  for (const tone of ["gentle", "direct", "competitive"]) {
    const wc = wordCount(s.scenario[tone]);
    if (wc < 80 || wc > 150) {
      issue("MEDIUM", "I2", `Scenario "${s.title}" ${tone} = ${wc} words (need 80-150)`, `ch${s.ch}`);
      scenarioWCIssues++;
    }
  }
}
i2 = Math.max(0, 1 - scenarioWCIssues * 0.05);

// I3: Title diversity
const allTitles = [];
for (const ch of chapters) {
  for (const ex of (ch.examples || [])) {
    if (ex.title) allTitles.push(ex.title);
  }
}
const titlePatterns = {
  "Before and After": allTitles.filter(t => /before and after/i.test(t)).length,
  "Predicts": allTitles.filter(t => /predicts/i.test(t)).length,
  "Dilemma": allTitles.filter(t => /dilemma/i.test(t)).length,
};
for (const [pat, count] of Object.entries(titlePatterns)) {
  if (count > 3) {
    issue("MEDIUM", "I3", `Title pattern "${pat}" used ${count}x (max 3)`, "global");
    i3 -= 0.2;
  }
}
// Possessive pattern
const possessiveCount = allTitles.filter(t => /'s\s/i.test(t)).length;
if (possessiveCount > allTitles.length * 0.3) {
  issue("MEDIUM", "I3", `Possessive "'s" pattern in ${possessiveCount}/${allTitles.length} titles (max 30%)`, "global");
  i3 -= 0.5;
}
i3 = Math.max(0, i3);

// I4: At least 1 messy outcome per chapter
const messyKeywords = ["still", "didn't", "did not", "awkward", "messy", "partial", "lingered", "unresolved", "imperfect"];
for (const ch of chapters) {
  let hasMessy = false;
  for (const ex of (ch.examples || [])) {
    if (ex.scenario && isToneObj(ex.scenario)) {
      const text = [ex.scenario.gentle, ex.scenario.direct, ex.scenario.competitive].join(" ").toLowerCase();
      if (messyKeywords.some(k => text.includes(k))) { hasMessy = true; break; }
    }
  }
  if (!hasMessy) {
    issue("LOW", "I4", "No messy outcome found", `ch${ch.number}`, "Add imperfect outcome to at least 1 scenario");
    i4 -= 0.03;
  }
}
i4 = Math.max(0, i4);

// I5: Hook quality
const bannedStarts = [/^this chapter\b/i, /^the author argues\b/i, /^in this chapter\b/i, /^chapter \d/i];
for (const ch of chapters) {
  const cv = ch.contentVariants || {};
  for (const depth of ["easy", "medium", "hard"]) {
    if (cv[depth]?.chapterBreakdown && isToneObj(cv[depth].chapterBreakdown)) {
      for (const tone of ["gentle", "direct", "competitive"]) {
        const text = cv[depth].chapterBreakdown[tone] || "";
        const firstSentence = text.split(/[.!?]/)[0].trim();
        for (const pat of bannedStarts) {
          if (pat.test(firstSentence)) {
            issue("HIGH", "I5", `Banned hook start: "${firstSentence.substring(0, 50)}..."`, `ch${ch.number}.${depth}.${tone}`);
            i5 -= 0.05;
          }
        }
      }
    }
  }
}
i5 = Math.max(0, i5);

scores.I = Math.min(7, Math.max(0, Math.round((i2 + i3 + i4 + i5) * 10) / 10));
// Note: I1 (scenario vividness) checked by LLM — reserve 2 pts

// ═══════════════════════════════════════
// CATEGORY K: CROSS-CHAPTER (5 points) — partial automated
// ═══════════════════════════════════════
let k1 = 2, k3 = 1, k4 = 1;

// K1: Character name reuse
const stopwords = new Set(["the", "this", "that", "they", "what", "when", "where", "which", "while", "why", "how", "every", "getting", "being", "having", "making", "taking", "doing", "going", "coming", "most", "some", "many", "each", "any", "all", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "people", "someone", "try", "practice", "run", "test", "count", "ask", "write", "start", "begin", "make", "do", "notice", "track", "record", "monitor", "check", "review", "schedule", "plan", "set", "create", "build", "you", "your", "their", "his", "her", "said", "but", "and", "for", "with", "not", "she", "his", "her", "him", "its", "our", "has", "had", "was", "were", "are", "been", "will", "would", "could", "should", "may", "might", "can", "must", "shall", "did", "does", "let", "get", "got", "put", "see", "saw", "say", "tell", "told", "take", "took", "give", "gave", "use", "used", "find", "keep", "show", "try", "leave", "call", "come", "seem", "feel", "think", "look", "want", "need", "mean", "help", "turn", "move", "live", "believe", "hold", "bring", "happen", "hear", "play", "stand", "lose", "pay", "meet", "include", "continue", "learn", "change", "lead", "understand", "watch", "follow", "stop", "speak", "read", "spend", "grow", "open", "walk", "win", "offer", "remember", "love", "consider", "appear", "buy", "wait", "serve", "die", "send", "expect", "stay", "fall", "cut", "reach", "remain", "suggest", "raise", "pass", "sell", "require", "report", "decide", "pull", "develop", "thank", "carry", "break", "receive", "agree", "support", "hit", "produce", "eat", "cover", "catch", "draw", "choose", "predict", "rain", "same", "then", "nobody", "both", "here", "zero", "now", "warm", "something", "option", "before", "after", "next", "also", "still", "just", "even", "back", "into", "only", "over", "such", "other", "than", "well", "very", "just", "about", "like", "more", "through", "between", "work", "first", "last", "long", "great", "little", "own", "old", "right", "big", "high", "different", "small", "large", "early", "young", "important", "few", "public", "bad", "new", "able"]);
const namesByCh = {};
for (const ch of chapters) {
  const names = new Set();
  for (const ex of (ch.examples || [])) {
    // Extract from title
    const titleMatch = (ex.title || "").match(/^([A-Z][a-z]{2,})/);
    if (titleMatch && !stopwords.has(titleMatch[1].toLowerCase())) names.add(titleMatch[1]);
    // Extract from scenarios
    if (ex.scenario && isToneObj(ex.scenario)) {
      for (const tone of ["gentle", "direct", "competitive"]) {
        const text = ex.scenario[tone] || "";
        const nameMatches = text.match(/\b([A-Z][a-z]{2,})\b/g) || [];
        nameMatches.forEach(n => { if (!stopwords.has(n.toLowerCase())) names.add(n); });
      }
    }
  }
  namesByCh[ch.number] = names;
}
// Count name appearances across chapters
const nameChapters = {};
for (const [chNum, names] of Object.entries(namesByCh)) {
  for (const name of names) {
    if (!nameChapters[name]) nameChapters[name] = new Set();
    nameChapters[name].add(Number(chNum));
  }
}
// Filter common words that look like names
const commonWords = new Set(["Carnegie", "Chapter", "Practice", "Notice", "Consider", "Think", "Before", "After", "During", "People", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "Dale", "American", "English", "French", "German", "Chinese", "Japanese", "Korean", "Spanish", "Italian", "Russian", "Instead", "Rather", "Without", "Because", "However", "Although", "Whether", "Sometimes", "Never", "Always", "Perhaps", "Imagine", "Meanwhile", "Otherwise", "Another", "Between", "Through", "Against", "Within", "Toward", "Around", "About", "Until", "Since", "Unless", "Already", "Really", "Certainly", "Probably", "Exactly", "Simply", "Nearly", "Suddenly", "Quickly", "Slowly", "Quietly", "Directly", "Recently", "Actually", "Finally", "Eventually", "Ultimately", "Absolutely", "Basically", "Completely", "Clearly", "Typically", "Especially", "Essentially", "Specifically", "Approach", "Option", "Strategy", "Cold", "Nothing", "Reveal", "There", "Over", "Under", "Silence", "Neither", "Fifteen", "Outside", "Client", "Papers", "Forty", "Research", "Interest", "Attention", "Opportunity", "Evidence", "Information", "Connection", "Conversation", "Recognition", "Appreciation", "Criticism", "Response", "Question", "Problem", "Solution", "Result", "Effect", "Impact", "Influence", "Trust", "Respect", "Signal", "Version", "Message", "Control", "Power", "Value", "Cost", "Risk", "Advantage", "Change", "Shift", "Return", "Loss", "Gain"]);
const reusedNames = Object.entries(nameChapters)
  .filter(([name, chs]) => chs.size > 2 && !commonWords.has(name))
  .sort((a, b) => b[1].size - a[1].size);
for (const [name, chs] of reusedNames.slice(0, 15)) {
  issue("MEDIUM", "K1", `Name "${name}" in ${chs.size} chapters: ${[...chs].join(",")}`, "global", "Diversify character names");
  k1 -= 0.1;
}
k1 = Math.max(0, k1);

// K3: Format-category rotation across book
const formatCats = {};
for (const ch of chapters) {
  for (const ex of (ch.examples || [])) {
    if (ex.format && ex.category) {
      if (!formatCats[ex.format]) formatCats[ex.format] = new Set();
      formatCats[ex.format].add(ex.category);
    }
  }
}
for (const [fmt, cats] of Object.entries(formatCats)) {
  if (cats.size === 1) {
    issue("MEDIUM", "K3", `Format "${fmt}" locked to single category "${[...cats][0]}"`, "global");
    k3 -= 0.25;
  }
}
k3 = Math.max(0, k3);

// K4: School setting variety
const schoolSettings = new Set();
for (const ch of chapters) {
  for (const ex of (ch.examples || [])) {
    if (ex.category === "school" && ex.scenario && isToneObj(ex.scenario)) {
      // Extract setting from first sentence
      const text = ex.scenario.direct || "";
      const firstSentence = text.split(/[.!?]/)[0] || "";
      schoolSettings.add(firstSentence.substring(0, 30).toLowerCase());
    }
  }
}
if (schoolSettings.size < 5) {
  issue("MEDIUM", "K4", `Only ${schoolSettings.size} unique school settings (need 5+)`, "global");
  k4 -= 0.5;
}
k4 = Math.max(0, k4);

scores.K = Math.min(5, Math.max(0, Math.round((k1 + k3 + k4) * 10) / 10));
// Note: K2 (cross-chapter references) checked by LLM — reserve 1 pt

// Placeholder scores for LLM-checked categories
scores.F = 10; // Will be adjusted by LLM checks
scores.J = 5;  // Will be adjusted by LLM checks

// ═══════════════════════════════════════
// REPORT
// ═══════════════════════════════════════
const total = Object.values(scores).reduce((a, b) => a + b, 0);

// Sort and group issues
const bySeverity = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
for (const iss of issues) {
  bySeverity[iss.severity] = bySeverity[iss.severity] || [];
  bySeverity[iss.severity].push(iss);
}

console.log(`
═══════════════════════════════════════
CHAPTERFLOW MASTERVALIDATOR REPORT
Book: ${book.title || "Unknown"} by ${book.author || "Unknown"}
Chapters: ${N}
Date: ${new Date().toISOString().split("T")[0]}
═══════════════════════════════════════

SCORE: ${Math.round(total * 10) / 10}/100 (automated checks; F,J,L pending LLM review)

CATEGORY BREAKDOWN:
  A. Schema Structure:     ${scores.A}/15
  B. Depth Structure:      ${scores.B}/10
  C. Word Counts:          ${scores.C}/8
  D. Example Schema:       ${scores.D}/12
  E. Quiz Schema:          ${scores.E}/10
  F. Content Specificity:  ${scores.F}/10 (LLM review pending)
  G. Vocabulary & Phrases: ${scores.G}/8
  H. Closing Patterns:     ${scores.H}/7
  I. Scenario Quality:     ${scores.I}/7 (I1 LLM review pending)
  J. Tone Quality:         ${scores.J}/5 (LLM review pending)
  K. Cross-Chapter:        ${scores.K}/5 (K2 LLM review pending)
  L. Wiring & Assembly:    —/3 (file check pending)

═══════════════════════════════════════
ISSUES FOUND: ${issues.length}
═══════════════════════════════════════
`);

for (const sev of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) {
  const list = bySeverity[sev] || [];
  if (list.length === 0) continue;
  console.log(`${sev} (${list.length}):`);
  // Deduplicate similar issues
  const seen = new Map();
  for (const iss of list) {
    const key = `${iss.category}|${iss.description}`;
    if (seen.has(key)) {
      seen.get(key).count++;
      seen.get(key).locations.push(iss.location);
    } else {
      seen.set(key, { ...iss, count: 1, locations: [iss.location] });
    }
  }
  for (const iss of seen.values()) {
    const loc = iss.count > 3 ? `${iss.locations.slice(0, 3).join(", ")}... (${iss.count} total)` : iss.locations.join(", ");
    console.log(`  - [${iss.category}] ${iss.description} — ${loc}${iss.fix ? ` — Fix: ${iss.fix}` : ""}`);
  }
  console.log();
}

// Summary counts for quick reference
console.log(`═══════════════════════════════════════`);
console.log(`SUMMARY COUNTS`);
console.log(`═══════════════════════════════════════`);
console.log(`Total issues: ${issues.length}`);
console.log(`  CRITICAL: ${(bySeverity.CRITICAL || []).length}`);
console.log(`  HIGH:     ${(bySeverity.HIGH || []).length}`);
console.log(`  MEDIUM:   ${(bySeverity.MEDIUM || []).length}`);
console.log(`  LOW:      ${(bySeverity.LOW || []).length}`);

// Detailed word count report
console.log(`\n═══════════════════════════════════════`);
console.log(`WORD COUNT DETAILS (C)`);
console.log(`═══════════════════════════════════════`);
for (const ch of chapters) {
  const cv = ch.contentVariants || {};
  const counts = [];
  for (const depth of ["easy", "medium", "hard"]) {
    if (cv[depth]?.chapterBreakdown && isToneObj(cv[depth].chapterBreakdown)) {
      const g = wordCount(cv[depth].chapterBreakdown.gentle);
      const d = wordCount(cv[depth].chapterBreakdown.direct);
      const c = wordCount(cv[depth].chapterBreakdown.competitive);
      counts.push(`${depth}:g${g}/d${d}/c${c}`);
    }
  }
  console.log(`  Ch${String(ch.number).padStart(2)}: ${counts.join("  ")}`);
}

// Example count summary
console.log(`\n═══════════════════════════════════════`);
console.log(`EXAMPLE & QUIZ SUMMARY`);
console.log(`═══════════════════════════════════════`);
for (const ch of chapters) {
  const exCount = (ch.examples || []).length;
  const qCount = ch.quiz?.questions?.length ?? "null";
  const fmts = (ch.examples || []).map(e => e.format || "?").join(",");
  console.log(`  Ch${String(ch.number).padStart(2)}: ${exCount} examples, ${qCount} quiz Qs | formats: ${fmts}`);
}
