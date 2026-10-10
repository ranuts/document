import json,hashlib,re
from pathlib import Path
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-document-writing-route-gpu.json').read_text())
cases=json.loads((p/'2026-10-04-document-writing-route-cases.json').read_text())
assert r['status']=='completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['cases']==cases and len(r['results'])==4
assert r['probeSHA256']==hashlib.sha256((p/'probe-document-writing-route-gpu.mjs').read_bytes()).hexdigest()
assert r['exactModelId']==r['modelId']=='Qwen3-1.7B-q4f16_1-MLC'
for c,x in zip(cases,r['results']):
 assert all(x[k]==v for k,v in c.items())
 assert x['selected']==c['source']+'\r\n' and not x['documentUnchanged']
 assert not x['errors'] and x['previewCount']==0 and x['isolated']
 assert x['undoExact'] and x['redoExact'] and x['undoText']==x['selected'] and x['redoText']==x['output']
 assert len(x['inputs'])==len(x['raw'])==1 and x['inputs'][0]['modelId']==[r['modelId']]
 q=x['inputs'][0]['request'];assert q['temperature']==0 and q['max_tokens']==512 and q['response_format']['schema']
 d=json.loads(q['messages'][-1]['content'].split('\n')[-1])
 assert d['task']==c['task'] and d['text']==c['source']+'\n' and d['instruction']==c['instruction']
 text=json.loads(re.sub(r'^\s*<think>\s*</think>\s*','',x['raw'][0]['text']))['text']
 assert x['output']==text+'\r\n'
print('Four exact structured GPU writing requests applied natively with Undo/Redo; semantic correctness not implied')
