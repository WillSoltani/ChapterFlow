#!/usr/bin/env python3
import json, sys, re
from pathlib import Path

LEAK_PHRASES = [
    'keep the prose narrow and concrete',
    'used lazily, the point turns into',
    'keep this question alive',
    'reading calibration',
    'threshold question',
    'keep custom as political support visible when you use it',
    'keep moderation before innovation visible when you use it',
]
CANONICAL_CHAPTER_KEYS = {
    'chapterId','number','title','readingTimeMinutes','contentVariants','examples','quiz','implementationPlan','reviewCards','keyTakeawayCard'
}

def walk_strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, list):
        for x in obj:
            yield from walk_strings(x)
    elif isinstance(obj, dict):
        for x in obj.values():
            yield from walk_strings(x)

def check_tone_obj(value):
    return isinstance(value, dict) and set(value.keys()) == {'gentle','direct','competitive'} and all(isinstance(value[k], str) and value[k].strip() for k in ('gentle','direct','competitive'))

def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))

def main():
    if len(sys.argv) != 3:
        print('Usage: chapterflow_v19_artifact_guard.py <run_root> <chapter_json_rel_or_abs>')
        raise SystemExit(1)
    run_root = Path(sys.argv[1])
    p = Path(sys.argv[2])
    if not p.is_absolute():
        p = run_root / p
    chapter = load(p)
    fails = []
    extra = [k for k in chapter.keys() if k not in CANONICAL_CHAPTER_KEYS]
    if extra:
        fails.append(f'extra top-level keys: {extra}')
    text_blob = '\n'.join(walk_strings(chapter)).lower()
    for phrase in LEAK_PHRASES:
        if phrase in text_blob:
            fails.append(f'contamination phrase: {phrase}')
    if 'this chapter' in text_blob or 'the chapter says' in text_blob or "the chapter's" in text_blob:
        fails.append('meta-distance leakage present')
    quiz = chapter.get('quiz')
    if not isinstance(quiz, dict) or not isinstance(quiz.get('questions'), list) or len(quiz['questions']) != 10:
        fails.append('quiz missing or not 10 questions')
    examples = chapter.get('examples', [])
    if len(examples) != 6:
        fails.append('examples count is not 6')
    for i, ex in enumerate(examples, 1):
        scen = ex.get('scenario')
        if not check_tone_obj(scen):
            fails.append(f'example {i} scenario is not a tone object')
        for field in ('whatToDo','whyItMatters'):
            if not check_tone_obj(ex.get(field)):
                fails.append(f'example {i} {field} is not a tone object')
    def walk_tones(obj, path='root'):
        if isinstance(obj, dict):
            if set(obj.keys()) == {'gentle','direct','competitive'}:
                yield path, obj
            for k,v in obj.items():
                yield from walk_tones(v, f'{path}.{k}')
        elif isinstance(obj, list):
            for idx,v in enumerate(obj):
                yield from walk_tones(v, f'{path}[{idx}]')
    for path, tone in walk_tones(chapter):
        vals = [tone['gentle'].strip(), tone['direct'].strip(), tone['competitive'].strip()]
        if len(set(vals)) < 3:
            fails.append(f'tone collapse at {path}')
    for depth in ('easy','medium','hard'):
        cv = chapter.get('contentVariants', {}).get(depth, {})
        if 'takeaways' in cv:
            fails.append(f'{depth} has noncanonical takeaways key')
        if 'keyTakeaways' not in cv:
            fails.append(f'{depth} missing keyTakeaways')
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text_blob) if len(s.strip()) > 30]
    seen = set(); dups = set()
    for s in sentences:
        if s in seen:
            dups.add(s[:80])
        seen.add(s)
    if dups:
        fails.append(f'repeated exact sentences detected: {len(dups)}')
    if fails:
        print('FAIL')
        for f in fails:
            print(f'- {f}')
        raise SystemExit(1)
    print('PASS')

if __name__ == '__main__':
    main()
