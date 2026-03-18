#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BOOK_PACKAGES_DIR = path.join(ROOT, "book-packages");
const BOOK_COVERS_DIR = path.join(ROOT, "public", "book-covers");
const COVER_EXTS = [".svg", ".png", ".jpg", ".jpeg", ".webp", ".avif"];
const FORCE_REGEN_COVERS = process.env.FORCE_REGEN_COVERS === "1";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "under",
  "with",
  "without",
]);

function hash(input) {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = ((value << 5) - value + input.charCodeAt(index)) | 0;
  }
  return Math.abs(value);
}

function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanSpaces(text) {
  return String(text || "")
    .replace(/[–—]/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function capitalizeSentenceStarts(text) {
  if (!text) return text;
  let output = text.replace(/(^|[.!?]\s+)([a-z])/g, (_match, start, letter) => {
    return `${start}${letter.toUpperCase()}`;
  });
  output = output.replace(/^([a-z])/, (match) => match.toUpperCase());
  return output;
}

function ensureTerminalPunctuation(text) {
  if (!text) return text;
  if (/[.!?]$/.test(text)) return text;
  return `${text}.`;
}

function polishText(text) {
  return ensureTerminalPunctuation(capitalizeSentenceStarts(cleanSpaces(text)));
}

function extractLeadName(text) {
  const skip = new Set([
    "A",
    "An",
    "The",
    "At",
    "In",
    "On",
    "When",
    "While",
    "During",
    "After",
    "Before",
    "From",
    "With",
    "Without",
    "Over",
    "Under",
    "Across",
    "Through",
    "This",
    "That",
  ]);
  const tokens = cleanSpaces(text).match(/\b[A-Z][a-z]+\b/g) || [];
  for (const token of tokens) {
    if (!skip.has(token)) return token;
  }
  return null;
}

function extractCandidateNames(text) {
  const skip = new Set([
    "A",
    "An",
    "The",
    "At",
    "In",
    "On",
    "When",
    "While",
    "During",
    "After",
    "Before",
    "From",
    "With",
    "Without",
    "Over",
    "Under",
    "Across",
    "Through",
    "This",
    "That",
    "Small",
    "Good",
    "Personal",
    "Use",
    "Keep",
    "Focus",
  ]);

  const tokens = cleanSpaces(text).match(/\b[A-Z][a-z]+\b/g) || [];
  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  const names = [];
  for (const [token, count] of counts.entries()) {
    if (skip.has(token)) continue;
    if (count >= 2 || new RegExp(`\\b${token}'s\\b`).test(text)) {
      names.push(token);
    }
  }
  return names;
}

function conjugateThirdPerson(verb) {
  const irregular = new Map([
    ["be", "is"],
    ["have", "has"],
    ["do", "does"],
  ]);
  if (irregular.has(verb)) return irregular.get(verb);
  if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh|o)$/.test(verb)) return `${verb}es`;
  return `${verb}s`;
}

