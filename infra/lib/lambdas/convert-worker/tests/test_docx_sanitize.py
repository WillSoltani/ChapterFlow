#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET
import zipfile


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from docx_sanitize import sanitize_docx_for_pdf  # noqa: E402


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"


def _make_minimal_docx(path: Path, paragraph_count: int = 80) -> None:
    long_line = (
        "This is a long resume-style paragraph that should flow across a normal page width "
        "without collapsing into a narrow vertical strip. "
    )
    paras = []
    for i in range(paragraph_count):
        text = f"{long_line} Paragraph {i+1}."
        paras.append(f"<w:p><w:r><w:t>{text}</w:t></w:r></w:p>")

    document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W_NS}">
  <w:body>
    {''.join(paras[:25])}
    <w:p>
      <w:pPr>
        <w:sectPr>
          <w:type w:val="continuous"/>
          <w:cols w:num="2" w:equalWidth="0">
            <w:col w:w="929"/>
            <w:col w:w="8568"/>
          </w:cols>
        </w:sectPr>
      </w:pPr>
    </w:p>
    {''.join(paras[25:])}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:num="2" w:equalWidth="0">
        <w:col w:w="929"/>
        <w:col w:w="8568"/>
      </w:cols>
    </w:sectPr>
  </w:body>
</w:document>
"""

    content_types = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="{CT_NS}">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
"""

    rels = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="{PKG_REL_NS}">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
"""

    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", document_xml)


class TestDocxSanitize(unittest.TestCase):
    def test_normalizes_problematic_columns(self) -> None:
        with tempfile.TemporaryDirectory(prefix="docx-sanitize-test-") as td:
            src = Path(td) / "input.docx"
            out = Path(td) / "sanitized.docx"
            _make_minimal_docx(src)

            report = sanitize_docx_for_pdf(str(src), str(out), min_col_width_twips=2000)
            self.assertTrue(report["applied"])
            self.assertGreater(report["normalized_sections"], 0)
            self.assertTrue(out.exists())

            with zipfile.ZipFile(out, "r") as z:
                doc_xml = z.read("word/document.xml")
            root = ET.fromstring(doc_xml)
            ns = {"w": W_NS}
            cols_nodes = root.findall(".//w:sectPr/w:cols", ns)
            self.assertGreater(len(cols_nodes), 0)
            for cols in cols_nodes:
                self.assertEqual(cols.get(f"{{{W_NS}}}num"), "1")
                self.assertEqual(cols.get(f"{{{W_NS}}}equalWidth"), "1")
                self.assertEqual(len(cols.findall("./w:col", ns)), 0)

    def test_can_limit_normalization_to_first_paragraph_section(self) -> None:
        with tempfile.TemporaryDirectory(prefix="docx-sanitize-limit-test-") as td:
            src = Path(td) / "input.docx"
            out = Path(td) / "sanitized.docx"
            _make_minimal_docx(src)

            report = sanitize_docx_for_pdf(
                str(src),
                str(out),
                min_col_width_twips=2000,
                max_paragraph_sections=1,
                include_body_final=False,
            )
            self.assertTrue(report["applied"])
            self.assertEqual(report["normalized_sections"], 1)
            self.assertEqual(report["normalized_paragraph_sections"], 1)
            self.assertEqual(report["normalized_body_sections"], 0)
            self.assertEqual(report["problematic_sections_total"], 2)

            with zipfile.ZipFile(out, "r") as z:
                doc_xml = z.read("word/document.xml")
            root = ET.fromstring(doc_xml)
            ns = {"w": W_NS}
            cols_nodes = root.findall(".//w:sectPr/w:cols", ns)
            self.assertEqual(len(cols_nodes), 2)
            normalized = 0
            untouched = 0
            for cols in cols_nodes:
                if cols.get(f"{{{W_NS}}}num") == "1":
                    normalized += 1
                    self.assertEqual(cols.get(f"{{{W_NS}}}equalWidth"), "1")
                    self.assertEqual(len(cols.findall("./w:col", ns)), 0)
                else:
                    untouched += 1
                    self.assertEqual(cols.get(f"{{{W_NS}}}num"), "2")
            self.assertEqual(normalized, 1)
            self.assertEqual(untouched, 1)

    def test_docx_to_pdf_integration_no_narrow_strip(self) -> None:
        libreoffice = shutil.which("libreoffice")
        if not libreoffice:
            self.skipTest("libreoffice not available in test runtime")
        try:
            import fitz  # noqa: F401
        except Exception:
            self.skipTest("PyMuPDF (fitz) not available in test runtime")

        with tempfile.TemporaryDirectory(prefix="docx-sanitize-integration-") as td:
            src = Path(td) / "input.docx"
            out = Path(td) / "output.pdf"
            _make_minimal_docx(src, paragraph_count=140)

            proc = subprocess.run(
                ["python3", str(ROOT / "docx_to_pdf.py"), str(src), str(out)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            self.assertTrue(out.exists())

            payload = json.loads((proc.stdout or "").strip().splitlines()[-1])
            self.assertTrue(payload.get("ok"))
            sanitization = payload.get("sanitization") or {}
            self.assertTrue(sanitization.get("applied"))
            self.assertGreaterEqual(int(sanitization.get("normalized_sections", 0)), 1)

            import fitz

            doc = fitz.open(out)
            try:
                self.assertGreaterEqual(len(doc), 1)
                for page in doc:
                    words = page.get_text("words")
                    if len(words) < 20:
                        continue
                    min_x = min(w[0] for w in words)
                    max_x = max(w[2] for w in words)
                    width_ratio = (max_x - min_x) / float(page.rect.width)
                    self.assertGreater(
                        width_ratio,
                        0.35,
                        msg=f"Detected narrow-strip text flow (width_ratio={width_ratio:.3f})",
                    )
            finally:
                doc.close()


if __name__ == "__main__":
    unittest.main()
