#!/usr/bin/env node
// Detects shared 6+ word phrases and stock phrase remnants in the-33-strategies-of-war.v21.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '../../book-packages/the-33-strategies-of-war.v21.json');

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
  
  const targetChapters = [3, 5, 17, 18, 20, 21, 25];
  
  for (const ch of pkg.chapters) {
    if (!targetChapters.includes(ch.number)) continue;
    
    const questions = ch.quiz?.questions || [];
    
    // Check for stock phrase remnants
    const stockPhraseCount = questions.filter(q => 
      (q.prompt || '').includes('The decision is due before the next review') ||
      (q.prompt || '').includes('lock people into')
    ).length;
    
    // Check for shared phrases
    const sharedPhrases = checkSharedPhrases(questions);
    
    const issues = {
      number: ch.number,
      title: ch.title,
      stockPhrase: stockPhraseCount,
      sharedPhraseCount: Object.keys(sharedPhrases).length,
      details: sharedPhrases,
    };
    
    report.push(issues);
  }
  
  let totalBad = 0;
  console.log('CH#  STOCK  SHARED  TITLE');
  for (const r of report) {
    if (r.stockPhrase > 0 || r.sharedPhraseCount > 0) {
      totalBad++;
      console.log(`${String(r.number).padStart(2)}  ${String(r.stockPhrase).padStart(2)}       ${String(r.sharedPhraseCount).padStart(2)}       ${r.title}`);
      if (r.stockPhrase > 0) {
        console.log(`    → ${r.stockPhrase} prompt(s) still contain stock phrase`);
      }
    }
  }
  console.log(`\nChapters with defects: ${totalBad}/7`);
}

main();
