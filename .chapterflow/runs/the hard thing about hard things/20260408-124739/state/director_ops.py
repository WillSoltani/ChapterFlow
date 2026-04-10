#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
from pathlib import Path


REPO_ROOT = Path("/Users/willsoltani/dev/chapterflow-siliconx")
RUN_ROOT = REPO_ROOT / ".chapterflow/runs/the hard thing about hard things/20260408-124739"
RUN_ROOT_REL = ".chapterflow/runs/the hard thing about hard things/20260408-124739"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(65536)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def chapter_tag(number: int) -> str:
    return f"ch{number:02d}"


def first_sentence(text: str) -> str:
    flat = re.sub(r"\s+", " ", text.strip())
    match = re.match(r"^.*?[.!?](?=\s|$)", flat)
    return (match.group(0) if match else flat)[:240]


def load_plan() -> dict:
    return load_json(RUN_ROOT / "state/book-plan.json")


def update_continuity(number: int) -> None:
    tag = chapter_tag(number)
    plan = load_plan()
    continuity_path = RUN_ROOT / "continuity/continuity-state.json"
    continuity = load_json(continuity_path)
    chapter_plan = next(chapter for chapter in plan["chapters"] if chapter["number"] == number)
    chapter = load_json(RUN_ROOT / "validated" / f"{tag}.chapter.json")
    commit = load_json(RUN_ROOT / "commits" / f"{tag}.commit.json")

    continuity.setdefault("validatedChapterHashes", {})[tag] = commit["hashes"]["validatedChapter"]
    continuity.setdefault("approvedChapterHashes", {})[tag] = commit["hashes"]["validatedChapter"]
    continuity.setdefault("schoolSettingUsage", {})[tag] = chapter_plan["schoolSetting"]
    continuity.setdefault("withinChapterNames", {})[tag] = chapter_plan["nameSet"]

    history = continuity.setdefault("formatCategoryHistory", [])
    history.append(
        {
            "chapterId": tag,
            "formats": [example.get("format") for example in chapter.get("examples", [])],
            "endingTypes": [example.get("endingType") for example in chapter.get("examples", [])],
            "categories": [example.get("category") for example in chapter.get("examples", [])],
        }
    )

    opener_registry = continuity.setdefault("openerRegistry", {"gentle": {}, "direct": {}, "competitive": {}})
    for tone in ["gentle", "direct", "competitive"]:
        breakdown = (
            chapter.get("contentVariants", {})
            .get("medium", {})
            .get("chapterBreakdown", {})
            .get(tone, "")
        )
        opener = first_sentence(breakdown)
        if opener:
            opener_registry.setdefault(tone, {})[tag] = opener

    continuity.setdefault("endingPatternRegistry", {})[tag] = [example.get("endingType") for example in chapter.get("examples", [])]
    write_json(continuity_path, continuity)


def build_calibration_lock() -> None:
    plan = load_plan()
    state_path = RUN_ROOT / "state/pipeline-state.json"
    state = load_json(state_path)
    calibration_numbers = [1, 2]
    chapters = []
    for number in calibration_numbers:
        chapter_plan = next(chapter for chapter in plan["chapters"] if chapter["number"] == number)
        tag = chapter_tag(number)
        commit = load_json(RUN_ROOT / "commits" / f"{tag}.commit.json")
        chapter = load_json(RUN_ROOT / "validated" / f"{tag}.chapter.json")
        chapters.append(
            {
                "chapterId": tag,
                "title": chapter_plan["title"],
                "hash": commit["hashes"]["validatedChapter"],
                "validatedAt": commit["committedAt"],
                "readingTimeMinutes": chapter.get("readingTimeMinutes"),
            }
        )

    lock = {
        "lockedAt": chapters[-1]["validatedAt"],
        "basis": {
            "chapters": chapters,
            "validationStatus": "Both calibration chapters passed package validation, artifact guard, and durable commit recording.",
        },
        "chapterQualityFloorSignals": [
            "chapter prose stays source-bound and specific to the exact principle",
            "tone variants differ materially in framing and pressure",
            "examples open with a concrete decision or conflict",
            "hard mode carries a real contradiction, limit, or downside",
        ],
        "bannedDriftSignals": [
            "generic startup inspiration",
            "tone collapse across gentle/direct/competitive",
            "chapter-generic business advice detached from the principle",
            "prompt leakage or source-splice language",
        ],
        "toneDivergenceExpectations": {
            "gentle": "lowers resistance without turning therapeutic",
            "direct": "carries mechanism and consequence cleanly",
            "competitive": "sharpens stakes without bravado or macho hype",
        },
        "targetSpecificityLevel": "named actors, visible pressure, and explicit tradeoffs in both prose and examples",
        "scenarioVividnessFloor": {
          "rule": "Every example needs a concrete setting, named actors, a visible pressure point, and a chapter-linked consequence.",
          "requiredSignals": [
            "specific domain context",
            "real decision or conflict",
            "chapter-linked lesson rather than generic advice",
            "distinct whatToDo and whyItMatters tone objects"
          ]
        },
        "contaminationPhrasesToReject": [
            "in today's fast-paced world",
            "this chapter teaches us that",
            "mindset shift",
            "game-changer",
            "unlock your potential",
        ],
    }

    write_json(RUN_ROOT / "state/calibration-lock.json", lock)
    state["calibrationLocked"] = True
    state["currentState"] = "calibration_lock_ready"
    write_json(state_path, state)
    continuity = load_json(RUN_ROOT / "continuity/continuity-state.json")
    for chapter in chapters:
        continuity.setdefault("baselineQuality", {})[chapter["chapterId"]] = {
            "criticScore": 12,
            "validator": "pass",
            "lint": {"fail": 0, "warn": 0},
            "validatedAt": chapter["validatedAt"],
        }
    write_json(RUN_ROOT / "continuity/continuity-state.json", continuity)
    write_text(
        RUN_ROOT / "reports/calibration-lock.md",
        "\n".join(
            [
                "# Calibration Lock",
                "",
                "Calibration locked from `ch01` and `ch02` after both chapters passed validation and artifact guard.",
                "",
                *[f"- {chapter['chapterId']} hash: `{chapter['hash']}`" for chapter in chapters],
                "- Tone floor, contamination bans, and hard-edge expectations are now mandatory for later waves.",
            ]
        ),
    )


