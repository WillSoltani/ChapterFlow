#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, "book-packages", "the-48-laws-of-power.modern.json");

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

// ─── NAME POOL ──────────────────────────────────────────────────────────

const EXISTING_POOL = "Maya,Ethan,Priya,Marcus,Sofia,Kai,Nora,James,Leila,Andre,Yuki,Omar,Tessa,Davi,Aaliyah,Connor,Rosa,Kenji,Dante,Rina,Felix,Naomi,Tariq,Ivy,Mei,Zara,Liam,Amara,Samir,Elena,Hana,Derek,Celia,Riku,Asha,Nico,Petra,Idris,Quinn,Lena,Tomas,Suki,Mikhail,Bria,Kaden,Anika,Joel,Thea,Ravi,Luz,Emery,Camille,Soren,Dina,Grant,Yara,Paco,Iris,Malik,Freya,Theo,Alma,Jai,Nell,Amir,Sage,Rowan,Cleo,Benny,Vera,Hugo,Lia,Milo,Selena,Kira,Cruz,Maren,Tate,Ada,Obi,Nina,Leo,Farah,Wren,Dex,Sable,Remy,Gil,Zuri,Tala,Knox,Elise,Rio,Harlan,Pearl,Juno,Cole,Lyra,Siya,Finn,Esme,Atlas,Raina,Kit,Maeve,Bodhi,Lina,Zeke,Cora,Taj,Willa,Oren,Nadia,Bryn,Ezra,Simone,Beck,Anya,Gael,Tova,Ray,Mira,Otis,June,Ren,Daria,Axel,Sol,Nyla,Penn,Rue,Joss,Koa,Belen,Nash,Paloma,Eamon,Isla,Dane,Pia,Reed,Noelle,Kip,Lark".split(",");

// Fresh names NOT in the existing pool (diverse, realistic)
const FRESH_NAMES = [
  "Sana", "Kieran", "Liora", "Tobias", "Ingrid", "Jalen", "Celeste", "Arlo",
  "Anisa", "Mateo", "Yael", "Callum", "Rhea", "Navid", "Maren", "Joaquin",
  "Linnea", "Stefan", "Amina", "Kyler", "Tamsin", "Rohan", "Zoya", "Brennan",
  "Saskia", "Kian", "Elara", "Orion", "Talia", "Jensen", "Noor", "Colton",
  "Hadley", "Rafa", "Maisie", "Idara", "Tristan", "Leona", "Barrett", "Seraphina",
  "Elio", "Vivaan", "Chiara", "Declan", "Saoirse", "Anders", "Zaina", "Grady",
  "Valentina", "Caspian", "Odette", "Kaito", "Soleil", "Esteban", "Niamh", "Alaric",
  "Ines", "Theron", "Suki", "Holden", "Livia", "Emeric", "Kamala", "Dorian",
  "Vesper", "Reuel", "Adira", "Leif", "Winona", "Caius",
].filter((n) => !EXISTING_POOL.includes(n));

// ─── LEVERAGE SYNONYMS ──────────────────────────────────────────────────

const LEVERAGE_SYNONYMS = [
  "advantage", "influence", "power", "position", "upper hand", "edge",
  "bargaining power", "hold", "sway", "pull", "weight", "authority",
];

// ─── GENTLE OPENER REPLACEMENTS ─────────────────────────────────────────

