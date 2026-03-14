"use client";

import NextImage from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  AlertTriangle,
  Eraser,
  PencilLine,
  RotateCcw,
  Search,
  Signature,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { PDFDocument, rgb, type PDFImage } from "pdf-lib";
import {
  createFilledPdfUpload,
  deleteFile,
  getInlineUrl,
  uploadFilledPdfBytes,
} from "../../_lib/api-client";
import { fieldLabelResolver } from "./field-label-resolver";
import {
  classifyField,
  formatIsoDate,
  parseDateInputToIso,
  type DateFormatPattern,
  type SmartFieldType,
} from "./field-type-rules";
import {
  normalizeValueForType,
  validateFieldValue,
  type ValidationIssue,
} from "./field-validation";

type Props = {
  projectId: string;
  projectName: string;
  fileId: string;
  filename: string;
};

type PageViewport = {
  width: number;
  height: number;
  convertToViewportRectangle: (rect: [number, number, number, number]) => number[];
};

type PdfPageProxy = {
  getViewport: (opts: { scale: number }) => PageViewport;
  getAnnotations: (opts: { intent: "display" | string }) => Promise<unknown[]>;
  render: (args: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: PageViewport;
  }) => RenderTask;
};

type PDFDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy: () => Promise<void>;
};

type RenderTask = {
  promise: Promise<unknown>;
  cancel: () => void;
};

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (args: { data: Uint8Array }) => { promise: Promise<PDFDocumentProxy> };
};

type FieldKind = "text" | "checkbox" | "radio" | "dropdown" | "signature";
type FieldValue = string | boolean;
type SignatureKind = "signature" | "initials";
type OverlayKind = SignatureKind | "text";
type SignatureSourceType = "drawn" | "uploaded" | "typed";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PdfPageMeta = {
  width: number;
  height: number;
};

type FieldWidget = {
  id: string;
  fieldName: string;
  pageIndex: number;
  kind: FieldKind;
  rect: Rect;
  optionValue?: string;
  options: string[];
  readOnly: boolean;
  required: boolean;
  initialValue?: FieldValue;
  tooltip?: string;
  annotationLabel?: string;
  defaultValue?: string;
  multiLine?: boolean;
  dateTimeType?: string;
  dateTimeFormat?: string;
};

type FieldGroup = {
  name: string;
  label: string;
  kind: FieldKind;
  smartType: SmartFieldType;
  signatureLike: boolean;
  dateFormat: DateFormatPattern | null;
  pageIndex: number;
  primaryWidgetId: string;
  widgetIds: string[];
  options: string[];
  readOnly: boolean;
  required: boolean;
  tooltip?: string;
  annotationLabel?: string;
};

type OverlayItem = {
  id: string;
  kind: OverlayKind;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl?: string;
  text?: string;
  fontSize: number;
  includeDate: boolean;
  lockedWidgetId?: string;
};

type SignatureAssetDraft = {
  kind: SignatureKind;
  sourceType: SignatureSourceType;
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  label?: string;
};

type SavedSignature = {
  id: string;
  kind: SignatureKind;
  createdAt: string;
  sourceType: SignatureSourceType;
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  aspectRatio: number;
  label?: string;
};

type Snapshot = {
  fieldValues: Record<string, FieldValue>;
  overlays: OverlayItem[];
};

type SignaturePlacementMode = {
  kind: SignatureKind;
  signatureId: string;
};

type GroupBuilder = {
  name: string;
  kind: FieldKind;
  pageIndex: number;
  primaryWidgetId: string;
  widgetIds: string[];
  options: Set<string>;
  readOnly: boolean;
  required: boolean;
  initialValue?: FieldValue;
  tooltip?: string;
  annotationLabel?: string;
  defaultValue?: string;
  multiLine?: boolean;
  dateTimeType?: string;
  dateTimeFormat?: string;
};

type DrawMode = "draw" | "type" | "upload";

type FieldFilter = "all" | "required" | "completed";
type MobilePanel = "tools" | "fields" | "inspect";

type SignatureModalProps = {
  kind: SignatureKind | null;
  onClose: () => void;
  onSave: (asset: SignatureAssetDraft) => void;
};

type SignatureChooserModalProps = {
  kind: SignatureKind | null;
  signatures: SavedSignature[];
  activeSignatureId: string | null;
  onClose: () => void;
  onUseSaved: (signatureId: string) => void;
  onCreateNew: () => void;
  onSelectSaved: (signatureId: string) => void;
};

type DragState = {
  overlayId: string;
  mode: "move" | "resize";
  startClientX: number;
  startClientY: number;
  startOverlay: OverlayItem;
  pageMeta: PdfPageMeta;
  zoom: number;
};

type ExportBuildArgs = {
  inputBytes: Uint8Array;
  fieldWidgets: FieldWidget[];
  fieldGroups: FieldGroup[];
  fieldValues: Record<string, FieldValue>;
  overlays: OverlayItem[];
  flattenFields: boolean;
  hasFillableFields: boolean;
};

type ExportBuildStep =
  | "load_pdf"
  | "apply_fields"
  | "embed_signature"
  | "draw_signature"
  | "flatten"
  | "save";

type ExportBuildContext = {
  step: ExportBuildStep;
  pageCount: number;
  placementCount: number;
  signaturePlacementCount: number;
  signatureBytesPresent: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumberArray4(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const nums = value.map((v) => (typeof v === "number" ? v : Number.NaN));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return [nums[0], nums[1], nums[2], nums[3]];
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeRect(rect: [number, number, number, number], viewport: PageViewport): Rect {
  const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle(rect) as [
    number,
    number,
    number,
    number,
  ];
  const x = Math.min(vx1, vx2);
  const y = Math.min(vy1, vy2);
  const width = Math.abs(vx2 - vx1);
  const height = Math.abs(vy2 - vy1);
  return { x, y, width, height };
}

function inferKind(annotation: Record<string, unknown>): FieldKind | null {
  const fieldType = (asString(annotation.fieldType) ?? "").toLowerCase();
  if (fieldType === "tx") return "text";
  if (fieldType === "ch") return "dropdown";
  if (fieldType === "sig") return "signature";
  if (fieldType === "btn") {
    if (asBoolean(annotation.radioButton)) return "radio";
    if (asBoolean(annotation.checkBox)) return "checkbox";
    return "checkbox";
  }
  return null;
}

function parseOptions(rawOptions: unknown): string[] {
  if (!Array.isArray(rawOptions)) return [];
  const out: string[] = [];
  for (const option of rawOptions) {
    if (!isRecord(option)) continue;
    const exportValue = asString(option.exportValue);
    const displayValue = asString(option.displayValue);
    const value = exportValue || displayValue;
    if (value) out.push(value);
  }
  return out;
}

function parseInitialValue(kind: FieldKind, raw: unknown): FieldValue | undefined {
  if (kind === "checkbox") {
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw !== 0;
    if (typeof raw === "string") {
      const lowered = raw.toLowerCase();
      return !(lowered === "" || lowered === "off" || lowered === "false" || lowered === "0");
    }
    return false;
  }

  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    const first = raw.find((item) => typeof item === "string");
    if (typeof first === "string") return first;
  }
  return "";
}

function cloneOverlays(items: OverlayItem[]): OverlayItem[] {
  return items.map((item) => ({ ...item }));
}

function buildFilledFilename(input: string, flattened: boolean): string {
  const cleaned = input
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ");
  const safe = cleaned || "document.pdf";
  const base = safe.toLowerCase().endsWith(".pdf") ? safe.slice(0, -4) : safe;
  return `${base}${flattened ? "-filled-flat" : "-filled"}.pdf`;
}

function isPdfHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  );
}

function firstBytesPreview(bytes: Uint8Array, max = 16): string {
  return [...bytes.slice(0, max)].map((v) => v.toString(16).padStart(2, "0")).join(" ");
}

function toDateInputValue(value: string): string {
  return parseDateInputToIso(value) ?? "";
}

function draftKey(projectId: string, fileId: string): string {
  return `pdf-fill-draft:${projectId}:${fileId}`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildSignatureLabel(asset: SignatureAssetDraft): string {
  if (asset.label?.trim()) return asset.label.trim();
  const source = asset.sourceType[0].toUpperCase() + asset.sourceType.slice(1);
  return `${source} ${asset.kind}`;
}

function toSavedSignature(asset: SignatureAssetDraft): SavedSignature {
  const width = Math.max(1, asset.naturalWidth || 1);
  const height = Math.max(1, asset.naturalHeight || 1);
  return {
    id: crypto.randomUUID(),
    kind: asset.kind,
    createdAt: new Date().toISOString(),
    sourceType: asset.sourceType,
    dataUrl: asset.dataUrl,
    naturalWidth: width,
    naturalHeight: height,
    aspectRatio: width / height,
    label: buildSignatureLabel(asset),
  };
}

function isEncryptedPdfError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("encrypted") || message.includes("password");
}

function isPdfDictUndefinedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("expected instance of pdfdict") && message.includes("undefined");
}

function isExportDebugEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

function logExportStep(step: ExportBuildStep, context: ExportBuildContext): void {
  if (!isExportDebugEnabled()) return;
  console.info("fill_pdf_export_step", {
    step,
    pageCount: context.pageCount,
    placementCount: context.placementCount,
    signaturePlacementCount: context.signaturePlacementCount,
    signatureBytesPresent: context.signatureBytesPresent,
  });
}

function toPdfSafeText(text: string): string {
  const normalized = text.normalize("NFKD");
  const asciiOnly = normalized.replace(/[^\x20-\x7E]/g, "");
  if (asciiOnly.length > 0) return asciiOnly;
  return text.replace(/[^\x20-\x7E]/g, "?");
}

async function drawOverlayItemsToPages({
  editorDoc,
  pages,
  overlays,
}: {
  editorDoc: PDFDocument;
  pages: ReturnType<PDFDocument["getPages"]>;
  overlays: OverlayItem[];
}): Promise<void> {
  const imageCache = new Map<string, PDFImage>();

  for (const overlay of overlays) {
    const page = pages[overlay.pageIndex];
    if (!page) {
      console.warn("fill_pdf_export_missing_page", {
        pageIndex: overlay.pageIndex,
        pageCount: pages.length,
        overlayId: overlay.id,
      });
      continue;
    }

    if (overlay.kind === "text") {
      const text = (overlay.text ?? "").trim();
      if (!text) continue;
      const safeText = toPdfSafeText(text);
      if (!safeText) continue;
      const fontSize = clamp(overlay.fontSize || 13, 8, 64);
      const y = Math.max(6, page.getHeight() - overlay.y - fontSize - 2);
      page.drawText(safeText, {
        x: overlay.x,
        y,
        size: fontSize,
        maxWidth: overlay.width,
        color: rgb(0.08, 0.1, 0.15),
      });
      continue;
    }

    const imageData = overlay.dataUrl;
    if (!imageData || !imageData.startsWith("data:image/")) {
      console.warn("fill_pdf_export_missing_signature_bytes", {
        overlayId: overlay.id,
        kind: overlay.kind,
      });
      continue;
    }

    let embedded = imageCache.get(imageData);
    if (!embedded) {
      if (imageData.startsWith("data:image/png")) {
        embedded = await editorDoc.embedPng(imageData);
      } else if (
        imageData.startsWith("data:image/jpeg") ||
        imageData.startsWith("data:image/jpg")
      ) {
        embedded = await editorDoc.embedJpg(imageData);
      } else {
        throw new Error("Unsupported signature image format. Use PNG or JPG.");
      }
      if (!embedded) {
        throw new Error("Signature image embed returned no result.");
      }
      imageCache.set(imageData, embedded);
    }

    const y = page.getHeight() - overlay.y - overlay.height;
    page.drawImage(embedded, {
      x: overlay.x,
      y,
      width: overlay.width,
      height: overlay.height,
    });

    // Signature date stamps are disabled; only place the signature image.
  }
}

