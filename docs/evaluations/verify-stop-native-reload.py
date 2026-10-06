import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[2];p=root/'docs/evaluations'
r=json.loads((p/'2026-10-05-stop-native-reload.json').read_text())
assert r['passed'] and r['contextClosed'],r.get('error')
probe=(p/'probe-stop-native-reload.mjs').read_bytes()
assert probe==subprocess.check_output(['git','show','3875833:docs/evaluations/probe-stop-native-reload.mjs'],cwd=root)
assert hashlib.sha256(probe).hexdigest()==r['probeSHA256']
assert hashlib.sha256((root/'dist/assets'/r['plugin']).read_bytes()).hexdigest()==r['pluginSHA256']
assert 'CPU' in r['engine'] and 'qwen2.5-0.5b' in r['engine']
assert len(r['partialText'])>=40
assert r['ready']['loads']==r['ready']['exits']==r['ready']['generations']==r['ready']['userMessages']==1
assert not r['ready']['sendDisabled'] and r['ready']['draft']=='请只回复 BRAVO，不要操作文档。'
assert r['sent']['generations']==r['sent']['userMessages']==2 and r['sent']['draft']==''
assert r['documentBefore']==r['documentAfter']
assert not r['errors'] and not r['guidance'] and r['previewCount']==0
assert r['reply']
print('Current IM native CPU stream/Stop, one ungated exit/reload, explicit second send, unchanged document and cleanup verified. Reply quality and cache retention are not inferred.')
