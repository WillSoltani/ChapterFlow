#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, "book-packages", "friends-and-influence.modern.json");
const BATCH_DIR = path.join(ROOT, "scripts", "book", "batches");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

// ─── EXTRACT BATCH ──────────────────────────────────────────────────────

function extractBatch(startChapter, endChapter) {
  const pkg = readJson(PACKAGE_PATH);

  if (!fs.existsSync(BATCH_DIR)) fs.mkdirSync(BATCH_DIR, { recursive: true });

  const batch = {
    batchId: `batch-ch${startChapter}-${endChapter}`,
    chapterRange: [startChapter, endChapter],
    examples: [],
    quizExplanations: [],
  };

  for (const ch of pkg.chapters) {
    if (ch.number < startChapter || ch.number > endChapter) continue;

    for (let i = 0; i < (ch.examples || []).length; i++) {
      const ex = ch.examples[i];
      const entry = {
        chapterNumber: ch.number,
        exampleIndex: i,
        exampleId: ex.exampleId,
        title: ex.title,
        category: ex.category,
        format: ex.format,
        fields: {},
      };

      // Include fields that have placeholders
      for (const field of ["scenario", "whatToDo", "whyItMatters"]) {
        if (ex[field] && typeof ex[field] === "object") {
          const needsGentle = ex[field].gentle === "__PLACEHOLDER__";
          const needsCompetitive = ex[field].competitive === "__PLACEHOLDER__";
          if (needsGentle || needsCompetitive) {
            entry.fields[field] = { direct: ex[field].direct };
          }
        }
      }

      if (Object.keys(entry.fields).length > 0) {
        batch.examples.push(entry);
      }
    }

    for (let i = 0; i < (ch.quiz?.questions || []).length; i++) {
      const q = ch.quiz.questions[i];
      if (q.explanation && typeof q.explanation === "object") {
        const needsGentle = q.explanation.gentle === "__PLACEHOLDER__";
        const needsCompetitive = q.explanation.competitive === "__PLACEHOLDER__";
        if (needsGentle || needsCompetitive) {
          batch.quizExplanations.push({
            chapterNumber: ch.number,
            questionIndex: i,
            questionId: q.questionId,
            prompt: q.prompt,
            correctChoice: q.choices[q.correctIndex],
            explanation: { direct: q.explanation.direct },
          });
        }
      }
    }
  }

  const outPath = path.join(BATCH_DIR, `${batch.batchId}-input.json`);
  writeJson(outPath, batch);
  console.log(`Extracted batch: ${batch.examples.length} examples, ${batch.quizExplanations.length} quiz explanations`);
  console.log(`Written to: ${outPath}`);
  return outPath;
}

// ─── APPLY BATCH ────────────────────────────────────────────────────────

function applyBatch(batchPath) {
  const pkg = readJson(PACKAGE_PATH);
  const batch = readJson(batchPath);
  let applied = { examples: 0, quiz: 0 };

  // Build lookup maps
  const exampleMap = new Map();
  for (const item of batch.examples || []) {
    exampleMap.set(`${item.chapterNumber}-${item.exampleIndex}`, item);
  }

  const quizMap = new Map();
  for (const item of batch.quizExplanations || []) {
    quizMap.set(`${item.chapterNumber}-${item.questionIndex}`, item);
  }

  for (const ch of pkg.chapters) {
    // Apply example tone expansions
    for (let i = 0; i < (ch.examples || []).length; i++) {
      const key = `${ch.number}-${i}`;
      const batchItem = exampleMap.get(key);
      if (!batchItem) continue;

      for (const field of ["scenario", "whatToDo", "whyItMatters"]) {
        if (batchItem.fields?.[field]) {
          const ex = ch.examples[i];
          if (ex[field] && typeof ex[field] === "object") {
            if (batchItem.fields[field].gentle) {
              ex[field].gentle = batchItem.fields[field].gentle;
            }
            if (batchItem.fields[field].competitive) {
              ex[field].competitive = batchItem.fields[field].competitive;
            }
          }
        }
      }

      // Apply title fix if present
      if (batchItem.title && batchItem.title !== ch.examples[i].title) {
        ch.examples[i].title = batchItem.title;
      }

      applied.examples++;
    }

    // Apply quiz explanation tone expansions
    for (let i = 0; i < (ch.quiz?.questions || []).length; i++) {
      const key = `${ch.number}-${i}`;
      const batchItem = quizMap.get(key);
      if (!batchItem) continue;

      const q = ch.quiz.questions[i];
      if (q.explanation && typeof q.explanation === "object") {
        if (batchItem.explanation?.gentle) {
          q.explanation.gentle = batchItem.explanation.gentle;
        }
        if (batchItem.explanation?.competitive) {
          q.explanation.competitive = batchItem.explanation.competitive;
        }
      }

      applied.quiz++;
    }
  }

  writeJson(PACKAGE_PATH, pkg);
  console.log(`Applied: ${applied.examples} examples, ${applied.quiz} quiz explanations`);
}

// ─── STATUS ─────────────────────────────────────────────────────────────

function status() {
  const pkg = readJson(PACKAGE_PATH);
  let totalPlaceholders = 0;
  const byChapter = {};

  for (const ch of pkg.chapters) {
    let chCount = 0;

    for (const ex of ch.examples || []) {
      for (const field of ["scenario", "whatToDo", "whyItMatters"]) {
        if (ex[field] && typeof ex[field] === "object") {
          if (ex[field].gentle === "__PLACEHOLDER__") chCount++;
          if (ex[field].competitive === "__PLACEHOLDER__") chCount++;
        }
      }
    }

    for (const q of ch.quiz?.questions || []) {
      if (q.explanation && typeof q.explanation === "object") {
        if (q.explanation.gentle === "__PLACEHOLDER__") chCount++;
        if (q.explanation.competitive === "__PLACEHOLDER__") chCount++;
      }
    }

    if (chCount > 0) {
      byChapter[ch.number] = chCount;
      totalPlaceholders += chCount;
    }
  }

  console.log(`Total __PLACEHOLDER__: ${totalPlaceholders}`);
  console.log(`Chapters remaining: ${Object.keys(byChapter).length}`);
  for (const [ch, count] of Object.entries(byChapter)) {
    console.log(`  Ch${String(ch).padStart(2, "0")}: ${count} placeholders`);
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────

const command = process.argv[2] ?? "status";
const args = process.argv.slice(3);

switch (command) {
  case "extract-batch": {
    const start = parseInt(args[0], 10);
    const end = parseInt(args[1], 10);
    if (!start || !end) {
      console.log("Usage: extract-batch <start> <end>");
      process.exit(1);
    }
    extractBatch(start, end);
    break;
  }
  case "apply-batch": {
    if (!args[0]) {
      console.log("Usage: apply-batch <path-to-batch-result.json>");
      process.exit(1);
    }
    applyBatch(args[0]);
    break;
  }
  case "status":
    status();
    break;
  default:
    console.log("Usage: node fix-friends-v3-tone-expand.mjs <command>");
    console.log("  extract-batch <start> <end>  Extract chapters for agent processing");
    console.log("  apply-batch <file>           Apply completed batch to master JSON");
    console.log("  status                       Show remaining placeholders");
    process.exit(1);
}
