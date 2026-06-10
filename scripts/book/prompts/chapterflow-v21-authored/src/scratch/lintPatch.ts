/**
 * lintPatch <patchFile> — pre-flight checks on a hand-authored patch so common
 * gate failures are caught before applying. Read-only.
 *   - absolute words in quiz distractors (BP15)
 *   - "chapter" meta-reference anywhere (B1)
 *   - banned counter/prose phrases (B4)
 *   - em dash / non-ascii (would break applyAuthored)
 *   - quiz correctIndex sequence (for AS12 planning)
 *   - per-question rough length ratio (BP16/C18)
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const ABS = ["always","never","automatically","impossible","guaranteed","entirely","ever","forever","completely","wholly","absolutely","under no circumstances","in all cases"];
const BANNED = ["the real test is","boundary condition","keeps the chapter","strips away","is not decorative","is not magic","operating logic","tidy explanation","durable practice","usable lesson","turns out to be","the paradox is","most people assume","most readers assume"];

const patch = JSON.parse(readFileSync(resolve(process.argv[2]), "utf8"));
let issues = 0;
const warn = (m: string) => { console.log("  ⚠ " + m); issues++; };

const wordRe = (w: string) => new RegExp(`\\b${w}\\b`, "i");

if (patch.quiz?.questions) {
  const seq: number[] = [];
  patch.quiz.questions.forEach((q: any, qi: number) => {
    seq.push(q.correctIndex);
    const allText = [q.prompt, ...(q.choices||[]), q.explanation].join(" ");
    if (/\bchapters?\b/i.test(allText)) warn(`q${qi+1}: contains "chapter"`);
    for (const b of BANNED) if (allText.toLowerCase().includes(b)) warn(`q${qi+1}: banned phrase "${b}"`);
    (q.choices||[]).forEach((c: string, ci: number) => {
      if (ci === q.correctIndex) return; // distractors only for BP15
      for (const a of ABS) if (wordRe(a).test(c)) warn(`q${qi+1} choice[${ci}] absolute "${a}"`);
    });
    // length ratio
    const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
    const correct = wc(q.choices[q.correctIndex]);
    const distr = q.choices.filter((_: any, i: number) => i !== q.correctIndex).map(wc);
    const avg = distr.reduce((a: number, b: number) => a+b, 0)/distr.length;
    if (correct/avg >= 1.4) warn(`q${qi+1}: correct/distractor length ratio ${(correct/avg).toFixed(2)} (>=1.4)`);
  });
  console.log(`  seq: [${seq.join(",")}]  zeros=${seq.filter(x=>x===0).length} ones=${seq.filter(x=>x===1).length} twos=${seq.filter(x=>x===2).length}`);
  const aStart = patch.quiz.questions.filter((q:any)=>/^An? /.test(q.prompt)).length;
  if (aStart > 5) warn(`${aStart} prompts start with "A "/"An " (>5, BP17)`);
}

// scenarios: comma-opener (A13), decision cue presence is left to the gate
const CUES = ["has to decide","must decide","must choose","has to choose","to decide","decide whether","faces a choice","before the","minutes before"];
(patch.examples||[]).forEach((ex: any, i: number) => {
  const sc = ex.scenario || "";
  const first80 = sc.slice(0,80);
  if ((first80.match(/,/g)||[]).length >= 3) warn(`ex${i+1}: 3+ commas in first 80 chars (A13)`);
  for (const s of [ex.title, ex.scenario, ex.whatToDo]) {
    if (s && /—/.test(s)) warn(`ex${i+1}: em dash`);
    if (s && /[^\x00-\x7F]/.test(s)) warn(`ex${i+1}: non-ascii`);
  }
});

console.log(issues === 0 ? "  ✓ lint clean" : `  ${issues} issue(s)`);
