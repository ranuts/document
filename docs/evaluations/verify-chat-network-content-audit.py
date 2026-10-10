import json,hashlib
from pathlib import Path
from urllib.parse import unquote
p=Path(__file__).parent
for backend in ['cpu','gpu']:
 r=json.loads((p/f'2026-10-04-{backend}-chat-network-content-audit.json').read_text())
 assert r['status']=='completed' and not r['errors'] and len(r['rows'])==1
 assert r['probeSHA256']==hashlib.sha256((p/f'probe-{backend}-chat-network-content-audit.mjs').read_bytes()).hexdigest()
 assert r['networkRequests']
 for q in r['networkRequests']:
  assert q['method']=='GET' and q['body'] is None
  assert q['url'].startswith(('http://127.0.0.1:5193/','blob:http://127.0.0.1:5193/'))
  assert r['marker'] not in unquote(q['url'])
 x=r['rows'][0]
 assert r['marker'] in x['text'] and not x['errors'] and x['reply'] and x['stats']
 assert not x['previews'] and x['before']==x['after']
 assert any(s.endswith('/assets/'+r['currentPlugin']) for s in r['seedResources'])
 if backend=='cpu': assert x['engine']=='CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf' and x['failedGpuLoads']==1
 else:
  assert x['engine']=='WebGPU · Qwen3 · 1.7B' and x['failedGpuLoads']==0
  assert x['inputs'] and all(i['modelId']==['Qwen3-1.7B-q4f16_1-MLC'] for i in x['inputs'])
 print(backend,len(r['networkRequests']),'observed GET requests; no body, external origin or URL marker')
