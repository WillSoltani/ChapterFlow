#!/usr/bin/env python3
import copy
import json
import re
from pathlib import Path

from chapterflow_v13_good_strategy_bad_strategy_profiles import CHAPTER_SUPPORT_PROFILES

BOOK_ID = "good-strategy-bad-strategy"
CLEAN_TITLE = "Good Strategy / Bad Strategy"
CLEAN_AUTHOR = "Richard Rumelt"
DEFAULT_CHAPTER_RANGE = "1-17"
DEFAULT_CATEGORIES = ["Strategy", "Business", "Management", "Decision Making"]
DEFAULT_TAGS = [
    "diagnosis",
    "coherent-action",
    "leverage",
    "proximate-objectives",
    "dynamics",
    "design",
    "inertia",
    "entropy",
]
TONE_KEYS = ("gentle", "direct", "competitive")
CONTEXTS = ("work", "school", "personal")
REVIEW_CARD_DIFFICULTIES = ("easy", "easy", "medium", "medium", "hard")
REVIEW_CARD_FRONTS = (
    {
        "gentle": "What mechanism does this chapter teach?",
        "direct": "What strategic mechanism drives this chapter?",
        "competitive": "What force actually does the work here?",
    },
    {
        "gentle": "What distinction matters most in this chapter?",
        "direct": "What confusion does this chapter cut apart?",
        "competitive": "What line cannot be blurred here?",
    },
    {
        "gentle": "How should you read a live case through this chapter?",
        "direct": "On a live case, what should you inspect first?",
        "competitive": "Where does this chapter tell you to put the knife?",
    },
    {
        "gentle": "What is this chapter not telling you to do?",
        "direct": "What would be a bad overreading of this chapter?",
        "competitive": "What false lesson does this chapter reject?",
    },
    {
        "gentle": "What rule should carry forward from this chapter?",
        "direct": "What transfer rule should survive into the next decision?",
        "competitive": "What should still be true one chapter later?",
    },
)
BROKEN_REVIEW_CARD_FRAGMENTS = (
    "??",
    "the mechanism is ",
    "the distinction is ",
    "miss the mechanism",
    "blur this line",
    "what is this chapter not telling you to do??",
)
BROKEN_IMPLEMENTATION_FRAGMENTS = (
    "??",
    "If leads ",
    "If has to ",
    "If asks ",
    "If deck shows ",
    "then the team to ",
    "then the move by ",
    "then the next ",
)

BOOK_VOICE_BANNED_PHRASES = (
    "leadership journey",
    "visionary leader",
    "startup hustle",
    "product management",
    "product-manager",
    "north star metric",
    "move fast and break things",
    "crush it",
    "10x",
    "dream big",
    "inspirational journey",
    "founder energy",
)


def meta_text(value):
    return str(value or "").replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'").strip()


def norm(value):
    text = meta_text(value).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text


def normalize_spaces(value):
    return re.sub(r"\s+", " ", meta_text(value)).strip()


def ensure_sentence(text):
    text = normalize_spaces(text)
    if not text:
        return text
    if text[-1] not in ".!?":
        return text + "."
    return text


def ensure_question(text):
    text = normalize_spaces(text).rstrip(".?!")
    if not text:
        return text
    return text + "?"


def lower_first(text):
    text = normalize_spaces(text)
    if not text:
        return text
    return text[:1].lower() + text[1:]


def strip_terminal_punct(text):
    return normalize_spaces(text).rstrip(".!?")


def is_tone_object(value):
    return isinstance(value, dict) and set(value.keys()) == set(TONE_KEYS) and all(
        isinstance(value.get(tone), str) and value.get(tone).strip() for tone in TONE_KEYS
    )


def normalize_book_id(value):
    return norm(value)


def is_book_id(value):
    return normalize_book_id(value) == BOOK_ID


