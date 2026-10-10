import hashlib
import json
from pathlib import Path
p = Path(__file__).parent
root = p.parents[1]
r = json.loads((p / '2026-10-04-excel-text-redo-cancellation.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and len(r['cases']) == 2
for key, filename in [('redoSHA256', 'native-redo.ts'), ('formatSHA256', 'excel-cell-format.ts'), ('adapterSHA256', 'excel-native-paste.ts'), ('pasteSHA256', 'excel-paste-guard.ts'), ('sourceSHA256', 'excel-text-transaction.ts')]:
    assert r[key] == hashlib.sha256((root / 'lib/agent-plugin' / filename).read_bytes()).hexdigest()
for x in r['cases']:
    assert x['completion']['failure']['name'] == 'AbortError'
    assert x['completion']['latePreparationReleased']
    assert x['completion']['historyRestored'] == {'index': True, 'points': True, 'depth': True, 'groupIndex': -1}
    assert x['after'] == x['before'] and x['before']['raw'] == '30'
    assert x['completion']['restoredBeforeRelease'] == x['originalFormat']
    assert x['oldRedo']['raw'] == '40' and x['oldRedo']['type'] == 0
    assert x['oldRedo']['format'] == x['originalFormat']
    assert x['undoOldRedo'] == x['before']
print('Native cancellation restores original history-point identities; old Redo/Undo remains usable in both formats')