function fixNameVerbAgreement(text, name) {
  let output = text;
  const names = new Set(extractCandidateNames(output));
  if (name) names.add(name);
  for (const commonName of ["Alex", "Jordan", "Maya", "Riley"]) {
    if (new RegExp(`\\b${commonName}\\b`).test(output)) {
      names.add(commonName);
    }
  }
  if (names.size === 0) return output;

  const directSubjectVerbs = [
    "blame",
    "keep",
    "need",
    "want",
    "know",
    "feel",
    "try",
    "tell",
    "say",
    "do",
    "have",
    "use",
    "see",
    "perform",
    "begin",
    "join",
    "enjoy",
    "run",
    "lead",
    "stop",
    "worry",
    "remember",
    "show",
    "contribute",
    "answer",
    "spend",
    "take",
    "evaluate",
    "react",
    "start",
    "open",
    "look",
    "finish",
    "share",
    "admire",
    "bring",
    "treat",
    "explain",
    "test",
    "interrupt",
    "put",
    "understand",
    "attend",
    "brush",
    "expect",
    "review",
    "talk",
    "fall",
    "tend",
    "prefer",
    "read",
    "manage",
    "bomb",
    "sense",
    "hope",
    "praise",
    "consume",
    "hold",
    "act",
    "register",
    "invest",
    "accumulate",
    "prepare",
    "miss",
    "attach",
    "approach",
    "hate",
    "lean",
    "chase",
    "remove",
    "hint",
    "pride",
    "communicate",
    "coordinate",
    "conclude",
    "withdraw",
    "respond",
    "send",
    "trust",
    "question",
    "connect",
    "persist",
    "reduce",
    "lose",
    "freeze",
    "win",
    "rush",
    "grasp",
    "mentor",
    "care",
    "like",
    "keep",
  ];
  const conjoinedVerbs = [
    "feel",
    "start",
    "begin",
    "stop",
    "worry",
    "react",
    "perform",
    "remember",
    "join",
    "lead",
    "run",
    "show",
    "contribute",
    "answer",
    "spend",
    "take",
    "want",
    "need",
    "try",
    "evaluate",
    "open",
    "look",
    "finish",
    "share",
    "admire",
    "bring",
    "treat",
    "explain",
    "test",
    "interrupt",
    "put",
    "understand",
    "attend",
    "brush",
    "expect",
    "review",
    "talk",
    "fall",
    "tend",
    "prefer",
    "read",
    "manage",
    "sense",
    "bomb",
    "hope",
    "praise",
    "consume",
    "hold",
    "act",
    "register",
    "invest",
    "accumulate",
    "prepare",
    "miss",
    "attach",
    "approach",
    "hate",
    "lean",
    "chase",
    "remove",
    "hint",
    "pride",
    "communicate",
    "coordinate",
    "conclude",
    "withdraw",
    "respond",
    "send",
    "trust",
    "question",
    "connect",
    "persist",
    "reduce",
    "lose",
    "freeze",
    "win",
    "rush",
    "grasp",
    "mentor",
    "care",
    "like",
    "keep",
  ];

  const modalWord = /\b(may|might|can|could|would|should|will|must)\b/i;
  const directPrefix =
    "(^|[.!?]\\s+|,\\s+|;\\s+|:\\s+|\\(\\s*|\\b(?:and|but|so|because|while|when|if|after|before|that|which|who|where|how|way|as|then|although|though|unless|means|meaning|since|than|more)\\s+)";
  const directAdverb =
    "((?:(?:still|also|immediately|rarely|quietly|often|usually|just|never|already|only|even|actually|quickly|slowly|simply|really|always)\\s+){0,3})";
  const chainAdverb =
    "((?:(?:still|also|immediately|rarely|quietly|often|usually|just|never|already|only|even|actually|quickly|slowly|simply|really|always)\\s+){0,2})";

  for (const candidate of names) {
    output = output.replace(new RegExp(`\\b${candidate}'s\\b`, "g"), "their");
    output = output.replace(
      new RegExp(`\\b${candidate} ([^.]{0,60}?)\\b${candidate}'s\\b`, "g"),
      `${candidate} $1their`
    );

    for (const verb of directSubjectVerbs) {
      const directRule = new RegExp(`${directPrefix}${candidate}\\s+${directAdverb}${verb}\\b`, "gi");
      output = output.replace(directRule, (_match, prefix, adverb = "") => {
        return `${prefix}${candidate} ${adverb ? `${adverb} ` : ""}${conjugateThirdPerson(verb)}`;
      });
    }

    for (const verb of conjoinedVerbs) {
      const conjoinedRule = new RegExp(`\\b${candidate}\\b([^.!?]{0,220}?)\\band\\s+${chainAdverb}${verb}\\b`, "gi");
      output = output.replace(conjoinedRule, (match, between, adverb = "") => {
        if (modalWord.test(between)) return match;
        return `${candidate}${between}and ${adverb || ""}${conjugateThirdPerson(verb)}`;
      });

      const commaRule = new RegExp(`\\b${candidate}\\b([^.!?]{0,220}?),\\s+${chainAdverb}${verb}\\b`, "gi");
      output = output.replace(commaRule, (match, between, adverb = "") => {
        if (modalWord.test(between)) return match;
        return `${candidate}${between}, ${adverb || ""}${conjugateThirdPerson(verb)}`;
      });
    }

    output = output.replace(
      new RegExp(`\\b(make|makes|made) ${candidate} feels\\b`, "g"),
      `$1 ${candidate} feel`
    );
    output = output.replace(
      new RegExp(`\\bmany people around ${candidate} is\\b`, "g"),
      `many people around ${candidate} are`
    );
    output = output.replace(new RegExp(`\\bmessage ${candidate} send\\b`, "gi"), `message ${candidate} sends`);
    output = output.replace(
      new RegExp(`\\breactive ${candidate} communicate\\b`, "gi"),
      `reactive ${candidate} communicates`
    );
    output = output.replace(new RegExp(`\\bthan ${candidate} actually are\\b`, "g"), "than they actually are");
  }

  output = output.replace(
    /\b(still|also|immediately|rarely|quietly|often|usually|just|never|already|only|even|actually|quickly|slowly|simply|really|always)(has|does|sees|starts|feels|wants|needs|tries|tells|says|keeps|uses|runs|joins|leads|stops|worries|remembers|shows|contributes|answers|spends|takes|evaluates|reacts|performs|begins|enjoys|knows|looks|opens|finishes|shares|admires|brings|treats|explains|tests|interrupts|puts|understands|attends|brushes|expects|reviews|talks|falls|tends|prefers|reads|manages|senses|bombs)\b/gi,
    "$1 $2"
  );

  return output;
}

function chapterKeywords(title) {
  return cleanSpaces(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length >= 4 && !STOP_WORDS.has(part));
}

function hasChapterRelevance(chapter, textBlocks) {
  const fullText = cleanSpaces(textBlocks.join(" ").toLowerCase());
  const keywords = chapterKeywords(chapter.title);
  return keywords.some((word) => fullText.includes(word));
}

function normalizeContexts(rawContexts) {
  const normalized = [];
  for (const value of Array.isArray(rawContexts) ? rawContexts : []) {
    const key = cleanSpaces(value).toLowerCase().replace(/[-_]/g, " ");
    if (key.includes("school")) normalized.push("school");
    else if (key.includes("work")) normalized.push("work");
    else normalized.push("personal");
  }
  if (normalized.length > 0) return normalized;
  return ["personal"];
}

function chooseAnchor(chapter) {
  const variants = Object.values(chapter.contentVariants || {});
  const candidates = [];
  for (const variant of variants) {
    if (variant?.importantSummary) candidates.push(variant.importantSummary);
    if (Array.isArray(variant?.keyTakeaways) && variant.keyTakeaways.length > 0) {
      candidates.push(variant.keyTakeaways[0]);
    }
    if (Array.isArray(variant?.takeaways) && variant.takeaways.length > 0) {
      candidates.push(variant.takeaways[0]);
    }
  }
  const fallback = chapter.title;
  const base = cleanSpaces(candidates[0] || fallback);
  const firstSentence = base.split(/[.!?]/)[0] || fallback;
  return cleanSpaces(firstSentence).slice(0, 140);
}

function buildPrompt(chapterTitle, anchor, index, retry = false) {
  const chapter = cleanSpaces(chapterTitle);
  const regularTemplates = [
    `You are making a real-world decision tied to "${chapter}". Which option is the strongest next move?`,
    `In a relatable day-to-day scenario, which choice best puts "${chapter}" into practice?`,
    `When pressure rises, which response best reflects "${chapter}"?`,
    `Which option would be most effective in a realistic situation for "${chapter}"?`,
    `For someone in their twenties handling real constraints, which choice best applies "${chapter}"?`,
  ];
  const retryTemplates = [
    `After reflecting on your first attempt, which option now best applies "${chapter}"?`,
    `You get a second attempt in a realistic scenario. Which choice best puts "${chapter}" into practice?`,
    `In a relatable follow-up situation, which option is the strongest application of "${chapter}"?`,
  ];
  const templates = retry ? retryTemplates : regularTemplates;
  void anchor;
  return templates[index % templates.length];
}

function polishChoice(text) {
  let output = cleanSpaces(text);
  output = output.replace(/^That\s+/i, "");
  output = output.replace(/^This chapter introduces\s+/i, "");
  output = output.replace(/^It argues that\s+/i, "");
  output = output.replace(/^It claims that\s+/i, "");
  output = capitalizeSentenceStarts(output);
  return ensureTerminalPunctuation(output);
}

