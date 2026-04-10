#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import re
import shutil
import textwrap
from pathlib import Path


REPO_ROOT = Path("/Users/willsoltani/dev/chapterflow-siliconx")
RUN_ROOT = REPO_ROOT / ".chapterflow/runs/the hard thing about hard things/20260408-124739"
RUN_ROOT_REL = ".chapterflow/runs/the hard thing about hard things/20260408-124739"
PACK_ROOT = REPO_ROOT / "scripts/book/prompts/chapterflow-v17-director-worker"
DATA_PATH = RUN_ROOT / "state/bootstrap-data.json"
NOW = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
GLOBAL_BANNED_NAMES = ["Alex", "Taylor", "Jordan", "Chris", "Sam", "Casey", "Jamie", "Morgan"]
GLOBAL_BANNED_OPENERS = [
    "In today's fast-paced world",
    "This chapter teaches us that",
    "Success starts when",
]
GLOBAL_VOCAB_WATCHLIST = [
    "mindset",
    "unlock",
    "journey",
    "game-changer",
    "navigate",
    "guru",
]
FORMAT_ORDER = [
    "decision_point",
    "postmortem",
    "dialogue",
    "predict_reveal",
    "dilemma",
    "before_after",
]
ENDING_ORDER = [
    "broader_principle",
    "self_directed_question",
    "surprising_implication",
    "cross_domain",
    "common_trap",
    "perspective_reframe",
]
CATEGORY_SLOTS = ["work", "school", "personal", "work", "school", "personal"]


def load_data() -> dict:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


DATA = load_data()
BOOK = DATA["book"]
SOURCE_REFS = DATA["sourceRefs"]


def rotate(values: list[str], offset: int) -> list[str]:
    offset = offset % len(values)
    return values[offset:] + values[:offset]


def chapter_id(number: int) -> str:
    return f"ch{number:02d}"


def rel(path: Path) -> str:
    return str(path.relative_to(REPO_ROOT))


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def load_state() -> dict:
    state_path = RUN_ROOT / "state/pipeline-state.json"
    if state_path.exists():
        return json.loads(state_path.read_text(encoding="utf-8"))
    return {
        "currentState": "preflight",
        "completedChapters": [],
        "currentWave": 0,
        "queuedChapters": [],
        "committedHashes": {},
        "calibrationLocked": False,
        "sourceFreezeLocked": False,
        "releaseAssembled": False,
        "releaseValidated": False,
    }


def build_assignments(chapter: dict) -> list[dict]:
    idx = chapter["number"] - 1
    formats = rotate(FORMAT_ORDER, idx)
    endings = rotate(ENDING_ORDER, idx * 2)
    categories = rotate(CATEGORY_SLOTS, idx)
    lessons = [
        f"spot the main {chapter['title'].lower()} decision inside a time-pressured work scenario",
        f"apply {chapter['title'].lower()} when a school team is confused or misaligned",
        f"use {chapter['title'].lower()} to break a personal avoidance loop",
        f"show the failure mode when {chapter['title'].lower()} is ignored at work",
        f"teach the difference between surface compliance and real ownership in a school setting",
        f"show what changes after a leader applies {chapter['title'].lower()} consistently",
    ]
    return [
        {
            "slot": slot + 1,
            "format": formats[slot],
            "category": categories[slot],
            "endingType": endings[slot],
            "lesson": lessons[slot],
        }
        for slot in range(6)
    ]


