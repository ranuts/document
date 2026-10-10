"""Verify actual native Unicode edit/history/save controls, not all format fidelity."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
r = json.loads((root / '2026-10-04-unicode-im-three-editors.json').read_text())
assert r['passed'] and not r['errors'] and len(r['results']) == 3
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-unicode-im-three-editors.mjs').read_bytes()).hexdigest()
assert {row['type'] for row in r['results']} == {'docx', 'xlsx', 'pptx'}
for row in r['results']:
    assert 'WebGPU' in row['engine'] and 'Qwen3-1.7B' in row['engine']
    assert row['isolated'] and row['iframeIsolated'] and row['previewCount'] == 0
    assert not row['visibleErrors']
    assert r['markers'][row['type']] in json.dumps(row['after'], ensure_ascii=False)
    marker = r['markers'][row['type']]
    if row['type'] == 'docx':
        assert row['before'] == '\r\n' and row['after'] == marker + '\r\n'
    elif row['type'] == 'xlsx':
        assert row['before'] == '' and row['after'] == marker
    else:
        assert len(row['before']) == 1
        assert row['after'] == [row['before'][0] + [marker + '\r\n']]
    assert row['undoExact'] and row['afterUndo'] == row['before']
    assert row['redoExact'] and row['afterRedo'] == row['after']
    assert row['reopenExact'] and row['reopened'] == row['after']
    saved = row['nativeSave']
    assert not saved['failure'] and saved['bytes'] > 0
    data = Path(saved['artifactPath']).read_bytes()
    assert len(data) == saved['bytes'] and hashlib.sha256(data).hexdigest() == saved['sha256']
print('Three real Unicode IM edits: native Undo/Redo, saved-file hashes and reopened target text verified')
