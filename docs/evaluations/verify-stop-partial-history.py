import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[2];p=root/'docs/evaluations'
r=json.loads((p/'2026-10-05-stop-partial-history.json').read_text())
assert r['status']=='completed' and r['contextClosed'] and not r['errors']
probe=(p/'probe-stop-partial-history.mjs').read_bytes()
assert probe==subprocess.check_output(['git','show','56efc22:docs/evaluations/probe-stop-partial-history.mjs'],cwd=root)
assert hashlib.sha256(probe).hexdigest()==r['probeSHA256']
source='docs/evaluations/2026-10-05-stop-native-requests.json';data=(root/source).read_bytes()
assert data==subprocess.check_output(['git','show','b4d2100:'+source],cwd=root)
assert hashlib.sha256(data).hexdigest()==r['sourceSHA256']
base=json.loads(data)['sent']['sdk'][1]['request']
def digest(file):
 h=hashlib.sha256()
 with open(file,'rb') as f:
  while chunk:=f.read(1024*1024):h.update(chunk)
 return h.hexdigest()
assert r['model']['bytes']==491400032 and digest(root/r['model']['path'])==r['model']['sha256']
assert digest(root/'dist/assets/wllama-BITawafS.wasm')==r['nativeSHA256']
assert r['servedClientSHA256']==r['clientSHA256']==digest(root/'dist/assets/client-D5_UYdz1.js')
assert [row['mode'] for row in r['rows']]==['partial','partial-status']
partial=''.join(choice.get('delta',{}).get('content') or '' for chunk in json.loads(data)['sent']['sdk'][0]['chunks'] for choice in chunk['choices'])
assert r['partial']==partial and partial
for row in r['rows']:
 messages=base['messages']
 messages=messages[:-1]+[{'role':'assistant','content':partial+('\n[已停止。]' if row['mode']=='partial-status' else '')},messages[-1]]
 expected={**base,'messages':messages,'max_tokens':32,'stream':False};expected.pop('stream_options')
 assert row['request']==expected
 assert row['response']['choices']
 print(row['mode'],row['response']['choices'][0]['finish_reason'],repr(row['response']['choices'][0]['message']['content']))
print('Frozen source, matched 0.5B history-shape requests, native/served-client identities and cleanup verified; not default-model or history-dropping acceptance.')

