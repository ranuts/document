"""Verify bounded actual-device fault/retry evidence, not full acceptance."""
import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parent
prefix = '2026-10-07-native-gpu-device-loss-fixed'
binding = json.loads((root / (prefix + '-bindings.json')).read_text())
assert binding['processExitCode'] == 0
for name, digest in binding['evidenceSHA256'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, name
report = json.loads((root / (prefix + '.json')).read_text())
assert report['finished'] and report['contextClosed'] and not report.get('error')
assert report['workerHeaders']['cross-origin-embedder-policy'] == 'require-corp'
assert 'Model loaded' in report['loadedNote'] and 'Model loaded' in report['retryNote']
assert report['partialBeforeLoss'] and any(text.strip() for text in report['partialBeforeLoss'])
loss = report['afterLoss']
assert any(message['kind'] == 'diagnostic-device-destroyed' and message['count'] > 0 for message in loss['messages'])
assert len(loss['requests']) == 1 and not loss['inputDisabled'] and loss['chatErrors']
# Native textContent included an English action label before interruption.
partial = report['partialBeforeLoss'][-1]
assert partial.endswith('Write to document')
partial = partial.removesuffix('Write to document')
assert partial and any(text.startswith(partial) for text in loss['assistants'])
assert report['documentBefore'] == report['documentAfter']
retry = report['afterRetry']
assert len(retry['requests']) == 2 and retry['workers'] == 2 and not retry['inputDisabled']
assert retry['chatErrors'] == loss['chatErrors']
assert any(not message['interrupted'] and message['text'].strip() for message in retry['assistants'])
assert loss['note'] == 'Load model' and loss['status'] == ''
assert report['currentEditor'] and any(url.endswith('/assets/' + report['currentEditor']) for url in report['editorScripts'])
assert not report['errors']
print('Current-production device-loss feedback, preserved partial output and explicit retry verified; not full device acceptance.')
