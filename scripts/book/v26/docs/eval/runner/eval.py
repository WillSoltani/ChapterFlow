#!/usr/bin/env python3
"""W1c lesson-first eval runner (Phase 2). Model calls go through W1's wrapper (tools/proto/proto.py call) and are
logged to scratch/W1c/ledger.tsv under the W1c cap ($80).

  eval.py judge CHAPTER.json --tag T --out DIR [--prompt judge.md]   blind judge (Opus 5.5, checker role)
  eval.py nochapter CHAPTER.json --tag T --out DIR                    no-chapter solver on q1-q5 (Sonnet 5)
  eval.py det CHAPTER.json                                            deterministic items
  eval.py score --labels labels.json --runs X=a.judge.json,Z=b.judge.json [--only X,Z]
  eval.py report DIR/T.judge.json [CHAPTER.json]                      per-item table + aggregates
"""
import argparse
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.expanduser("~/cf-wt/v26-plan")
sys.path.insert(0, os.path.join(KIT, "tools", "proto"))
sys.path.insert(0, HERE)
import proto  # noqa: E402
from readability import stats  # noqa: E402

REPO_EVAL = os.path.expanduser("~/cf-wt/v26-lesson-first/scripts/book/v26/docs/eval")
LEDGER = os.path.join(KIT, "scratch", "W1c", "ledger.tsv")
CWD = os.path.join(KIT, "scratch", "W1c", "cwd")
CAP = 80.0


def call(role, effort, step, tag, prompt_path, out_prefix):
    cmd = [sys.executable, os.path.join(KIT, "tools", "proto", "proto.py"), "call", "--role", role, "--effort", effort,
           "--step", step, "--chapter", tag, "--prompt-file", prompt_path, "--out", out_prefix,
           "--ledger", LEDGER, "--cwd", CWD, "--cap", str(CAP)]
    p = subprocess.run(cmd, capture_output=True, text=True)
    print(p.stdout.strip()[-600:])
    if p.returncode != 0:
        print(p.stderr[-800:])
    return p.returncode


def judge_text(c):
    """Reader-visible fields with field ids; no version name, ids as authored."""
    return proto.reader_text(c)


def expected_ids(c):
    ids = ["OPENER-hook", "PLAIN-summary", "PLAIN-rest", "COUNTER", "TRY", "LINES-1", "PRACTICE", "SPINE"]
    for t in ("fastRead", "deepRead", "fullRead"):
        ids += [f"OPENER-{t}", f"ARC-{t}", f"END-{t}"]
    ids += [f"EX-{e['exampleId']}" for e in c.get("examples", [])] + [f"EXFIT-{e['exampleId']}" for e in c.get("examples", [])]
    ids += [f"QUIZ-{q['questionId']}" for q in c["quiz"]["questions"]] + [f"CARD-{r['cardId']}" for r in c.get("reviewCards", [])]
    return ids


def missing_ids(c, path):
    try:
        got = {x["id"] for x in json.load(open(path))["items"]}
    except Exception:
        return ["<unparseable>"]
    return [i for i in expected_ids(c) if i not in got]


def cmd_judge(a):
    c = json.load(open(a.chapter, encoding="utf-8"))
    tpl = open(a.prompt or os.path.join(REPO_EVAL, "judge.md"), encoding="utf-8").read()
    os.makedirs(a.out, exist_ok=True)
    pp = os.path.join(a.out, f"{a.tag}.judge.prompt.md")
    open(pp, "w", encoding="utf-8").write(tpl.replace("@@CHAPTER@@", judge_text(c)))
    prefix = os.path.join(a.out, f"{a.tag}.judge")
    rc = call("checker", a.effort, "eval:judge", a.tag, pp, prefix)
    if rc == 0:
        miss = missing_ids(c, prefix + ".json")
        if miss:
            print(f"JUDGE_INCOMPLETE {a.tag}: missing {len(miss)} ids, e.g. {miss[:5]}; retrying once")
            os.replace(prefix + ".json", prefix + ".incomplete.json")
            rc = call("checker", a.effort, "eval:judge-retry", a.tag, pp, prefix)
            if rc == 0:
                miss = missing_ids(c, prefix + ".json")
                print(f"JUDGE_RETRY {a.tag}: missing {len(miss)} ids {miss[:5]}")
    return rc


