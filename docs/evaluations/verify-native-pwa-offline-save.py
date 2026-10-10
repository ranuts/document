import hashlib
import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
base = Path(__file__).parent
r = json.loads((base / '2026-10-05-native-pwa-offline-save.json').read_text())
assert r['probeSHA256'] == hashlib.sha256((base / 'probe-native-pwa-offline-save.mjs').read_bytes()).hexdigest()
assert r['status'] == 'completed' and r['errors'] == []
assert r['serverClosed'] and r['originFailure'] == 'TypeError: fetch failed'
assert r['seedContextClosed'] and r['contextClosed'] and r['uninstalled']
assert r['offlineEditor']['state']['standalone'] and r['offlineEditor']['state']['isolated']
assert r['seedEngine'] == r['offlineEngine'] == 'CPU · offline-model.gguf'
assert r['artifactBytes'] == 491400032 and r['artifactSHA256'] == '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db'
assert r['served'] == [{'method': 'HEAD', 'url': '/offline-model.gguf'}, {'method': 'GET', 'url': '/offline-model.gguf'}]
assert not r['chatErrors'] and not r['editErrors'] and r['previews'] == 0
assert r['undoText'] == r['offlineEditor']['text'] == '\r\n'
assert r['editText'] == r['redoText'] == r['reopened']['text'] == 'PWA_ORIGIN_DOWN_2026\r\n'
assert r['reopened']['standalone'] and r['saved']['failure'] is None
artifact = Path(r['saved']['path'])
assert artifact.stat().st_size == r['saved']['bytes'] > 0
assert hashlib.sha256(artifact.read_bytes()).hexdigest() == r['saved']['sha256']
with zipfile.ZipFile(artifact) as z:
    root = ET.fromstring(z.read('word/document.xml'))
    text = ''.join(n.text or '' for n in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'))
assert text == 'PWA_ORIGIN_DOWN_2026'
b = json.loads((base / '2026-10-05-native-pwa-offline-save-before.json').read_text())
assert b['probeSHA256'] == hashlib.sha256((base / 'probe-native-pwa-offline-save-before.mjs').read_bytes()).hexdigest()
assert b['status'] == 'failed' and b['uninstalled'] and b['contextClosed']
assert len(b['errors']) == 1 and 'waiting for event "download"' in b['errors'][0]
print('Installed origin-down CPU IM edit, native Save download, actual DOCX XML and native reopen verified; system picker and broad offline acceptance remain open.')
