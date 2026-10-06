"""Check real conversation download and scoped in-memory deletion."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
r = json.loads((root / '2026-10-04-im-history-clean-export.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and len(r['rows']) == 1
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-im-history-clean-export.mjs').read_bytes()).hexdigest()
x = r['rows'][0]
assert x['reply'] == x['afterCancel'] == 'Hello!Write to document'
assert x['afterDelete'] == 0 and x['documentAfterDelete'] == x['before'] == x['after'] == '\r\n'
assert not x['errors'] and x['previews'] == 0
e = x['exported']
assert set(e) == {'version', 'activeId', 'sessions', 'exportedAt'} and e['version'] == 1
assert x['exportName'] == 'conversations-' + e['exportedAt'][:10] + '.json'
assert len(e['sessions']) == 1
s = e['sessions'][0]
assert set(s) == {'id', 'title', 'createdAt', 'updatedAt', 'messages'} and s['id'] == e['activeId']
assert s['messages'] == [{'role': 'user', 'content': 'Reply with a brief greeting.'}, {'role': 'assistant', 'content': [{'type': 'text', 'text': 'Hello!'}]}]
assert 'You are concise' not in json.dumps(e)
print('Actual conversation download, cancellation and current in-memory deletion verified; exported assistant text is clean.')
