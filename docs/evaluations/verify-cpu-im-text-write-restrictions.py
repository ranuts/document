"""Check actual built IM negative paths; this is not model-quality evidence."""
import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parents[2]
report = json.loads((root / 'docs/evaluations/2026-10-04-cpu-im-text-write-restrictions.json').read_text())
assert report['status'] == 'completed' and not report['errors'] and report['bundleUnchanged']
assert hashlib.sha256((root / 'dist/assets' / report['plugin']).read_bytes()).hexdigest() == report['pluginSHA256']
assert {case['scenario'] for case in report['cases']} == {'merged', 'protected', 'stop', 'selectionStop', 'sheetStop'}
for case in report['cases']:
    before, after = case['before'], case['after']
    assert before['historyRefsRetained'] and after['historyRefsRetained']
    for field in ('value', 'format', 'index', 'items', 'backupDepth', 'other', 'busy'):
        assert after[field] == before[field], (case['scenario'], field)
    assert not after['busy'] and after['value'] == '30' and after['format'] == 'General'
    assert case['previews'] == 0 and any('A1:B4' in a and 'B2: "30"' in a for a in case['activity'])
    if case['scenario'] in ('merged', 'protected'):
        assert after['selection'] == before['selection']
        expected = 'unmerged cell' if case['scenario'] == 'merged' else 'range is protected'
        assert len(case['errors']) == 1 and expected in case['errors'][0]
    else:
        assert not case['errors'] and any('Stopped' in status for status in case['statuses'])
    if case['scenario'] == 'sheetStop':
        assert after['other'] == {'value': 'SECOND', 'format': '0%'}
print('Verified 5 actual IM negative paths, retained native history references and backup depth.')
