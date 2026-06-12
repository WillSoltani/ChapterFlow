#!/usr/bin/env python3
"""Build a compact cross-chapter digest for the full-book templating sweep.
Extracts only the templating-prone fields so one agent can see all 34 chapters
side-by-side without ingesting ~880KB of full chapter JSON."""
import json, glob, os, re

CH_DIR = os.path.join(os.path.dirname(__file__), "..", "chapters")
OUT = os.path.join(os.path.dirname(__file__), "stillness.fullbook.digest.md")

def cap(s, n):
    if s is None: return ""
    s = re.sub(r"\s+", " ", str(s)).strip()
    return s if len(s) <= n else s[:n] + "…"

files = sorted(glob.glob(os.path.join(CH_DIR, "stillness-is-the-key-ch*.v21-native.chapter.json")))
parts = []
for f in files:
    d = json.load(open(f))
    n = d.get("number")
    L = [f"### CH{n}: {cap(d.get('title'),80)}"]
    L.append(f"HOOK: {cap(d.get('hook'),220)}")
    L.append(f"TRY-NOW: {cap(d.get('tryThisNow'),200)}")
    L.append("EXAMPLES:")
    for i, ex in enumerate(d.get("examples", []), 1):
        ps = ex.get("planSpec", {}) or {}
        L.append(f"  [ex{i}] format={cap(ps.get('format'),40)} | beat={cap(ps.get('requiredBeat'),160)}")
        L.append(f"        domain={cap(ps.get('domain'),100)}; audience={cap(ps.get('audience'),90)}; stakes={cap(ps.get('stakes'),110)}")
        L.append(f"        scenario: {cap(ex.get('scenario'),400)}")
        L.append(f"        whatToDo: {cap(ex.get('whatToDo'),260)}")
        L.append(f"        whyItMatters: {cap(ex.get('whyItMatters'),220)}")
    ip = d.get("implementationPlan", {}) or {}
    L.append(f"PLAN: title={cap(ip.get('title'),70)}; coreSkill={cap(ip.get('coreSkill'),70)}")
    for p in ip.get("ifThenPlans", []) or []:
        L.append(f"  ifThen: [{cap(p.get('context'),90)}] -> {cap(p.get('plan'),160)}")
    L.append(f"  24h: {cap(ip.get('twentyFourHourChallenge'),200)}")
    L.append(f"  weekly: {cap(ip.get('weeklyPractice'),200)}")
    L.append("CARDS:")
    for c in d.get("reviewCards", []) or []:
        L.append(f"  Q: {cap(c.get('front'),120)} || A: {cap(c.get('back'),200)}")
    L.append("QUIZ-OPENERS:")
    for q in d.get("quiz", {}).get("questions", []) or []:
        L.append(f"  {cap(q.get('prompt'),140)}")
    L.append("MEMORABLE: " + " | ".join(cap(m.get('text'),100) for m in (d.get("memorableLines") or [])))
    bd = d.get("breakdown", {}) or {}
    L.append(f"FAST-READ: {cap(bd.get('fastRead'),600)}")
    L.append(f"DEEP-READ(head): {cap(bd.get('deepRead'),350)}")
    parts.append("\n".join(L))

text = ("# Stillness-is-the-key — full-book cross-chapter digest (all 34 chapters)\n"
        "# Compact extract of templating-prone fields for the cross-batch sweep.\n\n"
        + "\n\n".join(parts) + "\n")
open(OUT, "w").write(text)
print(f"wrote {OUT}: {len(text)} bytes (~{len(text)//4} tokens est) across {len(files)} chapters")
