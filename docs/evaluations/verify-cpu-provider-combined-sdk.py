import hashlib
import json
from pathlib import Path
p = Path(__file__).parent
r = json.loads((p / '2026-10-04-cpu-provider-combined-sdk.json').read_text())
assert r['status'] == 'completed' and r['phase'] == 'verified' and not r['errors']
assert r['probeSHA256'] == hashlib.sha256((p / 'probe-cpu-provider-combined-sdk.mjs').read_bytes()).hexdigest()
z = r['result']
assert [x['count']['promptTokens'] for x in z['counts']] == [436, 24, 419, 24]
assert all(x['count']['contextTokens'] == 256 for x in z['counts'])
assert z['counts'][1]['request'] == z['generations'][0]
assert z['counts'][3]['request'] == z['generations'][1]
assert z['reply']['contextTrimmed'] and z['archiveUnchanged']
assert z['reply']['usage']['promptTokens'] == 24
assert 'agentContextTooLong' in z['overflowError']
assert len(z['generations']) == 2 and z['recovered']['usage']['promptTokens'] == 24
assert z['recovered']['text']
print('Native provider counts final request, trims complete history, rejects oversized system and recovers')
