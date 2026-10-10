import hashlib
import json
from pathlib import Path
base = Path(__file__).parent
reports = {}
for suffix in ['', '-before', '-before-launch-wait']:
    r = json.loads((base / f'2026-10-05-native-pwa-offline-pptx{suffix}.json').read_text())
    assert r['probeSHA256'] == hashlib.sha256((base / f'probe-native-pwa-offline-pptx{suffix}.mjs').read_bytes()).hexdigest()
    assert r['contextClosed'] and r['uninstalled'] and r['status'] == 'failed'
    reports[suffix] = r
before = reports['-before']
assert len(json.loads(before['editText'])) == len(json.loads(before['seedSlides'])) == 1
assert 'Add a slide' in before['editText']
assert reports['-before-launch-wait']['errors'] == ['Error: No offline standalone window after browser restart']
r = reports['']
assert r['serverClosed'] and r['originFailure'] == 'TypeError: fetch failed'
assert r['offlineEditor']['state']['standalone'] and r['offlineEditor']['state']['isolated']
assert r['offlineEngine'] == 'CPU · offline-model.gguf' and r['reply']
assert len(json.loads(r['seedSlides'])) == 1 and len(json.loads(r['editText'])) == 2
assert r['undoText'] == r['seedSlides'] and r['redoText'] == r['editText']
assert 'Add a slide' not in r['editText'] and 'PWA_PPT_四季_2026' not in r['editText']
assert r['errors'] == ['Error: Offline native edit history mismatch']
assert len(r['editErrors']) == 1 and 'not enough space' in r['editErrors'][0]
assert 'saved' not in r and 'reopened' not in r
print('Routing failure and corrected native slide history reproduced; layout rejection retained, PPT save/reopen remains incomplete.')
