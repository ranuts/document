"""Check real UI settings reaching a streaming local Worker request."""
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).parent
r = json.loads((root / '2026-10-04-configured-local-chat.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and len(r['rows']) == 1
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-configured-local-chat.mjs').read_bytes()).hexdigest()
x = r['rows'][0]
assert x['before'] == x['after'] == '\r\n' and not x['errors'] and x['previews'] == 0
assert len(x['inputs']) == 1 and x['inputs'][0]['modelId'] == ['Qwen3-1.7B-q4f16_1-MLC']
q = x['inputs'][0]['request']
assert (q['temperature'], q['top_p'], q['max_tokens']) == (0.4, 0.85, 96)
assert q['messages'][0] == {'role': 'system', 'content': 'You are concise. Answer in English.\n/no_think'}
assert q['messages'][-1]['content'].endswith('Reply with a brief greeting.')
assert q['stream'] and q['stream_options']['include_usage']
assert x['reply'] == 'Hello!Write to document'
assert re.fullmatch(r'Decode speed: [0-9]+\.[0-9] token/s · First token: [0-9]+\.[0-9]{2} s · 2 tokens', x['stats'])
before = json.loads((root / '2026-10-04-configured-local-chat-before.json').read_text())
assert before['status'] == 'failed' and "locator('.cui-msg-assistant')" in before['error']
print('Actual UI generation settings reach local stream; visible usage statistics present, document unchanged.')
