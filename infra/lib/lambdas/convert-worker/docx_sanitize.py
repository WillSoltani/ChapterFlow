#!/usr/bin/env python3
"""
DOCX section-layout sanitizer for stable PDF rendering.

This normalizes problematic section column definitions (w:sectPr / w:cols)
into a single-column layout in a temporary DOCX copy.
"""

from __future__ import annotations

from dataclasses import dataclass
import shutil
import xml.etree.ElementTree as ET
import zipfile


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
DOC_XML = "word/document.xml"


def w(tag: str) -> str:
    return f"{{{W_NS}}}{tag}"


W_ATTR_NUM = w("num")
W_ATTR_EQUAL_WIDTH = w("equalWidth")
W_ATTR_SPACE = w("space")
W_ATTR_WIDTH = w("w")


@dataclass
class SectionRef:
    scope: str
    index: int
    sectpr: ET.Element
    ppr_parent: ET.Element | None = None


def _parse_int(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except Exception:
        return None


def _gather_sections(root: ET.Element) -> tuple[list[SectionRef], ET.Element | None]:
    body = root.find(f".//{w('body')}")
    if body is None:
        return [], None

    sections: list[SectionRef] = []
    para_idx = 0
    for p in body.findall(f"./{w('p')}"):
        ppr = p.find(f"./{w('pPr')}")
        if ppr is None:
            para_idx += 1
            continue
        sectpr = ppr.find(f"./{w('sectPr')}")
        if sectpr is not None:
            sections.append(SectionRef(scope="paragraph", index=para_idx, sectpr=sectpr, ppr_parent=ppr))
        para_idx += 1

    body_sectpr = body.find(f"./{w('sectPr')}")
    if body_sectpr is not None:
        sections.append(SectionRef(scope="body-final", index=-1, sectpr=body_sectpr, ppr_parent=None))

    return sections, body_sectpr


def _is_false(value: str | None) -> bool:
    if value is None:
        return False
    return value in {"0", "false", "False", "off", "no"}


def _analyze_cols(sectpr: ET.Element, min_col_width_twips: int, min_col_ratio: float) -> dict:
    cols = sectpr.find(f"./{w('cols')}")
    if cols is None:
        return {
            "has_cols": False,
            "num": 1,
            "equal_width": None,
            "widths": [],
            "reasons": [],
            "signature": None,
            "problematic": False,
            "min_width": None,
            "max_width": None,
            "ratio": None,
        }

    num_raw = _parse_int(cols.get(W_ATTR_NUM))
    col_elems = cols.findall(f"./{w('col')}")
    widths = [v for v in (_parse_int(c.get(W_ATTR_WIDTH)) for c in col_elems) if v is not None]
    num = num_raw if num_raw is not None else (len(widths) if widths else 1)
    equal_width = cols.get(W_ATTR_EQUAL_WIDTH)

    min_width = min(widths) if widths else None
    max_width = max(widths) if widths else None
    ratio = (float(min_width) / float(max_width)) if min_width and max_width and max_width > 0 else None

    narrow_column = bool(min_width is not None and min_width < min_col_width_twips)
    non_equal_width = _is_false(equal_width)
    highly_imbalanced = bool(ratio is not None and ratio < min_col_ratio)

    reasons: list[str] = []
    if num > 1:
        reasons.append("multi_column")
    if non_equal_width:
        reasons.append("non_equal_width")
    if narrow_column:
        reasons.append("narrow_column")
    if highly_imbalanced:
        reasons.append("highly_imbalanced")

    signature = (num, equal_width or "", tuple(widths))
    problematic = bool(num > 1 and (non_equal_width or narrow_column or highly_imbalanced))
    return {
        "has_cols": True,
        "num": num,
        "equal_width": equal_width,
        "widths": widths,
        "reasons": reasons,
        "signature": signature,
        "problematic": problematic,
        "min_width": min_width,
        "max_width": max_width,
        "ratio": ratio,
    }


def _normalize_to_single_column(sectpr: ET.Element) -> None:
    cols = sectpr.find(f"./{w('cols')}")
    if cols is None:
        cols = ET.SubElement(sectpr, w("cols"))
    for child in list(cols):
        if child.tag == w("col"):
            cols.remove(child)
    cols.attrib.clear()
    cols.set(W_ATTR_NUM, "1")
    cols.set(W_ATTR_EQUAL_WIDTH, "1")
    cols.attrib.pop(W_ATTR_SPACE, None)


def _copy_docx_with_document_xml(input_docx: str, output_docx: str, xml_bytes: bytes) -> None:
    with zipfile.ZipFile(input_docx, "r") as zin, zipfile.ZipFile(
        output_docx, "w", compression=zipfile.ZIP_DEFLATED
    ) as zout:
        for info in zin.infolist():
            data = xml_bytes if info.filename == DOC_XML else zin.read(info.filename)
            zout.writestr(info, data)


def sanitize_docx_for_pdf(
    input_docx: str,
    output_docx: str,
    *,
    min_col_width_twips: int = 2000,
    min_col_ratio: float = 0.35,
    max_paragraph_sections: int | None = None,
    include_body_final: bool = True,
) -> dict:
    with zipfile.ZipFile(input_docx, "r") as z:
        try:
            document_xml = z.read(DOC_XML)
        except KeyError:
            shutil.copyfile(input_docx, output_docx)
            return {
                "applied": False,
                "reason": "missing_document_xml",
                "sections_total": 0,
                "sections_with_cols": 0,
                "problematic_sections_total": 0,
                "problematic_paragraph_sections": 0,
                "problematic_body_sections": 0,
                "normalized_sections": 0,
                "normalized_paragraph_sections": 0,
                "normalized_body_sections": 0,
                "max_paragraph_sections": max_paragraph_sections,
                "include_body_final": include_body_final,
                "inconsistent_columns": False,
            }

    ET.register_namespace("w", W_NS)
    root = ET.fromstring(document_xml)
    sections, _ = _gather_sections(root)

    analyses: list[dict] = []
    signatures: set[tuple] = set()
    min_width_seen: int | None = None
    for sec in sections:
        an = _analyze_cols(sec.sectpr, min_col_width_twips, min_col_ratio)
        analyses.append(an)
        if an["has_cols"] and an["signature"] is not None:
            signatures.add(an["signature"])
            widths: list[int] = an["widths"]
            if widths:
                sec_min = min(widths)
                min_width_seen = sec_min if min_width_seen is None else min(min_width_seen, sec_min)

    inconsistent_columns = len(signatures) > 1
    normalized_sections = 0
    normalized_paragraph_sections = 0
    normalized_body_sections = 0
    problematic_sections_total = 0
    problematic_paragraph_sections = 0
    problematic_body_sections = 0
    changed_sections: list[dict] = []
    normalized_remaining_quota = max_paragraph_sections

    for sec, an in zip(sections, analyses):
        if not an["problematic"]:
            continue

        problematic_sections_total += 1
        if sec.scope == "paragraph":
            problematic_paragraph_sections += 1
        elif sec.scope == "body-final":
            problematic_body_sections += 1

        should_normalize = False
        if sec.scope == "paragraph":
            if normalized_remaining_quota is None:
                should_normalize = True
            elif normalized_remaining_quota > 0:
                should_normalize = True
        elif sec.scope == "body-final" and include_body_final:
            should_normalize = True

        if should_normalize:
            _normalize_to_single_column(sec.sectpr)
            normalized_sections += 1
            if sec.scope == "paragraph":
                normalized_paragraph_sections += 1
                if normalized_remaining_quota is not None:
                    normalized_remaining_quota -= 1
            elif sec.scope == "body-final":
                normalized_body_sections += 1
            changed_sections.append(
                {
                    "scope": sec.scope,
                    "index": sec.index,
                    "original_num": an["num"],
                    "original_equal_width": an["equal_width"],
                    "original_widths": an["widths"],
                    "min_width": an["min_width"],
                    "max_width": an["max_width"],
                    "ratio": an["ratio"],
                    "reasons": an["reasons"],
                }
            )

    if normalized_sections > 0:
        xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
        _copy_docx_with_document_xml(input_docx, output_docx, xml_bytes)
        return {
            "applied": True,
            "sections_total": len(sections),
            "sections_with_cols": sum(1 for a in analyses if a["has_cols"]),
            "problematic_sections_total": problematic_sections_total,
            "problematic_paragraph_sections": problematic_paragraph_sections,
            "problematic_body_sections": problematic_body_sections,
            "normalized_sections": normalized_sections,
            "normalized_paragraph_sections": normalized_paragraph_sections,
            "normalized_body_sections": normalized_body_sections,
            "max_paragraph_sections": max_paragraph_sections,
            "include_body_final": include_body_final,
            "inconsistent_columns": inconsistent_columns,
            "min_column_width_seen_twips": min_width_seen,
            "min_column_width_threshold_twips": min_col_width_twips,
            "min_column_ratio_threshold": min_col_ratio,
            "changed_sections": changed_sections,
        }

    shutil.copyfile(input_docx, output_docx)
    return {
        "applied": False,
        "reason": "no_problematic_columns_detected",
        "sections_total": len(sections),
        "sections_with_cols": sum(1 for a in analyses if a["has_cols"]),
        "problematic_sections_total": problematic_sections_total,
        "problematic_paragraph_sections": problematic_paragraph_sections,
        "problematic_body_sections": problematic_body_sections,
        "normalized_sections": 0,
        "normalized_paragraph_sections": 0,
        "normalized_body_sections": 0,
        "max_paragraph_sections": max_paragraph_sections,
        "include_body_final": include_body_final,
        "inconsistent_columns": inconsistent_columns,
        "min_column_width_seen_twips": min_width_seen,
        "min_column_width_threshold_twips": min_col_width_twips,
        "min_column_ratio_threshold": min_col_ratio,
    }
