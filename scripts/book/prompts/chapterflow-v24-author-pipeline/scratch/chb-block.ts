/**
 * CHB6-9 calibration reproduction (v24 W3). Prints, per book, the W3 checks that
 * fire and their severity — the table committed to docs/v24/CHB6-9-calibration.md.
 *
 *   npx tsx scratch/chb-block.ts games-people-play crucial-conversations \
 *     atomic-habits thinking-in-bets difficult-conversations the-power-of-moments
 *
 * ENFORCE eligibility = zero BLOCKERS across the top-5 owner-scored books; only
 * CHB7 clears it, so only CHB7 is a blocker (the rest ship shadow/advisory).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { checkReaderBudgets } from "../src/critics/readerBudgets.js";

const PKG_DIR = resolve(__dirname, "../../../../../book-packages");
const W3 = new Set([
  "CHB6.opener_class", "CHB7.scaffold_family", "CHB7.phrase_spread",
  "CHB8.shortest_band", "CHB8.longest_band", "CHB8.echo_band", "CHB8.case_stem_band",
  "CHB9.option_menu", "CHB9.quoted_script",
]);

for (const id of process.argv.slice(2)) {
  const pkg = JSON.parse(readFileSync(resolve(PKG_DIR, `${id}.v21.json`), "utf8"));
  const all = checkReaderBudgets(pkg.chapters ?? []).filter((f) => W3.has(f.checkId));
  const blk = [...new Set(all.filter((f) => f.severity === "blocker").map((f) => f.checkId))].sort();
  const adv = [...new Set(all.filter((f) => f.severity === "advisory").map((f) => f.checkId))].sort();
  console.log(`${id}: BLOCKERS=[${blk.join(",") || "none"}]  advisory=[${adv.join(",")}]`);
}
