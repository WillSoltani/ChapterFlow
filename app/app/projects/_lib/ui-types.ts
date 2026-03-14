export type OutputFormat =
  | "PNG"
  | "JPG"
  | "WebP"
  | "GIF"
  | "SVG"
  | "ICO"
  | "BMP"
  | "TIFF";

export type PendingItem = {
  id: string;
  file: File;
  selected: boolean;
};
