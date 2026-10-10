"""Check actual custom-model execution and native mechanics, not semantic acceptance."""
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent
report = json.loads((root / '2026-10-04-llama3b-summary-current.json').read_text())
model = 'Llama-3.2-3B-Instruct-q4f16_1-MLC'
assert report['status'] == 'completed' and report['modelId'] == model
assert report['engine'] == 'WebGPU · ' + model
assert report['variants'] == ['current'] and report['repetitions'] == 1
assert report['probeSHA256'] == hashlib.sha256((root / 'probe-gpu-summary-focused.mjs').read_bytes()).hexdigest()
assert report['bundleBytesUnchanged'] and not report['errors']
fixtures = json.loads((root / '2026-10-03-summary-focused-cases.json').read_text())
assert report['cases'] == fixtures and len(report['results']) == len(fixtures) == 6
assert report['externalRequests']
for request in report['externalRequests']:
    assert request['method'] in ['GET', 'HEAD'] and request['bodyBytes'] == 0
applied = 0
for row, case in zip(report['results'], fixtures):
    assert row['id'] == case['id'] and row['variant'] == 'current'
    assert row['selected'].removesuffix('\r\n') == case['source']
    assert row['isolated'] and row['previewCount'] == 0
    assert len(row['raw']) == len(row['inputs']) == 1
    captured = row['inputs'][0]
    assert captured['modelId'] == [model]
    request = captured['request']
    assert request['temperature'] == 0 and request['max_tokens'] == 512
    assert request['response_format']['schema']
    messages = request['messages']
    assert [m['role'] for m in messages] == ['system', 'user']
    data = json.loads(messages[-1]['content'].split('\n')[-1])
    assert data['text'] == row['selected'].replace('\r\n', '\n')
    assert data['instruction'] == case['instruction'] and data['task'] == 'summarize'
    if row['documentUnchanged']:
        assert row['output'] == row['selected'] and row['errors']
    else:
        assert not row['errors'] and row['undoExact'] and row['redoExact']
        text = json.loads(re.sub(r'^\s*<think>\s*</think>\s*', '', row['raw'][0]['text']))['text']
        assert row['output'].removesuffix('\r\n') == text
        applied += 1
assert applied == 5
print('Six actual Llama 3.2 3B inferences verified; five native applications with Undo/Redo, one unchanged refusal. No semantic/default-model acceptance.')
