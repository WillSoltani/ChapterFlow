/** The cover step. The session that runs a book asks an image model for the cover with the Higgsfield CLI, which this
 *  tool does not call, so the tool does the two ends only: it writes the prompt (a fixed recipe plus the session's one-sentence picture
 *  and an art direction from a short list), and it turns the image that comes back into the 600x900 WebP and AVIF pair
 *  the web app ships. No model call and no network call happen here.
 *
 *  The ledger (covers.json next to cli.ts) records each book's picture and art direction, so a catalogue does not end up
 *  with twenty covers in one style: a book without an explicit style gets the one the fewest other books use.
 *
 *  Where the files go: <runDir>/cover/ keeps everything (prompt, brief, source, both rasters), and the tool repo's
 *  public/book-covers/ gets the pair, since the publish step's register script uploads <REPO_ROOT>/public/book-covers/
 *  <bookId>.webp to the live store and the site step carries the pair into the checkout of main. */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { Sharp } from "sharp";
import { loadPrompt, renderTemplate } from "./prompts";
import { REPO_ROOT } from "./publish";

/** The art directions, in the order a tie is broken. Every one renders the picture realistically (a photograph, or a
 *  painting true to life): the owner asked for covers that look somewhat realistic after seeing the first flat ones. */
export const COVER_STYLES: ReadonlyArray<readonly [string, string]> = [
  ["painted-still-life", "A painted still life, true to life in the manner of a realist oil painting: the subject lit from one side, its surroundings falling into deep shadow, fine brushwork, a few rich deep colours, with the title in a warm metallic serif."],
  ["studio-object", "A studio photograph of the subject: soft light from one side, a gentle natural shadow, true materials and texture, and where the picture names no setting a seamless backdrop of one muted colour, with the title in a clean modern serif."],
  ["miniature-scene", "A photograph inside a finely made miniature world: the model fills the whole frame edge to edge, real materials at small scale, soft light, shallow tilt-shift depth of field, no base, plinth, table edge or label in view, with the title in a friendly serif."],
  ["mono-photo", "A black-and-white fine-art photograph: every colour the picture names rendered as a tone of grey, deep contrast, a little film grain, plenty of dark empty space, with the title in an elegant serif set in one strong warm colour, the only colour on the cover."],
  ["dusk-scene", "A photograph at dusk with the light of a film still: one warm light source against deep blue, real atmosphere and depth, the background soft and quiet, with the title in clean, widely spaced capitals."],
  ["daylight-photo", "A natural-light photograph: the real subject in soft early daylight, true colours, shallow depth of field so the background falls away into a quiet blur, with the title in a bold clean sans-serif."],
];

/** What the session passes to the Higgsfield CLI (`higgsfield generate create`). The tool only records and prints it.
 *  Measured 2026-11-12 on the owner's plan, where every CLI generation spends credits (the plan's unlimited allowance
 *  does not apply there): this model at 2k costs 0.5 credits a try at quality low and 1 at medium, and gave a clean,
 *  correctly lettered cover at low; gpt_image_2 at 2k high costs 6.5 for a slightly finer texture. */
export const COVER_GENERATION = {
  model: "gpt_image_2_6",
  aspectRatio: "2:3",
  resolution: "2k",
  quality: "low",
  retryQuality: "medium",
} as const;

/** The command a session runs for one image: it blocks until the job is done and prints JSON whose `result_url` is the image. */
export function coverCommand(promptFile: string, quality: string = COVER_GENERATION.quality): string {
  const g = COVER_GENERATION;
  return `higgsfield generate create ${g.model} --prompt "$(cat '${promptFile}')" --aspect_ratio ${g.aspectRatio} --resolution ${g.resolution} --quality ${quality} --wait --json`;
}

/** scripts/book/v26/covers.json: one entry per book, shared by every run. */
export const COVER_LEDGER: string = fileURLToPath(new URL("../covers.json", import.meta.url));
/** The tool repo's cover folder, which the publish step uploads from. */
export const DEFAULT_COVERS_DIR: string = path.join(REPO_ROOT, "public/book-covers");

