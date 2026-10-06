import copy
import hashlib
import json
from pathlib import Path
base = Path(__file__).resolve().parent
report = json.loads((base / '2026-10-04-writing-fidelity-fresh.json').read_text())
cases = json.loads((base / '2026-10-04-writing-fidelity-fresh-cases.json').read_text())
assert hashlib.sha256((base / 'probe-gpu-writing-fidelity-fresh.mjs').read_bytes()).hexdigest() == report['probeSHA256']
assert report['cases'] == cases and report['status'] == 'completed' and report['errors'] == []
assert report['bundleBytesUnchanged'] and len(report['results']) == 12
addition = 'Preserve who performs each action and who receives it. Never turn an approver into an applicant, reverse payer and recipient, change pending approval into completed approval, or add or remove a prerequisite. Keep negation attached to the same action and actor. '
counts = {'current': 0, 'fidelity': 0}
for case in cases:
    rows = [r for r in report['results'] if r['id'] == case['id']]
    assert len(rows) == 2
    before = next(r for r in rows if r['variant'] == 'current')
    after = next(r for r in rows if r['variant'] == 'fidelity')
    expected = copy.deepcopy(before['inputs'])
    assert len(expected) == 1
    message = next(m for m in reversed(expected[0]['request']['messages']) if m['role'] == 'user')
    assert message['content'].count('Copy numeric tokens exactly,') == 1
    message['content'] = message['content'].replace('Copy numeric tokens exactly,', addition + 'Copy numeric tokens exactly,')
    assert after['inputs'] == expected
    for row in rows:
        assert row['source'] == case['source'] and row['previewCount'] == 0
        if row['errors']:
            assert row['documentUnchanged']
            raw = json.loads(row['raw'][-1]['text'].replace('<think>\n\n</think>', '').strip())['text']
            assert '2026年10月18日' in raw
        else:
            counts[row['variant']] += 1
            assert row['undoExact'] and row['redoExact']
assert counts == {'current': 3, 'fidelity': 2}, counts
print('PASS: twelve paired requests differ only by relationship prompt; current 3 applied, candidate 2')
