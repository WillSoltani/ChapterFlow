#!/usr/bin/env python3
from pathlib import Path
import json, sys
if len(sys.argv) < 2:
    print('Usage: chapterflow_v20_source_sufficiency.py <source-lock.json>')
    sys.exit(2)
obj = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
lawful = bool(obj.get('lawfulFullTextAvailable'))
coverage = float(obj.get('chapterEvidenceCoverage', 0))
chapter_map = bool(obj.get('chapterMapLocked'))
edition = bool(obj.get('editionLocked'))
if lawful and coverage >= 0.75 and chapter_map and edition:
    print('PASS')
    sys.exit(0)
print('BLOCK')
print('lawfulFullTextAvailable=', lawful)
print('chapterEvidenceCoverage=', coverage)
print('chapterMapLocked=', chapter_map)
print('editionLocked=', edition)
sys.exit(1)
