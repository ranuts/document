import json
from pathlib import Path
r = json.loads((Path(__file__).parent / '2026-10-04-cpu-count-im-stop-draft.json').read_text())
assert r['status'] == 'completed' and r['bundleUnchanged'] and not r['errors']
assert 'Preparing AI' in r['uiAfterStop']
assert r['draftWhilePreparing'] == r['draftAfterReady'] == 'Say hello in one short sentence.'
assert r['stopped']['replies'] == r['afterWait'] and not r['stopped']['errors']
assert r['recovery']['actions'][0] == 'count_chat' and 'completion' in r['recovery']['actions']
assert len(r['recovery']['replies']) == 2 and not r['recovery']['errors']
print('CPU IM Stop reload preserves draft across Enter and ready recovery')
