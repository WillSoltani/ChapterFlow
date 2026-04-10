#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path

TONE_KEYS = ("gentle", "direct", "competitive")
CLAUSE_SCAFFOLDS = (
    "that is why",
    "the point is",
    "what changes is",
    "the chapter also",
    "there is also",
    "the final movement",
)
THESIS_FIRST_PREFIXES = (
    "this chapter",
    "in this chapter",
    "chapter ",
    "the author argues",
    "the authors argue",
)
COMPETITIVE_SLOGAN_LEADS = (
    "the hard truth is",
    "real winners",
    "kill the weakness",
    "dominate the room",
    "become the machine",
)
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "because", "but", "by", "for", "from",
    "how", "if", "in", "into", "is", "it", "its", "of", "on", "or", "so", "that", "the",
    "their", "there", "this", "to", "was", "what", "when", "which", "with", "you", "your",
}
MEMOIR_BANNED = (
    "elite mindset",
    "dominate everything",
    "unlimited greatness",
    "endless possibility",
    "poster-ready",
)
MEMOIR_ABSTRACTIONS = {"greatness", "range", "possibility", "mindset", "destiny", "legend"}
MEMOIR_ANCHORS = {
    "body", "pain", "recovery", "repair", "stillness", "stretch", "stretching", "discipline",
    "disease", "race", "training", "brother", "retirement", "governor", "40%", "forty",
}
PITCH_ANYTHING_BANNED = (
    "use it as a practical rule",
    "make it hold in the room",
    "that is the pressure tested edge",
    "that is the practical rule",
    "state the mechanism clearly",
    "use this as the practical mechanism behind the takeaway not as a slogan",
)
GENERIC_PROMPT_PHRASES = (
    "answer in practical sequence terms",
    "make the room effect unmistakable",
    "what should this chapter alter",
    "what does this chapter change",
    "how does this make your next room",
)
GENERIC_IMPLEMENTATION_PHRASES = (
    "start small and stay consistent",
    "be consistent every day",
    "track your progress",
    "reflect on what worked",
    "hold yourself accountable",
    "push yourself harder",
    "raise your standards",
)
REINFORCEMENT_BANNED_OPENERS = (
    "this chapter",
    "the point is",
    "that is why",
)
BOOK_ANCHOR_REQUIREMENTS = {
    (1, 3): {"abuse", "poverty", "racism", "grief", "mirror", "school", "weight", "obesity", "labor"},
    (4, 6): {"buds", "hell", "week", "service", "race", "cookie", "duty", "pain", "injury"},
    (7, 8): {"40%", "forty", "governor", "planning", "pacing", "logistics", "strategy"},
    (9, 10): {"ranger", "leadership", "standard", "delta", "record", "failure", "after action"},
    (11, 11): {"addison", "stillness", "stretch", "recovery", "repair", "retirement", "reconciliation"},
}


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def normalize_text(value):
    value = str(value).lower()
    value = re.sub(r"['’]", "", value)
    value = re.sub(r"[^a-z0-9%s\s]" % re.escape("%"), " ", value)
    return re.sub(r"\s+", " ", value).strip()


def split_sentences(text):
    compact = re.sub(r"\s+", " ", str(text).strip())
    if not compact:
        return []
    parts = re.split(r"(?<=[.!?])\s+", compact)
    return [part.strip() for part in parts if part.strip()]


def split_paragraphs(text):
    raw = str(text).strip()
    if not raw:
        return []
    parts = re.split(r"\n\s*\n", raw)
    parts = [part.strip() for part in parts if part.strip()]
    if len(parts) <= 1:
        return [raw]
    return parts


def tokenize(text):
    return [token for token in normalize_text(text).split() if token and token not in STOPWORDS]


def jaccard(left, right):
    left_set = set(left)
    right_set = set(right)
    if not left_set or not right_set:
        return 0.0
    return len(left_set & right_set) / len(left_set | right_set)


def word_count(text):
    return len([token for token in str(text).strip().split() if token])


