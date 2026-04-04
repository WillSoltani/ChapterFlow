#!/usr/bin/env node
/**
 * Generates Anthropic Batch API JSONL input files for Phase 2 LLM-required fixes:
 * 1. Breakdown word count expansion (direct/competitive under target for ch1-31)
 * 2. moreDetails generation (ch4-6 missing all moreDetails)
 * 3. Dialogue scenario rewrites (add quoted speech exchanges)
 *
 * Output: scripts/book/batches/friends-phase2-{batch-name}-input.jsonl
 * Submit via: anthropic batches create --input-file <file>
 */

import { readFileSync, writeFileSync } from "fs";

const FILE = "book-packages/friends-and-influence.modern.json";
const pkg = JSON.parse(readFileSync(FILE, "utf-8"));
const chapters = pkg.chapters;

function wordCount(s) { return s ? s.trim().split(/\s+/).length : 0; }

// ═══════════════════════════════════════════════
// BATCH 1: BREAKDOWN WORD COUNT EXPANSION
// ═══════════════════════════════════════════════
const breakdownItems = [];

for (let i = 0; i < chapters.length; i++) {
  const ch = chapters[i];
  const cv = ch.contentVariants || {};

  for (const depth of ["medium", "hard"]) {
    const target = depth === "medium" ? { min: 330, max: 420 } : { min: 490, max: 600 };
    const bd = cv[depth]?.chapterBreakdown;
    if (!bd) continue;

    for (const tone of ["gentle", "direct", "competitive"]) {
      const text = bd[tone];
      if (!text) continue;
      const wc = wordCount(text);
      if (wc >= target.min) continue;

      const wordsNeeded = target.min + 20 - wc; // aim for min+20 buffer
      breakdownItems.push({
        custom_id: `bd-ch${ch.number}-${depth}-${tone}`,
        method: "POST",
        url: "/v1/messages",
        body: {
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: `You are expanding a chapter breakdown for a book learning app. The current text is ${wc} words but needs to be ${target.min}-${target.max} words.

BOOK: "How to Win Friends and Influence People" by Dale Carnegie
CHAPTER ${ch.number}: "${ch.title}"
DEPTH: ${depth}
TONE: ${tone}${tone === "gentle" ? " (warm, reflective, sit-with-it framing)" : tone === "direct" ? " (clinical, mechanism-focused, efficient)" : " (edge-seeking, strategic, advantage-focused)"}

CURRENT TEXT (${wc} words):
${text}

RULES:
- Add ~${wordsNeeded} words of NEW chapter-specific content
- Reference Carnegie's actual stories, examples, and frameworks from this chapter
- Do NOT use any of these words/phrases: delve, crucial, landscape, realm, furthermore, moreover, robust, synergy, utilize, foster, paradigm shift, game-changer, at its core, the art of, navigating, harnessing
- Do NOT use em dashes (—) or double hyphens (--)
- Do NOT start the first sentence with: "This chapter", "The author argues", "In this chapter", "Chapter ${ch.number}"
- Do NOT end any sentence with "structural", "mechanism", "pattern", "dynamic", "framework", or "system"
- Maintain the existing ${tone} tone throughout
- The expanded text must flow naturally, not read like padding was added
- Return ONLY the expanded text, no commentary`
          }]
        }
      });
    }
  }
}

// ═══════════════════════════════════════════════
// BATCH 2: MOREDETAILS GENERATION (ch4-6)
// ═══════════════════════════════════════════════
const moreDetailsItems = [];

for (const chNum of [4, 5, 6]) {
  const ch = chapters.find(c => c.number === chNum);
  if (!ch) continue;

  for (const depth of ["medium", "hard"]) {
    const kts = ch.contentVariants?.[depth]?.keyTakeaways;
    if (!kts) continue;

    for (let j = 0; j < kts.length; j++) {
      const kt = kts[j];
      if (kt.moreDetails) continue; // already has it

      const pointText = typeof kt.point === "object"
        ? `gentle: "${kt.point.gentle}"\ndirect: "${kt.point.direct}"\ncompetitive: "${kt.point.competitive}"`
        : `"${kt.point}"`;

      for (const tone of ["gentle", "direct", "competitive"]) {
        moreDetailsItems.push({
          custom_id: `md-ch${chNum}-${depth}-kt${j}-${tone}`,
          method: "POST",
          url: "/v1/messages",
          body: {
            model: "claude-sonnet-4-20250514",
            max_tokens: 800,
            messages: [{
              role: "user",
              content: `Generate a "moreDetails" explanation for a key takeaway in a book learning app.

BOOK: "How to Win Friends and Influence People" by Dale Carnegie
CHAPTER ${chNum}: "${ch.title}"
DEPTH: ${depth} (${depth === "medium" ? "intermediate detail" : "advanced deep-dive"})
TONE: ${tone}${tone === "gentle" ? " (warm, reflective, sit-with-it framing)" : tone === "direct" ? " (clinical, mechanism-focused, efficient)" : " (edge-seeking, strategic, advantage-focused)"}

KEY TAKEAWAY (point):
${pointText}

RULES:
- Write 2-4 sentences that EXPLAIN the insight further, specific to Carnegie's chapter content
- This is CONCEPTUAL explanation, NOT a fictional vignette (no "Sarah noticed...", no invented characters)
- Reference actual stories, research, or frameworks Carnegie uses in this chapter
- Do NOT use banned phrases: delve, crucial, landscape, realm, furthermore, moreover, robust, at its core, the art of
- Do NOT use em dashes (—) or double hyphens (--)
- Do NOT end the last sentence with: structural, mechanism, pattern, dynamic, framework, system
- Do NOT start with imperative verbs (Try, Practice, Start, Make, Do)
- Return ONLY the moreDetails text for the "${tone}" tone, no commentary`
            }]
          }
        });
      }
    }
  }
}

