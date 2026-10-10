import hashlib
import json
from pathlib import Path
root=Path(__file__).parent
r=json.loads((root/'2026-10-04-chat-clipboard-distinct-browser.json').read_text())
assert r['status']=='completed' and not r['errors']
assert r['probeSHA256']==hashlib.sha256((root/'probe-chat-clipboard-distinct-browser.mjs').read_bytes()).hexdigest()
assert r['sourceSHA256']==hashlib.sha256((root.parent.parent/'packages/chat-ui/src/chat-view.ts').read_bytes()).hexdigest()
a,b=r['results']
assert not a['blocked'] and a['label']=='Copied' and not a['disabled']
assert a['clipboard']==a['attempted']==r['text']
assert b['blocked'] and b['label']=='Could not copy' and not b['disabled']
assert b['attempted']!=a['attempted'] and b['clipboard']==a['clipboard']
print('Native clipboard exact copy and policy-blocked distinct write: honest feedback, enabled retry, previous clipboard preserved')
