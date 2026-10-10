import json
from pathlib import Path
p=Path(__file__).parent
for suffix in ['', '-switch']:
    r=json.loads((p/('2026-10-04-cpu-count-im-sequence-history'+suffix+'.json')).read_text())
    assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
    session=next(s for s in r['exported']['sessions'] if s['id']==r['exported']['activeId'])
    m=session['messages']
    assert len(m)==3 and m[0]['role']=='user'
    assert 'B2: "30"' in m[1]['content'] and m[1]['hostGuidance']=='tool'
    assert 'Result checked' in m[2]['content'] and m[2]['hostGuidance']=='tool'
    assert r['restoredActivity']==r['cases'][0]['activity']
    assert r['restoredRequest']==[m[0]['content']]
    if suffix:
        assert r['newConversationActivity']==[]
        assert r['switchedBackActivity']==r['restoredActivity']
print('Actual sequence export, reload restoration and completed-conversation switching verified')
