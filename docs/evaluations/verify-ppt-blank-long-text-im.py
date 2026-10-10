"""Check blank-slide layout evidence and preserve observed literal failure."""
import hashlib,json
from pathlib import Path
root=Path(__file__).parent
r=json.loads((root/'2026-10-04-ppt-blank-long-text-blank-im.json').read_text())
assert r['status']=='completed' and not r['errors'] and len(r['rows'])==2
assert r['probeSHA256']==hashlib.sha256((root/'probe-ppt-blank-long-text-im.mjs').read_bytes()).hexdigest()
assert r['cases']==json.loads((root/'2026-10-04-ppt-long-text-cases.json').read_text())
for c,x in zip(r['cases'],r['rows']):
 assert x['id']==c['id'] and x['text']==c['text'] and x['setup']['type']==0 and x['setup']['count']==0
 assert not x['before']['shapes'] and x['applied'] and len(x['after']['shapes'])==1
 assert not x['visibleErrors'] and x['previews']==0 and x['boxInside'] and x['contentHeightFits']
 assert x['undoExact'] and x['redoExact'] and x['undo']==x['before'] and x['redo']==x['after']
 assert hashlib.sha256(Path(x['screenshotPath']).read_bytes()).hexdigest()==x['screenshotSHA256']
multiline,long=r['rows']
assert multiline['after']['shapes'][0]['text'] is None and not multiline['literalExact']
assert long['text'].count('Extraordinary')==35
assert long['after']['shapes'][0]['text'].count('Extraordinary')==40 and not long['literalExact']
print('Blank-layout bounds/history snapshots verified; long-token literal FAIL preserved, multiline full text unverified')
