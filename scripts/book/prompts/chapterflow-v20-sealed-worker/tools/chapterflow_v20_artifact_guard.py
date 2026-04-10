#!/usr/bin/env python3
from pathlib import Path
import json, sys
if len(sys.argv) < 2:
    print('Usage: chapterflow_v20_artifact_guard.py <chapter-json>')
    sys.exit(2)
path = Path(sys.argv[1])
obj = json.loads(path.read_text(encoding='utf-8'))
chapter = obj['chapters'][0] if 'chapters' in obj else obj
errors = []
allowed = {'chapterId','number','title','readingTimeMinutes','contentVariants','examples','quiz','implementationPlan','reviewCards','keyTakeawayCard'}
extra = set(chapter.keys()) - allowed
if extra:
    errors.append(f'extra_keys:{sorted(extra)}')
quiz = chapter.get('quiz')
if not isinstance(quiz, dict) or not isinstance(quiz.get('questions'), list) or len(quiz['questions']) == 0:
    errors.append('quiz_missing_or_empty')
examples = chapter.get('examples')
if not isinstance(examples, list) or len(examples) != 6:
    errors.append('examples_count_invalid')
else:
    for i, ex in enumerate(examples, 1):
        for field in ('scenario','whatToDo','whyItMatters'):
            val = ex.get(field)
            if not (isinstance(val, dict) and set(val.keys()) == {'gentle','direct','competitive'} and all(isinstance(v, str) and v.strip() for v in val.values())):
                errors.append(f'example_{i}_{field}_not_tone_object')
bad_phrases = [
    'keep the prose narrow and concrete',
    'used lazily, the point turns into',
    'keep this question alive',
    'threshold question',
    'reading calibration'
]
text = json.dumps(chapter, ensure_ascii=False).lower()
for p in bad_phrases:
    if p in text:
        errors.append(f'contamination_phrase:{p}')

def walk(x):
    if isinstance(x, dict):
        if set(x.keys()) == {'gentle','direct','competitive'}:
            vals = [x['gentle'], x['direct'], x['competitive']]
            if len(set(vals)) < 3:
                errors.append('tone_collapse_exact')
        for v in x.values():
            walk(v)
    elif isinstance(x, list):
        for v in x:
            walk(v)
walk(chapter)
if errors:
    print('FAIL')
    for e in errors:
        print(e)
    sys.exit(1)
print('PASS')
