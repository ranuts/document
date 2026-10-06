import hashlib
import json
from pathlib import Path

base = Path(__file__).resolve().parent
report = json.loads((base / '2026-10-04-writing-semantic-pairs.json').read_text())
cases = json.loads((base / '2026-10-04-writing-semantic-pairs-cases.json').read_text())
assert hashlib.sha256((base / 'probe-gpu-writing-semantic-pairs.mjs').read_bytes()).hexdigest() == report['probeSHA256']
assert report['cases'] == cases
assert report['status'] == 'completed' and report['errors'] == [] and report['bundleBytesUnchanged']
assert len(report['results']) == len(cases) == 6
rows = {row['id']: row for row in report['results']}
for case in cases:
    row = rows[case['id']]
    assert row['source'] == case['source'] and row['instruction'] == case['instruction']
    assert row['previewCount'] == 0 and row['variant'] == 'current'
    assert row['raw'] and row['inputs']
    if row['errors']:
        assert row['documentUnchanged']
        assert json.loads(row['raw'][-1]['text'].replace('<think>\n\n</think>', '').strip())['text'] == case['source']
    else:
        assert row['undoExact'] and row['redoExact']
assert sum(bool(row['errors']) for row in rows.values()) == 4
assert rows['zh-approved']['output'] == '林青已批准于2026-10-12支付640 EUR。\r\n'
assert rows['zh-not-approved']['output'] == '林青的支付申请尚未批准，日期为2026-10-12，金额640 EUR。\r\n'
print('PASS: six recorded cases, four unchanged refusals, two applied results including role drift')
