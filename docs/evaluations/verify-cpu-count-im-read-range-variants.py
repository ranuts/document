import json
from pathlib import Path
p=Path(__file__).parent
before=json.loads((p/'2026-10-04-cpu-count-im-read-range-variants.json').read_text())
assert 'A1\nName' in before['cases'][0]['messages'] and 'A3: "Davi"' not in before['cases'][0]['messages']
r=json.loads((p/'2026-10-04-cpu-count-im-read-range-variants-fixed.json').read_text())
assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
for x in r['cases']:
    assert x['after']==r['before'] and not x['errors'] and x['previews']==0
    for row,cells in enumerate(r['before'],1):
        for col,value in enumerate(cells[:2]):
            assert f'{chr(65+col)}{row}: {json.dumps(value,ensure_ascii=False)}' in x['messages']
assert r['cases'][0]['actions']==[] and r['cases'][2]['actions']==[]
print('All three range-reading variants return the complete region after the fix')
