#!/usr/bin/env python3
"""
DOCX/DOC -> canonical PDF via LibreOffice headless.

Usage:
  python3 docx_to_pdf.py <input.docx> <output.pdf>
"""

import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

from docx_sanitize import sanitize_docx_for_pdf


def emit_error(where: str, message: str) -> None:
    payload = {
        "ok": False,
        "error_type": "docx_to_pdf_error",
        "where": where,
        "message": message,
    }
    print(json.dumps(payload), file=sys.stderr, flush=True)


def parse_version_output(text: str) -> str:
    line = (text or "").strip().splitlines()
    return line[0].strip() if line else "unknown"


def non_blank_fraction(page) -> float:
    # Low-res probe: enough to catch blank/white-only failures cheaply.
    import fitz  # noqa: PLC0415

    pix = page.get_pixmap(matrix=fitz.Matrix(0.4, 0.4), alpha=False)
    samples = memoryview(pix.samples)
    if pix.width <= 0 or pix.height <= 0:
        return 0.0
    non_white = 0
    total = pix.width * pix.height
    # RGB triplets
    for i in range(0, len(samples), 3):
        if samples[i] < 245 or samples[i + 1] < 245 or samples[i + 2] < 245:
            non_white += 1
    return non_white / float(total)


def page_text_width_ratio(page, min_words: int = 20) -> float | None:
    words = page.get_text("words")
    if len(words) < min_words:
        return None
    min_x = min(w[0] for w in words)
    max_x = max(w[2] for w in words)
    width = float(page.rect.width)
    if width <= 0:
        return None
    return (max_x - min_x) / width


def analyze_pdf_layout(pdf_path: str, narrow_threshold: float = 0.20) -> dict:
    import fitz  # noqa: PLC0415

    doc = fitz.open(pdf_path)
    try:
        page_count = len(doc)
        if page_count <= 0:
            raise RuntimeError("Rendered PDF has zero pages")

        non_blank_pages = 0
        sample_coverage: list[float] = []
        text_width_ratios: list[float | None] = []
        narrow_pages: list[int] = []
        for idx in range(page_count):
            page = doc[idx]
            frac = non_blank_fraction(page)
            sample_coverage.append(frac)
            if frac >= 0.002:
                non_blank_pages += 1

            ratio = page_text_width_ratio(page)
            text_width_ratios.append(ratio)
            if ratio is not None and ratio < narrow_threshold:
                narrow_pages.append(idx + 1)

        if non_blank_pages == 0:
            raise RuntimeError("Rendered PDF appears blank (all sampled pages near-white)")

        return {
            "page_count": page_count,
            "non_blank_pages": non_blank_pages,
            "sample_coverage": sample_coverage,
            "text_width_ratios": text_width_ratios,
            "narrow_text_pages": narrow_pages,
            "narrow_threshold": narrow_threshold,
        }
    finally:
        doc.close()


def run_libreoffice_convert(input_path: str, out_dir: str) -> str:
    env = os.environ.copy()
    env["HOME"] = out_dir
    env["TMPDIR"] = out_dir
    env["SAL_USE_VCLPLUGIN"] = "svp"
    env["LANG"] = env.get("LANG", "en_US.UTF-8")
    env["LC_ALL"] = env.get("LC_ALL", "en_US.UTF-8")

    cmd = [
        "libreoffice",
        "--headless",
        "--nologo",
        "--nodefault",
        "--nofirststartwizard",
        "--nolockcheck",
        "--convert-to",
        "pdf:writer_pdf_Export",
        "--outdir",
        out_dir,
        input_path,
    ]
    proc = subprocess.run(
        cmd,
        check=False,
        env=env,
        capture_output=True,
        text=True,
        timeout=90,
    )
    if proc.returncode != 0:
        stderr = (proc.stderr or "").strip()
        stdout = (proc.stdout or "").strip()
        details = " | ".join(x for x in [stderr, stdout] if x)
        raise RuntimeError(f"LibreOffice failed (code={proc.returncode}){': ' + details if details else ''}")

    in_stem = pathlib.Path(input_path).stem
    expected = os.path.join(out_dir, f"{in_stem}.pdf")
    if os.path.exists(expected):
        return expected

    # LibreOffice occasionally rewrites names; find any produced PDF.
    for name in os.listdir(out_dir):
        if name.lower().endswith(".pdf"):
            return os.path.join(out_dir, name)
    raise RuntimeError("LibreOffice did not produce a PDF output file")


def candidate_score(candidate: dict, baseline_page_count: int) -> tuple[int, int, int]:
    layout = candidate["layout"]
    sanitization = candidate["sanitization"]
    narrow_count = len(layout.get("narrow_text_pages") or [])
    page_delta = abs(int(layout.get("page_count", 0)) - baseline_page_count)
    normalized = int(sanitization.get("normalized_sections", 0) or 0)
    # prioritize no narrow-page failures, then page-count stability, then minimum edits.
    return (narrow_count, page_delta, normalized)

