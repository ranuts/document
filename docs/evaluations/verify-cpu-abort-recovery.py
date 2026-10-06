"""Check controlled SDK abort handling and real CPU reload/reply."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
r = json.loads((root / '2026-10-04-cpu-abort-recovery.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and len(r['rows']) == 1
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-cpu-abort-recovery.mjs').read_bytes()).hexdigest()
x = r['rows'][0]
assert x['engine'] == 'CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf'
assert x['failureState'] == {'armed': False, 'injected': 1, 'terminated': 1}
assert len(x['errors']) == 1 and x['errors'][0].startswith('The request could not be completed.')
assert x['reply'] == [] and x['stats'] == '' and x['previews'] == 0
assert x['before'] == x['after'] == x['recoveryDocument'] == '\r\n'
assert x['recoveryReply'] == 'Hello!Write to document'
print('Controlled object abort settles CPU request and terminates Worker; manual reload produces a real reply.')
