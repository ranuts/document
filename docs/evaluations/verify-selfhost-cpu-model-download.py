import hashlib,json
from pathlib import Path
from urllib.parse import unquote
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-selfhost-cpu-model-download.json').read_text())
assert r['status']=='completed' and not r['errors']
assert r['probeSHA256']==hashlib.sha256((p/'probe-selfhost-cpu-model-download.mjs').read_bytes()).hexdigest()
assert r['artifactBytes']==484220320
assert any(q['method']=='HEAD' for q in r['served'])
assert sum(q['responseBytes'] for q in r['served'] if q['method']=='GET')==r['artifactBytes']
assert all(q['requestBytes']==0 and q['url']=='/model.gguf' for q in r['served'])
assert any(q['url']==r['modelUrl'] and q['method']=='GET' for q in r['networkRequests'])
for q in r['networkRequests']:
 assert q['body'] is None and r['marker'] not in unquote(q['url'])
x=r['rows'][0]
assert x['selectedProvider']=='wllama' and x['engine']=='CPU · model.gguf'
assert not x['errors'] and x['reply'] and x['stats'] and not x['previews']
assert x['before']==x['after']
assert any(q.endswith('/assets/'+r['currentPlugin']) for q in r['seedResources'])
print('Actual cross-origin self-hosted GGUF: complete 484220320-byte transfer, CPU load/chat, no request body or URL message marker')
