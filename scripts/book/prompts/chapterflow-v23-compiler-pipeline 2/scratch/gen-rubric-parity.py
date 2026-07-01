#!/usr/bin/env python3
"""One-off parity-fixture generator for src/metrics/rubricMetrics.ts.

Imports the CANONICAL scorer (`.claude/skills/book-score/score.py`) by absolute
path and evaluates ITS OWN functions over (a) hand-authored edge-case texts and
(b) real chapter prose from two tracked packages. The output JSON is therefore
score.py's ground truth — the TS port is asserted against it, guaranteeing a
single ruler (no re-implemented "similar" formula).

Run from the pipeline dir:
  python3 scratch/gen-rubric-parity.py
Writes tests/fixtures/rubric-metrics-parity.json.
"""
import json, os, importlib.util

SCORE_PY = "/Users/radinsoltani/ChapterFlow-books/.claude/skills/book-score/score.py"
PKG_DIR = "/Users/radinsoltani/wt-v23-p01/book-packages"
OUT = os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures", "rubric-metrics-parity.json")

# --- load the canonical scorer as a module (absolute path, never the worktree copy) ---
spec = importlib.util.spec_from_file_location("score_canonical", SCORE_PY)
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)


def nominal(text):
    ws = S.words(text)
    return (100.0 * len(S.NOM.findall(text)) / len(ws)) if ws else 0.0


def house(text):
    low = text.lower()
    return sum(low.count(h) for h in S.HOUSE)


def readability_case(name, text):
    r = S.readability(text)
    y = S.rhythm(text)
    return dict(
        name=name, text=text,
        readability=r,  # dict or None
        rhythm=(dict(cv=y["cov"], shortPct=y["short_pct"], maxLen=y["maxlen"]) if y else None),
        nominal=nominal(text),
        houseTic=house(text),
    )


def tell_case(name, question):
    # Drive score.py's own distractor_tell via a one-question chapter so the
    # fixture reflects the canonical rule exactly. rate is (pct or None, tot).
    rate, tot = S.distractor_tell({"quiz": {"questions": [question]}})
    if tot == 0:
        verdict = None
    else:
        verdict = (rate == 100.0)
    return dict(name=name, question=question, tell=verdict)


def tell_rate_case(name, questions):
    rate, _ = S.distractor_tell({"quiz": {"questions": questions}})
    return dict(name=name, questions=questions, ratePct=rate)  # None allowed


def transfer_case(name, questions):
    rate = S.transfer_ratio({"quiz": {"questions": questions}})
    return dict(name=name, questions=questions, ratePct=rate)  # None allowed


def memorable_case(name, lines):
    c = {"memorableLines": [{"text": t} for t in lines]}
    m = S.memorable_lines(c)
    return dict(name=name, lines=lines, cleanCount=m["clean"], total=m["count"])


# --- (a) synthetic edge-case texts ------------------------------------------
SYNTH = [
    ("empty", ""),
    ("one-word", "Hello."),
    ("no-punctuation", "the quick brown fox jumps over the lazy dog"),
    ("unicode-quotes", "She said “don’t” and it’s fine — really."),
    ("ascii-apostrophe-hyphen", "It's a well-known, self-made success story that can't fail."),
    ("numbers", "In 2020, 15 teams shipped 3 products and 42 features."),
    ("short-staccato", "Go. Run. Win. Do it now. Stop."),
    ("one-long-sentence",
     "The committee unanimously determined that the organization's transformation "
     "initiative required substantial reconsideration before implementation could reasonably proceed."),
    ("multi-sentence-prose",
     "Habits are the compound interest of self-improvement. Small changes seem to make "
     "no difference until you cross a critical threshold. The most powerful outcomes are delayed."),
    ("silent-e-and-cafe", "The cafe made cake. He rode home. She wrote a note."),
]

# --- (b) real chapter prose from two tracked packages -----------------------
def real_chapters(book_id, n=2):
    # Use score.py's OWN md5-seeded chapter sampler so the fixture reproduces the
    # exact chapters the canonical scorer measures (the audit's Flesch-63.9 POM
    # signal is the mean over these seeded chapters, not the first ones).
    path = os.path.join(PKG_DIR, f"{book_id}.v21.json")
    d = json.load(open(path))
    chs = d.get("chapters", []) or []
    idxs = S.select_idxs(book_id, len(chs), n)
    out = []
    for i in idxs:
        c = chs[i]
        bd = S.breakdown_prose(c)
        if bd and len(S.words(bd)) > 50:
            out.append((f"{book_id}-ch{c.get('number','?')}", bd, S.chapter_prose(c), c))
    return out


