/**
 * leadAliases (IMP-09, F-016/D7) — compiler-derived lead/case alias sets and
 * Unicode-aware presence matching for the D7 lead-thread contract.
 *
 * The pre-IMP-09 D7 reduced a dealt case label to its FIRST capitalized ASCII
 * token ("Vincent van Gogh" → "Vincent") and regex-searched that one token.
 * R2 (docs/v24/V24_FRESH_SCENE_ORIGIN_GOLD_RUN_REPORT.md:84,176) documents the
 * false-negative class: writers legitimately use surnames ("Van Gogh",
 * "Malamud"), diacritics fall outside [A-Z], lowercase particles (van/de/al-)
 * break token shape, and concept leads can yield NO token (check silently
 * skipped).
 *
 * The replacement is a NORMALIZED ALIAS SET derived ONLY from the dealt label
 * (source metadata — the case label the compiler dealt): full label, family
 * name with particles attached, given name, per-token names, diacritic-folded
 * twins, and the concept label itself for concept leads. NOTHING is inferred
 * or model-generated (plan instruction 14) — every alias is a deterministic
 * projection of the label string, reviewable in one screen of code. Matching
 * normalizes case/diacritics/punctuation variants (possessives, curly
 * apostrophes, hyphen↔space) but never word choice, so a genuine
 * missing-thread chapter still fails: if NO form of the dealt name appears,
 * there is no alias to match.
 *
 * Pure functions; no io, no env, no config — hostile artifact text cannot
 * influence them (instruction 13), and there is nowhere for a book-specific
 * alias list to hide (instruction 11's static test greps this module).
 */

/** Sentence-shape words that must never count as a name token (the old D7's
 *  stopword list, widened with the sourceGrounding set's sentence starters). */
const NAME_TOKEN_STOPWORDS = new Set([
  "the", "this", "that", "when", "what", "from", "into", "with", "and",
  "study", "case", "effect", "rule", "principle", "experiment", "project",
  "story", "team", "group", "school", "method", "model", "theory", "problem",
]);

/** Lowercase name particles that attach to the FOLLOWING token to form a
 *  family name ("van Gogh", "de la Cruz", "al-Khwarizmi", "von Neumann"). */
const NAME_PARTICLES = new Set(["van", "von", "de", "der", "den", "del", "della", "di", "da", "la", "le", "al", "bin", "ibn", "ter", "ten"]);

/** NFD-based diacritic fold ("Gödel" → "Godel", "Ólafur" → "Olafur"). */
export function foldDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Case-KEEPING normalization: diacritic fold, curly→straight apostrophes,
 *  hyphens→space, whitespace collapse. */
