import hashlib
import json
from pathlib import Path
p = Path(__file__).parent
root = p.parents[1]
for mode in ['cancellation', 'success']:
    r = json.loads((p / f'2026-10-04-excel-history-group-{mode}.json').read_text())
    assert r['status'] == 'completed' and not r['errors'] and len(r['cases']) == 2
    for key, filename in [('groupSHA256','excel-history-group.ts'),('redoSHA256','native-redo.ts'),('formatSHA256','excel-cell-format.ts'),('adapterSHA256','excel-native-paste.ts'),('pasteSHA256','excel-paste-guard.ts'),('sourceSHA256','excel-text-transaction.ts')]:
        assert r[key] == hashlib.sha256((root / 'lib/agent-plugin' / filename).read_bytes()).hexdigest()
    for x in r['cases']:
        h = x['completion']['historyRestored']
        assert h['depth'] and h['groupIndex'] == -1
        assert x['completion']['restoredBeforeRelease'] == x['originalFormat']
        if mode == 'cancellation':
            assert x['completion']['failure']['name'] == 'AbortError' and x['completion']['latePreparationReleased']
            assert h['index'] and h['points'] and h['oldFuturePresent']
            assert x['after'] == x['before'] and x['before']['raw'] == '30'
            assert x['oldRedo']['raw'] == '40' and x['undoOldRedo'] == x['before']
        else:
            assert 'failure' not in x['completion']
            assert not h['oldFuturePresent']
            assert x['after']['raw'] == '00123' and x['after']['type'] == 1
            assert x['after']['format'] == x['originalFormat']
            assert x['oldRedo'] == x['after']
            assert x['undoOldRedo'] == x['before'] and x['newRedo'] == x['after']
print('Current history scope restores original Redo after cancel; successful text write discards old branch and passes Undo/Redo')
