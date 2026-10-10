import hashlib
import json
from pathlib import Path
base = Path(__file__).parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
for phase in ['before', 'after']:
    r = json.loads((base / f'2026-10-05-local-entry-{phase}.json').read_text())
    assert r['probeSHA256'] == sha(base / 'probe-local-entry-build.mjs')
    for c in r['writtenChunks']:
        p = Path(f'.scratch/local-entry-{phase}') / c['name']
        assert p.stat().st_size == c['bytes'] and sha(p) == c['sha256']
before = json.loads((base / '2026-10-05-local-entry-before.json').read_text())
after = json.loads((base / '2026-10-05-local-entry-after.json').read_text())
assert len(before['cloudModules']) == 102 and sum(m['renderedBytes'] for m in before['cloudModules']) == 0
assert after['cloudModules'] == [] and after['entrySHA256'] == sha(Path('index.ts'))
r = json.loads((base / '2026-10-05-local-entry-offline-im.json').read_text())
assert r['probeSHA256'] == sha(base / 'probe-local-entry-offline-im.mjs')
assert r['status'] == 'completed' and not r['errors'] and not r['chatErrors'] and not r['editErrors'] and r['previews'] == 0
assert r['serverClosed'] and r['originFailure'] == 'TypeError: fetch failed' and r['seedContextClosed'] and r['contextClosed'] and r['uninstalled']
assert r['restoredProvider'] == 'wllama' and r['restoredURL'] == r['origin'] + 'offline-model.gguf'
assert r['offlineEngine'] == 'CPU · offline-model.gguf' and r['reply']
assert r['offlineEditor']['state']['standalone'] and r['offlineEditor']['state']['isolated']
assert r['undoText'] == r['seedSlides'] and r['redoText'] == r['editText'] == r['reopened']['text'] and r['reopened']['standalone']
p = Path(r['saved']['path'])
assert r['saved']['failure'] is None and p.stat().st_size == r['saved']['bytes'] and sha(p) == r['saved']['sha256']
print('Local product entry graph, artifact identities and actual installed origin-down IM round trip verified; no runtime SDK-byte/privacy improvement inferred.')
