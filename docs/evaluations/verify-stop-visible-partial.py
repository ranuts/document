import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[2];p=root/'docs/evaluations'
r=json.loads((p/'2026-10-05-stop-visible-partial.json').read_text())
assert r['passed'] and r['contextClosed'] and not r['errors'] and not r['guidance']
probe=(p/'probe-stop-visible-partial.mjs').read_bytes()
assert probe==subprocess.check_output(['git','show','328196e:docs/evaluations/probe-stop-visible-partial.mjs'],cwd=root)
assert hashlib.sha256(probe).hexdigest()==r['probeSHA256']
assert hashlib.sha256((root/'dist/assets'/r['plugin']).read_bytes()).hexdigest()==r['pluginSHA256']
a,b=r['sent']['sdk'];assert not a['returned'] and b['returned']
assert a['request']['messages']==a['originalMessages']
original=b['originalMessages'];actual=b['request']['messages']
assert [m['role'] for m in original]==['system','user','user']
assert actual==original[:-1]+[{'role':'assistant','content':r['interruptedVisible']+'\n[已停止。]'},original[-1]]
assert r['sent']['counts'][-1]['messages']==actual
assert 'BRAVO' in actual[-1]['content']
text=''.join(choice.get('delta',{}).get('content') or '' for chunk in b['chunks'] for choice in chunk['choices'])
assert text=='BRAVO.' and r['reply']==text+'写入文档'
assert r['documentBefore']==r['documentAfter'] and r['previewCount']==0
assert r['interruptedVisible'] and '写入文档' not in r['interruptedVisible']
assert r['ready']['generations']==1 and r['ready']['exits']==1
assert r['sent']['generations']==2 and r['sent']['userMessages']==2
print('Actual visible partial insertion and count/completion parity verified; raw reply BRAVO. follows the current label but fails exact-only formatting.')
