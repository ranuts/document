"""Verify archived experiment mechanics, not linguistic/semantic quality."""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPORTS = {
    '2026-10-03-cpu-writing-examples.json': (12, {'current', 'examples'}),
    '2026-10-03-cpu-writing-neutral-examples.json': (12, {'current', 'neutral-examples'}),
    '2026-10-03-cpu-writing-neutral-heldout.json': (14, {'current', 'neutral-examples'}),
}

for filename, (expected_count, variants) in REPORTS.items():
    report = json.loads((ROOT / filename).read_text())
    assert report['status'] == 'completed', filename
    assert report['bundleBytesUnchanged'] is True, filename
    assert not report['externalRequests'], filename
    # The system-replacement run had a diagnostic init-script access error on
    # about:blank. It is archived, not silently treated as error-free evidence.
    if filename != '2026-10-03-cpu-writing-examples.json':
        assert not report['errors'], filename
    else:
        assert report['errors'] == ["Failed to read the 'localStorage' property from 'Window': Access is denied for this document."]
    assert 'CPU' in report['engine'] and '0.6B' in report['engine']
    rows = report['results']
    assert len(rows) == expected_count and {row['variant'] for row in rows} == variants
    pairs = {}
    for row in rows:
        assert row['selected'].removesuffix('\r\n') == row['source']
        assert row['previewCount'] == 0 and row['isolated'] is True
        runtime = row['runtime']
        assert runtime['threads'] == 4 and runtime['multithread'] is True and runtime['isolated'] is True
        assert len(row['raw']) == len(row['inputs']) == 1
        captured = row['inputs'][0]
        assert captured['variant'] == row['variant']
        assert captured['request']['text'] == row['selected'].replace('\r\n', '\n')
        assert captured['request']['task'] == row['task']
        assert captured['request']['instruction'] == row['instruction']
        assert (captured['temperature'], captured['topP'], captured['maxTokens']) == (0.7, 0.8, 512)
        schema = captured['schema']
        assert schema['type'] == 'json_schema' and schema['json_schema']['strict'] is True
        assert schema['json_schema']['schema'] == {
            'type': 'object', 'additionalProperties': False,
            'required': ['text'], 'properties': {'text': {'type': 'string'}},
        }
        messages = captured['messages']
        roles = [message['role'] for message in messages]
        assert roles == (['system', 'user'] if row['variant'] == 'current' else ['system', 'user', 'assistant', 'user', 'assistant', 'user'])
        if row['variant'] != 'current':
            assert json.loads(messages[-1]['content']) == captured['request']
            assert captured['request']['text'] not in '\n'.join(message['content'] for message in messages[:-1])
        assert row['raw'][0]['stopReason'] == 'stop'
        assert row['raw'][0]['usage']['completionTokens'] > 0
        parsed = json.loads(row['raw'][0]['text'])
        assert isinstance(parsed['text'], str)
        assert row['documentUnchanged'] == (row['output'] == row['selected'])
        if row['documentUnchanged']:
            assert row['errors'], (filename, row['id'])
        else:
            assert not row['errors'] and row['undoExact'] and row['redoExact']
            assert row['undoText'] == row['selected'] and row['redoText'] == row['output']
            assert row['output'].removesuffix('\r\n') == parsed['text']
        pair = pairs.setdefault((row['id'], row['repetition']), {})
        assert row['variant'] not in pair
        pair[row['variant']] = captured
    for pair in pairs.values():
        assert set(pair) == variants
        control = pair['current']
        for variant, candidate in pair.items():
            assert candidate['request'] == control['request'] and candidate['schema'] == control['schema']
            if variant == 'neutral-examples':
                assert candidate['messages'][0] == control['messages'][0]
    counts = Counter(row['variant'] for row in rows if not row['documentUnchanged'])
    print(filename, 'mechanics verified;', dict(counts), 'native applications; NOT quality passes')
