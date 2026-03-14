#!/usr/bin/env python3
"""
Convert PDF or DOCX/DOC to image artifacts.

Usage:
  python3 document_to_images_zip.py \
    <input_path> <output_path> <base_name> <format> <dpi> <quality> <resize_pct> <max_width>

Notes:
- format: png | jpg | webp | gif | tiff | avif | bmp | ico | svg
- resize_pct: 10-100 (100 = no explicit resize)
- max_width: 0 to disable preset width cap
- For single-page inputs, writes a single image file to output_path.
- For multi-page inputs, writes a ZIP archive to output_path.
"""

import base64
import io
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import zipfile


def emit_error(where: str, message: str, extra: dict | None = None) -> None:
    payload = {
        "ok": False,
        "error_type": "document_to_images_zip_error",
        "where": where,
        "message": message,
    }
    if extra:
        payload.update(extra)
    print(json.dumps(payload), file=sys.stderr, flush=True)


def sanitize_base_name(name: str) -> str:
    base = (name or "").strip()
    if not base:
        return "document"
    cleaned = "".join(ch for ch in base if ch not in '/\\:*?"<>|\r\n\t')
    return cleaned.strip() or "document"


def run_doc_to_pdf_script(input_path: str, output_pdf: str) -> None:
    script = "/var/task/docx_to_pdf.py"
    if not os.path.exists(script):
        script = os.path.join(os.path.dirname(__file__), "docx_to_pdf.py")

    proc = subprocess.run(
        ["python3", script, input_path, output_pdf],
        check=False,
        capture_output=True,
        text=True,
        timeout=100,
    )
    if proc.returncode != 0:
        stderr = (proc.stderr or "").strip()
        stdout = (proc.stdout or "").strip()
        details = " | ".join(x for x in [stderr, stdout] if x)
        raise RuntimeError(f"DOCX->PDF pre-conversion failed{': ' + details if details else ''}")
    if not os.path.exists(output_pdf):
        raise RuntimeError("DOCX->PDF pre-conversion did not produce a PDF")


def open_pdf_from_input(input_path: str):
    ext = pathlib.Path(input_path).suffix.lower()
    if ext == ".pdf":
        return input_path, None

    if ext in [".docx", ".doc"]:
        tmp_dir_obj = tempfile.TemporaryDirectory(prefix="doc-to-pdf-")
        pdf_path = os.path.join(tmp_dir_obj.name, "converted.pdf")
        run_doc_to_pdf_script(input_path, pdf_path)
        return pdf_path, tmp_dir_obj

    raise ValueError(f"Unsupported input type for document image conversion: {ext or 'unknown'}")


def mean_abs_error(a, b) -> float:
    # Normalized MAE in [0,1] over grayscale diff.
    from PIL import ImageChops  # noqa: PLC0415

    if a.size != b.size:
        raise ValueError(f"image dimensions mismatch: {a.size} vs {b.size}")
    diff = ImageChops.difference(a, b).convert("L")
    hist = diff.histogram()
    total = sum(v * count for v, count in enumerate(hist))
    denom = 255.0 * float(a.width * a.height)
    if denom <= 0:
        return 1.0
    return total / denom


def ensure_avif_support() -> None:
    try:
        import pillow_avif  # noqa: PLC0415
    except Exception as exc:  # pragma: no cover - exercised in runtime tests
        raise RuntimeError(f"AVIF codec support is unavailable in this runtime: {exc}") from exc

    register = getattr(pillow_avif, "register", None)
    if callable(register):
        register()


def icon_sizes(width: int, height: int) -> list[tuple[int, int]]:
    preferred = [256, 192, 128, 96, 64, 48, 32, 24, 16]
    max_dim = max(width, height)
    sizes = [(s, s) for s in preferred if s <= max_dim]
    if sizes:
        return sizes
    fallback = max(16, min(256, max_dim))
    return [(fallback, fallback)]