/** The app's spec (public/book-covers/README.md on main) and its test's floor for a real raster. */
export const COVER_WIDTH = 600;
export const COVER_HEIGHT = 900;
const WEBP_QUALITY = 82;
const AVIF_QUALITY = 55;
const MIN_WEBP_BYTES = 2000;
const MIN_AVIF_BYTES = 1000;
/** Portrait 2:3 is 0.667; a little either way survives the crop, a square or landscape image loses its title in it. */
const MIN_ASPECT = 0.6;
const MAX_ASPECT = 0.74;
const MAX_CONCEPT_WORDS = 60;

export interface CoverCtx {
  config: { bookId: string; runDir: string; title: string; author: string };
}

export interface CoverEntry {
  concept: string;
  style: string;
  at: string;
}
export type CoverLedger = Record<string, CoverEntry>;

const coverDir = (ctx: CoverCtx): string => path.join(ctx.config.runDir, "cover");
const styleDescription = (name: string): string | undefined => COVER_STYLES.find(([n]) => n === name)?.[1];

export function readCoverLedger(file: string = COVER_LEDGER): CoverLedger {
  if (!fs.existsSync(file)) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`COVER_LEDGER_INVALID: ${file} is not valid JSON (${(e as Error).message}); fix or remove it`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`COVER_LEDGER_INVALID: ${file} is not a JSON object`);
  return raw as CoverLedger;
}

function writeCoverLedger(file: string, ledger: CoverLedger): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + "\n");
}

/** Each style with the number of books that use it, fewest first (ties in list order), leaving out one book's own entry. */
export function styleCounts(ledger: CoverLedger, exceptBookId?: string): Array<{ style: string; description: string; count: number }> {
  const counts = COVER_STYLES.map(([style, description]) => ({ style, description, count: 0 }));
  for (const [id, e] of Object.entries(ledger)) {
    if (id === exceptBookId) continue;
    const row = counts.find((c) => c.style === e.style);
    if (row) row.count++;
  }
  // Array.prototype.sort is stable, so equal counts keep the list's order.
  return counts.sort((a, b) => a.count - b.count);
}

