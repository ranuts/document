import hashlib
import json
from pathlib import Path
p = Path(__file__).parent
for kind in ['size', 'length', 'persistent']:
    r = json.loads((p / f'2026-10-04-cpu-cache-api-{kind}-diagnostic.json').read_text())
    assert r['status'] == 'completed' and r['phase'] == 'verified' and not r['errors']
    assert r['probeSHA256'] == hashlib.sha256((p / f'probe-cpu-cache-api-{kind}-diagnostic.mjs').read_bytes()).hexdigest()
    rows = r['result']['results']
    assert [x['bytes'] for x in rows] == [1048576, 67108864, 268435456, 484220320]
    assert [x['state'] for x in rows] == (['saved'] * 4 if kind == 'persistent' else ['saved', 'saved', 'failed', 'failed'])
    for x in rows:
        assert x['streamedBytes'] == x['bytes']
        if x['state'] == 'saved': assert x['actual'] == x['bytes']
        else: assert x['name'] == 'UnknownError'
print('Cache API large-stream failure reproduced in incognito contexts; ordinary isolated profile saves full model')
