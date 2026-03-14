export const OUTPUT_FORMATS = [
  "PNG",
  "JPG",
  "WebP",
  "GIF",
  "TIFF",
  "AVIF",
  "HEIC",
  "HEIF",
  "BMP",
  "ICO",
  "SVG",
  "PDF",
] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const IMAGE_OUTPUT_FORMATS = [
  "PNG",
  "JPG",
  "WebP",
  "GIF",
  "TIFF",
  "AVIF",
  "HEIC",
  "HEIF",
  "BMP",
  "ICO",
  "SVG",
] as const;

export type SourceFormatLabel =
  | "PNG"
  | "JPG"
  | "WebP"
  | "GIF"
  | "TIFF"
  | "AVIF"
  | "BMP"
  | "HEIC"
  | "HEIF"
  | "SVG"
  | "ICO"
  | "PDF"
  | "DOCX"
  | "PAGES"
  | "IMG";

export const INPUT_ONLY_FORMAT_LABELS = ["DOC", "DOCX", "PAGES"] as const;
export type InputOnlyFormatLabel = (typeof INPUT_ONLY_FORMAT_LABELS)[number];

const IMAGE_OUTPUTS_WITH_PDF: readonly OutputFormat[] = [
  "PNG",
  "JPG",
  "WebP",
  "GIF",
  "TIFF",
  "AVIF",
  "HEIC",
  "HEIF",
  "BMP",
  "ICO",
  "SVG",
  "PDF",
];

const DOCUMENT_IMAGE_OUTPUTS: readonly OutputFormat[] = [
  "PNG",
  "JPG",
  "WebP",
  "GIF",
  "TIFF",
  "AVIF",
  "BMP",
  "ICO",
  "SVG",
];

const DOCUMENT_OUTPUTS_WITH_PDF: readonly OutputFormat[] = [
  ...DOCUMENT_IMAGE_OUTPUTS,
  "PDF",
];

export const SOURCE_LABEL_OUTPUT_FORMATS: Record<SourceFormatLabel, readonly OutputFormat[]> = {
  PNG: IMAGE_OUTPUTS_WITH_PDF,
  JPG: IMAGE_OUTPUTS_WITH_PDF,
  WebP: IMAGE_OUTPUTS_WITH_PDF,
  GIF: IMAGE_OUTPUTS_WITH_PDF,
  TIFF: IMAGE_OUTPUTS_WITH_PDF,
  AVIF: IMAGE_OUTPUTS_WITH_PDF,
  BMP: IMAGE_OUTPUTS_WITH_PDF,
  HEIC: IMAGE_OUTPUTS_WITH_PDF,
  HEIF: IMAGE_OUTPUTS_WITH_PDF,
  SVG: IMAGE_OUTPUTS_WITH_PDF,
  ICO: IMAGE_OUTPUTS_WITH_PDF,
  PDF: DOCUMENT_IMAGE_OUTPUTS,
  DOCX: DOCUMENT_OUTPUTS_WITH_PDF,
  PAGES: DOCUMENT_OUTPUTS_WITH_PDF,
  IMG: IMAGE_OUTPUTS_WITH_PDF,
};

export const CONTENT_TYPE_OUTPUT_FORMATS: Record<string, readonly OutputFormat[]> = {
  "image/png": IMAGE_OUTPUTS_WITH_PDF,
  "image/x-png": IMAGE_OUTPUTS_WITH_PDF,
  "image/jpeg": IMAGE_OUTPUTS_WITH_PDF,
  "image/jpg": IMAGE_OUTPUTS_WITH_PDF,
  "image/pjpeg": IMAGE_OUTPUTS_WITH_PDF,
  "image/webp": IMAGE_OUTPUTS_WITH_PDF,
  "image/gif": IMAGE_OUTPUTS_WITH_PDF,
  "image/tiff": IMAGE_OUTPUTS_WITH_PDF,
  "image/x-tiff": IMAGE_OUTPUTS_WITH_PDF,
  "image/avif": IMAGE_OUTPUTS_WITH_PDF,
  "image/heic": IMAGE_OUTPUTS_WITH_PDF,
  "image/heif": IMAGE_OUTPUTS_WITH_PDF,
  "image/bmp": IMAGE_OUTPUTS_WITH_PDF,
  "image/x-bmp": IMAGE_OUTPUTS_WITH_PDF,
  "image/svg+xml": IMAGE_OUTPUTS_WITH_PDF,
  "image/x-icon": IMAGE_OUTPUTS_WITH_PDF,
  "image/vnd.microsoft.icon": IMAGE_OUTPUTS_WITH_PDF,
  "image/icon": IMAGE_OUTPUTS_WITH_PDF,
  "application/pdf": DOCUMENT_IMAGE_OUTPUTS,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": DOCUMENT_OUTPUTS_WITH_PDF,
  "application/msword": DOCUMENT_OUTPUTS_WITH_PDF,
  "application/vnd.apple.pages": DOCUMENT_OUTPUTS_WITH_PDF,
  "application/x-iwork-pages-sffpages": DOCUMENT_OUTPUTS_WITH_PDF,
};

