#!/usr/bin/env python3
"""Recover rich v24 loose chapters from Git history only when reader-content roundtrip is exact."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any, Mapping

from repair_common import RepairError, atomic_write_json, mapping, read_json, resolve_local_path, sequence, sha256_file


PIPELINE = Path("scripts/book/prompts/chapterflow-v24-author-pipeline")


def _git(repo: Path, *args: str, binary: bool = False) -> str | bytes:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=not binary,
        check=False,
    )
    if result.returncode:
        error = result.stderr.decode(errors="replace") if binary else result.stderr
        raise RepairError(f"git {' '.join(args)} failed: {str(error).strip()}")
    return result.stdout


def _book_id(package: Mapping[str, Any]) -> str:
    return str(mapping(package.get("book")).get("bookId") or package.get("book_id") or "")


def _validate_chapters(package: Mapping[str, Any], book_id: str, label: str) -> list[Mapping[str, Any]]:
    chapters = sequence(package.get("chapters"))
    if not chapters or any(not isinstance(item, Mapping) for item in chapters):
        raise RepairError(f"{label} must contain a non-empty object chapter list")
    numbers = [mapping(item).get("number") for item in chapters]
    ids = [str(mapping(item).get("chapterId") or "") for item in chapters]
    if numbers != list(range(1, len(chapters) + 1)) or len(set(ids)) != len(ids):
        raise RepairError(f"{label} chapters must be uniquely numbered and ordered from 1")
    expected_ids = [f"{book_id}-ch{number:02d}" for number in numbers]
    if ids != expected_ids:
        raise RepairError(f"{label} chapterId inventory is not canonical for {book_id}")
    if any(not str(mapping(item).get("title") or "").strip() for item in chapters):
        raise RepairError(f"{label} contains a chapter without a title")
    return [mapping(item) for item in chapters]


def _strip_with_live_pipeline(repo: Path, pipeline: Path, recovered_bytes: bytes) -> list[Mapping[str, Any]]:
    source = pipeline / "src/lib/readerContent.ts"
    if not source.is_file():
        raise RepairError("live v24 stripInternalFields implementation is missing")
    fd, temporary = tempfile.mkstemp(prefix="book-repair-recovered-", suffix=".json")
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(recovered_bytes)
        code = (
            'import {readFileSync} from "node:fs"; '
            'import * as readerContent from "./src/lib/readerContent.ts"; '
            'const stripInternalFields=readerContent.stripInternalFields??readerContent.default?.stripInternalFields; '
            'if(typeof stripInternalFields!=="function") throw new Error("stripInternalFields export unavailable"); '
            'const p=JSON.parse(readFileSync(process.argv[1],"utf8")); '
            'process.stdout.write(JSON.stringify(p.chapters.map((c)=>stripInternalFields(c))));'
        )
        override = os.environ.get("CHAPTERFLOW_TSX_BIN")
        candidates = [Path(override).expanduser() if override else None, pipeline / "node_modules/.bin/tsx", repo / "node_modules/.bin/tsx"]
        tsx = next((path.resolve() for path in candidates if path is not None and path.is_file() and os.access(path, os.X_OK)), None)
        if tsx is None:
            raise RepairError("local tsx runtime is unavailable; refusing a network-backed npx bootstrap")
        loader = tsx.resolve().parent / "loader.mjs"
        node = shutil.which("node")
        if node is None or not loader.is_file():
            raise RepairError("local Node/tsx loader runtime is unavailable")
        result = subprocess.run(
            [node, "--import", str(loader), "--input-type=module", "--eval", code, temporary],
            cwd=pipeline,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        if result.returncode:
            raise RepairError(f"live stripInternalFields invocation failed: {result.stderr.strip()}")
        value = json.loads(result.stdout)
        if not isinstance(value, list) or any(not isinstance(item, Mapping) for item in value):
            raise RepairError("live stripInternalFields returned an invalid chapter list")
        return value
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass


def bootstrap(args: argparse.Namespace) -> dict[str, Any]:
    book_id = args.book_id
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", book_id):
        raise RepairError("book id must be exact lowercase hyphenated text")
    repo = resolve_local_path(args.repo_root)
    pipeline = repo / PIPELINE
    outer = repo / "book-packages" / f"{book_id}.v21.json"
    nested = pipeline / "book-packages" / f"{book_id}.v21.json"
    manifest_path = resolve_local_path(args.manifest)
    if manifest_path.exists():
        raise RepairError(f"refusing to overwrite bootstrap manifest: {manifest_path}")
    if not outer.is_file():
        raise RepairError(f"shipped outer package is missing: {outer}")
    outer_package = read_json(outer)
    if not isinstance(outer_package, Mapping) or _book_id(outer_package) != book_id:
        raise RepairError("outer package book id mismatch")
    outer_chapters = _validate_chapters(outer_package, book_id, "outer package")

    commit = str(_git(repo, "rev-parse", f"{args.recovered_commit}^{{commit}}")).strip()
    ancestor = subprocess.run(["git", "-C", str(repo), "merge-base", "--is-ancestor", commit, "HEAD"], check=False)
    if ancestor.returncode:
        raise RepairError("recovered commit is not an ancestor of current HEAD")
    recovered_path = args.recovered_repo_path or f"book-packages/{book_id}.v21.json"
    recovered_bytes = _git(repo, "show", f"{commit}:{recovered_path}", binary=True)
    assert isinstance(recovered_bytes, bytes)
    try:
        recovered_package = json.loads(recovered_bytes)
    except json.JSONDecodeError as exc:
        raise RepairError(f"historical recovered package is invalid JSON: {exc}") from exc
    if not isinstance(recovered_package, Mapping) or _book_id(recovered_package) != book_id:
        raise RepairError("historical recovered package book id mismatch")
    recovered_chapters = _validate_chapters(recovered_package, book_id, "historical recovered package")
    if [(item["chapterId"], item["number"], item["title"]) for item in recovered_chapters] != [(item["chapterId"], item["number"], item["title"]) for item in outer_chapters]:
        raise RepairError("historical and shipped chapter indexes differ")
    stripped = _strip_with_live_pipeline(repo, pipeline, recovered_bytes)
    if stripped != outer_chapters:
        raise RepairError("stripInternalFields(recoveredChapter) does not roundtrip exactly to every shipped chapter")
    if any(dict(raw) == dict(clean) for raw, clean in zip(recovered_chapters, stripped)):
        raise RepairError("historical package is not rich enough; at least one chapter has no recoverable authoring fields")

    index = [
        {"chapterId": item["chapterId"], "chapterNumber": item["number"], "chapterTitle": item["title"]}
        for item in recovered_chapters
    ]
    targets: dict[Path, Any] = {
        pipeline / "state/indexes" / f"{book_id}.json": index,
        **{
            pipeline / "state/chapters" / f"{item['chapterId']}.v21-native.chapter.json": {**dict(item), "schemaVersion": "chapterflow-v21-authored"}
            for item in recovered_chapters
        },
    }
    collision_paths = set(path for path in targets if path.exists())
    if nested.exists():
        collision_paths.add(nested)
    for root in (pipeline / "state", pipeline / ".chapterflow", repo / ".chapterflow"):
        if root.exists():
            collision_paths.update(root.rglob(f"*{book_id}*"))
    collisions = sorted(str(path) for path in collision_paths)
    if collisions:
        raise RepairError("bootstrap target collision; refusing all writes: " + ", ".join(collisions))
    outer_before = sha256_file(outer)
    nested_before = sha256_file(nested) if nested.is_file() else None
    rows = []
    for path, value in targets.items():
        payload = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        rows.append({"path": str(path), "sha256": __import__("hashlib").sha256(payload).hexdigest()})

    applied_created: list[Path] = []
    if args.apply:
        stage = pipeline / "state" / f".book-repair-bootstrap-{book_id}-{uuid.uuid4().hex}"
        created: list[Path] = []
        try:
            stage.mkdir(parents=True, exist_ok=False)
            staged: list[tuple[Path, Path]] = []
            for index_value, (target, value) in enumerate(targets.items()):
                staged_path = stage / f"{index_value:04d}.json"
                atomic_write_json(staged_path, value)
                staged.append((staged_path, target))
            for staged_path, target in staged:
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.exists():
                    raise RepairError(f"bootstrap collision appeared during transaction: {target}")
                os.replace(staged_path, target)
                created.append(target)
                applied_created.append(target)
        except BaseException:
            for path in reversed(created):
                try:
                    path.unlink()
                except FileNotFoundError:
                    pass
            raise
        finally:
            if stage.exists():
                for path in stage.iterdir():
                    path.unlink()
                stage.rmdir()
    if sha256_file(outer) != outer_before or (sha256_file(nested) if nested.is_file() else None) != nested_before:
        raise RepairError("bootstrap modified a package artifact; refusing success")
    manifest = {
        "schema_version": "1.0.0",
        "status": "applied" if args.apply else "preflight-valid",
        "book_id": book_id,
        "recovered_commit": commit,
        "recovered_repo_path": recovered_path,
        "recovered_blob_sha256": __import__("hashlib").sha256(recovered_bytes).hexdigest(),
        "outer_package_path": str(outer),
        "outer_package_sha256": outer_before,
        "nested_package_path": str(nested),
        "nested_package_sha256": nested_before,
        "chapter_count": len(recovered_chapters),
        "targets": rows,
        "source_evidence_imported": False,
        "qc_imported": False,
        "required_next_steps": ["regenerate source-v2 evidence", "run independent source verification", "run all author and QC gates"],
    }
    try:
        atomic_write_json(manifest_path, manifest)
    except BaseException:
        if args.apply:
            for path in reversed(applied_created):
                try:
                    path.unlink()
                except FileNotFoundError:
                    pass
        raise
    return manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--book-id", required=True)
    parser.add_argument("--recovered-commit", required=True)
    parser.add_argument("--recovered-repo-path")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--apply", action="store_true", help="Default is preflight only")
    return parser.parse_args()


def main() -> int:
    try:
        manifest = bootstrap(parse_args())
    except (RepairError, OSError, json.JSONDecodeError) as exc:
        print(f"book-repair bootstrap error: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
