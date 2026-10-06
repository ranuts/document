"""Verify controls and the saved-session failure without declaring migration safe."""
import hashlib
import json
from pathlib import Path

base = Path('docs/evaluations')
def read(name):
    return json.loads((base / name).read_text())
def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
probe_hash = sha(base / 'probe-vendor-csp-two-build.mjs')
control = read('2026-10-03-vendor-csp-two-build-blank-control.json')
failure = read('2026-10-03-vendor-csp-two-build-saved-regression.json')
for report in [control, failure]:
    assert report['probeSha256'] == probe_hash
    assert report['completeMigrationPassed'] is False
    assert report['builds']['sourceCommit'].startswith('75b6551')
    assert report['experiment']['policyBakedIntoArtifacts'] is True
    assert report['experiment']['staticStylesheet'] is True
    assert not report['experiment']['manualDiagnostic']
    assert not report['experiment']['routingDisabled']
    assert not report['errors']
    builds = report['builds']
    assert builds['baseline']['vendor'] != builds['candidate']['vendor']
    assert builds['baseline']['core'] != builds['candidate']['core']
    for variant in ['baseline', 'candidate']:
        build = builds[variant]
        assert build['fullVendorDigest'][:12] == build['vendor']
        assert build['vendorFiles'] == 2542 and build['vendorBytes'] > 400_000_000
        root = Path(builds['root']) / variant
        assert sha(root / 'sw.js') == build['swSha256']
        assert sha(root / '_headers') == build['headersSha256']
        for entry in build['entries']:
            assert sha(root / entry['path']) == entry['sha256']
            assert (entry['policy'] is not None) == (variant == 'candidate')
assert control['passed'] and control['experiment']['skipOldCheckpoint']
assert [r['type'] for r in control['cold']] == ['docx', 'xlsx', 'pptx']
assert len(control['upgrade']) == len(control['offline']) == 3
for row in control['upgrade']:
    assert row['diagnosticOldCheckpointSkipped']
    assert row['newControllerVersion']['vendorVersion'] == control['candidateVendor']
    assert row['oldEntries'] and all(r['policy'] is None and r['asyncStyle'] for r in row['oldEntries'])
for row in control['cold']:
    assert row['isolated'] and row['iframeIsolated'] and row['vendorResponse']['fromServiceWorker']
    assert row['vendorResponse']['policy']
    assert row['reopenExact'] and row['edited'] == row['redone'] == row['reopenedText']
    assert 'VENDOR_CSP_' in json.dumps(row['edited']) and 'VENDOR_CSP_' not in json.dumps(row['undone'])
    assert row['nativeSave']['bytes'] > 1000 and row['nativeSave']['failure'] is None
for row in control['offline']:
    assert row['upstreamResponses'] == row['foreignRequests'] == 0
    assert row['networkRejected'] and not row['online'] and row['isolated'] and row['iframeIsolated']
    controls = row['controls']
    assert not controls['inline'] and not controls['event'] and not controls['foreign']
    assert controls['evalValue'] == 2 and controls['save']['hit']
    assert any(v['directive'] == 'script-src-attr' for v in controls['violations'])
    assert any(v['directive'] == 'script-src-elem' and v['blocked'] == 'https://controlled-script.example/probe.js' for v in controls['violations'])
assert failure['passed'] is False and failure['error'] == 'Error: Candidate controlling version did not arrive'
assert not failure['experiment']['skipOldCheckpoint']
assert len(failure['upgrade']) == 1 and not failure['cold'] and not failure['offline']
row = failure['upgrade'][0]
dirty = row['dirtyCheckpoint']
assert dirty['dirtyBefore'] == dirty['dirtyAfter'] == 'OLD_UNSAVED_docx\r\n'
assert dirty['dirtyVersion']['vendorVersion'] == failure['vendor'] and dirty['waitingState'] == 'installed'
assert dirty['oldSavedBytes'] > 1000
assert sha('.scratch/ai-csp/two-build-old.docx') == dirty['oldSavedSha256']
assert any(e['type'] == 'SKIP_WAITING' for e in row['landingLifecycle'])
for observation in row['controllerObservations']:
    assert observation['observedVersion']['vendorVersion'] == failure['vendor']
    assert observation['waitingVersion']['vendorVersion'] == failure['candidateVendor']
    assert observation['waitingState'] == 'installed'
    assert observation['clients']['editors'] == 0
for filename, download in [('2026-10-03-sw-minimal-promotion.json',False),('2026-10-03-sw-minimal-promotion-download.json',True)]:
    report = read(filename)
    assert report['probeSha256'] == sha(base / 'probe-sw-minimal-promotion.mjs')
    assert report['passed'] and report['nativeBlobDownload'] == download
    assert report['initial']['version'] == 'old' and report['waiting']['version'] == 'new'
    assert report['delivery'] == {'received':True,'version':'new'} and report['final']['version'] == 'new'
    if download: assert report['download'] == {'failure':None,'text':'SW_BLOB_CONTROL'}
stop = read('2026-10-03-vendor-csp-two-build-stop-old-diagnostic.json')['upgrade'][0]
assert stop['directTargetVersion']['vendorVersion'] == control['candidateVendor']
assert stop['directSkipResult'] == 'diagnostic-timeout'
assert stop['afterOldStopVersion']['vendorVersion'] == control['candidateVendor']
print('Verified: three blank-session native/offline controls; saved Word migration remains failed; bare and Blob-download SW controls pass. Full migration gate stays open.')
