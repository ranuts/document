import hashlib
import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
base = Path(__file__).parent
r = json.loads((base / '2026-10-05-native-pwa-offline-xlsx.json').read_text())
assert r['probeSHA256'] == hashlib.sha256((base / 'probe-native-pwa-offline-xlsx.mjs').read_bytes()).hexdigest()
assert r['status'] == 'completed' and r['errors'] == []
assert r['serverClosed'] and r['originFailure'] == 'TypeError: fetch failed'
assert r['seedContextClosed'] and r['contextClosed'] and r['uninstalled']
assert r['offlineEditor']['state']['standalone'] and r['offlineEditor']['state']['isolated']
assert r['seedEngine'] == r['offlineEngine'] == 'CPU · offline-model.gguf'
assert r['artifactBytes'] == 491400032 and r['artifactSHA256'] == '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db'
assert r['served'] == [{'method': 'HEAD', 'url': '/offline-model.gguf'}, {'method': 'GET', 'url': '/offline-model.gguf'}]
assert not r['chatErrors'] and not r['editErrors'] and r['previews'] == 0
assert r['seedCellValue'] == r['undoText'] == r['offlineEditor']['text'] == ''
assert r['editText'] == r['redoText'] == r['reopened']['text'] == '00123'
assert r['reopened']['standalone'] and r['saved']['failure'] is None
artifact = Path(r['saved']['path'])
assert artifact.stat().st_size == r['saved']['bytes'] > 0
assert hashlib.sha256(artifact.read_bytes()).hexdigest() == r['saved']['sha256']
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(artifact) as z:
    sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    cells = sheet.findall('.//s:sheetData/s:row/s:c', ns)
    assert len(cells) == 1
    cell = cells[0]
    assert cell.attrib['r'] == 'B2' and cell.attrib['t'] == 's' and cell.find('s:f', ns) is None
    index = int(cell.find('s:v', ns).text)
    strings = ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si', ns)
    assert ''.join(n.text or '' for n in strings[index].findall('.//s:t', ns)) == '00123'
print('Installed origin-down Excel IM text literal, native history, XLSX Save/reopen and independent string/formula XML checks verified.')
