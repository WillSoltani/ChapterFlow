#!/usr/bin/env python3
"""
Image special encoders used by the conversion worker.

Usage:
  python3 image_special_convert.py <input-image> <output-file> <target>

Targets:
  - ico
  - bmp
  - avif
  - heic
  - heif
  - avif_decode
  - bmp_decode
  - heif_decode
"""

from __future__ import annotations

import json
import os
import sys

from PIL import Image


def emit_error(where: str, message: str) -> None:
    payload = {
        "ok": False,
        "error_type": "image_special_convert_error",
        "where": where,
        "message": message,
    }
    print(json.dumps(payload), file=sys.stderr, flush=True)


def icon_sizes(width: int, height: int) -> list[tuple[int, int]]:
    preferred = [256, 192, 128, 96, 64, 48, 32, 24, 16]
    max_dim = max(width, height)
    sizes = [(s, s) for s in preferred if s <= max_dim]
    if sizes:
        return sizes
    fallback = max(16, min(256, max_dim))
    return [(fallback, fallback)]


def ensure_avif_support() -> None:
    try:
        import pillow_avif  # noqa: PLC0415
    except Exception as exc:  # pragma: no cover - exercised in container runtime tests
        raise RuntimeError(f"AVIF codec support is unavailable in this runtime: {exc}") from exc

    register = getattr(pillow_avif, "register", None)
    if callable(register):
        register()


def ensure_heif_support() -> None:
    try:
        import pillow_heif  # noqa: PLC0415
    except Exception as exc:  # pragma: no cover - exercised in container runtime tests
        raise RuntimeError(f"HEIF codec support is unavailable in this runtime: {exc}") from exc

    register_heif = getattr(pillow_heif, "register_heif_opener", None)
    if callable(register_heif):
        register_heif()


def main() -> None:
    if len(sys.argv) not in {4, 5}:
        emit_error("args", f"Usage: {sys.argv[0]} <input-image> <output-file> <target> [quality]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    target = (sys.argv[3] or "").strip().lower()
    quality = int(sys.argv[4]) if len(sys.argv) == 5 else 60
    quality = max(1, min(100, quality))

    if target not in {"ico", "bmp", "avif", "heic", "heif", "avif_decode", "bmp_decode", "heif_decode"}:
        emit_error("validate_args", f"Unsupported target: {target}")
        sys.exit(1)
    if not os.path.exists(input_path):
        emit_error("validate_input", f"Input file not found: {input_path}")
        sys.exit(1)

    try:
        if target in {"avif", "avif_decode"}:
            ensure_avif_support()
        if target in {"heic", "heif", "heif_decode"}:
            ensure_heif_support()

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with Image.open(input_path) as src:
            if target == "ico":
                rgba = src.convert("RGBA")
                sizes = icon_sizes(rgba.width, rgba.height)
                rgba.save(output_path, format="ICO", sizes=sizes)
            elif target == "bmp":
                # BMP has no alpha channel in common viewers; flatten transparency to white.
                if src.mode in {"RGBA", "LA"} or "transparency" in src.info:
                    rgba = src.convert("RGBA")
                    canvas = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
                    canvas.alpha_composite(rgba)
                    bmp = canvas.convert("RGB")
                else:
                    bmp = src.convert("RGB")
                bmp.save(output_path, format="BMP")
            elif target == "avif":
                img = src.convert("RGBA") if src.mode in {"RGBA", "LA"} else src.convert("RGB")
                img.save(output_path, format="AVIF", quality=quality)
            elif target == "avif_decode":
                # Decode AVIF → PNG so Node.js/sharp can consume it.
                decoded = src.convert("RGBA") if src.mode in {"RGBA", "LA"} else src.convert("RGB")
                decoded.save(output_path, format="PNG", compress_level=1)
            elif target in {"heic", "heif"}:
                encoded = src.convert("RGBA") if src.mode in {"RGBA", "LA"} else src.convert("RGB")
                encoded.save(output_path, format="HEIF", quality=quality)
            elif target == "bmp_decode":
                # Normalize any BMP variant → PNG for consistent sharp decoding.
                decoded = src.convert("RGBA") if src.mode in {"RGBA", "LA"} else src.convert("RGB")
                decoded.save(output_path, format="PNG", compress_level=1)
            elif target == "heif_decode":
                # Decode HEIC/HEIF → PNG for consistent downstream processing.
                decoded = src.convert("RGBA") if src.mode in {"RGBA", "LA"} else src.convert("RGB")
                decoded.save(output_path, format="PNG", compress_level=1)
    except Exception as exc:
        emit_error("convert", str(exc))
        sys.exit(1)

    if not os.path.exists(output_path):
        emit_error("validate_output", "Output file was not created")
        sys.exit(1)

    size = os.path.getsize(output_path)
    if size <= 0:
        emit_error("validate_output", "Output file is empty")
        sys.exit(1)

    print(
        json.dumps(
            {
                "ok": True,
                "target": target,
                "size": size,
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
