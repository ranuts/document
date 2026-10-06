import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
base = root / 'docs/evaluations'
report = json.loads((base / '2026-10-04-chat-browser-security.json').read_text())
assert hashlib.sha256((base / 'probe-chat-browser-security.mjs').read_bytes()).hexdigest() == report['probeSHA256']
for path, digest in report['sources'].items():
    assert hashlib.sha256((root / path).read_bytes()).hexdigest() == digest, path
assert report['passed'] and report['requests'] == report['errors'] == report['dialogs'] == []
assert len(report['results']) == 48
payloads = {row['payload'] for row in report['results']}
assert len(payloads) == 12
for payload in payloads:
    rows = [row for row in report['results'] if row['payload'] == payload]
    assert len(rows) == 4 and {row['mode'] for row in rows} == {'agent', 'user', 'tool', 'stream'}
    assert all(row['injected'] == 0 and row['unsafe'] is False and row['handlers'] is False for row in rows)
before = json.loads((base / '2026-10-04-chat-browser-security-before.json').read_text())
assert hashlib.sha256((base / 'probe-chat-browser-security-before.mjs').read_bytes()).hexdigest() == before['probeSHA256']
assert before['passed'] is False and before['results'] == [] and 'Timeout' in before['error']
print('PASS: 12 payloads × 4 real Chromium rendering paths; failed harness preserved')
