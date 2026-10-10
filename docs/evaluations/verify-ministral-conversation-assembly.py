import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parents[2]
base = root / 'docs/evaluations'
report = json.loads((base / '2026-10-04-ministral-conversation-assembly.json').read_text())
assert hashlib.sha256((base / 'probe-ministral-conversation-assembly.mjs').read_bytes()).hexdigest() == report['probeSHA256']
sdk = (root / 'packages/agent-core/node_modules/@mlc-ai/web-llm/lib/index.js').read_bytes()
assert hashlib.sha256(sdk).hexdigest() == report['sdkSHA256']
assert hashlib.sha256(sdk + b'\nexport {getConversationFromChatCompletionRequest as DiagnosticConversation};\n').hexdigest() == report['instrumentedSHA256']
for filename, key in [('2026-10-04-ministral-writing-semantic-pairs.json', 'baselineSHA256'), ('2026-10-04-local-writing-model-candidates.json', 'catalogSHA256')]:
    assert hashlib.sha256((base / filename).read_bytes()).hexdigest() == report[key]
baseline = json.loads((base / '2026-10-04-ministral-writing-semantic-pairs.json').read_text())
assert len(report['results']) == 6
for row, original in zip(report['results'], baseline['results']):
    assert row['id'] == original['id'] and row['systemPrefixTokenIds'] == [1]
    messages = original['inputs'][0]['request']['messages']
    assert len(messages) == 2
    assert row['prompts'] == [
        '[SYSTEM_PROMPT]' + messages[0]['content'] + '[/SYSTEM_PROMPT]{function_string}',
        '[INST]' + messages[1]['content'] + '[/INST]',
        '',
    ]
    assert row['unexpandedFunctionPlaceholder'] is True
print('PASS: six exact SDK prompt reconstructions retain unexpanded function placeholder')
