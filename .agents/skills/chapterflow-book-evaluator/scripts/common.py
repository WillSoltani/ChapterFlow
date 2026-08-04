#!/usr/bin/env python3
"""Shared deterministic utilities for the ChapterFlow evaluator."""

from __future__ import annotations

import csv
import hashlib
import json
import math
import os
import re
import shutil
import stat
import tempfile
import unicodedata
import zipfile
from collections import OrderedDict
from pathlib import Path
from typing import Any, Iterable, Iterator, Mapping, MutableMapping, Sequence

SCHEMA_VERSION = "2.0.0"
RUBRIC_VERSION = "2.0"

DOMAINS: "OrderedDict[str, dict[str, Any]]" = OrderedDict(
    [
        (
            "epistemic_integrity",
            {
                "name": "Epistemic Integrity and Intellectual Honesty",
                "weight": 15,
                "subcriteria": OrderedDict(
                    [
                        ("claim_support_fit", "Claim-support fit"),
                        ("uncertainty_limitations", "Uncertainty and limitations"),
                        ("internal_consistency_qa", "Internal consistency and instructional QA"),
                        ("misuse_safeguards", "Misuse safeguards"),
                    ]
                ),
            },
        ),
        (
            "audience_fit",
            {
                "name": "Audience Fit, Comprehensibility, and Cognitive Economy",
                "weight": 12,
                "subcriteria": OrderedDict(
                    [
                        ("language_clarity", "Language clarity"),
                        ("beginner_onboarding", "Beginner onboarding"),
                        ("signal_noise_framework_load", "Signal-to-noise and framework load"),
                        ("audience_context_accessibility", "Audience and context accessibility"),
                    ]
                ),
            },
        ),
        (
            "mental_model_coherence",
            {
                "name": "Mental-Model Coherence and Explanatory Depth",
                "weight": 15,
                "subcriteria": OrderedDict(
                    [
                        ("central_model", "Central model"),
                        ("mechanism_causal_explanation", "Mechanism and causal explanation"),
                        ("cross_concept_integration", "Cross-concept integration"),
                        ("nuance_diagnostic_power", "Nuance and diagnostic power"),
                    ]
                ),
            },
        ),
        (
            "learning_architecture",
            {
                "name": "Learning Architecture and Productive Processing",
                "weight": 12,
                "subcriteria": OrderedDict(
                    [
                        ("sequencing_scaffolding", "Sequencing and scaffolding"),
                        ("worked_examples_contrasts", "Worked examples and contrasts"),
                        ("active_processing", "Active processing"),
                        ("feedback_metacognitive_calibration", "Feedback and metacognitive calibration"),
                    ]
                ),
            },
        ),
        (
            "retention_retrieval",
            {
                "name": "Retention and Retrieval Support",
                "weight": 10,
                "subcriteria": OrderedDict(
                    [
                        ("meaningful_retrieval_cues", "Meaningful retrieval cues"),
                        ("cumulative_reinforcement", "Cumulative reinforcement"),
                        ("quiz_retrieval_depth", "Quiz and retrieval depth"),
                        ("interference_control_consolidation", "Interference control and consolidation"),
                    ]
                ),
            },
        ),
        (
            "transfer_action_judgment",
            {
                "name": "Purpose-Appropriate Transfer, Action, and Practical Judgment",
                "weight": 15,
                "subcriteria": OrderedDict(
                    [
                        ("concrete_actions", "Concrete actions"),
                        ("cross_context_transfer", "Cross-context transfer"),
                        ("implementation_feedback_support", "Implementation and feedback support"),
                        ("boundaries_adaptation_tradeoffs", "Boundaries, adaptation, and tradeoffs"),
                    ]
                ),
            },
        ),
        (
            "motivation_autonomy",
            {
                "name": "Motivation, Autonomy, and Calibrated Agency",
                "weight": 8,
                "subcriteria": OrderedDict(
                    [
                        ("personal_relevance", "Personal relevance"),
                        ("achievable_progress", "Achievable progress"),
                        ("autonomy_non_shaming_tone", "Autonomy and non-shaming tone"),
                        ("calibrated_confidence", "Calibrated confidence"),
                    ]
                ),
            },
        ),
        (
            "engagement_momentum",
            {
                "name": "Instructionally Aligned Engagement and Reading Momentum",
                "weight": 8,
                "subcriteria": OrderedDict(
                    [
                        ("curiosity_momentum", "Curiosity and momentum"),
                        ("narrative_example_vividness", "Narrative and example vividness"),
                        ("emotional_relevance", "Emotional relevance"),
                        ("instructional_alignment", "Instructional alignment and absence of decoration"),
                    ]
                ),
            },
        ),
        (
            "whole_book_coherence",
            {
                "name": "Whole-Book Coherence, Consistency, and Completion Value",
                "weight": 5,
                "subcriteria": OrderedDict(
                    [
                        ("chapter_necessity_order", "Chapter necessity and order"),
                        ("quality_consistency_pacing", "Quality consistency and pacing"),
                        ("redundancy_cumulative_load", "Redundancy and cumulative load"),
                        ("synthesis_completion_value", "Synthesis and completion value"),
                    ]
                ),
            },
        ),
    ]
)

