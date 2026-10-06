"""Check field-specific validity and a corrected real local request."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
r = json.loads((root / '2026-10-04-sampling-input-validity.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and len(r['rows']) == 1
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-sampling-input-validity.mjs').read_bytes()).hexdigest()
x = r['rows'][0]
assert x['invalidFields'] == {'systemPrompt': 'false', 'temperature': 'false', 'topP': 'false', 'maxTokens': 'true'}
assert x['correctedFields'] == {k: 'false' for k in x['invalidFields']}
assert x['nativeValidity'] == {k: True for k in x['correctedFields']}
assert not x['errors'] and x['previews'] == 0 and x['before'] == x['after'] == '\r\n'
assert len(x['inputs']) == 1 and x['inputs'][0]['modelId'] == ['Qwen3-1.7B-q4f16_1-MLC']
q = x['inputs'][0]['request']
assert (q['temperature'], q['top_p'], q['max_tokens']) == (0.35, 0.005, 96)
assert q['stream'] and q['messages'][0]['content'] == 'You are concise. Answer in English.\n/no_think'
assert x['reply'].startswith('Hello') and x['stats']
print('Fractional sampling inputs are natively valid and reach the actual local stream.')
