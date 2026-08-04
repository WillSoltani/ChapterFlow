/** In-memory render sanity: compile execution's briefs (NO writes) with the new
 *  dealt fields, build ch01/ch05 cards, report sizes + spot content. */
import { compileChapterBriefs, renderBriefMd } from "../src/compiler/chapterBrief.js";
import { buildAuthorCard } from "../src/orchestrator/authorRun.js";
import { voiceCard } from "../src/lib/voiceCard.js";
import { readJsonFile, sourcePacketPath } from "../src/artifacts/artifactStore.js";
import type { SourcePacketV1 } from "../src/artifacts/artifactTypes.js";

const { briefs, findings } = compileChapterBriefs("execution", {});
console.log(`briefs compiled in-memory: ${briefs.length}, findings: ${findings.length}`);
const voice = voiceCard("execution");
console.log(`voice card: ${voice ? `${voice.length} chars (non-null OK)` : "NULL — P8 VIOLATION"}`);
for (const n of [1, 5]) {
  const brief = briefs.find((b) => b.chapterNumber === n)!;
  const md = renderBriefMd(brief);
  const packet = readJsonFile<SourcePacketV1>(sourcePacketPath("execution", n, {}));
  const card = buildAuthorCard({ bookId: "execution", chapterNumber: n, briefMd: md, packet, voice, brief });
  console.log(`ch${n}: md ${md.length}ch card ${card.length}ch | lenses [${brief.exampleLenses?.join(", ")}] verb ${brief.practiceVerb} friction ${brief.requireFrictionExample} | nouns [${brief.frameworkNouns?.join(", ")}]`);
}
const withFriction = briefs.filter((b) => b.requireFrictionExample).length;
console.log(`friction dealt to ${withFriction}/${briefs.length} chapters`);
const md1 = renderBriefMd(briefs[0]);
console.log("--- ch01 VARIETY section ---");
console.log(md1.slice(md1.indexOf("## VARIETY"), md1.indexOf("## YOUR CASES")));
