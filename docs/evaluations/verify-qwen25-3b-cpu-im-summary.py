import hashlib,json,pathlib
root=pathlib.Path(__file__).parent
r=json.loads((root/'2026-10-04-qwen25-3b-cpu-im-summary.json').read_text())
cases=[c for c in json.loads((root/'2026-10-04-seven-language-writing-cases.json').read_text()) if c['task']=='summarize']
assert r['status']=='completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['probeSHA256']==hashlib.sha256((root/'probe-qwen25-3b-cpu-im-summary.mjs').read_bytes()).hexdigest()
assert r['cases']==cases and len(r['results'])==7 and r['variants']==['production'] and r['repetitions']==1
assert r['modelId']=='qwen2.5-3b-instruct-q4_k_m.gguf' and 'CPU' in r['engine'] and r['modelId'] in r['engine']
model=json.loads((root/'2026-10-04-qwen25-3b-cpu-im-model-file.json').read_text())
assert model['bytes']==2104932768 and model['sha256']=='626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d'
assert model['path']=='.scratch/node_modules/ai-models/'+r['modelId']
plugins=list((root.parents[1]/'dist/assets').glob('agent-plugin-*.js'))
assert len(plugins)==1 and hashlib.sha256(plugins[0].read_bytes()).hexdigest()==r['bundleHashes']['plugin']
assert {x['id'] for x in r['results']}=={c['id'] for c in cases}
for x in r['results']:
 case=next(c for c in cases if c['id']==x['id'])
 assert x['source']==case['source'] and x['instruction']==case['instruction'] and x['rubric']==case['rubric']
 assert x['selected'].removesuffix('\r\n')==case['source']
 assert len(x['inputs'])==len(x['raw'])==1 and x['isolated'] and not x['previewCount']
 q=x['inputs'][0]['request']
 assert q['temperature']==0 and q['top_p']==0.8 and q['max_tokens']==512 and not q['stream']
 assert q['response_format']['json_schema']['schema']=={'type':'object','additionalProperties':False,'required':['text'],'properties':{'text':{'type':'string'}}}
 data=json.loads(q['messages'][-1]['content'].split('\n')[-1])
 assert data['task']=='summarize' and data['targetLanguage']=='source'
 assert data['text']==x['selected'].replace('\r\n','\n') and data['instruction']==case['instruction']
 assert 'Produce a concise summary shorter than the source' in q['messages'][-1]['content']
 assert x['raw'][0]['stopReason']=='stop'
 if x['documentUnchanged']:
  assert x['output']==x['selected'] and x['errors']
 else:
  assert not x['errors'] and x['undoExact'] and x['redoExact']
  assert x['undoText']==x['selected'] and x['redoText']==x['output']
print('Seven real CPU 3B native Word IM summaries verified; captured production requests, refusal source protection and native Undo/Redo. Not semantic acceptance.')
