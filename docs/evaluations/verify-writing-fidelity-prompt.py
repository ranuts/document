import copy
import hashlib
import json
from pathlib import Path

base = Path(__file__).resolve().parent
baseline = json.loads((base / '2026-10-04-writing-semantic-pairs.json').read_text())
candidate = json.loads((base / '2026-10-04-writing-semantic-fidelity-prompt.json').read_text())
assert hashlib.sha256((base / 'probe-gpu-writing-fidelity-prompt.mjs').read_bytes()).hexdigest() == candidate['probeSHA256']
assert candidate['status'] == 'completed' and candidate['errors'] == [] and candidate['bundleBytesUnchanged']
assert candidate['cases'] == baseline['cases'] and candidate['modelId'] == baseline['modelId']
assert candidate['bundleHashes'] == baseline['bundleHashes']
addition = 'Preserve who performs each action and who receives it. Never turn an approver into an applicant, reverse payer and recipient, change pending approval into completed approval, or add or remove a prerequisite. Keep negation attached to the same action and actor. '
assert len(candidate['results']) == len(baseline['results']) == 6
for before, after in zip(baseline['results'], candidate['results']):
    assert before['id'] == after['id'] and after['variant'] == 'fidelity'
    expected = copy.deepcopy(before['inputs'])
    assert len(expected) == 1
    message = next(m for m in reversed(expected[0]['request']['messages']) if m['role'] == 'user')
    assert message['content'].count('Copy numeric tokens exactly,') == 1
    message['content'] = message['content'].replace('Copy numeric tokens exactly,', addition + 'Copy numeric tokens exactly,')
    assert expected == after['inputs'], after['id']
    assert after['previewCount'] == 0
    if after['errors']:
        assert after['documentUnchanged'] and after['output'] == before['output']
    else:
        assert after['undoExact'] and after['redoExact']
assert sum(bool(row['errors']) for row in candidate['results']) == 4
negative = next(row for row in candidate['results'] if row['id'] == 'zh-not-approved')
assert negative['output'] == '林青尚未批准支付 640 EUR 于 2026-10-12。\r\n'
print('PASS: same six requests except explicit relationship instruction; four refusals, known role drift improved')
