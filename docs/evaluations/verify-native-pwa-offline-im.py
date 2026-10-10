import hashlib
import json
from pathlib import Path
base = Path(__file__).parent
r = json.loads((base / '2026-10-05-native-pwa-offline-im.json').read_text())
assert r['probeSHA256'] == hashlib.sha256((base / 'probe-native-pwa-offline-im.mjs').read_bytes()).hexdigest()
assert r['status'] == 'completed' and r['errors'] == []
assert r['artifactBytes'] == 491400032 and r['artifactSHA256'] == '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db'
assert r['served'] == [{'method': 'HEAD', 'url': '/offline-model.gguf'}, {'method': 'GET', 'url': '/offline-model.gguf'}]
assert r['serverClosed'] and r['originFailure'] == 'TypeError: fetch failed'
assert r['seedContextClosed'] and r['contextClosed'] and r['uninstalled']
assert r['offlineLaunch']['targetId'] and r['offlineEditorLaunch']['targetId']
assert r['offlineReload'] == {'url': r['origin'], 'status': 200, 'fromServiceWorker': True}
assert r['offlineEditor']['state']['standalone'] and r['offlineEditor']['state']['isolated']
assert r['offlineEngine'] == r['seedEngine'] == 'CPU · offline-model.gguf'
assert r['reply'] == 'Hello!Write to document'
assert not r['chatErrors'] and not r['editErrors'] and r['previews'] == 0
assert r['seedWordText'] == r['offlineEditor']['text'] == r['undoText'] == '\r\n'
assert r['editText'] == r['redoText'] == 'PWA_ORIGIN_DOWN_2026\r\n'
for suffix in ['before', 'before-provider']:
    b = json.loads((base / f'2026-10-05-native-pwa-offline-im-{suffix}.json').read_text())
    assert b['probeSHA256'] == hashlib.sha256((base / f'probe-native-pwa-offline-im-{suffix}.mjs').read_bytes()).hexdigest()
    assert b['status'] == 'failed' and b['contextClosed'] and b['served'] == []
    assert len(b['errors']) == 1 and 'TimeoutError: locator.click' in b['errors'][0]
print('Installed origin-down cached CPU greeting, bounded IM edit and native history verified; broad quality/privacy/save acceptance remains open.')
