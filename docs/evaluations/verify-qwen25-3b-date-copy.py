"""Validate diagnostic requests and native mechanics; report exact extraction separately."""
import hashlib,json,pathlib,re
root=pathlib.Path(__file__).parent
report=json.loads((root/'2026-10-04-qwen25-3b-date-copy.json').read_text())
assert report['status']=='completed' and not report['errors'] and report['bundleBytesUnchanged']
assert report['probeSHA256']==hashlib.sha256((root/'probe-qwen25-3b-date-copy.mjs').read_bytes()).hexdigest()
assert report['variants']==['production','minimal'] and report['repetitions']==1
assert len(report['cases'])==8 and len(report['results'])==16
assert report['modelId']=='Qwen2.5-3B-Instruct-q4f32_1-MLC'
assert 'WebGPU' in report['engine'] and report['modelId'] in report['engine']
plugins=list((root.parents[1]/'dist/assets').glob('agent-plugin-*.js'))
assert len(plugins)==1 and hashlib.sha256(plugins[0].read_bytes()).hexdigest()==report['bundleHashes']['plugin']
system='Copy the ISO date from the user text exactly. Return only JSON with one text field containing that date.'
counts={v:0 for v in report['variants']}
for case in report['cases']:
 assert case['expected']==re.search(r'\d{4}-\d{2}-\d{2}',case['source'])[0]
 rows=[r for r in report['results'] if r['id']==case['id']]
 assert [r['variant'] for r in rows]==report['variants']
 left,right=[r['inputs'][0]['request'] for r in rows]
 assert {k:v for k,v in left.items() if k!='messages'}=={k:v for k,v in right.items() if k!='messages'}
 data=json.loads(left['messages'][-1]['content'].split('\n')[-1])
 assert data['task']=='summarize' and data['text'].rstrip('\r\n')==case['source'] and data['instruction']==case['instruction']
 assert right['messages']==[{'role':'system','content':system},{'role':'user','content':data['text']}]
 for row in rows:
  assert row['selected'].removesuffix('\r\n')==case['source']
  assert row['source']==case['source'] and row['instruction']==case['instruction'] and row['expected']==case['expected']
  assert len(row['raw'])==len(row['inputs'])==1 and row['isolated'] and not row['previewCount']
  request=row['inputs'][0]['request']
  assert row['inputs'][0]['modelId']==[report['modelId']]
  assert request['temperature']==0 and request['top_p']==0.8 and request['max_tokens']==512 and request['response_format']['schema']
  if row['documentUnchanged']:
   assert row['output']==row['selected'] and row['errors']
  else:
   assert not row['errors'] and row['undoExact'] and row['redoExact']
   assert row['undoText']==row['selected'] and row['redoText']==row['output']
  text=json.loads(row['raw'][0]['text'])['text']
  counts[row['variant']]+=text==case['expected']
print('16 real date-copy requests verified; only messages differ in each pair. Exact date-only outputs:',counts)
print('Not a summary fidelity, prompt repair, offline or mobile certification.')
