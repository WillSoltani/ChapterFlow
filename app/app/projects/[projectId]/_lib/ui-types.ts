import {
  IMAGE_OUTPUT_FORMATS as SHARED_IMAGE_OUTPUT_FORMATS,
  OUTPUT_FORMATS as SHARED_OUTPUT_FORMATS,
  SOURCE_LABEL_OUTPUT_FORMATS,
  type OutputFormat,
} from "@/app/app/_lib/conversion-support";

export type { OutputFormat };

/** Formats that produce image output (Quality/Resize/Presets apply). */
export const IMAGE_OUTPUT_FORMATS: OutputFormat[] = [...SHARED_IMAGE_OUTPUT_FORMATS];

export type PresetId = "web" | "hq" | "email";

/** Per-item settings used in the Ready queue and sent to the API. */
export type ItemSettings = {
  format: OutputFormat;
  quality: number;   // 1–100
  preset: PresetId;
  resizePct: number; // 10–100, 100 = no resize
};

export type LocalReadyFile = {
  id: string;
  file: File;
  previewUrl: string;
  contentType?: string;
  status?: string;
  fromLabel: string;
  toFormat: OutputFormat;
  quality: number;
  preset: PresetId;
  resizePct: number;
  sizeLabel: string;
  selected: boolean;
};

export type LocalConvertedFile = {
  id: string;
  filename: string;
  name: string;
  previewUrl?: string;
  contentType?: string;
  fromLabel: string;
  /** Immutable: the actual output format used for this conversion (stored in DDB). */
  toLabel: string;
  sourceFileId?: string;
  fromSizeLabel?: string;
  toSizeLabel?: string;
  sizeBytes?: number;
  sizeLabel: string;
  whenLabel?: string;
  status: "done" | "processing" | "failed";
  progress?: number;
  packaging?: "single" | "zip";
  pageCount?: number;
  outputCount?: number;
};

// Valid output formats per source format label.
export const VALID_OUTPUT_FORMATS: Record<string, OutputFormat[]> = Object.fromEntries(
  Object.entries(SOURCE_LABEL_OUTPUT_FORMATS).map(([source, formats]) => [source, [...formats]])
) as Record<string, OutputFormat[]>;

/** All selectable output formats (shown in the sidebar format picker). */
export const ALL_OUTPUT_FORMATS: OutputFormat[] = [...SHARED_OUTPUT_FORMATS];
