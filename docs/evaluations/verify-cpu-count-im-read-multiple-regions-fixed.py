import json
from pathlib import Path
r=json.loads((Path(__file__).parent/'2026-10-04-cpu-count-im-read-multiple-regions-fixed.json').read_text())
assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
for x in r['cases'][:2]:
    assert x['after']==r['before'] and not x['errors'] and x['previews']==0 and x['actions']==[]
    assert 'A1:B2\n' in x['messages'] and 'A3:B4\n' in x['messages']
    for row,cells in enumerate(r['before'],1):
        for col,value in enumerate(cells[:2]):
            assert f'{chr(65+col)}{row}: {json.dumps(value,ensure_ascii=False)}' in x['messages']
x=r['cases'][2]
assert x['after']==r['before'] and x['errors']
print('Both requested regions fully read in Chinese/English; wrong-target composite remains rejected')
