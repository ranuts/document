import json
from pathlib import Path
r=json.loads((Path(__file__).parent/'2026-10-04-cpu-count-im-read-write-sequence.json').read_text())
assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
x=r['cases'][0]
assert not x['errors'] and x['previews']==0 and x['actions']==[]
expected=[row[:] for row in r['before']];expected[1][1]='99'
assert x['after']==expected and r['undo']==r['before'] and r['redo']==expected
assert len(x['activity'])==1 and 'Result checked' in x['activity'][0]
for row,cells in enumerate(r['before'],1):
    for col,value in enumerate(cells[:2]):
        assert f'{chr(65+col)}{row}: {json.dumps(value,ensure_ascii=False)}' in x['activity'][0]
print('Actual read-before-write sequence preserves all read values, writes B2 alone and supports native history')
