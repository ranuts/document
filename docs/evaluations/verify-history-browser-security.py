"""Verify the recorded Chromium persisted-history security probe and source binding."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
report = json.loads((root / 'docs/evaluations/2026-10-04-history-browser-security.json').read_text())
driver = root / 'docs/evaluations/probe-history-browser-security.mjs'
assert hashlib.sha256(driver.read_bytes()).hexdigest() == report['probeSHA256']
for name, digest in report['sources'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, name
assert report['passed'] and report['restoredExactly'] and report['injected'] == 0
assert len(report['results']) == 48
assert {row['role'] for row in report['results']} == {'user', 'agent', 'tool', 'error'}
for role in ('user', 'agent', 'tool', 'error'):
    assert sum(row['role'] == role for row in report['results']) == 12
assert all(not row['unsafe'] and not row['handlers'] for row in report['results'])
assert not report['requests'] and not report['errors'] and not report['dialogs']
assert 'error' not in report
print('PASS: 48 persisted-history rendering cases; recorded driver and sources match')
