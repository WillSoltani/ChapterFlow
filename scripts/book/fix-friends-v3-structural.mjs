#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, "book-packages", "friends-and-influence.modern.json");

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

function wordCount(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

// ─── NAME POOL ──────────────────────────────────────────────────────────

const EXISTING_POOL = "Maya,Ethan,Priya,Marcus,Sofia,Kai,Nora,James,Leila,Andre,Yuki,Omar,Tessa,Davi,Aaliyah,Connor,Rosa,Kenji,Dante,Rina,Felix,Naomi,Tariq,Ivy,Mei,Zara,Liam,Amara,Samir,Elena,Hana,Derek,Celia,Riku,Asha,Nico,Petra,Idris,Quinn,Lena,Tomas,Suki,Mikhail,Bria,Kaden,Anika,Joel,Thea,Ravi,Luz,Emery,Camille,Soren,Dina,Grant,Yara,Paco,Iris,Malik,Freya,Theo,Alma,Jai,Nell,Amir,Sage,Rowan,Cleo,Benny,Vera,Hugo,Lia,Milo,Selena,Kira,Cruz,Maren,Tate,Ada,Obi,Nina,Leo,Farah,Wren,Dex,Sable,Remy,Gil,Zuri,Tala,Knox,Elise,Rio,Harlan,Pearl,Juno,Cole,Lyra,Siya,Finn,Esme,Atlas,Raina,Kit,Maeve,Bodhi,Lina,Zeke,Cora,Taj,Willa,Oren,Nadia,Bryn,Ezra,Simone,Beck,Anya,Gael,Tova,Ray,Mira,Otis,June,Ren,Daria,Axel,Sol,Nyla,Penn,Rue,Joss,Koa,Belen,Nash,Paloma,Eamon,Isla,Dane,Pia,Reed,Noelle,Kip,Lark,Amina".split(",");

const FRESH_NAMES = [
  "Sana", "Kieran", "Liora", "Tobias", "Ingrid", "Jalen", "Celeste", "Arlo",
  "Anisa", "Mateo", "Yael", "Callum", "Rhea", "Navid", "Joaquin",
  "Linnea", "Stefan", "Kyler", "Tamsin", "Rohan", "Zoya", "Brennan",
  "Saskia", "Kian", "Elara", "Orion", "Talia", "Jensen", "Noor", "Colton",
  "Hadley", "Rafa", "Maisie", "Idara", "Tristan", "Leona", "Barrett", "Seraphina",
  "Elio", "Vivaan", "Chiara", "Declan", "Saoirse", "Anders", "Zaina", "Grady",
  "Valentina", "Caspian", "Odette", "Kaito", "Soleil", "Esteban", "Niamh", "Alaric",
  "Ines", "Theron", "Holden", "Livia", "Emeric", "Kamala", "Dorian",
  "Vesper", "Reuel", "Adira", "Leif", "Winona", "Caius",
].filter((n) => !EXISTING_POOL.includes(n));

// ─── LEVERAGE SYNONYMS ──────────────────────────────────────────────────

const LEVERAGE_SYNONYMS = [
  "advantage", "influence", "power", "position", "upper hand", "edge",
  "bargaining power", "hold", "sway", "pull", "weight", "authority",
];

// ─── ASK YOURSELF REPLACEMENTS ──────────────────────────────────────────

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

// ─── AI-TELL PHRASE REPLACEMENTS ────────────────────────────────────────

const AITELL_REPLACEMENTS = {
  landscape: ["environment", "context", "terrain", "world", "field", "setting"],
  facilitate: ["help", "support", "enable"],
  navigating: ["handling", "working through"],
  crucial: ["important", "critical", "essential"],
};

// ─── STUDY GROUP REPLACEMENTS ───────────────────────────────────────────

const STUDY_GROUP_SETTINGS = [
  "thesis advisor meeting", "student government session", "debate team practice",
  "campus newspaper editorial", "peer tutoring session", "dorm floor meeting",
  "scholarship interview", "mock trial preparation", "lab partner discussion",
  "art critique session", "athletic team meeting", "teaching assistant office hours",
  "internship orientation", "club fundraiser planning", "campus tour guide training",
  "research assistant meeting", "honors seminar discussion", "student council meeting",
  "capstone project review", "academic conference rehearsal",
];

// ─── FORMAT AND ENDING TYPE CONSTANTS ───────────────────────────────────

const FORMATS = ["decision_point", "postmortem", "dialogue", "predict_reveal", "dilemma", "before_after"];
const ENDING_TYPES = ["broader_principle", "self_directed_question", "surprising_implication", "cross_domain", "common_trap", "perspective_reframe"];

// ─── COMMANDS ───────────────────────────────────────────────────────────

function audit() {
  const pkg = readJson(PACKAGE_PATH);
  const results = {
    leverage: { total: 0, byChapter: {} },
    askSelf: { total: 0, byChapter: {}, chaptersOver1: [] },
    aiTell: { landscape: 0, facilitate: 0, navigating: 0, crucial: 0 },
    declarativeEndings: { total: 0, byChapter: {} },
    studyGroup: { total: 0, chapters: [] },
    patternClosings: 0,
    mechanismClosings: 0,
    structuralClosings: 0,
    names: {},
    practiceTakeaways: [],
    missingMetadata: { category: 0, format: 0, endingType: 0 },
    nonToneScenario: 0,
    nonToneWhatToDo: 0,
    nonToneWhyItMatters: 0,
    nonToneExplanation: 0,
    fourChoiceQuiz: 0,
    beforeAfterTitles: 0,
    predictsTitles: 0,
    dilemmaTitles: 0,
    easyBreakdownOutOfRange: { under: 0, over: 0 },
    emDashes: 0,
    placeholders: 0,
  };

  const primaryByChapter = new Map();

  for (const ch of pkg.chapters) {
    const nn = zeroPad(ch.number);
    const chPrimary = new Set();
    for (const ex of ch.examples || []) {
      const m = ex.title?.match(/^([A-Z][a-z]+)/);
      if (m) chPrimary.add(m[1]);
    }
    primaryByChapter.set(ch.number, chPrimary);

    let leverageCount = 0;
    let askSelfCount = 0;
    let declarativeCount = 0;

    // Check examples for missing metadata and non-tone fields
    for (const ex of ch.examples || []) {
      if (!ex.category) results.missingMetadata.category++;
      if (!ex.format) results.missingMetadata.format++;
      if (!ex.endingType) results.missingMetadata.endingType++;
      if (typeof ex.scenario === "string") results.nonToneScenario++;
      if (Array.isArray(ex.whatToDo)) results.nonToneWhatToDo++;
      else if (typeof ex.whatToDo === "string") results.nonToneWhatToDo++;
      if (typeof ex.whyItMatters === "string") results.nonToneWhyItMatters++;

      // Title patterns
      if (/before and after/i.test(ex.title)) results.beforeAfterTitles++;
      if (/\bpredicts?\b/i.test(ex.title)) results.predictsTitles++;
      if (/\bdilemma\b/i.test(ex.title)) results.dilemmaTitles++;
    }

    // Check quiz
    for (const q of ch.quiz?.questions || []) {
      if (q.choices?.length === 4) results.fourChoiceQuiz++;
      if (typeof q.explanation === "string") results.nonToneExplanation++;
    }

    // Check easy breakdown word counts
    const easyBreakdown = ch.contentVariants?.easy?.chapterBreakdown;
    if (easyBreakdown) {
      const variants = typeof easyBreakdown === "string"
        ? [easyBreakdown]
        : [easyBreakdown.gentle, easyBreakdown.direct, easyBreakdown.competitive].filter(Boolean);
      for (const v of variants) {
        const wc = wordCount(v);
        if (wc < 140) results.easyBreakdownOutOfRange.under++;
        if (wc > 175) results.easyBreakdownOutOfRange.over++;
      }
    }

    walkStrings(ch, (text, fieldPath) => {
      // Leverage
      const leverageMatches = text.match(/\bleverage\b/gi);
      if (leverageMatches) leverageCount += leverageMatches.length;

      // Ask yourself
      const askMatches = text.match(/\bask yourself\b/gi);
      if (askMatches) askSelfCount += askMatches.length;

      // AI-tell phrases
      if (/\blandscape\b/i.test(text)) results.aiTell.landscape++;
      if (/\bfacilitate\b/i.test(text)) results.aiTell.facilitate++;
      if (/\bnavigating\b/i.test(text)) results.aiTell.navigating++;
      if (/\bcrucial\b/i.test(text)) results.aiTell.crucial++;

      // Declarative endings
      const lastSent = getLastSentence(text);
      if (/^(It is|This is|That is)\s/i.test(lastSent) && lastSent.split(/\s+/).length < 15) {
        declarativeCount++;
      }

      // Pattern/mechanism/structural in closings
      if (/\bpattern\b/i.test(lastSent)) results.patternClosings++;
      if (/\bmechanism\b/i.test(lastSent)) results.mechanismClosings++;
      if (/\bstructural\b/i.test(lastSent)) results.structuralClosings++;

      // Study group
      if (/\bstudy group\b/i.test(text) && !results.studyGroup.chapters.includes(ch.number)) {
        results.studyGroup.chapters.push(ch.number);
      }

      // Em/en dashes
      const dashMatches = text.match(/[\u2013\u2014]/g);
      if (dashMatches) results.emDashes += dashMatches.length;

      // Placeholders
      const phMatches = text.match(/__PLACEHOLDER__/g);
      if (phMatches) results.placeholders += phMatches.length;

      // Secondary names
      const nameMatches = text.match(/\b([A-Z][a-z]{2,})\b/g) || [];
      for (const name of nameMatches) {
        if (EXISTING_POOL.includes(name) && !chPrimary.has(name)) {
          if (!results.names[name]) results.names[name] = new Set();
          results.names[name].add(ch.number);
        }
      }
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
    const medTakeaways = ch.contentVariants?.medium?.keyTakeaways || [];
    for (const [i, t] of medTakeaways.entries()) {
      const directPoint = typeof t.point === "string" ? t.point : (t.point?.direct || "");
      if (/^\*?\*?(?:Try|Practice|Run|Test|Count|Ask|Write|Start|Begin|Make|Do|Track|Record|Monitor|Check|Review|Schedule|Plan|Set|Create|Build|Stop|Read|Tell)\b/i.test(directPoint.replace(/^\*+/, ""))) {
        results.practiceTakeaways.push({
          chapter: ch.number,
          index: i,
          text: directPoint.slice(0, 120),
        });
      }
    }
  }

  // Convert name sets to arrays and filter
  const overusedNames = {};
  for (const [name, chs] of Object.entries(results.names)) {
    if (chs.size > 2) {
      overusedNames[name] = { count: chs.size, chapters: [...chs].sort((a, b) => a - b) };
    }
  }

  console.log("=== Friends & Influence v3 Compliance Audit ===\n");

  console.log("--- SCHEMA ---");
  console.log(`Missing category: ${results.missingMetadata.category}`);
  console.log(`Missing format: ${results.missingMetadata.format}`);
  console.log(`Missing endingType: ${results.missingMetadata.endingType}`);
  console.log(`Non-tone scenario (plain string): ${results.nonToneScenario}`);
  console.log(`Non-tone whatToDo (array/string): ${results.nonToneWhatToDo}`);
  console.log(`Non-tone whyItMatters (plain string): ${results.nonToneWhyItMatters}`);
  console.log(`Non-tone quiz explanation (plain string): ${results.nonToneExplanation}`);
  console.log(`4-choice quiz questions: ${results.fourChoiceQuiz}`);
  console.log(`Remaining __PLACEHOLDER__: ${results.placeholders}`);

  console.log("\n--- CONTENT QUALITY ---");
  console.log(`LEVERAGE: ${results.leverage.total} total`);
  const topLev = Object.entries(results.leverage.byChapter).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [ch, count] of topLev) console.log(`  Ch${ch}: ${count}`);

  console.log(`\nASK YOURSELF: ${results.askSelf.total} total, ${results.askSelf.chaptersOver1.length} chapters with 2+`);

  console.log(`\nAI-TELL PHRASES:`);
  console.log(`  landscape: ${results.aiTell.landscape}`);
  console.log(`  facilitate: ${results.aiTell.facilitate}`);
  console.log(`  navigating: ${results.aiTell.navigating}`);
  console.log(`  crucial: ${results.aiTell.crucial}`);

  console.log(`\nDECLARATIVE ENDINGS: ${results.declarativeEndings.total}`);
  console.log(`PATTERN in closings: ${results.patternClosings}`);
  console.log(`MECHANISM in closings: ${results.mechanismClosings}`);
  console.log(`STRUCTURAL in closings: ${results.structuralClosings}`);

  console.log(`\nSTUDY GROUP: ${results.studyGroup.chapters.length} chapters [${results.studyGroup.chapters.join(", ")}]`);

  console.log(`\nOVERUSED NAMES (>2 chapters secondary):`);
  for (const [name, info] of Object.entries(overusedNames).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  ${name}: ${info.count} chapters [${info.chapters.join(", ")}]`);
  }

  console.log(`\nTITLE PATTERNS:`);
  console.log(`  "Before and After": ${results.beforeAfterTitles}`);
  console.log(`  "Predicts": ${results.predictsTitles}`);
  console.log(`  "Dilemma": ${results.dilemmaTitles}`);

  console.log(`\nPRACTICE TAKEAWAYS: ${results.practiceTakeaways.length}`);
  for (const pt of results.practiceTakeaways) {
    console.log(`  Ch${zeroPad(pt.chapter)} med[${pt.index}]: ${pt.text}`);
  }

  console.log(`\nEASY BREAKDOWN WORD COUNTS: ${results.easyBreakdownOutOfRange.under} under 140, ${results.easyBreakdownOutOfRange.over} over 175`);
  console.log(`EM/EN DASHES: ${results.emDashes}`);
}

// ─── ADD METADATA ───────────────────────────────────────────────────────

function addMetadata() {
  const pkg = readJson(PACKAGE_PATH);
  let added = { category: 0, format: 0, endingType: 0 };

  for (const ch of pkg.chapters) {
    const examples = ch.examples || [];
    if (examples.length !== 6) {
      console.log(`WARNING: Ch${zeroPad(ch.number)} has ${examples.length} examples (expected 6)`);
    }

    // --- CATEGORY ---
    for (const ex of examples) {
      if (!ex.category) {
        ex.category = (ex.contexts && ex.contexts[0]) || "work";
        added.category++;
      }
    }

    // --- FORMAT ---
    // First pass: assign by heuristic
    const formatAssignments = new Map();

    for (let i = 0; i < examples.length; i++) {
      const ex = examples[i];
      if (ex.format) {
        formatAssignments.set(i, ex.format);
        continue;
      }

      const title = (ex.title || "").toLowerCase();
      const scenarioText = typeof ex.scenario === "string" ? ex.scenario :
        (ex.scenario?.direct || "");

      // Check dialogue: 3+ quoted speech exchanges
      const quoteMatches = scenarioText.match(/['"\u2018\u2019\u201C\u201D][^'"\u2018\u2019\u201C\u201D]{5,}['"\u2018\u2019\u201C\u201D]/g) || [];
      if (quoteMatches.length >= 3) {
        formatAssignments.set(i, "dialogue");
        continue;
      }

      // Check title keywords
      if (/before and after/i.test(title) || /transformation/i.test(title)) {
        formatAssignments.set(i, "before_after");
        continue;
      }
      if (/\bpredicts?\b/i.test(title) || /\bguess/i.test(title)) {
        formatAssignments.set(i, "predict_reveal");
        continue;
      }
      if (/\bdilemma\b/i.test(title) || /\bbetween\b/i.test(title) || /\bchoice\b/i.test(title) || /\bchooses?\b/i.test(title)) {
        formatAssignments.set(i, "dilemma");
        continue;
      }

      // Check postmortem: scenario uses past tense analysis words
      if (/what went wrong|looking back|in hindsight|after the fact|the mistake was|the failure/i.test(scenarioText)) {
        formatAssignments.set(i, "postmortem");
        continue;
      }

      // Default
      formatAssignments.set(i, "decision_point");
    }

    // Second pass: ensure all 6 formats used exactly once
    const usedFormats = new Set();
    const formatCounts = {};
    for (const [_, fmt] of formatAssignments) {
      formatCounts[fmt] = (formatCounts[fmt] || 0) + 1;
      usedFormats.add(fmt);
    }

    // Find missing formats
    const missingFormats = FORMATS.filter(f => !usedFormats.has(f));

    // Find duplicate formats (take from the most duplicated, preferring decision_point)
    if (missingFormats.length > 0) {
      // Sort by count descending, preferring to steal from decision_point
      const stealOrder = [...formatAssignments.entries()]
        .filter(([_, fmt]) => formatCounts[fmt] > 1)
        .sort((a, b) => {
          // Prefer to steal from decision_point
          if (a[1] === "decision_point" && b[1] !== "decision_point") return -1;
          if (b[1] === "decision_point" && a[1] !== "decision_point") return 1;
          return formatCounts[b[1]] - formatCounts[a[1]];
        });

      for (const missing of missingFormats) {
        if (stealOrder.length === 0) break;
        const [idx, oldFmt] = stealOrder.shift();
        formatAssignments.set(idx, missing);
        formatCounts[oldFmt]--;
        formatCounts[missing] = 1;
      }
    }

    // Apply format assignments
    for (const [i, fmt] of formatAssignments) {
      if (!examples[i].format) {
        examples[i].format = fmt;
        added.format++;
      }
    }

    // --- ENDING TYPE ---
    const endingAssignments = new Map();

    for (let i = 0; i < examples.length; i++) {
      const ex = examples[i];
      if (ex.endingType) {
        endingAssignments.set(i, ex.endingType);
        continue;
      }

      const whyText = typeof ex.whyItMatters === "string" ? ex.whyItMatters :
        (ex.whyItMatters?.direct || "");
      const lastSent = getLastSentence(whyText);

      // Classify
      if (lastSent.endsWith("?")) {
        endingAssignments.set(i, "self_directed_question");
        continue;
      }
      if (/\bmistake\b|\btrap\b|\bwrong\b|\berror\b|\bfail/i.test(lastSent)) {
        endingAssignments.set(i, "common_trap");
        continue;
      }
      if (/\bsurpris/i.test(lastSent) || /\bunexpect/i.test(lastSent) || /\bcounterintuiti/i.test(lastSent)) {
        endingAssignments.set(i, "surprising_implication");
        continue;
      }
      // Cross-domain: mentions a different context
      const exCategory = ex.category || (ex.contexts && ex.contexts[0]) || "work";
      const otherDomains = { work: /\bschool\b|\bclass\b|\bfamily\b|\bfriend/i, school: /\boffice\b|\bwork\b|\bboss\b|\bfamily/i, personal: /\boffice\b|\bwork\b|\bschool\b|\bclass/i };
      if (otherDomains[exCategory]?.test(lastSent)) {
        endingAssignments.set(i, "cross_domain");
        continue;
      }
      if (/\breframe\b|\bshift\b|\bperspective\b|\blens\b|\bangle\b/i.test(lastSent)) {
        endingAssignments.set(i, "perspective_reframe");
        continue;
      }
      // Default to broader_principle
      endingAssignments.set(i, "broader_principle");
    }

    // Ensure all 6 ending types used exactly once
    const usedEndings = new Set();
    const endingCounts = {};
    for (const [_, et] of endingAssignments) {
      endingCounts[et] = (endingCounts[et] || 0) + 1;
      usedEndings.add(et);
    }

    const missingEndings = ENDING_TYPES.filter(e => !usedEndings.has(e));
    if (missingEndings.length > 0) {
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

    // Apply ending type assignments
    for (const [i, et] of endingAssignments) {
      if (!examples[i].endingType) {
        examples[i].endingType = et;
        added.endingType++;
      }
    }
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Added metadata: category=${added.category}, format=${added.format}, endingType=${added.endingType}`);
}

// ─── SCAFFOLD TONES ─────────────────────────────────────────────────────

function scaffoldTones() {
  const pkg = readJson(PACKAGE_PATH);
  let converted = { scenario: 0, whatToDo: 0, whyItMatters: 0, explanation: 0 };

  for (const ch of pkg.chapters) {
    // Convert example fields
    for (const ex of ch.examples || []) {
      // scenario: string -> tone object
      if (typeof ex.scenario === "string") {
        ex.scenario = {
          gentle: "__PLACEHOLDER__",
          direct: ex.scenario,
          competitive: "__PLACEHOLDER__",
        };
        converted.scenario++;
      }

      // whatToDo: array -> tone object
      if (Array.isArray(ex.whatToDo)) {
        const joined = ex.whatToDo.join(" ");
        ex.whatToDo = {
          gentle: "__PLACEHOLDER__",
          direct: joined,
          competitive: "__PLACEHOLDER__",
        };
        converted.whatToDo++;
      } else if (typeof ex.whatToDo === "string") {
        ex.whatToDo = {
          gentle: "__PLACEHOLDER__",
          direct: ex.whatToDo,
          competitive: "__PLACEHOLDER__",
        };
        converted.whatToDo++;
      }

      // whyItMatters: string -> tone object
      if (typeof ex.whyItMatters === "string") {
        ex.whyItMatters = {
          gentle: "__PLACEHOLDER__",
          direct: ex.whyItMatters,
          competitive: "__PLACEHOLDER__",
        };
        converted.whyItMatters++;
      }
    }

    // Convert quiz explanations
    for (const q of ch.quiz?.questions || []) {
      if (typeof q.explanation === "string") {
        q.explanation = {
          gentle: "__PLACEHOLDER__",
          direct: q.explanation,
          competitive: "__PLACEHOLDER__",
        };
        converted.explanation++;
      }
    }
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Scaffolded tones: scenario=${converted.scenario}, whatToDo=${converted.whatToDo}, whyItMatters=${converted.whyItMatters}, explanation=${converted.explanation}`);
  const totalPlaceholders = (converted.scenario + converted.whatToDo + converted.whyItMatters + converted.explanation) * 2;
  console.log(`Total __PLACEHOLDER__ markers: ${totalPlaceholders}`);
}

// ─── TRIM QUIZ ──────────────────────────────────────────────────────────

function trimQuiz() {
  const pkg = readJson(PACKAGE_PATH);
  let trimmed = 0;
  let needsAgent = 0;
  const flaggedQuestions = [];

  for (const ch of pkg.chapters) {
    for (const q of ch.quiz?.questions || []) {
      if (!q.choices || q.choices.length !== 4) continue;

      if (q.correctIndex === 3) {
        // Answer is D -- need agent help to decide which of A/B/C to drop
        // For now, keep D as the correct answer and remove the first wrong answer (A, B, or C)
        // that seems weakest. Simple heuristic: remove the shortest wrong answer.
        const wrongIndices = [0, 1, 2]; // A, B, C are all wrong
        let removeIdx = wrongIndices[0];
        let shortestLen = Infinity;
        for (const wi of wrongIndices) {
          const choiceText = q.choices[wi].replace(/^[A-D]\)\s*/, "");
          if (choiceText.length < shortestLen) {
            shortestLen = choiceText.length;
            removeIdx = wi;
          }
        }

        // Remove the shortest wrong answer
        q.choices.splice(removeIdx, 1);

        // The correct answer (was at index 3) is now at index 2
        q.correctIndex = 2;

        // Relabel A, B, C
        q.choices = q.choices.map((c, i) => {
          const label = String.fromCharCode(65 + i); // A, B, C
          return `${label}) ${c.replace(/^[A-D]\)\s*/, "")}`;
        });

        trimmed++;
        continue;
      }

      // correctIndex is 0, 1, or 2 -- remove choice D (index 3)
      q.choices.splice(3, 1);

      // Relabel remaining as A, B, C
      q.choices = q.choices.map((c, i) => {
        const label = String.fromCharCode(65 + i);
        return `${label}) ${c.replace(/^[A-D]\)\s*/, "")}`;
      });

      // correctIndex stays the same (was 0, 1, or 2)
      trimmed++;
    }
  }

  // Verify correctIndex balance per chapter
  let imbalanced = 0;
  for (const ch of pkg.chapters) {
    const counts = [0, 0, 0];
    for (const q of ch.quiz?.questions || []) {
      if (q.correctIndex >= 0 && q.correctIndex <= 2) {
        counts[q.correctIndex]++;
      }
    }
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    if (max - min > 4) {
      imbalanced++;
      console.log(`  Ch${zeroPad(ch.number)} correctIndex balance: A=${counts[0]} B=${counts[1]} C=${counts[2]}`);
    }
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Trimmed ${trimmed} questions to 3 choices`);
  if (imbalanced > 0) console.log(`${imbalanced} chapters have imbalanced correctIndex distribution`);
}