def first_sentence(text):
    sentences = split_sentences(text)
    return sentences[0] if sentences else ""


def suffix_key(sentence, size=6):
    tokens = tokenize(sentence)
    if len(tokens) < size:
        return None
    return " ".join(tokens[-size:])


def prefix_key(sentence, size=5):
    tokens = tokenize(sentence)
    if len(tokens) < size:
        return None
    return " ".join(tokens[:size])


def make_issue(severity, issue_type, location, message):
    return {
        "severity": severity,
        "issue_type": issue_type,
        "location": location,
        "message": message,
    }


def infer_book_context(pkg, source_path=None):
    context = {
        "bookId": "",
        "title": "",
        "author": "",
        "sourcePath": str(source_path or ""),
    }
    if isinstance(pkg, dict):
        book = pkg.get("book", {}) if isinstance(pkg.get("book"), dict) else {}
        context["bookId"] = str(book.get("bookId", "")).strip()
        context["title"] = str(book.get("title", "")).strip()
        context["author"] = str(book.get("author", "")).strip()

    source_norm = normalize_text(context["sourcePath"])
    if not context["bookId"] and "pitch anything" in source_norm:
        context["bookId"] = "pitch-anything"
    if not context["title"] and "pitch anything" in source_norm:
        context["title"] = "Pitch Anything"
    return context


def attach_book_context(pkg, source_path=None):
    context = infer_book_context(pkg, source_path)
    chapters = pkg.get("chapters", []) if isinstance(pkg, dict) and isinstance(pkg.get("chapters"), list) else [pkg]
    for chapter in chapters:
        if isinstance(chapter, dict):
            chapter["_book_context"] = dict(context)
    return chapters


def is_pitch_anything(chapter):
    book = chapter.get("_book_context", {})
    title = normalize_text(book.get("title", ""))
    book_id = normalize_text(book.get("bookId", ""))
    source_path = normalize_text(book.get("sourcePath", ""))
    return "pitch anything" in title or "pitch anything" in source_path or "pitch anything" in book_id or "pitch-anything" in source_path or "pitch-anything" in book_id


def yield_tone_object(location, value, kind, depth, family):
    if not isinstance(value, dict):
        return
    for tone in TONE_KEYS:
        text = value.get(tone)
        if isinstance(text, str):
            yield {
                "location": f"{location}.{tone}",
                "text": text,
                "kind": kind,
                "depth": depth,
                "tone": tone,
                "family": family,
            }


def chapter_breakdown_surfaces(chapter):
    number = chapter.get("number", "?")
    content = chapter.get("contentVariants", {})
    for depth_name in ("easy", "medium", "hard"):
        depth = content.get(depth_name, {})
        yield from yield_tone_object(
            f"ch{number}.{depth_name}.chapterBreakdown",
            depth.get("chapterBreakdown"),
            "chapterBreakdown",
            depth_name,
            f"chapterBreakdown.{depth_name}",
        )


def recap_surfaces(chapter):
    number = chapter.get("number", "?")
    content = chapter.get("contentVariants", {})
    for depth_name in ("easy", "medium", "hard"):
        recap = content.get(depth_name, {}).get("oneMinuteRecap")
        if not isinstance(recap, dict):
            continue
        for key, value in recap.items():
            if key in TONE_KEYS:
                yield from yield_tone_object(
                    f"ch{number}.{depth_name}.oneMinuteRecap",
                    recap,
                    "recap",
                    depth_name,
                    f"recap.{depth_name}",
                )
                break
            yield from yield_tone_object(
                f"ch{number}.{depth_name}.oneMinuteRecap.{key}",
                value,
                "recap",
                depth_name,
                f"recap.{depth_name}.{key}",
            )


def review_surfaces(chapter):
    number = chapter.get("number", "?")
    cards = chapter.get("reviewCards", [])
    for index, card in enumerate(cards):
        if not isinstance(card, dict):
            continue
        for field in ("front", "back"):
            value = card.get(field)
            yield from yield_tone_object(
                f"ch{number}.reviewCards[{index}].{field}",
                value,
                "reviewCard",
                card.get("difficulty", "unknown"),
                f"reviewCard.{field}",
            )