const GENTLE_OPENERS = [
  "One thing that tends to go unnoticed is",
  "You might have experienced this without naming it:",
  "The part most people skip past is",
  "It helps to picture this from the other side.",
  "A quiet but important detail here is",
  "Something shifts when you slow down and notice",
  "What often goes unspoken in these situations is",
  "You may recognize this feeling without knowing its name.",
  "The overlooked part of this idea is",
  "There is a reason this principle catches people off guard.",
  "Most people feel this before they can name it.",
  "This idea becomes clearer when you flip it around.",
  "The part that deserves more attention is",
  "A small detail changes the entire picture here.",
  "What makes this principle stick is something subtle.",
  "You have probably seen this play out without realizing it.",
  "The quiet version of this principle is the one that matters most.",
  "If you pause on this idea, something unexpected emerges.",
  "The reason this sticks with people is rarely the obvious one.",
  "A different angle on this makes it click.",
  "This is one of those ideas that looks simple on the surface.",
  "Something counterintuitive is hiding in this principle.",
  "When you sit with this idea, the layers start to show.",
  "Most people encounter this principle backward.",
  "The emotional logic here runs deeper than the strategic logic.",
  "If you have ever felt uneasy about a win, this is why.",
  "The surprise is not in the principle itself but in how often it applies.",
  "You already know this instinctively, even if you have never framed it this way.",
  "A small shift in perspective transforms this idea completely.",
  "There is a gentler reading of this principle that changes everything.",
  "The human side of this principle is where the real insight lives.",
  "What catches people off guard is not the idea but the timing.",
  "This principle works because it touches something universal.",
  "The emotional core of this idea is simpler than it seems.",
  "When you slow down, you notice the principle was always there.",
  "A pattern starts to emerge once you pay attention.",
  "The first time you see this clearly, it changes how you read every room.",
  "There is a version of this principle that even kind people can use.",
  "You will likely recognize this from your own experience.",
  "What gives this idea its power is its invisibility.",
  "The warmth in this principle comes from understanding, not manipulation.",
  "Something about this idea makes people uncomfortable, and that discomfort is informative.",
  "If you look at your own past decisions, this principle was probably already at work.",
  "The hardest part of this idea is accepting how often you have missed it.",
  "This is not a cold principle. It works because it respects how people actually feel.",
  "The reason this matters is more personal than strategic.",
  "Once you name this pattern, you start seeing it everywhere.",
  "There is a compassionate way to apply this principle, and it usually works better.",
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

// ─── COMMANDS ───────────────────────────────────────────────────────────

function audit() {
  const pkg = readJson(PACKAGE_PATH);
  const results = {
    leverage: { total: 0, byChapter: {} },
    names: {},
    gentleOpener: { total: 0, chapters: [] },
    askSelf: { total: 0, byChapter: {}, chaptersOver1: [] },
    declarativeEndings: { total: 0, byChapter: {} },
    studyGroup: { total: 0, chapters: [] },
    dialogueWithoutDialogue: { total: 0, chapters: [] },
    practiceTakeaways: [],
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

    walkStrings(ch, (text, fieldPath) => {
      // Leverage
      const leverageMatches = text.match(/\bleverage\b/gi);
      if (leverageMatches) leverageCount += leverageMatches.length;

      // Gentle opener
      if (/here['']?s something worth sitting with|here is something worth sitting with/i.test(text)) {
        results.gentleOpener.total++;
        if (!results.gentleOpener.chapters.includes(ch.number)) {
          results.gentleOpener.chapters.push(ch.number);
        }
      }

      // Ask yourself
      const askMatches = text.match(/\bask yourself\b/gi);
      if (askMatches) askSelfCount += askMatches.length;

      // Declarative endings
      const lastSent = getLastSentence(text);
      if (/^(It is|This is|That is)\s/i.test(lastSent) && lastSent.split(/\s+/).length < 15) {
        declarativeCount++;
      }

      // Study group
      if (/\bstudy group\b/i.test(text) && !results.studyGroup.chapters.includes(ch.number)) {
        results.studyGroup.chapters.push(ch.number);
      }

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

    // Dialogue without dialogue
    for (const ex of ch.examples || []) {
      if (ex.format === "dialogue") {
        const scenarioText = typeof ex.scenario === "string" ? ex.scenario :
          (ex.scenario?.direct || ex.scenario?.gentle || "");
        const quoteMatches = scenarioText.match(/['"][^'"]{5,}['"]/g) || [];
        if (quoteMatches.length < 3) {
          results.dialogueWithoutDialogue.total++;
          results.dialogueWithoutDialogue.chapters.push(ch.number);
        }
      }
    }

    // Practice takeaways
    const medTakeaways = ch.contentVariants?.medium?.keyTakeaways || [];
    for (const [i, t] of medTakeaways.entries()) {
      const directPoint = typeof t.point === "string" ? t.point : (t.point?.direct || "");
      if (/^\*?\*?(?:Try|Practice|Run|Test|Count|Ask|Write|Start|Begin|Make|Do|Track|Record|Monitor|Check|Review|Schedule|Plan|Set|Create|Build)\b/i.test(directPoint.replace(/^\*+/, ""))) {
        results.practiceTakeaways.push({
          chapter: ch.number,
          index: i,
          text: directPoint.slice(0, 100),
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

  console.log("=== 48 Laws v3 Compliance Audit ===\n");

  console.log(`LEVERAGE: ${results.leverage.total} total`);
  const topLev = Object.entries(results.leverage.byChapter).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [ch, count] of topLev) console.log(`  Ch${ch}: ${count}`);

  console.log(`\nOVERUSED NAMES (>2 chapters):`);
  for (const [name, info] of Object.entries(overusedNames).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  ${name}: ${info.count} chapters [${info.chapters.join(", ")}]`);
  }

  console.log(`\nGENTLE OPENER ("here's something worth sitting with"): ${results.gentleOpener.total}`);
  console.log(`  In chapters: [${results.gentleOpener.chapters.join(", ")}]`);

  console.log(`\nASK YOURSELF: ${results.askSelf.total} total, ${results.askSelf.chaptersOver1.length} chapters with 2+`);

  console.log(`\nDECLARATIVE ENDINGS ("It is/This is/That is"): ${results.declarativeEndings.total} total`);

  console.log(`\nSTUDY GROUP: ${results.studyGroup.chapters.length} chapters`);

  console.log(`\nDIALOGUE WITHOUT DIALOGUE: ${results.dialogueWithoutDialogue.total} chapters`);

  console.log(`\nPRACTICE TAKEAWAYS: ${results.practiceTakeaways.length}`);
  for (const pt of results.practiceTakeaways) {
    console.log(`  Ch${zeroPad(pt.chapter)} med[${pt.index}]: ${pt.text}`);
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

      // Replace in all string fields of this chapter
      const regex = new RegExp(`\\b${name}\\b`, "g");
      pkg.chapters[chIdx] = walkAndReplace(pkg.chapters[chIdx], (text) => {
        return text.replace(regex, replacement);
      });

      totalReplacements++;
    }

    console.log(`${name}: kept in Ch[${[...keep].join(",")}], replaced in ${replaceIn.length} chapters`);
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`\nTotal chapter-level replacements: ${totalReplacements}`);
  console.log("Written to", PACKAGE_PATH);
}

function fixLeverage() {
  const pkg = readJson(PACKAGE_PATH);
  let totalRemoved = 0;

  for (const ch of pkg.chapters) {
    let chapterCount = 0;
    const synIndex = ch.number % LEVERAGE_SYNONYMS.length;

    pkg.chapters[pkg.chapters.indexOf(ch)] = walkAndReplace(ch, (text) => {
      return text.replace(/\bleverage\b/gi, (match) => {
        chapterCount++;
        if (chapterCount === 1) return match; // Keep first occurrence
        totalRemoved++;
        // Rotate through synonyms based on occurrence number
        const syn = LEVERAGE_SYNONYMS[(synIndex + chapterCount) % LEVERAGE_SYNONYMS.length];
        // Preserve capitalization
        if (match[0] === match[0].toUpperCase()) {
          return syn.charAt(0).toUpperCase() + syn.slice(1);
        }
        return syn;
      });
    });
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Leverage: removed ${totalRemoved} occurrences (kept 1 per chapter max)`);
}

function fixOpeners() {
  const pkg = readJson(PACKAGE_PATH);
  let replaced = 0;
  let openerIdx = 0;

  for (const ch of pkg.chapters) {
    pkg.chapters[pkg.chapters.indexOf(ch)] = walkAndReplace(ch, (text, fieldPath) => {
      if (!fieldPath.includes("gentle")) return text;
      const pattern = /here[''\u2019]s something worth sitting with[.:,]?\s?|here is something worth sitting with[.:,]?\s?/gi;
      if (pattern.test(text)) {
        const replacement = GENTLE_OPENERS[openerIdx % GENTLE_OPENERS.length];
        openerIdx++;
        replaced++;
        return text.replace(pattern, replacement + " ");
      }
      return text;
    });
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Gentle openers: replaced ${replaced} occurrences with unique alternatives`);
}

function fixAskSelf() {
  const pkg = readJson(PACKAGE_PATH);
  let totalRemoved = 0;

  for (const ch of pkg.chapters) {
    let chapterCount = 0;
    let altIdx = ch.number % ASK_SELF_ALTS.length;

    pkg.chapters[pkg.chapters.indexOf(ch)] = walkAndReplace(ch, (text) => {
      return text.replace(/\bask yourself\b/gi, (match) => {
        chapterCount++;
        if (chapterCount === 1) return match; // Keep first
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

function fixAll() {
  console.log("=== Running all scripted fixes ===\n");
  console.log("--- Step 1: Name deduplication ---");
  fixNames();
  console.log("\n--- Step 2: Leverage reduction ---");
  fixLeverage();
  console.log("\n--- Step 3: Gentle opener elimination ---");
  fixOpeners();
  console.log("\n--- Step 4: Ask yourself reduction ---");
  fixAskSelf();
  console.log("\n=== All scripted fixes complete ===");
  console.log("Remaining fixes (declarative endings, dialogue, study groups, titles, practice takeaways) require direct content rewriting.");
}

// ─── CLI ────────────────────────────────────────────────────────────────

const command = process.argv[2] ?? "audit";

switch (command) {
  case "audit":
    audit();
    break;
  case "fix-names":
    fixNames();
    break;
  case "fix-leverage":
    fixLeverage();
    break;
  case "fix-openers":
    fixOpeners();
    break;
  case "fix-askself":
    fixAskSelf();
    break;
  case "fix-all":
    fixAll();
    break;
  case "validate":
    audit(); // For now, audit serves as validation
    break;
  default:
    console.log("Usage: node fix-48-laws-v3-compliance.mjs <command>");
    console.log("  audit        Report all violations");
    console.log("  fix-names    Deduplicate secondary character names");
    console.log("  fix-leverage Reduce 'leverage' to max 1/chapter");
    console.log("  fix-openers  Eliminate 'Here's something worth sitting with'");
    console.log("  fix-askself  Reduce 'ask yourself' to max 1/chapter");
    console.log("  fix-all      Run all scripted fixes in order");
    console.log("  validate     Full validation check");
    process.exit(1);
}
