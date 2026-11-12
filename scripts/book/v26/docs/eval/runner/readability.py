"""Flesch-Kincaid grade (standard formula) with a heuristic syllable counter. 0 model calls."""
import re

def syllables(word):
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 0
    if len(w) <= 3:
        return 1
    w = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", w)
    w = re.sub(r"^y", "", w)
    n = len(re.findall(r"[aeiouy]{1,2}", w))
    return max(1, n)

def sentences(text):
    t = re.sub(r"\s+", " ", text or "").strip()
    parts = [p for p in re.split(r"(?<=[.!?])[\"'”’)]*\s+(?=[\"'“‘(]?[A-Z0-9])", t) if re.search(r"[A-Za-z]", p)]
    return parts

def fk_grade(text):
    sents = sentences(text)
    words = re.findall(r"[A-Za-z][A-Za-z'’-]*", text or "")
    if not sents or not words:
        return None
    syl = sum(syllables(w) for w in words)
    return round(0.39 * len(words) / len(sents) + 11.8 * syl / len(words) - 15.59, 1)

def stats(text):
    sents = sentences(text)
    words = re.findall(r"[A-Za-z][A-Za-z'’-]*", text or "")
    return {"fk": fk_grade(text), "words": len(words), "sentences": len(sents),
            "avgSentence": round(len(words) / max(1, len(sents)), 1),
            "longWordShare": round(sum(1 for w in words if syllables(w) >= 3) / max(1, len(words)), 3)}
