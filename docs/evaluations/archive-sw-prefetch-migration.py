"""Preserve synthetic native downloads before subsequent probes reuse scratch paths."""
import hashlib
import json
import shutil
from pathlib import Path

report_path = Path('docs/evaluations/2026-10-03-sw-prefetch-before-after-migration.json')
report = json.loads(report_path.read_text())
assert report['passed'] and report['completeMigrationPassed']
root = Path(report['builds']['root']) / 'saved-evidence'
assert not root.exists(), 'Never overwrite archived migration downloads'
records = []
for upgrade, cold in zip(report['upgrade'], report['cold']):
    kind = upgrade['type']
    for variant in ['old', 'candidate']:
        source = Path(f'.scratch/ai-csp/two-build-{variant}.{kind}')
        body = source.read_bytes()
        digest = hashlib.sha256(body).hexdigest()
        expected = upgrade['dirtyCheckpoint']['oldSavedBytes'] if variant == 'old' else cold['nativeSave']['bytes']
        assert len(body) == expected
        if variant == 'old':
            assert digest == upgrade['dirtyCheckpoint']['oldSavedSha256']
        records.append({'source': str(source), 'file': f'{variant}.{kind}', 'bytes': len(body), 'sha256': digest})
root.mkdir()
for row in records:
    shutil.copyfile(row['source'], root / row['file'])
metadata = {'scope': 'Synthetic owned native downloads; byte preservation, not formatting-fidelity proof',
            'root': str(root), 'reportSha256': hashlib.sha256(report_path.read_bytes()).hexdigest(), 'files': records}
(root / 'manifest.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps({'archivedSyntheticFiles': len(records), 'root': str(root)}))
