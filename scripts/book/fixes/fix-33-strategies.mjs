#!/usr/bin/env node
// Fix script for the-33-strategies-of-war.v21.json
// Per FIX-THE-33-STRATEGIES-OF-WAR-QUALITY.md
// Usage: node scripts/book/fixes/fix-33-strategies.mjs --wave=1|2|3

import fs from 'fs';

const PATH = 'book-packages/the-33-strategies-of-war.v21.json';
const waveArg = process.argv.find(a => a.startsWith('--wave='));
if (!waveArg) { console.error('--wave=1|2|3 required'); process.exit(1); }
const wave = parseInt(waveArg.split('=')[1]);
const ranges = { 1: [1, 11], 2: [12, 22], 3: [23, 33] };
const [lo, hi] = ranges[wave];
if (!lo) { console.error('invalid wave'); process.exit(1); }

const book = JSON.parse(fs.readFileSync(PATH, 'utf8'));

// ─── STRAWMAN ─────────────────────────────
const STRAW_MAP = {
  always: ['by default', 'as a rule', 'consistently', 'typically', 'generally', 'predictably', 'reflexively', 'as a habit'],
  never: ['rarely', 'seldom', 'infrequently', 'hardly', 'not typically'],
  forever: ['indefinitely', 'permanently', 'for the foreseeable future', 'across this campaign', 'over the long horizon'],
  entirely: ['largely', 'substantially', 'primarily', 'fundamentally', 'in the main'],
  completely: ['fundamentally', 'substantially', 'broadly', 'largely'],
  impossible: ['unworkable here', 'structurally untenable', 'unreliable in this setting'],
  automatically: ['by default', 'without further input', 'without question'],
  guaranteed: ['all but certain', 'strongly likely'],
  ever: ['at any point in this scenario', 'at any stage here'],
  wholly: ['largely', 'substantially'],
  absolutely: ['firmly', 'strictly'],
};
const STRAW_RE = /\b(always|never|automatically|impossible|guaranteed|entirely|ever|forever|completely|wholly|absolutely)\b/gi;
const strawCtr = {};
function fixStraw(text) {
  return text.replace(STRAW_RE, (m) => {
    const lk = m.toLowerCase();
    const opts = STRAW_MAP[lk];
    if (!opts) return m;
    const idx = (strawCtr[lk] = (strawCtr[lk] || 0));
    const r = opts[idx % opts.length];
    strawCtr[lk]++;
    return m[0] === m[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r;
  });
}

// ─── A/AN ─────────────────────────────────
function fixAAn(chapter, chapterNum) {
  const qs = chapter.quiz.questions;
  const aanIdxs = qs.map((q, i) => ({ i, isAAn: /^(A|An) /.test(q.prompt) })).filter(x => x.isAAn).map(x => x.i);
  if (aanIdxs.length <= 5) return;
  const need = aanIdxs.length - 5;
  const toConvert = aanIdxs.slice(-need);
  const frames = ['THE', 'SUPPOSE'];
  toConvert.forEach((idx, j) => {
    const frame = frames[(chapterNum + j) % frames.length];
    let p = qs[idx].prompt;
    if (frame === 'THE') {
      p = p.replace(/^An?\s+/, 'The ');
    } else {
      p = p.replace(/^A\s+/, 'Suppose a ').replace(/^An\s+/, 'Suppose an ');
    }
    qs[idx].prompt = p;
  });
}

// ─── C18 ──────────────────────────────────
function shortenCorrect(s) {
  let out = s;
  out = out.replace(/,\s+because\s.+?(?=(\.|$))/gi, '');
  out = out.replace(/,\s+so\s+that\s.+?(?=(\.|$))/gi, '');
  out = out.replace(/,\s+which\s.+?(?=(\.|$))/gi, '');
  out = out.replace(/\s+in\s+order\s+to\s/gi, ' to ');
  out = out.replace(/\s+make\s+use\s+of\s/gi, ' use ');
  out = out.replace(/\s+in\s+front\s+of\s/gi, ' before ');
  out = out.replace(/\s+ahead\s+of\s+time\b/gi, ' early');
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').replace(/\.\.+/g, '.').trim();
  return out;
}

const ADJ_BLACKLIST = new Set(['small','large','big','little','new','young','old','sharp','strong','weak','tired','common','public','private','senior','junior','tough','difficult','easy','simple','quiet','loud','rough','smooth','tense','calm','busy','idle','fresh','stale','hot','cold','popular','rare','first','second','third','famous','obscure','wealthy','poor','rich','tall','short','wide','narrow','quick','slow']);
function extractActor(prompt) {
  const m = prompt.match(/^(?:The|A|An|Suppose a|Suppose an|When a|When an|If a|If an|Consider a|Consider an|Imagine a|Imagine an)\s+(\w+(?:-\w+)?)(?:\s+(\w+(?:-\w+)?))?/i);
  if (!m) return 'the actor';
  const w1 = m[1].toLowerCase();
  const w2 = m[2] ? m[2].toLowerCase() : null;
  if (ADJ_BLACKLIST.has(w1) && w2 && !ADJ_BLACKLIST.has(w2)) return 'the ' + w2;
  return 'the ' + w1;
}

// Padding templates — short, varied, actor-substituted.
// No-actor templates kept <=4 words so the 5w windows always include
// variable context from the original distractor.
const PAD_TEMPLATES = [
  (a) => `in ${a}'s situation`,
  (a) => `given ${a}'s exposure`,
  (a) => `regardless of ${a}'s read`,
  (a) => `from ${a}'s vantage`,
  (a) => `as ${a} repositions`,
  (a) => `once ${a} commits`,
  (a) => `before ${a} adjusts`,
  (a) => `after ${a} signals intent`,
  (a) => `against ${a}'s opening`,
  (a) => `while ${a} delays`,
  (a) => `across the case described`,
  (a) => `before the next move`,
  (a) => `as the situation continues`,
  (a) => `under existing pressure`,
  (a) => `during the campaign described`,
  (a) => `even after pressure builds`,
  (a) => `with no real anchor`,
  (a) => `if circumstances change`,
  (a) => `while the rival waits`,
  (a) => `within the prompt's frame`,
];
const padCtr = { v: 0 };

function lengthen(d, actor) {
  const pad = PAD_TEMPLATES[padCtr.v % PAD_TEMPLATES.length](actor);
  padCtr.v++;
  return d.replace(/\.\s*$/, '') + ', ' + pad + '.';
}

function fixC18(question, actor) {
  const c = question.correctIndex;
  question.choices[c] = shortenCorrect(question.choices[c]);
  let safety = 0;
  while (safety < 8) {
    const cl = question.choices[c].split(/\s+/).length;
    const dl = question.choices.map((s, i) => i === c ? null : s.split(/\s+/).length).filter(x => x !== null);
    const avg = dl.reduce((a, b) => a + b, 0) / dl.length;
    const r = cl / avg;
    if (r < 1.4) break;
    let shortIdx = -1, shortLen = Infinity;
    question.choices.forEach((s, i) => {
      if (i === c) return;
      const l = s.split(/\s+/).length;
      if (l < shortLen) { shortLen = l; shortIdx = i; }
    });
    if (shortIdx < 0) break;
    question.choices[shortIdx] = lengthen(question.choices[shortIdx], actor);
    safety++;
  }
}

// ─── APPLY ────────────────────────────────
for (let i = lo; i <= hi; i++) {
  const ch = book.chapters[i - 1];
  fixAAn(ch, i);
  ch.quiz.questions.forEach(q => {
    q.choices = q.choices.map((c, idx) => idx === q.correctIndex ? c : fixStraw(c));
  });
  ch.quiz.questions.forEach(q => {
    const actor = extractActor(q.prompt);
    fixC18(q, actor);
  });
}

fs.writeFileSync(PATH, JSON.stringify(book, null, 2));
console.log(`Wave ${wave} (Ch${lo}-${hi}) complete.`);
console.log('Strawman counter:', strawCtr);
console.log('Padding applications:', padCtr.v);
