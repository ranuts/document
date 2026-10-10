"""Verify one diagnostic Word migration; never claim automatic product acceptance."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
report = json.loads((root / '2026-10-03-sw-saved-no-prefetch.json').read_text())
assert report['passed'] is False and report['completeMigrationPassed'] is False
assert not report.get('error') and not report['errors']
assert report['probeSha256'] == hashlib.sha256((root / 'probe-vendor-csp-two-build.mjs').read_bytes()).hexdigest()
for field, filename in [('browserDriver', 'probe-sw-browser-channel.mjs'),
                        ('quietObservationDriver', 'probe-sw-saved-quiet-observation.mjs'),
                        ('prefetchControlDriver', 'probe-sw-saved-no-prefetch.mjs')]:
    assert report[field]['sha256'] == hashlib.sha256((root / filename).read_bytes()).hexdigest()
quiet, = report['quietObservationDriver']['events']
assert quiet['quietMs'] == 40000 and quiet['finished'] - quiet['started'] >= 40000
events = report['prefetchControlDriver']['events']
stopped = [e for e in events if e['kind'] == 'stopped' and e['time'] <= quiet['started']]
assert len(stopped) == 1 and stopped[0]['leaving'] is True
assert not any(e['kind'] == 'missing-hook' for e in events)
assert not any(e['kind'] == 'prefetch-fetch' and e['time'] < quiet['finished'] for e in events)
upgrade, = report['upgrade']
assert upgrade['type'] == 'docx'
checkpoint = upgrade['dirtyCheckpoint']
assert checkpoint['dirtyBefore'] == checkpoint['dirtyAfter'] == 'OLD_UNSAVED_docx\r\n'
assert checkpoint['oldSavedBytes'] > 0
assert upgrade['newControllerVersion']['vendorVersion'] == report['candidateVendor']
assert upgrade['oldSavedReopenedText'] == checkpoint['dirtyBefore']
assert upgrade['controllerObservations'][0]['time'] >= quiet['finished']
cold, = report['cold']
assert cold['reopenExact'] is True and cold['nativeSave']['bytes'] > 0
assert cold['nativeSave']['failure'] is None
assert cold['edited'] == cold['redone'] == cold['reopenedText']
assert cold['undone'] != cold['edited']
offline, = report['offline']
assert offline['isolated'] and offline['iframeIsolated'] and offline['networkRejected']
assert offline['upstreamResponses'] == offline['foreignRequests'] == 0
assert offline['controls']['save']['hit'] is True
assert all(offline['controls'][k] is False for k in ['inline', 'event', 'foreign'])
print('Diagnostic saved Word migration/native/offline evidence verified; production migration gate remains false.')
