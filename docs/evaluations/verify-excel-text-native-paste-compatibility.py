import hashlib
import json
from pathlib import Path
p = Path(__file__).parent
root = p.parents[1]
r = json.loads((p / '2026-10-04-excel-text-native-paste-compatibility.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and len(r['cases']) == 14
assert r['sourceSHA256'] == hashlib.sha256((root / 'lib/agent-plugin/excel-text-transaction.ts').read_bytes()).hexdigest()
assert r['pasteSHA256'] == hashlib.sha256((root / 'lib/agent-plugin/native-paste.ts').read_bytes()).hexdigest()
for x in r['cases']:
    assert x['completion']['ok'] is True
    assert x['after']['raw'] == x['after']['value'] == x['value']
    assert x['after']['format'] == x['before']['format'] == x['originalFormat']
    assert x['undo'] == x['before'] and x['redo'] == x['after']
invalid = json.loads((p / '2026-10-04-excel-text-native-paste-cancellation.json').read_text())
assert invalid['status'] == 'completed' and not invalid['errors']
for x in invalid['cases']:
    assert not x['completion']['latePreparationReleased']
    assert x['completion']['failure']['message'] == 'Native preparation was not deferred'
r = json.loads((p / '2026-10-04-excel-text-native-paste-font-delay.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and len(r['cases']) == 2
for x in r['cases']:
    assert x['completion']['latePreparationReleased']
    assert x['completion']['failure']['message'] == 'Native paste was rejected'
    assert x['completion']['restoredBeforeRelease'] == x['originalFormat']
    assert x['before']['raw'] == '30' and x['after']['raw'] == '123'
    assert x['undo'] == x['before'] and x['redo'] == x['after']
print('Normal compatibility succeeds; deferred Excel font callback reproduces unsafe late insertion after rejection')
