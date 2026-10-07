"""Verify current cached-origin offline chat evidence, not full acceptance."""
import hashlib
import json
from pathlib import Path
root=Path(__file__).resolve().parent
prefix='2026-10-07-current-default-cpu-offline-restart'
b=json.loads((root/(prefix+'-bindings.json')).read_text())
assert b['processExitCode']==0
for name,digest in b['evidenceSHA256'].items():
    assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
r=json.loads((root/(prefix+'.json')).read_text())
assert r['finished'] and r['contextClosed'] and not r.get('error')
assert r['driverSHA256']==hashlib.sha256((root/(prefix+'.mjs')).read_bytes()).hexdigest()
assert r['modelStatus']=='CPU · Qwen3 · 0.6B' and r['cpuCompletions']==1
assert r['answer'].strip() and not r['chatErrors'] and not r['errors']
assert r['documentBefore']==r['documentAfter']
assert r['state']['controller'] and r['state']['isolated']
assert any(url.endswith('/assets/'+r['currentEditor']) for url in r['state']['scripts'])
assert all(row['method']=='GET' and not row['hasBody'] for row in r['requests'])
print(f"Current cached-origin offline chat verified; {len(r['failures'])} request failures retained; not full acceptance.")
