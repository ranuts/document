"""Check controlled SDK abort handling and real CPU reload/reply."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
r = json.loads((root / '2026-10-04-cpu-reload-guidance.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and len(r['rows']) == 1
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-cpu-reload-guidance.mjs').read_bytes()).hexdigest()
x = r['rows'][0]
assert x['engine'] == 'CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf'
assert x['failureState'] == {'armed': False, 'injected': 1, 'terminated': 1}
assert len(x['errors']) == 1 and x['errors'][0] == 'Reload the model in settings, then try your request again.Restore request'
assert x['reply'] == [] and x['stats'] == '' and x['previews'] == 0
assert x['before'] == x['after'] == x['recoveryDocument'] == '\r\n'
assert x['recoveryReply'] == 'Hello!Write to document'
print('CPU failure shows safe reload guidance; manual model reload produces a real reply.')
