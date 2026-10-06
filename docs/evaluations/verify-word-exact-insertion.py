"""Check schema-bound Word insertion, normalizing native CR line breaks only."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
r = json.loads((root / '2026-10-04-word-exact-insertion.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and len(r['rows']) == 2
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-word-exact-insertion.mjs').read_bytes()).hexdigest()
assert r['cases'] == json.loads((root / '2026-10-04-ppt-long-text-cases.json').read_text())
for c, x in zip(r['cases'], r['rows']):
    assert x['id'] == c['id'] and x['text'] == c['text']
    assert x['before'] == '\r\n' and not x['errors'] and x['previews'] == 0
    assert x['after'].replace('\r\n', '\n').replace('\r', '\n') == c['text'] + '\n'
    assert x['undoExact'] and x['redoExact'] and x['undo'] == x['before'] and x['redo'] == x['after']
    assert len(x['inputs']) == 1 and x['inputs'][0]['modelId'] == ['Qwen3-1.7B-q4f16_1-MLC']
    q = x['inputs'][0]['request']
    assert q['temperature'] == 0 and q['max_tokens'] == 512
    operations = json.loads(q['response_format']['schema'])['anyOf']
    assert len(operations) == 2
    assert [o['properties']['tool']['enum'] for o in operations] == [['insert_text'], ['unsupported']]
    assert operations[0]['properties']['input']['properties']['text']['enum'] == [c['text']]
# Preserve the original probe's CRLF-only comparison and its false negative.
assert r['rows'][0]['literalExact'] is False and r['rows'][1]['literalExact'] is True
print('Two exact source insertions after native newline normalization; exact native Undo/Redo verified.')