def is_good_strategy_bad_strategy_book(book):
    if not isinstance(book, dict):
        return False
    book_id = normalize_book_id(book.get("bookId", ""))
    title = normalize_book_id(book.get("title", ""))
    author = normalize_book_id(book.get("author", ""))
    return (
        book_id == BOOK_ID
        or title in {"good-strategy-bad-strategy", "good-strategy-bad-strategy-the-difference-and-why-it-matters", "good-strategy-bad-strategy"}
        or author == "richard-rumelt"
    )


def is_good_strategy_bad_strategy_data(data, source_path=None):
    if isinstance(data, dict):
        if is_book_id(data.get("bookId", "")):
            return True
        for key in ("book", "bookRequest"):
            if is_good_strategy_bad_strategy_book(data.get(key)):
                return True
    source_norm = norm(str(source_path or ""))
    return BOOK_ID in source_norm or "good-strategy-bad-strategy" in source_norm


def compute_chapter_numbers_from_chapters(chapters):
    numbers = []
    for chapter in chapters or []:
        if isinstance(chapter, dict) and isinstance(chapter.get("number"), int):
            numbers.append(chapter["number"])
    return sorted(set(numbers))


def compute_chapter_range(chapter_numbers=None):
    numbers = sorted(set(chapter_numbers or []))
    if not numbers:
        return DEFAULT_CHAPTER_RANGE
    return f"{numbers[0]}-{numbers[-1]}"


def review_package_chapter_range(number):
    return f"Chapter {number} review package only"


def normalized_book_metadata(book, chapter_numbers=None, chapter_range=None):
    base = copy.deepcopy(book) if isinstance(book, dict) else {}
    edition = copy.deepcopy(base.get("edition")) if isinstance(base.get("edition"), dict) else {}
    normalized = copy.deepcopy(base)
    normalized["bookId"] = BOOK_ID
    normalized["title"] = CLEAN_TITLE
    normalized["author"] = CLEAN_AUTHOR
    categories = base.get("categories")
    tags = base.get("tags")
    normalized["categories"] = categories if isinstance(categories, list) and categories else list(DEFAULT_CATEGORIES)
    normalized["tags"] = tags if isinstance(tags, list) and tags else list(DEFAULT_TAGS)
    normalized["edition"] = {
        "name": normalize_spaces(edition.get("name")),
        "translator": normalize_spaces(edition.get("translator")),
        "publishedYear": edition.get("publishedYear"),
        "translationYear": edition.get("translationYear"),
        "sourceText": normalize_spaces(edition.get("sourceText")),
        "sourceProvenance": normalize_spaces(edition.get("sourceProvenance")),
    }
    normalized["variantFamily"] = "EMH"
    normalized["chapterRange"] = chapter_range or compute_chapter_range(chapter_numbers)
    return normalized


def metadata_failures(book, chapter_range_required=True, expected_chapter_range=None):
    fails = []
    if not isinstance(book, dict):
        return ["good-strategy-bad-strategy book metadata missing or malformed"]
    raw_title = str(book.get("title", ""))
    raw_author = str(book.get("author", ""))
    title = normalize_spaces(book.get("title"))
    author = normalize_spaces(book.get("author"))
    if title != CLEAN_TITLE:
        fails.append("good-strategy-bad-strategy title metadata is not normalized")
    if author != CLEAN_AUTHOR:
        fails.append("good-strategy-bad-strategy author metadata is not normalized")
    if re.search(r"[“”‘’]", raw_title + raw_author):
        fails.append("good-strategy-bad-strategy metadata still contains decorative quotes")
    if "good-strategy-bad-strategy" in raw_title.lower():
        fails.append("good-strategy-bad-strategy title still contains hyphen-stitched corruption")
    if "richard-rumelt" in raw_author.lower():
        fails.append("good-strategy-bad-strategy author still contains hyphen-stitched corruption")
    if chapter_range_required:
        expected = normalize_spaces(expected_chapter_range or DEFAULT_CHAPTER_RANGE)
        if normalize_spaces(book.get("chapterRange")) != expected:
            fails.append(f"good-strategy-bad-strategy chapterRange must be populated as {expected}")
    if book.get("variantFamily") != "EMH":
        fails.append("good-strategy-bad-strategy variantFamily must equal EMH")
    edition = book.get("edition", {})
    if not isinstance(edition, dict) or not normalize_spaces(edition.get("name")):
        fails.append("good-strategy-bad-strategy edition.name missing")
    if not isinstance(edition, dict) or not normalize_spaces(edition.get("sourceText")):
        fails.append("good-strategy-bad-strategy edition.sourceText missing")
    if not isinstance(edition, dict) or not normalize_spaces(edition.get("sourceProvenance")):
        fails.append("good-strategy-bad-strategy edition.sourceProvenance missing")
    if not isinstance(edition, dict) or not edition.get("publishedYear"):
        fails.append("good-strategy-bad-strategy edition.publishedYear missing")
    return fails


