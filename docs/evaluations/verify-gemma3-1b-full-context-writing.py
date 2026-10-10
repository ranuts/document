"""Check captured browser mechanics; semantic quality requires separate review."""
import argparse
import hashlib
import json
from pathlib import Path
parser = argparse.ArgumentParser()
parser.add_argument('--partial', action='store_true', help='Validate recorded prefix only; does not certify completion')
args = parser.parse_args()
root = Path(__file__).parent
r = json.loads((root / '2026-10-04-gemma3-1b-full-context-writing.json').read_text())
cases = json.loads((root / '2026-10-04-seven-language-writing-cases.json').read_text())
assert r['cases'] == cases and len(cases) == 21
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-gemma3-1b-full-context-writing.mjs').read_bytes()).hexdigest()
assert r['modelId'] == 'gemma3-1b-it-q4f16_1-MLC'
assert r['engine'] == 'WebGPU · ' + r['modelId'] and not r['workerFailures'] and not r['errors']
assert r['variants'] == ['current'] and r['repetitions'] == 1
if not args.partial:
    assert r['status'] == 'completed' and len(r['results']) == 21 and r['bundleBytesUnchanged']
else:
    assert 0 < len(r['results']) <= 21
for c, x in zip(cases, r['results'], strict=False):
    assert all(x[k] == c[k] for k in c)
    assert x['selected'] == c['source'] + '\r\n'
    assert x['previewCount'] == 0 and x['isolated']
    assert len(x['inputs']) == len(x['raw']) == 1
    call = x['inputs'][0]
    assert call['modelId'] == [r['modelId']]
    assert call['chatOpts'] == [{'context_window_size': 4096, 'sliding_window_size': -1, 'attention_sink_size': 0}]
    q = call['request']
    assert q['temperature'] == 0 and q['max_tokens'] == 512 and q['response_format']['schema']
    data = json.loads(q['messages'][-1]['content'].split('\n')[-1])
    assert data['task'] == c['task'] and data['text'] == x['selected'].replace('\r\n', '\n')
    assert data['instruction'] == c['instruction']
    assert data['targetLanguage'] == (c['targetLanguage'] if c['task'] == 'translate' else 'source')
    assert x['raw'][0]['stopReason'] in ('stop', 'length')
    if x['documentUnchanged']:
        assert x['errors'] and x['output'] == x['selected']
    else:
        assert not x['errors'] and x['undoExact'] and x['redoExact']
        assert x['undoText'] == x['selected'] and x['redoText'] == x['output']
print(f"{len(r['results'])} recorded cases mechanically verified; {'PREFIX ONLY, completion unproven' if args.partial else 'complete run, semantic quality not certified'}")