def key_takeaway_card_surfaces(chapter):
    number = chapter.get("number", "?")
    yield from yield_tone_object(
        f"ch{number}.keyTakeawayCard",
        chapter.get("keyTakeawayCard"),
        "keyTakeawayCard",
        "supporting",
        "keyTakeawayCard",
    )


def key_takeaway_surfaces(chapter):
    number = chapter.get("number", "?")
    content = chapter.get("contentVariants", {})
    for depth_name in ("easy", "medium", "hard"):
        takeaways = content.get(depth_name, {}).get("keyTakeaways", [])
        if not isinstance(takeaways, list):
            continue
        for index, takeaway in enumerate(takeaways):
            if not isinstance(takeaway, dict):
                continue
            yield from yield_tone_object(
                f"ch{number}.{depth_name}.keyTakeaways[{index}].point",
                takeaway.get("point"),
                "takeawayPoint",
                depth_name,
                f"takeawayPoint.{depth_name}",
            )
            if "moreDetails" in takeaway:
                yield from yield_tone_object(
                    f"ch{number}.{depth_name}.keyTakeaways[{index}].moreDetails",
                    takeaway.get("moreDetails"),
                    "moreDetails",
                    depth_name,
                    f"moreDetails.{depth_name}",
                )


def prompt_surfaces(chapter):
    number = chapter.get("number", "?")
    content = chapter.get("contentVariants", {})
    scalar_fields = ("activationPrompt", "selfCheckPrompt", "predictionPrompt")
    list_fields = ("selfCheckPrompts",)
    for depth_name in ("medium", "hard"):
        depth = content.get(depth_name, {})
        for field in scalar_fields:
            if field in depth:
                yield from yield_tone_object(
                    f"ch{number}.{depth_name}.{field}",
                    depth.get(field),
                    "prompt",
                    depth_name,
                    f"prompt.{depth_name}",
                )
        for field in list_fields:
            prompts = depth.get(field)
            if isinstance(prompts, list):
                for index, prompt in enumerate(prompts):
                    yield from yield_tone_object(
                        f"ch{number}.{depth_name}.{field}[{index}]",
                        prompt,
                        "prompt",
                        depth_name,
                        f"prompt.{depth_name}",
                    )


def implementation_surfaces(chapter):
    number = chapter.get("number", "?")
    plan = chapter.get("implementationPlan", {})
    if not isinstance(plan, dict):
        return
    yield from yield_tone_object(
        f"ch{number}.implementationPlan.coreSkill",
        plan.get("coreSkill"),
        "implementationPlan",
        "supporting",
        "implementationPlan.coreSkill",
    )
    if_then = plan.get("ifThenPlans")
    if isinstance(if_then, list):
        for index, item in enumerate(if_then):
            if not isinstance(item, dict):
                continue
            yield from yield_tone_object(
                f"ch{number}.implementationPlan.ifThenPlans[{index}].plan",
                item.get("plan"),
                "implementationPlan",
                "supporting",
                "implementationPlan.ifThenPlans",
            )
    yield from yield_tone_object(
        f"ch{number}.implementationPlan.twentyFourHourChallenge",
        plan.get("twentyFourHourChallenge"),
        "implementationPlan",
        "supporting",
        "implementationPlan.challenge",
    )
    yield from yield_tone_object(
        f"ch{number}.implementationPlan.weeklyPractice",
        plan.get("weeklyPractice"),
        "implementationPlan",
        "supporting",
        "implementationPlan.weeklyPractice",
    )


def collect_surfaces(chapter):
    for item in chapter_breakdown_surfaces(chapter):
        yield item
    for item in recap_surfaces(chapter):
        yield item
    for item in review_surfaces(chapter):
        yield item
    for item in key_takeaway_card_surfaces(chapter):
        yield item
    for item in key_takeaway_surfaces(chapter):
        yield item
    for item in prompt_surfaces(chapter):
        yield item
    for item in implementation_surfaces(chapter):
        yield item