def review_card_style(chapter):
    cards = chapter.get("reviewCards", [])
    if not isinstance(cards, list) or not cards:
        return "missing"
    keys = set(cards[0].keys()) if isinstance(cards[0], dict) else set()
    if {"cardId", "difficulty", "front", "back"} <= keys:
        return "rich"
    if {"cardId", "level", "prompt", "answer"} <= keys:
        return "flat"
    return "unknown"


def implementation_plan_style(chapter):
    plan = chapter.get("implementationPlan")
    if not isinstance(plan, dict):
        return "missing"
    keys = set(plan.keys())
    if {"coreSkill", "ifThenPlans", "twentyFourHourChallenge", "weeklyPractice"} <= keys:
        return "rich"
    if keys == set(TONE_KEYS):
        return "thin"
    return "unknown"


def review_card_failures(chapter):
    fails = []
    style = review_card_style(chapter)
    cards = chapter.get("reviewCards", [])
    number = chapter.get("number", "?")
    if style == "flat":
        fails.append(f"ch{number}: flattened reviewCards fallback shell is not allowed for good-strategy-bad-strategy")
        return fails
    if style != "rich":
        fails.append(f"ch{number}: reviewCards must use the canonical rich structure")
        return fails
    if len(cards) != 5:
        fails.append(f"ch{number}: reviewCards must contain exactly 5 cards")
    for index, card in enumerate(cards):
        if not isinstance(card, dict):
            fails.append(f"ch{number}: reviewCards[{index}] malformed")
            continue
        if card.get("difficulty") not in {"easy", "medium", "hard"}:
            fails.append(f"ch{number}: reviewCards[{index}] difficulty missing or invalid")
        if not is_tone_object(card.get("front")):
            fails.append(f"ch{number}: reviewCards[{index}].front must be a tone object")
        if not is_tone_object(card.get("back")):
            fails.append(f"ch{number}: reviewCards[{index}].back must be a tone object")
        for surface in ("front", "back"):
            tone = card.get(surface, {})
            if isinstance(tone, dict):
                flat = " ".join(normalize_spaces(tone.get(key)) for key in TONE_KEYS).lower()
                if any(fragment in flat for fragment in BROKEN_REVIEW_CARD_FRAGMENTS):
                    fails.append(f"ch{number}: reviewCards[{index}].{surface} contains templated or corrupted fallback language")
    return fails


