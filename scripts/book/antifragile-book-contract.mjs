export const ANTIFRAGILE_BOOK_ID = "antifragile";
export const ANTIFRAGILE_TITLE = "Antifragile: Things That Gain from Disorder";
export const ANTIFRAGILE_AUTHOR = "Nassim Nicholas Taleb";
export const ANTIFRAGILE_CATEGORIES = ["Risk", "Decision Making", "Philosophy"];
export const ANTIFRAGILE_TAGS = ["antifragility", "risk", "asymmetry", "optionality", "convexity"];

export const ANTIFRAGILE_DEPTH_RULES = {
  easy: {
    minTakeaways: 3,
    maxTakeaways: 3,
    minWords: 29,
    maxWords: 155,
    requireMoreDetails: false,
    requireActivationPrompt: false,
    requireSelfCheckPrompt: false,
    requireSelfCheckPrompts: false,
    requirePredictionPrompt: false,
    recapShape: "flat",
  },
  medium: {
    minTakeaways: 5,
    maxTakeaways: 6,
    minWords: 185,
    maxWords: 330,
    requireMoreDetails: true,
    requireActivationPrompt: true,
    requireSelfCheckPrompt: true,
    requireSelfCheckPrompts: false,
    requirePredictionPrompt: false,
    recapShape: "structured",
  },
  hard: {
    minTakeaways: 5,
    maxTakeaways: 7,
    minWords: 235,
    maxWords: 430,
    requireMoreDetails: true,
    requireActivationPrompt: true,
    requireSelfCheckPrompt: false,
    requireSelfCheckPrompts: true,
    requirePredictionPrompt: true,
    recapShape: "structured",
  },
};

export const ANTIFRAGILE_SOFT_DRIFT_PHRASES = [
  "life lesson",
  "feel inspired",
  "stay positive",
  "positive mindset",
  "comfort zone",
  "self-care",
  "healing journey",
  "trust the process",
  "just take more risk",
  "take more risk",
  "be more resilient",
  "bounce back stronger",
];

export const ANTIFRAGILE_BRIDGE_EXPECTATIONS = {
  3: ["what kills", "stronger", "harm", "stress"],
  9: ["seneca", "upside", "downside", "asymmetry"],
  10: ["barbell", "structure", "clipped downside", "open upside"],
  18: ["intervention", "opacity", "nonlinear", "consequence"],
  24: ["conclusion", "fragility", "optionality", "time"],
};

export const ANTIFRAGILE_BOUNDARY_EXPECTATIONS = {
  9: ["theory", "expertise", "not"],
  10: ["risk", "timidity", "not"],
  18: ["arithmetic", "counting", "not"],
  21: ["intervention", "passivity", "not"],
  24: ["institution", "code", "not"],
};

function normalizeLooseText(value) {
  return String(value || "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAntifragileMetadataString(value) {
  return normalizeLooseText(value)
    .replace(/^"+|"+$/g, "")
    .replace(/\bNassim-Nicholas-Taleb\b/g, ANTIFRAGILE_AUTHOR)
    .replace(/\bNassim Nicholas Taleb\b/g, ANTIFRAGILE_AUTHOR)
    .replace(/\bAntifragile\b$/g, ANTIFRAGILE_TITLE)
    .trim();
}

export function antifragileSourceProvenanceSummary(sourceLedger) {
  const sourceCount = Array.isArray(sourceLedger?.sources) ? sourceLedger.sources.length : 0;
  const sourceLabel = sourceCount > 0 ? `${sourceCount} locked source${sourceCount === 1 ? "" : "s"}` : "locked source bundle";
  return `Frozen source bundle for the 2012 English Random House edition using authorized preview, official publisher metadata, and chapter-structure crosschecks (${sourceLabel}).`;
}

export function matchesAntifragilePackage(pkg) {
  const book = pkg?.book ?? pkg;
  const bookId = normalizeLooseText(book?.bookId).toLowerCase();
  return bookId === ANTIFRAGILE_BOOK_ID;
}

export function buildAntifragileBookMetadata({
  editionLock,
  sourceLedger,
  chapterRange,
}) {
  const selected = editionLock?.selectedEdition ?? {};
  return {
    bookId: ANTIFRAGILE_BOOK_ID,
    title: ANTIFRAGILE_TITLE,
    author: ANTIFRAGILE_AUTHOR,
    categories: [...ANTIFRAGILE_CATEGORIES],
    tags: [...ANTIFRAGILE_TAGS],
    edition: {
      name: `${selected?.publishedYear ?? 2012} ${selected?.language ?? "English"} ${selected?.publisher ?? "Random House"} first edition`,
      language: selected?.language ?? "English",
      publisher: selected?.publisher ?? "Random House",
      publishedYear: selected?.publishedYear ?? 2012,
      formatAnchor: selected?.formatAnchor ?? "First edition hardcover / ebook family",
      isbn13: selected?.isbn13 ?? "9781400067824",
      sourceText: selected?.sourceText ?? "",
      sourceProvenance: antifragileSourceProvenanceSummary(sourceLedger),
    },
    variantFamily: "EMH",
    chapterRange,
  };
}
