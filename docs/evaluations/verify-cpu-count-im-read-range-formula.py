import json
from pathlib import Path
r=json.loads((Path(__file__).parent/'2026-10-04-cpu-count-im-read-range-formula-verified.json').read_text())
assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
assert r['formulaBefore']==r['formulaAfter']=='10+20'
x=r['cases'][0]
assert x['after']==r['before'] and not x['errors'] and x['previews']==0 and x['actions']==[]
assert 'B2: "30"' in x['messages'] and 'B3: ""' in x['messages']
assert 'A3: "<b>Davi & Mira</b>"' in x['messages']
for row,cells in enumerate(r['before'],1):
    for col,value in enumerate(cells[:2]):
        assert f'{chr(65+col)}{row}: {json.dumps(value,ensure_ascii=False)}' in x['messages']
print('Actual range read preserves native formula, evaluated value, blank cell and literal markup-like text')
