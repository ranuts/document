import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[2];p=root/'docs/evaluations'
r=json.loads((p/'2026-10-05-stop-native-requests.json').read_text())
assert r['passed'] and r['contextClosed'] and not r['errors'] and not r['guidance']
probe=(p/'probe-stop-native-requests.mjs').read_bytes()
assert probe==subprocess.check_output(['git','show','5819160:docs/evaluations/probe-stop-native-requests.mjs'],cwd=root)
assert hashlib.sha256(probe).hexdigest()==r['probeSHA256']
assert hashlib.sha256((root/'dist/assets'/r['plugin']).read_bytes()).hexdigest()==r['pluginSHA256']
a,b=r['sent']['sdk'];assert not a['returned'] and a['chunks'] and a.get('error')
assert b['returned'] and b['chunks'] and not b.get('error')
messages=b['request']['messages'];assert [m['role'] for m in messages]==['system','user','user']
assert '旧钟' in messages[1]['content'] and 'BRAVO' in messages[2]['content']
text=''.join(choice.get('delta',{}).get('content') or '' for chunk in b['chunks'] for choice in chunk['choices'])
assert text=='请描述一位工匠修理旧钟的过程。' and 'BRAVO' not in text
assert r['reply']==text+'写入文档'
assert r['documentBefore']==r['documentAfter'] and r['previewCount']==0
print('Actual new instruction present, consecutive pending user messages and raw SDK old-request answer verified; UI matches raw output. Causal history-boundary repair remains unproven.')
