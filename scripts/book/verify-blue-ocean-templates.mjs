#!/usr/bin/env node
// Detects the defect phrase and shared 6+ word phrases in blue-ocean-strategy.v21.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '../../book-packages/blue-ocean-strategy.v21.json');

function extract6PlusWordPhrases(text) {
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  const phrases = [];
  for (let i = 0; i <= words.length - 6; i++) {
    phrases.push(words.slice(i, i + 6).join(' '));
  }
  return phrases;
}

function checkSharedPhrases(questions) {
  const sharedByQuestion = {};
  
  for (let i = 0; i < questions.length; i++) {
    const q1 = questions[i];
    const phrases1 = extract6PlusWordPhrases(q1.prompt || '');
    
    for (let j = i + 1; j < questions.length; j++) {
      const q2 = questions[j];
      const phrases2 = extract6PlusWordPhrases(q2.prompt || '');
      
      const shared = phrases1.filter(p => phrases2.includes(p));
      if (shared.length > 0) {
        if (!sharedByQuestion[i]) sharedByQuestion[i] = [];
        if (!sharedByQuestion[j]) sharedByQuestion[j] = [];
        sharedByQuestion[i].push({ with: j, phrases: shared });
        sharedByQuestion[j].push({ with: i, phrases: shared });
      }
    }
  }
  
  return sharedByQuestion;
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const report = [];
  
  for (const ch of pkg.chapters) {
    const questions = ch.quiz?.questions || [];
    
    // Check for defect phrase
    const defectPhraseCount = questions.filter(q => 
      (q.prompt || '').includes('week before the budget review and must choose')
    ).length;
    
    // Check for shared phrases
    const sharedPhrases = checkSharedPhrases(questions);
    
    const issues = {
      number: ch.number,
      title: ch.title,
      defectPhrase: defectPhraseCount,
      sharedPhraseCount: Object.keys(sharedPhrases).length,
      details: sharedPhrases,
    };
    
    report.push(issues);
  }
  
  let totalBad = 0;
  console.log('CH#  DEFECT  SHARED  TITLE');
  for (const r of report) {
    if (r.defectPhrase > 0 || r.sharedPhraseCount > 0) {
      totalBad++;
      console.log(`${String(r.number).padStart(2)}  ${String(r.defectPhrase).padStart(2)}       ${String(r.sharedPhraseCount).padStart(2)}       ${r.title}`);
      if (r.defectPhrase > 0) {
        console.log(`    → ${r.defectPhrase} prompt(s) still contain "week before the budget review and must choose"`);
      }
      if (r.sharedPhraseCount > 0) {
        for (const qIdx in r.details) {
          const details = r.details[qIdx];
          details.forEach(d => {
            console.log(`    Q${parseInt(qIdx)+1}-Q${d.with+1}: "${d.phrases[0]}..."`);
          });
        }
      }
    }
  }
  console.log(`\nChapters with defects: ${totalBad}/11`);
}

main();
