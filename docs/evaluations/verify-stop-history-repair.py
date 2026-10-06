import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[2];p=root/'docs/evaluations'
r=json.loads((p/'2026-10-05-stop-history-repair.json').read_text())
assert r['passed'] and r['contextClosed'] and not r['errors'] and not r['guidance']
probe=(p/'probe-stop-history-repair.mjs').read_bytes()
assert probe==subprocess.check_output(['git','show','27c35a2:docs/evaluations/probe-stop-history-repair.mjs'],cwd=root)
assert hashlib.sha256(probe).hexdigest()==r['probeSHA256']
assert hashlib.sha256((root/'dist/assets'/r['plugin']).read_bytes()).hexdigest()==r['pluginSHA256']
a,b=r['sent']['sdk'];assert not a['returned'] and b['returned']
messages=b['request']['messages']
assert [m['role'] for m in messages]==['system','user','assistant','assistant','user']
assert messages[2]=={'role':'assistant','content':r['interruptedVisible']}
assert messages[3]=={'role':'assistant','content':'已停止。'}
assert 'BRAVO' in messages[-1]['content']
text=''.join(c.get('delta',{}).get('content') or '' for chunk in b['chunks'] for c in chunk['choices'])
assert text=='BRAVO。' and r['reply']==text+'写入文档'
assert r['ready']['loads']==1 and r['ready']['exits']==1 and r['ready']['generations']==1
assert r['sent']['generations']==2 and r['sent']['userMessages']==2 and not r['sent']['draft']
assert r['documentBefore']==r['documentAfter'] and r['previewCount']==0
print('Unadjusted production history contains exact visible partial and stopped state; raw BRAVO。 follows current label but fails exact-only formatting.')