def implementation_plan_failures(chapter):
    fails = []
    style = implementation_plan_style(chapter)
    number = chapter.get("number", "?")
    plan = chapter.get("implementationPlan")
    if style == "thin":
        fails.append(f"ch{number}: thin tri-tone implementationPlan shell is not allowed for good-strategy-bad-strategy")
        return fails
    if style != "rich":
        fails.append(f"ch{number}: implementationPlan must use the canonical rich structure")
        return fails
    if not is_tone_object(plan.get("coreSkill")):
        fails.append(f"ch{number}: implementationPlan.coreSkill must be a tone object")
    if not is_tone_object(plan.get("twentyFourHourChallenge")):
        fails.append(f"ch{number}: implementationPlan.twentyFourHourChallenge must be a tone object")
    if not is_tone_object(plan.get("weeklyPractice")):
        fails.append(f"ch{number}: implementationPlan.weeklyPractice must be a tone object")
    if_then = plan.get("ifThenPlans")
    if not isinstance(if_then, list) or len(if_then) != 3:
        fails.append(f"ch{number}: implementationPlan.ifThenPlans must contain exactly 3 context plans")
    else:
        contexts = []
        for index, item in enumerate(if_then):
            if not isinstance(item, dict):
                fails.append(f"ch{number}: implementationPlan.ifThenPlans[{index}] malformed")
                continue
            contexts.append(item.get("context"))
            if item.get("context") not in CONTEXTS:
                fails.append(f"ch{number}: implementationPlan.ifThenPlans[{index}].context missing or invalid")
            if not is_tone_object(item.get("plan")):
                fails.append(f"ch{number}: implementationPlan.ifThenPlans[{index}].plan must be a tone object")
            elif not all(re.match(r"^If .+?, then I will .+[.!?]$", normalize_spaces(item["plan"][tone])) for tone in TONE_KEYS):
                fails.append(f"ch{number}: implementationPlan.ifThenPlans[{index}].plan must be a usable if/then instruction")
        if set(contexts) != set(CONTEXTS):
            fails.append(f"ch{number}: implementationPlan.ifThenPlans must cover work, school, and personal")
    text = json.dumps(plan, ensure_ascii=False).lower()
    if any(fragment.lower() in text for fragment in BROKEN_IMPLEMENTATION_FRAGMENTS):
        fails.append(f"ch{number}: implementationPlan contains corrupted generator fragments")
    return fails


def support_parity_failures(chapter):
    fails = []
    has_strong_core = (
        isinstance(chapter.get("examples"), list)
        and len(chapter.get("examples")) >= 6
        and isinstance(chapter.get("quiz", {}).get("questions"), list)
        and len(chapter.get("quiz", {}).get("questions")) >= 10
    )
    if has_strong_core:
        if review_card_style(chapter) != "rich":
            fails.append(f"ch{chapter.get('number', '?')}: strong core content is wrapped in a downgraded review-card shell")
        if implementation_plan_style(chapter) != "rich":
            fails.append(f"ch{chapter.get('number', '?')}: strong core content is wrapped in an underbuilt implementation-plan shell")
    return fails


def consistency_failures(chapters):
    fails = []
    if not chapters:
        return fails
    review_styles = {review_card_style(chapter) for chapter in chapters}
    plan_styles = {implementation_plan_style(chapter) for chapter in chapters}
    if len(review_styles) > 1:
        fails.append("good-strategy-bad-strategy chapters export with inconsistent reviewCards shell strength")
    if len(plan_styles) > 1:
        fails.append("good-strategy-bad-strategy chapters export with inconsistent implementationPlan shell strength")
    return fails


def strip_leading_name(text):
    text = normalize_spaces(text)
    return re.sub(r"^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+", "", text)


def sentence_fragment(text):
    return strip_terminal_punct(strip_leading_name(text))


def support_profile(chapter):
    if not isinstance(chapter, dict):
        return None
    number = chapter.get("number")
    return CHAPTER_SUPPORT_PROFILES.get(number)


def repeated_tone(text):
    sentence = strip_terminal_punct(text)
    return {
        "gentle": ensure_sentence(sentence),
        "direct": ensure_sentence(f"In direct terms, {lower_first(sentence)}"),
        "competitive": ensure_sentence(f"Put sharply, {lower_first(sentence)}"),
    }