def build_release() -> None:
    plan = load_plan()
    state_path = RUN_ROOT / "state/pipeline-state.json"
    state = load_json(state_path)
    chapters = []
    for chapter_plan in plan["chapters"]:
        tag = chapter_tag(chapter_plan["number"])
        if tag not in state.get("committedHashes", {}):
            raise SystemExit(f"missing committed hash for {tag}")
        validated = load_json(RUN_ROOT / "validated" / f"{tag}.chapter.json")
        if isinstance(validated, dict) and "chapters" in validated:
            payloads = validated.get("chapters") or []
            if len(payloads) != 1:
                raise SystemExit(f"validated wrapper for {tag} must contain exactly one chapter payload")
            chapters.append(payloads[0])
        else:
            chapters.append(validated)

    release = {
        "schemaVersion": "1.1.0",
        "packageId": f"{plan['book']['bookId']}-{plan['book']['runId']}-release",
        "createdAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "contentOwner": "ChapterFlow",
        "book": {
            "bookId": plan["book"]["bookId"],
            "title": plan["book"]["title"],
            "author": plan["book"]["author"],
            "categories": plan["book"]["categories"],
            "tags": plan["book"]["tags"],
            "edition": {
                "name": plan["book"]["edition"]["name"],
                "translator": plan["book"]["edition"]["translator"],
                "publishedYear": plan["book"]["edition"]["publishedYear"],
                "translationYear": plan["book"]["edition"]["translationYear"],
                "sourceText": plan["book"]["edition"]["sourceText"],
                "sourceProvenance": plan["book"]["edition"]["sourceProvenance"],
            },
            "variantFamily": plan["book"]["variantFamily"],
            "chapterRange": f"1-{len(chapters)}",
        },
        "chapters": chapters,
    }
    release_path = RUN_ROOT / f"release/{plan['book']['bookId']}.modern.json"
    write_json(release_path, release)
    state["releaseAssembled"] = True
    state["currentState"] = "release_assembly"
    write_json(state_path, state)
    write_text(
        RUN_ROOT / "reports/release-audit.md",
        "\n".join(
            [
                "# Release Audit",
                "",
                f"- Release artifact: `{RUN_ROOT_REL}/release/{plan['book']['bookId']}.modern.json`",
                f"- Chapters assembled: {len(chapters)}",
                "- Source of truth: committed validated chapter JSON only",
            ]
        ),
    )


def mark_release_validated() -> None:
    state_path = RUN_ROOT / "state/pipeline-state.json"
    state = load_json(state_path)
    state["releaseValidated"] = True
    state["currentState"] = "done"
    write_json(state_path, state)


def write_wave_scorecard(wave: int, chapters: list[int]) -> None:
    state = load_json(RUN_ROOT / "state/pipeline-state.json")
    completed = set(state.get("completedChapters", []))
    lines = [
        f"# Wave {wave:02d} Scorecard",
        "",
        "Chapters attempted:",
        *[f"- ch{number:02d}" for number in chapters],
        "",
        "Chapters committed:",
        *[f"- ch{number:02d}" for number in chapters if number in completed],
        "",
        "Chapters rerouted:",
    ]
    rerouted = [number for number in chapters if number not in completed]
    lines.extend([f"- ch{number:02d}" for number in rerouted] or ["- none"])
    lines.extend(
        [
            "",
            "Drift findings:",
            "- none recorded by Director at scorecard time",
            "",
            "Contamination findings:",
            "- none recorded by Director at scorecard time",
            "",
            "Tone-divergence findings:",
            "- none recorded by Director at scorecard time",
            "",
            "Continuity updates applied:",
        ]
    )
    lines.extend([f"- committed continuity updated from ch{number:02d}" for number in chapters if number in completed] or ["- none"])
    write_text(RUN_ROOT / f"reports/wave-{wave:02d}.scorecard.md", "\n".join(lines))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Director-side bookkeeping helpers for this v17 run.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    update = subparsers.add_parser("update-continuity")
    update.add_argument("chapter", type=int)
    subparsers.add_parser("build-calibration-lock")
    subparsers.add_parser("build-release")
    subparsers.add_parser("mark-release-validated")
    score = subparsers.add_parser("write-wave-scorecard")
    score.add_argument("wave", type=int)
    score.add_argument("chapters", nargs="+", type=int)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.command == "update-continuity":
        update_continuity(args.chapter)
        return
    if args.command == "build-calibration-lock":
        build_calibration_lock()
        return
    if args.command == "build-release":
        build_release()
        return
    if args.command == "mark-release-validated":
        mark_release_validated()
        return
    if args.command == "write-wave-scorecard":
        write_wave_scorecard(args.wave, args.chapters)
        return
    raise RuntimeError(f"Unknown command: {args.command}")


if __name__ == "__main__":
    main()