def build_plan() -> dict:
    chapters = []
    chapter_order = []
    waves = DATA["chapterSettings"]["waves"]
    wave_lookup: dict[int, int] = {}
    for wave in waves:
        for number in wave["chapters"]:
            wave_lookup[number] = wave["wave"]

    for idx, raw in enumerate(copy.deepcopy(DATA["chapters"])):
        chapter = raw
        chapter["chapterId"] = chapter_id(chapter["number"])
        chapter["normalizedTitle"] = slugify(chapter["title"].replace('"', ""))
        chapter["wave"] = wave_lookup[chapter["number"]]
        chapter["nameSet"] = DATA["nameSets"][idx]
        chapter["schoolSetting"] = DATA["schoolSettings"][idx]
        chapter["assignments"] = build_assignments(chapter)
        chapter["bannedNames"] = GLOBAL_BANNED_NAMES
        chapter["bannedOpeners"] = GLOBAL_BANNED_OPENERS
        chapter["vocabularyWatchlist"] = GLOBAL_VOCAB_WATCHLIST
        chapter["sourceSidecarJson"] = f"{RUN_ROOT_REL}/sidecars/source/{chapter['chapterId']}.source.json"
        chapter["sourceSidecarTxt"] = f"{RUN_ROOT_REL}/sidecars/source/{chapter['chapterId']}.source.txt"
        chapter["ticketPath"] = f"{RUN_ROOT_REL}/tickets/{chapter['chapterId']}.ticket.md"
        chapter["outputs"] = {
            "brief": f"{RUN_ROOT_REL}/briefs/{chapter['chapterId']}.md",
            "outline": f"{RUN_ROOT_REL}/outlines/{chapter['chapterId']}.md",
            "quiz_blueprint": f"{RUN_ROOT_REL}/quiz-blueprints/{chapter['chapterId']}.md",
            "canonical_draft": f"{RUN_ROOT_REL}/drafts/canonical/{chapter['chapterId']}.md",
            "edited_draft": f"{RUN_ROOT_REL}/drafts/edited/{chapter['chapterId']}.md",
            "critic_report": f"{RUN_ROOT_REL}/reports/{chapter['chapterId']}.critic.md",
            "structured": f"{RUN_ROOT_REL}/structured/{chapter['chapterId']}.chapter.json",
            "quiz": f"{RUN_ROOT_REL}/quizzes/{chapter['chapterId']}.quiz.json",
            "validated": f"{RUN_ROOT_REL}/validated/{chapter['chapterId']}.chapter.json",
            "review_package": f"{RUN_ROOT_REL}/validated/{chapter['chapterId']}.review-package.json",
            "validation_report": f"{RUN_ROOT_REL}/reports/{chapter['chapterId']}.validation.md",
            "reading_metrics": f"{RUN_ROOT_REL}/reports/{chapter['chapterId']}.reading-metrics.json",
            "patch_report": f"{RUN_ROOT_REL}/reports/{chapter['chapterId']}.patch.md",
            "repair_report": f"{RUN_ROOT_REL}/reports/{chapter['chapterId']}.repair.md",
            "commit_record": f"{RUN_ROOT_REL}/commits/{chapter['chapterId']}.commit.json",
        }
        chapters.append(chapter)
        chapter_order.append(
            {
                "number": chapter["number"],
                "title": chapter["title"],
                "type": chapter["type"],
            }
        )

    return {
        "book": BOOK,
        "canonicalFormats": FORMAT_ORDER,
        "canonicalEndings": ENDING_ORDER,
        "chapterOrder": chapter_order,
        "premiumCandidates": DATA["chapterSettings"]["premiumCandidates"],
        "waves": DATA["chapterSettings"]["waves"],
        "chapters": chapters,
    }


def build_run_log(plan: dict) -> str:
    premium = ", ".join(f"`ch{number:02d}`" for number in plan["premiumCandidates"])
    wave_lines = []
    for wave in plan["waves"]:
        members = ", ".join(f"`ch{number:02d}`" for number in wave["chapters"])
        wave_lines.append(f"- Wave {wave['wave']} ({wave['lane']}): {members}")
    return textwrap.dedent(
        f"""
        # Run Log

        - Run root: `{RUN_ROOT_REL}`
        - Pack root: `scripts/book/prompts/chapterflow-v17-director-worker`
        - Book: *{BOOK['title']}* by {BOOK['author']}
        - Run started: `{NOW}`

        ## Phase 0

        - Manifest confirmed.
        - Locked public contract:
          - `outputProfile=flagship_v4_compatible`
          - `learningContract=research_native`
          - `runProfile=director_workers_balanced`
          - `validationMode=chapter_gate`
          - `chapterGateQuizMode=generate`
          - `scenarioTonePolicy=required`
          - `sourceDiscoveryMode=web_first`
          - `waveDefaultWidth=6`
          - `forbidBulkGenerators=true`
          - `releaseAssembleFromValidatedOnly=true`
          - `preserveCommittedHashes=true`
          - `coverPolicy=manual_user_supplied_none_generated`
          - `askOnlyOnMaterialEditionAmbiguity=true`
        - Sibling runs under `.chapterflow/runs/the hard thing about hard things/*` are treated as stale and non-authoritative.
        - No human gate policy confirmed.
        - Phase 0 complete.

        ## Phase 1

        - Source discovery frozen against the 2014 HarperBusiness first edition, ISBN `9780062273208`.
        - Canonical run map locked to 10 chapters: the introduction plus printed Chapters 1-9.
        - Excluded from the numbered queue: {", ".join(DATA['sourceFreeze']['excludedSections'])}.

        ## Phase 2

        - Pack rules compressed into run-local memory cards and role cards.

        ## Phase 3

        - Whole-book skeleton written from the frozen chapter map.
        {chr(10).join(wave_lines)}
        - Premium/downshift candidates seeded as {premium}.
        - Calibration wave packets prepared for `ch01` and `ch02`.
        """
    ).strip()


def build_continuity(plan: dict, locked: bool) -> dict:
    return {
        "bookId": BOOK["bookId"],
        "runId": BOOK["runId"],
        "title": BOOK["title"],
        "author": BOOK["author"],
        "sourceFreeze": {
            "status": "locked" if locked else "unlocked",
            "lockedAt": NOW if locked else None,
            "materialAmbiguity": False,
            "editionAnchor": {
                "editionName": BOOK["edition"]["name"],
                "publisher": BOOK["edition"]["publisher"],
                "publishedYear": BOOK["edition"]["publishedYear"],
                "isbn13": BOOK["edition"]["isbn13"],
                "language": "English",
                "region": "US",
            },
            "sourceRefs": [ref["id"] for ref in SOURCE_REFS],
        },
        "chapterOrder": plan["chapterOrder"],
        "waves": [{"wave": wave["wave"], "chapters": wave["chapters"], "status": "queued"} for wave in plan["waves"]],
        "validatedChapterHashes": {},
        "nameUsage": {},
        "formatCategoryHistory": [],
        "schoolSettingUsage": {},
        "wordFrequency": {},
        "phraseFrequency": {},
        "openerRegistry": {"gentle": {}, "direct": {}, "competitive": {}},
        "titleTemplateRegistry": {},
        "endingPatternRegistry": {},
        "withinChapterNames": {},
        "approvedChapterHashes": {},
        "baselineQuality": {},
    }


