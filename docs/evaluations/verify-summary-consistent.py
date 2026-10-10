import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[2];p=root/'docs/evaluations'
r=json.loads((p/'2026-10-05-summary-consistent.json').read_text())
assert r['status']=='completed',r.get('error')
assert len(r['results'])==4 and not r['errors'] and r['bundleBytesUnchanged']
for commit,name in [('9f49d2f','probe-summary-consistent.mjs'),('f00789a','2026-10-05-summary-consistent-cases.json'),('eb5708e','2026-10-05-summary-consistent-candidate.json')]:
 assert (p/name).read_bytes()==subprocess.check_output(['git','show',commit+':docs/evaluations/'+name],cwd=root)
assert hashlib.sha256((p/'probe-summary-consistent.mjs').read_bytes()).hexdigest()==r['probeSHA256']
assert r['cases']==json.loads((p/'2026-10-05-summary-consistent-cases.json').read_text())
c=json.loads((p/'2026-10-05-summary-consistent-candidate.json').read_text())
for row in r['results']:
 assert row['previewCount']==0 and not row['errors'] and row['raw']
 assert row['counts'] and len(row['inputs'])==1
 messages=row['inputs'][0]['request']['messages']
 assert row['counts'][-1]['messages']==messages
 original=row['inputs'][0]['originalMessages']
 users=[m for m in original if m['role']=='user'];assert len(users)==1
 lines=[line for line in users[0]['content'].split('\n') if line.startswith('{"task":')];assert len(lines)==1
 data=json.loads(lines[0]);assert data['task']=='summarize' and data['targetLanguage']=='source'
 assert data['text'].rstrip('\r\n')==row['source'] and data['instruction']==row['instruction']
 if row['variant']=='consistent':
  assert messages==[{'role':'system','content':c['system']},{'role':'user','content':lines[0]}]
 else:
  assert row['variant']=='relations'
 if not row['documentUnchanged']:assert row['undoExact'] and row['redoExact']
print('Frozen inputs, exact candidate task JSON and counted/completed message parity verified. Semantic quality and numeric token-count accuracy require separate evidence.')
