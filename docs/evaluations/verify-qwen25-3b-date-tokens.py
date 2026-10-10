"""Verify boundary/token/native evidence; probabilities at temperature zero are not confidence."""
import hashlib,json,pathlib
root=pathlib.Path(__file__).parent
r=json.loads((root/'2026-10-04-qwen25-3b-date-tokens.json').read_text())
assert r['status']=='completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['probeSHA256']==hashlib.sha256((root/'probe-qwen25-3b-date-tokens.mjs').read_bytes()).hexdigest()
assert r['variants']==['baseline','logged'] and r['repetitions']==3
assert len(r['cases'])==4 and len(r['results'])==24
assert {c['id'] for c in r['cases']}=={'date-22','date-current','zh-date','pt-date'}
assert r['modelId']=='Qwen2.5-3B-Instruct-q4f32_1-MLC' and 'WebGPU' in r['engine']
plugins=list((root.parents[1]/'dist/assets').glob('agent-plugin-*.js'))
assert len(plugins)==1 and hashlib.sha256(plugins[0].read_bytes()).hexdigest()==r['bundleHashes']['plugin']
for case in r['cases']:
 rows=[x for x in r['results'] if x['id']==case['id']]
 assert len(rows)==6 and {x['repetition'] for x in rows}=={0,1,2}
 for repetition in range(3):
  pair=[x for x in rows if x['repetition']==repetition]
  assert [x['variant'] for x in pair]==(['baseline','logged'] if repetition%2==0 else ['logged','baseline'])
  baseline=next(x for x in pair if x['variant']=='baseline')['inputs'][0]['request']
  logged=next(x for x in pair if x['variant']=='logged')['inputs'][0]['request']
  assert not baseline.get('logprobs') and not baseline.get('top_logprobs')
  assert logged['logprobs'] is True and logged['top_logprobs']==5
  assert baseline=={k:v for k,v in logged.items() if k not in ('logprobs','top_logprobs')}
 assert len({json.dumps(x['inputs'][0]['request'],sort_keys=True) for x in rows if x['variant']=='baseline'})==1
 assert len({x['raw'][0]['text'] for x in rows})==1, 'Observed outputs differ; revise repeatability report'
 for x in rows:
  assert x['selected'].removesuffix('\r\n')==case['source']
  assert x['source']==case['source'] and x['expected']==case['expected']
  assert len(x['inputs'])==len(x['raw'])==len(x['completions'])==1 and x['isolated'] and not x['previewCount']
  q=x['inputs'][0]['request']
  assert x['inputs'][0]['modelId']==[r['modelId']]
  assert q['temperature']==0 and q['top_p']==0.8 and q['max_tokens']==512 and q['response_format']['schema']
  assert q['messages']==[{'role':'system','content':'Copy the ISO date from the user text exactly. Return only JSON with one text field containing that date.'},{'role':'user','content':x['selected'].replace('\r\n','\n')}]
  completion=x['completions'][0]['content'];choice=completion['choices'][0]
  assert choice['message']['content']==x['raw'][0]['text'] and choice['finish_reason']==x['raw'][0]['stopReason']=='stop'
  if x['variant']=='logged':
   tokens=choice['logprobs']['content']
   assert tokens[-1]['token']=='<|im_end|>'
   assert ''.join(t['token'] for t in tokens[:-1])==choice['message']['content']
   for token in tokens:
    assert token['bytes']==list(token['token'].encode()) and len(token['top_logprobs'])==5
  else:assert choice['logprobs'] is None
  if x['documentUnchanged']:
   assert x['output']==x['selected'] and x['errors']
  else:
   assert not x['errors'] and x['undoExact'] and x['redoExact']
   assert x['undoText']==x['selected'] and x['redoText']==x['output']
print('24 actual requests verified; four sources repeat identically across three repetitions and logging variants.')
print('All 12 logged token sequences reconstruct raw Worker/provider text exactly; native refusals and Undo/Redo verified.')
