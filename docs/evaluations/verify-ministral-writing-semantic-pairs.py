import hashlib
import json
from pathlib import Path

base = Path(__file__).resolve().parent
report = json.loads((base / '2026-10-04-ministral-writing-semantic-pairs.json').read_text())
cases = json.loads((base / '2026-10-04-writing-semantic-pairs-cases.json').read_text())
model = 'Ministral-3-3B-Instruct-2512-BF16-q4f16_1-MLC'
assert hashlib.sha256((base / 'probe-ministral-writing-semantic-pairs.mjs').read_bytes()).hexdigest() == report['probeSHA256']
assert report['status'] == 'completed' and report['errors'] == [] and report['bundleBytesUnchanged']
assert report['modelId'] == model and report['engine'] == 'WebGPU · ' + model
assert report['cases'] == cases and len(report['results']) == 6
for row, case in zip(report['results'], cases):
    assert row['id'] == case['id'] and row['source'] == case['source']
    assert row['errors'] and row['documentUnchanged'] and row['previewCount'] == 0
    assert len(row['inputs']) == len(row['raw']) == 1
    assert row['inputs'][0]['modelId'] == [model]
    user = next(m for m in reversed(row['inputs'][0]['request']['messages']) if m['role'] == 'user')
    data = json.loads(user['content'].split('\n')[-1])
    assert row['selected'] == case['source'] + '\r\n'
    assert data['text'] == case['source'] + '\n' and data['instruction'] == case['instruction']
    assert row['raw'][0]['stopReason'] == ('length' if case['id'].startswith('zh-') else 'stop')
head = json.loads((base / '2026-10-04-ministral-runtime-artifact-head.json').read_text())
assert head['method'] == 'HEAD' and len(head['checks']) == 3
assert all(check['status'] == 200 for check in head['checks'])
print('PASS: actual Ministral loaded; six recorded refusals preserve source; runtime endpoints available')
