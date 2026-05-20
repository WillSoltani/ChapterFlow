#!/usr/bin/env python3
"""Audit zero-to-one.v21.json: for Ch02-Ch14, verify that the previously-duplicated
quiz pairs (Q1/Q7, Q2/Q8, Q3/Q9) no longer share long substrings, and that no
'documents include ...' descriptive list is repeated within a chapter."""

import json
import re
from pathlib import Path

PATH = Path('/Users/willsoltani/dev/chapterflow-siliconx/book-packages/zero-to-one.v21.json')


def tokens(s: str):
    """Word tokens; treats hyphenated words as a single token."""
    return re.findall(r"[A-Za-z][\w'-]*", s)


def longest_common_ngram(a: str, b: str) -> int:
    """Return length of longest contiguous shared token sequence (case-insensitive)."""
    ta = [t.lower() for t in tokens(a)]
    tb = [t.lower() for t in tokens(b)]
    if not ta or not tb:
        return 0
    # dynamic programming
    best = 0
    prev = [0] * (len(tb) + 1)
    for i in range(1, len(ta) + 1):
        cur = [0] * (len(tb) + 1)
        for j in range(1, len(tb) + 1):
            if ta[i - 1] == tb[j - 1]:
                cur[j] = prev[j - 1] + 1
                if cur[j] > best:
                    best = cur[j]
        prev = cur
    return best


def main():
    data = json.loads(PATH.read_text())
    chapters = data['chapters']

    issues = []

    for ch in chapters:
        num = ch.get('number')
        if num is None or num < 2 or num > 14:
            continue

        quiz = ch.get('quiz', {})
        questions = quiz.get('questions', [])
        if len(questions) < 9:
            continue

        prompts = [q['prompt'] for q in questions]

        # Check the three pairs that were previously duplicated
        pairs = [(0, 6, 'Q1/Q7'), (1, 7, 'Q2/Q8'), (2, 8, 'Q3/Q9')]
        for i, j, label in pairs:
            n = longest_common_ngram(prompts[i], prompts[j])
            if n >= 6:
                issues.append(f"Ch{num:02d} {label}: longest shared n-gram = {n} words")

        # Also verify the rewritten Q7/Q8/Q9 don't share 6+ words with each other.
        rewritten_pairs = [(6, 7, 'Q7/Q8'), (6, 8, 'Q7/Q9'), (7, 8, 'Q8/Q9')]
        for i, j, label in rewritten_pairs:
            n = longest_common_ngram(prompts[i], prompts[j])
            if n >= 6:
                issues.append(f"Ch{num:02d} {label} (rewritten): longest shared n-gram = {n} words")
                # Print the shared substring for debugging
                # (only for first violation per chapter to keep output short)

        # Also check that the "documents include ..." substring (with its
        # 3-item descriptive list) is not repeated within the chapter.
        doc_lists = []
        for p in prompts:
            m = re.search(r'documents include ([^.]+)\.', p, re.IGNORECASE)
            if m:
                doc_lists.append(m.group(1).strip().lower())
        dup = [s for s in set(doc_lists) if doc_lists.count(s) > 1]
        if dup:
            issues.append(f"Ch{num:02d}: duplicated 'documents include' lists: {dup}")

    if issues:
        print("AUDIT FAILED:")
        for x in issues:
            print(f"  - {x}")
    else:
        print("AUDIT PASSED: no Q1/Q7, Q2/Q8, Q3/Q9 pair in Ch02-Ch14 shares a 6+ word substring; no duplicated 'documents include' lists.")


if __name__ == '__main__':
    main()