function drawFieldValuesAsVisualFallback({
  pages,
  fieldWidgets,
  fieldGroups,
  fieldValues,
}: {
  pages: ReturnType<PDFDocument["getPages"]>;
  fieldWidgets: FieldWidget[];
  fieldGroups: FieldGroup[];
  fieldValues: Record<string, FieldValue>;
}): void {
  const groupByName = new Map<string, FieldGroup>();
  for (const group of fieldGroups) {
    groupByName.set(group.name, group);
  }

  for (const widget of fieldWidgets) {
    const group = groupByName.get(widget.fieldName);
    if (!group) continue;
    const page = pages[widget.pageIndex];
    if (!page) continue;

    const value = fieldValues[group.name];
    const maxFont = Math.max(9, Math.min(13, widget.rect.height - 2));
    const textY = Math.max(6, page.getHeight() - widget.rect.y - maxFont - 1.5);
    const textX = widget.rect.x + 1.5;

    if (group.kind === "text" || group.kind === "dropdown") {
      if (typeof value !== "string" || value.trim().length === 0) continue;
      const safeValue = toPdfSafeText(value.trim());
      if (!safeValue) continue;
      page.drawText(safeValue, {
        x: textX,
        y: textY,
        size: maxFont,
        maxWidth: Math.max(8, widget.rect.width - 3),
        color: rgb(0.1, 0.12, 0.15),
      });
      continue;
    }

    if (group.kind === "checkbox") {
      if (value !== true) continue;
      page.drawText("X", {
        x: widget.rect.x + Math.max(1, widget.rect.width * 0.16),
        y: Math.max(6, page.getHeight() - widget.rect.y - widget.rect.height + 1),
        size: Math.max(10, Math.min(14, widget.rect.height * 0.9)),
        color: rgb(0.08, 0.1, 0.15),
      });
      continue;
    }

    if (group.kind === "radio") {
      const selected = typeof value === "string" ? value : "";
      if (!selected || selected !== widget.optionValue) continue;
      page.drawText("X", {
        x: widget.rect.x + Math.max(0.5, widget.rect.width * 0.18),
        y: Math.max(6, page.getHeight() - widget.rect.y - widget.rect.height + 1),
        size: Math.max(8, Math.min(12, widget.rect.height * 0.82)),
        color: rgb(0.08, 0.1, 0.15),
      });
    }
  }
}

function validatePdfBytesOrThrow(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 1024 || !isPdfHeader(bytes)) {
    throw new Error("Exported file is invalid PDF data. Please try again.");
  }
  return bytes;
}

async function buildFilledPdfBytesVisualFallback({
  inputBytes,
  fieldWidgets,
  fieldGroups,
  fieldValues,
  overlays,
}: Omit<ExportBuildArgs, "flattenFields" | "hasFillableFields">): Promise<Uint8Array> {
  const sourceDoc = await PDFDocument.load(Uint8Array.from(inputBytes), {
    ignoreEncryption: true,
  });
  const visualDoc = await PDFDocument.create();
  const copiedPages = await visualDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
  for (const copiedPage of copiedPages) {
    visualDoc.addPage(copiedPage);
  }
  const pages = visualDoc.getPages();

  drawFieldValuesAsVisualFallback({
    pages,
    fieldWidgets,
    fieldGroups,
    fieldValues,
  });
  await drawOverlayItemsToPages({
    editorDoc: visualDoc,
    pages,
    overlays,
  });

  const output = await visualDoc.save();
  return validatePdfBytesOrThrow(Uint8Array.from(output));
}

async function buildFilledPdfBytes({
  inputBytes,
  fieldWidgets,
  fieldGroups,
  fieldValues,
  overlays,
  flattenFields,
  hasFillableFields,
}: ExportBuildArgs): Promise<Uint8Array> {
  const context: ExportBuildContext = {
    step: "load_pdf",
    pageCount: 0,
    placementCount: overlays.length,
    signaturePlacementCount: overlays.filter((overlay) => overlay.kind !== "text").length,
    signatureBytesPresent: overlays.some(
      (overlay) => overlay.kind !== "text" && typeof overlay.dataUrl === "string" && overlay.dataUrl.length > 0
    ),
  };

  try {
    context.step = "load_pdf";
    logExportStep("load_pdf", context);
    const editorDoc = await PDFDocument.load(Uint8Array.from(inputBytes), {
      ignoreEncryption: true,
    });
    const pages = editorDoc.getPages();
    context.pageCount = pages.length;

    let form: ReturnType<PDFDocument["getForm"]> | null = null;
    if (hasFillableFields && fieldGroups.length > 0) {
      context.step = "apply_fields";
      logExportStep("apply_fields", context);
      try {
        form = editorDoc.getForm();
      } catch (error: unknown) {
        console.warn("fill_pdf_export_form_unavailable", {
          message: error instanceof Error ? error.message : String(error),
        });
        form = null;
      }

      if (form) {
        let availableFieldNames: Set<string> = new Set();
        try {
          availableFieldNames = new Set(form.getFields().map((field) => field.getName()));
        } catch (error: unknown) {
          console.warn("fill_pdf_export_form_fields_unavailable", {
            message: error instanceof Error ? error.message : String(error),
          });
          form = null;
        }

        if (form) {
          for (const group of fieldGroups) {
            if (!availableFieldNames.has(group.name)) continue;
            const current = fieldValues[group.name];
            try {
              if (group.kind === "text") {
                const textField = form.getTextField(group.name);
                textField.setText(typeof current === "string" ? current : "");
                continue;
              }
              if (group.kind === "checkbox") {
                const checkField = form.getCheckBox(group.name);
                if (current === true) checkField.check();
                else checkField.uncheck();
                continue;
              }
              if (group.kind === "radio") {
                const radio = form.getRadioGroup(group.name);
                if (typeof current === "string" && current) radio.select(current);
                continue;
              }
              if (group.kind === "dropdown") {
                const dropdown = form.getDropdown(group.name);
                if (typeof current === "string" && current) dropdown.select(current);
                else dropdown.clear();
              }
            } catch (error: unknown) {
              console.warn("fill_pdf_export_apply_field_failed", {
                fieldName: group.name,
                kind: group.kind,
                message: error instanceof Error ? error.message : String(error),
              });
            }
          }

          try {
            form.updateFieldAppearances();
          } catch (error: unknown) {
            console.warn("fill_pdf_export_update_appearances_failed", {
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }

    context.step = "embed_signature";
    logExportStep("embed_signature", context);
    await drawOverlayItemsToPages({
      editorDoc,
      pages,
      overlays,
    });
    context.step = "draw_signature";
    logExportStep("draw_signature", context);

    if (flattenFields && hasFillableFields && form) {
      context.step = "flatten";
      logExportStep("flatten", context);
      try {
        form.flatten();
      } catch (error: unknown) {
        console.warn("fill_pdf_export_flatten_failed", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    context.step = "save";
    logExportStep("save", context);
    const output = await editorDoc.save();
    return validatePdfBytesOrThrow(Uint8Array.from(output));
  } catch (error: unknown) {
    const errorPayload = {
      step: context.step,
      signatureBytesPresent: context.signatureBytesPresent,
      pageCount: context.pageCount,
      placementCount: context.placementCount,
      signaturePlacementCount: context.signaturePlacementCount,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };

    if (isPdfDictUndefinedError(error)) {
      console.warn("fill_pdf_export_pdfdict_retrying_visual_fallback", errorPayload);
      return buildFilledPdfBytesVisualFallback({
        inputBytes,
        fieldWidgets,
        fieldGroups,
        fieldValues,
        overlays,
      });
    }

    console.warn("fill_pdf_export_failed", errorPayload);
    throw error;
  }
}

function styleRect(rect: Rect, zoom: number): CSSProperties {
  return {
    left: rect.x * zoom,
    top: rect.y * zoom,
    width: Math.max(18, rect.width * zoom),
    height: Math.max(16, rect.height * zoom),
  };
}

function SignatureModal({ kind, onClose, onSave }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });

  const [mode, setMode] = useState<DrawMode>("draw");
  const [uploaded, setUploaded] = useState<{
    dataUrl: string;
    width: number;
    height: number;
  } | null>(null);
  const [typedValue, setTypedValue] = useState("");

  useEffect(() => {
    if (!kind) return;
    const id = window.requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    return () => window.cancelAnimationFrame(id);
  }, [kind]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const saveDrawn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !kind) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave({
      kind,
      sourceType: "drawn",
      dataUrl,
      naturalWidth: canvas.width,
      naturalHeight: canvas.height,
    });
  }, [kind, onSave]);

  const onUploadFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        if (!result) return;
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, img.naturalWidth || img.width || 800);
          canvas.height = Math.max(1, img.naturalHeight || img.height || 240);
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const normalizedDataUrl = canvas.toDataURL("image/png");
          setUploaded({
            dataUrl: normalizedDataUrl,
            width: canvas.width,
            height: canvas.height,
          });
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const saveUploaded = useCallback(() => {
    if (!kind || !uploaded) return;
    onSave({
      kind,
      sourceType: "uploaded",
      dataUrl: uploaded.dataUrl,
      naturalWidth: uploaded.width,
      naturalHeight: uploaded.height,
    });
  }, [kind, onSave, uploaded]);

  const saveTyped = useCallback(() => {
    if (!kind) return;
    const value = typedValue.trim();
    if (!value) return;
    const canvas = document.createElement("canvas");
    canvas.width = 980;
    canvas.height = 260;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0f172a";
    ctx.textBaseline = "middle";
    ctx.font = kind === "signature" ? "64px cursive" : "60px serif";
    ctx.fillText(value, 42, canvas.height / 2);
    onSave({
      kind,
      sourceType: "typed",
      dataUrl: canvas.toDataURL("image/png"),
      naturalWidth: canvas.width,
      naturalHeight: canvas.height,
      label: value,
    });
  }, [kind, onSave, typedValue]);

  const canvasPointFromEvent = useCallback((event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * canvas.width) / Math.max(rect.width, 1);
    const y = ((event.clientY - rect.top) * canvas.height) / Math.max(rect.height, 1);
    return { x, y };
  }, []);

  const startDrawing = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = canvasPointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = { active: true, x: point.x, y: point.y };
  }, [canvasPointFromEvent]);

  const moveDrawing = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current.active) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const point = canvasPointFromEvent(event);
    if (!point) return;

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(drawingRef.current.x, drawingRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    drawingRef.current.x = point.x;
    drawingRef.current.y = point.y;
  }, [canvasPointFromEvent]);

  const endDrawing = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drawingRef.current.active = false;
  }, []);

  if (!kind) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/75 p-2 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={kind === "signature" ? "Create signature" : "Create initials"}
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-2xl overflow-auto rounded-[26px] border border-white/10 bg-slate-900/95 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.65)] sm:rounded-3xl sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-100">
          {kind === "signature" ? "Create Signature" : "Create Initials"}
        </h3>
        <p className="mt-1 text-sm text-slate-300">
          Draw directly or upload an image. Everything stays in your browser.
        </p>

        <div className="mt-4 inline-flex flex-wrap rounded-xl border border-white/10 bg-white/5 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("draw")}
            className={[
              "rounded-lg px-3 py-1.5 transition",
              mode === "draw"
                ? "bg-sky-500/20 text-sky-100"
                : "text-slate-300 hover:bg-white/10",
            ].join(" ")}
          >
            Draw
          </button>
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={[
                "rounded-lg px-3 py-1.5 transition",
              mode === "upload"
                ? "bg-sky-500/20 text-sky-100"
                : "text-slate-300 hover:bg-white/10",
            ].join(" ")}
            >
              Upload
            </button>
            <button
              type="button"
              onClick={() => setMode("type")}
              className={[
                "rounded-lg px-3 py-1.5 transition",
                mode === "type"
                  ? "bg-sky-500/20 text-sky-100"
                  : "text-slate-300 hover:bg-white/10",
              ].join(" ")}
            >
              Type
            </button>
          </div>

          {mode === "draw" ? (
            <div className="mt-4 space-y-3">
            <canvas
              ref={canvasRef}
              width={980}
              height={260}
              onPointerDown={startDrawing}
              onPointerMove={moveDrawing}
              onPointerUp={endDrawing}
              onPointerCancel={endDrawing}
              className="h-40 w-full touch-none rounded-2xl border border-slate-300/30 bg-white sm:h-auto"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={clearCanvas}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              >
                Clear drawing
              </button>
              <button
                type="button"
                onClick={saveDrawn}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
              >
                Use drawing
              </button>
              </div>
            </div>
          ) : mode === "type" ? (
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-slate-200">
                {kind === "signature" ? "Type signature" : "Type initials"}
                <input
                  type="text"
                  value={typedValue}
                  onChange={(event) => setTypedValue(event.currentTarget.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/45 focus:outline-none"
                  placeholder={kind === "signature" ? "Type your full name" : "Type initials"}
                />
              </label>
              <div className="rounded-2xl border border-white/10 bg-white px-4 py-3">
                <div
                  className={kind === "signature" ? "text-[36px] text-slate-900" : "text-[34px] font-semibold text-slate-900"}
                  style={{
                    fontFamily: kind === "signature" ? "cursive" : "serif",
                    minHeight: 56,
                  }}
                >
                  {typedValue.trim() || (kind === "signature" ? "Signature preview" : "Initials preview")}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setTypedValue("")}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={saveTyped}
                  disabled={!typedValue.trim()}
                  className={[
                    "rounded-xl px-4 py-2 text-sm font-semibold transition",
                    typedValue.trim()
                      ? "bg-sky-600 text-white hover:bg-sky-500"
                      : "cursor-not-allowed border border-white/10 bg-white/5 text-slate-500",
                  ].join(" ")}
                >
                  Use typed
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
            <label className="inline-flex cursor-pointer items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 hover:bg-white/10">
              Upload image
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={onUploadFile}
              />
            </label>

            {uploaded ? (
              <div className="rounded-2xl border border-white/10 bg-white px-4 py-3">
                <NextImage
                  src={uploaded.dataUrl}
                  alt="Signature preview"
                  width={Math.min(uploaded.width, 540)}
                  height={Math.max(80, Math.min(uploaded.height, 180))}
                  unoptimized
                  className="max-h-36 w-auto object-contain"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/3 px-4 py-6 text-sm text-slate-400">
                No image selected yet.
              </div>
            )}

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={saveUploaded}
                disabled={!uploaded}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  uploaded
                    ? "bg-sky-600 text-white hover:bg-sky-500"
                    : "cursor-not-allowed border border-white/10 bg-white/5 text-slate-500",
                ].join(" ")}
              >
                Use image
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SignatureChooserModal({
  kind,
  signatures,
  activeSignatureId,
  onClose,
  onUseSaved,
  onCreateNew,
  onSelectSaved,
}: SignatureChooserModalProps) {
  if (!kind) return null;

  return (
    <div
      className="fixed inset-0 z-[82] flex items-end justify-center bg-slate-950/75 p-2 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={kind === "signature" ? "Choose signature" : "Choose initials"}
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-xl overflow-auto rounded-[26px] border border-white/10 bg-slate-900/95 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.65)] sm:rounded-3xl sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-100">
          {kind === "signature" ? "Add Signature" : "Add Initials"}
        </h3>
        <p className="mt-1 text-sm text-slate-300">
          Choose a saved option or create a new one before placing it on the PDF.
        </p>

        <div className="mt-4 max-h-56 space-y-2 overflow-auto pr-1">
          {signatures.map((signature) => {
            const isActive = signature.id === activeSignatureId;
            return (
              <button
                key={signature.id}
                type="button"
                onClick={() => onSelectSaved(signature.id)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
                  isActive
                    ? "border-sky-400/45 bg-sky-500/12"
                    : "border-white/10 bg-white/5 hover:bg-white/10",
                ].join(" ")}
              >
                <div className="relative h-14 w-28 shrink-0 overflow-hidden rounded border border-white/10 bg-white">
                  <NextImage
                    src={signature.dataUrl}
                    alt={signature.label || `${kind} preview`}
                    fill
                    unoptimized
                    className="object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-100">
                    {signature.label || `Saved ${kind}`}
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(signature.createdAt).toLocaleString()}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCreateNew}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Create new {kind}
          </button>
          <button
            type="button"
            onClick={() => activeSignatureId && onUseSaved(activeSignatureId)}
            disabled={!activeSignatureId}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              activeSignatureId
                ? "bg-sky-600 text-white hover:bg-sky-500"
                : "cursor-not-allowed border border-white/10 bg-white/5 text-slate-500",
            ].join(" ")}
          >
            Use saved {kind}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

