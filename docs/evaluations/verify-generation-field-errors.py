"""Check field-specific validity and a corrected real local request."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
r = json.loads((root / '2026-10-04-generation-field-errors.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and len(r['rows']) == 1
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-generation-field-errors.mjs').read_bytes()).hexdigest()
x = r['rows'][0]
assert x['invalidFields'] == {'systemPrompt': 'false', 'temperature': 'false', 'topP': 'false', 'maxTokens': 'true'}
assert x['correctedFields'] == {k: 'false' for k in x['invalidFields']}
assert not x['errors'] and x['previews'] == 0 and x['before'] == x['after'] == '\r\n'
assert len(x['inputs']) == 1 and x['inputs'][0]['modelId'] == ['Qwen3-1.7B-q4f16_1-MLC']
q = x['inputs'][0]['request']
assert (q['temperature'], q['top_p'], q['max_tokens']) == (0.4, 0.85, 96)
assert q['stream'] and q['messages'][0]['content'] == 'You are concise. Answer in English.\n/no_think'
assert x['reply'].startswith('Hello') and x['stats']
print('Invalid token field isolated; correction clears errors and reaches actual local stream.')
