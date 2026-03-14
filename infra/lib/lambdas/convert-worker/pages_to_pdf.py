#!/usr/bin/env python3
"""
Extract a canonical PDF from an Apple Pages (.pages) bundle.

Usage:
  python3 pages_to_pdf.py <input.pages> <output.pdf>
"""

from __future__ import annotations

from dataclasses import dataclass
import io
import json
import os
import re
import sys
import zipfile

from PIL import Image, ImageOps


PREVIEW_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff")
MAX_REASONABLE_PAGE_INDEX = 1000


@dataclass(frozen=True)
class PreviewImageCandidate:
    entry: str
    width: int
    height: int
    byte_size: int
    page_index: int | None


def emit_error(where: str, message: str, extra: dict | None = None) -> None:
    payload = {
        "ok": False,
        "error_type": "pages_to_pdf_error",
        "where": where,
        "message": message,
    }
    if extra:
        payload.update(extra)
    print(json.dumps(payload), file=sys.stderr, flush=True)


def natural_sort_key(value: str) -> list[object]:
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", value)]


def pick_preview_pdf(entries: list[str]) -> str | None:
    lower_map = {name.lower(): name for name in entries}

    # Priority 1: canonical QuickLook paths
    for p in ["quicklook/preview.pdf", "preview.pdf"]:
        if p in lower_map:
            return lower_map[p]

    # Priority 2: any entry ending with preview.pdf (locale-specific or nested paths)
    for name in entries:
        if name.lower().endswith("preview.pdf"):
            return name

    # Priority 3: any PDF inside a QuickLook-like directory
    for name in entries:
        nl = name.lower()
        if nl.endswith(".pdf") and ("quicklook" in nl or "qlpreview" in nl):
            return name

    # Priority 4: any embedded PDF at all (last resort for reduced-size Pages files
    # that store a PDF thumbnail rather than a full QuickLook preview)
    for name in entries:
        if name.lower().endswith(".pdf"):
            return name

    return None


def pick_preview_images(entries: list[str]) -> list[str]:
    def is_image(name: str) -> bool:
        return name.lower().endswith(PREVIEW_IMAGE_EXTENSIONS)

    quicklook_images = [name for name in entries if name.lower().startswith("quicklook/") and is_image(name)]
    if quicklook_images:
        ranked = sorted(
            quicklook_images,
            key=lambda name: (
                0 if "preview" in name.lower() else 1,
                0 if "page" in name.lower() else 1,
                0 if "thumbnail" in name.lower() else 1,
                natural_sort_key(name),
            ),
        )
        return ranked

    preview_named = [
        name
        for name in entries
        if is_image(name)
        and (
            "preview" in name.lower()
            or "thumbnail" in name.lower()
            or "quicklook" in name.lower()
            or "qlpreview" in name.lower()
        )
    ]
    return sorted(preview_named, key=natural_sort_key)


def detect_page_index_from_name(name: str) -> int | None:
    base = os.path.basename(name).lower()
    stem = re.sub(r"\.[a-z0-9]+$", "", base)
    parts = [part for part in re.split(r"[^a-z0-9]+", stem) if part]
    if not parts:
        return None

    for idx, token in enumerate(parts):
        if token in {"page", "preview", "pg", "p"} and idx + 1 < len(parts):
            next_token = parts[idx + 1]
            if next_token.isdigit():
                page = int(next_token)
                if 1 <= page <= MAX_REASONABLE_PAGE_INDEX:
                    return page

        for prefix in ("page", "preview", "pg", "p"):
            if token.startswith(prefix) and token[len(prefix) :].isdigit():
                page = int(token[len(prefix) :])
                if 1 <= page <= MAX_REASONABLE_PAGE_INDEX:
                    return page

    return None


def size_variant_rank(name: str) -> int:
    lower = name.lower()
    if "large" in lower or "full" in lower:
        return 3
    if "medium" in lower or "med" in lower:
        return 2
    if "small" in lower or "thumb" in lower:
        return 1
    return 0


def candidate_quality_key(candidate: PreviewImageCandidate) -> tuple[int, int, int, int, int, str]:
    lower = candidate.entry.lower()
    area = candidate.width * candidate.height
    preview_bonus = 1 if "preview" in lower else 0
    thumbnail_penalty = -1 if "thumbnail" in lower else 0
    return (
        area,
        candidate.width,
        candidate.byte_size,
        size_variant_rank(lower),
        preview_bonus + thumbnail_penalty,
        lower,
    )


def collect_preview_image_candidates(
    zf: zipfile.ZipFile, image_entries: list[str]
) -> list[PreviewImageCandidate]:
    candidates: list[PreviewImageCandidate] = []
    for entry in image_entries:
        try:
            data = zf.read(entry)
            if not data:
                continue
            with Image.open(io.BytesIO(data)) as img:
                normalized = ImageOps.exif_transpose(img)
                width, height = normalized.size
            if width <= 0 or height <= 0:
                continue
            candidates.append(
                PreviewImageCandidate(
                    entry=entry,
                    width=width,
                    height=height,
                    byte_size=len(data),
                    page_index=detect_page_index_from_name(entry),
                )
            )
        except Exception:
            continue
    return candidates


