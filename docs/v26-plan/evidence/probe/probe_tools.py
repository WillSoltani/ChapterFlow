#!/usr/bin/env python3
"""Helpers used by the 2026-09-27 planning probe (0 model calls). Seed code for the W1 harness.

Usage:
  python3 probe_tools.py reader  <chapter.json>                 # labelled reader text (the fact checker's <chapter> input)
  python3 probe_tools.py quotes  <chapter.json> <source-span.txt> # verbatim-quote check; exit 1 if any quote is missing
  python3 probe_tools.py stats   <chapter.json>                 # words / paragraphs / quotes per tier, reader chars
"""
import json
import re
import sys


def load(path):
    return json.load(open(path, encoding="utf-8"))


def reader_text(c):
    """Every reader-visible field, labelled with its field id (the layout the probe's fact check used)."""
    out = []
    for k in ("title", "hook", "counterintuition", "keyTakeaway", "tryThisNow"):
        if c.get(k):
            out.append(f"[{k}] {c[k]}")
    for k in ("fastRead", "deepRead", "fullRead"):
        out.append(f"[breakdown.{k}]\n{c['breakdown'][k]}")
    for e in c.get("examples", []):
        out.append(
            f"[examples.{e['exampleId']}] {e['title']}\nScenario: {e['scenario']}\n"
            f"What to do: {e['whatToDo']}\nWhy it matters: {e['whyItMatters']}"
        )
    for q in c.get("quiz", {}).get("questions", []):
        ch = "\n".join(f"  {i}. {x}" for i, x in enumerate(q["choices"]))
        out.append(f"[quiz.{q['questionId']}] {q['prompt']}\n{ch}\n  KEY: {q['correctIndex']}\n  Explanation: {q['explanation']}")
    for r in c.get("reviewCards", []):
        out.append(f"[reviewCards.{r['cardId']}] Front: {r['front']} | Back: {r['back']}")
    if c.get("implementationPlan"):
        out.append("[implementationPlan] " + json.dumps(c["implementationPlan"], ensure_ascii=False))
    if c.get("memorableLines"):
        out.append("[memorableLines] " + " | ".join(m["text"] for m in c["memorableLines"]))
    return "\n\n".join(out)


def norm(t):
    """Normalization for the verbatim-quote check: drop [n] footnote markers and '_', unify quotes/dashes, keep letters/digits/apostrophes."""
    t = re.sub(r"\[\d+\]", "", t).replace("_", "")
    t = t.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    t = t.replace("—", " ").replace("–", " ").replace("--", " ")
    t = re.sub(r"[^a-z0-9' ]", " ", t.lower())
    return re.sub(r"\s+", " ", t).strip()


def quote_spans(c):
    texts = {k: c["breakdown"][k] for k in ("fastRead", "deepRead", "fullRead")}
    for k in ("hook", "counterintuition", "keyTakeaway", "tryThisNow"):
        texts[k] = c.get(k, "")
    for q in c.get("quiz", {}).get("questions", []):
        texts[f"quiz.{q['questionId']}.explanation"] = q["explanation"]
    for r in c.get("reviewCards", []):
        texts[f"reviewCards.{r['cardId']}.back"] = r["back"]
    for i, m in enumerate(c.get("memorableLines", [])):
        texts[f"memorableLines.{i}"] = '"' + m["text"] + '"'
    for field, t in texts.items():
        for q in re.findall(r'"([^"]{8,})"', t or ""):
            yield field, q


def check_quotes(c, source_span):
    ns = norm(source_span)
    missing = [(f, q) for f, q in quote_spans(c) if norm(q) not in ns]
    total = sum(1 for _ in quote_spans(c))
    return total, missing


def stats(c):
    b = c["breakdown"]
    for k in ("fastRead", "deepRead", "fullRead"):
        paras = [p for p in b[k].split("\n\n") if p.strip()]
        sents = [s for s in re.split(r"(?<=[.!?])\s+", b[k]) if s.strip()]
        print(
            f"{k}: {len(b[k].split())} words, {len(paras)} paragraphs, longest {max(len(p.split()) for p in paras)} words, "
            f"{b[k].count(chr(34)) // 2} quotes, avg sentence {sum(len(s.split()) for s in sents) / len(sents):.1f} words"
        )
    print("reader chars:", len(reader_text(c)))


if __name__ == "__main__":
    cmd = sys.argv[1]
    ch = load(sys.argv[2])
    if cmd == "reader":
        print(reader_text(ch))
    elif cmd == "quotes":
        total, missing = check_quotes(ch, open(sys.argv[3], encoding="utf-8").read())
        print(f"quotes {total}, missing {len(missing)}")
        for f, q in missing:
            print(f"  NOT IN SOURCE [{f}] {q}")
        sys.exit(1 if missing else 0)
    elif cmd == "stats":
        stats(ch)
