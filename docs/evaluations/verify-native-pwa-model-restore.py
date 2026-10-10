import hashlib
import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
base = Path(__file__).parent
probe = base / 'probe-native-pwa-model-restore.mjs'
r = json.loads((base / '2026-10-05-native-pwa-model-restore.json').read_text())
assert r['probeSHA256'] == hashlib.sha256(probe.read_bytes()).hexdigest()
assert 'await loadCPU(editor)' not in probe.read_text()
assert r['status'] == 'completed' and r['errors'] == []
assert r['restoredProvider'] == 'wllama' and r['restoredURL'] == r['origin'] + 'offline-model.gguf'
assert r['seedEngine'] == r['offlineEngine'] == 'CPU · offline-model.gguf' and r['reply']
assert r['serverClosed'] and r['originFailure'] == 'TypeError: fetch failed' and r['seedContextClosed']
assert r['offlineEditor']['state']['standalone'] and r['offlineEditor']['state']['isolated']
assert not r['chatErrors'] and not r['editErrors'] and r['previews'] == 0
assert r['undoText'] == r['seedSlides'] and r['redoText'] == r['editText'] == r['reopened']['text']
assert len(json.loads(r['seedSlides'])) == 1 and len(json.loads(r['editText'])) == 2
assert r['reopened']['standalone'] and r['saved']['failure'] is None
assert r['contextClosed'] and r['uninstalled']
artifact = Path(r['saved']['path'])
assert artifact.stat().st_size == r['saved']['bytes'] and hashlib.sha256(artifact.read_bytes()).hexdigest() == r['saved']['sha256']
ns = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main', 'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
with zipfile.ZipFile(artifact) as z:
    deck = ET.fromstring(z.read('ppt/presentation.xml'))
    assert len(deck.findall('p:sldIdLst/p:sldId', ns)) == 2
    slide = ET.fromstring(z.read('ppt/slides/slide2.xml'))
    assert [n.text for n in slide.findall('.//a:t', ns)] == ['PWA_PPT_四季_2026']
print('Automatic local provider/URL restore, origin-down installed CPU inference, native PPT history/save/reopen and artifact identity verified.')
