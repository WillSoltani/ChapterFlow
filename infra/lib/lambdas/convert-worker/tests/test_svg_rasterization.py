#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHARP_MODULE = ROOT / "node_modules" / "sharp"
if not SHARP_MODULE.exists():
    SHARP_MODULE = Path("/var/task/node_modules/sharp")
WORKER_ENTRY = ROOT / "index.ts"
if not WORKER_ENTRY.exists():
    WORKER_ENTRY = ROOT / "index.js"
if not WORKER_ENTRY.exists():
    WORKER_ENTRY = Path("/var/task/index.js")


class TestSvgRasterization(unittest.TestCase):
    def test_svg_to_png_preserves_transparency(self) -> None:
        if not SHARP_MODULE.exists():
            self.skipTest("sharp module is not available in this runtime")

        with tempfile.TemporaryDirectory(prefix="svg-raster-") as td:
            td_path = Path(td)
            svg_path = td_path / "input.svg"
            png_path = td_path / "output.png"
            svg_path.write_text(
                (
                    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120">'
                    '<rect x="20" y="20" width="160" height="80" fill="#ff4d4f"/>'
                    "</svg>"
                ),
                encoding="utf-8",
            )

            node_script = (
                "const fs=require('fs');"
                "const sharp=require(process.argv[1]);"
                "(async()=>{"
                "const input=fs.readFileSync(process.argv[2]);"
                "const out=await sharp(input,{failOn:'none',density:192}).png().toBuffer();"
                "fs.writeFileSync(process.argv[3],out);"
                "})().catch((e)=>{console.error(e);process.exit(1);});"
            )
            proc = subprocess.run(
                ["node", "-e", node_script, str(SHARP_MODULE), str(svg_path), str(png_path)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            self.assertTrue(png_path.exists())
            self.assertGreater(png_path.stat().st_size, 0)

            with Image.open(png_path) as img:
                self.assertIn(img.mode, {"RGBA", "LA"})
                # Corner should remain transparent (alpha = 0).
                corner = img.getpixel((0, 0))
                alpha = corner[3] if isinstance(corner, tuple) and len(corner) > 3 else 255
                self.assertEqual(alpha, 0)

    def test_svg_with_doctype_is_sanitized_and_rasterized(self) -> None:
        if not SHARP_MODULE.exists():
            self.skipTest("sharp module is not available in this runtime")
        if not WORKER_ENTRY.exists():
            self.skipTest("convert-worker entry module is not available in this runtime")

        with tempfile.TemporaryDirectory(prefix="svg-doctype-") as td:
            td_path = Path(td)
            svg_path = td_path / "input.svg"
            sanitized_path = td_path / "sanitized.svg"
            png_path = td_path / "output.png"
            svg_path.write_text(
                (
                    '<?xml version="1.0" encoding="UTF-8"?>'
                    '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" '
                    '"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" ['
                    '  <!ENTITY xxe SYSTEM "file:///etc/passwd">'
                    "]>"
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">'
                    '<style>@import url("https://example.com/fonts.css");'
                    '.bg{fill:#66d9e8;background-image:url("https://evil.example/bg.png");}</style>'
                    '<script>alert(1)</script>'
                    '<foreignObject width="40" height="20"><div>bad</div></foreignObject>'
                    '<rect class="bg" x="0" y="0" width="200" height="120"/>'
                    '<image href="http://example.com/remote.png" x="0" y="0" width="10" height="10"/>'
                    "</svg>"
                ),
                encoding="utf-8",
            )

            node_script = (
                "const fs=require('fs');"
                "const {pathToFileURL}=require('url');"
                "const sharp=require(process.argv[2]);"
                "(async()=>{"
                "const mod=await import(pathToFileURL(process.argv[1]).href);"
                "const sanitize=mod.__test__ && mod.__test__.sanitizeSvg;"
                "if(typeof sanitize!=='function'){throw new Error('sanitizeSvg test hook missing');}"
                "const input=fs.readFileSync(process.argv[3]);"
                "const sanitized=sanitize(input);"
                "fs.writeFileSync(process.argv[4],sanitized);"
                "const out=await sharp(sanitized,{failOn:'none',density:192}).png().toBuffer();"
                "fs.writeFileSync(process.argv[5],out);"
                "})().catch((e)=>{console.error(e);process.exit(1);});"
            )
            node_args = ["node"]
            if WORKER_ENTRY.suffix == ".ts":
                node_args.append("--experimental-strip-types")
            node_args.extend(
                [
                    "-e",
                    node_script,
                    str(WORKER_ENTRY),
                    str(SHARP_MODULE),
                    str(svg_path),
                    str(sanitized_path),
                    str(png_path),
                ]
            )
            proc = subprocess.run(
                node_args,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            self.assertTrue(png_path.exists())
            self.assertGreater(png_path.stat().st_size, 0)

            sanitized_svg = sanitized_path.read_text(encoding="utf-8")
            self.assertIn("<svg", sanitized_svg.lower())
            self.assertNotIn("<!doctype", sanitized_svg.lower())
            self.assertNotIn("<!entity", sanitized_svg.lower())
            self.assertNotIn("<script", sanitized_svg.lower())
            self.assertNotIn("<foreignobject", sanitized_svg.lower())
            self.assertNotIn("example.com", sanitized_svg.lower())
            self.assertNotIn("href=\"http", sanitized_svg.lower())
            self.assertNotIn("href='http", sanitized_svg.lower())


if __name__ == "__main__":
    unittest.main()
