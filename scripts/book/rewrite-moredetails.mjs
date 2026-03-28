#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, "book-packages", "the-48-laws-of-power.modern.json");
const OUTPUT_PATH = path.join(ROOT, "book-packages", "the-48-laws-of-power.modern.patched.json");
const REPORT_PATH = path.join("/tmp", "48-laws-moredetails-audit.json");

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8192;

const BANNED_PHRASES = [
  "delve",
  "crucial",
  "landscape",
  "realm",
  "It's worth noting",
  "In today's world",
  "It's important to remember",
  "This highlights the importance of",
  "Furthermore",
  "Moreover",
  "In conclusion",
  "plays a pivotal role",
  "at its core",
  "the art of",
  "navigating",
  "harnessing",
  "game-changer",
  "paradigm shift",
  "robust",
  "synergy",
  "leverage",
  "facilitate",
  "utilize",
  "foster",
  "embark on",
  "a testament to",
  "shed light on",
  "This matters because",
  "This is significant because",
  "it is essential to",
];

const STOPWORDS = new Set([
  "The", "This", "That", "They", "What", "When", "Where", "Which", "While", "Why", "How",
  "Every", "Getting", "Being", "Having", "Making", "Taking", "Doing", "Going", "Coming",
  "Most", "Some", "Many", "Each", "Any", "All", "One", "Two", "Three", "People", "Someone",
]);

const FICTIONAL_VIGNETTE_PATTERNS = [
  /\b([A-Z][a-z]{2,})\s+(?:said|walked|noticed|sat|stood|looked|opened|picked|turned|glanced|leaned|paused|asked|replied|decided|grabbed|pulled|pushed|stared|sighed|nodded|shook|smiled|frowned|whispered|shouted)\b/,
];

function zeroPad(value) {
  return String(value).padStart(2, "0");
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveToneText(value, tone = "direct") {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if (typeof value[tone] === "string") return value[tone];
    for (const key of ["direct", "gentle", "competitive"]) {
      if (typeof value[key] === "string") return value[key];
    }
  }
  return "";
}

function ensureToneObject(value, pathLabel, issues) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(`${pathLabel} must be a tone object`);
    return false;
  }
  let ok = true;
  for (const tone of ["gentle", "direct", "competitive"]) {
    if (typeof value[tone] !== "string" || value[tone].trim().length === 0) {
      issues.push(`${pathLabel}.${tone} must be a non-empty string`);
      ok = false;
    }
  }
  return ok;
}

function countSentences(text) {
  return String(text)
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 5).length;
}

function hasBannedPhrase(text) {
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

function hasDashes(text) {
  return /[\u2014\u2013]/.test(text);
}

function hasFictionalVignette(text) {
  for (const pattern of FICTIONAL_VIGNETTE_PATTERNS) {
    const match = text.match(pattern);
    if (match && !STOPWORDS.has(match[1])) return true;
  }
  return false;
}

function stripTrailingCommas(text) {
  let next = text;
  while (true) {
    const candidate = next.replace(/,\s*([}\]])/g, "$1");
    if (candidate === next) return next;
    next = candidate;
  }
}

function tryParseJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function buildMissingClosers(text) {
  let inString = false;
  let escaped = false;
  const stack = [];

  for (const ch of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }

    if (ch === "}" || ch === "]") {
      stack.pop();
    }
  }

  return stack
    .reverse()
    .map((ch) => (ch === "{" ? "}" : "]"))
    .join("");
}

function repairJsonText(text) {
  let candidate = stripTrailingCommas(text);
  if (tryParseJson(candidate)) return candidate;

  const missingClosers = buildMissingClosers(candidate);
  if (missingClosers) {
    const withClosers = `${candidate}${missingClosers}`;
    if (tryParseJson(withClosers)) return withClosers;
  }

  return null;
}

function extractJsonFromResponse(text) {
  // Try direct parse first
  if (tryParseJson(text)) return JSON.parse(text);

  // Try extracting from code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    if (tryParseJson(inner)) return JSON.parse(inner);
    const repaired = repairJsonText(inner);
    if (repaired) return JSON.parse(repaired);
  }

  // Try finding array brackets
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    const inner = arrayMatch[0];
    if (tryParseJson(inner)) return JSON.parse(inner);
    const repaired = repairJsonText(inner);
    if (repaired) return JSON.parse(repaired);
  }

  // Last resort: repair raw text
  const repaired = repairJsonText(text);
  if (repaired) return JSON.parse(repaired);

  return null;
}

// ─── API ───────────────────────────────────────────────────────────────

