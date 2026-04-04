#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, "book-packages", "laws-of-human-nature.modern.json");
const BATCH_DIR = path.join(ROOT, "scripts", "book", "batches");

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

function getFieldByPath(obj, dotPath) {
  const parts = dotPath.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = Array.isArray(cur) ? cur[Number(p)] : cur[p];
  }
  return cur;
}

function setFieldByPath(obj, dotPath, value) {
  const parts = dotPath.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    cur = Array.isArray(cur) ? cur[Number(p)] : cur[p];
  }
  const lastPart = parts[parts.length - 1];
  if (Array.isArray(cur)) {
    cur[Number(lastPart)] = value;
  } else {
    cur[lastPart] = value;
  }
}

function wordCount(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

// ─── STEP 9: DECLARATIVE ENDINGS ────────────────────────────────────────

function extractDeclarative() {
  const pkg = readJson(PACKAGE_PATH);
  const batches = { 1: [], 2: [], 3: [] };

  let idCounter = 0;
  for (const ch of pkg.chapters) {
    const batchNum = ch.number <= 6 ? 1 : ch.number <= 12 ? 2 : 3;

    walkStrings(ch, (text, fieldPath) => {
      const lastSent = getLastSentence(text);
      if (/^(It is|This is|That is)\s/i.test(lastSent) && lastSent.split(/\s+/).length < 15) {
        const contextStart = Math.max(0, text.length - lastSent.length - 200);
        idCounter++;
        batches[batchNum].push({
          id: `s9-${String(idCounter).padStart(3, "0")}`,
          chapter: ch.number,
          fieldPath: `chapters.${pkg.chapters.indexOf(ch)}.${fieldPath}`,
          tone: fieldPath.match(/\.(gentle|direct|competitive)$/)?.[1] || "none",
          lastSentence: lastSent,
          contextPreview: text.slice(contextStart, text.length - lastSent.length).trim().slice(-200),
          replacement: "",
        });
      }
    });
  }

  for (const [num, items] of Object.entries(batches)) {
    const outPath = path.join(BATCH_DIR, `laws-s9-batch-${num}-input.json`);
    writeJson(outPath, { batchId: `laws-s9-batch-${num}`, items });
    console.log(`Batch ${num}: ${items.length} entries -> ${outPath}`);
  }
  console.log(`Total: ${idCounter} declarative endings extracted`);
}

function applyDeclarative() {
  const pkg = readJson(PACKAGE_PATH);
  let applied = 0, skipped = 0;

  for (let num = 1; num <= 3; num++) {
    const batchPath = path.join(BATCH_DIR, `laws-s9-batch-${num}-input.json`);
    if (!fs.existsSync(batchPath)) continue;
    const batch = readJson(batchPath);

    for (const item of batch.items) {
      if (!item.replacement) { skipped++; continue; }
      const currentText = getFieldByPath(pkg, item.fieldPath);
      if (typeof currentText !== "string") { skipped++; continue; }

      // Find and replace the last sentence
      const idx = currentText.lastIndexOf(item.lastSentence);
      if (idx === -1) { skipped++; continue; }

      const newText = currentText.slice(0, idx) + item.replacement;
      setFieldByPath(pkg, item.fieldPath, newText);
      applied++;
    }
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Declarative endings: applied ${applied}, skipped ${skipped}`);
}

function verifyDeclarative() {
  const pkg = readJson(PACKAGE_PATH);
  let count = 0;

  for (const ch of pkg.chapters) {
    walkStrings(ch, (text) => {
      const lastSent = getLastSentence(text);
      if (/^(It is|This is|That is)\s/i.test(lastSent) && lastSent.split(/\s+/).length < 15) {
        count++;
      }
    });
  }

  console.log(`Declarative endings remaining: ${count} (target: 0)`);
  if (count > 0) process.exit(1);
}

// ─── STEP 10: VOCABULARY CLOSINGS ───────────────────────────────────────

function extractVocabulary() {
  const pkg = readJson(PACKAGE_PATH);
  const batches = { 1: [], 2: [], 3: [] };

  let idCounter = 0;
  for (const ch of pkg.chapters) {
    const batchNum = ch.number <= 6 ? 1 : ch.number <= 12 ? 2 : 3;

    walkStrings(ch, (text, fieldPath) => {
      const lastSent = getLastSentence(text);
      const keywords = [];
      if (/\bstructural\b/i.test(lastSent)) keywords.push("structural");
      if (/\bpattern\b/i.test(lastSent)) keywords.push("pattern");
      if (/\bmechanism\b/i.test(lastSent)) keywords.push("mechanism");

      if (keywords.length > 0) {
        const contextStart = Math.max(0, text.length - lastSent.length - 200);
        idCounter++;
        batches[batchNum].push({
          id: `s10-${String(idCounter).padStart(3, "0")}`,
          chapter: ch.number,
          fieldPath: `chapters.${pkg.chapters.indexOf(ch)}.${fieldPath}`,
          tone: fieldPath.match(/\.(gentle|direct|competitive)$/)?.[1] || "none",
          keywords,
          lastSentence: lastSent,
          contextPreview: text.slice(contextStart, text.length - lastSent.length).trim().slice(-200),
          replacement: "",
          keep: false,
        });
      }
    });
  }

  for (const [num, items] of Object.entries(batches)) {
    const outPath = path.join(BATCH_DIR, `laws-s10-batch-${num}-input.json`);
    writeJson(outPath, { batchId: `laws-s10-batch-${num}`, items });
    console.log(`Batch ${num}: ${items.length} entries -> ${outPath}`);
  }
  console.log(`Total: ${idCounter} vocabulary closings extracted`);
}

function applyVocabulary() {
  const pkg = readJson(PACKAGE_PATH);
  let applied = 0, kept = 0, skipped = 0;

  for (let num = 1; num <= 3; num++) {
    const batchPath = path.join(BATCH_DIR, `laws-s10-batch-${num}-input.json`);
    if (!fs.existsSync(batchPath)) continue;
    const batch = readJson(batchPath);

    for (const item of batch.items) {
      if (item.keep) { kept++; continue; }
      if (!item.replacement) { skipped++; continue; }
      const currentText = getFieldByPath(pkg, item.fieldPath);
      if (typeof currentText !== "string") { skipped++; continue; }

      const idx = currentText.lastIndexOf(item.lastSentence);
      if (idx === -1) { skipped++; continue; }

      const newText = currentText.slice(0, idx) + item.replacement;
      setFieldByPath(pkg, item.fieldPath, newText);
      applied++;
    }
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Vocabulary closings: applied ${applied}, kept ${kept}, skipped ${skipped}`);
}

function verifyVocabulary() {
  const pkg = readJson(PACKAGE_PATH);
  let structural = 0, pattern = 0, mechanism = 0;

  for (const ch of pkg.chapters) {
    walkStrings(ch, (text) => {
      const lastSent = getLastSentence(text);
      if (/\bstructural\b/i.test(lastSent)) structural++;
      if (/\bpattern\b/i.test(lastSent)) pattern++;
      if (/\bmechanism\b/i.test(lastSent)) mechanism++;
    });
  }

  console.log(`Vocabulary in closings: structural=${structural} pattern=${pattern} mechanism=${mechanism} (target: max 3 each)`);
  if (structural > 3 || pattern > 3 || mechanism > 3) process.exit(1);
}

// ─── STEP 11: DIALOGUE SCENARIOS ────────────────────────────────────────

const DIALOGUE_TARGETS = [
  { chapter: 4, title: "Petra" },
  { chapter: 10, title: "Naomi" },
  { chapter: 11, title: "Tom\u00e1s" },
  { chapter: 12, title: "Sage" },
  { chapter: 14, title: "Juno" },
  { chapter: 15, title: "Ravi" },
];

function extractDialogues() {
  const pkg = readJson(PACKAGE_PATH);
  const items = [];

  for (const target of DIALOGUE_TARGETS) {
    const ch = pkg.chapters.find(c => c.number === target.chapter);
    if (!ch) continue;

    const ex = (ch.examples || []).find(e =>
      e.format === "dialogue" && e.title?.includes(target.title)
    );
    if (!ex) {
      console.log(`  WARNING: No dialogue example with "${target.title}" in Ch${target.chapter}`);
      continue;
    }

    const exIdx = ch.examples.indexOf(ex);
    const chIdx = pkg.chapters.indexOf(ch);

    items.push({
      chapter: target.chapter,
      exampleIndex: exIdx,
      title: ex.title,
      category: ex.category,
      characterName: target.title,
      scenario: {
        gentle: ex.scenario?.gentle || "",
        direct: ex.scenario?.direct || "",
        competitive: ex.scenario?.competitive || "",
      },
      gentleQuoteCount: (ex.scenario?.gentle?.match(/['"][^'"]{5,}['"]/g) || []).length,
      directQuoteCount: (ex.scenario?.direct?.match(/['"][^'"]{5,}['"]/g) || []).length,
      competitiveQuoteCount: (ex.scenario?.competitive?.match(/['"][^'"]{5,}['"]/g) || []).length,
      gentleWordCount: wordCount(ex.scenario?.gentle || ""),
      directWordCount: wordCount(ex.scenario?.direct || ""),
      competitiveWordCount: wordCount(ex.scenario?.competitive || ""),
      replacements: {
        gentle: "",
        direct: "",
        competitive: "",
      },
    });
  }

  const outPath = path.join(BATCH_DIR, "laws-s11-input.json");
  writeJson(outPath, { batchId: "laws-s11-dialogues", items });
  console.log(`Extracted ${items.length} dialogue scenarios -> ${outPath}`);

  // Summary
  for (const item of items) {
    console.log(`  Ch${zeroPad(item.chapter)} "${item.title}":`);
    console.log(`    gentle: ${item.gentleQuoteCount} quotes, ${item.gentleWordCount} words`);
    console.log(`    direct: ${item.directQuoteCount} quotes, ${item.directWordCount} words`);
    console.log(`    competitive: ${item.competitiveQuoteCount} quotes, ${item.competitiveWordCount} words`);
  }
}

function applyDialogues() {
  const pkg = readJson(PACKAGE_PATH);
  let applied = 0;

  const batchPath = path.join(BATCH_DIR, "laws-s11-input.json");
  if (!fs.existsSync(batchPath)) {
    console.log("No batch file found. Run extract-dialogues first.");
    return;
  }
  const batch = readJson(batchPath);

  for (const item of batch.items) {
    const ch = pkg.chapters.find(c => c.number === item.chapter);
    if (!ch) continue;
    const ex = ch.examples[item.exampleIndex];
    if (!ex) continue;

    for (const tone of ["gentle", "direct", "competitive"]) {
      if (item.replacements[tone]) {
        ex.scenario[tone] = item.replacements[tone];
        applied++;
      }
    }
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Dialogue scenarios: applied ${applied} tone replacements`);
}

function verifyDialogues() {
  const pkg = readJson(PACKAGE_PATH);
  let issues = 0;

  for (const ch of pkg.chapters) {
    for (const ex of ch.examples || []) {
      if (ex.format !== "dialogue") continue;

      for (const tone of ["gentle", "direct", "competitive"]) {
        const text = ex.scenario?.[tone] || "";
        const quotes = text.match(/['"][^'"]{5,}['"]/g) || [];

        if (quotes.length < 3) {
          console.log(`  Ch${zeroPad(ch.number)} "${ex.title}" ${tone}: only ${quotes.length} quotes (need 3+)`);
          issues++;
        }
      }
    }
  }

  console.log(`\nDialogue quote issues: ${issues} (target: 0)`);
}

// ─── STEP 12: TITLE DIVERSIFICATION ────────────────────────────────────

function extractTitles() {
  const pkg = readJson(PACKAGE_PATH);
  const allTitles = [];
  const flagged = [];

  let possessiveCount = 0;
  let predictsCount = 0;
  let beforeAfterCount = 0;

  for (const ch of pkg.chapters) {
    for (const [i, ex] of (ch.examples || []).entries()) {
      const title = ex.title || "";
      const isPossessive = /^[A-Z][a-z]+'s\s/.test(title);
      const isPredicts = /\bpredicts?\b/i.test(title);
      const isBeforeAfter = /before and after/i.test(title);

      allTitles.push({
        chapter: ch.number,
        exampleIndex: i,
        title,
        isPossessive,
        isPredicts,
        isBeforeAfter,
      });

      if (isPossessive) possessiveCount++;
      if (isPredicts) predictsCount++;
      if (isBeforeAfter) beforeAfterCount++;
    }
  }

  // Determine which to flag for rewriting
  // Possessive: keep max 15, flag the rest (starting from end to preserve early chapters)
  let possessiveKept = 0;
  for (const t of allTitles) {
    if (t.isPossessive) {
      if (possessiveKept < 15) {
        possessiveKept++;
        t.keepPossessive = true;
      } else {
        t.keepPossessive = false;
      }
    }
  }

  // Predicts: keep first 3, flag rest
  let predictsKept = 0;
  for (const t of allTitles) {
    if (t.isPredicts) {
      if (predictsKept < 3) {
        predictsKept++;
        t.keepPredicts = true;
      } else {
        t.keepPredicts = false;
      }
    }
  }

  // Before and After: keep first 3, flag rest
  let baKept = 0;
  for (const t of allTitles) {
    if (t.isBeforeAfter) {
      if (baKept < 3) {
        baKept++;
        t.keepBA = true;
      } else {
        t.keepBA = false;
      }
    }
  }

  // Build flagged list
  for (const t of allTitles) {
    const reasons = [];
    if (t.isPossessive && !t.keepPossessive) reasons.push("possessive");
    if (t.isPredicts && !t.keepPredicts) reasons.push("predicts");
    if (t.isBeforeAfter && !t.keepBA) reasons.push("before_after");

    if (reasons.length > 0) {
      flagged.push({
        chapter: t.chapter,
        exampleIndex: t.exampleIndex,
        currentTitle: t.title,
        flagReasons: reasons,
        characterName: t.title.match(/^([A-Z][a-z]+)/)?.[1] || "",
        replacement: "",
      });
    }
  }

  const outPath = path.join(BATCH_DIR, "laws-s12-input.json");
  writeJson(outPath, {
    batchId: "laws-s12-titles",
    summary: {
      totalTitles: allTitles.length,
      possessive: { total: possessiveCount, toRewrite: possessiveCount - possessiveKept },
      predicts: { total: predictsCount, toRewrite: predictsCount - predictsKept },
      beforeAfter: { total: beforeAfterCount, toRewrite: beforeAfterCount - baKept },
    },
    allTitles: allTitles.map(t => ({ chapter: t.chapter, title: t.title })),
    flagged,
  });

  console.log(`Titles extracted -> ${outPath}`);
  console.log(`  Possessive: ${possessiveCount} total, ${possessiveCount - possessiveKept} to rewrite`);
  console.log(`  Predicts: ${predictsCount} total, ${predictsCount - predictsKept} to rewrite`);
  console.log(`  Before and After: ${beforeAfterCount} total, ${beforeAfterCount - baKept} to rewrite`);
  console.log(`  Total flagged: ${flagged.length}`);
}

function applyTitles() {
  const pkg = readJson(PACKAGE_PATH);
  let applied = 0;

  const batchPath = path.join(BATCH_DIR, "laws-s12-input.json");
  if (!fs.existsSync(batchPath)) {
    console.log("No batch file found. Run extract-titles first.");
    return;
  }
  const batch = readJson(batchPath);

  for (const item of batch.flagged) {
    if (!item.replacement) continue;
    const ch = pkg.chapters.find(c => c.number === item.chapter);
    if (!ch) continue;
    const ex = ch.examples[item.exampleIndex];
    if (!ex) continue;

    const oldTitle = ex.title;
    ex.title = item.replacement;
    applied++;

    // Also update any references to the old title in scenario/whatToDo/whyItMatters text
    // (title references are rare but possible in quiz prompts)
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Titles: applied ${applied} replacements`);
}

function verifyTitles() {
  const pkg = readJson(PACKAGE_PATH);
  let possessive = 0, predicts = 0, beforeAfter = 0;

  for (const ch of pkg.chapters) {
    for (const ex of ch.examples || []) {
      if (/^[A-Z][a-z]+'s\s/.test(ex.title)) possessive++;
      if (/\bpredicts?\b/i.test(ex.title)) predicts++;
      if (/before and after/i.test(ex.title)) beforeAfter++;
    }
  }

  console.log(`Title patterns: possessive=${possessive} (max 15), predicts=${predicts} (max 3), beforeAfter=${beforeAfter} (max 3)`);
  if (possessive > 15 || predicts > 3 || beforeAfter > 3) process.exit(1);
}

// ─── FULL AUDIT ────────────────────────────────────────────────────────

function audit() {
  console.log("=== Phase B Audit ===\n");
  console.log("--- Step 9: Declarative Endings ---");
  verifyDeclarative();
  console.log("\n--- Step 10: Vocabulary Closings ---");
  verifyVocabulary();
  console.log("\n--- Step 11: Dialogue Scenarios ---");
  verifyDialogues();
  console.log("\n--- Step 12: Titles ---");
  verifyTitles();
}

// ─── CLI ────────────────────────────────────────────────────────────────

const command = process.argv[2] ?? "audit";

switch (command) {
  case "extract-declarative":  extractDeclarative(); break;
  case "apply-declarative":    applyDeclarative(); break;
  case "verify-declarative":   verifyDeclarative(); break;

  case "extract-vocabulary":   extractVocabulary(); break;
  case "apply-vocabulary":     applyVocabulary(); break;
  case "verify-vocabulary":    verifyVocabulary(); break;

  case "extract-dialogues":    extractDialogues(); break;
  case "apply-dialogues":      applyDialogues(); break;
  case "verify-dialogues":     verifyDialogues(); break;

  case "extract-titles":       extractTitles(); break;
  case "apply-titles":         applyTitles(); break;
  case "verify-titles":        verifyTitles(); break;

  case "audit":                audit(); break;

  default:
    console.log("Usage: node fix-human-nature-v3-phase-b.mjs <command>");
    console.log("Commands:");
    console.log("  extract-declarative / apply-declarative / verify-declarative");
    console.log("  extract-vocabulary / apply-vocabulary / verify-vocabulary");
    console.log("  extract-dialogues / apply-dialogues / verify-dialogues");
    console.log("  extract-titles / apply-titles / verify-titles");
    console.log("  audit");
    process.exit(1);
}
