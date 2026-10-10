"""Check controlled startup fallback evidence; not physical-device acceptance."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
driver_hash = hashlib.sha256((root / 'probe-current-local-init-fallback.mjs').read_bytes()).hexdigest()
reports = []
for mode in ('adapter', 'worker'):
    r = json.loads((root / f'2026-10-04-local-init-fallback-{mode}.json').read_text())
    assert r['status'] == 'passed' and r['mode'] == mode
    assert r['probeSHA256'] == driver_hash and r['pluginBytesUnchanged']
    assert r['selectedProvider'] == 'webllm' and r['adapterDeniedCalls'] > 0
    assert 'CPU' in r['engine'] and '0.6B' in r['engine'] and 'Model loaded' in r['note']
    assert not r['visibleErrors'] and any('hello' in text.lower() for text in r['reply'])
    assert r['documentUnchanged'] and r['before'] == r['after']
    if mode == 'adapter':
        assert r['failedWorkerScripts'] == 0 and not r['errors']
        assert not any('webllm.worker' in e['url'] for e in r['workerEvents'])
    else:
        assert r['failedWorkerScripts'] == 1
        assert r['errors'] == ['Controlled GPU Worker initialization failure']
        gpu = next(e for e in r['workerEvents'] if e['event'] == 'closed' and 'webllm.worker' in e['url'])
        cpu = next(e for e in r['workerEvents'] if e['event'] == 'created' and e['url'].startswith('blob:'))
        assert gpu['time'] <= cpu['time']
    reports.append(r)
assert reports[0]['pluginSHA256'] == reports[1]['pluginSHA256']
print('Both controlled startup failures recover real CPU chat, with preserved Word text and failed GPU Worker closed before CPU startup')
