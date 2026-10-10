"""Check seeded persistent caches support a new offline browser process."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
for engine in ['gpu', 'cpu']:
    r = json.loads((root / f'2026-10-04-{engine}-process-restart-offline-chat.json').read_text())
    assert r['status'] == 'completed' and not r['errors'] and r['closedSeedContext']
    assert r['probeSHA256'] == hashlib.sha256((root / f'probe-{engine}-process-restart-offline-chat.mjs').read_bytes()).hexdigest()
    assert len(r['rows']) == 1
    x = r['rows'][0]
    expected = 'WebGPU · Qwen3-1.7B-q4f16_1-MLC' if engine == 'gpu' else 'CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf'
    assert r['seedEngine'] == x['engine'] == expected
    assert r['seedState'] == x['coldState'] == {'controller': 'http://127.0.0.1:5193/sw.js?isolation=1', 'isolated': True}
    assert x['browserOnline'] is False and x['reply'] and x['stats']
    assert not x['errors'] and x['previews'] == 0 and x['before'] == x['after'] == '\r\n'
    if engine == 'gpu':
        assert x['reply'] == 'Hello!Write to document' and len(x['inputs']) == 1
        assert x['inputs'][0]['request']['messages'][-1]['content'].endswith('Reply with a brief greeting.')
    else:
        assert x['inputs'] == [] and x['reply'].startswith('Dear Editor,')
    plain = json.loads((root / f'2026-10-04-{engine}-plain-sw-offline-model-reload.json').read_text())
    assert plain['status'] == 'failed' and plain['rows'] == []
    assert plain['plainState'] == {'controller': 'http://127.0.0.1:5193/sw.js', 'isolated': True}
    assert plain['error'] == 'Error: Plain nonisolated SW state not established'
    assert plain['probeSHA256'] == hashlib.sha256((root / f'probe-{engine}-plain-sw-offline-model-reload.mjs').read_bytes()).hexdigest()
headers = json.loads((root / '2026-10-04-preview-isolation-headers.json').read_text())
assert headers['viteConfigSHA256'] == hashlib.sha256((root.parent.parent / 'vite.config.ts').read_bytes()).hexdigest()
assert all(x == {'status': 200, 'coop': 'same-origin', 'coep': 'require-corp'} for x in headers['headers'].values())
print('Cached GPU/CPU app and model startup in new offline browser processes verified; nonisolated mode not established.')