async function extractPdfModel(pdfDoc: PDFDocumentProxy): Promise<{
  pageMetas: PdfPageMeta[];
  fieldWidgets: FieldWidget[];
  fieldGroups: FieldGroup[];
  initialValues: Record<string, FieldValue>;
}> {
  const pageMetas: PdfPageMeta[] = [];
  const fieldWidgets: FieldWidget[] = [];
  const builders = new Map<string, GroupBuilder>();

  for (let pageIndex = 0; pageIndex < pdfDoc.numPages; pageIndex += 1) {
    const page = await pdfDoc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    pageMetas.push({ width: viewport.width, height: viewport.height });

    const annotations = await page.getAnnotations({ intent: "display" });
    for (let annotationIndex = 0; annotationIndex < annotations.length; annotationIndex += 1) {
      const raw = annotations[annotationIndex];
      if (!isRecord(raw)) continue;
      if (asString(raw.subtype) !== "Widget") continue;

      const kind = inferKind(raw);
      if (!kind) continue;

      const rectValue = asNumberArray4(raw.rect);
      if (!rectValue) continue;
      const rect = normalizeRect(rectValue, viewport);
      if (rect.width < 4 || rect.height < 4) continue;

      const rawName = asString(raw.fieldName)?.trim();
      const fieldName = rawName || `unnamed_field_${pageIndex + 1}_${annotationIndex + 1}`;
      const annotationId = asString(raw.id) || `${pageIndex}-${annotationIndex}-${fieldName}`;
      const id = `${fieldName}__${annotationId}`;
      const optionValue = asString(raw.buttonValue);
      const options = parseOptions(raw.options);
      const tooltip = asString(raw.alternativeText) ?? asString(raw.title);
      const annotationLabel = asString(raw.fieldLabel) ?? asString(raw.alternativeName);
      const defaultValue = asString(raw.defaultFieldValue);
      const multiLine = asBoolean(raw.multiLine);
      const dateTimeType = asString(raw.datetimeType);
      const dateTimeFormat = asString(raw.datetimeFormat);

      const widget: FieldWidget = {
        id,
        fieldName,
        pageIndex,
        kind,
        rect,
        optionValue,
        options,
        readOnly: asBoolean(raw.readOnly),
        required: asBoolean(raw.required),
        initialValue: parseInitialValue(kind, raw.fieldValue),
        tooltip,
        annotationLabel,
        defaultValue,
        multiLine,
        dateTimeType,
        dateTimeFormat,
      };
      fieldWidgets.push(widget);

      const existing = builders.get(fieldName);
      if (!existing) {
        builders.set(fieldName, {
          name: fieldName,
          kind,
          pageIndex,
          primaryWidgetId: id,
          widgetIds: [id],
          options: new Set([
            ...(optionValue ? [optionValue] : []),
            ...options,
          ]),
          readOnly: widget.readOnly,
          required: widget.required,
          initialValue: widget.initialValue,
          tooltip,
          annotationLabel,
          defaultValue,
          multiLine,
          dateTimeType,
          dateTimeFormat,
        });
      } else {
        existing.widgetIds.push(id);
        existing.pageIndex = Math.min(existing.pageIndex, pageIndex);
        existing.readOnly = existing.readOnly && widget.readOnly;
        existing.required = existing.required || widget.required;
        if (existing.kind !== kind) {
          // If a malformed file has mixed widgets under one field name,
          // prefer text-like interaction.
          existing.kind = "text";
        }
        if (optionValue) existing.options.add(optionValue);
        for (const option of options) existing.options.add(option);
        const current = existing.initialValue;
        if ((current === "" || current == null) && widget.initialValue != null) {
          existing.initialValue = widget.initialValue;
        }
        if (!existing.tooltip && tooltip) existing.tooltip = tooltip;
        if (!existing.annotationLabel && annotationLabel) existing.annotationLabel = annotationLabel;
        if (!existing.defaultValue && defaultValue) existing.defaultValue = defaultValue;
        existing.multiLine = existing.multiLine || multiLine;
        if (!existing.dateTimeType && dateTimeType) existing.dateTimeType = dateTimeType;
        if (!existing.dateTimeFormat && dateTimeFormat) existing.dateTimeFormat = dateTimeFormat;
      }
    }
  }

  fieldWidgets.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    if (a.rect.y !== b.rect.y) return a.rect.y - b.rect.y;
    return a.rect.x - b.rect.x;
  });

  const fieldGroups: FieldGroup[] = [...builders.values()]
    .map((builder) => {
      const label = fieldLabelResolver({
        fieldName: builder.name,
        tooltip: builder.tooltip,
        annotationLabel: builder.annotationLabel,
      });
      const inferredRequired =
        builder.required || /\brequired\b/i.test(label) || /\*/.test(label);
      const classification = classifyField({
        pdfKind: builder.kind,
        fieldName: builder.name,
        label,
        tooltip: builder.tooltip,
        defaultValue: typeof builder.initialValue === "string" ? builder.initialValue : builder.defaultValue,
        options: [...builder.options],
        multiLine: builder.multiLine,
        dateTimeType: builder.dateTimeType,
        dateTimeFormat: builder.dateTimeFormat,
      });

      return {
        name: builder.name,
        label,
        kind: builder.kind,
        smartType: classification.type,
        signatureLike: classification.signatureLike,
        dateFormat: classification.dateFormat,
        pageIndex: builder.pageIndex,
        primaryWidgetId: builder.primaryWidgetId,
        widgetIds: builder.widgetIds,
        options: [...builder.options],
        readOnly: builder.readOnly,
        required: inferredRequired,
        tooltip: builder.tooltip,
        annotationLabel: builder.annotationLabel,
      };
    })
    .sort((a, b) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      return a.label.localeCompare(b.label);
    });

  const initialValues: Record<string, FieldValue> = {};
  for (const builder of builders.values()) {
    if (builder.initialValue !== undefined) {
      initialValues[builder.name] = builder.initialValue;
      continue;
    }
    initialValues[builder.name] = builder.kind === "checkbox" ? false : "";
  }

  return { pageMetas, fieldWidgets, fieldGroups, initialValues };
}