def build_edition_lock() -> dict:
    return {
        "bookId": BOOK["bookId"],
        "runId": BOOK["runId"],
        "lockedAt": NOW,
        "materialAmbiguity": False,
        "decision": {
            "editionName": BOOK["edition"]["name"],
            "publisher": BOOK["edition"]["publisher"],
            "publishedDate": BOOK["edition"]["publishedDate"],
            "publishedYear": BOOK["edition"]["publishedYear"],
            "isbn13": BOOK["edition"]["isbn13"],
            "language": "English",
            "region": "US",
        },
        "reasoning": DATA["sourceFreeze"]["reasoning"],
        "sourceRefs": [
            "src-openlibrary-2014-first-ed",
            "src-google-books-2014",
            "src-icpl-contents",
            "src-semantic-foundation-contents",
        ],
    }


def build_source_ledger() -> dict:
    return {
        "bookId": BOOK["bookId"],
        "runId": BOOK["runId"],
        "createdAt": NOW,
        "sourcePolicy": DATA["sourceFreeze"]["sourcePolicy"],
        "lockedEdition": DATA["sourceFreeze"]["lockedEditionLabel"],
        "sources": SOURCE_REFS,
    }


def build_source_bundle(plan: dict) -> str:
    chapter_lines = [
        f"- `ch{chapter['number']:02d}` — {chapter['title']} ({chapter['part']}; richness `{chapter['richness']}`)"
        for chapter in plan["chapters"]
    ]
    source_lines = [f"- `{ref['id']}`: [{ref['label']}]({ref['url']}) — {ref['notes']}" for ref in SOURCE_REFS]
    excluded_lines = [f"- {item}" for item in DATA["sourceFreeze"]["excludedSections"]]
    return textwrap.dedent(
        f"""
        # Source Bundle

        This frozen bundle is the factual authority for the run rooted at `{RUN_ROOT_REL}`.

        ## Locked edition

        - Title: *{BOOK['title']}*
        - Author: {BOOK['author']}
        - Canonical edition: {DATA['sourceFreeze']['lockedEditionLabel']}
        - Reason for locking this edition: the available bibliographic and contents records align on the same introduction plus nine printed chapters, with no material translation or edition split.

        ## Chapter map locked for this run

        {chr(10).join(chapter_lines)}

        Excluded from the numbered run queue:
        {chr(10).join(excluded_lines)}

        ## Frozen sources

        {chr(10).join(source_lines)}

        ## Source policy

        - Paraphrase first.
        - Use primary metadata sources for edition and chapter-map authority.
        - Use narrow secondary summaries only to support chapter-level framing and anchor selection.
        - Do not switch source families later in the run without rewriting the freeze artifacts.
        """
    ).strip()


def build_source_discovery() -> str:
    reasoning = "\n".join(f"- {item}" for item in DATA["sourceFreeze"]["reasoning"])
    return textwrap.dedent(
        f"""
        # Source Discovery

        Discovery date: `{NOW}`

        ## Decision

        {DATA['sourceFreeze']['decisionSummary']}

        ## Why this is safe

        {reasoning}

        ## Material ambiguity

        - `materialAmbiguity=false`
        - No user question required.

        ## Outputs written from this freeze

        - `source-freeze/edition-lock.json`
        - `source-freeze/source-ledger.json`
        - `source-freeze/source-bundle.md`
        - `source-freeze/toc.json`
        - `sidecars/source-heading-index.json`
        - `sidecars/source/chXX.source.json`
        - `sidecars/source/chXX.source.txt`
        """
    ).strip()


def build_toc(plan: dict) -> dict:
    return {
        "bookId": BOOK["bookId"],
        "runId": BOOK["runId"],
        "lockedEdition": DATA["sourceFreeze"]["lockedEditionLabel"],
        "sourceRefs": [
            "src-openlibrary-2014-first-ed",
            "src-google-books-2014",
            "src-icpl-contents",
            "src-semantic-foundation-contents",
        ],
        "chapters": [
            {
                "number": chapter["number"],
                "type": chapter["type"],
                "part": chapter["part"],
                "title": chapter["title"],
                "normalizedTitle": chapter["normalizedTitle"],
            }
            for chapter in plan["chapters"]
        ],
    }


def build_heading_index(plan: dict) -> dict:
    return {
        "bookId": BOOK["bookId"],
        "runId": BOOK["runId"],
        "headings": [
            {
                "chapterId": chapter["chapterId"],
                "number": chapter["number"],
                "heading": chapter["title"],
                "part": chapter["part"],
                "richness": chapter["richness"],
                "sourceRefs": chapter["sourceRefs"],
            }
            for chapter in plan["chapters"]
        ],
    }