export const UPLOAD_FILE_INPUT_ACCEPT =
  "image/*,.svg,.heic,.heif,.pdf,.doc,.docx,.pages,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.apple.pages,application/x-iwork-pages-sffpages";

export const SUPPORTED_UPLOAD_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "tif",
  "tiff",
  "avif",
  "heic",
  "heif",
  "bmp",
  "svg",
  "ico",
  "pdf",
  "doc",
  "docx",
  "pages",
] as const;

export const SUPPORTED_UPLOAD_FORMATS_TEXT =
  "PNG, JPG, WebP, GIF, TIFF, AVIF, HEIC/HEIF, BMP, SVG, ICO, PDF, DOC, DOCX, PAGES";

const DEFAULT_RECOMMENDATION_PRIORITY: readonly OutputFormat[] = [
  "PDF",
  "PNG",
  "JPG",
  "WebP",
  "HEIC",
  "HEIF",
  "AVIF",
  "BMP",
  "TIFF",
  "GIF",
  "SVG",
  "ICO",
];

const SOURCE_RECOMMENDATION_PRIORITY: Record<SourceFormatLabel, readonly OutputFormat[]> = {
  PNG: ["JPG", "WebP", "PDF", "HEIC", "HEIF", "ICO", "AVIF", "TIFF", "GIF", "BMP", "SVG", "PNG"],
  JPG: ["PNG", "WebP", "PDF", "HEIC", "HEIF", "TIFF", "AVIF", "GIF", "BMP", "ICO", "SVG", "JPG"],
  WebP: ["JPG", "PNG", "PDF", "HEIC", "HEIF", "TIFF", "AVIF", "GIF", "BMP", "ICO", "SVG", "WebP"],
  GIF: ["PNG", "WebP", "JPG", "PDF", "HEIC", "HEIF", "AVIF", "TIFF", "BMP", "ICO", "SVG", "GIF"],
  TIFF: ["PDF", "JPG", "PNG", "WebP", "HEIC", "HEIF", "AVIF", "GIF", "BMP", "ICO", "SVG", "TIFF"],
  AVIF: ["JPG", "PNG", "PDF", "WebP", "HEIC", "HEIF", "TIFF", "BMP", "GIF", "ICO", "SVG", "AVIF"],
  BMP: ["PNG", "JPG", "WebP", "PDF", "HEIC", "HEIF", "AVIF", "TIFF", "GIF", "ICO", "SVG", "BMP"],
  HEIC: ["PDF", "JPG", "PNG", "WebP", "HEIF", "ICO", "BMP", "AVIF", "SVG", "HEIC"],
  HEIF: ["PDF", "JPG", "PNG", "WebP", "HEIC", "ICO", "BMP", "AVIF", "SVG", "HEIF"],
  SVG: ["PNG", "PDF", "WebP", "JPG", "HEIC", "HEIF", "ICO", "AVIF", "TIFF", "GIF", "BMP", "SVG"],
  ICO: ["PNG", "WebP", "JPG", "PDF", "HEIC", "HEIF", "BMP", "AVIF", "TIFF", "GIF", "SVG", "ICO"],
  PDF: ["PNG", "JPG", "WebP", "AVIF", "TIFF", "GIF", "BMP", "ICO", "SVG", "PDF"],
  DOCX: ["PDF", "PNG", "JPG", "WebP", "AVIF", "TIFF", "GIF", "BMP", "ICO", "SVG"],
  PAGES: ["PDF", "PNG", "JPG", "WebP", "AVIF", "TIFF", "GIF", "BMP", "ICO", "SVG"],
  IMG: ["PDF", "PNG", "JPG", "WebP", "HEIC", "HEIF", "AVIF", "BMP", "TIFF", "GIF", "SVG", "ICO"],
};

