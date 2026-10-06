"""Verify real three-type migration reports, retaining the earlier polling failures."""
import hashlib
import json
import subprocess
from pathlib import Path

base = Path(__file__).resolve().parent


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


for name, mixed in [('2026-10-03-sw-prefetch-fix-reactive-three-types.json', False),
                    ('2026-10-03-sw-prefetch-before-after-migration.json', True)]:
    report = json.loads((base / name).read_text())
    assert report['passed'] and report['completeMigrationPassed']
    assert not report.get('error') and not report['errors']
    assert report['probeSha256'] == sha(base / 'probe-vendor-csp-two-build.mjs')
    driver = report['reactiveObservationDriver']
    assert driver['sha256'] == sha(base / 'probe-sw-saved-reactive-observation.mjs')
    assert driver['stopPrefetch'] is False
    assert report['browserDriver']['channel'] == 'chromium'
    assert report['browserDriver']['sha256'] == sha(base / 'probe-sw-browser-channel.mjs')
    assert 'quietObservationDriver' not in report and 'prefetchControlDriver' not in report
    for flag in ['skipOldCheckpoint', 'manualDiagnostic', 'routingDisabled',
                 'cacheInstrumentation', 'stopOldDiagnostic', 'geometryOnly']:
        assert report['experiment'][flag] is False
    builds = report['builds']
    root = Path(builds['root'])
    assert json.loads((root / 'build-manifest.json').read_text()) == builds
    commits = builds['sourceCommits'] if mixed else dict.fromkeys(['baseline', 'candidate'], builds['sourceCommit'])
    assert commits['candidate'].startswith('87cf58f')
    assert commits['baseline'].startswith('75b6551' if mixed else '87cf58f')
    assert builds['baseline']['core'] != builds['candidate']['core']
    assert builds['baseline']['vendor'] != builds['candidate']['vendor']
    for variant in ['baseline', 'candidate']:
        build = builds[variant]
        assert build['fullVendorDigest'][:12] == build['vendor'] and build['vendorFiles'] == 2542
        assert sha(root / variant / 'sw.js') == build['swSha256']
        assert sha(root / variant / '_headers') == build['headersSha256']
        prefetch = (root / variant / 'landing-prefetch.js').read_bytes()
        assert prefetch == subprocess.check_output(['git', 'show', commits[variant] + ':public/landing-prefetch.js'])
        for entry in build['entries']:
            assert sha(root / variant / entry['path']) == entry['sha256']
            assert bool(entry['policy']) == (variant == 'candidate')
    assert [r['type'] for r in report['upgrade']] == ['docx', 'xlsx', 'pptx']
    assert len(report['cold']) == len(report['offline']) == len(driver['observations']) == 3
    for upgrade, cold, offline, observation in zip(report['upgrade'], report['cold'], report['offline'], driver['observations']):
        kind = upgrade['type']
        assert cold['type'] == offline['type'] == kind
        checkpoint = upgrade['dirtyCheckpoint']
        assert checkpoint['dirtyBefore'] == checkpoint['dirtyAfter'] == upgrade['oldSavedReopenedText']
        assert 'OLD_UNSAVED_' + kind in json.dumps(checkpoint['dirtyBefore'])
        assert checkpoint['waitingState'] == 'installed' and checkpoint['oldSavedBytes'] > 1000
        assert checkpoint['dirtyVersion']['vendorVersion'] == builds['baseline']['vendor']
        assert checkpoint['dirtyVersion']['cacheVersion'] == builds['baseline']['core']
        assert upgrade['newControllerVersion']['vendorVersion'] == builds['candidate']['vendor']
        assert upgrade['newControllerVersion']['cacheVersion'] == builds['candidate']['core']
        assert observation['result']['reason'] in ['controllerchange', 'already-observed']
        assert observation['result']['event']['kind'] == 'controllerchange'
        assert observation['finished'] - observation['started'] < observation['boundMs']
        # Warming may legitimately resume in the controllerchange handler,
        # before the observer's own Promise continuation records its finish.
        changed = observation['result']['event']['time']
        early = [e for e in driver['events'] if observation['started'] - 1000 <= e['time'] < changed]
        assert not any(e['kind'] == 'prefetch-fetch' for e in early)
        assert cold['reopenExact'] and cold['edited'] == cold['redone'] == cold['reopenedText']
        assert 'VENDOR_CSP_' + kind in json.dumps(cold['edited'])
        assert 'VENDOR_CSP_' + kind not in json.dumps(cold['undone'])
        assert cold['nativeSave']['bytes'] > 1000 and cold['nativeSave']['failure'] is None
        assert cold['isolated'] and cold['iframeIsolated'] and cold['vendorResponse']['fromServiceWorker']
        assert offline['networkRejected'] and not offline['online']
        assert offline['isolated'] and offline['iframeIsolated']
        assert offline['upstreamResponses'] == offline['foreignRequests'] == 0
        controls = offline['controls']
        assert all(controls[k] is False for k in ['inline', 'event', 'foreign'])
        assert controls['save']['hit'] and controls['evalValue'] == 2
        assert any(v['directive'] == 'script-src-attr' for v in controls['violations'])
        entry = next(e for e in builds['candidate']['entries'] if cold['vendorResponse']['url'].split('?')[0].endswith(e['path']))
        assert cold['vendorResponse']['policy'] == entry['policy']
        assert any(e['policy'] == entry['policy'] and e['fromServiceWorker'] for e in offline['vendorResponses'])
    print(json.dumps({'report': name, 'threeTypeArtifactMigrationVerified': True,
                      'prefetchIntervention': False, 'broaderProductGoalComplete': False}))
    if mixed:
        archive_root = root / 'saved-evidence'
        archive = json.loads((archive_root / 'manifest.json').read_text())
        assert archive['reportSha256'] == sha(base / name) and len(archive['files']) == 6
        for record in archive['files']:
            artifact = archive_root / record['file']
            assert artifact.stat().st_size == record['bytes'] and sha(artifact) == record['sha256']
        for row in report['upgrade']:
            artifact = archive_root / ('old.' + row['type'])
            assert sha(artifact) == row['dirtyCheckpoint']['oldSavedSha256']

failure = json.loads((base / '2026-10-03-vendor-csp-two-build-prefetch-fix.json').read_text())
assert not failure['passed'] and failure['error'] == 'Error: Candidate controlling version did not arrive'
trace = json.loads((base / '2026-10-03-sw-prefetch-fix-upgrade-trace.json').read_text())
assert not trace['passed'] and trace['prefetchUpgradeTrace']['sha256'] == sha(base / 'probe-sw-prefetch-upgrade-trace.mjs')
events = trace['prefetchUpgradeTrace']['events']
assert any(e['kind'] == 'effective-script' and e['hasUpgradeWatch'] for e in events)
assert not any(e['kind'] == 'prefetch-fetch' for e in events)
print('Earlier frequent-query failures preserved; no universal/browser-internal activation claim.')
