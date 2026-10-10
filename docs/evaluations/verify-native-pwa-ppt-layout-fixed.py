import hashlib
import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
base = Path(__file__).parent
for suffix in ['', '-before-measurement']:
    d = json.loads((base / f'2026-10-05-native-pwa-ppt-layout{suffix}.json').read_text())
    assert d['probeSHA256'] == hashlib.sha256((base / f'probe-native-pwa-ppt-layout{suffix}.mjs').read_bytes()).hexdigest()
    assert d['status'] == 'failed' and d['contextClosed'] and d['uninstalled']
d = json.loads((base / '2026-10-05-native-pwa-ppt-layout.json').read_text())
l = d['layout']
assert len(l['shapes']) == 2 and all(s['placeholder'] and s['empty'] for s in l['shapes'])
gap = min(l['width'], l['height']) * .02
available = l['height'] * .97 - l['shapes'][-1]['bounds']['b'] - gap
m = d['measured'][-1]['bounds']
height = m['b'] - m['t']
assert available < height <= l['height'] * .98 - l['shapes'][-1]['bounds']['b'] - gap
r = json.loads((base / '2026-10-05-native-pwa-ppt-layout-fixed.json').read_text())
assert r['probeSHA256'] == hashlib.sha256((base / 'probe-native-pwa-ppt-layout-fixed.mjs').read_bytes()).hexdigest()
assert r['status'] == 'completed' and not r['errors'] and not r['editErrors'] and not r['chatErrors']
assert r['serverClosed'] and r['originFailure'] == 'TypeError: fetch failed' and r['seedContextClosed'] and r['contextClosed'] and r['uninstalled']
assert r['offlineEditor']['state']['standalone'] and r['offlineEditor']['state']['isolated'] and r['previews'] == 0
assert r['offlineEngine'] == 'CPU · offline-model.gguf'
assert r['undoText'] == r['seedSlides'] and r['redoText'] == r['editText'] == r['reopened']['text']
assert len(json.loads(r['seedSlides'])) == 1 and len(json.loads(r['editText'])) == 2 and 'PWA_PPT_四季_2026' in r['editText']
assert r['reopened']['standalone'] and r['saved']['failure'] is None
p = Path(r['saved']['path'])
assert p.stat().st_size == r['saved']['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest() == r['saved']['sha256']
ns = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main', 'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
with zipfile.ZipFile(p) as z:
    deck = ET.fromstring(z.read('ppt/presentation.xml'))
    assert len(deck.findall('p:sldIdLst/p:sldId', ns)) == 2
    first = ET.fromstring(z.read('ppt/slides/slide1.xml'))
    second = ET.fromstring(z.read('ppt/slides/slide2.xml'))
    assert first.findall('.//a:t', ns) == []
    assert [n.text for n in second.findall('.//a:t', ns)] == ['PWA_PPT_四季_2026']
    shape = next(s for s in second.findall('.//p:sp', ns) if s.find('.//a:t', ns) is not None)
    pos = shape.find('p:spPr/a:xfrm/a:off', ns).attrib
    ext = shape.find('p:spPr/a:xfrm/a:ext', ns).attrib
    assert int(pos['y']) / 36000 >= l['height'] * .02 - .02
    assert (int(pos['y']) + int(ext['cy'])) / 36000 <= l['height'] * .98 + .02
print('Native measured-space diagnosis, corrected installed offline PPT history, actual PPTX XML/bounds and native reopen verified.')
