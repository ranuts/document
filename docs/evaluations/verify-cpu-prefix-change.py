import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[2];p=root/'docs/evaluations'
r=json.loads((p/'2026-10-05-cpu-prefix-change.json').read_text())
assert r['status']=='completed',r.get('error')
assert r['contextClosed'] and not r['errors'] and len(r['rows'])==4
probe=(p/'probe-cpu-prefix-change.mjs').read_bytes()
assert hashlib.sha256(probe).hexdigest()==r['probeSHA256']
assert probe==subprocess.check_output(['git','show','ac47b66:docs/evaluations/probe-cpu-prefix-change.mjs'],cwd=root)
def digest(file):
 h=hashlib.sha256()
 with open(file,'rb') as f:
  while chunk:=f.read(1024*1024):h.update(chunk)
 return h.hexdigest()
assert digest(root/r['model']['path'])==r['model']['sha256']
assert digest(root/'dist/assets/wllama-BITawafS.wasm')==r['nativeSHA256']
assert r['servedClientSHA256']==r['clientSHA256']==digest(root/'dist/assets/client-D5_UYdz1.js')
by_mode={mode:[x for x in r['rows'] if x['mode']==mode] for mode in ['omitted','false']}
for mode,rows in by_mode.items():
 assert [x['label'] for x in rows]==['ALPHA','BRAVO'] and [x['repeat'] for x in rows]==[0,1]
 for row in rows:
  assert row['request']['messages'][-1]['content'].endswith('Current final label: '+row['label']+'. Reply with that label only.')
  assert row['response']['choices'][0]['message']['content'] in {row['label'],row['label']+'.'}
  if mode=='omitted':assert 'cache_prompt' not in row['request']
  else:assert row['request']['cache_prompt'] is False
 cached=[x['response']['usage']['prompt_tokens_details']['cached_tokens'] for x in rows]
 assert cached[0]==0 and ((cached[1]>0)==(mode=='omitted'))
for i in [0,1]:
 a=dict(by_mode['omitted'][i]['request']);b=dict(by_mode['false'][i]['request']);b.pop('cache_prompt');assert a==b
print('Changed-label native prefix reuse, current-label replies (period tolerated explicitly), served SDK identity and cleanup verified; no global context-isolation or format claim.')
