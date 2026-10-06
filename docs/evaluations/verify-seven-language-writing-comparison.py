"""Verify comparison controls and native mechanics, not semantic quality."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
cases = json.loads((root / '2026-10-04-seven-language-writing-cases.json').read_text())
reports = []
for suffix, model, refused in (
    ('current', 'Qwen3-1.7B-q4f16_1-MLC', 9),
    ('qwen35-2b', 'Qwen3.5-2B-q4f16_1-MLC', 13),
):
    r = json.loads((root / f'2026-10-04-seven-language-writing-{suffix}.json').read_text())
    assert r['status'] == 'completed' and not r['errors'] and r['bundleBytesUnchanged']
    assert r['probeSHA256'] == hashlib.sha256((root / 'probe-gpu-seven-language-writing.mjs').read_bytes()).hexdigest()
    assert r['modelId'] == model and r['cases'] == cases
    assert r['variants'] == ['current'] and r['repetitions'] == 1
    assert len(r['results']) == len(cases) == 21 and not r['externalRequests']
    for row, case in zip(r['results'], cases):
        assert row['id'] == case['id']
        for key in ('source', 'instruction', 'rubric'):
            assert row[key] == case[key]
        assert row['selected'].removesuffix('\r\n') == case['source']
        assert row['isolated'] and row['previewCount'] == 0
        assert len(row['inputs']) == len(row['raw']) == 1
        assert row['inputs'][0]['modelId'] == [model]
        q = row['inputs'][0]['request']
        assert q['temperature'] == 0 and q['max_tokens'] == 512
        assert q['extra_body']['enable_thinking'] is False and q['response_format']['schema']
        data = json.loads(q['messages'][-1]['content'].split('\n')[-1])
        assert data['task'] == case['task'] and data['instruction'] == case['instruction']
        assert data['text'] == row['selected'].replace('\r\n', '\n')
        assert data['targetLanguage'] == (case['targetLanguage'] if case['task'] == 'translate' else 'source')
        assert row['raw'][0]['stopReason'] == 'stop'
        if row['documentUnchanged']:
            assert row['errors'] and row['output'] == row['selected']
        else:
            assert not row['errors'] and row['undoExact'] and row['redoExact']
            assert row['undoText'] == row['selected'] and row['redoText'] == row['output']
    assert sum(row['documentUnchanged'] for row in r['results']) == refused
    reports.append(r)
assert reports[0]['bundleHashes'] == reports[1]['bundleHashes']
for a, b in zip(reports[0]['results'], reports[1]['results']):
    assert a['inputs'][0]['request'] == b['inputs'][0]['request']
print('42 actual tasks: identical requests, 20 exact Undo/Redo edits, 22 source-preserving refusals; semantics require review')
