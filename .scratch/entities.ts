import { properNounTokens } from "/Users/radinsoltani/cf-wt/dealing-redesign/scripts/book/prompts/chapterflow-v24-author-pipeline/src/compiler/sourcePacketFacts.js";
const samples = [
  "Readers treat the fire story as decoration. Franklin ruled the page. Then Franklin marked it.",
  "Environments can be redesigned. The Junto met weekly at Philadelphia. Junto members argued.",
  "Repetition builds myelin so retrieval becomes faster. Myelin wraps the axon.",
];
for (const s of samples) console.log(JSON.stringify(s.slice(0,60)), "->", properNounTokens(s));
