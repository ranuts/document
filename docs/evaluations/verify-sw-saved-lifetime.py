"""Verify bounded saved-session diagnostics, not product migration acceptance."""
import hashlib
import json
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parent


def digest(name):
    return hashlib.sha256((root / name).read_bytes()).hexdigest()


for name in ['2026-10-03-sw-saved-full-chromium.json',
             '2026-10-03-sw-saved-response-trace.json']:
    report = json.loads((root / name).read_text())
    assert report['passed'] is False
    assert report['completeMigrationPassed'] is False
    assert 'Candidate controlling version did not arrive' in report['error']
    assert report['probeSha256'] == digest('probe-vendor-csp-two-build.mjs')
    driver = report['browserDriver']
    assert driver['channel'] == 'chromium'
    assert driver['sha256'] == digest('probe-sw-browser-channel.mjs')
    row, = report['upgrade']
    checkpoint = row['dirtyCheckpoint']
    assert checkpoint['dirtyBefore'] == checkpoint['dirtyAfter'] == 'OLD_UNSAVED_docx\r\n'
    assert checkpoint['oldSavedBytes'] > 0
    observations = row['controllerObservations']
    assert len(observations) >= 10
    for item in observations:
        assert item['observedVersion']['vendorVersion'] == report['vendor']
        assert item['waitingVersion']['vendorVersion'] == report['candidateVendor']
        assert item['waitingState'] == 'installed'
        assert item['clients']['editors'] == 0
    if 'saveLifetimeTrace' not in report:
        continue
    trace = report['saveLifetimeTrace']
    assert trace['sha256'] == digest('probe-sw-save-lifetime.mjs')
    assert not trace['errors'] and not trace.get('truncated')
    generations = Counter()
    operations = {}
    counts = Counter()
    for event in trace['events']:
        target = event['target']['targetId']
        kind = event['kind']
        counts[kind] += 1
        if kind == 'realm-created':
            generations[target] += 1
        if 'id' in event:
            key = (target, generations[target], event['id'])
            operations.setdefault(key, set()).add(kind)
    expected = {'wait-start': {'wait-start', 'wait-settle'},
                'put-start': {'put-start', 'put-settle'},
                'respond-start': {'respond-start', 'respond-ready', 'respond-handled'},
                'fetch-start': {'fetch-start', 'fetch-handled'}}
    for kinds in operations.values():
        matches = [value for key, value in expected.items() if key in kinds]
        assert len(matches) == 1 and kinds == matches[0], kinds
    assert max(generations.values()) >= 2
    assert counts['switch-received'] >= 1 and counts['respond-start'] >= 100
    print(json.dumps({'report': name, 'recordedOperations': len(operations),
                      'events': counts, 'migrationAccepted': False}))
print('Saved-session diagnostic evidence verified; browser internal idleness remains unproven.')
