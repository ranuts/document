"""Audit actual reasoning-pipeline observations; no semantic correctness judge."""
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).parent
report = json.loads((root / '2026-10-04-qwen-thinking-summary.json').read_text())
cases = json.loads((root / '2026-10-03-summary-focused-cases.json').read_text())
assert report['status'] == 'completed' and not report['errors'] and report['bundleBytesUnchanged']
assert report['probeSHA256'] == hashlib.sha256((root / 'probe-gpu-thinking-summary.mjs').read_bytes()).hexdigest()
assert report['modelId'] == 'Qwen3-1.7B-q4f16_1-MLC'
assert report['cases'] == cases and report['variants'] == ['current', 'thinking']
assert report['repetitions'] == 1 and len(report['results']) == 12
assert {(r['id'], r['variant']) for r in report['results']} == {(c['id'], v) for c in cases for v in report['variants']}
for row in report['results']:
    case = next(c for c in cases if c['id'] == row['id'])
    assert row['source'] == case['source'] and row['instruction'] == case['instruction']
    assert row['previewCount'] == 0 and row['isolated']
    assert len(row['inputs']) == len(row['raw']) == 1
    assert row['inputs'][0]['modelId'] == [report['modelId']]
    request = row['inputs'][0]['request']
    raw = row['raw'][0]
    assert raw['stopReason'] == 'stop'
    thought = re.match(r'^\s*<think>([\s\S]*?)</think>', raw['text'])
    assert thought
    if row['variant'] == 'thinking':
        assert thought.group(1).strip()
        assert request['extra_body']['enable_thinking'] is True and 'response_format' not in request
        assert request['temperature'] == .6 and request['top_p'] == .95 and request['max_tokens'] == 2048
        assert all('/no_think' not in m['content'] for m in request['messages'])
        assert request['messages'][-1]['content'].endswith('/think')
    else:
        assert not thought.group(1).strip()
        assert request['extra_body']['enable_thinking'] is False and request['response_format']['schema']
        assert request['temperature'] == 0 and request['max_tokens'] == 512
    if row['documentUnchanged']:
        assert row['output'] == row['selected'] and row['errors']
    else:
        assert not row['errors'] and row['undoExact'] and row['redoExact']
        assert row['undoText'] == row['selected'] and row['redoText'] == row['output']
assert sum(r['documentUnchanged'] for r in report['results']) == 1
assert not report['externalRequests']  # observed warm-profile run, not offline/privacy proof
print('12 native inferences, six nonempty reasoning responses, request controls, 11 Undo/Redo and unchanged refusal verified')
