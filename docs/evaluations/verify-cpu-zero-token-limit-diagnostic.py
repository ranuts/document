import hashlib
import json
from pathlib import Path

p = Path(__file__).parent
r = json.loads((p / '2026-10-04-cpu-zero-token-limit-diagnostic.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and r['bundleUnchanged']
assert r['probeSHA256'] == hashlib.sha256((p / 'probe-cpu-zero-token-limit-diagnostic.mjs').read_bytes()).hexdigest()
assert r['routeHits'] and r['engine'] == 'CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf'
assert len(r['cases']) == len(r['results']) == 1
x = r['results'][0]
assert x['text'] == 'Reply with hello.' and x['variant'] == 'zero-limit'
assert not x['errors'] and x['previews'] == 0
assert len(x['requests']) == len(x['replies']) == 1
z = x['requests'][0]
q = z['request']
assert z['before'] == z['after'] and z['originalMaxTokens'] == 96
assert q['max_tokens'] == 0 and q['temperature'] == 0 and q['top_p'] == 0.8 and q['stream']
assert q['messages'][0]['content'] == z['originalSystem']
assert q['messages'][1]['content'] == z['after']
assert x['replies'] == ['HelloWrite to document']
assert x['stats'].endswith('· 1 tokens')
print('Actual CPU SDK zero limit generated Hello and reported 1 output token; rejected as count-only preflight')