const POPULAR_TARGETS_BY_SOURCE: Record<SourceFormatLabel, readonly OutputFormat[]> = {
  PNG: ["JPG", "WebP", "PDF"],
  JPG: ["PNG", "WebP", "PDF"],
  WebP: ["JPG", "PNG", "PDF"],
  GIF: ["PNG", "WebP", "JPG"],
  TIFF: ["PNG", "JPG", "PDF"],
  AVIF: ["JPG", "PNG", "WebP"],
  BMP: ["PNG", "JPG", "PDF"],
  HEIC: ["JPG", "PNG", "PDF"],
  HEIF: ["JPG", "PNG", "PDF"],
  SVG: ["PNG", "PDF", "JPG"],
  ICO: ["PNG", "JPG", "WebP"],
  PDF: ["JPG", "PNG", "WebP"],
  DOCX: ["PDF", "JPG", "PNG"],
  PAGES: ["PDF", "JPG", "PNG"],
  IMG: ["JPG", "PNG", "PDF"],
};

export const FORMAT_CAPABILITIES = {
  supportedInputs: Object.keys(SOURCE_LABEL_OUTPUT_FORMATS) as SourceFormatLabel[],
  supportedOutputs: [...OUTPUT_FORMATS] as OutputFormat[],
  conversionMatrix: SOURCE_LABEL_OUTPUT_FORMATS,
} as const;

const SUPPORTED_UPLOAD_EXT_SET = new Set<string>(SUPPORTED_UPLOAD_EXTENSIONS);
const SOURCE_LABEL_BY_EXTENSION: Record<string, SourceFormatLabel> = {
  png: "PNG",
  jpg: "JPG",
  jpeg: "JPG",
  webp: "WebP",
  gif: "GIF",
  tif: "TIFF",
  tiff: "TIFF",
  avif: "AVIF",
  heic: "HEIC",
  heif: "HEIF",
  bmp: "BMP",
  svg: "SVG",
  ico: "ICO",
  pdf: "PDF",
  doc: "DOCX",
  docx: "DOCX",
  pages: "PAGES",
};

const SOURCE_LABEL_BY_CONTENT_TYPE: Record<string, SourceFormatLabel> = {
  "image/png": "PNG",
  "image/x-png": "PNG",
  "image/jpeg": "JPG",
  "image/jpg": "JPG",
  "image/pjpeg": "JPG",
  "image/webp": "WebP",
  "image/gif": "GIF",
  "image/tiff": "TIFF",
  "image/x-tiff": "TIFF",
  "image/avif": "AVIF",
  "image/heic": "HEIC",
  "image/heif": "HEIF",
  "image/bmp": "BMP",
  "image/x-bmp": "BMP",
  "image/svg+xml": "SVG",
  "image/x-icon": "ICO",
  "image/vnd.microsoft.icon": "ICO",
  "image/icon": "ICO",
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/msword": "DOCX",
  "application/vnd.apple.pages": "PAGES",
  "application/x-iwork-pages-sffpages": "PAGES",
};

function extFromFilename(name: string): string {
  const base = (name || "").split("?")[0].split("#")[0];
  const i = base.lastIndexOf(".");
  if (i < 0) return "";
  return base.slice(i + 1).toLowerCase();
}

function asSourceLabel(sourceLabel: string): SourceFormatLabel {
  if (sourceLabel in SOURCE_LABEL_OUTPUT_FORMATS) {
    return sourceLabel as SourceFormatLabel;
  }
  return "IMG";
}

export function normalizeContentType(contentType: string | null | undefined): string {
  return (contentType || "").toLowerCase().split(";")[0].trim();
}

export function allowedOutputFormatsForContentType(contentType: string): OutputFormat[] {
  const ct = normalizeContentType(contentType);
  if (CONTENT_TYPE_OUTPUT_FORMATS[ct]) return [...CONTENT_TYPE_OUTPUT_FORMATS[ct]];
  if (ct.startsWith("image/")) return [...SOURCE_LABEL_OUTPUT_FORMATS.IMG];
  return [];
}