const COVER_THEME_META = {
  strategy: {
    label: "STRATEGY",
    subtitle: "Position, timing, and leverage",
    titleFont: "Georgia, 'Times New Roman', serif",
    palettes: [
      {
        bgTop: "#0E2A44",
        bgBottom: "#1E486A",
        panel: "#F4ECDD",
        panelStroke: "#CDBA9D",
        ink: "#1C2B34",
        accent: "#D19A34",
        accentSoft: "#7AA4C4",
        light: "#FFF8EE",
      },
      {
        bgTop: "#2B2A3D",
        bgBottom: "#4A486E",
        panel: "#F2ECE1",
        panelStroke: "#C7B9A3",
        ink: "#232733",
        accent: "#D59A43",
        accentSoft: "#8F90C0",
        light: "#FEF8F0",
      },
    ],
  },
  communication: {
    label: "COMMUNICATION",
    subtitle: "Influence, dialogue, and trust",
    titleFont: "'Trebuchet MS', Arial, sans-serif",
    palettes: [
      {
        bgTop: "#2D4A64",
        bgBottom: "#3E6D8C",
        panel: "#F4EFE4",
        panelStroke: "#CBBBA3",
        ink: "#20313C",
        accent: "#E19345",
        accentSoft: "#8DBBCB",
        light: "#FDF8EE",
      },
      {
        bgTop: "#1F3E50",
        bgBottom: "#396A76",
        panel: "#F4ECE0",
        panelStroke: "#CAB7A0",
        ink: "#1E2E33",
        accent: "#D98540",
        accentSoft: "#7CB0A3",
        light: "#FEF8EE",
      },
    ],
  },
  psychology: {
    label: "PSYCHOLOGY",
    subtitle: "Behavior, bias, and motivation",
    titleFont: "Georgia, 'Times New Roman', serif",
    palettes: [
      {
        bgTop: "#3A3E63",
        bgBottom: "#5A5A86",
        panel: "#F2EDE3",
        panelStroke: "#C8B8A7",
        ink: "#24283A",
        accent: "#D59D5A",
        accentSoft: "#9FA8D9",
        light: "#FDF7EE",
      },
      {
        bgTop: "#2D3656",
        bgBottom: "#4E5E8A",
        panel: "#F3ECE2",
        panelStroke: "#C9B8A2",
        ink: "#232B3B",
        accent: "#D88D57",
        accentSoft: "#9AACD2",
        light: "#FDF8EF",
      },
    ],
  },
  productivity: {
    label: "PRODUCTIVITY",
    subtitle: "Focus, habits, and execution",
    titleFont: "'Trebuchet MS', Arial, sans-serif",
    palettes: [
      {
        bgTop: "#274F4C",
        bgBottom: "#3E7364",
        panel: "#F2EEE3",
        panelStroke: "#C6B9A3",
        ink: "#203230",
        accent: "#DB9F4F",
        accentSoft: "#8AC0AB",
        light: "#FBF8EF",
      },
      {
        bgTop: "#205F5D",
        bgBottom: "#3A8279",
        panel: "#F4EEE3",
        panelStroke: "#C8B9A3",
        ink: "#1F3331",
        accent: "#E2A457",
        accentSoft: "#7FC5B8",
        light: "#FDF8EE",
      },
    ],
  },
  leadership: {
    label: "LEADERSHIP",
    subtitle: "Responsibility and alignment",
    titleFont: "Georgia, 'Times New Roman', serif",
    palettes: [
      {
        bgTop: "#30354F",
        bgBottom: "#4F5A79",
        panel: "#F2ECE1",
        panelStroke: "#C7B7A3",
        ink: "#252B3E",
        accent: "#D8A354",
        accentSoft: "#96A8CA",
        light: "#FEF8EE",
      },
      {
        bgTop: "#1E3352",
        bgBottom: "#3F5978",
        panel: "#F4EDE2",
        panelStroke: "#CAB9A3",
        ink: "#223142",
        accent: "#DA9A49",
        accentSoft: "#88A8C7",
        light: "#FDF8EE",
      },
    ],
  },
  finance: {
    label: "MONEY",
    subtitle: "Wealth, risk, and incentives",
    titleFont: "Georgia, 'Times New Roman', serif",
    palettes: [
      {
        bgTop: "#264A37",
        bgBottom: "#3B7557",
        panel: "#F2EEE3",
        panelStroke: "#C6B9A4",
        ink: "#20332A",
        accent: "#E0A33F",
        accentSoft: "#94C2A7",
        light: "#FCF8EF",
      },
      {
        bgTop: "#375B2E",
        bgBottom: "#568346",
        panel: "#F2EDE1",
        panelStroke: "#C6B8A1",
        ink: "#2B3A24",
        accent: "#DCA255",
        accentSoft: "#9CC09C",
        light: "#FDF8EE",
      },
    ],
  },
  learning: {
    label: "LEARNING",
    subtitle: "Practice and skill building",
    titleFont: "'Trebuchet MS', Arial, sans-serif",
    palettes: [
      {
        bgTop: "#2D4A6A",
        bgBottom: "#4B7AA3",
        panel: "#F4EEE3",
        panelStroke: "#CABAA4",
        ink: "#223445",
        accent: "#E29C48",
        accentSoft: "#8EB4D1",
        light: "#FDF8EE",
      },
      {
        bgTop: "#314C74",
        bgBottom: "#5578A6",
        panel: "#F3ECE1",
        panelStroke: "#C8B8A2",
        ink: "#25364A",
        accent: "#DE9A4A",
        accentSoft: "#9CB9DA",
        light: "#FEF8EF",
      },
    ],
  },
  philosophy: {
    label: "PHILOSOPHY",
    subtitle: "Meaning and perspective",
    titleFont: "Georgia, 'Times New Roman', serif",
    palettes: [
      {
        bgTop: "#4C3D30",
        bgBottom: "#6C5845",
        panel: "#F3ECE0",
        panelStroke: "#C7B7A1",
        ink: "#332920",
        accent: "#D8A060",
        accentSoft: "#B7A28B",
        light: "#FDF7EC",
      },
      {
        bgTop: "#3F3A32",
        bgBottom: "#5F574A",
        panel: "#F3ECE2",
        panelStroke: "#C8B8A2",
        ink: "#322C25",
        accent: "#D6A160",
        accentSoft: "#B39F88",
        light: "#FEF8EE",
      },
    ],
  },
  relationships: {
    label: "RELATIONSHIPS",
    subtitle: "Attachment and connection",
    titleFont: "'Trebuchet MS', Arial, sans-serif",
    palettes: [
      {
        bgTop: "#5B3D57",
        bgBottom: "#7A5575",
        panel: "#F3EDE3",
        panelStroke: "#C8B7A4",
        ink: "#352635",
        accent: "#E0A35C",
        accentSoft: "#C4A2C3",
        light: "#FDF8EE",
      },
      {
        bgTop: "#6A3F52",
        bgBottom: "#8B5E6D",
        panel: "#F4ECE2",
        panelStroke: "#C9B7A1",
        ink: "#3A2A34",
        accent: "#DD9A54",
        accentSoft: "#C79BB1",
        light: "#FDF8EE",
      },
    ],
  },
  innovation: {
    label: "INNOVATION",
    subtitle: "Entrepreneurship and growth",
    titleFont: "'Trebuchet MS', Arial, sans-serif",
    palettes: [
      {
        bgTop: "#1F3C5C",
        bgBottom: "#345C85",
        panel: "#F3ECE1",
        panelStroke: "#C7B8A3",
        ink: "#213244",
        accent: "#F29B4B",
        accentSoft: "#8EB0D4",
        light: "#FDF8EE",
      },
      {
        bgTop: "#234057",
        bgBottom: "#3C6E7C",
        panel: "#F4ECE2",
        panelStroke: "#C8B8A2",
        ink: "#22343B",
        accent: "#EB9A4F",
        accentSoft: "#8CBCC6",
        light: "#FDF8EE",
      },
    ],
  },
  thinking: {
    label: "THINKING",
    subtitle: "Mental models and judgment",
    titleFont: "Georgia, 'Times New Roman', serif",
    palettes: [
      {
        bgTop: "#2A3F5B",
        bgBottom: "#3F5F86",
        panel: "#F3ECE0",
        panelStroke: "#C8B7A1",
        ink: "#233244",
        accent: "#E4A150",
        accentSoft: "#93B0CE",
        light: "#FDF8EE",
      },
      {
        bgTop: "#2A3951",
        bgBottom: "#48658C",
        panel: "#F4EDE2",
        panelStroke: "#CAB8A2",
        ink: "#243344",
        accent: "#DB9850",
        accentSoft: "#9CB4D1",
        light: "#FDF8EF",
      },
    ],
  },
  resilience: {
    label: "RESILIENCE",
    subtitle: "Stoicism and mental toughness",
    titleFont: "Georgia, 'Times New Roman', serif",
    palettes: [
      {
        bgTop: "#32425A",
        bgBottom: "#4D627D",
        panel: "#F2ECE1",
        panelStroke: "#C8B7A1",
        ink: "#273648",
        accent: "#DFA052",
        accentSoft: "#9FB3C9",
        light: "#FDF8EE",
      },
      {
        bgTop: "#3D445F",
        bgBottom: "#5A658A",
        panel: "#F4EDE2",
        panelStroke: "#CAB9A3",
        ink: "#2C3247",
        accent: "#E09F57",
        accentSoft: "#A9B7D1",
        light: "#FEF8EE",
      },
    ],
  },
};