def build_source_sidecar_json(chapter: dict) -> dict:
    return {
        "chapterId": chapter["chapterId"],
        "number": chapter["number"],
        "title": chapter["title"],
        "part": chapter["part"],
        "richness": chapter["richness"],
        "sourceRefs": chapter["sourceRefs"],
        "canonicalEdition": {
            "name": BOOK["edition"]["name"],
            "publisher": BOOK["edition"]["publisher"],
            "publishedDate": BOOK["edition"]["publishedDate"],
            "publishedYear": BOOK["edition"]["publishedYear"],
            "isbn13": BOOK["edition"]["isbn13"],
            "format": BOOK["edition"]["format"],
            "sourceText": BOOK["edition"]["sourceText"],
            "sourceProvenance": BOOK["edition"]["sourceProvenance"],
        },
        "quotePosture": "paraphrase_first",
        "anchorSummary": chapter["summary"],
        "coreClaim": chapter["coreClaim"],
        "distinctMechanism": chapter["mechanism"],
        "requiredAnchors": chapter["anchors"],
        "specificApplications": chapter["applications"],
        "commonMisreadings": chapter["misreadings"],
        "hardEdgeRequirement": chapter["hardEdge"],
        "thresholdQuestion": chapter["thresholdQuestion"],
    }


def build_source_sidecar_txt(chapter: dict) -> str:
    return textwrap.dedent(
        f"""
        # Source Sidecar

        Chapter: {chapter['chapterId']} — {chapter['title']}
        Part: {chapter['part']}
        Richness: {chapter['richness']}
        Source IDs: {", ".join(chapter['sourceRefs'])}
        Canonical edition: {DATA['sourceFreeze']['lockedEditionLabel']}
        Quote posture: paraphrase_first

        Core claim:
        - {chapter['coreClaim']}

        Distinct mechanism:
        - {chapter['mechanism']}

        Required anchors:
        {chr(10).join(f"- {item}" for item in chapter['anchors'])}

        Common misreadings:
        {chr(10).join(f"- {item}" for item in chapter['misreadings'])}

        Specific applications:
        {chr(10).join(f"- {item}" for item in chapter['applications'])}

        Hard-edge requirement:
        - {chapter['hardEdge']}

        Threshold question:
        - {chapter['thresholdQuestion']}
        """
    ).strip()


def build_style_memory() -> str:
    return textwrap.dedent(
        """
        # Style Memory

        - Reader-facing prose stays concrete, source-bound, and chapter-specific.
        - Open with pressure, conflict, or a decision rather than a thesis-first summary.
        - Keep tone variants functionally distinct:
          - `gentle` lowers resistance without drifting into therapy language.
          - `direct` carries the analytical load cleanly.
          - `competitive` sharpens stakes without swagger or macho inflation.
        - Avoid filler and internal prompt leakage.
        - Prefer named people, immediate pressure, and explicit tradeoffs over abstract startup cliches.
        - Hard mode must add a real boundary, contradiction, or failure mode instead of merely adding words.
        - Examples begin in concrete scenes and end with a distinct lesson.
        - No em dashes.
        - Avoid generic self-help vocabulary like `mindset`, `unlock`, `journey`, `game-changer`, and `navigate`.
        """
    ).strip()


def build_quality_memory() -> str:
    return textwrap.dedent(
        """
        # Quality Memory

        - Every chapter must be unmistakably specific to its principle.
        - Critic floor: no generic breakdowns, no tone collapse, no chapter-generic startup advice.
        - Scenario tone objects must stay distinct across `gentle`, `direct`, and `competitive`.
        - `moreDetails` explain mechanism, nuance, or limitation; they are not mini-vignettes.
        - Keep contamination phrases, prompt leakage, and source-splice language out of reader-facing fields.
        - Concrete examples must carry a real decision, pressure, or consequence.
        - Preserve the book's practical operator voice: truth, accountability, hiring, culture, cash, and tradeoff.
        - The introduction and Chapter 1 are calibration chapters for later drift control.
        """
    ).strip()


def build_schema_memory() -> str:
    return textwrap.dedent(
        """
        # Schema Memory

        - Public chapter contract remains EMH.
        - `contentVariants.easy.chapterBreakdown` is a tone object with 140-175 words per tone.
        - `contentVariants.medium.chapterBreakdown` is a tone object with 330-420 words per tone.
        - `contentVariants.hard.chapterBreakdown` is a tone object with 490-600 words per tone.
        - Easy: exactly 3 takeaways, no `moreDetails`, no activation/self-check/prediction extras, flat `oneMinuteRecap`.
        - Medium: 5-6 takeaways, `moreDetails` required, `activationPrompt`, singular `selfCheckPrompt`, structured recap.
        - Hard: 5-7 takeaways, `moreDetails` required, `activationPrompt`, exactly 2 `selfCheckPrompts`, `predictionPrompt`, structured recap.
        - Exactly 6 examples per chapter, one of each canonical format, one of each ending type, category distribution 2 work / 2 school / 2 personal.
        - `scenario`, `whatToDo`, and `whyItMatters` are tone objects.
        - Quiz: object with `passingScorePercent` and exactly 10 questions, 3 choices each, explanation tone object, valid `correctIndex`.
        - Implementation plan: tone-object `coreSkill`, 3 contextual `ifThenPlans`, tone-object `twentyFourHourChallenge`, tone-object `weeklyPractice`.
        - Review cards: exactly 5 with difficulty distribution 2 easy / 2 medium / 1 hard.
        - `keyTakeawayCard` is a tone object.
        - Release package is assembled from committed validated chapter JSON only.
        """
    ).strip()


