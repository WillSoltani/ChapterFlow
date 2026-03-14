#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import tempfile
import unittest
from importlib import util
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "image_special_convert.py"
if not SCRIPT.exists():
    SCRIPT = Path("/var/task/image_special_convert.py")


class TestImageSpecialConvert(unittest.TestCase):
    def _run(
        self,
        input_path: Path,
        output_path: Path,
        target: str,
        quality: int | None = None,
    ) -> subprocess.CompletedProcess[str]:
        cmd = ["python3", str(SCRIPT), str(input_path), str(output_path), target]
        if quality is not None:
            cmd.append(str(int(quality)))
        return subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_png_to_ico_emits_multi_size_icon(self) -> None:
        with tempfile.TemporaryDirectory(prefix="special-ico-") as td:
            td_path = Path(td)
            src = td_path / "input.png"
            out = td_path / "output.ico"

            img = Image.new("RGBA", (320, 180), (10, 100, 220, 255))
            img.save(src, format="PNG")

            proc = self._run(src, out, "ico")
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            self.assertTrue(out.exists())
            self.assertGreater(out.stat().st_size, 0)

            with Image.open(out) as ico:
                self.assertEqual(ico.format, "ICO")
                sizes = set(ico.info.get("sizes", []))
                # Ensure multiple icon sizes are embedded (small + large variants).
                self.assertTrue(any(max(s) <= 24 for s in sizes), msg=f"sizes={sizes}")
                self.assertTrue(any(max(s) >= 96 for s in sizes), msg=f"sizes={sizes}")

    def test_png_with_transparency_to_bmp_flattens_to_white(self) -> None:
        with tempfile.TemporaryDirectory(prefix="special-bmp-") as td:
            td_path = Path(td)
            src = td_path / "input.png"
            out = td_path / "output.bmp"

            img = Image.new("RGBA", (2, 1), (0, 0, 0, 0))
            img.putpixel((1, 0), (255, 0, 0, 200))
            img.save(src, format="PNG")

            proc = self._run(src, out, "bmp")
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            self.assertTrue(out.exists())
            self.assertGreater(out.stat().st_size, 0)

            with Image.open(out) as bmp:
                self.assertEqual(bmp.format, "BMP")
                self.assertEqual(bmp.mode, "RGB")
                # Fully transparent pixel should be flattened to white.
                self.assertEqual(bmp.getpixel((0, 0)), (255, 255, 255))

    def test_invalid_target_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="special-invalid-") as td:
            td_path = Path(td)
            src = td_path / "input.png"
            out = td_path / "output.bad"
            Image.new("RGB", (10, 10), (120, 30, 60)).save(src, format="PNG")

            proc = self._run(src, out, "svg")
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("Unsupported target", proc.stderr)

    def test_png_to_avif_and_decode_roundtrip(self) -> None:
        if util.find_spec("pillow_avif") is None:
            self.skipTest("pillow-avif-plugin is not available in this runtime")

        with tempfile.TemporaryDirectory(prefix="special-avif-") as td:
            td_path = Path(td)
            src = td_path / "input.png"
            avif = td_path / "output.avif"
            decoded = td_path / "decoded.png"

            Image.new("RGBA", (80, 48), (120, 40, 200, 180)).save(src, format="PNG")

            enc = self._run(src, avif, "avif", quality=62)
            self.assertEqual(enc.returncode, 0, msg=f"stderr={enc.stderr}\nstdout={enc.stdout}")
            self.assertTrue(avif.exists())
            self.assertGreater(avif.stat().st_size, 0)

            dec = self._run(avif, decoded, "avif_decode")
            self.assertEqual(dec.returncode, 0, msg=f"stderr={dec.stderr}\nstdout={dec.stdout}")
            self.assertTrue(decoded.exists())
            self.assertGreater(decoded.stat().st_size, 0)

            with Image.open(decoded) as png:
                self.assertEqual(png.format, "PNG")
                self.assertEqual(png.size, (80, 48))

    def test_heif_decode_to_png(self) -> None:
        if util.find_spec("pillow_heif") is None:
            self.skipTest("pillow-heif is not available in this runtime")

        import pillow_heif  # noqa: PLC0415

        with tempfile.TemporaryDirectory(prefix="special-heif-") as td:
            td_path = Path(td)
            src = td_path / "input.heif"
            out = td_path / "output.png"

            rgb = Image.new("RGB", (96, 64), (15, 120, 220))
            generated = False
            try:
                rgb.save(src, format="HEIF", quality=80)
                generated = True
            except Exception:
                try:
                    heif = pillow_heif.from_pillow(rgb)
                    heif.save(str(src), quality=80)
                    generated = True
                except Exception as exc:
                    self.skipTest(f"could not generate HEIF sample in this runtime: {exc}")

            if not generated:
                self.skipTest("could not generate HEIF sample in this runtime")

            proc = self._run(src, out, "heif_decode")
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            self.assertTrue(out.exists())
            self.assertGreater(out.stat().st_size, 0)

            with Image.open(out) as png:
                self.assertEqual(png.format, "PNG")
                self.assertEqual(png.size, (96, 64))

    def test_png_to_heic_and_heif_then_decode(self) -> None:
        if util.find_spec("pillow_heif") is None:
            self.skipTest("pillow-heif is not available in this runtime")

        with tempfile.TemporaryDirectory(prefix="special-heif-encode-") as td:
            td_path = Path(td)
            src = td_path / "input.png"
            heic = td_path / "output.heic"
            heif = td_path / "output.heif"
            decoded_heic = td_path / "decoded-heic.png"
            decoded_heif = td_path / "decoded-heif.png"

            Image.new("RGBA", (88, 52), (220, 80, 20, 160)).save(src, format="PNG")

            enc_heic = self._run(src, heic, "heic", quality=62)
            self.assertEqual(enc_heic.returncode, 0, msg=f"stderr={enc_heic.stderr}\nstdout={enc_heic.stdout}")
            self.assertTrue(heic.exists())
            self.assertGreater(heic.stat().st_size, 0)

            enc_heif = self._run(src, heif, "heif", quality=62)
            self.assertEqual(enc_heif.returncode, 0, msg=f"stderr={enc_heif.stderr}\nstdout={enc_heif.stdout}")
            self.assertTrue(heif.exists())
            self.assertGreater(heif.stat().st_size, 0)

            dec_heic = self._run(heic, decoded_heic, "heif_decode")
            self.assertEqual(dec_heic.returncode, 0, msg=f"stderr={dec_heic.stderr}\nstdout={dec_heic.stdout}")
            self.assertTrue(decoded_heic.exists())
            self.assertGreater(decoded_heic.stat().st_size, 0)

            dec_heif = self._run(heif, decoded_heif, "heif_decode")
            self.assertEqual(dec_heif.returncode, 0, msg=f"stderr={dec_heif.stderr}\nstdout={dec_heif.stdout}")
            self.assertTrue(decoded_heif.exists())
            self.assertGreater(decoded_heif.stat().st_size, 0)

            with Image.open(decoded_heic) as png_heic:
                self.assertEqual(png_heic.format, "PNG")
                self.assertEqual(png_heic.size, (88, 52))

            with Image.open(decoded_heif) as png_heif:
                self.assertEqual(png_heif.format, "PNG")
                self.assertEqual(png_heif.size, (88, 52))


if __name__ == "__main__":
    unittest.main()
