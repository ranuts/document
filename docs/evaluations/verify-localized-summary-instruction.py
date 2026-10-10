"""Bind localized-instruction regression controls and native edit mechanics."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
cases = json.loads((root / '2026-10-04-localized-summary-instruction-cases.json').read_text())
r = json.loads((root / '2026-10-04-localized-summary-instruction.json').read_text())
baseline = json.loads((root / '2026-10-04-seven-language-writing-current.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-gpu-seven-language-writing.mjs').read_bytes()).hexdigest()
assert r['modelId'] == baseline['modelId'] == 'Qwen3-1.7B-q4f16_1-MLC'
assert r['cases'] == cases and len(r['results']) == len(cases) == 7
assert r['variants'] == ['current'] and r['repetitions'] == 1
assert not r['externalRequests']
for c, x in zip(cases, r['results']):
    old = next(row for row in baseline['results'] if row['id'] == c['id'])
    assert c['task'] == 'summarize' and x['id'] == c['id']
    for key in ('source', 'rubric'):
        assert x[key] == c[key] == old[key]
    assert x['instruction'] == c['instruction']
    assert x['selected'].removesuffix('\r\n') == c['source']
    assert x['isolated'] and x['previewCount'] == 0
    assert len(x['inputs']) == len(x['raw']) == 1
    assert x['inputs'][0]['modelId'] == [r['modelId']]
    q = x['inputs'][0]['request']
    oldq = old['inputs'][0]['request']
    data = json.loads(q['messages'][-1]['content'].split('\n')[-1])
    olddata = json.loads(oldq['messages'][-1]['content'].split('\n')[-1])
    assert data.pop('instruction') == c['instruction']
    olddata.pop('instruction')
    assert data == olddata
    assert q['messages'][:-1] == oldq['messages'][:-1]
    assert q['messages'][-1]['content'].rsplit('\n', 1)[0] == oldq['messages'][-1]['content'].rsplit('\n', 1)[0]
    assert {k: v for k, v in q.items() if k != 'messages'} == {k: v for k, v in oldq.items() if k != 'messages'}
    assert x['raw'][0]['stopReason'] == 'stop'
    if x['documentUnchanged']:
        assert x['errors'] and x['output'] == x['selected']
    else:
        assert not x['errors'] and x['undoExact'] and x['redoExact']
        assert x['undoText'] == x['selected'] and x['redoText'] == x['output']
print('Seven native summary controls verified; only instruction field differs from prior requests, semantic review required')
