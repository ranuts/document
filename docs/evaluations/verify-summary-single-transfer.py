"""Check frozen transfer inputs and exact prompt-only contrast; not semantic scoring."""
import copy
import hashlib
import json
import subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[2]
folder = root / 'docs/evaluations'
report = json.loads((folder / '2026-10-05-summary-single-transfer.json').read_text())
assert report['status'] == 'completed', report.get('error')
for name in ('2026-10-05-summary-single-transfer-cases.json', '2026-10-05-summary-single-candidate.json', 'probe-summary-single-transfer.mjs'):
    frozen = subprocess.check_output(['git', 'show', f'4dafafe:docs/evaluations/{name}'], cwd=root)
    assert frozen == (folder / name).read_bytes(), name
assert report['probeSHA256'] == hashlib.sha256((folder / 'probe-summary-single-transfer.mjs').read_bytes()).hexdigest()
assert report['cases'] == json.loads((folder / '2026-10-05-summary-single-transfer-cases.json').read_text())
suffix = json.loads((folder / '2026-10-05-summary-single-candidate.json').read_text())['finalUserSuffix']
assert report['bundleBytesUnchanged'] and not report['errors']
assert len(report['results']) == 4
for case in report['cases']:
    rows = [row for row in report['results'] if row['id'] == case['id']]
    assert [row['variant'] for row in rows] == ['status-explicit', 'status-single']
    requests = []
    for row in rows:
        assert row['selected'].rstrip('\r\n') == case['source']
        assert row['previewCount'] == 0 and row['isolated']
        assert len(row['inputs']) == len(row['raw']) == 1
        if not row['documentUnchanged']:
            assert row['undoExact'] and row['redoExact']
        request = copy.deepcopy(row['inputs'][0]['request'])
        assert request['temperature'] == 0
        shared = json.loads((folder / '2026-10-05-summary-single-candidate.json').read_text())['sharedSystemSuffix']
        system_messages = [message for message in request['messages'] if message['role'] == 'system']
        assert len(system_messages) == 1
        assert system_messages[0]['content'].endswith('\n' + shared)
        requests.append(request)
    changed = requests[1]
    systems = [message for message in changed['messages'] if message['role'] == 'user']
    assert len(systems) == 1
    assert systems[0]['content'].endswith('\n' + suffix)
    systems[0]['content'] = systems[0]['content'][:-len('\n' + suffix)]
    assert requests[0] == changed, case['id']
print('Four native runs, frozen transfer sources and exact final-user-suffix-only request difference verified; semantic acceptance separate')