def cmd_nochapter(a):
    c = json.load(open(a.chapter, encoding="utf-8"))
    qs = c["quiz"]["questions"][:5]
    block = "\n\n".join(f"[{q['questionId']}] {q['prompt']}\n" + "\n".join(f"  {i}. {x}" for i, x in enumerate(q["choices"])) for q in qs)
    tpl = open(os.path.join(REPO_EVAL, "nochapter-solver.md"), encoding="utf-8").read()
    os.makedirs(a.out, exist_ok=True)
    pp = os.path.join(a.out, f"{a.tag}.nochapter.prompt.md")
    open(pp, "w", encoding="utf-8").write(tpl.replace("@@QUESTIONS@@", block))
    rc = call("solver", "medium", "eval:nochapter", a.tag, pp, os.path.join(a.out, f"{a.tag}.nochapter"))
    if rc == 0:
        r = json.load(open(os.path.join(a.out, f"{a.tag}.nochapter.json")))
        key = {q["questionId"]: q["correctIndex"] for q in qs}
        right = sum(1 for x in r.get("answers", []) if key.get(x.get("questionId")) == x.get("choice"))
        print(f"NOCHAPTER {a.tag}: {right}/{len(qs)} right ({'TOO OBVIOUS' if right > 3 else 'ok'})")
    return rc


# ---------------------------------------------------------------- deterministic items
def norm_words(t):
    return re.findall(r"[a-z0-9']+", (t or "").lower().replace("’", "'"))


def ngrams(ws, n):
    return {tuple(ws[i:i + n]) for i in range(len(ws) - n + 1)}


def fields(c):
    out = {"hook": c.get("hook", ""), "counterintuition": c.get("counterintuition", ""), "tryThisNow": c.get("tryThisNow", "")}
    for k in ("fastRead", "deepRead", "fullRead"):
        out[f"breakdown.{k}"] = c["breakdown"][k]
    for e in c.get("examples", []):
        for k in ("scenario", "whatToDo", "whyItMatters"):
            out[f"examples.{e['exampleId']}.{k}"] = e.get(k, "")
    for q in c.get("quiz", {}).get("questions", []):
        out[f"quiz.{q['questionId']}"] = q["prompt"] + " " + " ".join(q["choices"]) + " " + q.get("explanation", "")
    for r in c.get("reviewCards", []):
        out[f"reviewCards.{r['cardId']}"] = r["front"] + " " + r["back"]
    ip = c.get("implementationPlan") or {}
    out["implementationPlan"] = " ".join([ip.get("coreSkill", ""), ip.get("twentyFourHourChallenge", ""), ip.get("weeklyPractice", "")]
                                         + [p.get("context", "") + " " + p.get("plan", "") for p in ip.get("ifThenPlans", [])])
    for i, m in enumerate(c.get("memorableLines", [])):
        out[f"memorableLines.{i}"] = m.get("text", "")
    return out


def repeats(c, n=4, thresh=0.5):
    """Fields that repeat the keyTakeaway near-verbatim: share of its word 4-grams found in the field >= thresh."""
    kt = norm_words(c.get("keyTakeaway", ""))
    g = ngrams(kt, n)
    if not g:
        return []
    hits = []
    for f, t in fields(c).items():
        share = len(g & ngrams(norm_words(t), n)) / len(g)
        if share >= thresh:
            hits.append((f, round(share, 2)))
    return hits


def det(c):
    b = c["breakdown"]
    summary = " ".join(b[k] for k in ("fastRead", "deepRead", "fullRead"))
    rest = " ".join([c.get("tryThisNow", "")] + [e["scenario"] + " " + e["whatToDo"] + " " + e["whyItMatters"] for e in c.get("examples", [])]
                    + [q["prompt"] + " " + " ".join(q["choices"]) for q in c["quiz"]["questions"]]
                    + [r["front"] + " " + r["back"] for r in c.get("reviewCards", [])])
    out = {
        "fk": {k: stats(b[k])["fk"] for k in ("fastRead", "deepRead", "fullRead")},
        "fkRest": stats(rest)["fk"],
        "fkHook": stats(c.get("hook", ""))["fk"],
        "avgSentenceSummary": stats(summary)["avgSentence"],
        "keyTakeawayWords": len((c.get("keyTakeaway") or "").split()),
        "keyTakeawayRepeats": repeats(c),
        "exampleScenarioWords": [len(e["scenario"].split()) for e in c.get("examples", [])],
        "tierWords": {k: len(b[k].split()) for k in ("fastRead", "deepRead", "fullRead")},
    }
    band = (5.0, 8.5)
    out["D-READ-summary"] = all(band[0] <= v <= band[1] for v in out["fk"].values() if v is not None)
    out["D-READ-rest"] = out["fkRest"] is not None and out["fkRest"] <= 8.5
    out["D-LESSON-LEN"] = 0 < out["keyTakeawayWords"] <= 20
    out["D-REPEATS"] = len(out["keyTakeawayRepeats"]) <= 2
    out["D-EX-LEN"] = all(w <= 75 for w in out["exampleScenarioWords"])
    return out