def if_then_tone(trigger, action):
    trigger_text = strip_terminal_punct(trigger)
    action_text = strip_terminal_punct(action)
    return {
        "gentle": ensure_sentence(f"If {lower_first(trigger_text)}, then I will {lower_first(action_text)}"),
        "direct": ensure_sentence(f"If {lower_first(trigger_text)}, then I will immediately {lower_first(action_text)}"),
        "competitive": ensure_sentence(f"If {lower_first(trigger_text)}, then I will decisively {lower_first(action_text)}"),
    }


def build_review_cards_from_profile(chapter):
    profile = support_profile(chapter)
    if not profile:
        return normalize_review_cards(chapter)
    backs = (
        profile["mechanism"],
        profile["distinction"],
        profile["application"],
        profile["boundary"],
        profile["transfer"],
    )
    direct_prefixes = (
        "At the center, ",
        "The key distinction is that ",
        "On a live case, ",
        "Do not overread it as ",
        "Carry forward this rule: ",
    )
    competitive_prefixes = (
        "The engine is ",
        "Hold this line: ",
        "Start here: ",
        "Reject this false lesson: ",
        "Next move rule: ",
    )
    cards = []
    for index, back in enumerate(backs):
        cards.append(
            {
                "cardId": f"ch{chapter.get('number', 0):02d}-rc{index + 1:02d}",
                "difficulty": REVIEW_CARD_DIFFICULTIES[index],
                "front": {tone: ensure_question(REVIEW_CARD_FRONTS[index][tone]) for tone in TONE_KEYS},
                "back": {
                    "gentle": ensure_sentence(back),
                    "direct": ensure_sentence(direct_prefixes[index] + lower_first(strip_terminal_punct(back))),
                    "competitive": ensure_sentence(competitive_prefixes[index] + lower_first(strip_terminal_punct(back))),
                },
            }
        )
    return cards


def example_by_category(chapter, category):
    for example in chapter.get("examples", []):
        if isinstance(example, dict) and example.get("category") == category:
            return example
    return {}


def tone_from_example(example, field, fallback):
    value = example.get(field)
    if is_tone_object(value):
        return value
    return fallback


def build_if_then_plan(category, example, chapter_title):
    scenario = tone_from_example(
        example,
        "scenario",
        {
            "gentle": f"a {category} decision starts drifting from the chapter's logic",
            "direct": f"a live {category} call is leaning on weak strategy language",
            "competitive": f"the {category} move is getting softer than the diagnosis",
        },
    )
    what_to_do = tone_from_example(
        example,
        "whatToDo",
        {
            "gentle": f"apply the main mechanism from {chapter_title}",
            "direct": f"use the chapter's strategic distinction directly",
            "competitive": f"force the chapter's rule back onto the decision",
        },
    )
    return {
        "context": category,
        "plan": {
            "gentle": ensure_sentence(
                f"If {lower_first(sentence_fragment(scenario['gentle']))}, then {lower_first(sentence_fragment(what_to_do['gentle']))}"
            ),
            "direct": ensure_sentence(
                f"If {lower_first(sentence_fragment(scenario['direct']))}, then {lower_first(sentence_fragment(what_to_do['direct']))}"
            ),
            "competitive": ensure_sentence(
                f"If {lower_first(sentence_fragment(scenario['competitive']))}, then {lower_first(sentence_fragment(what_to_do['competitive']))}"
            ),
        },
    }


def thin_triplet_from_plan(plan):
    if isinstance(plan, dict) and set(plan.keys()) == set(TONE_KEYS):
        return {tone: normalize_spaces(plan[tone]) for tone in TONE_KEYS}
    return {
        "gentle": "apply the chapter's logic to one live decision",
        "direct": "use the chapter's mechanism on a current strategic call",
        "competitive": "make one real move carry the chapter instead of the slogan",
    }