const CATEGORY_THEME_MAP = {
  Strategy: "strategy",
  Business: "innovation",
  Entrepreneurship: "innovation",
  Innovation: "innovation",
  Product: "innovation",
  Communication: "communication",
  Negotiation: "communication",
  Conflict: "communication",
  Persuasion: "communication",
  "Social Skills": "communication",
  Psychology: "psychology",
  "Human Behavior": "psychology",
  Behavior: "psychology",
  "Behavior Change": "psychology",
  "Behavioral Economics": "psychology",
  Leadership: "leadership",
  Management: "leadership",
  Execution: "leadership",
  Productivity: "productivity",
  Focus: "productivity",
  Attention: "productivity",
  "Self Management": "productivity",
  "Self Improvement": "productivity",
  "Personal Development": "productivity",
  "Self Development": "productivity",
  Learning: "learning",
  "Skill Building": "learning",
  Education: "learning",
  "Decision Making": "thinking",
  Thinking: "thinking",
  "Mental Models": "thinking",
  Risk: "thinking",
  Finance: "finance",
  Wealth: "finance",
  "Personal Finance": "finance",
  Relationships: "relationships",
  Philosophy: "philosophy",
  Stoicism: "philosophy",
  Meaning: "philosophy",
  Ethics: "philosophy",
  Politics: "philosophy",
  Society: "philosophy",
  Resilience: "resilience",
  "Mental Toughness": "resilience",
  "Self Mastery": "resilience",
  "Self Discipline": "resilience",
};

const COVER_THEME_KEYWORDS = {
  strategy: ["strategy", "power", "war", "game", "positioning", "competition", "timing", "influence"],
  communication: ["communication", "conversation", "negotiation", "dialogue", "rapport", "persuasion", "talk"],
  psychology: ["psychology", "bias", "behavior", "motives", "mind", "emotion", "social", "attachment"],
  productivity: ["productivity", "focus", "habit", "execution", "workflow", "consistency", "time", "discipline"],
  leadership: ["leadership", "teams", "management", "ownership", "responsibility", "culture", "alignment"],
  finance: ["money", "wealth", "finance", "investing", "incentives", "capital", "economics"],
  learning: ["learning", "practice", "memory", "skill", "study", "mastery", "training", "teaching"],
  philosophy: ["philosophy", "meaning", "ethics", "stoicism", "purpose", "mortality", "wisdom"],
  relationships: ["relationship", "dating", "connection", "trust", "friendship", "attachment", "intimacy"],
  innovation: ["startup", "innovation", "entrepreneurship", "product", "market", "growth", "disruption"],
  thinking: ["thinking", "models", "judgment", "decision", "reasoning", "clarity", "uncertainty"],
  resilience: ["resilience", "grit", "toughness", "obstacle", "adversity", "courage", "endurance"],
};