# ---------------------------------------------------------------- aggregates and agreement
def aggregates(j):
    items = {x["id"]: bool(x["pass"]) for x in j.get("items", [])}
    agg = dict(items)

    def frac(prefix):
        v = [p for k, p in items.items() if k.startswith(prefix)]
        return (sum(v) / len(v)) if v else None
    ex, exfit, qz, cd = frac("EX-"), frac("EXFIT-"), frac("QUIZ-"), frac("CARD-")
    agg["AGG-EX"] = ex is not None and ex >= 2 / 3 - 1e-9
    agg["AGG-EXFIT"] = exfit is not None and exfit >= 2 / 3 - 1e-9
    agg["AGG-QUIZ"] = qz is not None and qz >= 0.8
    agg["AGG-CARDS"] = cd is not None and cd >= 0.8
    agg["_fractions"] = {"EX": ex, "EXFIT": exfit, "QUIZ": qz, "CARDS": cd}
    return agg


def cmd_score(a):
    labels = json.load(open(a.labels))["labels"]
    runs = dict(x.split("=", 1) for x in a.runs.split(","))
    only = set(a.only.split(",")) if a.only else None
    k = n = 0
    for l in labels:
        if l["version"] not in runs or (only and l["version"] not in only):
            continue
        agg = aggregates(json.load(open(runs[l["version"]])))
        got = agg.get(l["item"])
        want = l["verdict"] == "pass"
        ok = got is not None and got == want
        k += ok
        n += 1
        print(f"{'AGREE   ' if ok else 'DISAGREE'} {l['id']} {l['version']} {l['item']:16} owner={l['verdict']:4} judge={'pass' if got else 'fail' if got is not None else 'MISSING'}")
    print(f"AGREEMENT {k}/{n}")


def cmd_report(a):
    j = json.load(open(a.judge))
    agg = aggregates(j)
    print(f"lesson: {j.get('lesson')}  singleLesson={j.get('singleLesson')}")
    fails = [x for x in j["items"] if not x["pass"]]
    print(f"items {len(j['items'])}, pass {len(j['items']) - len(fails)}, fail {len(fails)}; fractions {agg['_fractions']}")
    for x in j["items"]:
        print(f"  {'PASS' if x['pass'] else 'FAIL'} {x['id']:18} {x.get('evidence','')[:150]}")
    if a.chapter:
        print("DET", json.dumps(det(json.load(open(a.chapter))), ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("judge"); s.add_argument("chapter"); s.add_argument("--tag", required=True); s.add_argument("--out", required=True)
    s.add_argument("--prompt"); s.add_argument("--effort", default="high")
    s = sub.add_parser("nochapter"); s.add_argument("chapter"); s.add_argument("--tag", required=True); s.add_argument("--out", required=True)
    s = sub.add_parser("det"); s.add_argument("chapter")
    s = sub.add_parser("score"); s.add_argument("--labels", required=True); s.add_argument("--runs", required=True); s.add_argument("--only")
    s = sub.add_parser("report"); s.add_argument("judge"); s.add_argument("chapter", nargs="?")
    a = ap.parse_args()
    if a.cmd == "judge":
        sys.exit(cmd_judge(a))
    if a.cmd == "nochapter":
        sys.exit(cmd_nochapter(a))
    if a.cmd == "det":
        print(json.dumps(det(json.load(open(a.chapter))), indent=1, ensure_ascii=False))
    if a.cmd == "score":
        cmd_score(a)
    if a.cmd == "report":
        cmd_report(a)


if __name__ == "__main__":
    main()