def expand_implementation_plan(chapter):
    profile = support_profile(chapter)
    if profile:
        return {
            "coreSkill": repeated_tone(profile["coreSkill"]),
            "ifThenPlans": [
                {
                    "context": context,
                    "plan": if_then_tone(
                        profile["ifThenPlans"][context]["trigger"],
                        profile["ifThenPlans"][context]["action"],
                    ),
                }
                for context in CONTEXTS
            ],
            "twentyFourHourChallenge": repeated_tone(profile["challenge"]),
            "weeklyPractice": repeated_tone(profile["weekly"]),
        }
    style = implementation_plan_style(chapter)
    if style == "rich":
        return chapter.get("implementationPlan")
    source = thin_triplet_from_plan(chapter.get("implementationPlan"))
    return {
        "coreSkill": {
            "gentle": ensure_sentence(source["gentle"]),
            "direct": ensure_sentence(source["direct"]),
            "competitive": ensure_sentence(source["competitive"]),
        },
        "ifThenPlans": [
            build_if_then_plan(category, example_by_category(chapter, category), chapter_title)
            for category in CONTEXTS
        ],
        "twentyFourHourChallenge": {
            "gentle": ensure_sentence(f"Within 24 hours, apply this chapter to one live decision: {strip_terminal_punct(source['gentle'])}"),
            "direct": ensure_sentence(f"Before tomorrow ends, test one real plan against this chapter's mechanism: {strip_terminal_punct(source['direct'])}"),
            "competitive": ensure_sentence(f"In the next day, make one live move prove it can survive this chapter's rule: {strip_terminal_punct(source['competitive'])}"),
        },
        "weeklyPractice": {
            "gentle": ensure_sentence(f"Each week, audit one current plan against this chapter's standard: {strip_terminal_punct(source['gentle'])}"),
            "direct": ensure_sentence(f"Weekly, review one active strategy for whether it still honors this chapter's mechanism: {strip_terminal_punct(source['direct'])}"),
            "competitive": ensure_sentence(f"Every week, catch one place where the strategy is drifting and cut it back to the chapter's rule: {strip_terminal_punct(source['competitive'])}"),
        },
    }


CARD_FRONT_GENTLE = (
    "What is the core move in {title}?",
    "What distinction does {title} insist on?",
    "How would this chapter read a live strategic case?",
    "What is this chapter not telling you to do?",
    "Where should this chapter change the next move?",
)
CARD_FRONT_COMPETITIVE = (
    "What mechanism actually carries {title}?",
    "What confusion does {title} cut apart?",
    "On a live case, what should you inspect first?",
    "What bad reading does {title} rule out?",
    "What compression rule should travel forward from {title}?",
)
CARD_BACK_DIRECT_PREFIX = (
    "The mechanism is ",
    "The distinction is ",
    "In application, ",
    "The boundary is ",
    "The transfer rule is ",
)
CARD_BACK_COMPETITIVE_PREFIX = (
    "Miss the mechanism and the rest blurs: ",
    "Blur this line and the chapter goes soft: ",
    "On a live case, start here: ",
    "Read it too broadly and you break the chapter: ",
    "Carry this forward as the rule: ",
)


def flat_card_to_rich(card, chapter_title, index):
    prompt = ensure_sentence(card.get("prompt", "")).rstrip(".")
    answer = ensure_sentence(card.get("answer", ""))
    difficulty = card.get("level", "medium")
    idx = min(index, 4)
    return {
        "cardId": card.get("cardId", f"temp-rc{index + 1:02d}"),
        "difficulty": difficulty,
        "front": {
            "gentle": ensure_question(CARD_FRONT_GENTLE[idx].format(title=chapter_title)),
            "direct": ensure_question(prompt),
            "competitive": ensure_question(CARD_FRONT_COMPETITIVE[idx].format(title=chapter_title)),
        },
        "back": {
            "gentle": answer,
            "direct": ensure_sentence(CARD_BACK_DIRECT_PREFIX[idx] + lower_first(strip_terminal_punct(answer))),
            "competitive": ensure_sentence(CARD_BACK_COMPETITIVE_PREFIX[idx] + lower_first(strip_terminal_punct(answer))),
        },
    }


