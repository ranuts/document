import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[2];p=root/'docs/evaluations'
r=json.loads((p/'2026-10-05-cpu-prefix-cache.json').read_text())
assert r['status']=='completed',r.get('error')
assert r['contextClosed'] and not r['errors'] and len(r['rows'])==6
probe=(p/'probe-cpu-prefix-cache.mjs').read_bytes()
assert hashlib.sha256(probe).hexdigest()==r['probeSHA256']
assert probe==subprocess.check_output(['git','show','826c89f:docs/evaluations/probe-cpu-prefix-cache.mjs'],cwd=root)
def digest(file):
 h=hashlib.sha256()
 with open(file,'rb') as f:
  while chunk:=f.read(1024*1024):h.update(chunk)
 return h.hexdigest()
assert (root/r['model']['path']).stat().st_size==r['model']['bytes']
assert digest(root/r['model']['path'])==r['model']['sha256']
assert digest(root/'dist/assets'/r['runtime'])==r['runtimeSHA256']
assert digest(root/'dist/assets/wllama-BITawafS.wasm')==r['nativeSHA256']
base=None
for mode in ['omitted','false','true']:
 rows=[x for x in r['rows'] if x['mode']==mode];assert [x['repeat'] for x in rows]==[0,1]
 assert rows[0]['request']==rows[1]['request']
 request=dict(rows[0]['request'])
 if mode=='omitted':assert 'cache_prompt' not in request
 else:assert request.pop('cache_prompt')==(mode=='true')
 if base is None:base=request
 else:assert request==base
 cached=[x['response']['usage']['prompt_tokens_details']['cached_tokens'] for x in rows]
 assert cached[0]==0
 assert (cached[1]>0)==(mode!='false')
 assert all(x['wallMs']>0 and x['response']['choices'] for x in rows)
print('Native identical-request cache contrast, frozen driver, model/WASM identities and context cleanup verified. No global speed or semantic-quality claim.')
