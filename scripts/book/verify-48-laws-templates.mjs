#!/usr/bin/env node
// Detects template damage across the-48-laws-of-power.v21.json.
// Flags scenarios, quiz prompts, reviewCard backs, and implementation plans
// that match the known template patterns and reports per-chapter failure counts.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '../../book-packages/the-48-laws-of-power.v21.json');

const TEMPLATE_SCENARIO_PATTERNS = [
  /sits in view\./,
  /the concrete beat is/i,
  /\bin e\b\s*"/,
  /\bin every conv\s*"/,
  /\bin every convers\s*"/,
  /handling .{10,}? at \d/i,
];

const TEMPLATE_QUIZ_PATTERNS = [
  /a decision has to be made before the next meeting starts/i,
  /Choose the option that makes .+ visible before the room hardens/i,
  /Push the most direct claim first and trust the strength of the argument/i,
  /Avoid the situation until no one can object/i,
];

const TEMPLATE_CARD_BACK_PATTERNS = [
  /Retrieve the specific move:/i,
  /Apply it through a visible action, then check the limit/i,
];

const TEMPLATE_PLAN_PATTERNS = [
  /change the first visible artifact or sequence before making the argument/i,
  /make .+ visible through the setup first/i,
  /narrow it to one concrete action and one clear limit/i,
  /Change one visible cue before adding any explanation/i,
  /Note the first cue people saw and whether it made the outcome easier or harder/i,
];

function check(text, patterns) {
  return patterns.filter((p) => p.test(text)).map((p) => p.source);
}

function jaccard(a, b) {
  const ta = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const inter = [...ta].filter((x) => tb.has(x)).length;
  const union = new Set([...ta, ...tb]).size;
  return union ? inter / union : 0;
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const report = [];
  for (const ch of pkg.chapters) {
    const issues = {
      number: ch.number,
      title: ch.title,
      examples: 0,
      quiz: 0,
      reviewCards: 0,
      reviewCardsIdentical: false,
      implementationPlan: 0,
      details: [],
    };

    for (const ex of ch.examples || []) {
      const hits = check(ex.scenario || '', TEMPLATE_SCENARIO_PATTERNS);
      const what = check(ex.whatToDo || '', TEMPLATE_SCENARIO_PATTERNS);
      const why = check(ex.whyItMatters || '', TEMPLATE_SCENARIO_PATTERNS);
      if (hits.length || what.length || why.length) {
        issues.examples++;
        issues.details.push(`ex ${ex.exampleId}: ${[...hits, ...what, ...why].join(', ')}`);
      }
    }

    for (const q of ch.quiz?.questions || []) {
      const hits = check(q.prompt || '', TEMPLATE_QUIZ_PATTERNS);
      const choiceHits = (q.choices || []).flatMap((c) => check(c, TEMPLATE_QUIZ_PATTERNS));
      if (hits.length || choiceHits.length) {
        issues.quiz++;
      }
    }

    const cards = ch.reviewCards || [];
    let identicalPairs = 0;
    for (let i = 0; i < cards.length; i++) {
      const hits = check(cards[i].back || '', TEMPLATE_CARD_BACK_PATTERNS);
      if (hits.length) issues.reviewCards++;
      for (let j = i + 1; j < cards.length; j++) {
        if ((cards[i].back || '').trim() === (cards[j].back || '').trim()) identicalPairs++;
      }
    }
    issues.reviewCardsIdentical = identicalPairs >= 6; // 5 cards → C(5,2)=10 max

    const plan = ch.implementationPlan || {};
    const planText = [plan.coreSkill, plan.twentyFourHourChallenge, plan.weeklyPractice, ...(plan.ifThenPlans || []).map((p) => p.plan)].join(' \n ');
    const planHits = check(planText, TEMPLATE_PLAN_PATTERNS);
    issues.implementationPlan = planHits.length;

    report.push(issues);
  }

  let totalBad = 0;
  console.log('CH#  EX QZ RC IDN PL  TITLE');
  for (const r of report) {
    const flag = r.examples + r.quiz + r.reviewCards + r.implementationPlan + (r.reviewCardsIdentical ? 1 : 0);
    if (flag) totalBad++;
    console.log(
      `${String(r.number).padStart(2)}  ${String(r.examples).padStart(2)} ${String(r.quiz).padStart(2)} ${String(r.reviewCards).padStart(2)}  ${r.reviewCardsIdentical ? 'Y' : 'n'}  ${String(r.implementationPlan).padStart(2)}  ${r.title}`
    );
  }
  console.log(`\nChapters with any defect: ${totalBad}/48`);
}

main();
