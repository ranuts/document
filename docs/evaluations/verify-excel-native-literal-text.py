import json
from pathlib import Path
p = Path(__file__).parent
bad = json.loads((p / '2026-10-04-excel-native-literal-text-readback.json').read_text())
good = json.loads((p / '2026-10-04-excel-native-literal-text-format-transaction.json').read_text())
values = ['00123', '1e3', '2026-10-04', '99', "'quoted", 'text', '12345678901234567890']
for report in (bad, good):
    assert report['status'] == 'completed' and not report['errors']
    assert [x['value'] for x in report['cases']] == values
for x in bad['cases']:
    assert x['after']['raw'] == "'" + x['value']
    assert x['after']['value'] == "'" + x['value']
    assert x['undo'] == x['before'] and x['redo'] == x['after']
for x in good['cases']:
    assert x['before']['value'] == '30' and x['before']['type'] == 0
    assert x['after']['raw'] == x['value'] and x['after']['value'] == x['value'] and x['after']['edit'] == x['value']
    assert x['after']['type'] == 1 and x['after']['format'] == x['before']['format'] == 'General'
    assert x['undo'] == x['before'] and x['redo'] == x['after']
print('Prefix strategy rejected; native format transaction preserves seven literal texts with one Undo/Redo')
