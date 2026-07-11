"""Offline-report safety tests that require no browser or network access."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = SKILL_ROOT / "scripts"
ASSETS_DIR = SKILL_ROOT / "assets"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from common import embed_json_safely  # noqa: E402


class EmbeddedJsonSafetyTests(unittest.TestCase):
    def test_hostile_strings_round_trip_without_literal_script_delimiters(self) -> None:
        payload = {
            "title": "Hostile </script><script>globalThis.pwned=true</script>",
            "markup": "<img src=x onerror=alert(1)> & >",
            "separators": "before\u2028middle\u2029after",
        }

        encoded = embed_json_safely(payload)

        self.assertNotIn("</script", encoded.lower())
        self.assertNotIn("<", encoded)
        self.assertNotIn(">", encoded)
        self.assertNotIn("&", encoded)
        self.assertNotIn("\u2028", encoded)
        self.assertNotIn("\u2029", encoded)
        self.assertIn("\\u003c", encoded)
        self.assertIn("\\u0026", encoded)
        self.assertIn("\\u2028", encoded)
        self.assertIn("\\u2029", encoded)
        self.assertEqual(payload, json.loads(encoded))

    def test_json_encoding_does_not_replace_source_text_with_html_entities(self) -> None:
        payload = {"text": "<b>ordinary source</b> & a quote \""}
        encoded = embed_json_safely(payload)
        self.assertNotIn("&lt;", encoded)
        self.assertNotIn("&amp;", encoded)
        self.assertEqual(payload, json.loads(encoded))


class OfflineAssetSafetyTests(unittest.TestCase):
    def test_chapter_filters_use_explicit_metadata_and_searchable_fields(self) -> None:
        javascript = (ASSETS_DIR / "report.js").read_text(encoding="utf-8")
        self.assertIn("chapter_filter_index", javascript)
        self.assertIn("row.filterMetadata.domain_keys", javascript)
        self.assertIn("row.filterMetadata.max_issue_severity", javascript)
        self.assertIn("__chapterflowFilterTestHook", javascript)
        for field in (
            "chapter.title",
            "chapter.central_ideas",
            "chapter.mental_model_contribution",
            "chapter.engagement_and_pacing",
            "chapter.learning_support",
            "chapter.retention_support",
            "chapter.transfer_support",
            "chapter.trust_qa_safety_issues",
            "chapter.evidence",
        ):
            with self.subTest(field=field):
                self.assertIn(field, javascript)
        self.assertNotIn("fullText.indexOf(token)", javascript)

    def test_report_javascript_uses_dom_text_apis_not_html_injection(self) -> None:
        javascript = (ASSETS_DIR / "report.js").read_text(encoding="utf-8")
        prohibited = (
            r"\.innerHTML\s*=",
            r"\.outerHTML\s*=",
            r"insertAdjacentHTML\s*\(",
            r"document\.write\s*\(",
            r"\beval\s*\(",
            r"new\s+Function\s*\(",
        )
        for pattern in prohibited:
            with self.subTest(pattern=pattern):
                self.assertIsNone(re.search(pattern, javascript))
        self.assertIn(".textContent", javascript)
        self.assertIn("document.createTextNode", javascript)

    def test_assets_do_not_require_network_or_remote_fonts(self) -> None:
        template = (ASSETS_DIR / "report-template.html").read_text(encoding="utf-8")
        css = (ASSETS_DIR / "report.css").read_text(encoding="utf-8")
        javascript = (ASSETS_DIR / "report.js").read_text(encoding="utf-8")

        self.assertIsNone(re.search(r"<(?:script|link|img)[^>]+(?:src|href)\s*=\s*[\"']https?://", template, re.IGNORECASE))
        self.assertIsNone(re.search(r"@import\s+url|url\(\s*[\"']?https?://", css, re.IGNORECASE))
        for network_api in ("fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon("):
            with self.subTest(network_api=network_api):
                self.assertNotIn(network_api, javascript)
        self.assertNotIn("@font-face", css.lower())

    def test_template_has_static_fallback_and_canonical_data_container(self) -> None:
        template = (ASSETS_DIR / "report-template.html").read_text(encoding="utf-8")
        self.assertIn('<script type="application/json" id="chapterflow-report-data">', template)
        self.assertIn("<noscript>", template)
        self.assertIn("[[CHAPTER_FALLBACK_HTML]]", template)
        self.assertIn('id="main-content"', template)

    @unittest.skipUnless(shutil.which("node"), "Node.js is not available for a JavaScript syntax check")
    def test_report_javascript_parses_when_node_is_available(self) -> None:
        completed = subprocess.run(
            [shutil.which("node") or "node", "--check", str(ASSETS_DIR / "report.js")],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(0, completed.returncode, completed.stderr)


if __name__ == "__main__":
    unittest.main()