export default function FillPdfClient({ projectId, projectName, fileId, filename }: Props) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editBlockedReason, setEditBlockedReason] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [pageMetas, setPageMetas] = useState<PdfPageMeta[]>([]);
  const [fieldWidgets, setFieldWidgets] = useState<FieldWidget[]>([]);
  const [fieldGroups, setFieldGroups] = useState<FieldGroup[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, FieldValue>>({});
  const [initialFieldValues, setInitialFieldValues] = useState<Record<string, FieldValue>>({});

  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1.15);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [flashWidgetId, setFlashWidgetId] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState("");
  const [fieldFilter, setFieldFilter] = useState<FieldFilter>("all");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel | null>(null);
  const [fieldIssues, setFieldIssues] = useState<Record<string, ValidationIssue[]>>({});
  const [groupJumpCursor, setGroupJumpCursor] = useState<Record<string, number>>({});

  const flattenFields = false;
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);

  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>([]);
  const [activeSignatureByKind, setActiveSignatureByKind] = useState<
    Record<SignatureKind, string | null>
  >({
    signature: null,
    initials: null,
  });
  const [signatureModalKind, setSignatureModalKind] = useState<SignatureKind | null>(null);
  const [signatureChooserKind, setSignatureChooserKind] = useState<SignatureKind | null>(null);
  const [createAfterModalKind, setCreateAfterModalKind] = useState<SignatureKind | null>(null);
  const [signaturePlacementMode, setSignaturePlacementMode] = useState<SignaturePlacementMode | null>(
    null
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const flashTimeoutRef = useRef<number | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const pdfJsRef = useRef<PdfJsModule | null>(null);

  const ensurePdfJs = useCallback(async (): Promise<PdfJsModule> => {
    if (pdfJsRef.current) return pdfJsRef.current;
    if (typeof window === "undefined") {
      throw new Error("PDF rendering is only available in the browser.");
    }
    if (typeof window.DOMMatrix === "undefined") {
      throw new Error("This browser is missing required PDF APIs (DOMMatrix).");
    }

    const pdfJs = (await import("pdfjs-dist")) as unknown as PdfJsModule;
    if (!pdfJs.GlobalWorkerOptions.workerSrc) {
      pdfJs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
    }
    pdfJsRef.current = pdfJs;
    return pdfJs;
  }, []);

  const widgetById = useMemo(() => {
    const map = new Map<string, FieldWidget>();
    for (const widget of fieldWidgets) map.set(widget.id, widget);
    return map;
  }, [fieldWidgets]);

  const widgetsByPage = useMemo(() => {
    const map = new Map<number, FieldWidget[]>();
    for (const widget of fieldWidgets) {
      const list = map.get(widget.pageIndex);
      if (list) list.push(widget);
      else map.set(widget.pageIndex, [widget]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.rect.y !== b.rect.y) return a.rect.y - b.rect.y;
        return a.rect.x - b.rect.x;
      });
    }
    return map;
  }, [fieldWidgets]);

  const groupByName = useMemo(() => {
    const map = new Map<string, FieldGroup>();
    for (const group of fieldGroups) map.set(group.name, group);
    return map;
  }, [fieldGroups]);

  const isGroupCompleted = useCallback(
    (group: FieldGroup) => {
      const value = fieldValues[group.name];
      if (group.kind === "checkbox") return value === true;
      if (typeof value === "string") return value.trim().length > 0;
      return value === true;
    },
    [fieldValues]
  );

  const filteredGroups = useMemo(() => {
    const needle = fieldSearch.trim().toLowerCase();
    return fieldGroups.filter((group) => {
      if (needle) {
        const hay = `${group.label} ${group.name}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (fieldFilter === "required") return group.required;
      if (fieldFilter === "completed") return isGroupCompleted(group);
      return true;
    });
  }, [fieldFilter, fieldGroups, fieldSearch, isGroupCompleted]);

  const groupsByPage = useMemo(() => {
    const map = new Map<number, FieldGroup[]>();
    for (const group of filteredGroups) {
      const list = map.get(group.pageIndex);
      if (list) list.push(group);
      else map.set(group.pageIndex, [group]);
    }
    return map;
  }, [filteredGroups]);

  const overlaysByPage = useMemo(() => {
    const map = new Map<number, OverlayItem[]>();
    for (const overlay of overlays) {
      const list = map.get(overlay.pageIndex);
      if (list) list.push(overlay);
      else map.set(overlay.pageIndex, [overlay]);
    }
    return map;
  }, [overlays]);

  const selectedOverlay = useMemo(
    () => overlays.find((overlay) => overlay.id === selectedOverlayId) ?? null,
    [overlays, selectedOverlayId]
  );

  const savedSignatureById = useMemo(() => {
    const map = new Map<string, SavedSignature>();
    for (const signature of savedSignatures) {
      map.set(signature.id, signature);
    }
    return map;
  }, [savedSignatures]);

  const signaturesByKind = useMemo(
    () => ({
      signature: savedSignatures.filter((item) => item.kind === "signature"),
      initials: savedSignatures.filter((item) => item.kind === "initials"),
    }),
    [savedSignatures]
  );

  const chooserSignatures = useMemo(() => {
    if (!signatureChooserKind) return [];
    return signaturesByKind[signatureChooserKind];
  }, [signatureChooserKind, signaturesByKind]);

  const hasFillableFields = fieldGroups.length > 0;

  const pushUndoSnapshot = useCallback(() => {
    setUndoStack((previous) =>
      [
        {
          fieldValues: { ...fieldValues },
          overlays: cloneOverlays(overlays),
        },
        ...previous,
      ].slice(0, 50)
    );
  }, [fieldValues, overlays]);

  const jumpToPage = useCallback((pageIndex: number) => {
    const target = pageRefs.current[pageIndex];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActivePageIndex(pageIndex);
  }, []);

  const jumpToWidget = useCallback(
    (widgetId: string) => {
      const widget = widgetById.get(widgetId);
      if (!widget) return;
      setActiveWidgetId(widgetId);
      jumpToPage(widget.pageIndex);
      setFlashWidgetId(widgetId);
      if (flashTimeoutRef.current != null) {
        window.clearTimeout(flashTimeoutRef.current);
      }
      flashTimeoutRef.current = window.setTimeout(() => {
        setFlashWidgetId(null);
      }, 1300);
    },
    [jumpToPage, widgetById]
  );

  const jumpToGroup = useCallback(
    (group: FieldGroup) => {
      const cursor = groupJumpCursor[group.name] ?? 0;
      const nextWidgetId = group.widgetIds[cursor % group.widgetIds.length] ?? group.primaryWidgetId;
      if (!nextWidgetId) return;
      jumpToWidget(nextWidgetId);
      setGroupJumpCursor((prev) => ({
        ...prev,
        [group.name]: (cursor + 1) % Math.max(1, group.widgetIds.length),
      }));
    },
    [groupJumpCursor, jumpToWidget]
  );

  const validateOneField = useCallback(
    (group: FieldGroup, value: FieldValue): ValidationIssue[] =>
      validateFieldValue({
        label: group.label,
        type: group.smartType,
        value,
        required: group.required,
        completed: isGroupCompleted(group),
      }),
    [isGroupCompleted]
  );

  const applyFieldValue = useCallback(
    (name: string, value: FieldValue) => {
      if (fieldValues[name] === value) return;
      pushUndoSnapshot();
      setFieldValues((prev) => ({ ...prev, [name]: value }));
      setFieldIssues((prev) => {
        if (!prev[name]) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
    },
    [fieldValues, pushUndoSnapshot]
  );

  const onFieldBlur = useCallback(
    (group: FieldGroup) => {
      const current = fieldValues[group.name];
      const normalized =
        typeof current === "string" ? normalizeValueForType(group.smartType, current) : current;
      if (normalized !== current) {
        setFieldValues((prev) => ({ ...prev, [group.name]: normalized }));
      }
      const issues = validateOneField(group, normalized);
      setFieldIssues((prev) => {
        const next = { ...prev };
        if (issues.length === 0) delete next[group.name];
        else next[group.name] = issues;
        return next;
      });
    },
    [fieldValues, validateOneField]
  );

  const resetToDetected = useCallback(() => {
    pushUndoSnapshot();
    setFieldValues({ ...initialFieldValues });
    setOverlays([]);
    setSelectedOverlayId(null);
    setFieldIssues({});
  }, [initialFieldValues, pushUndoSnapshot]);

  const clearAll = useCallback(() => {
    pushUndoSnapshot();
    const cleared: Record<string, FieldValue> = {};
    for (const group of fieldGroups) {
      cleared[group.name] = group.kind === "checkbox" ? false : "";
    }
    setFieldValues(cleared);
    setOverlays([]);
    setSelectedOverlayId(null);
    setFieldIssues({});
  }, [fieldGroups, pushUndoSnapshot]);

  const undoOne = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const [latest, ...rest] = prev;
      setFieldValues(latest.fieldValues);
      setOverlays(latest.overlays);
      setFieldIssues({});
      setSelectedOverlayId((current) =>
        current && latest.overlays.some((overlay) => overlay.id === current) ? current : null
      );
      return rest;
    });
  }, []);

  const removeOverlay = useCallback(
    (overlayId: string) => {
      if (!overlays.some((overlay) => overlay.id === overlayId)) return;
      pushUndoSnapshot();
      setOverlays((prev) => prev.filter((overlay) => overlay.id !== overlayId));
      setSelectedOverlayId((current) => (current === overlayId ? null : current));
    },
    [overlays, pushUndoSnapshot]
  );

  const patchOverlay = useCallback(
    (overlayId: string, patch: Partial<OverlayItem>) => {
      setOverlays((prev) =>
        prev.map((overlay) => (overlay.id === overlayId ? { ...overlay, ...patch } : overlay))
      );
    },
    []
  );

  const beginOverlayDrag = useCallback(
    (
      event: ReactMouseEvent<HTMLDivElement>,
      overlay: OverlayItem,
      mode: "move" | "resize"
    ) => {
      event.preventDefault();
      event.stopPropagation();

      const pageMeta = pageMetas[overlay.pageIndex];
      if (!pageMeta) return;

      pushUndoSnapshot();
      setSelectedOverlayId(overlay.id);

      dragStateRef.current = {
        overlayId: overlay.id,
        mode,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startOverlay: { ...overlay },
        pageMeta,
        zoom,
      };

      const onMove = (moveEvent: MouseEvent) => {
        const current = dragStateRef.current;
        if (!current) return;

        const dx = (moveEvent.clientX - current.startClientX) / Math.max(current.zoom, 0.1);
        const dy = (moveEvent.clientY - current.startClientY) / Math.max(current.zoom, 0.1);

        if (current.mode === "move") {
          const x = clamp(
            current.startOverlay.x + dx,
            0,
            Math.max(0, current.pageMeta.width - current.startOverlay.width)
          );
          const y = clamp(
            current.startOverlay.y + dy,
            0,
            Math.max(0, current.pageMeta.height - current.startOverlay.height)
          );
          patchOverlay(current.overlayId, { x, y });
          return;
        }

        const width = clamp(
          current.startOverlay.width + dx,
          28,
          Math.max(28, current.pageMeta.width - current.startOverlay.x)
        );
        const height = clamp(
          current.startOverlay.height + dy,
          18,
          Math.max(18, current.pageMeta.height - current.startOverlay.y)
        );
        patchOverlay(current.overlayId, { width, height });
      };

      const onUp = () => {
        dragStateRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [pageMetas, patchOverlay, pushUndoSnapshot, zoom]
  );

  const startSignaturePlacement = useCallback((kind: SignatureKind, signatureId: string) => {
    setSignaturePlacementMode({ kind, signatureId });
    setSignatureChooserKind(null);
    setSignatureModalKind(null);
    setCreateAfterModalKind(null);
    setActionError(null);
  }, []);

  const placeSignatureOverlay = useCallback(
    (signature: SavedSignature, pageIndex: number, clickPoint?: { x: number; y: number }) => {
      const page = pageMetas[pageIndex];
      if (!page) return;

      const ratio = signature.aspectRatio > 0 ? signature.aspectRatio : 3.2;
      const width = clamp(page.width * 0.32, 120, Math.max(120, page.width - 24));
      const height = clamp(width / ratio, 38, Math.max(38, page.height - 24));
      const x = clickPoint
        ? clamp(clickPoint.x - width / 2, 8, Math.max(8, page.width - width))
        : clamp((page.width - width) / 2, 8, Math.max(8, page.width - width));
      const y = clickPoint
        ? clamp(clickPoint.y - height / 2, 8, Math.max(8, page.height - height))
        : clamp(page.height * 0.14, 8, Math.max(8, page.height - height));

      const overlay: OverlayItem = {
        id: crypto.randomUUID(),
        kind: signature.kind,
        pageIndex,
        x,
        y,
        width,
        height,
        dataUrl: signature.dataUrl,
        fontSize: 14,
        includeDate: false,
      };
      pushUndoSnapshot();
      setOverlays((prev) => [...prev, overlay]);
      setSelectedOverlayId(overlay.id);
      jumpToPage(pageIndex);
    },
    [jumpToPage, pageMetas, pushUndoSnapshot]
  );

  const placeSignatureFromMode = useCallback(
    (pageIndex: number, clickPoint?: { x: number; y: number }) => {
      if (!signaturePlacementMode) return;
      const signature = savedSignatureById.get(signaturePlacementMode.signatureId);
      if (!signature) {
        setSignaturePlacementMode(null);
        return;
      }
      placeSignatureOverlay(signature, pageIndex, clickPoint);
      setSignaturePlacementMode(null);
    },
    [placeSignatureOverlay, savedSignatureById, signaturePlacementMode]
  );

  const openSignatureTool = useCallback(
    (kind: SignatureKind) => {
      const available = signaturesByKind[kind];
      if (available.length === 0) {
        setCreateAfterModalKind(kind);
        setSignatureModalKind(kind);
        setSignatureChooserKind(null);
        return;
      }
      const currentActive = activeSignatureByKind[kind];
      const resolvedActive =
        currentActive && available.some((item) => item.id === currentActive)
          ? currentActive
          : available[0]?.id ?? null;
      setActiveSignatureByKind((prev) => ({ ...prev, [kind]: resolvedActive }));
      setCreateAfterModalKind(null);
      setSignatureChooserKind(kind);
      setSignaturePlacementMode(null);
    },
    [activeSignatureByKind, signaturesByKind]
  );

  const addTextOverlay = useCallback(() => {
    const page = pageMetas[activePageIndex];
    if (!page) return;
    const width = clamp(page.width * 0.28, 120, Math.max(120, page.width - 24));
    const height = 38;
    const overlay: OverlayItem = {
      id: crypto.randomUUID(),
      kind: "text",
      pageIndex: activePageIndex,
      x: clamp((page.width - width) / 2, 8, Math.max(8, page.width - width)),
      y: clamp(page.height * 0.18, 8, Math.max(8, page.height - height)),
      width,
      height,
      text: "Text",
      fontSize: 13,
      includeDate: false,
    };
    pushUndoSnapshot();
    setOverlays((prev) => [...prev, overlay]);
    setSelectedOverlayId(overlay.id);
  }, [activePageIndex, pageMetas, pushUndoSnapshot]);

  const zoomOut = useCallback(() => setZoom((prev) => clamp(prev - 0.1, 0.7, 2.3)), []);
  const zoomIn = useCallback(() => setZoom((prev) => clamp(prev + 0.1, 0.7, 2.3)), []);

  const buildFilledPdfBytesCanvasFallback = useCallback(async (): Promise<Uint8Array> => {
    if (pageMetas.length === 0) {
      throw new Error("PDF pages are unavailable for compatibility export.");
    }

    const snapshotDoc = await PDFDocument.create();
    for (let pageIndex = 0; pageIndex < pageMetas.length; pageIndex += 1) {
      const canvas = canvasRefs.current[pageIndex];
      if (!canvas) {
        throw new Error(
          `Page ${pageIndex + 1} is not rendered yet. Scroll through pages and try again.`
        );
      }
      const pngDataUrl = canvas.toDataURL("image/png");
      const pngImage = await snapshotDoc.embedPng(pngDataUrl);
      const pageMeta = pageMetas[pageIndex];
      const page = snapshotDoc.addPage([pageMeta.width, pageMeta.height]);
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageMeta.width,
        height: pageMeta.height,
      });
    }

    const pages = snapshotDoc.getPages();
    drawFieldValuesAsVisualFallback({
      pages,
      fieldWidgets,
      fieldGroups,
      fieldValues,
    });
    await drawOverlayItemsToPages({
      editorDoc: snapshotDoc,
      pages,
      overlays,
    });

    const output = await snapshotDoc.save();
    return validatePdfBytesOrThrow(Uint8Array.from(output));
  }, [fieldGroups, fieldValues, fieldWidgets, overlays, pageMetas]);

  const onDownload = useCallback(async () => {
    if (!pdfBytes) return;
    if (editBlockedReason) {
      setActionError(editBlockedReason);
      return;
    }
    setDownloadBusy(true);
    setSaveBusy(false);
    setActionError(null);
    setNotice(null);
    try {
      const nextIssues: Record<string, ValidationIssue[]> = {};
      let firstBlockingGroup: FieldGroup | null = null;
      for (const group of fieldGroups) {
        const value = fieldValues[group.name] ?? (group.kind === "checkbox" ? false : "");
        const issues = validateOneField(group, value);
        if (issues.length > 0) nextIssues[group.name] = issues;
        if (!firstBlockingGroup && issues.some((issue) => issue.severity === "error")) {
          firstBlockingGroup = group;
        }
      }
      setFieldIssues(nextIssues);
      if (firstBlockingGroup) {
        setActionError("Please complete required fields before downloading.");
        jumpToGroup(firstBlockingGroup);
        return;
      }

      let stableBytes: Uint8Array;
      try {
        stableBytes = await buildFilledPdfBytes({
          inputBytes: pdfBytes,
          fieldWidgets,
          fieldGroups,
          fieldValues,
          overlays,
          flattenFields,
          hasFillableFields,
        });
      } catch (error: unknown) {
        if (isEncryptedPdfError(error)) {
          setActionError(
            "This PDF is password-protected/encrypted and cannot be filled in the browser. Please upload an unprotected PDF."
          );
          return;
        }

        if (isPdfDictUndefinedError(error)) {
          console.warn("fill_pdf_export_retrying_canvas_snapshot", {
            message: error instanceof Error ? error.message : String(error),
            pageCount: pageMetas.length,
            overlayCount: overlays.length,
          });
          stableBytes = await buildFilledPdfBytesCanvasFallback();
          setNotice(
            "Used compatibility export mode for this PDF due to malformed form structure."
          );
        } else {
          throw error;
        }
      }

      const outputName = buildFilledFilename(filename, flattenFields);

      setSaveBusy(true);
      let filledArtifactFileId: string | null = null;
      try {
        const upload = await createFilledPdfUpload(projectId, {
          originalFileId: fileId,
          filename: outputName,
          sizeBytes: stableBytes.length,
        });
        filledArtifactFileId = upload.fileId;
        let uploaded = false;
        let lastErr: unknown = null;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            await uploadFilledPdfBytes(projectId, upload.fileId, stableBytes);
            uploaded = true;
            break;
          } catch (error: unknown) {
            lastErr = error;
            if (attempt < 3) {
              await wait(420 * attempt);
            }
          }
        }
        if (!uploaded) {
          throw lastErr ?? new Error("Could not save filled PDF.");
        }
      } catch (error: unknown) {
        if (filledArtifactFileId) {
          await deleteFile(projectId, filledArtifactFileId).catch(() => {});
        }
        const message = error instanceof Error ? error.message : String(error);
        console.warn("filled_pdf_persist_failed", {
          message,
          outputSize: stableBytes.length,
        });
        setNotice(`Downloaded file, but saving to Filled PDFs failed (${message}).`);
      } finally {
        setSaveBusy(false);
      }

      const blob = new Blob([stableBytes as unknown as BlobPart], { type: "application/pdf" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = outputName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1600);
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Could not export the filled PDF.");
    } finally {
      setDownloadBusy(false);
    }
  }, [
    buildFilledPdfBytesCanvasFallback,
    fieldWidgets,
    fieldGroups,
    fieldValues,
    fileId,
    filename,
    flattenFields,
    hasFillableFields,
    jumpToGroup,
    overlays,
    pageMetas.length,
    pdfBytes,
    projectId,
    editBlockedReason,
    validateOneField,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setLoadError(null);
      setActionError(null);
      setEditBlockedReason(null);
      setNotice(null);
      setActiveWidgetId(null);
      setFlashWidgetId(null);
      setSelectedOverlayId(null);
      setUndoStack([]);
      setSignaturePlacementMode(null);
      setSignatureChooserKind(null);
      setSignatureModalKind(null);
      setCreateAfterModalKind(null);

      try {
        setPdfDoc((prev) => {
          if (prev) void prev.destroy();
          return null;
        });

        const inlineUrl = await getInlineUrl(projectId, fileId);
        if (!inlineUrl) throw new Error("Could not load a signed PDF URL.");

        const res = await fetch(inlineUrl, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`PDF fetch failed: ${res.status}`);
        }

        const contentType = (res.headers.get("content-type") || "").toLowerCase();
        const fetchedBytes = new Uint8Array(await res.arrayBuffer());
        const stableBytes = Uint8Array.from(fetchedBytes);
        const parseBytes = Uint8Array.from(fetchedBytes);

        if (fetchedBytes.length < 1024 || !isPdfHeader(fetchedBytes)) {
          console.error("fill_pdf_source_invalid", {
            status: res.status,
            contentType,
            bytes: fetchedBytes.length,
            firstBytes: firstBytesPreview(fetchedBytes),
          });
          throw new Error("Loaded file is not a valid PDF.");
        }

        if (!contentType.includes("pdf")) {
          console.warn("fill_pdf_source_unexpected_content_type", { contentType, inlineUrl });
        }

        try {
          await PDFDocument.load(Uint8Array.from(stableBytes), { ignoreEncryption: true });
        } catch (error: unknown) {
          if (isEncryptedPdfError(error)) {
            setEditBlockedReason(
              "This PDF is password-protected/encrypted and cannot be filled in the browser. Please upload an unprotected PDF."
            );
          }
        }

        const pdfJs = await ensurePdfJs();
        const loadingTask = pdfJs.getDocument({ data: parseBytes });
        const nextPdfDoc = await loadingTask.promise;

        const model = await extractPdfModel(nextPdfDoc);
        if (cancelled) {
          await nextPdfDoc.destroy();
          return;
        }

        const restoredValues: Record<string, FieldValue> = { ...model.initialValues };
        let restoredOverlays: OverlayItem[] = [];
        let restoredSignatures: SavedSignature[] = [];
        const restoredActiveSignatures: Record<SignatureKind, string | null> = {
          signature: null,
          initials: null,
        };
        try {
          const rawDraft = window.localStorage.getItem(draftKey(projectId, fileId));
          if (rawDraft) {
            const parsed = JSON.parse(rawDraft) as {
              fieldValues?: Record<string, FieldValue>;
              overlays?: OverlayItem[];
              savedSignatures?: SavedSignature[];
              activeSignatureByKind?: Partial<Record<SignatureKind, string>>;
            };
            if (parsed.fieldValues && isRecord(parsed.fieldValues)) {
              for (const [name, value] of Object.entries(parsed.fieldValues)) {
                if (!(name in restoredValues)) continue;
                if (typeof value === "string" || typeof value === "boolean") {
                  restoredValues[name] = value;
                }
              }
            }
            if (Array.isArray(parsed.overlays)) {
              restoredOverlays = parsed.overlays.filter((item) => {
                if (!item || typeof item !== "object") return false;
                const rec = item as OverlayItem;
                if (!Number.isFinite(rec.pageIndex)) return false;
                if (rec.pageIndex < 0 || rec.pageIndex >= model.pageMetas.length) return false;
                return true;
              });
            }

            if (Array.isArray(parsed.savedSignatures)) {
              restoredSignatures = parsed.savedSignatures
                .filter((item) => {
                  if (!item || typeof item !== "object") return false;
                  if (item.kind !== "signature" && item.kind !== "initials") return false;
                  if (typeof item.id !== "string" || item.id.length < 4) return false;
                  if (
                    typeof item.dataUrl !== "string" ||
                    !item.dataUrl.startsWith("data:image/")
                  ) {
                    return false;
                  }
                  if (
                    !Number.isFinite(item.naturalWidth) ||
                    !Number.isFinite(item.naturalHeight)
                  ) {
                    return false;
                  }
                  return true;
                })
                .map((item) => {
                  const width = Math.max(1, item.naturalWidth);
                  const height = Math.max(1, item.naturalHeight);
                  return {
                    ...item,
                    sourceType:
                      item.sourceType === "drawn" ||
                      item.sourceType === "typed" ||
                      item.sourceType === "uploaded"
                        ? item.sourceType
                        : "uploaded",
                    createdAt: item.createdAt || new Date().toISOString(),
                    naturalWidth: width,
                    naturalHeight: height,
                    aspectRatio: item.aspectRatio && item.aspectRatio > 0 ? item.aspectRatio : width / height,
                  };
                });
            }
            if (parsed.activeSignatureByKind && isRecord(parsed.activeSignatureByKind)) {
              for (const kind of ["signature", "initials"] as SignatureKind[]) {
                const value = parsed.activeSignatureByKind[kind];
                if (typeof value === "string") restoredActiveSignatures[kind] = value;
              }
            }

            for (const kind of ["signature", "initials"] as SignatureKind[]) {
              const available = restoredSignatures.filter((item) => item.kind === kind);
              if (available.length === 0) {
                restoredActiveSignatures[kind] = null;
                continue;
              }
              const activeId = restoredActiveSignatures[kind];
              if (!activeId || !available.some((item) => item.id === activeId)) {
                restoredActiveSignatures[kind] = available[0]?.id ?? null;
              }
            }
          }
        } catch {
          // Ignore malformed local draft.
        }

        setPdfBytes(stableBytes);
        setPdfDoc(nextPdfDoc);
        setPageMetas(model.pageMetas);
        setFieldWidgets(model.fieldWidgets);
        setFieldGroups(model.fieldGroups);
        setFieldValues(restoredValues);
        setInitialFieldValues(model.initialValues);
        setOverlays(restoredOverlays);
        setSavedSignatures(restoredSignatures);
        setActiveSignatureByKind(restoredActiveSignatures);
        setActivePageIndex(0);
        setFieldIssues({});
        setGroupJumpCursor({});
      } catch (error: unknown) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPdf();
    return () => {
      cancelled = true;
    };
  }, [ensurePdfJs, fileId, projectId]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current != null) window.clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pdfDoc) void pdfDoc.destroy();
    };
  }, [pdfDoc]);

  useEffect(() => {
    if (!pdfDoc || pageMetas.length === 0) return;
    const currentPdf = pdfDoc;

    let cancelled = false;
    const renderTasks: RenderTask[] = [];

    async function renderPages() {
      for (let pageIndex = 0; pageIndex < pageMetas.length; pageIndex += 1) {
        if (cancelled) return;
        const canvas = canvasRefs.current[pageIndex];
        if (!canvas) continue;

        const page = await currentPdf.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: zoom });
        const dpr = window.devicePixelRatio || 1;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) continue;

        canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
        canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);

        const task = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });
        renderTasks.push(task);
        try {
          await task.promise;
        } catch {
          // Rendering cancellation is expected when zoom or page changes quickly.
        }
      }
    }

    void renderPages();
    return () => {
      cancelled = true;
      for (const task of renderTasks) task.cancel();
    };
  }, [pageMetas, pdfDoc, zoom]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || pageMetas.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { idx: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idxAttr = (entry.target as HTMLElement).dataset.pageIndex;
          const idx = idxAttr ? Number(idxAttr) : Number.NaN;
          if (!Number.isFinite(idx)) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { idx, ratio: entry.intersectionRatio };
          }
        }
        if (best) setActivePageIndex(best.idx);
      },
      { root, threshold: [0.2, 0.45, 0.7, 0.95] }
    );

    for (const pageRef of pageRefs.current) {
      if (pageRef) observer.observe(pageRef);
    }

    return () => observer.disconnect();
  }, [pageMetas.length]);

  useEffect(() => {
    if (!signaturePlacementMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSignaturePlacementMode(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [signaturePlacementMode]);

  useEffect(() => {
    if (!mobilePanel) return;
    const onResize = () => {
      if (window.innerWidth >= 1280) {
        setMobilePanel(null);
      }
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [mobilePanel]);

  useEffect(() => {
    if (loading) return;
    const id = window.setTimeout(() => {
      try {
        const payload = JSON.stringify({
          fieldValues,
          overlays,
          savedSignatures,
          activeSignatureByKind,
          savedAt: new Date().toISOString(),
        });
        window.localStorage.setItem(draftKey(projectId, fileId), payload);
      } catch (error: unknown) {
        console.warn("fill_pdf_draft_save_failed", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }, 220);
    return () => window.clearTimeout(id);
  }, [
    activeSignatureByKind,
    fieldValues,
    fileId,
    loading,
    overlays,
    projectId,
    savedSignatures,
  ]);

  const onSignatureSaved = useCallback(
    (asset: SignatureAssetDraft) => {
      const saved = toSavedSignature(asset);
      setSavedSignatures((prev) => [saved, ...prev].slice(0, 20));
      setActiveSignatureByKind((prev) => ({
        ...prev,
        [saved.kind]: saved.id,
      }));
      setSignatureModalKind(null);
      setSignatureChooserKind(null);
      if (createAfterModalKind === saved.kind) {
        startSignaturePlacement(saved.kind, saved.id);
      }
      setCreateAfterModalKind(null);
    },
    [createAfterModalKind, startSignaturePlacement]
  );

  const onUseSavedSignature = useCallback(
    (signatureId: string) => {
      if (!signatureChooserKind) return;
      setActiveSignatureByKind((prev) => ({ ...prev, [signatureChooserKind]: signatureId }));
      startSignaturePlacement(signatureChooserKind, signatureId);
    },
    [signatureChooserKind, startSignaturePlacement]
  );

  const onCreateNewSignature = useCallback(() => {
    if (!signatureChooserKind) return;
    setCreateAfterModalKind(signatureChooserKind);
    setSignatureModalKind(signatureChooserKind);
    setSignatureChooserKind(null);
  }, [signatureChooserKind]);

  const pageCount = pageMetas.length;
  const placementSignature = useMemo(() => {
    if (!signaturePlacementMode) return null;
    return savedSignatureById.get(signaturePlacementMode.signatureId) ?? null;
  }, [savedSignatureById, signaturePlacementMode]);
  const issueList = useMemo(
    () =>
      Object.entries(fieldIssues)
        .flatMap(([name, issues]) =>
          issues.map((issue) => ({
            name,
            issue,
            group: groupByName.get(name) ?? null,
          }))
        )
        .sort((a, b) => {
          const ap = a.group?.pageIndex ?? 9999;
          const bp = b.group?.pageIndex ?? 9999;
          if (ap !== bp) return ap - bp;
          return (a.group?.label ?? a.name).localeCompare(b.group?.label ?? b.name);
        }),
    [fieldIssues, groupByName]
  );
  const toolsCardVisible = !mobilePanel || mobilePanel === "tools";
  const fieldsCardVisible = !mobilePanel || mobilePanel === "fields";
  const inspectorCardVisible = !mobilePanel || mobilePanel === "inspect";

  return (
    <div className="mx-auto grid max-w-[1900px] grid-cols-1 gap-4 px-3 pb-5 pt-3 sm:gap-5 sm:px-5 sm:pt-5 xl:grid-cols-[340px_minmax(0,1fr)] xl:px-6 xl:py-6">
      {mobilePanel ? (
        <button
          type="button"
          onClick={() => setMobilePanel(null)}
          className="fixed inset-0 z-[65] bg-slate-950/65 backdrop-blur-sm xl:hidden"
          aria-label="Close mobile panel"
        />
      ) : null}

      <aside
        className={[
          mobilePanel
            ? "fixed inset-x-0 bottom-0 top-24 z-[70] overflow-auto rounded-t-[26px] border-t border-white/10 bg-[#081025] p-3 pb-6 shadow-[0_-24px_70px_rgba(0,0,0,0.65)]"
            : "hidden xl:block",
          "xl:static xl:z-auto xl:block xl:overflow-visible xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none",
        ].join(" ")}
      >
        {mobilePanel ? (
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 xl:hidden">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-sky-200/85">Fill PDF</p>
              <p className="text-sm font-semibold text-slate-100">
                {mobilePanel === "tools"
                  ? "Tools"
                  : mobilePanel === "fields"
                    ? "Fields"
                    : "Overlay Inspector"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMobilePanel(null)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/8 text-slate-200 hover:bg-white/12"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {toolsCardVisible ? (
          <div className="rounded-3xl border border-white/10 bg-white/3 p-4">
          <p className="truncate text-sm font-semibold text-slate-100">{filename}</p>
          <p className="mt-1 text-xs text-slate-400">{projectName}</p>

          {!hasFillableFields && !loading && !loadError ? (
            <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              This PDF has no fillable fields. Annotate mode is enabled.
            </div>
          ) : null}

          {notice ? (
            <div className="mt-4 rounded-xl border border-sky-300/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
              {notice}
            </div>
          ) : null}

          {actionError ? (
            <div className="mt-3 rounded-xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              {actionError}
            </div>
          ) : null}

          {editBlockedReason ? (
            <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              {editBlockedReason}
            </div>
          ) : null}

          {signaturePlacementMode ? (
            <div className="mt-3 rounded-xl border border-sky-300/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
              <div className="font-semibold">
                Placement mode: {signaturePlacementMode.kind === "signature" ? "Signature" : "Initials"}
              </div>
              <div className="mt-1">
                Click anywhere on the PDF to place{" "}
                {placementSignature?.label || signaturePlacementMode.kind}. Press Esc to cancel.
              </div>
              <button
                type="button"
                onClick={() => setSignaturePlacementMode(null)}
                className="mt-2 rounded-lg border border-sky-300/35 bg-sky-500/15 px-2 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/25"
              >
                Cancel placement
              </button>
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={addTextOverlay}
              disabled={loading || pageCount === 0}
              className={[
                "inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
                loading || pageCount === 0
                  ? "cursor-not-allowed border border-white/10 bg-white/5 text-slate-500"
                  : "border border-white/15 bg-white/8 text-slate-100 hover:bg-white/12",
              ].join(" ")}
            >
              <PencilLine className="h-4 w-4" />
              Add text box
            </button>
            <button
              type="button"
              onClick={() => openSignatureTool("signature")}
              disabled={loading || pageCount === 0}
              className={[
                "inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
                loading || pageCount === 0
                  ? "cursor-not-allowed border border-white/10 bg-white/5 text-slate-500"
                  : "border border-white/15 bg-white/8 text-slate-100 hover:bg-white/12",
              ].join(" ")}
            >
              <Signature className="h-4 w-4" />
              Add signature
            </button>
            <button
              type="button"
              onClick={() => openSignatureTool("initials")}
              disabled={loading || pageCount === 0}
              className={[
                "inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
                loading || pageCount === 0
                  ? "cursor-not-allowed border border-white/10 bg-white/5 text-slate-500"
                  : "border border-white/15 bg-white/8 text-slate-100 hover:bg-white/12",
              ].join(" ")}
            >
              <Signature className="h-4 w-4" />
              Add initials
            </button>
          </div>

          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={resetToDetected}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              <Eraser className="h-4 w-4" />
              Clear all
            </button>
            <button
              type="button"
              onClick={undoOne}
              disabled={undoStack.length === 0}
              className={[
                "inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm",
                undoStack.length === 0
                  ? "cursor-not-allowed border border-white/10 bg-white/5 text-slate-500"
                  : "border border-white/15 bg-white/5 text-slate-100 hover:bg-white/10",
              ].join(" ")}
            >
              <Undo2 className="h-4 w-4" />
              Undo
            </button>
          </div>

          <button
            type="button"
            onClick={onDownload}
            disabled={loading || !pdfBytes || downloadBusy || saveBusy || !!editBlockedReason}
            className={[
              "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              loading || !pdfBytes || downloadBusy || saveBusy || !!editBlockedReason
                ? "cursor-not-allowed border border-white/10 bg-white/5 text-slate-500"
                : "bg-sky-600 text-white hover:bg-sky-500",
            ].join(" ")}
          >
            <Download className="h-4 w-4" />
            {downloadBusy ? "Preparing…" : saveBusy ? "Saving to Filled PDFs…" : "Save and download PDF"}
          </button>
        </div>
        ) : null}

        {fieldsCardVisible ? (
          <div className="rounded-3xl border border-white/10 bg-white/3 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Search className="h-4 w-4 text-slate-300" />
            Fields
          </div>

          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="search"
              value={fieldSearch}
              onChange={(event) => setFieldSearch(event.currentTarget.value)}
              placeholder="Search labels"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/45 focus:outline-none"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["all", "required", "completed"] as FieldFilter[]).map((filterKey) => (
              <button
                key={filterKey}
                type="button"
                onClick={() => setFieldFilter(filterKey)}
                className={[
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition",
                  fieldFilter === filterKey
                    ? "border-sky-400/35 bg-sky-500/15 text-sky-200"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                ].join(" ")}
              >
                {filterKey[0].toUpperCase()}
                {filterKey.slice(1)}
              </button>
            ))}
          </div>

          {issueList.length > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2">
              <div className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-100">
                <AlertTriangle className="h-3.5 w-3.5" />
                {issueList.length} field issue{issueList.length === 1 ? "" : "s"}
              </div>
              <div className="space-y-1">
                {issueList.slice(0, 5).map((entry, idx) => (
                  <button
                    key={`${entry.name}-${entry.issue.code}-${idx}`}
                    type="button"
                    onClick={() => entry.group && jumpToGroup(entry.group)}
                    className="block w-full truncate text-left text-[11px] text-amber-100/95 hover:text-amber-50"
                  >
                    {entry.group?.label ?? entry.name}: {entry.issue.message}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-3 max-h-[44vh] space-y-3 overflow-auto pr-1">
            {filteredGroups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/3 px-3 py-4 text-sm text-slate-400">
                {hasFillableFields ? "No matching fields." : "No AcroForm fields found."}
              </div>
            ) : (
              [...groupsByPage.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([pageIndex, groups]) => (
                  <div key={`page-${pageIndex}`} className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Page {pageIndex + 1}
                    </div>
                    {groups.map((group) => {
                      const value = fieldValues[group.name];
                      const fieldIssuesForGroup = fieldIssues[group.name] ?? [];
                      const completed = isGroupCompleted(group);
                      const active = activeWidgetId != null && group.widgetIds.includes(activeWidgetId);
                      const activeIndex = activeWidgetId ? group.widgetIds.indexOf(activeWidgetId) : -1;
                      const shownIndex = activeIndex >= 0 ? activeIndex + 1 : 1;
                      return (
                        <div
                          key={group.name}
                          className={[
                            "rounded-xl border p-2.5 transition",
                            active
                              ? "border-sky-400/35 bg-sky-500/10"
                              : "border-white/10 bg-white/5",
                          ].join(" ")}
                        >
                          <button
                            type="button"
                            onClick={() => jumpToGroup(group)}
                            className="w-full truncate text-left text-xs font-semibold text-slate-100 hover:text-sky-100"
                            title={group.label}
                          >
                            {group.label}
                          </button>
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                            {group.required ? (
                              <span className="rounded-full border border-rose-300/30 bg-rose-400/10 px-1.5 py-0.5 text-rose-100">
                                Required
                              </span>
                            ) : null}
                            {group.widgetIds.length > 1 ? (
                              <span className="rounded-full border border-white/15 bg-white/5 px-1.5 py-0.5">
                                {shownIndex}/{group.widgetIds.length}
                              </span>
                            ) : null}
                            {completed ? (
                              <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-100">
                                Completed
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-2">
                            {group.kind === "text" ? (
                              group.smartType === "multiline" ? (
                                <textarea
                                  value={typeof value === "string" ? value : ""}
                                  onChange={(event) => applyFieldValue(group.name, event.currentTarget.value)}
                                  onBlur={() => onFieldBlur(group)}
                                  rows={3}
                                  disabled={group.readOnly}
                                  className="w-full rounded-lg border border-white/10 bg-white/8 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/45 focus:outline-none disabled:opacity-60"
                                />
                              ) : group.smartType === "date" ? (
                                <input
                                  type="date"
                                  value={typeof value === "string" ? toDateInputValue(value) : ""}
                                  onChange={(event) => {
                                    const iso = event.currentTarget.value;
                                    const formatted = iso
                                      ? formatIsoDate(iso, group.dateFormat ?? "MM/DD/YYYY")
                                      : "";
                                    applyFieldValue(group.name, formatted);
                                  }}
                                  onBlur={() => onFieldBlur(group)}
                                  disabled={group.readOnly}
                                  className="w-full rounded-lg border border-white/10 bg-white/8 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/45 focus:outline-none disabled:opacity-60"
                                />
                              ) : (
                                <input
                                  type={group.smartType === "email" ? "email" : group.smartType === "number" || group.smartType === "currency" ? "text" : "text"}
                                  inputMode={
                                    group.smartType === "phone"
                                      ? "tel"
                                      : group.smartType === "number" || group.smartType === "currency"
                                        ? "decimal"
                                        : group.smartType === "email"
                                          ? "email"
                                          : "text"
                                  }
                                  value={typeof value === "string" ? value : ""}
                                  onChange={(event) => applyFieldValue(group.name, event.currentTarget.value)}
                                  onBlur={() => onFieldBlur(group)}
                                  disabled={group.readOnly}
                                  className="w-full rounded-lg border border-white/10 bg-white/8 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/45 focus:outline-none disabled:opacity-60"
                                />
                              )
                            ) : null}

                            {group.kind === "checkbox" ? (
                              <label className="inline-flex items-center gap-2 text-xs text-slate-200">
                                <input
                                  type="checkbox"
                                  checked={value === true}
                                  onChange={(event) =>
                                    applyFieldValue(group.name, event.currentTarget.checked)
                                  }
                                  onBlur={() => onFieldBlur(group)}
                                  disabled={group.readOnly}
                                  className="h-4 w-4 accent-sky-500"
                                />
                                Checked
                              </label>
                            ) : null}

                            {group.kind === "radio" ? (
                              <select
                                value={typeof value === "string" ? value : ""}
                                onChange={(event) => applyFieldValue(group.name, event.currentTarget.value)}
                                onBlur={() => onFieldBlur(group)}
                                disabled={group.readOnly}
                                className="w-full rounded-lg border border-white/10 bg-white/8 px-2.5 py-1.5 text-xs text-slate-100 focus:border-sky-400/45 focus:outline-none"
                              >
                                <option value="">Select option</option>
                                {group.options.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : null}

                            {group.kind === "dropdown" ? (
                              <select
                                value={typeof value === "string" ? value : ""}
                                onChange={(event) => applyFieldValue(group.name, event.currentTarget.value)}
                                onBlur={() => onFieldBlur(group)}
                                disabled={group.readOnly}
                                className="w-full rounded-lg border border-white/10 bg-white/8 px-2.5 py-1.5 text-xs text-slate-100 focus:border-sky-400/45 focus:outline-none"
                              >
                                <option value="">Select option</option>
                                {group.options.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : null}

                            {group.kind === "signature" ? (
                              <p className="text-[11px] text-slate-400">
                                Use the left toolbar signature tool to place a signature manually.
                              </p>
                            ) : null}

                            {fieldIssuesForGroup.length > 0 ? (
                              <p className="mt-1 text-[11px] text-amber-200">
                                {fieldIssuesForGroup[0]?.message}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
            )}
          </div>
        </div>
        ) : null}

        {inspectorCardVisible ? (
          <div className="rounded-3xl border border-white/10 bg-white/3 p-4">
          <div className="text-sm font-semibold text-slate-100">Overlay inspector</div>
          {selectedOverlay ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                {selectedOverlay.kind.toUpperCase()} on page {selectedOverlay.pageIndex + 1}
              </div>

              {selectedOverlay.kind === "text" ? (
                <>
                  <label className="block text-xs text-slate-300">
                    Text
                    <input
                      type="text"
                      value={selectedOverlay.text ?? ""}
                      onChange={(event) => patchOverlay(selectedOverlay.id, { text: event.currentTarget.value })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/8 px-2.5 py-1.5 text-xs text-slate-100 focus:border-sky-400/45 focus:outline-none"
                    />
                  </label>
                  <label className="block text-xs text-slate-300">
                    Font size
                    <input
                      type="range"
                      min={8}
                      max={42}
                      value={selectedOverlay.fontSize}
                      onChange={(event) =>
                        patchOverlay(selectedOverlay.id, {
                          fontSize: clamp(Number(event.currentTarget.value), 8, 42),
                        })
                      }
                      className="mt-1 w-full"
                    />
                  </label>
                </>
              ) : (
                <p className="text-xs text-slate-300">
                  Signature/initial overlays are exported without date stamps.
                </p>
              )}

              <button
                type="button"
                onClick={() => removeOverlay(selectedOverlay.id)}
                className="w-full rounded-lg border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/20"
              >
                Remove overlay
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-400">
              Select an overlay on the PDF to edit its properties.
            </p>
          )}
        </div>
        ) : null}
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="grid grid-cols-3 gap-2 xl:hidden">
          <button
            type="button"
            onClick={() => setMobilePanel("tools")}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
          >
            Tools
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel("fields")}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
          >
            Fields
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel("inspect")}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
          >
            Inspect
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/3 px-4 py-3">
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={zoomOut}
              className="rounded-lg p-1.5 text-slate-200 hover:bg-white/10"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <div className="min-w-12 text-center text-xs font-semibold text-slate-200">
              {Math.round(zoom * 100)}%
            </div>
            <button
              type="button"
              onClick={zoomIn}
              className="rounded-lg p-1.5 text-slate-200 hover:bg-white/10"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => jumpToPage(Math.max(0, activePageIndex - 1))}
              disabled={activePageIndex <= 0}
              className="rounded-lg p-1.5 text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-600"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-xs font-semibold text-slate-200">
              Page {pageCount ? activePageIndex + 1 : 0} / {pageCount}
            </div>
            <button
              type="button"
              onClick={() => jumpToPage(Math.min(pageCount - 1, activePageIndex + 1))}
              disabled={activePageIndex >= pageCount - 1}
              className="rounded-lg p-1.5 text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-600"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="max-h-[68dvh] overflow-auto rounded-2xl border border-white/10 bg-slate-950/35 p-2 sm:max-h-[calc(100vh-11rem)] sm:p-4"
        >
          {loading ? (
            <div className="grid min-h-72 place-items-center text-sm text-slate-300">Loading PDF…</div>
          ) : null}

          {!loading && loadError ? (
            <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {loadError}
            </div>
          ) : null}

          {!loading && !loadError ? (
            <div className="space-y-5">
              {pageMetas.map((pageMeta, pageIndex) => {
                const widgets = widgetsByPage.get(pageIndex) ?? [];
                const pageOverlays = overlaysByPage.get(pageIndex) ?? [];
                return (
                  <div
                    key={`page-${pageIndex}`}
                    ref={(node) => {
                      pageRefs.current[pageIndex] = node;
                    }}
                    data-page-index={pageIndex}
                    className="mx-auto w-fit rounded-2xl border border-white/10 bg-slate-900/55 p-2"
                    style={{
                      width: pageMeta.width * zoom + 16,
                    }}
                  >
                    <div
                      className={[
                        "relative overflow-hidden rounded-xl bg-white",
                        signaturePlacementMode ? "cursor-crosshair" : "",
                      ].join(" ")}
                      style={{
                        width: pageMeta.width * zoom,
                        height: pageMeta.height * zoom,
                      }}
                      onClick={(event) => {
                        if (!signaturePlacementMode) return;
                        const rect = event.currentTarget.getBoundingClientRect();
                        const x = (event.clientX - rect.left) / Math.max(zoom, 0.1);
                        const y = (event.clientY - rect.top) / Math.max(zoom, 0.1);
                        placeSignatureFromMode(pageIndex, { x, y });
                      }}
                    >
                      <canvas
                        ref={(node) => {
                          canvasRefs.current[pageIndex] = node;
                        }}
                        className="absolute inset-0 block h-full w-full"
                      />

                      {widgets.map((widget) => {
                        const group = groupByName.get(widget.fieldName);
                        const isActive =
                          activeWidgetId === widget.id || flashWidgetId === widget.id;
                        const commonClass = [
                          "absolute border text-[11px] shadow-[0_2px_8px_rgba(0,0,0,0.2)] outline-none transition",
                          isActive
                            ? "border-sky-400/90 ring-2 ring-sky-400/35"
                            : "border-sky-500/35 hover:border-sky-500/70",
                          widget.readOnly ? "cursor-not-allowed opacity-70" : "",
                        ].join(" ");
                        const fieldValue = fieldValues[widget.fieldName];

                        if (widget.kind === "text") {
                          if (group?.smartType === "multiline") {
                            return (
                              <textarea
                                key={widget.id}
                                value={typeof fieldValue === "string" ? fieldValue : ""}
                                onFocus={() => setActiveWidgetId(widget.id)}
                                onChange={(event) =>
                                  applyFieldValue(widget.fieldName, event.currentTarget.value)
                                }
                                onBlur={() => group && onFieldBlur(group)}
                                readOnly={widget.readOnly}
                                style={styleRect(widget.rect, zoom)}
                                className={`${commonClass} rounded-sm bg-white/85 px-1 text-slate-900`}
                              />
                            );
                          }

                          if (group?.smartType === "date") {
                            return (
                              <input
                                key={widget.id}
                                type="date"
                                value={typeof fieldValue === "string" ? toDateInputValue(fieldValue) : ""}
                                onFocus={() => setActiveWidgetId(widget.id)}
                                onChange={(event) => {
                                  const iso = event.currentTarget.value;
                                  const formatted = iso
                                    ? formatIsoDate(iso, group.dateFormat ?? "MM/DD/YYYY")
                                    : "";
                                  applyFieldValue(widget.fieldName, formatted);
                                }}
                                onBlur={() => group && onFieldBlur(group)}
                                readOnly={widget.readOnly}
                                style={styleRect(widget.rect, zoom)}
                                className={`${commonClass} rounded-sm bg-white/85 px-1 text-slate-900`}
                              />
                            );
                          }

                          return (
                            <input
                              key={widget.id}
                              type={group?.smartType === "email" ? "email" : "text"}
                              inputMode={
                                group?.smartType === "phone"
                                  ? "tel"
                                  : group?.smartType === "number" || group?.smartType === "currency"
                                    ? "decimal"
                                    : group?.smartType === "email"
                                      ? "email"
                                      : "text"
                              }
                              value={typeof fieldValue === "string" ? fieldValue : ""}
                              onFocus={() => setActiveWidgetId(widget.id)}
                              onChange={(event) =>
                                applyFieldValue(widget.fieldName, event.currentTarget.value)
                              }
                              onBlur={() => group && onFieldBlur(group)}
                              readOnly={widget.readOnly}
                              style={styleRect(widget.rect, zoom)}
                              className={`${commonClass} rounded-sm bg-white/85 px-1 text-slate-900`}
                            />
                          );
                        }

                        if (widget.kind === "checkbox") {
                          return (
                            <label
                              key={widget.id}
                              className={`${commonClass} flex items-center justify-center rounded-sm bg-white/85`}
                              style={styleRect(widget.rect, zoom)}
                            >
                              <input
                                type="checkbox"
                                checked={fieldValue === true}
                                onFocus={() => setActiveWidgetId(widget.id)}
                                onChange={(event) =>
                                  applyFieldValue(widget.fieldName, event.currentTarget.checked)
                                }
                                onBlur={() => group && onFieldBlur(group)}
                                disabled={widget.readOnly}
                                className="h-4 w-4 accent-sky-600"
                              />
                            </label>
                          );
                        }

                        if (widget.kind === "radio") {
                          const option = widget.optionValue ?? "On";
                          return (
                            <label
                              key={widget.id}
                              className={`${commonClass} flex items-center justify-center rounded-full bg-white/85`}
                              style={styleRect(widget.rect, zoom)}
                            >
                              <input
                                type="radio"
                                name={`field-radio-${widget.fieldName}`}
                                value={option}
                                checked={fieldValue === option}
                                onFocus={() => setActiveWidgetId(widget.id)}
                                onChange={(event) =>
                                  applyFieldValue(widget.fieldName, event.currentTarget.value)
                                }
                                onBlur={() => group && onFieldBlur(group)}
                                disabled={widget.readOnly}
                                className="h-4 w-4 accent-sky-600"
                              />
                            </label>
                          );
                        }

                        if (widget.kind === "dropdown") {
                          return (
                            <select
                              key={widget.id}
                              value={typeof fieldValue === "string" ? fieldValue : ""}
                              onFocus={() => setActiveWidgetId(widget.id)}
                              onChange={(event) =>
                                applyFieldValue(widget.fieldName, event.currentTarget.value)
                              }
                              onBlur={() => group && onFieldBlur(group)}
                              disabled={widget.readOnly}
                              style={styleRect(widget.rect, zoom)}
                              className={`${commonClass} rounded-sm bg-white/90 px-1 text-slate-900`}
                            >
                              <option value="">Select…</option>
                              {(group?.options ?? widget.options).map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          );
                        }

                        return (
                          <div
                            key={widget.id}
                            style={styleRect(widget.rect, zoom)}
                            className={`${commonClass} grid place-items-center rounded-sm bg-amber-500/10 px-1.5 text-[10px] font-semibold text-amber-900`}
                          >
                            Signature Field
                          </div>
                        );
                      })}

                      {pageOverlays.map((overlay) => (
                        <div
                          key={overlay.id}
                          style={styleRect(overlay, zoom)}
                          onMouseDown={(event) => beginOverlayDrag(event, overlay, "move")}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedOverlayId(overlay.id);
                          }}
                          className={[
                            "absolute cursor-move overflow-hidden rounded border bg-white/90 shadow-[0_4px_14px_rgba(0,0,0,0.24)]",
                            selectedOverlayId === overlay.id
                              ? "border-sky-500 ring-2 ring-sky-400/35"
                              : "border-slate-300 hover:border-slate-500",
                          ].join(" ")}
                        >
                          {overlay.kind === "text" ? (
                            <div
                              className="h-full w-full px-1.5 py-1 text-slate-900"
                              style={{ fontSize: overlay.fontSize }}
                            >
                              {(overlay.text ?? "").trim() || "Text"}
                            </div>
                          ) : overlay.dataUrl ? (
                            <NextImage
                              src={overlay.dataUrl}
                              alt={overlay.kind}
                              fill
                              unoptimized
                              className="object-contain"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-[10px] text-slate-500">
                              Missing image
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeOverlay(overlay.id);
                            }}
                            className="absolute right-1 top-1 rounded bg-black/45 px-1 py-0.5 text-[10px] font-semibold text-white hover:bg-black/65"
                            aria-label="Remove overlay"
                          >
                            ×
                          </button>

                          <div
                            onMouseDown={(event) => beginOverlayDrag(event, overlay, "resize")}
                            className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize bg-slate-900/70"
                            aria-hidden="true"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 text-center text-xs font-medium text-slate-300">
                      Page {pageIndex + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      <SignatureChooserModal
        kind={signatureChooserKind}
        signatures={chooserSignatures}
        activeSignatureId={signatureChooserKind ? activeSignatureByKind[signatureChooserKind] : null}
        onClose={() => {
          setSignatureChooserKind(null);
        }}
        onUseSaved={onUseSavedSignature}
        onCreateNew={onCreateNewSignature}
        onSelectSaved={(signatureId) => {
          if (!signatureChooserKind) return;
          setActiveSignatureByKind((prev) => ({
            ...prev,
            [signatureChooserKind]: signatureId,
          }));
        }}
      />

      <SignatureModal
        key={signatureModalKind ?? "signature-modal"}
        kind={signatureModalKind}
        onClose={() => {
          setSignatureModalKind(null);
          setCreateAfterModalKind(null);
        }}
        onSave={onSignatureSaved}
      />
    </div>
  );
}