function chooseCoverTheme(book) {
  const score = new Map(Object.keys(COVER_THEME_META).map((key) => [key, 0]));
  const categories = Array.isArray(book.categories) ? book.categories : [];
  for (const category of categories) {
    const mapped = CATEGORY_THEME_MAP[category];
    if (mapped) score.set(mapped, (score.get(mapped) || 0) + 6);
  }

  const words = cleanSpaces([book.title, ...(book.categories || []), ...(book.tags || [])].join(" "))
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const [theme, keywords] of Object.entries(COVER_THEME_KEYWORDS)) {
    for (const word of words) {
      if (keywords.includes(word)) {
        score.set(theme, (score.get(theme) || 0) + 2);
      }
      for (const key of keywords) {
        if (key.includes("-") && word === key.replace("-", "")) {
          score.set(theme, (score.get(theme) || 0) + 1);
        }
      }
    }
  }

  let bestTheme = "thinking";
  let bestScore = -1;
  for (const [theme, value] of score.entries()) {
    if (value > bestScore) {
      bestScore = value;
      bestTheme = theme;
    }
  }
  return bestTheme;
}

function splitTitle(title, maxLines = 4) {
  const words = cleanSpaces(title).split(/\s+/);
  if (words.length <= 4) return [cleanSpaces(title).toUpperCase()];
  const lineCount = Math.min(maxLines, words.length <= 8 ? 3 : 4);
  const target = Math.ceil(words.length / lineCount);
  const lines = [];
  let current = [];
  for (const word of words) {
    current.push(word);
    if (current.length >= target && lines.length < lineCount - 1) {
      lines.push(current.join(" ").toUpperCase());
      current = [];
    }
  }
  if (current.length > 0) lines.push(current.join(" ").toUpperCase());
  return lines.slice(0, lineCount);
}

function titleFontSize(lines) {
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  if (longest <= 12) return 108;
  if (longest <= 18) return 92;
  if (longest <= 26) return 78;
  return 64;
}

function keywordLine(book, themeLabel) {
  const source = [...(book.tags || []), ...(book.categories || [])]
    .map((value) => cleanSpaces(value).toUpperCase())
    .filter(Boolean);
  const unique = [];
  for (const value of source) {
    if (!unique.includes(value)) unique.push(value);
  }
  const line = unique.slice(0, 3).join("  ·  ");
  return line || themeLabel;
}

function renderCoverLayout(layoutVariant, palette, seed) {
  const dx = (seed % 60) - 30;
  const dy = ((seed >> 3) % 50) - 25;
  switch (layoutVariant % 5) {
    case 0:
      return `
  <rect x="-120" y="310" width="820" height="1100" transform="rotate(-12 400 860)" fill="${palette.accentSoft}" opacity="0.24"/>
  <rect x="560" y="260" width="760" height="1150" transform="rotate(8 940 835)" fill="${palette.accent}" opacity="0.16"/>
  <circle cx="${250 + dx}" cy="${560 + dy}" r="180" fill="${palette.accent}" opacity="0.17"/>
  <circle cx="${980 - dx}" cy="${1040 - dy}" r="220" fill="${palette.accentSoft}" opacity="0.2"/>`;
    case 1:
      return `
  <rect x="0" y="300" width="1200" height="1180" fill="${palette.accentSoft}" opacity="0.12"/>
  <rect x="140" y="360" width="920" height="1050" rx="48" fill="${palette.light}" opacity="0.22"/>
  <path d="M0 560 Q300 ${440 + dy} 600 560 T1200 560" stroke="${palette.light}" stroke-width="22" opacity="0.24"/>
  <path d="M0 1180 Q300 ${1060 + dy} 600 1180 T1200 1180" stroke="${palette.accent}" stroke-width="16" opacity="0.22"/>`;
    case 2:
      return `
  <circle cx="600" cy="840" r="420" fill="${palette.accentSoft}" opacity="0.16"/>
  <circle cx="600" cy="840" r="300" fill="${palette.light}" opacity="0.16"/>
  <circle cx="${600 + dx}" cy="${840 + dy}" r="210" fill="${palette.accent}" opacity="0.18"/>
  <circle cx="${600 - dx}" cy="${840 - dy}" r="130" fill="${palette.light}" opacity="0.34"/>`;
    case 3:
      return `
  <rect x="0" y="300" width="1200" height="1180" fill="${palette.accentSoft}" opacity="0.1"/>
  <g stroke="${palette.light}" opacity="0.2">
    <line x1="160" y1="320" x2="160" y2="1460" stroke-width="4"/>
    <line x1="320" y1="320" x2="320" y2="1460" stroke-width="3"/>
    <line x1="480" y1="320" x2="480" y2="1460" stroke-width="2"/>
    <line x1="640" y1="320" x2="640" y2="1460" stroke-width="3"/>
    <line x1="800" y1="320" x2="800" y2="1460" stroke-width="2"/>
    <line x1="960" y1="320" x2="960" y2="1460" stroke-width="3"/>
  </g>
  <path d="M140 430 L1060 430" stroke="${palette.accent}" stroke-width="10" opacity="0.22"/>
  <path d="M140 1330 L1060 1330" stroke="${palette.accent}" stroke-width="10" opacity="0.2"/>`;
    default:
      return `
  <rect x="0" y="300" width="1200" height="1180" fill="${palette.accentSoft}" opacity="0.12"/>
  <rect x="110" y="370" width="420" height="420" rx="42" fill="${palette.light}" opacity="0.2"/>
  <rect x="670" y="360" width="420" height="430" rx="42" fill="${palette.accent}" opacity="0.16"/>
  <rect x="110" y="980" width="420" height="360" rx="42" fill="${palette.accent}" opacity="0.15"/>
  <rect x="670" y="950" width="420" height="390" rx="42" fill="${palette.light}" opacity="0.2"/>`;
  }
}

