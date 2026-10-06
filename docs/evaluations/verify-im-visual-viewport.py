import json,pathlib
p=pathlib.Path(__file__).resolve().parent
before=json.loads((p/'2026-10-05-visual-viewport-before.json').read_text())
after=json.loads((p/'2026-10-05-visual-viewport-after.json').read_text())
assert not before['passed'] and after['passed'] and after['contextClosed'] and not after['errors']
assert [(r['height'],r['offsetTop'],r['settings']) for r in before['rows']]==[(r['height'],r['offsetTop'],r['settings']) for r in after['rows']]
assert any(r['send']['bottom']>r['panel']['bottom'] for r in before['rows'])
for r in after['rows']:
 assert r['layoutHeight']==900 and r['panel']['top']==r['offsetTop'] and r['panel']['height']==r['height']
 assert r['input']['top']>=r['offsetTop'] and r['input']['bottom']<=r['panel']['bottom'] and r['send']['bottom']<=r['panel']['bottom']
 assert r['draft']=='中文草稿'
print('Synthetic visual shrink with unchanged layout height: before overflow reproduced, after composer geometry verified. Not physical keyboard certification.')
