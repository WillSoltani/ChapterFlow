#!/usr/bin/env python3
"""
Single-image to PDF converter for Lambda worker.

Usage:
  python3 image_to_pdf.py <input-image> <output.pdf>
"""

from __future__ import annotations

import json
import os
import sys

from PIL import Image


def emit_error(where: str, message: str) -> None:
    payload = {
        "ok": False,
        "error_type": "image_to_pdf_error",
        "where": where,
        "message": message,
    }
    print(json.dumps(payload), file=sys.stderr, flush=True)


def main() -> None:
    if len(sys.argv) != 3:
        emit_error("args", f"Usage: {sys.argv[0]} <input-image> <output.pdf>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    if not os.path.exists(input_path):
        emit_error("validate_input", f"Input file not found: {input_path}")
        sys.exit(1)

    try:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with Image.open(input_path) as img:
            if getattr(img, "is_animated", False):
                img.seek(0)
            # PDF writer expects RGB/L mode; normalize for consistent output.
            if img.mode in {"RGBA", "LA"} or "transparency" in img.info:
                rgba = img.convert("RGBA")
                canvas = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
                canvas.alpha_composite(rgba)
                img = canvas.convert("RGB")
            elif img.mode not in {"RGB", "L"}:
                img = img.convert("RGB")
            img.save(output_path, "PDF", resolution=300.0)
    except Exception as exc:
        emit_error("convert", str(exc))
        sys.exit(1)

    if not os.path.exists(output_path):
        emit_error("validate_output", "image_to_pdf output file was not created")
        sys.exit(1)

    size = os.path.getsize(output_path)
    if size <= 0:
        emit_error("validate_output", "image_to_pdf output file is empty")
        sys.exit(1)

    print(json.dumps({"ok": True, "size": size}), flush=True)


if __name__ == "__main__":
    main()