function renderThemeSymbol(theme, palette, seed) {
  const sx = (seed % 30) - 15;
  const sy = ((seed >> 4) % 26) - 13;
  switch (theme) {
    case "strategy":
      return `
  <g transform="translate(${415 + sx} ${565 + sy})">
    <rect x="0" y="0" width="370" height="330" rx="24" fill="${palette.light}" opacity="0.92" stroke="${palette.accentSoft}" stroke-width="8"/>
    <g stroke="${palette.accentSoft}" stroke-width="3" opacity="0.8">
      <line x1="92" y1="0" x2="92" y2="330"/>
      <line x1="184" y1="0" x2="184" y2="330"/>
      <line x1="276" y1="0" x2="276" y2="330"/>
      <line x1="0" y1="82" x2="370" y2="82"/>
      <line x1="0" y1="164" x2="370" y2="164"/>
      <line x1="0" y1="246" x2="370" y2="246"/>
    </g>
    <path d="M46 260 L136 182 L198 222 L318 112" stroke="${palette.accent}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    <polygon points="318,112 284,114 304,140" fill="${palette.accent}"/>
  </g>`;
    case "communication":
      return `
  <g transform="translate(${400 + sx} ${575 + sy})">
    <path d="M30 46 H270 Q304 46 304 80 V188 Q304 222 270 222 H150 L110 260 L110 222 H30 Q-4 222 -4 188 V80 Q-4 46 30 46 Z" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M194 142 H366 Q398 142 398 174 V280 Q398 312 366 312 H280 L244 346 V312 H194 Q162 312 162 280 V174 Q162 142 194 142 Z" fill="${palette.accent}" opacity="0.86"/>
    <circle cx="86" cy="132" r="12" fill="${palette.ink}"/>
    <circle cx="148" cy="132" r="12" fill="${palette.ink}"/>
    <circle cx="210" cy="132" r="12" fill="${palette.ink}"/>
    <rect x="214" y="222" width="132" height="14" rx="7" fill="${palette.light}" opacity="0.92"/>
    <rect x="214" y="252" width="102" height="14" rx="7" fill="${palette.light}" opacity="0.92"/>
  </g>`;
    case "psychology":
      return `
  <g transform="translate(${410 + sx} ${560 + sy})">
    <circle cx="180" cy="180" r="158" fill="${palette.light}" opacity="0.95" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M148 76 Q92 120 92 190 Q92 258 144 292 Q198 326 258 290 Q304 264 318 220 Q332 178 306 138 Q280 98 232 82 Q192 68 148 76 Z" fill="none" stroke="${palette.ink}" stroke-width="10" opacity="0.72"/>
    <g stroke="${palette.accent}" stroke-width="6" opacity="0.88">
      <line x1="126" y1="146" x2="188" y2="122"/>
      <line x1="188" y1="122" x2="238" y2="156"/>
      <line x1="188" y1="122" x2="184" y2="196"/>
      <line x1="184" y1="196" x2="246" y2="230"/>
      <line x1="126" y1="146" x2="128" y2="220"/>
      <line x1="128" y1="220" x2="184" y2="196"/>
    </g>
    <g fill="${palette.accent}">
      <circle cx="126" cy="146" r="12"/>
      <circle cx="188" cy="122" r="12"/>
      <circle cx="238" cy="156" r="12"/>
      <circle cx="184" cy="196" r="12"/>
      <circle cx="128" cy="220" r="12"/>
      <circle cx="246" cy="230" r="12"/>
    </g>
  </g>`;
    case "productivity":
      return `
  <g transform="translate(${408 + sx} ${568 + sy})">
    <rect x="0" y="0" width="384" height="334" rx="26" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <rect x="34" y="46" width="316" height="28" rx="12" fill="${palette.accentSoft}" opacity="0.55"/>
    <g stroke="${palette.ink}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="42" y="108" width="40" height="40" rx="8" fill="none"/>
      <path d="M52 128 L62 138 L82 116"/>
      <rect x="42" y="174" width="40" height="40" rx="8" fill="none"/>
      <path d="M52 194 L62 204 L82 182"/>
      <rect x="42" y="240" width="40" height="40" rx="8" fill="none"/>
      <path d="M52 260 L62 270 L82 248"/>
    </g>
    <rect x="106" y="112" width="240" height="28" rx="10" fill="${palette.accent}" opacity="0.8"/>
    <rect x="106" y="178" width="224" height="28" rx="10" fill="${palette.accentSoft}" opacity="0.72"/>
    <rect x="106" y="244" width="258" height="28" rx="10" fill="${palette.accent}" opacity="0.7"/>
  </g>`;
    case "leadership":
      return `
  <g transform="translate(${404 + sx} ${556 + sy})">
    <circle cx="196" cy="196" r="188" fill="${palette.light}" opacity="0.95" stroke="${palette.accentSoft}" stroke-width="10"/>
    <circle cx="196" cy="196" r="124" fill="none" stroke="${palette.accent}" stroke-width="14" opacity="0.8"/>
    <polygon points="196,52 226,166 340,196 226,226 196,340 166,226 52,196 166,166" fill="${palette.accent}" opacity="0.92"/>
    <circle cx="196" cy="196" r="36" fill="${palette.ink}" opacity="0.84"/>
  </g>`;
    case "finance":
      return `
  <g transform="translate(${402 + sx} ${566 + sy})">
    <rect x="0" y="0" width="396" height="336" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <rect x="58" y="214" width="56" height="90" rx="12" fill="${palette.accentSoft}" opacity="0.85"/>
    <rect x="142" y="174" width="56" height="130" rx="12" fill="${palette.accent}" opacity="0.82"/>
    <rect x="226" y="128" width="56" height="176" rx="12" fill="${palette.accentSoft}" opacity="0.88"/>
    <rect x="310" y="92" width="56" height="212" rx="12" fill="${palette.accent}" opacity="0.9"/>
    <path d="M44 236 L112 206 L170 184 L252 134 L332 108" stroke="${palette.ink}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="334" cy="108" r="16" fill="${palette.ink}"/>
    <circle cx="84" cy="78" r="34" fill="${palette.accent}" opacity="0.88"/>
    <text x="84" y="89" text-anchor="middle" fill="${palette.light}" font-family="Georgia, serif" font-size="34" font-weight="700">$</text>
  </g>`;
    case "learning":
      return `
  <g transform="translate(${396 + sx} ${570 + sy})">
    <path d="M18 56 Q118 6 218 56 V302 Q118 252 18 302 Z" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M382 56 Q282 6 182 56 V302 Q282 252 382 302 Z" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M200 62 Q200 22 200 8" stroke="${palette.accent}" stroke-width="10" stroke-linecap="round"/>
    <rect x="76" y="106" width="94" height="12" rx="6" fill="${palette.accent}" opacity="0.76"/>
    <rect x="76" y="138" width="112" height="12" rx="6" fill="${palette.accentSoft}" opacity="0.76"/>
    <rect x="76" y="170" width="98" height="12" rx="6" fill="${palette.accent}" opacity="0.76"/>
    <rect x="226" y="106" width="94" height="12" rx="6" fill="${palette.accent}" opacity="0.76"/>
    <rect x="214" y="138" width="112" height="12" rx="6" fill="${palette.accentSoft}" opacity="0.76"/>
    <rect x="224" y="170" width="98" height="12" rx="6" fill="${palette.accent}" opacity="0.76"/>
  </g>`;
    case "philosophy":
      return `
  <g transform="translate(${410 + sx} ${546 + sy})">
    <circle cx="190" cy="112" r="58" fill="${palette.accent}" opacity="0.3"/>
    <rect x="70" y="130" width="240" height="24" rx="10" fill="${palette.accentSoft}" opacity="0.8"/>
    <rect x="92" y="152" width="196" height="34" rx="12" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="6"/>
    <g fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="6">
      <rect x="106" y="184" width="38" height="170" rx="10"/>
      <rect x="170" y="184" width="38" height="170" rx="10"/>
      <rect x="234" y="184" width="38" height="170" rx="10"/>
    </g>
    <rect x="78" y="356" width="224" height="26" rx="10" fill="${palette.accent}" opacity="0.78"/>
  </g>`;
    case "relationships":
      return `
  <g transform="translate(${404 + sx} ${562 + sy})">
    <circle cx="146" cy="174" r="92" fill="none" stroke="${palette.accent}" stroke-width="20"/>
    <circle cx="258" cy="174" r="92" fill="none" stroke="${palette.accentSoft}" stroke-width="20"/>
    <path d="M144 286 Q202 350 258 286" stroke="${palette.ink}" stroke-width="12" stroke-linecap="round"/>
    <rect x="82" y="52" width="240" height="282" rx="28" fill="none" stroke="${palette.light}" stroke-width="7" opacity="0.82"/>
  </g>`;
    case "innovation":
      return `
  <g transform="translate(${408 + sx} ${552 + sy})">
    <path d="M198 20 C272 74 304 146 304 212 C304 284 254 332 198 364 C142 332 92 284 92 212 C92 146 124 74 198 20 Z" fill="${palette.accent}" opacity="0.9"/>
    <circle cx="198" cy="156" r="44" fill="${palette.light}" opacity="0.95"/>
    <path d="M176 224 L220 224 L236 320 L160 320 Z" fill="${palette.light}" opacity="0.94"/>
    <path d="M110 270 L58 302 L104 314 Z" fill="${palette.accentSoft}" opacity="0.9"/>
    <path d="M286 270 L338 302 L292 314 Z" fill="${palette.accentSoft}" opacity="0.9"/>
    <circle cx="72" cy="94" r="8" fill="${palette.light}"/>
    <circle cx="328" cy="114" r="10" fill="${palette.light}"/>
    <circle cx="304" cy="56" r="6" fill="${palette.light}"/>
  </g>`;
    case "resilience":
      return `
  <g transform="translate(${396 + sx} ${564 + sy})">
    <circle cx="204" cy="72" r="44" fill="${palette.accent}" opacity="0.44"/>
    <path d="M24 292 L132 144 L208 248 L296 114 L388 292 Z" fill="${palette.accentSoft}" opacity="0.82"/>
    <path d="M84 292 L168 186 L226 260 L302 172 L360 292 Z" fill="${palette.accent}" opacity="0.82"/>
    <path d="M34 292 H378" stroke="${palette.light}" stroke-width="12" stroke-linecap="round" opacity="0.8"/>
    <path d="M196 146 L210 166 L232 170 L216 186 L220 208 L198 196 L176 208 L180 186 L164 170 L186 166 Z" fill="${palette.light}" opacity="0.9"/>
  </g>`;
    case "thinking":
    default:
      return `
  <g transform="translate(${396 + sx} ${558 + sy})">
    <rect x="20" y="36" width="364" height="324" rx="26" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <g stroke="${palette.accent}" stroke-width="8" opacity="0.86">
      <line x1="82" y1="92" x2="184" y2="146"/>
      <line x1="184" y1="146" x2="286" y2="108"/>
      <line x1="184" y1="146" x2="168" y2="248"/>
      <line x1="168" y1="248" x2="286" y2="288"/>
      <line x1="286" y1="108" x2="286" y2="288"/>
      <line x1="82" y1="92" x2="90" y2="232"/>
      <line x1="90" y1="232" x2="168" y2="248"/>
    </g>
    <g fill="${palette.ink}">
      <circle cx="82" cy="92" r="14"/>
      <circle cx="184" cy="146" r="14"/>
      <circle cx="286" cy="108" r="14"/>
      <circle cx="90" cy="232" r="14"/>
      <circle cx="168" cy="248" r="14"/>
      <circle cx="286" cy="288" r="14"/>
    </g>
  </g>`;
  }
}

