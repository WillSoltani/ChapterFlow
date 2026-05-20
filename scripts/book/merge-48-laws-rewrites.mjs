#!/usr/bin/env node
// Merges per-chapter JSON patches from /tmp/48-laws-rewrites/ch{NN}.json into
// the-48-laws-of-power.v21.json. Patch shape:
//   { number: N, examples: [...], quiz: {...}, reviewCards: [...], implementationPlan: {...} }
// Only the four fields are replaced. Everything else in the chapter is preserved.
//
// Usage:
//   node scripts/book/merge-48-laws-rewrites.mjs              # merge all available patches
//   node scripts/book/merge-48-laws-rewrites.mjs 3 4 5        # only these chapter numbers
//   node scripts/book/merge-48-laws-rewrites.mjs --dry        # preview without writing

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '../../book-packages/the-48-laws-of-power.v21.json');
const PATCH_DIR = '/tmp/48-laws-rewrites';

function pad(n) { return String(n).padStart(2, '0'); }

function loadPatch(num) {
  const p = path.join(PATCH_DIR, `ch${pad(num)}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    console.error(`FAILED to parse ${p}: ${err.message}`);
    return { _parseError: err.message };
  }
}

function validatePatch(p, num) {
  const errs = [];
  if (p._parseError) errs.push(`json parse error: ${p._parseError}`);
  if (typeof p.number !== 'number' || p.number !== num) errs.push(`number mismatch (expected ${num}, got ${p.number})`);
  if (!Array.isArray(p.examples) || p.examples.length !== 6) errs.push(`examples must have 6 items (got ${p.examples?.length})`);
  if (!p.quiz?.questions || p.quiz.questions.length !== 3) errs.push(`quiz must have 3 questions (got ${p.quiz?.questions?.length})`);
  if (!Array.isArray(p.reviewCards) || p.reviewCards.length !== 5) errs.push(`reviewCards must have 5 items (got ${p.reviewCards?.length})`);
  if (!p.implementationPlan) errs.push('implementationPlan missing');
  else {
    const pl = p.implementationPlan;
    if (!pl.coreSkill) errs.push('implementationPlan.coreSkill missing');
    if (!Array.isArray(pl.ifThenPlans) || pl.ifThenPlans.length !== 4) errs.push(`implementationPlan.ifThenPlans must have 4 items (got ${pl.ifThenPlans?.length})`);
    if (!pl.twentyFourHourChallenge) errs.push('twentyFourHourChallenge missing');
    if (!pl.weeklyPractice) errs.push('weeklyPractice missing');
  }
  for (const [i, ex] of (p.examples || []).entries()) {
    if (!ex.exampleId) errs.push(`examples[${i}].exampleId missing`);
    if (!ex.scenario) errs.push(`examples[${i}].scenario missing`);
    if (!ex.whatToDo) errs.push(`examples[${i}].whatToDo missing`);
    if (!ex.whyItMatters) errs.push(`examples[${i}].whyItMatters missing`);
    if (!ex.planSpec) errs.push(`examples[${i}].planSpec missing`);
  }
  for (const [i, q] of (p.quiz?.questions || []).entries()) {
    if (!q.prompt) errs.push(`quiz[${i}].prompt missing`);
    if (!Array.isArray(q.choices) || q.choices.length !== 3) errs.push(`quiz[${i}] must have 3 choices`);
    if (typeof q.correctIndex !== 'number') errs.push(`quiz[${i}].correctIndex missing`);
    if (!q.explanation) errs.push(`quiz[${i}].explanation missing`);
  }
  for (const [i, c] of (p.reviewCards || []).entries()) {
    if (!c.front) errs.push(`reviewCards[${i}].front missing`);
    if (!c.back) errs.push(`reviewCards[${i}].back missing`);
  }
  return errs;
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const nums = args
    .filter((a) => !a.startsWith('--'))
    .map((a) => parseInt(a, 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 48);

  const targets = nums.length ? nums : Array.from({ length: 48 }, (_, i) => i + 1);

  const pkg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const byNumber = new Map(pkg.chapters.map((c) => [c.number, c]));

  const applied = [];
  const skipped = [];
  const failed = [];

  for (const num of targets) {
    const patch = loadPatch(num);
    if (!patch) { skipped.push(num); continue; }
    const errs = validatePatch(patch, num);
    if (errs.length) {
      failed.push({ num, errs });
      continue;
    }
    const ch = byNumber.get(num);
    if (!ch) { failed.push({ num, errs: ['chapter not found in book'] }); continue; }
    ch.examples = patch.examples;
    ch.quiz = { passingScorePercent: patch.quiz.passingScorePercent ?? 70, questions: patch.quiz.questions };
    ch.reviewCards = patch.reviewCards;
    ch.implementationPlan = patch.implementationPlan;
    applied.push(num);
  }

  console.log(`applied: ${applied.join(', ') || '(none)'}`);
  console.log(`skipped (no patch): ${skipped.join(', ') || '(none)'}`);
  for (const f of failed) console.log(`FAILED ${f.num}: ${f.errs.join('; ')}`);

  if (!dry && applied.length) {
    fs.writeFileSync(FILE, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`wrote ${FILE}`);
  } else if (dry) {
    console.log('--dry: no write');
  }
}

main();
