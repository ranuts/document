"""Bind preregistered inputs and observed native outcomes; no automatic semantic score."""
import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parents[2]
base = root / 'docs/evaluations'
cases = json.loads((base / '2026-10-04-writing-role-holdout-cases.json').read_text())
r = json.loads((base / '2026-10-04-writing-role-holdout.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['cases'] == cases and r['variants'] == ['current', 'minimal'] and r['repetitions'] == 1
assert r['probeSHA256'] == hashlib.sha256((base / 'probe-gpu-writing-role-holdout.mjs').read_bytes()).hexdigest()
assert 'WebGPU' in r['engine'] and r['modelId'] == 'Qwen3-1.7B-q4f16_1-MLC'
assert len(r['results']) == 16
plugins = list((root / 'dist/assets').glob('agent-plugin-*.js'))
assert len(plugins) == 1 and hashlib.sha256(plugins[0].read_bytes()).hexdigest() == r['bundleHashes']['plugin']
for case in cases:
    rows = [row for row in r['results'] if row['id'] == case['id']]
    assert [row['variant'] for row in rows] == ['current', 'minimal']
    payloads = []
    for row in rows:
        assert all(row[key] == value for key, value in case.items())
        assert row['selected'].removesuffix('\r\n') == case['source']
        assert row['isolated'] and row['previewCount'] == 0
        assert len(row['raw']) == len(row['inputs']) == 1
        assert row['inputs'][0]['modelId'] == [r['modelId']]
        request = row['inputs'][0]['request']
        assert request['temperature'] == 0 and request['top_p'] == 0.8 and request['max_tokens'] == 512
        assert request['extra_body']['enable_thinking'] is False and request['response_format']['schema']
        user = request['messages'][-1]['content']
        data = json.loads(user[user.rfind('\n') + 1:])
        assert data['text'] == row['selected'].replace('\r\n', '\n') and data['instruction'] == case['instruction']
        payloads.append(data)
        if row['documentUnchanged']:
            assert row['output'] == row['selected'] and row['errors']
        else:
            assert not row['errors'] and row['undoExact'] and row['redoExact']
            assert row['undoText'] == row['selected'] and row['redoText'] == row['output']
    assert payloads[0] == payloads[1]
print('Verified 16 actual model requests, paired input identity, refusals and native Undo/Redo. Semantics require manual review.')
