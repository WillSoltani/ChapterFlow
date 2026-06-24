/**
 * Pure, dependency-free moderation helpers for user-submitted community
 * scenarios — no `server-only`, no AWS, no Anthropic — so they are unit-testable
 * under `tsx --test` and run identically on every surface.
 *
 * Two concerns live here:
 *
 *  1. **Prompt-injection hardening** (`wrapUntrustedField`): user fields are
 *     concatenated into the moderation model's user message. We wrap each field
 *     in an explicit, named delimiter and strip any literal closing delimiter the
 *     user typed, so a submission can't terminate its own block early and smuggle
 *     instructions into the surrounding prompt. The system prompt (in
 *     `ai-service.ts`) tells the model to treat delimited contents strictly as
 *     DATA, never as instructions.
 *
 *  2. **Deterministic pre-filter** (`prefilterScenario`): a cheap, code-only
 *     check that runs BEFORE the model call. A hit routes the submission to
 *     human review (`queue_for_review`) — NEVER an auto-reject — preserving the
 *     existing conservative fail-safe-to-queue bias. It catches the obvious
 *     abuse the model shouldn't be paying tokens to adjudicate: links, a small
 *     inline blocklist, and degenerate repetition/gibberish.
 */

// ── Prompt-injection delimiting ──────────────────────────────────────────────

/**
 * Wrap an untrusted user field in a named, delimiter-stripped block.
 * `tag` is a stable label (e.g. "user_scenario"). Any literal `<user_*>` /
 * `</user_*>` delimiter the user typed — this field's OWN tag or a sibling
 * field's — is neutralized so they can't forge a block boundary or close a
 * neighbouring block early. The strip is whitespace-tolerant and
 * case-insensitive. This is best-effort delimiter strip, not a hard guarantee;
 * the model is also instructed (system prompt) to treat everything between the
 * tags as DATA.
 */