function createCoverSvg(pkg) {
  const id = pkg.book.bookId;
  const theme = chooseCoverTheme(pkg.book);
  const meta = COVER_THEME_META[theme] || COVER_THEME_META.thinking;
  const seed = hash(`${id}|${pkg.book.author}|${pkg.book.title}|${theme}`);
  const palette = meta.palettes[hash(`${id}|${theme}`) % meta.palettes.length];
  const layoutVariant = hash(`${pkg.book.title}|${pkg.book.author}`) % 5;
  const gradId = `g${hash(`${id}-${theme}`)}`;
  const author = cleanSpaces(pkg.book.author).toUpperCase();
  const titleLines = splitTitle(pkg.book.title);
  const fontSize = titleFontSize(titleLines);
  const keywordText = keywordLine(pkg.book, meta.label);
  const lineGap = Math.round(fontSize * 1.08);
  const firstLineY = titleLines.length === 1 ? 1216 : titleLines.length === 2 ? 1162 : 1114;
  const titleSvg = titleLines
    .map((line, index) => {
      const y = firstLineY + index * lineGap;
      return `  <text x="600" y="${y}" text-anchor="middle" fill="${palette.ink}" font-family="${meta.titleFont}" font-size="${fontSize}" font-weight="700" letter-spacing="2">${esc(line)}</text>`;
    })
    .join("\n");

  return `<svg width="1200" height="1800" viewBox="0 0 1200 1800" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${esc(pkg.book.title)} cover</title>
  <desc id="desc">Auto-generated themed cover for ${esc(pkg.book.title)} by ${esc(pkg.book.author)}.</desc>
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1800" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${palette.bgTop}"/>
      <stop offset="100%" stop-color="${palette.bgBottom}"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="1800" fill="url(#${gradId})"/>
${renderCoverLayout(layoutVariant, palette, seed)}
  <rect x="116" y="304" width="968" height="1036" rx="38" fill="${palette.panel}" stroke="${palette.panelStroke}" stroke-width="10"/>
${renderThemeSymbol(theme, palette, seed)}

  <rect x="0" y="0" width="1200" height="238" fill="${palette.bgTop}" opacity="0.93"/>
  <rect x="0" y="1454" width="1200" height="346" fill="${palette.bgBottom}" opacity="0.95"/>
  <text x="600" y="136" text-anchor="middle" fill="${palette.light}" font-family="Georgia, serif" font-size="62" font-weight="700" letter-spacing="3">${esc(author)}</text>
  <text x="600" y="208" text-anchor="middle" fill="${palette.light}" font-family="'Trebuchet MS', Arial, sans-serif" font-size="30" letter-spacing="4">${esc(meta.label)}</text>
${titleSvg}
  <text x="600" y="1538" text-anchor="middle" fill="${palette.light}" font-family="'Trebuchet MS', Arial, sans-serif" font-size="30" letter-spacing="3">${esc(keywordText)}</text>
  <text x="600" y="1604" text-anchor="middle" fill="${palette.light}" font-family="Georgia, serif" font-size="30">${esc(meta.subtitle)}</text>
  <text x="600" y="1668" text-anchor="middle" fill="${palette.light}" font-family="'Trebuchet MS', Arial, sans-serif" font-size="26" letter-spacing="2">Modern Edition · Practical Lessons · Real Scenarios</text>
</svg>
`;
}

