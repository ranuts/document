import json
from pathlib import Path
r=json.loads((Path(__file__).parent/'2026-10-04-cpu-count-im-cell-target-fixed.json').read_text())
assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
x=r['cases'][2]
assert x['after']==r['before'] and len(x['errors'])==1 and 'No executable operation' in x['errors'][0]
assert x['previews']==0
print('Wrong destination rejected before execution; full composite support remains open')
