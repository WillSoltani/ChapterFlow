
#!/usr/bin/env python3
from pathlib import Path
import json, sys

def load_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def dump_json(p, data):
    Path(p).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def chapter_entry(run_root, num):
    idx = load_json(run_root / "state" / "chapter-index.json")
    for ch in idx:
        if ch.get("number") == num:
            return ch
    raise SystemExit(f"Chapter {num} not found in chapter-index.json")

def ticket_md(run_root, task):
    stage = task["stage"]
    lines = []
    lines.append(f"# Current Ticket")
    lines.append("")
    lines.append(f"Stage: `{stage}`")
    lines.append("")
    lines.append("## Non-negotiables")
    lines.append("- Filesystem is memory. Do not rely on chat memory.")
    lines.append("- Do only this ticket.")
    lines.append("- Do not create generator scripts or seed-based chapter authors.")
    lines.append("- Release must later be assembled from validated chapter files only.")
    lines.append("- If the current ticket is incomplete, fix this ticket. Do not jump ahead.")
    lines.append("")
    if stage == "source_discovery":
        lines.extend([
            "## Read",
            "- `PACK_ROOT/rules/source-discovery-rules.md`",
            "- `RUN_ROOT/manifests/run-manifest.json`",
            "",
            "## Write",
            "- `source-freeze/edition-lock.json`",
            "- `source-freeze/source-ledger.json`",
            "- `source-freeze/source-discovery.md`",
            "- `source-freeze/source-bundle/`",
            "- `source-freeze/toc.json`",
            "- `sidecars/source-heading-index.json`",
            "- `state/chapter-index.json`",
            "",
            "## Exit criteria",
            "- frozen source ledger exists",
            "- edition or translation is locked or safely auto-resolved",
            "- chapter index exists for the book",
        ])
    elif stage == "memory_compile":
        lines.extend([
            "## Read",
            "- `PACK_ROOT/style/*`",
            "- `PACK_ROOT/rules/*` as needed",
            "",
            "## Write",
            "- `memory/style-memory.md`",
            "- `memory/quality-memory.md`",
            "- `memory/role-cards/writer.md`",
            "- `memory/role-cards/editor.md`",
            "- `memory/role-cards/critic.md`",
            "- `memory/role-cards/converter.md`",
            "- `memory/role-cards/quiz.md`",
            "- `memory/role-cards/validator.md`",
            "- `memory/role-cards/patch.md`",
            "",
            "## Exit criteria",
            "- role cards exist and are concise enough for repeated reuse",
        ])
    elif stage == "book_skeleton":
        lines.extend([
            "## Read",
            "- `source-freeze/edition-lock.json`",
            "- `source-freeze/source-ledger.json`",
            "- `state/chapter-index.json`",
            "- `memory/style-memory.md`",
            "- `memory/quality-memory.md`",
            "",
            "## Write",
            "- `skeleton/book-skeleton.md`",
            "",
            "## Exit criteria",
            "- skeleton covers every chapter with one-line intent and source richness",
        ])
    elif stage == "calibration_lock":
        lines.extend([
            "## Read",
            "- `validated/ch01.chapter.json`",
            "- `validated/ch02.chapter.json`",
            "- `reports/ch01.validation.md`",
            "- `reports/ch02.validation.md`",
            "- `memory/style-memory.md`",
            "- `memory/quality-memory.md`",
            "",
            "## Write",
            "- `state/calibration-lock.json`",
            "- `reports/calibration-lock.md`",
            "",
            "## Exit criteria",
            "- calibration lock captures contamination bans, tone floor, grade-band floor, hard-edge rule, quiz rule, scenario-tone rule",
        ])
    elif stage.startswith("chapter_"):
        num = int(stage.split("_")[1])
        ch = chapter_entry(run_root, num)
        chid = f"ch{num:02d}"
        lines.extend([
            f"## Chapter",
            f"- Number: {num}",
            f"- Title: {ch.get('title', '')}",
            "",
            "## Read in this order",
            "- `RUN_ROOT/state/book-state.json`",
            "- `RUN_ROOT/continuity/continuity-state.json`",
            "- `RUN_ROOT/memory/style-memory.md`",
            "- `RUN_ROOT/memory/quality-memory.md`",
            "- `RUN_ROOT/memory/role-cards/writer.md`",
            "- `RUN_ROOT/memory/role-cards/editor.md`",
            "- `RUN_ROOT/memory/role-cards/critic.md`",
            "- `RUN_ROOT/memory/role-cards/converter.md`",
            "- `RUN_ROOT/memory/role-cards/quiz.md`",
            "- `RUN_ROOT/memory/role-cards/validator.md`",
            "- `RUN_ROOT/state/calibration-lock.json` if it exists",
            f"- `RUN_ROOT/sidecars/source/{chid}.source.txt` if it exists",
            f"- `RUN_ROOT/sidecars/source/{chid}.source.json` if it exists",
            "- `RUN_ROOT/skeleton/book-skeleton.md`",
            "- `PACK_ROOT/briefs/brief-template.md`",
            "- `PACK_ROOT/briefs/chapter-outline-template.md`",
            "- `PACK_ROOT/briefs/quiz-blueprint-template.md`",
            "- `PACK_ROOT/rules/chapter-quality-gate.md`",
            "- `PACK_ROOT/rules/chapter-structure.md`",
            "",
            "## Do the full chapter loop",
            f"1. write `briefs/{chid}.md`",
            f"2. write `outlines/{chid}.md`",
            f"3. write `quiz-blueprints/{chid}.md`",
            f"4. write `drafts/canonical/{chid}.md`",
            f"5. write `drafts/edited/{chid}.md`",
            f"6. write `reports/{chid}.critic.md`",
            f"7. patch locally if critic says LOCAL_PATCH",
            f"8. write `structured/{chid}.chapter.json`",
            f"9. write `quizzes/{chid}.quiz.json`",
            f"10. write `reports/{chid}.validation.md`",
            f"11. write `validated/{chid}.chapter.json`",
            f"12. write `validated/{chid}.review-package.json`",
            f"13. update `continuity/continuity-state.json` from the validated chapter only",
            "",
            "## Hard fails",
            "- instruction leakage into reader-facing prose",
            "- plain-string scenario fields",
            "- empty quiz",
            "- identical tone variants",
            "- source-splice contamination",
            "- generator-script shortcut",
            "",
            "## Exit criteria",
            "- chapter-quality gate cleared internally",
            "- quiz exists and is non-empty",
            "- validated chapter exists",
            "- review wrapper exists",
            "- continuity updated",
        ])
    elif stage == "release_assembly":
        lines.extend([
            "## Read",
            "- `RUN_ROOT/manifests/run-manifest.json`",
            "- all `RUN_ROOT/validated/ch*.chapter.json`",
            "- `PACK_ROOT/rules/release-assembly-rules.md`",
            "",
            "## Do",
            "- run `python3 PACK_ROOT/tools/chapterflow_v16_build_release.py PACK_ROOT RUN_ROOT`",
            "",
            "## Exit criteria",
            "- `release/{bookId}.modern.json` exists",
        ])
    elif stage == "release_validation":
        lines.extend([
            "## Read",
            "- `release/{bookId}.modern.json`",
            "- all `validated/ch*.chapter.json`",
            "- `PACK_ROOT/MasterValidator-v16.md`",
            "",
            "## Do",
            "- run the repo mechanical validator if present",
            "- run `python3 PACK_ROOT/tools/chapterflow_v16_release_guard.py RUN_ROOT release/{bookId}.modern.json`",
            "- write `reports/release.validation.md`",
            "- write `reports/release.audit.md`",
            "",
            "## Exit criteria",
            "- release guard passes",
            "- release validation report exists",
        ])
    elif stage == "complete":
        lines.extend([
            "Run complete.",
            "",
            "No further generation work is required."
        ])
    else:
        lines.append(f"Unknown stage: {stage}")
    return "\n".join(lines) + "\n"

def main():
    if len(sys.argv) != 3:
        print("Usage: chapterflow_v16_dispatch.py <pack_root> <run_root>")
        sys.exit(2)
    pack_root = Path(sys.argv[1])
    run_root = Path(sys.argv[2])
    task = load_json(run_root / "state" / "current-task.json")
    md = ticket_md(run_root, task)
    (run_root / "state" / "current-ticket.md").write_text(md, encoding="utf-8")
    print(run_root / "state" / "current-ticket.md")

if __name__ == "__main__":
    main()
