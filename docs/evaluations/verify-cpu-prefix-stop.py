import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[2];p=root/'docs/evaluations'
r=json.loads((p/'2026-10-05-cpu-prefix-stop.json').read_text())
assert r['status']=='completed' and r['contextClosed'] and not r['errors']
probe=(p/'probe-cpu-prefix-stop.mjs').read_bytes()
assert probe==subprocess.check_output(['git','show','07d98fd:docs/evaluations/probe-cpu-prefix-stop.mjs'],cwd=root)
assert hashlib.sha256(probe).hexdigest()==r['probeSHA256']
def digest(file):
 h=hashlib.sha256()
 with open(file,'rb') as f:
  while chunk:=f.read(1024*1024):h.update(chunk)
 return h.hexdigest()
assert digest(root/r['model']['path'])==r['model']['sha256']
assert digest(root/'dist/assets/wllama-BITawafS.wasm')==r['nativeSHA256']
assert r['servedClientSHA256']==r['clientSHA256']==digest(root/'dist/assets/client-D5_UYdz1.js')
assert len(r['rows'])==2
cancel,resume=r['rows'];assert [cancel['phase'],resume['phase']]==['cancel','resume']
assert cancel['aborted'] and not cancel['returnedNormally'] and cancel['error']['name']=='AbortError'
assert any(choice.get('delta',{}).get('content') for chunk in cancel['chunks'] for choice in chunk['choices'])
assert all(choice['finish_reason'] is None for chunk in cancel['chunks'] for choice in chunk['choices'])
assert cancel['abortToSettlementMs']>=0
assert resume['response']['choices'][0]['message']['content']=='BRAVO.'
assert resume['response']['usage']['prompt_tokens_details']['cached_tokens']>0
assert all('cache_prompt' not in row['request'] for row in r['rows'])
print('Actual partial SDK stream cancellation, changed-label recovery, native cache reuse, served SDK identity and cleanup verified; no product Stop or general isolation acceptance.')
