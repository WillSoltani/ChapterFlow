#!/usr/bin/env python3
from __future__ import annotations

import io
import json
import subprocess
import tempfile
import unittest
import zipfile
from importlib import util
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "document_to_images_zip.py"
if not SCRIPT.exists():
    SCRIPT = Path("/var/task/document_to_images_zip.py")


class TestDocumentToImagesZip(unittest.TestCase):
    def _run(self, input_path: Path, output_zip: Path, target: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                "python3",
                str(SCRIPT),
                str(input_path),
                str(output_zip),
                "sample",
                target,
                "144",  # dpi
                "80",   # quality
                "100",  # resize_pct
                "0",    # max_width
            ],
            capture_output=True,
            text=True,
            check=False,
        )

    def _make_two_page_pdf(self, path: Path) -> None:
        first = Image.new("RGB", (300, 140), (230, 240, 255))
        second = Image.new("RGB", (300, 140), (255, 240, 230))
        first.save(path, "PDF", save_all=True, append_images=[second])

    def _make_single_page_pdf(self, path: Path) -> None:
        Image.new("RGB", (320, 180), (210, 235, 250)).save(path, "PDF")

    def test_pdf_to_all_supported_image_targets(self) -> None:
        targets = ["png", "jpg", "webp", "gif", "tiff", "bmp", "ico", "svg"]
        if util.find_spec("pillow_avif") is not None:
            targets.append("avif")

        with tempfile.TemporaryDirectory(prefix="doc2img-") as td:
            td_path = Path(td)
            src_pdf = td_path / "input.pdf"
            self._make_two_page_pdf(src_pdf)

            for target in targets:
                with self.subTest(target=target):
                    out_zip = td_path / f"output-{target}.zip"
                    proc = self._run(src_pdf, out_zip, target)
                    self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
                    self.assertTrue(out_zip.exists())
                    self.assertGreater(out_zip.stat().st_size, 0)

                    payload = json.loads((proc.stdout or "").strip().splitlines()[-1])
                    self.assertTrue(payload.get("ok"))
                    self.assertEqual(payload.get("format"), target)
                    self.assertEqual(payload.get("pages"), 2)
                    self.assertEqual(payload.get("packaging"), "zip")
                    self.assertEqual(payload.get("output_count"), 2)

                    with zipfile.ZipFile(out_zip, "r") as zf:
                        names = sorted(zf.namelist())
                        self.assertEqual(len(names), 2, msg=f"unexpected entries: {names}")
                        self.assertTrue(all(name.endswith(f".{target}") for name in names))

                        for name in names:
                            encoded = zf.read(name)
                            self.assertGreater(len(encoded), 0)
                            if target == "svg":
                                lowered = encoded[:256].decode("utf-8", errors="ignore").lower()
                                self.assertIn("<svg", lowered)
                                continue

                            with Image.open(io.BytesIO(encoded)) as img:
                                self.assertGreater(img.width, 0)
                                self.assertGreater(img.height, 0)

    def test_single_page_pdf_outputs_single_file_not_zip(self) -> None:
        with tempfile.TemporaryDirectory(prefix="doc2img-single-") as td:
            td_path = Path(td)
            src_pdf = td_path / "single.pdf"
            out_file = td_path / "output.png"
            self._make_single_page_pdf(src_pdf)

            proc = self._run(src_pdf, out_file, "png")
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            self.assertTrue(out_file.exists())
            self.assertGreater(out_file.stat().st_size, 0)
            self.assertFalse(zipfile.is_zipfile(out_file))

            payload = json.loads((proc.stdout or "").strip().splitlines()[-1])
            self.assertTrue(payload.get("ok"))
            self.assertEqual(payload.get("pages"), 1)
            self.assertEqual(payload.get("output_count"), 1)
            self.assertEqual(payload.get("packaging"), "single")

            with Image.open(out_file) as img:
                self.assertEqual(img.format, "PNG")
                self.assertGreater(img.width, 0)
                self.assertGreater(img.height, 0)


if __name__ == "__main__":
    unittest.main()
