/** Phase-3 regen: rewrite ch01+ch09 with the deterministic rubric failures as
 *  complaints, through the (now rubric-enforcing) author write loop. */
import { resolveDeps } from "../src/orchestrator/autopilot.js";
import { authorWriteOneChapter } from "../src/orchestrator/authorRun.js";

const BOOK = "the-power-of-moments";
const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`);

const COMPLAINTS: Record<number, string[]> = {
  1: [
    "Readability: Flesch ease was 66.4 — the prose is too dense. Write plainer: shorter sentences, smaller words, one idea per sentence. Land inside 72–84.",
    "Distractor tell: 7 of 9 keyed answers were the LONGEST choice. Balance choice lengths so the key is never guessable by length or hedging — make distractors as substantial as the key.",
    "Transfer: only 5 of 9 quiz questions tested a NEW scenario. Most questions must apply the chapter's move to situations the chapter never narrated, not recall its examples.",
  ],
  9: [
    "Readability: Flesch ease was 66.2 — the prose is too dense. Write plainer: shorter sentences, smaller words, one idea per sentence. Land inside 72–84.",
    "Distractor tell: 5 of 9 keyed answers were the LONGEST choice. Balance choice lengths so the key is never guessable by length or hedging — make distractors as substantial as the key.",
  ],
};

async function main() {
  const deps = resolveDeps({ log });
  const results = await Promise.all(
    Object.entries(COMPLAINTS).map(([n, complaints]) => authorWriteOneChapter(BOOK, Number(n), deps, { complaints })),
  );
  let failed = false;
  Object.keys(COMPLAINTS).forEach((n, i) => {
    const r = results[i];
    if (r.ok) log(`ch${String(n).padStart(2, "0")}: REGENERATED (session ${r.sessionId})`);
    else { failed = true; log(`ch${String(n).padStart(2, "0")}: FAILED — ${(r as { reason: string }).reason.slice(0, 500)}`); }
  });
  if (failed) throw new Error("regen did not converge");
  const m = await deps.runVerb(["rubric-metrics", BOOK], {});
  console.log([m.stdout, m.stderr].join("\n").split("\n").filter((l) => l.includes("ch01") || l.includes("ch09")).join("\n"));
  log("PHASE3 REGEN COMPLETE");
}
main().catch((e) => { console.error("DRIVER ERROR:", e); process.exit(1); });