def build_learning_memory() -> str:
    return textwrap.dedent(
        """
        # Learning Memory

        - Quiz questions test mechanism and application, not trivia.
        - Quiz explanations teach why the correct answer fits the chapter principle.
        - Medium activation prompts ask for immediate use, not chapter summary.
        - Medium self-check prompts are questions, not statements.
        - Hard self-check prompts come in two distinct tone-object slots.
        - Hard prediction prompts must ask the reader to anticipate the next move or consequence, not tease the next chapter vaguely.
        - Structured recap:
          - `retrieve` demands recall.
          - `connect` links the principle to mechanism or tradeoff.
          - `preview` opens the next question or adjacent principle.
        - Review cards test applied recall and transfer, not just quote memory.
        """
    ).strip()


def build_skeleton(plan: dict) -> str:
    chapter_sections = []
    for chapter in plan["chapters"]:
        premium = "high" if chapter["premium"] else "low"
        chapter_sections.append(
            textwrap.dedent(
                f"""
                {chapter['number']}. `{chapter['title']}`
                   - intent: {chapter['intent']}
                   - source richness: {chapter['richness']}
                   - concept density: {chapter['conceptDensity']}
                   - moral complexity: {chapter['moralComplexity']}
                   - premium-routing risk: {premium}
                """
            ).strip()
        )
    premium_lines = [f"- `ch{number:02d}`" for number in plan["premiumCandidates"]]
    return textwrap.dedent(
        f"""
        # Book Skeleton

        ## Metadata

        - Title: *{BOOK['title']}*
        - Author: {BOOK['author']}
        - Book ID: `{BOOK['bookId']}`
        - Run ID: `{BOOK['runId']}`
        - Edition anchor: {DATA['sourceFreeze']['lockedEditionLabel']}
        - Frozen chapter count: {len(plan['chapters'])}

        ## Chapter Order And Intent

        {chr(10).join(chapter_sections)}

        ## Rotation Plan For Examples

        - Use the six canonical formats exactly once per chapter:
          - `decision_point`
          - `postmortem`
          - `dialogue`
          - `predict_reveal`
          - `dilemma`
          - `before_after`
        - Use the six ending types exactly once per chapter:
          - `broader_principle`
          - `self_directed_question`
          - `surprising_implication`
          - `cross_domain`
          - `common_trap`
          - `perspective_reframe`
        - Keep category distribution at 2 `work`, 2 `school`, and 2 `personal`.

        ## School-Setting Plan

        - Rotate through: {", ".join(DATA['schoolSettings'])}

        ## Vocabulary Watchlist

        - Avoid {", ".join(f"`{item}`" for item in GLOBAL_VOCAB_WATCHLIST)} and generic startup-cliche language.
        - Keep terms operational: `cash`, `truth`, `people`, `product`, `profit`, `culture`, `decision`, `tradeoff`.

        ## Premium-Routing Candidates

        {chr(10).join(premium_lines)}
        """
    ).strip()


def build_wave_queue(plan: dict) -> dict:
    return {
        "bookId": BOOK["bookId"],
        "runId": BOOK["runId"],
        "createdAt": NOW,
        "defaultWaveWidth": 6,
        "premiumCandidates": plan["premiumCandidates"],
        "waves": plan["waves"],
    }