export function sourceLabelFromFilenameOrContentType(
  filename: string,
  contentType?: string | null
): SourceFormatLabel {
  const ext = extFromFilename(filename);
  if (ext && SOURCE_LABEL_BY_EXTENSION[ext]) return SOURCE_LABEL_BY_EXTENSION[ext];

  const ct = normalizeContentType(contentType);
  if (ct && SOURCE_LABEL_BY_CONTENT_TYPE[ct]) return SOURCE_LABEL_BY_CONTENT_TYPE[ct];
  if (ct.startsWith("image/")) return "IMG";

  return "IMG";
}

export function allowedOutputFormatsForFile(
  filename: string,
  contentType?: string | null
): OutputFormat[] {
  const sourceLabel = sourceLabelFromFilenameOrContentType(filename, contentType);
  return allowedOutputFormatsForSourceLabel(sourceLabel);
}

export function allowedOutputFormatsForSourceLabel(sourceLabel: string): OutputFormat[] {
  const mapped = SOURCE_LABEL_OUTPUT_FORMATS[asSourceLabel(sourceLabel)];
  return mapped ? [...mapped] : [...SOURCE_LABEL_OUTPUT_FORMATS.IMG];
}

export function invalidTargetReasonForSourceLabel(
  sourceLabel: string,
  target: OutputFormat | string
): string | null {
  const normalized = asSourceLabel(sourceLabel);
  const isOutputTarget = OUTPUT_FORMATS.includes(target as OutputFormat);
  if (!isOutputTarget) {
    return `${target} is supported as an input format only`;
  }

  const outputTarget = target as OutputFormat;
  const supportedTargets = SOURCE_LABEL_OUTPUT_FORMATS[normalized] ?? SOURCE_LABEL_OUTPUT_FORMATS.IMG;

  if (!supportedTargets.includes(outputTarget)) {
    return `${normalized} cannot convert to ${outputTarget}`;
  }

  // Same-format conversions are intentionally allowed: users may want to re-encode
  // with different quality/compression settings or resize the image.

  return null;
}

export function isSupportedUploadFile(file: { name: string; type?: string | null }): boolean {
  const ext = extFromFilename(file.name);
  if (SUPPORTED_UPLOAD_EXT_SET.has(ext)) return true;
  const ct = normalizeContentType(file.type);
  if (!ct) return false;
  return ct in CONTENT_TYPE_OUTPUT_FORMATS;
}

export function sortOutputsByRecommendation(
  outputs: readonly OutputFormat[],
  sourceLabels: readonly string[]
): OutputFormat[] {
  const labels = sourceLabels.map((s) => asSourceLabel(s));

  let priority = DEFAULT_RECOMMENDATION_PRIORITY;
  if (labels.length > 0 && labels.every((l) => l === labels[0])) {
    priority = SOURCE_RECOMMENDATION_PRIORITY[labels[0]] ?? DEFAULT_RECOMMENDATION_PRIORITY;
  }

  const rank = new Map<OutputFormat, number>();
  priority.forEach((fmt, idx) => rank.set(fmt, idx));

  return [...outputs].sort((a, b) => {
    const ra = rank.get(a) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    const ia = OUTPUT_FORMATS.indexOf(a);
    const ib = OUTPUT_FORMATS.indexOf(b);
    return ia - ib;
  });
}

export function recommendedOutputsForSourceLabels(
  sourceLabels: readonly string[],
  availableOutputs: readonly OutputFormat[],
  maxCount: number = 3
): OutputFormat[] {
  const labels = sourceLabels.map((s) => asSourceLabel(s));
  const availableSet = new Set(availableOutputs);

  if (labels.length > 0 && labels.every((l) => l === labels[0])) {
    const source = labels[0];
    const curated = (POPULAR_TARGETS_BY_SOURCE[source] ?? [])
      .filter((fmt) => availableSet.has(fmt))
      .filter((fmt) => !invalidTargetReasonForSourceLabel(source, fmt));

    if (curated.length >= Math.min(maxCount, availableOutputs.length)) {
      return curated.slice(0, maxCount);
    }

    const fallback = sortOutputsByRecommendation(availableOutputs, [source]).filter(
      (fmt) => !invalidTargetReasonForSourceLabel(source, fmt)
    );
    const merged = [...curated, ...fallback.filter((fmt) => !curated.includes(fmt))];
    return merged.slice(0, maxCount);
  }

  return sortOutputsByRecommendation(availableOutputs, labels).slice(0, maxCount);
}
