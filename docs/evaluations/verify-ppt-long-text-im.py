"""Validate observed long-text refusals, not successful layout acceptance."""
import hashlib
import json
from pathlib import Path
root = Path(__file__).parent
r = json.loads((root/'2026-10-04-ppt-long-text-im.json').read_text())
cases = json.loads((root/'2026-10-04-ppt-long-text-cases.json').read_text())
assert r['status']=='completed' and not r['errors'] and r['cases']==cases and len(r['rows'])==2
assert r['probeSHA256']==hashlib.sha256((root/'probe-ppt-long-text-im.mjs').read_bytes()).hexdigest()
for c,row in zip(cases,r['rows']):
 assert row['id']==c['id'] and row['text']==c['text']
 assert 'WebGPU' in row['engine'] and 'Qwen3-1.7B' in row['engine']
 assert not row['applied'] and row['documentUnchanged'] and row['before']==row['after'] and row['previews']==0
 assert len(row['visibleErrors'])==1 and 'not enough space' in row['visibleErrors'][0]
 assert hashlib.sha256(Path(row['screenshotPath']).read_bytes()).hexdigest()==row['screenshotSHA256']
print('Two actual default-layout long-text refusals preserve native shape text/geometry; successful layout remains unverified')
