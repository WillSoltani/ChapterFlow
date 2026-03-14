export type OutputFormat =
  | "PNG"
  | "JPG"
  | "WebP"
  | "GIF"
  | "TIFF"
  | "AVIF"
  | "HEIC"
  | "HEIF"
  | "BMP"
  | "ICO"
  | "SVG"
  | "PDF";

export type ImageOutputFormat = Exclude<OutputFormat, "PDF">;

export function extForFormat(fmt: OutputFormat): string {
  const map: Record<OutputFormat, string> = {
    PNG: "png",
    JPG: "jpg",
    WebP: "webp",
    GIF: "gif",
    TIFF: "tiff",
    AVIF: "avif",
    HEIC: "heic",
    HEIF: "heif",
    BMP: "bmp",
    ICO: "ico",
    SVG: "svg",
    PDF: "pdf",
  };
  return map[fmt];
}

export function contentTypeFor(fmt: OutputFormat): string {
  const map: Record<OutputFormat, string> = {
    PNG: "image/png",
    JPG: "image/jpeg",
    WebP: "image/webp",
    GIF: "image/gif",
    TIFF: "image/tiff",
    AVIF: "image/avif",
    HEIC: "image/heic",
    HEIF: "image/heif",
    BMP: "image/bmp",
    ICO: "image/x-icon",
    SVG: "image/svg+xml",
    PDF: "application/pdf",
  };
  return map[fmt];
}

export function replaceExt(filename: string, ext: string): string {
  const dot = filename.lastIndexOf(".");
  return (dot < 0 ? filename : filename.slice(0, dot)) + "." + ext;
}

export function stripExt(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? filename : filename.slice(0, dot);
}

export function isImageOutputFormat(fmt: OutputFormat): fmt is ImageOutputFormat {
  return fmt !== "PDF";
}