// ═══════════════════════════════════════════════
// BATCH 3: DIALOGUE SCENARIO REWRITES
// ═══════════════════════════════════════════════
const dialogueItems = [];

for (const ch of chapters) {
  const dialogueExamples = (ch.examples || []).filter(ex => ex.format === "dialogue");

  for (const ex of dialogueExamples) {
    if (!ex.scenario || typeof ex.scenario !== "object") continue;

    for (const tone of ["gentle", "direct", "competitive"]) {
      const currentScenario = ex.scenario[tone];
      if (!currentScenario) continue;

      // Check if it already has enough quotes
      const quoteCount = (currentScenario.match(/"/g) || []).length;
      if (quoteCount >= 6) continue; // Already has 3+ exchanges

      dialogueItems.push({
        custom_id: `dlg-ch${ch.number}-${ex.exampleId}-${tone}`,
        method: "POST",
        url: "/v1/messages",
        body: {
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          messages: [{
            role: "user",
            content: `Rewrite this dialogue-format scenario for a book learning app. The current version describes speech instead of showing it. It needs at least 3 quoted speech exchanges between named characters.

BOOK: "How to Win Friends and Influence People" by Dale Carnegie
CHAPTER ${ch.number}: "${ch.title}"
EXAMPLE: "${ex.title}"
TONE: ${tone}${tone === "gentle" ? " (warm, reflective, sit-with-it framing)" : tone === "direct" ? " (clinical, mechanism-focused, efficient)" : " (edge-seeking, strategic, advantage-focused)"}
CATEGORY: ${ex.category}

CURRENT SCENARIO (lacks quoted dialogue):
${currentScenario}

RULES:
- Rewrite to include at least 3 back-and-forth quoted speech exchanges using "double quotes"
- Keep the same characters, setting, and lesson
- Total length: 80-150 words
- Include 3+ concrete details (names, times, objects, locations) and 1 sensory/emotional detail
- Do NOT use em dashes (—) or double hyphens (--)
- Do NOT use banned phrases: delve, crucial, landscape, realm, furthermore, moreover
- Maintain the ${tone} tone
- Return ONLY the rewritten scenario text, no commentary`
          }]
        }
      });
    }
  }
}

// ═══════════════════════════════════════════════
// WRITE BATCH FILES
// ═══════════════════════════════════════════════
const dir = "scripts/book/batches";

// JSONL format (one JSON object per line)
function writeJsonl(items, filename) {
  const lines = items.map(item => JSON.stringify(item));
  writeFileSync(`${dir}/${filename}`, lines.join("\n") + "\n", "utf-8");
  console.log(`  ${filename}: ${items.length} items`);
}

console.log("Batch input files generated:");

// Split breakdowns into chunks of 50 for manageable batches
for (let i = 0; i < breakdownItems.length; i += 50) {
  const chunk = breakdownItems.slice(i, i + 50);
  const batchNum = Math.floor(i / 50) + 1;
  writeJsonl(chunk, `friends-phase2-breakdowns-batch${batchNum}-input.jsonl`);
}

// moreDetails - single batch
if (moreDetailsItems.length > 0) {
  writeJsonl(moreDetailsItems, "friends-phase2-moredetails-input.jsonl");
}

// Dialogues - split into chunks of 50
for (let i = 0; i < dialogueItems.length; i += 50) {
  const chunk = dialogueItems.slice(i, i + 50);
  const batchNum = Math.floor(i / 50) + 1;
  writeJsonl(chunk, `friends-phase2-dialogues-batch${batchNum}-input.jsonl`);
}

console.log(`\nTotal:
  Breakdown expansions: ${breakdownItems.length}
  moreDetails generation: ${moreDetailsItems.length}
  Dialogue rewrites: ${dialogueItems.length}
  Grand total: ${breakdownItems.length + moreDetailsItems.length + dialogueItems.length} API calls`);

console.log(`
To submit batches:
  anthropic batches create --input-file ${dir}/friends-phase2-breakdowns-batch1-input.jsonl
  anthropic batches create --input-file ${dir}/friends-phase2-moredetails-input.jsonl
  anthropic batches create --input-file ${dir}/friends-phase2-dialogues-batch1-input.jsonl

After results come back, run:
  node scripts/book/apply-phase2-results.mjs <result-file.jsonl>
`);
