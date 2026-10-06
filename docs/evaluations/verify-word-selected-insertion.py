"""Verify actual IM insertion over an existing native Word selection."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
r = json.loads((root / '2026-10-04-word-selected-insertion.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and len(r['rows']) == 1
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-word-selected-insertion.mjs').read_bytes()).hexdigest()
c, x = r['cases'][0], r['rows'][0]
assert c == {'id': 'selected-source', 'text': 'Replacement 四季 日本 ä', 'source': 'Selected original text 四季'}
assert x['id'] == c['id'] and x['text'] == c['text']
assert x['selected'] == x['before'] == c['source'] + '\r\n'
assert x['after'] == c['text'] + '\r\n' and x['literalExact']
assert x['undo'] == x['before'] and x['redo'] == x['after'] and x['undoExact'] and x['redoExact']
assert not x['errors'] and x['previews'] == 0 and len(x['inputs']) == 1
assert x['inputs'][0]['modelId'] == ['Qwen3-1.7B-q4f16_1-MLC']
q = x['inputs'][0]['request']
assert q['temperature'] == 0 and q['max_tokens'] == 512
ops = json.loads(q['response_format']['schema'])['anyOf']
assert [o['properties']['tool']['enum'] for o in ops] == [['insert_text'], ['unsupported']]
assert ops[0]['properties']['input']['properties']['text']['enum'] == [c['text']]
print('One actual selected Word insertion: exact replacement and native Undo/Redo verified.')