/** The prompt for the image model. The title and author sit inside double quotes there, so theirs become single quotes. */
export function coverPrompt(p: { title: string; author: string; concept: string; style: string }): string {
  const description = styleDescription(p.style);
  if (description === undefined) throw unknownStyle(p.style);
  // renderTemplate refuses a placeholder a value brings in; say which field did it instead of a bare TEMPLATE_UNFILLED.
  for (const [field, value] of [["title", p.title], ["author", p.author], ["concept", p.concept]] as const) {
    if (TOKEN.test(value)) throw new Error(`COVER_${field === "concept" ? "CONCEPT" : "TITLE"}_INVALID: the ${field} contains a template token (${value.match(TOKEN)![0]})`);
  }
  const unquote = (s: string): string => s.replace(/"/g, "'");
  return renderTemplate(loadPrompt("cover"), { TITLE: unquote(p.title), AUTHOR: unquote(p.author), CONCEPT: p.concept, STYLE: description });
}

/** The prompt's placeholder form (src/prompts.ts); a value carrying one would make the render fail. */
const TOKEN = /@@[A-Z0-9_]+@@/;

const unknownStyle = (name: string): Error =>
  new Error(`COVER_STYLE_UNKNOWN: "${name}" is not a cover style (choose from ${COVER_STYLES.map(([n]) => n).join(", ")})`);

/** The picture in one sentence or two: trimmed, not empty, one line, at most 60 words. */
export function cleanConcept(concept: string): string {
  const c = concept.trim();
  if (c === "") throw new Error("COVER_CONCEPT_INVALID: the concept is empty; describe the one picture on the cover");
  if (/[\r\n]/.test(c)) throw new Error("COVER_CONCEPT_INVALID: the concept has a line break; give it on one line");
  const words = c.split(/\s+/).length;
  if (words > MAX_CONCEPT_WORDS) throw new Error(`COVER_CONCEPT_INVALID: the concept has ${words} words; keep it to ${MAX_CONCEPT_WORDS} (one bold picture, not a scene list)`);
  return c;
}

export interface CoverBrief {
  promptFile: string;
  briefFile: string;
  prompt: string;
  style: string;
}

/** Writes <runDir>/cover/prompt.txt and brief.json and records the book in the ledger (replacing its earlier entry). */
export function coverBrief(ctx: CoverCtx, opts: { concept: string; style?: string; ledgerPath?: string; now?: () => Date }): CoverBrief {
  const { bookId, title, author } = ctx.config;
  const concept = cleanConcept(opts.concept);
  const ledgerPath = opts.ledgerPath ?? COVER_LEDGER;
  const ledger = readCoverLedger(ledgerPath);
  const style = opts.style ?? styleCounts(ledger, bookId)[0]!.style;
  // An unknown style name is refused here (COVER_STYLE_UNKNOWN), before anything is written.
  const prompt = coverPrompt({ title, author, concept, style });
  const at = (opts.now?.() ?? new Date()).toISOString();

  const dir = coverDir(ctx);
  fs.mkdirSync(dir, { recursive: true });
  const promptFile = path.join(dir, "prompt.txt");
  const briefFile = path.join(dir, "brief.json");
  fs.writeFileSync(promptFile, prompt);
  fs.writeFileSync(briefFile, JSON.stringify({ bookId, title, author, concept, style, generation: COVER_GENERATION, at }, null, 2) + "\n");
  // Assigning an existing key keeps its place, so the file's order stays the order books first got a cover.
  ledger[bookId] = { concept, style, at };
  writeCoverLedger(ledgerPath, ledger);
  return { promptFile, briefFile, prompt, style };
}

export interface CoverStatus {
  styles: Array<{ style: string; description: string; count: number }>;
  entries: Array<{ bookId: string; style: string; concept: string }>;
}

/** Read-only: how much each style is used (the first is what a new book gets) and the pictures already taken. */
export function coverStatus(ctx: CoverCtx, opts: { ledgerPath?: string } = {}): CoverStatus {
  const ledger = readCoverLedger(opts.ledgerPath ?? COVER_LEDGER);
  return {
    styles: styleCounts(ledger, ctx.config.bookId),
    entries: Object.entries(ledger).map(([bookId, e]) => ({ bookId, style: e.style, concept: e.concept })),
  };
}

type SharpFn = (input?: Buffer | string) => Sharp;

/** sharp comes through the repo's node_modules (the web app's dependency, not this tool's), so it is loaded on demand. */
async function loadSharp(): Promise<SharpFn> {
  try {
    const m = (await import("sharp")) as unknown as { default?: SharpFn } & SharpFn;
    return m.default ?? m;
  } catch (e) {
    throw new Error(`COVER_NO_SHARP: sharp could not be loaded (${(e as Error).message.split("\n")[0]}); run npm ci in ${REPO_ROOT}`);
  }
}

export interface InstalledCover {
  bookId: string;
  webp: string;
  avif: string;
  coversWebp: string;
  coversAvif: string;
  source: string;
  webpBytes: number;
  avifBytes: number;
  sourceWidth: number;
  sourceHeight: number;
  at: string;
}

/** The returned image becomes the app's pair: checked, cropped to 600x900, encoded as the app's spec says, and written to
 *  <runDir>/cover/ (with the source kept) and to coversDir. Every refusal comes before the first write. */
export async function installCover(ctx: CoverCtx, opts: { image: string; coversDir?: string; now?: () => Date }): Promise<InstalledCover> {
  const { bookId } = ctx.config;
  const image = path.resolve(opts.image);
  if (!fs.existsSync(image) || !fs.statSync(image).isFile()) throw new Error(`COVER_IMAGE_MISSING: ${image} does not exist`);
  const input = fs.readFileSync(image);
  const sharp = await loadSharp();

  let meta: { width?: number; height?: number; orientation?: number; format?: string };
  try {
    meta = await sharp(input).metadata();
  } catch (e) {
    throw new Error(`COVER_IMAGE_UNREADABLE: ${image} is not an image sharp can decode (${(e as Error).message.split("\n")[0]})`);
  }
  // EXIF orientations 5-8 turn the picture a quarter: what a viewer sees has width and height swapped.
  const turned = (meta.orientation ?? 1) >= 5;
  const width = (turned ? meta.height : meta.width) ?? 0;
  const height = (turned ? meta.width : meta.height) ?? 0;
  if (width < COVER_WIDTH || height < COVER_HEIGHT) {
    throw new Error(`COVER_TOO_SMALL: ${image} is ${width}x${height}; a cover needs at least ${COVER_WIDTH}x${COVER_HEIGHT}`);
  }
  const ratio = width / height;
  if (ratio < MIN_ASPECT || ratio > MAX_ASPECT) {
    throw new Error(`COVER_ASPECT: ${image} is ${width}x${height} (width/height ${ratio.toFixed(2)}); the cover must be portrait 2:3 (0.67, between ${MIN_ASPECT.toFixed(2)} and ${MAX_ASPECT.toFixed(2)}), since the crop to 600x900 would cut the title off a square or landscape image`);
  }

  let webp: Buffer;
  let avif: Buffer;
  try {
    const sized = (): Sharp => sharp(input).rotate().resize(COVER_WIDTH, COVER_HEIGHT, { fit: "cover" });
    webp = await sized().webp({ quality: WEBP_QUALITY }).toBuffer();
    avif = await sized().avif({ quality: AVIF_QUALITY }).toBuffer();
  } catch (e) {
    throw new Error(`COVER_IMAGE_UNREADABLE: ${image} could not be decoded in full (${(e as Error).message.split("\n")[0]})`);
  }
  // The app's test floor: a raster this small is a blank or near-blank image, not a cover.
  if (webp.length <= MIN_WEBP_BYTES || avif.length <= MIN_AVIF_BYTES) {
    throw new Error(`COVER_TOO_LIGHT: the encoded cover is ${webp.length} bytes as WebP and ${avif.length} as AVIF; the app requires over ${MIN_WEBP_BYTES} and ${MIN_AVIF_BYTES}, so the image is blank or nearly so`);
  }

  const dir = coverDir(ctx);
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(image).toLowerCase() || (meta.format ? `.${meta.format}` : "");
  // A second install with another image replaces the first, whatever the old source's extension was.
  for (const f of fs.readdirSync(dir)) if (/^source(\.[^.]*)?$/.test(f)) fs.rmSync(path.join(dir, f), { force: true });
  const source = path.join(dir, `source${ext}`);
  // From the bytes already read: the image may be the kept source itself, which the loop above has just removed.
  fs.writeFileSync(source, input);
  const out = { webp: path.join(dir, `${bookId}.webp`), avif: path.join(dir, `${bookId}.avif`) };
  fs.writeFileSync(out.webp, webp);
  fs.writeFileSync(out.avif, avif);

  const coversDir = opts.coversDir ?? DEFAULT_COVERS_DIR;
  fs.mkdirSync(coversDir, { recursive: true });
  const coversWebp = path.join(coversDir, `${bookId}.webp`);
  const coversAvif = path.join(coversDir, `${bookId}.avif`);
  fs.writeFileSync(coversWebp, webp);
  fs.writeFileSync(coversAvif, avif);

  return {
    bookId,
    webp: out.webp,
    avif: out.avif,
    coversWebp,
    coversAvif,
    source,
    webpBytes: webp.length,
    avifBytes: avif.length,
    sourceWidth: width,
    sourceHeight: height,
    at: (opts.now?.() ?? new Date()).toISOString(),
  };
}