def audit_surface(surface):
    issues = []
    text = surface["text"]
    location = surface["location"]
    sentences = split_sentences(text)
    normalized = [normalize_text(sentence) for sentence in sentences]
    seen = {}
    for index, sentence in enumerate(normalized):
        if not sentence:
            continue
        if sentence in seen:
            issues.append(make_issue("FAIL", "duplicate_sentence", location, f"Repeated sentence: \"{sentences[index]}\""))
        seen.setdefault(sentence, index)

    for index, sentence in enumerate(sentences):
        left = tokenize(sentence)
        if len(left) < 7:
            continue
        for prior_index in range(index):
            right = tokenize(sentences[prior_index])
            if len(right) < 7:
                continue
            overlap = jaccard(left, right)
            if overlap >= 0.82 and normalize_text(sentence) != normalize_text(sentences[prior_index]):
                issues.append(
                    make_issue(
                        "FAIL",
                        "near_duplicate_sentence",
                        location,
                        f"Near-duplicate sentence pair with {prior_index + 1} and {index + 1} (overlap={overlap:.2f}).",
                    )
                )
                break

    if surface["kind"] == "chapterBreakdown":
        normalized_text = normalize_text(text)
        opening = normalize_text(first_sentence(text))
        if any(opening.startswith(prefix) for prefix in THESIS_FIRST_PREFIXES):
            issues.append(
                make_issue("FAIL", "thesis_first_open", location, f"Breakdown opens thesis-first: \"{first_sentence(text)}\"")
            )
        if surface["tone"] == "competitive" and any(opening.startswith(prefix) for prefix in COMPETITIVE_SLOGAN_LEADS):
            issues.append(
                make_issue(
                    "FAIL",
                    "competitive_slogan_lead",
                    location,
                    f"Competitive breakdown opens with a sloganized severity lead: \"{first_sentence(text)}\"",
                )
            )
        for scaffold in CLAUSE_SCAFFOLDS:
            count = len(re.findall(r"\b" + re.escape(scaffold) + r"\b", normalized_text))
            if count > 1:
                issues.append(
                    make_issue("FAIL", "repeated_clause_scaffold", location, f"Clause scaffold '{scaffold}' appears {count} times.")
                )

    paragraphs = split_paragraphs(text)
    if len(paragraphs) > 1:
        endings = {}
        for index, paragraph in enumerate(paragraphs):
            paragraph_sentences = split_sentences(paragraph)
            if not paragraph_sentences:
                continue
            last_sentence = paragraph_sentences[-1]
            suffix = suffix_key(last_sentence, size=6)
            if suffix:
                endings.setdefault(suffix, []).append(index + 1)
        for suffix, positions in endings.items():
            if len(positions) > 1:
                issues.append(
                    make_issue("FAIL", "ending_echo", location, f"Repeated paragraph ending beat across paragraphs {positions}.")
                )

        claims = {}
        for index, paragraph in enumerate(paragraphs):
            paragraph_sentences = split_sentences(paragraph)
            if not paragraph_sentences:
                continue
            claim = prefix_key(paragraph_sentences[0], size=6)
            if not claim:
                continue
            claims.setdefault(claim, []).append(index + 1)
        for claim, positions in claims.items():
            if len(positions) > 1:
                issues.append(
                    make_issue("FAIL", "paragraph_role_repeat", location, f"Paragraphs {positions} appear to reopen the same claim.")
                )
    else:
        sentence_endings = {}
        for index, sentence in enumerate(sentences):
            suffix = suffix_key(sentence, size=6)
            if suffix:
                sentence_endings.setdefault(suffix, []).append(index + 1)
        if surface["kind"] in {"chapterBreakdown", "recap", "reviewCard"}:
            for suffix, positions in sentence_endings.items():
                if len(positions) > 1:
                    issues.append(
                        make_issue("FAIL", "ending_echo", location, f"Repeated sentence ending beat across sentences {positions}.")
                    )

    if surface["kind"] == "recap":
        recap_words = word_count(text)
        if recap_words > 95:
            issues.append(make_issue("FAIL", "recap_overexpansion", location, f"Recap surface is too long at {recap_words} words."))
    if surface["kind"] in {"reviewCard", "prompt", "keyTakeawayCard", "takeawayPoint", "moreDetails"}:
        opening = normalize_text(first_sentence(text))
        if any(opening.startswith(prefix) for prefix in REINFORCEMENT_BANNED_OPENERS):
            issues.append(
                make_issue(
                    "FAIL",
                    "reinforcement_echo",
                    location,
                    f"Reinforcement surface opens with a banned reusable stem: \"{first_sentence(text)}\"",
                )
            )
    if surface["kind"] == "implementationPlan":
        normalized = normalize_text(text)
        for phrase in GENERIC_IMPLEMENTATION_PHRASES:
            if phrase in normalized:
                issues.append(
                    make_issue(
                        "FAIL",
                        "generic_implementation_plan",
                        location,
                        f"Implementation plan uses generic coaching language: '{phrase}'.",
                    )
                )

    return issues


