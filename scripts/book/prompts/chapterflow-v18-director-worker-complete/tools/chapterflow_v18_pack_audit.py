
#!/usr/bin/env python3
import os, sys, re
required = [
    "README.md","OPERATING_CONTRACT.md","ARCHITECTURE.md","STATE_MACHINE.md",
    "WAVE_PROTOCOL.md","TICKET_SPEC.md","WORKER_SPAWN_PROTOCOL.md",
    "MasterDirector-v18.md","MasterValidator-v18.md","QUICKSTART.md","REPO_RUNBOOK.md","launch.sh",
    "style/voice.md","style/constraints.md","style/bad-patterns.md","style/gold-examples.md",
    "style/gold-patterns.md","style/gold-prose.md","style/gold-quiz.md","style/grade-bands.md",
    "briefs/brief-template.md","briefs/chapter-outline-template.md","briefs/quiz-blueprint-template.md",
    "briefs/example-blueprint-template.md","rules/chapter-structure.md","rules/writer-agent.md",
    "rules/editor-agent.md","rules/critic-agent.md","rules/structure-agent.md","rules/scenario-agent.md",
    "rules/assembler-agent.md","rules/quiz-agent.md","rules/validator-rules.md","rules/assembly-hygiene-rules.md",
    "tools/chapterflow_v18_artifact_guard.py","tools/chapterflow_v18_release_guard.py"
]
root = sys.argv[1]
missing = [p for p in required if not os.path.exists(os.path.join(root,p))]
hits = []
def bad_hit(txt, phrase):
    txt = txt.lower()
    phrase = phrase.lower()
    if phrase not in txt:
        return False
    # allow explicit negation
    neg_patterns = [
        r"no\s+" + re.escape(phrase),
        r"forbid\w*\s+" + re.escape(phrase),
        r"forbidden\s+" + re.escape(phrase),
        r"without\s+" + re.escape(phrase),
    ]
    return not any(re.search(p, txt) for p in neg_patterns)

for dirpath,_,files in os.walk(root):
    for fn in files:
        if fn in {"chapterflow_v18_pack_audit.py","PACK_AUDIT_REPORT.md"}:
            continue
        path = os.path.join(dirpath, fn)
        try:
            txt = open(path, encoding='utf-8').read()
        except:
            continue
        for bad in ["approve this chapter", "generate-the-prince", "bulk generator", "placeholder cover"]:
            if bad_hit(txt, bad):
                hits.append((os.path.relpath(path, root), bad))
print("ChapterFlow v18 Pack Audit")
print("Root:", root)
print("Missing files:", len(missing))
for m in missing: print("MISSING", m)
print("Banned-text hits:", len(hits))
for h in hits[:20]: print("HIT", h[0], "=>", h[1])
print("PASS" if not missing and not hits else "FAIL")
