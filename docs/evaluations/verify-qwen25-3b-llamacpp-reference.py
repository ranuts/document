import hashlib,json,pathlib
root=pathlib.Path(__file__).parent
r=json.loads((root/'2026-10-04-qwen25-3b-llamacpp-reference.json').read_text())
prior=json.loads((root/'2026-10-04-qwen25-3b-date-tokens.json').read_text())
assert r['status']=='completed' and not r['errors']
assert r['probeSHA256']==hashlib.sha256((root/'probe-qwen25-3b-llamacpp-reference.py').read_bytes()).hexdigest()
assert r['model']['revision']=='7dabda4d13d513e3e842b20f0d435c732f172cbe'
assert r['model']['bytes']==2104932768 and r['model']['sha256']=='626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d'
assert r['cases']==prior['cases'] and len(r['results'])==8
args=r['runtime']['args']
assert args[args.index('--device')+1]=='none' and args[args.index('--n-gpu-layers')+1]=='0'
assert args[args.index('--host')+1]=='127.0.0.1' and '--no-op-offload' in args and '--no-cache-prompt' in args
for case in r['cases']:
 rows=[x for x in r['results'] if x['id']==case['id']]
 assert [x['penalty'] for x in rows]==[1.05,1.0]
 baseline=next(x for x in prior['results'] if x['id']==case['id'] and x['variant']=='baseline')['inputs'][0]['request']
 for x in rows:
  q=x['request'];completion=x['completion'];choice=completion['choices'][0]
  assert q['messages']==baseline['messages'] and q['temperature']==0 and q['top_p']==0.8 and q['max_tokens']==512
  assert q['repeat_penalty']==x['penalty'] and q['repeat_last_n']==4096 and q['seed']==42 and not q['cache_prompt']
  assert q['response_format']['schema']==json.loads(baseline['response_format']['schema'])
  assert choice['finish_reason']=='stop'
  text=json.loads(choice['message']['content'])
  assert set(text)=={'text'} and x['expected']==case['expected'] and x['source']==case['source']
  assert x['exact']==(text['text']==case['expected'])
print('Eight independent native CPU requests verified; exact date-copy results:',sum(x['exact'] for x in r['results']),'/8.')
print('Different GGUF quantization/template/runtime and penalty implementation; not an isolated cause or browser/product certification.')
