"""Verify provenance/request/history mechanics; does not certify semantics."""
import json
from pathlib import Path
r = json.loads(Path('docs/evaluations/2026-10-05-default-cpu-consistent.json').read_text())
candidate = json.loads(Path('docs/evaluations/2026-10-05-summary-consistent-candidate.json').read_text())
assert r['browserClosed'] and len(r['cases']) == 4
for row in r['cases']:
    assert row['finished'] and row['contextClosed'] and not row['errors']
    assert not row['chatErrors'] and row['previewCount'] == 0
    assert len(row['sdk']) == 1 and row['counts']
    probe = row['sdk'][0]
    request = probe['request']
    assert row['counts'][-1] == request['messages']
    assert request['response_format']['type'] == 'json_schema'
    users = [m for m in probe['originalMessages'] if m['role'] == 'user']
    assert len(users) == 1
    lines = [line for line in users[0]['content'].split('\n') if line.startswith('{"task":')]
    assert len(lines) == 1
    task = json.loads(lines[0])
    assert task['task'] == 'summarize' and task['targetLanguage'] == 'source'
    assert task['text'].strip() == row['prompt']['source']
    assert task['instruction'] == row['prompt']['instruction']
    if row['variant'] == 'consistent':
        assert request['messages'] == [{'role': 'system', 'content': candidate['system']}, {'role': 'user', 'content': lines[0]}]
    else:
        assert request['messages'] == probe['originalMessages']
    completion = probe['completion']
    raw = completion['choices'][0]['message']['content']
    assert completion['choices'][0]['finish_reason'] == 'stop'
    output = json.loads(raw)['text']
    assert row['documentAfter'].strip() == output.strip()
    assert not row['documentUnchanged']
    assert row['afterUndo'] == row['documentBefore'] and row['afterRedo'] == row['documentAfter']
print('Four real completions; unchanged task JSON, count/completion parity and native history verified. Semantic acceptance remains separate.')