def chapter_package_duplicate_issues(chapter, surfaces):
    issues = []
    sentence_map = {}
    for surface in surfaces:
        if surface["kind"] == "chapterBreakdown":
            continue
        for sentence in split_sentences(surface["text"]):
            normalized = normalize_text(sentence)
            if not normalized or len(tokenize(sentence)) < 5:
                continue
            entries = sentence_map.setdefault(normalized, [])
            entries.append((surface["location"], sentence))
    for normalized, entries in sentence_map.items():
        unique_locations = []
        for location, sentence in entries:
            if location not in [item[0] for item in unique_locations]:
                unique_locations.append((location, sentence))
        if len(unique_locations) > 1:
            first_location, sentence = unique_locations[0]
            other_locations = ", ".join(location for location, _ in unique_locations[1:])
            issues.append(
                make_issue(
                    "FAIL",
                    "chapter_package_duplicate_sentence",
                    first_location,
                    f"Sentence also appears at {other_locations}: \"{sentence}\"",
                )
            )
    return issues


def repeated_template_tail_issues(chapter, surfaces):
    issues = []
    grouped = {}
    for surface in surfaces:
        group = surface.get("family")
        if not group:
            continue
        grouped.setdefault((group, surface["tone"]), []).append(surface)
    for (group, tone), items in grouped.items():
        suffixes = {}
        for item in items:
            key = suffix_key(item["text"], size=5)
            if not key:
                continue
            suffixes.setdefault(key, []).append(item["location"])
        for key, locations in suffixes.items():
            if len(locations) > 1:
                issues.append(
                    make_issue(
                        "FAIL",
                        "repeated_template_tail",
                        locations[0],
                        f"Repeated content-bearing tail across {group}.{tone}: {locations}",
                    )
                )
    return issues


def repeated_card_scaffold_issues(chapter):
    issues = []
    number = chapter.get("number", "?")
    cards = chapter.get("reviewCards", [])
    for field in ("front", "back"):
        for tone in TONE_KEYS:
            prior = None
            for index, card in enumerate(cards):
                value = card.get(field) if isinstance(card, dict) else None
                if not isinstance(value, dict) or not isinstance(value.get(tone), str):
                    continue
                text = value[tone]
                current = {
                    "location": f"ch{number}.reviewCards[{index}].{field}.{tone}",
                    "prefix": prefix_key(text, 3),
                    "suffix": suffix_key(text, 4),
                }
                if prior and (
                    (current["prefix"] and current["prefix"] == prior["prefix"]) or
                    (current["suffix"] and current["suffix"] == prior["suffix"])
                ):
                    issues.append(
                        make_issue(
                            "FAIL",
                            "repeated_card_scaffold",
                            current["location"],
                            f"Adjacent review cards reuse the same {field} scaffold as {prior['location']}.",
                        )
                    )
                prior = current
    return issues