def main():
    readability = [readability_case(n, t) for n, t in SYNTH]

    real = real_chapters("atomic-habits", 2) + real_chapters("the-power-of-moments", 2)
    for name, bd, allp, _c in real:
        # readability + rhythm + nominal on breakdown prose (score.py uses bd);
        # house tics on full chapter prose (score.py uses allp). Store both texts.
        rc = readability_case(name, bd)
        rc["houseTicText"] = allp
        rc["houseTic"] = house(allp)
        readability.append(rc)

    # distractor per-question edge cases
    tells = [
        tell_case("longest-unique-key-is-tell",
                  {"choices": ["yes", "no", "a much longer keyed answer here"], "correctIndex": 2}),
        tell_case("key-not-longest",
                  {"choices": ["a much longer wrong answer", "no", "yes"], "correctIndex": 2}),
        tell_case("tie-for-longest-not-a-tell",
                  {"choices": ["abcd", "abcd", "xy"], "correctIndex": 0}),
        tell_case("string-correctindex",
                  {"choices": ["short", "the longest one wins"], "correctIndex": "1"}),
        tell_case("out-of-range-excluded",
                  {"choices": ["a", "b"], "correctIndex": 5}),
        tell_case("empty-choices-excluded", {"choices": [], "correctIndex": 0}),
    ]

    tell_rates = [
        tell_rate_case("mixed-with-excluded", [
            {"choices": ["a", "bb", "cccc"], "correctIndex": 2},         # tell
            {"choices": ["aaaa", "bb", "c"], "correctIndex": 2},         # not tell
            {"choices": [], "correctIndex": 0},                          # excluded
            {"choices": ["x", "y"], "correctIndex": 9},                  # excluded
        ]),
        tell_rate_case("all-excluded", [{"choices": [], "correctIndex": 0}]),
        tell_rate_case("empty-list", []),
    ]

    transfers = [
        transfer_case("blooms-apply-and-cue", [
            {"prompt": "Recall the definition.", "bloomsLevel": "remember"},
            {"prompt": "Apply this.", "bloomsLevel": "apply"},
            {"prompt": "Imagine your team is stuck.", "bloomsLevel": "understand"},
            {"prompt": "Suppose a colleague disagrees.", "bloomsLevel": "remember"},
        ]),
        transfer_case("none-transfer", [
            {"prompt": "What is the term?", "bloomsLevel": "remember"},
            {"prompt": "Define it.", "bloomsLevel": "understand"},
        ]),
        transfer_case("empty-questions", []),
    ]

    is_transfer = [
        dict(prompt="Imagine you run a small team.", expected=True),
        dict(prompt="You are a new manager on day one.", expected=True),
        dict(prompt="Consider a factory floor.", expected=True),
        dict(prompt="What did the author define as a habit?", expected=False),
        dict(prompt="", expected=False),
    ]

    # add a real-chapter quiz case if available
    ah = real_chapters("atomic-habits", 1)
    if ah:
        c = ah[0][3]
        qs = (c.get("quiz", {}) or {}).get("questions", []) or []
        if qs:
            tell_rates.append(tell_rate_case("real-atomic-habits-ch", qs))
            transfers.append(transfer_case("real-atomic-habits-ch", qs))
        ml = [m.get("text", "") for m in (c.get("memorableLines", []) or [])]
        if ml:
            memorables_real = [memorable_case("real-atomic-habits-ch", ml)]
        else:
            memorables_real = []
    else:
        memorables_real = []

    memorables = [
        memorable_case("mixed-lengths", [
            "Small habits compound.",                                            # clean
            "This is a deliberately long memorable line that runs well past the fourteen word ceiling for sure",  # not clean
            "",                                                                  # 0 words -> clean (faithful edge)
            "Systems beat goals every single time.",                            # clean
        ]),
        memorable_case("exactly-14-words",
                       ["one two three four five six seven eight nine ten eleven twelve thirteen fourteen"]),
        memorable_case("exactly-15-words",
                       ["one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen"]),
    ] + memorables_real

    fixture = dict(
        _generator="scratch/gen-rubric-parity.py",
        _source=SCORE_PY,
        readability=readability,
        distractorTell=tells,
        distractorTellRate=tell_rates,
        transfer=transfers,
        isTransferQuestion=is_transfer,
        memorable=memorables,
    )

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(fixture, fh, indent=2, ensure_ascii=False)
    print(f"wrote {os.path.relpath(OUT)}: "
          f"{len(readability)} readability, {len(tells)} tell, {len(tell_rates)} tell-rate, "
          f"{len(transfers)} transfer, {len(is_transfer)} is-transfer, {len(memorables)} memorable")


if __name__ == "__main__":
    main()
