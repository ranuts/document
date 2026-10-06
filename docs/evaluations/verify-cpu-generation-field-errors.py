"""Verify field recovery and real CPU chat, not internal parameter capture."""
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).parent
r = json.loads((root / '2026-10-04-cpu-generation-field-errors.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and len(r['rows']) == 1
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-cpu-generation-field-errors.mjs').read_bytes()).hexdigest()
x = r['rows'][0]
assert x['engine'] == 'CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf'
assert x['invalidFields'] == {'systemPrompt': 'false', 'temperature': 'false', 'topP': 'false', 'maxTokens': 'true'}
assert x['correctedFields'] == {k: 'false' for k in x['invalidFields']}
assert not x['errors'] and x['previews'] == 0 and x['before'] == x['after'] == '\r\n'
assert x['inputs'] == []  # GPU-only interceptor does not observe CPU requests.
assert x['reply'] == "Hello! Let me know if there's anything you need.Write to document"
assert re.fullmatch(r'Decode speed: [0-9]+\.[0-9] token/s · First text: [0-9]+\.[0-9]{2} s · Overall response rate: [0-9]+\.[0-9]{2} token/s · 13 tokens', x['stats'])
print('CPU chat after field recovery; formatted telemetry visible and document unchanged. No internal parameter proof.')
