import type { SourcePacketV1 } from "../artifacts/artifactTypes.js";

const DEFAULT_PROTAGONIST_NAMES = [
  "Liam", "Noah", "Ethan", "Lucas", "Benjamin", "Jack", "Jacob", "William", "James", "Henry", "Alexander", "Logan",
  "Mason", "Oliver", "Elijah", "Nathan", "Samuel", "Daniel", "Matthew", "Carter", "Wyatt", "Hudson", "Isaac", "Ryan",
  "Connor", "Cole", "Aiden", "Dylan", "Adam", "Nicholas", "Joshua", "Tyler", "Brandon", "Cameron", "Evan", "Hunter",
  "Landon", "Aaron", "Eric", "Kevin", "Brian", "Scott", "Craig", "Dean", "Grant", "Reid", "Blake", "Brady",
  "Brett", "Chase", "Cody", "Curtis", "Derek", "Drew", "Garrett", "Gavin", "Heath", "Jared", "Jesse", "Jordan",
];

const SOURCE_FIGURE_ALIASES: Record<string, string[]> = {
  Graham: ["Benjamin"],
  Dodd: ["David"],
  Buffett: ["Warren"],
  Munger: ["Charlie", "Charles"],
  Fisher: ["Philip"],
  Lynch: ["Peter"],
  Bogle: ["John"],
  Klarman: ["Seth"],
  Marks: ["Howard"],
};

export const GLOBAL_RESERVED_SOURCE_FIGURE_NAMES = ["Benjamin", "Graham", "Dodd", "Buffett", "Warren"] as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function packetNameText(packet: SourcePacketV1): string {
  return [
    packet.chapterTitle,
    ...packet.allowedEntities,
    ...packet.namedCases.flatMap((c) => [c.label, c.summary, ...c.hardSpecifics]),
    ...packet.facts.flatMap((f) => [f.claim, f.mechanism, f.commonError, f.whyWrong, ...f.groundedEntities]),
  ].join(" ");
}

export function protectedSourceNames(packet: SourcePacketV1, candidateNames: string[] = DEFAULT_PROTAGONIST_NAMES): Set<string> {
  const protectedNames = new Set<string>();
  const candidates = new Set(candidateNames);
  const haystack = packetNameText(packet);

  for (const name of GLOBAL_RESERVED_SOURCE_FIGURE_NAMES) {
    protectedNames.add(name);
  }

  for (const name of candidateNames) {
    if (new RegExp(`\\b${escapeRegex(name)}\\b`).test(haystack)) protectedNames.add(name);
  }

  for (const match of haystack.matchAll(/\b([A-Z][a-z]+)\s+(?:[A-Z]\.\s+)?([A-Z][a-z]+)\b/g)) {
    const [, first, last] = match;
    if (first && candidates.has(first)) protectedNames.add(first);
    if (last && candidates.has(last)) protectedNames.add(last);
  }

  for (const [surname, aliases] of Object.entries(SOURCE_FIGURE_ALIASES)) {
    if (!new RegExp(`\\b${escapeRegex(surname)}(?:'s)?\\b`).test(haystack)) continue;
    for (const alias of aliases) {
      if (candidates.has(alias)) protectedNames.add(alias);
    }
  }

  return protectedNames;
}

export function sourceNameActorPattern(name: string): RegExp {
  return new RegExp(
    `\\b${escapeRegex(name)}\\b(?:,|\\s+(?:and\\s+[A-Z][a-z]+\\s+)?(?:has(?:\\s+to)?|is|sits|opens|brings|describes|wants|asks|adds|checks|reviews|tries|drafts|decides|chooses|keeps|starts|stands|walks|calls|looks|hovers|remembers|stops|highlights|marks|marked|works|holds|limits|braces|steadies|slows|redirects))\\b`,
  );
}
