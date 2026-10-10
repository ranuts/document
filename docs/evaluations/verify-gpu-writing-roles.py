"""Verify real inference mechanics, not semantic quality."""
import hashlib
import json
from pathlib import Path
root = Path(__file__).parent
probe_hash = hashlib.sha256((root / "probe-gpu-writing-roles.mjs").read_bytes()).hexdigest()
count = 0
for name, expected in (("2026-10-03-gpu-writing-roles.json", 12), ("2026-10-03-gpu-writing-roles-fresh.json", 16)):
    report = json.loads((root / name).read_text())
    assert report["status"] == "completed" and len(report["results"]) == expected
    assert report["probeSHA256"] == probe_hash and report["bundleBytesUnchanged"]
    assert not report["errors"]
    for case in report["cases"]:
        pair = [row for row in report["results"] if row["id"] == case["id"]]
        assert len(pair) == 2 and [row["variant"] for row in pair] == ["current", "roles"]
        requests = []
        for row in pair:
            assert row["previewCount"] == 0 and row["isolated"]
            assert len(row["raw"]) == len(row["inputs"]) == 1
            worker = row["inputs"][0]
            assert worker["modelId"] == [report["modelId"]]
            request = dict(worker["request"])
            messages = request.pop("messages")
            assert request["temperature"] == 0
            payload = json.loads(messages[-1]["content"].split("\n")[-1])
            assert payload["text"] == row["selected"].replace("\r\n", "\n")
            assert payload["instruction"] == case["instruction"] and payload["task"] == case["task"]
            assert len(messages) == 2 and messages[0]["role"] == "system" and messages[1]["role"] == "user"
            if row["variant"] == "roles":
                assert messages[0]["content"].startswith("You are a faithful multilingual document editor.")
            if row["documentUnchanged"]:
                assert row["errors"] and row["output"] == row["selected"]
            else:
                assert not row["errors"] and row["undoExact"] and row["redoExact"]
            requests.append(request)
            count += 1
        assert requests[0] == requests[1]
print(f"{count} rows verified: actual model, unchanged non-message request fields, exact source/instruction, native history and rejection preservation")
