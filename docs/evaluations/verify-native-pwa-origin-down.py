import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse
base = Path(__file__).parent
r = json.loads((base / '2026-10-05-native-pwa-origin-down.json').read_text())
assert r['probeSHA256'] == hashlib.sha256((base / 'probe-native-pwa-origin-down.mjs').read_bytes()).hexdigest()
assert r['status'] == 'completed' and r['errors'] == []
assert urlparse(r['origin']).hostname == '127.0.0.1' and urlparse(r['origin']).port != 5193
assert r['serverClosed'] and r['originFailure'] == 'TypeError: fetch failed'
assert r['seedContextClosed'] and r['contextClosed'] and r['uninstalled']
assert r['install'] == {} and r['displaySetting'] == {} and r['offlineLaunch']['targetId'] and r['offlineEditorLaunch']['targetId']
assert any(p['url'] == r['origin'] and p['state'].get('standalone') and p['state']['online'] is True and p['state'].get('controller') for p in r['offlinePages'])
assert r['offlineReload'] == {'url': r['origin'], 'status': 200, 'fromServiceWorker': True}
e = r['offlineEditor']
assert e['url'].startswith(r['origin'] + 'editor?') and e['state']['standalone'] and e['state']['isolated'] and e['state']['controller']
assert r['seedWordText'] == e['text'] == r['undoText'] == '\r\n'
assert r['editText'] == r['redoText'] == 'PWA_ORIGIN_DOWN_2026\r\n'
b = json.loads((base / '2026-10-05-native-pwa-origin-down-before.json').read_text())
assert b['probeSHA256'] == hashlib.sha256((base / 'probe-native-pwa-origin-down-before.mjs').read_bytes()).hexdigest()
assert b['serverClosed'] and b['uninstalled'] and b['contextClosed'] and b['status'] == 'failed'
assert b['errors'] == ['Error: Offline navigation was not served by the service worker']
print('Origin-down installed PWA restart, SW refresh, native Word edit/Undo/Redo and cleanup verified; AI and full offline acceptance remain open.')
