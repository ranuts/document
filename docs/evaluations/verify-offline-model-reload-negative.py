"""Preserve failed offline model reload observations, not acceptance."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
for engine in ['gpu', 'cpu']:
    r = json.loads((root / f'2026-10-04-{engine}-offline-model-reload.json').read_text())
    assert r['status'] == 'failed' and r['rows'] == []
    assert r['probeSHA256'] == hashlib.sha256((root / f'probe-{engine}-offline-model-reload.mjs').read_bytes()).hexdigest()
    assert 'Timeout 180000ms exceeded' in r['error']
    events = r['workerEvents']
    first = next(x for x in events if x['event'] == 'created' and (('/assets/webllm.worker-' in x['url']) if engine == 'gpu' else x['url'].startswith('blob:')))
    assert any(x['event'] == 'closed' and x['id'] == first['id'] for x in events)
    assert all(x['method'] == 'GET' and not x['hasBody'] for x in r['offlineRequests'])
    before = json.loads((root / f'2026-10-04-{engine}-offline-model-reload-before.json').read_text())
    assert before['status'] == 'failed' and 'not a <select>' in before['error']
    intermediate = json.loads((root / f'2026-10-04-{engine}-offline-model-reload-worker-check-before.json').read_text())
    assert intermediate['status'] == 'failed' and intermediate['error'] == 'Error: Initial Workers did not close'
    assert any(x['event'] == 'created' and '/spell/' in x['url'] for x in intermediate['workerEvents'])
    if engine == 'gpu':
        assert any('/assets/webllm.worker-' in x['url'] for x in r['offlineRequests'])
    else:
        assert any('/assets/wllama-' in x['url'] and x['url'].endswith('.wasm') for x in r['offlineRequests'])
        assert any('Failed to load' in error and '.wasm' in error for error in r['errors'])
print('Negative GPU/CPU offline reload evidence verified; no cache-reload acceptance.')
