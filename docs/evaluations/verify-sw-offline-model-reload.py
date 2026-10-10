"""Check disposed model Workers are replaced and reply offline under actual SW."""
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse

root = Path(__file__).parent
for engine in ['gpu', 'cpu']:
    r = json.loads((root / f'2026-10-04-{engine}-sw-offline-model-reload.json').read_text())
    assert r['status'] == 'completed' and not r['errors'] and len(r['rows']) == 1
    assert r['probeSHA256'] == hashlib.sha256((root / f'probe-{engine}-sw-offline-model-reload.mjs').read_bytes()).hexdigest()
    x = r['rows'][0]
    assert x['browserOnline'] is False and x['selectedProvider'] == 'webllm'
    assert r['initialController'] == x['swController']
    assert urlparse(x['swController']).path == '/sw.js' and urlparse(x['swController']).query == 'isolation=1'
    assert x['reply'] == 'Hello!Write to document' and x['stats']
    assert not x['errors'] and x['previews'] == 0 and x['before'] == x['after'] == '\r\n'
    events = r['workerEvents']
    initial = x['initialWorkerIds']
    assert len(initial) == (1 if engine == 'gpu' else 5)
    closes = []
    for worker_id in initial:
        closes.append(next(i for i, e in enumerate(events) if e['event'] == 'closed' and e['id'] == worker_id))
    fresh = [i for i, e in enumerate(events) if e['event'] == 'created' and e['id'] not in initial and (('/assets/webllm.worker-' in e['url']) if engine == 'gpu' else e['url'].startswith('blob:'))]
    assert len(fresh) == len(initial) and min(fresh) > max(closes)
    if engine == 'gpu':
        assert x['engine'] == 'WebGPU · Qwen3-1.7B-q4f16_1-MLC' and len(x['inputs']) == 1
    else:
        assert x['engine'] == 'CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf' and x['inputs'] == []
    before = json.loads((root / f'2026-10-04-{engine}-sw-offline-model-reload-before.json').read_text())
    assert before['status'] == 'failed' and 'Timeout 120000ms exceeded' in before['error']
print('GPU and CPU model Workers disposed, recreated, loaded and replied offline under isolation=1 SW.')
