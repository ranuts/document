"""Check October 7 evidence identity and narrow completed native claims."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evaluation = root / 'docs/evaluations'
record = json.loads((evaluation / '2026-10-07-current-state-reconciliation.json').read_text())
assert record['qualityAccepted'] is False and record['fullDeviceMatrixAccepted'] is False
for name, expected in record['sourceHashes'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name
for name, expected in record['evidenceHashes'].items():
    assert hashlib.sha256((evaluation / name).read_bytes()).hexdigest() == expected, name
for prefix in ['2026-10-07-cpu-offline-word', '2026-10-07-offline-ppt']:
    binding = json.loads((evaluation / (prefix + '-bindings.json')).read_text())
    for name, expected in binding['evidenceSHA256'].items():
        assert hashlib.sha256((evaluation / name).read_bytes()).hexdigest() == expected, name
    for suffix in ['chain', 'reopen']:
        receipt = json.loads((evaluation / (prefix + '-' + suffix + '.json')).read_text())
        assert receipt['passed'] and receipt['closed'] and receipt['homeFromSW']
        assert not receipt['errors']
    chain = json.loads((evaluation / (prefix + '-chain.json')).read_text())
    assert chain['saved'] and not chain['chatErrors']
    assert chain['undo'] == chain['before'] and chain['redo'] == chain['after']
print('Present source and completed narrow evidence bound; full semantic/device acceptance remains false.')
