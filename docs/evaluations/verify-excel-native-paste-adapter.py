import hashlib
import json
from pathlib import Path
p = Path(__file__).parent
root = p.parents[1]
for mode in ['cancellation', 'normal', 'timeout']:
    r = json.loads((p / f'2026-10-04-excel-native-paste-adapter-{mode}.json').read_text())
    assert r['status'] == 'completed' and not r['errors'] and len(r['cases']) == 2
    for key, filename in [('adapterSHA256', 'excel-native-paste.ts'), ('pasteSHA256', 'excel-paste-guard.ts'), ('sourceSHA256', 'excel-text-transaction.ts')]:
        assert r[key] == hashlib.sha256((root / 'lib/agent-plugin' / filename).read_bytes()).hexdigest()
    for x in r['cases']:
        assert x['completion']['restoredBeforeRelease'] == x['originalFormat']
        assert x['after']['format'] == x['originalFormat']
        if mode == 'normal':
            assert 'failure' not in x['completion']
            assert x['after']['raw'] == '00123' and x['after']['type'] == 1
            assert x['undo'] == x['before'] and x['redo'] == x['after']
        else:
            assert x['completion']['latePreparationReleased']
            assert x['after'] == x['before']
            if mode == 'cancellation': assert x['completion']['failure']['name'] == 'AbortError'
            else: assert x['completion']['failure']['message'] == 'Native paste timed out'
print('Current native adapter completes text paste and suppresses late insertion after Stop or timeout')
