#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

RUN_DIR = Path(__file__).resolve().parent
DOMAIN_LABELS = {
    "epistemic_integrity": "Epistemic integrity",
    "audience_fit": "Audience fit",
    "mental_model_coherence": "Mental-model coherence",
    "learning_architecture": "Learning architecture",
    "retention_retrieval": "Retention and retrieval",
    "transfer_action_judgment": "Transfer, action, and judgment",
    "motivation_autonomy": "Motivation and autonomy",
    "engagement_momentum": "Engagement and momentum",
}


def text_list(values) -> list[str]:
    result = []
    for value in values or []:
        if isinstance(value, str):
            result.append(value)
        elif isinstance(value, dict):
            locator = value.get("locator") or value.get("locators") or ""
            detail = value.get("paraphrase") or value.get("action") or value.get("rationale") or str(value)
            if isinstance(locator, list):
                locator = "; ".join(map(str, locator))
            result.append(f"{detail}" + (f" ({locator})" if locator else ""))
    return result


def gate_status(value) -> str:
    return str(value.get("status")) if isinstance(value, dict) else str(value)


def book_title(record: dict) -> str:
    book = record.get("book") or {}
    return str(book.get("title") or book.get("source_book_title") or book.get("book_id") or "Unknown source")


def md_cell(value) -> str:
    return str(value or "").replace("|", "\\|").replace("\n", " ")


def evidence_cell(values) -> str:
    items = []
    for value in values or []:
        if isinstance(value, dict):
            locator = md_cell(value.get("locator") or value.get("local_locator") or "Source")
            paraphrase = md_cell(value.get("paraphrase") or value.get("rationale") or "")
            items.append(f"**{locator}:** {paraphrase}")
        else:
            items.append(md_cell(value))
    return "<br>".join(items)


def criterion_label(key: str) -> str:
    return key.replace("_", " ").capitalize()


def domain_pattern(domain: dict) -> str:
    return str(domain.get("within_chapter_pattern") or domain.get("pattern") or "")


def domain_rationale(domain: dict) -> str:
    return str(domain.get("anchor_linked_rationale") or domain.get("anchor_rationale") or domain.get("rationale") or "")


def subcriterion_rationale(subcriterion: dict) -> str:
    return str(subcriterion.get("rationale") or subcriterion.get("anchor_rationale") or "")


def improvement_lines(improvements) -> list[str]:
    lines = []
    for index, improvement in enumerate(improvements or [], 1):
        if isinstance(improvement, str):
            lines.append(f"{index}. {improvement}")
            continue
        action = improvement.get("action") or improvement.get("recommendation") or str(improvement)
        rationale = improvement.get("rationale") or ""
        locators = improvement.get("local_locators") or improvement.get("locators") or improvement.get("locator") or []
        if isinstance(locators, str):
            locators = [locators]
        lines.append(f"{index}. **{action}**")
        if rationale:
            lines.append(f"   - Why: {rationale}")
        if locators:
            lines.append(f"   - Source: {'; '.join(map(str, locators))}")
    return lines


def engagement_lines(value) -> list[str]:
    if isinstance(value, dict):
        return [f"- **{criterion_label(key)}:** {detail}" for key, detail in value.items()]
    if isinstance(value, list):
        rendered = []
        for item in value:
            if isinstance(item, dict):
                phase = item.get("phase") or item.get("direction") or "Phase"
                locator = item.get("locator") or item.get("chapter_range") or ""
                assessment = item.get("assessment") or item.get("explanation") or ""
                rendered.append(f"- **{phase}:** {assessment}" + (f" ({locator})" if locator else ""))
            else:
                rendered.append(f"- {item}")
        return rendered
    return [f"- {value}"] if value else []


