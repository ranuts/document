import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[2];p=root/'docs/evaluations'
r=json.loads((p/'2026-10-05-stop-history-restored-context.json').read_text())
probe=(p/'probe-stop-history-restored-context.mjs').read_bytes()
assert probe==subprocess.check_output(['git','show','90c833d:docs/evaluations/probe-stop-history-restored-context.mjs'],cwd=root)
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
assert r['restoredDraft']==session['messages'][0]['content']
assert r['requestsBeforeSend']==0 and len(r['restoredRequests'])==1
q=r['restoredRequests'][0];assert q['returned']
messages=q['request']['messages'];assert [m['role'] for m in messages]==['system','user','assistant','assistant','user']
assert messages[1:4]==[{k:v for k,v in m.items() if k!='hostGuidance'} for m in session['messages']]
assert messages[-1]['content'].endswith(r['followup'])
text=''.join(c.get('delta',{}).get('content') or '' for chunk in q['chunks'] for c in chunk['choices'])
assert text==r['followupReply']=='钟表'
print('Native recovery draft and unmodified restored context verified; factual follow-up returns clock category 钟表, not the exact old-clock wording.')
