import hashlib
import json
from pathlib import Path
p = Path(__file__).parent
r = json.loads((p / '2026-10-04-cpu-count-im-zh-three-editors.json').read_text())
assert r['passed'] and not r['errors']
assert hashlib.sha256((p / 'probe-cpu-count-im-zh-three-editors.mjs').read_bytes()).hexdigest() == r['probeSHA256']
assert [x['type'] for x in r['results']] == ['docx', 'xlsx', 'pptx']
for x in r['results']:
    assert x['engine'].startswith('CPU') and x['isolated'] and x['iframeIsolated']
    assert not x['visibleErrors'] and x['previewCount'] == 0
    assert x['undoExact'] and x['redoExact'] and x['reopenExact']
    assert x['before'] == x['afterUndo']
    assert x['after'] == x['afterRedo'] == x['reopened']
    marker=r['markers'][x['type']]
    if x['type']=='docx': assert x['after']==marker+'\r\n'
    elif x['type']=='xlsx': assert x['after']==marker
    else: assert x['after']==[x['before'][0]+[marker+'\r\n']]
    a = Path(x['nativeSave']['artifactPath']).read_bytes()
    assert len(a) == x['nativeSave']['bytes'] and not x['nativeSave']['failure']
    assert hashlib.sha256(a).hexdigest() == x['nativeSave']['sha256']
print('Chinese CPU Word/Excel/PPT IM exact text edits, native Undo/Redo, Save and reopen verified')
