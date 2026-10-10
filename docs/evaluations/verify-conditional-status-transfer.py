"""Check frozen transfer inputs and exact prompt-only contrast; not semantic scoring."""
import copy
import hashlib
import json
import subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[2]
folder = root / 'docs/evaluations'
report = json.loads((folder / '2026-10-05-conditional-status-transfer.json').read_text())
assert report['status'] == 'completed', report.get('error')
for name in ('2026-10-05-conditional-status-transfer-cases.json', '2026-10-05-conditional-status-candidate.json', 'probe-conditional-status-transfer.mjs'):
    frozen = subprocess.check_output(['git', 'show', f'56b5611:docs/evaluations/{name}'], cwd=root)
    assert frozen == (folder / name).read_bytes(), name
assert report['probeSHA256'] == hashlib.sha256((folder / 'probe-conditional-status-transfer.mjs').read_bytes()).hexdigest()
assert report['cases'] == json.loads((folder / '2026-10-05-conditional-status-transfer-cases.json').read_text())
suffix = json.loads((folder / '2026-10-05-conditional-status-candidate.json').read_text())['systemSuffix']
assert report['bundleBytesUnchanged'] and not report['errors']
assert len(report['results']) == 6
for case in report['cases']:
    rows = [row for row in report['results'] if row['id'] == case['id']]
    assert [row['variant'] for row in rows] == ['production', 'status-explicit']
    requests = []
    for row in rows:
        assert row['selected'].rstrip('\r\n') == case['source']
        assert row['previewCount'] == 0 and row['isolated']
        assert len(row['inputs']) == len(row['raw']) == 1
        if not row['documentUnchanged']:
            assert row['undoExact'] and row['redoExact']
        request = copy.deepcopy(row['inputs'][0]['request'])
        assert request['temperature'] == 0
        requests.append(request)
    changed = requests[1]
    systems = [message for message in changed['messages'] if message['role'] == 'system']
    assert len(systems) == 1
    assert systems[0]['content'].endswith('\n' + suffix)
    systems[0]['content'] = systems[0]['content'][:-len('\n' + suffix)]
    assert requests[0] == changed, case['id']
print('Six native runs, frozen transfer sources and exact system-suffix-only request difference verified; semantic acceptance separate')