def normalize_review_cards(chapter):
    profile = support_profile(chapter)
    if profile:
        return build_review_cards_from_profile(chapter)
    style = review_card_style(chapter)
    cards = chapter.get("reviewCards", [])
    if style == "rich":
        return cards
    if style != "flat":
        return cards
    chapter_title = chapter.get("title", "this chapter")
    return [flat_card_to_rich(card, chapter_title, index) for index, card in enumerate(cards)]


def dialogue_example_failures(chapter):
    fails = []
    number = chapter.get("number", "?")
    for index, example in enumerate(chapter.get("examples", [])):
        if not isinstance(example, dict) or example.get("format") != "dialogue":
            continue
        scenario = example.get("scenario")
        if not is_tone_object(scenario):
            fails.append(f"ch{number}: examples[{index}].scenario must remain a tone object for dialogue format")
            continue
        for tone in TONE_KEYS:
            labels = re.findall(r"(?:^|\n)[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?:", scenario[tone])
            if len(labels) < 3:
                fails.append(f"ch{number}: examples[{index}] dialogue must contain at least 3 named speaker turns in {tone}")
    return fails


def normalize_examples(chapter):
    profile = support_profile(chapter)
    if not profile:
        return copy.deepcopy(chapter.get("examples", []))
    examples = copy.deepcopy(chapter.get("examples", []))
    for example in examples:
        if isinstance(example, dict) and example.get("format") == "dialogue":
            example["scenario"] = copy.deepcopy(profile["dialogueScenario"])
    return examples


def clean_chapter_breakdown_artifacts(chapter):
    updated = copy.deepcopy(chapter)
    if updated.get("number") != 3:
        return updated
    replacements = (
        ("Weak execution starts with a real strategy and then struggles to carry it out.", "Execution failure starts with a real strategy and then struggles to carry it out."),
        ("Weak execution begins with a real strategy and then stumbles in carrying it out.", "Execution failure begins with a real strategy and then stumbles in carrying it out."),
        ("Weak execution can wreck a real strategy.", "Execution failure can still wreck a real strategy."),
    )
    variants = updated.get("contentVariants", {})
    for variant in variants.values():
        breakdown = variant.get("chapterBreakdown", {})
        if not isinstance(breakdown, dict):
            continue
        for tone, text in list(breakdown.items()):
            if not isinstance(text, str):
                continue
            cleaned = text
            for old, new in replacements:
                cleaned = cleaned.replace(old, new)
            breakdown[tone] = cleaned
    return updated


def normalize_chapter(chapter):
    updated = clean_chapter_breakdown_artifacts(chapter)
    updated["reviewCards"] = normalize_review_cards(updated)
    updated["implementationPlan"] = expand_implementation_plan(updated)
    updated["examples"] = normalize_examples(updated)
    return updated


def normalize_review_package(review, chapter_numbers=None):
    updated = copy.deepcopy(review)
    chapters = updated.get("chapters", [])
    normalized_chapters = []
    for chapter in chapters:
        normalized_chapters.append(normalize_chapter(chapter))
    updated["chapters"] = normalized_chapters
    chapter_number = normalized_chapters[0].get("number") if normalized_chapters else None
    updated["book"] = normalized_book_metadata(
        updated.get("book", {}),
        chapter_numbers=chapter_numbers or compute_chapter_numbers_from_chapters(normalized_chapters),
        chapter_range=review_package_chapter_range(chapter_number) if chapter_number else None,
    )
    return updated


def normalize_release_package(release):
    updated = copy.deepcopy(release)
    chapters = [normalize_chapter(chapter) for chapter in updated.get("chapters", [])]
    updated["chapters"] = chapters
    updated["book"] = normalized_book_metadata(updated.get("book", {}), chapter_numbers=compute_chapter_numbers_from_chapters(chapters))
    return updated


def serialize_json(path, payload):
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