def select_best_preview_images(candidates: list[PreviewImageCandidate]) -> list[PreviewImageCandidate]:
    if not candidates:
        return []

    grouped: dict[int, list[PreviewImageCandidate]] = {}
    for candidate in candidates:
        if candidate.page_index is None:
            continue
        grouped.setdefault(candidate.page_index, []).append(candidate)

    # If image names encode page numbers, keep one highest-quality variant per page.
    if grouped:
        selected = []
        for page in sorted(grouped.keys()):
            best = max(grouped[page], key=candidate_quality_key)
            selected.append(best)
        return selected

    # Otherwise treat entries as alternative previews (small/medium/large) for same page.
    return [max(candidates, key=candidate_quality_key)]


def _flatten_to_rgb(img: Image.Image) -> Image.Image:
    normalized = ImageOps.exif_transpose(img)
    if normalized.mode in {"RGBA", "LA"} or "transparency" in normalized.info:
        rgba = normalized.convert("RGBA")
        canvas = Image.new("RGB", rgba.size, (255, 255, 255))
        canvas.paste(rgba, mask=rgba.split()[-1])
        return canvas
    return normalized.convert("RGB")


def build_visual_pdf_from_images(
    zf: zipfile.ZipFile, selected_candidates: list[PreviewImageCandidate], output_path: str
) -> tuple[int, list[str]]:
    pages: list[Image.Image] = []
    used_entries: list[str] = []
    try:
        for candidate in selected_candidates:
            try:
                data = zf.read(candidate.entry)
                if not data:
                    continue
                with Image.open(io.BytesIO(data)) as img:
                    page = _flatten_to_rgb(img)
                    pages.append(page)
                    used_entries.append(candidate.entry)
            except Exception:
                continue

        if not pages:
            raise RuntimeError("No usable QuickLook preview images were found in this .pages file")

        first, *rest = pages
        first.save(output_path, format="PDF", resolution=144.0, save_all=True, append_images=rest)
        return len(pages), used_entries
    finally:
        for page in pages:
            try:
                page.close()
            except Exception:
                pass


def count_pdf_pages(path: str) -> int:
    try:
        import fitz  # noqa: PLC0415
    except Exception:
        return 0
    try:
        doc = fitz.open(path)
        try:
            return len(doc)
        finally:
            doc.close()
    except Exception:
        return 0


def main() -> None:
    if len(sys.argv) != 3:
        emit_error("args", f"Usage: {sys.argv[0]} <input.pages> <output.pdf>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    if not os.path.exists(input_path):
        emit_error("validate_input", f"Input file not found: {input_path}")
        sys.exit(1)

    if not zipfile.is_zipfile(input_path):
        emit_error("validate_input", "Input is not a valid .pages zip container")
        sys.exit(1)

    try:
        with zipfile.ZipFile(input_path, "r") as zf:
            names = zf.namelist()
            preview_entry = pick_preview_pdf(names)
            converter = "pages_quicklook_preview"
            source_entry = preview_entry or ""
            source_entries: list[str] = [preview_entry] if preview_entry else []
            visual_fallback = False

            if preview_entry:
                data = zf.read(preview_entry)
                if not data.startswith(b"%PDF-"):
                    emit_error("validate_preview", "Embedded preview file is not a valid PDF")
                    sys.exit(1)
                os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
                with open(output_path, "wb") as f:
                    f.write(data)
            else:
                preview_images = pick_preview_images(names)
                if not preview_images:
                    quicklook_entries = [n for n in names if n.lower().startswith("quicklook/")]
                    emit_error(
                        "extract_preview",
                        "This .pages file does not include an embedded preview PDF or usable preview images. "
                        "Open it in Apple Pages on macOS, then Save or Export to PDF before uploading.",
                        {
                            "hint": "Re-save from Apple Pages with previews enabled, or export to PDF first.",
                            "all_pdf_entries": [n for n in names if n.lower().endswith(".pdf")][:20],
                            "all_image_entries": [
                                n for n in names if n.lower().endswith(PREVIEW_IMAGE_EXTENSIONS)
                            ][:20],
                            "quicklook_entries": quicklook_entries[:20],
                        },
                    )
                    sys.exit(1)
                candidates = collect_preview_image_candidates(zf, preview_images)
                selected_candidates = select_best_preview_images(candidates)
                if not selected_candidates:
                    emit_error("extract_preview_images", "No usable preview images were found in this .pages file")
                    sys.exit(1)
                os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
                image_count, used_entries = build_visual_pdf_from_images(zf, selected_candidates, output_path)
                if image_count <= 0:
                    emit_error("extract_preview_images", "No usable preview images were rendered into a PDF")
                    sys.exit(1)
                converter = "pages_quicklook_images"
                visual_fallback = True
                source_entries = used_entries
                source_entry = used_entries[0] if used_entries else preview_images[0]
    except zipfile.BadZipFile:
        emit_error("read_zip", "Invalid .pages zip file")
        sys.exit(1)
    except Exception as exc:
        emit_error("read_zip", str(exc))
        sys.exit(1)

    if not os.path.exists(output_path):
        emit_error("validate_output", "Output PDF was not created")
        sys.exit(1)

    size = os.path.getsize(output_path)
    if size <= 0:
        emit_error("validate_output", "Output PDF is empty")
        sys.exit(1)

    page_count = count_pdf_pages(output_path)
    print(
        json.dumps(
            {
                "ok": True,
                "converter": converter,
                "source_entry": source_entry,
                "source_entries": source_entries[:20],
                "visual_fallback": visual_fallback,
                "page_count": page_count,
                "size": size,
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
