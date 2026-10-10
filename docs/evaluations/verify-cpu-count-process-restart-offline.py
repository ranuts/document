import hashlib
import json
from pathlib import Path
p = Path(__file__).parent
for mode in ['chat', 'edit', 'xlsx', 'pptx']:
    name = 'cpu-count-process-restart-offline-' + mode
    r = json.loads((p / ('2026-10-04-' + name + '.json')).read_text())
    assert r['status'] == 'completed' and not r['errors'] and r['closedSeedContext']
    assert hashlib.sha256((p / ('probe-' + name + '.mjs')).read_bytes()).hexdigest() == r['probeSHA256']
    assert r['seedState']['controller'] and r['seedEngine'].startswith('CPU')
    assert any(r['plugin'] in n for n in r['seedResources'])
    assert len(r['rows']) == 1
    x = r['rows'][0]
    assert x['browserOnline'] is False and x['coldState']['controller'] and x['engine'].startswith('CPU')
    assert any(r['plugin'] in n for n in x['resources'])
    assert 'count_chat' in x['actions'] and 'completion' in x['actions']
    assert x['reply'] and not x['errors'] and x['previews'] == 0
    assert all(n['url'].startswith(('http://127.0.0.1:5193/', 'blob:', 'data:')) for n in r['offlineRequests'])
    assert all(n['method'] == 'GET' and not n['hasBody'] for n in r['offlineRequests'])
    if mode != 'chat':
        assert x['chatAfter'] == x['before'] and not x['editErrors']
        assert 'OFFLINE_CPU_四季_2026' in json.dumps(x['after'], ensure_ascii=False)
        assert x['editActions'].count('count_chat') >= 2 and x['editActions'].count('completion') >= 2
        assert x['undoExact'] and x['redoExact']
        assert x['undo'] == x['before'] and x['redo'] == x['after']
print('Current CPU IM browser restart offline chat and Word/Excel/PPT edit/history verified')
