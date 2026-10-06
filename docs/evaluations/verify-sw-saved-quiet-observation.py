"""Keep delayed observation separate from a successful product migration."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
report = json.loads((root / '2026-10-03-sw-saved-quiet-observation.json').read_text())
assert report['passed'] is False and report['completeMigrationPassed'] is False
assert report['error'] == 'Error: Candidate controlling version did not arrive'
assert report['probeSha256'] == hashlib.sha256((root / 'probe-vendor-csp-two-build.mjs').read_bytes()).hexdigest()
assert report['browserDriver']['channel'] == 'chromium'
assert report['browserDriver']['sha256'] == hashlib.sha256((root / 'probe-sw-browser-channel.mjs').read_bytes()).hexdigest()
driver = report['quietObservationDriver']
assert driver['sha256'] == hashlib.sha256((root / 'probe-sw-saved-quiet-observation.mjs').read_bytes()).hexdigest()
event, = driver['events']
assert event['quietMs'] == 40000 and event['finished'] - event['started'] >= 40000
row, = report['upgrade']
assert row['landingUrl'] == event['url']
checkpoint = row['dirtyCheckpoint']
assert checkpoint['dirtyBefore'] == checkpoint['dirtyAfter'] == 'OLD_UNSAVED_docx\r\n'
assert checkpoint['oldSavedBytes'] > 0
observations = row['controllerObservations']
assert len(observations) >= 10 and observations[0]['time'] >= event['finished']
for item in observations:
    assert item['observedVersion']['vendorVersion'] == report['vendor']
    assert item['waitingVersion']['vendorVersion'] == report['candidateVendor']
    assert item['waitingState'] == 'installed' and item['clients']['editors'] == 0
assert any(item['type'] == 'SKIP_WAITING' for item in row['landingLifecycle'])
print('Saved Word quiet-observer failure verified; product migration remains unaccepted.')
