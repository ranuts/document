"""Check browser keyboard actions and simulated composition-event protection."""
import hashlib
import json
from pathlib import Path
root = Path(__file__).parent
r = json.loads((root / '2026-10-04-chat-keyboard-browser.json').read_text())
assert r['status'] == 'completed' and not r['errors']
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-chat-keyboard-browser.mjs').read_bytes()).hexdigest()
assert r['sourceSHA256'] == hashlib.sha256((root.parent.parent / 'packages/chat-ui/src/chat-view.ts').read_bytes()).hexdigest()
rows = {x['id']: x for x in r['results']}
assert len(rows) == len(r['results']) == 8
assert rows['shift-enter']['value'] == '中文消息\n' and rows['shift-enter']['sent'] == []
assert rows['enter-send']['sent'] == ['中文消息\n'] and rows['enter-send']['value'] == ''
for key in ('composition-enter', 'legacy-229'):
    assert rows[key]['sent'] == ['中文消息\n'] and rows[key]['value'].startswith('正在选词')
assert rows['after-composition']['sent'] == ['中文消息\n', '继续发送']
assert rows['running-locked']['disabled'] and rows['running-locked']['value'] == '保留草稿'
assert rows['running-locked']['sent'] == rows['after-composition']['sent']
for key in ('unlocked-send', 'empty-enter'):
    assert rows[key]['value'] == '' and rows[key]['sent'] == ['中文消息\n', '继续发送', '保留草稿']
print('Eight browser keyboard checkpoints verified; physical OS IME remains outside scope')
