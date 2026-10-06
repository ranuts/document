import json
from pathlib import Path
p=Path(__file__).parent
for suffix in ['exceptions','parameters']:
    r=json.loads((p/('2026-10-04-cpu-count-im-sort-negation-'+suffix+'.json')).read_text())
    assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
    assert all(x['after']==r['before'] for x in r['cases'])
    descriptions=[e['data']['description'] for e in r['exceptions']]
    assert any('agentToolNotChosen' in d for d in descriptions)
    assert any('Invalid document tool parameters' in d for d in descriptions)
    assert not r['cases'][2]['errors'] and 'B2\n30' in r['cases'][2]['messages']
print('Caught parameter-validation rejection traced in actual CPU IM; no editor mutation')