def generic_more_details_issues(chapter):
    issues = []
    number = chapter.get("number", "?")
    content = chapter.get("contentVariants", {})
    seen = {}
    for depth_name in ("medium", "hard"):
        takeaways = content.get(depth_name, {}).get("keyTakeaways", [])
        if not isinstance(takeaways, list):
            continue
        for index, takeaway in enumerate(takeaways):
            if not isinstance(takeaway, dict):
                continue
            point = takeaway.get("point")
            details = takeaway.get("moreDetails")
            if not isinstance(point, dict) or not isinstance(details, dict):
                continue
            for tone in TONE_KEYS:
                point_text = point.get(tone)
                detail_text = details.get(tone)
                if not isinstance(point_text, str) or not isinstance(detail_text, str):
                    continue
                location = f"ch{number}.{depth_name}.keyTakeaways[{index}].moreDetails.{tone}"
                normalized = normalize_text(detail_text)
                if normalized in seen:
                    issues.append(
                        make_issue(
                            "FAIL",
                            "more_details_restate",
                            location,
                            f"moreDetails reuses the same wording as {seen[normalized]}.",
                        )
                    )
                else:
                    seen[normalized] = location
                overlap = jaccard(tokenize(point_text), tokenize(detail_text))
                new_tokens = set(tokenize(detail_text)) - set(tokenize(point_text))
                if overlap >= 0.72 or len(new_tokens) < 4:
                    issues.append(
                        make_issue(
                            "FAIL",
                            "more_details_restate",
                            location,
                            "moreDetails mostly restates the takeaway instead of adding mechanism, limit, failure mode, or operational implication.",
                        )
                    )
    return issues


def generic_prompt_surface_issues(chapter):
    issues = []
    for surface in collect_surfaces(chapter):
        if surface["kind"] not in {"prompt", "recap"}:
            continue
        normalized = normalize_text(surface["text"])
        for phrase in GENERIC_PROMPT_PHRASES:
            if phrase in normalized:
                issues.append(
                    make_issue(
                        "FAIL",
                        "generic_prompt_surface",
                        surface["location"],
                        f"Prompt uses reusable template wording: '{phrase}'.",
                    )
                )
    return issues


def review_echo_issues(chapter):
    issues = []
    key_card = chapter.get("keyTakeawayCard")
    if not isinstance(key_card, dict):
        return issues
    number = chapter.get("number", "?")
    review_cards = chapter.get("reviewCards", [])
    content = chapter.get("contentVariants", {})
    recap_lookup = {}
    takeaway_lookup = {}
    for depth_name in ("easy", "medium", "hard"):
        recap = content.get(depth_name, {}).get("oneMinuteRecap", {})
        if isinstance(recap, dict):
            for key, value in recap.items():
                if isinstance(value, dict):
                    for tone in TONE_KEYS:
                        text = value.get(tone)
                        if isinstance(text, str):
                            recap_lookup.setdefault(tone, []).append(text)
        takeaways = content.get(depth_name, {}).get("keyTakeaways", [])
        if isinstance(takeaways, list):
            for takeaway in takeaways:
                if not isinstance(takeaway, dict):
                    continue
                point = takeaway.get("point")
                if isinstance(point, dict):
                    for tone in TONE_KEYS:
                        text = point.get(tone)
                        if isinstance(text, str):
                            takeaway_lookup.setdefault(tone, []).append(text)
    for index, card in enumerate(review_cards):
        if not isinstance(card, dict):
            continue
        back = card.get("back")
        if not isinstance(back, dict):
            continue
        for tone in TONE_KEYS:
            back_text = back.get(tone)
            key_text = key_card.get(tone)
            if not isinstance(back_text, str) or not isinstance(key_text, str):
                continue
            comparisons = [key_text] + recap_lookup.get(tone, []) + takeaway_lookup.get(tone, [])
            max_overlap = 0.0
            for comparison in comparisons:
                max_overlap = max(max_overlap, jaccard(tokenize(back_text), tokenize(comparison)))
            if max_overlap >= 0.78:
                issues.append(
                    make_issue(
                        "FAIL",
                        "review_card_echo",
                        f"ch{number}.reviewCards[{index}].back.{tone}",
                        f"Review card back overlaps another reinforcement surface too closely (overlap={max_overlap:.2f}).",
                    )
                )
    return issues


