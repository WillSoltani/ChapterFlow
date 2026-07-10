import { readFileSync } from "fs";
import { findEvaluatorOpeners } from "../critics/exampleRegister.js";
const c = JSON.parse(readFileSync("state/chapters/multipliers-ch02.v21-native.chapter.json", "utf8"));
console.log("LEDE:", JSON.stringify(c.breakdown.fastRead.split(/(?<=[.?!])\s+/)[0]));
console.log("C31 openers:");
for (const o of findEvaluatorOpeners(c) as any[]) console.log(`  [${o.exampleId}.${o.field}] "${(o.opener||o.text||"").slice(0,72)}"`);
