import hashlib,json
from pathlib import Path
p=Path(__file__).parent
for prefix,probe in [('', 'probe-chat-context-order.mjs'),('cpu-','probe-cpu-chat-context-order.mjs')]:
 r=json.loads((p/f'2026-10-04-{prefix}chat-context-order.json').read_text())
 assert r['status']=='completed' and not r['errors'] and r['bundleUnchanged']
 assert r['probeSHA256']==hashlib.sha256((p/probe).read_bytes()).hexdigest()
 assert len(r['cases'])==4 and len(r['results'])==8
 for i,c in enumerate(r['cases']):
  a,b=r['results'][2*i:2*i+2]
  assert a['variant']=='current' and b['variant']=='request-first'
  for x in [a,b]:
   assert all(x[k]==v for k,v in c.items()) and not x['errors'] and x['previews']==0
   assert len(x['replies'])==1
  if prefix:
   assert not a['requests'] and not b['requests']
   continue
  assert len(a['requests'])==len(b['requests'])==1
  qa,qb=a['requests'][0],b['requests'][0]
  assert qa['before']==qb['before']
  delimiter='\n\nUser request:\n';split=qa['before'].index(delimiter)
  expected='User request:\n'+qa['before'][split+len(delimiter):]+'\n\n'+qa['before'][:split]
  if prefix:
   assert qa['after']==qa['before'] and qb['after']==expected
  else:
   ra,rb=qa['content']['request'],qb['content']['request']
   assert ra['temperature']==rb['temperature']==0 and ra['max_tokens']==rb['max_tokens']==96
   assert ra['messages'][-1]['content']==qa['before'] and rb['messages'][-1]['content']==expected
   assert ra['messages'][:-1]==rb['messages'][:-1]
  assert a['replies']==b['replies']
 print('cpu: instrumentation absent, input-order comparison invalid' if prefix else 'gpu: four known paired cases, exact reorder and identical replies, no adoption')
