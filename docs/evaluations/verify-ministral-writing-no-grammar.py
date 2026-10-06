import copy
import hashlib
import json
from pathlib import Path
base = Path(__file__).resolve().parent
baseline = json.loads((base / '2026-10-04-ministral-writing-semantic-pairs.json').read_text())
report = json.loads((base / '2026-10-04-ministral-writing-no-grammar.json').read_text())
assert hashlib.sha256((base / 'probe-ministral-writing-no-grammar.mjs').read_bytes()).hexdigest() == report['probeSHA256']
assert report['status'] == 'completed' and report['errors'] == [] and report['bundleBytesUnchanged']
assert report['modelId'] == baseline['modelId'] and report['cases'] == baseline['cases']
assert report['bundleHashes'] == baseline['bundleHashes']
assert len(report['results']) == len(baseline['results']) == 6
for before, after in zip(baseline['results'], report['results']):
    assert before['id'] == after['id']
    expected = copy.deepcopy(before['inputs'])
    assert len(expected) == 1 and 'response_format' in expected[0]['request']
    del expected[0]['request']['response_format']
    assert after['inputs'] == expected
    assert after['errors'] and after['documentUnchanged'] and after['previewCount'] == 0
    assert after['raw'][0]['text'].startswith('```json')
negative = json.loads((base / '2026-10-04-ministral-writing-no-grammar-before.json').read_text())
assert hashlib.sha256((base / 'probe-ministral-writing-no-grammar-before.mjs').read_bytes()).hexdigest() == negative['probeSHA256']
assert negative['status'] == 'failed' and negative['results'] == [] and negative['error'] == 'Error: Sampling/schema mismatch'
print('PASS: only response_format removed in six requests; all refused; preliminary assertion failure preserved')
