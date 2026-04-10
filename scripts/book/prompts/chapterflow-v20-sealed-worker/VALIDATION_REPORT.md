# ChapterFlow v20 Validation Report

Checks run on this pack:

1. `python3 tools/chapterflow_v20_pack_audit.py <pack-root>`
   - Result: PASS
2. `python3 tools/chapterflow_v20_smoke_test.py <pack-root>`
   - Result: PASS

What these checks verify:
- required files are present
- banned old approval/drift text is absent
- `launch.sh` works on a fresh temp repo
- `launch-prompt.txt` includes anti-shortcut lines
- run root + manifest + prompt are created correctly

Known intentional behavior:
- the Director blocks instead of simulating worker stages if fresh worker sessions are unavailable
- copyrighted books without sufficient lawful chapter-level source coverage block in full-fidelity mode
- no cover generation is performed
