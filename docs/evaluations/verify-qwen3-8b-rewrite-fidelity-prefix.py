import hashlib,json,re
from pathlib import Path
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-qwen3-8b-rewrite-fidelity-prefix.json').read_text())
cases=[x for x in json.loads((p/'2026-10-04-seven-language-writing-cases.json').read_text()) if x['task']=='rewrite']
assert r['status']=='completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['probeSHA256']==hashlib.sha256((p/'probe-qwen3-8b-rewrite-fidelity-prefix.mjs').read_bytes()).hexdigest()
assert r['cases']==cases and len(r['results'])==14 and r['exactModelId']==r['modelId']=='Qwen3-8B-q4f16_1-MLC'
old='Rewrite the source to improve clarity and grammar. Do not return it unchanged.'
new='Rewrite the source in its original language or languages; do not translate it. Improve style while preserving who does what to whom, negation, conditions, uncertainty and whether actions are proposed or completed. Preserve the meaning of each relationship without adding implications. Do not return the source unchanged.'
for i,c in enumerate(cases):
 a,b=r['results'][2*i:2*i+2]
 for x,v in [(a,'current'),(b,'rewrite-fidelity')]:
  assert all(x[k]==val for k,val in c.items()) and x['variant']==v
  assert len(x['inputs'])==len(x['raw'])==1 and x['isolated'] and not x['previewCount']
  assert x['inputs'][0]['modelId']==[r['modelId']]
  q=x['inputs'][0]['request'];assert q['temperature']==0 and q['max_tokens']==512 and q['response_format']['schema']
  assert x['selected']==c['source']+'\r\n'
  if x['documentUnchanged']:assert x['errors'] and x['output']==x['selected']
  else:
   assert not x['errors'] and x['undoExact'] and x['redoExact'] and x['undoText']==x['selected'] and x['redoText']==x['output']
 qa,qb=a['inputs'][0]['request'],b['inputs'][0]['request']
 assert {k:v for k,v in qa.items() if k!='messages'}=={k:v for k,v in qb.items() if k!='messages'}
 assert qa['messages'][:-1]==qb['messages'][:-1]
 assert qa['messages'][-1]['content'].startswith(old+'\n')
 assert qb['messages'][-1]['content']==new+qa['messages'][-1]['content'][len(old):]
print('14 exact native rewrite requests: only constant task prefix changed; model/schema/JSON/system/sampling and history verified')