GATE_KEYS = (
    "technical_completeness",
    "epistemic_instructional_safety",
    "ethics_reader_autonomy",
    "purpose_audience_declaration",
    "external_accuracy",
)
GATE_STATUSES = {"pass", "conditional", "fail", "not_assessed", "unevaluable"}
CERTIFICATION_STATUSES = {"pass", "conditional", "fail", "unevaluable"}
SAMPLE_RESULT_TYPE = "experimental_chapter_sample_evaluation"
SAMPLE_REPORT_RESULT_TYPE = "experimental_chapter_sample_report"
SAMPLE_EVALUATION_MODE = "chapter_sample"
SAMPLE_PACKAGE_MODE = "deterministic-four-chapter-sample"
SAMPLE_SELECTION_ALGORITHM = "sha256-lowest-rank-v1"
SAMPLE_PROTOCOL_VERSION = "1.0.0"
SAMPLE_INFERENCE_SCOPE = "selected_chapters_only"
SAMPLE_SCORE_LABEL = "Experimental four-chapter sample score"
SAMPLE_CLASSIFICATION = "Exploratory sample estimate; no full-book classification"
SAMPLE_CERTIFICATION_STATUSES = {"fail", "unevaluable", "not_assessed"}
SAMPLE_SCOPE_LIMITATION = (
    "Selected chapters only; unsampled content may materially change the estimate."
)
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
SUPPORTED_TEXT_SUFFIXES = {".json", ".md", ".txt", ".csv", ".tsv", ".yaml", ".yml"}
IGNORED_NAMES = {
    ".DS_Store",
    "__MACOSX",
    "node_modules",
    "artifacts",
    "chapterflow-evaluation",
    "__pycache__",
    ".pytest_cache",
}


class EvaluationError(ValueError):
    """Raised for deterministic contract violations."""


