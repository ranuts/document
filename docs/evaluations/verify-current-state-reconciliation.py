"""Check bindings and narrow claims; not a completion or semantic-quality gate."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
record = json.loads((ROOT / 'docs/evaluations/2026-10-05-current-state-reconciliation.json').read_text())
assert record['qualityAccepted'] is False
assert record['freshBrowserRuns'] == 0
for group in ('sourceHashes', 'archivedEvidenceHashes'):
    for name, expected in record[group].items():
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected, name
index = json.loads((ROOT / 'docs/evaluations/2026-10-04-writing-model-decision-index.json').read_text())
assert len(index['rows']) == 16
assert len(index['followups']) == 6
assert all(row['qualityAccepted'] is False for row in index['rows'] + index['followups'])
provider = (ROOT / 'packages/agent-core/src/llm/wllama.ts').read_text()
assert 'engine.countChatTokens!(request)' in provider
assert 'request.max_tokens + 1' in provider
print('Current source and archived evidence bindings match; 16 + 6 reports, no quality acceptance or fresh browser claim')
