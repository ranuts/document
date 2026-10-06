"""Verify actual Chromium list/table geometry, not native editor integration."""
import hashlib
import json
from pathlib import Path
root = Path(__file__).parent
r = json.loads((root / '2026-10-04-chat-final-scroll-browser.json').read_text())
assert r['passed'] and not r['errors'] and len(r['results']) == 8
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-chat-final-scroll-browser.mjs').read_bytes()).hexdigest()
workspace = root.parent.parent
for source, sha in r['sources'].items():
    assert hashlib.sha256((workspace / source).read_bytes()).hexdigest() == sha
assert {(x['width'], x['format'], x['atBottom']) for x in r['results']} == {(w,f,b) for w in (1280,390) for f in ('list','table') for b in (True,False)}
for x in r['results']:
    assert x['rendered'] and x['passed']
    before, after = x['before'], x['after']
    assert before['height'] > before['client'] > 0
    assert after['height'] > before['height'] and after['client'] == before['client']
    if x['atBottom']:
        assert abs(before['height'] - before['top'] - before['client']) <= 2
        assert abs(after['height'] - after['top'] - after['client']) <= 2
    else:
        assert abs(after['top'] - before['top']) <= 2
print('Eight actual browser layouts: final content follows latest, history reading stays fixed')
