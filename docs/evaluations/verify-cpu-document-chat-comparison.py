import json,hashlib
from pathlib import Path
p=Path(__file__).parent
cases=json.loads((p/'2026-10-04-cpu-document-chat-cases.json').read_text())
reports=[]
for name,probe in [('qwen25-05b-document-chat','probe-qwen25-05b-document-chat.mjs'),('qwen3-06b-document-chat-baseline','probe-qwen3-06b-document-chat-baseline.mjs')]:
 r=json.loads((p/f'2026-10-04-{name}.json').read_text());reports.append(r)
 assert r['status']=='completed' and not r['errors'] and r['bundleUnchanged'] and r['cases']==cases
 assert r['probeSHA256']==hashlib.sha256((p/probe).read_bytes()).hexdigest()
 assert len(r['results'])==4 and r['routeHits'] and r['engine']=='CPU · model.gguf'
 assert sum(x['responseBytes'] for x in r['served'] if x['method']=='GET')==r['artifactBytes']
 for c,x in zip(cases,r['results']):
  assert all(x[k]==v for k,v in c.items()) and x['variant']=='current'
  assert len(x['requests'])==len(x['replies'])==1 and not x['errors'] and not x['previews']
  q=x['requests'][0]['request']
  assert q['temperature']==0 and q['top_p']==0.8 and q['max_tokens']==512 and q['stream']
  assert c['text'] in q['messages'][-1]['content']
for a,b in zip(reports[0]['results'],reports[1]['results']):
 assert a['requests'][0]['request']==b['requests'][0]['request']
provenance=json.loads((p/'2026-10-04-qwen25-05b-artifact-provenance.json').read_text())
assert reports[0]['artifactSHA256']==provenance['expectedLfsSHA256']==provenance['actualSHA256']
assert reports[0]['artifactBytes']==provenance['bytes']==397808192
assert reports[1]['artifactBytes']==484220320 and reports[0]['artifactSHA256']!=reports[1]['artifactSHA256']
print('Two real CPU artifacts, full transfers, four identical captured document-task requests; semantic quality remains manual')