def ticket_text(chapter: dict, plan: dict, calibration_exists: bool) -> str:
    prev_title = next((item["title"] for item in plan["chapters"] if item["number"] == chapter["number"] - 1), "None")
    next_title = next((item["title"] for item in plan["chapters"] if item["number"] == chapter["number"] + 1), "End of book")
    allowed_quotes = "\n".join(f"- {item}" for item in chapter["allowedQuotes"])
    misreadings = "\n".join(f"- {item}" for item in chapter["misreadings"])
    assignment_lines = "\n".join(
        f"- Scenario {item['slot']}: {item['format']} / {item['category']} / {item['endingType']} -> {item['lesson']}"
        for item in chapter["assignments"]
    )
    calibration_line = (
        f"- Calibration lock: `{RUN_ROOT_REL}/state/calibration-lock.json`"
        if calibration_exists
        else "- Calibration lock: not yet created; calibration wave packet"
    )
    return "\n".join(
        [
            "# Chapter Ticket",
            "",
            f"Ticket ID: {chapter['chapterId']}-wave-{chapter['wave']}",
            f"Book: {BOOK['title']}",
            f"Author: {BOOK['author']}",
            f"Book ID: {BOOK['bookId']}",
            f"Run ID: {BOOK['runId']}",
            f"Wave: {chapter['wave']}",
            "",
            f"Chapter Number: {chapter['number']}",
            f"Chapter Title: {chapter['title']}",
            f"Source Richness Tier: {chapter['richness']}",
            f"Concept Budget: {chapter['conceptBudget']}",
            "",
            f"Source Sidecar Path: `{chapter['sourceSidecarJson']}`",
            "Allowed Source Scope: frozen source bundle plus this chapter sidecar only",
            f"Edition Lock: `{DATA['sourceFreeze']['lockedEditionLabel']}`",
            "",
            f"Core Claim: {chapter['coreClaim']}",
            f"Distinct Mechanism: {chapter['mechanism']}",
            "Required Anchors:",
            *[f"- {item}" for item in chapter["anchors"]],
            "",
            "Allowed Quotes or Near-Quotes:",
            *allowed_quotes.splitlines(),
            "",
            "Common Misreadings:",
            *misreadings.splitlines(),
            "",
            f"Limit / Moral Complexity: {chapter['moralNote']}",
            f"Hard-Edge Requirement: {chapter['hardEdge']}",
            f"Threshold Question: {chapter['thresholdQuestion']}",
            "",
            f"Previous Chapter Bridge: {prev_title}",
            f"Next Chapter Bridge: {next_title}",
            "",
            "Assigned Scenario Assets:",
            f"Primary Names: {', '.join(chapter['nameSet']['primary'])}",
            f"Secondary Names: {', '.join(chapter['nameSet']['secondary'])}",
            f"School Setting: {chapter['schoolSetting']}",
            "Format / Category Map:",
            *[f"- Scenario {item['slot']}: {item['format']} / {item['category']}" for item in chapter["assignments"]],
            "Ending Type Map:",
            *[f"- Scenario {item['slot']}: {item['endingType']}" for item in chapter["assignments"]],
            "Scenario Lesson Map:",
            *assignment_lines.splitlines(),
            "",
            f"Banned Names: {', '.join(chapter['bannedNames'][:6])}",
            f"Banned Opener Patterns: {', '.join(chapter['bannedOpeners'])}",
            f"Vocabulary Watchlist: {', '.join(chapter['vocabularyWatchlist'])}",
            "",
            "Grade-Band Targets:",
            "- Easy: grade 8-9, 140-175 words per tone",
            "- Medium: grade 10-11, 330-420 words per tone",
            "- Hard: grade 12, 490-600 words per tone with a real boundary or contradiction",
            "",
            "Acceptance Checks:",
            "- critic >= 10/12",
            "- no auto-fails",
            "- quiz populated",
            "- scenario tone objects",
            "- artifact guard passes",
            "",
            "Output Paths:",
            f"Brief: `{chapter['outputs']['brief']}`",
            f"Outline: `{chapter['outputs']['outline']}`",
            f"Quiz Blueprint: `{chapter['outputs']['quiz_blueprint']}`",
            f"Canonical Draft: `{chapter['outputs']['canonical_draft']}`",
            f"Edited Draft: `{chapter['outputs']['edited_draft']}`",
            f"Structured: `{chapter['outputs']['structured']}`",
            f"Quiz: `{chapter['outputs']['quiz']}`",
            f"Validated: `{chapter['outputs']['validated']}`",
            f"Review Package: `{chapter['outputs']['review_package']}`",
            f"Validation Report: `{chapter['outputs']['validation_report']}`",
            f"Patch Report: `{chapter['outputs']['patch_report']}`",
            f"Commit Record: `{chapter['outputs']['commit_record']}`",
            "",
            "Continuity / Calibration Notes:",
            f"- Continuity state: `{RUN_ROOT_REL}/continuity/continuity-state.json`",
            calibration_line,
            f"- Premium routing: {str(chapter['premium']).lower()}",
        ]
    ).strip()


