import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[2];p=root/'docs/evaluations'
r=json.loads((p/'2026-10-05-stop-history-durable.json').read_text())
probe=(p/'probe-stop-history-durable.mjs').read_bytes()
assert probe==subprocess.check_output(['git','show','e64e90b:docs/evaluations/probe-stop-history-durable.mjs'],cwd=root)
assert hashlib.sha256(probe).hexdigest()==r['probeSHA256']
assert hashlib.sha256((root/'dist/assets'/r['plugin']).read_bytes()).hexdigest()==r['pluginSHA256']
assert r['passed'] and r['contextClosed'] and r['savingAfterReload']
assert not r['errors'] and not r['guidance'] and not r['previewCount']
assert r['documentBefore']==r['documentAfter']
assert r['interruptedVisible'] and r['interruptedVisible']==r['beforeReload']==r['afterReload']
export=r['exported'];assert export['activeId']==r['activeId']
session=next(s for s in export['sessions'] if s['id']==r['activeId'])
assert len(session['messages'])==3
assert session['messages'][0]['role']=='user'
assert session['messages'][1]=={'role':'assistant','content':r['interruptedVisible']}
assert session['messages'][2]=={'role':'assistant','content':'已停止。','hostGuidance':'status'}
assert r['restoredRows']==[session['messages'][0]['content'],r['interruptedVisible']+'写入文档','已停止。恢复请求']
print('Exact interrupted partial and separate stopped status verified in native export and page-reload restored rows; document unchanged.')
