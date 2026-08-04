/** BP33 calibration: run checkQuizCausalKeyShape over every shipped package. */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { checkQuizCausalKeyShape, CAUSAL_STEM_RX } from "../src/critics/quizQuality.js";

const dir = "../../../../book-packages";
let books = 0, causalStems = 0, hits = 0;
const hitLines: string[] = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith(".v21.json")).sort()) {
  const pkg = JSON.parse(readFileSync(join(dir, f), "utf8"));
  books++;
  const chapters = pkg.chapters ?? [];
  for (const ch of chapters) {
    const quiz = ch.quiz ?? { questions: [] };
    for (const q of quiz.questions ?? []) if (typeof q.prompt === "string" && CAUSAL_STEM_RX.test(q.prompt)) causalStems++;
    const fs2 = checkQuizCausalKeyShape(quiz);
    hits += fs2.length;
    for (const x of fs2) hitLines.push(`${f} ch${ch.number}: ${x.message.slice(0, 160)}`);
  }
}
console.log(`books=${books} causalStems=${causalStems} BP33hits=${hits}`);
for (const l of hitLines) console.log(l);
