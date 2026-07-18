#!/usr/bin/env python3
"""Safely inspect a ChapterFlow package and emit structural diagnostics."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterator

from common import EvaluationError, atomic_write_json, inspect_package, read_json, source_hash


def walk(value: Any, locator: str = "$") -> Iterator[tuple[str, Any]]:
    yield locator, value
    if isinstance(value, dict):
        for key, item in value.items():
            yield from walk(item, f"{locator}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from walk(item, f"{locator}[{index}]")


def json_diagnostics(path: Path) -> dict[str, Any]:
    data = read_json(path)
    chapters = data.get("chapters", []) if isinstance(data, dict) else []
    diagnostics: dict[str, Any] = {
        "signals_are_diagnostic_not_scores": True,
        "chapter_content_hashes": [],
        "exact_duplicate_long_strings": [],
        "quiz": {
            "question_count": 0,
            "invalid_correct_indices": [],
            "missing_explanations": [],
            "correct_to_distractor_length_ratios": [],
            "mean_correct_to_distractor_length_ratio": None,
            "answer_position_counts": {},
            "repeated_choice_sets": [],
        },
        "repeated_timestamps": [],
        "acronym_frequency": {},
        "embedded_markup_strings": [],
    }
    long_strings: dict[str, list[str]] = defaultdict(list)
    timestamps: Counter[str] = Counter()
    acronyms: Counter[str] = Counter()
    choice_set_hashes: dict[str, list[str]] = defaultdict(list)
    position_counts: Counter[int] = Counter()
    ratios: list[float] = []
    for chapter_index, chapter in enumerate(chapters, start=1):
        chapter_json = json.dumps(chapter, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        diagnostics["chapter_content_hashes"].append(
            {
                "chapter_index": chapter_index,
                "chapter_id": chapter.get("chapterId") if isinstance(chapter, dict) else None,
                "sha256": hashlib.sha256(chapter_json.encode("utf-8")).hexdigest(),
            }
        )
        for locator, value in walk(chapter, f"$.chapters[{chapter_index - 1}]"):
            if not isinstance(value, str):
                continue
            words = re.findall(r"\b[\w'-]+\b", value)
            if len(words) >= 40:
                digest = hashlib.sha256(re.sub(r"\s+", " ", value.strip()).encode("utf-8")).hexdigest()
                long_strings[digest].append(locator)
            for timestamp in re.findall(r"\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*[ap]\.?(?:m\.)?)?\b", value, flags=re.IGNORECASE):
                timestamps[timestamp.lower()] += 1
            for acronym in re.findall(r"\b[A-Z][A-Z0-9]{1,7}\b", value):
                acronyms[acronym] += 1
            if re.search(r"<\s*/?\s*(?:script|style|iframe|img|svg)\b|javascript\s*:", value, flags=re.IGNORECASE):
                diagnostics["embedded_markup_strings"].append(locator)
        if not isinstance(chapter, dict):
            continue
        quiz = chapter.get("quiz")
        questions = quiz.get("questions", []) if isinstance(quiz, dict) else []
        for q_index, question in enumerate(questions):
            if not isinstance(question, dict):
                continue
            qid = str(question.get("questionId") or f"chapter-{chapter_index}-question-{q_index + 1}")
            q_locator = f"chapter {chapter_index} quiz {qid}"
            diagnostics["quiz"]["question_count"] += 1
            choices = question.get("choices") if isinstance(question.get("choices"), list) else []
            correct = question.get("correctIndex")
            if not isinstance(correct, int) or isinstance(correct, bool) or correct < 0 or correct >= len(choices):
                diagnostics["quiz"]["invalid_correct_indices"].append(q_locator)
            else:
                position_counts[correct] += 1
                correct_length = max(len(str(choices[correct]).split()), 1)
                distractor_lengths = [len(str(choice).split()) for idx, choice in enumerate(choices) if idx != correct]
                if distractor_lengths:
                    ratio = correct_length / max(statistics.mean(distractor_lengths), 0.1)
                    ratios.append(ratio)
                    diagnostics["quiz"]["correct_to_distractor_length_ratios"].append({"locator": q_locator, "ratio": round(ratio, 3)})
            if not str(question.get("explanation") or "").strip():
                diagnostics["quiz"]["missing_explanations"].append(q_locator)
            if choices:
                choices_hash = hashlib.sha256(json.dumps(choices, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
                choice_set_hashes[choices_hash].append(q_locator)
    diagnostics["exact_duplicate_long_strings"] = [
        {"sha256": digest, "locators": locators}
        for digest, locators in sorted(long_strings.items())
        if len(locators) > 1
    ]
    diagnostics["quiz"]["mean_correct_to_distractor_length_ratio"] = round(statistics.mean(ratios), 3) if ratios else None
    diagnostics["quiz"]["answer_position_counts"] = {str(key): value for key, value in sorted(position_counts.items())}
    diagnostics["quiz"]["repeated_choice_sets"] = [locators for locators in choice_set_hashes.values() if len(locators) > 1]
    diagnostics["repeated_timestamps"] = [{"value": value, "count": count} for value, count in timestamps.most_common() if count > 1]
    diagnostics["acronym_frequency"] = dict(acronyms.most_common(30))
    diagnostics["embedded_markup_strings"] = sorted(set(diagnostics["embedded_markup_strings"]))
    return diagnostics


def inspect(path: Path, temp_root: Path) -> dict[str, Any]:
    result = inspect_package(path, temp_root)
    diagnostics: dict[str, Any] = {"signals_are_diagnostic_not_scores": True, "note": "Manual full-content inspection is required before using any signal as evidence."}
    if path.is_file() and path.suffix.lower() == ".json":
        diagnostics = json_diagnostics(path)
    return {"package_path": str(path.resolve()), "source_hash": source_hash(path), "inspection": result, "diagnostics": diagnostics}


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--output", type=Path, help="Write JSON to this path; stdout when omitted")
    parser.add_argument("--temp-root", type=Path, default=Path(".chapterflow-inspection-tmp"))
    parser.add_argument("--expected-source-hash", help="Fail if the package hash does not match")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        result = inspect(args.package, args.temp_root)
        if args.expected_source_hash and result["source_hash"] != args.expected_source_hash:
            raise EvaluationError(f"Source hash mismatch: expected {args.expected_source_hash}, got {result['source_hash']}")
    except (EvaluationError, OSError, json.JSONDecodeError, UnicodeError) as exc:
        print(f"inspection error: {exc}", file=sys.stderr)
        return 2
    if args.output:
        atomic_write_json(args.output, result)
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
