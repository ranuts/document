import hashlib
import json
from pathlib import Path
p = Path(__file__).parent
r = json.loads((p / '2026-10-04-cpu-count-im-three-editors.json').read_text())
assert r['passed'] and not r['errors']
assert hashlib.sha256((p / 'probe-cpu-count-im-three-editors-executed.mjs').read_bytes()).hexdigest() == r['probeSHA256']
assert [x['type'] for x in r['results']] == ['docx', 'xlsx', 'pptx']
for x in r['results']:
    assert x['engine'].startswith('CPU') and x['isolated'] and x['iframeIsolated']
    assert not x['visibleErrors'] and x['previewCount'] == 0
    assert x['undoExact'] and x['redoExact'] and x['reopenExact']
    assert x['before'] == x['afterUndo']
    assert x['after'] == x['afterRedo'] == x['reopened']
    assert r['markers'][x['type']] in json.dumps(x['after'], ensure_ascii=False)
    a = Path(x['nativeSave']['preservedArtifactPath']).read_bytes()
    assert len(a) == x['nativeSave']['bytes'] and not x['nativeSave']['failure']
    assert hashlib.sha256(a).hexdigest() == x['nativeSave']['sha256']
print('CPU Word/Excel/PPT IM exact text edits, native Undo/Redo, Save and reopen verified')