def build_work_order(role: str, chapter: dict, calibration_exists: bool) -> str:
    role_card = f"{RUN_ROOT_REL}/memory/role-cards/{role}.md"
    ticket = chapter["ticketPath"]
    source_sidecar = chapter["sourceSidecarJson"]
    continuity = f"{RUN_ROOT_REL}/continuity/continuity-state.json"
    skeleton = f"{RUN_ROOT_REL}/skeleton/book-skeleton.md"
    calibration = f"{RUN_ROOT_REL}/state/calibration-lock.json"
    read_only = {
        "research": [
            role_card,
            f"{RUN_ROOT_REL}/memory/style-memory.md",
            f"{RUN_ROOT_REL}/memory/quality-memory.md",
            f"{RUN_ROOT_REL}/memory/learning-memory.md",
            skeleton,
            ticket,
            source_sidecar,
            continuity,
        ],
        "writer": [
            role_card,
            f"{RUN_ROOT_REL}/memory/style-memory.md",
            f"{RUN_ROOT_REL}/memory/quality-memory.md",
            ticket,
            chapter["outputs"]["brief"],
            chapter["outputs"]["outline"],
            source_sidecar,
        ],
        "editor": [
            role_card,
            f"{RUN_ROOT_REL}/memory/style-memory.md",
            f"{RUN_ROOT_REL}/memory/quality-memory.md",
            ticket,
            chapter["outputs"]["brief"],
            chapter["outputs"]["outline"],
            chapter["outputs"]["canonical_draft"],
        ],
        "critic": [
            role_card,
            f"{RUN_ROOT_REL}/memory/quality-memory.md",
            ticket,
            chapter["outputs"]["brief"],
            chapter["outputs"]["outline"],
            chapter["outputs"]["edited_draft"],
        ],
        "converter": [
            role_card,
            f"{RUN_ROOT_REL}/memory/schema-memory.md",
            f"{RUN_ROOT_REL}/memory/style-memory.md",
            ticket,
            chapter["outputs"]["brief"],
            chapter["outputs"]["outline"],
            chapter["outputs"]["edited_draft"],
        ],
        "quiz": [
            role_card,
            f"{RUN_ROOT_REL}/memory/schema-memory.md",
            f"{RUN_ROOT_REL}/memory/learning-memory.md",
            ticket,
            chapter["outputs"]["brief"],
            chapter["outputs"]["quiz_blueprint"],
            chapter["outputs"]["edited_draft"],
            chapter["outputs"]["structured"],
        ],
        "validator": [
            role_card,
            f"{RUN_ROOT_REL}/memory/schema-memory.md",
            f"{RUN_ROOT_REL}/memory/quality-memory.md",
            ticket,
            chapter["outputs"]["brief"],
            chapter["outputs"]["outline"],
            chapter["outputs"]["edited_draft"],
            chapter["outputs"]["structured"],
            chapter["outputs"]["quiz"],
            "scripts/book/validate-book.mjs",
        ],
        "patch": [
            role_card,
            ticket,
            chapter["outputs"]["structured"],
            chapter["outputs"]["quiz"],
            chapter["outputs"]["validation_report"],
            chapter["outputs"]["patch_report"],
        ],
    }
    if calibration_exists and role in {"research", "critic"}:
        read_only[role].append(calibration)
    write_only = {
        "research": [chapter["outputs"]["brief"], chapter["outputs"]["outline"], chapter["outputs"]["quiz_blueprint"]],
        "writer": [chapter["outputs"]["canonical_draft"]],
        "editor": [chapter["outputs"]["edited_draft"]],
        "critic": [chapter["outputs"]["critic_report"]],
        "converter": [chapter["outputs"]["structured"]],
        "quiz": [chapter["outputs"]["quiz"]],
        "validator": [
            chapter["outputs"]["validation_report"],
            chapter["outputs"]["validated"],
            chapter["outputs"]["review_package"],
            chapter["outputs"]["reading_metrics"],
            chapter["outputs"]["repair_report"],
        ],
        "patch": [
            chapter["outputs"]["structured"],
            chapter["outputs"]["quiz"],
            chapter["outputs"]["validated"],
            chapter["outputs"]["review_package"],
        ],
    }
    allowed_scope = {
        "research": "Build only the chapter packet. Use only frozen facts. Lock outline, anchors, and quiz blueprint before prose starts.",
        "writer": "Write the canonical draft only. Stay inside the ticket, brief, outline, and source sidecar.",
        "editor": "Edit the canonical draft for clarity, specificity, and flow without changing the chapter's factual scope.",
        "critic": "Audit for genericity, drift, tone collapse, lesson convergence, and missing hard-edge tension. Report only.",
        "converter": "Convert the edited draft into valid EMH JSON without inventing unsupported facts.",
        "quiz": "Write only the quiz JSON and keep questions chapter-specific, structural, and fully populated.",
        "validator": "Run mechanical validation, fix mechanical issues directly where safe, and write the validated chapter package plus reports.",
        "patch": "Patch only the exact failing fields called out by the report. Do not rewrite healthy sections.",
    }
    forbidden = {
        "research": "No reader-facing chapter prose. No JSON. No facts outside the frozen bundle.",
        "writer": "Do not edit other files or jump ahead to JSON conversion, quiz, or validation.",
        "editor": "Do not add unsupported facts or rewrite the chapter into a different principle.",
        "critic": "Do not rewrite the chapter. Do not create new reader-facing output.",
        "converter": "Do not invent facts, collapse tone objects, or use plain strings where tone objects are required.",
        "quiz": "Do not leave empty question arrays, duplicate explanation tones, or use unsupported facts.",
        "validator": "Do not flatten prose into generic compliance text to force a pass. Write a repair report if prose quality blocks validation.",
        "patch": "Do not broaden scope beyond the exact flagged artifact and field list.",
    }
    done = {
        "research": "Brief, outline, and quiz blueprint are written and specific enough that later workers do not need outside context.",
        "writer": "Canonical draft is written at the target specificity level and aligned to the outline.",
        "editor": "Edited draft is clean, specific, and ready for critique.",
        "critic": "Critic report scores the chapter, names exact issues, and distinguishes local from global reroute risk.",
        "converter": "Structured chapter JSON parses and satisfies the schema contract.",
        "quiz": "Quiz JSON has exactly 10 populated questions with 3 choices each and explanation tone objects.",
        "validator": "Validation report, validated chapter JSON, review package JSON, and reading metrics sidecar are all written.",
        "patch": "Only the exact flagged fields are patched and the output artifact remains valid JSON or markdown.",
    }
    return "\n".join(
        [
            "# Work Order",
            "",
            f"Role: {role}",
            f"Chapter: {chapter['chapterId']} — {chapter['title']}",
            f"Ticket Path: `{ticket}`",
            "",
            "Read only:",
            *[f"- `{item}`" for item in read_only[role]],
            "",
            "Write only:",
            *[f"- `{item}`" for item in write_only[role]],
            "",
            f"Allowed scope: {allowed_scope[role]}",
            f"Forbidden actions: {forbidden[role]}",
            f"Done criteria: {done[role]}",
        ]
    ).strip()


