"""Verify native trace and exact task parity, not semantic quality."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
folder = root / "docs/evaluations"
bindings = json.loads((folder / "2026-10-07-gemma4-consistent-bindings.json").read_text())
for name, expected in bindings["sourceHashes"].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected
receipt = folder / "2026-10-07-gemma4-consistent-native.json"
assert hashlib.sha256(receipt.read_bytes()).hexdigest() == bindings["receiptSHA256"]
report = json.loads(receipt.read_text())
fixtures = json.loads((folder / "2026-10-07-gemma4-consistent-cases.json").read_text())
candidate = json.loads((folder / "2026-10-05-summary-consistent-candidate.json").read_text())
assert len(report["cases"]) == 4 and report["browserClosed"]
assert bindings["processExitCode"] == 0 and not bindings["semanticAccepted"]
assert report["modelBytes"] == 2841481184
assert report["modelSHA256"] == "8e30dff3ac4c8434c49a7036fa15564bdbb6044e42bf04550bf1a096ad7e6a52"
for index, fixture in enumerate(fixtures):
    pair = report["cases"][index * 2:index * 2 + 2]
    original_messages = None
    parameters = None
    for row, variant in zip(pair, ["product", "consistent"]):
        assert row["prompt"] == fixture and row["variant"] == variant
        assert row["finished"] and row["contextClosed"] and not row["crashed"]
        assert not row.get("error") and not row["errors"] and not row["chatErrors"]
        assert row["previewCount"] == 0
        assert row["modelStatus"] == "CPU · gemma-4-E2B-it-Q4_0.gguf"
        assert row["documentBefore"].rstrip("\r\n") == fixture["source"]
        assert row["selected"].rstrip("\r\n") == fixture["source"]
        assert len(row["sdk"]) == 1 and row["counts"]
        observation = row["sdk"][0]
        request = observation["request"]
        assert row["counts"][-1] == request
        assert request["temperature"] == 0 and request["top_p"] == 0.8 and request["max_tokens"] == 512
        if variant == "product":
            original_messages = observation["originalMessages"]
            assert original_messages == request["messages"]
            parameters = {k: v for k, v in request.items() if k != "messages"}
        else:
            assert observation["originalMessages"] == original_messages
            assert {k: v for k, v in request.items() if k != "messages"} == parameters
            users = [m for m in original_messages if m["role"] == "user"]
            assert len(users) == 1
            lines = [line for line in users[0]["content"].split("\n") if line.startswith('{"task":')]
            assert len(lines) == 1
            assert request["messages"] == [{"role": "system", "content": candidate["system"]}, {"role": "user", "content": lines[0]}]
            task = json.loads(lines[0])
            assert task["task"] == "summarize" and task["targetLanguage"] == "source"
            assert task["text"].rstrip("\r\n") == fixture["source"] and task["instruction"] == fixture["instruction"]
        completion = observation["completion"]
        assert completion["choices"][0]["finish_reason"] == "stop"
        body = json.loads(completion["choices"][0]["message"]["content"])
        assert set(body) == {"text"}
        assert row["documentAfter"].rstrip("\r\n") == body["text"]
        assert row["afterUndo"] == row["documentBefore"] and row["afterRedo"] == row["documentAfter"]
print("Frozen sources, identical task JSON and non-message parameters, final request parity and four native Undo/Redo results verified. Semantic acceptance remains rejected.")