def png_to_embedded_svg(png_bytes: bytes, width: int, height: int) -> bytes:
    w = max(1, int(width))
    h = max(1, int(height))
    b64 = base64.b64encode(png_bytes).decode("ascii")
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" version="1.1">'
        f'<image width="{w}" height="{h}" href="data:image/png;base64,{b64}"/>'
        "</svg>\n"
    )
    return xml.encode("utf-8")


def main() -> None:
    if len(sys.argv) != 9:
        emit_error(
            "args",
            "Usage: document_to_images_zip.py <input_path> <output_path> <base_name> <format> <dpi> <quality> <resize_pct> <max_width>",
        )
        sys.exit(1)

    input_path = sys.argv[1]
    output_zip = sys.argv[2]
    base_name = sanitize_base_name(sys.argv[3])
    target_fmt = sys.argv[4].lower()
    dpi = int(sys.argv[5])
    quality = int(sys.argv[6])
    resize_pct = int(sys.argv[7])
    max_width = int(sys.argv[8])

    if not os.path.exists(input_path):
        emit_error("validate_input", f"Input file not found: {input_path}")
        sys.exit(1)
    if target_fmt not in ["png", "jpg", "webp", "gif", "tiff", "avif", "bmp", "ico", "svg"]:
        emit_error("validate_args", f"Unsupported target image format: {target_fmt}")
        sys.exit(1)
    if dpi < 36 or dpi > 400:
        emit_error("validate_args", "dpi must be between 36 and 400")
        sys.exit(1)
    if quality < 1 or quality > 100:
        emit_error("validate_args", "quality must be between 1 and 100")
        sys.exit(1)
    if resize_pct < 10 or resize_pct > 100:
        emit_error("validate_args", "resize_pct must be between 10 and 100")
        sys.exit(1)
    if max_width < 0:
        emit_error("validate_args", "max_width must be >= 0")
        sys.exit(1)

    try:
        import fitz  # noqa: PLC0415
    except ImportError as exc:
        emit_error("import", f"PyMuPDF not installed: {exc}")
        sys.exit(1)

    try:
        from PIL import Image  # noqa: PLC0415
    except ImportError as exc:
        emit_error("import", f"Pillow not installed: {exc}")
        sys.exit(1)

    tmp_ctx = None
    doc = None
    try:
        pdf_path, tmp_ctx = open_pdf_from_input(input_path)
        doc = fitz.open(pdf_path)
        page_count = len(doc)
        if page_count <= 0:
            raise RuntimeError("Document has no pages")

        if target_fmt == "avif":
            ensure_avif_support()

        os.makedirs(os.path.dirname(output_zip) or ".", exist_ok=True)
        scale = dpi / 72.0
        matrix = fitz.Matrix(scale, scale)
        thresholds = {"png": 0.0010, "jpg": 0.0200, "webp": 0.0200, "avif": 0.0300}
        threshold = thresholds.get(target_fmt)
        page_mae: list[float] = []
        rendered_pages: list[tuple[str, bytes]] = []

        for i in range(page_count):
            page = doc[i]
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            reference = image.copy()

            if resize_pct < 100:
                new_w = max(1, round(image.width * resize_pct / 100.0))
                new_h = max(1, round(image.height * resize_pct / 100.0))
                image = image.resize((new_w, new_h), Image.Resampling.LANCZOS)
                reference = reference.resize((new_w, new_h), Image.Resampling.LANCZOS)
            elif max_width > 0 and image.width > max_width:
                ratio = max_width / float(image.width)
                new_h = max(1, round(image.height * ratio))
                image = image.resize((max_width, new_h), Image.Resampling.LANCZOS)
                reference = reference.resize((max_width, new_h), Image.Resampling.LANCZOS)

            out_name = f"{base_name}_page_{i + 1:02d}.{target_fmt}"
            out_bytes = io.BytesIO()

            if target_fmt == "png":
                image.save(out_bytes, format="PNG", optimize=True, compress_level=6)
                encoded = out_bytes.getvalue()
            elif target_fmt == "jpg":
                image.save(out_bytes, format="JPEG", quality=quality, optimize=True, progressive=True)
                encoded = out_bytes.getvalue()
            elif target_fmt == "webp":
                image.save(out_bytes, format="WEBP", quality=quality, method=6)
                encoded = out_bytes.getvalue()
            elif target_fmt == "gif":
                image.convert("P", palette=Image.ADAPTIVE).save(out_bytes, format="GIF", optimize=True)
                encoded = out_bytes.getvalue()
            elif target_fmt == "tiff":
                image.save(out_bytes, format="TIFF", compression="tiff_adobe_deflate")
                encoded = out_bytes.getvalue()
            elif target_fmt == "avif":
                image.save(out_bytes, format="AVIF", quality=quality)
                encoded = out_bytes.getvalue()
            elif target_fmt == "bmp":
                image.save(out_bytes, format="BMP")
                encoded = out_bytes.getvalue()
            elif target_fmt == "ico":
                rgba = image.convert("RGBA")
                rgba.save(out_bytes, format="ICO", sizes=icon_sizes(rgba.width, rgba.height))
                encoded = out_bytes.getvalue()
            else:
                png_bytes = io.BytesIO()
                image.save(png_bytes, format="PNG", optimize=True, compress_level=6)
                encoded = png_to_embedded_svg(png_bytes.getvalue(), image.width, image.height)

            rendered_pages.append((out_name, encoded))

            # Fidelity gate: encoded page must stay within strict visual threshold
            if threshold is not None:
                decoded = Image.open(io.BytesIO(encoded)).convert("RGB")
                mae = mean_abs_error(reference, decoded)
                page_mae.append(mae)
                if mae > threshold:
                    emit_error(
                        "fidelity_gate",
                        f"Page {i + 1} exceeds fidelity threshold ({mae:.6f} > {threshold:.6f})",
                        {
                            "page": i + 1,
                            "format": target_fmt,
                            "mae": mae,
                            "threshold": threshold,
                        },
                    )
                    sys.exit(1)

        if page_count == 1:
            single_name, single_encoded = rendered_pages[0]
            with open(output_zip, "wb") as out_file:
                out_file.write(single_encoded)
            output_size = os.path.getsize(output_zip)
            if output_size <= 64:
                raise RuntimeError(f"Single output is suspiciously small ({output_size} bytes)")
            result: dict[str, object] = {
                "ok": True,
                "pages": page_count,
                "output_count": 1,
                "packaging": "single",
                "single_filename": single_name,
                "output_size": output_size,
                "format": target_fmt,
            }
        else:
            with zipfile.ZipFile(output_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
                for out_name, encoded in rendered_pages:
                    zf.writestr(out_name, encoded)

            if not os.path.exists(output_zip):
                raise RuntimeError("ZIP output file was not created")
            zip_size = os.path.getsize(output_zip)
            if zip_size <= 256:
                raise RuntimeError(f"ZIP output is suspiciously small ({zip_size} bytes)")

            result = {
                "ok": True,
                "pages": page_count,
                "output_count": page_count,
                "packaging": "zip",
                "zip_size": zip_size,
                "format": target_fmt,
            }
        if threshold is not None:
            max_mae = max(page_mae) if page_mae else 0.0
            avg_mae = sum(page_mae) / len(page_mae) if page_mae else 0.0
            result["fidelity"] = {
                "threshold": threshold,
                "max_mae": max_mae,
                "avg_mae": avg_mae,
                "page_mae": page_mae,
            }
        print(json.dumps(result), flush=True)
    except subprocess.TimeoutExpired:
        emit_error("docx_to_pdf", "DOCX->PDF pre-conversion timed out")
        sys.exit(1)
    except Exception as exc:
        emit_error("convert", str(exc))
        sys.exit(1)
    finally:
        if doc is not None:
            doc.close()
        if tmp_ctx is not None:
            tmp_ctx.cleanup()


if __name__ == "__main__":
    main()