def main() -> None:
    if len(sys.argv) != 3:
        emit_error("args", f"Usage: {sys.argv[0]} <input.docx> <output.pdf>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    if not os.path.exists(input_path):
        emit_error("validate_input", f"Input file not found: {input_path}")
        sys.exit(1)

    libreoffice_bin = shutil.which("libreoffice")
    if not libreoffice_bin:
        emit_error("runtime", "libreoffice binary not found; high-fidelity DOCX rendering requires LibreOffice")
        sys.exit(1)

    libreoffice_version = "unknown"
    try:
        ver = subprocess.run(
            [libreoffice_bin, "--version"],
            check=False,
            capture_output=True,
            text=True,
            timeout=15,
        )
        libreoffice_version = parse_version_output(ver.stdout or ver.stderr or "")
    except Exception:
        # Keep running even if version lookup fails.
        pass

    sanitize_report: dict = {}
    conversion_strategy = "baseline"
    variants_tried: list[dict] = []
    with tempfile.TemporaryDirectory(prefix="docx2pdf-") as tmp_dir:
        try:
            os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

            def run_candidate(
                name: str,
                sanitize_kwargs: dict | None,
            ) -> dict:
                cand_dir = os.path.join(tmp_dir, name)
                os.makedirs(cand_dir, exist_ok=True)

                source_docx = input_path
                local_sanitization: dict = {
                    "applied": False,
                    "reason": "not_requested",
                    "normalized_sections": 0,
                }
                if sanitize_kwargs is not None:
                    source_docx = os.path.join(cand_dir, "sanitized.docx")
                    local_sanitization = sanitize_docx_for_pdf(
                        input_path,
                        source_docx,
                        min_col_width_twips=2000,
                        min_col_ratio=0.35,
                        **sanitize_kwargs,
                    )

                produced_pdf = run_libreoffice_convert(source_docx, cand_dir)
                layout = analyze_pdf_layout(produced_pdf, narrow_threshold=0.20)
                variants_tried.append(
                    {
                        "name": name,
                        "page_count": layout["page_count"],
                        "narrow_text_pages": layout["narrow_text_pages"],
                        "normalized_sections": local_sanitization.get("normalized_sections", 0),
                    }
                )
                return {
                    "name": name,
                    "sanitize_kwargs": sanitize_kwargs or {},
                    "sanitization": local_sanitization,
                    "produced_pdf": produced_pdf,
                    "layout": layout,
                }

            candidates: list[dict] = []
            baseline = run_candidate("baseline", None)
            candidates.append(baseline)

            chosen = baseline
            baseline_narrow_pages = baseline["layout"].get("narrow_text_pages") or []
            baseline_page_count = int(baseline["layout"].get("page_count", 0))

            if baseline_narrow_pages:
                progressive_variants = [
                    ("sanitize_first_paragraph", {"max_paragraph_sections": 1, "include_body_final": False}),
                    ("sanitize_first_two_paragraphs", {"max_paragraph_sections": 2, "include_body_final": False}),
                    ("sanitize_all_paragraphs", {"max_paragraph_sections": None, "include_body_final": False}),
                    ("sanitize_all_including_body", {"max_paragraph_sections": None, "include_body_final": True}),
                ]

                for name, kwargs in progressive_variants:
                    cand = run_candidate(name, kwargs)
                    candidates.append(cand)
                    if not cand["layout"].get("narrow_text_pages") and int(cand["layout"].get("page_count", 0)) == baseline_page_count:
                        chosen = cand
                        break

                if chosen is baseline:
                    chosen = min(candidates, key=lambda c: candidate_score(c, baseline_page_count))

            sanitize_report = dict(chosen["sanitization"])
            sanitize_report["strategy"] = chosen["name"]
            sanitize_report["variants_tried"] = variants_tried
            conversion_strategy = chosen["name"]
            produced = chosen["produced_pdf"]
            shutil.copyfile(produced, output_path)
        except subprocess.TimeoutExpired:
            emit_error("convert", "DOCX conversion timed out")
            sys.exit(1)
        except Exception as exc:
            emit_error("convert", str(exc))
            sys.exit(1)

    if not os.path.exists(output_path):
        emit_error("validate_output", "DOCX->PDF output file was not created")
        sys.exit(1)

    size = os.path.getsize(output_path)
    if size <= 0:
        emit_error("validate_output", "DOCX->PDF produced an empty output file")
        sys.exit(1)

    try:
        import fitz  # noqa: PLC0415
    except ImportError as exc:
        emit_error("runtime", f"PyMuPDF not available for validation: {exc}")
        sys.exit(1)

    try:
        layout = analyze_pdf_layout(output_path, narrow_threshold=0.20)
        page_count = int(layout["page_count"])
        non_blank_pages = int(layout["non_blank_pages"])
        sample_coverage = list(layout["sample_coverage"])
        text_width_ratios = list(layout["text_width_ratios"])
        narrow_text_pages = list(layout["narrow_text_pages"])
    except Exception as exc:
        emit_error("validate_output", str(exc))
        sys.exit(1)

    print(
        json.dumps(
            {
                "ok": True,
                "size": size,
                "converter": "libreoffice",
                "libreoffice_version": libreoffice_version,
                "page_count": page_count,
                "non_blank_pages": non_blank_pages,
                "sample_coverage": sample_coverage,
                "text_width_ratios": text_width_ratios,
                "narrow_text_pages": narrow_text_pages,
                "conversion_strategy": conversion_strategy,
                "sanitization": sanitize_report,
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