def slugify(value: str, fallback: str = "book") -> str:
    text = unicodedata.normalize("NFKD", value or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text[:80] or fallback


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _iter_package_files(root: Path) -> Iterator[Path]:
    for path in sorted(root.rglob("*"), key=lambda p: p.as_posix().casefold()):
        if path.is_symlink():
            try:
                path.resolve().relative_to(root.resolve())
            except (OSError, ValueError):
                continue
        if not path.is_file() or any(part.startswith(".") or part in IGNORED_NAMES for part in path.relative_to(root).parts):
            continue
        yield path


def source_hash(path: Path) -> str:
    """Hash a package byte-for-byte, including stable relative paths for directories."""
    if path.is_file():
        return sha256_file(path)
    if not path.is_dir():
        raise EvaluationError(f"Package path is not a readable file or directory: {path}")
    digest = hashlib.sha256()
    for file_path in _iter_package_files(path):
        rel = file_path.relative_to(path).as_posix().encode("utf-8")
        digest.update(len(rel).to_bytes(8, "big"))
        digest.update(rel)
        digest.update(bytes.fromhex(sha256_file(file_path)))
    return digest.hexdigest()


def _normalise_json_bytes(raw: bytes) -> bytes:
    try:
        value = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return raw.replace(b"\r\n", b"\n")
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def normalized_content_hash(path: Path, extraction_root: Path | None = None) -> str:
    """Hash readable content independent of archive container and root folder name."""
    temp: tempfile.TemporaryDirectory[str] | None = None
    candidate = path
    if path.is_file() and path.suffix.lower() == ".zip":
        if extraction_root is None:
            temp = tempfile.TemporaryDirectory(prefix="chapterflow-hash-")
            extraction_root = Path(temp.name)
        candidate = safe_extract_zip(path, extraction_root / slugify(path.stem))
    files = [candidate] if candidate.is_file() else list(_iter_package_files(candidate))
    content_digests: list[str] = []
    for item in files:
        if item.suffix.lower() not in SUPPORTED_TEXT_SUFFIXES:
            continue
        raw = item.read_bytes()
        if item.suffix.lower() == ".json":
            raw = _normalise_json_bytes(raw)
        else:
            raw = raw.replace(b"\r\n", b"\n")
        content_digests.append(sha256_bytes(raw))
    if temp is not None:
        temp.cleanup()
    payload = "\n".join(sorted(content_digests)).encode("ascii")
    return sha256_bytes(payload)


def safe_extract_zip(
    archive: Path,
    destination: Path,
    *,
    max_files: int = 10_000,
    max_uncompressed_bytes: int = 250 * 1024 * 1024,
    max_compression_ratio: float = 200.0,
) -> Path:
    """Extract an archive after zip-slip, symlink, size, and ratio checks."""
    destination = destination.resolve()
    if destination.exists() and any(destination.iterdir()):
        return destination
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as zf:
        members = zf.infolist()
        if len(members) > max_files:
            raise EvaluationError(f"Archive has {len(members)} entries; limit is {max_files}")
        expanded = sum(info.file_size for info in members)
        compressed = sum(max(info.compress_size, 1) for info in members if not info.is_dir())
        if expanded > max_uncompressed_bytes:
            raise EvaluationError(f"Archive expands to {expanded} bytes; limit is {max_uncompressed_bytes}")
        if expanded and expanded / max(compressed, 1) > max_compression_ratio:
            raise EvaluationError("Archive compression ratio exceeds safety limit")
        for info in members:
            mode = (info.external_attr >> 16) & 0xFFFF
            if stat.S_ISLNK(mode):
                raise EvaluationError(f"Archive symlink is not allowed: {info.filename}")
            member = Path(info.filename)
            if member.is_absolute() or ".." in member.parts:
                raise EvaluationError(f"Unsafe archive path: {info.filename}")
            target = (destination / member).resolve()
            try:
                target.relative_to(destination)
            except ValueError as exc:
                raise EvaluationError(f"Archive path escapes extraction root: {info.filename}") from exc
        zf.extractall(destination)
    return destination


def atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def atomic_write_json(path: Path, value: Any) -> None:
    atomic_write_text(path, json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n")


def write_csv(path: Path, fieldnames: Sequence[str], rows: Iterable[Mapping[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore", lineterminator="\r\n")
            writer.writeheader()
            for row in rows:
                writer.writerow({key: normalise_csv_value(row.get(key, "")) for key in fieldnames})
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def normalise_csv_value(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return value


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def _walk_strings(value: Any) -> Iterator[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from _walk_strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from _walk_strings(item)


def estimate_word_count(value: Any) -> int:
    return sum(len(re.findall(r"\b[\w'-]+\b", text, flags=re.UNICODE)) for text in _walk_strings(value))


def _component_count(chapters: Sequence[Mapping[str, Any]], key: str) -> int:
    count = 0
    for chapter in chapters:
        value = chapter.get(key)
        if isinstance(value, list):
            count += len(value)
        elif isinstance(value, dict):
            count += len(value)
        elif value not in (None, "", False):
            count += 1
    return count


def _nested_list_count(chapters: Sequence[Mapping[str, Any]], parent: str, child: str) -> int:
    count = 0
    for chapter in chapters:
        container = chapter.get(parent)
        if isinstance(container, dict) and isinstance(container.get(child), list):
            count += len(container[child])
    return count


def inspect_json_package(path: Path) -> dict[str, Any]:
    data = read_json(path)
    if not isinstance(data, dict):
        raise EvaluationError("Top-level JSON value must be an object")
    book = data.get("book") if isinstance(data.get("book"), dict) else {}
    chapters_raw = data.get("chapters")
    if chapters_raw is None and isinstance(data.get("content"), dict):
        chapters_raw = data["content"].get("chapters")
    chapters: list[dict[str, Any]] = [item for item in chapters_raw or [] if isinstance(item, dict)]
    title = str(book.get("title") or data.get("title") or path.stem)
    book_id = str(book.get("bookId") or book.get("id") or data.get("bookId") or data.get("packageId") or slugify(title))
    numbers = [chapter.get("number") for chapter in chapters]
    ids = [chapter.get("chapterId") or chapter.get("id") for chapter in chapters]
    duplicate_positions = sorted({str(item) for item in numbers + ids if item is not None and (numbers + ids).count(item) > 1})
    component_inventory = {
        "examples": _component_count(chapters, "examples"),
        "quiz_questions": _nested_list_count(chapters, "quiz", "questions"),
        "review_cards": _component_count(chapters, "reviewCards"),
        "implementation_items": _nested_list_count(chapters, "implementationPlan", "ifThenPlans"),
        "exercises": _component_count(chapters, "tryThisNow") + _component_count(chapters, "exercises"),
        "memorable_lines": _component_count(chapters, "memorableLines"),
        "other": {
            "hooks": _component_count(chapters, "hook"),
            "counterintuitions": _component_count(chapters, "counterintuition"),
            "breakdown_sections": _component_count(chapters, "breakdown"),
            "key_takeaways": _component_count(chapters, "keyTakeaway"),
        },
    }
    chapter_inventory = []
    for index, chapter in enumerate(chapters, start=1):
        chapter_inventory.append(
            {
                "chapter_index": index,
                "chapter_id": chapter.get("chapterId") or chapter.get("id"),
                "number": chapter.get("number", index),
                "title": str(chapter.get("title") or f"Chapter {index}"),
                "word_count_estimate": estimate_word_count(chapter),
                "fields": sorted(chapter.keys()),
            }
        )
    warnings: list[str] = []
    inventory_errors: list[str] = []
    if not chapters:
        warnings.append("No chapter objects were detected")
        inventory_errors.append("No chapter objects were detected")
    if chapters_raw is not None and len(chapters) != len(chapters_raw):
        warnings.append("One or more chapter entries are not objects")
        inventory_errors.append("One or more chapter entries are not objects")
    if duplicate_positions:
        warnings.append(f"Duplicate chapter identifiers or numbers: {', '.join(duplicate_positions)}")
        inventory_errors.append(f"Duplicate chapter identifiers or numbers: {', '.join(duplicate_positions)}")
    numeric_numbers = [number for number in numbers if isinstance(number, int) and not isinstance(number, bool)]
    if numeric_numbers:
        missing_numbers = sorted(set(range(1, max(numeric_numbers) + 1)) - set(numeric_numbers))
        if missing_numbers:
            warnings.append("Missing chapter numbers: " + ", ".join(str(number) for number in missing_numbers))
            inventory_errors.append("Missing chapter numbers: " + ", ".join(str(number) for number in missing_numbers))
        if len(numeric_numbers) != len(numbers):
            warnings.append("Chapter numbering is only partially declared")
            inventory_errors.append("Chapter numbering is only partially declared")
        expected_numbers = list(range(1, len(chapters) + 1))
        if numeric_numbers != expected_numbers:
            inventory_errors.append(
                "Declared chapter numbers must be the complete reader-order sequence 1..chapter_count"
            )
        if numeric_numbers != sorted(numeric_numbers):
            warnings.append("Chapter numbers are not in ascending reader order")
            inventory_errors.append("Chapter numbers are not in ascending reader order")
    titles = [str(chapter.get("title") or "").strip().casefold() for chapter in chapters]
    duplicate_titles = sorted({title for title in titles if title and titles.count(title) > 1})
    if duplicate_titles:
        warnings.append("Duplicate chapter titles: " + ", ".join(duplicate_titles))
    return {
        "package_id": str(data.get("packageId") or book_id),
        "book_id": book_id,
        "title": title,
        "subtitle": book.get("subtitle"),
        "package_format": "json",
        "schema_version_detected": data.get("schemaVersion"),
        "chapter_count": len(chapters),
        "word_count_estimate": estimate_word_count(chapters),
        "component_inventory": component_inventory,
        "chapter_inventory": chapter_inventory,
        "inventory_complete": bool(chapters) and not inventory_errors,
        "inventory_errors": list(dict.fromkeys(inventory_errors)),
        "warnings": warnings,
    }


def inspect_package(path: Path, temp_root: Path | None = None) -> dict[str, Any]:
    path = path.resolve()
    if path.is_file() and path.suffix.lower() == ".json":
        return inspect_json_package(path)
    if path.is_file() and path.suffix.lower() == ".zip":
        if temp_root is None:
            raise EvaluationError("A temporary extraction root is required for archives")
        extracted = safe_extract_zip(path, temp_root / slugify(path.stem))
        candidates = list(_iter_package_files(extracted))
    elif path.is_dir():
        candidates = list(_iter_package_files(path))
    elif path.is_file() and path.suffix.lower() in {".md", ".txt"}:
        text = path.read_text(encoding="utf-8", errors="replace")
        return {
            "package_id": slugify(path.stem),
            "book_id": slugify(path.stem),
            "title": path.stem,
            "subtitle": None,
            "package_format": path.suffix.lower().lstrip("."),
            "schema_version_detected": None,
            "chapter_count": 1,
            "word_count_estimate": estimate_word_count(text),
            "component_inventory": {"examples": 0, "quiz_questions": 0, "review_cards": 0, "implementation_items": 0, "exercises": 0, "memorable_lines": 0, "other": {}},
            "chapter_inventory": [{"chapter_index": 1, "chapter_id": None, "number": 1, "title": path.stem, "word_count_estimate": estimate_word_count(text), "fields": ["text"]}],
            "inventory_complete": True,
            "inventory_errors": [],
            "warnings": ["Chapter boundary inferred from a single text file"],
        }
    else:
        raise EvaluationError(f"Unsupported package form: {path}")
    json_candidates = [candidate for candidate in candidates if candidate.suffix.lower() == ".json"]
    for candidate in json_candidates:
        try:
            inspected = inspect_json_package(candidate)
        except (EvaluationError, json.JSONDecodeError, OSError):
            continue
        if inspected["chapter_count"]:
            inspected["package_format"] = "zip" if path.suffix.lower() == ".zip" else "directory"
            inspected["container_entry"] = str(candidate.relative_to(path if path.is_dir() else candidate.parents[0]))
            return inspected
    text_candidates = [candidate for candidate in candidates if candidate.suffix.lower() in {".md", ".txt"}]
    if text_candidates:
        title = path.stem
        return {
            "package_id": slugify(title),
            "book_id": slugify(title),
            "title": title,
            "subtitle": None,
            "package_format": "zip" if path.suffix.lower() == ".zip" else "directory",
            "schema_version_detected": None,
            "chapter_count": len(text_candidates),
            "word_count_estimate": sum(estimate_word_count(item.read_text(encoding="utf-8", errors="replace")) for item in text_candidates),
            "component_inventory": {"examples": 0, "quiz_questions": 0, "review_cards": 0, "implementation_items": 0, "exercises": 0, "memorable_lines": 0, "other": {}},
            "chapter_inventory": [
                {"chapter_index": index, "chapter_id": None, "number": index, "title": item.stem, "word_count_estimate": estimate_word_count(item.read_text(encoding="utf-8", errors="replace")), "fields": ["text"]}
                for index, item in enumerate(text_candidates, start=1)
            ],
            "inventory_complete": True,
            "inventory_errors": [],
            "warnings": ["Chapter boundaries inferred from text filenames"],
        }
    raise EvaluationError("No readable chapter content was detected")


def classification_for(score: float | None) -> str:
    if score is None or math.isnan(score):
        return "Unevaluable"
    if score >= 90:
        return "Reference-standard design, subject to gate and core-domain rules"
    if score >= 80:
        return "Strong design with identifiable improvements"
    if score >= 70:
        return "Valuable but materially uneven; targeted redesign needed"
    if score >= 60:
        return "Substantial redesign needed"
    return "Not ready as a ChapterFlow learning product"


def is_chapter_sample(record: Mapping[str, Any]) -> bool:
    """Return whether a record explicitly opts into the additive sample contract."""
    scope = record.get("evaluation_scope")
    return isinstance(scope, Mapping) and scope.get("mode") == SAMPLE_EVALUATION_MODE


def evaluation_scope_from_sample_metadata(
    metadata: Mapping[str, Any],
    *,
    sampled_package_sha256: str,
    selection_manifest_sha256: str,
    scope_limitation: str = SAMPLE_SCOPE_LIMITATION,
) -> dict[str, Any]:
    """Normalize embedded sampler metadata into the immutable result scope.

    The sampled package deliberately does not contain its own byte hash or the
    hash of the separately written selection manifest. Callers must supply both
    values from the deterministic job manifest.
    """
    if not isinstance(metadata, Mapping):
        raise EvaluationError("sample metadata must be an object")
    if metadata.get("mode") != SAMPLE_PACKAGE_MODE:
        raise EvaluationError(f"sample metadata mode must be {SAMPLE_PACKAGE_MODE!r}")
    if not SHA256_PATTERN.fullmatch(str(sampled_package_sha256 or "")):
        raise EvaluationError("sampled package hash must be a lowercase SHA-256 digest")
    if not SHA256_PATTERN.fullmatch(str(selection_manifest_sha256 or "")):
        raise EvaluationError("selection manifest hash must be a lowercase SHA-256 digest")
    if not str(scope_limitation or "").strip():
        raise EvaluationError("sample scope limitation cannot be empty")

    required = (
        "public_seed",
        "per_book_seed_sha256",
        "algorithm",
        "original_source",
        "requested_chapter_count",
        "actual_chapter_count",
        "selected_chapters",
    )
    missing = [key for key in required if key not in metadata]
    if missing:
        raise EvaluationError("sample metadata is missing: " + ", ".join(missing))
    original_source = metadata.get("original_source")
    selected_chapters = metadata.get("selected_chapters")
    algorithm = metadata.get("algorithm")
    if not isinstance(original_source, Mapping):
        raise EvaluationError("sample metadata original_source must be an object")
    if not isinstance(selected_chapters, list):
        raise EvaluationError("sample metadata selected_chapters must be an array")
    if not isinstance(algorithm, Mapping):
        raise EvaluationError("sample metadata algorithm must be an object")

    # JSON round-tripping creates an independent JSON-compatible snapshot and
    # avoids carrying mutable objects from a parsed source package into results.
    def snapshot(value: Any) -> Any:
        try:
            return json.loads(json.dumps(value, ensure_ascii=False))
        except (TypeError, ValueError) as exc:
            raise EvaluationError("sample metadata must be JSON-compatible") from exc

    return {
        "protocol_version": SAMPLE_PROTOCOL_VERSION,
        "mode": SAMPLE_EVALUATION_MODE,
        "sample_mode": SAMPLE_PACKAGE_MODE,
        "inference_scope": SAMPLE_INFERENCE_SCOPE,
        "score_label": SAMPLE_SCORE_LABEL,
        "public_seed": str(metadata["public_seed"]),
        "per_book_seed_sha256": str(metadata["per_book_seed_sha256"]),
        "selection_algorithm": snapshot(algorithm),
        "selection_manifest_sha256": selection_manifest_sha256,
        "original_source": snapshot(original_source),
        "sampled_package_sha256": sampled_package_sha256,
        "requested_chapter_count": metadata["requested_chapter_count"],
        "selected_chapter_count": metadata["actual_chapter_count"],
        "selected_chapters": snapshot(selected_chapters),
        "scope_limitation": scope_limitation,
        "full_book_certification_eligible": False,
    }


def derive_certification(gates: Mapping[str, Any]) -> str:
    statuses = {key: (gates.get(key) or {}).get("status") for key in GATE_KEYS}
    if statuses.get("epistemic_instructional_safety") == "fail" or statuses.get("ethics_reader_autonomy") == "fail" or statuses.get("technical_completeness") == "fail":
        return "fail"
    if statuses.get("technical_completeness") == "unevaluable" or statuses.get("purpose_audience_declaration") == "unevaluable":
        return "unevaluable"
    if any(statuses.get(key) == "conditional" for key in GATE_KEYS[:4]):
        return "conditional"
    if all(statuses.get(key) == "pass" for key in GATE_KEYS[:4]) and statuses.get("external_accuracy") in {"pass", "not_assessed"}:
        return "pass"
    return "unevaluable"


def derive_sample_certification(
    gates: Mapping[str, Any],
    *,
    selected_content_sufficient: bool,
) -> str:
    """Derive the intentionally non-certifying status for a chapter sample."""
    statuses = {key: (gates.get(key) or {}).get("status") for key in GATE_KEYS}
    if any(statuses.get(key) == "fail" for key in (
        "technical_completeness",
        "epistemic_instructional_safety",
        "ethics_reader_autonomy",
    )):
        return "fail"
    if not selected_content_sufficient or statuses.get("technical_completeness") == "unevaluable":
        return "unevaluable"
    return "not_assessed"


def sample_selected_content_sufficient(record: Mapping[str, Any]) -> bool:
    """Whether every selected chapter was fully readable for sample inference."""
    book = record.get("book")
    if not isinstance(book, Mapping):
        return False
    expected = book.get("chapter_count_expected")
    read_full = book.get("chapter_count_read_full")
    partial = book.get("chapter_count_partial")
    inaccessible = book.get("chapter_count_inaccessible")
    return (
        isinstance(expected, int)
        and not isinstance(expected, bool)
        and expected > 0
        and read_full == expected
        and partial == 0
        and inaccessible == 0
    )


def calculate_scores(record: MutableMapping[str, Any], *, mutate: bool = True) -> dict[str, float]:
    target = record if mutate else json.loads(json.dumps(record))
    domains = target.get("domains")
    if not isinstance(domains, dict):
        raise EvaluationError("domains must be an object")
    weighted_total = 0.0
    domain_scores: dict[str, float] = {}
    for domain_key, definition in DOMAINS.items():
        domain = domains.get(domain_key)
        if not isinstance(domain, dict):
            raise EvaluationError(f"Missing domain: {domain_key}")
        subcriteria = domain.get("subcriteria")
        if not isinstance(subcriteria, dict):
            raise EvaluationError(f"Missing subcriteria object for {domain_key}")
        ratings: list[float] = []
        for subcriterion_key in definition["subcriteria"]:
            item = subcriteria.get(subcriterion_key)
            if not isinstance(item, dict) or not isinstance(item.get("rating"), (int, float)) or isinstance(item.get("rating"), bool):
                raise EvaluationError(f"Missing numeric rating: {domain_key}.{subcriterion_key}")
            rating = float(item["rating"])
            if rating < 0 or rating > 4 or rating * 2 != int(rating * 2):
                raise EvaluationError(f"Invalid rating {rating}: {domain_key}.{subcriterion_key}")
            ratings.append(rating)
        domain_score = sum(ratings) / 4.0
        weighted_points = domain_score / 4.0 * float(definition["weight"])
        domain["weight"] = definition["weight"]
        domain["domain_score"] = domain_score
        domain["weighted_points"] = weighted_points
        weighted_total += weighted_points
        domain_scores[domain_key] = domain_score
    target["overall_score"] = weighted_total
    sample_mode = is_chapter_sample(target)
    classification = SAMPLE_CLASSIFICATION if sample_mode else classification_for(weighted_total)
    if isinstance(target.get("gates"), dict):
        if sample_mode:
            target["certification_status"] = derive_sample_certification(
                target["gates"],
                selected_content_sufficient=sample_selected_content_sufficient(target),
            )
        else:
            target["certification_status"] = derive_certification(target["gates"])
    if not sample_mode and weighted_total >= 90 and (
        target.get("certification_status") != "pass"
        or any(domain_scores[key] < 3.0 for key in list(DOMAINS)[:6])
    ):
        classification = "Strong design with identifiable improvements"
    target["classification"] = classification
    return {"overall_score": weighted_total, **domain_scores}


def reference_standard_eligible(record: Mapping[str, Any]) -> bool:
    if is_chapter_sample(record):
        return False
    score = float(record.get("overall_score", 0))
    if score < 90 or record.get("certification_status") != "pass":
        return False
    core = list(DOMAINS)[:6]
    return all(float(record["domains"][key]["domain_score"]) >= 3.0 for key in core)


def confidence_from_inputs(
    *,
    chapter_completeness_ratio: float,
    package_ambiguity: str,
    mean_difference: float,
    unresolved_maximum: float,
    unresolved_gate_conflict: bool,
    evidence_sufficient: bool,
    adjudication_complete: bool,
) -> str:
    if (
        chapter_completeness_ratio >= 1.0
        and package_ambiguity == "none"
        and mean_difference <= 0.35
        and unresolved_maximum <= 1
        and not unresolved_gate_conflict
        and evidence_sufficient
        and adjudication_complete
    ):
        return "high"
    if (
        chapter_completeness_ratio >= 0.9
        and package_ambiguity in {"none", "minor"}
        and mean_difference <= 0.75
        and not unresolved_gate_conflict
        and evidence_sufficient
        and adjudication_complete
    ):
        return "medium"
    return "low"


def rating_paths() -> list[tuple[str, str]]:
    return [(domain, subcriterion) for domain, definition in DOMAINS.items() for subcriterion in definition["subcriteria"]]


def agreement_statistics(primary: Mapping[str, Any], verification: Mapping[str, Any]) -> dict[str, Any]:
    differences: list[float] = []
    disagreements: list[dict[str, Any]] = []
    for domain_key, subcriterion_key in rating_paths():
        p = float(primary["domains"][domain_key]["subcriteria"][subcriterion_key]["rating"])
        v = float(verification["domains"][domain_key]["subcriteria"][subcriterion_key]["rating"])
        difference = abs(p - v)
        differences.append(difference)
        if difference:
            disagreements.append({"path": f"domains.{domain_key}.subcriteria.{subcriterion_key}", "primary": p, "verification": v, "difference": difference})
    gate_conflicts = []
    for key in GATE_KEYS:
        p_status = primary["gates"][key]["status"]
        v_status = verification["gates"][key]["status"]
        if p_status != v_status:
            gate_conflicts.append({"gate": key, "primary": p_status, "verification": v_status})
    return {
        "mean_absolute_subcriterion_difference": sum(differences) / len(differences),
        "maximum_subcriterion_difference": max(differences, default=0),
        "overall_score_difference": abs(float(primary.get("overall_score", 0)) - float(verification.get("overall_score", 0))),
        "gate_conflicts": gate_conflicts,
        "disagreements": disagreements,
    }


def embed_json_safely(value: Any) -> str:
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return (
        text.replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def atomic_replace_directory(source: Path, destination: Path) -> None:
    """Replace a directory without exposing a partially copied destination."""
    source = source.resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    staging = destination.parent / f".{destination.name}.staging-{os.getpid()}"
    previous = destination.parent / f".{destination.name}.previous-{os.getpid()}"
    if staging.exists():
        shutil.rmtree(staging)
    shutil.copytree(source, staging, symlinks=False)
    try:
        if destination.exists():
            os.replace(destination, previous)
        os.replace(staging, destination)
        if previous.exists():
            shutil.rmtree(previous)
    except Exception:
        if not destination.exists() and previous.exists():
            os.replace(previous, destination)
        if staging.exists():
            shutil.rmtree(staging)
        raise


def json_equivalent(left: Any, right: Any) -> bool:
    return json.dumps(left, sort_keys=True, ensure_ascii=False, separators=(",", ":")) == json.dumps(right, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