async function callClaude(systemPrompt, userMessage, retries = 3) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
      });

      if (res.status === 429 || res.status >= 500) {
        const wait = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.warn(`  API ${res.status}, retrying in ${Math.round(wait / 1000)}s (attempt ${attempt}/${retries})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`API ${res.status}: ${body.slice(0, 300)}`);
      }

      const data = await res.json();
      return data.content?.[0]?.text ?? "";
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = Math.pow(2, attempt) * 1000;
      console.warn(`  Error: ${err.message}, retrying in ${Math.round(wait / 1000)}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

// ─── PROMPT ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You rewrite moreDetails for book chapter takeaways. Your output is ONLY a JSON array.

## What moreDetails should be

moreDetails is a CONCEPTUAL EXPANSION of the takeaway point. It deepens the "why" and "how" of the principle.

It should:
- Explain the mechanism, psychology, or logic behind the principle
- Add nuance: when does the principle apply vs. not apply, edge cases, common misunderstandings
- Reference real-world patterns, historical context, or research when relevant
- Be 3-5 sentences, accessible grade 9-10 prose, conversational voice
- Use "you" and "your" to address the reader directly
- Each sentence should tell the reader something they can act on or picture

It must NOT:
- Use fictional character names or vignettes (no "Sarah noticed..." or "Marcus decided...")
- Retell or reference any of the chapter's examples
- Read like a mini-scenario with a named person in a specific scene
- Use any of these banned phrases: ${BANNED_PHRASES.join(", ")}
- Use em dashes or en dashes (use commas, periods, or colons instead)

## Tone rules

Each moreDetails has three tone variants. They must be SUBSTANTIVELY different, not just adjective swaps:

- gentle: Warm, reflective, sit-with-it framing. "Here's something worth sitting with..."
- direct: Sharp, clinical, efficient. Facts and mechanisms. "The first battle is over meaning, not facts."
- competitive: Edge, advantage-seeking. "Most people argue the point. The person who reads the room first, wins."

## Output format

Output ONLY a valid JSON array. No markdown, no code fences, no explanatory text.

Each element:
{
  "depth": "medium" or "hard",
  "index": <integer, 0-based index of the takeaway>,
  "moreDetails": {
    "gentle": "<3-5 sentences>",
    "direct": "<3-5 sentences>",
    "competitive": "<3-5 sentences>"
  }
}`;

function buildUserMessage(chapter) {
  const nn = zeroPad(chapter.number);
  const medTakeaways = chapter.contentVariants?.medium?.keyTakeaways ?? [];
  const hardTakeaways = chapter.contentVariants?.hard?.keyTakeaways ?? [];

  // Get chapter breakdown for context
  const breakdown = resolveToneText(chapter.contentVariants?.medium?.chapterBreakdown, "direct");

  let msg = `# Chapter ${chapter.number}: ${chapter.title}\n\n`;
  msg += `## Chapter Context\n${breakdown.slice(0, 1500)}\n\n`;

  msg += `## Medium Takeaways (rewrite moreDetails for each)\n\n`;
  for (const [i, t] of medTakeaways.entries()) {
    if (!t.moreDetails) continue;
    msg += `### medium[${i}]\n`;
    msg += `Point (gentle): ${resolveToneText(t.point, "gentle").slice(0, 300)}\n`;
    msg += `Point (direct): ${resolveToneText(t.point, "direct").slice(0, 300)}\n`;
    msg += `Point (competitive): ${resolveToneText(t.point, "competitive").slice(0, 300)}\n\n`;
  }

  msg += `## Hard Takeaways (rewrite moreDetails for each)\n\n`;
  for (const [i, t] of hardTakeaways.entries()) {
    if (!t.moreDetails) continue;
    msg += `### hard[${i}]\n`;
    msg += `Point (gentle): ${resolveToneText(t.point, "gentle").slice(0, 300)}\n`;
    msg += `Point (direct): ${resolveToneText(t.point, "direct").slice(0, 300)}\n`;
    msg += `Point (competitive): ${resolveToneText(t.point, "competitive").slice(0, 300)}\n\n`;
  }

  msg += `Rewrite ALL moreDetails as conceptual expansions. Output ONLY the JSON array.`;

  return msg;
}

// ─── VALIDATION ────────────────────────────────────────────────────────

function validateRewrittenMoreDetails(entries, chapter) {
  const issues = [];
  const medCount = (chapter.contentVariants?.medium?.keyTakeaways ?? []).filter((t) => t.moreDetails).length;
  const hardCount = (chapter.contentVariants?.hard?.keyTakeaways ?? []).filter((t) => t.moreDetails).length;
  const expectedTotal = medCount + hardCount;

  if (!Array.isArray(entries)) {
    issues.push("Response is not an array");
    return issues;
  }

  if (entries.length !== expectedTotal) {
    issues.push(`Expected ${expectedTotal} entries, got ${entries.length}`);
  }

  for (const [i, entry] of entries.entries()) {
    const label = `entry[${i}] (${entry.depth}[${entry.index}])`;

    if (!["medium", "hard"].includes(entry.depth)) {
      issues.push(`${label}: invalid depth "${entry.depth}"`);
    }

    if (typeof entry.index !== "number") {
      issues.push(`${label}: missing or invalid index`);
    }

    const toneIssues = [];
    ensureToneObject(entry.moreDetails, `${label}.moreDetails`, toneIssues);
    issues.push(...toneIssues);

    if (entry.moreDetails && typeof entry.moreDetails === "object") {
      for (const tone of ["gentle", "direct", "competitive"]) {
        const text = entry.moreDetails[tone] ?? "";
        if (typeof text !== "string") continue;

        if (countSentences(text) < 2) {
          issues.push(`${label}.${tone}: fewer than 2 sentences`);
        }

        const banned = hasBannedPhrase(text);
        if (banned) {
          issues.push(`${label}.${tone}: contains banned phrase "${banned}"`);
        }

        if (hasDashes(text)) {
          issues.push(`${label}.${tone}: contains em/en dashes`);
        }
      }
    }
  }

  return issues;
}

// ─── COMMANDS ──────────────────────────────────────────────────────────

function audit() {
  const pkg = readJson(PACKAGE_PATH);
  const report = { chapters: [], totalMedium: 0, totalHard: 0, total: 0 };

  for (const ch of pkg.chapters) {
    const med = (ch.contentVariants?.medium?.keyTakeaways ?? []).filter((t) => t.moreDetails).length;
    const hard = (ch.contentVariants?.hard?.keyTakeaways ?? []).filter((t) => t.moreDetails).length;
    report.chapters.push({
      number: ch.number,
      title: ch.title,
      medium: med,
      hard: hard,
      total: med + hard,
    });
    report.totalMedium += med;
    report.totalHard += hard;
    report.total += med + hard;
  }

  writeJson(REPORT_PATH, report);

  console.log("=== moreDetails Audit ===\n");
  console.log(`Total chapters: ${report.chapters.length}`);
  console.log(`Medium moreDetails: ${report.totalMedium}`);
  console.log(`Hard moreDetails: ${report.totalHard}`);
  console.log(`Total to rewrite: ${report.total}\n`);

  for (const ch of report.chapters) {
    console.log(`  Ch${zeroPad(ch.number)} ${ch.title.slice(0, 50).padEnd(50)} med=${ch.medium} hard=${ch.hard} total=${ch.total}`);
  }

  console.log(`\nReport written to ${REPORT_PATH}`);
}

async function fix(options = {}) {
  const { start = 1, end = 48 } = options;
  const pkg = readJson(PACKAGE_PATH);
  const results = { fixed: 0, skipped: 0, failed: 0, issues: [] };

  console.log(`=== Rewriting moreDetails (Ch${zeroPad(start)}-Ch${zeroPad(end)}) ===\n`);

  for (const ch of pkg.chapters) {
    if (ch.number < start || ch.number > end) continue;

    const nn = zeroPad(ch.number);
    const medTakeaways = ch.contentVariants?.medium?.keyTakeaways ?? [];
    const hardTakeaways = ch.contentVariants?.hard?.keyTakeaways ?? [];
    const medWithDetails = medTakeaways.filter((t) => t.moreDetails).length;
    const hardWithDetails = hardTakeaways.filter((t) => t.moreDetails).length;
    const totalDetails = medWithDetails + hardWithDetails;

    if (totalDetails === 0) {
      console.log(`Ch${nn}: no moreDetails, skipping`);
      results.skipped++;
      continue;
    }

    console.log(`Ch${nn}: rewriting ${medWithDetails} medium + ${hardWithDetails} hard moreDetails...`);

    try {
      const userMessage = buildUserMessage(ch);
      const rawResponse = await callClaude(SYSTEM_PROMPT, userMessage);

      const entries = extractJsonFromResponse(rawResponse);
      if (!entries) {
        console.error(`  Ch${nn}: FAILED to parse JSON response`);
        results.failed++;
        results.issues.push({ chapter: ch.number, error: "JSON parse failure" });

        // Write raw response for debugging
        fs.writeFileSync(`/tmp/48-laws-ch${nn}-raw-response.txt`, rawResponse, "utf8");
        continue;
      }

      const validationIssues = validateRewrittenMoreDetails(entries, ch);
      if (validationIssues.length > 0) {
        console.warn(`  Ch${nn}: ${validationIssues.length} validation warnings:`);
        for (const issue of validationIssues.slice(0, 5)) {
          console.warn(`    - ${issue}`);
        }
      }

      // Apply patches
      let patchedCount = 0;
      for (const entry of entries) {
        if (!entry.moreDetails || typeof entry.moreDetails !== "object") continue;
        if (!["medium", "hard"].includes(entry.depth)) continue;
        if (typeof entry.index !== "number") continue;

        const takeaways = entry.depth === "medium" ? medTakeaways : hardTakeaways;
        if (entry.index < 0 || entry.index >= takeaways.length) continue;
        if (!takeaways[entry.index].moreDetails) continue;

        // Only patch if all 3 tones are present and non-empty
        const g = entry.moreDetails.gentle;
        const d = entry.moreDetails.direct;
        const c = entry.moreDetails.competitive;
        if (typeof g === "string" && g.trim() && typeof d === "string" && d.trim() && typeof c === "string" && c.trim()) {
          takeaways[entry.index].moreDetails = {
            gentle: g.trim(),
            direct: d.trim(),
            competitive: c.trim(),
          };
          patchedCount++;
        }
      }

      console.log(`  Ch${nn}: patched ${patchedCount}/${totalDetails} moreDetails`);
      results.fixed++;

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`  Ch${nn}: ERROR - ${err.message}`);
      results.failed++;
      results.issues.push({ chapter: ch.number, error: err.message });
    }
  }

  // Write output
  writeJson(OUTPUT_PATH, pkg);

  console.log(`\n=== Done ===`);
  console.log(`Fixed: ${results.fixed}, Skipped: ${results.skipped}, Failed: ${results.failed}`);
  console.log(`Output: ${OUTPUT_PATH}`);

  if (results.issues.length > 0) {
    console.log(`\nIssues:`);
    for (const issue of results.issues) {
      console.log(`  Ch${zeroPad(issue.chapter)}: ${issue.error}`);
    }
  }
}

