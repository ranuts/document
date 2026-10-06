"""Check real browser media preference changes and scrolling requests."""
import hashlib
import json
from pathlib import Path
root = Path(__file__).parent
r = json.loads((root / '2026-10-04-chat-reduced-motion-browser.json').read_text())
assert r['status'] == 'completed' and not r['errors']
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-chat-reduced-motion-browser.mjs').read_bytes()).hexdigest()
assert r['sourceSHA256'] == hashlib.sha256((root.parent.parent / 'packages/chat-ui/src/chat-view.ts').read_bytes()).hexdigest()
assert [x['preference'] for x in r['results']] == ['reduce','no-preference','reduce']
for x in r['results']:
    assert x['matches'] == (x['preference'] == 'reduce')
    assert len(x['calls']) == 1 and x['calls'][0]['top'] > 0
    assert x['calls'][0]['behavior'] == ('auto' if x['matches'] else 'smooth')
    assert abs(x['gap']) <= 2
print('Browser preference switches select auto/smooth/auto on the same view and reach latest content')
