import hashlib, json, pathlib, subprocess
root=pathlib.Path(__file__).resolve().parents[2]
p=root/'docs/evaluations'
report=json.loads((p/'2026-10-05-summary-relations.json').read_text())
assert report['status']=='completed', report.get('error')
assert len(report['results'])==4
assert report['bundleBytesUnchanged']
assert not report['errors']
probe=(p/'probe-summary-relations.mjs').read_bytes()
assert hashlib.sha256(probe).hexdigest()==report['probeSHA256']
assert probe==subprocess.check_output(['git','show','4b18fa7:docs/evaluations/probe-summary-relations.mjs'],cwd=root)
for name in ['candidate','cases']:
 file='docs/evaluations/2026-10-05-summary-relations-'+name+'.json'
 assert (root/file).read_bytes()==subprocess.check_output(['git','show','e6bf259:'+file],cwd=root)
candidates={'status-single':json.loads((p/'2026-10-05-summary-single-candidate.json').read_text()),'relations':json.loads((p/'2026-10-05-summary-relations-candidate.json').read_text())}
assert report['cases']==json.loads((p/'2026-10-05-summary-relations-cases.json').read_text())
for row in report['results']:
 assert not row['errors'] and row['previewCount']==0
 assert row['raw'] and row['inputs']
 candidate=candidates[row['variant']]
 messages=row['inputs'][0]['request']['messages']
 assert any(m['role']=='system' and m['content'].endswith(candidate['sharedSystemSuffix']) for m in messages)
 assert any(m['role']=='user' and m['content'].endswith(candidate['finalUserSuffix']) for m in messages)
 if not row['documentUnchanged']:assert row['undoExact'] and row['redoExact']
print('Frozen driver/cases, diagnostic completion suffixes and native history checked. Semantic quality requires separate review; count/completion equivalence is not independently certified.')