def reinforcement_echo_issues(chapter):
    issues = []
    content = chapter.get("contentVariants", {})
    number = chapter.get("number", "?")
    for depth_name in ("medium", "hard"):
        takeaways = content.get(depth_name, {}).get("keyTakeaways", [])
        if not isinstance(takeaways, list):
            continue
        for index, takeaway in enumerate(takeaways):
            if not isinstance(takeaway, dict):
                continue
            point = takeaway.get("point", {})
            details = takeaway.get("moreDetails", {})
            if not isinstance(point, dict) or not isinstance(details, dict):
                continue
            for tone in TONE_KEYS:
                point_text = point.get(tone)
                detail_text = details.get(tone)
                if not isinstance(point_text, str) or not isinstance(detail_text, str):
                    continue
                overlap = jaccard(tokenize(point_text), tokenize(detail_text))
                if overlap >= 0.84 and normalize_text(point_text) != normalize_text(detail_text):
                    issues.append(
                        make_issue(
                            "FAIL",
                            "reinforcement_echo",
                            f"ch{number}.{depth_name}.keyTakeaways[{index}].moreDetails.{tone}",
                            "moreDetails is too close to its paired point and does not feel separately authored.",
                        )
                    )
    return issues


def medium_hard_overlap_issues(chapter):
    issues = []
    number = chapter.get("number", "?")
    content = chapter.get("contentVariants", {})
    families = {
        "chapterBreakdown": lambda depth: [depth.get("chapterBreakdown", {})],
        "keyTakeaways": lambda depth: [item.get("point", {}) for item in depth.get("keyTakeaways", []) if isinstance(item, dict)] + [item.get("moreDetails", {}) for item in depth.get("keyTakeaways", []) if isinstance(item, dict) and isinstance(item.get("moreDetails"), dict)],
        "recap": lambda depth: list(depth.get("oneMinuteRecap", {}).values()) if isinstance(depth.get("oneMinuteRecap"), dict) else [],
        "prompts": lambda depth: [depth.get("activationPrompt", {}), depth.get("selfCheckPrompt", {}), depth.get("predictionPrompt", {})] + (depth.get("selfCheckPrompts", []) if isinstance(depth.get("selfCheckPrompts"), list) else []),
    }
    medium = content.get("medium", {})
    hard = content.get("hard", {})
    for family, extractor in families.items():
        medium_items = extractor(medium)
        hard_items = extractor(hard)
        for tone in TONE_KEYS:
            medium_blob = " ".join(item.get(tone, "") for item in medium_items if isinstance(item, dict) and isinstance(item.get(tone), str))
            hard_blob = " ".join(item.get(tone, "") for item in hard_items if isinstance(item, dict) and isinstance(item.get(tone), str))
            if not medium_blob.strip() or not hard_blob.strip():
                continue
            overlap = jaccard(tokenize(medium_blob), tokenize(hard_blob))
            threshold = 0.72 if family == "chapterBreakdown" else 0.66
            if overlap >= threshold:
                issues.append(
                    make_issue(
                        "FAIL",
                        "hard_medium_overlap",
                        f"ch{number}.hard.{family}.{tone}",
                        f"Hard overlaps medium too closely in {family} for {tone} tone (overlap={overlap:.2f}).",
                    )
                )
    return issues


