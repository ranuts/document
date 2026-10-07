"""Verify bounded actual-device fault/retry evidence, not full acceptance."""
import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parent
prefix = '2026-10-07-default-gpu-loss-cpu-retry-without-sw'
binding = json.loads((root / (prefix + '-bindings.json')).read_text())
assert binding['processExitCode'] == 0
for name, digest in binding['evidenceSHA256'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, name
report = json.loads((root / (prefix + '.json')).read_text())
assert report['finished'] and report['contextClosed'] and not report.get('error')
assert report['workerHeaders']['cross-origin-embedder-policy'] == 'require-corp'
assert 'Model loaded' in report['loadedNote'] and 'Model loaded' in report['retryNote']
loss = report['afterLoss']
assert any(message['kind'] == 'diagnostic-device-destroyed' and message['count'] > 0 for message in loss['messages'])
assert len(loss['requests']) == 0 and not loss['inputDisabled'] and not loss['chatErrors']
assert loss['allWorkers'] == report['workersBeforeLoss'] and len(loss['allWorkers']) == 1
assert loss['allWorkers'][0].endswith('/assets/webllm.worker-CMk6FPDh.js?diagnostic=default-loss-20261007')
assert any(m['kind']=='diagnostic-worker-ready' for m in loss['messages'])
assert report['documentBefore'] == report['documentAfter']
retry = report['afterRetry']
assert len(retry['requests']) == 0 and retry['workers'] == 1 and not retry['inputDisabled']
assert retry['chatErrors'] == loss['chatErrors']
assert any(not message['interrupted'] and message['text'].strip() for message in retry['assistants'])
assert loss['note'] == 'Load model' and loss['status'] == ''
assert report['currentEditor'] and any(url.endswith('/assets/' + report['currentEditor']) for url in report['editorScripts'])
assert not report['errors']
assert report['controller'] is None
assert all(row['unregistered'] for row in report['serviceWorkerSetup']['removed'])
assert report['loadedStatus'] == 'WebGPU · Qwen3 · 1.7B'
assert report['retryStatus'] == 'CPU · Qwen3 · 0.6B'
assert report['cpuBeforeRetry'] == {'loads':0,'completions':0}
assert report['cpuAfterRetry'] == {'loads':1,'completions':1}
print('Default GPU loss, no automatic CPU replay and explicit real CPU retry verified; capability loss is simulated, not full physical acceptance.')
