#!/usr/bin/env node
// Detects stock frames and shared 6+ word phrases in never-split-the-difference.v21.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '../../book-packages/never-split-the-difference.v21.json');

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
  
  const targetChapters = [4, 6, 7, 8];
  
  for (const ch of pkg.chapters) {
    if (!targetChapters.includes(ch.number)) continue;
    
    const questions = ch.quiz?.questions || [];
    
    // Check for stock frames
    const stockFrameCount = questions.filter(q => 
      (q.prompt || '').includes('Which move best fits this scene with visible stakes') ||
      (q.prompt || '').includes('Which action best fits this scene?')
    ).length;
    
    // Check for shared phrases
    const sharedPhrases = checkSharedPhrases(questions);
    
    const issues = {
      number: ch.number,
      title: ch.title,
      stockFrame: stockFrameCount,
      sharedPhraseCount: Object.keys(sharedPhrases).length,
      details: sharedPhrases,
    };
    
    report.push(issues);
  }
  
  let totalBad = 0;
  console.log('CH#  STOCK  SHARED  TITLE');
  for (const r of report) {
    if (r.stockFrame > 0 || r.sharedPhraseCount > 0) {
      totalBad++;
      console.log(`${String(r.number).padStart(2)}  ${String(r.stockFrame).padStart(2)}       ${String(r.sharedPhraseCount).padStart(2)}       ${r.title}`);
      if (r.stockFrame > 0) {
        console.log(`    → ${r.stockFrame} prompt(s) still contain stock frame`);
      }
    }
  }
  console.log(`\nChapters with defects: ${totalBad}/4`);
}

main();
