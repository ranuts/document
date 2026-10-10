import hashlib,json,pathlib
root=pathlib.Path(__file__).parent
r=json.loads((root/'2026-10-04-qwen25-3b-browser-cpu-reference.json').read_text())
prior=json.loads((root/'2026-10-04-qwen25-3b-date-tokens.json').read_text())
assert r['status']=='completed' and r['phase']=='completed' and not r['errors']
assert r['probeSHA256']==hashlib.sha256((root/'probe-qwen25-3b-browser-cpu-reference.mjs').read_bytes()).hexdigest()
assert r['modelSHA256']=='626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d' and r['modelBytes']==2104932768
assert r['cases']==prior['cases'] and len(r['results'])==4
runtime=r['runtime']
assert runtime['crossOriginIsolated'] and not runtime['navigatorGPU'] and not runtime['compatibility'] and not runtime['hasInlineWorker']
assert runtime['threads']==4 and runtime['context']==2048 and runtime['fileBytes']==r['modelBytes']
assert runtime['wasmUrl']=='http://127.0.0.1:5193/assets/wllama-BITawafS.wasm'
for name,digest in r['assetHashes'].items():
 assert hashlib.sha256((root.parents[1]/'dist/assets'/name).read_bytes()).hexdigest()==digest
assert {x['id'] for x in r['results']}=={c['id'] for c in r['cases']}
for x in r['results']:
 case=next(c for c in r['cases'] if c['id']==x['id'])
 original=next(z for z in prior['results'] if z['id']==x['id'] and z['variant']=='baseline')['inputs'][0]['request']
 request=x['request'];choice=x['completion']['choices'][0]
 assert request['messages']==original['messages'] and request['temperature']==0 and request['top_p']==0.8 and request['max_tokens']==512 and not request['stream']
 assert request['response_format']['json_schema']['schema']==json.loads(original['response_format']['schema'])
 assert x['source']==case['source'] and x['expected']==case['expected'] and choice['finish_reason']=='stop'
 assert json.loads(choice['message']['content'])=={'text':case['expected']} and x['exact']
assert all(q['url'].startswith('http://127.0.0.1:5193/') for q in r['requests'])
print('Four same-GGUF browser CPU Worker date-copy outputs verified; shipped SDK/WASM hashes and schema/messages match diagnostic controls.')
print('Standalone SDK calls, not IM/product fidelity or general cause isolation.')
