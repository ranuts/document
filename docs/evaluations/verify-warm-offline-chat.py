"""Verify actual GPU and CPU chat after browser-context offline transition."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
for engine in ['gpu', 'cpu']:
    r = json.loads((root / f'2026-10-04-warm-{engine}-offline-chat.json').read_text())
    assert r['status'] == 'completed' and not r['errors'] and len(r['rows']) == 1
    assert r['probeSHA256'] == hashlib.sha256((root / f'probe-warm-{engine}-offline-chat.mjs').read_bytes()).hexdigest()
    assert r['offlineRequests'] == []
    x = r['rows'][0]
    assert x['browserOnline'] is False and x['reply'].startswith('Hello!') and x['stats']
    assert not x['errors'] and x['previews'] == 0 and x['before'] == x['after'] == '\r\n'
    if engine == 'gpu':
        assert x['engine'] == 'WebGPU · Qwen3-1.7B-q4f16_1-MLC'
        assert len(x['inputs']) == 1 and x['inputs'][0]['modelId'] == ['Qwen3-1.7B-q4f16_1-MLC']
        q = x['inputs'][0]['request']
        assert q['stream'] and (q['temperature'], q['top_p'], q['max_tokens']) == (0.4, 0.85, 96)
        assert q['messages'][-1]['content'].endswith('Reply with a brief greeting.')
    else:
        assert x['engine'] == 'CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf' and x['inputs'] == []
print('Loaded GPU and CPU models both reply after browser offline transition; no observed page requests.')
