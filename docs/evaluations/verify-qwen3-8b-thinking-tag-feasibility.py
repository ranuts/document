import hashlib,json,re
from pathlib import Path
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-qwen3-8b-thinking-tag-feasibility.json').read_text())
cases=json.loads((p/'2026-10-04-document-writing-route-cases.json').read_text())
assert r['status']=='completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['probeSHA256']==hashlib.sha256((p/'probe-qwen3-8b-thinking-tag-feasibility.mjs').read_bytes()).hexdigest()
assert r['cases']==cases and len(r['results'])==8 and r['exactModelId']==r['modelId']=='Qwen3-8B-q4f16_1-MLC'
for i,c in enumerate(cases):
 a,b=r['results'][2*i:2*i+2]
 for x,v in [(a,'current'),(b,'thinking-tag')]:
  assert all(x[k]==val for k,val in c.items()) and x['variant']==v
  assert len(x['inputs'])==len(x['raw'])==1 and x['isolated'] and not x['previewCount']
  assert x['inputs'][0]['modelId']==[r['modelId']]
  if x['documentUnchanged']:assert x['errors'] and x['output']==x['selected']
  else:assert not x['errors'] and x['undoExact'] and x['redoExact']
 qa,qb=a['inputs'][0]['request'],b['inputs'][0]['request']
 assert qa['temperature']==0 and qa['max_tokens']==512 and qa['extra_body']['enable_thinking'] is False
 assert qb['temperature']==0.6 and qb['top_p']==0.95 and qb['max_tokens']==1536 and qb['extra_body']['enable_thinking'] is True
 assert qb['response_format']['type']=='structural_tag'
 tag=qb['response_format']['structural_tag']['format']['tags'][0]
 assert tag['begin']=='<final>' and tag['end']=='</final>' and tag['content']['json_schema']==json.loads(qa['response_format']['schema'])
 assert json.loads(qa['messages'][-1]['content'].split('\n')[-1])==json.loads(qb['messages'][-1]['content'].split('\n')[-1])
 assert b['documentUnchanged'] and b['errors'], 'Existing parser must not apply tagged reasoning output'
 matches=re.findall(r'<final>(.*?)</final>',b['raw'][0]['text'],re.S)
 valid=[]
 for match in matches:
  try:
   final=json.loads(match)
   if isinstance(final,dict) and set(final)=={'text'} and isinstance(final['text'],str):valid.append(final)
  except (ValueError,TypeError):pass
 print(c['id'],'complete JSON tags',len(valid),'stop reason',b['raw'][0]['stopReason'])
print('Eight actual requests: compatibility prototype identities/format/payload and protected native source verified; quality not certified')
