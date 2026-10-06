import json
from pathlib import Path
r=json.loads((Path(__file__).parent/'2026-10-04-cpu-count-im-read-range-fixed.json').read_text())
assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
assert len(r['cases'])==4
for x in r['cases']:
    assert x['after']==r['before'] and not x['errors'] and x['previews']==0
for x in r['cases'][:2]: assert 'B2\n30' in x['messages']
for x in r['cases'][2:]:
    assert x['actions']==[]
    for row,cells in enumerate(r['before'],1):
        for col,value in enumerate(cells[:2]):
            assert f'{chr(65+col)}{row}: {json.dumps(value,ensure_ascii=False)}' in x['messages']
    assert 'C1: ' not in x['messages']
print('Actual Chinese/English range reads return all eight requested cells unchanged; single-cell reads retained')