def pitch_anything_boilerplate_issues(chapter, surfaces):
    issues = []
    if not is_pitch_anything(chapter):
        return issues
    for surface in surfaces:
        normalized = normalize_text(surface["text"])
        for phrase in PITCH_ANYTHING_BANNED:
            if phrase in normalized:
                issues.append(
                    make_issue(
                        "FAIL",
                        "pitch_anything_boilerplate",
                        surface["location"],
                        f"Pitch Anything boilerplate detected: '{phrase}'.",
                    )
                )
    return issues


def memoir_fidelity_issues(chapter):
    issues = []
    book = chapter.get("_book_context", {})
    title = normalize_text(book.get("title", ""))
    author = normalize_text(book.get("author", ""))
    if "cant hurt me" not in title and "david goggins" not in author:
        return issues
    number = chapter.get("number", "?")
    for surface in chapter_breakdown_surfaces(chapter):
        text_norm = normalize_text(surface["text"])
        for banned in MEMOIR_BANNED:
            if banned in text_norm:
                issues.append(
                    make_issue("FAIL", "memoir_abstraction_drift", surface["location"], f"Banned memoir drift phrase '{banned}' found.")
                )
        tokens = set(tokenize(surface["text"]))
        if tokens & MEMOIR_ABSTRACTIONS and not tokens & MEMOIR_ANCHORS:
            issues.append(
                make_issue(
                    "FAIL",
                    "memoir_abstraction_drift",
                    surface["location"],
                    "Abstract memoir language appears without an event or body anchor.",
                )
            )
        if number == 11 and any(phrase in text_norm for phrase in ("final victory", "ultimate triumph", "you become unstoppable")):
            issues.append(
                make_issue(
                    "FAIL",
                    "memoir_abstraction_drift",
                    surface["location"],
                    "Closing reflection drifts into victory-pose language.",
                )
            )
    for (start, end), anchors in BOOK_ANCHOR_REQUIREMENTS.items():
        if start <= int(number) <= end:
            for surface in chapter_breakdown_surfaces(chapter):
                tokens = set(tokenize(surface["text"]))
                if not tokens & anchors:
                    issues.append(
                        make_issue(
                            "FAIL",
                            "memoir_anchor_gap",
                            surface["location"],
                            "Breakdown is missing the chapter-family anchor pressure expected for Can't Hurt Me.",
                        )
                    )
            break
    return issues


def audit_package(pkg, source_path=None):
    issues = []
    for chapter in attach_book_context(pkg, source_path=source_path):
        surfaces = list(collect_surfaces(chapter))
        for surface in surfaces:
            issues.extend(audit_surface(surface))
        issues.extend(chapter_package_duplicate_issues(chapter, surfaces))
        issues.extend(repeated_template_tail_issues(chapter, surfaces))
        issues.extend(repeated_card_scaffold_issues(chapter))
        issues.extend(generic_more_details_issues(chapter))
        issues.extend(generic_prompt_surface_issues(chapter))
        issues.extend(review_echo_issues(chapter))
        issues.extend(reinforcement_echo_issues(chapter))
        issues.extend(medium_hard_overlap_issues(chapter))
        issues.extend(pitch_anything_boilerplate_issues(chapter, surfaces))
        issues.extend(memoir_fidelity_issues(chapter))
        chapter.pop("_book_context", None)
    return {"issues": issues}


def main():
    parser = argparse.ArgumentParser(description="Audit ChapterFlow v13 prose surfaces for repetition and drift.")
    parser.add_argument("path", help="Path to a chapter or package JSON file.")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of plain text.")
    args = parser.parse_args()

    input_path = Path(args.path)
    data = load_json(input_path)
    result = audit_package(data, source_path=input_path)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        for issue in result["issues"]:
            print(f"{issue['severity']} {issue['issue_type']} {issue['location']}: {issue['message']}")
        print(f"FAIL={sum(1 for issue in result['issues'] if issue['severity'] == 'FAIL')} WARN=0")
    raise SystemExit(1 if result["issues"] else 0)


if __name__ == "__main__":
    main()