def build_wave_packets(chapter_numbers: list[int], plan_override: dict | None = None) -> None:
    plan = plan_override or json.loads((RUN_ROOT / "state/book-plan.json").read_text(encoding="utf-8"))
    calibration_exists = (RUN_ROOT / "state/calibration-lock.json").exists()
    chapter_map = {chapter["number"]: chapter for chapter in plan["chapters"]}
    for number in chapter_numbers:
        chapter = chapter_map[number]
        write_text(RUN_ROOT / f"tickets/{chapter['chapterId']}.ticket.md", ticket_text(chapter, plan, calibration_exists))
        for role in ["research", "writer", "editor", "critic", "converter", "quiz", "validator", "patch"]:
            write_text(
                RUN_ROOT / f"work-orders/{chapter['chapterId']}.{role}.md",
                build_work_order(role, chapter, calibration_exists),
            )
    if chapter_numbers:
        state = load_state()
        state["currentWave"] = next(chapter["wave"] for chapter in plan["chapters"] if chapter["number"] == chapter_numbers[0])
        state["queuedChapters"] = chapter_numbers
        state["currentState"] = "work_orders_ready"
        write_json(RUN_ROOT / "state/pipeline-state.json", state)


def bootstrap() -> None:
    plan = build_plan()
    for directory in [
        "manifests",
        "state",
        "memory",
        "memory/role-cards",
        "source-freeze",
        "sidecars",
        "sidecars/source",
        "skeleton",
        "briefs",
        "outlines",
        "quiz-blueprints",
        "tickets",
        "work-orders",
        "drafts/canonical",
        "drafts/edited",
        "structured",
        "quizzes",
        "validated",
        "continuity",
        "commits",
        "reports",
        "release",
    ]:
        (RUN_ROOT / directory).mkdir(parents=True, exist_ok=True)

    role_map = {
        "research": PACK_ROOT / "roles/research-card.md",
        "writer": PACK_ROOT / "roles/writer-card.md",
        "editor": PACK_ROOT / "roles/editor-card.md",
        "critic": PACK_ROOT / "roles/critic-card.md",
        "converter": PACK_ROOT / "roles/converter-card.md",
        "quiz": PACK_ROOT / "roles/quiz-card.md",
        "validator": PACK_ROOT / "roles/validator-card.md",
        "patch": PACK_ROOT / "roles/patch-card.md",
    }
    for role, src in role_map.items():
        shutil.copyfile(src, RUN_ROOT / "memory/role-cards" / f"{role}.md")

    write_json(RUN_ROOT / "state/book-plan.json", plan)
    write_text(RUN_ROOT / "reports/run-log.md", build_run_log(plan))
    write_json(RUN_ROOT / "continuity/continuity-state.json", build_continuity(plan, locked=True))
    write_json(RUN_ROOT / "source-freeze/edition-lock.json", build_edition_lock())
    write_json(RUN_ROOT / "source-freeze/source-ledger.json", build_source_ledger())
    write_text(RUN_ROOT / "source-freeze/source-bundle.md", build_source_bundle(plan))
    write_text(RUN_ROOT / "source-freeze/source-discovery.md", build_source_discovery())
    write_json(RUN_ROOT / "source-freeze/toc.json", build_toc(plan))
    write_json(RUN_ROOT / "sidecars/source-heading-index.json", build_heading_index(plan))
    for chapter in plan["chapters"]:
        write_json(RUN_ROOT / f"sidecars/source/{chapter['chapterId']}.source.json", build_source_sidecar_json(chapter))
        write_text(RUN_ROOT / f"sidecars/source/{chapter['chapterId']}.source.txt", build_source_sidecar_txt(chapter))
    write_text(RUN_ROOT / "memory/style-memory.md", build_style_memory())
    write_text(RUN_ROOT / "memory/quality-memory.md", build_quality_memory())
    write_text(RUN_ROOT / "memory/schema-memory.md", build_schema_memory())
    write_text(RUN_ROOT / "memory/learning-memory.md", build_learning_memory())
    write_text(RUN_ROOT / "skeleton/book-skeleton.md", build_skeleton(plan))
    write_json(RUN_ROOT / "state/wave-queue.json", build_wave_queue(plan))
    state = load_state()
    state.update(
        {
            "currentState": "work_orders_ready",
            "completedChapters": [],
            "currentWave": 1,
            "queuedChapters": [1, 2],
            "committedHashes": {},
            "calibrationLocked": False,
            "sourceFreezeLocked": True,
            "releaseAssembled": False,
            "releaseValidated": False,
        }
    )
    write_json(RUN_ROOT / "state/pipeline-state.json", state)
    build_wave_packets([1, 2], plan_override=plan)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap and packetize the v17 run for The Hard Thing About Hard Things.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("bootstrap")
    wave = subparsers.add_parser("build-wave-packets")
    wave.add_argument("chapters", nargs="+", type=int)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.command == "bootstrap":
        bootstrap()
        return
    if args.command == "build-wave-packets":
        build_wave_packets(args.chapters)
        return
    raise RuntimeError(f"Unknown command: {args.command}")


if __name__ == "__main__":
    main()