export function wrapUntrustedField(tag: string, value: string): string {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  // Strip ALL `user_*` delimiters (this field's and any sibling's), tolerant of
  // surrounding whitespace and case, so the content can't close its own block
  // early or forge a sibling boundary. The whitespace tolerance must include a
  // gap BETWEEN "<" and the "/" of a closing tag — "< /user_scenario>" is just as
  // forge-able as "</user_scenario>" (C12) — so allow `\s*` on BOTH sides of the
  // optional slash.
  const escaped = value.replace(/<\s*\/?\s*user_[a-z_]*\s*>/gi, "");
  return `${open}\n${escaped}\n${close}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Deterministic pre-filter ─────────────────────────────────────────────────

export type PrefilterReason =
  | "contains_link"
  | "blocklisted_term"
  | "excessive_repetition"
  | "low_diversity_gibberish";

export interface PrefilterResult {
  /** True when at least one deterministic check fired. */
  flagged: boolean;
  /** Distinct reasons, sorted for stable metric dimensions / assertions. */
  reasons: PrefilterReason[];
}

export interface PrefilterInput {
  title: string;
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
}

// URLs / links / bare domains. Conservative: matches an explicit scheme, a
// www.-prefixed host, or a host.tld followed by a path/query — enough to catch
// spam links without flagging ordinary "e.g." / "etc." prose. Markdown link
// syntax is caught via the bracket-paren form too.
// The TLD group includes common URL-shortener / abused TLDs (ly, me, gg, app,
// to, gl, tk) so bit.ly, t.me, discord.gg and bare .ly/.me/.gg/.app hosts are
// caught. A pre-filter hit only routes to queue_for_review (never a reject), so
// erring toward over-matching here is acceptable.
//
// Three alternatives with DIFFERENT case rules (no /i flag — case is encoded per
// alternative so it can't bleed across them):
//  1. explicit scheme / www. — case-INsensitive (URLs may be typed "HTTP://").
//  2. host.tld FOLLOWED BY A PATH (/?#) — case-INsensitive: a trailing path is a
//     strong link signal, so "Bit.Ly/scam" / "SPAM.SHOP/buy" must still match
//     even though they carry uppercase (a false-NEGATIVE here would let a spam
//     link evade the deterministic backstop entirely).
//  3. bare host.tld with NO path — case-SENSITIVE lowercase + a curated TLD list:
//     real shortened links are lowercase (bit.ly, spam.shop), whereas an ordinary
//     sentence boundary like "deadline.To be honest" / "app.Co-workers" has an
//     UPPERCASE next-sentence word and (lacking a path) must NOT read as a domain
//     (C10). The path requirement on alt 2 is what keeps prose out of it: prose
//     reads "word.Word be honest", not "word.Word/...".
const LINK_RE =
  /\b(?:[Hh][Tt][Tt][Pp][Ss]?:\/\/|[Ww][Ww][Ww]\.)\S+|\b[A-Za-z0-9][A-Za-z0-9-]*\.[A-Za-z]{2,}[/?#]\S*|\b[a-z0-9][a-z0-9-]*\.(?:com|net|org|io|co|info|biz|xyz|ru|cn|link|click|shop|store|ly|me|gg|app|to|gl|tk)\b/;
const MARKDOWN_LINK_RE = /\]\(\s*(?:https?:\/\/|www\.)/i;

// Small inline blocklist (no env injection point — deliberately code-only so it
// can't be silently weakened in prod). Word-boundary matched, case-insensitive.
// Kept intentionally small and obvious; the model handles nuanced moderation.
// A hit only ROUTES TO REVIEW — it never auto-rejects.
const BLOCKLIST = [
  // Spam / promo
  "viagra",
  "cialis",
  "casino",
  "crypto airdrop",
  "free money",
  "make money fast",
  "click here",
  "buy now",
  "promo code",
  // Slurs / hate / explicit — minimal seed; the model is the real moderator.
  "fuck",
  "shit",
  "bitch",
  "nigger",
  "faggot",
  "rape",
  "porn",
];

// Chars that may appear in an email local-part (RFC-5321 dot-atom subset) — used
// to scan backward from a matched host to decide whether the host is the domain
// part of an email address. Hosts also use [a-z0-9.-] label chars, so the
// backward scan accepts label chars too before requiring an '@'.
const EMAIL_LOCALPART_CHARS = /[A-Za-z0-9._%+-]/;

/**
 * Decide whether a matched host is the domain of an email address (so it should
 * NOT count as a link). The regex match can begin at ANY label of a subdomained
 * host (e.g. it may start at "company.com" inside "alex@mail.company.com"), so a
 * single-char "@ immediately before" check is insufficient (C11/C13).
 *
 * We scan backward from the match start over the host's own label chars and the
 * email local-part charset, looking for an '@' that introduces a plausible
 * local-part. The match is treated as an email ONLY when:
 *   - such an '@' exists with at least one local-part char before the host, AND
 *   - the matched host is NOT followed by a path/query/fragment.
 * The trailing-path exclusion is what keeps a disguised link like
 * "x@spam.shop/buy-now" flagged: the "@local-part" shape is present, but the
 * "/buy-now" tail marks it as a link, not an address.
 */
function matchIsEmailAddress(text: string, matchStart: number, matchEnd: number): boolean {
  // A real email host has no trailing path/query/fragment. If the match captured
  // one (e.g. "spam.shop/buy-now"), it's a disguised link, never an address.
  const matched = text.slice(matchStart, matchEnd);
  if (/[/?#]/.test(matched)) return false;
  // Also reject if a path/query/fragment immediately follows the matched host.
  const nextChar = matchEnd < text.length ? text[matchEnd] : "";
  if (nextChar === "/" || nextChar === "?" || nextChar === "#") return false;

  // Walk backward over host-label / local-part chars (a subdomained host like
  // mail.company.* may sit between the '@' and the matched label) until we reach
  // an '@' or leave the charset.
  let i = matchStart - 1;
  while (i >= 0 && EMAIL_LOCALPART_CHARS.test(text[i])) i--;
  // For this to be an email, the boundary char must be '@' AND there must be at
  // least one local-part char immediately before that '@' (so "@host" alone, with
  // no addressee, is NOT treated as an address).
  if (i < 0 || text[i] !== "@") return false;
  const beforeAt = i - 1;
  return beforeAt >= 0 && EMAIL_LOCALPART_CHARS.test(text[beforeAt]);
}

function containsLink(text: string): boolean {
  if (MARKDOWN_LINK_RE.test(text)) return true;
  // Scan all LINK_RE matches; ignore any that is the domain part of an email
  // address (e.g. alex@mail.company.com), but NOT a disguised "@host/path" link.
  // LINK_RE is case-sensitive by design (bare-domain alt is lowercase-only), so
  // we add only the global flag here — adding 'i' would resurrect the C10 false
  // positives on ".To"/".Co"/".Me" sentence boundaries.
  const re = new RegExp(LINK_RE.source, "g");
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    if (matchIsEmailAddress(text, m.index, m.index + m[0].length)) continue;
    return true;
  }
  return false;
}

function containsBlocklisted(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKLIST.some((term) => {
    // Word-boundary match for single tokens; substring for multi-word phrases.
    if (/\s/.test(term)) return lower.includes(term);
    return new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(lower);
  });
}

/**
 * Excessive repetition: the same token repeated many times (e.g. "test test test
 * test …") or a single token dominating a long body. Conservative thresholds so
 * legitimate prose (which repeats common words a little) never trips it.
 */
function hasExcessiveRepetition(text: string): boolean {
  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length < 12) return false; // too short to judge confidently

  // (a) A long run of the identical token in a row.
  let run = 1;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === tokens[i - 1]) {
      run++;
      if (run >= 6) return true;
    } else {
      run = 1;
    }
  }

  // (b) One token makes up an implausible share of a long body.
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  let max = 0;
  for (const c of counts.values()) if (c > max) max = c;
  if (max / tokens.length > 0.5) return true;

  return false;
}

/**
 * Low lexical diversity over a long body = gibberish / lorem-ipsum / mashed keys.
 * Distinct-token ratio well below normal prose, evaluated only once the body is
 * long enough for the ratio to be meaningful.
 */
function isLowDiversityGibberish(text: string): boolean {
  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length < 25) return false;
  const distinct = new Set(tokens).size;
  // Natural English over 25+ words stays comfortably above ~0.35 unique. Below
  // 0.2 is degenerate repetition the model shouldn't pay to read.
  return distinct / tokens.length < 0.2;
}

/**
 * Run all deterministic checks over the combined user-authored text. Pure and
 * side-effect-free. The caller routes any `flagged` result to `queue_for_review`
 * and emits a `ScenarioPrefilterHit` ops metric — it must NEVER auto-reject on a
 * pre-filter hit (conservative fail-safe-to-queue bias).
 */
export function prefilterScenario(input: PrefilterInput): PrefilterResult {
  const combined = [
    input.title,
    input.scenario,
    input.whatToDo,
    input.whyItMatters,
  ].join("\n");

  const reasons = new Set<PrefilterReason>();
  if (containsLink(combined)) reasons.add("contains_link");
  if (containsBlocklisted(combined)) reasons.add("blocklisted_term");
  if (hasExcessiveRepetition(combined)) reasons.add("excessive_repetition");
  if (isLowDiversityGibberish(combined)) reasons.add("low_diversity_gibberish");

  return {
    flagged: reasons.size > 0,
    reasons: [...reasons].sort(),
  };
}
