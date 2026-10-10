import json
from pathlib import Path
r=json.loads((Path(__file__).parent/'2026-10-04-cpu-count-im-sort.json').read_text())
assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
a,b=r['cases'];header=['Name','Value','OUTSIDE']
assert r['before']==[header,['Cora','30',''],['Davi','10',''],['Mira','20','']]
assert a['after']==[header,['Davi','10',''],['Mira','20',''],['Cora','30','']]
assert b['after']==[header,['Cora','30',''],['Mira','20',''],['Davi','10','']]
assert r['undo']==a['after'] and r['redo']==b['after']
for x in [a,b]:
    assert x['actions'][0]=='count_chat' and 'completion' in x['actions']
    assert not x['errors'] and x['previews']==0 and 'Result checked' in x['messages']
print('CPU Chinese ascending/descending row sort, header/outside preservation and history verified')
