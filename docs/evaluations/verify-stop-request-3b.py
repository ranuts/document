import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[2];p=root/'docs/evaluations'
r=json.loads((p/'2026-10-05-stop-request-3b.json').read_text())
assert r['status']=='completed' and r['contextClosed'] and not r['errors']
probe=(p/'probe-stop-request-3b.mjs').read_bytes()
assert probe==subprocess.check_output(['git','show','08a3c6c:docs/evaluations/probe-stop-request-3b.mjs'],cwd=root)
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
assert r['model']['bytes']==2104932768 and digest(root/r['model']['path'])==r['model']['sha256']
assert digest(root/'dist/assets/wllama-BITawafS.wasm')==r['nativeSHA256']
assert r['servedClientSHA256']==r['clientSHA256']==digest(root/'dist/assets/client-D5_UYdz1.js')
assert [row['mode'] for row in r['rows']]==['original','boundary','fresh']
for row in r['rows']:
 messages=base['messages']
 if row['mode']=='boundary':messages=messages[:-1]+[{'role':'assistant','content':'已停止。'},messages[-1]]
 if row['mode']=='fresh':messages=[messages[0],messages[-1]]
 expected={**base,'messages':messages,'max_tokens':32,'stream':False};expected.pop('stream_options')
 assert row['request']==expected
 assert row['response']['choices']
 print(row['mode'],row['response']['choices'][0]['finish_reason'],repr(row['response']['choices'][0]['message']['content']))
print('Frozen source, matched 3B history-shape requests, native/served-client identities and cleanup verified; not default-model or history-dropping acceptance.')
