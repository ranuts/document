import hashlib,json
from pathlib import Path
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-system-prompt-context-guidance.json').read_text())
assert r['status']=='completed' and not r['errors']
assert r['probeSHA256']==hashlib.sha256((p/'probe-system-prompt-context-guidance.mjs').read_bytes()).hexdigest()
x=r['rows'][0];z=r['recovery']
assert len(x['errors'])==1 and 'custom system prompt' in x['errors'][0]
assert not x['replies'] and x['before']==x['after']
assert r['restoredDraft']==x['text']
assert len(z['replies'])==1 and z['stats'] and z['errors']==x['errors']
assert z['document']==x['before'] and z['engine']==x['engine'] and z['failedGpuLoads']==1
assert any(s.endswith('/assets/'+r['currentPlugin']) for s in r['seedResources'])
print('Current real CPU: actionable system-prompt overflow guidance, exact draft restore and successful resend without reload')