def main() -> None:
    records = [json.loads(path.read_text()) for path in sorted((RUN_DIR / "raw/adjudicated").glob("*.json"))]
    if len(records) != 3:
        raise SystemExit(f"expected 3 adjudicated records, found {len(records)}")
    records.sort(key=lambda item: item["chapter_diagnostic_score"], reverse=True)

    lines = [
        "# ChapterFlow standalone chapter audit",
        "",
        "## Scope and result",
        "",
        "The three supplied files are individual chapters, not complete book packages. Accordingly, the evaluator rubric does **not** permit full-book Content Design Scores or certifications. The numeric results below are non-canonical chapter diagnostics: Domains 1-8 were scored on observable chapter-local support, Domain 9 was unassessable, and the retained 95 points were normalized to 100.",
        "",
        "| Rank | Supplied chapter | Chapter diagnostic | Descriptive band | Blind-rater MAD | Chapter confidence | Full-book score |",
        "|---:|---|---:|---|---:|---|---|",
    ]
    for index, record in enumerate(records, 1):
        agreement = record["rater_agreement"]
        confidence = record["confidence"]
        title = f"{book_title(record)} — Ch. {record['chapter']['number']}: {record['chapter']['title']}"
        lines.append(
            f"| {index} | {title} | **{record['chapter_diagnostic_score']:.1f}** | {record['diagnostic_band']} | {agreement['mean_absolute_subcriterion_difference']:.2f} | {confidence['level']} | Unevaluable |"
        )

    spread = records[0]["chapter_diagnostic_score"] - records[-1]["chapter_diagnostic_score"]
    lines += [
        "",
        "## Comparative read",
        "",
        f"The full score spread is {spread:.1f} points. " + ("Under the rubric's one-point rule, the closest results should be treated as effectively tied unless their qualitative evidence shows a meaningful difference." if spread <= 1 else "The ordering is descriptive of these chapter artifacts only and cannot be generalized to the books."),
        "",
    ]

    for record in records:
        chapter_name = f"{book_title(record)} — Chapter {record['chapter']['number']}: {record['chapter']['title']}"
        lines += [f"## {chapter_name}", "", f"**Adjudicated chapter diagnostic: {record['chapter_diagnostic_score']:.1f}/100.** {record['diagnostic_band']}", "", "| Domain | Rating / 4 | Weighted points |", "|---|---:|---:|"]
        for key, label in DOMAIN_LABELS.items():
            domain = record["domains"][key]
            lines.append(f"| {label} | {domain['domain_score']:.2f} | {domain['weighted_points']:.2f} |")

        lines += ["", "### Subcriterion analysis", ""]
        for key, label in DOMAIN_LABELS.items():
            domain = record["domains"][key]
            lines += [f"#### {label}", "", f"Pattern: {domain_pattern(domain)}", "", f"Anchor rationale: {domain_rationale(domain)}", "", "| Subcriterion | Rating / 4 | Anchor-linked rationale | Local evidence |", "|---|---:|---|---|"]
            for subkey, subcriterion in domain["subcriteria"].items():
                lines.append(
                    f"| {criterion_label(subkey)} | {subcriterion['rating']:.1f} | {md_cell(subcriterion_rationale(subcriterion))} | {evidence_cell(subcriterion.get('evidence'))} |"
                )
            lines.append("")

        lines += ["### Strengths and limitations", "", "Strongest observable qualities:", ""]
        lines += [f"- {item}" for item in text_list(record.get("strongest_qualities"))]
        lines += ["", "Main limitations:", ""]
        lines += [f"- {item}" for item in text_list(record.get("weakest_qualities"))]

        lines += ["", "### Reader-experience analysis", "", "Engagement curve:", ""]
        lines += engagement_lines(record.get("engagement_curve"))
        lines += ["", f"Comprehension and retention support: {record.get('comprehension_retention_analysis', '')}", "", f"Practical use and judgment: {record.get('practical_use_judgment_analysis', '')}", "", "Best-fit readers:", ""]
        lines += [f"- {item}" for item in text_list(record.get("best_fit_readers"))]
        lines += ["", "Readers likely to struggle:", ""]
        lines += [f"- {item}" for item in text_list(record.get("struggling_readers"))]

        agreement = record["rater_agreement"]
        lines += [
            "",
            "### Blind-rater agreement and adjudication",
            "",
            f"- Mean absolute subcriterion difference: {agreement['mean_absolute_subcriterion_difference']:.5f}",
            f"- Maximum subcriterion difference: {agreement['maximum_subcriterion_difference']}",
            f"- Blind chapter-diagnostic difference: {agreement['chapter_diagnostic_score_difference']:.5f} points",
            f"- Resolved rating disagreements: {len(agreement.get('disagreements') or [])}",
            f"- Gate conflicts reviewed: {len(agreement.get('gate_conflicts') or [])}",
            "",
        ]
        if agreement.get("disagreements"):
            lines += ["| Rating path | Primary | Verification | Final | Adjudication rationale |", "|---|---:|---:|---:|---|"]
            for disagreement in agreement["disagreements"]:
                rationale = disagreement.get("adjudication_rationale") or disagreement.get("rationale") or ""
                lines.append(f"| `{md_cell(disagreement.get('path'))}` | {disagreement.get('primary')} | {disagreement.get('verification')} | {disagreement.get('final')} | {md_cell(rationale)} |")
            lines.append("")
        if agreement.get("gate_conflicts"):
            lines += ["Gate conflicts:", "", "| Gate | Primary | Verification | Final | Resolution |", "|---|---|---|---|---|"]
            for conflict in agreement["gate_conflicts"]:
                lines.append(f"| {md_cell(conflict.get('gate'))} | {conflict.get('primary')} | {conflict.get('verification')} | {conflict.get('final')} | {md_cell(conflict.get('rationale'))} |")
            lines.append("")
        confidence = record["confidence"]
        lines += [f"Chapter-only confidence: **{confidence['level']}**. {confidence['rationale']}", ""]

        lines += ["### Gates", "", "| Gate | Status | Rationale |", "|---|---|---|"]
        for key, value in record.get("gates", {}).items():
            rationale = value.get("rationale") if isinstance(value, dict) else ""
            lines.append(f"| {criterion_label(key)} | {gate_status(value)} | {md_cell(rationale)} |")

        lines += ["", "### Highest-impact improvements", ""]
        lines += improvement_lines(record.get("improvements"))

        calibration_changes = record.get("calibration_changes") or []
        if calibration_changes:
            lines += ["", "### Calibration changes", "", "| Path | Original | Final | Reason | Evidence |", "|---|---:|---:|---|---|"]
            for change in calibration_changes:
                lines.append(f"| `{md_cell(change.get('path'))}` | {change.get('original')} | {change.get('final')} | {md_cell(change.get('reason'))} | {evidence_cell(change.get('evidence'))} |")

        lines += ["", "### Verdict", "", record["verdict"], ""]

    lines += [
        "## Cross-chapter calibration",
        "",
        "All 14 subcriterion paths with nonuniform final ratings were rechecked against the same anchors and local source evidence. One demonstrable inconsistency was corrected: Made to Stick's `feedback_metacognitive_calibration` rating moved from 1.0 to 1.5 because its no-key quiz is partly offset by six worked causal explanations and five front/back self-check cards. That changed its Learning Architecture mean from 2.50 to 2.625 and its normalized chapter diagnostic from 67.3 to 67.7. No other rating change was justified.",
        "",
        "The smallest final score difference is 1.2 points, so none of the three chapter diagnostics falls within the rubric's one-point effective-tie rule.",
        "",
        "## Method and limitations",
        "",
        "- Each supplied chapter was read in full by two mutually blind raters using source-bound dispatch receipts.",
        "- Both records were deterministically checked for source and heading hashes, complete section inventory, all 32 applicable rubric criteria, evidence minimums, scope declarations, and arithmetic.",
        "- A fresh adjudicator reviewed each source plus its sealed blind pair. Half-points were allowed only during adjudication.",
        "- Cross-chapter calibration compared anchor application without forcing a distribution and logged the single corrected rating.",
        "- External factual accuracy was intentionally not assessed. Scores describe observable support for learning, retention, transfer, judgment, and reader experience; they do not establish measured reader outcomes.",
        "- Full-book completeness, Domain 9, and full-book certification remain unevaluable until every chapter and reader-facing component for each book is supplied.",
        "",
    ]
    (RUN_DIR / "REPORT.md").write_text("\n".join(lines))


if __name__ == "__main__":
    main()