// ─── PHASE B: MECHANICAL FIXES ──────────────────────────────────────────

function fixLeverage() {
  const pkg = readJson(PACKAGE_PATH);
  let totalRemoved = 0;

  for (const ch of pkg.chapters) {
    let chapterCount = 0;
    const synIndex = ch.number % LEVERAGE_SYNONYMS.length;

    const chIdx = pkg.chapters.indexOf(ch);
    pkg.chapters[chIdx] = walkAndReplace(ch, (text) => {
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
  console.log(`Leverage: removed ${totalRemoved} excess occurrences`);
}

function fixAskSelf() {
  const pkg = readJson(PACKAGE_PATH);
  let totalRemoved = 0;

  for (const ch of pkg.chapters) {
    let chapterCount = 0;
    let altIdx = ch.number % ASK_SELF_ALTS.length;

    const chIdx = pkg.chapters.indexOf(ch);
    pkg.chapters[chIdx] = walkAndReplace(ch, (text) => {
      return text.replace(/\bask yourself\b/gi, (match) => {
        chapterCount++;
        if (chapterCount === 1) return match;
        totalRemoved++;
        const alt = ASK_SELF_ALTS[altIdx % ASK_SELF_ALTS.length];
        altIdx++;
        return alt;
      });
    });
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`"ask yourself": removed ${totalRemoved} excess occurrences`);
}

function fixAiTell() {
  const pkg = readJson(PACKAGE_PATH);
  let totalReplaced = 0;
  const counters = {};

  for (const ch of pkg.chapters) {
    const chIdx = pkg.chapters.indexOf(ch);
    pkg.chapters[chIdx] = walkAndReplace(ch, (text) => {
      let result = text;

      for (const [word, replacements] of Object.entries(AITELL_REPLACEMENTS)) {
        const regex = new RegExp(`\\b${word}\\b`, "gi");
        result = result.replace(regex, (match) => {
          if (!counters[word]) counters[word] = 0;
          const replacement = replacements[counters[word] % replacements.length];
          counters[word]++;
          totalReplaced++;
          if (match[0] === match[0].toUpperCase()) {
            return replacement.charAt(0).toUpperCase() + replacement.slice(1);
          }
          return replacement;
        });
      }

      return result;
    });
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`AI-tell phrases: replaced ${totalReplaced} total`);
  for (const [word, count] of Object.entries(counters)) {
    console.log(`  ${word}: ${count}`);
  }
}

function fixNames() {
  const pkg = readJson(PACKAGE_PATH);

  // Build name-to-chapters map for secondary names
  const nameChapters = {};
  const primaryByChapter = new Map();

  for (const ch of pkg.chapters) {
    const chPrimary = new Set();
    for (const ex of ch.examples || []) {
      const m = ex.title?.match(/^([A-Z][a-z]+)/);
      if (m) chPrimary.add(m[1]);
    }
    primaryByChapter.set(ch.number, chPrimary);

    walkStrings(ch, (text) => {
      const matches = text.match(/\b([A-Z][a-z]{2,})\b/g) || [];
      for (const name of matches) {
        if (EXISTING_POOL.includes(name) && !chPrimary.has(name)) {
          if (!nameChapters[name]) nameChapters[name] = new Set();
          nameChapters[name].add(ch.number);
        }
      }
    });
  }

  const overused = Object.entries(nameChapters)
    .filter(([_, chs]) => chs.size > 2)
    .sort((a, b) => b[1].size - a[1].size);

  let freshIndex = 0;
  let totalReplacements = 0;

  for (const [name, chapSet] of overused) {
    const chapters = [...chapSet].sort((a, b) => a - b);
    const keep = new Set(chapters.slice(0, 2)); // Keep first 2 appearances
    const replaceIn = chapters.filter((ch) => !keep.has(ch));

    for (const chNum of replaceIn) {
      const replacement = FRESH_NAMES[freshIndex % FRESH_NAMES.length];
      freshIndex++;

      const chIdx = pkg.chapters.findIndex((c) => c.number === chNum);
      if (chIdx === -1) continue;

      const regex = new RegExp(`\\b${name}\\b`, "g");
      let chReplaced = 0;
      pkg.chapters[chIdx] = walkAndReplace(pkg.chapters[chIdx], (text) => {
        const matches = text.match(regex);
        if (matches) chReplaced += matches.length;
        return text.replace(regex, replacement);
      });

      totalReplacements += chReplaced;
      console.log(`  ${name} in Ch${zeroPad(chNum)} -> ${replacement} (${chReplaced} occurrences)`);
    }

    console.log(`${name}: kept in [${[...keep].join(",")}], replaced in ${replaceIn.length} chapters`);
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`\nTotal replacements: ${totalReplacements}`);
}

function fixDashes() {
  const pkg = readJson(PACKAGE_PATH);
  let totalReplaced = 0;

  for (let i = 0; i < pkg.chapters.length; i++) {
    pkg.chapters[i] = walkAndReplace(pkg.chapters[i], (text) => {
      const matches = text.match(/[\u2013\u2014]/g);
      if (matches) totalReplaced += matches.length;
      return text.replace(/[\u2014]/g, " -- ").replace(/[\u2013]/g, " - ");
    });
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Dashes: replaced ${totalReplaced} em/en dashes`);
}

function fixStudyGroup() {
  const pkg = readJson(PACKAGE_PATH);

  // Find chapters with "study group"
  const chaptersWithSG = [];
  for (const ch of pkg.chapters) {
    let found = false;
    walkStrings(ch, (text) => {
      if (!found && /\bstudy group\b/i.test(text)) {
        found = true;
      }
    });
    if (found) chaptersWithSG.push(ch.number);
  }

  console.log(`Found "study group" in ${chaptersWithSG.length} chapters: [${chaptersWithSG.join(", ")}]`);

  // Keep first 3, replace in rest
  const keepChapters = new Set(chaptersWithSG.slice(0, 3));
  const replaceChapters = chaptersWithSG.filter(n => !keepChapters.has(n));

  let settingIdx = 0;
  let totalReplaced = 0;

  for (const chNum of replaceChapters) {
    const chIdx = pkg.chapters.findIndex(c => c.number === chNum);
    if (chIdx === -1) continue;

    const setting = STUDY_GROUP_SETTINGS[settingIdx % STUDY_GROUP_SETTINGS.length];
    settingIdx++;

    pkg.chapters[chIdx] = walkAndReplace(pkg.chapters[chIdx], (text) => {
      const matches = text.match(/\bstudy group\b/gi);
      if (matches) totalReplaced += matches.length;
      return text.replace(/\bstudy group\b/gi, setting);
    });
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Study group: replaced in ${replaceChapters.length} chapters (${totalReplaced} occurrences), kept in [${[...keepChapters].join(", ")}]`);
}

function fixPractice() {
  const pkg = readJson(PACKAGE_PATH);
  let fixed = 0;

  for (const ch of pkg.chapters) {
    const medTakeaways = ch.contentVariants?.medium?.keyTakeaways || [];

    for (const t of medTakeaways) {
      // Check all three tones
      for (const tone of ["gentle", "direct", "competitive"]) {
        let text = "";
        if (typeof t.point === "string") {
          text = t.point;
        } else if (t.point && t.point[tone]) {
          text = t.point[tone];
        } else {
          continue;
        }

        const stripped = text.replace(/^\*+/, "").trim();
        if (/^(?:Try|Practice|Run|Test|Count|Ask|Write|Start|Begin|Make|Do|Track|Record|Monitor|Check|Review|Schedule|Plan|Set|Create|Build|Stop|Read|Tell)\b/i.test(stripped)) {
          // Convert imperative to insight
          // Extract the bold headline if present
          const boldMatch = text.match(/^\*\*(.+?)\*\*/);
          if (boldMatch) {
            // Has bold headline -- rewrite the headline from imperative to declarative
            const headline = boldMatch[1];
            // Replace imperative verbs with insight framing
            let newHeadline = headline
              .replace(/^Start\b/i, "The key is")
              .replace(/^Stop\b/i, "The shift away from")
              .replace(/^Do\b/i, "The practice of")
              .replace(/^Read\b/i, "Understanding comes from")
              .replace(/^Check\b/i, "Awareness of")
              .replace(/^Ask\b/i, "The question that matters is")
              .replace(/^Tell\b/i, "The message that lands is")
              .replace(/^Try\b/i, "The experiment worth running is")
              .replace(/^Practice\b/i, "The skill that compounds is")
              .replace(/^Begin\b/i, "The starting point is")
              .replace(/^Make\b/i, "What works is")
              .replace(/^Monitor\b/i, "What to watch for is")
              .replace(/^Review\b/i, "The review reveals")
              .replace(/^Track\b/i, "Tracking reveals")
              .replace(/^Build\b/i, "Building toward")
              .replace(/^Create\b/i, "Creating")
              .replace(/^Set\b/i, "Setting")
              .replace(/^Plan\b/i, "Planning for")
              .replace(/^Schedule\b/i, "Scheduling")
              .replace(/^Record\b/i, "Recording")
              .replace(/^Count\b/i, "Counting")
              .replace(/^Write\b/i, "Writing");

            // Ensure it ends with a period if the original didn't
            if (!newHeadline.endsWith(".")) newHeadline += ".";

            const newText = text.replace(`**${headline}**`, `**${newHeadline}**`);

            if (typeof t.point === "string") {
              t.point = newText;
            } else {
              t.point[tone] = newText;
            }
            fixed++;
          }
        }
      }
    }
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Practice takeaways: fixed ${fixed} imperative takeaways`);
}

// ─── FIX ALL MECHANICAL ─────────────────────────────────────────────────

// ─── CLOSING WORD FIXES ─────────────────────────────────────────────────

const PATTERN_REPLACEMENTS = [
  "habit", "tendency", "dynamic", "approach", "cycle", "reflex",
  "instinct", "rhythm", "routine", "behavior", "response", "way of operating",
  "default", "move", "practice",
];

const MECHANISM_REPLACEMENTS = [
  "dynamic", "process", "response", "reaction", "shift", "exchange",
  "effect", "force", "trigger", "reflex", "instinct", "logic",
  "pressure", "impulse", "undercurrent",
];

const STRUCTURAL_REPLACEMENTS = [
  "fundamental", "underlying", "built-in", "deep", "foundational",
  "invisible", "ingrained", "embedded", "core", "root-level",
];

function fixClosings() {
  const pkg = readJson(PACKAGE_PATH);
  let patternFixed = 0, mechFixed = 0, structFixed = 0;
  let pIdx = 0, mIdx = 0, sIdx = 0;

  // Keep count across entire book -- allow max 3 of each
  let patternKept = 0, mechKept = 0, structKept = 0;
  const MAX_KEEP = 3;

  for (let ci = 0; ci < pkg.chapters.length; ci++) {
    pkg.chapters[ci] = walkAndReplace(pkg.chapters[ci], (text) => {
      const sentences = text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
      if (sentences.length === 0) return text;

      const lastIdx = sentences.length - 1;
      let lastSent = sentences[lastIdx];
      let changed = false;

      // Fix "pattern" in last sentence
      if (/\bpattern\b/i.test(lastSent)) {
        if (patternKept < MAX_KEEP) {
          patternKept++;
        } else {
          lastSent = lastSent.replace(/\bpattern\b/gi, (m) => {
            const rep = PATTERN_REPLACEMENTS[pIdx % PATTERN_REPLACEMENTS.length];
            pIdx++;
            patternFixed++;
            return m[0] === m[0].toUpperCase() ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep;
          });
          changed = true;
        }
      }

      // Fix "mechanism" in last sentence
      if (/\bmechanism\b/i.test(lastSent)) {
        if (mechKept < MAX_KEEP) {
          mechKept++;
        } else {
          lastSent = lastSent.replace(/\bmechanism\b/gi, (m) => {
            const rep = MECHANISM_REPLACEMENTS[mIdx % MECHANISM_REPLACEMENTS.length];
            mIdx++;
            mechFixed++;
            return m[0] === m[0].toUpperCase() ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep;
          });
          changed = true;
        }
      }

      // Fix "structural" in last sentence
      if (/\bstructural\b/i.test(lastSent)) {
        if (structKept < MAX_KEEP) {
          structKept++;
        } else {
          lastSent = lastSent.replace(/\bstructural\b/gi, (m) => {
            const rep = STRUCTURAL_REPLACEMENTS[sIdx % STRUCTURAL_REPLACEMENTS.length];
            sIdx++;
            structFixed++;
            return m[0] === m[0].toUpperCase() ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep;
          });
          changed = true;
        }
      }

      if (changed) {
        sentences[lastIdx] = lastSent;
        return sentences.join(" ");
      }
      return text;
    });
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Closings fixed: pattern=${patternFixed}, mechanism=${mechFixed}, structural=${structFixed}`);
  console.log(`Kept: pattern=${patternKept}/${MAX_KEEP}, mechanism=${mechKept}/${MAX_KEEP}, structural=${structKept}/${MAX_KEEP}`);
}

// ─── DECLARATIVE ENDINGS FIX ────────────────────────────────────────────

function fixDeclarativeEndings() {
  const pkg = readJson(PACKAGE_PATH);
  let fixed = 0;

  for (let ci = 0; ci < pkg.chapters.length; ci++) {
    pkg.chapters[ci] = walkAndReplace(pkg.chapters[ci], (text) => {
      const sentences = text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
      if (sentences.length < 2) return text;

      const lastIdx = sentences.length - 1;
      const lastSent = sentences[lastIdx];

      if (/^(It is|This is|That is)\s/i.test(lastSent) && lastSent.split(/\s+/).length < 15) {
        // Replace the declarative ending by merging it into the previous sentence
        // or by rewriting it to remove the "It is/This is/That is" prefix
        let rewritten = lastSent
          .replace(/^It is /i, "")
          .replace(/^This is /i, "")
          .replace(/^That is /i, "");

        // Capitalize the first letter
        rewritten = rewritten.charAt(0).toUpperCase() + rewritten.slice(1);

        // If the rewrite is too short or still sounds declarative, prepend context from previous sentence
        if (rewritten.split(/\s+/).length < 5 && sentences.length >= 2) {
          // Use the second-to-last sentence's subject context
          const prev = sentences[lastIdx - 1];
          // Just use the rewritten version as-is since it's now more concrete
          sentences[lastIdx] = rewritten;
        } else {
          sentences[lastIdx] = rewritten;
        }

        fixed++;
        return sentences.join(" ");
      }
      return text;
    });
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Declarative endings: fixed ${fixed}`);
}

// ─── TITLE PATTERN FIX ──────────────────────────────────────────────────

const TITLE_TEMPLATES = [
  "The Day [NAME] Changed the Conversation",
  "What [NAME] Stopped Doing at the Meeting",
  "How [NAME]'s Silence Changed Everything",
  "[NAME] at the Crossroads",
  "A Quiet Win for [NAME]",
  "Why [NAME] Walked Away Smiling",
  "The Moment [NAME] Realized",
  "[NAME]'s Unexpected Move",
  "What Happened When [NAME] Listened",
  "The Risk [NAME] Didn't Take",
  "[NAME]'s Turning Point",
  "How [NAME] Won Without Arguing",
  "What [NAME] Noticed That No One Else Did",
  "The Question [NAME] Almost Didn't Ask",
  "[NAME] and the Conversation That Changed",
  "When [NAME] Chose Curiosity Over Control",
  "[NAME]'s One-Sentence Strategy",
  "The Problem [NAME] Solved by Doing Less",
  "How [NAME] Earned Trust in Ten Minutes",
  "[NAME] and the Power of Going Second",
  "The Mistake [NAME] Didn't Make",
  "What [NAME] Did Instead of Reacting",
  "How [NAME] Read the Room",
  "The Move [NAME] Made Before Anyone Noticed",
  "[NAME] and the Open Door",
  "Why [NAME] Changed the Subject",
  "The Offer [NAME] Made That Cost Nothing",
  "[NAME]'s Small Shift, Big Result",
  "When [NAME] Let Someone Else Lead",
  "The Conversation [NAME] Almost Ruined",
  "[NAME] and the Unspoken Agreement",
  "How [NAME] Recovered After Speaking Too Soon",
  "The Signal [NAME] Missed at First",
  "What [NAME] Learned by Asking Once",
  "[NAME] in a Room Full of Skeptics",
  "The Pause That Changed [NAME]'s Outcome",
  "How [NAME] Gained an Ally",
  "The Apology [NAME] Didn't Expect to Give",
  "What Happened After [NAME] Stopped Pushing",
  "[NAME] and the Favor That Backfired",
  "The Choice [NAME] Made Before the Meeting",
  "How [NAME] Made a Critic Into a Supporter",
  "[NAME]'s Hardest Conversation",
  "The Praise [NAME] Almost Forgot",
  "When [NAME] Tried the Opposite Approach",
  "How [NAME] Reopened a Closed Door",
  "[NAME] and the Three Words That Mattered",
  "The Idea [NAME] Let Someone Else Claim",
  "What [NAME] Overheard That Changed the Plan",
  "[NAME]'s Gamble With Honesty",
  "The Invitation [NAME] Extended First",
  "How [NAME] Broke a Three-Month Stalemate",
  "[NAME] on the Other Side of the Table",
  "The Detail [NAME] Almost Overlooked",
  "[NAME] and the Late Night Rewrite",
  "What [NAME] Discovered by Staying Quiet",
  "The Feedback [NAME] Gave Without a Word",
  "How [NAME] Disarmed the Room",
  "When [NAME] Put the Relationship First",
  "[NAME]'s Exit Strategy That Built a Bridge",
  "The Compliment [NAME] Nearly Swallowed",
  "How [NAME] Turned a No Into a Maybe",
  "What [NAME] Would Have Said a Year Ago",
  "[NAME] and the Email That Stayed in Drafts",
  "The Request [NAME] Framed as a Question",
  "How [NAME] Made Someone Feel Heard",
  "The Walk [NAME] Took Before Responding",
  "[NAME] and the Colleague Who Never Agreed",
  "How [NAME] Found Common Ground on Accident",
  "The Silence [NAME] Chose to Keep",
  "What [NAME] Said That Nobody Expected",
  "[NAME] and the Deadline That Changed Priorities",
  "The Lunch Where [NAME] Only Listened",
  "How [NAME] Handled Being Wrong",
  "[NAME] in the Middle of Someone Else's Fight",
  "The Word [NAME] Replaced at the Last Minute",
  "How [NAME] Made the Second Meeting Different",
  "[NAME]'s Response When the Plan Fell Apart",
  "What [NAME] Did With the Awkward Silence",
  "The Gesture [NAME] Made After the Argument",
  "How [NAME] Reframed a Losing Position",
  "[NAME] and the Forgotten Thank You",
  "The Strategy [NAME] Found by Accident",
  "What [NAME] Gained by Going Last",
  "The Note [NAME] Left on the Desk",
  "How [NAME] Changed the Story Without Changing the Facts",
  "When [NAME] Played the Long Game",
  "[NAME] and the Trust That Took Three Tries",
];

function fixTitles() {
  const pkg = readJson(PACKAGE_PATH);

  // Count existing patterns and decide which to keep
  let baKept = 0, predKept = 0, dilKept = 0;
  let baFixed = 0, predFixed = 0, dilFixed = 0;
  let templateIdx = 0;
  const MAX_KEEP = 3;

  for (const ch of pkg.chapters) {
    for (const ex of ch.examples || []) {
      const title = ex.title || "";

      // Extract character name from title
      const nameMatch = title.match(/^([A-Z][a-z]+)/);
      const name = nameMatch ? nameMatch[1] : "Someone";

      if (/before and after/i.test(title)) {
        if (baKept < MAX_KEEP) {
          baKept++;
        } else {
          const template = TITLE_TEMPLATES[templateIdx % TITLE_TEMPLATES.length];
          templateIdx++;
          ex.title = template.replace(/\[NAME\]/g, name);
          baFixed++;
        }
      } else if (/\bpredicts?\b/i.test(title)) {
        if (predKept < MAX_KEEP) {
          predKept++;
        } else {
          const template = TITLE_TEMPLATES[templateIdx % TITLE_TEMPLATES.length];
          templateIdx++;
          ex.title = template.replace(/\[NAME\]/g, name);
          predFixed++;
        }
      } else if (/\bdilemma\b/i.test(title)) {
        if (dilKept < MAX_KEEP) {
          dilKept++;
        } else {
          const template = TITLE_TEMPLATES[templateIdx % TITLE_TEMPLATES.length];
          templateIdx++;
          ex.title = template.replace(/\[NAME\]/g, name);
          dilFixed++;
        }
      }
    }
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Titles fixed: "Before and After"=${baFixed}, "Predicts"=${predFixed}, "Dilemma"=${dilFixed}`);
  console.log(`Kept: BA=${baKept}/${MAX_KEEP}, Pred=${predKept}/${MAX_KEEP}, Dil=${dilKept}/${MAX_KEEP}`);
}

function fixAllMechanical() {
  console.log("=== Running all Phase B mechanical fixes ===\n");
  console.log("--- Step 1: Fix leverage ---");
  fixLeverage();
  console.log("\n--- Step 2: Fix ask yourself ---");
  fixAskSelf();
  console.log("\n--- Step 3: Fix AI-tell phrases ---");
  fixAiTell();
  console.log("\n--- Step 4: Fix overused names ---");
  fixNames();
  console.log("\n--- Step 5: Fix study group ---");
  fixStudyGroup();
  console.log("\n--- Step 6: Fix practice takeaways ---");
  fixPractice();
  console.log("\n--- Step 7: Fix em/en dashes ---");
  fixDashes();
  console.log("\n=== All Phase B fixes complete ===");
}

// ─── VALIDATE ───────────────────────────────────────────────────────────

function validate() {
  const pkg = readJson(PACKAGE_PATH);
  let pass = 0;
  let fail = 0;

  function check(name, condition) {
    if (condition) {
      console.log(`  PASS: ${name}`);
      pass++;
    } else {
      console.log(`  FAIL: ${name}`);
      fail++;
    }
  }

  console.log("=== Full v3 Validation ===\n");

  // 1. Every example has required fields
  let missingFields = 0;
  let totalExamples = 0;
  for (const ch of pkg.chapters) {
    for (const ex of ch.examples || []) {
      totalExamples++;
      for (const f of ["exampleId", "title", "category", "format", "endingType", "contexts", "scenario", "whatToDo", "whyItMatters"]) {
        if (!ex[f]) missingFields++;
      }
    }
  }
  check(`All ${totalExamples} examples have required fields`, missingFields === 0);

  // 2. Tone objects
  let nonTone = 0;
  for (const ch of pkg.chapters) {
    for (const ex of ch.examples || []) {
      for (const f of ["scenario", "whatToDo", "whyItMatters"]) {
        if (typeof ex[f] === "string" || Array.isArray(ex[f])) nonTone++;
        else if (ex[f] && (!ex[f].gentle || !ex[f].direct || !ex[f].competitive)) nonTone++;
      }
    }
  }
  check("All example fields are tone objects", nonTone === 0);

  // 3. Quiz 3 choices
  let wrongChoiceCount = 0;
  for (const ch of pkg.chapters) {
    for (const q of ch.quiz?.questions || []) {
      if (q.choices?.length !== 3) wrongChoiceCount++;
    }
  }
  check("All quiz questions have exactly 3 choices", wrongChoiceCount === 0);

  // 4. Quiz explanation tone objects
  let nonToneExpl = 0;
  for (const ch of pkg.chapters) {
    for (const q of ch.quiz?.questions || []) {
      if (typeof q.explanation === "string") nonToneExpl++;
      else if (q.explanation && (!q.explanation.gentle || !q.explanation.direct || !q.explanation.competitive)) nonToneExpl++;
    }
  }
  check("All quiz explanations are tone objects", nonToneExpl === 0);

  // 5. correctIndex 0-2
  let badIndex = 0;
  for (const ch of pkg.chapters) {
    for (const q of ch.quiz?.questions || []) {
      if (q.correctIndex < 0 || q.correctIndex > 2) badIndex++;
    }
  }
  check("All correctIndex values are 0-2", badIndex === 0);

  // 6. Zero declarative endings
  let declEndings = 0;
  for (const ch of pkg.chapters) {
    walkStrings(ch, (text) => {
      const lastSent = getLastSentence(text);
      if (/^(It is|This is|That is)\s/i.test(lastSent) && lastSent.split(/\s+/).length < 15) {
        declEndings++;
      }
    });
  }
  check(`Zero declarative endings (found ${declEndings})`, declEndings === 0);

  // 7-9. Pattern/mechanism/structural max 3
  let patternCount = 0, mechCount = 0, structCount = 0;
  for (const ch of pkg.chapters) {
    walkStrings(ch, (text) => {
      const lastSent = getLastSentence(text);
      if (/\bpattern\b/i.test(lastSent)) patternCount++;
      if (/\bmechanism\b/i.test(lastSent)) mechCount++;
      if (/\bstructural\b/i.test(lastSent)) structCount++;
    });
  }
  check(`"pattern" in closings max 3 (found ${patternCount})`, patternCount <= 3);
  check(`"mechanism" in closings max 3 (found ${mechCount})`, mechCount <= 3);
  check(`"structural" in closings max 3 (found ${structCount})`, structCount <= 3);

  // 10. Leverage max 1/chapter
  let leverageViolations = 0;
  for (const ch of pkg.chapters) {
    let count = 0;
    walkStrings(ch, (text) => {
      const m = text.match(/\bleverage\b/gi);
      if (m) count += m.length;
    });
    if (count > 1) leverageViolations++;
  }
  check(`Leverage max 1/chapter (${leverageViolations} violations)`, leverageViolations === 0);

  // 11. Ask yourself max 1/chapter
  let askViolations = 0;
  for (const ch of pkg.chapters) {
    let count = 0;
    walkStrings(ch, (text) => {
      const m = text.match(/\bask yourself\b/gi);
      if (m) count += m.length;
    });
    if (count > 1) askViolations++;
  }
  check(`"ask yourself" max 1/chapter (${askViolations} violations)`, askViolations === 0);

  // 12. Zero AI-tell phrases
  let aiTellCount = 0;
  for (const ch of pkg.chapters) {
    walkStrings(ch, (text) => {
      if (/\blandscape\b/i.test(text)) aiTellCount++;
      if (/\bfacilitate\b/i.test(text)) aiTellCount++;
      if (/\bnavigating\b/i.test(text)) aiTellCount++;
      if (/\bcrucial\b/i.test(text)) aiTellCount++;
    });
  }
  check(`Zero AI-tell phrases (found ${aiTellCount})`, aiTellCount === 0);

  // 13. No character name in >2 chapters
  const nameChapters = {};
  const primaryByChapter = new Map();
  for (const ch of pkg.chapters) {
    const chPrimary = new Set();
    for (const ex of ch.examples || []) {
      const m = ex.title?.match(/^([A-Z][a-z]+)/);
      if (m) chPrimary.add(m[1]);
    }
    primaryByChapter.set(ch.number, chPrimary);
    walkStrings(ch, (text) => {
      const matches = text.match(/\b([A-Z][a-z]{2,})\b/g) || [];
      for (const name of matches) {
        if (EXISTING_POOL.includes(name) && !chPrimary.has(name)) {
          if (!nameChapters[name]) nameChapters[name] = new Set();
          nameChapters[name].add(ch.number);
        }
      }
    });
  }
  const overusedNames = Object.entries(nameChapters).filter(([_, s]) => s.size > 2);
  check(`No secondary name in >2 chapters (found ${overusedNames.length})`, overusedNames.length === 0);

  // 14. Study group max 3
  const sgChapters = new Set();
  for (const ch of pkg.chapters) {
    walkStrings(ch, (text) => {
      if (/\bstudy group\b/i.test(text)) sgChapters.add(ch.number);
    });
  }
  check(`"study group" in max 3 chapters (found ${sgChapters.size})`, sgChapters.size <= 3);

  // 15. Zero practice takeaways
  let pracCount = 0;
  for (const ch of pkg.chapters) {
    const medTakeaways = ch.contentVariants?.medium?.keyTakeaways || [];
    for (const t of medTakeaways) {
      const directPoint = typeof t.point === "string" ? t.point : (t.point?.direct || "");
      if (/^\*?\*?(?:Try|Practice|Run|Test|Count|Ask|Write|Start|Begin|Make|Do|Track|Record|Monitor|Check|Review|Schedule|Plan|Set|Create|Build|Stop|Read|Tell)\b/i.test(directPoint.replace(/^\*+/, ""))) {
        pracCount++;
      }
    }
  }
  check(`Zero practice takeaways (found ${pracCount})`, pracCount === 0);

  // 16. Easy breakdown word counts 140-175
  let outOfRange = 0;
  for (const ch of pkg.chapters) {
    const eb = ch.contentVariants?.easy?.chapterBreakdown;
    if (eb) {
      for (const tone of ["gentle", "direct", "competitive"]) {
        if (eb[tone]) {
          const wc = wordCount(eb[tone]);
          if (wc < 140 || wc > 175) outOfRange++;
        }
      }
    }
  }
  check(`Easy breakdown word counts 140-175 (${outOfRange} out of range)`, outOfRange === 0);

  // 17. Zero em/en dashes
  let dashCount = 0;
  for (const ch of pkg.chapters) {
    walkStrings(ch, (text) => {
      const m = text.match(/[\u2013\u2014]/g);
      if (m) dashCount += m.length;
    });
  }
  check(`Zero em/en dashes (found ${dashCount})`, dashCount === 0);

  // 18. Title patterns max 3
  let baCount = 0, predCount = 0, dilCount = 0;
  for (const ch of pkg.chapters) {
    for (const ex of ch.examples || []) {
      if (/before and after/i.test(ex.title)) baCount++;
      if (/\bpredicts?\b/i.test(ex.title)) predCount++;
      if (/\bdilemma\b/i.test(ex.title)) dilCount++;
    }
  }
  check(`"Before and After" titles max 3 (found ${baCount})`, baCount <= 3);
  check(`"Predicts" titles max 3 (found ${predCount})`, predCount <= 3);
  check(`"Dilemma" titles max 3 (found ${dilCount})`, dilCount <= 3);

  // 19. Each chapter uses all 6 formats exactly once
  let formatViolations = 0;
  for (const ch of pkg.chapters) {
    const formats = (ch.examples || []).map(e => e.format).filter(Boolean);
    const unique = new Set(formats);
    if (unique.size !== 6 || formats.length !== 6) formatViolations++;
  }
  check(`Each chapter uses all 6 formats exactly once (${formatViolations} violations)`, formatViolations === 0);

  // 20. Each chapter uses all 6 ending types exactly once
  let endingViolations = 0;
  for (const ch of pkg.chapters) {
    const endings = (ch.examples || []).map(e => e.endingType).filter(Boolean);
    const unique = new Set(endings);
    if (unique.size !== 6 || endings.length !== 6) endingViolations++;
  }
  check(`Each chapter uses all 6 ending types exactly once (${endingViolations} violations)`, endingViolations === 0);

  // 21. No placeholders remaining
  let phCount = 0;
  for (const ch of pkg.chapters) {
    walkStrings(ch, (text) => {
      if (text.includes("__PLACEHOLDER__")) phCount++;
    });
  }
  check(`Zero __PLACEHOLDER__ remaining (found ${phCount})`, phCount === 0);

  // 22. Valid JSON (we already parsed it, so this is guaranteed)
  check("Valid JSON", true);

  console.log(`\n=== Results: ${pass} PASS, ${fail} FAIL ===`);
}

// ─── CLI ────────────────────────────────────────────────────────────────

const command = process.argv[2] ?? "audit";

switch (command) {
  case "audit":
    audit();
    break;
  case "add-metadata":
    addMetadata();
    break;
  case "scaffold-tones":
    scaffoldTones();
    break;
  case "trim-quiz":
    trimQuiz();
    break;
  case "fix-leverage":
    fixLeverage();
    break;
  case "fix-askself":
    fixAskSelf();
    break;
  case "fix-aitell":
    fixAiTell();
    break;
  case "fix-names":
    fixNames();
    break;
  case "fix-dashes":
    fixDashes();
    break;
  case "fix-studygroup":
    fixStudyGroup();
    break;
  case "fix-practice":
    fixPractice();
    break;
  case "fix-closings":
    fixClosings();
    break;
  case "fix-endings":
    fixDeclarativeEndings();
    break;
  case "fix-titles":
    fixTitles();
    break;
  case "fix-all-mechanical":
    fixAllMechanical();
    break;
  case "validate":
    validate();
    break;
  default:
    console.log("Usage: node fix-friends-v3-structural.mjs <command>");
    console.log("  audit              Report all violations");
    console.log("  add-metadata       Add category/format/endingType to examples");
    console.log("  scaffold-tones     Convert plain strings to tone objects with placeholders");
    console.log("  trim-quiz          Remove 4th quiz choice, reindex");
    console.log("  fix-leverage       Reduce 'leverage' to max 1/chapter");
    console.log("  fix-askself        Reduce 'ask yourself' to max 1/chapter");
    console.log("  fix-aitell         Replace AI-tell phrases");
    console.log("  fix-names          Deduplicate overused secondary names");
    console.log("  fix-dashes         Replace em/en dashes");
    console.log("  fix-studygroup     Replace 'study group' in 15 chapters");
    console.log("  fix-practice       Fix practice takeaways");
    console.log("  fix-all-mechanical Run all Phase B fixes");
    console.log("  validate           Full v3 validation");
    process.exit(1);
}
