import hashlib
import json
from pathlib import Path
p = Path(__file__).parent
root = p.parents[1]
for mode in ['cancellation', 'normal']:
    r = json.loads((p / f'2026-10-04-excel-text-paste-guard-{mode}.json').read_text())
    assert r['status'] == 'completed' and not r['errors'] and len(r['cases']) == 2
    assert r['pasteSHA256'] == hashlib.sha256((root / 'lib/agent-plugin/excel-paste-guard.ts').read_bytes()).hexdigest()
    assert r['sourceSHA256'] == hashlib.sha256((root / 'lib/agent-plugin/excel-text-transaction.ts').read_bytes()).hexdigest()
    assert [x['originalFormat'] for x in r['cases']] == ['General', '0.00']
    for x in r['cases']:
        assert x['completion']['restoredBeforeRelease'] == x['originalFormat']
        assert x['after']['format'] == x['originalFormat']
        if mode == 'cancellation':
            assert x['completion']['failure']['name'] == 'AbortError'
            assert x['completion']['latePreparationReleased']
            assert x['after'] == x['before']
        else:
            assert 'failure' not in x['completion']
            assert x['after']['raw'] == x['after']['value'] == '00123' and x['after']['type'] == 1
            assert x['undo'] == x['before'] and x['redo'] == x['after']
print('Current Excel callback guard suppresses late native font insertion after cancellation; normal text write succeeds')
