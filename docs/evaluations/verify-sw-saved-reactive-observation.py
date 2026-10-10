"""Verify event-based observations and actual per-Word outcomes, not all-type production acceptance."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
for suffix, stop in [('on', False), ('off', True)]:
    report = json.loads((root / f'2026-10-03-sw-saved-reactive-prefetch-{suffix}.json').read_text())
    assert report['passed'] is False and report['completeMigrationPassed'] is False
    assert report['probeSha256'] == hashlib.sha256((root / 'probe-vendor-csp-two-build.mjs').read_bytes()).hexdigest()
    driver = report['reactiveObservationDriver']
    assert driver['sha256'] == hashlib.sha256((root / 'probe-sw-saved-reactive-observation.mjs').read_bytes()).hexdigest()
    assert report['browserDriver']['channel'] == 'chromium'
    assert report['browserDriver']['sha256'] == hashlib.sha256((root / 'probe-sw-browser-channel.mjs').read_bytes()).hexdigest()
    assert driver['stopPrefetch'] is stop
    observation, = driver['observations']
    assert observation['boundMs'] == 55000
    assert observation['finished'] >= observation['started']
    reason = observation['result']['reason']
    assert reason in ['timeout', 'controllerchange', 'already-observed']
    if reason == 'timeout':
        assert observation['finished'] - observation['started'] >= 54000
    else:
        assert observation['result']['event']['kind'] == 'controllerchange'
        assert observation['result']['event']['time'] <= observation['finished']
    early = [e for e in driver['events'] if e['time'] <= observation['finished']]
    assert not any(e['kind'] == 'missing-hook' for e in early)
    states = [e for e in early if e['kind'] == 'prefetch-state']
    assert len(states) == 1 and states[0]['leaving'] is stop
    fetches = [e for e in early if e['kind'] == 'prefetch-fetch']
    assert bool(fetches) is not stop
    upgrade, = report['upgrade']
    checkpoint = upgrade['dirtyCheckpoint']
    assert checkpoint['dirtyBefore'] == checkpoint['dirtyAfter'] == 'OLD_UNSAVED_docx\r\n'
    assert checkpoint['oldSavedBytes'] > 0
    if report.get('error'):
        assert report['error'] == 'Error: Candidate controlling version did not arrive'
        assert not report['cold'] and not report['offline']
        for item in upgrade['controllerObservations']:
            assert item['observedVersion']['vendorVersion'] == report['vendor']
            assert item['waitingVersion']['vendorVersion'] == report['candidateVendor']
            assert item['clients']['editors'] == 0
    else:
        assert not report['errors']
        assert upgrade['newControllerVersion']['vendorVersion'] == report['candidateVendor']
        assert upgrade['oldSavedReopenedText'] == checkpoint['dirtyBefore']
        cold, = report['cold']
        assert cold['reopenExact'] and cold['nativeSave']['failure'] is None
        assert cold['nativeSave']['bytes'] > 0
        assert cold['edited'] == cold['redone'] == cold['reopenedText']
        assert cold['undone'] != cold['edited']
        offline, = report['offline']
        assert offline['isolated'] and offline['iframeIsolated'] and offline['networkRejected']
        assert offline['upstreamResponses'] == offline['foreignRequests'] == 0
        assert offline['controls']['save']['hit']
        assert all(offline['controls'][k] is False for k in ['inline', 'event', 'foreign'])
    print(json.dumps({'stopPrefetch': stop, 'observerReason': reason,
                      'observerMs': observation['finished'] - observation['started'],
                      'wordMigrationCompleted': not bool(report.get('error')),
                      'productionMigrationAccepted': False}))
