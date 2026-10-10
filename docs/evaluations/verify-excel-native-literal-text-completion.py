import json
from pathlib import Path
r = json.loads((Path(__file__).parent / '2026-10-04-excel-native-literal-text-completion.json').read_text())
assert r['status'] == 'completed' and not r['errors']
values = ['00123', '1e3', '2026-10-04', '99', "'quoted", 'text', '12345678901234567890']
assert [(x['originalFormat'], x['value']) for x in r['cases']] == [(f, v) for f in ['General', '0.00'] for v in values]
for x in r['cases']:
    assert x['completion']['ok'] is True
    assert x['after']['value'] == x['after']['raw'] == x['after']['edit'] == x['value']
    assert x['after']['type'] == 1
    assert x['after']['format'] == x['before']['format'] == x['originalFormat']
    assert x['undo'] == x['before'] and x['redo'] == x['after']
print('Native completion callback preserves fourteen text/format cases and one-step Undo/Redo')
