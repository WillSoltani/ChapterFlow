#!/usr/bin/env python3
"""Small, dependency-free helpers shared by the book-repair scripts."""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Mapping, Sequence
from urllib.parse import unquote, urlparse


class RepairError(ValueError):
    """Raised when a repair artifact cannot be trusted."""


def resolve_local_path(value: str | Path) -> Path:
    """Resolve a plain path or a local file:// URL; reject every remote URL."""
    text = str(value)
    parsed = urlparse(text)
    if parsed.scheme:
        if parsed.scheme != "file" or parsed.netloc not in {"", "localhost"}:
            raise RepairError(f"only local paths and file:// URLs are supported: {text}")
        return Path(unquote(parsed.path)).expanduser().resolve()
    return Path(text).expanduser().resolve()


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise RepairError(f"cannot read {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise RepairError(f"invalid JSON in {path}: {exc}") from exc


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
    except OSError as exc:
        raise RepairError(f"cannot hash {path}: {exc}") from exc
    return digest.hexdigest()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def canonical_json_sha256(value: Any) -> str:
    """Hash a JSON value with a stable, whitespace-independent encoding."""
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256_text(payload)


def history_entry_sha256(entry: Mapping[str, Any]) -> str:
    """Hash every field of one state-history entry except its own digest."""
    payload = dict(entry)
    payload.pop("entry_sha256", None)
    return canonical_json_sha256(payload)


def validate_history_chain(history: Sequence[Any], *, genesis_sha256: str) -> list[str]:
    """Validate the append-only state history chain anchored by the context seal."""
    errors: list[str] = []
    previous: str | None = None
    for index, raw in enumerate(history):
        if not isinstance(raw, Mapping):
            errors.append(f"state history entry {index} is not an object")
            continue
        expected_previous = None if index == 0 else previous
        if raw.get("previous_entry_sha256") != expected_previous:
            errors.append(f"state history entry {index} has an invalid previous-entry hash")
        actual = history_entry_sha256(raw)
        if raw.get("entry_sha256") != actual:
            errors.append(f"state history entry {index} digest is invalid")
        if index == 0 and actual != genesis_sha256:
            errors.append("state history genesis differs from the immutable context seal")
        previous = actual
    return errors


def atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def atomic_write_json(path: Path, value: Any) -> None:
    atomic_write_text(path, json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def sequence(value: Any) -> list[Any]:
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return list(value)
    return []


def mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def exact_book(data: Mapping[str, Any], book_id: str) -> Mapping[str, Any]:
    matches = []
    for item in sequence(data.get("books")):
        if not isinstance(item, Mapping):
            continue
        candidate = str(item.get("book_id") or item.get("id") or "")
        if candidate == book_id:
            matches.append(item)
    if len(matches) != 1:
        raise RepairError(f"expected exactly one exact book_id={book_id!r}; found {len(matches)}")
    return matches[0]


class _ReportDataParser(HTMLParser):
    def __init__(self, identifier: str = "report-data") -> None:
        super().__init__(convert_charrefs=False)
        self.identifier = identifier
        self._inside = False
        self._seen = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag.casefold() == "script" and attributes.get("id") == self.identifier:
            self._seen += 1
            self._inside = True

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() == "script" and self._inside:
            self._inside = False

    def handle_data(self, data: str) -> None:
        if self._inside:
            self.parts.append(data)

    @property
    def seen(self) -> int:
        return self._seen


def script_json_from_html(path: Path, identifier: str) -> Mapping[str, Any]:
    parser = _ReportDataParser(identifier)
    try:
        parser.feed(path.read_text(encoding="utf-8"))
        parser.close()
    except OSError as exc:
        raise RepairError(f"cannot read report HTML {path}: {exc}") from exc
    if parser.seen != 1:
        raise RepairError(f"report HTML must contain exactly one script#{identifier}; found {parser.seen}")
    try:
        value = json.loads("".join(parser.parts))
    except json.JSONDecodeError as exc:
        raise RepairError(f"invalid embedded {identifier} JSON in {path}: {exc}") from exc
    if not isinstance(value, Mapping):
        raise RepairError(f"embedded {identifier} must be a JSON object")
    return value


def report_data_from_html(path: Path) -> Mapping[str, Any]:
    return script_json_from_html(path, "report-data")


def report_data(path: Path) -> Mapping[str, Any]:
    if path.suffix.casefold() in {".html", ".htm"}:
        return report_data_from_html(path)
    value = read_json(path)
    if not isinstance(value, Mapping):
        raise RepairError(f"report data must be a JSON object: {path}")
    return value


def validate_json_schema(value: Any, schema: Mapping[str, Any], path: str = "$") -> list[str]:
    """Validate the JSON-Schema subset used by this skill's bundled schemas."""
    errors: list[str] = []
    expected_type = schema.get("type")
    type_checks = {
        "object": lambda item: isinstance(item, Mapping),
        "array": lambda item: isinstance(item, list),
        "string": lambda item: isinstance(item, str),
        "number": lambda item: isinstance(item, (int, float)) and not isinstance(item, bool),
        "integer": lambda item: isinstance(item, int) and not isinstance(item, bool),
        "boolean": lambda item: isinstance(item, bool),
        "null": lambda item: item is None,
    }
    if isinstance(expected_type, str) and expected_type in type_checks and not type_checks[expected_type](value):
        return [f"{path}: expected {expected_type}"]
    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: expected constant {schema['const']!r}")
    if isinstance(schema.get("enum"), list) and value not in schema["enum"]:
        errors.append(f"{path}: value is not in the allowed enum")
    if isinstance(value, str):
        if isinstance(schema.get("minLength"), int) and len(value) < schema["minLength"]:
            errors.append(f"{path}: string is shorter than minLength")
        if isinstance(schema.get("pattern"), str) and re.search(schema["pattern"], value) is None:
            errors.append(f"{path}: string does not match pattern {schema['pattern']!r}")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if isinstance(schema.get("minimum"), (int, float)) and value < schema["minimum"]:
            errors.append(f"{path}: number is below minimum {schema['minimum']}")
    if isinstance(value, list):
        if isinstance(schema.get("minItems"), int) and len(value) < schema["minItems"]:
            errors.append(f"{path}: array has fewer than minItems")
        if isinstance(schema.get("maxItems"), int) and len(value) > schema["maxItems"]:
            errors.append(f"{path}: array has more than maxItems")
        item_schema = schema.get("items")
        if isinstance(item_schema, Mapping):
            for index, item in enumerate(value):
                errors.extend(validate_json_schema(item, item_schema, f"{path}[{index}]"))
    if isinstance(value, Mapping):
        required = schema.get("required")
        if isinstance(required, list):
            for key in required:
                if key not in value:
                    errors.append(f"{path}: missing required property {key!r}")
        properties = schema.get("properties")
        if isinstance(properties, Mapping):
            if schema.get("additionalProperties") is False:
                for key in value:
                    if key not in properties:
                        errors.append(f"{path}: additional property {key!r} is not allowed")
            for key, property_schema in properties.items():
                if key in value and isinstance(property_schema, Mapping):
                    errors.extend(validate_json_schema(value[key], property_schema, f"{path}.{key}"))
    return errors
