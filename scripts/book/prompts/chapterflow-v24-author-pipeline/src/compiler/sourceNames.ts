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

/**
 * R-115 — the investing-canon carve-out, kept ONLY as the default for callers that have no book
 * genre in hand.
 *
 * These five names (Graham, his co-author Dodd, Buffett and his given name Warren, and Graham's
 * given name Benjamin) were added unconditionally to EVERY packet's protected set, so every book
 * in the catalogue reserved them. On a memoir by Benjamin Franklin that opened the writer's
 * forbidden-name list with "Benjamin" — the author's own name treated as an off-limits invented
 * protagonist for reasons that belong to a different genre entirely.
 *
 * The list now lives in config/genre-pools.json under each genre's `reservedFigureNames`, and
 * `protectedSourceNames` takes it as a parameter. This constant remains the DEFAULT so the two
 * consumers that reserve names book-wide without a genre — sectionGate's SEC34 actor check and
 * critics/readerBudgets' person-token exclusion — keep behaving exactly as before; narrowing
 * those two is a section-gate change, not a compiler one.
 */
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

/**
 * Names an invented protagonist must not take for this packet.
 *
 * `reservedNames` is the genre's source-figure canon (R-115). It defaults to the investing block
 * for backward compatibility; pass `[]` to get the PACKET-DERIVED protection alone — the names
 * that genuinely appear in this chapter's own material — which is what the blueprint's
 * forbidden-name guidance should show a reader-facing writer.
 */
export function protectedSourceNames(
  packet: SourcePacketV1,
  candidateNames: string[] = DEFAULT_PROTAGONIST_NAMES,
  reservedNames: readonly string[] = GLOBAL_RESERVED_SOURCE_FIGURE_NAMES,
): Set<string> {
  const protectedNames = new Set<string>();
  const candidates = new Set(candidateNames);
  const haystack = packetNameText(packet);

  for (const name of reservedNames) {
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
