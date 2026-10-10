import copy
import hashlib
import json
from pathlib import Path
base = Path(__file__).resolve().parent
before = json.loads((base / '2026-10-04-ministral-basic-generation.json').read_text())
after = json.loads((base / '2026-10-04-ministral-basic-generation-fp32.json').read_text())
assert hashlib.sha256((base / 'probe-ministral-basic-generation-fp32.mjs').read_bytes()).hexdigest() == after['probeSHA256']
assert after['status'] == 'completed' and after['errors'] == [] and after['bundleBytesUnchanged']
assert after['modelId'] == 'Ministral-3-3B-Instruct-2512-BF16-q4f32_1-MLC'
assert after['engine'] == 'WebGPU · ' + after['modelId']
assert after['cases'] == before['cases'] and after['bundleHashes'] == before['bundleHashes']
assert len(after['results']) == 6
for a, b in zip(before['results'], after['results']):
    assert a['id'] == b['id']
    expected = copy.deepcopy(a['inputs'])
    expected[0]['modelId'] = [after['modelId']]
    assert expected == b['inputs']
    assert b['errors'] and b['documentUnchanged'] and b['previewCount'] == 0
    assert b['raw'][0]['text'].startswith('```json')
rows = {row['id']: row for row in after['results']}
assert 'ABC' not in rows['copy-ascii']['raw'][0]['text']
assert rows['arithmetic']['raw'][0]['text'] == '```json\n{"answer": "4"}'
assert 'six hundred and forty' in rows['formal-english']['raw'][0]['text']
print('PASS: six FP32 requests match FP16 except model identity; all rejected and sources unchanged')
