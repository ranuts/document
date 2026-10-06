import hashlib
import json
import re
from pathlib import Path
root=Path(__file__).parent
index=json.loads((root/'2026-10-04-writing-model-decision-index.json').read_text())
assert len(index['rows'])==16
for row in index['rows']:
    p=root/row['report'];r=json.loads(p.read_text());xs=r['results']
    assert hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256']
    assert row['model']==r['modelId'] and row['status']==r['status']
    assert row['recorded']==len(xs) and row['refused']==sum(bool(x['errors']) for x in xs)
    assert row['edited']==sum(not x['documentUnchanged'] for x in xs)
    assert row['acceptedUnchanged']==sum(x['documentUnchanged'] and not x['errors'] for x in xs)
    assert row['recorded']==row['refused']+row['edited']+row['acceptedUnchanged']
    assert not row['qualityAccepted']
print('Sixteen bound reports: counts derived from actual outcomes, no quality-score substitution')

md=(root/'2026-10-04-writing-model-decision-index.md').read_text()
expected=''.join(f"| [{x['model']}]({x['report']}) | {x['status']} | {x['recorded']} | {x['refused']} | {x['edited']} | {x['acceptedUnchanged']} |\n" for x in index['rows'])
assert expected in md, 'All model rows must form one contiguous rendered Markdown table'
assert len({x['report'] for x in index['rows']})==len(index['rows'])

assert len(index['followups']) == 6
assert len({row['report'] for row in index['followups']}) == 6
for row in index['followups']:
    path = root / row['report']
    report = json.loads(path.read_text())
    assert hashlib.sha256(path.read_bytes()).hexdigest() == row['sha256']
    assert row['status'] == report['status'] and row['status'] in ('matched', 'completed')
    assert row['qualityAccepted'] is False
    assert row['report'].replace('.json', '.md') in md
configuration = index['configurationSnapshot']
for name, digest in configuration['sourceHashes'].items():
    assert hashlib.sha256((root.parents[1] / name).read_bytes()).hexdigest() == digest
assert configuration['defaultGPU'] == 'Qwen3-1.7B-q4f16_1-MLC'
assert len(configuration['gpuCandidates']) == 4
assert configuration['defaultGPU'] in configuration['gpuCandidates']
assert '60b85c0e3d8fe0f6474f406922a26d12aca4550d' in configuration['defaultCPU']
web = (root.parents[1] / 'packages/agent-core/src/llm/webllm.ts').read_text()
local = (root.parents[1] / 'packages/agent-core/src/llm/local.ts').read_text()
assert re.search(r"DEFAULT_WEBLLM_MODEL = '([^']+)'", web)[1] == configuration['defaultGPU']
assert re.search(r"DEFAULT_CPU_MODEL_URL =\s*'([^']+)'", local)[1] == configuration['defaultCPU']
assert re.findall(r"\{ id: '([^']+)'", web) == configuration['gpuCandidates']
print('Six follow-up reports and current configuration bound; no default promotion')
