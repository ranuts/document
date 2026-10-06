"""Verify captured CPU SDK request and served diagnostic provenance."""
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse

root = Path(__file__).parent
r = json.loads((root / '2026-10-04-cpu-generation-request.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and len(r['rows']) == 1
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-cpu-generation-request.mjs').read_bytes()).hexdigest()
assert len(r['served']) == 1
s = r['served'][0]
bundle = root.parent.parent / 'dist' / urlparse(s['url']).path.lstrip('/')
original = bundle.read_text()
assert hashlib.sha256(original.encode()).hexdigest() == s['originalSHA256']
needle = 'c.createChatCompletion({messages:j(e,this.generation.systemPrompt??this.options.systemPrompt??ge)'
replacement = '(options=>{const {abortSignal,...data}=options;(window.__cpuRequests??=[]).push(structuredClone(data));return c.createChatCompletion(options)})({messages:j(e,this.generation.systemPrompt??this.options.systemPrompt??ge)'
assert original.count(needle) == 1
assert hashlib.sha256(original.replace(needle, replacement).encode()).hexdigest() == s['instrumentedSHA256']
x = r['rows'][0]
assert x['engine'] == 'CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf' and len(x['inputs']) == 1
q = x['inputs'][0]
assert (q['temperature'], q['top_p'], q['max_tokens']) == (0.4, 0.85, 96)
assert q['messages'][0] == {'role': 'system', 'content': 'You are concise. Answer in English.'}
assert q['messages'][-1]['content'].endswith('Reply with a brief greeting.')
assert q['stream'] and q['stream_options']['include_usage']
assert not x['errors'] and x['previews'] == 0 and x['before'] == x['after'] == '\r\n'
assert x['reply'] == 'Hello!Write to document' and x['stats']
print('Actual CPU SDK request preserves all four configured settings and produces a reply.')
