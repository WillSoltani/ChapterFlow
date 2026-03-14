#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
import zipfile
from io import BytesIO
from importlib import util
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "pages_to_pdf.py"
if not SCRIPT.exists():
    SCRIPT = Path("/var/task/pages_to_pdf.py")
DOC_TO_IMG_SCRIPT = ROOT / "document_to_images_zip.py"
if not DOC_TO_IMG_SCRIPT.exists():
    DOC_TO_IMG_SCRIPT = Path("/var/task/document_to_images_zip.py")


class TestPagesToPdf(unittest.TestCase):
    def _run(self, input_path: Path, output_path: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", str(SCRIPT), str(input_path), str(output_path)],
            capture_output=True,
            text=True,
            check=False,
        )

    def _run_doc_to_images(self, input_pdf: Path, output_path: Path, target: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                "python3",
                str(DOC_TO_IMG_SCRIPT),
                str(input_pdf),
                str(output_path),
                "sample",
                target,
                "144",
                "80",
                "100",
                "0",
            ],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_extracts_quicklook_preview_pdf(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pages-to-pdf-") as td:
            td_path = Path(td)
            pages_path = td_path / "sample.pages"
            preview_pdf_path = td_path / "preview.pdf"
            output_pdf_path = td_path / "out.pdf"

            Image.new("RGB", (300, 120), (220, 220, 250)).save(preview_pdf_path, "PDF")

            with zipfile.ZipFile(pages_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.write(preview_pdf_path, arcname="QuickLook/Preview.pdf")
                zf.writestr("Index/Document.iwa", b"iwa")

            proc = self._run(pages_path, output_pdf_path)
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            self.assertTrue(output_pdf_path.exists())
            self.assertGreater(output_pdf_path.stat().st_size, 0)

            with output_pdf_path.open("rb") as f:
                header = f.read(5)
            self.assertEqual(header, b"%PDF-")

            payload = json.loads((proc.stdout or "").strip().splitlines()[-1])
            self.assertTrue(payload.get("ok"))
            self.assertEqual(payload.get("converter"), "pages_quicklook_preview")

    def test_falls_back_to_preview_images_when_preview_pdf_missing(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pages-to-pdf-image-fallback-") as td:
            td_path = Path(td)
            pages_path = td_path / "sample.pages"
            output_pdf_path = td_path / "out.pdf"

            page1 = BytesIO()
            page2 = BytesIO()
            Image.new("RGB", (300, 180), (245, 220, 200)).save(page1, "JPEG")
            Image.new("RGB", (300, 180), (200, 230, 245)).save(page2, "JPEG")

            with zipfile.ZipFile(pages_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.writestr("Index/Document.iwa", b"iwa")
                zf.writestr("QuickLook/Preview-1.jpg", page1.getvalue())
                zf.writestr("QuickLook/Preview-2.jpg", page2.getvalue())

            proc = self._run(pages_path, output_pdf_path)
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            self.assertTrue(output_pdf_path.exists())
            with output_pdf_path.open("rb") as f:
                header = f.read(5)
            self.assertEqual(header, b"%PDF-")

            payload = json.loads((proc.stdout or "").strip().splitlines()[-1])
            self.assertTrue(payload.get("ok"))
            self.assertEqual(payload.get("converter"), "pages_quicklook_images")
            self.assertEqual(payload.get("visual_fallback"), True)
            self.assertEqual(int(payload.get("page_count", 0)), 2)
            self.assertEqual(len(payload.get("source_entries", [])), 2)

    def test_single_page_preview_variants_keep_only_largest_image(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pages-to-pdf-variants-single-") as td:
            td_path = Path(td)
            pages_path = td_path / "sample.pages"
            output_pdf_path = td_path / "out.pdf"

            small = BytesIO()
            medium = BytesIO()
            large = BytesIO()
            Image.new("RGB", (120, 90), (240, 230, 210)).save(small, "JPEG")
            Image.new("RGB", (360, 270), (240, 210, 190)).save(medium, "JPEG")
            Image.new("RGB", (900, 700), (210, 230, 250)).save(large, "JPEG")

            with zipfile.ZipFile(pages_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.writestr("Index/Document.iwa", b"iwa")
                zf.writestr("QuickLook/Preview-small.jpg", small.getvalue())
                zf.writestr("QuickLook/Preview-medium.jpg", medium.getvalue())
                zf.writestr("QuickLook/Preview-large.jpg", large.getvalue())
                zf.writestr("QuickLook/Thumbnail.jpg", small.getvalue())

            proc = self._run(pages_path, output_pdf_path)
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            payload = json.loads((proc.stdout or "").strip().splitlines()[-1])
            self.assertEqual(payload.get("converter"), "pages_quicklook_images")
            self.assertEqual(int(payload.get("page_count", 0)), 1)
            source_entries = payload.get("source_entries", [])
            self.assertEqual(len(source_entries), 1)
            self.assertIn("large", str(source_entries[0]).lower())

    def test_multi_page_preview_variants_keep_largest_per_page(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pages-to-pdf-variants-multi-") as td:
            td_path = Path(td)
            pages_path = td_path / "sample.pages"
            output_pdf_path = td_path / "out.pdf"

            p1_small = BytesIO()
            p1_large = BytesIO()
            p2_small = BytesIO()
            p2_large = BytesIO()
            Image.new("RGB", (180, 120), (240, 220, 210)).save(p1_small, "JPEG")
            Image.new("RGB", (960, 640), (210, 220, 250)).save(p1_large, "JPEG")
            Image.new("RGB", (190, 130), (240, 210, 220)).save(p2_small, "JPEG")
            Image.new("RGB", (980, 650), (220, 240, 210)).save(p2_large, "JPEG")

            with zipfile.ZipFile(pages_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.writestr("Index/Document.iwa", b"iwa")
                zf.writestr("QuickLook/Page-1-small.jpg", p1_small.getvalue())
                zf.writestr("QuickLook/Page-1-large.jpg", p1_large.getvalue())
                zf.writestr("QuickLook/Page-2-small.jpg", p2_small.getvalue())
                zf.writestr("QuickLook/Page-2-large.jpg", p2_large.getvalue())
                zf.writestr("QuickLook/Thumbnail.jpg", p1_small.getvalue())

            proc = self._run(pages_path, output_pdf_path)
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            payload = json.loads((proc.stdout or "").strip().splitlines()[-1])
            self.assertEqual(payload.get("converter"), "pages_quicklook_images")
            self.assertEqual(int(payload.get("page_count", 0)), 2)
            source_entries = [str(v).lower() for v in payload.get("source_entries", [])]
            self.assertEqual(len(source_entries), 2)
            self.assertTrue(any("page-1-large" in entry for entry in source_entries))
            self.assertTrue(any("page-2-large" in entry for entry in source_entries))

    def test_fails_when_no_preview_pdf_or_images_exist(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pages-to-pdf-missing-") as td:
            td_path = Path(td)
            pages_path = td_path / "sample.pages"
            output_pdf_path = td_path / "out.pdf"

            with zipfile.ZipFile(pages_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.writestr("Index/Document.iwa", b"iwa")

            proc = self._run(pages_path, output_pdf_path)
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("preview", (proc.stderr or "").lower())

    def test_pages_preview_pdf_single_page_rasterizes_to_single_output(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pages-doc2img-") as td:
            td_path = Path(td)
            pages_path = td_path / "sample.pages"
            preview_pdf_path = td_path / "preview.pdf"
            canonical_pdf_path = td_path / "canonical.pdf"

            Image.new("RGB", (320, 160), (210, 230, 250)).save(preview_pdf_path, "PDF")
            with zipfile.ZipFile(pages_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.write(preview_pdf_path, arcname="QuickLook/Preview.pdf")
                zf.writestr("Index/Document.iwa", b"iwa")

            to_pdf = self._run(pages_path, canonical_pdf_path)
            self.assertEqual(to_pdf.returncode, 0, msg=f"stderr={to_pdf.stderr}\nstdout={to_pdf.stdout}")
            self.assertTrue(canonical_pdf_path.exists())

            targets = ["png", "svg"]
            if util.find_spec("pillow_avif") is not None:
                targets.append("avif")

            for target in targets:
                with self.subTest(target=target):
                    out_file = td_path / f"pages-{target}.{target}"
                    proc = self._run_doc_to_images(canonical_pdf_path, out_file, target)
                    self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
                    self.assertTrue(out_file.exists())
                    payload = json.loads((proc.stdout or "").strip().splitlines()[-1])
                    self.assertEqual(payload.get("packaging"), "single")
                    self.assertEqual(int(payload.get("pages", 0)), 1)
                    self.assertFalse(zipfile.is_zipfile(out_file))

    def test_pages_preview_images_single_page_rasterizes_to_single_output(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pages-doc2img-fallback-") as td:
            td_path = Path(td)
            pages_path = td_path / "sample.pages"
            canonical_pdf_path = td_path / "canonical.pdf"

            small = BytesIO()
            medium = BytesIO()
            large = BytesIO()
            Image.new("RGB", (140, 90), (230, 220, 250)).save(small, "PNG")
            Image.new("RGB", (420, 260), (230, 220, 250)).save(medium, "PNG")
            Image.new("RGB", (980, 620), (230, 220, 250)).save(large, "PNG")
            with zipfile.ZipFile(pages_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.writestr("QuickLook/Preview-small.png", small.getvalue())
                zf.writestr("QuickLook/Preview-medium.png", medium.getvalue())
                zf.writestr("QuickLook/Preview-large.png", large.getvalue())
                zf.writestr("Index/Document.iwa", b"iwa")

            to_pdf = self._run(pages_path, canonical_pdf_path)
            self.assertEqual(to_pdf.returncode, 0, msg=f"stderr={to_pdf.stderr}\nstdout={to_pdf.stdout}")
            self.assertTrue(canonical_pdf_path.exists())
            payload = json.loads((to_pdf.stdout or "").strip().splitlines()[-1])
            self.assertEqual(payload.get("converter"), "pages_quicklook_images")
            self.assertEqual(int(payload.get("page_count", 0)), 1)

            out_file = td_path / "pages-png.png"
            proc = self._run_doc_to_images(canonical_pdf_path, out_file, "png")
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            self.assertTrue(out_file.exists())
            payload = json.loads((proc.stdout or "").strip().splitlines()[-1])
            self.assertEqual(payload.get("packaging"), "single")
            self.assertEqual(int(payload.get("pages", 0)), 1)
            self.assertFalse(zipfile.is_zipfile(out_file))


if __name__ == "__main__":
    unittest.main()
