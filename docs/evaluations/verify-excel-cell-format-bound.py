import hashlib
import json
from pathlib import Path
p = Path(__file__).parent
root = p.parents[1]
for mode in ['normal', 'sheet-switch']:
    r = json.loads((p / f'2026-10-04-excel-cell-format-bound-{mode}.json').read_text())
    assert r['status'] == 'completed' and not r['errors'] and len(r['cases']) == 2
    for key, filename in [('formatSHA256', 'excel-cell-format.ts'), ('adapterSHA256', 'excel-native-paste.ts'), ('pasteSHA256', 'excel-paste-guard.ts'), ('sourceSHA256', 'excel-text-transaction.ts')]:
        assert r[key] == hashlib.sha256((root / 'lib/agent-plugin' / filename).read_bytes()).hexdigest()
    for x in r['cases']:
        assert x['completion']['restoredBeforeRelease'] == x['originalFormat']
        if mode == 'normal':
            assert 'failure' not in x['completion']
            assert x['after']['raw'] == '00123' and x['after']['type'] == 1
            assert x['after']['format'] == x['originalFormat']
            assert x['undo'] == x['before'] and x['redo'] == x['after']
        else:
            assert x['completion']['sheetSwitch'] == {'before': 0, 'after': 1}
            assert x['completion']['failure']['name'] == 'AbortError'
            assert x['completion']['latePreparationReleased']
            assert x['after'] == x['before']
            assert x['after'][0]['raw'] == '30' and x['after'][0]['format'] == x['originalFormat']
            assert x['after'][1]['raw'] == 'SECOND' and x['after'][1]['format'] == '0%'
print('Bound original-cell formatting survives sheet switching and late-callback cancellation; normal text Undo/Redo passes')
