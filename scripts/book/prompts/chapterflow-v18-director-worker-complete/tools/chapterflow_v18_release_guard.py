
#!/usr/bin/env python3
import os, sys, json, hashlib
def sha(path):
    return hashlib.sha256(open(path,'rb').read()).hexdigest()
if len(sys.argv)<3:
    print("Usage: release_guard.py RUN_ROOT release.json")
    sys.exit(1)
run_root, release_path = sys.argv[1], sys.argv[2]
if not os.path.isabs(release_path):
    release_path = os.path.join(run_root, release_path)
release = json.load(open(release_path, encoding='utf-8'))
fails=[]
for ch in release.get("chapters", []):
    code = f"ch{int(ch['number']):02d}"
    vpath = os.path.join(run_root, "validated", f"{code}.chapter.json")
    if not os.path.exists(vpath):
        fails.append(f"missing validated chapter for {code}")
        continue
    v = json.load(open(vpath, encoding='utf-8'))
    if v != ch:
        fails.append(f"release chapter {code} does not match validated artifact")
print("FAILS", len(fails))
for f in fails: print("FAIL", f)
print("PASS" if not fails else "FAIL")
sys.exit(1 if fails else 0)