export function normalizeKeepCase(s: string): string {
  return foldDiacritics(s)
    .replace(/[’‘‛′]/g, "'")
    .replace(/[–—−-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalization for MATCHING (both haystack and needle): diacritic fold,
 *  curly→straight apostrophes, hyphens→space, whitespace collapse, lowercase.
 *  Forgiving on presentation only — never on word choice. */
export function normalizeForNameMatch(s: string): string {
  return normalizeKeepCase(s).toLowerCase();
}

/** A token counts as name-shaped when it is ≥3 chars, made of letters plus
 *  name punctuation, contains an UPPERCASE letter in ANY script at a word
 *  start — including AFTER a hyphen or apostrophe ("al-Khwarizmi",
 *  "O'Malley") — and is not a sentence-shape stopword. */
function isNameShapedToken(tok: string): boolean {
  return tok.length >= 3
    && /^[\p{L}'’-]+$/u.test(tok)
    && /(?:^|[-'’])\p{Lu}/u.test(tok)
    && !NAME_TOKEN_STOPWORDS.has(tok.toLowerCase());
}

/**
 * Derive the reviewable alias set for a dealt lead label.
 *
 * For a PERSON/ENTITY-shaped label ("Vincent van Gogh", "Bernard Malamud",
 * "José Raúl Capablanca", "the Wright brothers"):
 *   - the full label (minus a leading article);
 *   - the FAMILY NAME with its particles ("van Gogh", "al-Khwarizmi");
 *   - each name-shaped token ("Vincent", "Gogh" alone is NOT emitted — the
 *     family alias keeps particles so "Gogh" without "van" still matches via
 *     the token "Gogh"? No: bare last token IS emitted, matching normalizes
 *     hyphens/case, and a false hit on a 3-char common word is prevented by
 *     the stopword + name-shape filters).
 * For a CONCEPT label with no name-shaped token ("the 10,000-hour study"):
 *   - the label itself (normalized matching handles punctuation variants).
 *
 * Deduplicated, order-stable, all non-empty. NEVER infers nicknames,
 * translations, or abbreviations that are not substrings of the label.
 */
export function leadAliasSet(label: string): string[] {
  const cleaned = label.trim().replace(/^(the|a|an)\s+/i, "");
  const out: string[] = [];
  const push = (alias: string): void => {
    const a = alias.trim();
    if (a.length >= 3 && !out.some((x) => normalizeForNameMatch(x) === normalizeForNameMatch(a))) out.push(a);
  };
  push(cleaned);
  const tokens = cleaned.split(/\s+/);
  // Family name with particles: walk back from the last name-shaped token,
  // absorbing contiguous preceding particles ("van", "de la").
  let lastNameIdx = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (isNameShapedToken(tokens[i])) { lastNameIdx = i; break; }
  }
  if (lastNameIdx >= 0) {
    let start = lastNameIdx;
    while (start > 0 && NAME_PARTICLES.has(tokens[start - 1].toLowerCase())) start--;
    push(tokens.slice(start, lastNameIdx + 1).join(" "));
    push(tokens[lastNameIdx]);
  }
  // Every name-shaped token is an alias (given names, org words) — the honest
  // per-token set the old first-token pick was an arbitrary sample of.
  for (const tok of tokens) {
    if (isNameShapedToken(tok)) push(tok.replace(/[’']s$/i, ""));
  }
  return out;
}

/** Unicode-aware whole-word presence: does `text` contain `alias` as a word
 *  sequence (never a mid-word substring), tolerating diacritics, possessives
 *  ("Malamud's"), and hyphen/space variation? Pure; deterministic.
 *
 *  CASE RULE: a MULTI-WORD alias ("van Gogh", "10,000 hour study") matches
 *  case-insensitively — the word sequence itself is distinctive. A
 *  SINGLE-TOKEN alias ("Airlines", "Willow", "Neocortex") matches
 *  case-SENSITIVELY, exactly like the pre-IMP-09 token matcher: otherwise the
 *  generic lowercase word ("the airlines flew") would satisfy an organization
 *  alias — the acronym/common-term red-team collision. */
export function aliasPresent(text: string | undefined, alias: string): boolean {
  if (!text || !alias) return false;
  const needleKC = normalizeKeepCase(alias);
  if (needleKC.length === 0) return false;
  const multiWord = needleKC.includes(" ");
  const hay = multiWord ? normalizeForNameMatch(text) : normalizeKeepCase(text);
  const needle = multiWord ? needleKC.toLowerCase() : needleKC;
  let from = 0;
  while (true) {
    const at = hay.indexOf(needle, from);
    if (at < 0) return false;
    const before = at === 0 ? "" : hay[at - 1];
    let end = at + needle.length;
    // Tolerate a trailing possessive ('s or bare ') before the boundary test.
    if (hay.startsWith("'s", end) || hay.startsWith("'S", end)) end += 2;
    else if (hay[end] === "'") end += 1;
    const after = end >= hay.length ? "" : hay[end];
    const isBoundary = (ch: string) => ch === "" || !/[\p{L}\p{N}]/u.test(ch);
    if (isBoundary(before) && isBoundary(after)) return true;
    from = at + 1;
  }
}

/** True when ANY alias is present in the text. */
export function anyAliasPresent(text: string | undefined, aliases: readonly string[]): boolean {
  return aliases.some((a) => aliasPresent(text, a));
}
