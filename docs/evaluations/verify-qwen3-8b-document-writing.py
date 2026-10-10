import json,hashlib,re
from pathlib import Path
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-qwen3-8b-document-writing.json').read_text())
cases=json.loads((p/'2026-10-04-document-writing-route-cases.json').read_text())
assert r['status']=='completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['cases']==cases and len(r['results'])==4
assert r['probeSHA256']==hashlib.sha256((p/'probe-qwen3-8b-document-writing.mjs').read_bytes()).hexdigest()
assert r['exactModelId']==r['modelId']=='Qwen3-8B-q4f16_1-MLC'
for c,x in zip(cases,r['results']):
 assert all(x[k]==v for k,v in c.items())
 assert x['selected']==c['source']+'\r\n'
 assert x['previewCount']==0 and x['isolated']
 if x['documentUnchanged']:assert x['errors'] and x['output']==x['selected']
 else:assert not x['errors'] and x['undoExact'] and x['redoExact'] and x['undoText']==x['selected'] and x['redoText']==x['output']
 assert len(x['inputs'])==len(x['raw'])==1 and x['inputs'][0]['modelId']==[r['modelId']]
 q=x['inputs'][0]['request'];assert q['temperature']==0 and q['max_tokens']==512 and q['response_format']['schema']
 d=json.loads(q['messages'][-1]['content'].split('\n')[-1])
 assert d['task']==c['task'] and d['text']==c['source']+'\n' and d['instruction']==c['instruction']
 if not x['documentUnchanged']:
  text=json.loads(re.sub(r'^\s*<think>\s*</think>\s*','',x['raw'][0]['text']))['text']
  expected=text.replace('\r\n','\n').replace('\n','\r\n')
  if not expected.endswith('\r\n'):expected+='\r\n'
  assert x['output']==expected
print('Four exact Qwen3 8B structured requests: native edits/refusals and Undo/Redo; semantic correctness not implied')

baseline=json.loads((p/'2026-10-04-document-writing-route-gpu.json').read_text())
for a,b in zip(baseline['results'],r['results']):
 assert a['inputs'][0]['request']==b['inputs'][0]['request'], 'Comparison must use identical schema/system/user/sampling input'
print('Default and 8B captured inference requests are identical apart from Worker model identity')