function validate() {
  const sourcePath = fs.existsSync(OUTPUT_PATH) ? OUTPUT_PATH : PACKAGE_PATH;
  const pkg = readJson(sourcePath);
  console.log(`=== Validating ${path.basename(sourcePath)} ===\n`);

  let totalIssues = 0;
  let totalChecked = 0;
  let fictionalVignetteCount = 0;

  for (const ch of pkg.chapters) {
    const nn = zeroPad(ch.number);
    const chIssues = [];

    for (const depth of ["medium", "hard"]) {
      const takeaways = ch.contentVariants?.[depth]?.keyTakeaways ?? [];
      for (const [i, t] of takeaways.entries()) {
        if (!t.moreDetails) continue;
        totalChecked++;

        ensureToneObject(t.moreDetails, `Ch${nn}.${depth}[${i}].moreDetails`, chIssues);

        for (const tone of ["gentle", "direct", "competitive"]) {
          const text = t.moreDetails[tone] ?? "";
          if (typeof text !== "string") continue;

          if (countSentences(text) < 2) {
            chIssues.push(`${depth}[${i}].${tone}: fewer than 2 sentences`);
          }

          const banned = hasBannedPhrase(text);
          if (banned) {
            chIssues.push(`${depth}[${i}].${tone}: banned phrase "${banned}"`);
          }

          if (hasDashes(text)) {
            chIssues.push(`${depth}[${i}].${tone}: em/en dashes`);
          }

          if (hasFictionalVignette(text)) {
            fictionalVignetteCount++;
          }
        }
      }
    }

    if (chIssues.length > 0) {
      console.log(`Ch${nn} (${chIssues.length} issues):`);
      for (const issue of chIssues.slice(0, 5)) {
        console.log(`  - ${issue}`);
      }
      if (chIssues.length > 5) console.log(`  ... and ${chIssues.length - 5} more`);
      totalIssues += chIssues.length;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`moreDetails checked: ${totalChecked}`);
  console.log(`Total issues: ${totalIssues}`);
  console.log(`Fictional vignette patterns detected: ${fictionalVignetteCount} (across all tone variants)`);

  if (totalIssues === 0 && fictionalVignetteCount === 0) {
    console.log("\nAll moreDetails pass validation.");
  }
}

// ─── CLI ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0] ?? "audit";

function parseFlag(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return Number(args[idx + 1]);
}

if (command === "audit") {
  audit();
} else if (command === "fix") {
  fix({ start: parseFlag("start") ?? 1, end: parseFlag("end") ?? 48 }).catch((err) => {
    console.error("Fatal:", err.message);
    process.exit(1);
  });
} else if (command === "validate") {
  validate();
} else {
  console.log("Usage: node rewrite-moredetails.mjs <audit|fix|validate> [--start N] [--end N]");
  console.log("  audit     Count moreDetails per chapter (no API calls)");
  console.log("  fix       Rewrite all moreDetails via Claude API");
  console.log("  validate  Check patched file for quality issues");
  process.exit(1);
}