function hasCover(bookId) {
  return COVER_EXTS.some((ext) => fs.existsSync(path.join(BOOK_COVERS_DIR, `${bookId}${ext}`)));
}

function polishPackageFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const pkg = JSON.parse(raw);
  let touched = false;
  let chapterFixes = 0;
  let exampleFixes = 0;
  let questionFixes = 0;

  for (const chapter of pkg.chapters || []) {
    const anchor = chooseAnchor(chapter);

    if (Array.isArray(chapter.examples)) {
      for (const example of chapter.examples) {
        const original = JSON.stringify(example);
        const leadName = extractLeadName(example.scenario || "");

        example.scenario = polishText(fixNameVerbAgreement(example.scenario || "", leadName));
        example.whatToDo = (example.whatToDo || []).map((step) => polishText(fixNameVerbAgreement(step, leadName)));
        example.whyItMatters = polishText(fixNameVerbAgreement(example.whyItMatters || "", leadName));
        example.contexts = normalizeContexts(example.contexts);

        const relevant = hasChapterRelevance(chapter, [
          example.scenario,
          ...(example.whatToDo || []),
          example.whyItMatters || "",
        ]);
        if (!relevant) {
          example.whyItMatters = polishText(
            `${example.whyItMatters} This scenario is directly connected to ${cleanSpaces(chapter.title).toLowerCase()}.`
          );
        }

        if (JSON.stringify(example) !== original) {
          touched = true;
          exampleFixes += 1;
        }
      }
    }

    const processQuestions = (questions, retry = false) => {
      if (!Array.isArray(questions)) return;
      questions.forEach((question, index) => {
        const before = JSON.stringify(question);
        question.prompt = buildPrompt(chapter.title, anchor, index, retry);
        question.choices = (question.choices || []).map((choice) => polishChoice(choice));
        if (!Number.isInteger(question.correctIndex)) {
          question.correctIndex = 0;
        }
        question.correctIndex = Math.max(
          0,
          Math.min(question.correctIndex, Math.max(0, (question.choices?.length || 1) - 1))
        );
        if (JSON.stringify(question) !== before) {
          touched = true;
          questionFixes += 1;
        }
      });
    };

    processQuestions(chapter.quiz?.questions, false);
    processQuestions(chapter.quiz?.retryQuestions, true);

    chapterFixes += 1;
  }

  if (touched) {
    fs.writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }

  return {
    touched,
    chapterFixes,
    exampleFixes,
    questionFixes,
    package: pkg,
  };
}

function main() {
  const files = fs
    .readdirSync(BOOK_PACKAGES_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(BOOK_PACKAGES_DIR, name));

  let touchedBooks = 0;
  let touchedExamples = 0;
  let touchedQuestions = 0;
  let coversGenerated = 0;

  for (const filePath of files) {
    const result = polishPackageFile(filePath);
    if (result.touched) {
      touchedBooks += 1;
      touchedExamples += result.exampleFixes;
      touchedQuestions += result.questionFixes;
    }

    const bookId = result.package?.book?.bookId;
    if (bookId && (FORCE_REGEN_COVERS || !hasCover(bookId))) {
      fs.writeFileSync(
        path.join(BOOK_COVERS_DIR, `${bookId}.svg`),
        createCoverSvg(result.package),
        "utf8"
      );
      coversGenerated += 1;
    }
  }

  const missingCoverIds = [];
  for (const filePath of files) {
    const pkg = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!hasCover(pkg.book.bookId)) {
      missingCoverIds.push(pkg.book.bookId);
    }
  }

  console.log(
    JSON.stringify(
      {
        scannedBooks: files.length,
        touchedBooks,
        touchedExamples,
        touchedQuestions,
        coversGenerated,
        missingCovers: missingCoverIds.length,
        missingCoverIds,
      },
      null,
      2
    )
  );
}

main();
